#!/usr/bin/env node
// scripts/blog-publisher/watchdog.cjs
//
// Fires after every Weekly Blog Publisher run, every Netlify deploy,
// and on its own schedule. Detects breakage in the blog automation
// pipeline and auto-fixes what it can safely fix.
//
// Auto-fixes (require ACTIONS_PAT for cross-workflow triggers):
//   - Orphan branch (publisher pushed but PR creation failed) → open recovery PR
//   - Publisher transient failure → run publisher logic inline (no PAT needed)
//   - Deploy transient failure → re-trigger netlify-deploy.yml (PAT)
//   - Rejected PR's branch lingering >7d → delete branch
//   - Missed weekly cron → trigger publisher inline (no PAT)
//   - Workflow auto-disabled by inactivity → re-enable (PAT)
//
// Notify-only:
//   - Stale open PR >72h, topic queue ≤4, queue empty, repo perms drift,
//     live site/sitemap missing slug, deterministic validation failures.
//
// No persistent state file. All state derived from gh API.

const { execSync, execFileSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

const REPO = 'yorkisestevez/goldenmaplelandscaping';
const SITE_URL = 'https://goldenmaplelandscaping.ca';
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;
const SCRIPT_DIR = __dirname;
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');

const STALE_PR_HOURS = 72;
const LOW_QUEUE_THRESHOLD = 4;
const REJECTED_BRANCH_AGE_DAYS = 7;
const MAX_AUTO_RETRIES_PER_DAY = 1;
const ORPHAN_BRANCH_MIN_AGE_MIN = 10;       // grace period — publisher might still be running

// =============================================================================
// Trigger context (parsed from env vars set in the workflow YAML)
// =============================================================================

const trigger = {
  event:        process.env.WORKFLOW_EVENT || 'workflow_dispatch',
  upstreamName: process.env.WORKFLOW_RUN_NAME || '',
  upstreamConc: process.env.WORKFLOW_RUN_CONCLUSION || '',
  upstreamId:   process.env.WORKFLOW_RUN_ID || '',
  upstreamSha:  process.env.WORKFLOW_RUN_HEAD_SHA || '',
  scheduleCron: process.env.SCHEDULE_CRON || '',
  verbose:      process.env.VERBOSE === 'true',
};

const HAS_PAT = !!process.env.ACTIONS_PAT;

// =============================================================================
// gh CLI + HTTP helpers
// =============================================================================

function gh(args, opts = {}) {
  const env = { ...process.env };
  // For PAT-required operations, allow override by setting USE_PAT=1
  if (opts.usePat && HAS_PAT) env.GH_TOKEN = process.env.ACTIONS_PAT;
  return execSync(`gh ${args}`, { encoding: 'utf8', env, cwd: REPO_ROOT }).trim();
}

function ghJson(args, opts = {}) {
  const out = gh(args, opts);
  try { return JSON.parse(out); }
  catch (e) { throw new Error(`gh JSON parse failed for [${args}]: ${e.message}\nraw: ${out.slice(0, 400)}`); }
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'GET', timeout: 15000 },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function telegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) { console.warn('[watchdog] no telegram secrets'); return; }
  return new Promise((resolve) => {
    const data = `chat_id=${encodeURIComponent(chatId)}&text=${encodeURIComponent(text)}&disable_web_page_preview=true`;
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 15000,
      },
      () => resolve()
    );
    req.on('error', () => resolve());
    req.on('timeout', () => { req.destroy(); resolve(); });
    req.write(data);
    req.end();
  });
}

// =============================================================================
// Date helpers
// =============================================================================

function nowIso() { return new Date().toISOString(); }
function today() { return nowIso().slice(0, 10); }
function ageHours(iso) { return (Date.now() - new Date(iso).getTime()) / 3600000; }
function ageDays(iso) { return ageHours(iso) / 24; }

// =============================================================================
// Checks
// =============================================================================

