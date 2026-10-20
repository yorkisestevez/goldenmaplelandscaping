import * as THREE from 'three';
import {addMaterialPatch} from './materialPatches';

/**
 * Winter snow as one material patch: anything facing the sky turns white where it is level enough to hold snow, in drifts
 * that vary over the ground (world-space noise, so they stay put as the camera moves). Walkable finishes (deck boards,
 * stair treads, pavers) are shovelled: they keep a light dusting so the material still shows. Glass, water, flames and
 * anything see-through never take snow. The strength is one shared uniform, so leaving winter turns every patched
 * material back to exactly its own colour without recompiling.
 */
export type SnowRole='full'|'dust'|'none';
/** 1 in winter, 0 otherwise: read by every patched program. */
export const SNOW_ON={value:0};
export const SNOW={color:[.9,.92,.95] as [number,number,number],roughness:.72,depth:{full:1,dust:.32,none:0}};
/** Mark a material as a walkable finish (shovelled) or one that never holds snow. Unmarked surfaces take full snow. */
export function setSnowRole(material:THREE.Material,role:Exclude<SnowRole,'full'>){material.userData.snow=role;return material;}
export function snowRole(material:THREE.Material):SnowRole{
 const marked=material.userData.snow as SnowRole|undefined;if(marked)return marked;
 const m=material as THREE.MeshPhysicalMaterial;
 if(!(m as THREE.MeshStandardMaterial).isMeshStandardMaterial)return 'none';
 if(m.transparent&&m.opacity<.98||(m.transmission??0)>0)return 'none';
 const glow=m.emissive?Math.max(m.emissive.r,m.emissive.g,m.emissive.b)*(m.emissiveIntensity??1):0;
 return glow>.2?'none':'full';
}
const NOISE=`float snowHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float snowNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(snowHash(i),snowHash(i+vec2(1,0)),f.x),mix(snowHash(i+vec2(0,1)),snowHash(i+vec2(1,1)),f.x),f.y);}`;
/** Adds the snow patch for the material's role. Returns false when the material never takes snow. */
export function applySnowCover(material:THREE.Material,role:SnowRole=snowRole(material)){
 if(role==='none')return false;
 const depth={value:SNOW.depth[role]},[r,g,b]=SNOW.color;
 addMaterialPatch(material,{key:'snow-cover-v1',apply(shader){
  shader.uniforms.uSnowOn=SNOW_ON;shader.uniforms.uSnowDepth=depth;
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>\nvarying vec3 vSnowWorld;')
   .replace('#include <project_vertex>',`#include <project_vertex>
{ vec4 snowAt=vec4(transformed,1.0);
#ifdef USE_BATCHING
 snowAt=batchingMatrix*snowAt;
#endif
#ifdef USE_INSTANCING
 snowAt=instanceMatrix*snowAt;
#endif
 vSnowWorld=(modelMatrix*snowAt).xyz; }`);
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>',`#include <common>
varying vec3 vSnowWorld;
uniform float uSnowOn;
uniform float uSnowDepth;
${NOISE}`)
   .replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
if(uSnowOn>0.0){
 // How level the surface is (1 facing the sky), roughened by drifts a few feet across and clumps a few inches across.
 float snowLevel=dot(normal,normalize((viewMatrix*vec4(0.0,1.0,0.0,0.0)).xyz));
 float snowDrift=snowNoise(vSnowWorld.xz*.45)*.65+snowNoise(vSnowWorld.xz*3.1)*.35;
 float snowCover=smoothstep(.3,.7,snowLevel+(snowDrift-.5)*.5);
 // A shovelled finish keeps snow only in thin, broken patches.
 snowCover*=uSnowDepth<1.0?uSnowDepth*smoothstep(.5,.78,snowDrift):1.0;
 snowCover*=uSnowOn;
 // three r185 lights from diffuseContribution and specularColorBlended (the metal-weighted pair), so snow sets those too.
 vec3 snowWhite=vec3(${r.toFixed(2)},${g.toFixed(2)},${b.toFixed(2)});
 material.diffuseColor=mix(material.diffuseColor,snowWhite,snowCover);
 material.diffuseContribution=mix(material.diffuseContribution,snowWhite,snowCover);
 material.specularColor=mix(material.specularColor,vec3(.04),snowCover);
 material.specularColorBlended=mix(material.specularColorBlended,vec3(.04),snowCover);
 material.roughness=mix(material.roughness,${SNOW.roughness.toFixed(2)},snowCover);
}`);
 }});
 return true;
}

// Photo mode: the path tracer never runs the snow patch, so it bakes the same drifts into vertex colours (S3).
const hash=(x:number,y:number)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);};
function noise(x:number,y:number){
 const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
 const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);
 return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;
}
const smooth=(e0:number,e1:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t);};
/** How much snow a point holds, as the raster shader works it out: level surfaces, broken by drifts. */
export function snowCover(normalY:number,worldX:number,worldZ:number){
 const drift=noise(worldX*.45,worldZ*.45)*.65+noise(worldX*3.1,worldZ*3.1)*.35;
 return smooth(.3,.7,normalY+(drift-.5)*.5);
}
/** True when photo mode should bake snow onto this material (winter, and a surface that takes full snow). */
export const photoSnowFor=(material:THREE.Material)=>SNOW_ON.value>0&&snowRole(material)==='full';
