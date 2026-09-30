/**
 * Carr Landscape Depot pricing — sourced from carr-price-list skill. 2025 price book,
 * except the takeoff aggregates (¾" clear stone, HPB), which moved to the 2026 book
 * (effective 2026-05-01) on 2026-09-23. A full 2026 refresh is still outstanding.
 * `materialRetailPerSqft` is Carr's RETAIL material price (base color) — the number
 * shown on the brand-picker cards. `installedPerSqft` is the all-in installed anchor
 * (excavation, base, crew, disposal, margin) that the estimate math is built on; it
 * must never be displayed as a paver price.
 * Update quarterly when Carr publishes new pricing.
 *
 * Calculator scope: Permacon pavers only, TimberTech decking only.
 */

import engineBaseline from './engine-baseline.json';

export type PaverTier = 'budget' | 'mid' | 'premium';

/** What kind of tear-out/excavation spoil a job hauls away — drives bin count. */
export type TearOutKind = 'full-depth' | 'sod-strip' | 'spoil-only';

export interface PaverBrand {
  id: string;
  brand: string;
  product: string;
  tier: PaverTier;
  /** Carr 2025 retail material price, base color, $/sqft — shown on the picker cards. */
  materialRetailPerSqft: number;
  /** Carr 2025 TRADE column, $/sqft — the takeoff engine's cost basis, never displayed.
   *  VERIFY vs Carr trade column — initialized from the retail figures; if Carr's trade
   *  price is lower the 1.35 markup double-counts and the internal margin figure reads
   *  low. Outcome pricing is pinned by the calibration gate either way. */
  materialTradePerSqft: number;
  /** Legacy all-in installed anchor. Since the takeoff engine (2026-08) this is
   *  display/positioning-only — the estimate math prices from quantities. */
  installedPerSqft: number;
  thicknessMm: number;
  useCase: 'patio' | 'patio-driveway' | 'driveway';
  description: string;
  /** Surface a "Recommended" badge in the brand picker. */
  recommended?: boolean;
}

export const PAVER_BRANDS: PaverBrand[] = [
  // ----- BUDGET (Standard) -----
  {
    id: 'permacon-melville',
    brand: 'Permacon',
    product: 'Melville',
    tier: 'budget',
    materialRetailPerSqft: 5.62,
    materialTradePerSqft: 5.62,
    installedPerSqft: 32,
    thicknessMm: 60,
    useCase: 'patio-driveway',
    description: 'Permacon\'s most-installed slab. Versatile, durable, and consistent across batches.',
    recommended: true,
  },
  {
    id: 'permacon-cassara',
    brand: 'Permacon',
    product: 'Cassara',
    tier: 'budget',
    materialRetailPerSqft: 6.24,
    materialTradePerSqft: 6.24,
    installedPerSqft: 34,
    thicknessMm: 60,
    useCase: 'patio',
    description: 'Tumbled European character. Pairs naturally with seating walls and warm hardscape.',
  },
  {
    id: 'permacon-vendome',
    brand: 'Permacon',
    product: 'Vendome',
    tier: 'budget',
    materialRetailPerSqft: 5.96,
    materialTradePerSqft: 5.96,
    installedPerSqft: 33,
    thicknessMm: 60,
    useCase: 'patio',
    description: 'Textured rustic finish. Warm-toned, traditional Permacon look.',
  },
  // ----- MID (Elevated) -----
  {
    id: 'permacon-mondrian-plus',
    brand: 'Permacon',
    product: 'Mondrian Plus',
    tier: 'mid',
    materialRetailPerSqft: 5.79,
    materialTradePerSqft: 5.79,
    installedPerSqft: 36,
    thicknessMm: 60,
    useCase: 'patio',
    description: 'Clean large-format slab. Modern aesthetic with minimal visible joints.',
    recommended: true,
  },
  {
    id: 'permacon-wilfred',
    brand: 'Permacon',
    product: 'Wilfred',
    tier: 'mid',
    materialRetailPerSqft: 7.83,
    materialTradePerSqft: 7.83,
    installedPerSqft: 38,
    thicknessMm: 60,
    useCase: 'patio',
    description: 'Refined character with subtle European tumbling.',
  },
  {
    id: 'permacon-rosebel',
    brand: 'Permacon',
    product: 'Rosebel',
    tier: 'mid',
    materialRetailPerSqft: 7.32,
    materialTradePerSqft: 7.32,
    installedPerSqft: 40,
    thicknessMm: 60,
    useCase: 'patio',
    description: 'Sleek contemporary slab. Fits modern Simcoe County architecture.',
  },
  // ----- PREMIUM -----
  {
    id: 'permacon-mega-melville',
    brand: 'Permacon',
    product: 'Mega Melville',
    tier: 'premium',
    materialRetailPerSqft: 9.44,
    materialTradePerSqft: 9.44,
    installedPerSqft: 46,
    thicknessMm: 80,
    useCase: 'patio-driveway',
    description: 'Permacon\'s large-format flagship. Signature scale and premium finish.',
    recommended: true,
  },
  {
    id: 'permacon-brooklyn',
    brand: 'Permacon',
    product: 'Brooklyn',
    tier: 'premium',
    materialRetailPerSqft: 11.84,
    materialTradePerSqft: 11.84,
    installedPerSqft: 50,
    thicknessMm: 60,
    useCase: 'patio',
    description: 'Urban-industrial finish in Midnight and Rosewood tones. A statement paver.',
  },
  {
    id: 'permacon-metrik',
    brand: 'Permacon',
    product: 'Metrik',
    tier: 'premium',
    materialRetailPerSqft: 7.81,
    materialTradePerSqft: 7.81,
    installedPerSqft: 42,
    thicknessMm: 60,
    useCase: 'patio',
    description: 'Bold contemporary slab in Rockland Black. Architectural contrast.',
  },
];

