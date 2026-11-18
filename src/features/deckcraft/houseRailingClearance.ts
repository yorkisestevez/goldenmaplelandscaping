import type {DeckData,HouseOpening} from './types';
import type {DeckTakeoff,V3,Member} from './deckTakeoff';
import {getHouseConfig} from './houseSettings';
import {clampHouseOpening} from './houseSettings';
import {getHouseWalls,openingHidden,openingWallId,type HouseWallPlan} from './houseFootprint';

/** Finds actual railing volumes crossing a visible window/door and its trim.
 * Measured house openings remain where saved; a collision needs a design decision. */
export function houseRailingConflicts(data:DeckData,model:DeckTakeoff){
  if(data.houseVisible===false||data.railingType==='None')return [];
  const house=getHouseConfig(data),walls=getHouseWalls(data);
  const members:{a:V3;b:V3;planRadius:number;verticalRadius:number}[]=[
    ...[...model.railing.rails,...model.railing.balusters,...model.railing.glass].map((m:Member)=>({a:m.a,b:m.b,planRadius:m.width/2,verticalRadius:m.depth/2})),
    ...model.railing.posts.map(p=>({a:p,b:{...p,y:p.y+model.railing.height},planRadius:2.75,verticalRadius:0})),
  ];
  function intersects(o:HouseOpening,w:HouseWallPlan,m:typeof members[number]){
    const ux=(w.b.x-w.a.x)/w.lengthIn,uz=(w.b.y-w.a.y)/w.lengthIn;
    const local=(p:V3)=>[(p.x-w.a.x)*ux+(p.z-w.a.y)*uz,(p.x-w.a.x)*w.outward.x+(p.z-w.a.y)*w.outward.y,p.y];
    const a=local(m.a),b=local(m.b),center=w.lengthIn*o.offsetPct/100;
    const bounds=[[center-o.widthIn/2-3-m.planRadius,center+o.widthIn/2+3+m.planRadius],[-3-m.planRadius,3+m.planRadius],[o.bottomIn-3-m.verticalRadius,o.bottomIn+o.heightIn+3+m.verticalRadius]];
    let lo=0,hi=1;for(let i=0;i<3;i++){const delta=b[i]-a[i],[min,max]=bounds[i];if(Math.abs(delta)<1e-8){if(a[i]<min||a[i]>max)return false;}else{const x=(min-a[i])/delta,y=(max-a[i])/delta;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));if(lo>hi)return false;}}return true;
  }
  return house.openings.filter(o=>!openingHidden(o,walls,house)).flatMap(opening=>{
    const wall=walls.find(w=>w.id===openingWallId(opening,house));if(!wall)return [];
    const displayed=clampHouseOpening(opening,house);
    return members.some(m=>intersects(displayed,wall,m))?[{openingId:opening.id,wallId:wall.id,message:`The railing crosses ${opening.type.toLowerCase()} ${opening.id} or its trim on the ${wall.side} house wall. Confirm the measured opening and railing connection; move the opening in the house editor only if it matches the real house.`}]:[];
  });
}

/** Openings are appearance-only edits; refresh these warnings even when the priced takeoff is cached. */
export function houseRailingReviewFlags(data:DeckData,model:DeckTakeoff,cachedFlags:string[]){
  return [...cachedFlags.filter(f=>!f.startsWith('The railing crosses ')),...houseRailingConflicts(data,model).map(c=>c.message)];
}
