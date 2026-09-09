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
// These run against the REAL routes.ts / Resources.tsx / sitemap.xml and a REAL
// archived draft, then restore them — a fixture copy would not have caught (1),
// since the whole bug was that the real file had moved.

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { injectDraft, slugToComponent } = require('../inject.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const ROUTES_TS = path.join(REPO_ROOT, 'src/routes.ts');
const RESOURCES_TSX = path.join(REPO_ROOT, 'src/pages/Resources.tsx');
const SITEMAP_XML = path.join(REPO_ROOT, 'public/sitemap.xml');
const DRAFTS_DIR = path.join(__dirname, '..', 'drafts');

const TOUCHED = [ROUTES_TS, RESOURCES_TSX, SITEMAP_XML];

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

  test('writes the canonical trailing slash on the sitemap loc', () => {
    const slug = 'zz-test-inject-sitemap-slash';
    const comp = slugToComponent(slug);
    const tsxPath = path.join(REPO_ROOT, 'src/pages/blog', `${comp}.tsx`);
    pending = { snap: snapshot(), extra: [tsxPath] };

    injectDraft(loadRealDraft(slug));

    const sitemap = fs.readFileSync(SITEMAP_XML, 'utf8');
    assert.match(sitemap, new RegExp(`<loc>https://goldenmaplelandscaping.ca/resources/${slug}/</loc>`));
    assert.doesNotMatch(sitemap, new RegExp(`<loc>https://goldenmaplelandscaping.ca/resources/${slug}</loc>`));
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

    // Force a mid-run failure: pre-seed the sitemap (the LAST step) with this
    // slug's URL so injectIntoSitemap throws after .tsx + routes.ts are written.
    const url = `https://goldenmaplelandscaping.ca/resources/${slug}/`;
    const sitemap = fs.readFileSync(SITEMAP_XML, 'utf8');
    fs.writeFileSync(SITEMAP_XML, sitemap.replace('</urlset>', `  <url><loc>${url}</loc></url>\n</urlset>`));

    assert.throws(() => injectDraft(loadRealDraft(slug)), /already lists/);

    // The whole point: nothing partial survives, so the NEXT run can retry.
    assert.ok(!fs.existsSync(tsxPath), 'orphaned .tsx must be removed on failure');
    const routes = fs.readFileSync(ROUTES_TS, 'utf8');
    assert.ok(!routes.includes(`pages/blog/${comp}.tsx`), 'routes.ts must be rolled back');
  });
});
