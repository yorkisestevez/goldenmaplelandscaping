/**
 * S3 design moves for the AI Site Designer: the deterministic building blocks that turn a measured site into buildable
 * yard pieces. No AI model is involved here; a later model only chooses among moves and adjusts their bounded `params`.
 * siteConcepts.ts composes moves into whole, priced concepts.
 *
 * A move is pure over the design and its site brief (siteBrief.ts). It returns the `patch` for design.patch (full
 * yardFeatures / landscapeObjects arrays and any stair change, against the design it was given), the `parts` it adds or
 * replaces (so moves compose), its plan `footprints`, `feasible` with a plain `reason` when not, owner-voice `notes` and
 * `metrics`. Moves stand only on measured ground: nothing is placed outside the survey's coverage, and when the survey
 * is too small a move says how far to measure ("Measure about N ft further …"). Every move keeps clear of the house, the
 * deck and its stairs, other features and pools, and, when the design has its lot (data.permitSite), inside the lot lines by
 * the setbacks of designRules.ts (FIRE_CLEARANCE.fromPropertyLineFt for a fire, ZONING_SETBACKS). Rules come from
 * designRules.ts (draft: planning guidance, not a permit review).
 *
 * Lazy: import it dynamically (siteConcepts.ts does) after `loadSiteDesignRuntime()`. Plan inches as in siteBrief.ts:
 * x to the right as seen from the yard, z away from the house, elevations on the deck's datum.
 */
import type {DeckData,YardFeature} from './types';
import {GROUND_FIT_LIMITS} from './types';
import type {LandscapeObject,LandscapePoint} from './landscapeTypes';
import {validateLandscapeObjects,loadLandscapeTypesRuntime} from './landscapeTypes';
import {loadLandscapeModelRuntime} from './landscapeModel';
import type {PlanPoint} from './lib/deckGeometry';
import type {SiteBrief,SiteBriefZone} from './siteBrief';
import {designSiteSurface,type SiteSurface} from './siteSurface';
import {buildDeckTakeoff,type DeckTakeoff} from './deckTakeoff';
import {getHouseConfig} from './houseSettings';
import {getHouseWalls,houseOutline,openingHidden,openingWallId} from './houseFootprint';
import {yardArea,yardClip,yardRectangle,loadAdvancedYardRuntime} from './yardModel';
import {yardFeatureOutline,yardWallPath,yardPathEnvelope,pathRun} from './yardPathGeometry';
import {fireOutline,planGapIn,flightFootprint,treadFootprint,FIRE_MIN_CLEARANCE_FT,FIRE_PAD_MARGIN_IN} from './fireFeatureModel';
import {FIRE_PRODUCTS,fireProduct} from './fireFeatures';
import {FIRE_CLEARANCE,GUARD,RETAINING_WALL,TERRACE_WALL,SEAT_WALL,RAISED_BED as BED_RULE,STONE_STEPS,CONSERVATION_AUTHORITY,ZONING_SETBACKS} from './designRules';
import {raisedPatioWallPath,raisedPatioWall,raisedPatioGuard,type RaisedEdgeRun,type RaisedPatioGuard} from './raisedPatio';
import {poolOutline,poolPermanentExclusion} from './poolGeometry';
import {planTerraces} from './terracedBeds';
import {newLandscapeObject} from './landscapeCatalogue';
import {validateYardFinishedSettings} from './yardFinishedSettings';
import {wallConstructionProblem,wallConstructionPlan} from './wallConstruction';
import {validateStoneSteps} from './stoneSteps';
import {arcGeometry} from './circularArcs';
import {ensureLiveDesignExtensions} from './designExtensions';

import {MOVE_PARAMS,type SiteMoveKind,type MoveValue} from './siteMoveParams';
// The bounded vocabulary lives in the dependency-free siteMoveParams.ts so the AI server can validate against it.
export {MOVE_PARAMS};export type {SiteMoveKind,MoveValue};
/** What a move adds or replaces. `set` carries stair and deck changes (ground fit only). */
export interface MoveParts {addYard:YardFeature[];replaceYard:YardFeature[];addLandscape:LandscapeObject[];set:Partial<Pick<DeckData,'stairTargets'|'stairOffset'|'height'>>}
/** A plan footprint (world inches) the move occupies. `on`: ids it may overlap (a seat wall on its patio, a terrace bed
 * and its wall); everything else must stay clear. */
export interface MoveFootprint {id:string;rings:PlanPoint[][];on?:string[]}
export interface SiteMove {
 /** Stable: the kind (one move of a kind per concept). */
 id:string;kind:SiteMoveKind;title:string;
 /** The change against the design the move was made for, ready for design.patch. Empty when not feasible. */
 patch:Partial<DeckData>;
 /** Bounded inputs (see MOVE_PARAMS); the values the move used. */
 params:Record<string,MoveValue>;
 feasible:boolean;reason?:string;notes:string[];metrics:Record<string,MoveValue>;
 parts:MoveParts;footprints:MoveFootprint[];
 /** Patterns (RegExp sources) of new estimate messages this move accounts for in its notes. */
 explains:string[];
}

type P=PlanPoint;
interface Box {minX:number;maxX:number;minZ:number;maxZ:number}
export interface Occupant {id:string;kind:'house'|'deck'|'stair'|'feature'|'bed'|'plant'|'pool';label:string;rings:P[][];box:Box}
/** The lot as entered for the permit set (data.permitSite), plan inches, as the A-0 site plan draws it; `corner`: the
 * side a corner lot's second street runs along. */
export interface LotBox {minX:number;maxX:number;minZ:number;maxZ:number;corner?:'left'|'right'}
export interface MoveContext {
 data:DeckData;brief:SiteBrief;surface:SiteSurface;takeoff:DeckTakeoff;occupants:Occupant[];
 /** The lot lines when the design has them (data.permitSite); every move keeps inside them by its setbacks. */
 lot?:LotBox|null;
 /** The door that opens to the yard (or, without one, the stair foot), and the way it faces. */
 door:{x:number;z:number;out:{x:number;z:number};label:string}|null;
 /** Unit vector of the measured fall (brief plane); null on level ground (under 0.5 %). */
 down:{dx:number;dz:number}|null;
 northDeg?:number;ids:Set<string>;
 /** Yields to the event loop (and throws once cancelled); siteConcepts passes its own. */
 tick:()=>Promise<void>;
 /** For ground fit: its time limit and the abort signal. */
 budgetMs?:number;signal?:AbortSignal;
}

/** Everything a move needs loaded: measured terrain, the yard model, stair targets and the design extensions. */
export async function loadSiteDesignRuntime(data?:DeckData){
 const {loadSiteBriefRuntime}=await import('./siteBrief');
 await Promise.all([loadSiteBriefRuntime(),loadAdvancedYardRuntime(),loadLandscapeTypesRuntime(),loadLandscapeModelRuntime(),...(data?[ensureLiveDesignExtensions(data)]:[])]);
}

const r0=(v:number)=>Math.round(v)+0,r1=(v:number)=>Math.round(v*10)/10+0,r2=(v:number)=>Math.round(v*100)/100+0,q4=(v:number)=>Math.round(v*4)/4+0,ft=(inches:number)=>r1(inches/12);
const signed=(v:number)=>`${v>0.04?'+':v<-.04?'−':''}${r1(Math.abs(v))}`;
const esc=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function num(params:Record<string,unknown>,kind:SiteMoveKind,key:string):number{const b=MOVE_PARAMS[kind][key] as readonly [number,number,number],v=params[key];return typeof v==='number'&&Number.isFinite(v)?Math.min(b[1],Math.max(b[0],v)):b[2];}
function pick(params:Record<string,unknown>,kind:SiteMoveKind,key:string):string{const b=MOVE_PARAMS[kind][key] as readonly string[],v=params[key];return typeof v==='string'&&b.includes(v)?v:b[0];}
const boxOf=(rings:P[][]):Box=>{let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const r of rings)for(const p of r){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.y);maxZ=Math.max(maxZ,p.y);}return {minX,maxX,minZ,maxZ};};
const rect=(cx:number,cz:number,w:number,d:number,deg=0):P[]=>yardRectangle(cx,cz,w,d,deg*Math.PI/180);
const boxRing=(b:Box,m=0):P[]=>[{x:b.minX-m,y:b.minZ-m},{x:b.maxX+m,y:b.minZ-m},{x:b.maxX+m,y:b.maxZ+m},{x:b.minX-m,y:b.maxZ+m}];
function inRing(ring:P[],p:P){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c;}return c;}
const inRings=(rings:P[][],p:P)=>rings.reduce((n,r)=>n+(inRing(r,p)?1:0),0)%2===1;
function segGap(p:P,a:P,b:P){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
const edgeGap=(rings:P[][],p:P)=>Math.min(...rings.map(r=>Math.min(...r.map((a,i)=>segGap(p,a,r[(i+1)%r.length])))));
const gapBetween=(a:P[][],b:P[][])=>Math.min(...a.flatMap(ra=>b.map(rb=>planGapIn(ra,rb))));
const overlapSqft=(a:P[][],b:P[][])=>yardArea(yardClip(yardClip(a),yardClip(b),'intersection'));
/** Points along every edge, about `step` in apart. */
const densify=(rings:P[][],step=12)=>rings.flatMap(r=>r.flatMap((a,i)=>{const b=r[(i+1)%r.length],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/step));return Array.from({length:n},(_,k)=>({x:a.x+(b.x-a.x)*k/n,y:a.y+(b.y-a.y)*k/n}));}));
const SEEN=' (seen from the yard)';
/** Plain words for a plan direction relative to the house (as siteBrief.ts words it). */
export function towardWords(dx:number,dz:number){
 if(Math.hypot(dx,dz)<1e-9)return 'out';
 const s=Math.round(Math.atan2(dz,dx)/(Math.PI/4));
 return ['toward the right'+SEEN,'away from the house and to the right'+SEEN,'away from the house','away from the house and to the left'+SEEN,'toward the left'+SEEN,'toward the house and to the left'+SEEN,'toward the house','toward the house and to the right'+SEEN][((s%8)+8)%8];
}
const kindOf=(pct:number)=>pct<=2?'flat':pct<=5?'gentle':pct<=10?'moderate':'steep';
const KIND_RANK:Record<string,number>={flat:0,gentle:1,moderate:2,steep:3};

/** Plan footprint of a yard feature as the occupancy checks read it. */
export function featureRings(f:YardFeature):P[][]{
 try{if(f.kind==='retaining-wall')return yardPathEnvelope(yardWallPath(f),f.depthFt*12+2);if(f.kind==='fire-feature')return [fireOutline(f,f.supportFeatureId?0:FIRE_PAD_MARGIN_IN)];return yardFeatureOutline(f);}
 catch{return [rect(f.xFt*12,f.zFt*12,f.widthFt*12,f.depthFt*12,f.rotationDeg)];}
}
/** A retaining wall's construction envelope in front and behind as the yard model checks it against the survey (a foot
 * past each face), for the coverage test before a wall is offered. */
const wallEnvelope=(f:YardFeature):P[][]=>yardPathEnvelope(yardWallPath(f),f.depthFt*12+26);
export const objectRings=(o:LandscapeObject):P[][]=>o.polygon&&o.polygon.length>=3?[o.polygon.map(p=>({x:p.x,y:p.z}))]:[rect(o.xIn,o.zIn,o.widthIn,o.depthIn,o.rotationDeg)];
/** What already stands in the plan: the house, deck levels, stair flights and treads, yard features, landscape objects
 * and pools (their structure and coping). */
export function designOccupants(data:DeckData,takeoff:DeckTakeoff):Occupant[]{
 const out:Occupant[]=[],add=(id:string,kind:Occupant['kind'],label:string,rings:P[][])=>{rings=rings.filter(r=>r.length>=3&&r.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));if(rings.length)out.push({id,kind,label,rings,box:boxOf(rings)});};
 try{add('house','house','the house',houseOutline(data));}catch{/* no house blocks */}
 takeoff.levels.forEach((l,i)=>{if(l.kind==='winder')return;add(`deck:${i}`,'deck',i?'a deck level':'the deck',[l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))]);});
 for(const f of takeoff.flights)add(`stair:${f.id}`,'stair','the stair',[flightFootprint(f)]);
 // Every tread too: a winder or a path stair's treads reach past its flight lines, and a nosing past its foot.
 takeoff.treads.forEach((t,i)=>add(`stair:tread-${i+1}`,'stair','the stair',[treadFootprint(t)]));
 for(const f of data.yardFeatures??[])if(f.enabled)add(`yard:${f.id}`,'feature',f.name,featureRings(f));
 for(const o of data.landscapeObjects??[])if(o.enabled)add(`land:${o.id}`,o.kind==='bed'?'bed':'plant',o.name,objectRings(o));
 for(const p of data.pools??[])if(p.enabled){let rings:P[][];try{rings=poolPermanentExclusion(p);}catch{try{rings=[poolOutline(p)];}catch{continue;}}add(`pool:${p.id}`,'pool',p.name||'the pool',rings);}
 return out;
}
/** The lot from data.permitSite: its left line leftYardFt out from the house's left-most wall, its rear line rearYardFt
 * out from the wall the deck is on (z = 0), its front line lotDepthFt in front of that. Null without one. */
export function lotOf(data:DeckData):LotBox|null{
 const s=data.permitSite;if(!s)return null;
 let left:number;try{left=Math.min(...houseOutline(data).flat().map(p=>p.x))-s.leftYardFt*12;}catch{return null;}
 if(!Number.isFinite(left))return null;
 const rear=s.rearYardFt*12;return {minX:left,maxX:left+s.lotWidthFt*12,minZ:rear-s.lotDepthFt*12,maxZ:rear,...(s.corner?{corner:s.corner}:{})};
}
/** Setbacks from the lot lines (in): interior side lines, the rear line, a corner lot's street side, the front line. */
interface Setback {side:number;rear:number;street:number;front:number}
const IN_LOT:Setback={side:0,rear:0,street:0,front:0};
/** A fire: FIRE_CLEARANCE.fromPropertyLineFt (wood: a neighbour's fence or shed counts as a structure) or, for gas, its
 * combustibles clearance (a neighbour's fence counts as a combustible). Both unconfirmed defaults. */
