import type {PlanPoint} from './lib/deckGeometry';
import type {YardFeature,YardPathSpine} from './types';
import type {LandscapeObject} from './landscapeTypes';
import type {LandscapeRing,LandscapeSegment} from './landscapeOutline';
import {arcGeometry,inspectArcShape,sampleArc,type CircularArc} from './circularArcs';
import {localPolygonClip} from './lib/localPolygonClip';
import {bounds,yardShapeLocalPoint,yardShapeLocalPoints,yardShapeProblem,yardShapeWorldPoint} from './yardShapeGeometry';
import {validateYardFinishedSettings} from './yardFinishedSettings';
import {landscapeLocal,landscapeWorld,sampleLandscapeRing} from './landscapeOutline';

/**
 * Designer shape engine: the drawing tools of a real-time landscape design suite over one path model — control
 * points plus, per edge, a straight line or an exact circular arc. An arc's bulge is its signed sagitta: positive bows
 * to the left of travel, the same convention as patio `curves` and landscape `arc` segments. Closed paths are kept
 * counter-clockwise in plan x/y (positive shoelace area, as patio outlines require). Pure geometry: no React.
 */
export type ShapeEdge={kind:'line'}|{kind:'arc';bulgeIn:number};
export interface ShapePath {points:PlanPoint[];edges:ShapeEdge[];closed:boolean}
export interface ShapeRegion {outer:ShapePath;holes:ShapePath[]}

const LINE:ShapeEdge={kind:'line'};
const copy=(p:PlanPoint)=>({x:p.x,y:p.y});
const sub=(a:PlanPoint,b:PlanPoint)=>({x:a.x-b.x,y:a.y-b.y}),add=(a:PlanPoint,b:PlanPoint)=>({x:a.x+b.x,y:a.y+b.y}),mul=(a:PlanPoint,k:number)=>({x:a.x*k,y:a.y*k});
const len=(a:PlanPoint)=>Math.hypot(a.x,a.y),dist=(a:PlanPoint,b:PlanPoint)=>Math.hypot(a.x-b.x,a.y-b.y),mid=(a:PlanPoint,b:PlanPoint)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const cross=(a:PlanPoint,b:PlanPoint)=>a.x*b.y-a.y*b.x,dot=(a:PlanPoint,b:PlanPoint)=>a.x*b.x+a.y*b.y;
const unit=(a:PlanPoint)=>{const l=len(a);if(l<1e-12)throw Error('Two points coincide. Move them apart.');return mul(a,1/l);};
const rotate=(a:PlanPoint,t:number)=>({x:a.x*Math.cos(t)-a.y*Math.sin(t),y:a.x*Math.sin(t)+a.y*Math.cos(t)});
const rightOf=(d:PlanPoint)=>({x:d.y,y:-d.x});
const TAU=Math.PI*2;
export const edgeCount=(p:ShapePath)=>p.closed?p.points.length:p.points.length-1;
const after=(p:ShapePath,i:number)=>p.points[(i+1)%p.points.length];
const flip=(e:ShapeEdge):ShapeEdge=>e.kind==='arc'?{kind:'arc',bulgeIn:-e.bulgeIn}:LINE;

interface Seg {a:PlanPoint;b:PlanPoint;bulge:number;center?:PlanPoint;radius?:number;sweep?:number}
function seg(p:ShapePath,i:number):Seg{const a=p.points[i],b=after(p,i),e=p.edges[i];if(e.kind==='arc'&&e.bulgeIn){const g=arcGeometry(a,b,e.bulgeIn);return {a,b,bulge:e.bulgeIn,center:g.center,radius:g.radius,sweep:g.sweep};}return {a,b,bulge:0};}
/** Travel direction at the start (or end) of an edge. An arc leaves its chord by half its sweep. */
function tangent(s:Seg,end:boolean){const u=unit(sub(s.b,s.a));if(!s.bulge)return u;const half=2*Math.atan(2*s.bulge/dist(s.a,s.b));return rotate(u,end?-half:half);}
export function edgeTangent(p:ShapePath,i:number,end=false){return tangent(seg(p,i),end);}

