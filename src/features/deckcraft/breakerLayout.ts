import type {DeckData} from './types';
import type {DeckLevel,Member} from './deckTakeoff';
import {installationFamily} from './installationSystem';

export interface BreakerAssembly {
  id:string;
  x:number; // Level-local inches; world members include level offset.
  reason:'stock-length'|'requested-center';
  jointGapIn:number;
  supportStyle:'ladder';
  sourceUrl:string;
  status:'connection-review';
}
export function breakerJointGap(data:DeckData,fallback:number):number {
  const family=installationFamily(data.deckingMaterial);
  // Current PVC guide distinguishes end/divider joints from side gaps.
  if(family==='tt-pvc')return 0;
  if(family==='tt-composite'&&data.installation?.temperatureC!==undefined){
    const f=data.installation.temperatureC*9/5+32;
    // The guide prints whole-Fahrenheit bands. Fractional transition readings
    // retain the larger adjacent gap as a planning assumption, pending review.
    if(f<33)return 3/16;
    if(f<75)return 1/8;
    if(f>=75)return 1/32;
  }
  return fallback; // Explicit planning assumption; never a compliance result.
}
export function breakerStations(left:number,width:number,boardWidth:number,gap:number,stock:number,center:boolean):number[]{
  const zone=boardWidth+2*gap;
  let count=0;
  while((width-count*zone)/(count+1)>stock+1e-6)count++;
  if(center){count=Math.max(1,count);if(count%2===0)count++;}
  if(width<=zone||count===0)return [];
  const segment=(width-count*zone)/(count+1);
  return Array.from({length:count},(_,i)=>left+(i+1)*segment+i*zone+gap+boardWidth/2);
}

/** Ladder rungs bear the divider transversely; outer joists bear field-board ends.
 * This models bearing geometry, not connector capacity or an engineered assembly.
 * Rungs at each actual divider end take priority over intermediate rungs.
 */
export function addBreakerLadders(level:DeckLevel,boardWidth:number,spacing:number):void {
  for(const assembly of level.breakerAssemblies??[]){
    const x=assembly.x+level.offset.x, half=boardWidth/2+assembly.jointGapIn;
    const left=x-half-.75,right=x+half+.75;
    const pieces=level.boards.filter(b=>['breaker','inlay'].includes(b.role??'')&&Math.abs(b.cx-assembly.x)<.01);
    const intervals=pieces.map(b=>[b.cy-b.length/2+level.offset.z,b.cy+b.length/2+level.offset.z] as const);
    const stations:number[]=[];
    const add=(z:number)=>{if(!stations.some(s=>Math.abs(s-z)<1.5-.001))stations.push(z);};
    for(const [a,b]of intervals){add(a+.75);add(b-.75);}
    for(const [a,b]of intervals)for(let z=a+.75+spacing;z<b-.75;z+=spacing)add(z);
    for(const z of stations.sort((a,b)=>a-b)){
      const l=level.joists.find(j=>Math.abs(j.a.x-left)<.01&&z>=j.a.z&&z<=j.b.z);
      const r=level.joists.find(j=>Math.abs(j.a.x-right)<.01&&z>=j.a.z&&z<=j.b.z);
      if(!l||!r)continue; // Clipped/notched edge: retain the review hold instead of floating a rung.
      const member:Member={a:{x:left+.75,y:l.a.y,z},b:{x:right-.75,y:r.a.y,z},width:1.5,depth:l.depth,role:'breaker-ladder',assemblyId:assembly.id};
      level.blocking.push(member);
    }
  }
}
