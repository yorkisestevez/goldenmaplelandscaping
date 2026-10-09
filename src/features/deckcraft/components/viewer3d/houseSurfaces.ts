import * as THREE from 'three';
import masonryDetail from './assets/masonry-detail.webp';
import masonryNormal from './assets/masonry-normal.webp';
import rockDetail from './assets/rock-detail.webp';
import rockNormal from './assets/rock-normal.webp';
import {HOUSE_SURFACES,type HouseSurface} from './houseSurfaceKinds';
import {surfaceReliefTextures} from './surfaceDetail';
import type {DetailKind} from './detailMaps';

/**
 * The house's surface detail (Real Life G4) on HouseParts' instanced boxes: a grey detail map (linear, mean 0.5) that the
 * cladding's colour, doubled, multiplies, so the wall keeps its colour on average, and a normal map for the relief.
 * Each face is projected in its own plane with the longer side of the piece along u, and each piece is slid to its own
 * spot on the scan. Materials start with one-pixel stand-ins and swap in the shared textures once loaded, so no shader
 * recompiles; the textures are shared and live for the page.
 */
export const HOUSE_PROGRAM='dc-house-v1';
const pixel=(r:number,g:number,b:number)=>{const t=new THREE.DataTexture(new Uint8Array([r,g,b,255]),1,1);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.needsUpdate=true;return t;};
const HALF=pixel(128,128,128),FLAT=pixel(128,128,255);

type Set='masonry'|'rock'|'grain';
interface Maps{map:THREE.Texture;normalMap:THREE.Texture}
const loaded=new Map<Set,Promise<Maps>>();
/** A fine grain for painted boards: long streaks of relief along u, made once in code (no download). */
function grainNormal(){
  const w=512,h=64,height=new Float32Array(w*h),hash=(x:number,y:number)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);};
  const noise=(x:number,y:number,wrapX:number)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),at=(a:number,b:number)=>hash(((a%wrapX)+wrapX)%wrapX,((b%16)+16)%16);return (at(ix,iy)*(1-sx)+at(ix+1,iy)*sx)*(1-sy)+(at(ix,iy+1)*(1-sx)+at(ix+1,iy+1)*sx)*sy;};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)height[y*w+x]=noise(x/32,y/4,16)*.6+noise(x/8,y/1.6,64)*.4;
  const data=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const at=(a:number,b:number)=>height[((b+h)%h)*w+((a+w)%w)],dx=(at(x+1,y)-at(x-1,y))*2,dy=(at(x,y+1)-at(x,y-1))*2,n=1/Math.hypot(dx,dy,1),i=(y*w+x)*4;
    data[i]=Math.round((-dx*n*.5+.5)*255);data[i+1]=Math.round((-dy*n*.5+.5)*255);data[i+2]=Math.round((n*.5+.5)*255);data[i+3]=255;
  }
  const t=new THREE.DataTexture(data,w,h);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;
}
function mapsFor(set:Set,anisotropy:number):Promise<Maps>{
  const hit=loaded.get(set);if(hit)return hit;
  const load=(url:string)=>new THREE.TextureLoader().loadAsync(url).then(t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.NoColorSpace;t.anisotropy=anisotropy;return t;});
  const job=set==='grain'?Promise.resolve({map:HALF,normalMap:grainNormal()}):Promise.all(set==='masonry'?[load(masonryDetail),load(masonryNormal)]:[load(rockDetail),load(rockNormal)]).then(([map,normalMap])=>({map,normalMap}));
  loaded.set(set,job);return job;
}

const VERTEX=/* glsl */`
uniform float uRepeat;varying vec2 vHouseUv;flat varying vec2 vHouseShift;`;
const VERTEX_UV=/* glsl */`
  {
  #ifdef USE_INSTANCING
    vec3 hs=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz)),hseed=instanceMatrix[3].xyz;
  #else
    vec3 hs=vec3(1.),hseed=vec3(0.);
  #endif
    vec3 hp=position*hs,hn=abs(normal);
    vec2 st=hn.x>.5?hp.zy:hn.y>.5?hp.xz:hp.xy,ext=hn.x>.5?hs.zy:hn.y>.5?hs.xz:hs.xy;
    if(ext.y>ext.x)st=st.yx;
    vHouseUv=st/uRepeat;
    vHouseShift=vec2(fract(sin(dot(hseed,vec3(12.9898,78.233,37.719)))*43758.5453),fract(sin(dot(hseed,vec3(39.346,11.135,83.155)))*43758.5453));
  }`;
