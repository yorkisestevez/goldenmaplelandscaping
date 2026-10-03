import type {PlanPoint} from './lib/deckGeometry';
import type {SitePlane} from './siteSurface';
import {poolClip} from './poolGeometry';
import {yardSolidCells} from './yardModel';
import {abovePlane,subtractPlanes,planeVolume,planeAt} from './yardElevationGeometry';
export type Prism={polygon:PlanPoint[];topPlane:SitePlane;bottomPlane:SitePlane};
export const prismVolume=(s:Prism)=>Math.max(0,planeVolume(s.polygon,subtractPlanes(s.topPlane,s.bottomPlane)))/46656;
export function prismPart(polygon:PlanPoint[],topPlane:SitePlane,bottomPlane:SitePlane):Prism[]{const p=abovePlane(polygon,subtractPlanes(topPlane,bottomPlane));return p.length&&prismVolume({polygon:p,topPlane,bottomPlane})>1e-10?[{polygon:p,topPlane,bottomPlane}]:[];}
export function subtractPrism(input:Prism[],cut:Prism):Prism[]{return subtractBand(input,[cut.polygon],cut.topPlane,cut.bottomPlane);}
export function subtractBand(input:Prism[],mask:PlanPoint[][],topPlane:SitePlane,bottomPlane:SitePlane):Prism[]{const cut={topPlane,bottomPlane};return input.flatMap(s=>{const overlap=poolClip([s.polygon],mask,'intersection');if(!overlap.length)return [s];const out:Prism[]=yardSolidCells(poolClip([s.polygon],mask,'difference')).map(polygon=>({...s,polygon}));for(const polygon of yardSolidCells(overlap)){
 // Below the cut: choose the lesser top. Above the cut: choose the greater bottom.
 const lo=subtractPlanes(s.topPlane,cut.bottomPlane),hi=subtractPlanes(s.bottomPlane,cut.topPlane);
 out.push(...prismPart(abovePlane(polygon,{x:-lo.x,z:-lo.z,constant:-lo.constant}),s.topPlane,s.bottomPlane));if(!polygon.every(v=>Math.abs(planeAt(lo,v.x,v.y))<1e-8))out.push(...prismPart(abovePlane(polygon,lo),cut.bottomPlane,s.bottomPlane));out.push(...prismPart(abovePlane(polygon,hi),s.topPlane,s.bottomPlane));if(!polygon.every(v=>Math.abs(planeAt(hi,v.x,v.y))<1e-8))out.push(...prismPart(abovePlane(polygon,{x:-hi.x,z:-hi.z,constant:-hi.constant}),s.topPlane,cut.topPlane));
 }return out;});}
export function lowerPrisms(input:Prism[],mask:PlanPoint[][],plane:SitePlane):Prism[]{return input.flatMap(s=>{const overlap=poolClip([s.polygon],mask,'intersection');if(!overlap.length)return [s];const out=yardSolidCells(poolClip([s.polygon],mask,'difference')).map(polygon=>({...s,polygon}));for(const polygon of yardSolidCells(overlap)){const d=subtractPlanes(s.topPlane,plane);out.push(...prismPart(abovePlane(polygon,d),plane,s.bottomPlane));if(!polygon.every(v=>Math.abs(planeAt(d,v.x,v.y))<1e-8))out.push(...prismPart(abovePlane(polygon,{x:-d.x,z:-d.z,constant:-d.constant}),s.topPlane,s.bottomPlane));}return out;});}
