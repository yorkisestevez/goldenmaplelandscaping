import {validateYardFinishedSettings} from './yardFinishedSettings';
import type {YardFeature} from './types';
import type {PlanPoint} from './lib/deckGeometry';
import {arcGeometry,bulgeForRadius} from './circularArcs';
import {inspectArcShape} from './circularArcShape';
import {EPS,bounds,shapeKind,yardShapeProblem,yardShapeLocalPoints,yardShapeLocalPoint,yardShapeWorldPoint,yardShapeWorldPoints,type YardPullKind} from './yardShapeGeometry';
export * from './yardShapeGeometry';
const place=(f:YardFeature,xFt:number,zFt:number)=>{if(!Number.isFinite(xFt)||!Number.isFinite(zFt)||xFt< -150||xFt>150||zFt< -150||zFt>200)throw Error('Keep the feature centre within the editable yard (across −150 to 150 ft; out −150 to 200 ft).');return {...f,xFt,zFt};};
export const yardShapeMove=(f:YardFeature,dxIn:number,dyIn:number)=>place(f,f.xFt+dxIn/12,f.zFt+dyIn/12);

/** Recentre local points without moving their world geometry. All finishes, height and product fields survive. */
export function yardShapeEdit(f:YardFeature,world:PlanPoint[]):YardFeature{
 const kind=shapeKind(f),before=yardShapeWorldPoints(f);if(world.length===before.length&&world.every((p,i)=>Math.hypot(p.x-before[i].x,p.y-before[i].y)<EPS))return f;
 const raw=world.map(p=>yardShapeLocalPoint(f,p)),b=bounds(raw),centre={x:b.x+b.w/2,y:b.y+b.h/2},points=raw.map(p=>({x:p.x-centre.x,y:p.y-centre.y})),problem=yardShapeProblem(kind,points,f.curves);if(problem)throw Error(problem);
 const curves=f.curves?.map(c=>{const old=yardShapeLocalPoints(f),g=arcGeometry(old[c.edge],old[(c.edge+1)%old.length],c.bulgeIn),a=points[c.edge],b=points[(c.edge+1)%points.length],half=Math.hypot(b.x-a.x,b.y-a.y)/2;if(half>g.radius+1e-7)throw Error('This edit cannot retain the arc radius. Increase the radius first.');const major=Math.abs(c.bulgeIn)>Math.hypot(old[(c.edge+1)%old.length].x-old[c.edge].x,old[(c.edge+1)%old.length].y-old[c.edge].y)/2;return {...c,bulgeIn:major?Math.sign(c.bulgeIn)*(g.radius+Math.sqrt(Math.max(0,g.radius*g.radius-half*half))):bulgeForRadius(a,b,g.radius,Math.sign(c.bulgeIn))};});
 const curveShape=inspectArcShape(points,curves,kind==='patio',f.productId==='techo-raffinato-wall'?102:undefined);
 const positioned=yardShapeWorldPoint(f,centre),{curves:_oldCurves,...placed}=place(f,positioned.x/12,positioned.y/12),next={...placed,...(kind==='patio'&&f.finishedElevationIn!==undefined?{finishedElevationIn:f.finishedElevationIn+(f.patioSlope?.xPct??0)*centre.x/100+(f.patioSlope?.zPct??0)*centre.y/100}:{}),...(curves?.length?{curves}:{})};
 return validateYardFinishedSettings(kind==='patio'?{...next,outline:points,widthFt:b.w/12,depthFt:b.h/12,...(f.inlays?{inlays:f.inlays.map(i=>({...i,xIn:i.xIn-centre.x,yIn:i.yIn-centre.y}))}:{})}:{...next,wallPath:points,widthFt:curveShape.lengthIn/12});
}
export function yardShapePull(f:YardFeature,kind:YardPullKind,index:number,dxIn:number,dyIn:number):YardFeature{
 if(kind==='area')return yardShapeMove(f,dxIn,dyIn);
 const points=yardShapeWorldPoints(f),closed=f.kind==='patio';if(!Number.isInteger(index)||index<0||index>=points.length-(kind==='edge'&&!closed?1:0))throw Error('Choose an existing point or edge.');
 return yardShapeEdit(f,points.map((p,i)=>i===index||kind==='edge'&&i===(index+1)%points.length?{x:p.x+dxIn,y:p.y+dyIn}:p));
}
export function yardShapeInsert(f:YardFeature,index:number,cursor?:PlanPoint):YardFeature{
 if(f.curves?.some(c=>c.edge===index))throw Error('Straighten the arc before inserting a control point.');const p=yardShapeWorldPoints(f),closed=f.kind==='patio';if(p.length>=64)throw Error('This feature already has 64 points. Remove a point before adding another.');if(!Number.isInteger(index)||index<0||index>=p.length-(closed?0:1))throw Error('Choose an existing edge.');
 const a=p[index],b=p[(index+1)%p.length],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),t=cursor?Math.max(0,Math.min(1,((cursor.x-a.x)*dx+(cursor.y-a.y)*dy)/(len*len))):.5;
 if(!Number.isFinite(t)||t*len<1||(1-t)*len<1)throw Error('Place a new pull point at least 1 inch from either end.');
 p.splice(index+1,0,{x:a.x+dx*t,y:a.y+dy*t});const curves=f.curves?.map(c=>({...c,edge:c.edge>index?c.edge+1:c.edge}));const next=yardShapeEdit({...f,curves:undefined,wallTopSteps:undefined},p);return validateYardFinishedSettings({...next,wallTopSteps:f.wallTopSteps,...(curves?.length?{curves}:{}),...(f.kind==='retaining-wall'?{widthFt:inspectArcShape(next.wallPath!,curves,false).lengthIn/12}:{})});
}
export function yardShapeRemove(f:YardFeature,index:number):YardFeature{if(f.curves?.some(c=>c.edge===index||(c.edge+1)%yardShapeLocalPoints(f).length===index))throw Error('Straighten adjacent arcs before removing this endpoint.');const p=yardShapeWorldPoints(f),min=f.kind==='patio'?3:2;if(p.length<=min)throw Error(`Keep at least ${min} points, or select the whole feature to delete it.`);if(!Number.isInteger(index)||index<0||index>=p.length)throw Error('Choose an existing point.');const curves=f.curves?.map(c=>({...c,edge:c.edge>index?c.edge-1:c.edge})),next=yardShapeEdit({...f,curves:undefined,wallTopSteps:undefined},p.filter((_,i)=>i!==index));return validateYardFinishedSettings({...next,wallTopSteps:f.wallTopSteps,...(curves?.length?{curves}:{}),...(f.kind==='retaining-wall'?{widthFt:inspectArcShape(next.wallPath!,curves,false).lengthIn/12}:{})});}
export function yardShapeDimension(f:YardFeature,index:number,lengthIn:number,angleDeg?:number):YardFeature{
 const p=yardShapeWorldPoints(f);if(!Number.isInteger(index)||index<0||index>=p.length-(f.kind==='patio'?0:1))throw Error('Choose an existing edge.');if(!Number.isFinite(lengthIn)||lengthIn<1||lengthIn>960)throw Error('Enter an edge length between 1 inch and 80 ft.');
 const a=p[index],i=(index+1)%p.length,b=p[i],angle=angleDeg===undefined?Math.atan2(b.y-a.y,b.x-a.x):angleDeg*Math.PI/180;if(!Number.isFinite(angle))throw Error('Enter a finite edge angle.');
 p[i]={x:a.x+Math.cos(angle)*lengthIn,y:a.y+Math.sin(angle)*lengthIn};return yardShapeEdit(f,p);
}
/** Numeric settings scale a custom shape instead of silently replacing it with its legacy primitive. */
export function yardShapeResize(f:YardFeature,widthFt=f.widthFt,depthFt=f.depthFt):YardFeature{
 const kind=shapeKind(f);if(!Number.isFinite(widthFt)||!Number.isFinite(depthFt)||widthFt<2||widthFt>(kind==='patio'?60:f.wallPath?240:80)||depthFt<(kind==='patio'?2:1/12)||depthFt>(kind==='patio'?60:8))throw Error('Enter dimensions within this feature’s width and depth limits.');
 if(widthFt===f.widthFt&&depthFt===f.depthFt)return f;
 if(!f.outline&&!f.wallPath)return validateYardFinishedSettings({...f,widthFt,depthFt});
 const p=yardShapeLocalPoints(f),b=bounds(p),sx=kind==='patio'?widthFt*12/b.w:widthFt*12/inspectArcShape(p,f.curves,false).lengthIn,sy=kind==='patio'?depthFt*12/b.h:sx,centre={x:b.x+b.w/2,y:b.y+b.h/2},next=p.map(q=>({x:centre.x+(q.x-centre.x)*sx,y:centre.y+(q.y-centre.y)*sy})),problem=yardShapeProblem(kind,next,f.curves?.map(c=>({...c,bulgeIn:c.bulgeIn*sx})));if(problem)throw Error(problem);
 if(f.curves?.length&&Math.abs(sx-sy)>1e-8)throw Error('Circular arcs require uniform scaling. Change their radius or move an endpoint.');const curves=f.curves?.map(c=>({...c,bulgeIn:c.bulgeIn*sx}));inspectArcShape(next,curves,kind==='patio',f.productId==='techo-raffinato-wall'?102:undefined);return validateYardFinishedSettings(kind==='patio'?{...f,widthFt,depthFt,outline:next,curves}:{...f,widthFt,depthFt,wallPath:next,curves});
}