/** Bulge of the arc from a to b that leaves a along `direction` — a tangent arc continuing the previous edge. */
export function tangentArcBulge(direction:PlanPoint,a:PlanPoint,b:PlanPoint):number{
 const chord=sub(b,a),L=len(chord);if(L<1)throw Error('Place the arc end at least 1 inch away.');
 const u=mul(chord,1/L),d=unit(direction),delta=Math.atan2(cross(u,d),dot(u,d));
 if(Math.abs(delta)<1e-9)return 0;
 if(Math.PI-Math.abs(delta)<1e-3)throw Error('That arc would turn back on itself. Place its end ahead of the last edge.');
 return L/2*Math.tan(delta/2);
}
/** Bulge of the circular arc from a to b through m (a 3-point arc). */
export function threePointBulge(a:PlanPoint,m:PlanPoint,b:PlanPoint):number{
 const L=dist(a,b);if(L<1)throw Error('Place the arc ends at least 1 inch apart.');
 const side=cross(sub(b,a),sub(m,a));if(Math.abs(side)<1e-6*L*Math.max(1,dist(a,m)))throw Error('Pick the arc’s middle point off the straight line between its ends.');
 const c=circumcentre(a,m,b),r=dist(c,a),h=dist(c,mid(a,b)),major=Math.sign(cross(sub(b,a),sub(c,a)))===Math.sign(side);
 return Math.sign(side)*(major?r+h:r-h);
}
function circumcentre(a:PlanPoint,b:PlanPoint,c:PlanPoint){
 const d=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y)),a2=a.x*a.x+a.y*a.y,b2=b.x*b.x+b.y*b.y,c2=c.x*c.x+c.y*c.y;
 return {x:(a2*(b.y-c.y)+b2*(c.y-a.y)+c2*(a.y-b.y))/d,y:(a2*(c.x-b.x)+b2*(a.x-c.x)+c2*(b.x-a.x))/d};
}
/** Sweep from s to e around c, clockwise for a positive bulge and counter-clockwise for a negative one. */
function sweepOn(c:PlanPoint,s:PlanPoint,e:PlanPoint,sign:number){const as=Math.atan2(s.y-c.y,s.x-c.x),ae=Math.atan2(e.y-c.y,e.x-c.x);return sign>0?((as-ae)%TAU+TAU)%TAU:((ae-as)%TAU+TAU)%TAU;}
function bulgeOnCircle(c:PlanPoint,r:number,s:PlanPoint,e:PlanPoint,sign:number){const sweep=sweepOn(c,s,e,sign);if(sweep<1e-9)throw Error('An offset arc collapsed to nothing. Use a smaller distance.');return sign*r*(1-Math.cos(sweep/2));}

export function samplePath(p:ShapePath,toleranceIn=.05):PlanPoint[]{
 const out:PlanPoint[]=[];
 for(let i=0;i<edgeCount(p);i++){const a=p.points[i],b=after(p,i),e=p.edges[i];out.push(...(e.kind==='arc'&&e.bulgeIn?sampleArc(a,b,e.bulgeIn,toleranceIn).slice(0,-1):[copy(a)]));}
 if(!p.closed)out.push(copy(p.points.at(-1)!));
 return out;
}
/** Exact signed area: the control polygon less (or plus) each arc's circular segment. */
export function pathArea(p:ShapePath){
 if(!p.closed)return 0;let area=0;
 for(let i=0;i<p.points.length;i++){const a=p.points[i],b=after(p,i),e=p.edges[i];area+=(a.x*b.y-b.x*a.y)/2;if(e.kind==='arc'&&e.bulgeIn){const g=arcGeometry(a,b,e.bulgeIn);area-=Math.sign(e.bulgeIn)*g.radius*g.radius*(g.sweep-Math.sin(g.sweep))/2;}}
 return area;
}
export function pathLength(p:ShapePath){let n=0;for(let i=0;i<edgeCount(p);i++){const a=p.points[i],b=after(p,i),e=p.edges[i];n+=e.kind==='arc'&&e.bulgeIn?arcGeometry(a,b,e.bulgeIn).lengthIn:dist(a,b);}return n;}
export function reversePath(p:ShapePath):ShapePath{
 const n=p.points.length,points=[...p.points].reverse().map(copy);
 const edges=p.closed?points.map((_,j)=>flip(p.edges[j<n-1?n-2-j:n-1])):p.edges.map((_,j)=>flip(p.edges[n-2-j]));
 return {points,edges,closed:p.closed};
}
export const orientCcw=(p:ShapePath)=>p.closed&&pathArea(p)<0?reversePath(p):p;

