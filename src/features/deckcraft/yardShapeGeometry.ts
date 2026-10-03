import type {YardFeature} from './types';
import type {PlanPoint} from './lib/deckGeometry';
import {tessellateArcs,arcGeometry,type CircularArc} from './circularArcs';

export type YardShapeKind='patio'|'retaining-wall';
export type YardPullKind='point'|'edge'|'area';
export const YARD_SHAPE_LIMITS={points:64,coordinateIn:1200,minEdgeIn:1,patioMinIn:24,patioMaxIn:720,wallMinRunIn:24,wallMaxRunIn:2880} as const;
export const EPS=1e-7;
export const copy=(p:PlanPoint)=>({x:p.x,y:p.y});
export const bounds=(p:PlanPoint[])=>{const xs=p.map(q=>q.x),ys=p.map(q=>q.y),x=Math.min(...xs),y=Math.min(...ys);return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};};
export const yardShapeSignedArea=(p:PlanPoint[])=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.y-b.x*a.y;},0)/2;
export const yardShapeRunIn=(p:PlanPoint[])=>p.slice(1).reduce((n,b,i)=>n+Math.hypot(b.x-p[i].x,b.y-p[i].y),0);
const cross=(a:PlanPoint,b:PlanPoint,c:PlanPoint)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const on=(a:PlanPoint,b:PlanPoint,p:PlanPoint)=>Math.abs(cross(a,b,p))<EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;
const intersects=(a:PlanPoint,b:PlanPoint,c:PlanPoint,d:PlanPoint)=>cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
export const shapeKind=(f:YardFeature):YardShapeKind=>{if(f.kind!=='patio'&&f.kind!=='retaining-wall')throw Error('Choose a patio or retaining wall to edit its shape.');return f.kind;};

/** Strict shared validation. It inspects descriptors before reading values, so imports never invoke getters. */
export function yardShapeProblem(kind:YardShapeKind,value:unknown,curves?:CircularArc[]):string{
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
 else{const run=curves?.length?points.slice(1).reduce((sum,b,i)=>{const c=curves.find(c=>c.edge===i);return sum+(c?arcGeometry(points[i],b,c.bulgeIn).lengthIn:Math.hypot(b.x-points[i].x,b.y-points[i].y));},0):yardShapeRunIn(points);if(run<24-EPS||run>2880+EPS)return 'Keep the complete wall path between 2 and 240 ft long.';}
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
export const yardShapeCurveWorldPoints=(f:YardFeature)=>tessellateArcs(yardShapeLocalPoints(f),f.curves,f.kind==='patio').map(p=>yardShapeWorldPoint(f,p));
/** The editing view includes saved shapes even when their installed model is excluded. */
export function yardShapeFrame<T extends {x:number;y:number;w:number;h:number;viewBox:string}>(frame:T,features:readonly YardFeature[]):T{
 const points=features.filter(f=>f.kind==='patio'||f.kind==='retaining-wall').flatMap(yardShapeCurveWorldPoints).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));if(!points.length)return frame;
 const b=bounds(points),x=Math.min(frame.x,b.x-40),y=Math.min(frame.y,b.y-40),right=Math.max(frame.x+frame.w,b.x+b.w+40),bottom=Math.max(frame.y+frame.h,b.y+b.h+40);if(x===frame.x&&y===frame.y&&right===frame.x+frame.w&&bottom===frame.y+frame.h)return frame;
 return {...frame,x,y,w:right-x,h:bottom-y,viewBox:`${x} ${y} ${right-x} ${bottom-y}`};
}
