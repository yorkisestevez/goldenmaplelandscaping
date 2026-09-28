import * as THREE from 'three';
import {LAWN_MEAN} from './lawnSurface';

/**
 * The railing glass, frameless (FramelessGlass3D.tsx) and framed (RailingDetails.tsx): clear 1/2 in glass with a slight
 * green edge tint. All light it doesn't reflect passes through (transmission 1): real glass scatters none of its own,
 * and the 13% left at .87 turned sunlit panels milky grey. Its reflections below the horizon take the lawn's hue: the sky
 * HDRI's ground is a brown field (linear about .15, .11, .06) that the scene covers with its lawn, so glass mirroring it
 * at a slant read amber. The environment's strength is the scene's: three ignores envMapIntensity when a material has no
 * envMap of its own.
 */
const luminance=(c:readonly number[])=>.2126*c[0]+.7152*c[1]+.0722*c[2];
/** The lawn's hue: its mean colour (linear) over its luminance, so the sky map's own brightness carries over. */
export const GLASS_GROUND_HUE=LAWN_MEAN.map(c=>c/luminance(LAWN_MEAN)) as [number,number,number];
const LIGHTS:[string,string]=['lights_fragment_maps','radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );'];
/** The chunks and lines the glass patch rewrites or calls (check-deck-realism checks they exist). */
export const GLASS_CHUNKS:[string,string][]=[LIGHTS,['common','vec3 transformDirectionByInverseViewMatrix(']];

const GLASS_GROUND=/* glsl */`
vec3 glassGround(vec3 env,vec3 viewDir,vec3 normal){
  float below=1.-smoothstep(-.05,0.,transformDirectionByInverseViewMatrix(reflect(-viewDir,normal),viewMatrix).y);
  return mix(env,dot(env,vec3(.2126,.7152,.0722))*vec3(${GLASS_GROUND_HUE.map(v=>v.toFixed(4)).join(',')}),below);
}`;

function chunk(name:string,from:string,to:string){
  const source=(THREE.ShaderChunk as Record<string,string>)[name];
  if(!source?.includes(from))throw new Error(`Railing glass: ShaderChunk.${name} no longer has "${from}"`);
  return source.split(from).join(to);
}

/** A new railing glass material (the caller disposes it). depthWrite stays off so the ambient occlusion pass skips it. */
export function railingGlassMaterial(){
  const m=new THREE.MeshPhysicalMaterial({color:'#e5f1eb',roughness:.065,metalness:0,transmission:1,ior:1.52,thickness:.5,attenuationColor:'#92bda6',attenuationDistance:150,transparent:true,opacity:1,depthWrite:false});
  m.userData.photoRole='glass';
  m.customProgramCacheKey=()=>'dc-railing-glass-v1';
  m.onBeforeCompile=shader=>{
    const [name,line]=LIGHTS;
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\n${GLASS_GROUND}`)
      .replace(`#include <${name}>`,chunk(name,line,'radiance += glassGround( getIBLRadiance( geometryViewDir, geometryNormal, material.roughness ), geometryViewDir, geometryNormal );'));
  };
  return m;
}