// Detect branches matching auto/blog-* that have NO open PR.
// Split into two classes:
//   - true orphans (push succeeded, PR never opened) → recover
//   - confirmed-rejected (PR was opened + closed unmerged) → cleanup eligible
async function checkOrphanBranches(findings) {
  let branches;
  try { branches = ghJson(`api 'repos/${REPO}/branches?per_page=100'`); }
  catch (e) { findings.push({ severity: 'low', kind: 'branches_read_err', message: 'Could not list branches: ' + e.message }); return; }

  const autoBranches = branches.filter((b) => b.name.startsWith('auto/blog-'));
  if (!autoBranches.length) return;

  // Pull all PRs (any state) whose head ref starts with auto/blog-.
  // Note: `merged` is not a valid --json field; use `mergedAt` (null if not merged).
  let allPrs;
  try { allPrs = ghJson(`pr list --repo ${REPO} --state all --search 'head:auto/blog-' --json number,state,headRefName,mergedAt,closedAt --limit 200`); }
  catch (e) { findings.push({ severity: 'low', kind: 'prs_read_err', message: 'Could not list PRs: ' + e.message }); return; }

  const prsByHead = new Map();
  for (const pr of allPrs) {
    if (!prsByHead.has(pr.headRefName)) prsByHead.set(pr.headRefName, []);
    prsByHead.get(pr.headRefName).push(pr);
  }

  for (const b of autoBranches) {
    const prs = prsByHead.get(b.name) || [];
    const openPr = prs.find((p) => p.state === 'OPEN');
    if (openPr) continue;  // healthy — operator just hasn't merged yet

    // Get branch commit details to compute age
    let commit;
    try { commit = ghJson(`api repos/${REPO}/commits/${b.commit.sha}`); }
    catch { continue; }
    const commitAt = commit.commit?.committer?.date || commit.commit?.author?.date;
    if (!commitAt) continue;
    const ageMin = ageHours(commitAt) * 60;

    if (prs.length === 0) {
      // True orphan — no PR ever created. Recover.
      if (ageMin < ORPHAN_BRANCH_MIN_AGE_MIN) continue;  // grace period
      findings.push({
        severity: 'high',
        kind: 'orphan_branch',
        branch: b.name,
        sha: b.commit.sha,
        message: `Orphan branch ${b.name} has no PR (publisher likely failed at gh pr create).`,
        autofix: async () => autofixOrphanBranch(b.name),
        needsPat: true,
      });
    } else if (prs.every((p) => p.state === 'CLOSED' && !p.mergedAt)) {
      // PR opened and closed without merge → rejected. Clean up if old enough.
      const closedAt = prs.map((p) => p.closedAt).filter(Boolean).sort().pop();
      if (closedAt && ageDays(closedAt) >= REJECTED_BRANCH_AGE_DAYS) {
        findings.push({
          severity: 'low',
          kind: 'stale_rejected_branch',
          branch: b.name,
          message: `Rejected branch ${b.name} (closed ${Math.round(ageDays(closedAt))}d ago) eligible for cleanup.`,
          autofix: async () => autofixDeleteBranch(b.name),
          needsPat: false,
        });
      }
    }
  }
}

// Check for stale open PRs from the publisher (>72h)
async function checkStaleOpenPRs(findings) {
  let prs;
  try { prs = ghJson(`pr list --repo ${REPO} --state open --json number,title,headRefName,createdAt,url --search 'head:auto/blog-' --limit 50`); }
  catch (e) { findings.push({ severity: 'low', kind: 'pr_list_err', message: e.message }); return; }
  for (const pr of prs) {
    const age = ageHours(pr.createdAt);
    if (age > STALE_PR_HOURS) {
      findings.push({
        severity: 'medium',
        kind: 'stale_open_pr',
        prNumber: pr.number,
        message: `Open PR #${pr.number} has been waiting ${Math.round(age)}h — tap Merge or close to reject. ${pr.url}`,
      });
    }
  }
}

