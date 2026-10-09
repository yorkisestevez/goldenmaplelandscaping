import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import type {PlanPoint} from './lib/deckGeometry';
import {yardFeatureOutline} from './yardPathGeometry';
import {stairFootprints} from './fireFeatureModel';
import {insidePolygon} from './lib/polygonCuts';

/** Patios, the wood deck and its stairs. A standing path light does not belong on any of them. */
export function pavingRings(data:DeckData,model?:Pick<DeckTakeoff,'levels'|'flights'|'treads'>):PlanPoint[][]{
 const patios=(data.yardFeatures??[]).filter(f=>f.enabled&&f.kind==='patio').flatMap(f=>{try{return yardFeatureOutline(f);}catch{return [];}});
 if(!model)return patios;
 const decks=model.levels.map(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z})));
 return [...patios,...decks,...stairFootprints(model)];
}
export const onPaving=(rings:PlanPoint[][],xIn:number,zIn:number)=>rings.some(ring=>ring.length>=3&&insidePolygon({x:xIn,y:zIn},ring));

/** Walk outward until the point leaves every paving ring. Null when the run stays on paving. */
export function shiftOffPaving(rings:PlanPoint[][],x:number,z:number,dirX:number,dirZ:number){
 const len=Math.hypot(dirX,dirZ)||1,ux=dirX/len,uz=dirZ/len;
 for(let d=0;d<=40*12;d+=12){const px=x+ux*d,pz=z+uz*d;if(!onPaving(rings,px,pz))return {x:px,z:pz};}
 return null;
}
