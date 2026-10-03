import {applyHardscapeFinish} from './hardscapeFinish';
import {addMaterialPatch} from './materialPatches';
import * as THREE from 'three';
import LAWN from './assets/lawn.json';
import type {YardModel} from '../../yardModel';
import {yardSolidCells,yardClip} from '../../yardModel';
import {occlusionUv,type GroundBounds} from './groundOcclusion';
import {snapshotHeight} from './siteRendering';

/**
 * The lawn's surface (Real Life G3), apart from its files so the check scripts can test it: the patched material
 * (anti-tiling, variation, distance fade) and the ground to the horizon. Turf.tsx loads the maps and the blades.
 */
export const TILE_IN=LAWN.tileInches,FAR_RING_IN=18000;
const toLinear=(v:number)=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
/** The lawn's mean colour (linear), for the distance fade and the blades. */
export const LAWN_MEAN=LAWN.meanSrgb.map(toLinear) as [number,number,number];

const LAWN_FRAGMENT_HEAD=/* glsl */`
uniform float uTile;uniform vec3 uMean;
varying vec2 vLawn;
float lawnHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float lawnNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(lawnHash(i),lawnHash(i+vec2(1.,0.)),f.x),mix(lawnHash(i+vec2(0.,1.)),lawnHash(i+1.),f.x),f.y);}
vec2 lawnUv,lawnDx,lawnDy,lawnA,lawnB;float lawnMix,lawnFade,lawnDry;
vec4 lawnTex(sampler2D t){return mix(textureGrad(t,lawnUv+lawnA,lawnDx,lawnDy),textureGrad(t,lawnUv+lawnB,lawnDx,lawnDy),lawnMix);}`;
const LAWN_SETUP=/* glsl */`
  {
    lawnUv=vLawn/uTile;lawnDx=dFdx(lawnUv);lawnDy=dFdy(lawnUv);
    float k=lawnNoise(lawnUv*.37)*8.,f=fract(k);lawnA=sin(vec2(3.,7.)*floor(k));lawnB=sin(vec2(3.,7.)*(floor(k)+1.));lawnMix=smoothstep(.2,.8,f);
    lawnFade=smoothstep(1440.,4800.,length(vViewPosition)*12.);
    lawnDry=smoothstep(.62,.9,lawnNoise(vLawn/240.+41.))*.15;
  }`;
const LAWN_COLOUR=/* glsl */`
  {
    float broad=lawnNoise(vLawn/420.+13.),local=lawnNoise(vLawn/108.+17.);
    float bright=mix(.84,1.13,broad*.65+local*.35);
    // Subtle alternating blade direction from mowing, fixed in world space.
    float stripe=sin((vLawn.x*.8+vLawn.y*.6)/42.0);
    bright*=1.+.035*stripe*(1.-lawnFade);
    // Fine scan contrast should read as short grass, not gravel; preserve its measured mean colour.
    diffuseColor.rgb=mix(diffuseColor.rgb,uMean,.14);
    diffuseColor.rgb=mix(diffuseColor.rgb*bright,uMean*bright,lawnFade);
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.35,1.12,.78),lawnDry);
  }`;

function chunk(name:string,from:string,to:string){
  const source=(THREE.ShaderChunk as Record<string,string>)[name];
  if(!source?.includes(from))throw new Error(`Turf: ShaderChunk.${name} no longer has "${from}"`);
  return source.split(from).join(to);
}
/** The chunks and lookups the lawn patch rewrites (check-deck-realism checks they exist). */
export const LAWN_CHUNKS:[string,string][]=[['map_fragment','texture2D( map, vMapUv )'],['roughnessmap_fragment','texture2D( roughnessMap, vRoughnessMapUv )'],['normal_fragment_maps','texture2D( normalMap, vNormalMapUv )'],['normal_fragment_maps','mapN.xy *= normalScale;']];

