import type {YardFeature} from './types';
import type {PlanPoint} from './lib/deckGeometry';

export type YardShapeKind='patio'|'retaining-wall';
export type YardPullKind='point'|'edge'|'area';
export const YARD_SHAPE_LIMITS={points:64,coordinateIn:1200,minEdgeIn:1,patioMinIn:24,patioMaxIn:720,wallMinRunIn:24,wallMaxRunIn:960} as const;
const EPS=1e-7;
const copy=(p:PlanPoint)=>({x:p.x,y:p.y});
const bounds=(p:PlanPoint[])=>{const xs=p.map(q=>q.x),ys=p.map(q=>q.y),x=Math.min(...xs),y=Math.min(...ys);return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};};
export const yardShapeSignedArea=(p:PlanPoint[])=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.y-b.x*a.y;},0)/2;
export const yardShapeRunIn=(p:PlanPoint[])=>p.slice(1).reduce((n,b,i)=>n+Math.hypot(b.x-p[i].x,b.y-p[i].y),0);
const cross=(a:PlanPoint,b:PlanPoint,c:PlanPoint)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const on=(a:PlanPoint,b:PlanPoint,p:PlanPoint)=>Math.abs(cross(a,b,p))<EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;
const intersects=(a:PlanPoint,b:PlanPoint,c:PlanPoint,d:PlanPoint)=>cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
const shapeKind=(f:YardFeature):YardShapeKind=>{if(f.kind!=='patio'&&f.kind!=='retaining-wall')throw Error('Choose a patio or retaining wall to edit its shape.');return f.kind;};

/** Strict shared validation. It inspects descriptors before reading values, so imports never invoke getters. */
export function yardShapeProblem(kind:YardShapeKind,value:unknown):string{
 const min=kind==='patio'?3:2;
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length<min||value.length>64)return `Keep ${min}–64 points on this ${kind==='patio'?'patio':'wall path'}.`;
 const array=Object.getOwnPropertyDescriptors(value);if(Reflect.ownKeys(value).some(k=>typeof k!=='string'||k!=='length'&&(!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=value.length)))return 'Shape points cannot contain extra or unsafe fields.';
 const points:PlanPoint[]=[];
 for(let i=0;i<value.length;i++){
  const entry=array[i];if(!entry||!('value'in entry)||!entry.enumerable)return 'Every shape point must be present as a plain value.';
  const p=entry.value;if(!p||typeof p!=='object'||Array.isArray(p)||![Object.prototype,null].includes(Object.getPrototypeOf(p)))return 'Every shape point must be a plain across/out measurement.';
  const d=Object.getOwnPropertyDescriptors(p);if(Reflect.ownKeys(p).length!==2||!d.x||!d.y||![d.x,d.y].every(v=>'value'in v&&v.enumerable))return 'Every shape point needs only safe x and y measurements.';
  if(![d.x.value,d.y.value].every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1200))return 'Keep local shape coordinates finite and within 100 ft of the feature centre.';
  points.push({x:d.x.value,y:d.y.value});
 }
 const closed=kind==='patio',edges=closed?points.length:points.length-1;
 for(let i=0;i<edges;i++){const a=points[i],b=points[(i+1)%points.length];if(Math.hypot(b.x-a.x,b.y-a.y)<1-EPS)return 'Leave at least 1 inch between neighbouring pull points.';}
 for(let i=closed?0:1;i<(closed?points.length:points.length-1);i++){const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length];if(Math.abs(cross(a,b,c))<EPS&&(b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y)<0)return 'Those segments double back. Keep a clear shape.';}
 for(let i=0;i<edges;i++)for(let j=i+1;j<edges;j++){if(j===i+1||closed&&i===0&&j===edges-1)continue;if(intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))return 'Those segments cross or touch. Move the pull point back to a clear shape.';}
 if(closed){const b=bounds(points);if(b.w<24-EPS||b.h<24-EPS||b.w>720+EPS||b.h>720+EPS)return 'Keep the patio between 2 and 60 ft across and out.';if(yardShapeSignedArea(points)<144-EPS)return 'Keep a clockwise plan outline enclosing at least 1 sq ft.';}
 else{const run=yardShapeRunIn(points);if(run<24-EPS||run>960+EPS)return 'Keep the complete wall path between 2 and 80 ft long.';}
 return '';
}

