/**
 * Local rules that constrain where the yard-concept AI may place fire features, walls, raised patios,
 * seat walls, beds and steps in Barrie, Ontario. Researched 2026-10-05; brief in docs/deckcraft/design-trends-2026.md.
 * Approved by the owner on 2026-10-06, including the gas-first fire policy. `confirmed:false` values are conservative defaults: confirm with the
 * City of Barrie (or the named authority) before relying on them. Planning guidance only, not a permit review.
 * Dependency-free on purpose: it is bundled lazily.
 */

export const DESIGN_RULES_STATUS = 'approved' as 'draft' | 'approved';

export interface RuleSource { title: string; url: string; date?: string; section?: string }

const SRC = {
  openAirBylaw: { title: 'City of Barrie Open Air Fires By-law 2004-185 (consolidated, amended by 2007-208)', url: 'https://www.barrie.ca/Open-Air-Fires-Bylaw.pdf', section: 's. 3.1.1, 3.1.2, 3.1.8, 3.2.2, 6.1.1' },
  osfbaPage: { title: 'City of Barrie, Outdoor Solid Fuel Burning Appliances By-law 2007-210 (City summary page)', url: 'https://www.barrie.ca/government/policies-laws/laws-listing/outdoor-solid-fuel-burning-appliances-law', date: 'page updated 2015' },
  burnPermits: { title: 'City of Barrie, Burn Permits', url: 'https://www.barrie.ca/services-payments/permits-licences-applications/burn-permits' },
  hpcGas: { title: 'HPC Fire, Tech Talks: Gas Fire Pit Clearances', url: 'https://hpcfire.com/tech-talks-gas-fire-pit-clearances/', date: '2019-05-21' },
  tssa: { title: 'TSSA, Cautions Ontario Homeowners Against Hiring Fraudulent Fuels Workers (news release)', url: 'https://www.globenewswire.com/news-release/2023/03/01/2618464/0/en/TSSA-Cautions-Ontario-Homeowners-Against-Hiring-Fraudulent-Fuels-Workers.html', date: '2023-03-01' },
  deckSpecs: { title: 'City of Barrie Building Services, Deck Specs', url: 'https://www.barrie.ca/media/4040', date: 'Summer 2026', section: 'guard notes citing OBC 9.8.8.1.(1), 9.8.8.3, SB-7; stairs 9.8.4.2' },
  deckChecklist: { title: 'City of Barrie, Building Permit Application Checklist – Decks', url: 'https://www.barrie.ca/media/4041', date: '2025-08-26', section: 'Glossary: Guards and Railing; Conservation Authority' },
  obc9881: { title: 'Ontario Building Code Div. B 9.8.8.1 Required Guards (2012/2017 text as reproduced)', url: 'https://www.buildingcode.online/1337.html', section: '9.8.8.1.(1)(a),(b)' },
  retainingSheet: { title: 'City of Barrie Building Services Information Sheet, Retaining Walls', url: 'https://www.barrie.ca/media/12009', date: '2024-09' },
  cmhaSrw: { title: 'CMHA SRW-FAQ-001, Height restrictions for segmental retaining walls', url: 'https://www.cmha.org/resource/srw-faq-001/', date: 'rev. 2014' },
  versaLok7: { title: 'VERSA-LOK Technical Bulletin 7, Tiered Walls', url: 'https://www.versa-lok.com/assets/sites/versalok2016/uploads/assets/uploads/techbull7.pdf', date: '2019' },
  unilockSeatDetail: { title: 'Unilock, Estate Wall Raised Patio – Setback w/ Seat Wall (detail)', url: 'https://contractor.unilock.com/wp-content/uploads/2021/09/Detail_Estate-Wall_Raised-Patio-with-Seat-Wall_Setback.pdf' },
  abaBench: { title: 'U.S. Access Board, ADA/ABA Standards Ch. 9, 903 Benches', url: 'https://www.access-board.gov/aba/chapter/ch09/', section: '903.3, 903.5' },
  hardscapeIndex: { title: 'DeckCraft hardscape-index.json (stocked copings 300–500 mm deep)', url: 'src/data/hardscape-index.json', date: '2026-09-27' },
  ugaBeds: { title: 'UGA Extension C1027-4, Raised Garden Bed Dimensions', url: 'https://fieldreport.caes.uga.edu/publications/C1027-4/', date: '2022-12-14' },
  zoning: { title: 'City of Barrie Comprehensive Zoning By-law 2009-141, office consolidation July 31, 2026', url: 'https://www.barrie.ca/media/1498', date: '2026-07-31', section: '5.3.5, 5.3.5.2 (Decks), 5.3.5.4 (Fences), 4.9.1.1; accessory-structure Exemptions; definition of Landscaped Open Space' },
  zoningDraft: { title: 'Building Barrie, new draft Zoning By-law (Draft 3, timeline changed Nov 13, 2025)', url: 'https://www.buildingbarrie.ca/zoning' },
  lsrcaPermit: { title: 'LSRCA, Do I need a permit (O. Reg. 41/24, effective April 1, 2024)', url: 'https://lsrca.on.ca/index.php/planning-permits/do-i-need-a-permit/' },
} satisfies Record<string, RuleSource>;

