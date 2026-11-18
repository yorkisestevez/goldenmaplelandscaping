import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, sep } from 'node:path';
import { getEstimatorRangeCopy } from '../src/utils/pricingDoctrine';

/**
 * No price on the site that nobody approved (owner decision 2026-10-17: prevent hallucinated prices at all cost).
 *
 * Every dollar figure in the site's copy must be one of:
 *   - an engine fact quoted about its own subject (src/data/publishedPriceFacts.json, via findUnapprovedFigures), or
 *   - an entry in docs/pricing/price-ledger.json for that file, with at least as many occurrences:
 *       engine-checked  computed by the estimator engine and pinned by check-wall-prices / check-patio-prices
 *       approved        approved by the owner, with a note
 *       unverified      on the site before this ledger existed; on the owner's review list (docs/pricing/unverified-prices.md)
 * A new or extra figure anywhere fails lint (and so the PR and the Netlify build) until it is engine-derived or
 * approved. Removed figures make the ledger stale, which also fails, so the ledger always matches the site.
 *
 *   npx tsx scripts/check-price-ledger.ts                                  check (lint)
 *   npx tsx scripts/check-price-ledger.ts --approve <file> '<figure>' '<why>'   owner approves a figure
 *   npx tsx scripts/check-price-ledger.ts --prune                          drop entries for figures that were removed
 *   npx tsx scripts/check-price-ledger.ts --report                         rewrite the owner's review list
 */
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const LEDGER = join(ROOT, 'docs/pricing/price-ledger.json');
const REPORT = join(ROOT, 'docs/pricing/unverified-prices.md');
const { findUnapprovedFigures } = createRequire(import.meta.url)('./blog-publisher/price-figures.cjs') as {
  findUnapprovedFigures: (text: string, sheet: unknown) => Array<{ figure: string; context: string }>;
};
const SHEET = JSON.parse(readFileSync(join(ROOT, 'src/data/publishedPriceFacts.json'), 'utf8'));

/** Customer-facing copy: every TS/TSX/CJS/MJS/JSON file in SCAN except SKIP. Any other file type there fails the check. */
const SCAN = ['src/pages', 'src/components', 'src/data', 'src/utils', 'netlify/functions'];
const COPY_FILE = /\.(tsx?|cjs|mjs|json)$/;
const NOT_COPY = /\.(css|png|jpe?g|webp|avif|svg|gif|ico|woff2?)$/;
// The engine's own price math and data (the source of truth), the price sheet itself, the deck designer's price (decks
// are priced only there, by its own engine and gates: src/features/deckcraft is not scanned either), and the guard's
// own examples.
const SKIP = ['src/data/estimatorDefaults.ts', 'src/data/engine-baseline.json', 'src/data/publishedPriceFacts.json', 'src/utils/estimateEngine.ts', 'src/utils/takeoff.ts', 'src/utils/deckInEstimate.ts', 'src/utils/sophieGuard.ts'];
// Engine price tables that also hold visitor copy: only their copy fields are read (an add-on's phaseNote is shown).
const COPY_FIELDS_ONLY: Record<string, RegExp> = {
  'src/data/carrPrices.ts': /\b(?:label|description|phaseNote|note|detail|title|name|summary|tagline)\s*:\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g,
};
// Copy built at runtime from bare numbers the extractor cannot see in the source: scanned as rendered.
const RENDERED: Record<string, () => string[]> = {
  'src/utils/pricingDoctrine.ts#getEstimatorRangeCopy': () => [
    ...[null, 'full', 'wall', 'patio', 'stone', 'walkway', 'deck'].map((t) => getEstimatorRangeCopy(t)),
    getEstimatorRangeCopy(null, ['wall', 'patio']),
  ],
};
const STATUSES = ['engine-checked', 'approved', 'unverified'] as const;
type Status = (typeof STATUSES)[number];
interface Entry { count: number; status: Status; note?: string; context?: string }
type Ledger = { _readme: string; entries: Record<string, Record<string, Entry>> };

