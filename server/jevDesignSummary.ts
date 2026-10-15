/**
 * Turns a DeckCraft design JSON into the compact summary Jev reads, and into the same facts as plain data.
 *
 * Jev is weak at arithmetic, counting, coordinates and multi-step reasoning (docs.typesafe.ai/model-jaggedness), so
 * every measurement is taken here and handed over in words: which surface a light stands on, whether a seat faces its
 * focal point, which paving a stair lands on, which seating areas are joined by paving. Jev then applies the design
 * rule to those words (jevDesignCheck.ts).
 *
 * Deck, railing, stair and automatic light positions come from the deck engine, on a design the app's own validator
 * accepted. Landscape objects and pinned light positions are read tolerantly, because a design saved by a newer build
 * can carry assets this build does not know. Coordinates are inches, x across the house and z out from its back wall.
 *
 * No customer name, address, scope text or contact detail goes into the summary. Object names are reduced to plain
 * words, since anything in the state can sway the model.
 */
import {z} from 'zod';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import {validateDesign} from '../src/features/deckcraft/designPersistence';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {buildDeckTakeoff,guardRuns,type DeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {getHouseContact} from '../src/features/deckcraft/houseContact';
import {getHousePlacement} from '../src/features/deckcraft/housePlacement';
import {edgeFacing} from '../src/features/deckcraft/lib/deckGeometry';
import {extrasLayout} from '../src/features/deckcraft/extrasLayout';
import {getLightingRuntimeProduct} from '../src/features/deckcraft/lightingRuntimeCatalogue';
import {yardShapeCurveWorldPoints,yardShapeWorldPoints} from '../src/features/deckcraft/yardShapeGeometry';
import {poolOutline} from '../src/features/deckcraft/poolGeometry';

export class DesignInputError extends Error {constructor(message:string){super(message);this.name='DesignInputError';}}

/** The rule thresholds that are measured here rather than judged by Jev. */
export const SUMMARY_RULES={
 /** A seat faces its focal point within this angle (design rule 9, scripts/check-furniture-facing.ts). */
 facingDeg:30,
 /** Paving must begin within this distance beyond the bottom riser for a stair to land on it. */
 stairProbeIn:6,
 /** Two paved areas this close are joined. */
 touchIn:6,
 /** A wall or pool this close to paving or a bed belongs to it. */
 adjoinIn:12,
 /** Open ground narrower than this is a leftover strip, not lawn. */
 stripIn:36,
 seatReachIn:{fire:144,dining:120,coffee:96,peer:96},
} as const;
const LIMITS={landscapeObjects:1000,lightItems:200,places:500,polygon:128,coordinateIn:120_000,cells:160_000,nameChars:48} as const;

// ---------------------------------------------------------------------------------------------------------------
// Input

type Raw=Record<string,unknown>;
const record=(v:unknown):v is Raw=>!!v&&typeof v==='object'&&!Array.isArray(v);
const coordinate=z.number().min(-LIMITS.coordinateIn).max(LIMITS.coordinateIn);
const landscapeSchema=z.object({
 id:z.string().max(120),name:z.string().max(200).catch(''),enabled:z.boolean().catch(true),kind:z.string().max(40),assetId:z.string().max(80),
 xIn:coordinate,zIn:coordinate,rotationDeg:coordinate.catch(0),widthIn:z.number().min(0).max(LIMITS.coordinateIn).catch(0),depthIn:z.number().min(0).max(LIMITS.coordinateIn).catch(0),
 polygon:z.array(z.object({x:coordinate,z:coordinate})).min(3).max(LIMITS.polygon).optional().catch(undefined),
 speciesRecord:z.object({commonName:z.string().max(200),botanicalName:z.string().max(200)}).optional().catch(undefined),
});
type LandscapeItem=z.infer<typeof landscapeSchema>;
const lightSchema=z.object({productId:z.string().max(80),qty:z.number().min(0).max(1000).catch(0),zone:z.string().max(40).optional().catch(undefined),
 places:z.array(z.object({x:coordinate,z:coordinate})).max(LIMITS.places).optional().catch(undefined)});
const railSectionSchema=z.object({level:z.number(),edgeId:z.string().max(160),startPct:z.number().min(0).max(100),endPct:z.number().min(0).max(100),enabled:z.boolean()});

/** Optional settings a design may carry that the deck checks do not need. Dropped only when the full design fails
 * this build's validator, so the deck can still be checked. */
const OPTIONAL_KEYS=['pools','poolQuoteInputs','yardFeatures','yardAllowances','yardSettings','stairTargets','pergola','scenePresentation','terrainConfig','siteModel','permitSite','editorOrganization','inlays'];
const reason=(error:unknown)=>(error instanceof Error?error.message:String(error)).replace(/\s+/g,' ').slice(0,200);

/** A saved design file, or its bare configuration. The validator fills anything missing from the default deck, so
 * the two sizes every saved design carries are required here: otherwise any JSON object would read as a design. */
function configurationOf(input:unknown):Raw{
 if(!record(input))throw new DesignInputError('Send a DeckCraft design as a JSON object.');
 let cfg=input;
 if('configuration'in input){
  if(input.format!==undefined&&input.format!=='golden-maple-deck-design')throw new DesignInputError('This is not a Golden Maple deck design file.');
  if(!record(input.configuration))throw new DesignInputError('The design configuration is missing.');
  cfg=input.configuration;
 }
 if(typeof cfg.width!=='number'||typeof cfg.length!=='number')throw new DesignInputError('This JSON is not a DeckCraft design: it has no deck width and length.');
 return cfg;
}
/** The design as this build's engine can use it. Landscape objects are left out: they are read tolerantly below. */
async function engineData(cfg:Raw,warnings:string[]):Promise<DeckData>{
 const base:Raw={...cfg};delete base.landscapeObjects;
 try{await ensureLiveDesignExtensions({configuration:base});return validateDesign(base);}
 catch(first){
  const core:Raw={...base};for(const key of OPTIONAL_KEYS)delete core[key];
  try{const data=validateDesign(core);warnings.push(`This build could not read the yard, pool or site settings (${reason(first)}), so only the deck was measured.`);return data;}
  catch(second){throw new DesignInputError(`DeckCraft could not read this design: ${reason(second)}`);}
 }
}
function tolerantList<T>(value:unknown,schema:z.ZodType<T>,max:number,label:string,warnings:string[]):T[]{
 if(value===undefined||value===null)return [];
 if(!Array.isArray(value)){warnings.push(`${label} were not a list and were ignored.`);return [];}
 const out:T[]=[];let skipped=0;
 for(const item of value.slice(0,max)){const parsed=schema.safeParse(item);if(parsed.success)out.push(parsed.data);else skipped++;}
 if(value.length>max)warnings.push(`Only the first ${max} ${label.toLowerCase()} were read.`);
 if(skipped)warnings.push(`${skipped} ${label.toLowerCase()} could not be read and were left out.`);
 return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Words

/** A name the model can read as a plain label: letters, digits and light punctuation only, contact details gone. */
export function plainName(value:unknown,fallback:string):string{
 if(typeof value!=='string')return fallback;
 const text=value.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g,' ').replace(/\+?\d[\d\s().-]{8,}\d/g,' ').replace(/[^\p{L}\p{N} '’&()/.,×-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,LIMITS.nameChars).trim();
 return text||fallback;
}
const feet=(inches:number)=>Math.round(inches/12*10)/10;
const plural=(n:number,one:string,many=`${one}s`)=>`${n} ${n===1?one:many}`;
function listed(names:string[],max=4):string{
 const unique=[...new Set(names)];
 return unique.length>max?`${unique.slice(0,max).join(', ')} and ${unique.length-max} more`:unique.join(', ');
}

// ---------------------------------------------------------------------------------------------------------------
// Plan geometry

interface Pt {x:number;z:number}
const fromPlan=(p:{x:number;y:number}):Pt=>({x:p.x,z:p.y});
function inside(p:Pt,poly:Pt[]):boolean{
 let hit=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)hit=!hit;}
 return hit;
}
function pointSegment(p:Pt,a:Pt,b:Pt):number{
 const dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/len2));
 return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);
}
const cross=(a:Pt,b:Pt,c:Pt)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
const segmentsCross=(a:Pt,b:Pt,c:Pt,d:Pt)=>cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;
/** Distance from a point to a filled polygon (0 inside). */
function pointPolygon(p:Pt,poly:Pt[]):number{
 if(inside(p,poly))return 0;
 let best=Infinity;for(let i=0;i<poly.length;i++)best=Math.min(best,pointSegment(p,poly[i],poly[(i+1)%poly.length]));
 return best;
}
/** Distance between a path (closed or open) and a filled polygon (0 when they overlap). */
function pathPolygon(path:Pt[],closed:boolean,poly:Pt[]):number{
 let best=Infinity;const edges=closed?path.length:path.length-1;
 for(const p of path)best=Math.min(best,pointPolygon(p,poly));
 if(closed)for(const q of poly)best=Math.min(best,pointPolygon(q,path));
 for(let i=0;i<edges&&best>0;i++){const a=path[i],b=path[(i+1)%path.length];
  for(let j=0;j<poly.length;j++){const c=poly[j],d=poly[(j+1)%poly.length];
   if(segmentsCross(a,b,c,d))return 0;
   best=Math.min(best,pointSegment(c,a,b),pointSegment(d,a,b));}}
 return best;
}
const polygonArea=(poly:Pt[])=>Math.abs(poly.reduce((sum,a,i)=>{const b=poly[(i+1)%poly.length];return sum+a.x*b.z-b.x*a.z;},0))/2;
const centroid=(poly:Pt[]):Pt=>({x:poly.reduce((s,p)=>s+p.x,0)/poly.length,z:poly.reduce((s,p)=>s+p.z,0)/poly.length});
function nearestOnRing(p:Pt,ring:Pt[]):Pt{
 let best=ring[0],bestD=Infinity;
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/len2)),q={x:a.x+dx*t,z:a.z+dz*t},d=Math.hypot(q.x-p.x,q.z-p.z);
  if(d<bestD){bestD=d;best=q;}}
 return best;
}

