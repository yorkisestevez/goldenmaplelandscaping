import * as THREE from 'three';
import {addMaterialPatch} from './materialPatches';
/** Colour spill from the photographed lawn is too saturated for legible grey
 * product comparisons. Desaturate only diffuse daylight IBL, preserving its
 * measured luminance, direction and shadows. Specular sky and fixtures remain
 * photographic. Evening (environment strength .16) remains unchanged. */
export const WALL_DAYLIGHT_SATURATION=.2;
export function wallDiffuseIrradiance(rgb:[number,number,number],environmentIntensity:number):[number,number,number]{
 const t=Math.min(1,Math.max(0,(environmentIntensity-.3)/.7)),blend=t*t*(3-2*t)*(1-WALL_DAYLIGHT_SATURATION),y=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
 return rgb.map(v=>v+(y-v)*blend) as [number,number,number];
}
export function applyWallDaylight(material:THREE.MeshStandardMaterial){
 addMaterialPatch(material,{key:'wall-daylight-diffuse-v1',apply:shader=>{
  const source=THREE.ShaderChunk.lights_fragment_maps,needle='iblIrradiance += getIBLIrradiance( geometryNormal );';
  if(!source.includes(needle))throw Error('Wall daylight: Three diffuse IBL shader changed.');
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',source.replace(needle,`{
   vec3 wallIbl = getIBLIrradiance( geometryNormal );
   float wallLum = dot(wallIbl,vec3(.2126,.7152,.0722));
   float wallNeutral = smoothstep(.3,1.,envMapIntensity) * ${1-WALL_DAYLIGHT_SATURATION};
   iblIrradiance += mix(wallIbl,vec3(wallLum),wallNeutral);
  }`));
 }});
 return material;
}
