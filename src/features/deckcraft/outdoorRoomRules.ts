import type {DeckData,YardFeature} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import type {LandscapeAssetId,LandscapeObject} from './landscapeTypes';
import {yardRectangle} from './yardModel';
import {fireOutline,planGapIn} from './fireFeatureModel';
import {fireProduct} from './fireFeatures';
import {poolPermanentExclusion} from './poolGeometry';
import {patioInlayPlans} from './patioInlays';
import {onPaving,pavingRings} from './pathLightPlacement';
import {DINING_TABLES,seatFront} from './furnitureFacing';
import {CURVED_SECTIONAL,CURVED_SECTIONAL_ARC_OFFSET_IN,premiumAsset} from './premiumFurniture';

/**
 * The checkable outdoor-room rules (pavers & furniture review, October 2026): clearances a builder and a designer would
 * measure on the plan. Each returns one plain sentence for the design checker; none blocks a save.
 * - F-DINING-BEHIND: 36 in of paving or deck behind every dining chair back.
 * - F-COFFEE-GAP: a coffee table 14–18 in from each lounge seat front around it.
 * - F-CHAISE-COPING: a chaise foot 36 in or more from the coping's outer edge.
 * - F-FIRE-GAS: lounge seats 36–72 in from a gas burner rim (36–48 in is the target); a wood fire 72 in.
 * - F-FIRE-NO-COFFEE: no coffee table between a seat and the fire.
 * - R-GRILL: 36 in clear in front of a grill island and 48 in to lounge seating (its own bar stools excepted).
 * - B-ONE-WIDTH: every border and inlay band in the project is one width (±0.5 in).
 * - M-PAVE-COUNT: two paving colour-and-finish combinations (field and band); a third only on a walk or path.
 * - R-POOL-FENCE: a reminder that a pool needs a by-law enclosure.
 */
const LOUNGE_SEATS=new Set<LandscapeAssetId>(['outdoor-sofa','curved-sectional','swivel-lounge-chair','modular-sofa','lounge-chair']);
const FIRE_SEATS=new Set<LandscapeAssetId>(['outdoor-sofa','outdoor-chair','curved-sectional','swivel-lounge-chair','modular-sofa']);
const DINING_CHAIRS=new Set<LandscapeAssetId>(['outdoor-chair','woven-dining-chair']);
/** A walk may carry the third paving material: a patio no wider than a generous walk. */
const WALK_MAX_FT=10;

const ringOf=(o:LandscapeObject)=>yardRectangle(o.xIn,o.zIn,o.widthIn,o.depthIn,(o.rotationDeg??0)*Math.PI/180);
const ft=(n:number)=>`${Math.round(n)} in`;

/** The plan gap from a seat to a round burner. A curved sectional measures from its arc, not its envelope. */
function seatToFire(seat:LandscapeObject,fire:YardFeature,burner:{x:number;y:number}[]){
 if(seat.assetId==='curved-sectional'){
  const f=seatFront(seat.rotationDeg??0),cx=seat.xIn+f.x*CURVED_SECTIONAL_ARC_OFFSET_IN,cz=seat.zIn+f.z*CURVED_SECTIONAL_ARC_OFFSET_IN;
  const scale=seat.widthIn/premiumAsset('curved-sectional')!.widthIn,front=CURVED_SECTIONAL.frontRadiusIn*scale;
  const r=fireProduct(fire)?.round?fire.widthFt*6:Math.max(fire.widthFt,fire.depthFt)*6;
  return front-Math.hypot(fire.xFt*12-cx,fire.zFt*12-cz)-r;
 }
 return planGapIn(ringOf(seat),burner);
}

function segmentHitsRing(a:{x:number;y:number},b:{x:number;y:number},ring:{x:number;y:number}[]){
 for(let k=0;k<=24;k++){const t=k/24,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};if(inside(p,ring))return true;}
 return false;
}
function inside(p:{x:number;y:number},ring:{x:number;y:number}[]){
 let hit=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;}
 return hit;
}