const segmentsCross=(a:PlanPoint,b:PlanPoint,c:PlanPoint,d:PlanPoint)=>{const o=(p:PlanPoint,q:PlanPoint,r:PlanPoint)=>cross(sub(q,p),sub(r,p));return o(a,b,c)*o(a,b,d)<-1e-9&&o(c,d,a)*o(c,d,b)<-1e-9;};
/** Why a path cannot be used, or '' when it is a clear, simple shape. */
export function pathProblem(p:ShapePath):string{
 if(p.points.length<(p.closed?3:2))return p.closed?'An outline needs at least three points.':'A path needs at least two points.';
 if(p.edges.length!==edgeCount(p))return 'The shape’s edges do not match its points.';
 for(let i=0;i<edgeCount(p);i++){if(dist(p.points[i],after(p,i))<1-1e-7)return 'Leave at least 1 inch between neighbouring points.';const e=p.edges[i];if(e.kind==='arc'&&e.bulgeIn)try{arcGeometry(p.points[i],after(p,i),e.bulgeIn);}catch(err){return (err as Error).message;}}
 const s=samplePath(p,.25),m=s.length,count=p.closed?m:m-1;
 for(let i=0;i<count;i++)for(let j=i+2;j<count;j++){if(p.closed&&i===0&&j===count-1)continue;if(segmentsCross(s[i],s[(i+1)%m],s[j],s[(j+1)%m]))return 'The shape crosses itself. Move a point or reduce a curve.';}
 if(p.closed&&Math.abs(pathArea(p))<144)return 'Enclose at least 1 sq ft.';
 return '';
}

