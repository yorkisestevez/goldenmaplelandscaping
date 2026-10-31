import * as THREE from 'three';

/**
 * Board grain on screen (Real Life G2). A swatch material samples its atlas (swatchMaps.ts) so every board shows its
 * own strip of the photo, slid along and sometimes flipped end for end, instead of one picture repeated on every board.
 *
 * Two ways to find a board's place on the grain:
 * - Its own UVs ("mesh"): u runs along the grain at 48 in per repeat and v across the board, as FinishedBoards,
 *   PolygonBoard and the skirting build them. Each whole unit of v is another board course (skirting). The attribute
 *   aVar = (strip seed, offset seed, flip, board) seeds which strip and how far along, says which way round, and marks
 *   a finished board piece (per-tile grain and edge shade, below).
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
flat varying float vDcBoard;
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
  vDcBoard=0.;
#else
  vDcUv=vec2(uv.x*(aVar.z>.5?-1.:1.),uv.y);
  vDcVar=aVar.xy;
  vDcBoard=aVar.w;
#endif
}`;
/**
 * Finished board pieces (FinishedBoards: deck boards, treads, risers, accents) set aVar.w to BOARD_PIECE and get the two
 * board looks below; every other user of a swatch material (fascia, cladding, skirting, timbers, the box-projected framing)
 * keeps one strip and offset over the piece, as before.
 *
 * A board keeps one strip (one tone) its whole length; every 48 in tile the grain slides to a new offset, handing over
 * across the last GRAIN_BLEND of each tile, so a long board never shows one stretch of grain twice running. Each board
 * starts its tiles at its own seed, so the handovers never line up across the deck. The offset is an integer hash, so a tile boundary's two lookups agree
 * exactly on every GPU; grainPick is the same pick for check-deck-realism.
 */
/** 2, not 1: a mesh with no aVar attribute (the notched stringers) reads WebGL's default generic attribute (0,0,0,1). */
export const BOARD_PIECE=2;
export const GRAIN_BLEND=.12;
/** Seeds are quantised to 1/SEED_STEPS, so the shader's float32 seed and the check's float64 one almost always hash alike. */
const SEED_STEPS=65536,HASH_KEY=0x9e3779b9;
const mix32=(h:number)=>{h=(h^(h>>>16))>>>0;h=Math.imul(h,0x7feb352d)>>>0;h=(h^(h>>>15))>>>0;h=Math.imul(h,0x846ca68b)>>>0;return (h^(h>>>16))>>>0;};
/** The strip (0 to strips-1, the board's own) and offset along it (0–1) of tile `tile` of a board whose seed is (x 0–1, y). */
export function grainPick(x:number,y:number,tile:number,strips:number):[number,number]{
  const a=Math.floor(x*SEED_STEPS)>>>0,b=Math.floor((y-Math.floor(y))*SEED_STEPS)>>>0;
  const h=mix32((mix32((a^mix32((b+HASH_KEY)>>>0))>>>0)+(tile|0))>>>0);
  return [Math.min(Math.floor(x*strips),strips-1),(h>>>8)/16777216];
}
/** How far a point `f` (0–1) along its tile has handed over to the next tile's grain. */
export function grainBlend(f:number){
  if(f<=1-GRAIN_BLEND)return 0;
  if(f>=1)return 1;
  const t=(f-(1-GRAIN_BLEND))/GRAIN_BLEND;
  return t*t*(3-2*t);
}
/**
 * Board lines that hold at a distance. A 3/16 in gap and a 1/8 in ease are under a pixel a few metres off, so the deck
 * reads as a slab. Each board's long edges shade into the gap over `band` of its width (about 1/4 in on a 5.5 in
 * board), never narrower than a pixel (`px`, its width per pixel), fading out once the whole board is a few pixels wide.
 * As the band narrows to a pixel the gap itself goes sub-pixel and rasterises as dots, so the line darkens from `dark`
 * to `farDark` (between `farFrom` and `farTo` px) and carries the board line unbroken.
 * The shade is divided by its own mean across the board, so the board's average colour stays the product's.
 */