/** Fire features. Distances are from the fire. */
export const FIRE_CLEARANCE = {
  /** Approved enclosed wood appliance (OSFBA: non-combustible, enclosed on all sides, spark arrestor on every vent): 4 m from any dwelling or structure. */
  woodFt: 13.1,
  woodFromCombustiblesFt: 6.6,          // 2 m
  woodFromOverhangingVegetationFt: 9.8, // 3 m
  woodFromWoodlandFt: 16.4,             // 5 m
  /** Any open wood fire that is not an approved OSFBA (an open stone pit): daily open-air permit, daylight only, 15 m from any dwelling, structure or combustible. */
  openWoodFireFt: 49.2,
  /** Gas table or bowl to any combustible. Conservative default: 48 in. HPC: 36 in up to 200k BTU, 48 in for 201–400k BTU. The unit's own manual governs. */
  gasFt: 4,
  /** HPC: 84 in clear overhead and at least 2 open walls (up to 200k BTU); no overhead structure above 200k BTU. Default: keep gas fire out from under roofs and pergolas. */
  gasOverheadMinIn: 84,
  /** No property-line distance is stated. Conservative default: treat a neighbour's fence or shed as a structure, so 4 m (wood) from the line. */
  fromPropertyLineFt: 13.1,
  confirmed: false,
  confirmedValues: { woodFt: true, openWoodFireFt: true, gasFt: false, gasOverheadMinIn: false, fromPropertyLineFt: false },
  note: 'Wood: OSFBA permit $24/calendar year, burning 8 am to midnight, dry clean wood only; zero tolerance on complaint. Gas: Barrie requires no burn permit for propane fire tables; gas piping and hook-up only by a TSSA-registered contractor with a certified gas technician. Property-line distance and gas clearances: confirm with the City of Barrie (Barrie Fire, fire.prevention@barrie.ca) and the unit manual. Whether a screened fire bowl qualifies as an approved OSFBA is not confirmed.',
  sources: [SRC.osfbaPage, SRC.openAirBylaw, SRC.burnPermits, SRC.hpcGas, SRC.tssa] as RuleSource[],
} as const;

/** OBC 9.8.8.1.(1): a guard is required where a walking surface is more than 600 mm above the adjacent surface within 1.2 m. */
export const GUARD_REQUIRED_ABOVE_IN = 23.6;

