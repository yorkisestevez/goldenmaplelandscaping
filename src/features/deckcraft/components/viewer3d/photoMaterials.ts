import * as THREE from 'three';
import {WATER_OPTICS} from './waterOptics';
import {WINDOW_ROOM} from './windowGlass';
import {skyDomeSampleElevation} from './skyModel';
import {PHOTO_LIGHT,type PhotoLook} from './photoGrade';

const HIDDEN=new Set(['sky-dome','picked-wall-outline','selection-outline','picked-pergola-outline','landscape-mature-overlay']);
let rippleNormal:THREE.DataTexture|null=null;
let caustic:THREE.Texture|null=null;

interface SurfaceRecord{fallback?:THREE.Color}
interface SavedMaterial{
 material:THREE.MeshStandardMaterial;
 color:THREE.Color;emissive:THREE.Color;
 map:THREE.Texture|null;normalMap:THREE.Texture|null;roughnessMap:THREE.Texture|null;emissiveMap:THREE.Texture|null;
 roughness:number;metalness:number;opacity:number;transparent:boolean;depthWrite:boolean;alphaTest:number;side:THREE.Side;
 emissiveIntensity:number;envMapIntensity:number;normalScale:THREE.Vector2;
 transmission:number;thickness:number;ior:number;attenuationDistance:number;attenuationColor:THREE.Color;
}
interface SavedLight{light:THREE.Light&{intensity:number;radius?:number};intensity:number;radius:number|undefined}

function physical(material:THREE.Material):THREE.MeshPhysicalMaterial|null{
 return (material as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial?(material as THREE.MeshPhysicalMaterial):null;
}
function standard(material:THREE.Material):THREE.MeshStandardMaterial|null{
 return (material as THREE.MeshStandardMaterial).isMeshStandardMaterial?(material as THREE.MeshStandardMaterial):null;
}
function saveMaterial(material:THREE.MeshStandardMaterial):SavedMaterial{
 const body=physical(material);
 return {material,color:material.color.clone(),emissive:material.emissive.clone(),map:material.map,normalMap:material.normalMap,roughnessMap:material.roughnessMap,emissiveMap:material.emissiveMap,
  roughness:material.roughness,metalness:material.metalness,opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite,alphaTest:material.alphaTest,side:material.side,
  emissiveIntensity:material.emissiveIntensity,envMapIntensity:material.envMapIntensity,normalScale:material.normalScale.clone(),
  transmission:body?.transmission??0,thickness:body?.thickness??0,ior:body?.ior??1.5,attenuationDistance:body?.attenuationDistance??Infinity,attenuationColor:(body?.attenuationColor??new THREE.Color(1,1,1)).clone()};
}
function restoreMaterial(saved:SavedMaterial){
 const material=saved.material,body=physical(material);
 material.color.copy(saved.color);material.emissive.copy(saved.emissive);
 material.map=saved.map;material.normalMap=saved.normalMap;material.roughnessMap=saved.roughnessMap;material.emissiveMap=saved.emissiveMap;
 material.roughness=saved.roughness;material.metalness=saved.metalness;material.opacity=saved.opacity;material.transparent=saved.transparent;material.depthWrite=saved.depthWrite;
 material.alphaTest=saved.alphaTest;material.side=saved.side;material.emissiveIntensity=saved.emissiveIntensity;material.envMapIntensity=saved.envMapIntensity;material.normalScale.copy(saved.normalScale);
 if(body){body.transmission=saved.transmission;body.thickness=saved.thickness;body.ior=saved.ior;body.attenuationDistance=saved.attenuationDistance;body.attenuationColor.copy(saved.attenuationColor);}
 material.needsUpdate=true;
}
/** A repeating ripple the path tracer can sample. The raster water keeps its shader waves. */
export function waterRippleNormal(){
 if(rippleNormal)return rippleNormal;
 const size=128,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,wave=(k:number,l:number,phase:number)=>Math.sin((u*k+v*l)*Math.PI*2+phase);
  const gx=.35*2.1*wave(2.1,1.4,0)+.22*-1.2*wave(-1.2,3.3,1.7)+.12*5.3*wave(5.3,-2.2,.8);
  const gy=.35*1.4*wave(2.1,1.4,0)+.22*3.3*wave(-1.2,3.3,1.7)+.12*-2.2*wave(5.3,-2.2,.8);
  const i=(y*size+x)*4;
  data[i]=Math.max(0,Math.min(255,Math.round(gx*28+128)));
  data[i+1]=Math.max(0,Math.min(255,Math.round(gy*28+128)));
  data[i+2]=255;data[i+3]=255;
 }
 rippleNormal=new THREE.DataTexture(data,size,size);rippleNormal.colorSpace=THREE.NoColorSpace;rippleNormal.wrapS=rippleNormal.wrapT=THREE.RepeatWrapping;rippleNormal.needsUpdate=true;return rippleNormal;
}
function causticTexture(){
 if(caustic)return caustic;
 const size=128,data=new Uint8Array(size*size*4);
 data.fill(28);
 for(let i=0;i<36;i++){
  const lum=90+((i*17)%5)*18;
  for(let s=0;s<size;s++){
   const t=s/size,x=Math.floor((t*1.4+Math.sin(t*6+i)*0.18+i*0.17)%1*size),y=Math.floor((Math.cos(t*5+i*1.7)*0.22+t*0.2+i*0.11)%1*size),o=(y*size+x)*4;
   data[o]=Math.min(255,data[o]+lum);data[o+1]=Math.min(255,data[o+1]+Math.round(lum*.92));data[o+2]=Math.min(255,data[o+2]+Math.round(lum*.75));data[o+3]=255;
  }
 }
 caustic=new THREE.DataTexture(data,size,size);caustic.colorSpace=THREE.SRGBColorSpace;caustic.wrapS=caustic.wrapT=THREE.RepeatWrapping;caustic.needsUpdate=true;return caustic;
}
function thinGlass(material:THREE.MeshPhysicalMaterial,color:string,roughness:number){
 material.color.set(color);material.emissive.set('#000000');material.emissiveIntensity=0;material.metalness=0;material.roughness=roughness;
 material.transmission=1;material.thickness=0;material.attenuationDistance=Infinity;material.opacity=1;material.transparent=true;material.depthWrite=true;material.side=THREE.DoubleSide;material.needsUpdate=true;
}
/** The cleaned sky the raster dome already shows: upper sky, plus a thin photographed horizon in neighbourhood mode.
 * Yaw is baked in, so the path tracer can use it without the shader dome (that dome would block the background). */
