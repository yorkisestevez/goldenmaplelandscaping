import * as THREE from 'three';

/**
 * Board grain on screen (Real Life G2). A swatch material samples its atlas (swatchMaps.ts) so every board shows its
 * own strip of the photo, slid along and sometimes flipped end for end, instead of one picture repeated on every board.
 *
 * Two ways to find a board's place on the grain:
 * - Its own UVs ("mesh"): u runs along the grain at 48 in per repeat and v across the board, as FinishedBoards,
 *   PolygonBoard and the skirting build them. Each whole unit of v is another board course (skirting). The attribute
 *   aVar = (strip seed, offset, flip, 0) says which strip, how far along and which way round.
 * - Box projection ("box"), for the unit boxes of Members and Boxes (rim, fascia, framing, benches, pickets): the grain
 *   runs along the piece's longest side at 48 in per repeat, across each face, with the strip and offset hashed from
 *   where the piece is.
 *
 * The vertex shader passes continuous board coordinates; the fragment shader picks the strip per pixel and samples
 * with gradients from the continuous coordinates, so course lines never pick a blurry mip.
 */
export const SURFACE_PROGRAM='dc-surface-v1';
/** Rows of each atlas strip: an 8-row gutter above and below 112 rows of board (STRIP_ROWS in swatchMaps.ts). */
const GUTTER=8/128,BODY=112/128;

export interface SurfaceMaps{map:THREE.Texture;normalMap:THREE.Texture;roughnessMap:THREE.Texture}
interface Surface{box:boolean;strips:{value:number};variants:THREE.MeshStandardMaterial[];maps:SurfaceMaps|null;fallback:THREE.Color;standIn:SurfaceMaps;relief:{value:boolean}}
const surfaceOf=(m:THREE.Material)=>m.userData.surface as Surface|undefined;

const VERTEX_HEAD=/* glsl */`
attribute vec4 aVar;
varying vec2 vDcUv;
flat varying vec2 vDcVar;
float dcHash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
void dcBoard(){
#ifdef DC_BOX_UV
  #ifdef USE_INSTANCING
    vec3 s=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz)),seed=instanceMatrix[3].xyz;
  #else
    vec3 s=vec3(1.),seed=vec3(0.);
  #endif
  vec3 p=position*s,n=abs(normal);
  vec3 k=n.x>.5?vec3(1.,0.,0.):n.y>.5?vec3(0.,1.,0.):vec3(0.,0.,1.);
  vec3 g=s.x>=s.y&&s.x>=s.z?vec3(1.,0.,0.):s.y>=s.z?vec3(0.,1.,0.):vec3(0.,0.,1.);
  if(dot(g,k)>.5)g=k.x>.5?vec3(0.,1.,0.):vec3(1.,0.,0.);
  vec3 a=vec3(1.)-g-k;
  float h=dcHash(seed+k*3.1);
  vDcUv=vec2(dot(p,g)/48.*(dcHash(seed.zxy)>.5?-1.:1.),clamp(dot(p,a)/max(dot(s,a),1e-3)+.5,0.,.999));
  vDcVar=vec2(h,fract(h*13.7));
#else
  vDcUv=vec2(uv.x*(aVar.z>.5?-1.:1.),uv.y);
  vDcVar=aVar.xy;
#endif
}`;
const FRAGMENT_HEAD=/* glsl */`
uniform float uStrips;
varying vec2 vDcUv;
flat varying vec2 vDcVar;
vec2 dcUv;vec2 dcDx;vec2 dcDy;
vec4 dcTex(sampler2D t){return textureGrad(t,dcUv,dcDx,dcDy);}`;
/** Edge-on surfaces (a stair tread in a wide hero) drop atlas relief. Face-on boards keep it. */
export const RELIEF_EDGE=0.12,RELIEF_FULL=0.42;
export function reliefWeight(facing:number){
  if(facing<=RELIEF_EDGE)return 0;
  if(facing>=RELIEF_FULL)return 1;
  const t=(facing-RELIEF_EDGE)/(RELIEF_FULL-RELIEF_EDGE);
  return t*t*(3-2*t);
}
const FRAGMENT_HEAD_RELIEF=/* glsl */`${FRAGMENT_HEAD}
float dcKeep;`;
const FRAGMENT_UV=/* glsl */`
  {
    float course=floor(vDcUv.y),across=vDcUv.y-course;
    float strip=min(floor(fract(vDcVar.x+course*.6180339)*uStrips),uStrips-1.);
    dcUv=vec2(vDcUv.x+vDcVar.y+course*.37,(strip+${GUTTER}+clamp(across,0.,1.)*${BODY})/uStrips);
    vec2 scale=vec2(1.,${BODY}/uStrips);dcDx=dFdx(vDcUv)*scale;dcDy=dFdy(vDcUv)*scale;
  }`;
