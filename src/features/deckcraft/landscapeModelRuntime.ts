import {landscapeSurface,landscapeSurfaceDepth,puttingCupWorld} from './landscapeSurfaces';
import {getPoolModels} from './poolModel';
import ClipperLib from 'clipper-lib';
import type {DeckData} from './types';
import type {LandscapeObject,LandscapePoint} from './landscapeTypes';
import {sampleSiteHeight} from './siteSurface';
import {getTerrainConfig} from './yardSettings';
import {buildYardModel} from './yardModel';
import {buildDeckTakeoff} from './deckTakeoff';
import {patioTopPlane,tiltStockPoint} from './yardElevationGeometry';
import {sitePlaneHeight} from './siteSurface';
import {landscapeWorld,landscapeOutlinePaths,insideLandscapeRing} from './landscapeOutline';
import {landscapeConnected,landscapeStructureExclusions,landscapeClip} from './landscapeFill';
import {landscapeAsset} from './landscapeCatalogue';
import {bedLevel,exposedRun,planeFillYd3,planeGround,ringGround,RAISED_BED,type BedGround,type BedLevel} from './raisedBeds';
import {designSiteSurface,integrateSiteFeatureFill} from './siteSurface';
export interface LandscapeItemTakeoff {objectId:string;name:string;kind:LandscapeObject['kind'];count:number;areaSqft:number;mulchYd3:number;edgingLf:number;aggregateYd3?:number;turfAreaSqft?:number;baseYd3?:number;cupCount?:number;quoteRequired:true;
 /** Raised beds only (raisedBeds.ts): level soil top (project datum), planting soil, highest soil over the outline's ground, timber/steel edging and holding wall run. */
 soilTopIn?:number;soilYd3?:number;raisedMaxIn?:number;raisedEdgeLf?:number;wallLf?:number;wallLinked?:boolean;unheld?:boolean}
export interface LandscapeTakeoff {plantCount:number;boulderCount:number;furnitureCount:number;bedAreaSqft:number;mulchYd3:number;edgingLf:number;aggregateYd3?:number;turfAreaSqft?:number;baseYd3?:number;cupCount?:number;soilYd3?:number;raisedEdgeLf?:number;items:LandscapeItemTakeoff[];warnings:string[]}
const SCALE=1000;
const signedArea=(p:LandscapePoint[])=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.z-b.x*a.z;},0)/2;
const area=(polys:LandscapePoint[][])=>Math.abs(polys.reduce((n,p)=>n+signedArea(p),0));
function clip(subject:LandscapePoint[][],taken:LandscapePoint[][],difference:boolean):LandscapePoint[][] {
 if(!subject.length)return [];const c=new ClipperLib.Clipper(),out:{X:number;Y:number}[][]=[];
 const paths=(p:LandscapePoint[][])=>p.map(poly=>poly.map(v=>({X:Math.round(v.x*SCALE),Y:Math.round(v.z*SCALE)})));
 c.AddPaths(paths(subject),ClipperLib.PolyType.ptSubject,true);if(taken.length)c.AddPaths(paths(taken),ClipperLib.PolyType.ptClip,true);
 c.Execute(difference?ClipperLib.ClipType.ctDifference:ClipperLib.ClipType.ctUnion,out,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);
 return out.map(poly=>poly.map(v=>({x:v.X/SCALE,z:v.Y/SCALE})));
}
export function landscapeFootprint(o:LandscapeObject):LandscapePoint[]{
 return landscapeOutlinePaths(o)[0];
}
/** Last enabled bed owns overlapping area. Varying depths are measured only on
 * each bed's remaining area, so overlap cannot silently double mulch. */
