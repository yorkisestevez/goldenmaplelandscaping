import * as THREE from 'three';
import {addMaterialPatch} from './materialPatches';

/** Stable 0–1 hash so one species is not one flat colour across the bed. */
export function plantColorHash(id:string,salt=1){
 let h=2166136261^salt;for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);return ((h>>>0)%10000)/10000;
}
/** Species tint, shifted a little per plant: warmer or cooler, lighter or deeper. */
export function tintPlantInstance(color:THREE.Color,speciesTint:string,objectId:string){
 color.set(speciesTint);
 const u=plantColorHash(objectId,3),v=plantColorHash(objectId,9);
 color.offsetHSL((u-.5)*.05,(v-.5)*.1,(u-.5)*.08);
 return color;
}
/**
 * Summer leaves: lift the crushed albedo, let the sun through the back of a card, and add a warm highlight.
 * The extra light is applied after the shadow map, so a self-shadowed canopy stays green instead of black.
 * Bark and trunks are left alone.
 */
export function applyFoliageLighting(material:THREE.Material){
 const standard=material as THREE.MeshStandardMaterial;
 const leafy=standard.alphaTest>0||/fern/i.test(standard.name);
 if(!leafy)return;
 standard.roughness=Math.min(standard.roughness,.64);standard.metalness=0;
 addMaterialPatch(material,{key:'foliage-summer-v1',apply(shader){
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <color_fragment>',`#include <color_fragment>
diffuseColor.rgb=pow(max(diffuseColor.rgb,vec3(0.0)),vec3(0.8));
diffuseColor.rgb*=vec3(1.04,1.12,0.9);`)
   .replace('#include <opaque_fragment>',`#if NUM_DIR_LIGHTS > 0
{
 vec3 leafSun=directionalLights[0].direction;
 float leafFace=saturate(dot(normal,leafSun));
 float leafBack=pow(saturate(dot(geometryViewDir,-leafSun)),1.25);
 reflectedLight.directDiffuse+=diffuseColor.rgb*directionalLights[0].color*leafBack*vec3(0.55,0.95,0.32);
 reflectedLight.directSpecular+=vec3(1.0,0.78,0.42)*pow(leafFace,2.4)*0.09;
}
#endif
float leafShade=1.0-saturate(dot(reflectedLight.directDiffuse,vec3(0.25,0.6,0.15))*1.8);
reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(0.18,0.26,0.09)*leafShade;
#include <opaque_fragment>`);
 }});
}
/** Flower heads stay their own colour in shade. No green multiply, so purple and gold are not pushed toward leaf. */
export function applyBloomLighting(material:THREE.Material){
 addMaterialPatch(material,{key:'bloom-lift-v1',apply(shader){
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`reflectedLight.indirectDiffuse+=diffuseColor.rgb*0.42;
#if NUM_DIR_LIGHTS > 0
 reflectedLight.directSpecular+=vec3(1.0,0.9,0.7)*pow(saturate(dot(normal,directionalLights[0].direction)),2.0)*0.12;
#endif
#include <opaque_fragment>`);
 }});
}
