import * as THREE from 'three';
import {landscapeSurface} from '../../landscapeSurfaces';
import type {LandscapeAssetId} from '../../landscapeTypes';
import {addMaterialPatch} from './materialPatches';

type Maps={map:THREE.Texture;normalMap:THREE.Texture;roughnessMap:THREE.Texture};
interface Shared {maps:Maps;materials:Set<THREE.MeshStandardMaterial>;loading?:boolean;loaded?:boolean;listeners:Set<()=>void>;pending:Set<THREE.Texture>}
const shared=new Map<string,Shared>();
const hash=(x:number,z:number)=>{const n=Math.sin(x*127.1+z*311.7+19.17)*43758.5453;return n-Math.floor(n);};
/** A local fallback with material-scale grains. The three mulch colours share the licensed wood-chip scan. */
function makeMaps(id:LandscapeAssetId,anisotropy:number):Maps{
 const p=landscapeSurface(id)!,size=anisotropy===4?128:anisotropy===8?256:512,turf=p.type==='turf',mulch=p.type==='mulch',fine=id==='limestone-screenings-bed';
 const bytes=new Uint8Array(size*size*4),normal=new Uint8Array(bytes.length),rough=new Uint8Array(bytes.length),height=new Float32Array(size*size),color=new THREE.Color(p.color).convertLinearToSRGB();
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  const u=x/size*8,v=z/size*8;let first=10,second=10,seed=0;
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const cx=Math.floor(u)+i,cz=Math.floor(v)+j,wx=(cx+8)%8,wz=(cz+8)%8,dx=u-cx-hash(wx,wz),dz=v-cz-hash(wz+31,wx+17),d=Math.hypot(dx,dz);if(d<first){second=first;first=d;seed=hash(wx+4,wz+23);}else second=Math.min(second,d);}
  const noise=hash(x,z),seam=Math.min(1,(second-first)*18),round=id==='river-rock-bed'||id==='mexican-beach-pebbles-bed'||id==='pea-gravel-bed';
  const fiber=Math.pow(Math.max(0,Math.sin(x*.72+Math.sin(z*.035)*3)),6),relief=turf?fiber*.24+noise*.04:Math.max(0,seam)*(round?Math.sqrt(Math.max(0,1-first*first)):1-first*.3);
  height[z*size+x]=relief;
  const tone=turf?.82+fiber*.25+noise*.08:fine?.91+seed*.08+noise*.035:(.64+seed*.62)*(.66+seam*.34),warm=round?(seed-.5)*.18:0,k=(z*size+x)*4;
  bytes[k]=Math.min(255,color.r*255*tone*(1+warm));bytes[k+1]=Math.min(255,color.g*255*tone);bytes[k+2]=Math.min(255,color.b*255*tone*(1-warm));bytes[k+3]=255;
  rough[k]=rough[k+1]=rough[k+2]=mulch?242:turf?233:id==='mexican-beach-pebbles-bed'?205+noise*25:fine?250:226+noise*23;rough[k+3]=255;
 }
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){const dx=height[z*size+(x+1)%size]-height[z*size+(x+size-1)%size],dz=height[((z+1)%size)*size+x]-height[((z+size-1)%size)*size+x],n=new THREE.Vector3(-dx*5,-dz*5,1).normalize(),k=(z*size+x)*4;normal[k]=(n.x*.5+.5)*255;normal[k+1]=(n.y*.5+.5)*255;normal[k+2]=(n.z*.5+.5)*255;normal[k+3]=255;}
 const texture=(data:Uint8Array,srgb=false)=>{const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;t.anisotropy=anisotropy;t.repeat.setScalar(2.1/.0254/(p.grainIn*8));t.needsUpdate=true;return t;};
 return {map:texture(bytes,true),normalMap:texture(normal),roughnessMap:texture(rough)};
}
function applyMaps(m:THREE.MeshStandardMaterial,maps:Maps){Object.assign(m,maps);m.needsUpdate=true;}
function disposeMaps(maps:Maps){Object.values(maps).forEach(t=>t.dispose());}
/** Reference-counted maps are shared; each viewer retains its own material and fixture-light uniforms. */
export function createLandscapeSurfaceMaterial(id:LandscapeAssetId,anisotropy=1){
 const p=landscapeSurface(id)!,mulch=p.type==='mulch',key=(mulch?'mulch':id)+':'+anisotropy;
 let entry=shared.get(key);if(!entry){entry={maps:makeMaps(mulch?'mulch-bed':id,anisotropy),materials:new Set(),listeners:new Set(),pending:new Set()};shared.set(key,entry);}const resource=entry;
 const material=new THREE.MeshStandardMaterial({color:id==='black-mulch-bed'?'#2a2622':id==='cedar-mulch-bed'?'#ffce99':'#ffffff',...resource.maps,normalScale:new THREE.Vector2(p.type==='turf'?.28:id==='limestone-screenings-bed'?.14:.72,p.type==='turf'?.28:.72),roughness:1});
 resource.materials.add(material);
 addMaterialPatch(material,{key:'ground-cover-stochastic-v1',apply:shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
float coverHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec4 coverSample(sampler2D t,vec2 uv){vec2 c=floor(uv*.2),f=fract(uv*.2);f=f*f*(3.-2.*f);float n=mix(mix(coverHash(c),coverHash(c+vec2(1.,0.)),f.x),mix(coverHash(c+vec2(0.,1.)),coverHash(c+1.),f.x),f.y)*8.;vec2 a=sin(vec2(3.,7.)*floor(n)),b=sin(vec2(3.,7.)*(floor(n)+1.));return mix(textureGrad(t,uv+a,dFdx(uv),dFdy(uv)),textureGrad(t,uv+b,dFdx(uv),dFdy(uv)),smoothstep(.2,.8,fract(n)));}`);
  for(const [chunk,map,uv] of [['map_fragment','map','vMapUv'],['normal_fragment_maps','normalMap','vNormalMapUv'],['roughnessmap_fragment','roughnessMap','vRoughnessMapUv']])shader.fragmentShader=shader.fragmentShader.replace('#include <'+chunk+'>',(THREE.ShaderChunk as Record<string,string>)[chunk].replace('texture2D( '+map+', '+uv+' )','coverSample( '+map+', '+uv+' )'));
 }});
 let released=false,listener:(()=>void)|undefined;
 return {material,loadPhotos(onReady:()=>void){
  if(!mulch||released)return;listener=onReady;resource.listeners.add(onReady);if(resource.loaded){onReady();return;}if(resource.loading)return;resource.loading=true;
  const loader=new THREE.TextureLoader();const loaded:THREE.Texture[]=[];let completed=0,failed=false;
  const urls=['diffuse','normal','roughness'];
  urls.forEach((name,index)=>loader.load('/deckcraft/landscape/mulch-'+name+'.jpg',t=>{
   if(shared.get(key)!==resource||failed){t.dispose();return;}loaded[index]=t;resource.pending.add(t);t.colorSpace=index===0?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=anisotropy;t.needsUpdate=true;
   if(++completed===3){const old=resource.maps;resource.maps={map:loaded[0],normalMap:loaded[1],roughnessMap:loaded[2]};resource.loaded=true;resource.pending.clear();resource.materials.forEach(m=>applyMaps(m,resource.maps));disposeMaps(old);resource.listeners.forEach(f=>f());}
  },undefined,()=>{failed=true;loaded.forEach(t=>t.dispose());resource.pending.clear();resource.loading=false;}));
 },dispose(){if(released)return;released=true;if(listener)resource.listeners.delete(listener);resource.materials.delete(material);material.dispose();if(!resource.materials.size){shared.delete(key);resource.pending.forEach(t=>t.dispose());resource.pending.clear();disposeMaps(resource.maps);}}};
}
