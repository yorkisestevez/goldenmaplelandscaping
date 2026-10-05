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
import { BIN_COST, PAVER_BRANDS, DECK_BRANDS, CARR_TRADE } from '../src/data/carrPrices';
import { DAILY_PRODUCTION_RATES, HARDSCAPE_DAILY_RATES } from '../src/utils/pricingDoctrine';
import { computeEstimate, type EstimateInput } from '../src/utils/estimateEngine';

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

// ---- CARR 2025 TRADE BOOK (engine v3 takeoff) ----
// carrPrices.ts CARR_TRADE must equal the baseline's carr2025 mirror, and the
// values must sit in sane bounds so a stale/tampered copy can't slide through.
const carrBounds: [string, number, number, number][] = [
  ['carr2025.aggregates.clearStone34PerTonne', baseline.carr2025.aggregates.clearStone34PerTonne, 25, 40],
  ['carr2025.aggregates.hpbPerTonne', baseline.carr2025.aggregates.hpbPerTonne, 22, 35],
  // Carr depth chart is 0.005 t/sqft/inch compacted. The pre-fix rule was
  // 0.0025 (1 t per 100 sqft at 4") and under-ordered base stone by half.
  ['carr2025.aggregates.tonnesPerSqftPerInch', baseline.carr2025.aggregates.tonnesPerSqftPerInch, 0.0045, 0.0055],
  ['carr2025.consumables.polySandPerBag', baseline.carr2025.consumables.polySandPerBag, 24, 40],
  ['carr2025.disposal.sodStripSqftPerBin', baseline.carr2025.disposal.sodStripSqftPerBin, 500, 800],
  ['carr2025.disposal.spoilOnlySqftPerBin', baseline.carr2025.disposal.spoilOnlySqftPerBin, 300, 400],
  ['calibration.crewDayCostCad', baseline.calibration.crewDayCostCad, 2000, 2800],
  ['facts.materialMarkup', baseline.facts.materialMarkup, 1.25, 1.55],
  ['facts.hstRate', baseline.facts.hstRate, 0.13, 0.13],
];
for (const [name, v, lo, hi] of carrBounds) {
  if (v < lo || v > hi) fail(`${name} = ${v} outside sane bounds [${lo}, ${hi}] — stale or tampered data?`);
  else pass(`${name} = ${v} within [${lo}, ${hi}]`);
}
const carrPairs: [string, number, number][] = [
  ['aggregates.clearStone34PerTonne', CARR_TRADE.aggregates.clearStone34PerTonne, baseline.carr2025.aggregates.clearStone34PerTonne],
  ['aggregates.hpbPerTonne', CARR_TRADE.aggregates.hpbPerTonne, baseline.carr2025.aggregates.hpbPerTonne],
  ['aggregates.tonnesPerSqftPerInch', CARR_TRADE.aggregates.tonnesPerSqftPerInch, baseline.carr2025.aggregates.tonnesPerSqftPerInch],
  ['consumables.polySandPerBag', CARR_TRADE.consumables.polySandPerBag, baseline.carr2025.consumables.polySandPerBag],
  ['consumables.snapEdgePer8ftPiece', CARR_TRADE.consumables.snapEdgePer8ftPiece, baseline.carr2025.consumables.snapEdgePer8ftPiece],
  ['consumables.gatorFabricPerRoll', CARR_TRADE.consumables.gatorFabricPerRoll, baseline.carr2025.consumables.gatorFabricPerRoll],
  ['delivery.tandemPerLoad', CARR_TRADE.delivery.tandemPerLoad, baseline.carr2025.delivery.tandemPerLoad],
  ['delivery.triAxlePerLoad', CARR_TRADE.delivery.triAxlePerLoad, baseline.carr2025.delivery.triAxlePerLoad],
  ['delivery.flatbedBase', CARR_TRADE.delivery.flatbedBase, baseline.carr2025.delivery.flatbedBase],
  ['disposal.sodStripSqftPerBin', CARR_TRADE.disposal.sodStripSqftPerBin, baseline.carr2025.disposal.sodStripSqftPerBin],
  ['disposal.spoilOnlySqftPerBin', CARR_TRADE.disposal.spoilOnlySqftPerBin, baseline.carr2025.disposal.spoilOnlySqftPerBin],
  ['disposal.concreteTearOutSqftPerBin', CARR_TRADE.disposal.concreteTearOutSqftPerBin, baseline.carr2025.disposal.concreteTearOutSqftPerBin],
  ['disposal.paverTearOutSqftPerBin', CARR_TRADE.disposal.paverTearOutSqftPerBin, baseline.carr2025.disposal.paverTearOutSqftPerBin],
  ['waste.standard', CARR_TRADE.waste.standard, baseline.carr2025.waste.standard],
  ['waste.complex', CARR_TRADE.waste.complex, baseline.carr2025.waste.complex],
];
let carrDrift = 0;
for (const [name, code, json] of carrPairs) {
  if (code !== json) { fail(`CARR_TRADE.${name} ${code} !== carr2025 mirror ${json}`); carrDrift++; }
}
if (carrDrift === 0) pass(`CARR_TRADE matches carr2025 mirror (${carrPairs.length} fields)`);
if (CARR_TRADE.disposal.fullDepthSqftPerBin !== baseline.facts.binPerSqftFullDepth)
  fail(`fullDepthSqftPerBin ${CARR_TRADE.disposal.fullDepthSqftPerBin} !== facts.binPerSqftFullDepth ${baseline.facts.binPerSqftFullDepth}`);
