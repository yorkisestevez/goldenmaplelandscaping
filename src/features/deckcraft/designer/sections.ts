import {deckReleaseData} from '../deckRelease';
import {DEFAULT_DECK} from '../defaults';
import type {DeckData} from '../types';

/**
 * The designer's sections, in page order: one pure registry for the section list, the page, the analytics and the
 * checks. A section names the design fields it owns (they attribute an edit to it and decide its "changed" mark) and
 * the estimate sections it owns (its price effect). Every estimate section except HST belongs to exactly one design
 * section, so the rows' amounts add up to the priced subtotal. Sections open in any order; nothing about them is saved.
 */
export type SectionId='house'|'deck'|'boards'|'stairs'|'lighting'|'extras'|'site'|'backyard'|'proposal';
/** A design field, or the one part of a field that another section owns. */
export type FieldPath=keyof DeckData|'deckFinishes.railingColor';
export interface DesignSection{
  id:SectionId;
  /** The row's accessible name; it never changes. */
  name:string;
  /** The wizard step this section replaces: its analytics step label is stepLabel(legacyStep). */
  legacyStep:number;
  /** Loads the section's body (each body is its own chunk). */
  load:()=>Promise<unknown>;
  fields:readonly FieldPath[];
  /** Estimate section titles it owns; a title ending in "*" is a prefix. */
  ledger:readonly string[];
  /** The one related section the text link at the end of the body opens. */
  related:{id:SectionId;text:string};
}

// Section bodies, and the panels inside them, load on demand. The page fetches them all once it has settled.
export const loadHouseSection=()=>import('./steps/HouseSection');
export const loadDimensionsStep=()=>import('./steps/DimensionsStep');
export const loadMaterialsStep=()=>import('./steps/MaterialsStep');
export const loadStairsStep=()=>import('./steps/StairsStep');
export const loadSiteExtrasStep=()=>import('./steps/SiteExtrasStep');
export const loadBackyardStep=()=>import('./steps/BackyardStep');
export const loadEstimateStep=()=>import('./steps/EstimateStep');
/** Accent boards, inlays and deck-part finishes (Boards & finish; the railing colour picker is in Stairs & railings). */
export const loadBoardColourPanel=()=>import('./BoardColourPanel');
export const loadInlayEditor=()=>import('./InlayEditor');
export const loadDeckFinishesPanel=()=>import('./DeckFinishesPanel');
/** Skirting (Privacy, skirting & extras). */
export const loadSkirtingEditor=()=>import('./SkirtingEditor');
export const loadUnderDeckEditor=()=>import('./UnderDeckEditor');

