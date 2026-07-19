/**
 * Carr Landscape Depot pricing — sourced from carr-price-list skill (2025 trade prices).
 * Trade values are internal cost; retail values are what we quote.
 * Update quarterly when Carr publishes new pricing.
 *
 * Calculator scope: Permacon pavers only, TimberTech decking only.
 */

import engineBaseline from './engine-baseline.json';

export type PaverTier = 'budget' | 'mid' | 'premium';

export interface PaverBrand {
  id: string;
  brand: string;
  product: string;
  tier: PaverTier;
  retailPerSqft: number; // installed retail
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
    retailPerSqft: 32,
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
    retailPerSqft: 34,
    thicknessMm: 60,
    useCase: 'patio',
    description: 'Tumbled European character. Pairs naturally with seating walls and warm hardscape.',
  },
  {
    id: 'permacon-vendome',
    brand: 'Permacon',
    product: 'Vendome',
    tier: 'budget',
    retailPerSqft: 33,
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
    retailPerSqft: 36,
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
    retailPerSqft: 38,
    thicknessMm: 60,
    useCase: 'patio',
    description: 'Refined character with subtle European tumbling.',
  },
  {
    id: 'permacon-rosebel',
    brand: 'Permacon',
    product: 'Rosebel',
    tier: 'mid',
    retailPerSqft: 40,
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
    retailPerSqft: 46,
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
    retailPerSqft: 50,
    thicknessMm: 60,
    useCase: 'patio',
    description: 'Urban-industrial finish in Midnight and Rosewood tones. A statement paver.',
  },
  {
    id: 'permacon-metrik',
    brand: 'Permacon',
    product: 'Metrik',
    tier: 'premium',
    retailPerSqft: 42,
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
  retailPerSqft: number;
  description: string;
  recommended?: boolean;
}

export const DECK_BRANDS: DeckBrand[] = [
  {
    id: 'timbertech-prime',
    brand: 'TimberTech',
    product: 'AZEK Prime+',
    tier: 'premium',
    retailPerSqft: 58,
    description: 'PVC, no organics. Won\'t rot, mold, or absorb water.',
    recommended: true,
  },
  {
    id: 'timbertech-vintage',
    brand: 'TimberTech',
    product: 'AZEK Vintage',
    tier: 'luxury',
    retailPerSqft: 68,
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
 * Add-on flat-cost ranges (CAD installed). Inclusive of materials + labour.
 * Source: Yorkis project history 2024–2025 averages.
 */
export interface AddOn {
  id: string;
  label: string;
  description: string;
  costLow: number;
  costHigh: number;
}

export const ADD_ONS: AddOn[] = [
  {
    id: 'lighting',
    label: 'Landscape Lighting',
    description: 'In-Lite low-voltage system, 8–14 fixtures, transformer, professional install.',
    costLow: 4000,
    costHigh: 8000,
  },
  {
    id: 'drainage',
    label: 'Drainage System',
    description: 'French drain or catch basins tied to grade. Critical for clay soil sites.',
    costLow: 2000,
    costHigh: 5000,
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

/** Disposal bin count rule of thumb for full 12" excavation hardscape jobs. */
export function estimateBins(sqft: number): number {
  if (sqft <= 0) return 0;
  return Math.max(1, Math.ceil(sqft / 240));
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
