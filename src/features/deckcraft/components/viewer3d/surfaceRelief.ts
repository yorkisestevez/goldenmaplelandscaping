import * as THREE from 'three';
import {buildSurfaceDetail,type DetailKind} from './detailMaps';
import type {ReliefRequest,ReliefResult} from './surfaceRelief.worker';
import {addMaterialPatch} from './materialPatches';

/**
 * 2K normal, roughness and height for pavers, slabs, caps, stone and siding. The product albedo
 * stays the manufacturer scan or swatch; this only adds relief. Shared per kind: the textures exist at once as flat
 * 1 px placeholders (no relief), and the 2K maps are built in a worker (surfaceRelief.worker.ts) and swapped in, so
 * opening the 3D view does not hold the page for seconds while they are generated.
 */
const RELIEF_SIZE=2048;
type Relief={normal:THREE.Texture;roughness:THREE.Texture};
const cached=new Map<DetailKind,Relief>();
const listeners=new Set<()=>void>();
/** Called whenever a kind's 2K relief replaces its placeholder, so an on-demand canvas can draw a frame. */
export function onSurfaceReliefReady(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};}
function texture(data:Uint8Array,size:number){
  const map=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  map.colorSpace=THREE.NoColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.generateMipmaps=true;
  map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.anisotropy=8;map.needsUpdate=true;
  return map;
}
/** A flat normal at mid height (no parallax) and a mid roughness (the roughness patch's factor of 1). */
const FLAT_NORMAL=[128,128,255,128],MID_ROUGHNESS=[128,128,128,255];
function upgrade(relief:Relief,size:number,normal:Uint8Array,roughness:Uint8Array){
  for(const [map,data] of [[relief.normal,normal],[relief.roughness,roughness]] as const){
    // A texture changes size only by being freed first: the GPU copy is reallocated at 2K on its next use.
    map.dispose();map.image={data,width:size,height:size};map.needsUpdate=true;
  }
  for(const listener of listeners)listener();
}
let worker:Worker|null|undefined;
const waiting=new Map<DetailKind,Relief>();
function onMainThread(kind:DetailKind,relief:Relief){
  setTimeout(()=>{const detail=buildSurfaceDetail(kind,RELIEF_SIZE);upgrade(relief,detail.size,detail.normal,detail.roughness);},0);
}
// Module functions, not closures, so the page-long worker never holds a renderer alive (see useSwatchTexture.ts).
function onWorkerMessage({data}:MessageEvent<ReliefResult>){
  const relief=waiting.get(data.kind);waiting.delete(data.kind);
  if(relief&&data.normal&&data.roughness)upgrade(relief,data.size,data.normal,data.roughness);
  else if(relief)onMainThread(data.kind,relief);
}
/** A worker that fails to load hands its jobs back to the main thread, and no more are sent to it. */
function onWorkerError(){worker=null;for(const [kind,relief] of waiting)onMainThread(kind,relief);waiting.clear();}
function build(kind:DetailKind,relief:Relief){
  if(worker===undefined){
    try{worker=typeof Worker==='function'?new Worker(new URL('./surfaceRelief.worker.ts',import.meta.url),{type:'module'}):null;}catch{worker=null;}
    worker?.addEventListener('message',onWorkerMessage);
    worker?.addEventListener('error',onWorkerError);
  }
  if(!worker){onMainThread(kind,relief);return;}
  waiting.set(kind,relief);worker.postMessage({kind,size:RELIEF_SIZE} satisfies ReliefRequest);
}
export function surfaceReliefTextures(kind:DetailKind){
  const hit=cached.get(kind);if(hit)return hit;
  const maps={normal:texture(new Uint8Array(FLAT_NORMAL),1),roughness:texture(new Uint8Array(MID_ROUGHNESS),1)};
  cached.set(kind,maps);build(kind,maps);return maps;
}

const MAP_SAMPLE=`#ifdef USE_MAP
  vec3 dcView=normalize(vViewPosition);
  float dcH=texture2D(uRelief,vMapUv).a;
  float dcParallax=smoothstep(0.12,0.42,abs(dot(normalize(vNormal),dcView)));
  vec2 dcReliefUv=vMapUv+dcView.xy*(dcH-0.5)*0.035*dcParallax;
  vec4 sampledDiffuseColor=texture2D(map,dcReliefUv);
  diffuseColor*=sampledDiffuseColor;
#endif`;

/** Fragment parallax plus a filtered normal. No vertex displacement. */
export function applySurfaceRelief(material:THREE.MeshStandardMaterial,kind:DetailKind){
  const maps=surfaceReliefTextures(kind);
  addMaterialPatch(material,{key:`dc-surface-relief-v1:${kind}`,apply:shader=>{
    shader.uniforms.uRelief={value:maps.normal};shader.uniforms.uReliefRough={value:maps.roughness};
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nuniform sampler2D uRelief;\nuniform sampler2D uReliefRough;')
      .replace('#include <map_fragment>',MAP_SAMPLE)
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor*mix(0.84,1.16,texture2D(uReliefRough,vMapUv).r),0.04,1.0);')
      .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nvec3 dcReliefN=texture2D(uRelief,vMapUv).xyz*2.0-1.0;\nfloat dcKeep=smoothstep(0.12,0.42,abs(dot(normalize(nonPerturbedNormal),normalize(vViewPosition))));\nnormal=normalize(mix(nonPerturbedNormal,normalize(normal+vec3(dcReliefN.xy,0.0)*0.72),dcKeep));');
  }});
  return material;
}
