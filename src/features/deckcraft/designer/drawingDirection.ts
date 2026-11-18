import type {PlanPoint} from '../lib/deckGeometry';
/** Hold the preview's bearing while changing length, without rounding diagonal angles. */
export function createDrawingDirection(){
 let origin:PlanPoint|undefined,last:PlanPoint|undefined,direction:PlanPoint|undefined;
 const release=()=>{direction=undefined;};
 const reset=()=>{origin=last=direction=undefined;};
 const point=(from:PlanPoint|undefined,to:PlanPoint,shift:boolean):PlanPoint=>{
  if(!from){reset();return to;}
  if(!origin||origin.x!==from.x||origin.y!==from.y){reset();origin={...from};}
  if(!shift){release();last={...to};return to;}
  if(!direction){const aim=last??to,dx=aim.x-from.x,dy=aim.y-from.y,length=Math.hypot(dx,dy);if(length<1e-7)return to;direction={x:dx/length,y:dy/length};}
  const length=(to.x-from.x)*direction.x+(to.y-from.y)*direction.y;
  return {x:from.x+length*direction.x,y:from.y+length*direction.y};
 };
 return {point,release,reset};
}
/** With Shift holding the bearing, snaps still count: the first point closes the outline (closing wins), and another
 * snap target sets the length along the held line instead of breaking it. */
export function lockedSnap(locked:PlanPoint,snap:(p:PlanPoint)=>{point:PlanPoint;closing:boolean;snapped?:boolean},along:(p:PlanPoint)=>PlanPoint){
 const hit=snap(locked);
 return hit.closing?{point:hit.point,closing:true}:{point:hit.snapped?along(hit.point):locked,closing:false};
}
