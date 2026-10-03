import {stepAssemblyFootprints} from './stepAssemblyRegistry';
import ClipperLib from 'clipper-lib';
import type {PlanPoint} from './lib/deckGeometry';
import type {YardFeature} from './types';
import {tessellateArcs,sampleArc,arcGeometry} from './circularArcs';

const SCALE=100000;
export const yardToWorld=(f:YardFeature,p:PlanPoint):PlanPoint=>{const a=f.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return {x:f.xFt*12+c*p.x-s*p.y,y:f.zFt*12+s*p.x+c*p.y};};
export function yardWallPath(f:YardFeature):PlanPoint[]{return yardWallStationPath(f).points;}
/** Every top step is a real path vertex at its analytical arc-chain station.
 * Render tessellation cannot move a saved step along a circular arc. */
type WallStationRuntime=Pick<typeof import('./wallStationRuntime'),'yardWallStationPath'>;
let stationRuntime:WallStationRuntime|undefined,stationLoading:Promise<void>|undefined;
export const wallStationReady=()=>!!stationRuntime;
export function registerWallStationRuntime(value:WallStationRuntime){stationRuntime=value;}
export async function loadWallStationRuntime(){if(stationRuntime)return;stationLoading??=import('./wallStationRuntime').then(value=>{stationRuntime=value;},error=>{stationLoading=undefined;throw error;});await stationLoading;}
export function yardWallStationPath(f:YardFeature){
 if(f.wallTopSteps?.length){if(!stationRuntime)throw Error('Geometry is loading. Retry shortly.');return stationRuntime.yardWallStationPath(f);}
 const p=f.wallPath??[{x:-f.widthFt*6,y:0},{x:f.widthFt*6,y:0}],points:PlanPoint[]=[],stations:number[]=[];let station=0;
 for(let i=0;i+1<p.length;i++){const a=p[i],b=p[i+1],arc=f.curves?.find(c=>c.edge===i),samples=arc?sampleArc(a,b,arc.bulgeIn):[a,b],length=arc?arcGeometry(a,b,arc.bulgeIn).lengthIn:Math.hypot(b.x-a.x,b.y-a.y);samples.slice(0,-1).forEach((v,k)=>{points.push(yardToWorld(f,v));stations.push(station+length*k/(samples.length-1));});station+=length;}points.push(yardToWorld(f,p.at(-1)!));stations.push(station);return {points,stations,lengthIn:station};
}
export const pathRun=(points:PlanPoint[])=>points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
/** A physical constant-width wall about an open centreline, with bounded mitres. */
export function yardPathEnvelope(points:PlanPoint[],widthIn:number):PlanPoint[][]{
  if(points.length<2||!Number.isFinite(widthIn)||widthIn<=0)return [];
  const offset=new ClipperLib.ClipperOffset(4,.01*SCALE),out=[];
  offset.AddPath(points.map(p=>({X:Math.round(p.x*SCALE),Y:Math.round(p.y*SCALE)})),ClipperLib.JoinType.jtMiter,ClipperLib.EndType.etOpenButt);
  offset.Execute(out,widthIn*SCALE/2);
  return out.map(p=>p.map(v=>({x:v.X/SCALE,y:v.Y/SCALE})));
}
export function yardFeatureOutline(f:YardFeature):PlanPoint[][]{
 if(f.stepAssembly)return stepAssemblyFootprints(f);
  if(f.kind==='retaining-wall'&&f.wallPath)return yardPathEnvelope(yardWallPath(f),f.depthFt*12);
  const points=f.kind==='patio'&&f.outline?f.outline:[{x:-f.widthFt*6,y:-f.depthFt*6},{x:f.widthFt*6,y:-f.depthFt*6},{x:f.widthFt*6,y:f.depthFt*6},{x:-f.widthFt*6,y:f.depthFt*6}];
  return [tessellateArcs(points,f.kind==='patio'?f.curves:undefined,true).map(p=>yardToWorld(f,p))];
}
/** A strip behind the left side of a directed wall; old left-to-right walls retain +yard backfill. */
export function yardPathBackStrip(points:PlanPoint[],fromIn:number,toIn:number,miterLimit=4):PlanPoint[][]{
  const at=(i:number,offset:number)=>{const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
    const before=i?Math.hypot(p.x-a.x,p.y-a.y):Math.hypot(b.x-p.x,b.y-p.y),after=i<points.length-1?Math.hypot(b.x-p.x,b.y-p.y):before;
    const n0=i?{x:-(p.y-a.y)/before,y:(p.x-a.x)/before}:{x:-(b.y-p.y)/after,y:(b.x-p.x)/after};
    const n1=i<points.length-1?{x:-(b.y-p.y)/after,y:(b.x-p.x)/after}:n0,denom=1+n0.x*n1.x+n0.y*n1.y;
    const scale=Math.min(miterLimit,1/Math.max(1e-8,denom));return {x:p.x+(n0.x+n1.x)*offset*scale,y:p.y+(n0.y+n1.y)*offset*scale};
  };
  return points.slice(1).map((_,i)=>[at(i,fromIn),at(i+1,fromIn),at(i+1,toIn),at(i,toIn)]);
}
