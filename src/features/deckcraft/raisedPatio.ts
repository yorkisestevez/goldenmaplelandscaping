import type {PlanPoint} from './lib/deckGeometry';
import type {SiteSurface} from './siteSurface';
import type {YardFeature} from './types';
import {yardFeatureOutline,pathRun,yardPathEnvelope} from './yardPathGeometry';
import {patioTopPlane,planeAt} from './yardElevationGeometry';
import {patioEdgeSpans} from './patioGroundContact';
import {wallCoursePath} from './wallFoundation';
import {GUARD} from './designRules';

/**
 * Raised patios, built from existing pieces: a patio at a fixed level, a retaining wall along the edges where it stands
 * well above the measured ground, and stone steps down to grade. Pure helpers for the site designer's move engine; the
 * yard model prices and checks whatever they produce like any hand-drawn wall.
 */

/** One run of a patio edge where its finished surface stands more than the threshold above the measured ground beside
 * it. World plan inches, ordered with the patio on the left: a retaining wall drawn along it (its wallPath direction)
 * retains the patio and shows its face outward. `maxRiseIn` is the tallest finished-surface-over-ground on the run. */
export interface RaisedEdgeRun {points:PlanPoint[];lengthIn:number;maxRiseIn:number}

const key=(p:PlanPoint)=>`${p.x.toFixed(4)}:${p.y.toFixed(4)}`;
const turn=(a:PlanPoint,b:PlanPoint,c:PlanPoint)=>(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);

/** The patio's edge runs where it stands more than `minHeightIn` above the measured (proposed) ground just outside it.
 * The ground is read 0.5 in outside the edge, between survey breaks, as the yard model's edge check reads it. `skip`
 * leaves out edge pieces whose outside is not open ground (a stair flight, another patio). Unknown ground is left out. */
export function raisedPatioWallPath(feature:YardFeature,surface:SiteSurface,minHeightIn:number,skip?:(x:number,z:number)=>boolean):RaisedEdgeRun[]{
 const grade=surface.sample(feature.xFt*12,feature.zFt*12)??0,plane=patioTopPlane(feature,grade);
 const spans=patioEdgeSpans(yardFeatureOutline(feature),plane,(x,z)=>surface.sample(x,z,'proposed'),{probeIn:.5,breaks:(a,b)=>surface.lineBreaks(a,b,'proposed'),...(skip?{skip}:{})});
 // Raised pieces, each turned so the outside (its exposed face) is on its right.
 const pieces:{a:PlanPoint;b:PlanPoint;rise:number}[]=[];
 for(const s of spans){
  if(s.a.ground===undefined||s.b.ground===undefined)continue;
  const ra=s.a.top-s.a.ground,rb=s.b.top-s.b.ground;if(ra<=minHeightIn&&rb<=minHeightIn)continue;
  const at=(t:number)=>({x:s.a.x+(s.b.x-s.a.x)*t,y:s.a.z+(s.b.z-s.a.z)*t}),cut=(ra-minHeightIn)/(ra-rb);
  let a=at(ra>minHeightIn?0:cut),b=at(rb>minHeightIn?1:cut);
  if((b.x-a.x)*-s.out.z+(b.y-a.y)*s.out.x<0)[a,b]=[b,a];
  if(Math.hypot(b.x-a.x,b.y-a.y)>.01)pieces.push({a,b,rise:Math.max(ra,rb)});
 }
 // Chain pieces end to start into runs; a run starts where no piece ends (or anywhere on a closed ring).
 const byStart=new Map<string,number[]>(),ends=new Set(pieces.map(p=>key(p.b))),used=new Set<number>(),runs:RaisedEdgeRun[]=[];
 pieces.forEach((p,i)=>byStart.set(key(p.a),[...(byStart.get(key(p.a))??[]),i]));
 const order=[...pieces.keys()].sort((i,j)=>Number(ends.has(key(pieces[i].a)))-Number(ends.has(key(pieces[j].a))));
 for(const first of order){
  if(used.has(first))continue;
  const points=[pieces[first].a];let i:number|undefined=first,maxRiseIn=0;
  while(i!==undefined&&!used.has(i)){used.add(i);const p:{a:PlanPoint;b:PlanPoint;rise:number}=pieces[i];points.push(p.b);maxRiseIn=Math.max(maxRiseIn,p.rise);i=byStart.get(key(p.b))?.find(j=>!used.has(j));}
  // One vertex per corner: drop the survey-break points along a straight edge.
  const clean=points.filter((p,k)=>k===0||k===points.length-1||Math.abs(turn(points[k-1],p,points[k+1]))>1e-6*Math.hypot(points[k+1].x-points[k-1].x,points[k+1].y-points[k-1].y)**2);
  runs.push({points:clean,lengthIn:pathRun(clean),maxRiseIn});
 }
 return runs.sort((a,b)=>b.lengthIn-a.lengthIn);
}

