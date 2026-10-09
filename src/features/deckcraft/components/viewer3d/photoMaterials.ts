import * as THREE from 'three';
import {WATER_OPTICS} from './waterOptics';
import {WINDOW_ROOM} from './windowGlass';
import {skyDomeSampleElevation} from './skyModel';
import {PHOTO_LIGHT,PHOTO_MOON,sunDisc,type PhotoLook} from './photoGrade';

const HIDDEN=new Set(['sky-dome','picked-wall-outline','selection-outline','picked-pergola-outline','landscape-mature-overlay']);
let rippleNormal:THREE.DataTexture|null=null;
let caustic:THREE.Texture|null=null;

interface SurfaceRecord{fallback?:THREE.Color}
interface SavedMaterial{
 material:THREE.MeshStandardMaterial;
 color:THREE.Color;emissive:THREE.Color;
 map:THREE.Texture|null;normalMap:THREE.Texture|null;roughnessMap:THREE.Texture|null;emissiveMap:THREE.Texture|null;aoMap:THREE.Texture|null;
 roughness:number;metalness:number;opacity:number;transparent:boolean;depthWrite:boolean;alphaTest:number;side:THREE.Side;
 emissiveIntensity:number;envMapIntensity:number;aoMapIntensity:number;normalScale:THREE.Vector2;
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
 return {material,color:material.color.clone(),emissive:material.emissive.clone(),map:material.map,normalMap:material.normalMap,roughnessMap:material.roughnessMap,emissiveMap:material.emissiveMap,aoMap:material.aoMap,
  roughness:material.roughness,metalness:material.metalness,opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite,alphaTest:material.alphaTest,side:material.side,
  emissiveIntensity:material.emissiveIntensity,envMapIntensity:material.envMapIntensity,aoMapIntensity:material.aoMapIntensity,normalScale:material.normalScale.clone(),
  transmission:body?.transmission??0,thickness:body?.thickness??0,ior:body?.ior??1.5,attenuationDistance:body?.attenuationDistance??Infinity,attenuationColor:(body?.attenuationColor??new THREE.Color(1,1,1)).clone()};
}
function restoreMaterial(saved:SavedMaterial){
 const material=saved.material,body=physical(material);
 material.color.copy(saved.color);material.emissive.copy(saved.emissive);
 material.map=saved.map;material.normalMap=saved.normalMap;material.roughnessMap=saved.roughnessMap;material.emissiveMap=saved.emissiveMap;material.aoMap=saved.aoMap;
 material.roughness=saved.roughness;material.metalness=saved.metalness;material.opacity=saved.opacity;material.transparent=saved.transparent;material.depthWrite=saved.depthWrite;
 material.alphaTest=saved.alphaTest;material.side=saved.side;material.emissiveIntensity=saved.emissiveIntensity;material.envMapIntensity=saved.envMapIntensity;material.aoMapIntensity=saved.aoMapIntensity;material.normalScale.copy(saved.normalScale);
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
 const half=new Uint16Array(data.length);
 for(let i=0;i<data.length;i++)half[i]=THREE.DataUtils.toHalfFloat(data[i]);
 const texture=new THREE.DataTexture(half,w,h,THREE.RGBAFormat,THREE.HalfFloatType);
 texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.LinearSRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;
 // The live HDR is half-float. A float32 panorama samples black on this software GPU, so the photo sky matches that format.
 texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;return texture;
}
function roleOf(mesh:THREE.Object3D){return typeof mesh.userData.poolRole==='string'?mesh.userData.poolRole:'';}

const PHOTO_ADDED=new Set(['photo-sky','photo-emitter','photo-moon']);

