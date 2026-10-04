import type {PlanPoint} from '../lib/deckGeometry';
/** Snap in screen-sized tolerance; closing the current outline takes priority. */
export function drawingSnap(raw:PlanPoint,points:PlanPoint[],targets:PlanPoint[],closed:boolean,reach:number){
 const distance=(p:PlanPoint)=>Math.hypot(raw.x-p.x,raw.y-p.y);
 if(closed&&points.length>=3&&distance(points[0])<=reach)return {point:points[0],closing:true};
 const hit=targets.reduce<PlanPoint|undefined>((best,p)=>distance(p)<=reach&&(!best||distance(p)<distance(best))?p:best,undefined);
 return {point:hit??raw,closing:false,snapped:!!hit};
}