/** One stretch of patio edge that needs a guard: on edge `edge` of the ring (from its vertex `edge`), `out` its outward
 * normal, `dropIn` the most the walking surface stands above the lowest ground beside it, `steep` where that ground
 * falls away steeper than 1 in 2. */
export interface GuardRun {edge:number;out:PlanPoint;from:PlanPoint;to:PlanPoint;lengthIn:number;dropIn:number;steep:boolean}
export interface RaisedPatioGuard {
 /** A guard is required somewhere on the edge. */
 required:boolean;
 /** Total edge length needing a guard (in), and the runs. */
 lengthIn:number;runs:GuardRun[];
 /** Over every open edge piece: the most the surface stands above the lowest ground within reach, and whether that
  * ground anywhere falls steeper than 1 in 2. */
 maxDropIn:number;steep:boolean;
 /** Ground points within reach that are off the survey (left out). */
 unmeasured:number;
}
/**
 * Where a walking surface at `levelIn` with outline `ring` needs a guard (designRules.ts GUARD, OBC 9.8.8.1.(1)): where
 * it stands more than GUARD.requiredAboveIn (600 mm) above the LOWEST proposed ground within GUARD.adjacentWithinIn
 * (1.2 m) of its edge, or where that ground falls away steeper than 1 in 2 (GUARD.adjacentSlopeTrigger). Every edge is
 * read in pieces about `stepIn` long, each out along its outward normal every `stepIn` to 1.2 m, and the corners are
 * fanned, so every point within 1.2 m of the edge is read. `open(x, z)` says where the outside is open ground: a piece
 * whose outside is not (shared with a landing, the deck, a stair) needs no guard, and a reading stops where it meets
 * a structure. Unmeasured ground is left out and counted. Plan inches; the ring in either winding.
 */
export function raisedPatioGuard(ring:PlanPoint[],levelIn:number,surface:Pick<SiteSurface,'sample'>,open:(x:number,z:number)=>boolean=()=>true,stepIn=6):RaisedPatioGuard{
 const reachIn=GUARD.adjacentWithinIn,above=GUARD.requiredAboveIn,fall=GUARD.adjacentSlopeTrigger,n=ring.length;
 const area=ring.reduce((s,a,i)=>{const b=ring[(i+1)%n];return s+a.x*b.y-b.x*a.y;},0),sgn=area>=0?1:-1;
 const dists=[.5];for(let d=stepIn;d<reachIn-1e-9;d+=stepIn)dists.push(d);dists.push(reachIn);
 let unmeasured=0;
 /** The lowest ground along one reading, and whether it falls steeper than 1 in 2 anywhere along it. */
 const read=(q:PlanPoint,dir:PlanPoint)=>{let low=Infinity,steep=false,prev:{d:number;g:number}|undefined;
  for(const d of dists){const x=q.x+dir.x*d,z=q.y+dir.y*d;if(!open(x,z))break;const g=surface.sample(x,z,'proposed');
   if(g===undefined||!Number.isFinite(g)){unmeasured++;prev=undefined;continue;}
   low=Math.min(low,g);if(prev&&(prev.g-g)/(d-prev.d)>fall+1e-9)steep=true;prev={d,g};}
  return {drop:levelIn-low,steep};};
 const edges=ring.map((a,i)=>{const b=ring[(i+1)%n],len=Math.hypot(b.x-a.x,b.y-a.y)||1,t={x:(b.x-a.x)/len,y:(b.y-a.y)/len};return {a,b,len,t,out:{x:sgn*t.y,y:-sgn*t.x}};});
 type Piece={from:PlanPoint;to:PlanPoint;len:number;open:boolean;drop:number;steep:boolean};
 const pieces:Piece[][]=edges.map(e=>{const m=Math.max(1,Math.ceil(e.len/stepIn-1e-9));return Array.from({length:m},(_,k)=>{
  const at=(f:number)=>({x:e.a.x+e.t.x*e.len*f,y:e.a.y+e.t.y*e.len*f}),q=at((k+.5)/m),probe={x:q.x+e.out.x*.5,y:q.y+e.out.y*.5};
  if(!open(probe.x,probe.y))return {from:at(k/m),to:at((k+1)/m),len:e.len/m,open:false,drop:-Infinity,steep:false};
  const r=read(q,e.out);return {from:at(k/m),to:at((k+1)/m),len:e.len/m,open:true,drop:r.drop,steep:r.steep};});});
 // Corners: readings fanned from the end of one edge's normal to the start of the next (convex corners only).
 edges.forEach((e,i)=>{const next=edges[(i+1)%n],turn=e.t.x*next.t.y-e.t.y*next.t.x;if(turn*sgn<=1e-9)return;
  const a0=Math.atan2(e.out.y,e.out.x);let a1=Math.atan2(next.out.y,next.out.x);while(a1-a0>Math.PI)a1-=2*Math.PI;while(a0-a1>Math.PI)a1+=2*Math.PI;
  const ends=[pieces[i].at(-1)!,pieces[(i+1)%n][0]];if(!ends.some(p=>p.open))return;
  for(let k=1;k<4;k++){const a=a0+(a1-a0)*k/4,r=read(e.b,{x:Math.cos(a),y:Math.sin(a)});for(const p of ends)if(p.open){p.drop=Math.max(p.drop,r.drop);p.steep||=r.steep;}}});
 const needs=(p:Piece)=>p.open&&(p.drop>above+1e-9||p.steep),runs:GuardRun[]=[];let maxDropIn=-Infinity,steep=false;
 pieces.forEach((list,i)=>{let run:GuardRun|undefined;for(const p of list){if(p.open){maxDropIn=Math.max(maxDropIn,p.drop);steep||=p.steep;}
  if(!needs(p)){run=undefined;continue;}
  if(!run){run={edge:i,out:edges[i].out,from:p.from,to:p.to,lengthIn:0,dropIn:-Infinity,steep:false};runs.push(run);}
  run.to=p.to;run.lengthIn+=p.len;run.dropIn=Math.max(run.dropIn,p.drop);run.steep||=p.steep;}});
 const lengthIn=runs.reduce((s,r)=>s+r.lengthIn,0);
 return {required:runs.length>0,lengthIn,runs,maxDropIn:Number.isFinite(maxDropIn)?maxDropIn:0,steep,unmeasured};
}