export const EDGE_SHADE={dark:.62,farDark:.3,farFrom:.02,farTo:.07,band:.045,fadeFrom:.12,fadeTo:.35,sideFace:1e-6};
const smooth=(a:number,b:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
/** The shader's dcEdgeShade: the colour scale at `across` (0–1 over the board's width), `px` board widths a pixel. A
 * board's long sides carry one `across` value over the whole face (px 0): they are left alone, so a tread nosing or
 * the outer board above the rim never grows a dark fringe. */
export function edgeShade(across:number,px:number){
  if(px<=EDGE_SHADE.sideFace)return 1;
  const dark=EDGE_SHADE.dark+(EDGE_SHADE.farDark-EDGE_SHADE.dark)*smooth(EDGE_SHADE.farFrom,EDGE_SHADE.farTo,px);
  const edge=Math.min(across,1-across),band=Math.max(EDGE_SHADE.band,px),depth=(1-dark)*(1-smooth(EDGE_SHADE.fadeFrom,EDGE_SHADE.fadeTo,px));
  return (1-depth*(1-smooth(0,band,edge)))/(1-depth*band);
}
/** A JS number as a GLSL float literal: an integer gets its decimal point, or GLSL reads it as an int. */
const glslFloat=(n:number)=>Number.isInteger(n)?n.toFixed(1):String(n);
const FRAGMENT_HEAD=/* glsl */`
uniform float uStrips;
varying vec2 vDcUv;
flat varying vec2 vDcVar;
flat varying float vDcBoard;
vec2 dcUvA;vec2 dcUvB;float dcW;vec2 dcDx;vec2 dcDy;float dcEdgeK=0.;
highp uint dcMix(highp uint h){h^=h>>16u;h*=0x7feb352du;h^=h>>15u;h*=0x846ca68bu;h^=h>>16u;return h;}
float dcPick(vec2 s,float tile){highp uint a=uint(s.x*${glslFloat(SEED_STEPS)}),b=uint(fract(s.y)*${glslFloat(SEED_STEPS)}),h=dcMix(dcMix(a^dcMix(b+${HASH_KEY}u))+uint(int(tile)));return float(h>>8u)/16777216.;}
vec4 dcTex(sampler2D t){vec4 a=textureGrad(t,dcUvA,dcDx,dcDy);return dcW>0.?mix(a,textureGrad(t,dcUvB,dcDx,dcDy),dcW):a;}
float dcEdgeShade(float v){float px=fwidth(v);if(vDcBoard<${glslFloat(BOARD_PIECE-.5)}||px<=${EDGE_SHADE.sideFace.toExponential()}*max(1.,abs(v)))return 1.;float e=min(fract(v),1.-fract(v)),band=max(${glslFloat(EDGE_SHADE.band)},px),f=1.-smoothstep(${glslFloat(EDGE_SHADE.fadeFrom)},${glslFloat(EDGE_SHADE.fadeTo)},px),d=${glslFloat(1-EDGE_SHADE.dark)}+${glslFloat(EDGE_SHADE.dark-EDGE_SHADE.farDark)}*smoothstep(${glslFloat(EDGE_SHADE.farFrom)},${glslFloat(EDGE_SHADE.farTo)},px);dcEdgeK=(1.-smoothstep(0.,band,e))*f;return(1.-d*dcEdgeK)/(1.-d*band*f);}`;
/** Finished board pieces shade their long edges, and the eased edge goes matte there: a sub-pixel sun glint on a 1/8 in
 * radius only shows as a dotted line. Everything else is left as it was. */
const EDGE_FRAGMENT=/* glsl */`
diffuseColor.rgb*=dcEdgeShade(vDcUv.y);`;
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
const FRAGMENT_PICK=/* glsl */`
    float course=floor(vDcUv.y),across=vDcUv.y-course,dcV=${GUTTER}+clamp(across,0.,1.)*${BODY};
    vec2 seed=vec2(fract(vDcVar.x+course*.6180339),vDcVar.y+course*.37);float st=(min(floor(seed.x*uStrips),uStrips-1.)+dcV)/uStrips;
    if(vDcBoard>${glslFloat(BOARD_PIECE-.5)}){float g=vDcUv.x+seed.y,tile=floor(g);dcUvA=vec2(g+dcPick(seed,tile),st);dcUvB=vec2(g+dcPick(seed,tile+1.),st);dcW=smoothstep(${glslFloat(1-GRAIN_BLEND)},1.,g-tile);}else{dcUvA=dcUvB=vec2(vDcUv.x+seed.y,st);dcW=0.;}
    vec2 scale=vec2(1.,${BODY}/uStrips);dcDx=dFdx(vDcUv)*scale;dcDy=dFdy(vDcUv)*scale;`;
const FRAGMENT_UV=/* glsl */`
  {${FRAGMENT_PICK}
  }`;
const FRAGMENT_UV_RELIEF=/* glsl */`
  {${FRAGMENT_PICK}
    float dcHeight=dcTex(normalMap).a;vec3 dcView=normalize(vViewPosition);
    dcKeep=smoothstep(${RELIEF_EDGE},${RELIEF_FULL},abs(dot(normalize(vNormal),dcView)));
    vec2 dcShift=dcView.xy*(dcHeight-.5)*.03*dcKeep;dcUvA+=dcShift;dcUvB+=dcShift;
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
  // Deck boards and treads are shovelled in winter (seasonSnow.ts reads this; no import keeps the snow code out of here).
  material.userData.snow='dust';
  material.customProgramCacheKey=()=>`${SURFACE_PROGRAM}:${surface.box?'box':'mesh'}:${surface.relief.value?'relief':''}`;
  material.onBeforeCompile=shader=>{
    shader.uniforms.uStrips=surface.strips;
    if(surface.box)shader.defines={...shader.defines,DC_BOX_UV:''};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\n${VERTEX_HEAD}`).replace('#include <uv_vertex>','#include <uv_vertex>\n  dcBoard();');
    const relief=surface.relief.value;
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>\n${relief?FRAGMENT_HEAD_RELIEF:FRAGMENT_HEAD}`)
      .replace('#include <map_fragment>',`${relief?FRAGMENT_UV_RELIEF:FRAGMENT_UV}\n${chunk('map_fragment','texture2D( map, vMapUv )','dcTex( map )')}${EDGE_FRAGMENT}`)
      .replace('#include <roughnessmap_fragment>',chunk('roughnessmap_fragment','texture2D( roughnessMap, vRoughnessMapUv )','dcTex( roughnessMap )')+'\nroughnessFactor=mix(roughnessFactor,1.,dcEdgeK);')
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

/** The per-board attribute value (strip seed, offset, flip, finished board piece) for a board at plan position (x, z):
 * stable while it stays put. `board` marks a finished board piece, which gets per-tile grain and the edge shade. */
export function boardVariation(x:number,z:number,board=false):[number,number,number,number]{
  const h=(a:number,b:number)=>{const s=Math.sin(x*a+z*b)*43758.5453;return s-Math.floor(s);};
  return [h(12.9898,78.233),h(39.3468,11.135),h(73.156,52.235)>.5?1:0,board?BOARD_PIECE:0];
}
