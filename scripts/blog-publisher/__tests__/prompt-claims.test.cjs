// scripts/blog-publisher/__tests__/prompt-claims.test.cjs
//
// Run via: node --test scripts/blog-publisher/__tests__/*.test.cjs
//
// The writer model repeats whatever the prompt tells it about the business. Until
// 2026-09-27 the prompt fed it "WSIB certified, $5M liability, 5.0 Google rating"
// and a universal 12-16" base depth, and those claims kept surfacing in posts
// and archived drafts. This pins the prompt against the SAME rule list the
// postbuild gate uses (scripts/claim-rules.json), so a claim can't be re-seeded.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildPrompt } = require('../generate.cjs');
const { rules } = require(path.join(__dirname, '..', '..', 'claim-rules.json'));

const topics = require(path.join(__dirname, '..', 'topics.json'));
const topicList = Array.isArray(topics) ? topics : topics.topics;

function hits(text, tier) {
  return rules
    .filter(r => (r.tier || 'block') === tier)
    .map(r => ({ id: r.id, m: new RegExp(r.pattern, 'i').exec(text) }))
    .filter(x => x.m)
    .map(x => `${x.id}: …${text.slice(Math.max(0, x.m.index - 40), x.m.index + x.m[0].length + 40)}…`);
}

test('claim-rules.json patterns compile in JavaScript', () => {
  for (const r of rules) assert.doesNotThrow(() => new RegExp(r.pattern, 'i'), r.id);
});

test('the writer prompt seeds no blocked claim for any queued topic', () => {
  assert.ok(topicList.length > 0, 'topics.json should not be empty');
  for (const topic of topicList) {
    assert.deepEqual(hits(buildPrompt(topic), 'block'), [], `topic ${topic.id}`);
  }
});

test('the writer prompt states no universal base depth', () => {
  assert.deepEqual(hits(buildPrompt(topicList[0]), 'warn'), []);
});