// Check the last publisher run — categorize failure as transient/deterministic
async function checkLastPublisherRun(findings) {
  let runs;
  try { runs = ghJson(`run list --repo ${REPO} --workflow=blog-publisher.yml --json conclusion,databaseId,createdAt,event,url --limit 5`); }
  catch (e) { findings.push({ severity: 'low', kind: 'runs_read_err', message: e.message }); return; }
  if (!runs.length) return;
  const last = runs[0];
  if (last.conclusion !== 'failure') return;

  // Don't retry if there's already an open publisher PR — operator hasn't merged yet
  const openPrs = ghJson(`pr list --repo ${REPO} --state open --search 'head:auto/blog-' --json number --limit 10`);
  if (openPrs.length > 0) {
    findings.push({
      severity: 'medium',
      kind: 'publisher_failed_with_open_pr',
      message: `Last publisher run failed (${last.url}) but ${openPrs.length} open PR(s) exist — retry suppressed.`,
    });
    return;
  }

  // Retry cap: count workflow_dispatch retries in last 24h
  const retriesIn24h = runs.filter(
    (r) => r.event === 'workflow_dispatch' && ageHours(r.createdAt) < 24
  ).length;
  const canRetry = retriesIn24h < MAX_AUTO_RETRIES_PER_DAY;

  findings.push({
    severity: 'high',
    kind: 'publisher_failed',
    message: `Last publisher run failed (${last.url}). ${canRetry ? 'Attempting inline retry.' : 'Daily retry cap reached.'}`,
    autofix: canRetry ? async () => autofixPublisherRetry() : null,
    needsPat: false,
  });
}

// Check the last deploy run — same logic
async function checkLastDeployRun(findings) {
  let runs;
  try { runs = ghJson(`run list --repo ${REPO} --workflow=netlify-deploy.yml --json conclusion,databaseId,createdAt,event,url --limit 5`); }
  catch (e) { findings.push({ severity: 'low', kind: 'deploy_runs_err', message: e.message }); return; }
  if (!runs.length) return;
  const last = runs[0];
  if (last.conclusion !== 'failure') return;

  const retriesIn24h = runs.filter(
    (r) => r.event === 'workflow_dispatch' && ageHours(r.createdAt) < 24
  ).length;
  const canRetry = retriesIn24h < MAX_AUTO_RETRIES_PER_DAY && HAS_PAT;

  findings.push({
    severity: 'high',
    kind: 'deploy_failed',
    message: `Last deploy failed (${last.url}). ${
      !HAS_PAT
        ? 'ACTIONS_PAT not set — cannot auto-retry. Paste to retry: gh workflow run netlify-deploy.yml --repo ' + REPO
        : canRetry
          ? 'Re-triggering.'
          : 'Daily retry cap reached.'
    }`,
    autofix: canRetry ? async () => autofixDeployRetry() : null,
    needsPat: true,
  });
}

// Topic queue health
async function checkTopicQueue(findings) {
  const topicsPath = path.join(SCRIPT_DIR, 'topics.json');
  const statePath = path.join(SCRIPT_DIR, 'state.json');
  if (!fs.existsSync(topicsPath) || !fs.existsSync(statePath)) return;
  const topics = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const used = new Set(state.usedTopicIds || []);
  const remaining = (topics.topics || []).filter((t) => !used.has(t.id)).length;

  if (remaining === 0) {
    findings.push({
      severity: 'high',
      kind: 'queue_empty',
      message: `Topic queue is EMPTY — next publisher run will fail. Refill scripts/blog-publisher/topics.json.`,
    });
  } else if (remaining <= LOW_QUEUE_THRESHOLD) {
    findings.push({
      severity: 'medium',
      kind: 'queue_low',
      message: `Topic queue running low: ${remaining} topic(s) remaining (~${remaining} weeks of content).`,
    });
  }
}

// Live site responding
async function checkLiveSite(findings) {
  try {
    const r = await httpsGet(SITE_URL);
    if (r.status !== 200) {
      findings.push({
        severity: 'high',
        kind: 'site_down',
        message: `Live site ${SITE_URL} returned status ${r.status}`,
      });
    }
  } catch (e) {
    findings.push({ severity: 'high', kind: 'site_unreachable', message: `Site unreachable: ${e.message}` });
  }
}

