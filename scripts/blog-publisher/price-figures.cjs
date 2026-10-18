// Every price in a piece of copy, in one canonical spelling, so the same price always compares equal:
// "$40-45", "$40 to $45" and "$40 – $45" all read "$40–$45"; "$12K" reads "$12k"; "25,000 dollars",
// "CAD 25,000" and "25,000 CAD" all read "$25,000".
//
// Shared by the price ledger (scripts/check-price-ledger.ts), the blog publisher's draft validator and
// the published price facts (src/data/publishedPriceFacts.json). Plain CommonJS: the publisher runs on
// bare Node with no install step.

// A number, an optional k/m suffix that is not the start of a word ("$30 more") or a spelled-out
// thousand/million/grand, and an optional open-ended "+". Template code such as `$${n}` never matches: a digit
// must follow the "$". Thousands separators must be real groups of three, so a sentence comma ("$18,500, or")
// is not swallowed.
const AMOUNT = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:\s?(?:[kKmM](?![A-Za-z])|thousand\b|million\b|grand\b))?\+?`;
const SEPARATOR = String.raw`\s?(?:–|—|-|to)\s?`;
const GROUPED = String.raw`\d+(?:[ ,]\d{3})*(?:\.\d+)?`;
const NUMBER_WORD = String.raw`(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|a few|several)`;
const FIGURE = new RegExp(
  [
    // $25,000 · US$25,000 · $18k–$33k · $25 thousand
    String.raw`(?:US|CA|C|A)?\$\s?${AMOUNT}(?:${SEPARATOR}(?:(?:US|CA|C|A)?\$)?\s?${AMOUNT})?`,
    // 25,000 dollars · 25 000 $ · 18 to 33 thousand dollars
    String.raw`\b${GROUPED}(?:${SEPARATOR}${GROUPED})?\s?(?:(?:[kK]|thousand|million|grand)\s?)?(?:dollars\b|bucks\b|\$(?![{\w]))`,
    // 25 grand · 25 thousand (not "10 thousand square feet")
    String.raw`\b${GROUPED}(?:${SEPARATOR}${GROUPED})?\s?grand\b`,
    String.raw`\b${GROUPED}(?:${SEPARATOR}${GROUPED})?\s(?:thousand|million)\b(?!\s+(?:sq|square|feet|linear|people|homes|visitors|residents|pavers|stones|pounds|lbs|tons))`,
    // twenty-five thousand dollars · fifty dollars · twenty grand
    String.raw`\b${NUMBER_WORD}(?:[\s-]+${NUMBER_WORD})*(?:[\s-]+(?:thousand|million))?\s+(?:dollars|bucks|grand)\b`,
  ].join('|'),
  'gi',
);
// Case matters for these, so they are a separate, case-sensitive pattern:
//   CAD 25,000 · USD 25000 · 25,000 CAD — upper case only, and never a year or a dimension ("CAD 3D render",
//   "CAD 2026 software");
//   about 25k — a lower-case k standing alone in prose ("2,700K" is a colour temperature; '13k-25k' is a code value).
const CURRENCY_AMOUNT = String.raw`(?!(?:19|20)\d\d\b)${GROUPED}(?![dD]\b)`;
const CURRENCY_FIGURE = new RegExp(
  [
    String.raw`\b(?:CAD|USD|CDN)\s?${CURRENCY_AMOUNT}(?:${SEPARATOR}${CURRENCY_AMOUNT})?`,
    String.raw`\b${CURRENCY_AMOUNT}(?:${SEPARATOR}${CURRENCY_AMOUNT})?\s?(?:CAD|USD|CDN)\b`,
    String.raw`(?<![-'"\w.])\d+(?:\.\d+)?\s?k\b(?![-'"+\w])`,
    // about 25K — upper case only with 1–3 digits not after a digit group (2,700K / 3000K is colour temperature)
    String.raw`(?<![-'"\w.,])\d{1,3}(?:\.\d+)?\s?K\b(?![-'"+\w])`,
  ].join('|'),
  'g',
);

/** Every figure match in `source` as { raw, index }, in order, overlaps dropped. */
function figureMatches(source) {
  const all = [...source.matchAll(FIGURE), ...source.matchAll(CURRENCY_FIGURE)]
    .map((m) => ({ raw: m[0], index: m.index }))
    .sort((a, b) => a.index - b.index || b.raw.length - a.raw.length);
  const kept = [];
  for (const m of all) if (!kept.length || m.index >= kept[kept.length - 1].index + kept[kept.length - 1].raw.length) kept.push(m);
  return kept;
}

/** Entities, escapes and look-alike characters that render as "$" or a space are read as the visitor sees them. */
function normalise(text) {
  return String(text)
    .normalize('NFKC')
    .replace(/&#0*36;|&#x0*24;|&dollar;|\\u0024|\\x24/gi, '$')
    .replace(/&nbsp;|&#160;| | /g, ' ')
    .replace(/&ndash;|&#8211;/g, '–')
    .replace(/&mdash;|&#8212;/g, '—')
    // JSX that splits the sign from its number: {'$'}25,000 · <strong>$</strong>25,000
    .replace(/\{\s*['"`]\$['"`]\s*\}\s*/g, '$')
    .replace(/\$\s*(?:<\/?[a-z][^>]*>\s*)+(?=\d)/gi, '$');
}

const MULTIPLIER = { k: 'k', thousand: 'k', grand: 'k', m: 'm', million: 'm' };

/** "$40 to 45" → "$40–$45"; "$8K – $12K" → "$8k–$12k"; "25,000 dollars" → "$25,000"; "$3,500+" stays. */
function canonicalFigure(raw) {
  const text = String(raw).trim();
  if (/[a-z]{3,}/i.test(text.replace(/\b(?:dollars|bucks|thousand|million|grand|CAD|USD|CDN|to)\b/gi, ''))) {
    return text.toLowerCase().replace(/\s+/g, ' '); // a spelled-out amount is compared verbatim
  }
  const suffix = (/(thousand|million|grand)\b/i.exec(text) || [])[1];
  const numbers = [...text.matchAll(/(\d{1,3}(?:[ ,]\d{3})+|\d+)(?:\.(\d+))?(?:\s?([kKmM])(?![A-Za-z]))?(\+)?/g)].map(([, whole, frac, k, plus]) => {
    const unit = (k || (suffix ? MULTIPLIER[suffix.toLowerCase()] : '') || '').toLowerCase();
    const grouped = whole.replace(/[ ,]/g, '').replace(/\B(?=(\d{3})+$)/g, ',');
    return `$${grouped}${frac ? `.${frac}` : ''}${unit}${plus || ''}`;
  });
  return numbers.slice(0, 2).join('–');
}

/** Every price in `text`, canonical, in document order (repeats included). */
function extractPriceFigures(text) {
  return figureMatches(normalise(text)).map((m) => canonicalFigure(m.raw));
}

// A sentence ends at ". " / "! " / "? ", a line break, or a block tag. "sq. ft." and decimals do not end one.
const BOUNDARY = /(?<!\bsq|\bft|\bapprox|\bvs|\be\.g|\bi\.e)[.!?](?=\s)|\n|<\/?(?:p|li|td|th|tr|h[1-6]|div|br)\b[^>]*>/gi;

/** [start, end) of every sentence in `source` that has words in it (the gap between "</td><td>" is not one). */
function sentenceSpans(source) {
  const cuts = [0, ...[...source.matchAll(BOUNDARY)].map((b) => b.index + b[0].length), source.length];
  return cuts.slice(0, -1).map((start, n) => [start, cuts[n + 1]])
    .filter(([start, end]) => source.slice(start, end).replace(/<[^>]*>/g, '').trim());
}

const MAX_CONTEXT = 600;

/** The sentence around `index`, widened by `extra` sentences either side. */
function sentenceAround(source, spans, index, extra) {
  let lo = 0;
  let hi = spans.length - 1;
  while (lo < hi) { // the last sentence starting at or before index (binary search: posts have thousands)
    const mid = (lo + hi + 1) >> 1;
    if (spans[mid][0] <= index) lo = mid; else hi = mid - 1;
  }
  const i = lo;
  // No real sentence is longer than this; the cap keeps a run-on input from making every figure read all of it.
  const start = Math.max(spans[Math.max(0, i - extra)][0], index - MAX_CONTEXT);
  const end = Math.min(spans[Math.min(spans.length - 1, i + extra)][1], index + MAX_CONTEXT);
  return source.slice(start, end);
}

// Separately priced subjects the engine facts never cover. A fact's figure in a sentence naming one of these is
// someone else's price ("$40–$45 for an interlocking driveway", "$13,500 for a pergola by the patio").
const OTHER_SUBJECTS = /driveway|porcelain|natural stone|flagstone|armou?r ?stone|\bdecks?\b|decking|pergola|kitchen|fire ?pit|fireplace|lighting|\bsod\b|permit|fence|sealer|sealing|polymeric|stamped|\bpool\b|hot tub|gazebo|\bshed\b/i;

/** A price table's bare-number cells ("Cost ($)" header, "25,000" cell) are prices even without a "$". */
// "Cost ($)", "Price per sq ft" are money columns; "Cost level" is a ranking. "Total" and "Rate" are money unless
// the header names what they measure: "Total area (sq ft)", "Rate of settling (mm)".
const MONEY_WORD = /\$|cost|price|budget|investment|allowance|spend/i;
const RANKING = /\b(?:level|tier|rank)\b/i;
const TOTAL_WORD = /\btotal\b|\brate\b/i;
const MEASURE_HEADER = /\((?:sq|ft|lf|mm|cm|m|in|inches|lbs?|%|days?|hrs?|hours|weeks?)\b|sq\.? ?ft|square f|linear f|\barea\b|depth|thickness|settling|\bdays\b|\bweeks\b|\bhours\b/i;
const isMoneyHeader = (h) => (MONEY_WORD.test(h) && !RANKING.test(h)) || (TOTAL_WORD.test(h) && !MEASURE_HEADER.test(h));
const BARE_AMOUNT = /^\d+(?:[ ,]\d{3})*(?:\.\d+)?(?:\s?[kK])?(?:\s?(?:–|—|-|to)\s?\d+(?:[ ,]\d{3})*(?:\.\d+)?(?:\s?[kK])?)?\+?$/;
const cellText = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
function bareTableAmounts(source) {
  const found = [];
  for (const table of source.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
    const rows = [...table[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)];
    const headerRow = rows.find((r) => /<th\b/i.test(r[0]));
    if (!headerRow) continue;
    const moneyColumns = [...headerRow[0].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)]
      .map((h, column) => (isMoneyHeader(cellText(h[1])) ? column : -1)).filter((c) => c >= 0);
    for (const row of rows) {
      [...row[0].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].forEach((cell, column) => {
        const bare = moneyColumns.includes(column) && BARE_AMOUNT.exec(cellText(cell[1]));
        if (bare) found.push({ figure: canonicalFigure(bare[0]), index: table.index + row.index + cell.index, length: cell[0].length, bare: true });
      });
    }
  }
  return found;
}

/**
 * Every price in `text` that is NOT an engine fact quoted about its own subject. A figure is approved only when
 * a fact in `sheet` (src/data/publishedPriceFacts.json) lists it, one of that fact's keywords is named in its
 * sentence or the one either side, AND its own sentence names no other priced subject (OTHER_SUBJECTS). So "$5"
 * for premium pavers is approved, "$5" for a bag of polymeric sand is not. Bare numbers in a price table are never
 * approved: a fact is always written with its "$". Returns [{ figure, context }] in document order.
 */
function findUnapprovedFigures(text, sheet) {
  const source = normalise(text);
  const spans = sentenceSpans(source);
  const figures = figureMatches(source).map((m) => ({ figure: canonicalFigure(m.raw), index: m.index, length: m.raw.length, bare: false }));
  // A cell already read as a figure ("25k") is not counted again as a bare amount.
  const bare = bareTableAmounts(source).filter((b) => !figures.some((f) => f.index >= b.index && f.index < b.index + b.length));
  const hits = [...figures, ...bare].sort((a, b) => a.index - b.index);
  const unapproved = [];
  for (const hit of hits) {
    const near = sentenceAround(source, spans, hit.index, 1).toLowerCase();
    const approved = !hit.bare && !OTHER_SUBJECTS.test(sentenceAround(source, spans, hit.index, 0)) &&
      (sheet.facts || []).some((f) => (f.figures || []).includes(hit.figure) && (f.keywords || []).some((k) => near.includes(k)));
    if (!approved) {
      const context = source.slice(Math.max(0, hit.index - 60), hit.index + hit.length + 60).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      unapproved.push({ figure: hit.bare ? `${hit.figure} (bare, in a price table)` : hit.figure, context });
    }
  }
  return unapproved;
}

module.exports = { extractPriceFigures, canonicalFigure, findUnapprovedFigures };
