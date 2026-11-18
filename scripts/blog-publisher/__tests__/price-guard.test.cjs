// scripts/blog-publisher/__tests__/price-guard.test.cjs
//
// Run via: node --test scripts/blog-publisher/__tests__/*.test.cjs
//
// Owner decision 2026-10-17: no invented prices, at all cost. Until then the writer prompt told the model
// "If you need a number, give a range like $X-$Y per square foot" and required a number in every section,
// so weekly posts carried made-up prices (patio rates from $18 to $85 per sq ft). The writer may now quote
// only the engine's published price facts, and a draft that quotes anything else is rejected before a PR.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { buildPrompt, validateDraft, generateDraft } = require('../generate.cjs');

const SHEET = require(path.join(__dirname, '..', '..', '..', 'src', 'data', 'publishedPriceFacts.json'));
const topics = require(path.join(__dirname, '..', 'topics.json'));
const topicList = Array.isArray(topics) ? topics : topics.topics;
const STATE_PATH = path.join(__dirname, '..', 'state.json');

test('the writer prompt hands over every engine price fact and the facts-only rule', () => {
  const prompt = buildPrompt(topicList[0]);
  for (const fact of SHEET.facts) assert.ok(prompt.includes(fact.statement), `prompt carries ${fact.id}`);
  assert.match(prompt, /the only dollar figures you may write are the ones in PRICE FACTS/i);
});

test('the writer prompt no longer asks for invented numbers or price ranges', () => {
  const prompt = buildPrompt(topicList[0]);
  assert.doesNotMatch(prompt, /give a range like/i);
  assert.doesNotMatch(prompt, /\$X-\$Y/);
  assert.doesNotMatch(prompt, /specific number, range/i);
  assert.doesNotMatch(prompt, /Include a specific number\/range/i);
});

const draftWith = (tldr) => ({ title: 'T', seoDescription: 'S', tldr, intro: '<p>i</p>', sections: [{ heading: 'h', html: '<p>Patio base depth matters.</p>' }], faqs: [{ question: 'q', answer: 'a' }], comparison_table: { include: false } });

test('a price that is not an engine fact about its own subject is flagged', () => {
  const v = validateDraft(draftWith('A basic interlocking patio runs about $25 per square foot, and a fire pit adds $3,000.'));
  assert.deepEqual(v.priceIssues.map((i) => i.figure), ['$25', '$3,000']);
  assert.ok(v.errors.some((e) => e.startsWith('unapproved price')));
});

test('an engine fact quoted about its own subject passes', () => {
  const rate = SHEET.facts.find((f) => f.id === 'patio.rate');
  const v = validateDraft(draftWith(`Most interlocking patios come out around ${rate.figures[0]} per square foot before HST.`));
  assert.deepEqual(v.priceIssues, []);
});

test('a draft that keeps quoting an unapproved price is rejected after two retries, and burns no topic', async () => {
  const before = fs.readFileSync(STATE_PATH, 'utf8');
  const prompts = [];
  const bad = JSON.stringify({ ...draftWith('An interlocking patio costs $19 per square foot in Barrie, every time, with no exceptions at all.'), category: 'Design', readTime: '8 min', heroImage: 'x', author_bio: 'b', cta_paragraph: 'c', seoTitle: 't' });
  await assert.rejects(
    generateDraft({ topicId: topicList[0].id, writer: async (p) => { prompts.push(p); return bad; } }),
    /unapproved price/,
  );
  assert.equal(prompts.length, 3, 'two retries');
  assert.match(prompts[1], /PRICE FIX/, 'the retry tells the writer which figures to remove');
  assert.match(prompts[1], /\(not a published engine figure\)/, 'each figure in the retry carries its reason');
  assert.equal(fs.readFileSync(STATE_PATH, 'utf8'), before, 'state.json untouched — the topic stays queued');
});

test('no queued topic hands the writer a price in its title, keyword or slug', () => {
  // A topic titled "What $25K vs $60K Buys" asks for the very prices the validator rejects, so the draft would
  // fail every week and stall the queue behind it.
  const { extractPriceFigures } = require('../price-figures.cjs');
  for (const t of topicList) {
    assert.deepEqual(extractPriceFigures([t.title, t.primary_keyword, t.slug].join(' ')), [], `${t.id}: ${t.title}`);
  }
});

test('a FAQ answer that quotes a fact without its subject is caught, as the built page (FAQ JSON-LD) would be', () => {
  const draft = { ...draftWith('Base depth matters.'), slug: 'retaining-wall-cost-test', faqs: [{ question: 'How much does a retaining wall cost per foot in Barrie?', answer: 'Around $330–$670 per linear foot before HST, depending on height.' }] };
  const v = validateDraft(draft);
  assert.ok(v.priceIssues.some((i) => i.figure === '$330–$670' && /same sentence/.test(i.reason)), JSON.stringify(v.priceIssues));
});
