import type {PlanPoint} from './lib/deckGeometry';
import type {SitePlane} from './siteSurface';

/** Where a patio's edge meets the ground beside it. Pure: the ground comes from the caller (the measured proposed
 * grade for the design checks, the lawn as drawn for the 3D), so both read the same edge the same way. */
export interface PatioEdgeSample {x:number;z:number;top:number;ground:number|undefined}
/** One straight piece of a patio edge; `out` is the unit normal pointing away from the paving. */
export interface PatioEdgeSpan {a:PatioEdgeSample;b:PatioEdgeSample;out:{x:number;z:number}}
export interface PatioEdgeOptions {
 /** Longest piece, inches: the ground between samples is read as a straight line. */
 stepIn?:number;
 /** Extra fractions (0…1) along a→b where the ground's slope changes (survey triangle edges). */
 breaks?:(a:PlanPoint,b:PlanPoint)=>number[];
 /** Leave out pieces whose outside is not open ground (a pool, a pond or another patio). */
 skip?:(x:number,z:number)=>boolean;
 /** Read each sample's ground this far outside the edge, inches, along the piece's outward normal (its top stays on
  * the edge). Exactly on the edge the survey's triangles may hand back the ground under the paving rather than the
  * ground graded beside it (a ground-fit bank); just outside always reads the ground beside it. */
 probeIn?:number;
}
const planeAt=(p:SitePlane,x:number,z:number)=>p.x*x+p.z*z+p.constant;
/** Even-odd inside test over every ring, so a pond cut out of a patio counts as outside. */
export function insideRings(rings:PlanPoint[][],x:number,z:number){
 let odd=false;
 for(const p of rings)for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a.y>z)!==(b.y>z)&&x<(b.x-a.x)*(z-a.y)/(b.y-a.y)+a.x)odd=!odd;}
 return odd;
}
/** True inside any one of these areas, each read even-odd on its own (a patio's outline with its holes, a pool, a
 * deck post's cut-out…), so two areas that overlap never cancel. For `skip`: ground there is not open lawn. */
export const insideAny=(areas:PlanPoint[][][])=>(x:number,z:number)=>areas.some(rings=>insideRings(rings,x,z));
/** A patio edge cut into straight pieces at every ground break, each with its outside side worked out from the
 * paving itself (rings may wind either way, holes included). */
export function patioEdgeSpans(rings:PlanPoint[][],plane:SitePlane,ground:(x:number,z:number)=>number|undefined,options:PatioEdgeOptions={}):PatioEdgeSpan[]{
 const step=options.stepIn??3,out:PatioEdgeSpan[]=[],PROBE=.75,probe=options.probeIn??0;
 const sample=(x:number,z:number,normal:{x:number;z:number}):PatioEdgeSample=>({x,z,top:planeAt(plane,x,z),ground:ground(x+normal.x*probe,z+normal.z*probe)});
 for(const ring of rings)for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],length=Math.hypot(b.x-a.x,b.y-a.y);if(length<.01)continue;
  const n={x:(b.y-a.y)/length,z:-(b.x-a.x)/length},count=Math.max(1,Math.ceil(length/step));
  const stops=[...new Set([...Array.from({length:count+1},(_,k)=>k/count),...(options.breaks?.(a,b)??[]).filter(t=>t>0&&t<1)].map(t=>Math.round(t*1e9)/1e9))].sort((p,q)=>p-q);
  for(let k=0;k+1<stops.length;k++){
   const u=stops[k],v=stops[k+1];if((v-u)*length<.01)continue;
   const m=(u+v)/2,mx=a.x+(b.x-a.x)*m,mz=a.y+(b.y-a.y)*m,left=insideRings(rings,mx+n.x*PROBE,mz+n.z*PROBE),right=insideRings(rings,mx-n.x*PROBE,mz-n.z*PROBE);
   if(left===right)continue;
   const normal=left?{x:-n.x,z:-n.z}:n;
   if(options.skip?.(mx+normal.x*PROBE,mz+normal.z*PROBE))continue;
   out.push({a:sample(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u,normal),b:sample(a.x+(b.x-a.x)*v,a.y+(b.y-a.y)*v,normal),out:normal});
  }
 }
 return out;
}
/** How far the ground beside a patio rises above its finished surface, and how far that surface stands above the
 * ground, each with the edge point where it is greatest. Pieces with unknown ground are left out. */
export function patioGroundGaps(spans:PatioEdgeSpan[]){
 let aboveIn=0,belowIn=0,above:{x:number;z:number}|undefined,below:{x:number;z:number}|undefined;
 for(const s of spans)for(const p of [s.a,s.b]){if(p.ground===undefined)continue;const up=p.ground-p.top,down=p.top-p.ground;if(up>aboveIn){aboveIn=up;above={x:p.x,z:p.z};}if(down>belowIn){belowIn=down;below={x:p.x,z:p.z};}}
 return {aboveIn,belowIn,above,below};
}
/** Where a patio's finished surface stands more than `aboveIn` over the ground beside it (a raised side a stone edge
 * course holds): that length of edge, inches, and its tallest rise there (finished surface less ground). Pieces with
 * unknown ground are left out; the ground is read as a straight line along each piece. */
export function patioRaisedEdge(spans:PatioEdgeSpan[],aboveIn:number){
 let lengthIn=0,maxIn=0;
 for(const s of spans){if(s.a.ground===undefined||s.b.ground===undefined)continue;const da=s.a.top-s.a.ground,db=s.b.top-s.b.ground;if(da<=aboveIn&&db<=aboveIn)continue;
  lengthIn+=Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z)*(da>aboveIn&&db>aboveIn?1:da>aboveIn?(da-aboveIn)/(da-db):(db-aboveIn)/(db-da));maxIn=Math.max(maxIn,da,db);}
 return {lengthIn,maxIn};
}
/** "back-right", "front", …: where a point sits on a patio, as the plan reads (back is towards the house, −z;
 * right is +x). */
export function patioEdgeWords(rings:PlanPoint[][],p:{x:number;z:number}){
 const xs=rings.flat().map(q=>q.x),zs=rings.flat().map(q=>q.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2,hx=Math.max(1,(Math.max(...xs)-Math.min(...xs))/2),hz=Math.max(1,(Math.max(...zs)-Math.min(...zs))/2);
 const u=(p.x-cx)/hx,v=(p.z-cz)/hz,depth=v<-1/3?'back':v>1/3?'front':'',side=u<-1/3?'left':u>1/3?'right':'';
 return [depth,side].filter(Boolean).join('-')||'middle';
}