const fireSetback=(fuel:'wood'|'gas'):Setback=>{const d=(fuel==='wood'?FIRE_CLEARANCE.fromPropertyLineFt:FIRE_CLEARANCE.gasFt)*12;return {side:d,rear:d,street:d,front:d};};
/** A raised patio and its walls, taken to be an accessory structure (ZONING_SETBACKS; whether it counts is unconfirmed). */
const RAISED_SETBACK:Setback={side:ZONING_SETBACKS.accessoryStructure.sideFt*12,rear:ZONING_SETBACKS.accessoryStructure.rearFt*12,street:ZONING_SETBACKS.accessoryStructure.exteriorSideCornerFt*12,front:ZONING_SETBACKS.accessoryStructure.frontLotLineFt*12};
/** A retaining wall: anywhere in the lot, but 0.3 m from a lot line on a street (zoning 4.9.1.1). */
const WALL_SETBACK:Setback={side:0,rear:0,street:ZONING_SETBACKS.retainingWallFromStreetLotLineFt*12,front:ZONING_SETBACKS.retainingWallFromStreetLotLineFt*12};
/** The lot line rings come closer to than their setback (the worst one), or undefined when they keep inside the lot. */
function lotShort(ctx:MoveContext,rings:P[][],s:Setback):{line:string;gapIn:number;needIn:number}|undefined{
 const lot=ctx.lot;if(!lot||!rings.some(r=>r.length))return undefined;
 const b=boxOf(rings),lines=[{line:'left side',gapIn:b.minX-lot.minX,needIn:lot.corner==='left'?s.street:s.side},{line:'right side',gapIn:lot.maxX-b.maxX,needIn:lot.corner==='right'?s.street:s.side},{line:'rear',gapIn:lot.maxZ-b.maxZ,needIn:s.rear},{line:'front',gapIn:b.minZ-lot.minZ,needIn:s.front}];
 let worst:(typeof lines)[number]|undefined;for(const l of lines)if(l.gapIn<l.needIn-1e-6&&(!worst||l.gapIn-l.needIn<worst.gapIn-worst.needIn))worst=l;
 return worst;
}
/** The least distance from rings to a lot line (in), Infinity without a lot. */
const lotGap=(ctx:MoveContext,rings:P[][])=>{const lot=ctx.lot;if(!lot)return Infinity;const b=boxOf(rings);return Math.min(b.minX-lot.minX,lot.maxX-b.maxX,lot.maxZ-b.maxZ,b.minZ-lot.minZ);};
type Gaps=Partial<Record<Occupant['kind'],number>>;
/** The first occupant closer than its gap (or, for a gap of 0, overlapping), skipping `skip`. */
function blocker(rings:P[][],occupants:Occupant[],gaps:Gaps,skip?:(o:Occupant)=>boolean):Occupant|undefined{
 const b=boxOf(rings);
 for(const o of occupants){if(skip?.(o))continue;const g=gaps[o.kind]??0;if(b.minX>o.box.maxX+g||o.box.minX>b.maxX+g||b.minZ>o.box.maxZ+g||o.box.minZ>b.maxZ+g)continue;
  if(g>0?gapBetween(rings,o.rings)<g-1e-6:overlapSqft(rings,o.rings)>.01)return o;}
 return undefined;
}

/** The move context for a design (runtime loaded, a measured site). */
export function moveContext(data:DeckData,brief:SiteBrief,opts:{northDeg?:number;tick?:()=>Promise<void>;budgetMs?:number;signal?:AbortSignal}={}):MoveContext{
 const surface=designSiteSurface(data);if(!surface)throw Error('The site designer needs a measured site.');
 const takeoff=buildDeckTakeoff(data),slope=brief.plane.slopePct;
 const house=getHouseConfig(data),walls=getHouseWalls(data),doors=house.openings.filter(o=>o.type==='Door'&&!openingHidden(o,walls,house)),door=doors.find(o=>openingWallId(o,house).endsWith('-front'))??doors[0];
 const wall=door&&walls.find(w=>w.id===openingWallId(door,house));
 let at:MoveContext['door']=door&&wall?{x:wall.a.x+(wall.b.x-wall.a.x)*door.offsetPct/100,z:wall.a.y+(wall.b.y-wall.a.y)*door.offsetPct/100,out:{x:wall.outward.x,z:wall.outward.y},label:'the door'}:null;
 if(!at){const f=takeoff.flights.find(f=>f.kind==='grade');if(f)at={x:f.end.x,z:f.end.z,out:{x:f.outward?.x??0,z:f.outward?.y??1},label:'the stair foot'};}
 const ids=new Set<string>([...(data.yardFeatures??[]).map(f=>f.id),...(data.landscapeObjects??[]).map(o=>o.id)]);
 return {data,brief,surface,takeoff,occupants:designOccupants(data,takeoff),lot:lotOf(data),door:at,down:slope>=.5?{dx:brief.plane.downhill.dx,dz:brief.plane.downhill.dz}:null,northDeg:opts.northDeg,ids,tick:opts.tick??(async()=>{}),budgetMs:opts.budgetMs,signal:opts.signal};
}
/** The parts of several moves applied to a design: replaced and added features and objects, stair changes. */
export function applyParts(data:DeckData,parts:MoveParts[]):Partial<DeckData>{
 const replace=new Map(parts.flatMap(p=>p.replaceYard).map(f=>[f.id,f])),addY=parts.flatMap(p=>p.addYard),addL=parts.flatMap(p=>p.addLandscape),out:Partial<DeckData>={};
 if(replace.size||addY.length)out.yardFeatures=[...(data.yardFeatures??[]).map(f=>replace.get(f.id)??f),...addY];
 if(addL.length)out.landscapeObjects=[...(data.landscapeObjects??[]),...addL];
 for(const p of parts)Object.assign(out,p.set);
 return out;
}
/** The context after a feasible move: the design with it, its occupants, ground and ids. */
export function withMove(ctx:MoveContext,move:SiteMove):MoveContext{
 if(!move.feasible)return ctx;
 const data={...ctx.data,...applyParts(ctx.data,[move.parts])},takeoff=Object.keys(move.parts.set).length?buildDeckTakeoff(data):ctx.takeoff,ids=new Set(ctx.ids);
 for(const f of move.parts.addYard)ids.add(f.id);for(const o of move.parts.addLandscape)ids.add(o.id);
 return {...ctx,data,takeoff,surface:designSiteSurface(data)!,occupants:designOccupants(data,takeoff),ids};
}
function freshId(ctx:MoveContext,base:string,local:Set<string>){let id=base,k=2;while(ctx.ids.has(id)||local.has(id))id=`${base}-${k++}`;local.add(id);return id;}
const covered=(ctx:MoveContext,rings:P[][])=>ctx.surface.extrema(rings,'existing').complete;
const ground=(ctx:MoveContext,x:number,z:number)=>{const h=ctx.surface.sample(x,z,'existing');return h===undefined||!Number.isFinite(h)?undefined:h;};
/** "Measure about N ft further …" for rings that run off the survey, or '' when they are inside it. */
export function measureFurther(ctx:MoveContext,rings:P[][],why:string){
 const out=densify(rings,12).filter(p=>ground(ctx,p.x,p.y)===undefined);if(!out.length)return '';
 const cov=ctx.surface.coverage,far=Math.max(...out.map(p=>edgeGap(cov,p))),b=boxOf(cov),mx=out.reduce((n,p)=>n+p.x,0)/out.length,mz=out.reduce((n,p)=>n+p.y,0)/out.length;
 return `Measure about ${Math.max(1,Math.ceil(far/12))} ft further ${towardWords(mx-(b.minX+b.maxX)/2,mz-(b.minZ+b.maxZ)/2)}: ${why}.`;
}
/** How far rings run past the measured ground (in), 0 inside it: ranks spots for a measure-further message. */
const outsideReach=(ctx:MoveContext,rings:P[][])=>{const out=densify(rings,24).filter(p=>ground(ctx,p.x,p.y)===undefined);return out.length?Math.max(...out.map(p=>edgeGap(ctx.surface.coverage,p))):0;};
/** Least-squares grade of the measured ground inside rings: percent and the unit direction it falls. */
function slopeOver(ctx:MoveContext,rings:P[][],step=12){
 const b=boxOf(rings),pts:{x:number;z:number;h:number}[]=[];
 for(let x=b.minX+step/2;x<b.maxX;x+=step)for(let z=b.minZ+step/2;z<b.maxZ;z+=step){if(!inRings(rings,{x,y:z}))continue;const h=ground(ctx,x,z);if(h!==undefined)pts.push({x,z,h});}
 if(pts.length<3)return {pct:0,dx:0,dz:0};
 const m=pts.reduce((s,p)=>({x:s.x+p.x/pts.length,z:s.z+p.z/pts.length,h:s.h+p.h/pts.length}),{x:0,z:0,h:0});let xx=0,xz=0,zz=0,xh=0,zh=0;
 for(const p of pts){const a=p.x-m.x,c=p.z-m.z,e=p.h-m.h;xx+=a*a;xz+=a*c;zz+=c*c;xh+=a*e;zh+=c*e;}
 const det=xx*zz-xz*xz,gx=det?(xh*zz-zh*xz)/det:0,gz=det?(zh*xx-xh*xz)/det:0,g=Math.hypot(gx,gz);
 return {pct:r1(g*100),dx:g?-gx/g:0,dz:g?-gz/g:0};
}
/** The brief zone a point lies in (else the nearest by centroid): what the reasons cite. */
export function zoneAt(brief:SiteBrief,x:number,z:number):SiteBriefZone|undefined{
 return brief.zones.find(zn=>inRing(zn.polygon.map(([a,b])=>({x:a,y:b})),{x,y:z}))??[...brief.zones].sort((p,q)=>Math.hypot(p.centroid.x-x,p.centroid.z-z)-Math.hypot(q.centroid.x-x,q.centroid.z-z))[0];
}
/** How far a graded bank reaches from a patio edge standing `h` in off ground of `slopePct`: at the default 3:1 it
 * meets ground falling away (or rising toward it) later than on the level, plus a foot of margin (in). */
const bankReach=(h:number,slopePct:number)=>Math.min(GROUND_FIT_LIMITS.maxBankRunIn,h/Math.max(.08,1/GROUND_FIT_LIMITS.defaultRatio-Math.min(.25,slopePct/100)))+12;
/** The yard model's graded-bank pad for a patio added to the design (status 'ready' when it stays on measured ground). */
const padOf=(ctx:MoveContext,f:YardFeature)=>designSiteSurface({...ctx.data,yardFeatures:[...(ctx.data.yardFeatures??[]).filter(g=>g.id!==f.id),f]})?.featurePadModels?.find(m=>m.featureId===f.id);
const compare=(a:number[],b:number[])=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
const EMPTY:MoveParts={addYard:[],replaceYard:[],addLandscape:[],set:{}};
function infeasible(kind:SiteMoveKind,title:string,params:Record<string,MoveValue>,reason:string,notes:string[]=[],metrics:Record<string,MoveValue>={}):SiteMove{return {id:kind,kind,title,patch:{},params,feasible:false,reason,notes,metrics,parts:{...EMPTY,set:{}},footprints:[],explains:[]};}
function feasible(ctx:MoveContext,kind:SiteMoveKind,title:string,params:Record<string,MoveValue>,parts:MoveParts,footprints:MoveFootprint[],notes:string[],metrics:Record<string,MoveValue>,explains:string[]=[]):SiteMove{
 return {id:kind,kind,title,patch:applyParts(ctx.data,[parts]),params,feasible:true,notes,metrics,parts,footprints,explains};
}
// ---------------------------------------------------------------------------------------------------------------
// Ground fit: the best priced option of groundFit.ts for the stair landing (or the patio nearest the door).
/** Ground fit's time limit inside a move: a safety stop only (see groundFitMove). */
export const GROUND_FIT_SAFETY_MS=20000;
/** The patio a stair lands on, else the enabled flat patio nearest the door. */
export function landingOf(ctx:MoveContext):YardFeature|undefined{
 const flat=(f:YardFeature)=>f.kind==='patio'&&f.enabled&&!f.stoneSteps&&!f.stepAssembly,patios=(ctx.data.yardFeatures??[]).filter(flat);
 const target=(ctx.data.stairTargets??[]).find(t=>t.surface==='patio'&&patios.some(p=>p.id===t.patioId));
 if(target)return patios.find(p=>p.id===target.patioId);
 const d=ctx.door;return d?[...patios].sort((a,b)=>Math.hypot(a.xFt*12-d.x,a.zFt*12-d.z)-Math.hypot(b.xFt*12-d.x,b.zFt*12-d.z)||a.id.localeCompare(b.id))[0]:patios[0];
}
export async function groundFitMove(ctx:MoveContext,params:Record<string,MoveValue>={}):Promise<SiteMove>{
 const title='Fit the landing to the ground',landing=typeof params.featureId==='string'?(ctx.data.yardFeatures??[]).find(f=>f.id===params.featureId):landingOf(ctx);
 const p:Record<string,MoveValue>={featureId:landing?.id??null,optionId:typeof params.optionId==='string'?params.optionId:'best'};
 if(!landing)return infeasible('ground-fit',title,p,'There is no stair landing or flat patio to fit to the ground.');
 const {groundFitOptions}=await import('./groundFit');
 // The search space is finite (levels, riser counts, stair slides, at most 12 priced): it runs in full, so the pick is
 // the same on any machine. Its time limit is only a safety stop, set well past a full search (about 1 s here), never
 // below the caller's budget; when it is hit the move says so (searchStoppedEarly) and the pick may then vary.
 const r=await groundFitOptions(ctx.data,{featureId:landing.id,budgetMs:Math.max(GROUND_FIT_SAFETY_MS,ctx.budgetMs??0),...(ctx.signal?{signal:ctx.signal}:{})});
 const stoppedEarly=r.warnings.some(w=>/stopped at its time limit/.test(w));
 if(r.status!=='ready'||!r.options.length)return infeasible('ground-fit',title,p,r.warnings[0]??'Ground fit found nothing to offer.');
 // The best option (groundFit.ts order: no new quoted work first, then price) whose bank stays on measured ground.
 const ready=r.options.filter(o=>o.metrics.status==='ready'),chosen=(p.optionId!=='best'&&r.options.find(o=>o.id===p.optionId))||ready.find(o=>o.id!=='current')||ready[0];
 if(!chosen){const o=r.options[1]??r.options[0],f=o.patch.yardFeatures?.find(g=>g.id===landing.id)??landing,b=boxOf(yardFeatureOutline(f));
  return infeasible('ground-fit',title,p,measureFurther(ctx,[boxRing(b,o.metrics.bankRunIn+6)],`every way of fitting the ${landing.name.toLowerCase()} grades a bank past the measured ground`)||'Every way of fitting the landing grades a bank past the measured ground: extend the survey round it.',o.lines);}
 const next=chosen.patch.yardFeatures?.find(f=>f.id===landing.id)??landing;
 const set:MoveParts['set']={};for(const k of ['stairTargets','stairOffset','height'] as const)if(chosen.patch[k]!==undefined)(set as Record<string,unknown>)[k]=chosen.patch[k];
 const others=r.options.filter(o=>o!==chosen).slice(0,3).map(o=>`${o.title} (${o.deltaFromCurrent>=0?'+':'−'}$${Math.abs(o.deltaFromCurrent).toFixed(0)})`);
 const m=chosen.metrics;p.optionId=chosen.id;
 return feasible(ctx,'ground-fit',chosen.title,p,{addYard:[],replaceYard:[next],addLandscape:[],set},[{id:next.id,rings:yardFeatureOutline(next)}],
  [...chosen.lines,...(others.length?[`Also possible: ${others.join('; ')}.`]:[]),...r.warnings.filter(w=>!/stopped at its time limit/.test(w)),...(stoppedEarly?[`The ground-fit search stopped early at its ${Math.max(GROUND_FIT_SAFETY_MS,ctx.budgetMs??0)/1000} s safety limit before trying every variation, so a faster device may pick a different option.`]:[])],
  {optionId:chosen.id,featureId:landing.id,landingIn:m.landingIn,risers:m.risers,riseIn:m.riseIn===null?null:r2(m.riseIn),deckTopIn:m.deckTopIn,stairOffsetPct:m.stairOffsetPct,bankCutYd3:r2(m.bankCutYd3),bankFillYd3:r2(m.bankFillYd3),bankRunIn:r1(m.bankRunIn),edgeLf:m.edgeLf,edgeMaxIn:m.edgeMaxIn,bankStatus:m.status,fitDelta:chosen.deltaFromCurrent,optionCount:r.options.length,searchStoppedEarly:stoppedEarly});
}