else pass(`fullDepthSqftPerBin = ${CARR_TRADE.disposal.fullDepthSqftPerBin} (FACT)`);

// ---- CALIBRATION ASSERTION (the owner's pricing rule, made contractual) ----
// Run the reference build through the real engine: 500 sqft mid Mondrian Plus,
// Barrie Z1, grass, simple. Identical to fixture patio-500-mid-barrie.
const referenceBuild: EstimateInput = {
  projectType: 'patio',
  selectedElements: [],
  sizes: {
    patio: 500, stone: 500, wall: 50, wallHeight: '2-4ft', steps: 5,
    deck: 300, kitchen: 'Basic', firepit: 'Medium', pergola: 'Medium',
    turf: 500, lighting: 'Medium',
  },
  details: {},
  conditions: { access: false, slope: false, drainage: false, levels: false },
  location: 'barrie',
  tier: 'mid',
  paverBrandId: 'permacon-mondrian-plus',
  deckBrandId: 'timbertech-prime',
  addOns: [],
};
const ref = computeEstimate(referenceBuild);
if (!ref.precise) {
  fail('reference build produced no precise result — takeoff engine broken');
} else {
  const perSqft = ref.precise.subtotalCents / 100 / 500;
  const [bandLo, bandHi] = baseline.calibration.retailPerSqftBand;
  if (perSqft < bandLo || perSqft > bandHi)
    fail(`reference job $${perSqft.toFixed(2)}/sqft outside owner band [$${bandLo}, $${bandHi}] — recalibrate excavation/installLabour rates`);
  else pass(`reference job $${perSqft.toFixed(2)}/sqft within owner band [$${bandLo}–$${bandHi}]`);
  const margin = ref.precise.marginPct;
  if (margin === null || margin < baseline.calibration.minGrossMarginPct)
    fail(`reference job margin ${margin}% below hard floor ${baseline.calibration.minGrossMarginPct}%`);
  else pass(`reference job margin ${margin}% >= ${baseline.calibration.minGrossMarginPct}% floor`);
  const [tLo, tHi] = baseline.calibration.targetGrossMarginPctBand;
  if (margin !== null && (margin < tLo || margin > tHi))
    warn(`reference job margin ${margin}% outside the ${tLo}–${tHi}% target band (hard floor still met)`);
  const expectedDisposal = 3 * baseline.facts.binCostCad * 100;
  if (ref.precise.perCategoryCents.disposal !== expectedDisposal)
    fail(`reference job disposal ${ref.precise.perCategoryCents.disposal} cents !== ${expectedDisposal} (3 x $${baseline.facts.binCostCad} bins)`);
  else pass(`reference job disposal = 3 x $${baseline.facts.binCostCad} bins`);
}

// Business-facts cleanup: numeric engine assumptions remain pinned above and
// by the full output snapshot. Public copy must label estimates as planning,
// not promise an unresolved universal 12–16-inch installation standard.
const costEstimatorSrc = readFileSync(join(ROOT, 'src/pages/CostEstimator.tsx'), 'utf8');
if (!/estimator is a planning tool/i.test(costEstimatorSrc) || !/written project scope/i.test(costEstimatorSrc))
  fail('CostEstimator must distinguish planning assumptions from written project specifications');
else pass(`Planning/scope disclosure present; numerical engine baseline remains ${baseline.facts.baseDepthIn}"`);

// ---- POSITIONING (warn-only visibility) ----
// Note: since engine v3 `installedPerSqft` is display/positioning-only — the
// engine prices patio/stone from quantity takeoff. These warnings keep the
// picker-card anchors visibly tethered to the engine bands anyway.
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
