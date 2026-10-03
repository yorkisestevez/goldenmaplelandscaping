import type {DeckData} from './types';
import type {LandscapePoint} from './landscapeTypes';
import {buildDeckTakeoff} from './deckTakeoff';
import {buildYardModel} from './yardModel';
import {getHouseBlocks} from './houseFootprint';
import {getPoolModels} from './poolModel';
import {localPolygonClip} from './lib/localPolygonClip';
import {insideLandscapeRing,landscapeSignedArea} from './landscapeOutline';
const cached=new WeakMap<DeckData,LandscapePoint[][]>();
/** Permanent physical footprints only: excavation working clearances never remove cover. */
export function landscapeStructureExclusions(data:DeckData):LandscapePoint[][]{
 const old=cached.get(data);if(old)return old;
 const deck=buildDeckTakeoff(data),yard=buildYardModel(data,deck),polys=[...yard.features.filter(f=>f.config.enabled&&!f.excluded).flatMap(f=>f.footprints),...getPoolModels(data,deck).flatMap(p=>p.permanentExclusionFootprints),...deck.treads.map(t=>t.polygon??(()=>{const a=t.angle??0,c=Math.cos(a),s=Math.sin(a);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>({x:t.x+c*x*t.w/2+s*z*t.d/2,y:t.z-s*x*t.w/2+c*z*t.d/2}));})()),...deck.levels.map(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))),...(data.houseVisible!==false?getHouseBlocks(data).map(b=>[{x:b.rect.x0,y:b.rect.y0},{x:b.rect.x1,y:b.rect.y0},{x:b.rect.x1,y:b.rect.y1},{x:b.rect.x0,y:b.rect.y1}]):[])];
 const result=polys.map(p=>{const q=p.map(v=>({x:v.x,z:v.y}));if(landscapeSignedArea(q)<0)q.reverse();return q;});cached.set(data,result);return result;
}
export function landscapeClip(subject:LandscapePoint[][],clip:LandscapePoint[][],operation:'union'|'difference'|'intersection'){
 return localPolygonClip(subject.map(p=>p.map(v=>({x:v.x,y:v.z}))),clip.map(p=>p.map(v=>({x:v.x,y:v.z}))),operation,1000).map(p=>p.map(v=>({x:v.x,z:v.y})));
}
export function landscapeConnected(paths:LandscapePoint[][],seed:LandscapePoint,allowCoveredSeed=false){
 const outer=paths.filter(p=>landscapeSignedArea(p)>0&&insideLandscapeRing(seed,p)).sort((a,b)=>Math.abs(landscapeSignedArea(a))-Math.abs(landscapeSignedArea(b)))[0];
 if(!outer||!allowCoveredSeed&&paths.some(p=>landscapeSignedArea(p)<0&&insideLandscapeRing(seed,p)))return [];
 return [outer,...paths.filter(p=>landscapeSignedArea(p)<0&&insideLandscapeRing(p[0],outer))];
}