// After a successful deploy, verify the latest published blog slug is in sitemap.xml.
// Sitemap is server-rendered (NOT a React route) so this proves the new build deployed.
async function checkLatestSlugInSitemap(findings) {
  const statePath = path.join(SCRIPT_DIR, 'state.json');
  if (!fs.existsSync(statePath)) return;
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const slugs = state.publishedSlugs || [];
  if (!slugs.length) return;
  const latest = slugs[slugs.length - 1];

  try {
    const r = await httpsGet(SITEMAP_URL);
    if (r.status !== 200) {
      findings.push({ severity: 'high', kind: 'sitemap_unreachable', message: `sitemap.xml returned ${r.status}` });
      return;
    }
    if (!r.body.includes(`/resources/${latest}`)) {
      findings.push({
        severity: 'high',
        kind: 'slug_missing_from_sitemap',
        message: `Latest published slug "${latest}" not found in live sitemap.xml — deploy may not have completed correctly.`,
      });
    }
  } catch (e) {
    findings.push({ severity: 'low', kind: 'sitemap_check_err', message: e.message });
  }
}

// Did Monday's cron fire? Look for any scheduled run in last 7 days.
async function checkMissedCron(findings) {
  let runs;
  try { runs = ghJson(`run list --repo ${REPO} --workflow=blog-publisher.yml --json conclusion,createdAt,event --limit 50`); }
  catch { return; }
  const scheduled = runs.filter((r) => r.event === 'schedule');
  const recentScheduled = scheduled.find((r) => ageDays(r.createdAt) < 7);
  if (recentScheduled) return;  // good — fired within last week

  // Only alert if at least one Monday has passed since the last scheduled run
  const lastScheduled = scheduled[0];
  if (!lastScheduled || ageDays(lastScheduled.createdAt) > 8) {
    const retriesIn24h = runs.filter(
      (r) => r.event === 'workflow_dispatch' && ageHours(r.createdAt) < 24
    ).length;
    const canCatchup = retriesIn24h < MAX_AUTO_RETRIES_PER_DAY;
    findings.push({
      severity: 'high',
      kind: 'missed_cron',
      message: `No scheduled publisher run in ${
        lastScheduled ? Math.round(ageDays(lastScheduled.createdAt)) + 'd' : '7+ days'
      }. ${canCatchup ? 'Triggering catch-up.' : 'Daily catchup cap reached.'}`,
      autofix: canCatchup ? async () => autofixPublisherRetry() : null,
      needsPat: false,
    });
  }
}

// Workflows auto-disabled by inactivity?
async function checkWorkflowsEnabled(findings) {
  for (const wf of ['blog-publisher.yml', 'netlify-deploy.yml', 'blog-watchdog.yml']) {
    try {
      const info = ghJson(`api repos/${REPO}/actions/workflows/${wf}`);
      if (info.state && info.state !== 'active') {
        findings.push({
          severity: 'high',
          kind: 'workflow_disabled',
          workflow: wf,
          message: `Workflow ${wf} state=${info.state}. ${
            HAS_PAT ? 'Re-enabling.' : 'ACTIONS_PAT required to re-enable.'
          }`,
          autofix: HAS_PAT ? async () => autofixEnableWorkflow(wf) : null,
          needsPat: true,
        });
      }
    } catch { /* ignore — workflow may not exist yet on first deploy of watchdog */ }
  }
}

// Repo workflow_permissions drift — the 2026-05-25 root cause
async function checkRepoPerms(findings) {
  try {
    const perms = ghJson(`api repos/${REPO}/actions/permissions/workflow`);
    if (perms.default_workflow_permissions !== 'write' || !perms.can_approve_pull_request_reviews) {
      findings.push({
        severity: 'high',
        kind: 'perms_drift',
        message:
          `Repo Actions perms drifted: default_workflow_permissions=${perms.default_workflow_permissions}, ` +
          `can_approve_pull_request_reviews=${perms.can_approve_pull_request_reviews}. ` +
          `Future publisher runs will fail at gh pr create. ` +
          `Fix: gh api -X PUT repos/${REPO}/actions/permissions/workflow ` +
          `--field default_workflow_permissions=write --field can_approve_pull_request_reviews=true`,
      });
    }
  } catch { /* ignore */ }
}

// =============================================================================
// Autofixes
// =============================================================================