function splice(p:ShapePath,i:number,points:PlanPoint[],edges:ShapeEdge[]):ShapePath{const pts=p.points.map(copy),eds=[...p.edges];pts.splice(i,1,...points);eds.splice(i,0,...edges);return {points:pts,edges:eds,closed:p.closed};}
function corner(p:ShapePath,i:number){
 const n=p.points.length;if(!Number.isInteger(i)||i<0||i>=n||!p.closed&&(i===0||i===n-1))throw Error('Choose a corner between two edges.');
 const before=(i+n-1)%n;if(p.edges[before].kind==='arc'||p.edges[i].kind==='arc')throw Error('Round or cut a corner between two straight edges. Straighten the neighbouring arc first.');
 const v=p.points[i],u1=unit(sub(v,p.points[before])),u2=unit(sub(after(p,i),v)),turn=Math.atan2(cross(u1,u2),dot(u1,u2));
 if(Math.abs(turn)<1e-6)throw Error('That point sits on a straight run; there is no corner to change.');
 if(Math.PI-Math.abs(turn)<1e-6)throw Error('That corner doubles back on itself.');
 return {v,u1,u2,turn,room:Math.min(dist(p.points[before],v),dist(v,after(p,i)))-1};
}
/** Fillet a corner with a true arc of the given radius, tangent to both straight edges (RLA “Round Corners”). */
export function roundCorner(p:ShapePath,i:number,radiusIn:number):ShapePath{
 if(!Number.isFinite(radiusIn)||radiusIn<1)throw Error('Enter a corner radius of at least 1 inch.');
 const {v,u1,u2,turn,room}=corner(p,i),k=Math.tan(Math.abs(turn)/2),t=radiusIn*k;
 if(t>room+1e-9)throw Error(`That radius needs ${(t/12).toFixed(2)} ft along each edge. The largest radius that fits is ${(Math.max(0,room)/k/12).toFixed(2)} ft.`);
 const T1=sub(v,mul(u1,t)),T2=add(v,mul(u2,t));
 return splice(p,i,[T1,T2],[{kind:'arc',bulgeIn:tangentArcBulge(u1,T1,T2)}]);
}
/** Cut a corner off with a straight edge set back `distanceIn` along each side. */
export function chamferCorner(p:ShapePath,i:number,distanceIn:number):ShapePath{
 if(!Number.isFinite(distanceIn)||distanceIn<1)throw Error('Enter a corner cut of at least 1 inch.');
 const {v,u1,u2,room}=corner(p,i);if(distanceIn>room+1e-9)throw Error(`The neighbouring edges allow a cut of at most ${(Math.max(0,room)/12).toFixed(2)} ft.`);
 return splice(p,i,[sub(v,mul(u1,distanceIn)),add(v,mul(u2,distanceIn))],[LINE]);
}
/** Make one edge straight, or an arc with the given bulge. */
export function setEdge(p:ShapePath,i:number,edge:ShapeEdge):ShapePath{
 if(!Number.isInteger(i)||i<0||i>=edgeCount(p))throw Error('Choose an existing edge.');
 const edges=[...p.edges];edges[i]=edge.kind==='arc'&&Math.abs(edge.bulgeIn)>1e-9?{kind:'arc',bulgeIn:edge.bulgeIn}:LINE;
 if(edges[i].kind==='arc')arcGeometry(p.points[i],after(p,i),(edges[i] as {bulgeIn:number}).bulgeIn);
 return {points:p.points.map(copy),edges,closed:p.closed};
}
/** Mirror across a vertical (`across`) or horizontal (`out`) plan line through `about`. Order is reversed so a closed
 * outline keeps its orientation; a reflection and a reversal each flip a bulge, so bulges keep their sign. */
export function mirrorPath(p:ShapePath,axis:'across'|'out',about:PlanPoint):ShapePath{
 return reversePath({points:p.points.map(q=>axis==='across'?{x:2*about.x-q.x,y:q.y}:{x:q.x,y:2*about.y-q.y}),edges:p.edges.map(flip),closed:p.closed});
}
export function rectanglePath(a:PlanPoint,b:PlanPoint):ShapePath{
 const x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y);if(x1-x0<12||y1-y0<12)throw Error('Make the rectangle at least 1 ft each way.');
 return {points:[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}],edges:[LINE,LINE,LINE,LINE],closed:true};
}
export function circlePath(c:PlanPoint,radiusIn:number):ShapePath{
 if(!Number.isFinite(radiusIn)||radiusIn<6)throw Error('Make the circle at least 1 ft across.');const b=-radiusIn*(1-Math.SQRT1_2);
 return {points:[{x:c.x+radiusIn,y:c.y},{x:c.x,y:c.y+radiusIn},{x:c.x-radiusIn,y:c.y},{x:c.x,y:c.y-radiusIn}],edges:[0,1,2,3].map(()=>({kind:'arc' as const,bulgeIn:b})),closed:true};
}

