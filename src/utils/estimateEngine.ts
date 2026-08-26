/**
 * Estimator pricing engine — pure, dependency-free arithmetic.
 *
 * Lifted verbatim out of the useMemo that used to live inside
 * src/components/Estimator.tsx. Extracting it bought two things the component
 * could never do:
 *
 *   1. Speculative pricing. `deltaFor()` answers "what would this build cost if
 *      ONE thing changed?" — which is what lets every option in the UI show its
 *      real dollar effect BEFORE the user commits to it, and what powers the
 *      budget gap coach.
 *   2. A snapshot gate. scripts/check-engine-snapshot.ts pins the output of
 *      every branch below, so the arithmetic cannot drift by accident.
 *
 * ENGINE v3 (2026-08-26, deliberate repricing): patio and natural-stone work is
 * now priced by QUANTITY TAKEOFF (src/utils/takeoff.ts) from the Carr 2025
 * trade book — pavers + waste, 12" clear-stone base tonnage, HPB bedding, poly
 * sand, edge restraint, fabric, truck-packed delivery, and disposal bins
 * counted by what the job actually hauls. The result carries a `precise` block
 * (integer cents: category figures, subtotal, 13% HST, grand total) — the
 * "most likely" invoice the UI headlines. For takeoff elements the banded
 * low/high now DERIVES from the precise figure (×0.95 / ×1.25); every other
 * element keeps its banded model and contributes its band midpoint to
 * `precise` as a labelled allowance. The precise figure is NEVER widened by
 * confidence — widening applies only to the secondary range.
 *
 * ⚠️  The legacy slice coefficients (materials 45% / labour 40% / excavation
 *     18%-of-core, and their per-element variants) still do NOT reconcile to a
 *     documented whole for non-takeoff elements, and `totalLow/High` are
 *     re-summed FROM the slices. Tidying the percentages to "make them add up"
 *     silently reprices every job Golden Maple quotes. Don't. If the pricing
 *     model itself needs to change, change it on purpose and regenerate the
 *     snapshot in the same commit.
 */

import {
  PAVER_BRANDS, DECK_BRANDS, ADD_ONS, BIN_COST, type PaverTier,
} from '../data/carrPrices';
import {
  ESTIMATOR_LOCATIONS, ZONE_SURCHARGE, type EstimatorLocationKey,
} from '../data/locations';
import { applyDailyProductionFloor, applyPreciseCrewFloor } from './pricingDoctrine';
import {
  hardscapeTakeoff, disposalBinsFor, c,
  type PreciseLineItem, type TakeoffQuantities,
} from './takeoff';
import engineBaseline from '../data/engine-baseline.json';

const CAL = engineBaseline.calibration;
const HST_RATE = engineBaseline.facts.hstRate;

/** Everything the price depends on. Anything not in here cannot move the number. */
export interface EstimateInput {
  projectType: string | null;
  /** Only meaningful when projectType === 'full'. */
  selectedElements: string[];
  sizes: Record<string, number | string>;
  /** Detail answers keyed `${element}.${question}` — e.g. "patio.surface": "concrete". */
  details: Record<string, string>;
  conditions: Record<string, boolean>;
  location: EstimatorLocationKey;
  tier: PaverTier;
  paverBrandId: string;
  deckBrandId: string;
  addOns: string[];
}

export interface EstimateLine {
  low: number;
  high: number;
  detail: string;
}

/**
 * The takeoff engine's "most likely" invoice. All money is INTEGER CENTS so
 * the snapshot gate pins bit-identical output. Pre-tax everywhere except
 * hstCents/grandTotalCents. `marginPct` is internal (parity gate) — never
 * displayed. `lineItems` is the internal takeoff detail; the public UI shows
 * category-level figures only.
 */
export interface PreciseResult {
  subtotalCents: number;
  hstCents: number;
  grandTotalCents: number;
  perCategoryCents: {
    excavation: number;
    materials: number;
    labour: number;
    disposal: number;
    restoration: number;
  };
  addOnsCents: number;
  lineItems: PreciseLineItem[];
  /** Element ids priced as banded-midpoint allowances rather than takeoff. */
  allowances: string[];
  /** Internal gross-margin estimate — only computable for pure-takeoff builds. */
  marginPct: number | null;
  /** Takeoff quantity summary for category detail copy. Null when no takeoff element. */
  quantities: TakeoffQuantities | null;
}

