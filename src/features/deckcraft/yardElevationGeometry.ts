import type {YardFeature} from './types';
import type {PlanPoint} from './lib/deckGeometry';
import type {SitePlane} from './siteSurface';

/** A local patio plane follows the object's rotation, preserving its centre datum. */
export function patioTopPlane(f:YardFeature,grade:number):SitePlane {
 const a=f.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),u=(f.patioSlope?.xPct??0)/100,v=(f.patioSlope?.zPct??0)/100,x=c*u-s*v,z=s*u+c*v;
 return {x,z,constant:(f.finishedElevationIn??grade+f.heightIn)-x*f.xFt*12-z*f.zFt*12};
}
export const planeAt=(p:SitePlane,x:number,z:number)=>p.x*x+p.z*z+p.constant;
export const planeNormalScale=(p:SitePlane)=>Math.sqrt(1+p.x*p.x+p.z*p.z);
export const belowPlane=(p:SitePlane,normalDepth:number):SitePlane=>({...p,constant:p.constant-normalDepth*planeNormalScale(p)});

/** Orthogonal tilt of a horizontal stock pattern. Unlike affine shearing this
 * preserves stock face edge lengths and right angles. Clipping happens after tilt. */
export function tiltStockPoint(p:PlanPoint,plane:SitePlane,origin:PlanPoint):PlanPoint {
 const r=Math.hypot(plane.x,plane.z);if(!r)return p;
 const along=((p.x-origin.x)*plane.x+(p.y-origin.y)*plane.z)/(r*r),contraction=1/planeNormalScale(plane)-1;
 return {x:p.x+plane.x*along*contraction,y:p.y+plane.z*along*contraction};
}
export function untiltStockPoint(p:PlanPoint,plane:SitePlane,origin:PlanPoint):PlanPoint {
 const r=Math.hypot(plane.x,plane.z);if(!r)return p;
 const along=((p.x-origin.x)*plane.x+(p.y-origin.y)*plane.z)/(r*r),expansion=planeNormalScale(plane)-1;
 return {x:p.x+plane.x*along*expansion,y:p.y+plane.z*along*expansion};
}
export interface ElevationPrism {y:number;h:number;topPlane?:SitePlane;bottomPlane?:SitePlane;bottomIn?:number;normalThicknessIn?:number}
/** Shared physical rings consumed by renderer/exporters. Plan vertices denote
 * the top face; the bottom moves along its normal by the stock thickness. */
export function yardBoxRings(b:ElevationPrism,p:PlanPoint[]) {
 const top=b.topPlane,normal=top&&b.normalThicknessIn!==undefined?b.normalThicknessIn/planeNormalScale(top):0;
 return {top:p.map(v=>({x:v.x,y:top?planeAt(top,v.x,v.y):b.y+b.h/2,z:v.y})),bottom:p.map(v=>({x:v.x+(top?top.x*normal:0),y:b.normalThicknessIn!==undefined&&top?planeAt(top,v.x,v.y)-normal:b.bottomPlane?planeAt(b.bottomPlane,v.x,v.y):b.bottomIn??b.y-b.h/2,z:v.y+(top?top.z*normal:0)}))};
}
export const subtractPlanes=(a:SitePlane,b:SitePlane):SitePlane=>({x:a.x-b.x,z:a.z-b.z,constant:a.constant-b.constant});
export const reversePlane=(p:SitePlane):SitePlane=>({x:-p.x,z:-p.z,constant:-p.constant});
export function abovePlane(poly:PlanPoint[],plane:SitePlane){const out:PlanPoint[]=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ha=planeAt(plane,a.x,a.y),hb=planeAt(plane,b.x,b.y);if(ha>=-1e-8)out.push(a);if(ha>1e-8&&hb<-1e-8||ha<-1e-8&&hb>1e-8){const t=ha/(ha-hb);out.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});}}return out.length>=3?out:[];}
export function planeVolume(poly:PlanPoint[],plane:SitePlane){let volume=0;for(let i=1;i+1<poly.length;i++){const a=poly[0],b=poly[i],c=poly[i+1],area=Math.abs((b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y))/2;volume+=area*(planeAt(plane,a.x,a.y)+planeAt(plane,b.x,b.y)+planeAt(plane,c.x,c.y))/3;}return volume;}
export interface PlaneCell {polygon:PlanPoint[];plane:SitePlane;featureId:string}
/** One construction formation updates an affine lower envelope. This common
 * partition operation is used by both legacy planes and measured TIN faces. */
export function applyPlaneFormation(cells:PlaneCell[],polygons:PlanPoint[][],plane:SitePlane,featureId:string,clip:(a:PlanPoint[][],b:PlanPoint[][],operation:'intersection'|'difference'|'union')=>PlanPoint[][],solid:(p:PlanPoint[][])=>PlanPoint[][]){
 const next:PlaneCell[]=[];
 for(const cell of cells){const difference=subtractPlanes(cell.plane,plane);if(cell.polygon.every(v=>planeAt(difference,v.x,v.y)<=1e-8)){next.push(cell);continue;}const overlap=clip([cell.polygon],polygons,'intersection');if(!overlap.length){next.push(cell);continue;}next.push(...solid(clip([cell.polygon],polygons,'difference')).map(polygon=>({...cell,polygon})));
  for(const p of solid(overlap)){const delta=subtractPlanes(cell.plane,plane);if(p.every(v=>Math.abs(planeAt(delta,v.x,v.y))<1e-8)){next.push({...cell,polygon:p});continue;}const lower=abovePlane(p,delta),keep=abovePlane(p,reversePlane(delta));if(lower.length)next.push({polygon:lower,plane,featureId});if(keep.length)next.push({...cell,polygon:keep});}
 }
 next.push(...solid(clip(polygons,clip(cells.map(c=>c.polygon),[],'union'),'difference')).map(polygon=>({polygon,plane,featureId})));return next;
}