function walk(dir: string): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((name) => {
    const p = join(abs, name);
    if (statSync(p).isDirectory()) return walk(relative(ROOT, p));
    if (NOT_COPY.test(name)) return [];
    // Fail closed: a new copy format (.md, .mdx, .html…) must be added here on purpose, never skipped silently.
    if (!COPY_FILE.test(name)) throw new Error(`PRICE LEDGER: ${relative(ROOT, p)} is a file type the price scan does not read; add it to COPY_FILE or NOT_COPY`);
    return [relative(ROOT, p).split(sep).join('/')];
  });
}

/** The text of `file` that a visitor can read. */
function copyOf(file: string): string {
  const source = readFileSync(join(ROOT, file), 'utf8');
  const fields = COPY_FIELDS_ONLY[file];
  return fields ? [...source.matchAll(fields)].map((m) => m[2]).join('\n') : source;
}

/** file → figure → { count, context of first occurrence } for figures that are not engine facts in context. */
function scanSite() {
  const found: Record<string, Record<string, { count: number; context: string }>> = {};
  const sources = [
    ...SCAN.flatMap(walk).filter((f) => !SKIP.includes(f)).sort().map((file) => [file, copyOf(file)] as const),
    ...Object.entries(RENDERED).map(([key, render]) => [key, [...new Set(render())].join('\n')] as const),
  ];
  if (sources.length < 100) throw new Error(`PRICE LEDGER: only ${sources.length} files scanned; the scan paths are wrong`);
  for (const [file, text] of sources) {
    for (const { figure, context } of findUnapprovedFigures(text, SHEET)) {
      const byFigure = (found[file] ??= {});
      byFigure[figure] ??= { count: 0, context };
      byFigure[figure].count++;
    }
  }
  return found;
}

const readLedger = (): Ledger => JSON.parse(readFileSync(LEDGER, 'utf8'));
const writeLedger = (l: Ledger) => {
  const sorted: Ledger['entries'] = {};
  for (const file of Object.keys(l.entries).sort()) {
    if (!Object.keys(l.entries[file]).length) continue;
    sorted[file] = Object.fromEntries(Object.entries(l.entries[file]).sort(([a], [b]) => a.localeCompare(b)));
  }
  writeFileSync(LEDGER, `${JSON.stringify({ _readme: l._readme, entries: sorted }, null, 2)}\n`);
};

const args = process.argv.slice(2);

if (args[0] === '--init') {
  // One-time: record what the site already says. Figures added by the engine-pricing PRs (#174/#175/#177) are
  // passed in as engine-checked; everything else starts unverified, for the owner's review list.
  if (existsSync(LEDGER)) throw new Error('ledger already exists; use --approve / --prune');
  const engineChecked: Record<string, string[]> = args[1] ? JSON.parse(readFileSync(args[1], 'utf8')) : {};
  const entries: Ledger['entries'] = {};
  for (const [file, figures] of Object.entries(scanSite())) {
    entries[file] = Object.fromEntries(Object.entries(figures).map(([figure, { count, context }]) => [
      figure, { count, status: (engineChecked[file] ?? []).includes(figure) ? 'engine-checked' : 'unverified', context },
    ]));
  }
  mkdirSync(join(ROOT, 'docs/pricing'), { recursive: true });
  writeLedger({ _readme: 'Every non-engine dollar figure on the site, per file. Maintained by scripts/check-price-ledger.ts — see its header.', entries });
  console.log(`ledger initialised: ${Object.values(entries).reduce((n, f) => n + Object.keys(f).length, 0)} figures in ${Object.keys(entries).length} files`);
  process.exit(0);
}

