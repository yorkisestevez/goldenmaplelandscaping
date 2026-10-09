import {sourcedDeckingSqft} from './supplierRates';
/** Private job-specific additions. Supply follows material markup; installation follows labour treatment. */
export interface QuoteResolution {scopeKey:string;fingerprint:string;supplyCost:number;installationCost:number;confirmedOn:string;source:string;note:string;additionalScope:true}
import type {PergolaQuoteContext} from './pergolaPricing';
import type {PergolaSelection} from './pergolaCatalog';
import type {FeatureLabourSettings} from './featureLabour';
export type DeckType = 'Attached' | 'Freestanding' | 'Floating' | 'Add-on';
export type Municipality = 'Toronto' | 'Barrie' | 'Simcoe County' | 'Burlington-Oakville' | 'Rural-Other';
export type SiteType = 'Standard' | 'Waterfront-Lakefront' | 'Hillside' | 'Urban Tight' | 'Island-Ferry';
export type SoilCondition = 'Unknown' | 'Sandy' | 'Clay' | 'Shallow Bedrock' | 'Fill';
export type BuildSeason = 'Spring-Summer' | 'Fall' | 'Winter';
export type IntendedLoad = 'Standard' | 'Heavy';
export type DeckShape = 'Rectangle' | 'L-Shape' | 'Multi-corner' | 'Curved' | 'Custom';
/** A point of a custom outline's front, in feet (see lib/customOutline.ts). */
export interface OutlinePoint {x:number;y:number}
/** Physical board edits, level-local inches. Ordering is significant: the last overlapping edit wins. */
export interface BoardLayoutPoint {x:number;y:number}
interface BoardLayoutEntry {id:string;level:1|2|3;colour?:ColourRef}
export interface BoardLayoutRegion extends BoardLayoutEntry {polygon:BoardLayoutPoint[];angleDeg:number;/** Replace a selected picture-frame board with field decking instead of leaving a hole. */replaceBorder?:true}
export interface BoardLayoutBreaker extends BoardLayoutEntry {start:BoardLayoutPoint;end:BoardLayoutPoint;widthIn?:number}
export interface BoardLayoutPiece extends BoardLayoutEntry {
  cx:number;cy:number;lengthIn:number;widthIn:number;angleDeg:number;
  /** An existing cut silhouette, before the target rotation, in level-local inches. When supplied, sourceAngleDeg
   * describes its source stock direction; angleDeg rotates it physically around cx/cy. Move both together. */
  polygon?:BoardLayoutPoint[];sourceAngleDeg?:number;
}
export interface BoardLayoutConfig {regions:BoardLayoutRegion[];breakers:BoardLayoutBreaker[];pieces:BoardLayoutPiece[]}
/** A real product colour, `${collectionId}:${colourName}` from DECKING_CATALOGUE (see boardFinishes.ts). */
export type ColourRef = string;
/** Deck boards in another real product colour: one board ('piece') or its whole row ('course'), found by the
 * board address in lib/boardAddress.ts. An address that no longer meets a board is kept but not applied. */
export interface BoardColour {lv:1|2|3;role:'field'|'border'|'breaker';scope:'piece'|'course';course:string;at?:number;colour:ColourRef}
/** How the boards inside a framed inlay run: across (Straight, front to back), at 45°, or in a herringbone. */
export type InlayFill = 'Straight' | 'Diagonal' | 'Herringbone';
/** A decorative inlay set into the decking (see lib/inlayGeometry.ts). A colour left out is the deck's own.
 * Absent on every existing design.
 * - 'rug' (a framed rectangle) or 'diamond' (a framed square turned 45°): centred dxFt/dyFt from the middle of its
 *   deck level (+x right, +y toward the yard), with 1 or 2 frame rows and an inside pattern.
 * - 'band': 1 to 4 boards across the whole field, running across the deck (parallel to the house) or front to
 *   back ('along' the joists); atFt moves its middle from the level's middle (toward the yard, or to the right).
 * - 'medallion': a round (16-sided) inlay with a one-row frame; inside, boards front to back ('round') or eight
 *   wedges in alternating inside and frame colours ('compass'). */
