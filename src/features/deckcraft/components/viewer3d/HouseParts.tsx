import {useLayoutEffect,useRef} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {Box} from '../../deckTakeoff';
export default function HouseParts({items,color,name,variation=false}:{items:Box[];color:string;name:string;variation?:boolean}){
 const ref=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate);
 useLayoutEffect(()=>{if(!ref.current)return;const m=new THREE.Matrix4(),q=new THREE.Quaternion();items.forEach((b,i)=>{q.setFromAxisAngle(new THREE.Vector3(0,1,0),b.angle||0);m.compose(new THREE.Vector3(b.x,b.y,b.z),q,new THREE.Vector3(b.w,b.h,b.d));ref.current!.setMatrixAt(i,m);const shade=variation?.9+.1*(Math.abs(Math.sin(i*127.1)*437.58)%1):1;ref.current!.setColorAt(i,new THREE.Color(shade,shade,shade));});ref.current.count=items.length;ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();invalidate();},[items,invalidate,variation]);
 return <instancedMesh name={name} ref={ref} key={items.length} args={[undefined,undefined,Math.max(1,items.length)]} castShadow receiveShadow><boxGeometry args={[1,1,1]}/><meshStandardMaterial color={color} roughness={.82} depthTest depthWrite/></instancedMesh>;
}