// ── Offset ────────────────────────────────────────────────────────────────────────────────────────────────────────
type Prim={kind:'line';a:PlanPoint;b:PlanPoint}|{kind:'arc';a:PlanPoint;b:PlanPoint;c:PlanPoint;r:number;sign:number};
/** Shift an edge to its right by d. A positive bulge turns clockwise, so its centre is on the right: radius r − d. */
function offsetPrim(s:Seg,d:number):Prim{
 if(!s.bulge){const n=rightOf(unit(sub(s.b,s.a)));return {kind:'line',a:add(s.a,mul(n,d)),b:add(s.b,mul(n,d))};}
 const sign=Math.sign(s.bulge),r=s.radius!-sign*d;if(r<1)throw Error('That offset is larger than a curve’s radius. Use a smaller distance.');
 const at=(q:PlanPoint)=>add(s.center!,mul(unit(sub(q,s.center!)),r));return {kind:'arc',a:at(s.a),b:at(s.b),c:s.center!,r,sign};
}
function circleHits(c:PlanPoint,r:number,a:PlanPoint,d:PlanPoint):PlanPoint[]{const f=sub(a,c),A=dot(d,d),B=2*dot(f,d),C=dot(f,f)-r*r,disc=B*B-4*A*C;if(disc<-1e-9)return [];const s=Math.sqrt(Math.max(0,disc));return [(-B-s)/(2*A),(-B+s)/(2*A)].map(t=>add(a,mul(d,t)));}
function hits(p:Prim,q:Prim):PlanPoint[]{
 if(p.kind==='line'&&q.kind==='line'){const d1=sub(p.b,p.a),d2=sub(q.b,q.a),den=cross(d1,d2);if(Math.abs(den)<1e-12)return [];return [add(p.a,mul(d1,cross(sub(q.a,p.a),d2)/den))];}
 if(p.kind==='arc'&&q.kind==='arc'){const d=dist(p.c,q.c);if(d<1e-9||d>p.r+q.r+1e-9||d<Math.abs(p.r-q.r)-1e-9)return [];const u=(p.r*p.r-q.r*q.r+d*d)/(2*d),h=Math.sqrt(Math.max(0,p.r*p.r-u*u)),e=mul(sub(q.c,p.c),1/d);return [-1,1].map(k=>({x:p.c.x+u*e.x-k*h*e.y,y:p.c.y+u*e.y+k*h*e.x}));}
 const c=p.kind==='arc'?p:q as Extract<Prim,{kind:'arc'}>,l=p.kind==='line'?p:q;return circleHits(c.c,c.r,l.a,sub(l.b,l.a));
}
/** Is x on the primitive between its ends (inclusive)? */
function onPrim(p:Prim,x:PlanPoint){
 if(p.kind==='line'){const d=sub(p.b,p.a),t=dot(sub(x,p.a),d)/dot(d,d);return t>-1e-7&&t<1+1e-7;}
 return sweepOn(p.c,p.a,x,p.sign)<=sweepOn(p.c,p.a,p.b,p.sign)+1e-7||sweepOn(p.c,p.a,x,p.sign)>TAU-1e-7;
}
/**
 * Offset a path to the right of travel by `distanceIn`: outward for a closed outline, and the right side of an open
 * path. Exact for line/arc chains — lines shift, arcs keep their centre with radius ∓ d. Outside a turn the gap is
 * bridged with a round (or, for two lines, mitred) join; inside a turn both edges are trimmed to their crossing.
 */
