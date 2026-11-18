import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {Box,Member} from '../../deckTakeoff';

type Part={position:THREE.Vector3;rotation:THREE.Quaternion;size:[number,number,number]};
/** A 1/25 inch edge radius on the actual extrusion dimensions, never a radius stretched with the instance. */
export function railGeometry(size:[number,number,number]){
  return new RoundedBoxGeometry(...size,1,Math.min(.04,...size.map(v=>v/8)));
}
function Batch({parts,material,name}:{parts:Part[];material:THREE.Material;name:string}){
  const mesh=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate),size=parts[0].size;
  const geometry=useMemo(()=>railGeometry(size),[size[0],size[1],size[2]]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useLayoutEffect(()=>{
    const target=mesh.current;if(!target)return;const matrix=new THREE.Matrix4(),scale=new THREE.Vector3(1,1,1);
    parts.forEach((part,i)=>{matrix.compose(part.position,part.rotation,scale);target.setMatrixAt(i,matrix);});
    target.instanceMatrix.needsUpdate=true;target.computeBoundingSphere();invalidate();
  },[parts,invalidate]);
  return <instancedMesh ref={mesh} name={name} args={[geometry,material,parts.length]} castShadow receiveShadow/>;
}
function Category({parts,material,name}:{parts:Part[];material:THREE.Material;name:string}){
  const groups=useMemo(()=>{
    const grouped=new Map<string,Part[]>();
    for(const part of parts){const key=part.size.join(':');const group=grouped.get(key)??[];group.push(part);grouped.set(key,group);}
    return [...grouped];
  },[parts]);
  return <>{groups.map(([key,items])=><Batch key={key} parts={items} material={material} name={name}/>)}</>;
}
function memberParts(members:Member[]):Part[]{
  return members.map(member=>{
    const a=new THREE.Vector3(member.a.x,member.a.y,member.a.z),b=new THREE.Vector3(member.b.x,member.b.y,member.b.z),axis=b.clone().sub(a),length=axis.length();axis.normalize();
    const up=Math.abs(axis.y)>.99?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0),side=new THREE.Vector3().crossVectors(axis,up).normalize(),vertical=new THREE.Vector3().crossVectors(side,axis).normalize();
    return {position:a.add(b).multiplyScalar(.5),rotation:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(axis,vertical,side)),size:[Math.max(.01,length),member.depth,member.width]};
  });
}
/** Group identical metal extrusions into instances. Bounds, centres and railing endpoints stay those of the model. */
export default function EasedRails({posts,rails,balusters,material}:{posts:Box[];rails:Member[];balusters:Member[];material:THREE.Material}){
  const postParts=useMemo(()=>posts.map(post=>({position:new THREE.Vector3(post.x,post.y,post.z),rotation:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),post.angle??0),size:[post.w,post.h,post.d] as [number,number,number]})),[posts]);
  const runParts=useMemo(()=>memberParts(rails),[rails]),infillParts=useMemo(()=>memberParts(balusters),[balusters]);
  return <><Category parts={postParts} material={material} name="railing-posts"/><Category parts={runParts} material={material} name="railing-runs"/><Category parts={infillParts} material={material} name="railing-infill"/></>;
}