export interface EstimateResult {
  totalLow: number;
  totalHigh: number;
  addOnsTotal: { low: number; high: number };
  days: { low: number; high: number };
  /** Null when nothing is selected yet. */
  lines: {
    excavation: EstimateLine;
    materials: EstimateLine;
    labour: EstimateLine;
    disposal: EstimateLine;
    restoration: EstimateLine;
  } | null;
  /** Surface area the engine actually priced (patio/stone/turf/deck only —
   *  wall linear feet and step counts are excluded). Used by the gap coach. */
  sqftPriced: number;
  /** Null when nothing is selected yet. */
  precise: PreciseResult | null;
}

const EMPTY: EstimateResult = {
  totalLow: 0,
  totalHigh: 0,
  lines: null,
  addOnsTotal: { low: 0, high: 0 },
  days: { low: 0, high: 0 },
  sqftPriced: 0,
  precise: null,
};

export function computeEstimate(input: EstimateInput): EstimateResult {
  const {
    projectType, selectedElements, sizes, details, conditions,
    location, tier, paverBrandId, deckBrandId, addOns,
  } = input;

  const isHardscape = projectType === 'patio' || projectType === 'stone'
    || projectType === 'wall' || projectType === 'steps';
  const isDeck = projectType === 'deck'
    || (projectType === 'full' && selectedElements.includes('deck'));
  const selectedPaver = PAVER_BRANDS.find(p => p.id === paverBrandId) || PAVER_BRANDS[2];
  const selectedDeck = DECK_BRANDS.find(d => d.id === deckBrandId) || DECK_BRANDS[0];

  const els = projectType === 'full' ? selectedElements : (projectType ? [projectType] : []);
  if (els.length === 0) return EMPTY;

  // Banded accumulators — LEGACY (non-takeoff) elements only.
  let coreLow = 0;
  let coreHigh = 0;
  let materialLow = 0;
  let materialHigh = 0;
  let labourLow = 0;
  let labourHigh = 0;
  // Banded contributions DERIVED from takeoff precise figures (×0.95 / ×1.25).
  let tMatLow = 0;
  let tMatHigh = 0;
  let tLabLow = 0;
  let tLabHigh = 0;
  let tExcavLow = 0;
  let tExcavHigh = 0;
  // Precise accumulators — integer cents.
  let pTakeoffMaterialsC = 0;
  let pTakeoffInstallC = 0;
  let pTakeoffExcavC = 0;
  let takeoffTradeC = 0;
  const lineItems: PreciseLineItem[] = [];
  let quantities: TakeoffQuantities | null = null;
  const allowances: string[] = [];
  let binsTotal = 0;

  let totalSqftCalc = 0;
  let daysLow = 0.5;
  let daysHigh = 1;
  // Flat additions from detail answers (tear-out, gas line, reinforced base…)
  let extraFlatLow = 0;
  let extraFlatHigh = 0;

  for (const el of els) {
    const sz = sizes[el];
    const dv = (q: string) => details[`${el}.${q}`];
    // Existing-surface tear-out — the breaking/lifting LABOUR, asked per
    // element and scaled to its footprint. HAULING is counted separately as
    // disposal bins (takeoff.disposalBinsFor) so the two never double-charge.
    const applySurface = (sqft: number) => {
      const surface = dv('surface');
      if (surface === 'concrete') {
        extraFlatLow += Math.max(1000, sqft * 4); extraFlatHigh += Math.max(2500, sqft * 7);
        daysLow += 0.5; daysHigh += 1;
      } else if (surface === 'pavers') {
        extraFlatLow += Math.max(600, sqft * 2.5); extraFlatHigh += Math.max(1500, sqft * 4.5);
        daysLow += 0.5; daysHigh += 1;
      } else if (surface === 'deck') {
        extraFlatLow += 800; extraFlatHigh += 2500;
        daysLow += 0.5; daysHigh += 1;
      }
    };

    if (el === 'patio' || el === 'stone') {
      // ---- TAKEOFF PATH (engine v3) ----
      const sqft = typeof sz === 'number' ? sz : 0;
      totalSqftCalc += sqft;
      if (sqft > 0) {
        const shape = dv('shape');
        const surface = dv('surface');
        const takeoff = hardscapeTakeoff({
          sqft, shape, surface, paver: selectedPaver, element: el,
        });
        // Labour-side multipliers: waste already covers the material side of
        // layout complexity; these are the midpoints of the legacy band mults.
        const shapeMult = shape === 'complex' ? 1.14 : shape === 'curves' ? 1.07 : 1;
        const useMult = dv('use') === 'multi' ? 1.03 : 1;
        if (dv('use') === 'hottub') { extraFlatLow += 1800; extraFlatHigh += 3500; }
        applySurface(sqft);

        const installC = Math.round(takeoff.installRetailCents * shapeMult * useMult);
        pTakeoffMaterialsC += takeoff.materialsRetailCents;
        pTakeoffInstallC += installC;
        pTakeoffExcavC += takeoff.excavationRetailCents;
        takeoffTradeC += takeoff.materialsTradeCents;
        binsTotal += takeoff.bins;
        lineItems.push(...takeoff.items);
        quantities = quantities
          ? {
              aggregateTonnes: Math.round((quantities.aggregateTonnes + takeoff.quantities.aggregateTonnes) * 10) / 10,
              polySandBags: quantities.polySandBags + takeoff.quantities.polySandBags,
              edgePieces: quantities.edgePieces + takeoff.quantities.edgePieces,
              fabricRolls: quantities.fabricRolls + takeoff.quantities.fabricRolls,
              skids: quantities.skids + takeoff.quantities.skids,
              deliveryLoads: quantities.deliveryLoads + takeoff.quantities.deliveryLoads,
              bins: quantities.bins + takeoff.quantities.bins,
            }
          : takeoff.quantities;

        // Band derives from precise: quantities are known, so the residual
        // uncertainty band is ×0.95 / ×1.25 around the takeoff figure.
        tMatLow += (takeoff.materialsRetailCents / 100) * 0.95;
        tMatHigh += (takeoff.materialsRetailCents / 100) * 1.25;
        tLabLow += (installC / 100) * 0.95;
        tLabHigh += (installC / 100) * 1.25;
        tExcavLow += (takeoff.excavationRetailCents / 100) * 0.95;
        tExcavHigh += (takeoff.excavationRetailCents / 100) * 1.25;
      }
      daysLow += (typeof sz === 'number' ? sz : 0) / 350;
      daysHigh += (typeof sz === 'number' ? sz : 0) / 220;
    } else if (el === 'turf') {
      const sqft = typeof sz === 'number' ? sz : 0;
      totalSqftCalc += sqft;
      allowances.push(el);
      const perSqft = 22;
      const lineLow = sqft * perSqft * 0.95;
      const lineHigh = sqft * perSqft * 1.20;
      applySurface(sqft);
      // Turf strips sod, not a 12" base — its bins follow the sod-strip rule.
      binsTotal += sqft > 0 ? disposalBinsFor(sqft, 'sod-strip', dv('surface')) : 0;
      materialLow += lineLow * 0.45;
      materialHigh += lineHigh * 0.45;
      labourLow += lineLow * 0.40;
      labourHigh += lineHigh * 0.40;
      coreLow += lineLow;
      coreHigh += lineHigh;
      daysLow += sqft / 350;
      daysHigh += sqft / 220;
    } else if (el === 'deck') {
      const sqft = typeof sz === 'number' ? sz : 0;
      totalSqftCalc += sqft;
      allowances.push(el);
      const perSqft = selectedDeck.installedPerSqft;
      let lineLow = sqft * perSqft * 0.95;
      let lineHigh = sqft * perSqft * 1.20;
      // Height off grade — framing, footings, code-required railings
      const height = dv('deckHeight');
      if (height === 'walkout') { lineLow *= 1.18; lineHigh *= 1.18; }
      if (height === 'mid') { extraFlatLow += 1500; extraFlatHigh += 3500; }
      // Footing spoil + framing offcuts — one bin, not a 12"-excavation count.
      if (sqft > 0) binsTotal += 1;
      materialLow += lineLow * 0.55;
      materialHigh += lineHigh * 0.55;
      labourLow += lineLow * 0.35;
      labourHigh += lineHigh * 0.35;
      coreLow += lineLow;
      coreHigh += lineHigh;
      daysLow += sqft / 250;
      daysHigh += sqft / 150;
    } else if (el === 'wall') {
      const lf = typeof sz === 'number' ? sz : 50;
      allowances.push(el);
      const hMult = sizes.wallHeight === 'Under 2ft' ? 1
        : sizes.wallHeight === '2-4ft' ? 1.5
        : sizes.wallHeight === '4-6ft' ? 2.2 : 3.2;
      // What the wall retains — engineering and reinforcement scale with load
      const purpose = dv('wallPurpose');
      const pMult = purpose === 'slope' ? 1.1 : purpose === 'structure' ? 1.25 : 1;
      const perLf = tier === 'budget' ? 220 : tier === 'mid' ? 280 : 360;
      const lineLow = lf * perLf * hMult * pMult * 0.9;
      const lineHigh = lf * perLf * hMult * pMult * 1.15;
      materialLow += lineLow * 0.45;
      materialHigh += lineHigh * 0.45;
      labourLow += lineLow * 0.40;
      labourHigh += lineHigh * 0.40;
      coreLow += lineLow;
      coreHigh += lineHigh;
      daysLow += (lf * hMult) / 50;
      daysHigh += (lf * hMult) / 30;
    } else if (el === 'steps') {
      const count = typeof sz === 'number' ? sz : 5;
      allowances.push(el);
      applySurface(0);
      const perStep = tier === 'budget' ? 850 : tier === 'mid' ? 1100 : 1500;
      const lineLow = count * perStep * 0.9;
      const lineHigh = count * perStep * 1.15;
      materialLow += lineLow * 0.5;
      materialHigh += lineHigh * 0.5;
      labourLow += lineLow * 0.4;
      labourHigh += lineHigh * 0.4;
      coreLow += lineLow;
      coreHigh += lineHigh;
      daysLow += count * 0.4;
      daysHigh += count * 0.6;
    } else if (el === 'kitchen') {
      allowances.push(el);
      const isFull = sizes.kitchen === 'Full Build';
      const lineLow = tier === 'budget' ? (isFull ? 18000 : 7000) : tier === 'mid' ? (isFull ? 28000 : 10000) : (isFull ? 42000 : 14000);
      const lineHigh = lineLow * 1.4;
      materialLow += lineLow * 0.60;
      materialHigh += lineHigh * 0.60;
      labourLow += lineLow * 0.30;
      labourHigh += lineHigh * 0.30;
      coreLow += lineLow;
      coreHigh += lineHigh;
      daysLow += isFull ? 6 : 3;
      daysHigh += isFull ? 10 : 5;
    } else if (el === 'firepit') {
      allowances.push(el);
      // Gas line run is its own trade
      if (dv('fuel') === 'gas') { extraFlatLow += 1500; extraFlatHigh += 3000; }
      const lineLow = tier === 'budget' ? 1500 : tier === 'mid' ? 2500 : 3500;
      const lineHigh = lineLow * 1.5;
      materialLow += lineLow * 0.6;
      materialHigh += lineHigh * 0.6;
      labourLow += lineLow * 0.3;
      labourHigh += lineHigh * 0.3;
      coreLow += lineLow;
      coreHigh += lineHigh;
      daysLow += 1; daysHigh += 2;
    } else if (el === 'pergola') {
      allowances.push(el);
      const lineLow = tier === 'budget' ? 4500 : tier === 'mid' ? 7000 : 10000;
      const lineHigh = lineLow * 1.4;
      materialLow += lineLow * 0.55;
      materialHigh += lineHigh * 0.55;
      labourLow += lineLow * 0.35;
      labourHigh += lineHigh * 0.35;
      coreLow += lineLow;
      coreHigh += lineHigh;
      daysLow += 2; daysHigh += 4;
    } else if (el === 'lighting') {
      allowances.push(el);
      const lineLow = tier === 'budget' ? 3000 : tier === 'mid' ? 5000 : 7500;
      const lineHigh = lineLow * 1.4;
      materialLow += lineLow * 0.5;
      materialHigh += lineHigh * 0.5;
      labourLow += lineLow * 0.35;
      labourHigh += lineHigh * 0.35;
      coreLow += lineLow;
      coreHigh += lineHigh;
      daysLow += 1; daysHigh += 2;
    }
  }

  // Site condition multipliers / additions
  let conditionMult = 1;
  if (conditions.access) conditionMult += 0.18;
  if (conditions.levels) conditionMult += 0.12;
  let conditionFlatLow = 0;
  let conditionFlatHigh = 0;
  if (conditions.slope)    { conditionFlatLow += 1500; conditionFlatHigh += 4000; daysLow += 0.5; daysHigh += 1.5; }
  if (conditions.drainage) { conditionFlatLow += 1500; conditionFlatHigh += 3500; daysLow += 0.5; daysHigh += 1; }

  coreLow = coreLow * conditionMult + conditionFlatLow + extraFlatLow;
  coreHigh = coreHigh * conditionMult + conditionFlatHigh + extraFlatHigh;
  materialLow *= conditionMult;
  materialHigh *= conditionMult;
  labourLow = labourLow * conditionMult + conditionFlatLow * 0.6 + extraFlatLow;
  labourHigh = labourHigh * conditionMult + conditionFlatHigh * 0.6 + extraFlatHigh;
  // Takeoff bands ride the same multiplier (access/levels are real crew cost).
  tMatLow *= conditionMult;
  tMatHigh *= conditionMult;
  tLabLow *= conditionMult;
  tLabHigh *= conditionMult;
  tExcavLow *= conditionMult;
  tExcavHigh *= conditionMult;

  // Excavation: takeoff elements price it explicitly (calibrated $/sqft);
  // legacy elements keep the 18%-of-core share. The floor spans the whole job.
  const excavationShare = isHardscape || (projectType === 'full' && totalSqftCalc > 0) ? 0.18 : 0.10;
  const excavationLow = Math.max(2500, coreLow * excavationShare + tExcavLow);
  const excavationHigh = Math.max(4000, coreHigh * excavationShare + tExcavHigh);

  // Disposal — bins counted per element by tear-out kind (takeoff for
  // patio/stone, sod-strip for turf, one bin for a deck build).
  const bins = binsTotal;
  const disposalLow = bins * BIN_COST;
  const disposalHigh = bins * BIN_COST * 1.15;

  // Restoration — site cleanup, sodding edges, perimeter dressing
  const restorationLow = Math.max(800, totalSqftCalc * 2.5);
  const restorationHigh = Math.max(1500, totalSqftCalc * 4);

  // Zone surcharge for delivery
  const loc = ESTIMATOR_LOCATIONS.find(l => l.key === location) || ESTIMATOR_LOCATIONS[0];
  const surcharge = ZONE_SURCHARGE[loc.zone];

  // Add-ons
  let addOnsLow = 0;
  let addOnsHigh = 0;
  for (const aid of addOns) {
    const a = ADD_ONS.find(x => x.id === aid);
    if (a) { addOnsLow += a.costLow; addOnsHigh += a.costHigh; }
  }
  if (addOns.length > 0) {
    daysLow += addOns.length * 0.5;
    daysHigh += addOns.length * 1;
  }

  // Combine legacy + takeoff-derived bands before the crew-day floor — the
  // floor is about the whole job's on-site days, not one accounting bucket.
  let materialLowAll = materialLow + tMatLow;
  let materialHighAll = materialHigh + tMatHigh;
  let labourLowAll = labourLow + tLabLow;
  let labourHighAll = labourHigh + tLabHigh;

  const flooredLabour = applyDailyProductionFloor({
    labourLow: labourLowAll,
    labourHigh: labourHighAll,
    daysLow,
    daysHigh,
    projectType,
  });
  labourLowAll = flooredLabour.labourLow;
  labourHighAll = flooredLabour.labourHigh;

  // Total = the five displayed slices + zone surcharge + add-ons. Deliberately
  // re-summed from the slices rather than from coreLow/High — see the file
  // header before touching this. Rounded to $250 since engine v3 (was $500).
  const totalLow = Math.round((excavationLow + materialLowAll + labourLowAll + disposalLow + restorationLow + surcharge + addOnsLow) / 250) * 250;
  const totalHigh = Math.round((excavationHigh + materialHighAll + labourHighAll + disposalHigh + restorationHigh + surcharge + addOnsHigh) / 250) * 250;

  // ---- PRECISE (the "most likely" invoice, integer cents) ----
  // Takeoff parts are exact; every legacy-banded contribution enters at its
  // band midpoint. Precise is never widened by confidence.
  const mid = (lo: number, hi: number) => (lo + hi) / 2;
  const daysMid = mid(daysLow, daysHigh);

  const pMaterialsBase = pTakeoffMaterialsC + c(mid(materialLow, materialHigh)) + c(surcharge);
  const pDisposalC = c(bins * BIN_COST);
  const pRestorationC = c(Math.max(CAL.restorationMinCad, totalSqftCalc * CAL.restorationPerSqft));
  let pExcavC = Math.round(pTakeoffExcavC * conditionMult)
    + c(mid(coreLow, coreHigh) * excavationShare);
  pExcavC = Math.max(pExcavC, c(mid(2500, 4000)));
  let pLabourC = Math.round(pTakeoffInstallC * conditionMult)
    + c(mid(labourLow, labourHigh));

  const crewFloored = applyPreciseCrewFloor({
    excavationCents: pExcavC,
    labourCents: pLabourC,
    daysMid,
    projectType,
  });
  pExcavC = crewFloored.excavationCents;
  pLabourC = crewFloored.labourCents;

  let pAddOnsC = 0;
  for (const aid of addOns) {
    const a = ADD_ONS.find(x => x.id === aid);
    if (a) pAddOnsC += c(mid(a.costLow, a.costHigh));
  }

  const subtotalCents = pMaterialsBase + pExcavC + pLabourC + pDisposalC + pRestorationC + pAddOnsC;
  const hstCents = Math.round(subtotalCents * HST_RATE);

  // Internal margin — only meaningful when the whole build is takeoff-priced.
  const pureTakeoff = allowances.length === 0 && takeoffTradeC > 0;
  const marginPct = pureTakeoff
    ? Math.round(((subtotalCents - (takeoffTradeC + pDisposalC + c(daysMid * CAL.crewDayCostCad))) / subtotalCents) * 1000) / 10
    : null;

  const precise: PreciseResult = {
    subtotalCents,
    hstCents,
    grandTotalCents: subtotalCents + hstCents,
    perCategoryCents: {
      excavation: pExcavC,
      materials: pMaterialsBase,
      labour: pLabourC,
      disposal: pDisposalC,
      restoration: pRestorationC,
    },
    addOnsCents: pAddOnsC,
    lineItems,
    allowances,
    marginPct,
    quantities,
  };

  // No job minimum. The estimate is whatever the project actually costs out
  // to — a small walkway prices as a small walkway, never padded up to a
  // floor. (The itemized breakdown is free to everyone as of 2026-08-14; the
  // gate is now SAVING the build — see EstimateLeadCapture.tsx.)
  return {
    totalLow,
    totalHigh,
    addOnsTotal: { low: addOnsLow, high: addOnsHigh },
    days: { low: Math.ceil(daysLow * 2) / 2, high: Math.ceil(daysHigh * 2) / 2 },
    sqftPriced: totalSqftCalc,
    precise,
    lines: {
      excavation: {
        low: Math.round(excavationLow / 100) * 100,
        high: Math.round(excavationHigh / 100) * 100,
        detail: totalSqftCalc > 0 ? `12–16" base depth on ${totalSqftCalc} sqft` : 'Site prep + base prep',
      },
      materials: {
        low: Math.round((materialLowAll + surcharge) / 100) * 100,
        high: Math.round((materialHighAll + surcharge) / 100) * 100,
        detail: isDeck
          ? `${selectedDeck.brand} ${selectedDeck.product}`
          : isHardscape || projectType === 'full'
          ? `${selectedPaver.brand} ${selectedPaver.product}${totalSqftCalc > 0 ? ` (${totalSqftCalc} sqft)` : ''}`
          : 'Materials & supplies',
      },
      labour: {
        low: Math.round(labourLowAll / 100) * 100,
        high: Math.round(labourHighAll / 100) * 100,
        detail: `${Math.ceil(daysLow * 2) / 2}–${Math.ceil(daysHigh * 2) / 2} days on-site, ICPI-certified crew`,
      },
      disposal: {
        low: Math.round(disposalLow / 100) * 100,
        high: Math.round(disposalHigh / 100) * 100,
        detail: bins > 0 ? `${bins} × 14-yard bin (clean fill)` : 'Standard waste removal',
      },
      restoration: {
        low: Math.round(restorationLow / 100) * 100,
        high: Math.round(restorationHigh / 100) * 100,
        detail: 'Edge dressing, soil amendments, site clean',
      },
    },
  };
}

