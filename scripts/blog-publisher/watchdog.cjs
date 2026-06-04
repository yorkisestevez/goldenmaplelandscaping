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
const LOW_QUEUE_THRESHOLD = 4;            // critical — auto-refill, may miss next Monday
const QUEUE_REFILL_THRESHOLD = 8;         // medium — start refill PR while there's runway
const REJECTED_BRANCH_AGE_DAYS = 7;
const MAX_AUTO_RETRIES_PER_DAY = 1;
const ORPHAN_BRANCH_MIN_AGE_MIN = 10;     // grace period — publisher might still be running

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

// Open-PR nudge with escalating severity:
//   0-24h:  silent (just opened, give operator time)
//   24-72h: medium (daily nudge in the daily sweep)
//   >72h:   high (stale — action needed)
async function checkStaleOpenPRs(findings) {
  let prs;
  try { prs = ghJson(`pr list --repo ${REPO} --state open --json number,title,headRefName,createdAt,url --search 'head:auto/blog-' --limit 50`); }
  catch (e) { findings.push({ severity: 'low', kind: 'pr_list_err', message: e.message }); return; }
  for (const pr of prs) {
    const age = ageHours(pr.createdAt);
    if (age < 24) continue;  // just opened — silent
    const severity = age > STALE_PR_HOURS ? 'high' : 'medium';
    const label = age > STALE_PR_HOURS ? 'STALE' : 'awaiting merge';
    findings.push({
      severity,
      kind: severity === 'high' ? 'stale_open_pr' : 'pending_open_pr',
      prNumber: pr.number,
      message: `${label}: PR #${pr.number} open for ${Math.round(age)}h — ${pr.title.slice(0, 60)} → ${pr.url}`,
    });
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

// Topic queue health — also triggers auto-refill when nearing exhaustion
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
      message: `Topic queue is EMPTY — next publisher run will fail. Auto-suggester firing.`,
      autofix: async () => autofixSuggestTopics(),
      needsPat: true,
    });
  } else if (remaining <= LOW_QUEUE_THRESHOLD) {
    // ≤4: high-urgency (might miss a Monday) — auto-refill
    findings.push({
      severity: 'high',
      kind: 'queue_critical',
      message: `Topic queue critical: ${remaining} topic(s) remaining. Auto-suggester firing.`,
      autofix: async () => autofixSuggestTopics(),
      needsPat: true,
    });
  } else if (remaining <= QUEUE_REFILL_THRESHOLD) {
    // ≤8: comfortable runway but trigger refill — also auto, no urgency
    // Only auto-fire if no recent refill PR is already open (idempotent)
    findings.push({
      severity: 'medium',
      kind: 'queue_low',
      message: `Topic queue running low: ${remaining} topic(s) remaining (~${remaining} weeks of content). Auto-suggester firing.`,
      autofix: async () => autofixSuggestTopics(),
      needsPat: true,
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

// SEO artifact verifier — confirms the AI-engine + Google citation surface
// is intact on the live site. Catches: robots.txt regression (lost AI bot
// allowances), llms.txt deleted/corrupted, IndexNow key file removed (kills
// IndexNow pings). Runs on daily 02:00 UTC sweep only.
async function checkSeoArtifacts(findings) {
  const requiredBots = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'CCBot'];
  try {
    const r = await httpsGet(`${SITE_URL}/robots.txt`);
    if (r.status !== 200) {
      findings.push({ severity: 'high', kind: 'robots_missing', message: `robots.txt returned ${r.status} — AI crawler config gone` });
    } else {
      const missing = requiredBots.filter((b) => !new RegExp(`User-agent:\\s*${b}`, 'i').test(r.body));
      if (missing.length) {
        findings.push({
          severity: 'high',
          kind: 'robots_ai_bots_missing',
          message: `robots.txt missing AI bot allowances: ${missing.join(', ')} — AI engine citation degraded`,
        });
      }
    }
  } catch (e) {
    findings.push({ severity: 'medium', kind: 'robots_check_err', message: `robots.txt unreachable: ${e.message}` });
  }

  try {
    const r = await httpsGet(`${SITE_URL}/llms.txt`);
    if (r.status !== 200) {
      findings.push({ severity: 'high', kind: 'llmstxt_missing', message: `llms.txt returned ${r.status}` });
    } else if (!r.body.includes('Yorkis Estevez') || !r.body.includes('Golden Maple Landscaping')) {
      findings.push({
        severity: 'medium',
        kind: 'llmstxt_corrupted',
        message: 'llms.txt is reachable but missing founder name or company name — content may have rotted',
      });
    }
  } catch (e) {
    findings.push({ severity: 'medium', kind: 'llmstxt_check_err', message: `llms.txt unreachable: ${e.message}` });
  }

  const indexnowKey = 'bdc5de0d5ef8e208d6e1aea168f008d7';
  try {
    const r = await httpsGet(`${SITE_URL}/${indexnowKey}.txt`);
    if (r.status !== 200) {
      findings.push({
        severity: 'high',
        kind: 'indexnow_key_missing',
        message: `IndexNow key file /${indexnowKey}.txt returned ${r.status} — post-deploy pings to Bing/Yandex will fail`,
      });
    } else if (r.body.trim() !== indexnowKey) {
      findings.push({
        severity: 'high',
        kind: 'indexnow_key_mismatch',
        message: `IndexNow key file contents don't match expected key — Bing/Yandex pings will be rejected`,
      });
    }
  } catch (e) {
    findings.push({ severity: 'low', kind: 'indexnow_check_err', message: `IndexNow key probe failed: ${e.message}` });
  }
}

// Rot scanner — fetches 3 random live posts from sitemap, parses for internal
// links + image refs, checks each returns 200. Catches link/image rot on old
// posts that other checks would miss. ALSO verifies any auto-generated post
// (those created 2026-06-04+) has the SEO upgrade artifacts: Quick Answer
// box markup, About the Author block, BreadcrumbList schema. Catches the
// case where a future edit regresses the template.
// Runs on daily 02:00 UTC sweep only.
async function checkPostRot(findings) {
  let sitemapBody;
  try {
    const r = await httpsGet(SITEMAP_URL);
    if (r.status !== 200) return;
    sitemapBody = r.body;
  } catch { return; }

  // Extract all live /resources/* URLs from sitemap
  const urls = Array.from(new Set((sitemapBody.match(/https:\/\/goldenmaplelandscaping\.ca\/resources\/[a-z0-9-]+/g) || [])));
  if (!urls.length) return;

  // Sample up to 3 at random — full crawl would be 19+ HTTP calls per daily run
  const sample = urls.sort(() => Math.random() - 0.5).slice(0, 3);
  console.log(`[rot-scan] checking ${sample.length} of ${urls.length} live posts`);

  for (const postUrl of sample) {
    let html;
    try {
      const r = await httpsGet(postUrl);
      if (r.status !== 200) {
        findings.push({
          severity: 'high',
          kind: 'post_unreachable',
          message: `Live post ${postUrl} returned ${r.status} — broken in production`,
        });
        continue;
      }
      html = r.body;
    } catch (e) {
      findings.push({ severity: 'high', kind: 'post_fetch_err', message: `Could not fetch ${postUrl}: ${e.message}` });
      continue;
    }

    // Auto-generated posts (any /resources/<slug> where slug appears in our
    // publisher's state.history) must ship with the SEO upgrade artifacts.
    // Catches the case where someone manually edits a post and accidentally
    // strips the Quick Answer box / About the Author block, OR where the
    // template regresses in a future change.
    const slug = postUrl.replace(/^.*\/resources\//, '');
    let isAutoGenerated = false;
    try {
      const state = JSON.parse(fs.readFileSync(path.join(SCRIPT_DIR, 'state.json'), 'utf8'));
      isAutoGenerated = (state.history || []).some((h) => h.slug === slug);
    } catch { /* state.json absent or unreadable — skip the check */ }

    if (isAutoGenerated) {
      // The SPA shell HTML returns the same bundle for every route, but
      // BlogPostLayout's JSON-LD payload is server-rendered into the post's
      // dangerouslySetInnerHTML at build time. Markers we look for:
      //   - "Quick Answer" string (from the TLDR box label)
      //   - "About the Author" string (from the bio block)
      //   - "BreadcrumbList" in the JSON-LD payload
      const missingMarkers = [];
      if (!html.includes('Quick Answer')) missingMarkers.push('Quick Answer (TLDR box)');
      if (!html.includes('About the Author')) missingMarkers.push('About the Author (bio block)');
      if (!html.includes('BreadcrumbList')) missingMarkers.push('BreadcrumbList schema');
      if (missingMarkers.length) {
        findings.push({
          severity: 'medium',
          kind: 'seo_artifact_missing',
          message: `Auto-generated post ${postUrl} missing SEO markers: ${missingMarkers.join(', ')} — template may have regressed`,
        });
      }
    }

    // Extract internal links: href="/foo" or href="/foo/bar"
    const internalHrefs = Array.from(new Set(
      [...html.matchAll(/href=["'](\/[a-z0-9\-/]+)["']/g)]
        .map((m) => m[1])
        .filter((h) => !h.startsWith('/_') && !h.includes('#'))
    ));

    // Extract image srcs that are LIKELY referenced from this post body (in dangerouslySetInnerHTML)
    // For the v1 scanner we conservatively check the heroImage path embedded in BlogPostLayout
    const imgRefs = Array.from(new Set(
      [...html.matchAll(/src=["'](\/images\/[^"']+)["']/g)].map((m) => m[1])
    ));

    // HEAD each — Netlify SPA fallback returns 200 for any path, so for routes
    // we trust that. For /images/* the request actually verifies the file exists.
    for (const ref of imgRefs) {
      try {
        const r = await httpsGet(`${SITE_URL}${ref}`);
        if (r.status !== 200) {
          findings.push({
            severity: 'medium',
            kind: 'image_rot',
            message: `${postUrl} references missing image ${ref} (status ${r.status})`,
          });
        }
      } catch (e) {
        findings.push({ severity: 'low', kind: 'image_check_err', message: `Couldn't verify ${ref}: ${e.message}` });
      }
    }

    // Internal hrefs — sample 2 to avoid hammering. SPA fallback means we
    // can't easily distinguish "real route" from "404 fallback", but a 5xx
    // would still show up. This is a coarse signal.
    for (const href of internalHrefs.slice(0, 2)) {
      try {
        const r = await httpsGet(`${SITE_URL}${href}`);
        if (r.status >= 500) {
          findings.push({
            severity: 'medium',
            kind: 'link_5xx',
            message: `${postUrl} links to ${href} → ${r.status}`,
          });
        }
      } catch { /* network blip — don't alert */ }
    }
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

// Gemini API key health — probe by listing models. Cheap, catches dead keys
// before the next Monday's publish silently fails.
async function checkGeminiKeyHealth(findings) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return;  // can't probe what we don't have
  try {
    const r = await httpsGet(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (r.status === 200) return;  // healthy
    if (r.status === 401 || r.status === 403) {
      findings.push({
        severity: 'high',
        kind: 'gemini_key_dead',
        message: `GEMINI_API_KEY returned ${r.status} on probe — key is revoked/expired/wrong. Next Monday's publish will fail. Rotate the key + update repo secret.`,
      });
    } else if (r.status === 429) {
      findings.push({
        severity: 'medium',
        kind: 'gemini_rate_limited',
        message: `GEMINI_API_KEY returned 429 (rate limited). Transient — won't affect Monday's run unless persistent.`,
      });
    }
  } catch (e) {
    findings.push({ severity: 'low', kind: 'gemini_probe_err', message: `Could not probe Gemini key: ${e.message}` });
  }
}

// ACTIONS_PAT expiry — fine-grained PATs include the expiration in response
// headers when used. Probe gh API and parse the X-GitHub-Token-Expires-At header.
// Alert if <30 days to expiry.
async function checkPatExpiry(findings) {
  if (!HAS_PAT) return;
  try {
    // Use a lightweight authenticated endpoint
    const out = execSync(`curl -sI -H "Authorization: Bearer ${process.env.ACTIONS_PAT}" https://api.github.com/user`, {
      encoding: 'utf8',
      timeout: 10000,
    });
    const m = out.match(/github-authentication-token-expiration:\s*(.+?)(?:\r|\n|$)/i);
    if (!m) return;  // not a fine-grained PAT or no expiry header
    const expiresAt = new Date(m[1].trim());
    if (isNaN(expiresAt.getTime())) return;
    const daysLeft = (expiresAt.getTime() - Date.now()) / 86400000;
    if (daysLeft < 0) {
      findings.push({
        severity: 'high',
        kind: 'pat_expired',
        message: `ACTIONS_PAT EXPIRED ${Math.abs(Math.round(daysLeft))} day(s) ago. Auto-fixes that need cross-workflow triggers are silently failing. Mint a new PAT and update repo secret.`,
      });
    } else if (daysLeft < 30) {
      findings.push({
        severity: daysLeft < 7 ? 'high' : 'medium',
        kind: 'pat_expiring',
        message: `ACTIONS_PAT expires in ${Math.round(daysLeft)} day(s) (${expiresAt.toISOString().slice(0, 10)}). Rotate before expiry to avoid downtime.`,
      });
    }
  } catch { /* probe failed — don't alert noisily */ }
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

// Topic queue auto-refill — spawns Gemini to suggest 20 new topics + opens PR.
// Idempotent: skips if a recent refill PR is already open (don't spam).
async function autofixSuggestTopics() {
  // Don't open a second refill PR if one is already pending
  try {
    const openRefillPrs = ghJson(`pr list --repo ${REPO} --state open --search 'head:auto/topics-refill-' --json number,createdAt --limit 5`);
    if (openRefillPrs.length > 0) {
      return `topic-refill PR #${openRefillPrs[0].number} already open — skipping new suggestion run`;
    }
  } catch { /* fall through to suggestion */ }

  // Invoke the suggester
  try {
    const { suggestTopics, openRefillPR } = require('./topic-suggester.cjs');
    const proposal = await suggestTopics();
    const pr = await openRefillPR(proposal);
    if (pr.skipped) return 'topic-suggester ran but all proposals were duplicates';
    return `opened topic-refill PR with ${pr.accepted.length} new topics: ${pr.prUrl}`;
  } catch (e) {
    throw new Error(`topic auto-suggest FAILED: ${e.message}`);
  }
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
  // Daily 02:00 UTC sweep — runs expensive/comprehensive checks that don't
  // need to fire on every workflow_run.
  if (trigger.scheduleCron === '0 2 * * *' || trigger.event === 'workflow_dispatch') {
    await checkPostRot(findings);          // live HTML crawl (3 sample posts) + SEO artifact check
    await checkSeoArtifacts(findings);     // robots.txt + llms.txt + IndexNow key
    await checkGeminiKeyHealth(findings);  // probe Gemini key
    await checkPatExpiry(findings);        // parse PAT expiry header
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

async function buildReport(findings, applied) {
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

  // Monday 16:00 UTC schedule = always emit a digest, even if healthy.
  // This is the user's "positive confirmation" channel — silence on a Monday
  // means "I never checked," not "all good." A weekly Telegram lands every Mon
  // afternoon ET reporting that the publisher fired AND the post is live.
  const isMondayDigest = trigger.scheduleCron === '0 16 * * 1';

  if (!lines.length && (trigger.verbose || isMondayDigest)) {
    return isMondayDigest ? await buildMondayDigest() : buildAllGreen();
  }

  if (!lines.length) return null;

  // For Monday digest WITH findings, prepend the digest header instead of the
  // generic watchdog header — gives the user weekly context.
  if (isMondayDigest) {
    lines.unshift(`📊 Weekly Blog Health (Mon ${today()}) — issues detected`);
  } else {
    lines.unshift(`🔍 Blog watchdog (${trigger.event}${trigger.upstreamName ? ' → ' + trigger.upstreamName : ''})`);
  }
  return lines.join('\n').trim();
}

// Monday weekly health digest — sent every Mon 16:00 UTC regardless of findings.
// This is the user-requested positive confirmation. If the publisher fired
// successfully and a new post is in the sitemap, Yorkis sees green. If not, he sees red.
// Async because it does a live sitemap fetch for accurate published-count.
async function buildMondayDigest() {
  const lines = [`📊 Weekly Blog Health (Mon ${today()})`, ''];

  // Pull recent runs to assess the last 7d
  let pubRuns = [], deployRuns = [];
  try { pubRuns = ghJson(`run list --repo ${REPO} --workflow=blog-publisher.yml --json conclusion,createdAt,event,url --limit 20`); } catch {}
  try { deployRuns = ghJson(`run list --repo ${REPO} --workflow=netlify-deploy.yml --json conclusion,createdAt,url --limit 20`); } catch {}

  // Did this Monday's scheduled cron fire?
  const recentScheduled = pubRuns.find((r) => r.event === 'schedule' && ageDays(r.createdAt) < 1.5);
  if (recentScheduled) {
    const em = recentScheduled.conclusion === 'success' ? '✅' : '❌';
    lines.push(`  ${em} This Monday's cron: ${recentScheduled.conclusion}`);
  } else {
    lines.push(`  🚨 This Monday's cron: did NOT fire in the last ~36h`);
  }

  // Open PRs from publisher
  try {
    const openPrs = ghJson(`pr list --repo ${REPO} --state open --search 'head:auto/blog-' --json number,title,createdAt,url --limit 20`);
    if (openPrs.length === 0) {
      lines.push(`  ✅ No open PRs — last week's post merged + deployed`);
    } else {
      for (const pr of openPrs) {
        const ageH = ageHours(pr.createdAt);
        lines.push(`  📩 PR #${pr.number} waiting ${ageH.toFixed(0)}h: ${pr.title.slice(0, 60)}`);
        lines.push(`     ${pr.url}`);
      }
    }
  } catch (e) {
    lines.push(`  ⚠️ Could not list PRs: ${e.message}`);
  }

  // Last successful deploy
  const lastSuccessDeploy = deployRuns.find((r) => r.conclusion === 'success');
  if (lastSuccessDeploy) {
    lines.push(`  ✅ Last successful deploy: ${fmtAgeShort(lastSuccessDeploy.createdAt)}`);
  }

  // Topic queue from local state file (in the runner's checkout)
  try {
    const statePath = path.join(SCRIPT_DIR, 'state.json');
    const topicsPath = path.join(SCRIPT_DIR, 'topics.json');
    if (fs.existsSync(statePath) && fs.existsSync(topicsPath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      const topics = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
      const used = new Set(state.usedTopicIds || []);
      const remaining = (topics.topics || []).filter((t) => !used.has(t.id)).length;
      lines.push(`  📚 Topic queue: ${remaining} remaining (~${Math.round(remaining / 4.3)} months)`);
    }
  } catch { /* best effort */ }

  // Live published post count — derived from sitemap.xml (single source of truth).
  // Replaces state.publishedSlugs which only updates when publisher pipeline runs.
  try {
    const sitemap = await httpsGet(SITEMAP_URL);
    if (sitemap.status === 200) {
      const slugs = Array.from(new Set((sitemap.body.match(/\/resources\/[a-z0-9-]+/g) || [])
        .map((s) => s.slice('/resources/'.length))));
      const latest = slugs[slugs.length - 1];
      lines.push(`  📝 Posts live on site: ${slugs.length}${latest ? ` (latest: ${latest})` : ''}`);
    }
  } catch { /* best effort */ }

  lines.push('');
  lines.push(`  Live: ${SITE_URL}`);
  lines.push(`  PAT: ${HAS_PAT ? 'configured ✅' : 'not set ⚠️ (some auto-fixes degraded)'}`);
  lines.push(`  Next cron: Mon ${nextMondayDateStr()} 13:00 UTC`);

  return lines.join('\n');
}

function fmtAgeShort(iso) {
  const h = ageHours(iso);
  if (h < 24) return `${h.toFixed(0)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function nextMondayDateStr() {
  const d = new Date();
  const daysToMon = ((1 - d.getUTCDay()) + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysToMon);
  return d.toISOString().slice(0, 10);
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
// External heartbeat
// =============================================================================

// Optional dead-man's-switch ping. If HEALTHCHECKS_URL is set, ping it at the
// END of every successful watchdog run. If healthchecks.io stops receiving
// pings within the grace period, IT emails Yorkis. Closes the "what if GitHub
// Actions itself is down" gap that no in-system check can catch.
//
// Free tier at https://healthchecks.io covers up to 20 checks. Setup:
//   1. Create account + new "check" with grace period = 26h (covers daily 02:00 UTC)
//   2. Copy the unique ping URL
//   3. Add it as repo secret HEALTHCHECKS_URL
async function pingHeartbeat(status) {
  const url = process.env.HEALTHCHECKS_URL;
  if (!url) return;
  // Append /fail for failures so healthchecks alerts immediately on bad runs
  const pingUrl = status === 'fail' ? `${url.replace(/\/$/, '')}/fail` : url;
  return new Promise((resolve) => {
    try {
      const u = new URL(pingUrl);
      const req = https.request(
        { hostname: u.hostname, path: u.pathname + u.search, method: 'GET', timeout: 5000 },
        (res) => { res.resume(); resolve(); }
      );
      req.on('error', () => resolve());
      req.on('timeout', () => { req.destroy(); resolve(); });
      req.end();
    } catch { resolve(); }
  });
}

// =============================================================================
// Entry
// =============================================================================

async function main() {
  console.log(`[watchdog] starting — event=${trigger.event} upstream=${trigger.upstreamName} conc=${trigger.upstreamConc} verbose=${trigger.verbose} pat=${HAS_PAT} heartbeat=${!!process.env.HEALTHCHECKS_URL}`);

  const { findings, skipReason } = await runChecks();
  if (skipReason) { console.log(`[watchdog] skipped: ${skipReason}`); await pingHeartbeat('ok'); return; }

  const applied = await applyAutofixes(findings);

  const report = await buildReport(findings, applied);
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

  await pingHeartbeat('ok');
}

main().catch(async (e) => {
  console.error('[watchdog] FATAL:', e.message);
  await telegram(`🚨 Blog watchdog ITSELF crashed: ${e.message}`);
  await pingHeartbeat('fail');
  process.exit(1);
});