export function buildPhotoBackground(source:THREE.Texture|null,strength:number,horizonBand:number,yawRad:number,horizon:[number,number,number]){
 const w=512,h=256,data=new Float32Array(w*h*4),image=source?.image as {width?:number;height?:number;data?:ArrayLike<number>}|undefined;
 const sw=image?.width??0,sh=image?.height??0,pixels=image?.data,channels=sw&&sh&&pixels?Math.round(pixels.length/(sw*sh)):0;
 const sample=(u:number,v:number):[number,number,number]|null=>{
  if(!pixels||channels<3)return null;
  const x=Math.min(sw-1,Math.max(0,Math.floor((((u%1)+1)%1)*sw))),row=(source!.flipY?1-v:v),y=Math.min(sh-1,Math.max(0,Math.floor(row*sh))),o=(y*sw+x)*channels;
  const n=(i:number)=>source!.type===THREE.HalfFloatType?THREE.DataUtils.fromHalfFloat(Number(pixels[o+i])):Number(pixels[o+i]);
  return [n(0),n(1),n(2)];
 };
 for(let y=0;y<h;y++){
  const el=((y+0.5)/h-0.5)*Math.PI,sampleEl=skyDomeSampleElevation(Math.max(el,-0.15),horizonBand),sv=sampleEl/Math.PI+0.5,t=Math.max(0,Math.sin(Math.max(el,0)));
  for(let x=0;x<w;x++){
   const rgb=sample((x+0.5)/w+yawRad/(Math.PI*2),sv),i=(y*w+x)*4;
   const zenith:[number,number,number]=[0.42,0.58,0.78];
   data[i]=(rgb?rgb[0]:horizon[0]*(1-t)+zenith[0]*t)*strength;
   data[i+1]=(rgb?rgb[1]:horizon[1]*(1-t)+zenith[1]*t)*strength;
   data[i+2]=(rgb?rgb[2]:horizon[2]*(1-t)+zenith[2]*t)*strength;
   data[i+3]=1;
  }
 }
 const texture=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);
 texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.LinearSRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.needsUpdate=true;return texture;
}
function roleOf(mesh:THREE.Object3D){return typeof mesh.userData.poolRole==='string'?mesh.userData.poolRole:'';}

/** Swap raster-only shader tricks for values the path tracer reads, and put a soft sun and area emitters in the scene.
 * Everything is put back by the returned function, including when setup throws. */