/** The lawn material: standard, with the anti-tiling, variation and distance fade patched in. */
export function lawnMaterial(){
  const m=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,metalness:0,normalScale:new THREE.Vector2(.3,.3)});
  m.customProgramCacheKey=()=>'dc-lawn-v3';
  m.onBeforeCompile=shader=>{
    shader.uniforms.uTile={value:TILE_IN};shader.uniforms.uMean={value:new THREE.Vector3(...LAWN_MEAN)};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vLawn;').replace('#include <uv_vertex>','#include <uv_vertex>\n  vLawn=position.xz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\n${LAWN_FRAGMENT_HEAD}`)
      .replace('#include <map_fragment>',`${LAWN_SETUP}\n${chunk('map_fragment','texture2D( map, vMapUv )','lawnTex( map )')}\n${LAWN_COLOUR}`)
      .replace('#include <roughnessmap_fragment>',`${chunk('roughnessmap_fragment','texture2D( roughnessMap, vRoughnessMapUv )','lawnTex( roughnessMap )')}\n  roughnessFactor=min(1.,roughnessFactor+.05*lawnDry/.25);`)
      .replace('#include <normal_fragment_maps>',chunk('normal_fragment_maps','texture2D( normalMap, vNormalMapUv )','lawnTex( normalMap )').replace('mapN.xy *= normalScale;','mapN.xy *= normalScale*(1.-lawnFade);'));
  };
  return m;
}

/** The yard's ground (clipped round excavations) plus a far ring from its edge to FAR_RING_IN, flattening to the yard's
 * middle height. UVs in lawn tiles; uv1 is the occlusion map's. */
/** The lawn's surface height at z (inches): the terrain plane, the lawn sitting just under it. */
export const lawnHeight=(t:{elevationIn:number;slopePct:number},z:number)=>t.elevationIn+z*t.slopePct/100-.7;
export function groundGeometry(yard:YardModel,cuts:{x:number;y:number}[][],width:number,depth:number,bounds:GroundBounds,kind:'existing'|'proposed'='proposed'){
  const positions:number[]=[],uvs:number[]=[],uv1:number[]=[],t=yard.terrain,height=(z:number)=>lawnHeight(t,z);
  const push=(x:number,y:number,z:number)=>{positions.push(x,y,z);uvs.push(x/TILE_IN,z/TILE_IN);uv1.push(...occlusionUv(bounds,x,z));};
  const measured=yard.siteSurface,oldCuts=measured?yardClip([...cuts,...measured.coverage]):cuts;
  if(measured)for(const triangle of kind==='existing'?measured.existingTriangles:measured.proposedTriangles){const polygon=triangle.vertices.map(v=>({x:v.xIn,y:v.zIn}));for(const p of yardSolidCells(yardClip([polygon],cuts,'difference')))for(let i=1;i<p.length-1;i++)for(const v of [p[0],p[i+1],p[i]])push(v.x,triangle.plane.x*v.x+triangle.plane.z*v.y+triangle.plane.constant-.7,v.y);}
  const n=24,tw=bounds.width,td=bounds.depth,minX=bounds.minX,minZ=bounds.minZ;
  for(let ix=0;ix<n;ix++)for(let iz=0;iz<n;iz++){
    const x=minX+ix*tw/n,z=minZ+iz*td/n,cell=[{x,y:z},{x:x+tw/n,y:z},{x:x+tw/n,y:z+td/n},{x,y:z+td/n}];
    for(const p of yardSolidCells(yardClip([cell],oldCuts,'difference')))for(let i=1;i<p.length-1;i++)for(const v of [p[0],p[i+1],p[i]])push(v.x,height(v.y),v.y);
  }
  // The far ring: the yard's edge walked in 64 steps, joined by bands to a circle round the yard's middle.
  const cx=width/2,cz=minZ+td/2,mid=height(cz),edge:{x:number;z:number}[]=[];
  const corners=[[minX,minZ],[minX+tw,minZ],[minX+tw,minZ+td],[minX,minZ+td]];
  for(let side=0;side<4;side++){const [ax,az]=corners[side],[bx,bz]=corners[(side+1)%4];for(let k=0;k<16;k++)edge.push({x:ax+(bx-ax)*k/16,z:az+(bz-az)*k/16});}
  const bands=[0,.01,.03,.07,.15,.3,.55,1],ring=(e:{x:number;z:number},s:number)=>{
    const a=Math.atan2(e.z-cz,e.x-cx),far={x:cx+Math.cos(a)*FAR_RING_IN,z:cz+Math.sin(a)*FAR_RING_IN},x=e.x+(far.x-e.x)*s,z=e.z+(far.z-e.z)*s;
    return [x,height(e.z)+(mid-height(e.z))*Math.min(1,s*6),z] as const;
  };
  for(let i=0;i<edge.length;i++){const e0=edge[i],e1=edge[(i+1)%edge.length];for(let b=0;b<bands.length-1;b++){
    const a0=ring(e0,bands[b]),a1=ring(e1,bands[b]),b0=ring(e0,bands[b+1]),b1=ring(e1,bands[b+1]);
    for(const v of [a0,a1,b1,a0,b1,b0])push(...v);// wound to face up
  }}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('uv1',new THREE.Float32BufferAttribute(uv1,2));
  g.computeVertexNormals();return g;
}

