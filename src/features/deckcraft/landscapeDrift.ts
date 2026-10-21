import type {LandscapeObject} from './landscapeTypes';
import {newLandscapePlant} from './landscapeCatalogue';

/** A planting drift saved on ONE bed: the renderer scatters many plants inside the bed outline (seeded, so it is
 * stable), grouped in drifts of one species the way designers plant masses. Drift plants are visual only: they are
 * not saved objects, so they do not count against the 300-object limit or the design-link size. */
export interface BedDrift {species:string[];spacingIn:number;seed:number}
export const DRIFT_LIMITS={species:8,minSpacingIn:12,maxSpacingIn:120,maxPlants:900};
export function validDrift(v:unknown):v is BedDrift{
 if(!v||typeof v!=='object')return false;const d=v as Record<string,unknown>;
 return Object.keys(d).every(k=>k==='species'||k==='spacingIn'||k==='seed')&&Array.isArray(d.species)&&d.species.length>=1&&d.species.length<=DRIFT_LIMITS.species&&d.species.every(s=>typeof s==='string'&&s.length<=80)
  &&typeof d.spacingIn==='number'&&d.spacingIn>=DRIFT_LIMITS.minSpacingIn&&d.spacingIn<=DRIFT_LIMITS.maxSpacingIn&&Number.isInteger(d.seed)&&(d.seed as number)>=0&&(d.seed as number)<2**31;
}
const rnd=(seed:number)=>{let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};};
const inside=(p:{x:number;z:number},ring:{x:number;z:number}[])=>{let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)c=!c;}return c;};
const edgeDist=(p:{x:number;z:number},ring:{x:number;z:number}[])=>{let d=Infinity;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i],vx=b.x-a.x,vz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*vx+(p.z-a.z)*vz)/(vx*vx+vz*vz||1)));d=Math.min(d,Math.hypot(p.x-a.x-t*vx,p.z-a.z-t*vz));}return d;};
function bedRing(o:LandscapeObject){
 if(o.polygon?.length)return o.polygon.map(p=>({x:p.x,z:p.z}));
 const w=o.widthIn/2,d=o.depthIn/2;return [{x:o.xIn-w,z:o.zIn-d},{x:o.xIn+w,z:o.zIn-d},{x:o.xIn+w,z:o.zIn+d},{x:o.xIn-w,z:o.zIn+d}];
}
const cache=new WeakMap<LandscapeObject,LandscapeObject[]>();
/** Drift plants for one bed. Species come in soft-edged groups (a low-frequency pattern), heights vary ±20%. */
export function driftPlants(bed:LandscapeObject):LandscapeObject[]{
 const d=(bed as LandscapeObject&{drift?:BedDrift}).drift;if(!d||!validDrift(d))return [];
 const hit=cache.get(bed);if(hit)return hit;
 const ring=bedRing(bed),r=rnd(d.seed),xs=ring.map(p=>p.x),zs=ring.map(p=>p.z),s=d.spacingIn,out:LandscapeObject[]=[];
 const x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);
 const ph=[r()*6.28,r()*6.28,r()*6.28],cell=Math.max(48,s*4);
 let row=0;
 for(let z=z0+s/2;z<z1&&out.length<DRIFT_LIMITS.maxPlants;z+=s*0.87,row++)for(let x=x0+s/2+(row%2)*s/2;x<x1&&out.length<DRIFT_LIMITS.maxPlants;x+=s){
  const p={x:x+(r()-.5)*s*.5,z:z+(r()-.5)*s*.5};
  if(!inside(p,ring)||edgeDist(p,ring)<s*.35)continue;
  const n=Math.sin(p.x/cell+ph[0])+Math.sin(p.z/cell*1.3+ph[1])+.6*Math.sin((p.x+p.z)/cell*.7+ph[2]);
  const k=Math.min(d.species.length-1,Math.max(0,Math.floor((n+2.6)/5.2*d.species.length)));
  try{const o=newLandscapePlant(d.species[k],`${bed.id}~${out.length}`,p.x,p.z),sc=.8+r()*.4;out.push({...o,rotationDeg:Math.floor(r()*360),heightIn:o.heightIn*sc,widthIn:o.widthIn*sc,depthIn:o.depthIn*sc});}catch{/* unknown species: skip */}
 }
 cache.set(bed,out);return out;
}
/** The saved objects plus every bed's drift plants, for drawing. */
export function withDriftPlants(objects:LandscapeObject[]|undefined):LandscapeObject[]{
 const list=objects??[];if(!list.some(o=>(o as {drift?:unknown}).drift))return list;
 return [...list,...list.filter(o=>o.enabled&&o.kind==='bed').flatMap(driftPlants)];
}