/** Saved custom points are local inches; absent fields retain the exact legacy rectangle or straight wall. */
export function yardShapeLocalPoints(f:YardFeature):PlanPoint[]{
 const kind=shapeKind(f),saved=kind==='patio'?f.outline:f.wallPath;if(saved)return saved.map(copy);
 const w=f.widthFt*12,d=f.depthFt*12;
 return kind==='patio'?[{x:-w/2,y:-d/2},{x:w/2,y:-d/2},{x:w/2,y:d/2},{x:-w/2,y:d/2}]:[{x:-w/2,y:0},{x:w/2,y:0}];
}
export function yardShapeWorldPoint(f:YardFeature,p:PlanPoint):PlanPoint{const a=f.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return {x:f.xFt*12+c*p.x-s*p.y,y:f.zFt*12+s*p.x+c*p.y};}
export function yardShapeLocalPoint(f:YardFeature,p:PlanPoint):PlanPoint{const a=f.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=p.x-f.xFt*12,y=p.y-f.zFt*12;return {x:c*x+s*y,y:-s*x+c*y};}
export const yardShapeWorldPoints=(f:YardFeature)=>yardShapeLocalPoints(f).map(p=>yardShapeWorldPoint(f,p));
/** The editing view includes saved shapes even when their installed model is excluded. */
export function yardShapeFrame<T extends {x:number;y:number;w:number;h:number;viewBox:string}>(frame:T,features:readonly YardFeature[]):T{
 const points=features.filter(f=>f.kind==='patio'||f.kind==='retaining-wall').flatMap(yardShapeWorldPoints).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));if(!points.length)return frame;
 const b=bounds(points),x=Math.min(frame.x,b.x-40),y=Math.min(frame.y,b.y-40),right=Math.max(frame.x+frame.w,b.x+b.w+40),bottom=Math.max(frame.y+frame.h,b.y+b.h+40);if(x===frame.x&&y===frame.y&&right===frame.x+frame.w&&bottom===frame.y+frame.h)return frame;
 return {...frame,x,y,w:right-x,h:bottom-y,viewBox:`${x} ${y} ${right-x} ${bottom-y}`};
}
const place=(f:YardFeature,xFt:number,zFt:number)=>{if(!Number.isFinite(xFt)||!Number.isFinite(zFt)||xFt< -150||xFt>150||zFt< -150||zFt>200)throw Error('Keep the feature centre within the editable yard (across −150 to 150 ft; out −150 to 200 ft).');return {...f,xFt,zFt};};
export const yardShapeMove=(f:YardFeature,dxIn:number,dyIn:number)=>place(f,f.xFt+dxIn/12,f.zFt+dyIn/12);