function shown(object:THREE.Object3D){
 for(let current:THREE.Object3D|null=object;current;current=current.parent)if(!current.visible)return false;
 return true;
}
/** Helpers, the raster sky shell, and shadow-only cards are not scenery. */
export function photoSkip(object:THREE.Object3D){
 if(HIDDEN.has(object.name)||object.name.includes('grass-blades')||object.name.includes('outline')||PHOTO_ADDED.has(object.name))return true;
 const data=object.userData??{};
 if(data.helper||data.shadowOnly||data.photoSkip||data.editHandle)return true;
 const mesh=object as THREE.Mesh;
 if(!mesh.isMesh)return false;
 const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
 return list.some(entry=>{
  const mat=entry as (THREE.Material&{colorWrite?:boolean;isShadowMaterial?:boolean})|null;
  return !!mat&&(mat.colorWrite===false||mat.isShadowMaterial===true);
 });
}
function materialTraceable(material:THREE.Material|null|undefined){
 if(!material)return false;
 if((material as THREE.MeshStandardMaterial).isMeshStandardMaterial)return true;
 return Boolean((material as THREE.MeshBasicMaterial).color);
}
function meshKept(mesh:THREE.Mesh){
 const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
 if(list.some(entry=>entry&&!materialTraceable(entry)))return false;
 return list.some(materialTraceable);
}
function geometryTriangles(geometry:THREE.BufferGeometry|undefined){
 const position=geometry?.getAttribute('position');
 if(!position)return 0;
 return (geometry!.index?geometry!.index.count:position.count)/3;
}
/** Triangles the raster draws for meshes photo mode is allowed to keep, with each instance expanded. */
export function rasterPhotoTriangles(root:THREE.Object3D){
 let triangles=0,objects=0;
 root.updateMatrixWorld(true);
 root.traverse(object=>{
  const mesh=object as THREE.Mesh;
  if(!mesh.isMesh||!shown(mesh)||photoSkip(mesh)||!meshKept(mesh))return;
  const copies=(mesh as THREE.InstancedMesh).isInstancedMesh?Math.max(0,(mesh as THREE.InstancedMesh).count):1;
  if(!copies)return;
  triangles+=geometryTriangles(mesh.geometry)*copies;
  objects+=1;
 });
 return {triangles,objects};
}
/** Triangles currently visible to the path tracer. Instanced meshes must already be baked. */
export function tracePhotoTriangles(root:THREE.Object3D){
 let triangles=0,objects=0;
 root.traverse(object=>{
  const mesh=object as THREE.Mesh;
  if(!mesh.isMesh||!shown(mesh)||photoSkip(mesh)||(mesh as THREE.InstancedMesh).isInstancedMesh)return;
  triangles+=geometryTriangles(mesh.geometry);
  objects+=1;
 });
 return {triangles,objects};
}
function proxyStandard(material:THREE.Material){
 const src=material as THREE.MeshBasicMaterial&{alphaMap?:THREE.Texture|null;emissive?:THREE.Color;emissiveIntensity?:number};
 const proxy=new THREE.MeshStandardMaterial({
  color:src.color?.clone()??new THREE.Color('#ffffff'),map:src.map??null,alphaMap:src.alphaMap??null,alphaTest:src.alphaTest??0,
  transparent:src.transparent,opacity:src.opacity,side:src.side,roughness:1,metalness:0,name:src.name,
  emissive:src.emissive?.clone?.()??new THREE.Color(0),emissiveIntensity:src.emissiveIntensity??0,vertexColors:src.vertexColors,
 });
 proxy.userData={...src.userData};
 return proxy;
}
/** The WebGL tracer bakes mesh.matrixWorld once and does not expand InstancedMesh. Merge every instance in world space. */
function bakeInstances(mesh:THREE.InstancedMesh){
 const src=mesh.geometry,count=mesh.count,position=src.getAttribute('position'),normal=src.getAttribute('normal'),index=src.index,verts=position.count;
 const matrix=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3(),vertex=new THREE.Vector3();
 const positions=new Float32Array(verts*count*3),normals=normal?new Float32Array(verts*count*3):null;
 const extras=['uv','uv2','color','tangent'].flatMap(key=>{
  const attr=src.getAttribute(key);
  return attr?[{key,itemSize:attr.itemSize,source:attr,array:new Float32Array(verts*count*attr.itemSize)}]:[];
 });
 for(let i=0;i<count;i++){
  mesh.getMatrixAt(i,matrix);matrix.premultiply(mesh.matrixWorld);normalMatrix.getNormalMatrix(matrix);
  const base=i*verts;
  for(let j=0;j<verts;j++){
   vertex.fromBufferAttribute(position as THREE.BufferAttribute,j).applyMatrix4(matrix);
   positions[(base+j)*3]=vertex.x;positions[(base+j)*3+1]=vertex.y;positions[(base+j)*3+2]=vertex.z;
   if(normals&&normal){
    vertex.fromBufferAttribute(normal as THREE.BufferAttribute,j).applyNormalMatrix(normalMatrix);
    if(vertex.lengthSq()>0)vertex.normalize();
    normals[(base+j)*3]=vertex.x;normals[(base+j)*3+1]=vertex.y;normals[(base+j)*3+2]=vertex.z;
   }
   for(const extra of extras){
    const at=(base+j)*extra.itemSize;
    if(extra.key==='tangent'){
     vertex.fromBufferAttribute(extra.source as THREE.BufferAttribute,j).transformDirection(matrix);
     extra.array[at]=vertex.x;extra.array[at+1]=vertex.y;extra.array[at+2]=vertex.z;
     if(extra.itemSize>3)extra.array[at+3]=extra.source.getComponent(j,3);
    }else for(let c=0;c<extra.itemSize;c++)extra.array[at+c]=extra.source.getComponent(j,c);
   }
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 if(normals)geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
 for(const extra of extras)geometry.setAttribute(extra.key,new THREE.BufferAttribute(extra.array,extra.itemSize));
 if(index){
  const out=new Uint32Array(index.count*count);
  for(let i=0;i<count;i++){const base=i*verts,at=i*index.count;for(let k=0;k<index.count;k++)out[at+k]=index.getX(k)+base;}
  geometry.setIndex(new THREE.BufferAttribute(out,1));
  for(let i=0;i<count;i++)for(const group of src.groups)geometry.addGroup(group.start+i*index.count,group.count,group.materialIndex);
 }
 const baked=new THREE.Mesh(geometry,mesh.material);
 baked.name=mesh.name?`photo-baked-${mesh.name}`:'photo-baked';
 baked.frustumCulled=false;baked.matrixAutoUpdate=false;baked.userData={photoBaked:true};
 return baked;
}
function tuneMaterial(mesh:THREE.Mesh,material:THREE.MeshStandardMaterial,look:PhotoLook,ripple:THREE.Texture,caustics:THREE.Texture|null){
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
 // The lawn's raster occlusion map is a baked shadow of the house. The tracer casts its own contact shadows.
 material.aoMap=null;
}

/** Swap raster-only shader tricks for values the path tracer reads, and put a soft sun and area emitters in the scene.
 * Everything is put back by the returned function, including when setup throws. */
export function applyPhotoScene(scene:THREE.Scene,look:PhotoLook,sun:{color:[number,number,number];direction:[number,number,number];diameterFt:number;radiance:number;distanceFt:number}|null){
 const materials=new Map<string,SavedMaterial>(),lights:SavedLight[]=[],hidden:THREE.Object3D[]=[],added:THREE.Object3D[]=[],proxies:THREE.Material[]=[];
 const swapped:THREE.Mesh[]=[],previous:THREE.Material[]=[];
 const ripple=waterRippleNormal(),caustics=look==='night'?null:causticTexture();
 scene.updateMatrixWorld(true);
 const meshes:THREE.Mesh[]=[];
 scene.traverse(object=>{if((object as THREE.Mesh).isMesh)meshes.push(object as THREE.Mesh);});
 for(const mesh of meshes){
  if(!shown(mesh))continue;
  if(photoSkip(mesh)||!meshKept(mesh)){mesh.visible=false;hidden.push(mesh);continue;}
  const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(list.some(entry=>entry&&!standard(entry))){
   swapped.push(mesh);previous.push(mesh.material as THREE.Material);
   const next=list.map(entry=>standard(entry)?entry:proxyStandard(entry));
   for(const entry of next)if(!list.includes(entry))proxies.push(entry);
   mesh.material=next.length===1?next[0]:next;
  }
  const tuned=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  for(const entry of tuned){
   const material=standard(entry);if(!material||materials.has(material.uuid))continue;
   materials.set(material.uuid,saveMaterial(material));
   tuneMaterial(mesh,material,look,ripple,caustics);
  }
 }
 for(const mesh of meshes){
  const inst=mesh as THREE.InstancedMesh;
  if(!inst.isInstancedMesh||!shown(inst)||inst.count<=0||!inst.geometry?.getAttribute('position'))continue;
  added.push(bakeInstances(inst));inst.visible=false;hidden.push(inst);
 }
 scene.traverse(object=>{
  const light=object as THREE.Light&{intensity:number;radius?:number;isSpotLight?:boolean;isPointLight?:boolean;isDirectionalLight?:boolean};
  if(!light.isLight||!shown(light)||typeof light.intensity!=='number')return;
  if(light.isSpotLight){lights.push({light,intensity:light.intensity,radius:light.radius});light.radius=Math.max(light.radius??0,PHOTO_LIGHT.spotRadiusFt);}
  else if(light.isPointLight){
   lights.push({light,intensity:light.intensity,radius:light.radius});
   const glow=Math.min(PHOTO_LIGHT.pointEmissiveCap,Math.max(0.8,light.intensity*PHOTO_LIGHT.pointEmissiveScale));
   const sphere=new THREE.Mesh(new THREE.SphereGeometry(PHOTO_LIGHT.pointSphereRadiusFt,10,8),new THREE.MeshStandardMaterial({color:'#000000',emissive:(light as THREE.PointLight).color.clone(),emissiveIntensity:glow,roughness:1}));
   light.getWorldPosition(sphere.position);sphere.name='photo-emitter';added.push(sphere);light.intensity*=PHOTO_LIGHT.pointKeep;
  }else if(light.isDirectionalLight&&light.name==='sun'){lights.push({light,intensity:light.intensity,radius:undefined});light.intensity=0;}
 });
 const place=(color:[number,number,number],direction:[number,number,number],diameterFt:number,radiance:number,distanceFt:number,name:string)=>{
  const disc=new THREE.RectAreaLight(new THREE.Color().setRGB(color[0],color[1],color[2]),radiance,diameterFt,diameterFt) as THREE.RectAreaLight&{isCircular?:boolean};
  disc.isCircular=true;disc.name=name;
  disc.position.set(direction[0],direction[1],direction[2]).multiplyScalar(distanceFt);
  disc.lookAt(0,2,20);added.push(disc);
 };
 if(sun)place(sun.color,sun.direction,sun.diameterFt,sun.radiance,sun.distanceFt,'photo-sun');
 if(look==='night'){
  const el=PHOTO_MOON.elevationDeg*Math.PI/180,az=PHOTO_MOON.azimuthDeg*Math.PI/180,disc=sunDisc(PHOTO_MOON.irradiance,PHOTO_MOON.angularRadiusDeg);
  place(PHOTO_MOON.color,[Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az)],disc.diameterFt,disc.radiance,disc.distanceFt,'photo-moon');
 }
 for(const object of added)scene.add(object);
 scene.updateMatrixWorld(true);
 return ()=>{
  for(const saved of materials.values())restoreMaterial(saved);
  for(const saved of lights){saved.light.intensity=saved.intensity;if(saved.radius===undefined)delete saved.light.radius;else saved.light.radius=saved.radius;}
  for(const object of hidden)object.visible=true;
  swapped.forEach((mesh,i)=>{mesh.material=previous[i];});
  for(const proxy of proxies)proxy.dispose();
  for(const object of added){scene.remove(object);const mesh=object as THREE.Mesh;mesh.geometry?.dispose();if(mesh.name==='photo-emitter')(mesh.material as THREE.Material|undefined)?.dispose?.();}
 };
}
