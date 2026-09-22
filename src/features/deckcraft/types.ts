export type DeckType = 'Attached' | 'Freestanding' | 'Floating' | 'Add-on';
export type Municipality = 'Toronto' | 'Barrie' | 'Simcoe County' | 'Burlington-Oakville' | 'Rural-Other';
export type SiteType = 'Standard' | 'Waterfront-Lakefront' | 'Hillside' | 'Urban Tight' | 'Island-Ferry';
export type SoilCondition = 'Unknown' | 'Sandy' | 'Clay' | 'Shallow Bedrock' | 'Fill';
export type BuildSeason = 'Spring-Summer' | 'Fall' | 'Winter';
export type IntendedLoad = 'Standard' | 'Heavy';
export type DeckShape = 'Rectangle' | 'L-Shape' | 'Multi-corner' | 'Curved';
export type BoardPattern = 'Straight' | 'Diagonal' | 'Picture Frame' | 'Herringbone';
export type RailingType = 'None' | 'Wood Picket' | 'Aluminum' | 'Cable' | 'Glass Panels' | 'Trex Select' | 'Trex Transcend' | 'Fortress AL13' | 'TT Classic' | 'TT Impression';
export type StairType = 'Straight' | 'Winder' | 'Landing';
export type LightingZone = 'deck'|'posts'|'stairs'|'landscape'|'house'|'privacy';
/** A single freestanding screen on one exposed deck edge; priced by its face area. */
export type PrivacyProductId='slatted'|'hideaway'|'oasis';
export interface PrivacyScreen {id:string;side:'Left'|'Right'|'Front'|'Back';lengthFt:number;heightFt:4|5|6;offsetPct:number;lights:boolean;
  /** Undefined = on. An off screen stays in the design but is not drawn, lit or priced. */
  enabled?:boolean;
  /** Undefined = Golden Maple slatted screen. Manufacturer screens are supplier-quote items. */
  product?:PrivacyProductId;design?:string;finish?:'Black'|'White';
  /** Manufacturer screens only: stock panel count; length follows the panels. */
  panels?:number}
export interface HouseOpening {id:string;type:'Door'|'Window';facade:'Front'|'Back'|'Left'|'Right';offsetPct:number;bottomIn:number;widthIn:number;heightIn:number}
export interface HouseConfig {widthFt:number;depthFt:number;storeys:1|2|3;storeyHeightIn:number;roofShape:'Gable'|'Hip'|'Flat';roofFinish:'Shingles'|'Metal';roofColor:string;cladding:'Brick'|'Siding';claddingColor:string;trimColor:string;openings:HouseOpening[];
  /** Finished floor / door-sill height above grade. When set, the deck is checked against it. */
  floorHeightIn?:number}
/** Where the house sits along the deck's back line. Absent = centred on the deck (the original behaviour). */
export interface HousePlacement {anchor:'left'|'center'|'right';offsetIn:number}
/** One side wing of a wrap-around deck: how far it reaches out from the house side wall, and how
 * far it runs back along that wall from the deck-facing wall. */
export interface WrapWing {widthFt:number;runFt:number}
/** Wrap-around deck: side wings around one or both house corners, each mitred on a corner-to-corner hip. */
export interface WrapConfig {left?:WrapWing;right?:WrapWing}
export type YardFeatureKind='patio'|'retaining-wall'|'water-feature';
export interface YardFeature {id:string;kind:YardFeatureKind;name:string;enabled:boolean;xFt:number;zFt:number;widthFt:number;depthFt:number;heightIn:number;rotationDeg:number;productId:string;color:string}
export interface TerrainConfig {widthFt:number;depthFt:number;elevationIn:number;slopePct:number}

export type FoundationType = 'Concrete Piers' | 'Helical Piles' | 'Deck Blocks';

export interface LightingProduct {
  id: string;
  name: string;
  category: 'Transformer' | 'Recessed' | 'Surface' | 'Bollard' | 'Accessory';
  cost: number;
  laborCost: number;
  description?: string;
}

