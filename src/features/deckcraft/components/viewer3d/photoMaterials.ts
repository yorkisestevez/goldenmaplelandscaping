import * as THREE from 'three';
import {WATER_OPTICS} from './waterOptics';
import {WINDOW_ROOM} from './windowGlass';
import {skyDomeSampleElevation} from './skyModel';
import {materialPatchKeys} from './materialPatches';
import {FOLIAGE} from './foliageLighting';
import {PHOTO_LIGHT,PHOTO_MOON,PHOTO_NIGHT_FILL,sunDisc,type PhotoLook} from '../../photoGrade';

const HIDDEN=new Set(['sky-dome','picked-wall-outline','selection-outline','picked-pergola-outline','landscape-mature-overlay']);
let rippleNormal:THREE.DataTexture|null=null;
let caustic:THREE.Texture|null=null;

interface SurfaceRecord{fallback?:THREE.Color}
interface SavedMaterial{
 material:THREE.MeshStandardMaterial;
 color:THREE.Color;emissive:THREE.Color;
 map:THREE.Texture|null;normalMap:THREE.Texture|null;roughnessMap:THREE.Texture|null;emissiveMap:THREE.Texture|null;aoMap:THREE.Texture|null;
 roughness:number;metalness:number;opacity:number;transparent:boolean;depthWrite:boolean;alphaTest:number;side:THREE.Side;
 emissiveIntensity:number;envMapIntensity:number;aoMapIntensity:number;normalScale:THREE.Vector2;vertexColors:boolean;
 transmission:number;thickness:number;ior:number;attenuationDistance:number;attenuationColor:THREE.Color;
}
interface WidenedColor{geometry:THREE.BufferGeometry;color:THREE.BufferAttribute}
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
  emissiveIntensity:material.emissiveIntensity,envMapIntensity:material.envMapIntensity,aoMapIntensity:material.aoMapIntensity,normalScale:material.normalScale.clone(),vertexColors:material.vertexColors,
  transmission:body?.transmission??0,thickness:body?.thickness??0,ior:body?.ior??1.5,attenuationDistance:body?.attenuationDistance??Infinity,attenuationColor:(body?.attenuationColor??new THREE.Color(1,1,1)).clone()};
}
function restoreMaterial(saved:SavedMaterial){
 const material=saved.material,body=physical(material);
 material.color.copy(saved.color);material.emissive.copy(saved.emissive);material.vertexColors=saved.vertexColors;
 material.map=saved.map;material.normalMap=saved.normalMap;material.roughnessMap=saved.roughnessMap;material.emissiveMap=saved.emissiveMap;material.aoMap=saved.aoMap;
 material.roughness=saved.roughness;material.metalness=saved.metalness;material.opacity=saved.opacity;material.transparent=saved.transparent;material.depthWrite=saved.depthWrite;
 material.alphaTest=saved.alphaTest;material.side=saved.side;material.emissiveIntensity=saved.emissiveIntensity;material.envMapIntensity=saved.envMapIntensity;material.aoMapIntensity=saved.aoMapIntensity;material.normalScale.copy(saved.normalScale);
 if(body){body.transmission=saved.transmission;body.thickness=saved.thickness;body.ior=saved.ior;body.attenuationDistance=saved.attenuationDistance;body.attenuationColor.copy(saved.attenuationColor);}
 delete material.userData.photoLeaf;delete material.userData.photoBloomLift;material.needsUpdate=true;
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
function textureReady(texture:THREE.Texture|null|undefined){
 const image=texture?.image as {width?:number;height?:number;complete?:boolean;naturalWidth?:number}|null|undefined;
 if(!image)return false;
 if(typeof image.complete==='boolean')return image.complete&&(image.naturalWidth??image.width??0)>0;
 return (image.width??0)>0&&(image.height??0)>0;
}
/** An image that has started loading but has no pixels yet. A null image is not worth waiting on. */
function texturePending(texture:THREE.Texture){
 const image=texture.image as {complete?:boolean;naturalWidth?:number}|null;
 if(!image||typeof image.complete!=='boolean')return false;
 return !image.complete||(image.naturalWidth??0)===0;
}
export function photoTexturesReady(root:THREE.Object3D){
 let ready=true;
 root.traverse(object=>{
  const mesh=object as THREE.Mesh;
  if(!mesh.isMesh||!ready)return;
  const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  for(const entry of list){
   const material=entry as THREE.MeshStandardMaterial|null;
   if(!material||!standard(material))continue;
   for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap'] as const){const tex=material[key];if(tex&&texturePending(tex))ready=false;}
  }
 });
 return ready;
}
function toLinear(value:number,srgb:boolean){
 const u=Math.max(0,value);
 if(!srgb)return u;
 return u<=0.04045?u/12.92:((u+0.055)/1.055)**2.4;
}
function srgbByte(linear:number){
 const c=Math.min(1,Math.max(0,linear));
 const s=c<=0.0031308?c*12.92:1.055*c**(1/2.4)-0.055;
 return Math.round(Math.min(255,Math.max(0,s*255)));
}
function readTextureRGBA(texture:THREE.Texture){
 const image=texture.image as {width?:number;height?:number;data?:ArrayLike<number>}|null;
 if(!image?.width||!image.height)return null;
 if(image.data){
  const w=image.width,h=image.height,src=image.data,channels=src.length/(w*h),out=new Uint8ClampedArray(w*h*4);
  if(channels===4)out.set(src as ArrayLike<number>);
  else if(channels===3){for(let i=0,j=0;i<src.length;i+=3,j+=4){out[j]=src[i];out[j+1]=src[i+1];out[j+2]=src[i+2];out[j+3]=255;}}
  else return null;
  return {data:out,w,h};
 }
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
 ctx.drawImage(image as CanvasImageSource,0,0);
 const read=ctx.getImageData(0,0,image.width,image.height);
 return {data:read.data,w:image.width,h:image.height};
}
function meanColor(attr:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,count=attr.count){
 let r=0,g=0,b=0;const n=Math.max(0,Math.min(count,attr.count));
 for(let i=0;i<n;i++){r+=attr.getX(i);g+=attr.getY(i);b+=attr.getZ(i);}
 const d=Math.max(1,n);return new THREE.Color(r/d,g/d,b/d);
}
function meanMap(texture:THREE.Texture){
 const image=texture.image as {width?:number;height?:number;data?:ArrayLike<number>;getContext?:(kind:string)=>CanvasRenderingContext2D|null};
 let data:ArrayLike<number>|null=image?.data??null;const width=image?.width??0,height=image?.height??0;
 if(!data&&image?.getContext){const pixels=image.getContext('2d')?.getImageData(0,0,width,height);data=pixels?.data??null;}
 if(!data||!width||!height)return new THREE.Color(1,1,1);
 const channels=Math.max(1,Math.round(data.length/(width*height))),srgb=texture.colorSpace===THREE.SRGBColorSpace;
 const max=data instanceof Uint8Array||data instanceof Uint8ClampedArray?255:data instanceof Uint16Array?65535:1;
 let r=0,g=0,b=0,n=0;const step=Math.max(1,Math.floor((width*height)/4096));
 for(let i=0;i<width*height;i+=step){const o=i*channels;r+=toLinear(Number(data[o])/max,srgb);g+=toLinear(Number(data[o+1]??data[o])/max,srgb);b+=toLinear(Number(data[o+2]??data[o])/max,srgb);n++;}
 return new THREE.Color(r/Math.max(1,n),g/Math.max(1,n),b/Math.max(1,n));
}
/** Linear mean albedo: material colour × decoded map × mean vertex colour, the product the tracer shades with.
 * `raster` applies the viewer's own rules (a loaded paver photo is not tinted a second time; an atlas the tracer cannot see uses its fallback). */
export function photoMeanAlbedo(material:THREE.MeshStandardMaterial,source?:THREE.Object3D|null,mode:'raster'|'trace'='trace'){
 const mesh=source as THREE.Mesh|null|undefined,geometry=mesh?.geometry as THREE.BufferGeometry|undefined,color=material.color.clone();
 const swatch=material.userData.hardscapeSwatch===true,fallback=(material.userData.surface as SurfaceRecord|undefined)?.fallback;
 let map=material.map;
 if(mode==='raster'){
  if(fallback){color.copy(fallback);map=null;}
  else if(swatch){if(map&&textureReady(map))color.set('#ffffff');else map=null;}
 }
 if(map&&textureReady(map))color.multiply(meanMap(map));
 const inst=mesh as THREE.InstancedMesh|undefined;
 if(mode==='raster'&&inst?.isInstancedMesh&&inst.instanceColor&&inst.count>0)color.multiply(meanColor(inst.instanceColor,inst.count));
 if(material.vertexColors&&geometry){const attr=geometry.getAttribute('color') as THREE.BufferAttribute|undefined;if(attr&&attr.count)color.multiply(meanColor(attr));}
 return color;
}

const PHOTO_ADDED=new Set(['photo-sky','photo-emitter','photo-moon']);

function shown(object:THREE.Object3D){
 for(let current:THREE.Object3D|null=object;current;current=current.parent)if(!current.visible)return false;
 return true;
}
/** Helpers, the raster sky shell, and shadow-only cards are not scenery. */
export function photoSkip(object:THREE.Object3D){
 if(HIDDEN.has(object.name)||object.name.includes('grass-blades')||object.name.includes('outline')||PHOTO_ADDED.has(object.name))return true;
 const data=object.userData??{};
 if(data.helper||data.shadowOnly||data.photoSkip||data.editHandle||data.renderOnly)return true;
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
 const srcColor=src.getAttribute('color') as THREE.BufferAttribute|undefined,instanceColor=mesh.instanceColor;
 const colors=srcColor||instanceColor?new Float32Array(verts*count*4):null;
 const extras=['uv','uv2','tangent'].flatMap(key=>{
  const attr=src.getAttribute(key);
  return attr?[{key,itemSize:attr.itemSize,source:attr,array:new Float32Array(verts*count*attr.itemSize)}]:[];
 });
 const bloom=listBloom(mesh.material);
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
   if(colors){
    const at=(base+j)*4;let r=1,g=1,b=1,a=1;
    if(srcColor){r=srcColor.getX(j);g=srcColor.getY(j);b=srcColor.getZ(j);if(srcColor.itemSize>3)a=srcColor.getW(j);}
    if(instanceColor){r*=instanceColor.getX(i);g*=instanceColor.getY(i);b*=instanceColor.getZ(i);if(instanceColor.itemSize>3)a*=instanceColor.getW(i);}
    if(bloom){const scale=1+bloom;r*=scale;g*=scale;b*=scale;}
    colors[at]=r;colors[at+1]=g;colors[at+2]=b;colors[at+3]=a;
   }
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 if(normals)geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
 if(colors)geometry.setAttribute('color',new THREE.BufferAttribute(colors,4));
 for(const extra of extras)geometry.setAttribute(extra.key,new THREE.BufferAttribute(extra.array,extra.itemSize));
 if(index){
  const out=new Uint32Array(index.count*count);
  for(let i=0;i<count;i++){const base=i*verts,at=i*index.count;for(let k=0;k<index.count;k++)out[at+k]=index.getX(k)+base;}
  geometry.setIndex(new THREE.BufferAttribute(out,1));
  for(let i=0;i<count;i++)for(const group of src.groups)geometry.addGroup(group.start+i*index.count,group.count,group.materialIndex);
 }
 if(colors){const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];for(const entry of list){const material=standard(entry);if(material)material.vertexColors=true;}}
 const baked=new THREE.Mesh(geometry,mesh.material);
 baked.name=mesh.name?`photo-baked-${mesh.name}`:'photo-baked';
 baked.frustumCulled=false;baked.matrixAutoUpdate=false;baked.userData={photoBaked:true};
 return baked;
}
/** Shallow edges and the waterline go lighter; the middle of the floor stays a deeper teal. The original colours are put back with the rest of the photo session. */
function paintPoolGradient(mesh:THREE.Mesh,role:'floor'|'wall',saved:Map<THREE.BufferGeometry,THREE.BufferAttribute>){
 const geometry=mesh.geometry,color=geometry.getAttribute('color') as THREE.BufferAttribute|undefined,position=geometry.getAttribute('position') as THREE.BufferAttribute|undefined;
 if(!color||!position||saved.has(geometry))return;
 saved.set(geometry,color);
 const painted=color.clone(),n=position.count;
 let sx=0,sz=0,minY=Infinity,maxY=-Infinity;
 for(let i=0;i<n;i++){sx+=position.getX(i);sz+=position.getZ(i);minY=Math.min(minY,position.getY(i));maxY=Math.max(maxY,position.getY(i));}
 sx/=n;sz/=n;
 let maxR=1e-4;
 for(let i=0;i<n;i++)maxR=Math.max(maxR,Math.hypot(position.getX(i)-sx,position.getZ(i)-sz));
 const shallow=new THREE.Color('#c5f3ea'),deep=new THREE.Color('#145e68'),top=new THREE.Color('#d4f3ec'),low=new THREE.Color('#124e58');
 for(let i=0;i<n;i++){
  const c=role==='floor'
   ?deep.clone().lerp(shallow,Math.pow(Math.min(1,Math.hypot(position.getX(i)-sx,position.getZ(i)-sz)/maxR),.72))
   :low.clone().lerp(top,maxY>minY?(position.getY(i)-minY)/(maxY-minY):1);
  painted.setXYZ(i,c.r,c.g,c.b);if(painted.itemSize>3)painted.setW(i,1);
 }
 geometry.setAttribute('color',painted);painted.needsUpdate=true;
}
function tuneMaterial(mesh:THREE.Mesh,material:THREE.MeshStandardMaterial,look:PhotoLook,ripple:THREE.Texture,caustics:THREE.Texture|null,poolColors:Map<THREE.BufferGeometry,THREE.BufferAttribute>){
 const body=physical(material),role=roleOf(mesh),surface=(material.userData.surface as SurfaceRecord|undefined)?.fallback;
 // A loaded paver photo already contains the product colour. Tint it only when the photo has not arrived, otherwise the field goes black.
 if(material.userData.hardscapeSwatch){if(material.map&&textureReady(material.map))material.color.set('#ffffff');else material.map=null;}
 if(role==='water'||mesh.name.includes('water')&&body&&Math.abs((body.ior??1.5)-1.333)<0.02){
  const tint=new THREE.Color(WATER_OPTICS.shallow).lerp(new THREE.Color(WATER_OPTICS.deep),0.42);
  material.color.copy(tint);material.roughness=look==='night'?0.08:0.045;material.metalness=0;material.opacity=1;material.transparent=true;material.side=THREE.DoubleSide;material.normalMap=ripple;material.normalScale.set(look==='night'?1.05:0.35,look==='night'?1.05:0.35);
  // Thickness stays 0. An open water sheet has no exit face, and a finite thickness absorbs the interior finish to black.
  if(body){body.transmission=1;body.thickness=0;body.ior=1.333;body.attenuationDistance=Infinity;body.attenuationColor.set('#ffffff');}
  material.needsUpdate=true;
 }else if(material.userData.photoRole==='glass'&&(body?.ior??1.5)>1.7){
  material.metalness=0;material.roughness=0.035;material.opacity=1;material.transparent=false;material.color.set(look==='night'?'#2a211c':'#121614');
  if(body){body.transmission=0;body.thickness=0;body.attenuationDistance=Infinity;body.ior=WINDOW_ROOM.ior;}
  if(look==='night'){material.emissive.set('#ffb060');material.emissiveIntensity=PHOTO_LIGHT.windowNightEmissive;}
  material.needsUpdate=true;
 }else if(material.userData.photoRole==='glass'&&body){
  thinGlass(body,'#e7f6f1',0.02);
 }else if(surface){
  material.color.copy(surface);material.map=null;material.normalMap=null;material.roughnessMap=null;material.roughness=Math.min(material.roughness,0.62);material.metalness=0;material.needsUpdate=true;
 }else if(material.alphaTest>0||material.alphaMap||material.transparent&&material.map&&material.opacity>0.85&&(body?.transmission??0)<0.05){
  // Keep the asset's own cutoff. Raising a soft leaf card to 0.45 leaves only a few white texels.
  if(material.alphaTest<=0)material.alphaTest=.08;
  material.transparent=false;material.depthWrite=true;material.side=THREE.DoubleSide;material.needsUpdate=true;
 }else if(look==='night'&&mesh.name==='aluminum-pergola-LED'){
  material.emissive.set('#ffd09a');material.emissiveIntensity=2.4;material.needsUpdate=true;
 }else if(look==='night'&&(mesh.name==='fire-flame'||mesh.name==='fire-burner'||material.emissive.getHex()>0&&mesh.name.startsWith('fire-'))){
  material.emissive.set('#ff7a30');material.emissiveIntensity=mesh.name==='fire-flame'?2.6:1.7;material.needsUpdate=true;
 }else if(look==='night'&&material.emissiveIntensity>0.05&&material.emissiveIntensity<1.2){
  // Neighbour panes. The house windows are set above; these stay a dim warm interior.
  material.emissiveIntensity=Math.min(0.26,material.emissiveIntensity);material.needsUpdate=true;
 }else if(look==='night'&&material.emissiveIntensity>=1.2){
  material.emissiveIntensity*=PHOTO_LIGHT.nightEmissiveBoost;material.needsUpdate=true;
 }
 if(look==='night'&&(role==='floor'||role==='wall')){
  paintPoolGradient(mesh,role,poolColors);
  material.emissive.set(role==='floor'?'#e7fff8':'#c9ebe4');
  if(role==='floor'){material.emissiveMap=caustics;material.emissiveIntensity=PHOTO_LIGHT.nightFloorGlow;}
  else material.emissiveIntensity=PHOTO_LIGHT.nightWallGlow;
  material.needsUpdate=true;
 }
 if(look==='night'&&(role==='coping'||role==='collar')){
  material.emissive.set('#d5ebe4');material.emissiveIntensity=PHOTO_LIGHT.nightCopingGlow;material.needsUpdate=true;
 }
 if(role==='floor'&&caustics&&look!=='night'){
  material.emissive.set('#fff1dc');material.emissiveMap=caustics;material.emissiveIntensity=PHOTO_LIGHT.floorCaustic;material.needsUpdate=true;
 }
 const patches=materialPatchKeys(material);
 if(patches.some(key=>key.startsWith('foliage-summer-v2'))){
  // Match the raster leaf shader: the atlas as it is and matte, with no faked glow. The tracer's transmission is see-through
  // glass, not leaf translucency (it darkens the leaf and lets grey light under the tree), so leaves stay opaque cards.
  // A cutoff above 0.22 would punch a soft leaf card down to specks.
  material.roughness=FOLIAGE.roughness;material.metalness=0;
  if(material.alphaTest>0.22)material.alphaTest=0.22;
  material.userData.photoLeaf=true;material.needsUpdate=true;
 }else if(patches.includes('mulch-shred-fiber-v3')&&material.userData.mulchPhotoColor instanceof THREE.Color){
  // The raster shader paints the product's swatch over the scan's grain; the tracer sees the plain scan, so its colour is
  // the swatch over the scan's mean, and the bed averages to the same swatch (vertex colours still give the soil).
  material.color.copy(material.userData.mulchPhotoColor);material.needsUpdate=true;
 }else if(patches.includes('bloom-lift-v1')){
  // Flower cards carry their own unlit lift. A hard 0.45 cutoff also trims the soft petal down to a speck.
  if(material.alphaTest>0.2)material.alphaTest=0.2;
  material.userData.photoBloomLift=0.42;material.needsUpdate=true;
 }
 // The lawn's raster occlusion map is a baked shadow of the house. The tracer casts its own contact shadows.
 material.aoMap=null;
}
function listBloom(material:THREE.Material|THREE.Material[]){
 const list=Array.isArray(material)?material:[material];
 return list.reduce((best,entry)=>Math.max(best,Number((standard(entry)?.userData as {photoBloomLift?:number}|undefined)?.photoBloomLift??0)),0);
}