export interface DeckBrand {
  id: string;
  brand: string;
  product: string;
  tier: 'mid' | 'premium' | 'luxury';
  /** All-in installed rate — decks are quoted installed; cards must say "installed". */
  installedPerSqft: number;
  description: string;
  recommended?: boolean;
}

export const DECK_BRANDS: DeckBrand[] = [
  {
    id: 'timbertech-prime',
    brand: 'TimberTech',
    product: 'AZEK Prime+',
    tier: 'premium',
    installedPerSqft: 58,
    description: 'PVC, no organics. Won\'t rot, mold, or absorb water.',
    recommended: true,
  },
  {
    id: 'timbertech-vintage',
    brand: 'TimberTech',
    product: 'AZEK Vintage',
    tier: 'luxury',
    installedPerSqft: 68,
    description: 'Top-tier capped polymer. 50-yr fade & stain warranty.',
  },
];

/** Cost-side aggregate / consumable rates. UI never renders these directly. */
export const AGGREGATES = {
  clearStone34PerTonne: 38.5,
  hpbPerTonne: 45,
  screeningsPerTonne: 32,
};

export const POLY_SAND_PER_BAG = 47; // Techniseal HP NextGel Urban Grey
export const EDGE_RESTRAINT_PER_LF = 4.5;
// FACT — derived from the DeckCraft pricing engine (engine-baseline.json).
// Do not hand-edit: scripts/check-pricing-parity.ts fails the build on drift.
export const BIN_COST = engineBaseline.facts.binCostCad; // 14-yard bin, before HST
export const DELIVERY_ZONE1 = 285;

/**
 * Carr 2025 TRADE book — the takeoff engine's cost side. UI never renders these.
 * Mirrored in engine-baseline.json `carr2025`; scripts/check-pricing-parity.ts
 * fails the build if the two drift apart, and bounds-checks the values so a
 * stale/tampered copy can't slide through. All CAD, pre-HST, Golden Maple pays
 * the Trade column (never quote off retail).
 */
export const CARR_TRADE = {
  aggregates: {
    /** ¾" Clear Stone (open-graded ICPI base), $/tonne trade — Carr 2026 book
     *  (2025 was $29.50). Yard $/tonne, not the page-6 load price. */
    clearStone34PerTonne: 31.50,
    /** HPB 1" bedding layer, $/tonne trade — Carr 2026 book (2025 was $26.22). */
    hpbPerTonne: 28.90,
    /** Carr depth chart (2025 printed p.60, compacted aggregate; carried over,
     *  not reprinted in the 2026 book): tonnes = sqft × depth_in × 0.005,
     *  i.e. sqft × depth / 200. Replaces the old "1 t per 100 sqft at 4""
     *  rule (sqft × depth / 400), which ordered half the base stone. */
    tonnesPerSqftPerInch: 0.005,
    /** For converting tonnes → truck yd³ when packing delivery loads. */
    tonnesPerYd3: 1.4,
  },
  consumables: {
    polySandPerBag: 29.10,        // Techniseal HP NextGel, trade
    polySandSqftPerBag: 80,       // conservative end of the 80–100 sqft/bag rule
    snapEdgePer8ftPiece: 14.64,   // Snap Edge paver restraint = $1.83/lf
    /** Exposed-edge heuristic: restrained perimeter lf ≈ 4 × √sqft. */
    edgeLfFactor: 4,
    gatorFabricPerRoll: 82.92,    // Gator Fabric 3.5 non-woven 4×100'
    fabricSqftPerRoll: 400,
  },
  /** Carr delivery, Zone 1 (Barrie/Innisfil/Angus/Ivy/Midhurst/Shanty Bay).
   *  Zones 2–4 keep the flat ZONE_SURCHARGE in locations.ts on top. */
  delivery: {
    tandemPerLoad: 125, tandemMaxYd3: 16,
    triAxlePerLoad: 135, triAxleMaxYd3: 22,
    flatbedBase: 256, flatbedBaseSkids: 6,
    flatbedPerExtraSkid: 40, flatbedMaxSkids: 15,
    /** Planning average — pavers per skid; refine per-brand when Permacon data lands. */
    paverSqftPerSkid: 100,
  },
  /** Sqft one 14-yd $550 bin absorbs, by what the job hauls. The tear-out kinds
   *  are the base rule; concrete/paver tear-outs ADD bins on top of the kind. */
  disposal: {
    fullDepthSqftPerBin: engineBaseline.facts.binPerSqftFullDepth, // 12" excavation FACT
    sodStripSqftPerBin: 650,        // mid of the 600–700 field rule
    spoilOnlySqftPerBin: 337,       // mid of the 325–350 field rule
    concreteTearOutSqftPerBin: 250, // ADDED bins when breaking out concrete
    paverTearOutSqftPerBin: 400,    // ADDED bins when lifting old pavers
  },
  /** Paver waste factors by layout complexity. */
  waste: { standard: 1.10, curves: 1.125, complex: 1.15 },
} as const;