export const GUARD = {
  requiredAboveIn: GUARD_REQUIRED_ABOVE_IN,
  /** Also required where the adjacent surface within 1.2 m (47 in) slopes steeper than 1 in 2. */
  adjacentWithinIn: 47.2,
  adjacentSlopeTrigger: 0.5,
  /** Barrie Deck Specs: 36 in where the walking surface is 5'-11" (1.8 m) or less above grade, 42 in above. */
  heightIn: 36,
  heightAbove71InIn: 42,
  maxOpeningIn: 4,
  /** No climbable member between 5.5 in and 36 in. */
  noClimbZoneIn: [5.5, 36] as const,
  confirmed: true,
  note: 'Applies to raised patios and landings as walking surfaces, not only decks. A retaining wall forming part of an elevated walkway needs a guard above 600 mm (Barrie, Retaining Walls sheet). A seat wall at the edge of a raised patio does not replace the guard; Unilock notes such a seat wall may require a railing.',
  sources: [SRC.deckSpecs, SRC.deckChecklist, SRC.obc9881, SRC.retainingSheet, SRC.unilockSeatDetail] as RuleSource[],
} as const;

/** Retaining walls. Height = finished grade at the base to top of wall, excluding the guard. */
export const RETAINING_WALL = {
  /** Building permit above 1,000 mm exposed height when "adjacent to" (horizontal distance <= wall height) public property, access to a building, or private property the public is admitted to (front or side yard on the way to the main entrance). */
  permitAboveIn: 39.4,
  /** A wall in the permit scope needs a P.Eng design (OBC Part 4) for wall and guard. */
  engineerAboveIn: 39.4,
  /** Conservative default for every other wall, including rear-yard walls outside the permit scope, or any wall with a surcharge (patio, driveway, upper tier). */
  engineerRecommendedAboveIn: 36,
  /** Guard on a permit-scope wall: above 600 mm where the wall is part of an elevated walkway, above 1.0 m elsewhere, where the public can reach the top. */
  guardAboveInWalkway: 23.6,
  guardAboveInOther: 39.4,
  /** Zoning 4.9.1.1: no retaining wall within 0.3 m of a lot line abutting a street. */
  minFromStreetLotLineFt: 1.0,
  confirmed: true,
  confirmedValues: { permitAboveIn: true, engineerAboveIn: true, engineerRecommendedAboveIn: false },
  note: 'Unreinforced segmental walls are typically buildable to 3–4 ft, less with poor soil or surcharge (CMHA). The 36 in recommendation is a DeckCraft default, not a Barrie rule.',
  sources: [SRC.retainingSheet, SRC.cmhaSrw, SRC.versaLok7, SRC.zoning] as RuleSource[],
} as const;

/** Terraces (tiered walls). */
export const TERRACE_WALL = {
  maxHeightInWithoutEngineer: 36,
  /** Upper wall set back at least 2x the lower wall's height (D >= 2H) with a level bench between, or the walls load each other. */
  minSeparationRatio: 2,
  /** Overall grade change across the tiers no steeper than 2H:1V without a global-stability review. */
  maxOverallSlopeRiseOverRun: 0.5,
  confirmed: false,
  note: 'Industry guidance (VERSA-LOK, CMHA), not a Barrie rule: even short tiers under 4 ft may need geogrid and engineering when D < 2H. Cost order: one wall lowest, one short wall in front of a taller wall medium, multiple tiers highest. Confirm with the City of Barrie where any tier is in the permit scope.',
  sources: [SRC.versaLok7, SRC.cmhaSrw, SRC.retainingSheet] as RuleSource[],
} as const;

/** Seat walls: design guidance, not a code value. */
export const SEAT_WALL = {
  /** Finished height to the top of the coping. */
  heightIn: [18, 20] as const,
  capDepthIn: [12, 16] as const,
  /** Accessible bench seat height for reference (ADA/ABA 903.5): 17–19 in; bench depth 20–24 in (903.3). */
  accessibleSeatHeightIn: [17, 19] as const,
  /** Zoning 5.3.5.4 a): any fence, wall or hedge in a front yard max 1 m above grade. */
  frontYardMaxIn: 39.4,
  basis: 'design-guidance' as const,
  note: 'Stocked copings run 300–500 mm (12–20 in) deep. At a raised-patio edge with more than 600 mm drop, the guard rule still applies.',
  sources: [SRC.abaBench, SRC.unilockSeatDetail, SRC.hardscapeIndex, SRC.zoning] as RuleSource[],
} as const;