interface InlayBase {id:string;level?:1|2|3;fill?:ColourRef}
export type DeckInlay =
  | InlayBase&{kind:'rug'|'diamond';dxFt?:number;dyFt?:number;rotationDeg?:number;widthFt:number;depthFt:number;frameRows?:1|2;pattern?:InlayFill;frame?:ColourRef}
  | InlayBase&{kind:'band';direction:'across'|'along';atFt?:number;boards:1|2|3|4}
  | InlayBase&{kind:'medallion';dxFt?:number;dyFt?:number;rotationDeg?:number;diameterFt:number;style:'round'|'compass'|'compass-rose'|'sunburst';frame?:ColourRef}
  /** Simple polygon, level-local inch offsets around the inlay origin. */
  | InlayBase&{kind:'custom';points:OutlinePoint[];dxFt?:number;dyFt?:number;rotationDeg?:number;name?:string;frameRows?:1|2;pattern?:InlayFill;frame?:ColourRef};
/** Skirting under the deck (see skirting.ts): boards or lattice closing in the space between the deck's rim and the
 * ground, clearanceIn above it. A colour left out is the deck's own; `openEdges` names deck sides left open
 * ('deck1-front', 'landing1-left', …). Absent on every existing design. Priced from the skirting rate table. */
export type SkirtingStyle = 'Horizontal boards' | 'Vertical boards' | 'Lattice';
export interface SkirtingConfig {style:SkirtingStyle;colour?:ColourRef;clearanceIn:number;openEdges?:string[];accessPanels?:number;cornerTreatment?:'Folded solid boards'}
/** Deck parts in their own real product colour (see deckPartFinishes.ts): the border boards, the fascia over the rim,
 * the stair treads and risers, each from a collection of the deck's own kind; and the railing in one of its system's
 * manufacturer colours (a colour name from railing-finish-provenance.json). A part left out is the deck's own colour.
 * Absent on every existing design. */
export interface DeckFinishes {fascia?:ColourRef;treads?:ColourRef;risers?:ColourRef;border?:ColourRef;railingColor?:string}
export type BoardPattern = 'Straight' | 'Diagonal' | 'Picture Frame' | 'Herringbone';
export type RailingType = 'None' | 'Wood Picket' | 'Aluminum' | 'Cable' | 'Glass Panels' | 'Frameless Glass' | 'Trex Select' | 'Trex Transcend' | 'Fortress AL13' | 'TT Classic' | 'TT Impression';
/** Perimeter guard override, measured along an actual polygon edge from its first endpoint. */
export interface RailSection {id:string;level:1|2|3;edgeId:string;startPct:number;endPct:number;enabled:boolean}
/** How a frameless glass railing holds its panels (framelessGlass.ts). */
export type GlassMount = 'Top-mount base shoe' | 'Fascia-mount base shoe' | 'Spigots';
/** A frameless glass railing's shoe, spigots and handrail: black powder coat, or clear anodized / 316 stainless. */
export type GlassFinish = 'Black' | 'Silver';
export type StairType = 'Straight' | 'Winder' | 'Landing';
export type LightingZone = 'deck'|'posts'|'stairs'|'landscape'|'house'|'privacy'|'border';
/** A single freestanding screen on one exposed deck edge; priced by its face area. */
export type PrivacyProductId='slatted'|'hideaway'|'oasis';
export interface PrivacyScreen {id:string;side:'Left'|'Right'|'Front'|'Back';lengthFt:number;heightFt:4|5|6;offsetPct:number;lights:boolean;
  /** An exact polygon edge; absent keeps the original main-deck side placement and clearances. */
  level?:1|2|3;edgeId?:string;
  /** Undefined = on. An off screen stays in the design but is not drawn, lit or priced. */
  enabled?:boolean;
  /** Undefined = Golden Maple slatted screen. Manufacturer screens are supplier-quote items. */
  product?:PrivacyProductId;design?:string;finish?:'Black'|'White';
  /** Manufacturer screens only: stock panel count; length follows the panels. */
  panels?:number}