const FRAGMENT=/* glsl */`
varying vec2 vHouseUv;flat varying vec2 vHouseShift;
vec4 houseTex(sampler2D t){return textureGrad(t,vHouseUv+vHouseShift,dFdx(vHouseUv),dFdy(vHouseUv));}`;
const FRAGMENT_RELIEF=/* glsl */`
uniform sampler2D uRelief;uniform sampler2D uReliefRough;
varying vec2 vHouseUv;flat varying vec2 vHouseShift;
vec4 houseTex(sampler2D t){vec3 dcView=normalize(vViewPosition);float dcH=texture2D(uRelief,vHouseUv).a;float dcParallax=smoothstep(0.12,0.42,abs(dot(normalize(vNormal),dcView)));vec2 uv=vHouseUv+vHouseShift+dcView.xy*(dcH-.5)*.028*dcParallax;return textureGrad(t,uv,dFdx(vHouseUv),dFdy(vHouseUv));}`;
const reliefKind=(surface:HouseSurface):DetailKind=>surface==='woodgrain'?'siding':surface==='rock'?'stone':surface==='stucco'?'slab':'paver';
function chunk(name:string,from:string,to:string){
  const source=(THREE.ShaderChunk as Record<string,string>)[name];
  if(!source?.includes(from))throw new Error(`houseSurfaces: ShaderChunk.${name} no longer has "${from}"`);
  return source.split(from).join(to);
}

/** A HouseParts material with surface detail; the colour is doubled against the detail map's mean of 0.5. */
export function houseSurfaceMaterial(surface:HouseSurface,color:string,roughness:number,metalness:number,anisotropy=4,onLoad?:()=>void,relief=false){
  const spec=HOUSE_SURFACES[surface],material=new THREE.MeshStandardMaterial({color:new THREE.Color(color).multiplyScalar(2),roughness,metalness,map:HALF,normalMap:FLAT,normalScale:new THREE.Vector2(spec.normalScale,spec.normalScale)});
  const detail=relief?surfaceReliefTextures(reliefKind(surface)):null;
  material.customProgramCacheKey=()=>relief?`${HOUSE_PROGRAM}:relief`:HOUSE_PROGRAM;
  material.onBeforeCompile=shader=>{
    shader.uniforms.uRepeat={value:spec.repeatIn};
    if(detail){shader.uniforms.uRelief={value:detail.normal};shader.uniforms.uReliefRough={value:detail.roughness};}
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\n${VERTEX}`).replace('#include <uv_vertex>',`#include <uv_vertex>\n${VERTEX_UV}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\n${relief?FRAGMENT_RELIEF:FRAGMENT}`)
      .replace('#include <map_fragment>',chunk('map_fragment','texture2D( map, vMapUv )','houseTex( map )'))
      .replace('#include <normal_fragment_begin>',chunk('normal_fragment_begin','vNormalMapUv','vHouseUv'))
      .replace('#include <normal_fragment_maps>',chunk('normal_fragment_maps','texture2D( normalMap, vNormalMapUv )','houseTex( normalMap )')+(relief?'\nvec3 dcReliefN=texture2D(uRelief,vHouseUv).xyz*2.0-1.0;\nfloat dcKeep=smoothstep(0.12,0.42,abs(dot(normalize(nonPerturbedNormal),normalize(vViewPosition))));\nnormal=normalize(mix(nonPerturbedNormal,normalize(normal+vec3(dcReliefN.xy,0.0)*0.85),dcKeep));':''))
      .replace('#include <roughnessmap_fragment>',relief?'#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor*mix(0.86,1.14,texture2D(uReliefRough,vHouseUv).r),0.04,1.0);':'#include <roughnessmap_fragment>');
  };
  let alive=true;
  mapsFor(spec.set,anisotropy).then(maps=>{if(alive){Object.assign(material,maps);onLoad?.();}});
  const dispose=material.dispose.bind(material);material.dispose=()=>{alive=false;dispose();};
  return material;
}

/**
 * The same scans on geometry that carries its own UVs in inches over the repeat (the yard's merged pieces, Real Life G5):
 * a plain standard material, no shader patch. The colour is doubled against the detail map's mean of 0.5.
 */
export function scanMaterial(set:'masonry'|'rock',color:string,{roughness=.9,normalScale=.8,anisotropy=4,vertexColors=false,onLoad}:{roughness?:number;normalScale?:number;anisotropy?:number;vertexColors?:boolean;onLoad?:()=>void}={}){
  const material=new THREE.MeshStandardMaterial({color:new THREE.Color(color).multiplyScalar(2),roughness,metalness:0,vertexColors,map:HALF,normalMap:FLAT,normalScale:new THREE.Vector2(normalScale,normalScale)});
  let alive=true;
  mapsFor(set,anisotropy).then(maps=>{if(alive){Object.assign(material,maps);onLoad?.();}});
  const dispose=material.dispose.bind(material);material.dispose=()=>{alive=false;dispose();};
  return material;
}
