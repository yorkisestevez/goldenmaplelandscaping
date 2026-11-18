import * as THREE from 'three';
import type {WindowReflection} from './windowReflections';
export interface WindowRoom {x:number;y:number;w:number;h:number;door:boolean}
export interface WindowSurface {reflection:WindowReflection;room:WindowRoom;offset:[number,number,number]}

/**
 * Window glass (Real Life G4): opaque, reflective glass with a room behind it. The sky reflects off the glass as off
 * real double glazing (strongly at a glancing angle, about 11% head-on, the Fresnel term of the standard lighting), and what the
 * glass lets through is a room drawn in the shader ("interior mapping"): the view ray is followed into a box 12 ft deep
 * behind the pane, as wide as the pane plus 3 ft each side, floor 30 in below the pane and 8 ft to the ceiling. Each
 * room projects a furnished staging photograph onto that box, preserving camera parallax. A procedural room is the
 * fallback when no texture is supplied. Daytime reflects the actual deck; evening reveals the warmly lit room.
 * Generic appearance only, not a model of the customer's interior.
 */
/** Double-glazed low-e glass reflects about 11% head-on (plain glass 4%), which is what makes a window read as glass. */
export const WINDOW_ROOM={depthIn:144,sideIn:36,sillIn:30,heightIn:108,dayLevel:.06,glow:[1.1,1.8] as const,litShare:1,f0:.11,ior:2};

const ROOM_PLACEHOLDER=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);ROOM_PLACEHOLDER.needsUpdate=true;
const VERTEX=/* glsl */`
attribute vec2 aPane;
uniform vec3 uPaneOffset;uniform vec2 uRoomHalf;uniform mat4 uReflectionMatrix;
varying vec4 vReflection;
varying vec3 vPaneLocal;varying vec3 vCamLocal;flat varying vec2 vPaneHalf;flat varying float vRoomSeed;`;
const VERTEX_ROOM=/* glsl */`
  vPaneLocal=position+uPaneOffset;vCamLocal=(inverse(modelMatrix)*vec4(cameraPosition,1.)).xyz+uPaneOffset;vPaneHalf=uRoomHalf.x>0.?uRoomHalf:aPane;
  vReflection=uReflectionMatrix*modelMatrix*vec4(position,1.);
  vRoomSeed=fract(sin(dot(modelMatrix[3].xyz,vec3(12.9898,78.233,37.719)))*43758.5453);`;
const FRAGMENT=/* glsl */`
uniform float uEvening,uRoomPhotoReady,uRoomSill,uReflectionReady;uniform sampler2D uRoomPhoto,uDeckReflection;
varying vec4 vReflection;
varying vec3 vPaneLocal;varying vec3 vCamLocal;flat varying vec2 vPaneHalf;flat varying float vRoomSeed;
vec3 windowRoom(){
  vec3 dir=normalize(vPaneLocal-vCamLocal);
  if(dir.z>-1e-3)return vec3(0.);
  float s=vRoomSeed,hw=vPaneHalf.x+${WINDOW_ROOM.sideIn}.,floorY=-vPaneHalf.y-uRoomSill,ceilY=floorY+${WINDOW_ROOM.heightIn}.,depth=${WINDOW_ROOM.depthIn}.;
  vec3 o=vec3(vPaneLocal.xy,0.);
  float tBack=(-depth-o.z)/dir.z,tSide=abs(dir.x)<1e-4?1e9:((dir.x>0.?hw:-hw)-o.x)/dir.x;
  float tFloor=dir.y<0.?(floorY-o.y)/dir.y:1e9,tCeil=dir.y>0.?(ceilY-o.y)/dir.y:1e9;
  float t=min(min(tBack,tSide),min(tFloor,tCeil));
  vec3 hit=o+dir*t;
  // The staged interior photograph projected onto the room box gives photographic surfaces with camera parallax.
  // It is generic visual staging, never a reconstruction of the customer's actual interior.
  if(uRoomPhotoReady>.5){
    // Project the furnished room photograph from one shared opening-space camera onto the room box.
    // Both sliding-door leaves therefore reveal one room, rather than repeating a sofa in every pane.
    // The photograph already contains its floor and ceiling. A continuous back-plane projection avoids
    // projecting those same floorboards a second time onto a foreground triangle at the threshold.
    vec3 look=(o+dir*tBack)-vec3(0.,floorY+60.,18.);
    vec2 uv=clamp(vec2(.5,.47)+look.xy/max(-look.z,24.)*vec2(.40,.63),vec2(.015),vec2(.985));
    vec3 room=texture2D(uRoomPhoto,uv).rgb;
    float lit=step(1.-${WINDOW_ROOM.litShare.toFixed(2)},fract(s*11.73));
    return room*mix(${WINDOW_ROOM.dayLevel},1.65,uEvening);
  }
  vec3 wall=mix(vec3(.74,.70,.62),vec3(.60,.64,.68),fract(s*7.31)),floorC=mix(vec3(.30,.21,.13),vec3(.52,.44,.34),fract(s*3.17)),ceil=vec3(.86);
  vec3 c=t==tFloor?floorC:t==tCeil?ceil:t==tBack?wall:wall*.82;
  float back=clamp(-hit.z/depth,0.,1.);
  vec3 day=c*${WINDOW_ROOM.dayLevel}*(1.-.45*back);
  float lit=step(1.-${WINDOW_ROOM.litShare.toFixed(2)},fract(s*11.73)),strength=mix(${WINDOW_ROOM.glow[0].toFixed(2)},${WINDOW_ROOM.glow[1].toFixed(2)},fract(s*5.91));
  float glow=lit*strength/(1.+pow(length(hit-vec3(0.,ceilY-10.,-depth*.45))/70.,2.));
  vec3 night=c*vec3(1.,.70,.40)*glow;
  vec3 room=mix(day,night,uEvening);
  // A blind drawn part-way down, and curtains at the sides, just behind the glass.
  float up=vPaneLocal.y/vPaneHalf.y*.5+.5,blind=step(1.-.07*fract(s*2.37),up)*step(.6,fract(s*9.1));
  float curtain=step(vPaneHalf.x-vPaneHalf.x*.10*fract(s*4.13),abs(vPaneLocal.x))*step(.55,fract(s*6.7));
  vec3 cloth=mix(vec3(.82,.79,.72),vec3(.55,.58,.60),fract(s*8.9));
  vec3 clothLit=cloth*mix(${(WINDOW_ROOM.dayLevel*1.6).toFixed(3)},lit*strength*.35,uEvening);
  return mix(room,clothLit,max(blind,curtain));
}`;