/** The tracer's merge leaves an RGB colour attribute at zero when another mesh has RGBA. Widen to RGBA before that merge. */
function widenSceneColors(scene:THREE.Scene,widened:WidenedColor[]){
 const seen=new Set<string>();
 scene.traverse(object=>{
  const mesh=object as THREE.Mesh;
  if(!mesh.isMesh||!shown(mesh)||photoSkip(mesh))return;
  const geometry=mesh.geometry;if(!geometry||seen.has(geometry.uuid))return;seen.add(geometry.uuid);
  const color=geometry.getAttribute('color') as THREE.BufferAttribute|undefined;
  if(!color||color.itemSize>=4)return;
  const next=new Float32Array(color.count*4);
  for(let i=0;i<color.count;i++){next[i*4]=color.getX(i);next[i*4+1]=color.getY(i);next[i*4+2]=color.getZ(i);next[i*4+3]=1;}
  geometry.setAttribute('color',new THREE.BufferAttribute(next,4));
  widened.push({geometry,color});
 });
}
/** Swap raster-only shader tricks for values the path tracer reads, and put a soft sun and area emitters in the scene.
 * Everything is put back by the returned function, including when setup throws. */
export function applyPhotoScene(scene:THREE.Scene,look:PhotoLook,sun:{color:[number,number,number];direction:[number,number,number];diameterFt:number;radiance:number;distanceFt:number}|null){
 const materials=new Map<string,SavedMaterial>(),lights:SavedLight[]=[],hidden:THREE.Object3D[]=[],added:THREE.Object3D[]=[],proxies:THREE.Material[]=[],widened:WidenedColor[]=[];
 const swapped:THREE.Mesh[]=[],previous:THREE.Material[]=[],poolColors=new Map<THREE.BufferGeometry,THREE.BufferAttribute>();
 const ripple=waterRippleNormal(),caustics=causticTexture();
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
   tuneMaterial(mesh,material,look,ripple,caustics,poolColors);
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
  const aim=(spec:{elevationDeg:number;azimuthDeg:number;irradiance:number;angularRadiusDeg:number;color:[number,number,number]},name:string)=>{
   const el=spec.elevationDeg*Math.PI/180,az=spec.azimuthDeg*Math.PI/180,disc=sunDisc(spec.irradiance,spec.angularRadiusDeg);
   place(spec.color,[Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az)],disc.diameterFt,disc.radiance,disc.distanceFt,name);
  };
  aim(PHOTO_MOON,'photo-moon');
  aim(PHOTO_NIGHT_FILL,'photo-night-fill');
  // Step lights and flush pavers only light the raster through a shader. A short warm pool sits just outside the housing.
  scene.traverse(object=>{
   if(!/^(wedge|evo_hyde|evo_ground_300)-/.test(object.name))return;
   if(object.children.some(child=>(child as THREE.Light).isLight))return;
   const step=/^wedge-/.test(object.name);
   const fill=new THREE.PointLight('#ffb56a',step?PHOTO_LIGHT.stepLightCandela:PHOTO_LIGHT.paverLightCandela,step?PHOTO_LIGHT.stepLightRangeFt:6,2);
   const lens=step?new THREE.Vector3(0,-4,6):new THREE.Vector3(0,.4,0);
   object.localToWorld(lens);fill.position.copy(lens);fill.position.y=Math.max(0.05,fill.position.y);
   fill.name=step?'photo-step':'photo-fill';added.push(fill);
  });
  // Underwater-looking wash: a few lamps just above the surface, so the coping catches a soft pool light and the floor is not a flat slab.
  scene.traverse(object=>{
   if(roleOf(object)!=='water')return;
   const box=new THREE.Box3().setFromObject(object),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
   if(size.x+size.z<0.2)return;
   const alongX=size.x>=size.z,span=Math.max(size.x,size.z);
   for(let i=0;i<3;i++){
    const t=(i-1)*.28;
    const lamp=new THREE.PointLight('#c8fff4',PHOTO_LIGHT.poolLightCandela,span*0.55,2);
    lamp.position.set(center.x+(alongX?size.x*t:0),box.max.y+0.4,center.z+(alongX?0:size.z*t));
    lamp.name='photo-pool-light';added.push(lamp);
   }
  });
  scene.traverse(object=>{
   if(object.name!=='aluminum-pergola-LED')return;
   const at=object.getWorldPosition(new THREE.Vector3());
   const wash=new THREE.PointLight('#ffc89a',PHOTO_LIGHT.pergolaWashCandela,12,2);
   wash.position.set(at.x,Math.max(0.4,at.y-1.4),at.z);wash.name='photo-pergola-wash';added.push(wash);
  });
 }
 for(const object of added)scene.add(object);
 scene.updateMatrixWorld(true);
 widenSceneColors(scene,widened);
 return ()=>{
  for(const entry of widened)entry.geometry.setAttribute('color',entry.color);
  for(const [geometry,color] of poolColors)geometry.setAttribute('color',color);
  for(const saved of materials.values())restoreMaterial(saved);
  for(const saved of lights){saved.light.intensity=saved.intensity;if(saved.radius===undefined)delete saved.light.radius;else saved.light.radius=saved.radius;}
  for(const object of hidden)object.visible=true;
  swapped.forEach((mesh,i)=>{mesh.material=previous[i];});
  for(const proxy of proxies)proxy.dispose();
  for(const object of added){scene.remove(object);const mesh=object as THREE.Mesh;mesh.geometry?.dispose();if(mesh.name==='photo-emitter')(mesh.material as THREE.Material|undefined)?.dispose?.();}
 };
}
