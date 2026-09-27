import type {PlanPoint} from '../lib/deckGeometry';

export interface BoundarySnapTarget {point:PlanPoint;label:string}
export interface BoundarySnapLine {a:PlanPoint;b:PlanPoint;label:string}
export interface BoundarySnapGuide {a:PlanPoint;b:PlanPoint;label:string}
export interface BoundarySnapContext {corners:BoundarySnapTarget[];lines:BoundarySnapLine[]}
export interface BoundarySnapResult {points:PlanPoint[];dxIn:number;dyIn:number;guides:BoundarySnapGuide[]}
const distance=(a:PlanPoint,b:PlanPoint)=>Math.hypot(a.x-b.x,a.y-b.y);

/** Soft, bounded alignment of one rigid gesture. Geometry/locks are validated by the caller. */
export function snapBoundaryMove(points:PlanPoint[],kind:'point'|'edge'|'area',index:number,dxIn:number,dyIn:number,context:BoundarySnapContext,toleranceIn:number):BoundarySnapResult {
 const moved=new Set(points.flatMap((_,i)=>kind==='area'||i===index||kind==='edge'&&i===(index+1)%points.length?[i]:[]));
 const make=(dx:number,dy:number)=>points.map((p,i)=>moved.has(i)?{x:p.x+dx,y:p.y+dy}:{...p});
 const raw=make(dxIn,dyIn),tol=Math.max(0,Math.min(6,Number.isFinite(toleranceIn)?toleranceIn:0));
 if(!tol||!points.length||![dxIn,dyIn].every(Number.isFinite))return {points:raw,dxIn,dyIn,guides:[]};
 const targets=[...context.corners,...points.flatMap((point,i)=>moved.has(i)?[]:[{point,label:`Corner ${i+1}`}])];
 // Prefer a true corner or projection on a finite wall over coincidental infinite-axis alignment.
 const candidates:{dx:number;dy:number;guides:BoundarySnapGuide[];cost:number;rank:number}[]=[];
 for(const i of moved){const q=raw[i];
  for(const target of targets){const d=distance(q,target.point);if(d<=tol)candidates.push({dx:target.point.x-q.x,dy:target.point.y-q.y,cost:d,rank:0,guides:[{a:q,b:target.point,label:target.label}]});}
  for(const line of context.lines){const vx=line.b.x-line.a.x,vy=line.b.y-line.a.y,l2=vx*vx+vy*vy;if(l2<1e-9)continue;const t=((q.x-line.a.x)*vx+(q.y-line.a.y)*vy)/l2;if(t<0||t>1)continue;const projection={x:line.a.x+t*vx,y:line.a.y+t*vy},d=distance(q,projection);if(d<=tol)candidates.push({dx:projection.x-q.x,dy:projection.y-q.y,cost:d,rank:1,guides:[{...line,label:`On ${line.label}`}]});}
 }
 // One point may align parallel/perpendicular to another existing edge, with its neighbour fixed.
 if(kind==='point'){
  const q=raw[index],anchors=[points[(index+points.length-1)%points.length],points[(index+1)%points.length]],lines=[...context.lines,...points.flatMap((a,i)=>moved.has(i)||moved.has((i+1)%points.length)?[]:[{a,b:points[(i+1)%points.length],label:`Edge ${i+1}`}])];
  for(const anchor of anchors)for(const line of lines){const vx=line.b.x-line.a.x,vy=line.b.y-line.a.y,len=Math.hypot(vx,vy);if(len<1e-9)continue;for(const perpendicular of [false,true]){const ux=(perpendicular?-vy:vx)/len,uy=(perpendicular?vx:vy)/len,t=(q.x-anchor.x)*ux+(q.y-anchor.y)*uy,projection={x:anchor.x+t*ux,y:anchor.y+t*uy},d=distance(q,projection);if(d<=tol&&distance(anchor,projection)>=1)candidates.push({dx:projection.x-q.x,dy:projection.y-q.y,cost:d,rank:2,guides:[{a:anchor,b:projection,label:`${perpendicular?'Perpendicular':'Parallel'} to ${line.label}`} ]});}}
  const a=anchors[0],b=anchors[1],vx=b.x-a.x,vy=b.y-a.y,l2=vx*vx+vy*vy;
  if(l2>1e-9){const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},t=((q.x-mid.x)*vx+(q.y-mid.y)*vy)/l2,projection={x:q.x-t*vx,y:q.y-t*vy},d=distance(q,projection);if(d<=tol)candidates.push({dx:projection.x-q.x,dy:projection.y-q.y,cost:d,rank:3,guides:[{a,b:projection,label:'Equal distance to adjacent corners'},{a:projection,b,label:'Equal distance to adjacent corners'}]});}
 }
 const physical=candidates.sort((a,b)=>a.rank-b.rank||a.cost-b.cost)[0];
 // Axis guides can align across a drawing, including another level's corners. A single rigid offset
 // applies to every moved point, so an edge or level is never skewed by two independent endpoint snaps.
 const axes=(axis:'x'|'y')=>[...moved].flatMap(i=>targets.map(target=>({i,target,delta:target.point[axis]-raw[i][axis]}))).filter(c=>Math.abs(c.delta)<=tol&&Math.abs(c.delta)>1e-8).sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta))[0];
 let sx=physical?.dx??0,sy=physical?.dy??0,guides=physical?.guides??[];
 if(!physical){let x=axes('x'),y=axes('y');if(x&&y&&Math.hypot(x.delta,y.delta)>tol){if(Math.abs(x.delta)<=Math.abs(y.delta))y=undefined;else x=undefined;}if(x){sx=x.delta;guides.push({a:x.target.point,b:{x:x.target.point.x,y:raw[x.i].y},label:`Align X · ${x.target.label}`});}if(y){sy=y.delta;guides.push({a:y.target.point,b:{x:raw[y.i].x+sx,y:y.target.point.y},label:`Align Y · ${y.target.label}`});}}
 // An already exact relation is still shown, without moving the user's point unnecessarily.
 if(!guides.length){const exact=candidates.filter(c=>c.cost<=1e-8).sort((a,b)=>a.rank-b.rank)[0];guides=exact?.guides??[];}
 return {points:make(dxIn+sx,dyIn+sy),dxIn:dxIn+sx,dyIn:dyIn+sy,guides};
}