export function applyPhotoScene(scene:THREE.Scene,look:PhotoLook,sun:{color:[number,number,number];direction:[number,number,number];diameterFt:number;radiance:number;distanceFt:number}|null){
 const materials=new Map<string,SavedMaterial>(),lights:SavedLight[]=[],hidden:THREE.Object3D[]=[],added:THREE.Object3D[]=[];
 const ripple=waterRippleNormal(),caustics=look==='night'?null:causticTexture();
 scene.traverse(object=>{
  if(object.visible&&(HIDDEN.has(object.name)||object.name.includes('grass-blades'))){object.visible=false;hidden.push(object);}
  const mesh=object as THREE.Mesh;
  if(mesh.isMesh){
   const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
   for(const entry of list){
    const material=standard(entry);if(!material||materials.has(material.uuid))continue;
    const saved=saveMaterial(material);materials.set(material.uuid,saved);
    const body=physical(material),role=roleOf(mesh),surface=(material.userData.surface as SurfaceRecord|undefined)?.fallback;
    if(role==='water'||mesh.name.includes('water')&&body&&Math.abs((body.ior??1.5)-1.333)<0.02){
     const tint=new THREE.Color(WATER_OPTICS.shallow).lerp(new THREE.Color(WATER_OPTICS.deep),0.42);
     material.color.copy(tint);material.roughness=0.045;material.metalness=0;material.opacity=1;material.transparent=true;material.side=THREE.DoubleSide;material.normalMap=ripple;material.normalScale.set(0.35,0.35);
     if(body){body.transmission=1;body.thickness=0;body.ior=1.333;body.attenuationDistance=Infinity;body.attenuationColor.set('#ffffff');}
     material.needsUpdate=true;
    }else if(material.userData.photoRole==='glass'&&(body?.ior??1.5)>1.7){
     material.metalness=0;material.roughness=0.035;material.opacity=1;material.transparent=false;material.color.set(look==='night'?'#2a211c':'#121614');
     if(body){body.transmission=0;body.thickness=0;body.attenuationDistance=Infinity;body.ior=WINDOW_ROOM.ior;}
     if(look==='night'){material.emissive.set('#ffc89a');material.emissiveIntensity=PHOTO_LIGHT.windowNightEmissive;}
     material.needsUpdate=true;
    }else if(material.userData.photoRole==='glass'&&body){
     thinGlass(body,'#e7f6f1',0.02);
    }else if(surface){
     material.color.copy(surface);material.map=null;material.normalMap=null;material.roughnessMap=null;material.roughness=Math.min(material.roughness,0.62);material.metalness=0;material.needsUpdate=true;
    }else if(material.alphaTest>0||material.alphaMap||material.transparent&&material.map&&material.opacity>0.85&&(body?.transmission??0)<0.05){
     material.alphaTest=Math.max(material.alphaTest,0.45);material.transparent=false;material.depthWrite=true;material.side=THREE.DoubleSide;material.needsUpdate=true;
    }else if(look==='night'&&material.emissiveIntensity>0.05){
     material.emissiveIntensity*=PHOTO_LIGHT.nightEmissiveBoost;material.needsUpdate=true;
    }
    if(role==='floor'&&caustics&&look!=='night'){
     material.emissive.set('#fff1dc');material.emissiveMap=caustics;material.emissiveIntensity=PHOTO_LIGHT.floorCaustic;material.needsUpdate=true;
    }
   }
  }
  const light=object as THREE.Light&{intensity:number;radius?:number;isSpotLight?:boolean;isPointLight?:boolean;isDirectionalLight?:boolean};
  if(!light.visible||typeof light.intensity!=='number')return;
  if(light.isSpotLight){lights.push({light,intensity:light.intensity,radius:light.radius});light.radius=Math.max(light.radius??0,PHOTO_LIGHT.spotRadiusFt);}
  else if(light.isPointLight){
   lights.push({light,intensity:light.intensity,radius:light.radius});
   const glow=Math.min(PHOTO_LIGHT.pointEmissiveCap,Math.max(0.8,light.intensity*PHOTO_LIGHT.pointEmissiveScale));
   const sphere=new THREE.Mesh(new THREE.SphereGeometry(PHOTO_LIGHT.pointSphereRadiusFt,10,8),new THREE.MeshStandardMaterial({color:'#000000',emissive:(light as THREE.PointLight).color.clone(),emissiveIntensity:glow,roughness:1}));
   light.getWorldPosition(sphere.position);sphere.name='photo-emitter';added.push(sphere);light.intensity*=PHOTO_LIGHT.pointKeep;
  }else if(light.isDirectionalLight&&light.name==='sun'){lights.push({light,intensity:light.intensity,radius:undefined});light.intensity=0;}
 });
 if(sun){
  const disc=new THREE.RectAreaLight(new THREE.Color().setRGB(sun.color[0],sun.color[1],sun.color[2]),sun.radiance,sun.diameterFt,sun.diameterFt) as THREE.RectAreaLight&{isCircular?:boolean};
  disc.isCircular=true;disc.name='photo-sun';
  disc.position.set(sun.direction[0],sun.direction[1],sun.direction[2]).multiplyScalar(sun.distanceFt);
  disc.lookAt(0,2,20);added.push(disc);
 }
 for(const object of added)scene.add(object);
 return ()=>{
  for(const saved of materials.values())restoreMaterial(saved);
  for(const saved of lights){saved.light.intensity=saved.intensity;if(saved.radius===undefined)delete saved.light.radius;else saved.light.radius=saved.radius;}
  for(const object of hidden)object.visible=true;
  for(const object of added){scene.remove(object);const mesh=object as THREE.Mesh;mesh.geometry?.dispose();const material=mesh.material as THREE.Material|undefined;material?.dispose?.();}
 };
}
