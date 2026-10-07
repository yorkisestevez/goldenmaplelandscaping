import * as THREE from 'three';
import {yardClip,yardSolidCells,type YardBox,type YardRole,type YardModel} from '../../yardModel';
import {pathRun,yardWallPath,yardPathBackStrip} from '../../yardPathGeometry';
import type {PlanPoint} from '../../lib/deckGeometry';
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
export const GRADED_ROLES:YardRole[]=['wall-drainage','backfill','geogrid'],BANK_RUN=2.5,BANK_STEP_IN=6;
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
/** The finished bank is a single height field, rather than swept offset rows.
 * Inner offsets of a tight curve can fold across one another; a height field
 * guarantees one surface at each plan position. Clipped vertices are shared so
 * the lawn normal remains continuous around patio masks. */
export function pathBankGeometry(path:PlanPoint[],depthIn:number,top:number,terrain:Terrain,bounds?:GroundBounds,cutouts:PlanPoint[][]=[],retainedFromIn?:number){
 if(path.length<2)return null;
 const run=pathRun(path),rise=Math.max(...path.map(p=>top-lawnHeight(terrain,p.y)));if(rise<1||run<1e-6)return null;
 const bankRun=rise*BANK_RUN,from=retainedFromIn??depthIn/2,shelf=from+24,to=shelf+bankRun,endRun=Math.min(bankRun,run/2);
 let along=0;const segments=path.slice(1).map((b,i)=>{const a=path[i],dx=b.x-a.x,dz=b.y-a.y,len=Math.hypot(dx,dz),start=along;along+=len;return {a,dx,dz,len,start};}).filter(s=>s.len>1e-6);
 const minX=Math.min(...path.map(p=>p.x))-to,maxX=Math.max(...path.map(p=>p.x))+to,minZ=Math.min(...path.map(p=>p.y))-to,maxZ=Math.max(...path.map(p=>p.y))+to;
 // Bound the visual mesh for very large yards while keeping close walls at 6 in.
 const step=Math.max(BANK_STEP_IN,Math.sqrt((maxX-minX)*(maxZ-minZ)/18000)),nx=Math.ceil((maxX-minX)/step),nz=Math.ceil((maxZ-minZ)/step);
 const height=(x:number,z:number)=>{let best=Infinity,distance=0,side=0,station=0;
  for(const s of segments){const t=Math.min(1,Math.max(0,((x-s.a.x)*s.dx+(z-s.a.y)*s.dz)/(s.len*s.len))),qx=s.a.x+t*s.dx,qz=s.a.y+t*s.dz,dist=Math.hypot(x-qx,z-qz);
   if(dist<best){best=dist;distance=dist;side=((x-qx)*-s.dz+(z-qz)*s.dx)/s.len;station=s.start+t*s.len;}}
  const toe=lawnHeight(terrain,z)-1,weight=side<from-.01?0:(1-smooth((distance-shelf)/bankRun))*smooth(Math.min(station,run-station)/endRun);
  return {x,y:toe+(Math.max(top,toe)-toe)*weight,z,weight};
 };
 const vertices:{x:number;y:number;z:number}[]=[],uv:number[]=[],uv1:number[]=[],index:number[]=[],lookup=new Map<string,number>();
 const append=(p:{x:number;y:number;z:number})=>{const key=`${p.x.toFixed(5)}:${p.z.toFixed(5)}`,hit=lookup.get(key);if(hit!==undefined)return hit;const id=vertices.length;lookup.set(key,id);vertices.push(p);uv.push(p.x/TILE_IN,p.z/TILE_IN);uv1.push(...(bounds?occlusionUv(bounds,p.x,p.z):[0,0]));return id;};
 const masks=cutouts.map(p=>({polygon:p,minX:Math.min(...p.map(q=>q.x)),maxX:Math.max(...p.map(q=>q.x)),minZ:Math.min(...p.map(q=>q.y)),maxZ:Math.max(...p.map(q=>q.y))})),bankRegion=yardClip(yardPathBackStrip(path,from,to));
 const triangle=(ps:ReturnType<typeof height>[])=>{if(ps.every(p=>p.weight<.0001))return;
  const minX=Math.min(...ps.map(p=>p.x)),maxX=Math.max(...ps.map(p=>p.x)),minZ=Math.min(...ps.map(p=>p.z)),maxZ=Math.max(...ps.map(p=>p.z)),hits=masks.filter(m=>m.minX<=maxX&&m.maxX>=minX&&m.minZ<=maxZ&&m.maxZ>=minZ);
  const triangle=ps.map(p=>({x:p.x,y:p.z})),inside=ps.some(p=>p.weight<.0001)?yardClip([triangle],bankRegion,'intersection'):[triangle];
  const kept=hits.length||inside.length!==1?yardSolidCells(yardClip(inside,hits.map(m=>m.polygon),'difference')):inside;
  for(const poly of kept){const ids=poly.map(p=>append(height(p.x,p.y)));for(let i=1;i+1<ids.length;i++){const a=poly[0],b=poly[i],c=poly[i+1];if(Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))>1e-4)index.push(ids[0],ids[i+1],ids[i]);}}
 };
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const x=minX+(maxX-minX)*i/nx,z=minZ+(maxZ-minZ)*j/nz,x1=minX+(maxX-minX)*(i+1)/nx,z1=minZ+(maxZ-minZ)*(j+1)/nz,a=height(x,z),b=height(x1,z),c=height(x,z1),d=height(x1,z1);
  triangle([a,b,c]);triangle([b,d,c]);
 }
 if(!index.length)return null;
 // Clipper normalizes winding; all landscape triangles must face the sky.
 for(let i=0;i<index.length;i+=3){const [a,b,c]=index.slice(i,i+3).map(k=>vertices[k]);if((b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z)<0)[index[i+1],index[i+2]]=[index[i+2],index[i+1]];}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flatMap(p=>[p.x,p.y,p.z]),3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('uv1',new THREE.Float32BufferAttribute(uv1,2));g.setIndex(index);g.computeVertexNormals();return g;
}
/** The legacy illustrative bank follows exposed wall geometry. Drainage and
 * backfill boxes can be clipped below-grade placeholders awaiting site inputs;
 * they do not establish a visible crest or a surveyed grade. A freestanding (seat) wall holds no ground: both faces
 * stay exposed, so it gets no bank. Measured sites use
 * their proposed surface instead of this helper. */