export function outdoorRoomIssues(data:DeckData,model?:Pick<DeckTakeoff,'levels'|'flights'|'treads'>):string[]{
 const out:string[]=[],objects=(data.landscapeObjects??[]).filter(o=>o.enabled!==false&&o.kind==='furniture');
 const paving=pavingRings(data,model);
 const near=(a:{xIn:number;zIn:number},b:{xIn:number;zIn:number},maxIn:number)=>Math.hypot(a.xIn-b.xIn,a.zIn-b.zIn)<=maxIn;

 // F-DINING-BEHIND
 const tables=objects.filter(o=>DINING_TABLES.has(o.assetId));
 for(const chair of objects.filter(o=>DINING_CHAIRS.has(o.assetId)&&tables.some(t=>near(o,t,10*12)))){
  const f=seatFront(chair.rotationDeg??0),bx=chair.xIn-f.x*(chair.depthIn/2+36),bz=chair.zIn-f.z*(chair.depthIn/2+36);
  if(paving.length&&!onPaving(paving,bx,bz))out.push(`${chair.name} has under 36 in of deck or paving behind it to push back from the table.`);
 }
 // F-COFFEE-GAP
 for(const table of objects.filter(o=>o.assetId==='outdoor-coffee-table')){
  const seats=objects.filter(o=>LOUNGE_SEATS.has(o.assetId)&&o.assetId!=='lounge-chair'&&near(o,table,8*12));
  for(const seat of seats){const gap=planGapIn(ringOf(seat),ringOf(table));if(gap<14-0.5||gap>18+0.5)out.push(`${table.name} is ${ft(gap)} from ${seat.name}; keep a coffee table 14–18 in from the seat front.`);}
 }
 // F-CHAISE-COPING
 const exclusions=(data.pools??[]).flatMap(p=>poolPermanentExclusion(p));
 for(const chaise of objects.filter(o=>o.assetId==='lounge-chair')){
  if(!exclusions.length)break;
  const gap=Math.min(...exclusions.map(r=>planGapIn(ringOf(chaise),r)));
  if(gap<10*12&&gap<36-0.5)out.push(`${chaise.name} is ${ft(gap)} from the pool coping; keep a chaise foot 36 in back so the walk round the pool stays open.`);
 }
 // F-FIRE-GAS, F-FIRE-WOOD, F-FIRE-NO-COFFEE
 for(const fire of (data.yardFeatures??[]).filter(f=>f.enabled&&f.kind==='fire-feature')){
  const product=fireProduct(fire);if(!product)continue;
  let burner:{x:number;y:number}[];try{burner=fireOutline(fire);}catch{continue;}
  const gas=product.fuel==='gas',fx=fire.xFt*12,fz=fire.zFt*12;
  for(const seat of objects.filter(o=>FIRE_SEATS.has(o.assetId)&&Math.hypot(o.xIn-fx,o.zIn-fz)<=12*12)){
   const gap=seatToFire(seat,fire,burner);
   if(gas&&(gap<36-0.5||gap>72+0.5))out.push(`${seat.name} is ${ft(gap)} from the burner; seat a gas fire 36–48 in from the rim (72 in at most).`);
   if(!gas&&gap<72-0.5)out.push(`${seat.name} is ${ft(gap)} from a wood fire; keep seats 72 in back from a wood burner.`);
   for(const table of objects.filter(o=>o.assetId==='outdoor-coffee-table'&&near(o,{xIn:fx,zIn:fz},12*12)))
    if(segmentHitsRing({x:seat.xIn,y:seat.zIn},{x:fx,y:fz},ringOf(table)))out.push(`${table.name} stands between ${seat.name} and the fire; use side tables beside the seats instead.`);
  }
 }
 // R-GRILL
 for(const island of objects.filter(o=>o.assetId==='kitchen-island')){
  const f=seatFront(island.rotationDeg??0),cx=island.xIn+f.x*(island.depthIn/2+18),cz=island.zIn+f.z*(island.depthIn/2+18);
  const aisle=yardRectangle(cx,cz,island.widthIn,36,(island.rotationDeg??0)*Math.PI/180);
  if(paving.length&&aisle.some(p=>!onPaving(paving,p.x,p.y)))out.push(`${island.name} has under 36 in of paving in front of the grill.`);
  for(const o of objects)if(o.id!==island.id&&o.assetId!=='bar-stool'&&o.assetId!=='outdoor-lantern'&&o.assetId!=='outdoor-rug'&&planGapIn(aisle,ringOf(o))<1)out.push(`${o.name} stands in the 36 in work aisle in front of ${island.name}.`);
  for(const seat of objects.filter(o=>LOUNGE_SEATS.has(o.assetId))){const gap=planGapIn(ringOf(island),ringOf(seat));if(gap<48-0.5)out.push(`${seat.name} is ${ft(gap)} from the grill island; keep lounge seating 48 in from a grill.`);}
 }
 // B-ONE-WIDTH
 const widths=new Map<number,string>();
 for(const f of (data.yardFeatures??[]).filter(f=>f.enabled&&f.kind==='patio'))for(const p of patioInlayPlans(f).filter(p=>p.status==='ok'&&p.inlay.shape==='rectangle'))widths.set(Math.round(Math.min(p.inlay.widthIn,p.inlay.depthIn)*2)/2,f.name);
 const ws=[...widths.keys()].sort((a,b)=>a-b);
 if(ws.length>1&&ws[ws.length-1]-ws[0]>0.5)out.push(`Borders and bands are ${ws.map(w=>`${w} in`).join(', ')} wide; keep one band width across the project.`);
 // M-PAVE-COUNT
 const main=new Set<string>(),walks=new Set<string>();
 for(const f of (data.yardFeatures??[]).filter(f=>f.enabled&&f.kind==='patio')){
  const walk=Math.min(f.widthFt,f.depthFt)<=WALK_MAX_FT+1e-6,key=(h:YardFeature['hardscape'])=>h?`${h.finishId}/${h.colorId}`:'';
  const k=key(f.hardscape);if(k)(walk?walks:main).add(k);
  for(const p of f.inlays??[]){const kk=key(p.hardscape);if(kk)main.add(kk);}
 }
 const extraWalk=[...walks].filter(k=>!main.has(k));
 if(main.size>2||extraWalk.length>1||main.size+extraWalk.length>3)out.push(`The paving uses ${main.size+extraWalk.length} colour and finish combinations; keep to a field and a band, with a third only on the walks.`);
 // R-POOL-FENCE
 if((data.pools??[]).some(p=>p.enabled))out.push('A pool needs a by-law enclosure: in Barrie a barrier at least 1.2 m high with self-closing, self-latching gates and a pool enclosure permit. Confirm the lot fence and gates qualify.');
 return out;
}
/** Whether a patio reads as a walk for M-PAVE-COUNT. */
export const isWalkWidth=(f:YardFeature)=>Math.min(f.widthFt,f.depthFt)<=WALK_MAX_FT+1e-6;
