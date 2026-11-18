import type {DeckData} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import {getHouseContact} from '../houseContact';
import {getStairPlacement,type PlanPoint} from '../lib/deckGeometry';
import type {StairTarget} from './planEditMath';

/** Project the cursor onto the actual usable opening span, using the model's placement rules. */
export function stairDragPlacement(data:DeckData,model:DeckTakeoff,targets:StairTarget[],cursor:PlanPoint,depth:number){
 let best:{patch:Partial<DeckData>;centre:PlanPoint;polygon:PlanPoint[];name:string;distance:number}|null=null;
 for(const target of targets){
  const level=model.levels[target.level],next={...data,...target.patch,stairOffset:0};
  const placement=getStairPlacement(next,level.footprint,target.level===0?getHouseContact(next,level.footprint):undefined);
  if(!placement||placement.edgeIndex!==target.edge)continue;
  const {along,outward,width}=placement,a={x:placement.origin.x+level.offset.x,y:placement.origin.y+level.offset.z};
  const span=Math.max(0,Math.hypot(target.b.x-target.a.x,target.b.y-target.a.y)-width);
  const t=Math.max(0,Math.min(span,(cursor.x-a.x)*along.x+(cursor.y-a.y)*along.y-width/2));
  const centre={x:a.x+along.x*(t+width/2),y:a.y+along.y*(t+width/2)},distance=Math.hypot(cursor.x-centre.x,cursor.y-centre.y);
  if(best&&best.distance<=distance)continue;
  const start={x:a.x+along.x*t,y:a.y+along.y*t},end={x:start.x+along.x*width,y:start.y+along.y*width};
  best={patch:{...target.patch,stairOffset:span?t/span*100:50},centre,polygon:[start,end,{x:end.x+outward.x*depth,y:end.y+outward.y*depth},{x:start.x+outward.x*depth,y:start.y+outward.y*depth}],name:target.name,distance};
 }
 return best;
}