export type GarageDoorStyle='Panel'|'Carriage'|'Flush'|'Glass';
/** Door looks. Absent = the studio's original glass-panel door. */
export type DoorStyle='Single'|'French'|'Sliding';
/** Window looks. Absent = the studio's original window (glass with a centre rail). */
export type WindowStyle='Double-hung'|'Casement'|'Picture'|'Slider'|'Awning';
/** House wall finishes, generic types rather than manufacturer products (appearance only, never priced). */
export type HouseCladding='Brick'|'Siding'|'Stone'|'Stucco'|'Board & batten'|'Vertical siding'|'Fibre-cement lap'|'Cedar shakes'|'Ledgestone'|'Fieldstone'|'Norman brick'|'Roman brick'|'Horizontal metal';
/** Roof finishes (appearance only). 'Shingles' (3-tab) and 'Metal' (standing seam) are the studio's originals. */
export type RoofFinish='Shingles'|'Metal'|'Architectural shingles'|'Cedar shakes'|'Slate'|'Clay tile'|'Concrete tile';
export interface HouseOpening {id:string;type:'Door'|'Window'|'Garage';facade:'Front'|'Back'|'Left'|'Right';offsetPct:number;bottomIn:number;widthIn:number;heightIn:number;
  /** Wall the opening sits on, '<block id>-<front|back|left|right>' (e.g. 'garage1-back'). Absent = the
   * main block's wall named by `facade`, as older designs have it. */
  wallId?:string;
  /** Appearance only, never priced: a garage door style on 'Garage' openings, a door style on 'Door'
   * openings, a window style on 'Window' openings. */
  style?:GarageDoorStyle|DoorStyle|WindowStyle;
  /** Appearance only: this opening's own colour (a door's slab, a window's frame, a garage door's face). Absent =
   * the house's door, window or garage-door colour, else the studio's original colours. */
  color?:string}
/** A block attached to one wall of the main house rectangle: a bump-out, an L-wing or a garage. */
export interface HouseBlock {id:string;kind:'house'|'garage';
  /** Main-block wall it is attached to ('Front' faces the deck). */
  wall:'Front'|'Back'|'Left'|'Right';
  /** Front/Back walls: plan +x from the main block's left corner. Left/Right walls: back from the deck-facing wall. */
  offsetFt:number;
  /** Along the wall it is attached to. */
  widthFt:number;
  /** Out from that wall. */
  depthFt:number;
  storeys?:1|2|3;floorHeightIn?:number;roofShape?:'Gable'|'Hip'|'Flat';
  /** Appearance only: this block's own wall finish. Absent = the whole house's. */
  finish?:HouseFinish}
/** A band of a second cladding along the bottom of a wall, under a trim cap (appearance only). */
export interface Wainscot {cladding:HouseCladding;color:string;
  /** Top of the band above grade, 12–72 in. */
  heightIn:number}
/** A different cladding on a gable triangle, such as shakes in the gable over siding (appearance only). */
export interface GableAccent {cladding:HouseCladding;color:string}
/**
 * How a wall (or a block, or the whole house) is finished, appearance only and never priced. A wall resolves
 * its own finish first, then its block's, then the whole house's (houseFinishes.ts `houseFinishFor`).
 */
export interface HouseFinish {cladding:HouseCladding;color:string;wainscot?:Wainscot;
  /** The gable triangle above the wall. Absent = the wall's own cladding carries on into the gable. */
  gable?:GableAccent}
