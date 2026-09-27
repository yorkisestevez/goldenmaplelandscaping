import * as THREE from 'three';
import type {YardBox,YardRole} from '../../yardModel';
import {TILE_IN,lawnHeight} from './lawnSurface';
import {occlusionUv,type GroundBounds} from './groundOcclusion';

/**
 * How the yard's earthwork looks once the job is done (Real Life G5), for the finished views only: the construction
 * views keep what the model builds, and quantities and exports are always the model's.
 * - A retaining wall's drainage stone and backfill (GRADED_ROLES) are buried under a lawn bank: level with the top
 *   course along the wall across both, then falling to the lawn beyond the backfill and towards the wall's ends,
 *   rounded at the crest and the toe, on average 1 in BANK_RUN.
 * - A rock reaches an inch into the lawn rather than standing clear of it, as a set stone does (the model's stepped
 *   waterfall stones stand 6 in apart with nothing under them); its top stays where the model puts it.
 */
export const GRADED_ROLES:YardRole[]=['wall-drainage','backfill'],BANK_RUN=2.5,BANK_STEP_IN=6;
type Terrain={elevationIn:number;slopePct:number};
const centre=(b:YardBox)=>{const p=b.polygon!;return p.reduce((c,q)=>({x:c.x+q.x/p.length,y:c.y+q.y/p.length}),{x:0,y:0});};
const smooth=(t:number)=>{const k=Math.min(1,Math.max(0,t));return k*k*(3-2*k);};
/** The lawn surface over a wall's drainage and backfill (inches, like the yard's boxes), or null when the wall holds
 * less than an inch. UVs in lawn tiles and uv1 in the ground occlusion map, as the lawn's own. */
export function bankGeometry(drainage:YardBox,backfill:YardBox,terrain:Terrain,bounds?:GroundBounds){
  if(!drainage.polygon?.length||!backfill.polygon?.length)return null;
  const o=centre(drainage),f=centre(backfill),len=Math.hypot(f.x-o.x,f.y-o.y);if(len<1e-6)return null;
  // v runs away from the wall (drainage to backfill), u along it.
  const v={x:(f.x-o.x)/len,y:(f.y-o.y)/len},u={x:-v.y,y:v.x},along=(p:{x:number;y:number},axis:{x:number;y:number})=>(p.x-o.x)*axis.x+(p.y-o.y)*axis.y;
  const us=drainage.polygon.map(p=>along(p,u)),u0=Math.min(...us),u1=Math.max(...us);
  const v0=Math.min(...drainage.polygon.map(p=>along(p,v))),shelf=Math.max(...backfill.polygon.map(p=>along(p,v)));
  const top=drainage.y+drainage.h/2,rise=top-lawnHeight(terrain,o.y);
  if(rise<1)return null;
  const run=rise*BANK_RUN,endRun=Math.min(run,(u1-u0)/2),v1=shelf+run;
  const nu=Math.max(2,Math.ceil((u1-u0)/BANK_STEP_IN)+1),nv=Math.max(2,Math.ceil((v1-v0)/BANK_STEP_IN)+1);
  const position:number[]=[],uv:number[]=[],uv1:number[]=[],index:number[]=[];
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
    const a=u0+(u1-u0)*i/(nu-1),b=v0+(v1-v0)*j/(nv-1),x=o.x+u.x*a+v.x*b,z=o.y+u.y*a+v.y*b;
    // The toe dips an inch under the lawn so the two meet without a seam.
    const toe=lawnHeight(terrain,z)-1,k=(1-smooth((b-shelf)/run))*smooth(Math.min(a-u0,u1-a)/endRun);
    position.push(x,toe+(Math.max(top,toe)-toe)*k,z);uv.push(x/TILE_IN,z/TILE_IN);uv1.push(...(bounds?occlusionUv(bounds,x,z):[0,0]));
  }
  for(let j=0;j<nv-1;j++)for(let i=0;i<nu-1;i++){const a=j*nu+i,b=a+1,c=a+nu,d=c+1;index.push(a,b,c,b,d,c);}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(position,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('uv1',new THREE.Float32BufferAttribute(uv1,2));
  g.setIndex(index);g.computeVertexNormals();
  return g;
}
/** A rock as the finished views draw it: reaching an inch under the lawn, its top unchanged. */
export function seatOnLawn(b:YardBox,terrain:Terrain):YardBox{
  if(b.role!=='rock')return b;
  const ground=lawnHeight(terrain,b.z)-1,top=b.y+b.h/2;
  return ground<b.y-b.h/2?{...b,y:(top+ground)/2,h:top-ground}:b;
}