export interface Delta {
  low: number;
  high: number;
  /** Midpoint movement — what the UI shows as a single "+$3,200" figure. */
  mid: number;
  /** Movement of the precise subtotal, in cents. Null when either side lacks one. */
  preciseCents: number | null;
}

/**
 * What would change if ONE thing about this build were different?
 *
 * This is the primitive behind every live price hint in the estimator and
 * behind the budget gap coach. It is honest by construction: the answer is
 * always a real re-run of the same engine, never a shortcut approximation, so
 * a hint can never promise a number the estimate won't then produce.
 *
 * Pure arithmetic — cheap enough to call for every visible option on a render.
 */
export function deltaFor(base: EstimateInput, patch: Partial<EstimateInput>): Delta {
  const before = computeEstimate(base);
  const after = computeEstimate({ ...base, ...patch });
  const low = after.totalLow - before.totalLow;
  const high = after.totalHigh - before.totalHigh;
  const preciseCents = before.precise && after.precise
    ? after.precise.subtotalCents - before.precise.subtotalCents
    : null;
  return { low, high, mid: (low + high) / 2, preciseCents };
}

/** Midpoint of a build — the single number the gap coach steers against. */
export function midpoint(r: Pick<EstimateResult, 'totalLow' | 'totalHigh'>): number {
  return (r.totalLow + r.totalHigh) / 2;
}