export function offsetPath(path:ShapePath,distanceIn:number,join:'round'|'miter'='round'):ShapePath{
 if(!Number.isFinite(distanceIn)||Math.abs(distanceIn)<1e-6)throw Error('Enter a non-zero offset distance.');
 const p=orientCcw(path),n=edgeCount(p),segs=Array.from({length:n},(_,i)=>seg(p,i)),prims=segs.map(s=>offsetPrim(s,distanceIn));
 const starts=prims.map(q=>q.a),ends=prims.map(q=>q.b),joins:(ShapeEdge|null)[]=Array(n).fill(null);
 for(let k=0;k<(p.closed?n:n-1);k++){
  const k2=(k+1)%n,a=ends[k],b=starts[k2];if(dist(a,b)<1e-7){starts[k2]=a;continue;}
  const tIn=tangent(segs[k],true),tOut=tangent(segs[k2],false);
  if(cross(tIn,tOut)*distanceIn>0){
   const pk=prims[k],pk2=prims[k2];
   if(join==='miter'&&pk.kind==='line'&&pk2.kind==='line'){const m=hits(pk,pk2)[0];if(m&&dist(m,p.points[k2])<=4*Math.abs(distanceIn)){ends[k]=m;starts[k2]=m;continue;}}
   joins[k]={kind:'arc',bulgeIn:tangentArcBulge(tIn,a,b)};
  }else{
   const near=mid(a,b),m=hits(prims[k],prims[k2]).filter(x=>onPrim(prims[k],x)&&onPrim(prims[k2],x)).sort((x,y)=>dist(x,near)-dist(y,near))[0];
   if(!m)throw Error('That offset is too large for a corner of this shape. Reduce it, or round the corner first.');
   ends[k]=m;starts[k2]=m;
  }
 }
 const points:PlanPoint[]=[],edges:ShapeEdge[]=[];
 for(let k=0;k<n;k++){
  const q=prims[k],s=starts[k],e=ends[k];
  if(dist(s,e)<1e-7)continue;
  points.push(copy(s));edges.push(q.kind==='line'?LINE:{kind:'arc',bulgeIn:bulgeOnCircle(q.c,q.r,s,e,q.sign)});
  const j=joins[k];if(j&&(p.closed||k<n-1)){points.push(copy(e));edges.push(j);}
 }
 if(!p.closed)points.push(copy(ends[n-1]));
 const out={points,edges,closed:p.closed},problem=pathProblem(out);if(problem)throw Error(`The offset shape is not usable: ${problem}`);
 return out;
}
/** A walkway outline from its centreline: both sides offset by half the width, joined by square or round ends. */
export function pathOutline(spine:ShapePath,widthIn:number,ends:'square'|'round'='square'):ShapePath{
 if(spine.closed)throw Error('Draw a path as an open centreline.');
 if(!Number.isFinite(widthIn)||widthIn<12||widthIn>240)throw Error('Enter a path width between 1 and 20 ft.');
 const right=offsetPath(spine,widthIn/2),left=reversePath(offsetPath(spine,-widthIn/2));
 const tEnd=tangent(seg(spine,edgeCount(spine)-1),true),tStart=tangent(seg(spine,0),false);
 const cap=(dir:PlanPoint,a:PlanPoint,b:PlanPoint):ShapeEdge=>ends==='round'?{kind:'arc',bulgeIn:tangentArcBulge(dir,a,b)}:LINE;
 const out=orientCcw({points:[...right.points,...left.points].map(copy),edges:[...right.edges,cap(tEnd,right.points.at(-1)!,left.points[0]),...left.edges,cap(mul(tStart,-1),left.points.at(-1)!,right.points[0])],closed:true});
 const problem=pathProblem(out);if(problem)throw Error(`That path is too tight for its width: ${problem}`);
 return out;
}

