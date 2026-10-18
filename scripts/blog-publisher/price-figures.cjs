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
    // a thousand dollars · a grand · a couple grand · a couple of thousand dollars
    String.raw`\b(?:an?|a couple(?: of)?)\s+(?:(?:hundred|thousand)\s+(?:dollars|bucks)|grand(?=\s*(?:$|[.,;:!?)]|(?:for|or|and|to|more|less|extra|per|each|apiece|on|in|plus|a|an|tops|max)\b)))\b`,
  ].join('|'),
  'gi',
);
// Case matters for these, so they are a separate, case-sensitive pattern:
//   CAD 25,000 · USD 25000 · 25,000 CAD — upper case only, and never a year or a dimension ("CAD 3D render",
//   "CAD 2026 software");
//   about 25k · 60-90k · 90k+ — a k-number standing alone in prose. Its edges exclude code values ('13k-25k' inside a
//   string, 'under-25k', '250k+' as a key) and colour temperatures ("2,700K", "3000K").
const CURRENCY_AMOUNT = String.raw`(?!(?:19|20)\d\d\b)${GROUPED}(?![dD]\b)`;
const K_RANGE = (k) => String.raw`\d+(?:\.\d+)?(?:\s?${k}?\s?(?:–|—|-|to)\s?\d+(?:\.\d+)?)?\s?${k}\b\+?`;
const CURRENCY_FIGURE = new RegExp(
  [
    String.raw`\b(?:CAD|USD|CDN)\s?${CURRENCY_AMOUNT}(?:${SEPARATOR}${CURRENCY_AMOUNT})?`,
    String.raw`\b${CURRENCY_AMOUNT}(?:${SEPARATOR}${CURRENCY_AMOUNT})?\s?(?:CAD|USD|CDN)\b`,
    String.raw`(?<![-'"\w.$])${K_RANGE('k')}(?![-'"\w])`,
    String.raw`(?<![-'"\w.,$])(?=\d{1,3}\D)${K_RANGE('K')}(?![-'"\w])`,
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
  if (!/\d/.test(text) || /[a-z]{3,}/i.test(text.replace(/\b(?:dollars|bucks|thousand|million|grand|CAD|USD|CDN|to)\b/gi, ''))) {
    return text.toLowerCase().replace(/\s+/g, ' '); // a spelled-out amount is compared verbatim
  }
  const suffix = (/(thousand|million|grand)\b/i.exec(text) || [])[1];
  const trailingK = (/\d\s?([kK])\b\+?$/.exec(text) || [])[1]; // "60-90k": the k applies to both ends
  const numbers = [...text.matchAll(/(\d{1,3}(?:[ ,]\d{3})+|\d+)(?:\.(\d+))?(?:\s?([kKmM])(?![A-Za-z]))?(\+)?/g)].map(([, whole, frac, k, plus]) => {
    const unit = (k || trailingK || (suffix ? MULTIPLIER[suffix.toLowerCase()] : '') || '').toLowerCase();
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

/** The sentence just before the one at `index`, if it is in the same paragraph (no heading or blank line between). */
function previousInParagraph(source, spans, index) {
  const i = spans.findIndex(([start, end]) => start <= index && index < end);
  if (i <= 0) return '';
  const [prevStart, prevEnd] = spans[i - 1];
  const prev = source.slice(prevStart, prevEnd);
  const between = source.slice(prevEnd, spans[i][0]);
  const paragraphBreak = /<\/(?:p|li|td|th|h[1-6])>|<h[1-6]\b/i.test(prev) || /\n[ \t]*\n|<(?:p|li|td|th|h[1-6])\b/i.test(between);
  return paragraphBreak ? '' : prev;
}

// The published figures are all before HST.
const AFTER_TAX = /\b(?:after|including|incl\.?|with)\s+HST\b|\bHST[\s-]+included\b|\btax(?:es)?[\s-]+in(?:cluded)?\b|\ball[\s-]in\b/i;

/** The nearest heading or FAQ question before `index` ("Interlocking Driveway Costs" above a priced paragraph). */
function headingBefore(source, index) {
  const before = source.slice(Math.max(0, index - 4000), index);
  const heads = [...before.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>|"(?:name|question)"\s*:\s*"([^"]*)"|\bq(?:uestion)?\s*:\s*['"`]([^'"`]*)['"`]/gi)];
  const last = heads[heads.length - 1];
  return last ? (last[1] || last[2] || last[3] || '') : '';
}

// Separately priced subjects the engine facts never cover. A fact's figure near one of these is someone else's price
// ("$40–$45 for an interlocking driveway", "$13,500 for a pergola by the patio", "drainage behind the wall runs $470").
// Kept in step with the 'everything-else' fact in scripts/gen-price-facts.ts.
const OTHER_SUBJECTS = /driveway|porcelain|natural[\s-]stone|flagstone|armou?r[\s-]?stone|\bdecks?\b|decking|pergola|kitchen|fire[\s-]?pit|fire[\s-]?table|fireplace|lighting|\bsod\b|permit|fence|sealer|sealing|polymeric|stamped|poured\s+concrete|concrete\s+slab|asphalt|\bpool\b|hot[\s-]?tub|gazebo|\bshed\b|drain|repair|re-?lay|re-?grad|\bsteps?\b|stairs?\b|seat[\s-]?walls?|sleeper|edging|planting|irrigation|snow|sunroom|porch/i;

/** A price table's bare-number cells ("Cost ($)" header, "25,000" cell) are prices even without a "$". */
// "Cost ($)", "Price per sq ft", "Typical range (CAD)" are money columns; "Cost level" is a ranking. "Total" and
// "Rate" are money unless the header names what they measure: "Total area (sq ft)", "Rate of settling (mm)".
const MONEY_WORD = /\$|cost|price|budget|investment|allowance|spend|\bCAD\b|\bUSD\b|installed/i;
const RANKING = /\b(?:level|tier|rank)\b/i;
const TOTAL_WORD = /\btotal\b|\brate\b|\brange\b/i;
const MEASURE_HEADER = /\((?:sq|ft|lf|mm|cm|m|in|inches|lbs?|%|days?|hrs?|hours|weeks?)\b|sq\.? ?ft|square f|linear f|\barea\b|depth|thickness|settling|\bdays\b|\bweeks\b|\bhours\b|height|size/i;
const isMoneyHeader = (h) => (MONEY_WORD.test(h) && !RANKING.test(h)) || (TOTAL_WORD.test(h) && !MEASURE_HEADER.test(h));
// A money cell's leading amount: "25,000", "~15,000", "about 15,000", "15,500–30,000 (350–450 sq ft)".
// Only when nothing it measures follows ("300–400 sq ft", "2–3 weeks", "8–12 fixtures" are not prices), and not in a
// row that is itself a size, timeline or count.
const BARE_PREFIX = /^(?:[~≈]\s?|(?:about|around|roughly|approx\.?|from|starting\s+at|up\s+to)\s+)/i;
const BARE_AMOUNT = /^(?:[~≈]\s?|(?:about|around|roughly|approx\.?|from|starting\s+at|up\s+to)\s+)?\d+(?:[ ,]\d{3})*(?:\.\d+)?(?:\s?[kK])?(?:\s?(?:–|—|-|to)\s?\d+(?:[ ,]\d{3})*(?:\.\d+)?(?:\s?[kK])?)?\+?(?=\s*$|\s*\(|\s*(?:CAD|USD|\+?\s*HST|before|installed|total|all[\s-]in|and\s+up|or\s+more|per\s+(?:job|project))\b)/i;
const MEASURE_ROW = /size|area|sq\.?\s?ft|square|timeline|duration|time|weeks?|days?|count|number|fixtures|height|depth|length|width|qty|quantity/i;
const cellText = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** Every table's cells, with what a reader sees around each one: the header row, the row's first cell, the caption. */
function tableCells(source) {
  const cells = [];
  for (const table of source.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
    const caption = cellText((/<caption\b[^>]*>([\s\S]*?)<\/caption>/i.exec(table[0]) || [])[1] || '');
    const rows = [...table[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)];
    const headerRow = rows.find((r) => /<th\b/i.test(r[0]));
    const headers = headerRow ? [...headerRow[0].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((h) => cellText(h[1])) : [];
    for (const row of rows) {
      const tds = [...row[0].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
      tds.forEach((cell, column) => cells.push({
        start: table.index + row.index + cell.index, end: table.index + row.index + cell.index + cell[0].length,
        text: cellText(cell[1]), money: !!headers[column] && isMoneyHeader(headers[column]),
        strongMoney: !!headers[column] && MONEY_WORD.test(headers[column]) && !RANKING.test(headers[column]),
        context: [caption, headers.join(' '), tds[0] ? cellText(tds[0][1]) : '', cellText(cell[1])].join(' \n '),
        row: tds.map((t) => cellText(t[1])).join(' '),
        label: tds[0] && column > 0 ? cellText(tds[0][1]) : '',
      }));
    }
  }
  return cells;
}

const word = (k) => new RegExp(String.raw`\b${k}`, 'i');
const plain = (html) => html.replace(/<[^>]*>/g, ' ');

/**
 * Every price in `text` that is NOT an engine fact quoted about its own subject and basis. A figure is approved only
 * when a fact in `sheet` (src/data/publishedPriceFacts.json) lists it and, in the figure's own sentence (or, in a
 * table, its row, header and caption):
 *   - one of the fact's keywords names its subject ("interlocking patio"),
 *   - its `requires` pattern states its basis ("per square foot", "300 sq ft", "2–4 ft" high, "per linear foot");
 * and neither that place, the sentences either side, nor the nearest heading / FAQ question names another priced
 * subject (OTHER_SUBJECTS) or another fact's subject (`excludes`). So "$5" for premium pavers is approved, "$5" for a
 * bag of polymeric sand is not, and "$40–$45" a paragraph after an "Interlocking driveway" heading is not.
 * Bare numbers in a price table are never approved: a fact is always written with its "$".
 * Returns [{ figure, context, reason }] in document order; `reason` says what to fix.
 */
function findUnapprovedFigures(text, sheet) {
  const source = normalise(text);
  const spans = sentenceSpans(source);
  const cells = tableCells(source);
  const cellAt = (index) => cells.find((c) => index >= c.start && index < c.end);
  const figures = figureMatches(source).map((m) => ({ figure: canonicalFigure(m.raw), index: m.index, length: m.raw.length, bare: false }));
  // A money cell's bare amount, unless the cell already holds a figure ("25k", "$330").
  const bare = cells.filter((c) => c.money && (c.strongMoney || !MEASURE_ROW.test(c.label)) && !figures.some((f) => f.index >= c.start && f.index < c.end))
    .map((c) => ({ c, m: BARE_AMOUNT.exec(c.text) })).filter(({ m }) => m)
    .map(({ c, m }) => ({ figure: canonicalFigure(m[0].replace(BARE_PREFIX, '')), index: c.start, length: c.end - c.start, bare: true }));
  const hits = [...figures, ...bare].sort((a, b) => a.index - b.index);
  const unapproved = [];
  for (const hit of hits) {
    const cell = cellAt(hit.index);
    const own = plain(cell ? cell.context : sentenceAround(source, spans, hit.index, 0));
    // Where another subject would make the figure someone else's price: its own sentence, the sentence before it in the
    // same paragraph ("An interlocking driveway is built deeper. It costs $40–$45…"), and the heading above it.
    const places = [['its sentence', own], ['the sentence before it', cell ? cell.row : previousInParagraph(source, spans, hit.index)], ['the heading above it', headingBefore(source, hit.index)]]
      .map(([where, text]) => [where, plain(text)]);
    const facts = (sheet.facts || []).filter((f) => (f.figures || []).includes(hit.figure));
    let reason = '';
    if (hit.bare) reason = 'an amount in a price table without its "$": write the engine figure exactly, with "$"';
    else if (!facts.length) reason = 'not a published engine figure';
    else if (AFTER_TAX.test(own)) reason = 'every published figure is before HST: say "before HST", never "after HST" or "HST included"';
    else {
      const clash = places.map(([where, text]) => [where, (OTHER_SUBJECTS.exec(text) || [])[0]]).find(([, found]) => found);
      const fits = facts.find((f) => (f.keywords || []).some((k) => word(k).test(own)) && (!f.requires || new RegExp(f.requires, 'i').test(own))
        && !(f.forbids && new RegExp(f.forbids, 'i').test(own))
        && !(f.excludes || []).some((k) => places.some(([, text]) => word(k).test(text))));
      if (clash) reason = `${clash[0]} names "${clash[1]}", which has no published price: give the figure its own sentence and paragraph, away from other items`;
      else if (!fits) {
        const subjectOnly = facts.find((f) => (f.keywords || []).some((k) => word(k).test(own)));
        reason = subjectOnly
          ? `quote it exactly as the fact states it, with its basis in the same sentence: "${subjectOnly.statement}"`
          : `name its subject (${[...new Set(facts.flatMap((f) => f.keywords || []))].join(' / ')}) in the same sentence, and no other project nearby`;
      }
    }
    if (reason) {
      const context = source.slice(Math.max(0, hit.index - 60), hit.index + hit.length + 60).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      unapproved.push({ figure: hit.bare ? `${hit.figure} (bare, in a price table)` : hit.figure, context, reason });
    }
  }
  return unapproved;
}

module.exports = { extractPriceFigures, canonicalFigure, findUnapprovedFigures };
