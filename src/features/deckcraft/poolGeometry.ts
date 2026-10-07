import ClipperLib from 'clipper-lib';
import type {PlanPoint} from './lib/deckGeometry';
import type {PoolFeature} from './poolTypes';
import type {SitePlane} from './siteSurface';
import {arcGeometry,sampleArc} from './circularArcs';
import {localPolygonClip} from './lib/localPolygonClip';
export const poolClip=(a:PlanPoint[][],b:PlanPoint[][]=[],op:'union'|'difference'|'intersection'='union')=>localPolygonClip(a,b,op,100000);
export const poolSignedArea=(p:PlanPoint[])=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.y-b.x*a.y;},0)/2;
export const poolArea=(p:PlanPoint[][])=>Math.abs(p.reduce((n,x)=>n+poolSignedArea(x),0))/144;
export function poolLocalOutline(p:Pick<PoolFeature,'outline'|'curves'>,toleranceIn=.002){const out:PlanPoint[]=[];for(let i=0;i<p.outline.length;i++){const a=p.outline[i],b=p.outline[(i+1)%p.outline.length],arc=p.curves?.find(c=>c.edge===i);out.push(...(arc?sampleArc(a,b,arc.bulgeIn,toleranceIn).slice(0,-1):[a]));}return out;}
export function poolLocalBounds(p:Pick<PoolFeature,'outline'|'curves'>){const points=poolLocalOutline(p),xs=points.map(v=>v.x),ys=points.map(v=>v.y);return {minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...ys),maxZ:Math.max(...ys),widthIn:Math.max(...xs)-Math.min(...xs),lengthIn:Math.max(...ys)-Math.min(...ys)};}
export function poolWorldPoint(p:Pick<PoolFeature,'xIn'|'zIn'|'rotationDeg'>,q:PlanPoint){const a=p.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return {x:p.xIn+c*q.x-s*q.y,y:p.zIn+s*q.x+c*q.y};}
export function poolLocalPoint(p:Pick<PoolFeature,'xIn'|'zIn'|'rotationDeg'>,q:PlanPoint){const a=p.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=q.x-p.xIn,z=q.y-p.zIn;return {x:c*x+s*z,y:-s*x+c*z};}
export const poolOutline=(p:PoolFeature,toleranceIn=.002)=>poolLocalOutline(p,toleranceIn).map(q=>poolWorldPoint(p,q));
export function poolPermanentExclusion(p:PoolFeature){const opening=poolClip([poolOutline(p)]),structure=poolOffset(opening,p.assembly?.wallThicknessIn??0),edge=poolOffset(opening,p.coping?p.coping.widthIn-p.coping.overhangIn:p.assembly?.wallThicknessIn??0);return poolOffset(poolClip([...structure,...edge]),p.coping?.transitionJointIn??0);}
export function poolPerimeterIn(p:PoolFeature){return p.outline.reduce((n,a,i)=>{const b=p.outline[(i+1)%p.outline.length],arc=p.curves?.find(c=>c.edge===i);return n+(arc?arcGeometry(a,b,arc.bulgeIn).lengthIn:Math.hypot(b.x-a.x,b.y-a.y));},0);}
/** Translation is removed before offsetting to retain the shared precision grid. */
export function poolOffset(polys:PlanPoint[][],distanceIn:number):PlanPoint[][]{if(Math.abs(distanceIn)<1e-10)return poolClip(polys);if(!polys.length)return [];const scale=100000,x=polys[0][0].x,y=polys[0][0].y;const engine=new ClipperLib.ClipperOffset(3,.001*scale),out:{X:number;Y:number}[][]=[];engine.AddPaths(polys.map(p=>p.map(v=>({X:Math.round((v.x-x)*scale),Y:Math.round((v.y-y)*scale)}))),ClipperLib.JoinType.jtMiter,ClipperLib.EndType.etClosedPolygon);engine.Execute(out,distanceIn*scale);return out.map(p=>p.map(v=>({x:x+v.X/scale,y:y+v.Y/scale})));}
export function poolShapeSignature(p:Pick<PoolFeature,'outline'|'curves'|'depthProfile'>){return JSON.stringify({outline:p.outline,curves:p.curves??[],depthProfile:p.depthProfile});}
export const poolWaterElevation=(p:PoolFeature)=>p.copingTopElevationIn-p.waterOffsetIn;
/** Piecewise affine floor in project coordinates, depth measured below water. */
export function poolFloorPlane(p:PoolFeature,index:number):SitePlane{const b=poolLocalBounds(p),u=p.depthProfile[index],v=p.depthProfile[index+1],slope=-(v.depthIn-u.depthIn)/(v.stationIn-u.stationIn),a=p.rotationDeg*Math.PI/180,x=-Math.sin(a)*slope,z=Math.cos(a)*slope;return {x,z,constant:poolWaterElevation(p)-u.depthIn-slope*(b.minZ+u.stationIn)-x*p.xIn-z*p.zIn};}
export function poolFloorElevation(p:PoolFeature,q:PlanPoint){const local=poolLocalPoint(p,q),station=local.y-poolLocalBounds(p).minZ;let i=p.depthProfile.findIndex((v,j)=>j>0&&station<=v.stationIn);if(i<0)i=p.depthProfile.length-1;return poolWaterElevation(p)-p.depthProfile[i-1].depthIn-(p.depthProfile[i].depthIn-p.depthProfile[i-1].depthIn)*(station-p.depthProfile[i-1].stationIn)/(p.depthProfile[i].stationIn-p.depthProfile[i-1].stationIn);}