export function landscapeBedAreas(objects:LandscapeObject[],data?:DeckData){
 const result=new Map<string,LandscapePoint[][]>();let taken:LandscapePoint[][]=data?getPoolModels(data).flatMap(p=>p.permanentExclusionFootprints.map(poly=>poly.map(v=>({x:v.x,z:v.y})))):[];
 const enabled=objects.filter(o=>o.enabled&&o.kind==='bed'),ordered=[...enabled.filter(o=>!o.fillSeed).reverse(),...enabled.filter(o=>!!o.fillSeed).reverse()];
 for(const o of ordered){const paths=landscapeOutlinePaths(o);if(signedArea(paths[0])<0)paths[0].reverse();const exclusions=data&&o.groundCoverOnly?landscapeStructureExclusions(data):[],available=clip(paths,clip([...taken,...exclusions],[],false),true),remaining=o.fillSeed?landscapeConnected(available,landscapeWorld(o,o.fillSeed),true):available;result.set(o.id,remaining);taken=clip(o.fillSeed?remaining:paths,taken,false);}
 return result;
}
/** Entire cup opening must remain in the visible area, including holes and later overlaps. */
export function activePuttingCups(o:LandscapeObject,remaining:LandscapePoint[][]){return (o.puttingCups??[]).filter(p=>{const w=puttingCupWorld(o,p),radius=2.125,circle=Array.from({length:64},(_,i)=>({x:w.x+radius*Math.cos(i*Math.PI/32),z:w.z+radius*Math.sin(i*Math.PI/32)}));return area(clip([circle],remaining,true))<.005;});}
export function landscapeTakeoff(objects:LandscapeObject[]=[],data?:DeckData):LandscapeTakeoff {
 const q:LandscapeTakeoff={plantCount:0,boulderCount:0,furnitureCount:0,bedAreaSqft:0,mulchYd3:0,edgingLf:0,items:[],warnings:[]},beds=landscapeBedAreas(objects,data),edges=new Map<string,{start:number;end:number;item:LandscapeItemTakeoff}[]>();
 for(const o of objects.filter(o=>o.enabled)){
  if(data?.pools?.some(p=>p.enabled)){const placement=landscapePlacement(data,o);if(placement.pendingReason)q.warnings.push(o.name+': '+placement.pendingReason);}
  if(data&&o.kind==='bed'&&o.groundCoverOnly&&(!data.siteModel||landscapeOutlinePaths(o).flat().some(p=>sampleSiteHeight(data,p.x,p.z)===undefined)))q.warnings.push(o.name+': unmeasured ground coverage is illustrative. Enter survey coverage before construction.');
  const item:LandscapeItemTakeoff={objectId:o.id,name:o.name,kind:o.kind,count:o.kind==='bed'?0:1,areaSqft:0,mulchYd3:0,edgingLf:0,quoteRequired:true};
  if(o.kind==='plant'){q.plantCount++;if(!o.speciesRecord)q.warnings.push(o.name+': species, nursery stock and spacing have not been specified.');}
  else if(o.kind==='boulder')q.boulderCount++;else if(o.kind==='furniture')q.furnitureCount++;
  else {const remaining=beds.get(o.id)??[];item.areaSqft=area(remaining)/144;const finish=landscapeSurface(o.assetId),volume=item.areaSqft*landscapeSurfaceDepth(o)/324;item.mulchYd3=finish?.type==='mulch'?volume:0;item.aggregateYd3=finish?.type==='aggregate'?volume:0;item.turfAreaSqft=finish?.type==='turf'?item.areaSqft:0;item.baseYd3=item.areaSqft*(o.baseDepthIn??0)/324;item.cupCount=activePuttingCups(o,remaining).length;q.bedAreaSqft+=item.areaSqft;q.mulchYd3+=item.mulchYd3;for(const key of ['aggregateYd3','turfAreaSqft','baseYd3','cupCount'] as const)q[key]=(q[key]??0)+(item[key]??0);if(o.assetId!=='mulch-bed'&&item.areaSqft>.001&&o.baseDepthIn===undefined)q.warnings.push(o.name+': base depth, subgrade preparation and drainage remain unspecified.');if(item.cupCount!==(o.puttingCups??[]).length)q.warnings.push(o.name+': a putting cup is covered by another area or excluded by a pool. Adjust its position.');
   if(o.raisedIn!==undefined)raisedTakeoff(o,remaining,item,q,data);
   if(o.edging)for(const p of remaining.filter(p=>!o.outline||o.holeEdging||signedArea(p)>0))for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.0001)continue;let dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;if(dx<-.000001||Math.abs(dx)<.000001&&dz<0){dx=-dx;dz=-dz;}const key=[Math.round(dx*1e6),Math.round(dz*1e6),Math.round((dx*a.z-dz*a.x)*1000)].join('/'),u=dx*a.x+dz*a.z,v=dx*b.x+dz*b.z,list=edges.get(key)??[];list.push({start:Math.min(u,v),end:Math.max(u,v),item});edges.set(key,list);}
   if(Math.abs(item.areaSqft-area(landscapeOutlinePaths(o))/144)>.01)q.warnings.push(o.name+(data?.pools?.some(p=>p.enabled)?': overlapping area is excluded by a pool or belongs to a later enabled bed; finish quantities and edging use the remaining boundary.':': covered ground is excluded by structures or other landscape areas; finish quantities and edging use the remaining boundary.'));}
  q.items.push(item);
 }
 // Shared or partially shared collinear boundaries are installed once. Assign
 // each unique span to the first requesting bed so line items sum to the total.
 for(const spans of edges.values()){const stops=[...new Set(spans.flatMap(s=>[s.start,s.end]))].sort((a,b)=>a-b);for(let i=0;i+1<stops.length;i++){const mid=(stops[i]+stops[i+1])/2,owner=spans.find(s=>s.start<=mid&&s.end>=mid);if(owner)owner.item.edgingLf+=(stops[i+1]-stops[i])/12;}}
 q.edgingLf=q.items.reduce((n,item)=>n+item.edgingLf,0);
 return q;
}
const raisedLevels=new WeakMap<DeckData,WeakMap<LandscapeObject,BedLevel|null>>();
/** The ground a raised bed stands on: the design's measured surface (survey, grading, transitions and ground-fit
 * banks), or the legacy terrain plane; each with its exact planting-soil integral. */