/** Raised beds. */
export const RAISED_BED = {
  heightIn: [12, 30] as const,
  minSoilDepthIn: 10,
  wheelchairHeightIn: 24,
  standingNoBendHeightIn: 36,
  maxWidthIn: 48,
  maxWidthWheelchairIn: 36,
  pathWidthIn: [18, 24] as const,
  wheelchairPathIn: 48,
  basis: 'design-guidance' as const,
  note: 'The 12–30 in band is a DeckCraft default; UGA gives 36 in for no-bend standing beds. A bed wall that retains a slope is a retaining wall for the rules above.',
  sources: [SRC.ugaBeds] as RuleSource[],
} as const;

/** Steps serving the house (OBC 9.8.4.2 private stairs as printed by Barrie). Use as the default for garden steps too. */
export const STONE_STEPS = {
  riseIn: [4.875, 7.875] as const,   // 125–200 mm
  runIn: [10.0625, 14] as const,     // 255–355 mm
  handrailAboveRisers: 3,
  confirmed: true,
  note: 'Confirmed for stairs serving a dwelling; applying it to free-standing garden steps is a conservative DeckCraft default.',
  sources: [SRC.deckSpecs] as RuleSource[],
} as const;

/** Setbacks from lot lines, residential zones, Zoning By-law 2009-141. */
export const ZONING_SETBACKS = {
  deckMinFt: { interiorSide: 2.0, exteriorSide: 4.9, rear: 2.0, front: 9.8 }, // 0.6 / 1.5 / 0.6 / 3 m
  accessoryStructure: { rearFt: 2.0, sideFt: 2.0, exteriorSideCornerFt: 9.8, frontLotLineFt: 23.0, maxHeightFt: 13.1, maxCoveragePct: 10, allowedInFrontYard: false },
  frontYardWallMaxIn: 39.4,
  retainingWallFromStreetLotLineFt: 1.0,
  /** "Required retaining walls" are permitted in any yard and exempt from zone height and setback rules (still subject to 4.9.1.1). */
  requiredRetainingWallsExempt: true,
  confirmed: true,
  note: 'Patios, walkways and retaining walls are listed in the definition of landscaped open space. Whether a raised patio, fire-table island or seat wall counts as an accessory "structure" (0.6 m setback, 4 m height, 10% coverage) is not confirmed: confirm with the City of Barrie. A new comprehensive zoning by-law is in draft (Draft 3); re-check when adopted. Corner lots, special provisions and non-residential zones differ.',
  sources: [SRC.zoning, SRC.zoningDraft] as RuleSource[],
} as const;

/** Conservation authority approvals. DeckCraft does not know whether a lot is regulated: ask, or flag it. */
export const CONSERVATION_AUTHORITY = {
  regulation: 'O. Reg. 41/24',
  authorities: ['Lake Simcoe Region Conservation Authority (LSRCA)', 'Nottawasaga Valley Conservation Authority (NVCA)'] as const,
  triggers: ['building or placing a structure', 'site grading', 'placing, dumping or removing fill'] as const,
  confirmed: true,
  note: 'Applies only inside a regulated area (near watercourses, wetlands, shorelines, steep slopes, flood or erosion hazards). Check the LSRCA regulation map before terracing or filling.',
  sources: [SRC.lsrcaPermit, SRC.deckChecklist] as RuleSource[],
} as const;

/** Frost protection depth for footings (pergola posts, fire-table footings on piers). */
export const FROST_DEPTH_IN = 48;
