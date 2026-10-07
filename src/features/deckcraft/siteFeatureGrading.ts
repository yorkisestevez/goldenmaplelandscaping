import type {DeckData,YardFeature} from './types';
import {GROUND_FIT_LIMITS} from './types';
import type {SiteModel,SiteFeaturePad,SiteBoundaryPoint as Point} from './siteModel';
import type {SiteSurface,SiteSurfaceTriangle,SitePlane,SiteVertex} from './siteSurfaceEngine';
import type {GradingTransitionModel} from './gradingTransitionGeometry';
import {yardFeatureOutline} from './yardPathGeometry';
import {patioTopPlane} from './yardElevationGeometry';
import {validateFeaturePads,validateFeaturePadOccupied,FEATURE_PAD_LIMITS} from './siteModelRuntime';
import {siteClip,siteArea} from './siteSurfaceEngine';

/** Why a pad's bank is not (wholly) built. The warnings are worded from these and the patio's current name. */
export type SiteFeaturePadIssue='unmeasured'|'off-survey'|'coverage'|'reach';
/** One ground-fit patio's graded bank, as built (G2 contract; implemented by siteFeatureGrading). cutYd3/fillYd3 are the
 * bank's own earthwork against the ground before it (grading and transitions applied); areaSqft is the ground it
 * disturbs that needs restoring (none under other paving). */
export interface SiteFeaturePadModel {featureId:string;name:string;status:'ready'|'partial'|'pending';warnings:string[];cutYd3:number;fillYd3:number;areaSqft:number;runIn:number;issues?:SiteFeaturePadIssue[]}

const REACH=GROUND_FIT_LIMITS.maxBankRunIn;
/** The warning for each issue, in the patio's own words. */
export function featurePadWarnings(name:string,issues:SiteFeaturePadIssue[],slopeRatio:number):string[]{
 const ratio=Number(slopeRatio.toFixed(2)),feet=Math.round(REACH/12);
 return issues.map(i=>i==='unmeasured'?`${name}: it stands outside the measured ground, so the ground round it is not graded; extend the survey to it.`
  :i==='off-survey'?`${name}: part of it stands outside the measured ground, so the ground round it is not graded; extend the survey to cover the whole patio.`
  :i==='coverage'?`${name}: its graded bank runs past the measured ground; extend the survey there. Earthwork is counted only where it is measured.`
  :`${name}: the ground does not meet a ${ratio}:1 bank within ${feet} ft; use a stone edge, a wall, or a steeper bank.`);
}

/** A patio's ground-fit pad, or undefined when it has none or its outline cannot shape the survey (the yard model
 * reports a bad shape itself; the ground round it is simply left ungraded). */
function groundFitPad(f:YardFeature):SiteFeaturePad|undefined{
 const ratio=Number(f.groundFit!.slopeRatio),{minRatio,maxRatio,defaultRatio}=GROUND_FIT_LIMITS,name=typeof f.name==='string'?f.name.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,120):'';
 try{const plane=patioTopPlane(f,0);return validateFeaturePads([{featureId:f.id,name:name||'Patio',rings:yardFeatureOutline(f).map(r=>r.map(p=>({x:p.x,y:p.y}))),plane:{x:plane.x,z:plane.z,constant:plane.constant},slopeRatio:Number.isFinite(ratio)?Math.min(maxRatio,Math.max(minRatio,ratio)):defaultRatio,...(f.groundFit!.lowEdge==='stone'?{lowEdge:'stone'}:{})}])[0];}catch{return undefined;}
}
/** Other paving within a bank's reach: the bank under it needs no restoring. Invalid outlines are skipped. */
function occupiedNear(pads:SiteFeaturePad[],others:YardFeature[]):Point[][]{
 const reach=pads.map(p=>{const b=bounds(p.rings.flat());return {minX:b.minX-REACH,maxX:b.maxX+REACH,minZ:b.minZ-REACH,maxZ:b.maxZ+REACH};}),out:Point[][]=[];
 for(const f of others){let rings:Point[][];try{rings=yardFeatureOutline(f).map(r=>r.map(p=>({x:p.x,y:p.y})));}catch{continue;}
  for(const ring of rings){if(out.length>=FEATURE_PAD_LIMITS.occupiedRings)return out;if(!reach.some(r=>overlaps(r,bounds(ring))))continue;try{out.push(...validateFeaturePadOccupied([ring]));}catch{/* not a usable outline */}}}
 return out;
}
const byFeatures=new WeakMap<SiteModel,WeakMap<YardFeature[],SiteModel>>(),byPads=new WeakMap<SiteModel,Map<string,SiteModel>>(),stripped=new WeakMap<SiteModel,SiteModel>();
/** Derived model → the saved survey it came from and its bank geometry key (pads without names). */
const geometry=new WeakMap<SiteModel,{site:SiteModel;key:string}>();
export const featurePadGeometry=(model:SiteModel)=>geometry.get(model);
/** The saved survey without derived ground-fit fields (an old file may carry them; they are never trusted). */
function savedSurvey(site:SiteModel):SiteModel{
 if(site.featurePads===undefined&&site.featurePadOccupied===undefined)return site;
 let s=stripped.get(site);if(!s){const {featurePads:_p,featurePadOccupied:_o,...rest}=site;stripped.set(site,s=rest);}return s;
}
/** The design's site model: the saved survey plus a derived pad for every ground-fit patio (enabled, kind patio, fixed
 * finishedElevationIn, no stone steps/step assembly, groundFit set) and the outlines of other paving near them. Same
 * object back for the same inputs (memoized on siteModel and yardFeatures identity, and on the pads themselves, so an
 * edit elsewhere in the yard keeps the surface cache); the saved siteModel itself when no patio is fitted. Pads saved
 * on the survey are ignored. */