const FRAGMENT_UV_RELIEF=/* glsl */`
  {
    float course=floor(vDcUv.y),across=vDcUv.y-course;
    float strip=min(floor(fract(vDcVar.x+course*.6180339)*uStrips),uStrips-1.);
    dcUv=vec2(vDcUv.x+vDcVar.y+course*.37,(strip+${GUTTER}+clamp(across,0.,1.)*${BODY})/uStrips);
    vec2 scale=vec2(1.,${BODY}/uStrips);dcDx=dFdx(vDcUv)*scale;dcDy=dFdy(vDcUv)*scale;
    float dcHeight=dcTex(normalMap).a;vec3 dcView=normalize(vViewPosition);
    dcKeep=smoothstep(${RELIEF_EDGE},${RELIEF_FULL},abs(dot(normalize(vNormal),dcView)));
    dcUv+=dcView.xy*(dcHeight-.5)*.03*dcKeep;
  }`;

/** The standard chunks with their map lookups sent through the board's atlas coordinates. Throws if three renamed them. */
function chunk(name:string,from:string,to:string){
  const source=(THREE.ShaderChunk as Record<string,string>)[name];
  if(!source?.includes(from))throw new Error(`surfaceShaders: ShaderChunk.${name} no longer has "${from}"`);
  return source.split(from).join(to);
}
/** The chunk names and lookups the patch rewrites (check-deck-realism checks they still exist). */
export const PATCHED_CHUNKS:[string,string][]=[['map_fragment','texture2D( map, vMapUv )'],['normal_fragment_maps','texture2D( normalMap, vNormalMapUv )'],['roughnessmap_fragment','texture2D( roughnessMap, vRoughnessMapUv )'],['normal_fragment_begin','vNormalMapUv'],['uv_vertex','vMapUv']];

function patch(material:THREE.MeshStandardMaterial,surface:Surface){
  material.userData.surface=surface;
  material.customProgramCacheKey=()=>`${SURFACE_PROGRAM}:${surface.box?'box':'mesh'}:${surface.relief.value?'relief':''}`;
  material.onBeforeCompile=shader=>{
    shader.uniforms.uStrips=surface.strips;
    if(surface.box)shader.defines={...shader.defines,DC_BOX_UV:''};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\n${VERTEX_HEAD}`).replace('#include <uv_vertex>','#include <uv_vertex>\n  dcBoard();');
    const relief=surface.relief.value;
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>\n${relief?FRAGMENT_HEAD_RELIEF:FRAGMENT_HEAD}`)
      .replace('#include <map_fragment>',`${relief?FRAGMENT_UV_RELIEF:FRAGMENT_UV}\n${chunk('map_fragment','texture2D( map, vMapUv )','dcTex( map )')}`)
      .replace('#include <roughnessmap_fragment>',chunk('roughnessmap_fragment','texture2D( roughnessMap, vRoughnessMapUv )','dcTex( roughnessMap )'))
      .replace('#include <normal_fragment_begin>',chunk('normal_fragment_begin','vNormalMapUv','vDcUv'))
      .replace('#include <normal_fragment_maps>',chunk('normal_fragment_maps','texture2D( normalMap, vNormalMapUv )','dcTex( normalMap )')+(relief?'\nnormal=normalize(mix(nonPerturbedNormal,normal,dcKeep));':''));
  };
  return material;
}

