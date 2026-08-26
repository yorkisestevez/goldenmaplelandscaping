/**
 * Quantity takeoff for hardscape elements — pure arithmetic, no React, no IO.
 *
 * This is the cost-side truth of the 2026-08 "engine v3" upgrade: instead of
 * pricing patio/stone work from an installed-$/sqft anchor, the engine now
 * counts what Golden Maple actually orders from Carr (pavers + waste, base
 * tonnage, bedding, poly sand, edge restraint, fabric), packs the delivery
 * trucks, and counts disposal bins by what the job hauls away. Trade cost →
 * retail via the locked materialMarkup FACT; excavation + install labour are
 * calibrated $/sqft rates solved so the reference job lands on the owner's
 * $40–42/sqft retail rule (see engine-baseline.json `calibration`).
 *
 * Money discipline: every line item is rounded to integer CENTS exactly once.
 * scripts/regen-engine-snapshot.ts asserts integer-ness so float drift can
 * never enter the pinned snapshot.
 *
 * Hand-verified reference (500 sqft, mid Mondrian Plus $5.79 trade, grass,
 * simple, Barrie): materials trade $4,205.00, delivery trade $506.00, 3 bins,
 * materials retail $6,359.85, excavation $4,395.00, install $6,595.00,
 * restoration $1,625.00 → subtotal $20,624.85 = $41.25/sqft. Change the
 * calibration numbers and this comment together or not at all.
 */

import {
  CARR_TRADE, STONE_TRADE, BIN_COST, type TearOutKind, type PaverBrand,
} from '../data/carrPrices';
import engineBaseline from '../data/engine-baseline.json';

const CAL = engineBaseline.calibration;
const MARKUP = engineBaseline.facts.materialMarkup;

/** Dollars → integer cents, rounded once. */
export const c = (dollars: number): number => Math.round(dollars * 100);

export type PreciseCategory = 'excavation' | 'materials' | 'labour' | 'disposal' | 'restoration';

export interface PreciseLineItem {
  id: string;
  label: string;
  qty: number;
  unit: string;
  unitTradeCents: number;
  tradeCents: number;
  /** trade × markup for materials/delivery; pass-through for bins. */
  retailCents: number;
  category: PreciseCategory;
}

export interface TakeoffQuantities {
  aggregateTonnes: number;
  polySandBags: number;
  edgePieces: number;
  fabricRolls: number;
  skids: number;
  deliveryLoads: number;
  bins: number;
}

export interface HardscapeTakeoff {
  items: PreciseLineItem[];
  /** Pavers + aggregates + consumables + delivery, at retail, integer cents. */
  materialsRetailCents: number;
  /** Same scope at trade — powers the internal margin figure. */
  materialsTradeCents: number;
  /** Calibrated $/sqft slices, integer cents (shape/use multipliers applied by the engine). */
  excavationRetailCents: number;
  installRetailCents: number;
  bins: number;
  quantities: TakeoffQuantities;
}

export function aggregateTonnes(sqft: number, depthIn: number): number {
  return (sqft * (depthIn / 4)) / CARR_TRADE.aggregates.coverageSqftPerTonnePer4in;
}

/** One product per truck: overflow rides tri-axles, the remainder a tandem. */
function loadsFor(yd3: number): number[] {
  const d = CARR_TRADE.delivery;
  const costs: number[] = [];
  let remaining = yd3;
  while (remaining > 1e-9) {
    if (remaining > d.tandemMaxYd3) { costs.push(d.triAxlePerLoad); remaining -= d.triAxleMaxYd3; }
    else { costs.push(d.tandemPerLoad); remaining = 0; }
  }
  return costs;
}

/** Flatbed pallet pricing: $256 covers 6 skids, +$40/skid to 15, then another flatbed. */
function flatbedCost(skids: number): number {
  const d = CARR_TRADE.delivery;
  let cost = 0;
  let remaining = skids;
  while (remaining > 0) {
    const onThisTruck = Math.min(remaining, d.flatbedMaxSkids);
    cost += d.flatbedBase + Math.max(0, onThisTruck - d.flatbedBaseSkids) * d.flatbedPerExtraSkid;
    remaining -= onThisTruck;
  }
  return cost;
}

/** What the existing-surface answer means for hauling. Breaking/lifting LABOUR
 *  stays in the engine's flat adders — this only counts the extra bins, so the
 *  two paths can never double-charge the same work. */
export function disposalBinsFor(sqft: number, kind: TearOutKind, surface?: string): number {
  if (sqft <= 0) return 0;
  const d = CARR_TRADE.disposal;
  const perBin = kind === 'sod-strip' ? d.sodStripSqftPerBin
    : kind === 'spoil-only' ? d.spoilOnlySqftPerBin
    : d.fullDepthSqftPerBin;
  let bins = Math.max(1, Math.ceil(sqft / perBin));
  if (surface === 'concrete') bins += Math.ceil(sqft / d.concreteTearOutSqftPerBin);
  if (surface === 'pavers') bins += Math.ceil(sqft / d.paverTearOutSqftPerBin);
  if (surface === 'deck') bins += 1;
  return bins;
}

/** Existing surface → what the excavation hauls. Old pavers come out as spoil
 *  (the base underneath usually stays); everything else digs the full 12". */
export function tearOutKindFor(surface: string | undefined): TearOutKind {
  return surface === 'pavers' ? 'spoil-only' : 'full-depth';
}

