#!/usr/bin/env node
// scripts/gbp-publisher/cli.cjs
// Orchestration entry. Mirrors the shape of scripts/blog-publisher/cli.js.
// Uses .cjs extension because root package.json declares "type": "module".
//
// Commands:
//   workflow-run                LEGACY/Playwright-only — depends on publisher.cjs (see that file's
//                               README.md entry). .github/workflows/gbp-publisher.yml, which this
//                               comment used to say it was "used by", does not exist in this repo.
//                               Live publishing runs via the scheduled Claude Code routine at
//                               scripts/gbp-publisher/ROUTINE.md (Business Profile API + Chrome MCP
//                               tiers), not this command.
//   post-now --slug=<slug>      LEGACY/Playwright-only — same publisher.cjs dependency as workflow-run.
//                               Force-mirror a specific blog slug (must exist in blog-publisher/drafts/).
//   generate-only --slug=<slug> Generate the GBP post body, do NOT publish. Prints JSON.
//   capture-state [--out=path]  Open a real Chrome window so you can sign in to GBP, then write the
//                               storage state JSON to disk. Local use only — never in CI.
//   doctor                      Smoke test: env vars present? Playwright importable? state files OK?

const fs = require('fs');
const path = require('path');

const generator = require('./generator.cjs');
const telegram = require('./telegram.cjs');

const SCRIPT_DIR = __dirname;
const STATE_PATH = path.join(SCRIPT_DIR, 'state.json');
const DEFAULT_STORAGE_OUT = path.join(SCRIPT_DIR, 'storage-state.json');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
  }
  return flags;
}

function loadState() {
  if (!fs.existsSync(STATE_PATH)) {
    return {
      version: 1, lastRunAt: null, lastSuccessAt: null, lastFailureAt: null,
      consecutiveFailures: 0, mirrored: [], history: []
    };
  }
  return readJson(STATE_PATH);
}

function saveState(state) {
  state.lastRunAt = new Date().toISOString();
  writeJson(STATE_PATH, state);
}

async function cmdWorkflowRun(flags) {
  const state = loadState();
  const pending = generator.findPendingBlog(state, { maxAgeDays: 7 });

  if (!pending) {
    console.log('[gbp:workflow] no pending blogs to mirror (idle).');
    try { await telegram.sendMessage(telegram.buildIdleMessage()); } catch (e) {
      console.warn('[gbp:workflow] Telegram idle ping failed (non-fatal):', e.message);
    }
    saveState(state);
    return { ok: true, idle: true };
  }

  const { blog } = pending;
  console.log(`[gbp:workflow] mirroring blog: ${blog.slug} — "${blog.title}"`);

  let post;
  try {
    post = await generator.generateGbpPost(blog);
    if (!post.validation.ok) {
      throw new Error('Generated post failed validation: ' + post.validation.errors.join(' | '));
    }
  } catch (e) {
    state.lastFailureAt = new Date().toISOString();
    state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
    saveState(state);
    try { await telegram.sendFailureWithScreenshot('generate', { slug: blog.slug, title: blog.title }, e); } catch {}
    throw e;
  }

  // Lazy-load publisher so doctor / generate-only don't need playwright installed.
  const { publishGbpPost } = require('./publisher.cjs');

  let result;
  try {
    result = await publishGbpPost(post);
  } catch (e) {
    state.lastFailureAt = new Date().toISOString();
    state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
    saveState(state);
    const shotMatch = /Debug shot: (.+)$/m.exec(e.message);
    const shotPath = shotMatch ? shotMatch[1].trim() : null;
    try { await telegram.sendFailureWithScreenshot('publish', post, e, shotPath); } catch {}
    throw e;
  }

  // Mark this blog as mirrored
  state.mirrored = [...(state.mirrored || []), {
    slug: blog.slug,
    title: blog.title,
    ctaUrl: post.ctaUrl,
    publishedAt: new Date().toISOString(),
    finalUrl: result.finalUrl
  }];
  state.history = [...(state.history || []), {
    slug: blog.slug,
    at: new Date().toISOString(),
    charCount: post.validation.charCount,
    ok: true
  }];
  state.lastSuccessAt = new Date().toISOString();
  state.consecutiveFailures = 0;
  saveState(state);

  try { await telegram.sendSuccessWithScreenshot(post, result.afterShot); } catch (e) {
    console.warn('[gbp:workflow] Telegram success ping failed (non-fatal):', e.message);
  }

  return { ok: true, slug: blog.slug, finalUrl: result.finalUrl };
}