// ---------------------------------------------------------------------------------------------------------------
// Fire room: a gas bowl on a level patio in the flattest open ground 10–25 ft from the door, clear of the house, the
// deck and its stairs by FIRE_CLEARANCE (and of the lot lines, when the design has them); siteConcepts adds a seat wall
// round its uphill side. A design that already has an enabled fire feature gets no second one: the room is built round
// it where it stands on its own pad on suitable ground, otherwise the move says why not.
/** The design's own enabled fire feature (the one nearest the door), which an outdoor room builds round. */
function existingFire(ctx:MoveContext):YardFeature|undefined{
 const d=ctx.door,fires=(ctx.data.yardFeatures??[]).filter(f=>f.enabled&&f.kind==='fire-feature'&&fireProduct(f));
 return [...fires].sort((a,b)=>(d?Math.hypot(a.xFt*12-d.x,a.zFt*12-d.z)-Math.hypot(b.xFt*12-d.x,b.zFt*12-d.z):0)||a.id.localeCompare(b.id))[0];
}
/** "18.4 ft from the house, 13.4 ft from the deck and 11.3 ft from the stair" (what there is). */
function gapWords(g:{gh:number;gd:number;gs:number}){
 const parts=([[g.gh,'the house'],[g.gd,'the deck'],[g.gs,'the stair']] as const).filter(([v])=>Number.isFinite(v)).map(([v,l])=>`${ft(v)} ft from ${l}`);
 return parts.length?parts.length>1?`${parts.slice(0,-1).join(', ')} and ${parts.at(-1)}`:parts[0]:'clear of the house, deck and stairs';
}
export async function fireRoomMove(ctx:MoveContext,params:Record<string,MoveValue>={}):Promise<SiteMove>{
 const mine=existingFire(ctx),productId=mine?mine.productId:pick(params,'fire-room','product'),product=FIRE_PRODUCTS.find(f=>f.id===productId)!,S0=Math.round(num(params,'fire-room','patioFt'))*12,near=num(params,'fire-room','minDoorFt')*12,far=Math.max(near+24,num(params,'fire-room','maxDoorFt')*12);
 const p:Record<string,MoveValue>={product:product.id,patioFt:S0/12,minDoorFt:near/12,maxDoorFt:far/12,productId:pick(params,'fire-room','productId')};
 const titled=(S:number)=>mine?`Fire room round “${mine.name}” on a ${S/12} ft patio`:`Fire room: ${product.name.toLowerCase()} on a ${S/12} ft patio`;
 let title=titled(S0);const fuel=product.fuel,clear=FIRE_MIN_CLEARANCE_FT[fuel]*12,confirmed=FIRE_CLEARANCE.confirmedValues[fuel==='wood'?'woodFt':'gasFt'],lotSet=fireSetback(fuel);
 const rules=[fuel==='gas'?'Gas: Barrie needs no burn permit for a gas fire bowl or table; the gas line and hook-up are by a TSSA-registered gas contractor (priced as its own line).':`A wood-burning ring is taken to be an approved enclosed appliance: ${FIRE_CLEARANCE.woodFt} ft (4 m) from the house, the deck and its stairs, and a yearly City of Barrie permit.`,
  `An open wood fire pit is not offered: Barrie needs a daily open-air permit and ${Math.round(FIRE_CLEARANCE.openWoodFireFt*.3048)} m (${Math.round(FIRE_CLEARANCE.openWoodFireFt)} ft) from any building.`];
 const door=ctx.door;if(!door)return infeasible('fire-room',title,p,'Mark the door on the house (or add a stair) so the fire room can be placed within reach of it.',rules);
 const bw=product.round?Math.min(product.max,Math.max(product.min,42)):60,bd=product.round?bw:20,gaps:Gaps={house:36,deck:36,stair:36,feature:24,bed:12,plant:6,pool:36};
 const rings=(k:Occupant['kind'])=>ctx.occupants.filter(o=>o.kind===k).flatMap(o=>o.rings),houseRings=rings('house'),deckRings=rings('deck'),stairRings=rings('stair');
 /** The fire's distance from the house, the deck and its stairs (in; Infinity where there is none). */
 const clearOf=(fire:P[])=>({gh:houseRings.length?gapBetween([fire],houseRings):Infinity,gd:deckRings.length?gapBetween([fire],deckRings):Infinity,gs:stairRings.length?gapBetween([fire],stairRings):Infinity});
 const lotWords=ctx.lot?`, ${lotSet.side/12} ft from the lot lines`:'';
 // Up: away from the measured fall; on level ground, away from the door.
 const upAt=(x:number,z:number)=>{if(ctx.down)return {x:-ctx.down.dx,y:-ctx.down.dz};const l=Math.hypot(x-door.x,z-door.z)||1;return {x:(x-door.x)/l,y:(z-door.z)/l};};
 // The fire's body: a round bowl, or a linear table with its long side across the slope.
 const body=(x:number,z:number,up:P)=>fireOutline({xFt:x/12,zFt:z/12,widthFt:bw/12,depthFt:bd/12,rotationDeg:product.round?0:Math.atan2(up.x,-up.y)*180/Math.PI,productId:product.id} as YardFeature);
 let outside:{rings:P[][];reach:number}|undefined,S=S0;
 const local=new Set<string>(),pid=freshId(ctx,'s3-fire-patio',local);
 const patioAt=(c:{cx:number;cz:number;level:number}):YardFeature=>({id:pid,kind:'patio',name:'Fire room patio',enabled:true,xFt:c.cx/12,zFt:c.cz/12,widthFt:S/12,depthFt:S/12,heightIn:0,rotationDeg:0,productId:p.productId as string,color:'#9a8f80',finishedElevationIn:c.level,patioSlope:{xPct:0,zPct:0},groundFit:{slopeRatio:GROUND_FIT_LIMITS.defaultRatio}});
 /** The patio's measured ground at (cx, cz): its level, relief and graded reach; null (an off-survey reach remembered for
  * a measure-further message) when it runs off the measured ground or varies more than 24 in. */
 const groundAt=(cx:number,cz:number)=>{
  const patio=rect(cx,cz,S,S),e=ctx.surface.extrema([patio],'existing'),relief=e.max-e.min,level=e.complete?q4(ground(ctx,cx,cz)??(e.min+e.max)/2):0,bank=e.complete?bankReach(Math.max(level-e.min,e.max-level),slopeOver(ctx,[patio],24).pct):12,reach=[boxRing(boxOf([patio]),bank)];
  if(!e.complete||!covered(ctx,[boxRing(boxOf([patio]),12)])){const far=outsideReach(ctx,reach);if(!outside||far<outside.reach)outside={rings:reach,reach:far};return null;}
  return relief>24?null:{relief,level,reach};
 };
 const clearanceNote=(g:{gh:number;gd:number;gs:number},name:string,fire:P[])=>[`The ${name.toLowerCase()} stands ${gapWords(g)} (at least ${clear/12} ft${confirmed?', City of Barrie rule':', an unconfirmed default: confirm with Barrie Fire and the unit manual'}).`,
  ...(ctx.lot?[`It stands ${ft(lotGap(ctx,[fire]))} ft inside the lot lines as entered (at least ${lotSet.side/12} ft: ${fuel==='wood'?'a neighbour\'s fence or shed counts as a structure':'a neighbour\'s fence counts as a combustible'}; an unconfirmed default).`]:[])];
 const metricsOf=(c:{cx:number;cz:number;level:number;relief:number},g:{gh:number;gd:number;gs:number},fireId:string,bx:number,bz:number,up:P,dist:number,fire:P[])=>{const zone=zoneAt(ctx.brief,c.cx,c.cz),slope=slopeOver(ctx,[rect(c.cx,c.cz,S,S)]);
  return {slope,metrics:{patioId:pid,fireId,fuel,levelIn:c.level,reliefIn:r1(c.relief),slopePct:slope.pct,doorFt:ft(dist),houseGapFt:Number.isFinite(g.gh)?ft(g.gh):null,deckGapFt:Number.isFinite(g.gd)?ft(g.gd):null,stairGapFt:Number.isFinite(g.gs)?ft(g.gs):null,lotGapFt:ctx.lot?ft(lotGap(ctx,[fire])):null,clearanceFt:clear/12,clearanceConfirmed:confirmed,zone:zone?.id??null,zoneKind:zone?.kind??null,zoneSlopePct:zone?.slopePct??null,zoneSqft:zone?.areaSqft??null,bowlX:r1(bx),bowlZ:r1(bz),upX:r2(up.x),upZ:r2(up.y),areaSqft:r1(S*S/144),reusedFireId:mine?mine.id:null} as Record<string,MoveValue>};};

 if(mine){
  // Round the design's own fire: it keeps its place, product and clearances; the patio goes round it.
  const mb=fireOutline(mine),fx=mine.xFt*12,fz=mine.zFt*12,g=clearOf(mb),closest=Math.min(g.gh,g.gd,g.gs),lot=lotShort(ctx,[mb],lotSet),dist=Math.hypot(fx-door.x,fz-door.z);
  const keep='move it and the outdoor room is built round it; a second fire is not added';
  if(closest<clear){const what=closest===g.gs?'the stair':closest===g.gd?'the deck':'the house';return infeasible('fire-room',title,p,`${mine.name} ${closest<=0?`overlaps ${what}`:`stands ${ft(closest)} ft from ${what}, inside its ${clear/12} ft clearance`}: ${keep}.`,rules);}
  if(lot)return infeasible('fire-room',title,p,`${mine.name} stands ${ft(Math.max(0,lot.gapIn))} ft from the ${lot.line} lot line, closer than ${ft(lot.needIn)} ft: ${keep}.`,rules);
  const support=mine.supportFeatureId?(ctx.data.yardFeatures??[]).find(f=>f.id===mine.supportFeatureId&&f.kind==='patio'&&f.enabled):undefined;
  if(support)return infeasible('fire-room',title,p,`${mine.name} already stands on ${support.name}, so the outdoor room adds no second fire: add a seat wall round it on ${support.name} instead.`,rules);
  const up=upAt(fx,fz),self=(o:Occupant)=>o.id===`yard:${mine.id}`;
  type Round={cx:number;cz:number;level:number;relief:number;reach:P[][];score:number[]};let found:Round|undefined,partial:Round|undefined;
  // The patio a foot uphill of the fire (room for the seat wall), slid up to 18 in round that; 2 ft smaller where it
  // does not fit. The fire's body stays a foot inside the paving.
  for(S=S0;S>=144&&!found;S-=24){
   const spots:Round[]=[];
   for(let dx=-18;dx<=18;dx+=6)for(let dz=-18;dz<=18;dz+=6){
    const cx=fx+up.x*12+dx,cz=fz+up.y*12+dz,half=S/2-12;if(!mb.every(q=>Math.abs(q.x-cx)<=half+1e-9&&Math.abs(q.y-cz)<=half+1e-9))continue;
    const patio=rect(cx,cz,S,S);if(blocker([patio],ctx.occupants,gaps,self)||lotShort(ctx,[patio],IN_LOT))continue;
    const c=groundAt(cx,cz);if(c)spots.push({cx,cz,...c,score:[r0(c.relief),r0(Math.hypot(dx,dz)),r0(cz),r0(cx)]});
   }
   spots.sort((a,b)=>compare(a.score,b.score));
   for(const s of spots.slice(0,10)){await ctx.tick();if(padOf(ctx,patioAt(s))?.status==='ready'){found=s;break;}partial??=s;}
  }
  if(found)S+=24;
  if(!found){S=S0;const need=`a ${S/12} ft level patio round it on open, measured ground with its graded bank on measured ground`,miss=partial?.reach??outside?.rings;
   const further=miss&&measureFurther(ctx,miss,`a fire room round ${mine.name} needs ${need}`);
   return infeasible('fire-room',title,p,further?`${further} ${mine.name} stays where it is: a second fire is not added.`:`No open measured ground round ${mine.name} fits ${need}: ${keep}.`,rules);}
  title=titled(S);p.patioFt=S/12;
  const patio=validateYardFinishedSettings(patioAt(found)),moved:YardFeature={...mine,supportFeatureId:pid},m=metricsOf(found,g,mine.id,fx,fz,up,dist,mb);
  return feasible(ctx,'fire-room',title,p,{addYard:[patio],replaceYard:[moved],addLandscape:[],set:{}},[{id:pid,rings:yardFeatureOutline(patio),on:[mine.id]},{id:mine.id,rings:[mb],on:[pid]}],
   [`${mine.name}, already in the design, stays where it is: a ${S/12} × ${S/12} ft patio set level at ${signed(found.level)} in is built round it, so it stands on the paving instead of its own gravel pad, ${ft(dist)} ft from ${door.label}. The measured ground varies ${r1(found.relief)} in under the patio (${m.slope.pct} %) and is graded round it at ${GROUND_FIT_LIMITS.defaultRatio}:1. No second fire is added.`,
    ...clearanceNote(g,mine.name,mb),...rules],m.metrics,[`^${esc(mine.name)}: (Gas hook-up|Open wood fire pits)`]);
 }

 const evaluate=(cx:number,cz:number)=>{
  const up=upAt(cx,cz),bx=cx-up.x*12,bz=cz-up.y*12,dist=Math.hypot(bx-door.x,bz-door.z);if(dist<near||dist>far)return null;
  const patio=rect(cx,cz,S,S);if(blocker([patio],ctx.occupants,gaps)||lotShort(ctx,[patio],IN_LOT))return null;
  const fire=body(bx,bz,up),g=clearOf(fire);if(Math.min(g.gh,g.gd,g.gs)<clear||lotShort(ctx,[fire],lotSet))return null;
  const c=groundAt(cx,cz);if(!c)return null;
  return {cx,cz,bx,bz,up,dist,...c,...g,fire,score:[r0(c.relief),r0(Math.abs(dist-180)/12),r0(cz),r0(cx)]};
 };
 // Every spot on a 2 ft grid, best first; each of the best few is refined on a 6 in grid round it and kept only when
 // its graded bank stays on the measured ground (the yard model's own pad grading, as ground fit reads it).
 const box={minX:door.x-far,maxX:door.x+far,minZ:door.z-far,maxZ:door.z+far},fid=freshId(ctx,'s3-fire-bowl',local);
 type Spot=NonNullable<ReturnType<typeof evaluate>>;let best:Spot|undefined,partial:Spot|undefined,n=0;
 // The size asked for, then 2 ft smaller (not under 12 ft) where it does not fit.
 for(S=S0;S>=144&&!best;S-=24){
  const found:Spot[]=[];
  for(let x=Math.ceil(box.minX/24)*24;x<=box.maxX;x+=24)for(let z=Math.ceil(box.minZ/24)*24;z<=box.maxZ;z+=24){const c=evaluate(x,z);if(c)found.push(c);if(++n%24===0)await ctx.tick();}
  found.sort((a,b)=>compare(a.score,b.score));const seen=new Set<string>();
  for(const c of found.slice(0,10)){
   let at=c;for(let dx=-18;dx<=18;dx+=6)for(let dz=-18;dz<=18;dz+=6){const r=dx||dz?evaluate(c.cx+dx,c.cz+dz):null;if(r&&compare(r.score,at.score)<0)at=r;}
   if(seen.has(`${at.cx}:${at.cz}`))continue;seen.add(`${at.cx}:${at.cz}`);await ctx.tick();
   const pad=padOf(ctx,patioAt(at));if(pad?.status==='ready'){best=at;break;}partial??=at;
  }
 }
 if(best){S+=24;p.patioFt=S/12;title=titled(S);}
 if(!best){S=S0;const why=`a fire room needs a ${S/12} ft level patio ${near/12}–${far/12} ft from the door, at least ${clear/12} ft from the house, the deck and its stairs${lotWords}, with its graded bank on measured ground`,miss=partial?.reach??outside?.rings;
  return infeasible('fire-room',title,p,miss?measureFurther(ctx,miss,why)||`No open measured ground fits: ${why}.`:`No open ground fits: ${why}.`,rules);}
 const patio=validateYardFinishedSettings(patioAt(best));
 const name=fuel==='gas'?(product.round?'Gas fire bowl':'Linear gas fire table'):'Wood-burning fire ring';
 const bowl=validateYardFinishedSettings({id:fid,kind:'fire-feature',name,enabled:true,xFt:best.bx/12,zFt:best.bz/12,widthFt:bw/12,depthFt:bd/12,heightIn:16,rotationDeg:product.round?0:r2(Math.atan2(best.up.x,-best.up.y)*180/Math.PI),productId:product.id,color:'#aaa69b',supportFeatureId:pid});
 const m=metricsOf(best,best,fid,best.bx,best.bz,best.up,best.dist,best.fire);
 return feasible(ctx,'fire-room',title,p,{addYard:[patio,bowl],replaceYard:[],addLandscape:[],set:{}},[{id:pid,rings:yardFeatureOutline(patio)},{id:fid,rings:[best.fire],on:[pid]}],
  [`A ${S/12} × ${S/12} ft patio set level at ${signed(best.level)} in, ${ft(best.dist)} ft from ${door.label}, where the measured ground varies ${r1(best.relief)} in under it (${m.slope.pct} %); the ground round it is graded at ${GROUND_FIT_LIMITS.defaultRatio}:1.`,
   ...clearanceNote(best,name,best.fire),...rules],
  m.metrics,[`^${esc(name)}: (Gas hook-up|Open wood fire pits)`]);
}