export function hardscapeTakeoff(args: {
  sqft: number;
  shape: string | undefined;   // details['el.shape'] — waste factor
  surface: string | undefined; // details['el.surface'] — tear-out kind + extra bins
  paver: PaverBrand;
  element: 'patio' | 'stone';
}): HardscapeTakeoff {
  const { sqft, shape, surface, paver, element } = args;
  const A = CARR_TRADE.aggregates;
  const K = CARR_TRADE.consumables;
  const baseDepthIn = engineBaseline.facts.baseDepthIn;

  const waste = shape === 'complex' ? CARR_TRADE.waste.complex
    : shape === 'curves' ? CARR_TRADE.waste.curves
    : CARR_TRADE.waste.standard;

  const tradePerSqft = element === 'stone'
    ? paver.materialTradePerSqft + STONE_TRADE.tradeDeltaPerSqft
    : paver.materialTradePerSqft;

  const paverSqft = sqft * waste;
  const stoneTonnes = aggregateTonnes(sqft, baseDepthIn);
  const hpbTonnes = aggregateTonnes(sqft, 1); // 1" bedding layer
  const polyBags = Math.ceil(sqft / K.polySandSqftPerBag);
  const edgeLf = K.edgeLfFactor * Math.sqrt(sqft);
  const edgePieces = Math.ceil(edgeLf / 8);
  const fabricRolls = Math.ceil(sqft / K.fabricSqftPerRoll);
  const skids = Math.ceil(paverSqft / CARR_TRADE.delivery.paverSqftPerSkid);
  const aggLoads = [...loadsFor(stoneTonnes / A.tonnesPerYd3), ...loadsFor(hpbTonnes / A.tonnesPerYd3)];
  const bins = disposalBinsFor(sqft, tearOutKindFor(surface), surface);

  const items: PreciseLineItem[] = [];
  const material = (id: string, label: string, qty: number, unit: string, unitTrade: number) => {
    const tradeCents = c(qty * unitTrade);
    items.push({
      id, label, qty: Math.round(qty * 100) / 100, unit,
      unitTradeCents: c(unitTrade), tradeCents,
      retailCents: Math.round(tradeCents * MARKUP), category: 'materials',
    });
  };

  material(`${element}-material`, element === 'stone' ? 'Natural stone (incl. cuts/waste)' : `${paver.brand} ${paver.product} pavers (incl. waste)`, paverSqft, 'sqft', tradePerSqft);
  material('clear-stone-base', `¾" clear stone base, ${baseDepthIn}" compacted`, stoneTonnes, 'tonne', A.clearStone34PerTonne);
  material('hpb-bedding', 'HPB bedding, 1" screeded', hpbTonnes, 'tonne', A.hpbPerTonne);
  material('poly-sand', 'Techniseal HP NextGel polymeric sand', polyBags, 'bag', K.polySandPerBag);
  material('edge-restraint', 'Snap Edge paver restraint + spikes', edgePieces, 'pc (8 ft)', K.snapEdgePer8ftPiece);
  material('geotextile', 'Non-woven geotextile fabric', fabricRolls, 'roll', K.gatorFabricPerRoll);

  const aggDeliveryTrade = aggLoads.reduce((a, b) => a + b, 0);
  const flatbedTrade = flatbedCost(skids);
  material('delivery-aggregate', 'Aggregate delivery (Carr, zone 1)', aggLoads.length, 'load', aggLoads.length > 0 ? aggDeliveryTrade / aggLoads.length : 0);
  material('delivery-pallets', 'Paver pallet delivery (flatbed)', skids, 'skid', skids > 0 ? flatbedTrade / skids : 0);

  const binTradeCents = c(bins * BIN_COST);
  items.push({
    id: 'disposal-bins', label: '14-yd disposal bins', qty: bins, unit: 'bin',
    unitTradeCents: c(BIN_COST), tradeCents: binTradeCents,
    retailCents: binTradeCents, category: 'disposal',
  });

  const materialsItems = items.filter(i => i.category === 'materials');
  const materialsRetailCents = materialsItems.reduce((a, i) => a + i.retailCents, 0);
  const materialsTradeCents = materialsItems.reduce((a, i) => a + i.tradeCents, 0);

  // Calibrated slices — stone carries a per-sqft install premium (heavier units, tighter joints).
  const installPerSqft = CAL.installLabourPerSqftRetail
    + (element === 'stone' ? STONE_TRADE.labourPremiumPerSqft : 0);
  const excavationRetailCents = c(sqft * CAL.excavationPerSqftRetail);
  const installRetailCents = c(sqft * installPerSqft);
  items.push({
    id: 'excavation-base-install', label: `Excavation + ${baseDepthIn}" base build`, qty: sqft, unit: 'sqft',
    unitTradeCents: 0, tradeCents: 0, retailCents: excavationRetailCents, category: 'excavation',
  });
  items.push({
    id: 'install-labour', label: 'Screeding, laying, cutting, compaction, joint sand', qty: sqft, unit: 'sqft',
    unitTradeCents: 0, tradeCents: 0, retailCents: installRetailCents, category: 'labour',
  });

  return {
    items,
    materialsRetailCents,
    materialsTradeCents,
    excavationRetailCents,
    installRetailCents,
    bins,
    quantities: {
      aggregateTonnes: Math.round((stoneTonnes + hpbTonnes) * 10) / 10,
      polySandBags: polyBags,
      edgePieces,
      fabricRolls,
      skids,
      deliveryLoads: aggLoads.length,
      bins,
    },
  };
}