export const SECTIONS:readonly DesignSection[]=[
  {id:'house',name:'House',legacyStep:0,load:loadHouseSection,
    fields:['houseConfig','housePlacement','houseVisible','houseWallHeightIn','houseDoorOffset','houseDoorWidthIn'],
    ledger:[],related:{id:'deck',text:'Size the deck against the house'}},
  {id:'deck',name:'Deck shape & size',legacyStep:0,load:loadDimensionsStep,
    fields:['width','length','height','deckType','shape','cutoutWidth','cutoutLength','cutoutWidth2','cutoutLength2','cornerChamfers','customFront','deckOutlines','deckOutlineOffsets','boundaryLocks','levels','width2','length2','height2','level2Position','level2EdgeId','level2Offset','level2FullStep','level3','wrap'],
    ledger:['Structural Framing (*','Hardware & Fasteners','Labour (Construction & Build)','Custom outline construction'],related:{id:'boards',text:'Choose the boards'}},
  {id:'boards',name:'Boards & finish',legacyStep:1,load:loadMaterialsStep,
    fields:['deckingMaterial','deckingColor','pattern','fasteningSystem','pictureFrameRows','pictureFrameOverhangIn','borderFinish','hasInlay','inlayLf','boardColours','boardLayout','inlays','deckFinishes'],
    ledger:['Decking','Picture-frame border finish','Accent-colour boards','Accent colours & inlays','Deck-part finishes','Custom board-layout*'],related:{id:'stairs',text:'Add stairs and a railing'}},
  {id:'stairs',name:'Stairs & railings',legacyStep:2,load:loadStairsStep,
    fields:['stairPath','stairTargets','stairRiserCount','stairTreadDepthIn','stairFlights','stairWidth','stairType','stairPosition','stairEdgeId','stairOffset','stairTurn','landingDepthIn','railingType','railingLf','railSections','railDefault','catalogueRailingId','glassMount','glassFinish','deckFinishes.railingColor'],
    ledger:['Stairs','Stair picture-frame detail','Railing System','Stair and level cladding','Terrain stair support connections','Unresolved stair path'],related:{id:'lighting',text:'Light the steps and posts'}},
  {id:'lighting',name:'Lighting',legacyStep:3,load:loadSiteExtrasStep,
    fields:['autoLighting','lightingSystem','lightingZoneEnabled'],
    ledger:['in-lite® Lighting System','Picture-frame lighting edge detail'],related:{id:'extras',text:'Add privacy screens or skirting'}},
  {id:'extras',name:'Privacy, skirting & extras',legacyStep:3,load:loadSiteExtrasStep,
    fields:['privacyScreens','privacySqft','skirting','benchLf','pergolaSqft','pergola','hasDemo','hasDrainage','underDeck','catalogueAccessories'],
    ledger:['Aluminum pergola','Add-ons & Extras','Manufacturer deck accessories','Deck skirting','Under-deck options'],related:{id:'site',text:'Tell us about the site'}},
  {id:'site',name:'Site & foundation',legacyStep:3,load:loadSiteExtrasStep,
    fields:['quoteResolutions','municipality','siteType','soilCondition','foundation','foundationDepthIn','buildSeason','intendedLoad','framingSize','joistSpacing','boardWidth'],
    ledger:['Permits & Professional Fees','Foundation & Footings','Confirmed additional quote costs'],related:{id:'backyard',text:'Plan the yard around the deck'}},
  {id:'backyard',name:'Backyard',legacyStep:4,load:loadBackyardStep,
    fields:['yardFeatures','yardEarthwork','terrainConfig','yardAllowances','siteModel','landscapeObjects','editorOrganization'],
    ledger:['Yard · *'],related:{id:'proposal',text:'See the estimate and send it'}},
  {id:'proposal',name:'Proposal & files',legacyStep:5,load:loadEstimateStep,
    fields:['customerName','projectAddress','scopeOfWork','permitSite'],
    ledger:[],related:{id:'deck',text:'Change the size or shape'}},
];
export const SECTION_BY_ID=Object.fromEntries(SECTIONS.map(s=>[s.id,s])) as Record<SectionId,DesignSection>;

/** Whether an estimate section (by title) belongs to a design section. */
export const ownsTitle=(section:DesignSection,title:string)=>section.ledger.some(t=>t.endsWith('*')?title.startsWith(t.slice(0,-1)):title===t);
/** The design section an estimate section belongs to; null for HST (and for a title no section owns). */
export const sectionOfTitle=(title:string):DesignSection|null=>SECTIONS.find(s=>ownsTitle(s,title))??null;

/** The field → section map (a part of a field, like the railing colour, maps on its own). */
export const SECTION_OF_FIELD=Object.fromEntries(SECTIONS.flatMap(s=>s.fields.map(f=>[f,s.id]))) as Partial<Record<FieldPath,SectionId>>;
// A field part ("deckFinishes.railingColor") belongs to its own section, not to the section owning the whole field.
const PARTS=SECTIONS.flatMap(s=>s.fields).filter(f=>f.includes('.'));
function valueAt(data:DeckData,path:FieldPath):unknown{
  const [key,part]=path.split('.') as [keyof DeckData,string|undefined];
  const value=data[key];
  if(part)return (value as Record<string,unknown>|undefined)?.[part];
  const claimed=PARTS.filter(p=>p.startsWith(`${key}.`)).map(p=>p.split('.')[1]);
  if(!claimed.length||!value||typeof value!=='object')return value;
  const rest={...(value as Record<string,unknown>)};for(const p of claimed)delete rest[p];
  return rest;
}
// Absent, empty lists and empty objects all mean "nothing chosen"; key order never matters.
function plain(value:unknown):unknown{
  if(Array.isArray(value))return value.length?value.map(plain):undefined;
  if(value&&typeof value==='object'){
    const out:Record<string,unknown>={};
    for(const key of Object.keys(value).sort()){const v=plain((value as Record<string,unknown>)[key]);if(v!==undefined)out[key]=v;}
    return Object.keys(out).length?out:undefined;
  }
  return value;
}
const same=(a:unknown,b:unknown)=>JSON.stringify(plain(a))===JSON.stringify(plain(b));

let defaults:DeckData|null=null;
/** The default design as the designer holds it (DEFAULT_DECK through the release boundary). */
const defaultDesign=()=>defaults??=deckReleaseData(structuredClone(DEFAULT_DECK));
/** Whether a section's fields differ from the default design; a restored or shared design shows it too. */
export const sectionChanged=(section:DesignSection,data:DeckData)=>section.fields.some(f=>!same(valueAt(data,f),valueAt(defaultDesign(),f)));

