// scripts/blog-publisher/__tests__/inject.test.cjs
//
// Uses Node 20's built-in node:test runner — no Vitest/Jest install needed.
// Run via: node --test scripts/blog-publisher/__tests__/*.test.cjs
//
// Scope: pin the injector against the two production failures of 2026-08-01.
//   1. inject.cjs still wrote to src/App.tsx, which the RR7 migration (d9a66cf)
//      deleted in July. Every publish died with ENOENT and the blog silently
//      stopped shipping.
//   2. The .tsx is written BEFORE the route wiring, so that crash orphaned
//      src/pages/blog/*.tsx — and the `already exists` guard then made every
//      retry fail too. One crash ended the cadence until a human noticed.
//
// These run against the REAL routes.ts / src/data/blogPosts.ts and a REAL
// archived draft, then restore them — a fixture copy would not have caught (1),
// since the whole bug was that the real file had moved.

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { injectDraft, slugToComponent, buildTsx } = require('../inject.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const ROUTES_TS = path.join(REPO_ROOT, 'src/routes.ts');
const RESOURCES_TSX = path.join(REPO_ROOT, 'src/data/blogPosts.ts');
const DRAFTS_DIR = path.join(__dirname, '..', 'drafts');

const TOUCHED = [ROUTES_TS, RESOURCES_TSX];

// A real archived draft — real headings, real HTML, real FAQ shape.
function loadRealDraft(slug) {
  const files = fs.readdirSync(DRAFTS_DIR).filter((f) => f.endsWith('.json')).sort();
  assert.ok(files.length > 0, 'expected at least one archived draft to test against');
  const draft = JSON.parse(fs.readFileSync(path.join(DRAFTS_DIR, files[0]), 'utf8'));
  draft.slug = slug; // retarget so we never collide with a published post
  return draft;
}

function snapshot() {
  return TOUCHED.map((p) => ({ path: p, before: fs.readFileSync(p, 'utf8') }));
}
function restore(snap, extraPaths = []) {
  for (const { path: p, before } of snap) fs.writeFileSync(p, before);
  for (const p of extraPaths) if (fs.existsSync(p)) fs.unlinkSync(p);
}

let pending = null;
afterEach(() => {
  if (pending) { restore(pending.snap, pending.extra); pending = null; }
});

describe('injectDraft: RR7 route wiring', () => {
  test('writes the route into src/routes.ts — App.tsx is gone since d9a66cf', () => {
    const slug = 'zz-test-inject-route-wiring';
    const comp = slugToComponent(slug);
    const tsxPath = path.join(REPO_ROOT, 'src/pages/blog', `${comp}.tsx`);
    pending = { snap: snapshot(), extra: [tsxPath] };

    const result = injectDraft(loadRealDraft(slug));

    // The regression: it must NOT claim to have touched App.tsx, because
    // cli.cjs feeds filesChanged straight into `git add` — a stale path there
    // fails the commit even if the injection itself worked.
    assert.ok(!result.filesChanged.includes('src/App.tsx'), 'must not reference deleted App.tsx');
    assert.ok(result.filesChanged.includes('src/routes.ts'), 'must stage routes.ts');

    const routes = fs.readFileSync(ROUTES_TS, 'utf8');
    assert.match(routes, new RegExp(`route\\('resources/${slug}', 'pages/blog/${comp}\\.tsx'\\),`));
    assert.ok(fs.existsSync(tsxPath), 'blog page component should be written');
  });

  test('does not touch a static sitemap — generate-sitemap.py builds it from the prerender', () => {
    const slug = 'zz-test-inject-no-sitemap';
    const comp = slugToComponent(slug);
    const tsxPath = path.join(REPO_ROOT, 'src/pages/blog', `${comp}.tsx`);
    pending = { snap: snapshot(), extra: [tsxPath] };

    const result = injectDraft(loadRealDraft(slug));

    assert.ok(!result.filesChanged.some((f) => f.includes('sitemap')), 'filesChanged must not list a sitemap');
    assert.ok(!fs.existsSync(path.join(REPO_ROOT, 'public/sitemap.xml')), 'public/sitemap.xml must stay deleted — the build generates it');
  });

  test('appends inside the blog block, above // Locations', () => {
    const slug = 'zz-test-inject-ordering';
    const comp = slugToComponent(slug);
    const tsxPath = path.join(REPO_ROOT, 'src/pages/blog', `${comp}.tsx`);
    pending = { snap: snapshot(), extra: [tsxPath] };

    injectDraft(loadRealDraft(slug));

    const routes = fs.readFileSync(ROUTES_TS, 'utf8');
    assert.ok(routes.indexOf(`pages/blog/${comp}.tsx`) < routes.indexOf('// Locations'),
      'new blog route must land in the blog block, not after the locations block');
  });

  test('preserves the file CRLF line endings (Windows working trees)', () => {
    const slug = 'zz-test-inject-eol';
    const comp = slugToComponent(slug);
    const tsxPath = path.join(REPO_ROOT, 'src/pages/blog', `${comp}.tsx`);
    const before = fs.readFileSync(ROUTES_TS, 'utf8');
    const wasCrlf = before.includes('\r\n');
    pending = { snap: snapshot(), extra: [tsxPath] };

    injectDraft(loadRealDraft(slug));

    const after = fs.readFileSync(ROUTES_TS, 'utf8');
    const injected = after.split(/\r?\n/).find((l) => l.includes(`pages/blog/${comp}.tsx`));
    assert.ok(injected, 'injected line should exist');
    if (wasCrlf) {
      // No lone-LF line may be introduced into a CRLF file.
      assert.equal((after.match(/\n/g) || []).length, (after.match(/\r\n/g) || []).length,
        'must not mix LF into a CRLF file');
    }
  });
});

describe('injectDraft: failure is all-or-nothing', () => {
  test('rolls back the .tsx when a later step throws — no orphan blocking retries', () => {
    const slug = 'zz-test-inject-rollback';
    const comp = slugToComponent(slug);
    const tsxPath = path.join(REPO_ROOT, 'src/pages/blog', `${comp}.tsx`);
    const snap = snapshot();
    pending = { snap, extra: [tsxPath] };

    // Force a mid-run failure: pre-seed blogPosts.ts (the LAST step) with this
    // slug so injectIntoResources throws after .tsx + routes.ts are written.
    const resources = fs.readFileSync(RESOURCES_TSX, 'utf8');
    fs.writeFileSync(RESOURCES_TSX, `${resources}\n// slug: '${slug}'\n`);

    assert.throws(() => injectDraft(loadRealDraft(slug)), /already lists/);

    // The whole point: nothing partial survives, so the NEXT run can retry.
    assert.ok(!fs.existsSync(tsxPath), 'orphaned .tsx must be removed on failure');
    const routes = fs.readFileSync(ROUTES_TS, 'utf8');
    assert.ok(!routes.includes(`pages/blog/${comp}.tsx`), 'routes.ts must be rolled back');
  });
});

// 2026-09-28: auto-023's CTA said "call Golden Maple Landscaping at
// (705) 300-8015". The postbuild contact check failed on it and every
// production deploy after it failed. See contact-gate.test.cjs for the unit
// cases; these run the real injector and the real check.
describe('injectDraft: contact details come only from src/data/business.ts', () => {
  const CHECK = path.join(REPO_ROOT, 'scripts', 'check-contact-centralization.py');
  const STUB = { phoneDisplay: '<DISPLAY>', phoneTel: '<TEL>', email: '<EMAIL>' };

  test('a CTA with the phone number and email produces a page that passes the contact check', () => {
    const slug = 'zz-test-inject-contacts';
    const comp = slugToComponent(slug);
    const tsxPath = path.join(REPO_ROOT, 'src/pages/blog', `${comp}.tsx`);
    pending = { snap: snapshot(), extra: [tsxPath] };

    const draft = loadRealDraft(slug);
    draft.cta_paragraph =
      'If you are planning a patio in Barrie, call Golden Maple Landscaping at (705) 300-8015 ' +
      '(<a href="tel:+17053008015">tap to call</a>) or email ' +
      '<a href="mailto:yorkis@goldenmaplelandscaping.ca">yorkis@goldenmaplelandscaping.ca</a>.';
    draft.faqs = [...(draft.faqs || []), {
      question: 'How do I reach you?',
      answer: 'Call (705) 300-8015 or email yorkis@goldenmaplelandscaping.ca.',
    }];

    // injectDraft runs the gate itself, so returning at all means it passed.
    injectDraft(draft);

    const r = spawnSync('python3', [CHECK, tsxPath], { cwd: REPO_ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, `contact check must pass on the generated page:\n${r.stdout}${r.stderr}`);
    assert.equal(JSON.parse(r.stdout).passed, true);

    const tsx = fs.readFileSync(tsxPath, 'utf8');
    assert.equal(tsx.match(/^import \{ publicContact \} from '\.\.\/\.\.\/data\/business';$/gm)?.length, 1,
      'the page must import publicContact exactly once');

    // The CTA is the last __html block. Evaluate it the way React would.
    const blocks = [...tsx.matchAll(/dangerouslySetInnerHTML=\{\{ __html: (.*) \}\} \/>$/gm)];
    const cta = new Function('publicContact', `return (${blocks[blocks.length - 1][1]});`)(STUB);
    assert.equal(cta,
      '<p>If you are planning a patio in Barrie, call Golden Maple Landscaping at <DISPLAY> ' +
      '(<a href="tel:<TEL>">tap to call</a>) or email <a href="mailto:<EMAIL>"><EMAIL></a>.</p>');

    // The FAQ answer is also emitted into the FAQPage schema.
    assert.match(tsx, /"text": "Call " \+ publicContact\.phoneDisplay \+ " or email " \+ publicContact\.email \+ "\."/);
  });

  test('a page with no contact details does not import publicContact', () => {
    const tsx = buildTsx(loadRealDraft('zz-test-inject-no-contacts'));
    assert.ok(!tsx.includes('publicContact'), 'an unused import would be dead code');
  });

  test('refuses a contact the injector cannot render, and rolls every write back', () => {
    const slug = 'zz-test-inject-contact-gate';
    const comp = slugToComponent(slug);
    const tsxPath = path.join(REPO_ROOT, 'src/pages/blog', `${comp}.tsx`);
    const snap = snapshot();
    pending = { snap, extra: [tsxPath] };

    // Section headings are plain JSX text, not HTML, so they are not rewritten.
    const draft = loadRealDraft(slug);
    draft.sections[0].heading = 'Call (705) 300-8015 before you dig';

    assert.throws(() => injectDraft(draft), (err) => {
      assert.equal(err.code, 'CONTACT_GATE');
      assert.match(err.message, new RegExp(`${comp}\\.tsx:\\d+`));
      return true;
    });

    assert.ok(!fs.existsSync(tsxPath), 'the refused page must not be left on disk');
    for (const { path: p, before } of snap) {
      assert.equal(fs.readFileSync(p, 'utf8'), before, `${path.basename(p)} must be rolled back`);
    }
  });
});
