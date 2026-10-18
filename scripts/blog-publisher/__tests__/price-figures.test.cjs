// scripts/blog-publisher/__tests__/price-figures.test.cjs
//
// Run via: node --test scripts/blog-publisher/__tests__/*.test.cjs
//
// Every dollar figure on the site is either computed by the cost-estimator engine or approved in
// docs/pricing/price-ledger.json (owner decision 2026-10-17: no invented prices, at all cost). That only
// works if the same price always reads the same way, so this pins the extractor's canonical spelling.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractPriceFigures, canonicalFigure } = require('../price-figures.cjs');

test('ranges written different ways share one canonical spelling', () => {
  for (const raw of ['$40-45', '$40–$45', '$40 – $45', '$40 to $45', '$40—$45', '$40 -$45']) {
    assert.equal(canonicalFigure(raw), '$40–$45', raw);
  }
});

test('thousands, suffixes and open-ended figures are kept as written', () => {
  assert.deepEqual(extractPriceFigures('From $12,000 to $18,500, or $8K–$12K, or $3,500+.'), ['$12,000–$18,500', '$8k–$12k', '$3,500+']);
  assert.deepEqual(extractPriceFigures('About $0.40–$0.80 per sq ft and $1.5k–$4k.'), ['$0.40–$0.80', '$1.5k–$4k']);
});

test('words after a figure are not swallowed into it', () => {
  assert.deepEqual(extractPriceFigures('It costs $30 more per foot and $5 to replace.'), ['$30', '$5']);
  assert.deepEqual(extractPriceFigures('$5M liability'), ['$5m']);
  assert.deepEqual(extractPriceFigures('$4 million and $25 thousand'), ['$4m', '$25k']);
});

test('a price written without a leading "$" is still a price', () => {
  assert.deepEqual(
    extractPriceFigures('CAD 4,500 · 25,000 CAD · 25000 dollars · USD 25000 · 25 000 $ · 18 to 33 thousand dollars'),
    ['$4,500', '$25,000', '$25,000', '$25,000', '$25,000', '$18k–$33k'],
  );
  assert.deepEqual(extractPriceFigures('twenty-five thousand dollars, or fifty dollars a foot, or twenty grand'), ['twenty-five thousand dollars', 'fifty dollars', 'twenty grand']);
});

test('entities, look-alikes and split JSX read as the "$" the visitor sees', () => {
  for (const raw of ['&#36;25,000', '&dollar;25,000', '＄25,000', '$&nbsp;25,000', "{'$'}25,000", '<strong>$</strong>25,000', 'US$25,000']) {
    assert.deepEqual(extractPriceFigures(raw), ['$25,000'], raw);
  }
});

test('template code, years, counts and measurements are not prices', () => {
  assert.deepEqual(extractPriceFigures('className={`p-3 duration-150 ${selected}`} In 2026 we laid 300 sq ft'), []);
});

test('"CAD" the drawing tool is not a currency; CAD the currency is', () => {
  assert.deepEqual(extractPriceFigures('We produce a CAD 3D render using CAD 2026 software, and the cad file is yours.'), []);
  assert.deepEqual(extractPriceFigures('Budget CAD 18,000, or 25,000 CAD.'), ['$18,000', '$25,000']);
});

test('"25 grand", "25 thousand" and a bare "25k" / "25K" are prices; colour temperatures and areas are not', () => {
  assert.deepEqual(extractPriceFigures('That is 25 grand, or about 25k, or 25K, or 25 thousand.'), ['$25k', '$25k', '$25k', '$25k']);
  assert.deepEqual(extractPriceFigures('Use 2,700K or 3000K lights over 10 thousand square feet.'), []);
});

test('code-generated prices in templates are not figures', () => {
  assert.deepEqual(extractPriceFigures('`${money(low)}–$${n}` and {`$${total}`}'), []);
});

const { findUnapprovedFigures } = require('../price-figures.cjs');
const SHEET = {
  facts: [
    { id: 'patio.rate', keywords: ['patio', 'interlock', 'paver'], figures: ['$40–$45'] },
    { id: 'patio.premium', keywords: ['patio', 'interlock', 'paver'], figures: ['$5'] },
    { id: 'wall.rate', keywords: ['wall'], figures: ['$330–$670'] },
  ],
};

test('an engine figure next to its own subject is approved', () => {
  assert.deepEqual(findUnapprovedFigures('Most interlocking patios come out around $40-45 per square foot.', SHEET), []);
  assert.deepEqual(findUnapprovedFigures('Retaining walls run $330 to $670 per linear foot.', SHEET), []);
});

test('an engine figure in the wrong context is not approved', () => {
  const hits = findUnapprovedFigures('A bag of polymeric sand is about $5 at the yard.', SHEET);
  assert.deepEqual(hits.map((h) => h.figure), ['$5']);
  assert.match(hits[0].context, /polymeric sand/);
  assert.deepEqual(findUnapprovedFigures('A composite deck runs $40–$45 per square foot.', SHEET).map((h) => h.figure), ['$40–$45']);
});

test('an engine figure is not approved for another subject named in its own sentence', () => {
  for (const s of [
    'An interlocking driveway costs about $40–$45 per square foot.',
    'A composite deck beside the patio costs $40–$45 per square foot.',
    'Porcelain pavers on a rear patio run $5 more per square foot.',
  ]) assert.equal(findUnapprovedFigures(s, SHEET).length, 1, s);
  assert.deepEqual(findUnapprovedFigures('For a 300 sq ft patio, here is the math. The range is $40–$45 per square foot.', SHEET), []);
});

test('bare amounts in a price column are prices; other columns are not', () => {
  const table = '<table><tr><th>Size (sq ft)</th><th>Cost ($)</th></tr><tr><td>300</td><td>25,000</td></tr></table>';
  assert.deepEqual(findUnapprovedFigures(table, SHEET).map((h) => h.figure), ['$25,000 (bare, in a price table)']);
  const perFoot = '<table><tr><th>Paver</th><th>Cost per sq ft</th></tr><tr><td>Standard</td><td>40–45</td></tr></table>';
  assert.deepEqual(findUnapprovedFigures(perFoot, SHEET).map((h) => h.figure), ['$40–$45 (bare, in a price table)'], 'even a two-digit amount in a price column');
  const units = '<table><tr><th>Total area (sq ft)</th><th>Rate of settling (mm)</th></tr><tr><td>1,200</td><td>300</td></tr></table>';
  assert.deepEqual(findUnapprovedFigures(units, SHEET), [], 'area and settling columns are not prices');
  const totals = '<table><tr><th>Cost level</th><th>Total</th></tr><tr><td>2</td><td>25000</td></tr></table>';
  assert.deepEqual(findUnapprovedFigures(totals, SHEET).map((h) => h.figure), ['$25,000 (bare, in a price table)'], 'a Total column is money, a Cost level column is a ranking');
  const cells = '<tr><td>Standard pavers</td><td>around $40–$45</td><td>Patios, walkways</td></tr>';
  assert.deepEqual(findUnapprovedFigures(cells, SHEET), [], 'a fact in a table cell is read with the cells beside it');
});

test('any figure that is not an engine fact is reported with its context', () => {
  const hits = findUnapprovedFigures('<p>A patio runs $25 per sq ft, and a fire pit adds $3,000–$6,000.</p>', SHEET);
  assert.deepEqual(hits.map((h) => h.figure), ['$25', '$3,000–$6,000']);
});

test('repeated figures are all reported, in order', () => {
  assert.deepEqual(extractPriceFigures('$40–$45 here, $53 there, $40-$45 again'), ['$40–$45', '$53', '$40–$45']);
});