/**
 * The confidence-widening applied to the SECONDARY range the customer sees.
 *
 * Lives here rather than in the component because THREE things have to agree on
 * it — the range, the itemized lines, and the budget gap coach. When the
 * coach reasoned on raw engine totals while the headline showed widened ones,
 * levers labelled "gets you there on its own" landed over target. One
 * definition, imported everywhere, is what prevents that class of bug.
 *
 * The `precise` figure is invariant to confidence — it is the model's point
 * estimate and is NEVER widened; only the range around it breathes.
 *
 * The asymmetry is deliberate: unresolved uncertainty pushes the ceiling up
 * roughly twice as hard as it pulls the floor down, because unknowns on a
 * jobsite far more often add work than remove it.
 */
export function widenFactors(confidence: number) {
  const spread = Math.max(0, (confidence - 8) / 100);
  return {
    low: (n: number) => n * (1 - spread * 0.45),
    high: (n: number) => n * (1 + spread * 0.9),
  };
}

/** The headline range a build displays at a given confidence. */
export function widenTotals(
  r: Pick<EstimateResult, 'totalLow' | 'totalHigh'>,
  confidence: number,
): { low: number; high: number } {
  if (r.totalLow <= 0) return { low: 0, high: 0 };
  const w = widenFactors(confidence);
  return {
    low: Math.max(500, Math.round(w.low(r.totalLow) / 250) * 250),
    high: Math.round(w.high(r.totalHigh) / 250) * 250,
  };
}