export interface HouseConfig {widthFt:number;depthFt:number;storeys:1|2|3;storeyHeightIn:number;roofShape:'Gable'|'Hip'|'Flat';roofFinish:RoofFinish;roofColor:string;cladding:HouseCladding;claddingColor:string;trimColor:string;openings:HouseOpening[];
  /** Finished floor / door-sill height above grade. When set, the deck is checked against it. */
  floorHeightIn?:number;
  /** Blocks attached to the main rectangle. Absent or empty = a plain rectangular house. */
  footprint?:{rects:HouseBlock[]};
  /** Roof pitch, inches of rise per 12 of run (3–12). Absent = the studio's original roof height. Appearance only. */
  roofPitch?:number;
  /** Main gable ridge: 'y' runs front to back (gables face the deck and the street, the original look);
   * 'x' runs side to side (gables on the side walls). Appearance only. */
  ridge?:'x'|'y';
  /** Exterior colours (appearance only, six-digit hex). Fascia (the rake boards), soffit and gutters follow
   * trimColor when absent; doors, windows and garage doors keep the studio's original colours when absent. */
  fasciaColor?:string;soffitColor?:string;gutterColor?:string;doorColor?:string;windowColor?:string;garageDoorColor?:string;
  /** Walls with their own finish, by wall id ('<block id>-<front|back|left|right>', 'main-front' faces the deck):
   * at most 28 (seven blocks of four walls); a key for a block that no longer exists is dropped on load and edit. */
  wallFinishes?:Record<string,HouseFinish>;
  /** A wainscot band on every wall that follows the whole house. */
  wainscot?:Wainscot;
  /** An accent on the gables of every wall that follows the whole house. */
  gableAccent?:GableAccent}
/** Where the house sits along the deck's back line. Absent = centred on the deck (the original behaviour). */
export interface HousePlacement {anchor:'left'|'center'|'right';offsetIn:number}
/** One side wing of a wrap-around deck: how far it reaches out from the house side wall, and how
 * far it runs back along that wall from the deck-facing wall. */
export interface WrapWing {widthFt:number;runFt:number}
/** Wrap-around deck: side wings around one or both house corners. Current rules keep one board direction across the front and turn beside the house; a legacy save keeps a corner-to-corner hip. */
/** A porch wrap: the deck continues around a far house corner along the street-side wall. */
export interface WrapPorch {depthFt:number;runFt:number}
export interface WrapConfig {left?:WrapWing;right?:WrapWing;
  /** Needs the left wing, which then runs the full house depth. */
  porchLeft?:WrapPorch;
  /** Needs the right wing, which then runs the full house depth. */
  porchRight?:WrapPorch}
/** 45° angled FRONT corners of the main deck (away from the house): each leg in feet, cut back equally
 * along the front and the side edge. A missing corner is square. Rectangles only (see lib/cornerChamfers.ts). */
export interface CornerChamfers {frontLeftFt?:number;frontRightFt?:number}
/** A third deck section, joined to the main deck (parent 1) or the second level (parent 2). */
export interface Level3Config {widthFt:number;lengthFt:number;heightIn:number;parent:1|2;position:'Front'|'Left'|'Right';offsetPct:number;
  /** Named wrap edge of the main deck (parent 1 only), e.g. 'wingR-end'; overrides position. */
  edgeId?:string;
  /** The connecting step or stair runs the full shared edge (a split level). */
  fullStep?:boolean}
/** 'fire-feature': a fire pit or table (fireFeatures.ts); widthFt/depthFt are its body (round: depth = width),
 * heightIn its body height, productId a FIRE_PRODUCTS id, color its stone. */