/** Recentre local points without moving their world geometry. All finishes, height and product fields survive. */
export function yardShapeEdit(f:YardFeature,world:PlanPoint[]):YardFeature{
 const kind=shapeKind(f),before=yardShapeWorldPoints(f);if(world.length===before.length&&world.every((p,i)=>Math.hypot(p.x-before[i].x,p.y-before[i].y)<EPS))return f;
 const raw=world.map(p=>yardShapeLocalPoint(f,p)),b=bounds(raw),centre={x:b.x+b.w/2,y:b.y+b.h/2},points=raw.map(p=>({x:p.x-centre.x,y:p.y-centre.y})),problem=yardShapeProblem(kind,points);if(problem)throw Error(problem);
 const positioned=yardShapeWorldPoint(f,centre),next=place(f,positioned.x/12,positioned.y/12);
 return kind==='patio'?{...next,outline:points,widthFt:b.w/12,depthFt:b.h/12}:{...next,wallPath:points,widthFt:yardShapeRunIn(points)/12};
}
export function yardShapePull(f:YardFeature,kind:YardPullKind,index:number,dxIn:number,dyIn:number):YardFeature{
 if(kind==='area')return yardShapeMove(f,dxIn,dyIn);
 const points=yardShapeWorldPoints(f),closed=f.kind==='patio';if(!Number.isInteger(index)||index<0||index>=points.length-(kind==='edge'&&!closed?1:0))throw Error('Choose an existing point or edge.');
 return yardShapeEdit(f,points.map((p,i)=>i===index||kind==='edge'&&i===(index+1)%points.length?{x:p.x+dxIn,y:p.y+dyIn}:p));
}
export function yardShapeInsert(f:YardFeature,index:number,cursor?:PlanPoint):YardFeature{
 const p=yardShapeWorldPoints(f),closed=f.kind==='patio';if(p.length>=64)throw Error('This feature already has 64 points. Remove a point before adding another.');if(!Number.isInteger(index)||index<0||index>=p.length-(closed?0:1))throw Error('Choose an existing edge.');
 const a=p[index],b=p[(index+1)%p.length],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),t=cursor?Math.max(0,Math.min(1,((cursor.x-a.x)*dx+(cursor.y-a.y)*dy)/(len*len))):.5;
 if(!Number.isFinite(t)||t*len<1||(1-t)*len<1)throw Error('Place a new pull point at least 1 inch from either end.');
 p.splice(index+1,0,{x:a.x+dx*t,y:a.y+dy*t});return yardShapeEdit(f,p);
}
export function yardShapeRemove(f:YardFeature,index:number):YardFeature{const p=yardShapeWorldPoints(f),min=f.kind==='patio'?3:2;if(p.length<=min)throw Error(`Keep at least ${min} points, or select the whole feature to delete it.`);if(!Number.isInteger(index)||index<0||index>=p.length)throw Error('Choose an existing point.');return yardShapeEdit(f,p.filter((_,i)=>i!==index));}
export function yardShapeDimension(f:YardFeature,index:number,lengthIn:number,angleDeg?:number):YardFeature{
 const p=yardShapeWorldPoints(f);if(!Number.isInteger(index)||index<0||index>=p.length-(f.kind==='patio'?0:1))throw Error('Choose an existing edge.');if(!Number.isFinite(lengthIn)||lengthIn<1||lengthIn>960)throw Error('Enter an edge length between 1 inch and 80 ft.');
 const a=p[index],i=(index+1)%p.length,b=p[i],angle=angleDeg===undefined?Math.atan2(b.y-a.y,b.x-a.x):angleDeg*Math.PI/180;if(!Number.isFinite(angle))throw Error('Enter a finite edge angle.');
 p[i]={x:a.x+Math.cos(angle)*lengthIn,y:a.y+Math.sin(angle)*lengthIn};return yardShapeEdit(f,p);
}
/** Numeric settings scale a custom shape instead of silently replacing it with its legacy primitive. */
export function yardShapeResize(f:YardFeature,widthFt=f.widthFt,depthFt=f.depthFt):YardFeature{
 const kind=shapeKind(f);if(!Number.isFinite(widthFt)||!Number.isFinite(depthFt)||widthFt<2||widthFt>(kind==='patio'?60:80)||depthFt<(kind==='patio'?2:1/12)||depthFt>(kind==='patio'?60:8))throw Error('Enter dimensions within this feature’s width and depth limits.');
 if(widthFt===f.widthFt&&depthFt===f.depthFt)return f;
 if(!f.outline&&!f.wallPath)return {...f,widthFt,depthFt};
 const p=yardShapeLocalPoints(f),b=bounds(p),sx=kind==='patio'?widthFt*12/b.w:widthFt*12/yardShapeRunIn(p),sy=kind==='patio'?depthFt*12/b.h:sx,centre={x:b.x+b.w/2,y:b.y+b.h/2},next=p.map(q=>({x:centre.x+(q.x-centre.x)*sx,y:centre.y+(q.y-centre.y)*sy})),problem=yardShapeProblem(kind,next);if(problem)throw Error(problem);
 return kind==='patio'?{...f,widthFt,depthFt,outline:next}:{...f,widthFt,depthFt,wallPath:next};
}