/**
 * Natural stone takeoff inputs. Back-solved so stone retail lands ≈ paver
 * + $10/sqft (6.30 × 1.35 markup + 1.50 labour premium ≈ 10), matching the
 * engine's long-standing positioning. VERIFY — replace with real Carr
 * natural-stone trade prices (StoneArch/Oakville) when Yorkis confirms them.
 */
export const STONE_TRADE = {
  tradeDeltaPerSqft: 6.30,
  labourPremiumPerSqft: 1.50,
} as const;

/**
 * Add-on flat-cost ranges (CAD installed). Inclusive of materials + labour.
 * Source: Yorkis project history 2024–2025 averages.
 */
export interface AddOn {
  id: string;
  label: string;
  description: string;
  costLow: number;
  costHigh: number;
  /** Overrides the budget gap coach's default "easy to add later" phasing
   *  note (see budgetLevers.ts). Only set this when phasing genuinely costs
   *  something extra — leaving it unset for an add-on that DOES have real
   *  rework cost is what makes the coach's claim false. */
  phaseNote?: string;
}

export const ADD_ONS: AddOn[] = [
  {
    id: 'lighting',
    label: 'Landscape Lighting',
    description: 'In-Lite low-voltage system, 8–14 fixtures, transformer, professional install.',
    costLow: 4000,
    costHigh: 8000,
    phaseNote: 'Can be added later, but conduit is cheapest to run while the base is open — expect extra trenching cost if it\'s added after the patio is set.',
  },
  {
    id: 'drainage',
    label: 'Drainage System',
    description: 'French drain or catch basins tied to grade. Critical for clay soil sites.',
    costLow: 2000,
    costHigh: 5000,
    phaseNote: 'Can be added later, but expect roughly $800–$2,000 extra to lift and relay pavers over the run.',
  },
  {
    id: 'firepit',
    label: 'Fire Feature',
    description: 'Prefab kit (Beltis, Orion) or custom-built natural gas fire table.',
    costLow: 1500,
    costHigh: 5000,
  },
  {
    id: 'seatingwall',
    label: 'Seating Wall',
    description: 'Built-in stone wall with cap, typically 16–18" tall. Pairs with fire feature.',
    costLow: 3000,
    costHigh: 8000,
  },
  {
    id: 'sealing',
    label: 'Annual Sealing Plan',
    description: '3-year sealing & joint-sand top-up plan. Locks in colour, prevents weeds.',
    costLow: 1000,
    costHigh: 2000,
  },
];

/**
 * Disposal bin count by tear-out kind (14-yd bins, CARR_TRADE.disposal rules).
 * Default 'full-depth' preserves the legacy single-arg call sites — but note
 * the divisor is now the 237-sqft FACT, not the old hand-rounded 240.
 */
export function estimateBins(sqft: number, kind: TearOutKind = 'full-depth'): number {
  if (sqft <= 0) return 0;
  const perBin = kind === 'sod-strip'
    ? CARR_TRADE.disposal.sodStripSqftPerBin
    : kind === 'spoil-only'
    ? CARR_TRADE.disposal.spoilOnlySqftPerBin
    : CARR_TRADE.disposal.fullDepthSqftPerBin;
  return Math.max(1, Math.ceil(sqft / perBin));
}

/** Pick a default brand for a given tier and use case. Prefers `recommended` matches first. */
export function defaultPaverForTier(tier: PaverTier, useCase: 'patio' | 'driveway' = 'patio'): PaverBrand {
  const filtered = PAVER_BRANDS.filter(p => p.tier === tier && (useCase === 'patio' ? p.useCase !== 'driveway' : p.thicknessMm >= 80));
  return filtered.find(p => p.recommended) || filtered[0] || PAVER_BRANDS[0];
}

/** Order pavers so recommended ones come first within each tier. */
export function sortPaversForDisplay(pavers: PaverBrand[]): PaverBrand[] {
  return [...pavers].sort((a, b) => {
    if (a.recommended && !b.recommended) return -1;
    if (!a.recommended && b.recommended) return 1;
    return 0;
  });
}