/**
 * One-pixel stand-ins: the fallback colour, a flat normal and the plain roughness. A swatch material starts with them,
 * so it compiles once with its maps in place, and the atlas arriving later swaps textures without a recompile (on a
 * phone or a software renderer each recompile costs up to a second).
 */
function pixel(r:number,g:number,b:number,colorSpace:THREE.ColorSpace){
  const t=new THREE.DataTexture(new Uint8Array([r,g,b,255]),1,1,THREE.RGBAFormat);
  t.colorSpace=colorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.needsUpdate=true;return t;
}
const FLAT_NORMAL=pixel(128,128,255,THREE.NoColorSpace),PLAIN_ROUGHNESS=pixel(122,122,122,THREE.NoColorSpace);
function standIns(fallback:THREE.Color):SurfaceMaps{
  const c=fallback.clone().convertLinearToSRGB();
  return {map:pixel(Math.round(c.r*255),Math.round(c.g*255),Math.round(c.b*255),THREE.SRGBColorSpace),normalMap:FLAT_NORMAL,roughnessMap:PLAIN_ROUGHNESS};
}

/** A swatch material that samples its atlas per board ("mesh" mode); the solid fallback colour until maps arrive. */
export function surfaceMaterial(color:THREE.ColorRepresentation,relief=false){
  const fallback=new THREE.Color(color),material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,metalness:0});
  const surface:Surface={box:false,strips:{value:1},variants:[],maps:null,fallback,standIn:standIns(fallback),relief:{value:relief}};
  Object.assign(material,surface.standIn);
  return patch(material,surface);
}

/** The same material for unit boxes (Members, Boxes), box-projected; any other material is returned as it is. */
export function boxVariant(material:THREE.Material):THREE.Material{
  const surface=surfaceOf(material);
  if(!surface||surface.box)return material;
  const existing=surface.variants[0];if(existing)return existing;
  // clone() copies userData through JSON, so the surface (materials and textures) is lifted off first.
  const source=material as THREE.MeshStandardMaterial,userData=source.userData;source.userData={};
  const box=patch(source.clone(),{box:true,strips:surface.strips,variants:[],maps:null,fallback:surface.fallback,standIn:surface.standIn,relief:surface.relief});source.userData=userData;
  surface.variants.push(box);return box;
}

/** Puts an atlas's maps on a swatch material and its box variant: a texture swap, never a recompile. */
export function setSurfaceMaps(material:THREE.MeshStandardMaterial,maps:SurfaceMaps,strips:number){
  const surface=surfaceOf(material);if(!surface)return;
  clearSurfaceMaps(material);surface.maps=maps;surface.strips.value=strips;
  for(const m of [material,...surface.variants])Object.assign(m,maps);
}
/** Takes the maps off again (disposing them), back to the one-pixel stand-ins in the fallback colour. */
export function clearSurfaceMaps(material:THREE.MeshStandardMaterial){
  const surface=surfaceOf(material);if(!surface?.maps)return;
  for(const t of Object.values(surface.maps))t.dispose();
  for(const m of [material,...surface.variants])Object.assign(m,surface.standIn);
  surface.maps=null;surface.strips.value=1;
}
/** Disposes a swatch material with its variants, maps and its own stand-in colour. */
export function disposeSurface(material:THREE.MeshStandardMaterial){
  const surface=surfaceOf(material);clearSurfaceMaps(material);
  surface?.standIn.map.dispose();for(const v of surface?.variants??[])v.dispose();material.dispose();
}

/** The per-board attribute value (strip seed, offset, flip) for a board at plan position (x, z): stable while it stays put. */
export function boardVariation(x:number,z:number):[number,number,number,number]{
  const h=(a:number,b:number)=>{const s=Math.sin(x*a+z*b)*43758.5453;return s-Math.floor(s);};
  return [h(12.9898,78.233),h(39.3468,11.135),h(73.156,52.235)>.5?1:0,0];
}