export function designSiteModel(data:Pick<DeckData,'siteModel'|'yardFeatures'>):SiteModel|undefined{
 const raw=data.siteModel,features=data.yardFeatures;if(!raw)return raw;const site=savedSurvey(raw);if(!features?.length)return site;
 let seen=byFeatures.get(raw);const hit=seen?.get(features);if(hit)return hit;
 // The yard model keeps the first enabled feature of a repeated id; so do the pads.
 const pads:SiteFeaturePad[]=[],others:YardFeature[]=[],ids=new Set<string>();
 for(const f of features){if(!f||!f.enabled||ids.has(f.id))continue;ids.add(f.id);if(f.kind!=='patio')continue;
  const fitted=pads.length<FEATURE_PAD_LIMITS.pads&&!!f.groundFit&&typeof f.finishedElevationIn==='number'&&Number.isFinite(f.finishedElevationIn)&&!f.stoneSteps&&!f.stepAssembly,pad=fitted?groundFitPad(f):undefined;
  if(pad)pads.push(pad);else others.push(f);}
 let out=site;
 if(pads.length){
  const occupied=occupiedNear(pads,others),shape=JSON.stringify(pads.map(({name:_n,...p})=>p)),key=JSON.stringify([pads.map(p=>p.name),occupied])+shape;
  let saved=byPads.get(site);if(!saved)byPads.set(site,saved=new Map());
  out=saved.get(key)??{...site,featurePads:pads,...(occupied.length?{featurePadOccupied:occupied}:{})};saved.delete(key);saved.set(key,out);while(saved.size>4)saved.delete(saved.keys().next().value!);
  geometry.set(out,{site,key:shape});
 }
 if(!seen)byFeatures.set(raw,seen=new WeakMap());seen.set(features,out);return out;
}

type Box={minX:number;maxX:number;minZ:number;maxZ:number};
/** One piece of a pad's daylight field, valid inside the convex `poly`: `d` is the run from the patio edge; the bank may
 * stand no higher than `upper` (patio top at the edge point + d/k) and no lower than `lower` (top − d/k; none on a
 * stone-edged pad). */
interface Element {pad:number;poly:Point[];box:Box;cuts:SitePlane[];d:SitePlane;upper:SitePlane;lower?:SitePlane;crossing?:boolean}
interface Limit {plane:SitePlane;e:Element}
/** Where one element can change the ground in a base face (or, between pads, may clash with another pad). */
interface Region {poly:Point[];box:Box;cuts:SitePlane[];hi:boolean;lim:Limit;slot:number}
/** A convex part of a base face with each pad's tightest limits found so far (by slot). */
interface Piece {poly:Point[];box:Box;lo:(Limit|undefined)[];hi:(Limit|undefined)[]}
interface Out {poly:Point[];plane:SitePlane;pad:number;e?:Element}
const EPS=1e-7,CHANGED=1e-6,ON_EDGE=1e-4,FACET=Math.PI/24,BIND=1e-9,GRID=48;
const at=(p:SitePlane,x:number,y:number)=>p.x*x+p.z*y+p.constant;
/** a + s·b */
const lin=(a:SitePlane,b:SitePlane,s:number):SitePlane=>({x:a.x+b.x*s,z:a.z+b.z*s,constant:a.constant+b.constant*s});
const sub=(a:SitePlane,b:SitePlane)=>lin(a,b,-1);
const signed=(p:Point[])=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.y-b.x*a.y;},0)/2;
const ccw=(p:Point[])=>signed(p)<0?[...p].reverse():p;
function bounds(ps:Point[]):Box{let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const p of ps){if(p.x<minX)minX=p.x;if(p.x>maxX)maxX=p.x;if(p.y<minZ)minZ=p.y;if(p.y>maxZ)maxZ=p.y;}return {minX,maxX,minZ,maxZ};}
function overlaps(a:Box,b:Box){return a.minX<=b.maxX+EPS&&a.maxX>=b.minX-EPS&&a.minZ<=b.maxZ+EPS&&a.maxZ>=b.minZ-EPS;}
const rotate=(v:Point,a:number)=>({x:v.x*Math.cos(a)-v.y*Math.sin(a),y:v.x*Math.sin(a)+v.y*Math.cos(a)});
function clipConvex(poly:Point[],f:SitePlane):Point[]{const out:Point[]=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ha=at(f,a.x,a.y),hb=at(f,b.x,b.y);if(ha>=-EPS)out.push(a);if(ha>EPS&&hb<-EPS||ha<-EPS&&hb>EPS){const t=ha/(ha-hb);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}return out.length>=3&&Math.abs(signed(out))>EPS?out:[];}
/** A convex piece split where f ≥ 0 and f ≤ 0. A piece wholly on one side (within EPS) goes there whole, so the two
 * halves never both claim it. */