async function autofixOrphanBranch(branch) {
  if (!HAS_PAT) {
    return `would open recovery PR for ${branch} but ACTIONS_PAT not set — needed so merge triggers deploy. Paste: gh pr create --repo ${REPO} --base main --head "${branch}" --title "[blog] recovered: ${branch}" --body "Auto-recovery from orphan branch."`;
  }
  const slug = branch.replace(/^auto\/blog-\d{4}-\d{2}-\d{2}-/, '');
  const title = `[blog] recovered: ${slug}`;
  const body = `Watchdog opened this PR after detecting an orphan branch (publisher pushed but \`gh pr create\` failed). Generated content is on this branch — review and merge to publish at https://goldenmaplelandscaping.ca/resources/${slug}.\n\nClosing without merging rejects.`;
  const url = gh(`pr create --repo ${REPO} --base main --head "${branch}" --title ${JSON.stringify(title)} --body ${JSON.stringify(body)}`, { usePat: true });
  return `opened recovery PR ${url}`;
}

async function autofixDeleteBranch(branch) {
  gh(`api -X DELETE repos/${REPO}/git/refs/heads/${encodeURIComponent(branch)}`);
  return `deleted branch ${branch}`;
}

async function autofixDeployRetry() {
  gh(`workflow run netlify-deploy.yml --repo ${REPO}`, { usePat: true });
  return `re-triggered netlify-deploy.yml`;
}

async function autofixEnableWorkflow(wf) {
  gh(`api -X PUT repos/${REPO}/actions/workflows/${wf}/enable`, { usePat: true });
  return `re-enabled workflow ${wf}`;
}

// Inline publisher retry — uses GITHUB_TOKEN since the publisher workflow itself
// is the one being retried (we're effectively replaying its logic from the watchdog
// runner instead of re-triggering the upstream workflow).
//
// This requires GEMINI_API_KEY + the cli.cjs's workflow-run command to be invokable.
async function autofixPublisherRetry() {
  try {
    // Defense: before retrying, sweep for orphan branches from today and delete
    // them. Avoids race where retry creates a duplicate branch.
    const branches = ghJson(`api 'repos/${REPO}/branches?per_page=100'`);
    const todayBranches = branches
      .map((b) => b.name)
      .filter((n) => n.startsWith(`auto/blog-${today()}-`));
    for (const b of todayBranches) {
      try { gh(`api -X DELETE repos/${REPO}/git/refs/heads/${encodeURIComponent(b)}`); }
      catch (e) { /* benign — may not exist */ }
    }

    // Invoke the publisher's existing entry point. It reads GEMINI_API_KEY +
    // TELEGRAM_* + GH_TOKEN from env (we pass them through from the workflow).
    execFileSync('node', [path.join(SCRIPT_DIR, 'cli.cjs'), 'workflow-run'], {
      env: process.env,
      stdio: 'inherit',
      cwd: REPO_ROOT,
    });
    return `publisher retry completed (check Actions tab for the PR)`;
  } catch (e) {
    throw new Error(`publisher retry FAILED: ${e.message}`);
  }
}

// =============================================================================
// Dispatch: which checks run for which trigger
// =============================================================================

async function runChecks() {
  const findings = [];

  // Trigger-specific gates
  if (trigger.event === 'workflow_run') {
    // Skip skipped/cancelled — they fire 'completed' too
    if (['skipped', 'cancelled'].includes(trigger.upstreamConc)) {
      console.log(`[watchdog] upstream conclusion=${trigger.upstreamConc}, skipping`);
      return { findings, skipReason: 'upstream_inert' };
    }

    if (trigger.upstreamName === 'Weekly Blog Publisher') {
      // Publisher just ran (success or failure)
      if (trigger.upstreamConc === 'success') {
        // Self-Telegrams already happened — no-op unless verbose
        if (!trigger.verbose) return { findings };
        await checkLiveSite(findings);
        await checkTopicQueue(findings);
      } else {
        await checkOrphanBranches(findings);
        await checkLastPublisherRun(findings);
      }
    } else if (trigger.upstreamName === 'Deploy to Netlify on main') {
      if (trigger.upstreamConc === 'success') {
        await checkLatestSlugInSitemap(findings);
        await checkLiveSite(findings);
      } else {
        await checkLastDeployRun(findings);
      }
    }
    return { findings };
  }

  // Schedule / dispatch → run a fuller sweep
  await checkOrphanBranches(findings);
  await checkLastPublisherRun(findings);
  await checkLastDeployRun(findings);
  await checkStaleOpenPRs(findings);
  await checkTopicQueue(findings);
  await checkLiveSite(findings);
  await checkWorkflowsEnabled(findings);
  await checkRepoPerms(findings);
  if (trigger.scheduleCron === '0 16 * * 1' || trigger.event === 'workflow_dispatch') {
    await checkMissedCron(findings);
  }
  return { findings };
}