// ---------------------------------------------------------------------------------------------------------------
// The summary

export type SurfaceKind='deck'|'stair'|'paving'|'pool'|'bed'|'turf'|'open';
interface Surface {kind:Exclude<SurfaceKind,'open'>;id:string;name:string;poly:Pt[];box?:Box}
interface Box {x0:number;x1:number;z0:number;z1:number}
function boxOf(points:Pt[]):Box{const box={x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity};for(const p of points){if(p.x<box.x0)box.x0=p.x;if(p.x>box.x1)box.x1=p.x;if(p.z<box.z0)box.z0=p.z;if(p.z>box.z1)box.z1=p.z;}return box;}
/** Point in a surface, with the bounding box tried first. */
function onSurface(p:Pt,s:Surface):boolean{const b=s.box??=boxOf(s.poly);return p.x>=b.x0&&p.x<=b.x1&&p.z>=b.z0&&p.z<=b.z1&&inside(p,s.poly);}
/** A type alias, not an interface, so it is plain JSON to the Jev client. */
export type SummaryState={
 deck:string;house:string;
 railing:{edge:string;railing:string}[];
 stairs:{stair:string;lands_on:string}[];
 paving:{area:string;size:string;touches:string}[];
 lights:{fixture:string;count:number;type:string;location:string}[];
 seating_areas:{area:string;seats:string;paved_route:string}[];
 seats:{area:string;seat:string;count:number;focal_point:string;facing:string}[];
 lawn:{measured_within:string;panels:{panel:string;size:string;framed_by:string}[];leftover_strips:string;artificial_turf:string};
 planting:{beds:string;species:{plant:string;botanical_name:string;count:number}[];plants_outside_beds:string};
 structures:{structure:string;role:string}[];
 fence_and_privacy:string;
};
export interface SpeciesFact {plant:string;botanicalName:string;count:number}
export interface DesignFacts {
 hasDeck:boolean;hasHouse:boolean;
 /** Feet of railing on the house-side edge; null when there is no deck, no railing or no house to judge it against. */
 houseSideRailingFt:number|null;
 stairs:{id:string;landsOn:SurfaceKind;surface:string;surfaceId:string|null}[];
 standingLightsOnPaving:string[];
 /** Fixtures whose position neither the design nor the engine gives. */
 lightsNotPlaced:number;
 seatingAreas:{area:string;seats:number;linked:boolean}[];
 seats:number;seatsOffFocal:string[];
 lawn:{panels:number;openSqft:number;stripSqft:number};
 species:SpeciesFact[];plants:number;
 structures:number;orphanStructures:string[];
}
export interface DesignSummary {
 /** What Jev reads. */
 state:SummaryState;
 /** The same summary as text, for people and logs. */
 text:string;facts:DesignFacts;warnings:string[]}