// ── Booleans ──────────────────────────────────────────────────────────────────────────────────────────────────────
const CORNER_TURN=.2,FIT_TOLERANCE=.06;
function turnAt(pts:PlanPoint[],i:number){const n=pts.length,a=pts[(i+n-1)%n],b=pts[i],c=pts[(i+1)%n],u=sub(b,a),v=sub(c,b);return Math.atan2(cross(u,v),dot(u,v));}
function lineFits(pts:PlanPoint[],s:number,e:number){const a=pts[s],b=pts[e],L=dist(a,b);if(L<1e-9)return false;for(let i=s+1;i<e;i++)if(Math.abs(cross(sub(b,a),sub(pts[i],a)))/L>FIT_TOLERANCE)return false;return true;}
function arcFits(pts:PlanPoint[],s:number,e:number):number|null{
 if(e-s<2)return null;const a=pts[s],b=pts[e],m=pts[Math.floor((s+e)/2)];let bulge:number;try{bulge=threePointBulge(a,m,b);}catch{return null;}
 const g=arcGeometry(a,b,bulge),sign=Math.sign(bulge),total=sweepOn(g.center,a,b,sign);let last=0;
 for(let i=s+1;i<e;i++){const p=pts[i];if(Math.abs(dist(p,g.center)-g.radius)>FIT_TOLERANCE)return null;const t=sweepOn(g.center,a,p,sign);if(t<last-1e-9||t>total+1e-9)return null;last=t;}
 return bulge;
}
/** Rebuild lines and true arcs from a sampled ring: corners break runs, then each run is fitted greedily. */
function fitRing(raw:PlanPoint[]):ShapePath{
 const pts=raw.filter((p,i)=>dist(p,raw[(i+1)%raw.length])>1e-6);if(pts.length<3)throw Error('The result is too small to keep.');
 const corners=pts.map((_,i)=>Math.abs(turnAt(pts,i))>CORNER_TURN),startAt=Math.max(0,corners.indexOf(true)),ring=[...pts.slice(startAt),...pts.slice(0,startAt)];
 const cuts=ring.map((_,i)=>i===0||Math.abs(turnAt(ring,i))>CORNER_TURN);if(!cuts.slice(1).some(Boolean))cuts[Math.floor(ring.length/2)]=true;
 const closedRing=[...ring,ring[0]],points:PlanPoint[]=[],edges:ShapeEdge[]=[];
 let s=0;
 while(s<ring.length){
  let stop=s+1;while(stop<ring.length&&!cuts[stop])stop++;
  let i=s;
  while(i<stop){
   let best=i+1,bestEdge:ShapeEdge=LINE;
   for(let e=i+1;e<=stop;e++){if(lineFits(closedRing,i,e)){best=e;bestEdge=LINE;continue;}const b=arcFits(closedRing,i,e);if(b===null)break;best=e;bestEdge={kind:'arc',bulgeIn:b};}
   points.push(copy(closedRing[i]));edges.push(bestEdge);i=best;
  }
  s=stop;
 }
 return {points,edges,closed:true};
}
/** Add, subtract or intersect two regions. Curved edges are sampled for Clipper, then refitted as true arcs. */
export function shapeBoolean(a:ShapeRegion,b:ShapeRegion,op:'union'|'difference'|'intersection'):ShapeRegion[]{
 const rings=(r:ShapeRegion)=>[orientCcw(r.outer),...r.holes.map(h=>reversePath(orientCcw(h)))].map(q=>samplePath(q,.02));
 const out=localPolygonClip(rings(a),rings(b),op,1000).filter(r=>r.length>=3).map(fitRing);
 const outers=out.filter(r=>pathArea(r)>0).map(outer=>({outer,holes:[] as ShapePath[]}));
 for(const hole of out.filter(r=>pathArea(r)<0)){const probe=samplePath(hole,.25)[0],owner=outers.find(o=>pointInRing(samplePath(o.outer,.25),probe));if(owner)owner.holes.push(hole);}
 return outers.filter(o=>pathArea(o.outer)>=144);
}
function pointInRing(ring:PlanPoint[],p:PlanPoint){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(a.y>p.y!==b.y>p.y&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}

// ── Adapters ──────────────────────────────────────────────────────────────────────────────────────────────────────
export const curvesOf=(p:ShapePath):CircularArc[]|undefined=>{const c=p.edges.flatMap((e,edge)=>e.kind==='arc'&&e.bulgeIn?[{edge,bulgeIn:e.bulgeIn}]:[]);return c.length?c:undefined;};
const edgesFrom=(count:number,curves?:CircularArc[]):ShapeEdge[]=>Array.from({length:count},(_,i)=>{const c=curves?.find(c=>c.edge===i);return c?{kind:'arc',bulgeIn:c.bulgeIn}:LINE;});
/** A patio outline or wall path in world plan inches. Rotation keeps every bulge. */
export function yardFeaturePath(f:YardFeature):ShapePath{const closed=f.kind==='patio',local=yardShapeLocalPoints(f);return {points:local.map(p=>yardShapeWorldPoint(f,p)),edges:edgesFrom(closed?local.length:local.length-1,f.curves),closed};}
export function yardSpinePath(f:YardFeature):ShapePath|null{const s=f.pathSpine;return s?{points:s.points.map(p=>yardShapeWorldPoint(f,p)),edges:edgesFrom(s.points.length-1,s.curves),closed:false}:null;}
/** Replace a patio outline or wall path, keeping product, finish, levels and construction fields. A new outline
 * drops any walkway centreline; pass `extra` to set one. Sloped patios keep their plane through the new centre. */
export function applyPathToYardFeature(f:YardFeature,world:ShapePath,extra:Partial<YardFeature>={}):YardFeature{
 const kind=f.kind;if(kind!=='patio'&&kind!=='retaining-wall')throw Error('Choose a patio or retaining wall.');
 if(world.closed!==(kind==='patio'))throw Error(kind==='patio'?'A patio needs a closed outline.':'A wall needs an open path.');
 const path=kind==='patio'?orientCcw(world):world;if(path.points.length>64)throw Error(`This shape has ${path.points.length} points; a patio or wall keeps up to 64. Simplify it first.`);
 const raw=path.points.map(p=>yardShapeLocalPoint(f,p)),b=bounds(raw),centre={x:b.x+b.w/2,y:b.y+b.h/2},points=raw.map(p=>({x:p.x-centre.x,y:p.y-centre.y})),curves=curvesOf(path);
 const problem=yardShapeProblem(kind,points,curves);if(problem)throw Error(problem);
 const {lengthIn}=inspectArcShape(points,curves,kind==='patio',f.productId==='techo-raffinato-wall'?102:undefined);
 const placed=yardShapeWorldPoint(f,centre),xFt=placed.x/12,zFt=placed.y/12;if(xFt< -150||xFt>150||zFt< -150||zFt>200)throw Error('Keep the shape within the editable yard (across −150 to 150 ft; out −150 to 200 ft).');
 const {curves:_curves,pathSpine:_spine,outline:_outline,wallPath:_path,wallTopSteps:_steps,...rest}=f;
 const next:YardFeature={...rest,xFt,zFt,...(kind==='patio'&&f.finishedElevationIn!==undefined?{finishedElevationIn:f.finishedElevationIn+(f.patioSlope?.xPct??0)*centre.x/100+(f.patioSlope?.zPct??0)*centre.y/100}:{}),...(curves?{curves}:{}),...extra};
 return validateYardFinishedSettings(kind==='patio'?{...next,outline:points,widthFt:b.w/12,depthFt:b.h/12,...(f.inlays?{inlays:f.inlays.map(i=>({...i,xIn:i.xIn-centre.x,yIn:i.yIn-centre.y}))}:{})}:{...next,wallPath:points,widthFt:lengthIn/12});
}
/** A walkway: a patio whose outline is derived from its centreline. The centreline is kept, in the patio's own frame,
 * so it can be edited again; construction always reads the outline. */
export function applyWalkway(f:YardFeature,worldSpine:ShapePath,widthIn:number,ends:YardPathSpine['ends']):YardFeature{
 if(f.kind!=='patio')throw Error('A walkway is a patio surface.');if(worldSpine.points.length>32)throw Error('Keep a walkway centreline to 32 points.');
 const {inlays:_inlays,...next}=applyPathToYardFeature(f,pathOutline(worldSpine,widthIn,ends)),curves=curvesOf(worldSpine);
 return {...next,pathSpine:{points:worldSpine.points.map(p=>yardShapeLocalPoint(next as YardFeature,p)),...(curves?{curves}:{}),widthIn,ends}};
}
/** A landscape ring in world plan inches. Smooth (Bézier) edges are refitted as arcs within 0.06 in. */
export function landscapeRingPath(o:LandscapeObject,ring:LandscapeRing):ShapePath{
 if(ring.segments.some(s=>s.kind==='cubic'))return fitRing(sampleLandscapeRing(ring).map(p=>{const w=landscapeWorld(o,p);return {x:w.x,y:w.z};}));
 return {points:ring.points.map(p=>{const w=landscapeWorld(o,p);return {x:w.x,y:w.z};}),edges:ring.segments.map(s=>s.kind==='arc'?{kind:'arc' as const,bulgeIn:s.bulgeIn}:LINE),closed:true};
}
export function landscapeRingFromPath(o:Pick<LandscapeObject,'xIn'|'zIn'|'rotationDeg'>,world:ShapePath):LandscapeRing{
 return {points:world.points.map(p=>landscapeLocal(o as LandscapeObject,{x:p.x,z:p.y})),segments:world.edges.map((e):LandscapeSegment=>e.kind==='arc'&&e.bulgeIn?{kind:'arc',bulgeIn:e.bulgeIn}:{kind:'line'})};
}
