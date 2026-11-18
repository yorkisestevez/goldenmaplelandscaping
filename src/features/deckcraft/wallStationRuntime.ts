import type {YardFeature} from './types';
import type {PlanPoint} from './lib/deckGeometry';
import {sampleArc,arcGeometry} from './circularArcs';
import {yardToWorld,registerWallStationRuntime} from './yardPathGeometry';
export function yardWallStationPath(f:YardFeature){
 const controls=f.wallPath??[{x:-f.widthFt*6,y:0},{x:f.widthFt*6,y:0}],points:PlanPoint[]=[],stations:number[]=[];let station=0;
 for(let edge=0;edge+1<controls.length;edge++){
  const a=controls[edge],b=controls[edge+1],arc=f.curves?.find(v=>v.edge===edge),samples=arc?sampleArc(a,b,arc.bulgeIn):[a,b],length=arc?arcGeometry(a,b,arc.bulgeIn).lengthIn:Math.hypot(b.x-a.x,b.y-a.y),fractions=[...samples.slice(0,-1).map((_,i)=>i/(samples.length-1)),...(f.wallTopSteps??[]).filter(v=>v.stationIn>station+1e-7&&v.stationIn<station+length-1e-7).map(v=>(v.stationIn-station)/length)].sort((a,b)=>a-b);
  for(const t of fractions){let p:PlanPoint;
   if(!arc)p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
   else{const chord=Math.hypot(b.x-a.x,b.y-a.y),r=Math.sign(arc.bulgeIn)*arcGeometry(a,b,arc.bulgeIn).radius,alpha=2*Math.atan2(2*arc.bulgeIn,chord),v=alpha*(2*t-1),along=chord/2+r*Math.sin(v),across=arc.bulgeIn-2*r*Math.sin(v/2)**2,ux=(b.x-a.x)/chord,uy=(b.y-a.y)/chord;p={x:a.x+ux*along-uy*across,y:a.y+uy*along+ux*across};}
   points.push(yardToWorld(f,p));stations.push(station+t*length);
  }station+=length;
 }points.push(yardToWorld(f,controls.at(-1)!));stations.push(station);return {points,stations,lengthIn:station};
}

registerWallStationRuntime({yardWallStationPath});