/** The sections an edit (a patch to the design) belongs to, through their fields. Unknown fields belong to none. */
export function sectionsOfPatch(patch:Partial<DeckData>,data:DeckData):SectionId[]{
  const ids=new Set<SectionId>();
  for(const key of Object.keys(patch) as (keyof DeckData)[]){
    const next={...data,...patch};
    for(const part of PARTS.filter(p=>p.startsWith(`${key}.`)))if(!same(valueAt(next,part),valueAt(data,part)))ids.add(SECTION_OF_FIELD[part]!);
    const whole=SECTION_OF_FIELD[key];
    if(whole&&(!PARTS.some(p=>p.startsWith(`${key}.`))||!same(valueAt(next,key),valueAt(data,key))))ids.add(whole);
  }
  return SECTIONS.filter(s=>ids.has(s.id)).map(s=>s.id);
}

/** Plain names for design fields, for the list of changes. A field without one reads "Design change". */
export const FIELD_NAMES:Partial<Record<FieldPath|'sceneLighting'|'lightingPreviewOn',string>>={
  houseConfig:'House',housePlacement:'House position',houseVisible:'Show house',houseWallHeightIn:'House wall height',houseDoorOffset:'House door position',houseDoorWidthIn:'House door width',
  width:'Deck width',length:'Deck depth',height:'Height above ground',deckType:'How the deck connects',shape:'Deck shape',
  cutoutWidth:'Corner cutout width',cutoutLength:'Corner cutout depth',cutoutWidth2:'Second cutout width',cutoutLength2:'Second cutout depth',
  cornerChamfers:'Angled front corners',customFront:'Custom outline',deckOutlines:'Deck outline points',deckOutlineOffsets:'Deck level position',boundaryLocks:'Measured edge locks',levels:'Number of levels',
  width2:'Second level width',length2:'Second level depth',height2:'Second level height',level2Position:'Second level side',level2EdgeId:'Second level wrap edge',level2Offset:'Second level alignment',level2FullStep:'Full-width step to the second level',level3:'Third level',wrap:'Wrap-around',
  deckingMaterial:'Collection',deckingColor:'Colour',pattern:'Board layout',fasteningSystem:'Fasteners',pictureFrameRows:'Border rows',pictureFrameOverhangIn:'Outer frame overhang',borderFinish:'Border finish',
  railSections:'Railing sections',railDefault:'Automatic railings',
  hasInlay:'Centre inlay stripe',inlayLf:'Inlay length',boardColours:'Accent boards',boardLayout:'Local board layout',inlays:'Inlays',deckFinishes:'Deck-part finishes',
  stairPath:'Stair edge path',stairRiserCount:'Number of risers',stairTreadDepthIn:'Tread depth',stairFlights:'Stair flights',stairWidth:'Stair width',stairType:'Stair layout',stairPosition:'Stair location',stairEdgeId:'Stair edge',stairOffset:'Stair position along the edge',stairTurn:'Stair turning direction',landingDepthIn:'Landing depth',
  railingType:'Railing style',railingLf:'Railing length',catalogueRailingId:'Manufacturer railing',glassMount:'Glass railing mount',glassFinish:'Glass hardware finish',['deckFinishes.railingColor']:'Railing colour',
  autoLighting:'Deck lighting',lightingSystem:'Lighting',lightingZoneEnabled:'Lighting zones',
  privacyScreens:'Privacy screens',privacySqft:'Privacy screen area',skirting:'Skirting',benchLf:'Built-in bench',pergolaSqft:'Pergola',hasDemo:'Remove an existing deck',hasDrainage:'Under-deck drainage',catalogueAccessories:'Manufacturer accessories',
  municipality:'Project area',siteType:'Site conditions',soilCondition:'Soil conditions',foundation:'Foundation',foundationDepthIn:'Footing depth',buildSeason:'Build season',intendedLoad:'Intended load',framingSize:'Joist size',joistSpacing:'Joist spacing',boardWidth:'Board width',
  stairTargets:'Stair landing elevations',siteModel:'Survey and grading',landscapeObjects:'Landscape objects',fences:'Fences',editorOrganization:'Layers, groups and locks',yardFeatures:'Backyard features',terrainConfig:'Terrain',yardAllowances:'Backyard allowances',
  customerName:'Your name',projectAddress:'Project address',scopeOfWork:'Scope of work',permitSite:'Lot and setbacks',
  sceneLighting:'Day or night preview',lightingPreviewOn:'Preview lights',
};
export const fieldName=(field:string)=>FIELD_NAMES[field as keyof typeof FIELD_NAMES]??'Design change';
