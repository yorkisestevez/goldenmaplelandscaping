import assert from 'node:assert/strict';
import { pickTeaser, shouldShowTeaser, isPriceQuestion, projectFromText, COST_CHIP, BOOK_CHIP } from '../src/data/sophieTeasers';

// Route → which project Sophie preselects.
const cases: Array<[string, string | undefined]> = [
  ['/', undefined],
  ['/services/interlocking-barrie', 'patio'],
  ['/patios-barrie/', 'patio'],
  ['/services/retaining-walls-barrie', 'wall'],
  ['/sloped-backyard-solutions-barrie', 'wall'],
  ['/services/composite-decking-barrie', 'deck'],
  ['/full-backyard-transformations-barrie', 'full'],
  ['/resources/paver-walkway-cost-barrie', 'walkway'],
  ['/portfolio', undefined],
];
for (const [path, project] of cases) {
  const teaser = pickTeaser(path);
  assert.ok(teaser, `${path} must have a teaser`);
  assert.equal(teaser.project, project, `${path} preselects ${project}`);
  assert.deepEqual(teaser.chips, [COST_CHIP, BOOK_CHIP]);
}

// Page-specific lines, not one line everywhere.
assert.notEqual(pickTeaser('/portfolio/some-job')!.line, pickTeaser('/')!.line);
assert.notEqual(pickTeaser('/resources/why-patios-sink-barrie')!.line, pickTeaser('/')!.line);
assert.equal(pickTeaser('/resources/why-patios-sink-barrie')!.project, 'patio');

// Pages where a nudge gets in the way.
for (const path of ['/privacy', '/terms/', '/book', '/contact', '/cost-guide/thank-you', '/cost-estimator', '/deck-designer']) {
  assert.equal(pickTeaser(path), null, `${path} must not tease`);
}

// Once per session, never over an open panel or a conversation already under way.
const base = { pathname: '/', stored: null, chatted: false, open: false } as const;
assert.equal(shouldShowTeaser(base), true);
assert.equal(shouldShowTeaser({ ...base, stored: 'seen' }), false);
assert.equal(shouldShowTeaser({ ...base, stored: 'dismissed' }), false);
assert.equal(shouldShowTeaser({ ...base, chatted: true }), false);
assert.equal(shouldShowTeaser({ ...base, open: true }), false);
assert.equal(shouldShowTeaser({ ...base, pathname: '/privacy' }), false);

// Typed price questions go to the estimator-backed range, not the LLM.
for (const q of ['How much does a patio cost?', 'whats the price for a wall', 'ballpark for 400 sq ft?', 'what would it cost']) {
  assert.equal(isPriceQuestion(q), true, q);
}
// Policy questions ("free estimate", "a quote", budget talk) belong to the fact-gated model, not the range.
for (const q of ['Do you build composite decks?', 'Which areas do you serve?', "What's your warranty?", 'Do you offer free estimates?', 'I need a quote', 'Can I get an estimate visit?', 'Is it expensive to maintain?']) {
  assert.equal(isPriceQuestion(q), false, q);
}

// What the visitor names beats what the page is about (a patio question on the deck page is a patio).
const named: Array<[string, string | undefined]> = [
  ['How much would a patio cost me?', 'patio'],
  ['price for an interlock driveway', 'patio'],
  ['what does a retaining wall run', 'wall'],
  ['cost of a composite deck', 'deck'],
  ['ballpark for redoing the whole backyard', 'full'],
  ['how much is a walkway', 'walkway'],
  ['how much does it cost', undefined],
];
for (const [q, project] of named) assert.equal(projectFromText(q), project, q);

console.log(`sophie teasers: ${cases.length} routes mapped, suppression + once-per-session rules hold`);