export const INLITE_PRODUCTS: LightingProduct[] = [
  // Transformers
  { id: 'hub50', name: 'HUB-50', category: 'Transformer', cost: 265, laborCost: 150, description: '50W Standard Transformer' },
  { id: 'hub100', name: 'HUB-100', category: 'Transformer', cost: 315, laborCost: 150, description: '100W Standard Transformer' },
  { id: 'smart_hub150', name: 'SMART HUB-150', category: 'Transformer', cost: 645, laborCost: 185, description: '150W Bluetooth Smart Transformer' },
  
  // Recessed Lights
  { id: 'puck', name: 'PUCK (Dark)', category: 'Recessed', cost: 55, laborCost: 55, description: '22mm Recessed Deck Light' },
  { id: 'fusion', name: 'FUSION', category: 'Recessed', cost: 65, laborCost: 55, description: '60mm Integrated Deck Light' },
  { id: 'hyve', name: 'HYVE', category: 'Recessed', cost: 58, laborCost: 55, description: 'Subtle 60mm Recessed Light' },
  
  // Surface / Stair Lights
  { id: 'evo_hyde', name: 'EVO HYDE', category: 'Surface', cost: 145, laborCost: 65, description: 'Linear Under-cap Light' },
  { id: 'wedge', name: 'WEDGE', category: 'Surface', cost: 75, laborCost: 65, description: 'Surface Mounted Wall/Stair Light' },
  { id: 'blink', name: 'BLINK', category: 'Surface', cost: 85, laborCost: 65, description: 'Compact Surface Light' },
  
  // Bollards / Accents
  { id: 'ace', name: 'ACE Bollard', category: 'Bollard', cost: 185, laborCost: 75, description: 'Directional Path Light' },
  { id: 'liv', name: 'LIV Bollard', category: 'Bollard', cost: 165, laborCost: 75, description: '360 Degree Path Light' },
  { id: 'scope', name: 'SCOPE Spotlight', category: 'Bollard', cost: 125, laborCost: 75, description: 'Accent Spotlight' },
  
  // Accessories
  { id: 'smart_move', name: 'SMART MOVE', category: 'Accessory', cost: 125, laborCost: 45, description: 'Wireless Motion Sensor' },
  { id: 'smart_bridge', name: 'SMART BRIDGE', category: 'Accessory', cost: 245, laborCost: 85, description: 'Wi-Fi Bridge for Remote Control' },
  { id: 'smart_extender', name: 'SMART EXTENDER', category: 'Accessory', cost: 95, laborCost: 25, description: 'Bluetooth Range Extender' },
  { id: 'cable_14_2', name: '14/2 Cable (100ft)', category: 'Accessory', cost: 185, laborCost: 0, description: 'Standard Low Voltage Cable' },
  { id: 'cable_12_2', name: '12/2 Cable (100ft)', category: 'Accessory', cost: 245, laborCost: 0, description: 'Heavy Duty Low Voltage Cable' },
];

export interface DeckData {
  yardFeatures?: YardFeature[];
  terrainConfig?: TerrainConfig;
  houseConfig?: HouseConfig;
  housePlacement?: HousePlacement;
  wrap?: WrapConfig;
  /** A named exposed edge (e.g. 'wingR-end') for the primary stair flight; overrides stairPosition. */
  stairEdgeId?: string;
  lightingZoneEnabled?: Partial<Record<LightingZone,boolean>>;
  lightingPreviewOn?: boolean;
  catalogueRailingId?: string;
  catalogueAccessories?: string[];
  borderFinish?: 'Matching'|'Dark Slate';
  pictureFrameOverhangIn?: number;
  houseVisible?: boolean;
  houseWallHeightIn?: number;
  houseDoorOffset?: number;
  houseDoorWidthIn?: number;
  sceneLighting?: 'Daylight' | 'Evening';
  level2Position?: 'Front' | 'Left' | 'Right';
  level2Offset?: number;
  stairTurn?: 'Left' | 'Right';
  landingDepthIn?: number;
  /** User-selected illustrative embedment, not a geotechnical design depth. */
  foundationDepthIn?: number;
  // What we're building — 'deck' keeps the original 6-step flow;
  // 'hardscape' switches steps 2-4 to the paver estimator (src/hardscape.ts)
  projectKind?: 'deck' | 'hardscape';
  hsUse?: 'Patio' | 'Walkway' | 'Driveway';
  hsProduct?: string;      // id into HARDSCAPE_PRODUCTS
  hsColor?: string;
  hsBorderRows?: number;   // 0-2 contrast border courses
  hsSteps?: number;        // 48" step units
  hsFirePit?: string;      // id into FIRE_PIT_KITS
  hsLightCount?: number;   // In-Lite fixture allowance

  // Step 1
  deckType: DeckType;
  municipality: Municipality;
  siteType: SiteType;
  soilCondition: SoilCondition;
  buildSeason: BuildSeason;
  intendedLoad: IntendedLoad;
  foundation: FoundationType;