// =============================================================================
// Apply autofixes + Telegram report
// =============================================================================

async function applyAutofixes(findings) {
  const applied = [];
  for (const f of findings) {
    if (typeof f.autofix !== 'function') continue;
    try {
      const result = await f.autofix();
      applied.push({ kind: f.kind, result });
      f.fixed = true;
      f.fixResult = result;
    } catch (e) {
      f.fixError = e.message;
      applied.push({ kind: f.kind, result: `FAILED: ${e.message}` });
    }
  }
  return applied;
}

function buildReport(findings, applied) {
  const fixed = findings.filter((f) => f.fixed);
  const high = findings.filter((f) => f.severity === 'high' && !f.fixed);
  const medium = findings.filter((f) => f.severity === 'medium' && !f.fixed);

  const lines = [];

  if (fixed.length) {
    lines.push('✅ Blog watchdog auto-fixed:');
    for (const f of fixed) lines.push(`  • ${f.kind}: ${f.fixResult}`);
    lines.push('');
  }

  if (high.length) {
    lines.push('🚨 Needs attention:');
    for (const f of high) lines.push(`  • ${f.message}`);
    lines.push('');
  }

  if (medium.length) {
    lines.push('🟡 FYI:');
    for (const f of medium) lines.push(`  • ${f.message}`);
    lines.push('');
  }

  if (!lines.length && trigger.verbose) {
    // Verbose mode → emit "all green" summary
    return buildAllGreen();
  }

  if (!lines.length) return null;

  lines.unshift(`🔍 Blog watchdog (${trigger.event}${trigger.upstreamName ? ' → ' + trigger.upstreamName : ''})`);
  return lines.join('\n').trim();
}

function buildAllGreen() {
  const lines = ['✅ Blog watchdog — all systems green'];
  try {
    const statePath = path.join(SCRIPT_DIR, 'state.json');
    const topicsPath = path.join(SCRIPT_DIR, 'topics.json');
    if (fs.existsSync(statePath) && fs.existsSync(topicsPath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      const topics = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
      const used = new Set(state.usedTopicIds || []);
      const remaining = (topics.topics || []).filter((t) => !used.has(t.id)).length;
      lines.push(`  • Topic queue: ${remaining} remaining`);
      lines.push(`  • Published so far: ${(state.publishedSlugs || []).length}`);
      if (state.lastRunAt) lines.push(`  • Last publisher run: ${state.lastRunAt}`);
    }
    lines.push(`  • Live site: ${SITE_URL}`);
    lines.push(`  • PAT: ${HAS_PAT ? 'configured' : 'NOT set — auto-fix degraded for deploy retry & workflow enable'}`);
  } catch { /* best effort */ }
  return lines.join('\n');
}

// =============================================================================
// Entry
// =============================================================================

async function main() {
  console.log(`[watchdog] starting — event=${trigger.event} upstream=${trigger.upstreamName} conc=${trigger.upstreamConc} verbose=${trigger.verbose} pat=${HAS_PAT}`);

  const { findings, skipReason } = await runChecks();
  if (skipReason) { console.log(`[watchdog] skipped: ${skipReason}`); return; }

  const applied = await applyAutofixes(findings);

  const report = buildReport(findings, applied);
  if (report) {
    console.log('---\n' + report + '\n---');
    await telegram(report);
  } else {
    console.log('[watchdog] no findings, no notification');
  }

  console.log(JSON.stringify({
    findings: findings.length,
    high: findings.filter((f) => f.severity === 'high').length,
    medium: findings.filter((f) => f.severity === 'medium').length,
    autofixed: applied.length,
  }));
}

main().catch(async (e) => {
  console.error('[watchdog] FATAL:', e.message);
  await telegram(`🚨 Blog watchdog ITSELF crashed: ${e.message}`);
  process.exit(1);
});