// ---------------------------------------------------------------------------------------------------------------
// Seat wall: a freestanding arc on the fire room's paving, round the uphill side of the fire.
/** The whole-course height a seat wall is built to on paving, from its own construction (wallConstructionPlan: the
 * product's course and cap, the count rounded up as the yard model builds it): of the whole-course heights within the
 * seat-wall range (MOVE_PARAMS 16–24 in), the one nearest the height asked for, ties to the 18–20 in seat target
 * (SEAT_WALL); outside the range only when no whole-course height falls in it. */
function seatHeight(wall:YardFeature,asked:number){
 const plan=(h:number)=>wallConstructionPlan({...wall,heightIn:h,finishedElevationIn:undefined},0,[0],true),{course,cap}=plan(asked);
 const [lo,hi]=MOVE_PARAMS['seat-wall'].heightIn as readonly [number,number,number],[a,b]=SEAT_WALL.heightIn,off=(v:number)=>v<a?a-v:v>b?v-b:0;
 const heights=Array.from({length:8},(_,i)=>({courses:i+1,exactIn:(i+1)*course+cap,builtIn:r2((i+1)*course+cap)})).filter(h=>plan(h.exactIn).count===h.courses);
 const inRange=heights.filter(h=>h.builtIn>=lo-1e-9&&h.builtIn<=hi+1e-9),pool=inRange.length?inRange:heights;
 const chosen=[...pool].sort((p,q)=>Math.abs(p.builtIn-asked)-Math.abs(q.builtIn-asked)||off(p.builtIn)-off(q.builtIn)||p.builtIn-q.builtIn)[0];
 const below=heights.filter(h=>h.builtIn<a-1e-9).at(-1),above=heights.find(h=>h.builtIn>b+1e-9);
 return {...chosen,courseIn:r2(course),capIn:r2(cap),inTarget:off(chosen.builtIn)===0,inRange:inRange.length>0,below:below?.builtIn,above:above?.builtIn};
}
export async function seatWallMove(ctx:MoveContext,fire:SiteMove|undefined,params:Record<string,MoveValue>={}):Promise<SiteMove>{
 const h=num(params,'seat-wall','heightIn'),R0=num(params,'seat-wall','radiusIn'),sweep0=num(params,'seat-wall','sweepDeg'),p:Record<string,MoveValue>={heightIn:h,radiusIn:R0,sweepDeg:sweep0};
 const generic:YardFeature={id:'',kind:'retaining-wall',name:'Seat wall',enabled:true,xFt:0,zFt:0,widthFt:8,depthFt:1,heightIn:h,rotationDeg:0,productId:'segmental-concrete',color:'#aaa69b',wallConstruction:{freestanding:true}};
 const seat=seatHeight(generic,h),title=`Seat wall round the fire, ${seat.builtIn} in high`;
 // The fire room's patio and its fire: a new one, or the design's own fire it was built round.
 const patio=fire?.feasible?fire.parts.addYard.find(f=>f.kind==='patio'):undefined,bowl=fire?.feasible?[...fire.parts.addYard,...fire.parts.replaceYard].find(f=>f.kind==='fire-feature'):undefined;
 if(!patio||!bowl)return infeasible('seat-wall',title,p,'A seat wall curves round a fire room: place the fire room first.');
 const c={x:bowl.xFt*12,y:bowl.zFt*12},up={x:Number(fire!.metrics.upX),y:Number(fire!.metrics.upZ)},ang=Math.atan2(up.y,up.x),pb=boxOf(yardFeatureOutline(patio)),inner={minX:pb.minX+2,maxX:pb.maxX-2,minZ:pb.minZ+2,maxZ:pb.maxZ-2};
 const local=new Set<string>(),id=freshId(ctx,'s3-seat-wall',local);
 const target=`${SEAT_WALL.heightIn[0]}–${SEAT_WALL.heightIn[1]} in`,range=`${MOVE_PARAMS['seat-wall'].heightIn[0]}–${MOVE_PARAMS['seat-wall'].heightIn[1]} in`;
 const heightNote=`It is built in whole courses: ${seat.courses} course${seat.courses>1?'s':''} of ${seat.courseIn} in and a ${seat.capIn} in cap come to ${seat.builtIn} in to the top of the cap. `
  +(seat.inTarget?`That is within the ${target} seat target.`:`${target} is the seat target, but this wall's ${seat.courseIn} in courses build ${[seat.below,seat.above].filter(v=>v!==undefined).join(' or ')} in, not ${target}, so ${seat.builtIn} in is the nearest.`)
  +(Math.abs(seat.builtIn-h)>.05?` (${h} in was asked for: ${seat.inRange?`${seat.builtIn} in is the nearest whole-course height in the ${range} seat-wall range`:`no whole-course height falls in the ${range} seat-wall range`}.)`:'')+' Both faces are finished; its second face is quoted.';
 for(let R=R0;R>=60;R-=6)for(let sweep=sweep0;sweep>=60;sweep-=10){
  await ctx.tick();
  const half=sweep/2*Math.PI/180,a={x:c.x+R*Math.cos(ang-half),y:c.y+R*Math.sin(ang-half)},b={x:c.x+R*Math.cos(ang+half),y:c.y+R*Math.sin(ang+half)},chord=Math.hypot(b.x-a.x,b.y-a.y),sag=R*(1-Math.cos(half)),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  for(const sign of [1,-1]){
   const ends=[{x:-r2(chord/2),y:0},{x:r2(chord/2),y:0}],bulge=r2(sign*sag);
   // heightIn is the built whole-course height, so the yard model lays exactly that many courses on the paving.
   const wall:YardFeature={...generic,id,xFt:mid.x/12,zFt:mid.y/12,widthFt:arcGeometry(ends[0],ends[1],bulge).lengthIn/12,heightIn:seat.exactIn,rotationDeg:r2(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI),wallPath:ends,curves:[{edge:0,bulgeIn:bulge}]};
   // The arc's apex (farthest from the chord line) must lie away from the fire; else it bulges toward it: the other sign.
   const path=yardWallPath(wall),dir={x:(b.x-a.x)/chord,y:(b.y-a.y)/chord},apex=path.reduce((f,q)=>Math.abs((q.x-a.x)*dir.y-(q.y-a.y)*dir.x)>Math.abs((f.x-a.x)*dir.y-(f.y-a.y)*dir.x)?q:f,path[0]);
   if(Math.hypot(apex.x-c.x,apex.y-c.y)<Math.hypot(mid.x-c.x,mid.y-c.y)+1)continue;
   const env=yardPathEnvelope(path,14);if(!env.flat().every(q=>q.x>=inner.minX&&q.x<=inner.maxX&&q.y>=inner.minZ&&q.y<=inner.maxZ))break;
   if(wallConstructionProblem(wall))break;
   const uphill=ground(ctx,c.x+up.x*R,c.y+up.y*R);
   return feasible(ctx,'seat-wall',title,{...p,radiusIn:R,sweepDeg:sweep},{addYard:[wall],replaceYard:[],addLandscape:[],set:{}},[{id,rings:env,on:[patio.id]}],
    [`A freestanding seat wall on the paving, an arc ${ft(R)} ft from the fire round its uphill side (${ft(arcGeometry(ends[0],ends[1],bulge).lengthIn)} ft of seat).`,heightNote],
    {wallId:id,patioId:patio.id,radiusIn:R,sweepDeg:sweep,lengthFt:ft(arcGeometry(ends[0],ends[1],bulge).lengthIn),heightIn:h,builtHeightIn:seat.builtIn,courses:seat.courses,courseIn:seat.courseIn,capIn:seat.capIn,inSeatTarget:seat.inTarget,uphillGroundIn:uphill===undefined?null:r1(uphill),patioLevelIn:patio.finishedElevationIn??null},
    [`^Freestanding seat wall on ${esc(patio.name)}`,`^${esc('Seat wall')}: Freestanding seat wall`]);
  }
 }
 return infeasible('seat-wall',title,p,'The fire room patio has no room for a seat wall round the fire; make the patio larger.');
}