  // Step 2
  width: number;
  length: number;
  height: number;
  cutoutWidth: number;
  cutoutLength: number;
  width2: number;
  length2: number;
  height2: number;
  cutoutWidth2: number;
  cutoutLength2: number;
  shape: DeckShape;
  levels: number;
  pattern: BoardPattern;

  // Step 3
  deckingMaterial: string;
  deckingColor?: string;
  framingSize: '2x8' | '2x10' | '2x12';
  boardWidth: 5.5 | 3.5;
  joistSpacing: 12 | 16;
  fasteningSystem: 'Face' | 'Hidden';
  pictureFrameRows: 0 | 1 | 2;
  hasInlay: boolean;
  inlayLf: number;

  // Step 4
  railingType: RailingType;
  railingLf: number;
  stairFlights: number;
  stairWidth: number;
  stairType: StairType;
  stairPosition: 'Front' | 'Left' | 'Right' | 'Back';
  stairOffset: number; // 0 to 100 percentage along the edge
  
  // Add-ons
  lightingSystem: {
    /** `auto` marks quantities kept in step with the modeled posts, treads or screen posts. */
    selectedItems: { productId: string; qty: number; zone?:LightingZone; auto?:true }[];
    wireDistance: number;
  };
  /** Simple post/stair lighting intent; kept separate so it survives a zero count. */
  autoLighting?: {posts?:boolean;stairs?:boolean;stairStyle?:'evo_hyde'|'evo_flex'};
  benchLf: number;
  /** Priced privacy area. Derived from privacyScreens whenever screens are present. */
  privacySqft: number;
  privacyScreens?: PrivacyScreen[];
  hasDrainage: boolean;
  hasDemo: boolean;
  pergolaSqft: number;
  
  // Add-on specific
  addOnTransitionLabor?: number;
  addOnHardwareCost?: number;
  addOnFlashingLf?: number;

  // Contractor overrides
  customLaborCost?: number;
  materialMarkup?: number;
  customOverrides?: Record<string, { qty?: number; cost?: number }>;

  // Customer & Project Info
  customerName: string;
  projectAddress: string;
  scopeOfWork: string;
  generatedImageUrl?: string;
  isGeneratingImage?: boolean;
}

// Golden Maple sells four decking lines: pressure treated, cedar, TimberTech and
// Deckorators. Trex and Ipe were removed 2026-07-15 (not sold).
//
// costPerSqft = TRUE supplier cost per square foot of deck surface, from the Carr
// Landscape Depot 2025 price book TRADE column (per-board price ÷ length = $/lin-ft,
// × 2.1818 lin-ft per sqft for a 5.5" board). Contractor markup applied separately
// in calculations.ts (materialMarkup). Colours within a collection are all the same
// price — Carr prices per collection, not per colour.
//
// `colors[].swatch` is the swatch FILE NAME in src/assets/swatches — every one is
// REAL manufacturer product photography (timbertech.com/colors, deckorators.com)
// or a real board photo, never an AI-generated approximation. A customer picks a
// colour off these, so an invented one would be a colour they can't actually buy.
// Only colours with a verified real swatch are listed: where Carr's 2025 book and
// the manufacturer's current lineup disagree (Terrain, Vintage, Harvest+), the
// CURRENT lineup wins — that's what's orderable today. Confirm stock with Carr.
export interface MaterialColor {
  name: string;
  swatch: string;
}

