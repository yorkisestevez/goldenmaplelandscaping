import {useEffect,useLayoutEffect,useMemo,useSyncExternalStore} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {DeckData} from '../../types';
import type {LandscapeObject} from '../../landscapeTypes';
import {getShowcaseFlags,subscribeShowcase} from '../../showcaseMode';
import {useSceneEvening} from './sceneEvening';
import {BED_RELIEF,finishGeometry,reliefGround,type BedRelief} from './bedRelief';
import type {LandscapePoint} from '../../landscapeTypes';
import {MULCH_LIP,stemRadiusIn,type PlantSeat} from './plantSeating';
import type {GroundBounds} from './groundOcclusion';

/**
 * Where a plant meets the ground (render only).
 * - Collar and lip, for plants in a mulch or stone bed: the mulch pulled back from the stems shows the dark soil
 *   (a COLLAR_SIDES-gon at the surface + 0.04 in), ringed by a lip of mulch 1¾ in wide that rises 0.6 in, its cut face
 *   soil. Drawn with the bed's own material (soil is the vertex colour), so it is opaque, takes the bed's light and
 *   occlusion, picks as the bed, and Photo mode traces it.
 * - Shade ring, for every plant on every tier: a soft multiply ring on the ground where stems meet it, which the sky's
 *   light (an environment map, with no shadows) cannot darken. Low plants 0.45 × width (at most 30 in); trees the trunk
 *   + 10 in, the canopy's shade left to real shadows. Its strength follows the light (faint at night) and Photo mode
 *   skips it, since the tracer makes its own contact shade. It casts nothing, so shadow maps are unchanged.
 */
export const COLLAR_SIDES=12,COLLAR_LIFT_IN=.04;
export const SHADE_RING={lowShare:.45,lowMaxIn:30,treeReachIn:10,liftIn:.02,day:.38,golden:.3,night:.1};
export const shadeRingRadiusIn=(o:LandscapeObject,seat:PlantSeat)=>seat.form==='tree'?stemRadiusIn(o)+SHADE_RING.treeReachIn:Math.min(SHADE_RING.lowMaxIn,SHADE_RING.lowShare*Math.max(o.widthIn,o.depthIn));
export const collarRadiusIn=(o:LandscapeObject,seat:PlantSeat)=>stemRadiusIn(o)+seat.pullIn;

/** One bed's collars and lips as a world-foot triangle list with uv, uv1 and colour (soil on the collar and cut face). */
export function collarGeometry(data:DeckData,plants:{object:LandscapeObject;seat:PlantSeat}[],soil:THREE.Color,polys:LandscapePoint[][],relief?:BedRelief,bounds?:GroundBounds){
 const ground=reliefGround(data),positions:number[]=[],soilFlags:boolean[]=[];
 const surface=(x:number,z:number,seat:PlantSeat)=>relief?ground.height(x,z)+relief.rise(x,z):seat.surfaceIn;
 const tri=(a:number[],b:number[],c:number[],isSoil:boolean)=>{
  // Outward or upward faces keep three's front side: counter-clockwise seen from outside.
  positions.push(...a,...b,...c);soilFlags.push(isSoil,isSoil,isSoil);
 };
 for(const {object:o,seat} of plants){
  const cx=seat.x,cz=seat.z,fit=collarFit(o,seat,polys);if(!fit)continue;const [r0,r1]=fit,centre=[cx/12,(surface(cx,cz,seat)+COLLAR_LIFT_IN)/12,cz/12];
  const ring=(r:number,lift:number)=>Array.from({length:COLLAR_SIDES},(_,i)=>{const a=i/COLLAR_SIDES*Math.PI*2,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;return [x/12,(surface(x,z,seat)+lift)/12,z/12];});
  const disc=ring(r0,COLLAR_LIFT_IN),wallTop=ring(r0,MULCH_LIP.riseIn),foot=ring(r1,-.05);
  for(let i=0;i<COLLAR_SIDES;i++){
   const j=(i+1)%COLLAR_SIDES;
   tri(centre,disc[j],disc[i],true);
   // The lip's cut face looks in, toward the stems; its top slopes out and down into the bed's mulch.
   tri(disc[i],disc[j],wallTop[j],true);tri(disc[i],wallTop[j],wallTop[i],true);
   tri(wallTop[i],wallTop[j],foot[j],false);tri(wallTop[i],foot[j],foot[i],false);
  }
 }
 return finishGeometry(positions,soilFlags,soil,bounds);
}

