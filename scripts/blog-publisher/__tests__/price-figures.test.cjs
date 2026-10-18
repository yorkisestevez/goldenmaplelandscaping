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

test('k ranges, open-ended k amounts and "a grand" forms are prices; code values are not', () => {
  assert.deepEqual(extractPriceFigures('A full backyard runs 60-90k. Most jobs land at 25k-40k. Some reach 90k+, or 120K+.'), ['$60k–$90k', '$25k–$40k', '$90k+', '$120k+']);
  assert.deepEqual(extractPriceFigures('Lighting adds a couple grand, or a thousand dollars.'), ['a couple grand', 'a thousand dollars']);
  assert.deepEqual(extractPriceFigures("value: '13k-25k', key under-25k, '250k+', budget_or_estimate_50k_plus, 2,700K, 3000K"), []);
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
  // The subject must be in the figure's own sentence: a subject one sentence away is how a driveway price got through.
  assert.equal(findUnapprovedFigures('For a 300 sq ft patio, here is the math. The range is $40–$45 per square foot.', SHEET).length, 1);
});

// The real sheet: every fact also carries its basis (unit, size, height) and the other facts' subjects.
const REAL = require('../../../src/data/publishedPriceFacts.json');

test('a published fact copied as stated is approved', () => {
  for (const f of REAL.facts) if (f.figures.length) assert.deepEqual(findUnapprovedFigures(f.statement, REAL), [], f.id);
});

test('an engine figure for the wrong subject, size, unit or height is not approved, however it is split', () => {
  for (const s of [
    '<p>An interlocking driveway is built on a deeper base. It costs about $40–$45 per square foot.</p>',
    'How much does a porcelain patio cost?\nMost come out around $40–$45 per square foot before HST.',
    '<h2>Interlocking Driveway Costs in Barrie</h2>\n<p>The base is deeper.</p>\n<p>Most interlocking work runs about $40–$45 per square foot before HST.</p>',
    'Drainage behind the patio runs $40–$45 per square foot.',
    'Unlike interlocking patios, a retaining wall runs $40–$45 per linear foot.',
    'A 300 sq ft interlocking patio is most likely about $40,000.',
    'A French drain behind the retaining wall runs around $470 per linear foot.',
    'An armour-stone wall 2–4 ft high runs around $470 per linear foot.',
    'A natural-stone patio runs around $40–$45 per square foot.',
    'Interlock steps at the front entrance add about $5 per square foot with premium pavers.',
    'Repairing a sunken interlock patio usually runs $40–$45 per square foot.',
    'A retaining wall runs about $970 per linear foot.',
    'Interlocking patios run about $40–$45.',
  ]) assert.equal(findUnapprovedFigures(s, REAL).length, 1, s);
});

test('each unapproved figure says what to fix', () => {
  const [hit] = findUnapprovedFigures('An interlocking driveway costs about $40–$45 per square foot.', REAL);
  assert.match(hit.reason, /driveway/);
  const [bare] = findUnapprovedFigures('A patio runs about 40 grand.', REAL);
  assert.match(bare.reason, /not a published engine figure/);
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
  const cells = '<table><tr><th>Paver</th><th>Per sq ft</th><th>Best for</th></tr><tr><td>Standard pavers</td><td>around $40–$45</td><td>Patios</td></tr></table>';
  assert.deepEqual(findUnapprovedFigures(cells, REAL), [], 'a fact in a table cell is read with its header, row and caption');
  const walls = '<table><caption>Retaining wall cost by height</caption><tr><th>Wall height</th><th>Around (per linear ft)</th><th>Typical range</th></tr>'
    + '<tr><td>Under 2 ft</td><td>$330</td><td>$280–$425</td></tr><tr><td>2–4 ft</td><td>$470</td><td>$405–$555</td></tr><tr><td>4–6 ft</td><td>$670</td><td>$585–$770</td></tr></table>';
  assert.deepEqual(findUnapprovedFigures(walls, REAL), [], 'a by-height wall table built from the facts passes');
  const noted = '<table><tr><th>Patio</th><th>Typical Cost (CAD)</th></tr><tr><td>Small</td><td>15,500–30,000 (350–450 sq ft)</td></tr><tr><td>Large</td><td>about 40,000</td></tr></table>';
  assert.equal(findUnapprovedFigures(noted, REAL).length, 2, 'money cells with a note, "about" or a (CAD) header are prices');
});

test('any figure that is not an engine fact is reported with its context', () => {
  const hits = findUnapprovedFigures('<p>A patio runs $25 per sq ft, and a fire pit adds $3,000–$6,000.</p>', SHEET);
  assert.deepEqual(hits.map((h) => h.figure), ['$25', '$3,000–$6,000']);
});

test('repeated figures are all reported, in order', () => {
  assert.deepEqual(extractPriceFigures('$40–$45 here, $53 there, $40-$45 again'), ['$40–$45', '$53', '$40–$45']);
});

test('round 5: wrong paving, out-of-range sizes and heights, and after-tax figures are not approved', () => {
  for (const s of [
    'A concrete patio costs $40–$45 per square foot.',
    'Premium paver sand is about $5 per square foot.',
    'A 100 sq ft interlocking patio costs $40–$45 per square foot.',
    'Retaining walls over 6 ft run $330–$670 per linear foot.',
    'Most interlocking patios come out around $40–$45 per square foot after HST.',
  ]) assert.equal(findUnapprovedFigures(s, REAL).length, 1, s);
});

test('round 5: natural writing of a fact still passes', () => {
  for (const s of [
    'A 300-square-foot interlocking patio is most likely about $13,500 before HST.',
    'A 300 sq-ft interlocking patio is most likely about $13,500 before HST.',
    'Standard concrete pavers on an interlocking patio come out around $40–$45 per square foot before HST.',
    '<p>A retaining wall 6 ft+ high is around $970 per linear foot (typically $845–$1,090) for about 50 ft of wall.</p>\n<h2>Budgeting steps</h2>\n<p>Steps are priced at the site visit.</p>',
    'A retaining wall 2–4 ft high is around $470 per linear foot (typically $405–$555). Access and drainage can move it.',
  ]) assert.deepEqual(findUnapprovedFigures(s, REAL), [], s);
});

test('round 5: "a grand entrance" is not a price; cost-table rows and "from 15,000" are', () => {
  assert.deepEqual(extractPriceFigures('A grand entrance, a grand total of three steps, a grand idea.'), []);
  assert.deepEqual(extractPriceFigures('Steps add about a grand each.'), ['a grand']);
  const table = '<table><tr><th>Patio size</th><th>Cost ($)</th></tr><tr><td>300 sq ft</td><td>99,999</td></tr><tr><td>Large (over 600 sq ft)</td><td>from 15,000</td></tr><tr><td>Number of steps</td><td>12,000 per job</td></tr></table>';
  assert.equal(findUnapprovedFigures(table, REAL).length, 3);
});