export type YardFeatureKind='patio'|'retaining-wall'|'water-feature'|'fire-feature';
export interface YardHardscape {finishId:string;colorId:string;unitId:string;patternId:string;angleDeg:number;jointMm:number;capUnitId?:string}
/** Decorative paving zones, centre-relative patio-local inches before patio rotation. */
export interface PatioInlay {id:string;name:string;shape:'rectangle'|'diamond'|'circle'|'compass'|'band'|'custom';xIn:number;yIn:number;widthIn:number;depthIn:number;rotationDeg:number;points?:{x:number;y:number}[];productId:string;color:string;hardscape?:YardHardscape}
export interface YardFeature {id:string;kind:YardFeatureKind;name:string;enabled:boolean;xFt:number;zFt:number;widthFt:number;depthFt:number;heightIn:number;rotationDeg:number;productId:string;color:string;
  /** Fire features only: the id of the patio it stands on. It sits on that patio's top when its footprint is wholly on
   * the patio; otherwise (or when the patio is gone or excluded) it stands on its own 4 in gravel pad at grade, with a
   * note. Absent: on its own pad. */
  supportFeatureId?:string;
  /** Explicit, fixed-level solid-stone stair flight. Stock and support inputs stay recorded. */
  stoneSteps?:import('./stoneSteps').StoneSteps;
  stepAssembly?:import('./stepAssembly').StepAssembly;
  /** Opt-in finish connection: working/reinforcement space may receive paving after construction. */
  pavingInterface?:{jointIn:number;supportNote?:string};
  /** Fixed top at the feature centre in the project datum. Absent preserves legacy grade-following. */
  finishedElevationIn?:number;
  /** Rise percentages in patio-local across/out axes; rotates with the patio. */
  patioSlope?:{xPct:number;zPct:number};
  /** Ground fit (patios with a fixed finishedElevationIn on measured ground): the ground round the patio is graded to
   * its edge, daylighting into the measured ground at `slopeRatio` run per unit of rise. Absent leaves the ground as
   * it is (saved designs are unchanged). Patios only; requires finishedElevationIn (validateYardFinishedSettings rejects
   * it otherwise) and is inert while the patio is disabled or carries steps. New patios on measured ground get the default
   * via yardSettings fitNewPatio; edits go through yardFinishedEdits {action:'groundFit'}. */
  groundFit?:PatioGroundFit;
  /** Each station begins a new horizontal cap-top run, measured on the exact path. */
  wallTopSteps?:{stationIn:number;elevationIn:number}[];
  /** Exact circular segments over the saved control points; meshes are derived. */
  curves?:import('./circularArcs').CircularArc[];
  /** Wall front-grade datum relative to local terrain, inches. Absent means zero. */
  baseElevationIn?:number;
  /** Reinforcement budgeting inputs; these never certify a structural design. */
  wallConstruction?:import('./wallConstruction').WallConstruction;
  /** Patio perimeter in local inches about the feature centre, before rotation. */
  outline?:{x:number;y:number}[];
  /** Open retaining-wall centreline in local inches; widthFt is its total run. */
  wallPath?:{x:number;y:number}[];
  /** A documented supplier variant. Absent preserves the original yard defaults. */
  hardscape?:YardHardscape;
  inlays?:PatioInlay[];
  /** A walkway's centreline, kept so it can be edited again. The outline is derived from it and stays authoritative. */
  pathSpine?:YardPathSpine;
}
/** How the ground meets a patio: graded banks at this run:rise (3 = 3 ft out per 1 ft of height). */
export interface PatioGroundFit {slopeRatio:number;
 /** 'stone': where the patio stands above the ground, a stone edge course holds its raised side instead of a fill bank
  * (the ground there is left as it is; cut banks still grade the high side). Absent = banks all round. */
 lowEdge?:'stone'}
export const GROUND_FIT_LIMITS={minRatio:1.5,maxRatio:10,defaultRatio:3,maxBankRunIn:240} as const;
/** Walkway centreline in the patio's local inches: control points and exact arcs, with the paved width and end shape. */
export interface YardPathSpine {points:{x:number;y:number}[];curves?:import('./circularArcs').CircularArc[];widthIn:number;ends:'square'|'round'}
export interface TerrainConfig {widthFt:number;depthFt:number;elevationIn:number;slopePct:number}
/** Backyard items priced at the site cost estimator's allowances. Not drawn in 3D: placed and confirmed at the site visit. */
export interface YardAllowances {finish:'budget'|'mid'|'premium';firePit:'none'|'wood'|'gas';kitchen:'none'|'basic'|'full';turfSqft:number;lighting:boolean}
export type CompassPoint='N'|'NE'|'E'|'SE'|'S'|'SW'|'W'|'NW';
/** The lot for the permit set's site plan (drawings/sitePlan.ts), in feet as a plan of survey gives it: a rectangular
 * lot square to the house. Left and right are as seen from the yard, like every other side in the designer. */
export interface PermitSite {
  /** Along the house: the frontage of an interior lot. */
  lotWidthFt:number;
  /** From the front (street) lot line to the rear lot line. */
  lotDepthFt:number;
  /** From the left lot line to the house's left-most wall. */
  leftYardFt:number;
  /** From the wall the deck is on to the rear lot line. */
  rearYardFt:number;
  /** Which way the back yard faces, for the north arrow. Absent draws no arrow. */
  yardFaces?:CompassPoint;
  /** A corner lot: a second street along this side. */
  corner?:'left'|'right';
}

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