// ---------------------------------------------------------------------------------------------------------------
// Raised patio: a patio level with the stair landing (or the stair foot, or a step below the door) beside it where the
// ground drops, held by a retaining wall where it stands more than 16 in (raisedPatio.ts), a stone edge course on lower
// raised sides, and a guard where GUARD requires one: more than 23.6 in above the lowest ground within 1.2 m of an edge,
// or that ground falling steeper than 1 in 2. Walls built over 36 in (an engineered wall) are never offered.
interface Access {ring:P[];level:number;label:string;occupant?:string}
function accessOf(ctx:MoveContext):Access|undefined{
 const landing=landingOf(ctx),target=landing&&(ctx.data.stairTargets??[]).find(t=>t.surface==='patio'&&t.patioId===landing.id);
 if(landing&&target&&typeof landing.finishedElevationIn==='number')return {ring:yardFeatureOutline(landing)[0],level:landing.finishedElevationIn,label:'stair landing',occupant:`yard:${landing.id}`};
 const f=ctx.takeoff.flights.find(f=>f.kind==='grade');
 if(f){const out=f.outward??{x:0,y:1},w=f.width||36;return {ring:rect(f.end.x+out.x*18,f.end.z+out.y*18,Math.abs(out.y)>.5?w:36,Math.abs(out.y)>.5?36:w),level:q4(f.end.y),label:'stair foot'};}
 const sill=ctx.brief.house.sillIn,d=ctx.door;
 if(d&&typeof sill==='number')return {ring:rect(d.x+d.out.x*24,d.z+d.out.z*24,48,48),level:q4(sill-7),label:'door'};
 return undefined;
}
/** The side of an axis-aligned patio an outward normal names, as seen from the yard. */
const sideOf=(out:P)=>Math.abs(out.y)>=Math.abs(out.x)?(out.y>0?'front':'back'):(out.x>0?'right':'left');
/** Why no raised patio fits, in the order a spot meets them: the furthest any spot got is the reason given. */
const RAISED_STAGES=['blocked','lot','coverage','cut','flat','short','tall','wall-coverage','wall-blocked','wall-lot'] as const;
export async function raisedPatioMove(ctx:MoveContext,params:Record<string,MoveValue>={}):Promise<SiteMove>{
 const W0=num(params,'raised-patio','widthFt')*12,D0=num(params,'raised-patio','depthFt')*12,threshold=num(params,'raised-patio','wallAboveIn');
 const p:Record<string,MoveValue>={widthFt:W0/12,depthFt:D0/12,wallAboveIn:threshold,productId:pick(params,'raised-patio','productId')};
 const access=accessOf(ctx);if(!access)return infeasible('raised-patio',`Raised patio, ${W0/12} × ${D0/12} ft`,p,'A raised patio starts level with a stair landing, a stair foot or the door: there is none here.');
 const A=boxOf([access.ring]),gaps:Gaps={house:24,deck:6,stair:6,feature:6,bed:6,plant:0,pool:24},local=new Set<string>(),id=freshId(ctx,'s3-raised-patio',local),wallId=freshId(ctx,'s3-raised-patio-wall',local);
 const others=ctx.occupants.filter(o=>o.kind!=='house'&&o.id!==access.occupant);
 const skip=(x:number,z:number)=>inRing(access.ring,{x,y:z})||others.some(o=>inRings(o.rings,{x,y:z}));
 // Open ground for the guard: not the access, the house, the deck, a stair, a yard feature or a pool (beds are ground).
 const structures=ctx.occupants.filter(o=>o.id!==access.occupant&&o.kind!=='bed'&&o.kind!=='plant');
 const open=(x:number,z:number)=>!inRing(access.ring,{x,y:z})&&!structures.some(o=>x>=o.box.minX&&x<=o.box.maxX&&z>=o.box.minZ&&z<=o.box.maxZ&&inRings(o.rings,{x,y:z}));
 const patioAt=(cx:number,cz:number,W:number,D:number):YardFeature=>({id,kind:'patio',name:'Raised patio',enabled:true,xFt:cx/12,zFt:cz/12,widthFt:W/12,depthFt:D/12,heightIn:0,rotationDeg:0,productId:p.productId as string,color:'#9a8f80',finishedElevationIn:access.level,patioSlope:{xPct:0,zPct:0},groundFit:{slopeRatio:GROUND_FIT_LIMITS.defaultRatio,lowEdge:'stone'}});
 const wallsFor=(patio:YardFeature,runs:RaisedEdgeRun[])=>runs.map((run,i)=>raisedPatioWall(patio,run,i?`${wallId}-${i+1}`:wallId,{name:`Raised patio wall${runs.length>1?` ${i+1}`:''}`,surface:ctx.surface}));
 type Best={cx:number;cz:number;W:number;D:number;runs:RaisedEdgeRun[];walls:YardFeature[];maxRise:number;cut:number;guard:RaisedPatioGuard;score:number[]};
 let best:Best|undefined,outside:{rings:P[][];reach:number}|undefined,wallsOutside:{rings:P[][];reach:number}|undefined,reached=-1,lotLine:{line:string;gapIn:number;needIn:number}|undefined,leastCut=Infinity,leastTall=Infinity,n=0;
 const fail=(stage:typeof RAISED_STAGES[number])=>{reached=Math.max(reached,RAISED_STAGES.indexOf(stage));};
 // The size asked for first, then 2 ft narrower or shallower where it does not fit.
 for(const [W,D] of [[W0,D0],[W0-24,D0],[W0,D0-24],[W0-24,D0-24]].filter(([w,d])=>w>=96&&d>=96)){
  // Beside the access on its left, right and front, sliding along each side and sharing at least 3 ft of edge with it.
  const spots:{side:number;cx:number;cz:number}[]=[];
  for(let z0=A.minZ-D+36;z0<=A.maxZ-36+1e-9;z0+=6){spots.push({side:1,cx:A.minX-W/2,cz:z0+D/2});spots.push({side:1,cx:A.maxX+W/2,cz:z0+D/2});}
  for(let x0=A.minX-W+36;x0<=A.maxX-36+1e-9;x0+=6)spots.push({side:0,cx:x0+W/2,cz:A.maxZ+D/2});
  for(const s of spots){
   if(++n%12===0)await ctx.tick();
   const ring=rect(s.cx,s.cz,W,D);if(blocker([ring],ctx.occupants,gaps,o=>o.id===access.occupant)){fail('blocked');continue;}
   const lot=lotShort(ctx,[ring],RAISED_SETBACK);if(lot){fail('lot');lotLine??=lot;continue;}
   if(!covered(ctx,[boxRing(boxOf([ring]),6)])){fail('coverage');const wide=[boxRing(boxOf([ring]),18)],reach=outsideReach(ctx,wide);if(!outside||reach<outside.reach)outside={rings:wide,reach};continue;}
   const e=ctx.surface.extrema([ring],'existing'),cut=e.max-access.level;if(cut>8){fail('cut');leastCut=Math.min(leastCut,cut);continue;}
   // A wall worth building: every run at least 2 ft and 4 ft in all (a shorter high spot is a corner, not a raised patio).
   const patio=patioAt(s.cx,s.cz,W,D),runs=raisedPatioWallPath(patio,ctx.surface,threshold,skip).filter(r=>r.lengthIn>=12);if(!runs.length){fail('flat');continue;}
   if(runs.some(r=>r.lengthIn<24)||runs.reduce((t,r)=>t+r.lengthIn,0)<48){fail('short');continue;}
   const maxRise=Math.max(...runs.map(r=>r.maxRiseIn)),guard=raisedPatioGuard(ring,access.level,ctx.surface,open);
   const face=runs.reduce((t,r)=>t+r.lengthIn*r.maxRiseIn,0)/144,score=[guard.required?1:0,r0(guard.lengthIn/12),r0(face),r0(Math.max(0,cut)),s.side,r0(s.cz),r0(s.cx)];
   if(best&&compare(score,best.score)>=0)continue;
   // The walls as built (their exposed face over the lowest ground under them, not the edge rise): over 36 in a wall
   // holding a patio needs an engineered design (RETAINING_WALL), and over 39.4 in a permit too; neither is offered.
   const walls=wallsFor(patio,runs),wallMax=Math.max(...walls.map(w=>w.heightIn));
   if(wallMax>RETAINING_WALL.engineerRecommendedAboveIn){fail('tall');leastTall=Math.min(leastTall,wallMax);continue;}
   // The walls stand on measured ground and clear of everything else too.
   const wallRings=walls.map(featureRings),envelopes=walls.map(wallEnvelope);
   if(!envelopes.every(r=>covered(ctx,r))){fail('wall-coverage');const reach=outsideReach(ctx,envelopes.flat());if(!wallsOutside||reach<wallsOutside.reach)wallsOutside={rings:envelopes.flat(),reach};continue;}
   if(wallRings.some(r=>blocker(r,ctx.occupants,{house:12,deck:6,stair:6,feature:0,bed:0,plant:0,pool:24},o=>o.id===access.occupant))){fail('wall-blocked');continue;}
   const wallLot=lotShort(ctx,wallRings.flat(),RAISED_SETBACK);if(wallLot){fail('wall-lot');lotLine=wallLot;continue;}
   best={cx:s.cx,cz:s.cz,W,D,runs,walls,maxRise,cut,guard,score};
  }
  if(best)break;
 }
 const title=`Raised patio, ${(best?.W??W0)/12} × ${(best?.D??D0)/12} ft`;
 if(!best){
  const stage=RAISED_STAGES[reached],at=`Beside the ${access.label}`,lotWhy=lotLine&&`${at} a raised patio would come within ${ft(Math.max(0,lotLine.gapIn))} ft of the ${lotLine.line} lot line: it is kept ${ft(lotLine.needIn)} ft from it as an accessory structure (zoning 2009-141, unconfirmed whether a raised patio counts), so there is no room for one.`;
  // Off the survey, and nothing measured drops enough yet: more survey may find the drop.
  if(outside&&(stage==='coverage'||stage==='cut'||stage==='flat'))return infeasible('raised-patio',title,p,measureFurther(ctx,outside.rings,`a raised patio level with the ${access.label} needs the ground beside it measured`)||`No open measured ground beside the ${access.label}.`,[],{cause:'coverage'});
  const why:Record<typeof RAISED_STAGES[number],string>={
   blocked:`${at} every spot is taken by the house, the deck, a stair or another feature.`,
   lot:lotWhy||`${at} there is no room inside the lot lines.`,
   coverage:`No open measured ground beside the ${access.label}.`,
   cut:`${at} the measured ground stands at least ${r1(leastCut)} in above its ${signed(access.level)} in level wherever a patio fits: it would be dug more than 8 in into the slope, so a patio at grade suits it better.`,
   flat:`${at} the ground never drops more than ${threshold} in below its ${signed(access.level)} in level along a patio's edge: a raised patio needs a drop of more than ${threshold} in, so a patio at grade suits it better.`,
   short:`${at} the ground drops more than ${threshold} in only along short stretches of a patio's edge (under 2 ft, or 4 ft in all): that is a corner to grade, not a raised patio.`,
   tall:leastTall>RETAINING_WALL.permitAboveIn?`${at} the retaining wall would stand at least ${leastTall} in wherever a patio fits: past ${RETAINING_WALL.permitAboveIn} in (1 m) it needs a building permit and an engineer's design, so the site designer never offers it.`
    :`${at} the retaining wall would stand at least ${leastTall} in wherever a patio fits: past ${RETAINING_WALL.engineerRecommendedAboveIn} in a wall that holds a patio needs an engineered wall, so it is not offered here; ask the builder.`,
   'wall-coverage':(wallsOutside&&measureFurther(ctx,wallsOutside.rings,'the retaining wall needs its footing and drainage measured'))||`${at} the retaining wall would run past the measured ground.`,
   'wall-blocked':`${at} the retaining wall it needs would run into the house, the deck, a stair or another feature wherever a patio fits.`,
   'wall-lot':lotWhy||`${at} the retaining wall would run past the lot lines.`,
  };
  return infeasible('raised-patio',title,p,stage?why[stage]:`No open measured ground beside the ${access.label}.`,[],{cause:stage??'coverage',...(stage==='tall'?{wallMaxIn:leastTall}:{}),...(stage==='cut'?{cutIn:r1(leastCut)}:{})});
 }
 const {W,D,walls}=best,patio=validateYardFinishedSettings(patioAt(best.cx,best.cz,W,D));p.widthFt=W/12;p.depthFt=D/12;
 // The guard on the design as it will be (the patio and its walls in it), as the ranking read it on the ground before.
 const parts:MoveParts={addYard:[patio,...walls],replaceYard:[],addLandscape:[],set:{}},after=designSiteSurface({...ctx.data,...applyParts(ctx.data,[parts])})??ctx.surface;
 const guard=raisedPatioGuard(yardFeatureOutline(patio)[0],access.level,after,open),sides=[...new Set(guard.runs.map(r=>sideOf(r.out)))];
 const maxWall=Math.max(...walls.map(w=>w.heightIn)),lengthIn=best.runs.reduce((t,r)=>t+r.lengthIn,0),e=ctx.surface.extrema([yardFeatureOutline(patio)[0]],'existing');
 const reach=`${r0(GUARD.adjacentWithinIn)} in (1.2 m)`,guardDrop=guard.runs.length?Math.max(...guard.runs.map(r=>r.dropIn)):0,steep=guard.runs.some(r=>r.steep);
 const notes=[`A ${W/12} × ${D/12} ft patio level with the ${access.label} at ${signed(access.level)} in; the measured ground under it runs from ${signed(e.min)} to ${signed(e.max)} in, and engineered fill brings it up to level (quoted).`,
  `Where it stands more than ${threshold} in above the ground, a ${ft(lengthIn)} ft segmental retaining wall holds it (up to ${maxWall} in of face, cap just under the paving); lower raised sides get a stone edge course (quoted).`,
  guard.required?`A guard is required along ${ft(guard.lengthIn)} ft of its ${sides.join(' and ')} edge${sides.length>1?'s':''}: the patio stands up to ${r1(guardDrop)} in above the lowest ground within ${reach} of it${steep?', or that ground falls away steeper than 1 in 2':''}, past the ${GUARD.requiredAboveIn} in (600 mm) of OBC 9.8.8.1. A ${GUARD.heightIn} in guard there is not priced here: it needs a quote.`
   :`No guard is needed: the patio stands at most ${r1(guard.maxDropIn)} in above the lowest ground within ${reach} of its open edges, under the ${GUARD.requiredAboveIn} in (600 mm) of OBC 9.8.8.1, and that ground falls no steeper than 1 in 2.`,
  ...(ctx.lot?[`It keeps ${ft(lotGap(ctx,[...yardFeatureOutline(patio),...walls.flatMap(featureRings)]))} ft inside the lot lines as entered (at least ${ZONING_SETBACKS.accessoryStructure.sideFt} ft, taken as an accessory structure; unconfirmed).`]:[]),
  "Shown in Permacon Melville (priced); matching the landing's paving needs a supplier quote."];
 return feasible(ctx,'raised-patio',title,p,parts,[{id:patio.id,rings:yardFeatureOutline(patio)},...walls.map(w=>({id:w.id,rings:featureRings(w)}))],notes,
  {patioId:patio.id,levelIn:access.level,access:access.label,accessId:access.occupant?.slice(5)??null,maxRiseIn:r1(best.maxRise),wallCount:walls.length,wallLengthFt:ft(lengthIn),wallMaxIn:maxWall,wallIds:walls.map(w=>w.id).join(','),
   guardRequired:guard.required,guardLf:ft(guard.lengthIn),guardEdges:sides.join(','),guardRuns:guard.runs.length,guardDropIn:r1(guard.required?guardDrop:guard.maxDropIn),guardSteep:steep,guardHeightIn:GUARD.heightIn,
   cutIn:r1(Math.max(0,best.cut)),groundMinIn:r1(e.min),groundMaxIn:r1(e.max),threshold,areaSqft:r1(W*D/144)},
  [`^${esc(patio.name)}: stone edge course on its raised side`,`^${esc(patio.name)}: a guard is required`,'^Raised patio wall','^Additional engineered fill below the patio base']);
}