function raisedGround(data:DeckData){
 const surface=designSiteSurface(data);
 if(surface)return {ground:surface as BedGround,fill:(polys:LandscapePoint[][],top:number)=>integrateSiteFeatureFill(surface,polys.map(p=>p.map(v=>({x:v.x,y:v.z}))),top)};
 const t=getTerrainConfig(data),plane={x:0,z:t.slopePct/100,constant:t.elevationIn};
 return {ground:planeGround(plane),fill:(polys:LandscapePoint[][],top:number)=>planeFillYd3(polys,plane,top)};
}
/** A raised bed's level soil top from its full outline (raisedBeds.ts); undefined when not raised or off measured ground. */
export function raisedBedLevel(data:DeckData,o:LandscapeObject):BedLevel|undefined{
 if(o.kind!=='bed'||o.raisedIn===undefined)return;
 let byObject=raisedLevels.get(data);if(!byObject)raisedLevels.set(data,byObject=new WeakMap());
 let level=byObject.get(o);if(level===undefined){level=bedLevel(raisedGround(data).ground,landscapeOutlinePaths(o)[0],o.raisedIn)??null;byObject.set(o,level);}
 return level??undefined;
}
/** Planting soil, edging and holding for one raised bed. Quantities only: prices stay quote lines. */
function raisedTakeoff(o:LandscapeObject,remaining:LandscapePoint[][],item:LandscapeItemTakeoff,q:LandscapeTakeoff,data?:DeckData){
 const kind=o.edge?.kind,level=data&&raisedBedLevel(data,o);item.soilYd3=0;
 if(kind==='timber'||kind==='steel')item.raisedEdgeLf=remaining.filter(p=>signedArea(p)>0).reduce((n,p)=>n+p.reduce((m,a,i)=>{const b=p[(i+1)%p.length];return m+Math.hypot(b.x-a.x,b.z-a.z);},0),0)/12;
 if(kind==='wall')item.wallLinked=false;
 if(!level||!data)q.warnings.push(o.name+': the raised bed is off measured ground, so its soil top and planting soil are pending. Survey the ground under it.');
 else{
  const {ground,fill}=raisedGround(data),wall=kind==='wall'?data.yardFeatures?.find(f=>f.id===o.edge!.wallFeatureId&&f.kind==='retaining-wall'&&f.enabled):undefined;
  item.soilTopIn=level.topIn;item.raisedMaxIn=level.topIn-level.lowIn;item.soilYd3=remaining.length?fill(remaining,level.topIn):0;
  if(!level.complete)q.warnings.push(o.name+': part of the raised bed is off measured ground; its planting soil covers the measured part only.');
  if(kind==='wall'){item.wallLinked=!!wall;item.wallLf=wall?wall.widthFt:exposedRun(ringGround(ground,landscapeOutlinePaths(o)[0]),level.topIn)/12;if(!wall)q.warnings.push(o.name+': its holding wall is not linked to an enabled retaining wall, so no wall is drawn or priced. Link the wall that holds this bed.');}
  else if(!kind&&item.raisedMaxIn>RAISED_BED.unheldIn){item.unheld=true;q.warnings.push(`${o.name}: the raised soil stands up to ${item.raisedMaxIn.toFixed(1)} in above the ground with no holding wall or edging. Choose a retaining wall, timber or steel edge.`);}
 }
 q.soilYd3=(q.soilYd3??0)+item.soilYd3;if(item.raisedEdgeLf!==undefined)q.raisedEdgeLf=(q.raisedEdgeLf??0)+item.raisedEdgeLf;
}
/** The soil top a plant, boulder or chair stands on inside an enabled raised bed (the last one listed wins). */
function raisedSupport(data:DeckData,x:number,z:number){
 const beds=data.landscapeObjects?.filter(b=>b.enabled&&b.kind==='bed'&&b.raisedIn!==undefined)??[];
 for(let i=beds.length-1;i>=0;i--){const b=beds[i],[outer,...holes]=landscapeOutlinePaths(b),p={x,z};if(!insideLandscapeRing(p,outer)||holes.some(h=>insideLandscapeRing(p,h)))continue;const level=raisedBedLevel(data,b);if(level)return {y:level.topIn+landscapeSurfaceDepth(b),measured:level.complete&&!!data.siteModel};}
}
function raisedQuoteLines(o:LandscapeObject,item:LandscapeItemTakeoff):import('./yardTakeoff').PublicYardSection[]{
 const out:import('./yardTakeoff').PublicYardSection[]=[],featureIds=[o.id],inches=(n:number)=>n.toFixed(1)+' in',kind=o.edge?.kind;
 if(item.soilTopIn===undefined)out.push({id:`landscape-soil-pending-${o.id}`,label:`${item.name} — planting soil (ground not measured)`,amountCents:null,featureIds,note:'Survey the ground under the raised bed. No soil quantity is invented.'});
 else if((item.soilYd3??0)>.001)out.push({id:`landscape-soil-${o.id}`,label:`${item.name} — planting soil supply and placement`,amountCents:null,quantity:item.soilYd3,unit:'cu yd',featureIds,note:`Level soil top at ${inches(item.soilTopIn)} (project datum): ${inches(o.raisedIn??0)} over the bed's lowest edge grade, never more than 2 in below its highest ground. Measured between that level and the proposed ground over the remaining bed area. Confirm the soil mix, settlement allowance, delivery and placement.`});
 if((item.raisedEdgeLf??0)>.001)out.push({id:`landscape-raised-edge-${o.id}`,label:`${item.name} — ${kind} raised-bed edging supply and installation`,amountCents:null,quantity:item.raisedEdgeLf,unit:'ft',featureIds,note:`Remaining bed perimeter${item.raisedMaxIn!==undefined?`; the soil stands up to ${inches(item.raisedMaxIn)} over the ground`:''}. Confirm the product, height, corner posts, anchoring and cuts.`});
 if(kind==='wall'&&!item.wallLinked)out.push({id:`landscape-wall-pending-${o.id}`,label:`${item.name} — holding wall (not yet designed)`,amountCents:null,...(item.wallLf?{quantity:item.wallLf,unit:'ft'}:{}),featureIds,note:'Run where the soil stands over the ground. Add or link an enabled retaining wall to hold this bed; no wall price is assumed.'});
 if(item.unheld)out.push({id:`landscape-hold-pending-${o.id}`,label:`${item.name} — holding edge not specified`,amountCents:null,featureIds,note:`The raised soil stands up to ${inches(item.raisedMaxIn??0)} over the ground. Choose a retaining wall, timber or steel edge; nothing is priced to hold it yet.`});
 return out;
}
const supports=new WeakMap<DeckData,ReturnType<typeof buildYardModel>>();
export function landscapePlacement(data:DeckData,o:LandscapeObject){
 const poolConflict=o.kind==='bed'&&o.groundCoverOnly?undefined:getPoolModels(data).find(p=>area(landscapeClip([landscapeFootprint(o)],p.permanentExclusionFootprints.map(poly=>poly.map(v=>({x:v.x,z:v.y}))),'intersection'))>.001);
 if(poolConflict)return {x:o.xIn/12,y:0,z:o.zIn/12,measured:false,normal:undefined,pendingReason:`Footprint intersects ${poolConflict.config.name}'s opening, structure or coping. Move or reshape this object; no pool-hole support is assumed.`};

 if(o.kind==='furniture'&&o.supportFeatureId){
  let yard=supports.get(data);if(!yard){yard=buildYardModel(data,buildDeckTakeoff(data));supports.set(data,yard);}const feature=yard.features.find(f=>f.config.id===o.supportFeatureId&&f.config.enabled&&f.config.kind==='patio'&&!f.excluded);
  if(feature){const plane=patioTopPlane(feature.config,sampleSiteHeight(data,feature.config.xFt*12,feature.config.zFt*12)??NaN),footprint=landscapeFootprint(o).map(v=>{const p=tiltStockPoint({x:v.x,y:v.z},plane,{x:o.xIn,y:o.zIn});return {x:p.x,z:p.y};}),footprintArea=Math.abs(signedArea(footprint)),covered=clip([footprint],feature.footprints.map(p=>p.map(v=>({x:v.x,z:v.y}))),true);
   if(area(covered)<.001&&footprintArea>0){const n=Math.sqrt(1+plane.x**2+plane.z**2);return {x:o.xIn/12,y:sitePlaneHeight(plane,o.xIn,o.zIn)/12,z:o.zIn/12,measured:true,normal:{x:-plane.x/n,y:1/n,z:-plane.z/n},pendingReason:undefined as string|undefined};}
  }
  return {x:o.xIn/12,y:0,z:o.zIn/12,measured:false,normal:undefined,pendingReason:'Selected patio support is missing, disabled, excluded, or does not cover the entire furniture footprint.'};
 }
 if(o.kind!=='bed'){const raised=raisedSupport(data,o.xIn,o.zIn);if(raised)return {x:o.xIn/12,y:raised.y/12,z:o.zIn/12,measured:raised.measured,normal:undefined,pendingReason:undefined};}
 const measured=sampleSiteHeight(data,o.xIn,o.zIn);if(measured!==undefined)return {x:o.xIn/12,y:measured/12,z:o.zIn/12,measured:!!data.siteModel,normal:undefined,pendingReason:undefined};
 const t=getTerrainConfig(data);return {x:o.xIn/12,y:(t.elevationIn+o.zIn*t.slopePct/100)/12,z:o.zIn/12,measured:false,normal:undefined,pendingReason:undefined};
}
/** Conservative maximum mature spread overlap; it is a planning envelope,
 * not prescribed planting spacing, a root zone, or an arborist clearance. */
