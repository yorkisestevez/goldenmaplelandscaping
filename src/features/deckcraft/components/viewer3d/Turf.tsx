import {useMemo,useEffect,useRef,useLayoutEffect} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import colorUrl from './assets/grass008-color.webp';
import normalUrl from './assets/grass008-normalgl.webp';
import roughnessUrl from './assets/grass008-roughness.webp';
import {yardClip,yardSolidCells,type YardModel} from '../../yardModel';

/** Mown lawn: a physically scaled textured ground with small actual blades near the deck. */
export default function Turf({width,depth,radius,yard}:{width:number;depth:number;radius:number;yard:YardModel}){
 const gl=useThree(s=>s.gl),invalidate=useThree(s=>s.invalidate),ref=useRef<THREE.InstancedMesh>(null);
 const material=useMemo(()=>new THREE.MeshStandardMaterial({color:'#899d69',vertexColors:true,roughness:.95,normalScale:new THREE.Vector2(.32,.32)}),[]);
 const cuts=useMemo(()=>yardClip(yard.excavationRegions.map(e=>e.polygon)),[yard]);
 const geometry=useMemo(()=>{const positions:number[]=[],uvs:number[]=[],colors:number[]=[],tw=yard.terrain.widthFt*12,td=yard.terrain.depthFt*12,n=24,minX=width/2-tw/2,minZ=depth/2-td/2;
  const tint=(x:number,z:number)=>.84+.16*(.5+.5*Math.sin(x*.0017+Math.sin(z*.0041)*1.7)*Math.cos(z*.0027+Math.sin(x*.0053)));
  for(let ix=0;ix<n;ix++)for(let iz=0;iz<n;iz++){const x=minX+ix*tw/n,z=minZ+iz*td/n,cell=[{x,y:z},{x:x+tw/n,y:z},{x:x+tw/n,y:z+td/n},{x,y:z+td/n}];
   for(const p of yardSolidCells(yardClip([cell],cuts,'difference')))for(let i=1;i<p.length-1;i++)for(const v of [p[0],p[i+1],p[i]]){positions.push(v.x,yard.terrain.elevationIn+v.y*yard.terrain.slopePct/100-.7,v.y);uvs.push(v.x/72,v.y/72);const t=tint(v.x,v.y);colors.push(t,t,t);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
 },[yard,cuts,width,depth]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 useEffect(()=>{let cancelled=false;const loaded:THREE.Texture[]=[];const loader=new THREE.TextureLoader();
   [colorUrl,normalUrl,roughnessUrl].forEach((url,index)=>loader.load(url,texture=>{if(cancelled){texture.dispose();return;}loaded.push(texture);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=Math.min(16,gl.capabilities.getMaxAnisotropy());texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
    if(index===0){texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;material.color.set('#89917e');}else if(index===1)material.normalMap=texture;else material.roughnessMap=texture;material.needsUpdate=true;invalidate();
   }));return ()=>{cancelled=true;loaded.forEach(t=>t.dispose());material.map=null;material.normalMap=null;material.roughnessMap=null;};
 },[material,gl,invalidate]);
 useEffect(()=>()=>material.dispose(),[material]);
 const count=18000;
 const blade=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.1,0,0,.1,0,0,.14,1,0,0,0,-.1,0,0,.1,0,1,.14],3));g.computeVertexNormals();return g;},[]);
 useEffect(()=>()=>blade.dispose(),[blade]);
 useLayoutEffect(()=>{if(!ref.current)return;const m=new THREE.Matrix4(),q=new THREE.Quaternion();let seed=317;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};let used=0;
  for(let i=0;i<count;i++){const x=-width*.7+random()*width*2.4,z=-18+random()*(depth+width*.8),h=.45+random()*.8;let inside=false;for(const poly of cuts){let hit=false;for(let a=0,b=poly.length-1;a<poly.length;b=a++){const p=poly[a],q=poly[b];if((p.y>z)!==(q.y>z)&&x<(q.x-p.x)*(z-p.y)/(q.y-p.y)+p.x)hit=!hit;}if(hit)inside=!inside;}if(inside)continue;q.setFromAxisAngle(new THREE.Vector3(0,1,0),random()*Math.PI*2);m.compose(new THREE.Vector3(x,yard.terrain.elevationIn+z*yard.terrain.slopePct/100-.55,z),q,new THREE.Vector3(.75+random(),h,.75+random()));ref.current.setMatrixAt(used,m);const shade=.8+random()*.3;ref.current.setColorAt(used,new THREE.Color(.27*shade,.36*shade,.12*shade));used++;}
  ref.current.count=used;ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();invalidate();
 },[width,depth,invalidate,yard,cuts]);
 return <group name="textured-lawn">
  <mesh receiveShadow geometry={geometry}><primitive object={material} attach="material"/></mesh>
  <instancedMesh name="close-view-grass-blades" ref={ref} args={[blade,undefined,count]} receiveShadow><meshStandardMaterial color="#ffffff" roughness={.95} side={THREE.DoubleSide}/></instancedMesh>
 </group>;
}