export const MATERIAL_TIERS = [
  {
    id: 'pressure_treated', name: 'Pressure Treated 5/4×6', tier: 'Budget', priceRange: '$2.70/sqft cost',
    costPerSqft: 2.70, isComposite: false, isHidden: false, // Carr $14.82/12'
    note: 'Natural wood. Stain every couple of seasons or it weathers grey. Tone and grain vary board to board.',
    colors: [{ name: 'Pressure Treated', swatch: 'wood-pressure-treated.jpg' }],
  },
  {
    id: 'cedar', name: 'Western Red Cedar 5/4×6', tier: 'Mid', priceRange: '~$6.50/sqft cost',
    costPerSqft: 6.50, isComposite: false, isHidden: false, // NOT stocked at Carr — market estimate
    note: 'Natural wood, market-rate estimate (not stocked at Carr — confirm price). Ages to silver-grey unless sealed.',
    colors: [{ name: 'Western Red Cedar', swatch: 'wood-cedar.jpg' }],
  },
  {
    id: 'tt_prime_plus', name: 'TimberTech EDGE Prime+', tier: 'Entry Composite', priceRange: '$9.00/sqft cost',
    costPerSqft: 9.00, isComposite: true, isHidden: false, // Carr Edge Prime+ $49.56/12'
    colors: [
      { name: 'Coconut Husk', swatch: 'tt-primeplus-coconut-husk.jpg' },
      { name: 'Sea Salt Gray', swatch: 'tt-primeplus-sea-salt-gray.jpg' },
      { name: 'Dark Cocoa', swatch: 'tt-primeplus-dark-cocoa.jpg' },
    ],
  },
  {
    id: 'tt_terrain', name: 'TimberTech PRO Terrain+', tier: 'Mid Composite', priceRange: '$12.15/sqft cost',
    costPerSqft: 12.15, isComposite: true, isHidden: false, // Carr Terrain+ $66.84/12'
    colors: [
      { name: 'Brown Oak', swatch: 'tt-terrain-brown-oak.jpg' },
      { name: 'Silver Maple', swatch: 'tt-terrain-silver-maple.jpg' },
    ],
  },
  {
    id: 'tt_reserve', name: 'TimberTech PRO Reserve', tier: 'Mid-Premium Composite', priceRange: '$12.15/sqft cost',
    costPerSqft: 12.15, isComposite: true, isHidden: false, // Carr Reserve $66.84/12' (book lists = Terrain+ ladder — confirm)
    colors: [
      { name: 'Antique Leather', swatch: 'tt-reserve-antique-leather.jpg' },
      { name: 'Dark Roast', swatch: 'tt-reserve-dark-roast.jpg' },
      { name: 'Driftwood', swatch: 'tt-reserve-driftwood.jpg' },
      { name: 'Reclaimed Chestnut', swatch: 'tt-reserve-reclaimed-chestnut.jpg' },
    ],
  },
  {
    id: 'tt_harvest', name: 'TimberTech AZEK Harvest', tier: 'Premium PVC', priceRange: '$14.99/sqft cost',
    costPerSqft: 14.99, isComposite: true, isHidden: false, // Carr $82.44/12'
    colors: [
      { name: 'Brownstone', swatch: 'tt-harvest-brownstone.jpg' },
      { name: 'Slate Gray', swatch: 'tt-harvest-slate-gray.jpg' },
      { name: 'Kona', swatch: 'tt-harvest-kona.jpg' },
    ],
  },
  {
    id: 'deck_vista', name: 'Deckorators Vista', tier: 'Mid-Premium Composite', priceRange: '$13.20/sqft cost',
    costPerSqft: 13.20, isComposite: true, isHidden: false, // Carr $72.60/12'
    colors: [
      { name: 'Dunewood', swatch: 'dk-vista-dunewood.jpg' },
      { name: 'Silverwood', swatch: 'dk-vista-silverwood.jpg' },
      { name: 'Driftwood', swatch: 'dk-vista-driftwood.jpg' },
      { name: 'Ironwood', swatch: 'dk-vista-ironwood.jpg' },
    ],
  },
  {
    id: 'deck_voyage', name: 'Deckorators Voyage (Surestone)', tier: 'Ultra-Premium MBC', priceRange: '$18.00/sqft cost',
    costPerSqft: 18.00, isComposite: true, isHidden: false, // Carr $99.00/12'
    colors: [
      { name: 'Costa', swatch: 'dk-voyage-costa.jpg' },
      { name: 'Tundra', swatch: 'dk-voyage-tundra.jpg' },
      { name: 'Sierra', swatch: 'dk-voyage-sierra.jpg' },
      { name: 'Khaya', swatch: 'dk-voyage-khaya.jpg' },
      { name: 'Sedona', swatch: 'dk-voyage-sedona.jpg' },
      { name: 'Mesa', swatch: 'dk-voyage-mesa.jpg' },
    ],
  },
  {
    id: 'tt_landmark', name: 'TimberTech AZEK Landmark', tier: 'Premium PVC', priceRange: '$18.80/sqft cost',
    costPerSqft: 18.80, isComposite: true, isHidden: false, // Carr Landmark $103.44/12'
    colors: [
      { name: 'French White Oak', swatch: 'tt-landmark-french-white-oak.jpg' },
      { name: 'Castle Gate', swatch: 'tt-landmark-castle-gate.jpg' },
      { name: 'American Walnut', swatch: 'tt-landmark-american-walnut.jpg' },
      { name: 'Boardwalk', swatch: 'tt-landmark-boardwalk.jpg' },
    ],
  },
  {
    id: 'tt_legacy', name: 'TimberTech PRO Legacy', tier: 'Premium Composite', priceRange: '$20.00/sqft cost',
    costPerSqft: 20.00, isComposite: true, isHidden: false, // Carr $110.04/12'
    colors: [
      { name: 'Ashwood', swatch: 'tt-legacy-ashwood.jpg' },
      { name: 'Pecan', swatch: 'tt-legacy-pecan.jpg' },
      { name: 'Tigerwood', swatch: 'tt-legacy-tigerwood.jpg' },
      { name: 'Mocha', swatch: 'tt-legacy-mocha.jpg' },
      { name: 'Espresso', swatch: 'tt-legacy-espresso.jpg' },
      { name: 'Whitewash Cedar', swatch: 'tt-legacy-whitewash-cedar.jpg' },
    ],
  },
  {
    id: 'tt_vintage', name: 'TimberTech AZEK Vintage', tier: 'Ultra-Premium PVC', priceRange: '$21.71/sqft cost',
    costPerSqft: 21.71, isComposite: true, isHidden: false, // Carr $119.40/12'
    colors: [
      { name: 'Coastline', swatch: 'tt-vintage-coastline.jpg' },
      { name: 'Mahogany', swatch: 'tt-vintage-mahogany.jpg' },
      { name: 'Weathered Teak', swatch: 'tt-vintage-weathered-teak.jpg' },
      { name: 'Cypress', swatch: 'tt-vintage-cypress.jpg' },
    ],
  },
];

