import type {PlanPoint} from '../lib/deckGeometry';
/** Snap in screen-sized tolerance; closing the current outline takes priority. */
export function drawingSnap(raw:PlanPoint,points:PlanPoint[],targets:PlanPoint[],closed:boolean,reach:number){
 const distance=(p:PlanPoint)=>Math.hypot(raw.x-p.x,raw.y-p.y);
 if(closed&&points.length>=3&&distance(points[0])<=reach)return {point:points[0],closing:true};
 const hit=targets.reduce<PlanPoint|undefined>((best,p)=>distance(p)<=reach&&(!best||distance(p)<distance(best))?p:best,undefined);
 return {point:hit??raw,closing:false,snapped:!!hit};
}
/** Deck corners and the house's corners in plan coordinates, so patios and walls can be drawn tight against them. */
export function siteSnapPoints(levels:{footprint:{outline:PlanPoint[]};offset:{x:number;z:number}}[],house:PlanPoint[][]=[]){
 return [...levels.flatMap(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))),...house.flat()];
}
