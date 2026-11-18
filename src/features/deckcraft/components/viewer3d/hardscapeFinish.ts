import * as THREE from 'three';
import {addMaterialPatch} from './materialPatches';

/** Product photos supply colour, not measured roughness. A small, smooth mineral
 * variation at centimetre scale prevents the whole slab reflecting as one flat
 * plastic sheet. The variation is fixed in world space and fades when subpixel. */
export function applyHardscapeFinish(material:THREE.MeshStandardMaterial){
 addMaterialPatch(material,{key:'hardscape-mineral-roughness-v1',apply:shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vMineralPosition;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvMineralPosition=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vMineralPosition;
float mineralHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float mineralNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(mineralHash(i),mineralHash(i+vec3(1,0,0)),f.x),mix(mineralHash(i+vec3(0,1,0)),mineralHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(mineralHash(i+vec3(0,0,1)),mineralHash(i+vec3(1,0,1)),f.x),mix(mineralHash(i+vec3(0,1,1)),mineralHash(i+vec3(1,1,1)),f.x),f.y),f.z);}`)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
vec3 mineralCell=vMineralPosition/0.035;
float mineralFootprint=max(length(dFdx(mineralCell)),length(dFdy(mineralCell)));
float mineralWeight=1.-smoothstep(.5,2.,mineralFootprint);
roughnessFactor=clamp(roughnessFactor+(mineralNoise(mineralCell)-.5)*.10*mineralWeight,.65,1.);`)
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
// Centimetre-scale relief with a 0.3 mm amplitude; derivative filtering keeps
// distant paving calm. View positions and material world coordinates are feet.
vec3 mineralNormalCell=vMineralPosition/.035;
float mineralNormalFade=1.-smoothstep(.5,2.,max(length(dFdx(mineralNormalCell)),length(dFdy(mineralNormalCell))));
float mineralHeight=mineralNoise(mineralNormalCell)*.001;
vec3 mineralDx=dFdx(-vViewPosition),mineralDy=dFdy(-vViewPosition);
vec3 mineralR1=cross(mineralDy,normal),mineralR2=cross(normal,mineralDx);
float mineralDet=dot(mineralDx,mineralR1);
if(abs(mineralDet)>1e-10)normal=normalize(abs(mineralDet)*normal-sign(mineralDet)*(dFdx(mineralHeight)*mineralR1+dFdy(mineralHeight)*mineralR2)*mineralNormalFade);`);
 }});
 return material;
}