export function matureSpreadConflicts(objects:LandscapeObject[]){
 const plants=objects.filter(o=>o.enabled&&o.kind==='plant'&&o.speciesRecord),pairs:{a:string;b:string;overlapIn:number}[]=[];
 for(let i=0;i<plants.length;i++)for(let j=i+1;j<plants.length;j++){const a=plants[i],b=plants[j],overlapIn=(a.speciesRecord!.matureSpreadIn[1]+b.speciesRecord!.matureSpreadIn[1])/2-Math.hypot(a.xIn-b.xIn,a.zIn-b.zIn);if(overlapIn>0)pairs.push({a:a.id,b:b.id,overlapIn});}
 return pairs;
}
/** All objects retain a far LOD. A bounded extra triangle budget upgrades the
 * largest projected objects; the estimate and object list are never truncated.
 * Showcase stills opt in to the nearest model for every plant, with shadows. */
export function landscapeRenderLods(objects:LandscapeObject[],camera:{x:number;y:number;z:number},viewportHeight:number,tier:'high'|'balanced'|'constrained',showcase=false){
 const lods=new Map<string,0|1|2>(),ranked=objects.filter(o=>o.enabled&&o.kind!=='bed').map(o=>{lods.set(o.id,2);const distance=Math.max(1,Math.hypot(o.xIn/12-camera.x,o.heightIn/24-camera.y,o.zIn/12-camera.z));return {o,pixels:o.heightIn/12/distance*viewportHeight/(2*Math.tan(19*Math.PI/180))};}).sort((a,b)=>b.pixels-a.pixels);
 if(tier==='constrained'&&!showcase)return lods;
 let medium=showcase?1e8:tier==='high'?300000:120000,near=showcase?1e8:tier==='high'?500000:0;
 for(const {o,pixels} of ranked){const costs=landscapeAsset(o.assetId).triangleCounts;if(!costs)continue;const extra=costs[1]-costs[2];if((showcase||pixels>(tier==='high'?18:36))&&extra<=medium){lods.set(o.id,1);medium-=extra;}}
 for(const {o,pixels} of ranked){const costs=landscapeAsset(o.assetId).triangleCounts;if(!costs||lods.get(o.id)!==1)continue;const extra=costs[0]-costs[1];if((showcase||pixels>160)&&extra<=near){lods.set(o.id,0);near-=extra;}}
 return lods;
}