// ---------------------------------------------------------------------------------------------------------------
// Stone steps: a solid stone flight from a raised patio down to the measured ground, on an edge with no wall.
export async function stoneStepsMove(ctx:MoveContext,target:SiteMove|undefined,params:Record<string,MoveValue>={}):Promise<SiteMove>{
 const W=num(params,'stone-steps','widthIn'),run=num(params,'stone-steps','treadRunIn'),thick=7,minRise=STONE_STEPS.riseIn[0],maxRise=Math.min(thick,STONE_STEPS.riseIn[1]);
 const p:Record<string,MoveValue>={widthIn:W,treadRunIn:run},title='Stone steps down to the lawn';
 const patio=target?.feasible?target.parts.addYard.find(f=>f.kind==='patio'&&!f.stoneSteps):undefined;
 if(!patio||typeof patio.finishedElevationIn!=='number')return infeasible('stone-steps',title,p,'Stone steps link a raised patio to the ground: there is no level change to link.');
 const top=patio.finishedElevationIn,pb=boxOf(yardFeatureOutline(patio)),accessId=typeof target!.metrics.accessId==='string'?target!.metrics.accessId:'';
 const access=ctx.occupants.find(o=>o.id===`yard:${accessId}`),gaps:Gaps={house:24,deck:6,stair:6,feature:0,bed:0,plant:0,pool:24};
 // Edges: front (toward the yard) first, then the downhill side, then the others; out is the way down.
 const down=ctx.down??{dx:0,dz:1},edges=[{name:'front',out:{x:0,y:1},rot:180},{name:'left',out:{x:-1,y:0},rot:270},{name:'right',out:{x:1,y:0},rot:90},{name:'back',out:{x:0,y:-1},rot:0}]
  .map(e=>({...e,rank:e.name==='front'?0:e.out.x*down.dx+e.out.y*down.dz>.5?1:2}));
 let best:{f:YardFeature;n:number;rise:number;lower:number;edge:string;score:number[]}|undefined,flush:string|undefined,k=0;
 const local=new Set<string>(),id=freshId(ctx,'s3-patio-steps',local);
 for(const e of edges){
  const along=e.out.x?{x:0,y:1}:{x:1,y:0},len=e.out.x?pb.maxZ-pb.minZ:pb.maxX-pb.minX,start=e.out.x?{x:e.out.x>0?pb.maxX:pb.minX,y:pb.minZ}:{x:pb.minX,y:e.out.y>0?pb.maxZ:pb.minZ};
  if(access&&(e.out.x?Math.abs(start.x-(e.out.x>0?access.box.minX:access.box.maxX))<1:Math.abs(start.y-(e.out.y>0?access.box.minZ:access.box.maxZ))<1))continue;// the side shared with the landing
  for(let t=W/2;t<=len-W/2+1e-9;t+=6){
   if(++k%16===0)await ctx.tick();
   const q={x:start.x+along.x*t,y:start.y+along.y*t},edgeGround=ground(ctx,q.x+e.out.x*3,q.y+e.out.y*3);if(edgeGround===undefined)continue;
   if(top-edgeGround<minRise){flush??=e.name;continue;}
   for(let n=1;n<=6;n++){
    const foot=ground(ctx,q.x+e.out.x*(n*run+8),q.y+e.out.y*(n*run+8));if(foot===undefined)break;
    const lower=q4(foot),rise=(top-lower)/n;if(rise>maxRise+1e-9)continue;if(rise<minRise-1e-9)break;
    const cx=q.x+e.out.x*n*run/2,cz=q.y+e.out.y*n*run/2,ring=rect(cx,cz,e.out.x?n*run:W,e.out.x?W:n*run);
    if(!covered(ctx,[boxRing(boxOf([ring]),6)])||blocker([ring],ctx.occupants,gaps,o=>o.id===`yard:${patio.id}`)||lotShort(ctx,[ring],IN_LOT))break;
    // No tread buried by the ground beside it: each row's ground stays under its own tread top.
    let buried=false;for(let r=0;r<n&&!buried;r++){const d0=(n-1-r)*run,row=rect(q.x+e.out.x*(d0+run/2),q.y+e.out.y*(d0+run/2),e.out.x?run:W,e.out.x?W:run);if(ctx.surface.extrema([row],'existing').max>lower+(r+1)*rise-.5)buried=true;}
    if(buried)break;
    const f:YardFeature={id,kind:'patio',name:'Patio steps',enabled:true,xFt:cx/12,zFt:cz/12,widthFt:W/12,depthFt:n*run/12,heightIn:0,rotationDeg:e.rot,productId:'permacon-melville',color:'#8d8a84',finishedElevationIn:top,
     stoneSteps:{lowerElevationIn:lower,riserCount:n,treadRunIn:run,stockWidthIn:W,stockDepthIn:run,stockThicknessIn:thick,baseDepthIn:6,settingBedIn:1,jointIn:.125,productName:'Entered cut-stone step planning stock'}};
    try{validateStoneSteps(f,f.stoneSteps);}catch{break;}
    const score=[e.rank,n,r0(Math.abs(rise-6.5)*4),r0(t)];if(!best||compare(score,best.score)<0)best={f,n,rise,lower,edge:e.name,score};
    break;
   }
  }
 }
 if(!best)return infeasible('stone-steps',title,p,flush?`Not needed: the patio meets the ground within ${minRise} in along its ${flush} side, so you step off it there.`:'No open, measured edge of the patio takes stone steps down to the ground (the walls, the deck or the survey edge are in the way).');
 return feasible(ctx,'stone-steps',`${best.n} stone step${best.n>1?'s':''} down to the lawn`,p,{addYard:[best.f],replaceYard:[],addLandscape:[],set:{}},[{id:best.f.id,rings:yardFeatureOutline(best.f)}],
  [`${best.n} equal risers of ${r2(best.rise)} in on the ${best.edge} side, from the patio at ${signed(top)} in down to the ground at ${signed(best.lower)} in; ${run} in treads, ${W} in wide.`,`Within the ${STONE_STEPS.riseIn[0]}–${STONE_STEPS.riseIn[1]} in rise and ${STONE_STEPS.runIn[0]}–${STONE_STEPS.runIn[1]} in run of OBC 9.8.4.2 (applied to garden steps as a conservative default); stone and setting are quoted.`,...(best.n>STONE_STEPS.handrailAboveRisers?['More than three risers: add a handrail.']:[])],
  {stepsId:best.f.id,patioId:patio.id,risers:best.n,riseIn:r2(best.rise),lowerIn:best.lower,topIn:top,side:best.edge,widthIn:W,treadRunIn:run});
}

// ---------------------------------------------------------------------------------------------------------------
// Bed planting: the garden moves' beds planted so they read as a garden. The plants are the catalogue's generic visual
// proxies (landscapeCatalogue.ts) at newly planted sizes, each a quote line as the planting move's are (no species,
// nursery stock or price is assumed).
interface BedPlant {assetId:'rounded-shrub'|'grass-clump';sizeIn:number;heightIn:number}
const SHRUB:BedPlant={assetId:'rounded-shrub',sizeIn:26,heightIn:28},GRASS:BedPlant={assetId:'grass-clump',sizeIn:20,heightIn:24};
/** Low mounds and tufts for raised beds: the catalogue has no vegetable or herb, so low shrubs and grasses stand in. */
const LOW:readonly BedPlant[]=[{assetId:'rounded-shrub',sizeIn:16,heightIn:12},{assetId:'grass-clump',sizeIn:16,heightIn:15}];
const BED_PLANTS_MAX=12,PLANT_GAP_IN=1;
/** Terrace rows, back to front: shrubs, then two rows of grasses, again while they fit; grasses alone where they make
 * more rows (a shallow tier). */
function terraceRows(depthIn:number):BedPlant[][]{
 const fill=(first:BedPlant)=>{const out:BedPlant[]=[];let used=-PLANT_GAP_IN;
  for(;;){const want=out.length%3?GRASS:first,next=[want,GRASS].find(p=>used+PLANT_GAP_IN+p.sizeIn<=depthIn+1e-9);if(!next)break;out.push(next);used+=PLANT_GAP_IN+next.sizeIn;}
  return out;};
 const a=fill(SHRUB),b=fill(GRASS);return (a.length>=b.length?a:b).map(p=>[p]);
}
/** Raised-bed rows: low mounds and tufts alternating, chequered row to row. */
const lowRows=(depthIn:number)=>Array.from({length:Math.max(0,Math.floor((depthIn+PLANT_GAP_IN)/(LOW[0].sizeIn+PLANT_GAP_IN)+1e-9))},(_,i)=>i%2?[LOW[1],LOW[0]]:[...LOW]);
/**
 * Plants for one bed on a staggered grid: rows along `u` from the back of the bed (`v`, square to `u`) to the front, each
 * row's plants spaced by their size and centred; a row of the same size as the one behind it, and as long, is one plant
 * shorter so its plants sit between those. Every plant's square envelope stands `margin` in inside the bed's outline,
 * clear of `keep` (the walls holding the bed) and of everything already in the plan. At most BED_PLANTS_MAX to a bed.
 */
function plantBed(ctx:MoveContext,bed:LandscapeObject,u:P,v:P,rowsFor:(depthIn:number)=>BedPlant[][],probeIn:number,keep:Occupant[],margin:number,local:Set<string>):LandscapeObject[]{
 const outline=objectRings(bed)[0],o={x:bed.xIn,y:bed.zIn},at=(s:number,t:number)=>({x:o.x+u.x*s+v.x*t,y:o.y+u.y*s+v.y*t}),deg=Math.atan2(u.y,u.x)*180/Math.PI;
 const fits=(ring:P[])=>ring.every(q=>inRing(outline,q)&&edgeGap([outline],q)>=margin-1e-6)&&!blocker([ring],keep,{})&&!blocker([ring],ctx.occupants,{});
 /** The longest run of centres (lo to hi) where a plant of `size` fits: stepped 2 in, then each end to 1/16 in. */
 const run=(size:number,q:(k:number)=>P,lo:number,hi:number):[number,number]|undefined=>{
  const ok=(k:number)=>{const p=q(k);return fits(rect(p.x,p.y,size,size,deg));};let best:[number,number]|undefined,start:number|undefined;
  for(let k=lo;k<=hi+1e-9;k+=2){const good=ok(k),last=k+2>hi+1e-9;if(good&&start===undefined)start=k;
   if((!good||last)&&start!==undefined){const end=good?k:k-2;if(!best||end-start>best[1]-best[0])best=[start,end];start=undefined;}}
  if(!best)return;
  const edge=(good:number,bad:number)=>{for(let i=0;i<5;i++){const m=(good+bad)/2;if(ok(m))good=m;else bad=m;}return good;},far=Math.min(hi,best[1]+2);
  return [best[0]>lo?edge(best[0],best[0]-2):best[0],far>best[1]+1e-9?(far===hi&&ok(far)?far:edge(best[1],far)):best[1]];};
 const us=outline.map(q=>(q.x-o.x)*u.x+(q.y-o.y)*u.y),vs=outline.map(q=>(q.x-o.x)*v.x+(q.y-o.y)*v.y),umin=Math.min(...us),umax=Math.max(...us);
 const depth=run(probeIn,t=>at((umin+umax)/2,t),Math.min(...vs)+probeIn/2,Math.max(...vs)-probeIn/2);if(!depth)return [];
 const rows=rowsFor(depth[1]-depth[0]+probeIn),block=rows.reduce((n,r)=>n+r[0].sizeIn+PLANT_GAP_IN,-PLANT_GAP_IN),plants:LandscapeObject[]=[];
 let cursor=depth[1]+probeIn/2-(depth[1]-depth[0]+probeIn-block)/2,prev=0;
 for(const [i,row] of rows.entries()){
  const size=row[0].sizeIn,t=cursor-size/2,pitch=size+PLANT_GAP_IN;cursor-=pitch;
  const span=run(size,s=>at(s,t),umin+size/2,umax-size/2);if(!span){prev=0;continue;}
  let n=Math.floor((span[1]-span[0])/pitch+1e-9)+1;if(n===prev&&n>1&&rows[i-1][0].sizeIn===size)n--;prev=n;
  for(let k=0;k<n&&plants.length<BED_PLANTS_MAX;k++){
   const p=row[k%row.length],c=at((span[0]+span[1])/2+(k-(n-1)/2)*pitch,t),turn=(deg+90*((i+3*k)%4)+540)%360-180;
   const plant={...newLandscapeObject(p.assetId,freshId(ctx,`${bed.id}-plant-${plants.length+1}`,local),r2(c.x),r2(c.y)),rotationDeg:r2(turn),heightIn:p.heightIn,widthIn:p.sizeIn,depthIn:p.sizeIn} as LandscapeObject;
   if(fits(objectRings(plant)[0]))plants.push(plant);else local.delete(plant.id);
  }
 }
 return plants;
}
const plantWords=(plants:LandscapeObject[])=>{const shrubs=plants.filter(p=>p.assetId==='rounded-shrub').length;return `${shrubs} shrub${shrubs===1?'':'s'} and ${plants.length-shrubs} ornamental grass${plants.length-shrubs===1?'':'es'}`;};

