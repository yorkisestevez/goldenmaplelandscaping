import type {BoundaryEdgeLock,DeckData} from '../types';
import type {PlanPoint} from '../lib/deckGeometry';

const TOL=1e-6;
const pointSame=(a:PlanPoint,b:PlanPoint)=>Math.abs(a.x-b.x)<=TOL&&Math.abs(a.y-b.y)<=TOL;
const key=(level:1|2|3)=>level===1?'main':level===2?'second':'third';
function strict(value:unknown,keys:string[],array=false):void {
  if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==(array?Array.prototype:Object.prototype)&&!( !array&&Object.getPrototypeOf(value)===null)||Array.isArray(value)!==array||Object.getOwnPropertySymbols(value).length)throw new Error('Boundary locks must contain plain data only.');
  for(const [k,d] of Object.entries(Object.getOwnPropertyDescriptors(value)))if(!keys.includes(k)||!('value' in d)||k!=='length'&&!d.enumerable)throw new Error(`Unknown or unsafe boundary lock field: ${k}.`);
}
/** A lock is an exact directed edge vector on a saved editable outline, never an inferred constraint. */
export function validateBoundaryLocks(input:unknown,data:DeckData):BoundaryEdgeLock[]{
  if(!Array.isArray(input)||input.length>192)throw new Error('Keep no more than 192 saved edge locks.');
  strict(input,['length',...Array.from({length:input.length},(_,i)=>String(i))],true);
  const used=new Set<string>();
  return Array.from({length:input.length},(_,i)=>{
    if(!Object.hasOwn(input,i))throw new Error('Boundary locks cannot have missing items.');
    const value=input[i];strict(value,['level','edge','dxIn','dyIn']);const lock=value as BoundaryEdgeLock;
    if(![1,2,3].includes(lock.level)||!Number.isInteger(lock.edge)||!Number.isFinite(lock.dxIn)||!Number.isFinite(lock.dyIn))throw new Error('A boundary lock needs a valid level, edge and finite inch vector.');
    if(lock.level>data.levels||lock.level===3&&!data.level3)throw new Error(`Level ${lock.level} is not active. Unlock its edges before removing the level.`);
    const points=data.deckOutlines?.[key(lock.level)],id=`${lock.level}:${lock.edge}`;
    if(!points||points.length<3)throw new Error(`Save level ${lock.level}'s editable outline before locking an edge.`);
    if(lock.edge<0||lock.edge>=points.length||used.has(id))throw new Error('Choose an existing edge once per level.');used.add(id);
    const a=points[lock.edge],b=points[(lock.edge+1)%points.length],dx=(b.x-a.x)*12,dy=(b.y-a.y)*12;
    if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.hypot(dx,dy)<=TOL||Math.hypot(lock.dxIn,lock.dyIn)<=TOL||Math.abs(lock.dxIn-dx)>TOL||Math.abs(lock.dyIn-dy)>TOL)throw new Error(`Level ${lock.level}, edge ${lock.edge+1}: the saved lock must match this edge's length and direction.`);
    return {level:lock.level,edge:lock.edge,dxIn:lock.dxIn,dyIn:lock.dyIn};
  });
}
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