import {registerLandscapeModelRuntime} from './landscapeModel';
registerLandscapeModelRuntime({landscapeFootprint,landscapeBedAreas,landscapeTakeoff,landscapePlacement,matureSpreadConflicts,landscapeRenderLods,landscapeQuoteSections});

/** Quote prose and scopes load together with the optional landscape model. */
export function landscapeQuoteSections(objects:import('./landscapeTypes').LandscapeObject[],landscape:import('./landscapeModel').LandscapeTakeoff):import('./yardTakeoff').PublicYardSection[]{
 const unknown:import('./yardTakeoff').PublicYardSection[]=[];
 for(const item of landscape.items){
  if(item.kind==='bed'){
   if(item.areaSqft>.001)unknown.push({id:`landscape-${item.objectId}`,label:`${item.name} — area preparation`,amountCents:null,quantity:item.areaSqft,unit:'sq ft',featureIds:[item.objectId],note:'Bed preparation only. Finish, base and edging are measured and priced separately; reconcile shared excavation and restoration.'});
   if(item.mulchYd3>.001)unknown.push({id:`landscape-mulch-${item.objectId}`,label:`${item.name} — mulch supply and placement`,amountCents:null,quantity:item.mulchYd3,unit:'cu yd',featureIds:[item.objectId],note:'Compacted design depth over the nonoverlapping bed area. Confirm material, purchasing conversion, delivery and placement; no assumed soil density.'});
   const object=objects.find(o=>o.id===item.objectId)!;
   for(const [key,label,unit] of [['aggregateYd3','decorative stone supply and placement','cu yd'],['turfAreaSqft','artificial turf supply and installation','sq ft'],['baseYd3','recorded base aggregate supply and placement','cu yd'],['cupCount','putting cup supply and installation','ea']] as const){const quantity=item[key]??0;if(quantity>.001)unknown.push({id:`landscape-${key}-${item.objectId}`,label:`${item.name} — ${label}`,amountCents:null,quantity,unit,featureIds:[item.objectId],note:'Measured remaining plan area; layer volumes use recorded vertical depth. Confirm product, ordering waste, purchasing units, delivery and labour. Cup drainage, turf seams and infill remain installation inputs. Reconcile package inclusions and shared earthwork.'});}
   if(object.assetId!=='mulch-bed'&&object.baseDepthIn===undefined&&item.areaSqft>.001)unknown.push({id:`landscape-base-pending-${item.objectId}`,label:`${item.name} — base and drainage specification pending`,amountCents:null,featureIds:[item.objectId],note:'Enter a base depth and installation specification. No excavation, disposal, geotextile, density or drainage quantity is invented.'});
   if(object.raisedIn!==undefined)unknown.push(...raisedQuoteLines(object,item));
   if(item.edgingLf>.001)unknown.push({id:`landscape-edging-${item.objectId}`,label:`${item.name} — edging supply and installation`,amountCents:null,quantity:item.edgingLf,unit:'ft',featureIds:[item.objectId],note:'Unique measured boundary length; shared collinear edges are counted once. Confirm selected product, purchasing pack, cuts and anchoring.'});
  }else unknown.push({id:`landscape-${item.objectId}`,label:`${item.name} — supply and installation`,amountCents:null,quantity:item.count,unit:'ea',featureIds:[item.objectId],note:'Generic visual proxy; confirm actual species/product, nursery stock or SKU, supply, delivery and installation.'});
 }

 for(const o of objects.filter(o=>o.enabled&&o.kind==='plant'&&(!o.speciesRecord||o.speciesRecord.spacingIn===undefined)))unknown.push({id:`plant-specification-${o.id}`,label:`${o.name}: botanical specification and planting spacing confirmation`,amountCents:null,featureIds:[o.id],note:'A generic visual proxy and cost entry cannot establish mature dimensions or planting spacing. Record a botanical source and the spacing specification.'});
 return unknown;
}
