'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runPublicationGate, validateEditorialDraft } = require('../quality-gate.cjs');

const A = 'https://unilock.com/porcelain/';
const B = 'https://www.techo-bloc.com/support/resources/technical-resources/installation-guides';
const paths = ['/services/porcelain-patios-barrie', '/resources/why-patios-sink-barrie', '/contact'];
const topic = { source_urls: [A, B] };
const long = ('A homeowner should compare the exact product information, intended use, support system, drainage, joints, edges and care instructions before choosing a patio surface. Product documentation can change, so confirm the current guide for the selected material and installation method. This article provides general planning information, not a site-specific design or construction specification. ' ).repeat(4);
function goodDraft() {
  return {
    slug: 'porcelain-patio-planning-guide', title: 'A practical porcelain patio planning guide', seoTitle: 'Porcelain patio planning guide',
    seoDescription: 'Compare outdoor porcelain options by product information and intended use.',
    tldr: 'Start with the exact manufacturer guide and intended use, then compare the installation system, drainage, joints and maintenance. A product name alone does not establish that it suits every patio or climate. Confirm current technical details and written project scope before deciding.',
    intro: `<p>${long}</p>`, author_bio: 'Prepared by Golden Maple Landscaping as general homeowner guidance.',
    cta_paragraph: `<p>Read the product guide or <a href='/contact'>ask a project question</a>.</p>`,
    sections: [1,2,3,4].map(i => ({ heading: `Planning question ${i}`, html: `<p>${long}</p><p>See <a href='${A}'>the manufacturer porcelain page</a> and <a href='${B}'>installation guide index</a>. For related information, visit <a href='${paths[1]}'>patio movement guidance</a>.</p>` })),
    faqs: [1,2,3,4].map(i => ({ question: `Question ${i}?`, answer: `<p>${long}</p>` })),
  };
}

test('valid draft calls only a fake temp-backed publication adapter', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-blog-gate-'));
  try {
    const record = path.join(dir, 'fake-published.json');
    let calls = 0;
    const result = await runPublicationGate({ draft: goodDraft(), topic, knownPaths: paths,
      existingSlugs: [], scheduledFor: '2026-11-02', runDate: '2026-11-02',
      publish: async draft => { calls++; fs.writeFileSync(record, JSON.stringify({ slug: draft.slug })); return { adapter: 'fake', record }; },
    });
    assert.equal(result.published, true);
    assert.equal(calls, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(record, 'utf8')), { slug: 'porcelain-patio-planning-guide' });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('malformed draft fails closed and never calls the adapter', async () => {
  let calls = 0;
  const result = await runPublicationGate({ draft: '{bad json', topic, knownPaths: paths, publish: async () => calls++ });
  assert.equal(result.published, false);
  assert.match(result.validation.errors[0], /draft must be an object/);
  assert.equal(calls, 0);
});

test('unsupported business experience, warranty, price, review and citation claims are rejected', () => {
  for (const claim of [
    'We have installed porcelain patios for dozens of homeowners.',
    'Our porcelain patio warranty is guaranteed for every job.',
    "Golden Maple's price starts at $12 per square foot.",
    'We have a 5.0 out of 5 Google rating for porcelain work.',
    'We guarantee Google will cite this article in AI answers.',
  ]) {
    const draft = goodDraft(); draft.sections[0].html += `<p>${claim}</p>`;
    const result = validateEditorialDraft(draft, { topic, knownPaths: paths });
    assert.equal(result.ok, false, claim);
  }
});

test('missing required source citation is rejected', () => {
  const draft = goodDraft();
  draft.sections = draft.sections.map(s => ({ ...s, html: s.html.replace(B, 'https://example.test/not-cited') }));
  const result = validateEditorialDraft(draft, { topic, knownPaths: paths });
  assert.ok(result.errors.some(e => e.includes(`required source not cited in article: ${B}`)));
});

test('broken internal links are rejected', () => {
  const draft = goodDraft();
  draft.sections[0].html = draft.sections[0].html.replace(paths[1], '/resources/nonexistent-porcelain-page');
  const result = validateEditorialDraft(draft, { topic, knownPaths: paths });
  assert.ok(result.errors.some(e => e.includes('broken internal link: /resources/nonexistent-porcelain-page')));
});

test('duplicate slug is rejected before adapter call', async () => {
  let calls = 0;
  const result = await runPublicationGate({ draft: goodDraft(), topic, knownPaths: paths,
    existingSlugs: ['porcelain-patio-planning-guide'], publish: async () => calls++ });
  assert.equal(result.published, false);
  assert.ok(result.validation.errors.some(e => e.includes('duplicate slug')));
  assert.equal(calls, 0);
});

test('future schedule date is held, due and overdue dates can run without catch-up burst', async () => {
  for (const runDate of ['2026-11-01']) {
    let calls = 0;
    const result = await runPublicationGate({ draft: goodDraft(), topic, knownPaths: paths,
      scheduledFor: '2026-11-02', runDate, publish: async () => calls++ });
    assert.equal(result.published, false);
    assert.equal(calls, 0);
  }
  for (const runDate of ['2026-11-02', '2026-11-09']) {
    let calls = 0;
    const result = await runPublicationGate({ draft: goodDraft(), topic, knownPaths: paths,
      scheduledFor: '2026-11-02', runDate, publish: async () => { calls++; return 'fake-ok'; } });
    assert.equal(result.published, true);
    assert.equal(calls, 1);
  }
});
