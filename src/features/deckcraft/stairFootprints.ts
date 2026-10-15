import type {DeckTakeoff} from './deckTakeoff';
import type {PlanPoint} from './lib/deckGeometry';
import {yardSignedArea} from './yardModel';

/** A stair flight's plan footprint, world inches: from its top to its foot at its width (a tapered foot at endWidth). */
export function flightFootprint(f:DeckTakeoff['flights'][number]):PlanPoint[]{
 const dx=f.end.x-f.start.x,dz=f.end.z-f.start.z,len=Math.hypot(dx,dz)||1,a=f.along??{x:-dz/len,y:dx/len},w=(f.width||36)/2,we=(f.endWidth??f.width??36)/2;
 return [{x:f.start.x-a.x*w,y:f.start.z-a.y*w},{x:f.start.x+a.x*w,y:f.start.z+a.y*w},{x:f.end.x+a.x*we,y:f.end.z+a.y*we},{x:f.end.x-a.x*we,y:f.end.z-a.y*we}];
}
/** A tread's plan footprint, world inches (its own polygon for winders and path treads), as the site plan draws it. */
export function treadFootprint(t:DeckTakeoff['treads'][number]):PlanPoint[]{
 const angle=-(t.angle||0);
 return t.polygon??[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:t.x+(u*t.w/2)*Math.cos(angle)-(v*t.d/2)*Math.sin(angle),y:t.z+(u*t.w/2)*Math.sin(angle)+(v*t.d/2)*Math.cos(angle)}));
}
const validRing=(r:PlanPoint[])=>r.length>=3&&r.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))&&Math.abs(yardSignedArea(r))>1e-6;
/** Every stair of the deck in plan: each flight and each tread. Wood stairs are structures for the fire clearances
 * (FIRE_CLEARANCE: 4 m for a wood ring, 48 in for gas), and nothing may stand on them. */
export function stairFootprints(model:Pick<DeckTakeoff,'flights'|'treads'>|undefined):PlanPoint[][]{
 return model?[...model.flights.map(flightFootprint),...model.treads.map(treadFootprint)].filter(validRing):[];
}