async function cmdPostNow(flags) {
  const slug = flags.slug;
  if (!slug) throw new Error('post-now requires --slug=<blog-slug>');
  const blog = generator.loadBlogDraft(slug);
  const post = await generator.generateGbpPost(blog);
  if (!post.validation.ok) {
    throw new Error('Generated post failed validation: ' + post.validation.errors.join(' | '));
  }
  const { publishGbpPost } = require('./publisher.cjs');
  const result = await publishGbpPost(post);
  const state = loadState();
  state.mirrored = [...(state.mirrored || []), {
    slug: blog.slug, title: blog.title, ctaUrl: post.ctaUrl,
    publishedAt: new Date().toISOString(), finalUrl: result.finalUrl, forced: true
  }];
  state.lastSuccessAt = new Date().toISOString();
  state.consecutiveFailures = 0;
  saveState(state);
  try { await telegram.sendSuccessWithScreenshot(post, result.afterShot); } catch {}
  return { ok: true, slug, finalUrl: result.finalUrl };
}

async function cmdGenerateOnly(flags) {
  const slug = flags.slug;
  if (!slug) throw new Error('generate-only requires --slug=<blog-slug>');
  const blog = generator.loadBlogDraft(slug);
  const post = await generator.generateGbpPost(blog);
  console.log('\n=== Generated GBP post ===\n');
  console.log(post.summary);
  console.log(`\nCTA: ${post.ctaType} → ${post.ctaUrl}`);
  console.log(`Image: ${post.imageUrl}`);
  console.log(`Validation: ${post.validation.ok ? 'OK' : 'FAIL'} (${post.validation.charCount} chars)`);
  if (!post.validation.ok) console.log('Errors:\n  - ' + post.validation.errors.join('\n  - '));
}

async function cmdCaptureState(flags) {
  const outPath = flags.out || DEFAULT_STORAGE_OUT;
  const { captureStorageState } = require('./publisher.cjs');
  await captureStorageState(outPath);
  console.log('\nNext step:');
  console.log(`  gh secret set GBP_STORAGE_STATE < "${outPath}"`);
  console.log('Then delete the local file — it is in .gitignore but treat it like a password.');
}

async function cmdDoctor() {
  const checks = [];
  function ok(name, msg) { checks.push({ name, ok: true, msg }); }
  function fail(name, msg) { checks.push({ name, ok: false, msg }); }

  // Env vars. GEMINI_API_KEY is informational only since the 2026-08-13 swap
  // to the local claude CLI (same as blog-publisher) — generation works without it.
  ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'].forEach(k => {
    process.env[k] ? ok(k, 'set') : fail(k, 'MISSING');
  });
  ok('GEMINI_API_KEY', process.env.GEMINI_API_KEY ? 'set (unused — claude CLI path)' : 'not set (fine — claude CLI path)');
  process.env.GBP_STORAGE_STATE
    ? ok('GBP_STORAGE_STATE', `set (${process.env.GBP_STORAGE_STATE.length} chars)`)
    : (process.env.GBP_STORAGE_STATE_FILE && fs.existsSync(process.env.GBP_STORAGE_STATE_FILE))
      ? ok('GBP_STORAGE_STATE_FILE', `set → ${process.env.GBP_STORAGE_STATE_FILE}`)
      : fail('GBP_STORAGE_STATE', 'MISSING (and no GBP_STORAGE_STATE_FILE found)');

  // Playwright importable?
  try {
    require.resolve('playwright');
    ok('playwright', 'installed');
  } catch {
    fail('playwright', 'NOT installed (npm install --no-save playwright && npx playwright install chromium)');
  }

  // State files
  fs.existsSync(STATE_PATH) ? ok('state.json', 'exists') : fail('state.json', 'missing');
  const blogStatePath = path.join(SCRIPT_DIR, '..', 'blog-publisher', 'state.json');
  fs.existsSync(blogStatePath) ? ok('blog-publisher state', 'exists') : fail('blog-publisher state', 'missing');

  console.log('\n=== gbp-publisher doctor ===\n');
  for (const c of checks) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name.padEnd(28)} ${c.msg}`);
  }
  const failed = checks.filter(c => !c.ok);
  console.log('');
  if (failed.length) {
    console.log(`${failed.length} check(s) failed.`);
    process.exit(1);
  } else {
    console.log('All checks passed.');
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  try {
    switch (cmd) {
      case 'workflow-run':   { const r = await cmdWorkflowRun(flags); console.log(JSON.stringify(r, null, 2)); break; }
      case 'post-now':       { const r = await cmdPostNow(flags); console.log(JSON.stringify(r, null, 2)); break; }
      case 'generate-only':  await cmdGenerateOnly(flags); break;
      case 'capture-state':  await cmdCaptureState(flags); break;
      case 'doctor':         await cmdDoctor(); break;
      default:
        console.error('Usage: cli.cjs {workflow-run [LEGACY] | post-now --slug=X [LEGACY] | generate-only --slug=X | capture-state [--out=path] | doctor}');
        process.exit(2);
    }
  } catch (e) {
    console.error('FAIL:', e.message);
    if (process.env.GBP_DEBUG) console.error(e.stack);
    process.exit(1);
  }
}

main();
