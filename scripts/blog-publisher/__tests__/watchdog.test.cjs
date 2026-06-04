// scripts/blog-publisher/__tests__/watchdog.test.cjs
//
// Uses Node 20's built-in node:test runner — no Vitest/Jest install needed.
// Run via: node --test scripts/blog-publisher/__tests__
//
// Scope: catch the class of bugs we found in production (missing fields in
// gh JSON output, missing workflow permissions). We don't aim for high
// coverage — just pin the most fragile assumptions.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WATCHDOG_PATH = path.join(__dirname, '..', 'watchdog.cjs');
const WATCHDOG_SRC = fs.readFileSync(WATCHDOG_PATH, 'utf8');

describe('watchdog: gh CLI JSON field assumptions', () => {
  test('pr list --json uses mergedAt (not merged) — caught in prod 2026-05-30', () => {
    // The `merged` field is NOT valid for `gh pr list --json`. Must be `mergedAt`.
    // Regression test for PR #14.
    assert.ok(
      /--json[^`]*\bmergedAt\b/.test(WATCHDOG_SRC),
      'watchdog must use `mergedAt` field in `gh pr list --json` calls'
    );
    assert.ok(
      !/--json[^`]*,merged,/.test(WATCHDOG_SRC) && !/--json[^`]*,merged\b(?!At)/.test(WATCHDOG_SRC),
      'watchdog must NOT use bare `merged` field (use `mergedAt` instead)'
    );
  });

  test('predicate uses !p.mergedAt (not !p.merged)', () => {
    assert.ok(
      /!p\.mergedAt/.test(WATCHDOG_SRC),
      'rejected-PR detection must check !p.mergedAt'
    );
    assert.ok(
      !/!p\.merged\b(?!At)/.test(WATCHDOG_SRC),
      'no usage of bare !p.merged should remain'
    );
  });

  test('queue thresholds are sane and ordered', () => {
    assert.ok(/LOW_QUEUE_THRESHOLD\s*=\s*\d+/.test(WATCHDOG_SRC));
    assert.ok(/QUEUE_REFILL_THRESHOLD\s*=\s*\d+/.test(WATCHDOG_SRC));
    const low = parseInt(WATCHDOG_SRC.match(/LOW_QUEUE_THRESHOLD\s*=\s*(\d+)/)[1], 10);
    const refill = parseInt(WATCHDOG_SRC.match(/QUEUE_REFILL_THRESHOLD\s*=\s*(\d+)/)[1], 10);
    assert.ok(low < refill, `LOW_QUEUE_THRESHOLD (${low}) must be < QUEUE_REFILL_THRESHOLD (${refill})`);
  });
});

describe('blog-watchdog.yml workflow permissions', () => {
  const ymlPath = path.join(__dirname, '..', '..', '..', '.github', 'workflows', 'blog-watchdog.yml');
  const ymlSrc = fs.existsSync(ymlPath) ? fs.readFileSync(ymlPath, 'utf8') : '';

  test('blog-watchdog.yml grants actions:read — caught in prod 2026-05-30', () => {
    // Without actions:read, every gh API call against /actions/* returns HTTP 403.
    // Regression test for PR #15.
    assert.ok(ymlSrc.length > 0, 'blog-watchdog.yml must exist');
    assert.ok(/actions:\s*read/.test(ymlSrc), 'blog-watchdog.yml must grant actions:read');
  });

  test('blog-watchdog.yml has concurrency group to serialize runs', () => {
    assert.ok(/concurrency:[\s\S]*group:\s*blog-watchdog/.test(ymlSrc));
  });

  test('blog-watchdog.yml exposes TELEGRAM secrets', () => {
    assert.ok(/TELEGRAM_BOT_TOKEN:[\s\S]*secrets\.TELEGRAM_BOT_TOKEN/.test(ymlSrc));
    assert.ok(/TELEGRAM_CHAT_ID:[\s\S]*secrets\.TELEGRAM_CHAT_ID/.test(ymlSrc));
  });
});

describe('publisher pipeline shape', () => {
  test('cli.cjs wires adversarial-review between generate and inject', () => {
    const cliSrc = fs.readFileSync(path.join(__dirname, '..', 'cli.cjs'), 'utf8');
    assert.ok(/require\(['"]\.\/adversarial-review/.test(cliSrc), 'cli.cjs must require adversarial-review');
    // Reviewer call must come AFTER generateDraft and BEFORE injectDraft
    const genIdx = cliSrc.indexOf('await generateDraft(');
    const reviewIdx = cliSrc.indexOf('reviewDraft(');
    const injectIdx = cliSrc.indexOf('injectDraft(');
    assert.ok(genIdx > 0 && reviewIdx > genIdx && injectIdx > reviewIdx,
      `pipeline order broken: generate(${genIdx}) → review(${reviewIdx}) → inject(${injectIdx})`);
  });

  test('cli.cjs honors SKIP_ADVERSARIAL_REVIEW env var (escape hatch)', () => {
    const cliSrc = fs.readFileSync(path.join(__dirname, '..', 'cli.cjs'), 'utf8');
    assert.ok(/SKIP_ADVERSARIAL_REVIEW/.test(cliSrc));
  });
});

describe('netlify-deploy.yml hygiene', () => {
  const ymlPath = path.join(__dirname, '..', '..', '..', '.github', 'workflows', 'netlify-deploy.yml');
  const ymlSrc = fs.existsSync(ymlPath) ? fs.readFileSync(ymlPath, 'utf8') : '';

  test('pins deploy to site by ID (never deploys to wrong site)', () => {
    // Honors ~/.claude/rules/netlify-deploy-safety.md spirit in CI context
    assert.ok(/--site=549b17bd-15af-42ee-8f0c-7fef576cf664/.test(ymlSrc),
      'deploy must use --site=<id> to pin the site');
  });

  test('paths-ignore excludes publisher state.json (avoid deploy storms)', () => {
    assert.ok(/paths-ignore:[\s\S]*scripts\/blog-publisher\/state\.json/.test(ymlSrc));
  });
});

describe('adversarial-review.cjs', () => {
  test('exports reviewDraft', () => {
    const r = require('../adversarial-review.cjs');
    assert.equal(typeof r.reviewDraft, 'function');
  });

  test('verdict normalization (defensive)', async () => {
    // Mock the prompt-building path — we can't call Gemini in tests, but we
    // can verify the module loads cleanly and shape contract is sane.
    const src = fs.readFileSync(path.join(__dirname, '..', 'adversarial-review.cjs'), 'utf8');
    assert.ok(/\['pass', 'warn', 'block'\]/.test(src),
      'verdict normalization must allow only pass|warn|block');
    assert.ok(/verdict = 'warn'/.test(src), 'fallback verdict must be warn (fail-open)');
  });
});