// ---------------------------------------------------------------------------------------------------------------
// Terraced beds: planTerraces on the steepest open measured ground, 2–3 level beds held by retaining walls (beds linked
// to their walls by wallFeatureId), planted.
export async function terracedBedsMove(ctx:MoveContext,params:Record<string,MoveValue>={}):Promise<SiteMove>{
 const L=num(params,'terraced-beds','lengthIn'),Wd=num(params,'terraced-beds','widthIn'),minWall=num(params,'terraced-beds','minWallIn'),maxWall=Math.max(minWall+6,num(params,'terraced-beds','maxWallIn'));
 const tierWish=params.tiers===2||params.tiers===3?params.tiers:null,p:Record<string,MoveValue>={tiers:tierWish,lengthIn:L,widthIn:Wd,minWallIn:minWall,maxWallIn:maxWall},title='Terraced planting beds';
 const gaps:Gaps={house:36,deck:24,stair:24,feature:24,bed:12,plant:6,pool:36},cov=boxOf(ctx.surface.coverage);
 const cands:{cx:number;cz:number;ring:P[];d:{x:number;z:number};fall:number;kind:string;score:number[]}[]=[];let outside:{rings:P[][];reach:number}|undefined,n=0;
 for(let x=Math.ceil(cov.minX/12)*12;x<=cov.maxX;x+=12)for(let z=Math.ceil(cov.minZ/12)*12;z<=cov.maxZ;z+=12){
  if(++n%48===0)await ctx.tick();
  const s=slopeOver(ctx,[rect(x,z,72,72)],12);if(s.pct<5)continue;const d={x:s.dx,z:s.dz},a={x:-d.z,z:d.x};
  const ring=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:x+d.x*u*L/2+a.x*v*Wd/2,y:z+d.z*u*L/2+a.z*v*Wd/2}));
  if(blocker([ring],ctx.occupants,gaps)||lotShort(ctx,[ring],IN_LOT))continue;
  const e=ctx.surface.extrema([ring],'existing');if(!e.complete){const reach=outsideReach(ctx,[ring]);if(!outside||reach<outside.reach)outside={rings:[ring],reach};continue;}
  const kind=kindOf(s.pct);cands.push({cx:x,cz:z,ring,d,fall:e.max-e.min,kind,score:[-KIND_RANK[kind],-r0(e.max-e.min),r0(z),r0(x)]});
 }
 if(!cands.length)for(let x=Math.ceil((cov.minX-120)/24)*24;x<=cov.maxX+120;x+=24)for(let z=Math.ceil((cov.minZ-120)/24)*24;z<=cov.maxZ+120;z+=24){
  // Nothing on the survey: an area laid along the overall fall 10 ft past it, only to say where to measure.
  if(++n%48===0)await ctx.tick();if(ground(ctx,x,z)!==undefined||!ctx.down)continue;const d={x:ctx.down.dx,z:ctx.down.dz},a={x:-d.z,z:d.x};
  const ring=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:x+d.x*u*L/2+a.x*v*Wd/2,y:z+d.z*u*L/2+a.z*v*Wd/2}));if(blocker([ring],ctx.occupants,gaps)||lotShort(ctx,[ring],IN_LOT))continue;
  const reach=outsideReach(ctx,[ring]);if(!outside||reach<outside.reach)outside={rings:[ring],reach};
 }
 cands.sort((a,b)=>compare(a.score,b.score));
 const tried:typeof cands=[],local=new Set<string>(),walls:YardFeature[]=[],beds:LandscapeObject[]=[];let plan:ReturnType<typeof planTerraces>|undefined,at:typeof cands[number]|undefined,lastReason='';
 /** A planned terrace wall as a retaining-wall feature: its path saved about its centre, cap top at the soil top. */
 const terraceWall=(w:ReturnType<typeof planTerraces>['walls'][number]):YardFeature=>{const pts=w.path.map(q=>({x:q.x,y:q.z})),b=boxOf([pts]),cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2,wallPath=pts.map(q=>({x:Math.round((q.x-cx)*1000)/1000,y:Math.round((q.y-cz)*1000)/1000}));
  return validateYardFinishedSettings({id:`s3-terrace-wall-${w.tier+1}`,kind:'retaining-wall',name:`Terrace wall ${w.tier+1}`,enabled:true,xFt:cx/12,zFt:cz/12,widthFt:pathRun(wallPath)/12,depthFt:1,heightIn:Math.min(72,Math.max(6,Math.ceil(w.heightIn))),rotationDeg:0,productId:'segmental-concrete',color:'#aaa69b',finishedElevationIn:r2(w.topIn),wallPath});};
 for(const c of cands){
  if(tried.length>=8)break;if(tried.some(t=>Math.hypot(t.cx-c.cx,t.cz-c.cz)<24))continue;tried.push(c);await ctx.tick();
  for(const tiers of tierWish?[tierWish]:c.fall>=36?[3,2]:[2,3]){
   const r=planTerraces(ctx.surface,c.ring.map(q=>({x:q.x,z:q.y})),{tiers:tiers as 2|3,minWallIn:minWall,maxWallIn:maxWall,downhill:{dx:c.d.x,dz:c.d.z}});if(!r.ok){lastReason=r.message;continue;}
   // Its walls' construction envelopes on measured ground and clear of everything else.
   const built=r.walls.map(w=>terraceWall(w));if(!built.every(w=>covered(ctx,wallEnvelope(w)))){lastReason=measureFurther(ctx,built.flatMap(wallEnvelope),'the terrace walls need their footings and drainage measured')||lastReason;continue;}
   if(built.some(w=>blocker(featureRings(w),ctx.occupants,gaps)||lotShort(ctx,featureRings(w),WALL_SETBACK)))continue;
   plan=r;at=c;walls.push(...built);break;
  }
  if(plan)break;
 }
 if(!plan||!at){
  const why=`terraces need about ${ft(L)} × ${ft(Wd)} ft of open sloping ground (over 5 %)`;
  return infeasible('terraced-beds',title,p,!cands.length&&outside?measureFurther(ctx,outside.rings,why)||`No open measured slope fits: ${why}.`:lastReason||`No open measured slope fits: ${why}.`,[`Tiered walls: ${TERRACE_WALL.note.split(':')[0]}.`]);
 }
 for(const w of walls)w.id=freshId(ctx,w.id,local);
 for(const b of plan.beds){const xs=b.outline.map(q=>q.x),zs=b.outline.map(q=>q.z),wall=walls[plan.walls.findIndex(w=>w.tier===b.tier)];
  beds.push({...newLandscapeObject('mulch-bed',freshId(ctx,`s3-terrace-bed-${b.tier+1}`,local)),name:`Terrace bed ${b.tier+1}`,polygon:b.outline.map(q=>({x:r2(q.x),z:r2(q.z)})),xIn:r2((Math.min(...xs)+Math.max(...xs))/2),zIn:r2((Math.min(...zs)+Math.max(...zs))/2),widthIn:r2(Math.max(...xs)-Math.min(...xs)),depthIn:r2(Math.max(...zs)-Math.min(...zs)),raisedIn:r2(b.raisedIn),edge:{kind:'wall',...(wall?{wallFeatureId:wall.id}:{})}});}
 if(!validateLandscapeObjects([...(ctx.data.landscapeObjects??[]),...beds]))return infeasible('terraced-beds',title,p,'The planned terrace beds did not make valid bed outlines; try a simpler area.');
 // Planted on the soil: rows along the contour, shrubs at the back (uphill), clear of every terrace wall.
 const keep:Occupant[]=walls.map(w=>{const rings=featureRings(w);return {id:`yard:${w.id}`,kind:'feature',label:w.name,rings,box:boxOf(rings)};}),plants:LandscapeObject[]=[],owner=new Map<string,string>();
 for(const b of beds){await ctx.tick();for(const q of plantBed(ctx,b,{x:-at.d.z,y:at.d.x},{x:-at.d.x,y:-at.d.z},terraceRows,GRASS.sizeIn,keep,2,local)){owner.set(q.id,b.id);plants.push(q);}}
 if(!validateLandscapeObjects([...(ctx.data.landscapeObjects??[]),...beds,...plants]))return infeasible('terraced-beds',title,p,'The terrace planting did not make valid plant placements.');
 // D >= 2H between tiers (TERRACE_WALL): the bench in front of each upper wall against the wall below it.
 const along=(q:LandscapePoint)=>q.x*at!.d.x+q.z*at!.d.z,depthOf=(bed:typeof plan.beds[number])=>Math.max(...bed.outline.map(along))-Math.min(...bed.outline.map(along));
 const separationOk=plan.beds.slice(1).every(b=>depthOf(b)>=TERRACE_WALL.minSeparationRatio*(plan!.walls.find(w=>w.tier===b.tier)?.heightIn??0)-1e-6);
 const zone=zoneAt(ctx.brief,at.cx,at.cz),heights=plan.walls.map(w=>r1(w.heightIn)),bedSqft=r1(plan.beds.reduce((t,b)=>t+b.areaSqft,0)),allIds=[...walls.map(w=>w.id),...beds.map(b=>b.id)];
 return feasible(ctx,'terraced-beds',`${plan.tiers} terraced beds stepping down the slope`,{...p,tiers:plan.tiers},{addYard:walls,replaceYard:[],addLandscape:[...beds,...plants],set:{}},
  [...walls.map(w=>({id:w.id,rings:featureRings(w),on:allIds})),...beds.map(b=>({id:b.id,rings:objectRings(b),on:allIds})),...plants.map(q=>({id:q.id,rings:objectRings(q),on:[owner.get(q.id)!]}))],
  [`${plan.message} The ground falls ${r1(plan.fallIn)} in across the ${ft(L)} × ${ft(Wd)} ft area (${plan.slope.pct} %).`,...plan.warnings,
   ...(plants.length?[`${plants.length} plants on the planting soil, ${plantWords(plants)}, in staggered rows along the contour (the taller at the back); each is a generic visual proxy, so species, nursery stock and supply are quoted.`]:[]),
   ...(separationOk?[]:[`The tiers sit closer than twice the lower wall's height apart, so the walls load each other: geogrid and an engineering review (${TERRACE_WALL.sources[0].title.split(',')[0]}).`]),
   `Grading and fill need a conservation authority permit only inside a regulated area (${CONSERVATION_AUTHORITY.regulation}, LSRCA or NVCA): check the map before terracing.`],
  {tiers:plan.tiers,fallIn:r1(plan.fallIn),slopePct:plan.slope.pct,alignment:plan.alignment,wallHeightsIn:heights.join(', '),maxWallIn:Math.max(...heights),wallCount:walls.length,bedSqft,plants:plants.length,separationOk,zone:zone?.id??null,zoneKind:zone?.kind??null,zoneSlopePct:zone?.slopePct??null,zoneSqft:zone?.areaSqft??null,downX:r2(at.d.x),downZ:r2(at.d.z),centreX:at.cx,centreZ:at.cz},
  ['^Terrace (wall|bed)']);
}

