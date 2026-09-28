import * as THREE from 'three';
import LAWN from './assets/lawn.json';
import type {YardModel} from '../../yardModel';
import {yardSolidCells,yardClip} from '../../yardModel';
import {occlusionUv,type GroundBounds} from './groundOcclusion';

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
    lawnFade=smoothstep(720.,2400.,length(vViewPosition)*12.);
    lawnDry=smoothstep(.62,.9,lawnNoise(vLawn/240.+41.))*.25;
  }`;
const LAWN_COLOUR=/* glsl */`
  {
    float bright=mix(.88,1.08,lawnNoise(vLawn/360.)*.6+lawnNoise(vLawn/96.+17.)*.4);
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
  const m=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,metalness:0,normalScale:new THREE.Vector2(.6,.6)});
  m.customProgramCacheKey=()=>'dc-lawn-v1';
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
export function groundGeometry(yard:YardModel,cuts:{x:number;y:number}[][],width:number,depth:number,bounds:GroundBounds){
  const positions:number[]=[],uvs:number[]=[],uv1:number[]=[],t=yard.terrain,height=(z:number)=>t.elevationIn+z*t.slopePct/100-.7;
  const push=(x:number,y:number,z:number)=>{positions.push(x,y,z);uvs.push(x/TILE_IN,z/TILE_IN);uv1.push(...occlusionUv(bounds,x,z));};
  const n=24,tw=bounds.width,td=bounds.depth,minX=bounds.minX,minZ=bounds.minZ;
  for(let ix=0;ix<n;ix++)for(let iz=0;iz<n;iz++){
    const x=minX+ix*tw/n,z=minZ+iz*td/n,cell=[{x,y:z},{x:x+tw/n,y:z},{x:x+tw/n,y:z+td/n},{x,y:z+td/n}];
    for(const p of yardSolidCells(yardClip([cell],cuts,'difference')))for(let i=1;i<p.length-1;i++)for(const v of [p[0],p[i+1],p[i]])push(v.x,height(v.y),v.y);
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
