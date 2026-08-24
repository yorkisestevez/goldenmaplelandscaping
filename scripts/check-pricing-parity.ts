// Pricing parity gate — runs in `npm run lint` (and therefore before every
// deploy). The DeckCraft engine (C:/Business/projects/deckcraft-pro) is the
// single source of pricing FACTS, delivered here as src/data/engine-baseline.json.
//
// HARD FAIL  — factual fields the site derives from the engine (bin cost,
//              crew-day rates, base-depth brand promise). Drift = exit 1.
// WARN ONLY  — positioning numbers (retail anchors, minimum floors, SEO
//              claims). Deliberately different from engine output; this report
//              just keeps the divergence VISIBLE so it stays a choice.
//
// Regenerating the baseline: in deckcraft-pro run
//   npx tsx scripts/export-public-ranges.mts
// then rebuild + redeploy this site.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import baseline from '../src/data/engine-baseline.json';
import { BIN_COST, PAVER_BRANDS, DECK_BRANDS } from '../src/data/carrPrices';
import { DAILY_PRODUCTION_RATES, HARDSCAPE_DAILY_RATES } from '../src/utils/pricingDoctrine';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const fail = (msg: string) => { failures++; console.log(`  FAIL  ${msg}`); };
const pass = (msg: string) => console.log(`  PASS  ${msg}`);
const warn = (msg: string) => console.log(`  warn  ${msg}`);

console.log('Pricing parity vs DeckCraft engine baseline');
console.log(`  baseline source: ${baseline.source}`);

// ---- HARD FACTS ----
// Derived constants (BIN_COST, day rates) import FROM the baseline, so
// equality alone is a tautology. The bounds below are the independent check:
// they catch a stale/tampered baseline (e.g. a regression to the old $350
// bin) even without the DeckCraft engine present. Bounds move only when
// Yorkis's real cost structure moves.
const bounds: [string, number, number, number][] = [
  ['facts.binCostCad', baseline.facts.binCostCad, 450, 800],
  // Hardscape floor widened 2026-07-28 for the $2,470 -> $2,800 all-in reset
  // (the $2,470 card was seven weeks stale). Deck bounds unchanged: the rate
  // was briefly cut to $3,000 and then returned to the $3,700 target.
  ['facts.crewDayRateHardscape', baseline.facts.crewDayRateHardscape, 2400, 3200],
  ['facts.crewDayRateDeck', baseline.facts.crewDayRateDeck, 3400, 4200],
  ['facts.baseDepthIn', baseline.facts.baseDepthIn, 12, 16],
];
for (const [name, v, lo, hi] of bounds) {
  if (v < lo || v > hi) fail(`${name} = ${v} outside sane bounds [${lo}, ${hi}] — stale or tampered baseline?`);
  else pass(`${name} = ${v} within [${lo}, ${hi}]`);
}

if (BIN_COST !== baseline.facts.binCostCad) fail(`BIN_COST ${BIN_COST} !== engine ${baseline.facts.binCostCad}`);
else pass(`BIN_COST $${BIN_COST}`);

if (DAILY_PRODUCTION_RATES.target !== baseline.facts.crewDayRateDeck)
  fail(`deck day-rate target ${DAILY_PRODUCTION_RATES.target} !== engine ${baseline.facts.crewDayRateDeck}`);
else pass(`deck day-rate target $${DAILY_PRODUCTION_RATES.target}`);

if (HARDSCAPE_DAILY_RATES.bottom !== baseline.facts.crewDayRateHardscape)
  fail(`hardscape day-rate ${HARDSCAPE_DAILY_RATES.bottom} !== engine ${baseline.facts.crewDayRateHardscape}`);
else pass(`hardscape day-rate $${HARDSCAPE_DAILY_RATES.bottom} (locked all-in card)`);

// Base-depth brand promise: the site's public copy must claim at least the
// engine's build depth (12"). We look for the "12–16" open-graded" claim.
const costEstimatorSrc = readFileSync(join(ROOT, 'src/pages/CostEstimator.tsx'), 'utf8');
if (!/12\s*[–-]\s*16\s*(?:"|&quot;|inch|″|&#8243;)/i.test(costEstimatorSrc))
  fail(`CostEstimator.tsx no longer claims the 12–16" base — engine builds ${baseline.facts.baseDepthIn}"; keep copy >= engine spec`);
else pass(`base-depth promise (12–16") present, engine builds ${baseline.facts.baseDepthIn}"`);

// ---- POSITIONING (warn-only visibility) ----
const patioBand = (baseline.bands as any).patio.perSqftPreTax as { low: number; high: number };
for (const p of PAVER_BRANDS as any[]) {
  const ratio = p.installedPerSqft / patioBand.high;
  if (ratio < 0.5 || ratio > 2.5)
    warn(`paver anchor ${p.id} $${p.installedPerSqft}/sqft is ${ratio.toFixed(1)}x the engine's $${patioBand.high} high band`);
}
const deckBand = (baseline.bands as any).deck.perSqftPreTax as { low: number; high: number };
for (const d of DECK_BRANDS as any[]) {
  const ratio = d.installedPerSqft / deckBand.high;
  if (ratio < 0.3 || ratio > 1.5)
    warn(`deck anchor ${d.id} $${d.installedPerSqft}/sqft vs engine high $${deckBand.high} (${ratio.toFixed(1)}x)`);
}
const engine300 = ((baseline.bands as any).patio.sizesSqft['300'] as any).mid * 300;
console.log(`  info  positioning: no estimator job minimum — a 300sqft patio prices at the engine mid ~$${Math.round(engine300).toLocaleString()}; qualification happens at the save-build gate (name+email traded for a shareable ?build= permalink), not a price floor`);

console.log(failures === 0 ? 'PARITY OK' : `${failures} PARITY FAILURE(S) — regenerate engine-baseline.json or fix the site data`);
process.exit(failures === 0 ? 0 : 1);