// ---------------------------------------------------------------------------------------------------------------
// Raised beds: two beds 18–24 in high near the house on the gentlest open ground (sun only when the compass is known).
export async function raisedBedsMove(ctx:MoveContext,params:Record<string,MoveValue>={}):Promise<SiteMove>{
 const count=Math.round(num(params,'raised-beds','count')),L=num(params,'raised-beds','lengthIn'),Wb=num(params,'raised-beds','widthIn'),raised=num(params,'raised-beds','raisedIn'),gap=num(params,'raised-beds','pathIn'),edge=pick(params,'raised-beds','edge') as 'timber'|'steel';
 const p:Record<string,MoveValue>={count,lengthIn:L,widthIn:Wb,raisedIn:raised,pathIn:gap,edge},title=`${count} raised bed${count>1?'s':''}, ${raised} in high`;
 const house=ctx.occupants.filter(o=>o.kind==='house').flatMap(o=>o.rings),gaps:Gaps={house:36,deck:24,stair:24,feature:24,bed:12,plant:6,pool:24},orient=ctx.brief.orientation;
 const shaded=!!orient&&/toward the house/.test(orient.sunSide),cov=boxOf(ctx.surface.coverage);
 let outside:{rings:P[][];reach:number}|undefined;
 const layout=(cx:number,cz:number,alongX:boolean)=>{const span=count*Wb+(count-1)*gap;return Array.from({length:count},(_,i)=>{const o=-span/2+Wb/2+i*(Wb+gap);return alongX?rect(cx,cz+o,L,Wb):rect(cx+o,cz,Wb,L);});};
 const evaluate=(cx:number,cz:number,alongX:boolean)=>{
  const beds=layout(cx,cz,alongX);if(beds.some(b=>blocker([b],ctx.occupants,gaps))||lotShort(ctx,beds,IN_LOT))return null;
  const houseGap=house.length?gapBetween(beds,house):0;if(house.length&&houseGap>240)return null;
  const all=[boxRing(boxOf(beds),6)];if(!covered(ctx,all)){const reach=outsideReach(ctx,all);if(!outside||reach<outside.reach)outside={rings:all,reach};return null;}
  const s=slopeOver(ctx,beds,12),relief=Math.max(...beds.map(b=>{const e=ctx.surface.extrema([b],'existing');return e.max-e.min;}));if(s.pct>10||relief>raised-6)return null;
  return {cx,cz,alongX,beds,houseGap,slope:s.pct,relief,score:[s.pct<=5?0:1,shaded&&houseGap<144?1:0,r0(houseGap/12),r0(relief),r0(cz),r0(cx),alongX?0:1]};
 };
 let best:ReturnType<typeof evaluate>|undefined,n=0;
 for(const alongX of [true,false])for(let x=Math.ceil(cov.minX/12)*12;x<=cov.maxX;x+=12)for(let z=Math.ceil(cov.minZ/12)*12;z<=cov.maxZ;z+=12){if(++n%48===0)await ctx.tick();const c=evaluate(x,z,alongX);if(c&&(!best||compare(c.score,best.score)<0))best=c;}
 // Nothing on the survey: look 10 ft past it, only to say where to measure.
 if(!best&&!outside)for(const alongX of [true,false])for(let x=Math.ceil((cov.minX-120)/24)*24;x<=cov.maxX+120;x+=24)for(let z=Math.ceil((cov.minZ-120)/24)*24;z<=cov.maxZ+120;z+=24){if(++n%48===0)await ctx.tick();evaluate(x,z,alongX);}
 if(!best){const why=`${count} raised beds need about ${ft(count*Wb+(count-1)*gap)} × ${ft(L)} ft of open, gentle ground within 20 ft of the house`;return infeasible('raised-beds',title,p,outside?measureFurther(ctx,outside.rings,why)||`No open measured ground fits: ${why}.`:`No open ground fits: ${why}.`);}
 const local=new Set<string>(),objects=best.beds.map((ring,i)=>{const xs=ring.map(q=>q.x),zs=ring.map(q=>q.y);return {...newLandscapeObject('mulch-bed',freshId(ctx,`s3-raised-bed-${i+1}`,local)),name:`Raised bed ${i+1}`,polygon:ring.map(q=>({x:r2(q.x),z:r2(q.y)})),xIn:r2((Math.min(...xs)+Math.max(...xs))/2),zIn:r2((Math.min(...zs)+Math.max(...zs))/2),widthIn:r2(Math.max(...xs)-Math.min(...xs)),depthIn:r2(Math.max(...zs)-Math.min(...zs)),raisedIn:raised,edge:{kind:edge}} as LandscapeObject;});
 if(!validateLandscapeObjects([...(ctx.data.landscapeObjects??[]),...objects]))return infeasible('raised-beds',title,p,'The raised beds did not make valid bed outlines.');
 // Planted on the soil top: low mounds and tufts in staggered rows along each bed, 3 in inside the edging.
 const along=best.alongX?{x:1,y:0}:{x:0,y:1},across=best.alongX?{x:0,y:1}:{x:1,y:0},plants:LandscapeObject[]=[],owner=new Map<string,string>();
 for(const b of objects){await ctx.tick();for(const q of plantBed(ctx,b,along,across,lowRows,LOW[0].sizeIn,[],3,local)){owner.set(q.id,b.id);plants.push(q);}}
 if(!validateLandscapeObjects([...(ctx.data.landscapeObjects??[]),...objects,...plants]))return infeasible('raised-beds',title,p,'The raised-bed planting did not make valid plant placements.');
 const zone=zoneAt(ctx.brief,best.cx,best.cz),sun=orient?`The yard faces ${orient.yardFaces}: the midday sun is ${orient.sunSide}${shaded?(best.houseGap>=144?', so the beds stand clear of the house\'s nearest shade':', so the house shades them part of the day'):''}.`:'Sun is not assessed: the yard\'s compass direction is not set.';
 return feasible(ctx,'raised-beds',title,p,{addYard:[],replaceYard:[],addLandscape:[...objects,...plants],set:{}},[...objects.map(o=>({id:o.id,rings:objectRings(o)})),...plants.map(q=>({id:q.id,rings:objectRings(q),on:[owner.get(q.id)!]}))],
  [`${count} ${ft(L)} × ${ft(Wb)} ft raised bed${count>1?'s':''} with ${edge} edging, ${raised} in high, ${ft(best.houseGap)} ft from the house on ${best.slope} % ground${count>1?`, a ${gap} in path between`:''}; the soil top is level, so the low side stands up to ${r1(best.relief)} in taller.`,
   `${Wb} in wide or less, so the middle is in reach (${BED_RULE.maxWidthIn} in from both sides); planting soil and edging are quoted.`,
   ...(plants.length?[`${plants.length} low plants in staggered rows on the soil, ${plantWords(plants)} standing in for vegetables or herbs (the catalogue has none); species and supply are quoted.`]:[]),sun],
  {count,houseGapFt:ft(best.houseGap),slopePct:best.slope,reliefIn:r1(best.relief),raisedIn:raised,edge,alongHouse:best.alongX,sun:orient?orient.sunSide:null,zone:zone?.id??null,zoneKind:zone?.kind??null,areaSqft:r1(count*L*Wb/144),plants:plants.length},['^Raised bed \\d']);
}

// ---------------------------------------------------------------------------------------------------------------
// Planting: a bed that follows the measured ground (a contour) along the high side of the open yard, with shrubs and
// grasses.
export async function plantingMove(ctx:MoveContext,params:Record<string,MoveValue>={}):Promise<SiteMove>{
 const len=num(params,'planting','lengthIn'),depth=num(params,'planting','depthIn'),p:Record<string,MoveValue>={lengthIn:len,depthIn:depth,plants:typeof params.plants==='number'?num(params,'planting','plants'):null},title='Planting bed along the high side';
 const up=ctx.down?{x:-ctx.down.dx,y:-ctx.down.dz}:{x:0,y:1},t={x:-up.y,y:up.x},gaps:Gaps={house:24,deck:24,stair:24,feature:18,bed:12,plant:6,pool:24},cov=boxOf(ctx.surface.coverage),half=depth/2;
 const strip=(a:P,b:P)=>[{x:a.x+up.x*half,y:a.y+up.y*half},{x:b.x+up.x*half,y:b.y+up.y*half},{x:b.x-up.x*half,y:b.y-up.y*half},{x:a.x-up.x*half,y:a.y-up.y*half}];
 const fits=(a:P,b:P)=>{const s=strip(a,b);return covered(ctx,[s])&&!blocker([s],ctx.occupants,gaps)&&!lotShort(ctx,[s],IN_LOT);};
 /** Follows the contour through `from` (level e0) one way, 12 in a step, while the strip stays open and measured. */
 const trace=(from:P,e0:number,dir:number,want:number)=>{const out:P[]=[];let q=from,run=0;
  while(run<want-1e-9){const g={x:q.x+t.x*dir*12,y:q.y+t.y*dir*12},f=(s:number)=>{const h=ground(ctx,g.x+up.x*s,g.y+up.y*s);return h===undefined?undefined:h-e0;};
   let lo=-18,hi=18,flo=f(lo);const fhi=f(hi);if(flo===undefined||fhi===undefined||flo*fhi>0)break;
   for(let i=0;i<14;i++){const mid=(lo+hi)/2,fm=f(mid);if(fm===undefined)break;if(fm*flo<=0)hi=mid;else{lo=mid;flo=fm;}}
   const next={x:g.x+up.x*(lo+hi)/2,y:g.y+up.y*(lo+hi)/2};if(!fits(q,next))break;run+=Math.hypot(next.x-q.x,next.y-q.y);out.push(next);q=next;}
  return {pts:out,run};};
 // Seeds: open measured spots, the highest (furthest up the fall) first.
 const seeds:{q:P;h:number}[]=[];
 for(let x=Math.ceil(cov.minX/12)*12;x<=cov.maxX;x+=12)for(let z=Math.ceil(cov.minZ/12)*12;z<=cov.maxZ;z+=12){const q={x,y:z};if(ground(ctx,x,z)===undefined)continue;const s=strip({x:x-t.x*12,y:z-t.y*12},{x:x+t.x*12,y:z+t.y*12});if(!covered(ctx,[s])||blocker([s],ctx.occupants,gaps)||lotShort(ctx,[s],IN_LOT))continue;seeds.push({q,h:x*up.x+z*up.y});}
 seeds.sort((a,b)=>b.h-a.h||a.q.x-b.q.x||a.q.y-b.q.y);
 let best:{line:P[];run:number;e0:number;score:number[]}|undefined,outside:{rings:P[][];reach:number}|undefined;
 for(const [i,s] of seeds.slice(0,30).entries()){
  if(i%4===0)await ctx.tick();
  // Half the length each way, then whatever is left on the side that still has room.
  const e0=ground(ctx,s.q.x,s.q.y)!,a=trace(s.q,e0,-1,len/2),b=trace(s.q,e0,1,len-a.run),more=a.run+b.run<len-12?trace(a.pts.at(-1)??s.q,e0,-1,len-a.run-b.run):{pts:[],run:0};
  const line=[...[...a.pts,...more.pts].reverse(),s.q,...b.pts],run=a.run+b.run+more.run;
  const score=[run>=len-12?0:1,-r0(run/12),-r0(s.h/6),r0(s.q.x),r0(s.q.y)];if(!best||compare(score,best.score)<0)best={line,run,e0,score};
 }
 if(!best||best.run<72-1e-9){
  const why=`a planting bed along the high side needs about ${ft(len)} ft of open ground there`,cand=seeds[0]?.q??{x:(cov.minX+cov.maxX)/2,y:cov.maxZ},far={x:cand.x+t.x*len/2,y:cand.y+t.y*len/2},nearEnd={x:cand.x-t.x*len/2,y:cand.y-t.y*len/2};
  outside={rings:[strip(nearEnd,far)],reach:0};
  return infeasible('planting',title,p,measureFurther(ctx,outside.rings,why)||`There is not enough open ground on the high side for ${ft(len)} ft of bed (${ft(best?.run??0)} ft fits).`);
 }
 const line=best.line,left=line.map(q=>({x:q.x+up.x*half,z:q.y+up.y*half})),right=line.map(q=>({x:q.x-up.x*half,z:q.y-up.y*half})).reverse(),polygon=[...left,...right].map(q=>({x:r2(q.x),z:r2(q.z)}));
 const xs=polygon.map(q=>q.x),zs=polygon.map(q=>q.z),local=new Set<string>();
 const bed:LandscapeObject={...newLandscapeObject('mulch-bed',freshId(ctx,'s3-planting-bed',local)),name:'Planting bed',polygon,xIn:r2((Math.min(...xs)+Math.max(...xs))/2),zIn:r2((Math.min(...zs)+Math.max(...zs))/2),widthIn:r2(Math.max(...xs)-Math.min(...xs)),depthIn:r2(Math.max(...zs)-Math.min(...zs))};
 // Plants spaced evenly along the bed's centre line, shrubs and grasses alternating.
 const count=typeof p.plants==='number'?p.plants:Math.max(2,Math.min(8,Math.floor(best.run/48))),stations=line.slice(1).reduce<number[]>((s,q,i)=>[...s,s[i]+Math.hypot(q.x-line[i].x,q.y-line[i].y)],[0]);
 const at=(d:number)=>{let i=0;while(i<stations.length-2&&stations[i+1]<d)i++;const a=line[i],b=line[i+1]??a,f=stations[i+1]>stations[i]?(d-stations[i])/(stations[i+1]-stations[i]):0;return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};};
 const plants=Array.from({length:count},(_,i)=>{const q=at(best!.run*(i+.5)/count);return {...newLandscapeObject(i%2?'grass-clump':'rounded-shrub',freshId(ctx,`s3-plant-${i+1}`,local),r2(q.x),r2(q.y))} as LandscapeObject;});
 if(!validateLandscapeObjects([...(ctx.data.landscapeObjects??[]),bed,...plants]))return infeasible('planting',title,p,'The planting bed did not make a valid outline here.');
 const g0=ctx.brief.elevation;
 return feasible(ctx,'planting',`Planting bed, ${ft(best.run)} ft along the high side`,{...p,plants:count},{addYard:[],replaceYard:[],addLandscape:[bed,...plants],set:{}},[{id:bed.id,rings:objectRings(bed),on:plants.map(q=>q.id)},...plants.map(q=>({id:q.id,rings:objectRings(q),on:[bed.id]}))],
  [`A ${ft(depth)} ft deep bed that follows the ${signed(best.e0)} in contour for ${ft(best.run)} ft along the high side (${towardWords(up.x,up.y)}), where the measured ground runs up to ${signed(g0.maxIn)} in.`,`${count} plants, shrubs and ornamental grasses alternating; mulch and plants are priced or quoted as the estimate lists them.`],
  {bedId:bed.id,lengthFt:ft(best.run),depthFt:ft(depth),contourIn:r1(best.e0),plants:count,bedSqft:r1(yardArea(objectRings(bed))),highSide:towardWords(up.x,up.y)},['^Planting bed']);
}

/** One move by kind; `anchor` is the move it builds on (the fire room for a seat wall, the raised patio for steps). */
export async function siteDesignMove(kind:SiteMoveKind,ctx:MoveContext,params:Record<string,MoveValue>={},anchor?:SiteMove):Promise<SiteMove>{
 switch(kind){
  case 'ground-fit':return groundFitMove(ctx,params);
  case 'fire-room':return fireRoomMove(ctx,params);
  case 'seat-wall':return seatWallMove(ctx,anchor,params);
  case 'raised-patio':return raisedPatioMove(ctx,params);
  case 'stone-steps':return stoneStepsMove(ctx,anchor,params);
  case 'terraced-beds':return terracedBedsMove(ctx,params);
  case 'raised-beds':return raisedBedsMove(ctx,params);
  case 'planting':return plantingMove(ctx,params);
 }
}
