import {getHouseConfig,ORIGINAL_HOUSE_CLADDINGS} from './houseSettings';
import {HOUSE_COLOUR_FIELDS} from './houseFinishes';
import {DEFAULT_DECK} from './defaults';
import {isSystemProduct} from './lightingSystem';
import {LIGHTING_CATALOGUE} from './lightingCatalogue';
import {screenOn} from './privacyScreens';
import {activeCornerChamfers} from './lib/cornerChamfers';
import {allowanceItems} from './yardSettings';
import type {DeckData} from './types';

/**
 * DeckCraft funnel analytics: a closed set of events with fixed, self-describing labels. The designer
 * page plugs in the site's `trackEngagement` (GA4 + Meta, and the per-visit behaviour trail that reaches
 * the CRM with a lead); this module stays free of browser-only imports so the checks can run it.
 * Labels are constants built here, never customer text, dimensions or prices.
 *
 * Steps, features and views count once per visit; outputs, links and sends count every time.
 */
export type DeckEvent='deckcraft_step'|'deckcraft_feature'|'deckcraft_view'|'deckcraft_output'|'deckcraft_link'|'deckcraft_send';
export const DECK_LABEL=/^deck_[a-z0-9_]{1,36}$/;
const ONCE_PER_VISIT:ReadonlySet<DeckEvent>=new Set(['deckcraft_step','deckcraft_feature','deckcraft_view']);
const SESSION_KEY='gm_deckcraft_events';

type Sink=(event:DeckEvent,label:string)=>void;
let sink:Sink=()=>{};
/** Sets where events go (the page passes `trackEngagement`; checks pass a recorder); returns the previous sink. */
export function setDeckAnalyticsSink(next:Sink):Sink{const previous=sink;sink=next;return previous;}

let memory=new Set<string>();
function sentThisVisit():Set<string>{
  try{return new Set(JSON.parse(sessionStorage.getItem(SESSION_KEY)??'[]') as string[]);}catch{return memory;}
}
function remember(sent:Set<string>){
  memory=sent;
  try{sessionStorage.setItem(SESSION_KEY,JSON.stringify([...sent]));}catch{/* The in-memory set still de-duplicates this page view. */}
}
/** Forget which once-per-visit events were sent (checks and "start over" use this). */
export function resetDeckAnalyticsVisit(){memory=new Set();try{sessionStorage.removeItem(SESSION_KEY);}catch{/* Nothing stored. */}}

/** Sends one DeckCraft event. Labels outside the fixed vocabulary are dropped, never sent. */
export function trackDeck(event:DeckEvent,label:string){
  if(!DECK_LABEL.test(label))return;
  if(ONCE_PER_VISIT.has(event)){
    const sent=sentThisVisit(),key=`${event}:${label}`;
    if(sent.has(key))return;
    sent.add(key);remember(sent);
  }
  sink(event,label);
}

const STEP_NAMES=['dimensions','materials','stairs_railings','site_extras','backyard','estimate'] as const;
/** Label for a design step (0-based index). */
export const stepLabel=(index:number)=>`deck_step_${index+1}_${STEP_NAMES[index]??'other'}`;
const slug=(text:string)=>text.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
// Doors and windows count as edited when one is added, removed, restyled or moved to another wall;
// positions and sizes are left out because resizing the house re-fits them on its own.
const openingSignature=(data:DeckData)=>JSON.stringify(getHouseConfig(data).openings.map(o=>[o.id,o.type,o.style??'',o.facade,o.wallId??'']));
const DEFAULT_OPENINGS=openingSignature(DEFAULT_DECK);

/** The design features in use, as fixed labels. The default design uses none. */
export function designFeatures(data:DeckData):string[]{
  const house=getHouseConfig(data),features:string[]=[];
  const add=(on:unknown,label:string)=>{if(on)features.push(label);};
  if(data.shape!=='Rectangle')add(true,`deck_shape_${slug(data.shape)}`);
  if(data.pattern!=='Straight')add(true,`deck_pattern_${slug(data.pattern)}`);
  add(data.deckType!=='Attached',`deck_type_${slug(data.deckType)}`);
  add(data.wrap?.left||data.wrap?.right,'deck_wrap');
  add(data.wrap?.porchLeft||data.wrap?.porchRight,'deck_porch');
  add(activeCornerChamfers(data),'deck_corner_chamfer');
  add(data.levels>=2,'deck_level_2');
  add(data.levels>=3,'deck_level_3');
  add(data.levels>=2&&data.level2FullStep,'deck_split_level');
  add(data.stairType!=='Straight',`deck_stairs_${slug(data.stairType)}`);
  add(data.stairFlights>1,'deck_stairs_extra_flights');
  add(house.footprint?.rects.some(b=>b.kind==='garage'),'deck_house_garage');
  add(house.footprint?.rects.some(b=>b.kind==='house'),'deck_house_block');
  add(openingSignature(data)!==DEFAULT_OPENINGS,'deck_doors_windows');
  // Exterior finishes (appearance only): a newer cladding or roof, or any exterior colour.
  add(!ORIGINAL_HOUSE_CLADDINGS.includes(house.cladding)||!['Shingles','Metal'].includes(house.roofFinish)||HOUSE_COLOUR_FIELDS.some(k=>house[k])||house.openings.some(o=>o.color),'deck_house_exterior');
  add(data.catalogueRailingId,'deck_catalogue_railing');
  add(data.catalogueAccessories?.length,'deck_accessory');
  add(data.pictureFrameRows>0,'deck_border_rows');
  add(data.hasInlay,'deck_inlay');
  add(data.boardColours?.length,'deck_board_colours');
  add(data.inlays?.some(i=>i.kind==='rug'),'deck_inlay_rug');
  add(data.inlays?.some(i=>i.kind==='diamond'),'deck_inlay_diamond');
  add(data.inlays?.some(i=>i.kind==='band'),'deck_inlay_band');
  add(data.inlays?.some(i=>i.kind==='medallion'),'deck_inlay_medallion');
  add(data.privacyScreens?.some(screenOn),'deck_privacy_screen');
  add(data.lightingSystem.selectedItems.some(i=>{const p=LIGHTING_CATALOGUE.find(x=>x.id===i.productId);return i.qty>0&&!!p&&!isSystemProduct(p);}),'deck_lighting');
  add(data.benchLf>0,'deck_bench');
  add(data.pergolaSqft>0,'deck_pergola');
  add(data.hasDemo,'deck_demolition');
  add(data.hasDrainage,'deck_drainage');
  add(data.sceneLighting==='Evening','deck_night_preview');
  const yard=(data.yardFeatures??[]).filter(f=>f.enabled);
  const allowances=new Set(allowanceItems(data.yardAllowances).map(i=>i.id));
  add(yard.length||allowances.size,'deck_backyard');
  add(yard.some(f=>f.kind==='patio'),'deck_patio');
  add(yard.some(f=>f.kind==='retaining-wall'),'deck_retaining_wall');
  add(yard.some(f=>f.kind==='water-feature'),'deck_water_feature');
  add(allowances.has('firepit'),'deck_fire_pit');
  add(allowances.has('kitchen'),'deck_outdoor_kitchen');
  add(allowances.has('turf'),'deck_turf');
  add(allowances.has('lighting'),'deck_landscape_lighting');
  return features.filter(label=>DECK_LABEL.test(label));
}
