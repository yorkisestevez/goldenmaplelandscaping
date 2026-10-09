import {cupFitsOutline,cupOutsideHole,puttingCupWorld,PUTTING_CUP_DIAMETER_IN} from './landscapeSurfaces';
import type {LandscapeObject,LandscapeAssetId,LandscapeKind,LandscapePoint,LandscapeSpeciesRecord} from './landscapeTypes';
export type {LandscapeObject,LandscapeAssetId,LandscapeKind,LandscapePoint,LandscapeSpeciesRecord} from './landscapeTypes';
import {LANDSCAPE_LIMITS} from './landscapeTypes';
import {validateLandscapeOutline,landscapeOutlinePaths} from './landscapeOutline';
const ASSETS:Record<LandscapeAssetId,LandscapeKind>={'deciduous-tree':'plant','conifer-tree':'plant','rounded-shrub':'plant','hedge-shrub':'plant','grass-clump':'plant','evergreen-shrub':'plant','pine-tree':'plant','hosta-clump':'plant','reed-grass':'plant','fern-clump':'plant','perennial-bloom':'plant','perennial-gold':'plant','natural-boulder':'boulder','outdoor-table':'furniture','outdoor-chair':'furniture','lounge-chair':'furniture','outdoor-sofa':'furniture','outdoor-coffee-table':'furniture','mulch-bed':'bed','black-mulch-bed':'bed','cedar-mulch-bed':'bed','river-rock-bed':'bed','mexican-beach-pebbles-bed':'bed','white-stone-bed':'bed','crushed-granite-bed':'bed','pea-gravel-bed':'bed','clear-limestone-bed':'bed','limestone-screenings-bed':'bed','granular-base-bed':'bed','artificial-grass':'bed','putting-green':'bed'};
const objectKeys=new Set(['id','name','enabled','kind','assetId','xIn','zIn','rotationDeg','heightIn','widthIn','depthIn','polygon','mulchDepthIn','edging','speciesRecord','supportFeatureId','surfaceDepthIn','baseDepthIn','puttingCups','outline','groundCoverOnly','holeEdging','fillSeed','raisedIn','edge']);
const speciesKeys=new Set(['id','commonName','botanicalName','matureHeightIn','matureSpreadIn','spacingIn','sourceURL','spacingSourceURL','sourceNote']);
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&!Object.getOwnPropertySymbols(v).length&&Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>d.enumerable&&'value'in d);
const list=(v:unknown,min:number,max:number):v is unknown[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&!Object.getOwnPropertySymbols(v).length&&v.length>=min&&v.length<=max&&Object.entries(Object.getOwnPropertyDescriptors(v)).every(([k,d])=>k==='length'||String(Number(k))===k&&Number(k)>=0&&Number(k)<v.length&&d.enumerable&&'value'in d)&&Array.from({length:v.length},(_,i)=>i).every(i=>Object.hasOwn(v,String(i)));
const text=(v:unknown,max=160):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v);
const number=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const url=(v:unknown)=>{if(!text(v,1000))return false;try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
const range=(v:unknown)=>list(v,2,2)&&number(v[0],1,4800)&&number(v[1],v[0],4800);
export function validateLandscapeSpecies(v:unknown):v is LandscapeSpeciesRecord {
 return record(v)&&Object.keys(v).every(k=>speciesKeys.has(k))&&text(v.id,80)&&text(v.commonName)&&text(v.botanicalName)&&range(v.matureHeightIn)&&range(v.matureSpreadIn)&&url(v.sourceURL)&&(v.sourceNote===undefined||text(v.sourceNote,500))&&(v.spacingIn===undefined||(number(v.spacingIn,1,4800)&&url(v.spacingSourceURL)))&&(v.spacingSourceURL===undefined||url(v.spacingSourceURL));
}
const area=(p:LandscapePoint[])=>p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a.x*b.z-b.x*a.z;},0)/2;
const cross=(a:LandscapePoint,b:LandscapePoint,c:LandscapePoint)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
const on=(a:LandscapePoint,b:LandscapePoint,p:LandscapePoint)=>Math.abs(cross(a,b,p))<1e-7&&p.x>=Math.min(a.x,b.x)-1e-7&&p.x<=Math.max(a.x,b.x)+1e-7&&p.z>=Math.min(a.z,b.z)-1e-7&&p.z<=Math.max(a.z,b.z)+1e-7;
function intersects(a:LandscapePoint,b:LandscapePoint,c:LandscapePoint,d:LandscapePoint){return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);}
export function validLandscapePolygon(v:unknown):v is LandscapePoint[]{
 if(!list(v,3,LANDSCAPE_LIMITS.polygonPoints)||!v.every(p=>record(p)&&Object.keys(p).every(k=>k==='x'||k==='z')&&number(p.x,-LANDSCAPE_LIMITS.coordinateIn,LANDSCAPE_LIMITS.coordinateIn)&&number(p.z,-LANDSCAPE_LIMITS.coordinateIn,LANDSCAPE_LIMITS.coordinateIn)))return false;
 const p=v as LandscapePoint[];if(Math.abs(area(p))<1)return false;
 for(let i=0;i<p.length;i++){if(Math.hypot(p[i].x-p[(i+1)%p.length].x,p[i].z-p[(i+1)%p.length].z)<.01)return false;for(let j=i+1;j<p.length;j++){if(j===i+1||i===0&&j===p.length-1)continue;if(intersects(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length]))return false;}}
 return true;
}
/** Strict import/API validator. Undefined means a legacy design with no objects. */
export function validateLandscapeObjects(v:unknown):v is LandscapeObject[]{
 if(!list(v,0,LANDSCAPE_LIMITS.objects))return false;
 const ids=new Set<string>();return v.every(o=>{
  if(!record(o)||!Object.keys(o).every(k=>objectKeys.has(k))||!text(o.id,80)||ids.has(o.id)||!text(o.name)||typeof o.enabled!=='boolean'||typeof o.assetId!=='string'||!(o.assetId in ASSETS)||ASSETS[o.assetId as LandscapeAssetId]!==o.kind)return false;ids.add(o.id);
  if(o.supportFeatureId!==undefined&&(o.kind!=='furniture'||!text(o.supportFeatureId,80)))return false;
  if(!number(o.xIn,-LANDSCAPE_LIMITS.coordinateIn,LANDSCAPE_LIMITS.coordinateIn)||!number(o.zIn,-LANDSCAPE_LIMITS.coordinateIn,LANDSCAPE_LIMITS.coordinateIn)||!number(o.rotationDeg,-360,360)||!['heightIn','widthIn','depthIn'].every(k=>number(o[k],.1,LANDSCAPE_LIMITS.dimensionIn)))return false;
  if(o.fillSeed!==undefined&&(!o.outline||!record(o.fillSeed)||Object.keys(o.fillSeed).length!==2||!number(o.fillSeed.x,-2400,2400)||!number(o.fillSeed.z,-2400,2400)))return false;
  if(o.outline!==undefined&&(o.kind!=='bed'||o.polygon!==undefined||!validateLandscapeOutline(o.outline)))return false;
  if(['groundCoverOnly','holeEdging'].some(k=>o[k]!==undefined&&(o.kind!=='bed'||typeof o[k]!=='boolean')))return false;
  if(o.kind==='bed'){if(o.polygon!==undefined&&!validLandscapePolygon(o.polygon)||!number(o.mulchDepthIn??0,0,12)||o.edging!==undefined&&typeof o.edging!=='boolean'||o.speciesRecord!==undefined)return false;}
  else if(o.polygon!==undefined||o.mulchDepthIn!==undefined||o.edging!==undefined||o.surfaceDepthIn!==undefined||o.baseDepthIn!==undefined||o.puttingCups!==undefined)return false;
  if(o.surfaceDepthIn!==undefined&&!number(o.surfaceDepthIn,0,12)||o.baseDepthIn!==undefined&&!number(o.baseDepthIn,0,48))return false;
  if(o.raisedIn!==undefined&&(o.kind!=='bed'||!number(o.raisedIn,0,36)))return false;
  if(o.edge!==undefined){const e=o.edge;if(o.raisedIn===undefined||!record(e)||!Object.keys(e).every(k=>k==='kind'||k==='wallFeatureId')||!['wall','timber','steel'].includes(e.kind as string)||e.wallFeatureId!==undefined&&(e.kind!=='wall'||!text(e.wallFeatureId,80)))return false;}
  if(o.puttingCups!==undefined){if(o.assetId!=='putting-green'||!list(o.puttingCups,0,9))return false;const bed=o as unknown as LandscapeObject,paths=landscapeOutlinePaths(bed),outline=paths[0];const cups=o.puttingCups;if(!cups.every(p=>record(p)&&Object.keys(p).every(k=>k==='x'||k==='z')&&number(p.x,-2400,2400)&&number(p.z,-2400,2400)&&cupFitsOutline(puttingCupWorld(bed,p as unknown as LandscapePoint),outline)&&paths.slice(1).every(h=>cupOutsideHole(puttingCupWorld(bed,p as unknown as LandscapePoint),h))))return false;if(cups.some((a,i)=>cups.some((b,j)=>i!==j&&Math.hypot((a as LandscapePoint).x-(b as LandscapePoint).x,(a as LandscapePoint).z-(b as LandscapePoint).z)<PUTTING_CUP_DIAMETER_IN)))return false;}
  return o.speciesRecord===undefined||o.kind==='plant'&&validateLandscapeSpecies(o.speciesRecord);
 });
}

import {registerLandscapeTypesRuntime} from './landscapeTypes';
registerLandscapeTypesRuntime({validateLandscapeSpecies,validLandscapePolygon,validateLandscapeObjects});
