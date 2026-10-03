import * as THREE from 'three';
import {landscapeSurface} from '../../landscapeSurfaces';
import type {LandscapeAssetId} from '../../landscapeTypes';

/** Original, deterministic, seamless textures. No downloaded asset or product scan. */
export function createLandscapeSurfaceMaterial(id:LandscapeAssetId,anisotropy=1){
 const profile=landscapeSurface(id)!,size=256,mapBytes=new Uint8Array(size*size*4),normalBytes=new Uint8Array(size*size*4),roughBytes=new Uint8Array(size*size*4),heights=new Float32Array(size*size),turf=profile.type==='turf',mulch=profile.type==='mulch';
 const hash=(x:number,z:number)=>{const n=Math.sin(x*127.1+z*311.7+19.17)*43758.5453;return n-Math.floor(n);};
 const color=new THREE.Color(profile.color);color.convertLinearToSRGB();
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  const u=x/size*8,v=z/size*8;let nearest=10,second=10,seed=0;
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const cx=Math.floor(u)+i,cz=Math.floor(v)+j,wx=(cx+8)%8,wz=(cz+8)%8,dx=u-cx-hash(wx,wz),dz=v-cz-hash(wz+31,wx+17),d=Math.hypot(dx*(mulch?2:1),dz);if(d<nearest){second=nearest;nearest=d;seed=hash(wx+4,wz+23);}else second=Math.min(second,d);}
  const edge=Math.min(1,(second-nearest)*(id==='crushed-granite-bed'?15:9)),noise=hash(x,z),relief=turf?.5+noise*.1:Math.max(0,edge)*Math.max(.15,1-nearest*.55);
  heights[z*size+x]=relief;
  const variation=turf?.9+noise*.17: (.78+seed*.35)*(.73+edge*.27)*( .95+noise*.1);
  const k=(z*size+x)*4;mapBytes[k]=Math.min(255,color.r*255*variation);mapBytes[k+1]=Math.min(255,color.g*255*variation);mapBytes[k+2]=Math.min(255,color.b*255*variation);mapBytes[k+3]=255;
  roughBytes[k]=roughBytes[k+1]=roughBytes[k+2]=turf?235:mulch?244:id==='mexican-beach-pebbles-bed'?180+noise*30:210+noise*35;roughBytes[k+3]=255;
 }
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){const dx=heights[z*size+(x+1)%size]-heights[z*size+(x+size-1)%size],dz=heights[((z+1)%size)*size+x]-heights[((z+size-1)%size)*size+x],n=new THREE.Vector3(-dx*3,-dz*3,1).normalize(),k=(z*size+x)*4;normalBytes[k]=(n.x*.5+.5)*255;normalBytes[k+1]=(n.y*.5+.5)*255;normalBytes[k+2]=(n.z*.5+.5)*255;normalBytes[k+3]=255;}
 const texture=(bytes:Uint8Array,srgb=false)=>{const t=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=anisotropy;const repeat=2.1/.0254/(profile.grainIn*8);t.repeat.set(repeat,repeat);t.needsUpdate=true;return t;};
 const map=texture(mapBytes,true),normalMap=texture(normalBytes),roughnessMap=texture(roughBytes),material=new THREE.MeshStandardMaterial({map,normalMap,roughnessMap,normalScale:new THREE.Vector2(turf?.15:.6,turf?.15:.6),roughness:1});
 return {material,dispose:()=>{material.dispose();map.dispose();normalMap.dispose();roughnessMap.dispose();}};
}