/** The cap top sits this far under the paving it holds: the paving's edge stands just proud of the cap. */
export const RAISED_PATIO_CAP_DROP_IN=.5;

/** For a patio at a fixed level (finishedElevationIn). A generic segmental retaining wall along a raised run: the inner edge of its cap on the patio edge (a `jointIn`
 * paving joint between), its cap top RAISED_PATIO_CAP_DROP_IN under the paving, its body from the measured ground (the
 * model buries and steps the foundation along it) and the paving connection on, so the patio paves over its working
 * space. With `surface`, heightIn (the estimator's wall height band) is its tallest exposed face over the measured
 * ground under its footprint; without, the run's rise. Planning geometry only; design, outlet and grid stay quoted. */
export function raisedPatioWall(patio:YardFeature,run:RaisedEdgeRun,id:string,options:{name?:string;depthIn?:number;jointIn?:number;color?:string;surface?:SiteSurface}={}):YardFeature{
 const depth=options.depthIn??12,joint=options.jointIn??.25,path=wallCoursePath(run.points,-((depth+2)/2+joint));
 const xs=path.map(p=>p.x),zs=path.map(p=>p.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2;
 const plane=patioTopPlane(patio,0)/* a fixed level: the grade is unused */,top=Math.max(...run.points.map(p=>planeAt(plane,p.x,p.y)))-RAISED_PATIO_CAP_DROP_IN;
 // Saved paths are local inches about the centre; the saved run (widthFt) must match the rounded path exactly.
 const wallPath=path.map(p=>({x:Math.round((p.x-cx)*1000)/1000,y:Math.round((p.y-cz)*1000)/1000}));
 return {id,kind:'retaining-wall',name:options.name??`${patio.name} wall`,enabled:true,xFt:cx/12,zFt:cz/12,widthFt:pathRun(wallPath)/12,depthFt:depth/12,heightIn:Math.min(72,Math.max(6,Math.ceil(options.surface?top-options.surface.extrema(yardPathEnvelope(path,depth+2)).min:run.maxRiseIn))),rotationDeg:0,productId:'segmental-concrete',color:options.color??'#aaa69b',finishedElevationIn:Math.round(top*100)/100,wallPath,pavingInterface:{jointIn:joint}};
}