/** Optional under-deck work. Absent keeps existing designs off, except the legacy hasDrainage switch. */
export interface UnderDeckConfig {drainage:'none'|'rainescape'|'dryspace'|'zipup';ceiling:'none'|'aluminum'|'pvc'|'cedar';scope:'main'|'all';gravel:boolean;gravelDepthIn:number;floorMesh:boolean}
/** Saved local edge vector; both endpoints may translate together, but length and direction stay measured. */
export interface BoundaryEdgeLock {level:1|2|3;edge:number;dxIn:number;dyIn:number}
export interface DeckData {
  stairTargets?:import('./stairTargets').StairTarget[];
  siteModel?:import('./siteModel').SiteModel;
  landscapeObjects?:import('./landscapeTypes').LandscapeObject[];
  pools?:import('./poolTypes').PoolFeature[];
  poolQuoteInputs?:import('./poolQuoteTypes').PoolQuoteInputs;
  editorOrganization?:import('./editorOrganization').EditorOrganization;
  railSections?:RailSection[];
  /** Absent = guard every eligible perimeter and stair edge. False = explicit enabled perimeter sections only. */
  railDefault?:boolean;
  boundaryLocks?:BoundaryEdgeLock[];
  /** Physical directions, finite breaker segments and individual stock-piece edits; absent preserves old layouts. */
  boardLayout?:BoardLayoutConfig;
  /** Freely edited complete deck boundaries, local feet; absent preserves every legacy shape. */
  deckOutlines?: {main?:OutlinePoint[];second?:OutlinePoint[];third?:OutlinePoint[]};
  /** Fixed world origin of an edited lower level, feet. */
  deckOutlineOffsets?: {second?:OutlinePoint;third?:OutlinePoint};
  underDeck?: UnderDeckConfig;
  yardFeatures?: YardFeature[];
  yardEarthwork?:import('./yardEarthwork').YardEarthwork;
  terrainConfig?: TerrainConfig;
  yardAllowances?: YardAllowances;
  /** The lot, for the permit set's site plan; absent on every existing design. */
  permitSite?: PermitSite;
  houseConfig?: HouseConfig;
  housePlacement?: HousePlacement;
  wrap?: WrapConfig;
  /** Absent means square corners; never set in DEFAULT_DECK so every existing design is unchanged. */
  cornerChamfers?: CornerChamfers;
  /** A custom outline's front, right side to left side, in feet (shape 'Custom' only; see lib/customOutline.ts). */
  customFront?: OutlinePoint[];
  /** Accent-colour boards; absent on every existing design (see boardFinishes.ts). */
  boardColours?: BoardColour[];
  /** Decorative inlays with their own framing; absent on every existing design (see lib/inlayGeometry.ts). */
  inlays?: DeckInlay[];
  /** Skirting under the deck; absent on every existing design (see skirting.ts). */
  skirting?: SkirtingConfig;
  /** Deck-part finishes and the railing colour; absent on every existing design (see deckPartFinishes.ts). */
  deckFinishes?: DeckFinishes;
  /** A named exposed edge (e.g. 'wingR-end') for the primary stair flight; overrides stairPosition. */
  stairEdgeId?: string;
  /** Open stair attachment path, in local inches on the lowest deck perimeter. */
  stairPath?: {points:{x:number;y:number}[]};
  /** Grade-flight riser count; absent means derive uniform rises from the deck elevation. */
  stairRiserCount?: number;
  /** Grade-flight going in inches; absent keeps the selected product's tread layout. */
  stairTreadDepthIn?: number;
  /** Named wrap edge of the main deck for the second level; overrides level2Position. */
  level2EdgeId?: string;
  /** The step or stair between the main deck and the second level runs their full shared edge. */
  level2FullStep?: boolean;
  level3?: Level3Config;
  lightingZoneEnabled?: Partial<Record<LightingZone,boolean>>;
  lightingPreviewOn?: boolean;
  catalogueRailingId?: string;
  /** A frameless glass railing's mount and hardware finish; absent unless railingType is 'Frameless Glass'. */
  glassMount?: GlassMount;
  glassFinish?: GlassFinish;
  catalogueAccessories?: string[];
  borderFinish?: 'Matching'|'Dark Slate';
  pictureFrameOverhangIn?: number;
  /** Takeoff rules: absent or 'legacy' for designs saved before 2026-10-06, '2026-10' for the takeoff after that, '2026-10-struct' for a new design (see buildRules.ts). */
  buildRules?: import('./buildRules').BuildRules;
  houseVisible?: boolean;
  houseWallHeightIn?: number;
  houseDoorOffset?: number;
  houseDoorWidthIn?: number;
  sceneLighting?: 'Daylight' | 'Evening';
  scenePresentation?:import('./scenePresentation').ScenePresentation;
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
  /** Joist species. Absent means S-P-F No. 1/No. 2, which is what every saved design was sized with. */
  framingSpecies?: 'SPF' | 'Hem-Fir' | 'D.Fir-L';
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
  autoLighting?: {posts?:boolean;stairs?:boolean;border?:boolean;stairStyle?:'evo_hyde'|'evo_flex'};
  benchLf: number;
  /** Priced privacy area. Derived from privacyScreens whenever screens are present. */
  privacySqft: number;
  privacyScreens?: PrivacyScreen[];
  hasDrainage: boolean;
  hasDemo: boolean;
  pergola?:PergolaSelection;
  pergolaSqft: number;
  