export const WASTE_FACTORS: Record<BoardPattern, number> = {
  'Straight': 1.10,
  'Diagonal': 1.18,
  'Picture Frame': 1.22,
  'Herringbone': 1.25,
};

// Golden Maple fully-loaded crew day rate. The day rate already covers crew
// wages, burden, equipment, overhead AND profit — no separate waterfall applies.
// Editable per-device in Settings.
//
// 2026-07-27 — Yorkis set deck to $3,000/day all-in (was $3,700 target).
// NOTE: the July 2026 doctrine called $2,200/day break-even and $3,400 the
// bottom, so $3,000 is a DELIBERATE move below the old floor: ~$800/day gross
// vs ~$1,500/day at $3,700. Above break-even, but roughly half the margin.
export const CREW_DAY_RATES: Record<Municipality, number> = {
  'Toronto': 3700,
  'Barrie': 3700,
  'Simcoe County': 3700,
  'Burlington-Oakville': 3700,
  'Rural-Other': 3700,
};

export const PERMIT_FEES: Record<Municipality, number> = {
  'Toronto': 215,
  'Barrie': 225,
  'Simcoe County': 200,
  'Burlington-Oakville': 280,
  'Rural-Other': 175,
};

export const DEFAULT_ENGINEERING_FEE = 1500;

export const RAILING_COSTS: Record<Exclude<RailingType, 'None'>, { material: number, install: number, spacing: number, postCost: number }> = {
  'Wood Picket': { material: 35, install: 45, spacing: 6, postCost: 45 },
  'Aluminum': { material: 60, install: 55, spacing: 6, postCost: 95 },
  'Cable': { material: 90, install: 90, spacing: 4, postCost: 120 },
  'Glass Panels': { material: 160, install: 95, spacing: 3, postCost: 150 },
  'Trex Select': { material: 40, install: 55, spacing: 8, postCost: 95 },
  'Trex Transcend': { material: 75, install: 65, spacing: 8, postCost: 145 },
  'Fortress AL13': { material: 50, install: 55, spacing: 8, postCost: 110 },
  'TT Classic': { material: 65, install: 65, spacing: 8, postCost: 130 },
  'TT Impression': { material: 58, install: 55, spacing: 8, postCost: 105 },
};

export const STAIR_LABOR_MULTIPLIER = 1.25;

export const STAIR_TREAD_COSTS: Record<string, number> = {
  'pine': 24,
  'cedar': 40,
  'composite': 85,
};

export const LIGHTING_COSTS = {
  hub75: 295,
  hub150: 645,
  hub300: 995,
  hub50: 265,
  hub100: 315,
  smartHub150: 645,
  puck: 55,
  evo: 145,
  bollard: 85,
  connector: 14.50,
  wirePerFt: 2.50,
  smartMove: 125,
};

export const LABOR_RATES_2026 = {
  construction: {
    standardDeckingBase: 30,
    standardDeckingMax: 45,
    structuralTieIn: 850,
    specialtyFramingSingle: 15,
    specialtyFramingDouble: 25,
  },
  lighting: {
    transformerSetup: 150,
    smartTransformerSetup: 185,
    recessedInstall: 55,
    surfaceInstall: 65,
    bollardInstall: 75,
  }
};
