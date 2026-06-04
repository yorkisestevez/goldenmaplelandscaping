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

  test('generate.cjs requires the new SEO-quality fields (tldr, author_bio)', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'generate.cjs'), 'utf8');
    assert.ok(/'tldr'/.test(src) && /'author_bio'/.test(src), 'tldr + author_bio must be in required list');
  });

  test('inject.cjs renders the TLDR Quick Answer box', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'inject.cjs'), 'utf8');
    assert.ok(/Quick Answer/.test(src), 'inject must render Quick Answer box from tldr');
    assert.ok(/draft\.tldr/.test(src), 'inject must reference draft.tldr');
  });

  test('inject.cjs renders the author bio section', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'inject.cjs'), 'utf8');
    assert.ok(/About the Author/.test(src), 'inject must render About the Author block from author_bio');
    assert.ok(/draft\.author_bio/.test(src), 'inject must reference draft.author_bio');
  });

  test('reviewer evaluates new SEO/GEO axes', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'adversarial-review.cjs'), 'utf8');
    for (const axis of ['tldr_quality', 'featured_snippet_ready', 'ai_citation_ready', 'numeric_density', 'e_e_a_t']) {
      assert.ok(src.includes(axis), `reviewer must evaluate axis ${axis}`);
    }
  });
});

describe('watchdog: SEO artifact checks', () => {
  const wdSrc = fs.readFileSync(path.join(__dirname, '..', 'watchdog.cjs'), 'utf8');

  test('checkSeoArtifacts is defined and dispatched on daily sweep', () => {
    assert.ok(/async function checkSeoArtifacts/.test(wdSrc),
      'checkSeoArtifacts must exist');
    assert.ok(/await checkSeoArtifacts\(findings\)/.test(wdSrc),
      'checkSeoArtifacts must be awaited in runChecks');
  });

  test('checkSeoArtifacts probes robots.txt, llms.txt, and the IndexNow key', () => {
    assert.ok(/\/robots\.txt/.test(wdSrc), 'must probe robots.txt');
    assert.ok(/\/llms\.txt/.test(wdSrc), 'must probe llms.txt');
    assert.ok(/indexnow_key_missing/.test(wdSrc) || /indexnow_key_mismatch/.test(wdSrc),
      'must verify IndexNow key file');
  });

  test('checkPostRot also verifies SEO upgrade markers on auto-generated posts', () => {
    assert.ok(/seo_artifact_missing/.test(wdSrc),
      'checkPostRot must surface missing Quick Answer / About the Author / BreadcrumbList');
    assert.ok(/Quick Answer/.test(wdSrc) && /About the Author/.test(wdSrc) && /BreadcrumbList/.test(wdSrc),
      'all three SEO markers must be checked');
  });
});

describe('AI crawler config', () => {
  const robotsPath = path.join(__dirname, '..', '..', '..', 'public', 'robots.txt');
  const robotsSrc = fs.existsSync(robotsPath) ? fs.readFileSync(robotsPath, 'utf8') : '';

  test('robots.txt explicitly allows major AI crawlers', () => {
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'CCBot']) {
      assert.ok(new RegExp(`User-agent:\\s*${bot}`, 'i').test(robotsSrc),
        `robots.txt must include ${bot}`);
    }
  });

  test('llms.txt exists and includes business profile', () => {
    const llmsPath = path.join(__dirname, '..', '..', '..', 'public', 'llms.txt');
    assert.ok(fs.existsSync(llmsPath), 'llms.txt must exist for AI engine citation');
    const src = fs.readFileSync(llmsPath, 'utf8');
    assert.ok(/Yorkis Estevez/.test(src), 'llms.txt must include founder name');
    assert.ok(/goldenmaplelandscaping\.ca/.test(src), 'llms.txt must include canonical URL');
  });
});

describe('schema + BlogPostLayout', () => {
  const layoutPath = path.join(__dirname, '..', '..', '..', 'src', 'components', 'BlogPostLayout.tsx');
  const layoutSrc = fs.existsSync(layoutPath) ? fs.readFileSync(layoutPath, 'utf8') : '';

  test('BlogPostLayout emits BreadcrumbList schema', () => {
    assert.ok(/BreadcrumbList/.test(layoutSrc), 'must emit BreadcrumbList schema');
  });

  test('BlogPostLayout accepts tldr / keywords / wordCount / dateModified props', () => {
    for (const prop of ['tldr', 'keywords', 'wordCount', 'dateModified']) {
      assert.ok(new RegExp(`${prop}\\??:`).test(layoutSrc), `must accept ${prop} prop`);
    }
  });

  test('Article schema uses abstract from tldr when provided', () => {
    assert.ok(/articleSchema\.abstract\s*=\s*tldr/.test(layoutSrc),
      'tldr must map to schema.abstract');
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