  // Add-on specific
  addOnTransitionLabor?: number;
  addOnHardwareCost?: number;
  addOnFlashingLf?: number;

  // Contractor overrides
  customLaborCost?: number;
  quoteResolutions?: QuoteResolution[];
  /** Private revision snapshot; excluded by public serializers and agent context. */
  pergolaQuoteCosts?: PergolaQuoteContext;
  materialMarkup?: number;
  customOverrides?: Record<string, { qty?: number; cost?: number }>;
  /** Private per-job inlay/special-feature labour (man-hours + materials). Stripped from public share/JSON. */
  featureLabour?: FeatureLabourSettings;

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
// costPerSqft is the purchasing basis before contractor markup. Unchanged lines
// retain Carr's archived 2025 trade rates; cedar remains an allowance. Terrain and
// Reserve use dated representative retail SKUs in supplierRates.ts, not trade quotes.
// Board price ÷ length ÷ (5.5/12) converts to this engine's square-foot basis.
// Collection benchmarks do not establish every colour/profile's final order price.
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
    id: 'tt_terrain', name: 'TimberTech Terrain', tier: 'Mid Composite', priceRange: `$${sourcedDeckingSqft('tt_terrain').toFixed(2)}/sqft benchmark`,
    costPerSqft: sourcedDeckingSqft('tt_terrain'), isComposite: true, isHidden: false,
    note: 'DeckMart regular retail purchasing benchmark checked September 26, 2026; clearance pricing excluded. Confirm the selected colour, profile, stock length and delivery before a final quote.',
    colors: [
      { name: 'Brown Oak', swatch: 'tt-terrain-brown-oak.jpg' },
      { name: 'Silver Maple', swatch: 'tt-terrain-silver-maple.jpg' },
    ],
  },
  {
    id: 'tt_reserve', name: 'TimberTech PRO Reserve', tier: 'Mid-Premium Composite', priceRange: `$${sourcedDeckingSqft('tt_reserve').toFixed(2)}/sqft benchmark`,
    costPerSqft: sourcedDeckingSqft('tt_reserve'), isComposite: true, isHidden: false,
    note: 'DeckMart retail purchasing benchmark checked September 26, 2026. Confirm the selected colour, profile, stock length and delivery before a final quote.',
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
// 2026-09-23 — the owner confirmed $3,700/day for deck estimates. (A 2026-07-27
// note here recorded a move to $3,000/day; the table was never changed, and the
// owner kept $3,700.)
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

/** Frameless glass has no rate here: its glass and hardware are a supplier quote (calculations.ts). */
export const RAILING_COSTS: Record<Exclude<RailingType, 'None' | 'Frameless Glass'>, { material: number, install: number, spacing: number, postCost: number }> = {
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