const SEATING=/chair|sofa|bench|seat|stool|chaise/,CHAISE=/lounge-chair|chaise/,TABLE=/table/;
const LIGHT_TYPE:Record<string,string>={recessed:'flush light recessed into the surface',wall:'wall or step light',undercap:'strip light under a step or wall cap',bollard:'standing bollard light',spot:'standing spotlight on a ground stake',pendant:'hanging light',ceiling:'ceiling light'};
const LIGHT_ZONE:Record<string,string>={posts:'on the railing posts',stairs:'under the deck stair treads',house:'on the house wall',privacy:'on the privacy screen posts',border:'in the deck border'};
const share=(part:number,whole:number)=>whole>0?part/whole:0;

export async function summarizeDesign(input:unknown):Promise<DesignSummary>{
 const cfg=configurationOf(input),warnings:string[]=[],data=await engineData(cfg,warnings);
 const landscape=tolerantList(cfg.landscapeObjects,landscapeSchema,LIMITS.landscapeObjects,'Landscape objects',warnings).filter(o=>o.enabled);
 const lightItems=tolerantList(record(cfg.lightingSystem)?cfg.lightingSystem.selectedItems:undefined,lightSchema,LIMITS.lightItems,'Lighting items',warnings);
 const hasDeck=data.projectKind!=='hardscape';
 let model:DeckTakeoff|null=null;
 if(hasDeck)try{model=buildDeckTakeoff(data);}catch(error){warnings.push(`The deck engine could not model this deck (${reason(error)}), so railing and stairs were not measured.`);}
 const house=data.houseVisible===false?null:getHousePlacement(data);

 // Surfaces, in the order a point is tested: water, then built surfaces, then beds.
 const surfaces:Surface[]=[];
 for(const pool of data.pools??[]){if(pool.enabled===false)continue;try{surfaces.push({kind:'pool',id:pool.id,name:plainName(pool.name,'Pool'),poly:poolOutline(pool).map(fromPlan)});}catch{warnings.push('A pool outline could not be read.');}}
 if(model)for(const level of model.levels){if(level.kind==='winder'||level.footprint.outline.length<3)continue;surfaces.push({kind:'deck',id:`deck-${surfaces.length}`,name:level.kind==='landing'?'Stair landing':'Deck',poly:level.footprint.outline.map(p=>({x:p.x+level.offset.x,z:p.y+level.offset.z}))});}
 const flights=model?model.flights.filter(f=>f.kind==='grade'&&f.outward):[];
 for(const f of flights){const o=f.outward!,half=f.width/2,ax=o.y,az=-o.x;surfaces.push({kind:'stair',id:f.id,name:'Deck stair',poly:[{x:f.start.x-ax*half,z:f.start.z-az*half},{x:f.start.x+ax*half,z:f.start.z+az*half},{x:f.end.x+ax*half,z:f.end.z+az*half},{x:f.end.x-ax*half,z:f.end.z-az*half}]});}
 const yard=(data.yardFeatures??[]).filter(f=>f.enabled);
 const yardPoints=(f:YardFeature):Pt[]=>{try{return yardShapeCurveWorldPoints(f).map(fromPlan);}catch{return yardShapeWorldPoints(f).map(fromPlan);}};
 const patios:(Surface&{feature:YardFeature})[]=[];
 for(const f of yard.filter(f=>f.kind==='patio')){try{const poly=yardPoints(f);if(poly.length>=3)patios.push({kind:'paving',id:f.id,name:plainName(f.name,'Patio'),poly,feature:f});}catch{warnings.push('A patio outline could not be read.');}}
 surfaces.push(...patios);
 const rectangle=(o:LandscapeItem):Pt[]=>{const a=o.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:o.xIn+c*u*o.widthIn/2-s*v*o.depthIn/2,z:o.zIn+s*u*o.widthIn/2+c*v*o.depthIn/2}));};
 const beds:Surface[]=landscape.filter(o=>o.kind==='bed').map(o=>({kind:/artificial-grass|putting-green/.test(o.assetId)?'turf' as const:'bed' as const,id:o.id,name:plainName(o.name,'Bed'),poly:o.polygon??rectangle(o)})).filter(b=>polygonArea(b.poly)>1);
 surfaces.push(...beds.filter(b=>b.kind==='turf'),...beds.filter(b=>b.kind==='bed'));
 const surfaceAt=(p:Pt):Surface|null=>surfaces.find(s=>onSurface(p,s))??null;
 const where=(s:Surface|null)=>!s?'open lawn':s.kind==='paving'?`paving (${s.name})`:s.kind==='bed'?`planting bed (${s.name})`:s.kind==='turf'?`artificial turf (${s.name})`:s.kind==='pool'?'inside the pool outline':s.kind==='stair'?'the deck stair':'the deck';

 // Deck, house and railing.
 const facts:DesignFacts={hasDeck:!!model,hasHouse:!!house,houseSideRailingFt:null,stairs:[],standingLightsOnPaving:[],lightsNotPlaced:0,seatingAreas:[],seats:0,seatsOffFocal:[],lawn:{panels:0,openSqft:0,stripSqft:0},species:[],plants:0,structures:0,orphanStructures:[]};
 const railing:SummaryState['railing']=[];
 if(model){
  const level=model.levels[0],fp=level.footprint,contact=getHouseContact(data,fp),runs=guardRuns(model).filter(r=>Math.abs(r.a.y-r.b.y)<.5&&Math.abs(r.a.y-level.top)<1.5);
  const off=tolerantList(cfg.railSections,railSectionSchema,64,'Rail sections',[]).filter(s=>!s.enabled&&s.level===1&&s.edgeId==='rect-back'&&!fp.edgeIds?.includes('rect-back'));
  let houseFt=0,houseEdges=0,aliasUsed=false;
  fp.outline.forEach((a,i)=>{
   const b=fp.outline[(i+1)%fp.outline.length],len=Math.hypot(b.x-a.x,b.y-a.y);if(len<.5)return;
   const ux=(b.x-a.x)/len,uy=(b.y-a.y)/len,side=edgeFacing({x:uy,y:-ux});
   const onHouseLine=Math.abs(a.y)<1&&Math.abs(b.y)<1&&!!house&&Math.min(Math.max(a.x,b.x),house.x1)-Math.max(Math.min(a.x,b.x),house.x0)>6;
   const houseSide=contact.isContactEdge(i)||onHouseLine;
   let spans:[number,number][]=[];
   for(const r of runs){const ta=(r.a.x-a.x)*ux+(r.a.z-a.y)*uy,tb=(r.b.x-a.x)*ux+(r.b.z-a.y)*uy,da=Math.abs((r.a.x-a.x)*uy-(r.a.z-a.y)*ux),db=Math.abs((r.b.x-a.x)*uy-(r.b.z-a.y)*ux);
    if(da<1.5&&db<1.5){const lo=Math.max(0,Math.min(ta,tb)),hi=Math.min(len,Math.max(ta,tb));if(hi-lo>.5)spans.push([lo,hi]);}}
   // A design can switch the house-wall guard off under the edge name 'rect-back', which this build only gives to decks with angled corners.
   const length=(list:[number,number][])=>{let total=0,end=-Infinity;for(const [lo,hi] of [...list].sort((p,q)=>p[0]-q[0])){total+=Math.max(0,hi-Math.max(lo,end));end=Math.max(end,hi);}return total;};
   if(onHouseLine&&spans.length){const drawn=length(spans);
    for(const s of off){const reversed=ux<0,lo=len*(reversed?100-s.endPct:s.startPct)/100,hi=len*(reversed?100-s.startPct:s.endPct)/100;
     spans=spans.flatMap(([x,y]):[number,number][]=>hi<=x||lo>=y?[[x,y]]:[...(x<lo-.5?[[x,lo] as [number,number]]:[]),...(y>hi+.5?[[hi,y] as [number,number]]:[])]);}
    if(length(spans)<drawn-.5)aliasUsed=true;}
   const covered=length(spans);
   const stairHere=flights.some(f=>Math.abs((f.start.x-a.x)*uy-(f.start.z-a.y)*ux)<3&&(f.start.x-a.x)*ux+(f.start.z-a.y)*uy>-1&&(f.start.x-a.x)*ux+(f.start.z-a.y)*uy<len+1);
   const text=covered<6?'no railing':covered>len-6?'railing along its full length':`railing along about ${feet(covered)} ft of its ${feet(len)} ft${stairHere?', open at the stair':''}`;
   if(houseSide){houseEdges++;houseFt+=covered<6?0:covered/12;}
   railing.push({edge:houseSide?`${side.toLowerCase()} edge, the house side (against the house wall)`:`${side.toLowerCase()} edge`,railing:text});
  });
  if(aliasUsed)warnings.push('The design switches the house-wall guard off under the edge name “rect-back”. This build of DeckCraft only uses that name on decks with angled corners, so the app would still draw that guard until the estate house-wall change is merged. The check follows the design.');
  facts.houseSideRailingFt=houseEdges&&data.railingType!=='None'?Math.round(houseFt*10)/10:null;
 }

 // Stairs: the surface just beyond the bottom riser.
 const stairs:SummaryState['stairs']=[];
 if(flights.length){
  const lowest=Math.min(...flights.map(f=>f.end.y));
  flights.filter(f=>f.end.y<=lowest+8).forEach((f,i)=>{
   const o=f.outward!,probe={x:f.end.x+o.x*SUMMARY_RULES.stairProbeIn,z:f.end.z+o.y*SUMMARY_RULES.stairProbeIn},s=surfaceAt(probe);
   facts.stairs.push({id:f.id,landsOn:s?.kind??'open',surface:s?.name??'open lawn',surfaceId:s?.id??null});
   stairs.push({stair:`Deck stair ${i+1}, ${plural(f.risers,'riser')}, ${feet(f.width)} ft wide`,lands_on:where(s)});
  });
 }

 // Paving and how it joins up.
 const nodes=new Map<string,string>(),find=(id:string):string=>{let root=id;while(nodes.get(root)!==root)root=nodes.get(root)!;nodes.set(id,root);return root;},join=(a:string,b:string)=>nodes.set(find(a),find(b));
 if(model)nodes.set('deck','deck');for(const p of patios)nodes.set(p.id,p.id);
 const touching=new Map<string,string[]>(patios.map(p=>[p.id,[]]));
 for(let i=0;i<patios.length;i++)for(let j=i+1;j<patios.length;j++)if(pathPolygon(patios[i].poly,true,patios[j].poly)<=SUMMARY_RULES.touchIn){join(patios[i].id,patios[j].id);touching.get(patios[i].id)!.push(patios[j].name);touching.get(patios[j].id)!.push(patios[i].name);}
 const stairPatios=new Set<string>();
 for(const s of facts.stairs)if(s.landsOn==='paving'&&s.surfaceId&&nodes.has(s.surfaceId)){join('deck',s.surfaceId);stairPatios.add(s.surfaceId);}
 // A deck within a step of the ground joins the paving it touches without a stair.
 if(model&&data.height<=8)for(const p of patios)if(surfaces.some(s=>s.kind==='deck'&&pathPolygon(s.poly,true,p.poly)<=SUMMARY_RULES.touchIn))join('deck',p.id);
 const paving:SummaryState['paving']=patios.map(p=>({area:p.name,size:`about ${Math.round(polygonArea(p.poly)/144)} sq ft`,touches:[...(stairPatios.has(p.id)?['the deck stair']:[]),...touching.get(p.id)!].join(', ')||'no other paving'}));

 // Lights: fixture type from the catalogue, surface from where each one stands.
 const lightGroups=new Map<string,{fixture:string;type:string;kind:string;names:string[];count:number;standing:boolean}>();
 let placed:{productId:string;x:number;z:number;zone?:string}[]=[];
 if(model&&lightItems.some(i=>!i.places?.length))try{placed=extrasLayout(data,model).fixtures;}catch{warnings.push('Automatic light positions could not be worked out.');}
 const addLight=(fixture:string,type:string,standing:boolean,kind:string,name:string|null,count:number)=>{const key=`${fixture}|${kind}`,g=lightGroups.get(key)??{fixture,type,kind,names:[],count:0,standing};g.count+=count;if(name)g.names.push(name);lightGroups.set(key,g);};
 for(const item of lightItems){
  const product=getLightingRuntimeProduct(item.productId),geometry=product?.geometry??'unknown';
  if(geometry==='transformer'||geometry==='cable'||geometry==='accessory')continue;
  const fixture=plainName(product?.name,`unlisted fixture ${plainName(item.productId,'')}`.trim()),type=LIGHT_TYPE[geometry]??'fixture of unknown type',standing=geometry==='bollard'||geometry==='spot';
  const zone=item.zone??'',spots:Pt[]=item.places?.length?item.places:placed.filter(f=>f.productId===item.productId&&(!item.zone||f.zone===item.zone));
  if(!item.places?.length&&LIGHT_ZONE[zone]){addLight(fixture,type,standing,LIGHT_ZONE[zone],null,spots.length||item.qty);continue;}
  if(!spots.length){if(item.qty>0){facts.lightsNotPlaced+=item.qty;addLight(fixture,type,standing,'position not recorded in the design',null,item.qty);}continue;}
  for(const p of spots){const s=surfaceAt(p);addLight(fixture,type,standing,!s?'open lawn':s.kind==='paving'?'paving':s.kind==='bed'?'planting bed':s.kind==='turf'?'artificial turf':s.kind==='pool'?'inside the pool outline':s.kind==='stair'?'the deck stair':'the deck',s&&(s.kind==='paving'||s.kind==='bed'||s.kind==='turf')?s.name:null,1);}
 }
 const lights:SummaryState['lights']=[...lightGroups.values()].map(g=>({fixture:g.fixture,count:g.count,type:g.type,location:g.names.length?`${g.kind} (${listed(g.names)})`:g.kind}));
 for(const g of lightGroups.values())if(g.standing&&g.kind==='paving')facts.standingLightsOnPaving.push(`${g.count} × ${g.fixture} on ${listed(g.names)}`);

 // Seats: what each one should look at, and how far off it is turned. Rotation 0 faces away from the house (+z).
 const furniture=landscape.filter(o=>o.kind==='furniture'),seatItems=furniture.filter(o=>SEATING.test(o.assetId)),tables=furniture.filter(o=>TABLE.test(o.assetId)&&!SEATING.test(o.assetId));
 const fires=yard.filter(f=>f.kind==='fire-feature').map(f=>({x:f.xFt*12,z:f.zFt*12,label:`the fire feature (${plainName(f.name,'Fire feature')})`}));
 const pools=surfaces.filter(s=>s.kind==='pool');
 const nearest=(seat:LandscapeItem,items:{x:number;z:number;label:string}[],reach:number)=>items.map(i=>({...i,d:Math.hypot(i.x-seat.xIn,i.z-seat.zIn)})).filter(i=>i.d<=reach).sort((a,b)=>a.d-b.d)[0]??null;
 function focalOf(seat:LandscapeItem):{x:number;z:number;label:string}|null{
  if(CHAISE.test(seat.assetId)){let best:{x:number;z:number;label:string}|null=null,bestD=Infinity;for(const pool of pools){const q=nearestOnRing({x:seat.xIn,z:seat.zIn},pool.poly),d=Math.hypot(q.x-seat.xIn,q.z-seat.zIn);if(d<bestD){bestD=d;best={...q,label:'the pool'};}}return best;}
  const reach=SUMMARY_RULES.seatReachIn,dining=tables.filter(t=>!/coffee|side/.test(t.assetId)),coffee=tables.filter(t=>/coffee|side/.test(t.assetId));
  return nearest(seat,fires,reach.fire)
   ??nearest(seat,dining.map(t=>({x:t.xIn,z:t.zIn,label:`the table (${plainName(t.name,'Table')})`})),reach.dining)
   ??nearest(seat,coffee.map(t=>({x:t.xIn,z:t.zIn,label:`the low table (${plainName(t.name,'Table')})`})),reach.coffee)
   ??nearest(seat,seatItems.filter(s=>s.id!==seat.id&&!CHAISE.test(s.assetId)).map(s=>({x:s.xIn,z:s.zIn,label:'the seat opposite'})),reach.peer);
 }
 const seatGroups=new Map<string,SummaryState['seats'][number]>(),areaSeats=new Map<string,{area:string;node:string|null;names:string[];reason:string}>();
 for(const seat of seatItems){
  const s=surfaceAt({x:seat.xIn,z:seat.zIn}),area=!s?'Open lawn':s.kind==='deck'||s.kind==='stair'?'Deck':s.name,node=!s?null:s.kind==='deck'||s.kind==='stair'?'deck':s.kind==='paving'?s.id:null,name=plainName(seat.name,'Seat');
  const key=s?`${s.kind}:${s.id}`:'open',entry=areaSeats.get(key)??{area,node,names:[],reason:!s?'it sits on open lawn':s.kind==='paving'||s.kind==='deck'||s.kind==='stair'?'':`it sits in ${where(s)}`};entry.names.push(name);areaSeats.set(key,entry);
  const focal=focalOf(seat);let facing='no focal point within reach',label='none within reach';
  if(focal){const yaw=-seat.rotationDeg*Math.PI/180,dx=focal.x-seat.xIn,dz=focal.z-seat.zIn,len=Math.hypot(dx,dz)||1,deg=Math.acos(Math.min(1,Math.max(-1,(Math.sin(yaw)*dx+Math.cos(yaw)*dz)/len)))*180/Math.PI;
   label=focal.label;facing=deg<=SUMMARY_RULES.facingDeg?'faces its focal point':deg<=90?`angled away from its focal point (about ${Math.round(deg)}° off)`:`has its back to its focal point (about ${Math.round(deg)}° off)`;}
  if(facing!=='faces its focal point')facts.seatsOffFocal.push(`${name} on ${area}: ${facing}`);
  const group=`${area}|${name}|${label}|${facing}`,g=seatGroups.get(group)??{area,seat:name,count:0,focal_point:label,facing};g.count++;seatGroups.set(group,g);
 }
 facts.seats=seatItems.length;
 // The seating area with the most seats on a deck or paving is the one the others are measured against.
 const areas=[...areaSeats.values()],reference=areas.filter(a=>a.node).sort((a,b)=>b.names.length-a.names.length)[0],root=reference?find(reference.node!):null;
 const seating_areas:SummaryState['seating_areas']=areas.map(a=>{
  const linked=areas.length===1||(!!a.node&&!!root&&find(a.node)===root);facts.seatingAreas.push({area:a.area,seats:a.names.length,linked});
  const tally=[...new Set(a.names)].map(n=>`${a.names.filter(x=>x===n).length} × ${n}`);
  return {area:a.area,seats:listed(tally,5),paved_route:areas.length===1?'the only seating area':linked?'linked to the other seating areas by the deck, its stair and paving':`not linked to the other seating areas by paving: ${a.reason||`no paved route joins it to ${reference?.area??'the rest'}`}`};
 });

 // Planting.
 const plants=landscape.filter(o=>o.kind==='plant'),species=new Map<string,SpeciesFact>();
 for(const p of plants){const botanical=plainName(p.speciesRecord?.botanicalName,''),plant=plainName(p.speciesRecord?.commonName??p.name,'Unnamed plant'),key=botanical||plant,s=species.get(key)??{plant,botanicalName:botanical||'not recorded',count:0};s.count++;species.set(key,s);}
 facts.species=[...species.values()].sort((a,b)=>b.count-a.count);facts.plants=plants.length;
 const plantingBeds=beds.filter(b=>b.kind==='bed'),outside=plants.filter(p=>!plantingBeds.some(b=>onSurface({x:p.xIn,z:p.zIn},b))).length;
 const planting:SummaryState['planting']={beds:plantingBeds.length?`${plural(plantingBeds.length,'planting bed')}: ${listed(plantingBeds.map(b=>b.name),8)}`:'no planting beds',
  species:facts.species.map(s=>({plant:s.plant,botanical_name:s.botanicalName,count:s.count})),
  plants_outside_beds:!plants.length?'no plants':!outside?'none: every plant stands in a bed':share(outside,plants.length)<.15?'a few plants stand outside the beds':'many plants stand outside the beds'};

 // Lawn: the open ground that is left once everything drawn is taken out, measured on a 1 ft grid.
 const lot=house&&data.permitSite?{x0:house.x0-data.permitSite.leftYardFt*12,x1:house.x0-data.permitSite.leftYardFt*12+data.permitSite.lotWidthFt*12,z0:0,z1:data.permitSite.rearYardFt*12}:null;
 const drawn=surfaces.length?boxOf(surfaces.flatMap(s=>s.poly)):null,bounds=lot??(drawn?{...drawn,z0:Math.max(0,drawn.z0)}:null);
 const lawn:SummaryState['lawn']={measured_within:lot?'the rear yard inside the lot lines recorded in the design':'the box around everything drawn (the design records no lot lines)',panels:[],leftover_strips:'no open ground',
  artificial_turf:beds.some(b=>b.kind==='turf')?listed(beds.filter(b=>b.kind==='turf').map(b=>b.name)):'none'};
 if(bounds&&bounds.x1-bounds.x0>24&&bounds.z1-bounds.z0>24){
  const spanX=bounds.x1-bounds.x0,spanZ=bounds.z1-bounds.z0,cell=Math.max(12,Math.ceil(Math.sqrt(spanX*spanZ/LIMITS.cells)/12)*12),cols=Math.ceil(spanX/cell),rows=Math.ceil(spanZ/cell);
  const grid:(SurfaceKind)[]=new Array(cols*rows);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const p={x:bounds.x0+(c+.5)*cell,z:bounds.z0+(r+.5)*cell};grid[r*cols+c]=surfaceAt(p)?.kind??'open';}
  // A strip: open ground whose open run, across or along the yard, is narrower than the limit.
  const strip=new Uint8Array(cols*rows),narrow=Math.ceil(SUMMARY_RULES.stripIn/cell)-1;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;){if(grid[r*cols+c]!=='open'){c++;continue;}let e=c;while(e<cols&&grid[r*cols+e]==='open')e++;if(e-c<=narrow)for(let k=c;k<e;k++)strip[r*cols+k]=1;c=e;}
  for(let c=0;c<cols;c++)for(let r=0;r<rows;){if(grid[r*cols+c]!=='open'){r++;continue;}let e=r;while(e<rows&&grid[e*cols+c]==='open')e++;if(e-r<=narrow)for(let k=r;k<e;k++)strip[k*cols+c]=1;r=e;}
  const seen=new Uint8Array(cols*rows),sqft=cell*cell/144,panels:{cells:number;edge:Record<string,number>}[]=[];let openCells=0,stripCells=0;
  for(let i=0;i<grid.length;i++){if(grid[i]!=='open')continue;openCells++;if(strip[i]){stripCells++;continue;}if(seen[i])continue;
   const panel={cells:0,edge:{} as Record<string,number>},stack=[i];seen[i]=1;
   while(stack.length){const at=stack.pop()!,r=Math.floor(at/cols),c=at%cols;panel.cells++;
    for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){const nr=r+dr,nc=c+dc;
     if(nr<0||nc<0||nr>=rows||nc>=cols){const label=lot?(nr<0?'the house and deck line':'the lot line'):'the edge of the drawing';panel.edge[label]=(panel.edge[label]??0)+1;continue;}
     const n=nr*cols+nc,kind=grid[n];
     if(kind==='open'){if(strip[n])panel.edge['leftover strips']=(panel.edge['leftover strips']??0)+1;else if(!seen[n]){seen[n]=1;stack.push(n);}continue;}
     const label=kind==='bed'?'planting beds':kind==='paving'?'paving':kind==='pool'?'the pool':kind==='turf'?'artificial turf':'the deck';panel.edge[label]=(panel.edge[label]??0)+1;}}
   panels.push(panel);}
  // A panel under 50 sq ft is a scrap, counted with the strips.
  const real=panels.filter(p=>p.cells*sqft>=50).sort((a,b)=>b.cells-a.cells),scraps=panels.filter(p=>p.cells*sqft<50).reduce((n,p)=>n+p.cells,0),leftover=(stripCells+scraps)*sqft,open=openCells*sqft,about=`about ${Math.round(leftover)} sq ft`;
  facts.lawn={panels:real.length,openSqft:Math.round(open),stripSqft:Math.round(leftover)};
  lawn.panels=real.slice(0,6).map((p,i)=>{const total=Object.values(p.edge).reduce((a,b)=>a+b,0),parts=Object.entries(p.edge).sort((a,b)=>b[1]-a[1]).filter(([,n])=>share(n,total)>=.05).map(([label,n])=>`${share(n,total)>=.6?'mostly':share(n,total)>=.2?'partly':'a little'} ${label}`);
   return {panel:`Lawn panel ${i+1}`,size:`about ${Math.round(p.cells*sqft)} sq ft`,framed_by:parts.join(', ')||'nothing drawn'};});
  // Measured against the whole yard: against the open ground alone, a yard that is nearly all built or planted would
  // call a few square feet of gaps a large share.
  const part=share(leftover,cols*rows*sqft);
  const kinds='lies in strips narrower than 3 ft or scraps under 50 sq ft';
  lawn.leftover_strips=!openCells?'no open ground: the yard is fully built or planted':leftover<1?'none':part<.03?`negligible: ${about}, under 3% of the yard, ${kinds}`:part<.1?`noticeable: ${about}, between 3% and 10% of the yard, ${kinds}`:`large: ${about}, over 10% of the yard, ${kinds}`;
 }

 // Structures: what each one is for and what it joins.
 const structures:SummaryState['structures']=[];
 const structure=(name:string,role:string,orphan:boolean)=>{structures.push({structure:name,role});if(orphan)facts.orphanStructures.push(name);};
 const seatsWithin=(p:Pt,reach:number)=>seatItems.filter(s=>Math.hypot(s.xIn-p.x,s.zIn-p.z)<=reach).length;
 for(const p of patios){
  const seatsHere=seatItems.filter(s=>inside({x:s.xIn,z:s.zIn},p.poly)).length,fire=yard.filter(f=>f.kind==='fire-feature'&&inside({x:f.xFt*12,z:f.zFt*12},p.poly)).map(f=>plainName(f.name,'Fire feature'));
  const pool=pools.filter(w=>pathPolygon(w.poly,true,p.poly)<=SUMMARY_RULES.adjoinIn*2).map(w=>w.name),links=touching.get(p.id)!,stair=stairPatios.has(p.id);
  const uses=[...(stair?['the deck stair lands on it']:[]),...(seatsHere?[`holds ${plural(seatsHere,'seat')}`]:[]),...(fire.length?[`holds ${listed(fire)}`]:[]),...(pool.length?[`borders ${listed(pool)}`]:[])];
  const alone=!links.length&&!stair&&(patios.length>1||!!model);
  const joined=links.length?`touches ${listed(links)}`:alone?'touches no other paving':'';
  structure(`Paved area: ${p.name}`,uses.length?[...uses,...(joined?[joined]:[])].join('; '):links.length>=2?`a walk linking ${listed(links)}`:links.length===1?`a paved spur off ${links[0]} with no seat or feature on it`:'stands alone: no seat, feature or paved link',alone||(!uses.length&&links.length<2));
 }
 for(const f of yard.filter(f=>f.kind==='retaining-wall')){
  let path:Pt[]=[];try{path=yardPoints(f);}catch{/* described without neighbours */}
  const near=(list:Surface[])=>list.filter(s=>path.length>1&&pathPolygon(path,false,s.poly)<=SUMMARY_RULES.adjoinIn).map(s=>s.name),byPaving=near(patios),byBeds=near(plantingBeds);
  const kind=f.wallConstruction&&'freestanding'in f.wallConstruction&&f.wallConstruction.freestanding?'Freestanding seat wall':'Retaining wall';
  structure(`${kind}: ${plainName(f.name,'Wall')}`,byPaving.length||byBeds.length?`${Math.round(f.heightIn)} in high, runs along ${listed([...byPaving,...byBeds])}`:`${Math.round(f.heightIn)} in high, stands alone on open lawn, touching no paving or bed`,!byPaving.length&&!byBeds.length);
 }
 for(const f of yard.filter(f=>f.kind==='fire-feature'||f.kind==='water-feature')){
  const at={x:f.xFt*12,z:f.zFt*12},s=surfaceAt(at),near=seatsWithin(at,SUMMARY_RULES.seatReachIn.fire),label=f.kind==='fire-feature'?'Fire feature':'Water feature';
  const paved=s?.kind==='paving',seated=near?`${plural(near,'seat')} within 12 ft`:'';
  // Furniture is often left out of a model, so a feature on paving with no seat drawn is not a fault.
  structure(`${label}: ${plainName(f.name,label)}`,paved||near?[`on ${where(s)}`,...(seated?[seated]:[])].join('; '):`stands alone on ${where(s)}: not on paving and no seat within 12 ft`,!paved&&!near);
 }
 for(const w of pools){const by=patios.filter(p=>pathPolygon(w.poly,true,p.poly)<=SUMMARY_RULES.adjoinIn*2).map(p=>p.name);structure(`Pool: ${w.name}`,by.length?`bordered by paving (${listed(by)})`:'no paving beside it',!by.length);}
 if(data.pergola){const target=data.pergola.target,on=target?.kind==='patio'?patios.find(p=>p.id===target.featureId)?.name:null;structure('Pergola',target?.kind==='deck'?'stands on the deck':on?`stands on paving (${on})`:'position not tied to the deck or a paved area',!target||(target.kind==='patio'&&!on));}
 facts.structures=structures.length;

 const hedges=plants.filter(p=>/hedge/.test(p.assetId)).length,screens=(data.privacyScreens??[]).length;
 const state:SummaryState={
  deck:model?`${feet(data.width*12)} ft wide and ${feet(data.length*12)} ft deep, ${Math.round(data.height)} in above the ground, ${plainName(data.deckType,'deck').toLowerCase()}, ${plural(Number(data.levels)||1,'level')}. Railing type: ${plainName(data.railingType,'none')}.`:'No deck in this design.',
  house:house?'A house is modelled along the back edge of the deck.':'No house is modelled.',
  railing,stairs,paving,lights,seating_areas,seats:[...seatGroups.values()],lawn,planting,structures,
  fence_and_privacy:`No fence is recorded: this design format has no fence object. ${hedges?`${plural(hedges,'hedge shrub')} planted`:'No hedge planted'}; ${screens?plural(screens,'privacy screen'):'no privacy screens'} on the deck.`,
 };
 return {state,text:summaryText(state),facts,warnings};
}

const TITLES:Record<keyof SummaryState,string>={deck:'Deck',house:'House',railing:'Railing by deck edge',stairs:'Stairs',paving:'Paved areas',lights:'Lights',seating_areas:'Seating areas',seats:'Seats',lawn:'Lawn',planting:'Planting',structures:'Structures',fence_and_privacy:'Fence and privacy'};
const words=(key:string)=>key.replace(/_/g,' ');
function lines(value:unknown,indent:string):string[]{
 if(Array.isArray(value))return value.length?value.map(item=>`${indent}- ${record(item)?Object.entries(item).map(([k,v])=>`${words(k)}: ${v}`).join('; '):item}`):[`${indent}- none`];
 if(record(value))return Object.entries(value).flatMap(([k,v])=>Array.isArray(v)?[`${indent}${words(k)}:`,...lines(v,`${indent}  `)]:[`${indent}${words(k)}: ${v}`]);
 return [`${indent}${value}`];
}
/** The state as readable text. */
export function summaryText(state:SummaryState):string{
 return (Object.keys(TITLES) as (keyof SummaryState)[]).flatMap(key=>[`${TITLES[key]}:`,...lines(state[key],'  ')]).join('\n');
}