/** Defined grade discontinuity faces, plus optional inspection cuts at the survey perimeter.
 * The perimeter bridges to illustrative outside terrain only in inspection;
 * it does not establish a measured retaining structure or grading transition.
 * Faces are derived from adjacent TIN planes. They do not extend measured coverage
 * or create a decorative bank, and leave construction quantities unchanged. */
export function groundEdgeGeometry(yard:YardModel,kind:'existing'|'proposed'='proposed',visualHoles:{x:number;y:number}[][]=[],includeSurveyCuts=true){
 const values:number[]=[],surface=yard.siteSurface;
 type Edge={from:number;to:number;plane:{x:number;z:number;constant:number}};
 type Line={x:number;z:number;dx:number;dz:number;origin:number;edges:Edge[]};
 const lines=new Map<string,Line>(),boundary=surface?.coverage.flatMap(p=>p.map((a,i)=>({a,b:p[(i+1)%p.length]})))??[];
 const emit=(a:{x:number;z:number;top:number;bottom:number},b:typeof a)=>{if(Math.abs(a.top-a.bottom)+Math.abs(b.top-b.bottom)<.001)return;const da=a.top-a.bottom,db=b.top-b.bottom;if(da*db<0){const t=da/(da-db),mid={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,top:a.top+(b.top-a.top)*t,bottom:a.bottom+(b.bottom-a.bottom)*t};emit(a,mid);emit(mid,b);return;}for(const v of [[a.x,a.top,a.z],[b.x,b.top,b.z],[b.x,b.bottom,b.z],[a.x,a.top,a.z],[b.x,b.bottom,b.z],[a.x,a.bottom,a.z]])values.push(...v);};
 const add=(a:Parameters<typeof emit>[0],b:typeof a)=>{
  if(!visualHoles.length){emit(a,b);return;}const ux=b.x-a.x,uz=b.z-a.z,stops=[0,1];
  for(const poly of visualHoles)for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],vx=q.x-p.x,vz=q.y-p.y,den=ux*vz-uz*vx;if(Math.abs(den)<1e-10)continue;const t=((p.x-a.x)*vz-(p.y-a.z)*vx)/den,u=((p.x-a.x)*uz-(p.y-a.z)*ux)/den;if(t>0&&t<1&&u>=0&&u<=1)stops.push(t);}
  const inside=(x:number,z:number)=>visualHoles.some(poly=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const p=poly[i],q=poly[j];if((p.y>z)!==(q.y>z)&&x<(q.x-p.x)*(z-p.y)/(q.y-p.y)+p.x)hit=!hit;}return hit;}),point=(t:number)=>({x:a.x+ux*t,z:a.z+uz*t,top:a.top+(b.top-a.top)*t,bottom:a.bottom+(b.bottom-a.bottom)*t});
  stops.sort((x,y)=>x-y);for(let i=0;i+1<stops.length;i++){const t=(stops[i]+stops[i+1])/2;if(stops[i+1]-stops[i]>1e-9&&!inside(a.x+ux*t,a.z+uz*t))emit(point(stops[i]),point(stops[i+1]));}
 };
 if(surface)for(const triangle of kind==='existing'?surface.existingTriangles:surface.proposedTriangles)for(let i=0;i<3;i++){
  const a=triangle.vertices[i],b=triangle.vertices[(i+1)%3],length=Math.hypot(b.xIn-a.xIn,b.zIn-a.zIn);if(length<.001)continue;
  let dx=(b.xIn-a.xIn)/length,dz=(b.zIn-a.zIn)/length;if(dx<-.00000001||Math.abs(dx)<.00000001&&dz<0){dx=-dx;dz=-dz;}
  const key=`${dx.toFixed(8)},${dz.toFixed(8)},${(-dz*a.xIn+dx*a.zIn).toFixed(4)}`;
  let line=lines.get(key);if(!line){line={x:a.xIn,z:a.zIn,dx,dz,origin:dx*a.xIn+dz*a.zIn,edges:[]};lines.set(key,line);}
  const qa=line.dx*a.xIn+line.dz*a.zIn,qb=line.dx*b.xIn+line.dz*b.zIn;
  line.edges.push({from:Math.min(qa,qb),to:Math.max(qa,qb),plane:triangle.plane});
 }
 for(const line of lines.values()){
  const ends=line.edges.flatMap(e=>[e.from,e.to]).sort((a,b)=>a-b),breaks=ends.filter((q,i)=>i===0||q-ends[i-1]>.00001);
  for(let i=0;i<breaks.length-1;i++){
   const from=breaks[i],to=breaks[i+1];if(to-from<.001)continue;
   const mid=(from+to)/2,active=line.edges.filter(e=>e.from<mid+.00001&&e.to>mid-.00001);if(!active.length)continue;
   const point=(q:number)=>({x:line.x+line.dx*(q-line.origin),z:line.z+line.dz*(q-line.origin)}),a=point(from),b=point(to);
   // A lone edge is closed only at the measured coverage perimeter; internal cuts remain open.
   if(active.length===1&&!boundary.some(edge=>{const vx=edge.b.x-edge.a.x,vz=edge.b.y-edge.a.y,len=Math.hypot(vx,vz);if(len<.001)return false;const on=(p:typeof a)=>Math.abs((p.x-edge.a.x)*vz-(p.z-edge.a.y)*vx)/len<.0001&&((p.x-edge.a.x)*vx+(p.z-edge.a.y)*vz)/(len*len)>=-.00001&&((p.x-edge.a.x)*vx+(p.z-edge.a.y)*vz)/(len*len)<=1.00001;return on(a)&&on(b);}))continue;
   const heights=(p:typeof a)=>active.map(e=>e.plane.x*p.x+e.plane.z*p.z+e.plane.constant-.7),ha=heights(a),hb=heights(b);
   if(active.length===1&&!includeSurveyCuts)continue;
   if(active.length===1){ha.push(lawnHeight(yard.terrain,a.z));hb.push(lawnHeight(yard.terrain,b.z));}
   // Upper/lower ownership can switch where two affine planes cross.
   // Split there before taking their envelope so zero-height jumps remain closed.
   const splits=[0,1];for(let u=0;u<ha.length;u++)for(let v=u+1;v<ha.length;v++){const da=ha[u]-ha[v],db=hb[u]-hb[v];if(da*db<0)splits.push(da/(da-db));}
   splits.sort((u,v)=>u-v);const spans=splits.filter((v,i)=>i===0||v-splits[i-1]>1e-9);
   const end=(t:number)=>{const heights=ha.map((h,j)=>h+(hb[j]-h)*t);return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,top:Math.max(...heights),bottom:Math.min(...heights)};};
   for(let j=0;j<spans.length-1;j++)add(end(spans[j]),end(spans[j+1]));
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(values,3));if(values.length)geometry.computeVertexNormals();return geometry;
}

/** Neutral, granular exposed earth. Pattern is visual only: it does not claim
 * measured soil strata or conceal unsupported grading discontinuities. */
export function soilFaceMaterial(){
 const material=applyHardscapeFinish(new THREE.MeshStandardMaterial({color:'#796951',roughness:1,side:THREE.DoubleSide}));
 addMaterialPatch(material,{key:'soil-grain-v1',apply:s=>{s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float soilBroad=mineralNoise(vMineralPosition/1.3),soilGrain=mineralNoise(vMineralPosition/.12);
diffuseColor.rgb*=.9+.14*soilBroad+.06*soilGrain;`);}});return material;
}
