import * as THREE from 'three';
import {buildSurfaceDetail,type DetailKind} from './detailMaps';
import {addMaterialPatch} from './materialPatches';

/**
 * 2K normal, roughness and height for pavers, slabs, caps, stone and siding. The product albedo
 * stays the manufacturer scan or swatch; this only adds relief. Built on first use, then shared.
 */
const cached=new Map<DetailKind,{normal:THREE.Texture;roughness:THREE.Texture}>();
function texture(data:Uint8Array,size:number){
  const map=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  map.colorSpace=THREE.NoColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.generateMipmaps=true;
  map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.anisotropy=8;map.needsUpdate=true;
  return map;
}
export function surfaceReliefTextures(kind:DetailKind){
  const hit=cached.get(kind);if(hit)return hit;
  const detail=buildSurfaceDetail(kind,2048),maps={normal:texture(detail.normal,detail.size),roughness:texture(detail.roughness,detail.size)};
  cached.set(kind,maps);return maps;
}

const MAP_SAMPLE=`#ifdef USE_MAP
  vec3 dcView=normalize(vViewPosition);
  float dcH=texture2D(uRelief,vMapUv).a;
  vec2 dcReliefUv=vMapUv+dcView.xy*(dcH-0.5)*0.035;
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
      .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nvec3 dcReliefN=texture2D(uRelief,vMapUv).xyz*2.0-1.0;\nnormal=normalize(normal+vec3(dcReliefN.xy,0.0)*0.45);');
  }});
  return material;
}