if (args[0] === '--approve') {
  const [, file, figure, note] = args;
  if (!file || !figure || !note?.trim()) throw new Error("usage: --approve <file> '<figure>' '<why it is right>'");
  const found = scanSite()[file]?.[figure];
  if (!found) throw new Error(`${figure} does not appear in ${file} (figures are canonical, e.g. '$40–$45')`);
  const ledger = readLedger();
  (ledger.entries[file] ??= {})[figure] = { count: found.count, status: 'approved', note: note.trim(), context: found.context };
  writeLedger(ledger);
  console.log(`approved ${figure} ×${found.count} in ${file}`);
  process.exit(0);
}

if (args[0] === '--prune') {
  const ledger = readLedger();
  const found = scanSite();
  let removed = 0;
  for (const [file, figures] of Object.entries(ledger.entries)) {
    for (const [figure, entry] of Object.entries(figures)) {
      const now = found[file]?.[figure]?.count ?? 0;
      if (now === 0) { delete figures[figure]; removed++; } else if (now < entry.count) entry.count = now;
    }
  }
  writeLedger(ledger);
  console.log(`pruned ${removed} removed figures`);
  process.exit(0);
}

if (args[0] === '--report') {
  const ledger = readLedger();
  const lines = ['# Unverified prices on the site', '', 'These dollar figures were on the site before the price ledger existed (2026-10-17) and are **not** backed by the cost-estimator engine. Each one should be confirmed and approved (`npx tsx scripts/check-price-ledger.ts --approve <file> \'<figure>\' \'<why>\'`), engine-derived, or removed. Generated by `scripts/check-price-ledger.ts --report`.', ''];
  let total = 0;
  for (const [file, figures] of Object.entries(ledger.entries)) {
    const open = Object.entries(figures).filter(([, e]) => e.status === 'unverified');
    if (!open.length) continue;
    lines.push(`## ${file}`, '');
    for (const [figure, e] of open) { lines.push(`- **${figure}**${e.count > 1 ? ` ×${e.count}` : ''} — …${e.context}…`); total++; }
    lines.push('');
  }
  lines.splice(3, 0, `**${total} figures to review.**`, '');
  writeFileSync(REPORT, `${lines.join('\n')}\n`);
  console.log(`wrote ${REPORT} (${total} unverified figures)`);
  process.exit(0);
}

// ---- Check ----
const ledger = readLedger();
const found = scanSite();
const problems: string[] = [];
for (const [file, figures] of Object.entries(found)) {
  for (const [figure, { count, context }] of Object.entries(figures)) {
    const entry = ledger.entries[file]?.[figure];
    if (!entry) problems.push(`NEW PRICE  ${file}: ${figure} — "…${context}…"`);
    else if (count > entry.count) problems.push(`NEW PRICE  ${file}: ${figure} now appears ${count}× (ledger has ${entry.count}) — "…${context}…"`);
  }
}
for (const [file, figures] of Object.entries(ledger.entries)) {
  for (const [figure, entry] of Object.entries(figures)) {
    if (!STATUSES.includes(entry.status)) problems.push(`BAD STATUS ${file}: ${figure} has status "${entry.status}"`);
    if (entry.status === 'approved' && !entry.note?.trim()) problems.push(`NO NOTE    ${file}: ${figure} is approved without a reason`);
    const now = found[file]?.[figure]?.count ?? 0;
    if (now < entry.count) problems.push(`STALE      ${file}: ${figure} — ledger has ${entry.count}, site has ${now} (run --prune)`);
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\nPRICE LEDGER FAILED — ${problems.length} problem(s). A price on the site must be an engine fact about its own subject (src/data/publishedPriceFacts.json) or approved by the owner:\n  npx tsx scripts/check-price-ledger.ts --approve <file> '<figure>' '<why it is right>'`);
  process.exit(1);
}
const counts = Object.values(ledger.entries).flatMap((f) => Object.values(f)).reduce((m, e) => ({ ...m, [e.status]: (m[e.status] ?? 0) + 1 }), {} as Record<string, number>);
console.log(`PRICE LEDGER OK — every dollar figure is an engine fact or in the ledger (${Object.entries(counts).map(([s, n]) => `${n} ${s}`).join(', ')}).`);