/** Close-up chips and stones keep off the soil of the spade cut and every collar and lip (with a 2 in margin), and sit on
 * the drawn top, up the cut's slope too. The kept-off zones are laid into a 1 in grid per bed once, so placing a chip
 * costs one array read; only a chip on the cut's slope measures its exact height. */
export interface ChipClearance{rise?:(x:number,z:number)=>number;clear:(x:number,z:number,r:number)=>boolean}
export const CHIP_MARGIN_IN=2;
export function chipClearance(relief:BedRelief|undefined,plants:{object:LandscapeObject;seat:PlantSeat}[],polys:LandscapePoint[][]):ChipClearance|undefined{
 const collars=plants.flatMap(({object:o,seat})=>{const fit=collarFit(o,seat,polys);return fit?[{x:seat.x,z:seat.z,r:fit[1]}]:[];});
 if(!relief&&!collars.length)return undefined;
 const {edgeIn,topIn,taperIn,soilShare}=BED_RELIEF,soil=taperIn*soilShare,m=CHIP_MARGIN_IN;
 const pts=[...(relief?.polys.flat()??[]),...collars.flatMap(c=>[{x:c.x-c.r,z:c.z-c.r},{x:c.x+c.r,z:c.z+c.r}])];
 const x0=Math.floor(Math.min(...pts.map(p=>p.x)))-1,z0=Math.floor(Math.min(...pts.map(p=>p.z)))-1,w=Math.ceil(Math.max(...pts.map(p=>p.x)))-x0+2,h=Math.ceil(Math.max(...pts.map(p=>p.z)))-z0+2;
 // 1: no chip here; 2: on the cut's slope (measure the height). Cell centres decide; the margin covers the half-diagonal.
 const cells=new Uint8Array(w*h),mark=(cx0:number,cz0:number,cx1:number,cz1:number,f:(x:number,z:number)=>number)=>{
  for(let i=Math.max(0,Math.floor(cx0)-x0);i<=Math.min(w-1,Math.ceil(cx1)-x0);i++)for(let j=Math.max(0,Math.floor(cz0)-z0);j<=Math.min(h-1,Math.ceil(cz1)-z0);j++)cells[i*h+j]|=f(x0+i+.5,z0+j+.5);
 };
 if(relief)for(const s of relief.tapered){const reach=taperIn+1;mark(Math.min(s.ax,s.bx)-reach,Math.min(s.az,s.bz)-reach,Math.max(s.ax,s.bx)+reach,Math.max(s.az,s.bz)+reach,(x,z)=>{const d=relief.cutDistance(x,z);return (d<soil+m?1:0)|(d<taperIn?2:0);});}
 for(const c of collars){const r=c.r+m;mark(c.x-r,c.z-r,c.x+r,c.z+r,(x,z)=>(x-c.x)**2+(z-c.z)**2<r*r?1:0);}
 const at=(x:number,z:number)=>{const i=Math.floor(x)-x0,j=Math.floor(z)-z0;return i<0||j<0||i>=w||j>=h?0:cells[i*h+j];};
 return {clear:(x,z)=>!(at(x,z)&1),rise:relief?(x,z)=>at(x,z)&2?edgeIn+(topIn-edgeIn)*relief.cutDistance(x,z)/taperIn:topIn:undefined};
}

/** Collar and lip radii (inches) that stay inside the bed's drawn area (polys: its landscapeBedAreas rings, raised or not):
 * near its edge the lip narrows, then the collar; a plant whose stems are too close to the edge for a collar gets none
 * (its shade ring still draws). */
