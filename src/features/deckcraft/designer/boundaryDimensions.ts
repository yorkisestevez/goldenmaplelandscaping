import type {BoundaryEdgeLock,DeckData} from '../types';
import type {PlanPoint} from '../lib/deckGeometry';
import {validateBoundaryLocks} from './boundaryLocks';
// The saved-lock validator ships with the first estimate (design loading); these editing helpers load with the editors.
export {validateBoundaryLocks} from './boundaryLocks';

const TOL=1e-6;
const pointSame=(a:PlanPoint,b:PlanPoint)=>Math.abs(a.x-b.x)<=TOL&&Math.abs(a.y-b.y)<=TOL;
/** Same topology preserves indices/vectors. Topology changes can only reindex edges with both endpoints unchanged. */
export function reconcileBoundaryLocks(data:DeckData,level:1|2|3,beforePoints:PlanPoint[],afterPoints:PlanPoint[]):BoundaryEdgeLock[]|null {
  let locks:BoundaryEdgeLock[];try{locks=validateBoundaryLocks(data.boundaryLocks??[],data);}catch{return null;}
  if(![1,2,3].includes(level)||beforePoints.length<3||afterPoints.length<3||afterPoints.length>64||[...beforePoints,...afterPoints].some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
  const result:BoundaryEdgeLock[]=[];
  for(const lock of locks){
    if(lock.level!==level){result.push({...lock});continue;}
    const a=beforePoints[lock.edge],b=beforePoints[(lock.edge+1)%beforePoints.length];if(!a||!b||Math.abs(b.x-a.x-lock.dxIn)>TOL||Math.abs(b.y-a.y-lock.dyIn)>TOL)return null;
    let edge=lock.edge;
    if(beforePoints.length!==afterPoints.length){const matches=afterPoints.flatMap((p,i)=>pointSame(p,a)&&pointSame(afterPoints[(i+1)%afterPoints.length],b)?[i]:[]);if(matches.length!==1)return null;edge=matches[0];}
    const from=afterPoints[edge],to=afterPoints[(edge+1)%afterPoints.length];
    if(!from||!to||Math.abs(to.x-from.x-lock.dxIn)>TOL||Math.abs(to.y-from.y-lock.dyIn)>TOL)return null;
    result.push({...lock,edge});
  }
  return result;
}
/** Start stays fixed; only the next endpoint moves. Adjacent edges change and caller validates crossings/locks. */
export function setBoundaryDimension(points:PlanPoint[],index:number,lengthIn:number,angleDeg?:number):PlanPoint[]{
  if(points.length<3||!Number.isInteger(index)||index<0||index>=points.length||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new Error('Choose an existing boundary edge.');
  if(!Number.isFinite(lengthIn)||lengthIn<=0||lengthIn>2400)throw new Error('Enter a positive edge length no greater than 200 feet.');
  if(angleDeg!==undefined&&(!Number.isFinite(angleDeg)||Math.abs(angleDeg)>360))throw new Error('Enter an edge angle between -360 and 360 degrees.');
  const start=points[index],end=points[(index+1)%points.length],angle=angleDeg===undefined?Math.atan2(end.y-start.y,end.x-start.x):angleDeg*Math.PI/180,dx=Math.cos(angle)*lengthIn,dy=Math.sin(angle)*lengthIn;
  return points.map((p,i)=>i===(index+1)%points.length?{x:start.x+(Math.abs(dx)<TOL?0:dx),y:start.y+(Math.abs(dy)<TOL?0:dy)}:{...p});
}
const quantity=(text:string):number=>{
  const t=text.trim().replace(/(\d)\s*-\s*(\d+\s*\/\s*\d+)$/,'$1 $2'),fraction=t.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
  if(fraction){const whole=Number(fraction[1]??0),n=Number(fraction[2]),d=Number(fraction[3]);if(!d||n>=d)throw new Error('Use a proper inch/foot fraction such as 1/2 or 5 1/2.');return whole+n/d;}
  if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(t))throw new Error('Use decimal feet or feet/inches, for example 16.5 or 16\' 5 1/2".');return Number(t);
};
/** Bare numbers are feet. Explicit inches and customary mixed/fractional feet-and-inches are accepted. */
export function parseContractorLength(text:string):number {
  if(typeof text!=='string'||!text.trim()||text.length>100)throw new Error('Enter a length in feet or feet and inches.');
  const t=text.trim().toLowerCase().replace(/[′’]/g,"'").replace(/[″“”]/g,'"').replace(/feet|foot/g,'ft').replace(/inches|inch/g,'in');
  const feet=t.match(/^(.+?)\s*(?:ft|')\s*(?:-\s*)?(.*?)$/),inches=t.match(/^(.+?)\s*(?:in|")$/);
  let value:number;
  if(feet){if(/(?:ft|')\s*-\s*$/.test(t))throw new Error('Enter the inch part after the feet separator.');const f=quantity(feet[1]),rest=feet[2].trim();let i=0;if(rest){const suffix=rest.match(/^(.+?)\s*(?:in|")$/);if(!suffix)throw new Error('Mark the inch part with in or ".');i=quantity(suffix[1]);if(i>=12)throw new Error('Keep the inch part below 12; carry extra inches into feet.');}value=f*12+i;}
  else value=inches?quantity(inches[1]):quantity(t)*12;
  if(!Number.isFinite(value)||value<=0)throw new Error('Edge length must be greater than zero.');return value;
}