function patch(material:THREE.MeshPhysicalMaterial,evening:boolean,surface?:WindowSurface){
  material.customProgramCacheKey=()=>'dc-window-v4-deck-reflection';
  material.onBeforeCompile=shader=>{
    shader.uniforms.uEvening={value:evening?1:0};
    shader.uniforms.uRoomPhoto={value:material.userData.roomPhoto??ROOM_PLACEHOLDER};
    shader.uniforms.uRoomPhotoReady={value:material.userData.roomPhoto?1:0};
    shader.uniforms.uPaneOffset={value:new THREE.Vector3(...(surface?.offset??[0,0,0]))};
    shader.uniforms.uRoomHalf={value:new THREE.Vector2(surface?surface.room.w/2:0,surface?surface.room.h/2:0)};
    shader.uniforms.uRoomSill={value:surface?.room.door?0:WINDOW_ROOM.sillIn};
    shader.uniforms.uDeckReflection=surface?.reflection.texture??{value:null};
    shader.uniforms.uReflectionMatrix=surface?.reflection.matrix??{value:new THREE.Matrix4()};
    shader.uniforms.uReflectionReady=surface?.reflection.ready??{value:0};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\n${VERTEX}`).replace('#include <project_vertex>',`#include <project_vertex>\n${VERTEX_ROOM}`);
    // What the glass lets through (1 − Fresnel) of the room adds to its emission; the reflection is the standard one.
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\n${FRAGMENT}`)
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>\n  {float cosV=clamp(dot(normal,normalize(vViewPosition)),0.,1.);float fresnel=${WINDOW_ROOM.f0}+${(1-WINDOW_ROOM.f0).toFixed(2)}*pow(1.-cosV,5.);float reflection=mix(mix(.60,.96,pow(1.-cosV,5.)),fresnel,uEvening);totalEmissiveRadiance+=windowRoom()*(1.-reflection);}`)
      .replace('#include <opaque_fragment>',`if(uReflectionReady>.5&&vReflection.w>0.){float cosV=clamp(dot(normal,normalize(vViewPosition)),0.,1.);float fresnel=${WINDOW_ROOM.f0}+${(1-WINDOW_ROOM.f0).toFixed(2)}*pow(1.-cosV,5.);float strength=mix(mix(.60,.96,pow(1.-cosV,5.)),fresnel,uEvening);outgoingLight+=texture2DProj(uDeckReflection,vReflection).rgb*strength*vec3(.91,.97,1.);}\n#include <opaque_fragment>`);
  };
  return material;
}
/** A pane's own uniforms; panes in an opening share the same room coordinates and facade reflection. */
export function createWindowGlass(evening:boolean,photo:THREE.Texture|null,surface:WindowSurface){
  const m=patch(new THREE.MeshPhysicalMaterial({color:'#000000',roughness:.04,metalness:0,ior:WINDOW_ROOM.ior,envMapIntensity:.18}),evening,surface);
  m.userData.roomPhoto=photo;m.userData.photoRole='glass';return m;
}
const materials=new Map<boolean,THREE.MeshPhysicalMaterial>();
/** The shared glass for day or evening. */
export function windowGlass(evening:boolean,photo?:THREE.Texture){
  let m=materials.get(evening);
  if(!m){m=patch(new THREE.MeshPhysicalMaterial({color:'#000000',roughness:.04,metalness:0,ior:WINDOW_ROOM.ior,envMapIntensity:1}),evening);m.userData.photoRole='glass';materials.set(evening,m);}
  if(photo&&m.userData.roomPhoto!==photo){m.userData.roomPhoto=photo;m.needsUpdate=true;}
  return m;
}
/** A pane w × h in (0.24 in thick), carrying its half size for the room behind it. */
export function paneGeometry(w:number,h:number){
  const g=new THREE.BoxGeometry(Math.max(1,w),Math.max(1,h),.24),n=g.getAttribute('position').count;
  g.setAttribute('aPane',new THREE.Float32BufferAttribute(Array.from({length:n},()=>[Math.max(1,w)/2,Math.max(1,h)/2]).flat(),2));
  return g;
}