export function collarFit(o:LandscapeObject,seat:PlantSeat,polys:LandscapePoint[][]):[number,number]|undefined{
 let r0=collarRadiusIn(o,seat),r1=r0+MULCH_LIP.widthIn;
 {let edge=Infinity;for(const ring of polys)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((seat.x-a.x)*dx+(seat.z-a.z)*dz)/(dx*dx+dz*dz||1)));edge=Math.min(edge,Math.hypot(seat.x-a.x-t*dx,seat.z-a.z-t*dz));}
  if(edge<r1+.25){r1=edge-.25;r0=Math.min(r0,r1-.75);}}
 return r0>=stemRadiusIn(o)*.8?[r0,r1]:undefined;
}

const RING_VERTEX=/* glsl */`
varying vec2 vRing;
void main(){
 vRing=uv*2.-1.;
 vec4 p=vec4(position,1.);
 #ifdef USE_INSTANCING
 p=instanceMatrix*p;
 #endif
 gl_Position=projectionMatrix*modelViewMatrix*p;
}`;
const RING_FRAGMENT=/* glsl */`
uniform float uStrength;
varying vec2 vRing;
void main(){
 float d=length(vRing);if(d>1.)discard;
 float k=uStrength*pow(1.-d,1.6);
 gl_FragColor=vec4(vec3(1.-k),1.);
}`;
export function createShadeRingMaterial(){
 return new THREE.ShaderMaterial({name:'plant-shade-ring',uniforms:{uStrength:{value:SHADE_RING.day}},vertexShader:RING_VERTEX,fragmentShader:RING_FRAGMENT,
  blending:THREE.MultiplyBlending,premultipliedAlpha:true,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-4});
}
/** A shade ring's world-foot transform: centred on the stems, on the surface, tilted to the ground's slope. */
export function shadeRingMatrix(data:DeckData,o:LandscapeObject,seat:PlantSeat){
 const ground=reliefGround(data),r=shadeRingRadiusIn(o,seat),h=6,{x,z}=seat,dx=(ground.height(x+h,z)-ground.height(x-h,z))/(2*h),dz=(ground.height(x,z+h)-ground.height(x,z-h))/(2*h);
 const normal=seat.raised?new THREE.Vector3(0,1,0):new THREE.Vector3(-dx,1,-dz).normalize();
 return new THREE.Matrix4().compose(new THREE.Vector3(x/12,(seat.surfaceIn+SHADE_RING.liftIn)/12,z/12),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal),new THREE.Vector3(r/12,1,r/12));
}
const ringGeometry=new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2);
export function PlantShadeRings({data,plants}:{data:DeckData;plants:{object:LandscapeObject;seat:PlantSeat}[]}){
 const invalidate=useThree(s=>s.invalidate),evening=useSceneEvening(data.sceneLighting),hour=useSyncExternalStore(subscribeShowcase,()=>getShowcaseFlags().hour,()=>'day');
 const material=useMemo(()=>createShadeRingMaterial(),[]);useEffect(()=>()=>material.dispose(),[material]);
 const mesh=useMemo(()=>new THREE.InstancedMesh(ringGeometry,material,Math.max(1,plants.length)),[material,plants.length]);
 useEffect(()=>()=>mesh.dispose(),[mesh]);
 useLayoutEffect(()=>{
  plants.forEach(({object,seat},i)=>mesh.setMatrixAt(i,shadeRingMatrix(data,object,seat)));
  mesh.count=plants.length;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  mesh.name='plant-shade-rings';mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=true;mesh.raycast=()=>{};
  mesh.userData={photoSkip:true,coversGround:false,renderOnly:true};invalidate();
 },[data,plants,mesh,invalidate]);
 useLayoutEffect(()=>{material.uniforms.uStrength.value=evening||hour==='night'?SHADE_RING.night:hour==='golden'?SHADE_RING.golden:SHADE_RING.day;invalidate();},[material,evening,hour,invalidate]);
 if(!plants.length)return null;
 return <primitive object={mesh} dispose={null}/>;
}
