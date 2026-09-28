import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {Box} from '../../deckTakeoff';
import type {HouseSurface} from './houseSurfaceKinds';
import {houseSurfaceMaterial} from './houseSurfaces';
/** Instanced boxes of one colour. surface (Real Life G4) adds scanned or painted detail up close (houseSurfaces.ts). */
export default function HouseParts({items,color,name,variation=false,roughness=.82,metalness=0,surface}:{items:Box[];color:string;name:string;variation?:boolean;roughness?:number;metalness?:number;surface?:HouseSurface}){
 const ref=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate),gl=useThree(s=>s.gl);
 const detailed=useMemo(()=>surface?houseSurfaceMaterial(surface,color,roughness,metalness,Math.min(8,gl.capabilities.getMaxAnisotropy()),invalidate):null,[surface,color,roughness,metalness,gl,invalidate]);
 useEffect(()=>()=>detailed?.dispose(),[detailed]);
 useLayoutEffect(()=>{if(!ref.current)return;const m=new THREE.Matrix4(),q=new THREE.Quaternion();items.forEach((b,i)=>{q.setFromAxisAngle(new THREE.Vector3(0,1,0),b.angle||0);m.compose(new THREE.Vector3(b.x,b.y,b.z),q,new THREE.Vector3(b.w,b.h,b.d));ref.current!.setMatrixAt(i,m);const shade=variation?.9+.1*(Math.abs(Math.sin(i*127.1)*437.58)%1):1;ref.current!.setColorAt(i,new THREE.Color(shade,shade,shade));});ref.current.count=items.length;ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();invalidate();},[items,invalidate,variation]);
 return <instancedMesh name={name} ref={ref} key={items.length} args={[undefined,undefined,Math.max(1,items.length)]} material={detailed??undefined} castShadow receiveShadow><boxGeometry args={[1,1,1]}/>{!detailed&&<meshStandardMaterial color={color} roughness={roughness} metalness={metalness} depthTest depthWrite/>}</instancedMesh>;
}