export function retainedBankGeometry(feature:YardModel['features'][number],terrain:Terrain,bounds?:GroundBounds,cutouts:PlanPoint[][]=[]){
 const blocks=feature.boxes.filter(b=>b.role==='wall-block');if(!blocks.length||feature.config.wallConstruction?.freestanding)return null;
 const top=Math.max(...blocks.map(b=>b.y+b.h/2)),path=yardWallPath(feature.config);
 if(path.length<2||Math.max(...path.map(p=>top-lawnHeight(terrain,p.y)))<=1)return null;
 const segments=path.slice(1).map((b,i)=>{const a=path[i],dx=b.x-a.x,dz=b.y-a.y,length=Math.hypot(dx,dz);return {a,dx,dz,length};}).filter(s=>s.length>.0001);
 const back=(p:PlanPoint)=>{let nearest=Infinity,side=0;for(const s of segments){const t=Math.max(0,Math.min(1,((p.x-s.a.x)*s.dx+(p.y-s.a.y)*s.dz)/(s.length*s.length))),x=s.a.x+t*s.dx,z=s.a.y+t*s.dz,distance=Math.hypot(p.x-x,p.y-z);if(distance<nearest){nearest=distance;side=((p.x-x)*-s.dz+(p.y-z)*s.dx)/s.length;}}return side;};
 const rear=Math.max(feature.config.depthFt*6,...blocks.flatMap(b=>(b.polygon??[]).map(back)))+.03;
 return pathBankGeometry(path,feature.config.depthFt*12,top,terrain,bounds,cutouts,rear);
}
/** A rock as the finished views draw it: reaching an inch under the lawn, its top unchanged. */
export function seatOnLawn(b:YardBox,terrain:Terrain):YardBox{
  if(b.role!=='rock')return b;
  const ground=lawnHeight(terrain,b.z)-1,top=b.y+b.h/2;
  return ground<b.y-b.h/2?{...b,y:(top+ground)/2,h:top-ground}:b;
}

/** Decorative retained banks are confined to saved legacy presentation. */
export const illustrativeBanksVisible=(model:{siteSurface?:unknown;terrain?:{elevationIn?:number;slopePct?:number};features:{config:{finishedElevationIn?:number;patioSlope?:unknown;wallTopSteps?:unknown}}[]},inspection=false)=>!inspection&&!model.siteSurface&&Math.abs(model.terrain?.elevationIn??0)<1e-8&&Math.abs(model.terrain?.slopePct??0)<1e-8&&!model.features.some(f=>f.config.finishedElevationIn!==undefined||f.config.patioSlope!==undefined||f.config.wallTopSteps!==undefined);