function split(poly:Point[],f:SitePlane):[Point[],Point[]]{let pos=false,neg=false;for(const v of poly){const h=at(f,v.x,v.y);if(h>EPS)pos=true;else if(h<-EPS)neg=true;}if(!neg)return [poly,[]];if(!pos)return [[],poly];return [clipConvex(poly,f),clipConvex(poly,lin({x:0,z:0,constant:0},f,-1))];}
/** Left of each edge of a counter-clockwise convex polygon, as signed distance. */
const insideCuts=(poly:Point[])=>poly.map((p,i)=>{const q=poly[(i+1)%poly.length],dx=q.x-p.x,dy=q.y-p.y,l=Math.hypot(dx,dy);return {x:-dy/l,z:dx/l,constant:(dy*p.x-dx*p.y)/l};});
/** Affine f over a convex polygon, integrated exactly (fan of triangles × mean vertex height). */
function integral(poly:Point[],f:SitePlane){let n=0;for(let i=1;i+1<poly.length;i++){const t=[poly[0],poly[i],poly[i+1]];n+=Math.abs(signed(t))*t.reduce((s,v)=>s+at(f,v.x,v.y),0)/3;}return n;}
const positivePart=(poly:Point[],f:SitePlane)=>{const p=clipConvex(poly,f);return p.length?Math.max(0,integral(p,f)):0;};
/** A uniform grid over boxes: everything whose box meets a query box. */
function boxGrid<T>(items:T[],box:(t:T)=>Box){
 const cells=new Map<string,T[]>(),span=(b:Box,f:(k:string)=>void)=>{const x0=Math.floor(b.minX/GRID),x1=Math.floor(b.maxX/GRID),z0=Math.floor(b.minZ/GRID),z1=Math.floor(b.maxZ/GRID);for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)f(x+','+z);};
 for(const t of items)span(box(t),k=>{let l=cells.get(k);if(!l)cells.set(k,l=[]);l.push(t);});
 return (q:Box)=>{const out=new Set<T>();span(q,k=>{const l=cells.get(k);if(l)for(const t of l)out.add(t);});return out;};
}
/** Even-odd inside test of one ring. */
function insideRing(ring:Point[],x:number,y:number){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
/** Does segment a–b run through the interior of the convex polygon with these inside cuts (not merely along its edge)? */
function crossesInterior(cuts:SitePlane[],a:Point,b:Point){let t0=0,t1=1;for(const c of cuts){const fa=at(c,a.x,a.y)-EPS,fb=at(c,b.x,b.y)-EPS;if(fa<0&&fb<0)return false;if(fa<0)t0=Math.max(t0,fa/(fa-fb));else if(fb<0)t1=Math.min(t1,fa/(fa-fb));if(t0>=t1)return false;}return (t1-t0)*Math.hypot(b.x-a.x,b.y-a.y)>EPS;}

/** The daylight field of every pad as convex elements with affine run and level: a slab out from each edge (the
 * nearest point is on that edge) and, round each convex corner, facets of the cone at most 7.5° apart, each tangent
 * to the cone along its middle ray (so every facet slopes exactly 1:k and meets its neighbours and the slabs without a
 * step; the run it measures is at most 0.2% short of the true distance). Each reaches maxBankRunIn. */
function padElements(pads:SiteFeaturePad[],live:boolean[]){
 const elements:Element[]=[];
 pads.forEach((pad,i)=>{if(!live[i])return;const k=pad.slopeRatio,add=(raw:Point[],d:SitePlane,level:SitePlane)=>{const poly=ccw(raw);if(Math.abs(signed(poly))>EPS)elements.push({pad:i,poly,box:bounds(poly),cuts:insideCuts(poly),d,upper:lin(level,d,1/k),...(pad.lowEdge==='stone'?{}:{lower:lin(level,d,-1/k)})});};
  for(const raw of pad.rings){const ring=ccw(raw),n=ring.length,unit=(a:Point,b:Point)=>{const l=Math.hypot(b.x-a.x,b.y-a.y);return {x:(b.x-a.x)/l,y:(b.y-a.y)/l};};
  for(let j=0;j<n;j++){const a=ring[j],b=ring[(j+1)%n],l=Math.hypot(b.x-a.x,b.y-a.y),t=unit(a,b),o={x:t.y,y:-t.x},pa=at(pad.plane,a.x,a.y),rise=(at(pad.plane,b.x,b.y)-pa)/l;
   add([a,b,{x:b.x+o.x*REACH,y:b.y+o.y*REACH},{x:a.x+o.x*REACH,y:a.y+o.y*REACH}],{x:o.x,z:o.y,constant:-(o.x*a.x+o.y*a.y)},{x:t.x*rise,z:t.y*rise,constant:pa-(t.x*a.x+t.y*a.y)*rise});}
  for(let j=0;j<n;j++){const p=ring[(j+n-1)%n],c=ring[j],q=ring[(j+1)%n],ti=unit(p,c),to=unit(c,q),turn=Math.atan2(ti.x*to.y-ti.y*to.x,ti.x*to.x+ti.y*to.y);if(turn<=1e-9)continue;
   const normal={x:ti.y,y:-ti.x},m=Math.ceil(turn/FACET),level={x:0,z:0,constant:at(pad.plane,c.x,c.y)};
   for(let s=0;s<=m;s++){const u=rotate(normal,turn*s/m),a0=Math.max(0,turn*(s-.5)/m),a1=Math.min(turn,turn*(s+.5)/m),w0=rotate(normal,a0),w1=rotate(normal,a1),r0=REACH/(u.x*w0.x+u.y*w0.y),r1=REACH/(u.x*w1.x+u.y*w1.y);
    add([c,{x:c.x+w0.x*r0,y:c.y+w0.y*r0},{x:c.x+w1.x*r1,y:c.y+w1.y*r1}],{x:u.x,z:u.y,constant:-(u.x*c.x+u.y*c.y)},level);}
  }
 }});
 return elements;
}

/** Coplanar convex pieces of one face merged where two share a whole edge and stay convex; collinear points dropped. */
function mergeConvex(polys:Point[][]):Point[][]{
 if(polys.length<2)return polys.map(dropCollinear);
 // A junction may turn left or run straight on, never right and never double back.
 const key=(v:Point)=>Math.round(v.x*1e6)+','+Math.round(v.y*1e6),convexAt=(a:Point,b:Point,c:Point)=>{const ux=b.x-a.x,uy=b.y-a.y,vx=c.x-b.x,vy=c.y-b.y,l=Math.hypot(ux,uy)*Math.hypot(vx,vy),cross=ux*vy-uy*vx;return l>0&&cross>=-1e-9*l&&(cross>1e-9*l||ux*vx+uy*vy>0);};
 // Points that weld together are one point (a clip can land a hair from a corner); then every corner of one piece that
 // lies on another's edge becomes a point of that edge too, so neighbours share whole edges (no T-junctions).
 const clean=polys.map(p=>dropCollinear(p.filter((v,i)=>key(v)!==key(p[(i+1)%p.length])))).filter(p=>p.length>=3);
 const corners=clean.flatMap((p,i)=>p.map(v=>({v,i}))).sort((a,b)=>a.v.x-b.v.x),xs=corners.map(c=>c.v.x),from=(x:number)=>{let lo=0,hi=xs.length;while(lo<hi){const m=(lo+hi)>>1;if(xs[m]<x)lo=m+1;else hi=m;}return lo;};
 const live=clean.map((p,i)=>{const out:Point[]=[];for(let k=0;k<p.length;k++){const a=p[k],b=p[(k+1)%p.length],dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy,ka=key(a),kb=key(b),hits:{t:number;v:Point}[]=[],maxX=Math.max(a.x,b.x)+EPS,minY=Math.min(a.y,b.y)-EPS,maxY=Math.max(a.y,b.y)+EPS;out.push(a);
  for(let c=from(Math.min(a.x,b.x)-EPS);c<corners.length&&xs[c]<=maxX;c++){const {v,i:j}=corners[c];if(j===i||v.y<minY||v.y>maxY)continue;const t=((v.x-a.x)*dx+(v.y-a.y)*dy)/l2;if(!(t>1e-9&&t<1-1e-9)||Math.abs((v.x-a.x)*dy-(v.y-a.y)*dx)>EPS*Math.sqrt(l2))continue;const kv=key(v);if(kv!==ka&&kv!==kb)hits.push({t,v});}
  hits.sort((x,y)=>x.t-y.t);for(const h of hits)if(key(h.v)!==key(out[out.length-1]))out.push(h.v);}return out;});
 for(let pass=0;pass<64;pass++){
  const edges=new Map<string,[number,number]>();live.forEach((p,i)=>{for(let k=0;k<p.length;k++)edges.set(key(p[k])+'>'+key(p[(k+1)%p.length]),[i,k]);});
  const dirty=new Set<number>();let merged=false;
  for(let i=0;i<live.length;i++){const p=live[i];if(!p.length||dirty.has(i))continue;
   for(let k=0;k<p.length;k++){const n=p.length,a=p[k],b=p[(k+1)%n],hit=edges.get(key(b)+'>'+key(a));if(!hit)continue;const [j,m]=hit,q=live[j],r=q.length;if(j===i||!r||dirty.has(j))continue;
    // The whole run of edges the two share (q runs it backwards): p[k-s] … p[k+1+e].
    const P=(t:number)=>p[((t%n)+n)%n],Q=(t:number)=>q[((t%r)+r)%r];let s=0,e=0;
    while(1+s+e<Math.min(n,r)-1&&key(Q(m-1-e))===key(P(k+2+e)))e++;
    while(1+s+e<Math.min(n,r)-1&&key(Q(m+2+s))===key(P(k-1-s)))s++;
    const L=1+s+e,k1=k+1+e,cand=[...Array.from({length:n-L+1},(_,t)=>P(k1+t)),...Array.from({length:r-L-1},(_,t)=>Q(m+2+s+t))],c=cand.length;
    if(c<3||!convexAt(cand[c-1],cand[0],cand[1])||!convexAt(cand[n-L-1],cand[n-L],cand[(n-L+1)%c]))continue;
    live[i]=cand;live[j]=[];dirty.add(i);dirty.add(j);merged=true;break;}}
  if(!merged)break;
 }
 return live.filter(p=>p.length).map(dropCollinear);
}
/** Points lying on the straight run between their neighbours, removed one at a time (each against its current
 * neighbours, so a corner is never lost to two near-coincident points). */
function dropCollinear(p:Point[]):Point[]{
 const out=p.slice();let removed=true;
 while(removed&&out.length>3){removed=false;for(let i=0;i<out.length&&out.length>3;){const n=out.length,a=out[(i+n-1)%n],v=out[i],b=out[(i+1)%n],dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy,along=l2?((v.x-a.x)*dx+(v.y-a.y)*dy)/l2:-1;
  if(along>0&&along<1&&Math.abs((v.x-a.x)*dy-(v.y-a.y)*dx)/Math.sqrt(l2)<1e-9){out.splice(i,1);removed=true;}else i++;}}
 return out;
}

/** The bank faces for every pad, against the surface before the pads (proposed grading and transitions applied).
 * Exact, not sampled. Outside the pads' rings the ground becomes clamp(base, lo, hi), where for each pad hi is the
 * lowest and lo the highest limit of all its field elements covering the point (so the bank is continuous everywhere,
 * concave and sloped patios included), and across pads the same, except where two pads ask for incompatible ground:
 * there the nearest pad's own limits hold. Only base faces where some limit binds are cut, only where it binds, and
 * coplanar pieces are merged again before they are fanned; inside the rings the ground stays as it was. A pad that is
 * not wholly on the measured ground, or whose bank would not daylight within maxBankRunIn, is pending and grades
 * nothing. `replacements` maps each touched base face to its exact replacement pieces. */
export function buildFeaturePads(surface:SiteSurface,pads:NonNullable<SiteModel['featurePads']>):{models:SiteFeaturePadModel[];faces:GradingTransitionModel[];replacements:Map<SiteSurfaceTriangle,SiteSurfaceTriangle[]>}{
 const issues=pads.map(()=>[] as SiteFeaturePadIssue[]),live=pads.map((p,i)=>{
  if(siteArea(siteClip(p.rings,surface.coverage,'intersection'))<=.001){issues[i].push('unmeasured');return false;}
  // The yard model leaves a patio that is not wholly on measured ground out of the design; so does its bank.
  if(siteArea(siteClip(p.rings,surface.coverage,'difference'))>.001){issues[i].push('off-survey');return false;}
  return true;});
 // Every patio's interior stays as it is, whether its own bank is built or not.
 const rings=pads.flatMap(p=>p.rings.map(r=>ccw(r))),ringEdges=rings.flatMap(r=>r.map((a,i)=>({a,b:r[(i+1)%r.length]}))),edgesNear=boxGrid(ringEdges,e=>bounds([e.a,e.b]));
 const insideAny=(x:number,y:number)=>rings.some(r=>insideRing(r,x,y));
 const crossing=(e:Element)=>e.crossing??=(()=>{for(const s of edgesNear(e.box))if(crossesInterior(e.cuts,s.a,s.b))return true;const c=e.poly.reduce((n,v)=>({x:n.x+v.x/e.poly.length,y:n.y+v.y/e.poly.length}),{x:0,y:0});return insideAny(c.x,c.y);})();
 /** A convex bank piece cut along the ring edges through it; the parts inside a patio revert to the base. */
 const outsideRings=(poly:Point[]):{poly:Point[];inside:boolean}[]=>{const cuts=insideCuts(poly),lines:SitePlane[]=[];
  for(const s of edgesNear(bounds(poly)))if(crossesInterior(cuts,s.a,s.b)){const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,l=Math.hypot(dx,dy);lines.push({x:-dy/l,z:dx/l,constant:(dy*s.a.x-dx*s.a.y)/l});}
  let cells=[poly];for(const f of lines)cells=cells.flatMap(c=>split(c,f).filter(p=>p.length));
  return cells.map(c=>{const m=c.reduce((n,v)=>({x:n.x+v.x/c.length,y:n.y+v.y/c.length}),{x:0,y:0});return {poly:c,inside:insideAny(m.x,m.y)};});};
 const coverageEdges=surface.coverage.flatMap(poly=>poly.map((a,i)=>{const b=poly[(i+1)%poly.length];return {a,b,box:bounds([a,b])};}));
 const onCoverage=(edges:typeof coverageEdges,v:Point)=>edges.some(({a,b})=>{const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy,t=l2?Math.max(0,Math.min(1,((v.x-a.x)*dx+(v.y-a.y)*dy)/l2)):0;return Math.hypot(v.x-a.x-dx*t,v.y-a.y-dy*t)<ON_EDGE;});

 // The base faces of one survey triangle on one proposed plane are one convex domain again (the survey's own trapezoid
 // split is no reason to cut a bank), so each bank strip is cut by as few lines as the ground needs. Only faces within
 // reach of a pad are considered.
 const reachBoxes=pads.map(p=>{const b=bounds(p.rings.flat());return {minX:b.minX-REACH,maxX:b.maxX+REACH,minZ:b.minZ-REACH,maxZ:b.maxZ+REACH};}),domains:{faces:SiteSurfaceTriangle[];polys:Point[][]}[]=[];
 {const byPlane=new Map<SitePlane,Map<SitePlane,Map<string,SiteSurfaceTriangle[]>>>();
  for(const t of surface.proposedTriangles){const box=bounds(t.vertices.map(v=>({x:v.xIn,y:v.zIn})));if(!reachBoxes.some(r=>overlaps(r,box)))continue;let a=byPlane.get(t.existingPlane);if(!a)byPlane.set(t.existingPlane,a=new Map());let c=a.get(t.plane);if(!c)a.set(t.plane,c=new Map());const k=t.gradingId??'';let l=c.get(k);if(!l)c.set(k,l=[]);l.push(t);}
  for(const a of byPlane.values())for(const c of a.values())for(const faces of c.values()){const polys=faces.map(f=>ccw(f.vertices.map(v=>({x:v.xIn,y:v.zIn}))));domains.push({faces,polys:polys.length>1?mergeConvex(polys):polys});}
  // Farthest first: a bank that does not daylight within reach shows at its far end, and the build stops there.
  const centres=pads.map(p=>{const b=bounds(p.rings.flat());return {x:(b.minX+b.maxX)/2,y:(b.minZ+b.maxZ)/2};}),far=new Map(domains.map(d=>{const v=d.polys[0][0];return [d,Math.min(...centres.map(c=>Math.hypot(v.x-c.x,v.y-c.y)))];}));
  domains.sort((a,b)=>far.get(b)!-far.get(a)!);}
 const build=()=>{
  const elements=padElements(pads,live),near=boxGrid(elements,e=>e.box),replacements=new Map<SiteSurfaceTriangle,SiteSurfaceTriangle[]>();
  const stats=pads.map(()=>({coverage:false,reach:false,runIn:0,cut:0,fill:0,area:0,faces:[] as SiteSurfaceTriangle[],footprint:[] as Point[][]}));
  if(!elements.length)return {replacements,stats};
  const fan=(poly:Point[],plane:SitePlane,base:SiteSurfaceTriangle,gradingId:string|undefined)=>{const made:SiteSurfaceTriangle[]=[];for(let i=1;i+1<poly.length;i++){let t=[poly[0],poly[i],poly[i+1]];const area=signed(t);if(Math.abs(area)<=EPS)continue;if(area<0)t=[t[0],t[2],t[1]];
   made.push({vertices:t.map(v=>({xIn:v.x,zIn:v.y,elevationIn:at(plane,v.x,v.y)})) as [SiteVertex,SiteVertex,SiteVertex],plane,existingPlane:base.existingPlane,...(gradingId?{gradingId}:{})});}return made;};
  /** One convex domain of a base face's plane: its replacement faces, or undefined when no bank touches it. */
  const domain=(tri:Point[],base:SiteSurfaceTriangle):SiteSurfaceTriangle[]|undefined=>{
   const box=bounds(tri),b=base.plane,cand=[...near(box)].filter(e=>overlaps(e.box,box));if(!cand.length)return;
   const regions:Omit<Region,'slot'>[]=[],clip=(e:Element)=>{let dom=tri;for(const c of e.cuts){dom=clipConvex(dom,c);if(!dom.length)break;}return dom;};
   const region=(poly:Point[],hi:boolean,plane:SitePlane,e:Element)=>{if(poly.length)regions.push({poly,box:bounds(poly),cuts:insideCuts(poly),hi,lim:{plane,e}});};
   if(new Set(cand.map(e=>e.pad)).size===1){
    // One pad: an element matters only where its limit binds against the base (no clash is possible).
    for(const e of cand){let hiMaybe=false,loMaybe=false;for(const v of tri){const h=at(b,v.x,v.y);if(at(e.upper,v.x,v.y)<h-BIND)hiMaybe=true;if(e.lower&&at(e.lower,v.x,v.y)>h+BIND)loMaybe=true;}
     if(!hiMaybe&&!loMaybe)continue;const dom=clip(e);if(!dom.length)continue;
     if(hiMaybe)region(clipConvex(dom,sub(b,e.upper)),true,e.upper,e);if(loMaybe&&e.lower)region(clipConvex(dom,sub(e.lower,b)),false,e.lower,e);}
   }else{
    // Several pads: also every element whose limit could cross another pad's (where the nearest pad's limits hold).
    const doms=cand.map(e=>{const dom=clip(e);let minUp=Infinity,maxLo=-Infinity,hiBind=false,loBind=false;for(const v of dom){const h=at(b,v.x,v.y),u=at(e.upper,v.x,v.y);minUp=Math.min(minUp,u);if(u<h-BIND)hiBind=true;if(e.lower){const l=at(e.lower,v.x,v.y);maxLo=Math.max(maxLo,l);if(l>h+BIND)loBind=true;}}return {e,dom,minUp,maxLo,hiBind,loBind};}).filter(d=>d.dom.length);
    const padLo=new Map<number,number>(),padUp=new Map<number,number>();for(const d of doms){padLo.set(d.e.pad,Math.max(padLo.get(d.e.pad)??-Infinity,d.maxLo));padUp.set(d.e.pad,Math.min(padUp.get(d.e.pad)??Infinity,d.minUp));}
    for(const {e,dom,minUp,maxLo,hiBind,loBind} of doms){
     const clashHi=[...padLo].some(([p,l])=>p!==e.pad&&l>minUp+BIND),clashLo=!!e.lower&&[...padUp].some(([p,u])=>p!==e.pad&&u<maxLo-BIND);
     if(clashHi)region(dom,true,e.upper,e);else if(hiBind)region(clipConvex(dom,sub(b,e.upper)),true,e.upper,e);
     if(e.lower){if(clashLo)region(dom,false,e.lower,e);else if(loBind)region(clipConvex(dom,sub(e.lower,b)),false,e.lower,e);}}
   }
   if(!regions.length)return;
   const slotPads=[...new Set(regions.map(r=>r.lim.e.pad))],slot=(pad:number)=>slotPads.indexOf(pad),k=slotPads.length;
   let pieces:Piece[]=[{poly:tri,box,lo:new Array(k),hi:new Array(k)}];
   for(const raw of regions){const r:Region={...raw,slot:slot(raw.lim.e.pad)},next:Piece[]=[];
    for(const p of pieces){if(!overlaps(p.box,r.box)){next.push(p);continue;}
     // Cut a piece only round where this limit is the tighter one (the lower upper, the higher lower): elsewhere nothing
     // changes, so nothing is split.
     let win=p.poly;for(const c of r.cuts){win=clipConvex(win,c);if(!win.length)break;}
     const cur=(r.hi?p.hi:p.lo)[r.slot];if(win.length&&cur)win=clipConvex(win,r.hi?sub(cur.plane,r.lim.plane):sub(r.lim.plane,cur.plane));
     if(!win.length){next.push(p);continue;}
     let core=p.poly;if(Math.abs(Math.abs(signed(win))-Math.abs(signed(core)))>EPS)for(const c of insideCuts(win)){const [pos,neg]=split(core,c);if(neg.length)next.push({poly:neg,box:bounds(neg),lo:p.lo,hi:p.hi});core=pos;if(!core.length)break;}
     if(!core.length)continue;
     const lo=r.hi?p.lo:p.lo.slice(),hi=r.hi?p.hi.slice():p.hi;(r.hi?hi:lo)[r.slot]=r.lim;next.push({poly:core,box:bounds(core),lo,hi});}
    pieces=next;}
   // Each piece: the ground clamped between the limits (a pad whose own limits cross is filled: lo wins).
   const out:Out[]=[],emit=(poly:Point[],plane:SitePlane,lim?:Limit)=>out.push({poly,plane,pad:lim?lim.e.pad:-1,e:lim?.e});
   const clamp=(poly:Point[],LO?:Limit,HI?:Limit)=>{const parts:{poly:Point[];plane:SitePlane;lim?:Limit}[]=[];
    if(HI){const [cut,keep]=split(poly,sub(b,HI.plane));if(cut.length)parts.push({poly:cut,plane:HI.plane,lim:HI});if(keep.length)parts.push({poly:keep,plane:b});}else parts.push({poly,plane:b});
    for(const q of parts){if(!LO){emit(q.poly,q.plane,q.lim);continue;}const [fill,keep]=split(q.poly,sub(LO.plane,q.plane));if(fill.length)emit(fill,LO.plane,LO);if(keep.length)emit(keep,q.plane,q.lim);}};
   for(const p of pieces){
    let parts:{poly:Point[];LO?:Limit;HI?:Limit}[]=[{poly:p.poly}];
    for(const l of p.lo)if(l)parts=parts.flatMap(q=>{if(!q.LO)return [{...q,LO:l}];const [w,s]=split(q.poly,sub(l.plane,q.LO.plane));return [...(w.length?[{...q,poly:w,LO:l}]:[]),...(s.length?[{...q,poly:s}]:[])];});
    for(const h of p.hi)if(h)parts=parts.flatMap(q=>{if(!q.HI)return [{...q,HI:h}];const [w,s]=split(q.poly,sub(q.HI.plane,h.plane));return [...(w.length?[{...q,poly:w,HI:h}]:[]),...(s.length?[{...q,poly:s}]:[])];});
    for(const q of parts){
     if(!q.LO||!q.HI||q.LO.e.pad===q.HI.e.pad){clamp(q.poly,q.LO,q.HI);continue;}
     const [clash,fine]=split(q.poly,sub(q.LO.plane,q.HI.plane));if(fine.length)clamp(fine,q.LO,q.HI);if(!clash.length)continue;
     // Two pads ask for incompatible ground: the nearest pad's own limits hold.
     const [nearLo,nearHi]=split(clash,sub(q.HI.e.d,q.LO.e.d)),own=(poly:Point[],pad:number)=>clamp(poly,p.lo[slot(pad)],p.hi[slot(pad)]);if(nearLo.length)own(nearLo,q.LO.e.pad);if(nearHi.length)own(nearHi,q.HI.e.pad);}
   }
   // A field element that runs over a patio (concave outlines, neighbouring pads) leaves that patio's ground alone.
   const kept:Out[]=[];for(const o of out){if(o.pad<0||!crossing(o.e!)){kept.push(o);continue;}for(const c of outsideRings(o.poly))kept.push(c.inside?{poly:c.poly,plane:b,pad:-1}:{...o,poly:c.poly});}
   const edges=coverageEdges.filter(c=>overlaps(c.box,{minX:box.minX-ON_EDGE,maxX:box.maxX+ON_EDGE,minZ:box.minZ-ON_EDGE,maxZ:box.maxZ+ON_EDGE})),groups=new Map<string,{plane:SitePlane;pad:number;polys:Point[][]}>();let changed=false;
   for(const o of kept){
    let pad=o.pad,plane=o.plane;
    if(pad>=0){const s=stats[pad];let moved=false,runIn=0,reach=false,coverage=false;
     // The bank runs to its daylight line (unchanged vertices included); it is cut short only where it is still off the ground.
     for(const v of o.poly){const run=at(o.e!.d,v.x,v.y);runIn=Math.max(runIn,run);if(Math.abs(at(plane,v.x,v.y)-at(b,v.x,v.y))<CHANGED)continue;moved=true;if(run>=REACH-1e-3)reach=true;if(edges.length&&onCoverage(edges,v))coverage=true;}
     if(moved){changed=true;s.runIn=Math.max(s.runIn,runIn);s.reach||=reach;s.coverage||=coverage;const delta=sub(b,plane);s.cut+=positivePart(o.poly,delta)/46656;s.fill+=positivePart(o.poly,lin({x:0,z:0,constant:0},delta,-1))/46656;s.area+=Math.abs(signed(o.poly))/144;s.footprint.push(o.poly);}
     else{pad=-1;plane=b;}}
    const id=pad<0?'base':`${pad}|${plane.x.toPrecision(12)}|${plane.z.toPrecision(12)}|${plane.constant.toPrecision(12)}`;let g=groups.get(id);if(!g)groups.set(id,g={plane,pad,polys:[]});g.polys.push(o.poly);}
   if(!changed)return;
   const faces:SiteSurfaceTriangle[]=[];
   for(const g of groups.values())for(const poly of mergeConvex(g.polys)){const made=fan(poly,g.plane,base,g.pad>=0?`pad:${pads[g.pad].featureId}`:base.gradingId);faces.push(...made);if(g.pad>=0)stats[g.pad].faces.push(...made);}
   return faces;
  };
  // Each domain is replaced as a whole: its first base face carries the new faces, the others none.
  for(const d of domains){const made=d.polys.map(poly=>domain(poly,d.faces[0]));if(stats.some((s,i)=>live[i]&&s.reach))return {replacements,stats};if(!made.some(Boolean))continue;
   replacements.set(d.faces[0],made.flatMap((m,i)=>m??fan(d.polys[i],d.faces[0].plane,d.faces[0],d.faces[0].gradingId)));for(const f of d.faces.slice(1))replacements.set(f,[]);}
  return {replacements,stats};
 };
 // A bank that would end in a cliff at 20 ft is not built: that pad is pending and the rest are built without it.
 let result=build();
 for(let guard=0;guard<pads.length;guard++){const out=result.stats.map((s,i)=>live[i]&&s.reach?i:-1).filter(i=>i>=0);if(!out.length)break;for(const i of out){live[i]=false;issues[i].push('reach');}result=build();}
 const {replacements,stats}=result;
 const models=pads.map((pad,i):SiteFeaturePadModel=>{const s=stats[i];if(live[i]&&s.coverage)issues[i].push('coverage');
  return {featureId:pad.featureId,name:pad.name,status:!live[i]?'pending':issues[i].length?'partial':'ready',warnings:featurePadWarnings(pad.name,issues[i],pad.slopeRatio),cutYd3:live[i]?s.cut:0,fillYd3:live[i]?s.fill:0,areaSqft:live[i]?s.area:0,runIn:live[i]?s.runIn:0,issues:issues[i]};});
 const faces=pads.map((pad,i):GradingTransitionModel=>{const s=stats[i];let low=Infinity,high=-Infinity,steepest=-Infinity;for(const t of s.faces){steepest=Math.max(steepest,Math.hypot(t.plane.x,t.plane.z)*100);for(const v of t.vertices){low=Math.min(low,v.elevationIn);high=Math.max(high,v.elevationIn);}}
  return {id:pad.featureId,name:pad.name,status:'ready',footprint:s.footprint,triangles:s.faces,warnings:[],areaSqft:s.area,maxSlopePct:s.faces.length?steepest:null,missingAreaSqft:0,minElevationIn:s.faces.length?low:null,maxElevationIn:s.faces.length?high:null};});
 return {models,faces,replacements};
}

/** The surface as this derived model names it: pad names and warnings from the model's own pads (the bank geometry is
 * shared between names), and restoration area less the bank under the model's other paving. Same surface back when
 * nothing differs. */
export function labelFeaturePads(surface:SiteSurface,model:SiteModel):SiteSurface{
 const models=surface.featurePadModels;if(!models?.length)return surface;
 const pads=new Map((model.featurePads??[]).map(p=>[p.featureId,p])),occupied=model.featurePadOccupied??[],occupiedBox=occupied.length?bounds(occupied.flat()):undefined;let changed=false;
 const next=models.map(m=>{const pad=pads.get(m.featureId),name=pad?.name??m.name;let area=m.areaSqft;
  if(occupiedBox&&area>0){const under=surface.proposedTriangles.filter(t=>t.gradingId===`pad:${m.featureId}`).map(t=>t.vertices.map(v=>({x:v.xIn,y:v.zIn}))).filter(p=>overlaps(bounds(p),occupiedBox));if(under.length)area=Math.max(0,area-siteArea(siteClip(under,occupied,'intersection'))/144);}
  if(name===m.name&&area===m.areaSqft)return m;changed=true;return {...m,name,areaSqft:area,warnings:featurePadWarnings(name,m.issues??[],pad?.slopeRatio??GROUND_FIT_LIMITS.defaultRatio)};});
 if(!changed)return surface;
 return {...surface,featurePadModels:next,cutFill:{...surface.cutFill,bankAreaSqft:next.reduce((n,m)=>n+m.areaSqft,0)}};
}
