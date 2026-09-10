import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {DeckData} from '../../types';
import type {DeckTakeoff,V3} from '../../deckTakeoff';

type Part={position:THREE.Vector3;axis:THREE.Vector3;size:THREE.Vector3};
const vec=(p:V3)=>new THREE.Vector3(p.x,p.y,p.z);

/** Fittings follow the shared panel and cable endpoints; no extra railing runs. */
function FittingBatch({parts,shape,material,name}:{parts:Part[];shape:'box'|'cylinder'|'hex';material:THREE.Material;name:string}){
  const mesh=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate);
  useLayoutEffect(()=>{
    if(!mesh.current)return;const m=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
    parts.forEach((p,i)=>{const axis=p.axis.clone().normalize();if(shape==='box')q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(up,axis,new THREE.Vector3().crossVectors(up,axis)));else q.setFromUnitVectors(up,axis);m.compose(p.position,q,p.size);mesh.current!.setMatrixAt(i,m);});
    mesh.current.count=parts.length;mesh.current.instanceMatrix.needsUpdate=true;mesh.current.computeBoundingSphere();invalidate();
  },[parts,shape,invalidate]);
  return <instancedMesh ref={mesh} key={parts.length} args={[undefined,material,Math.max(1,parts.length)]} castShadow receiveShadow name={name}>
    {shape==='box'?<boxGeometry args={[1,1,1]}/>:<cylinderGeometry args={[1,1,1,shape==='hex'?6:16]}/>}
  </instancedMesh>;
}

function GlassBatch({matrices,material}:{matrices:THREE.Matrix4[];material:THREE.Material}){
  const mesh=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate);
  useLayoutEffect(()=>{if(!mesh.current)return;matrices.forEach((m,i)=>mesh.current!.setMatrixAt(i,m));mesh.current.count=matrices.length;mesh.current.instanceMatrix.needsUpdate=true;mesh.current.computeBoundingSphere();invalidate();},[matrices,invalidate]);
  return <instancedMesh ref={mesh} key={matrices.length} args={[undefined,material,Math.max(1,matrices.length)]} name="half-inch-inset-glass-panels" renderOrder={2}><boxGeometry args={[1,1,1]}/></instancedMesh>;
}

export default function RailingDetails({data,model}:{data:DeckData;model:DeckTakeoff}){
  const materials=useMemo(()=>({
    glass:new THREE.MeshPhysicalMaterial({color:'#e5f1eb',roughness:.065,metalness:0,transmission:.87,ior:1.52,thickness:.5,attenuationColor:'#92bda6',attenuationDistance:150,transparent:true,opacity:1,depthWrite:false,envMapIntensity:1.25}),
    stainless:new THREE.MeshStandardMaterial({color:'#bdc4c6',metalness:.93,roughness:.24}),
    dark:new THREE.MeshStandardMaterial({color:'#303537',metalness:.68,roughness:.33}),
    rubber:new THREE.MeshStandardMaterial({color:'#19201f',metalness:0,roughness:.85}),
    edge:new THREE.MeshStandardMaterial({color:'#6d9b88',metalness:.1,roughness:.18,transparent:true,opacity:.32}),
  }),[]);
  useEffect(()=>()=>Object.values(materials).forEach(m=>m.dispose()),[materials]);
  const layout=useMemo(()=>{
    const glass:THREE.Matrix4[]=[],clamps:Part[]=[],pads:Part[]=[],bolts:Part[]=[],cables:Part[]=[],barrels:Part[]=[],nuts:Part[]=[],grommets:Part[]=[],edges:Part[]=[];
    const cylinder=(out:Part[],position:THREE.Vector3,axis:THREE.Vector3,radius:number,length:number)=>out.push({position,axis,size:new THREE.Vector3(radius,length,radius)});
    if(data.railingType==='Glass Panels')for(const panel of model.railing.glass){
      const a=vec(panel.a),b=vec(panel.b),direction=b.clone().sub(a),horizontal=new THREE.Vector3(direction.x,0,direction.z),span=horizontal.length();if(span<5)continue;
      horizontal.normalize();const normal=new THREE.Vector3(-horizontal.z,0,horizontal.x),trim=2.15,t=trim/span;
      const first=a.clone().lerp(b,t),last=b.clone().lerp(a,t),center=first.clone().add(last).multiplyScalar(.5);
      // A sheared box keeps stair panels vertical while their top/bottom follow the slope.
      const matrix=new THREE.Matrix4().makeBasis(last.clone().sub(first),new THREE.Vector3(0,panel.depth,0),normal.clone().multiplyScalar(panel.width));matrix.setPosition(center);glass.push(matrix);
      for(const endpoint of [first,last])for(const height of [-panel.depth*.31,panel.depth*.31]){
        const p=endpoint.clone().add(new THREE.Vector3(0,height,0));
        for(const side of [-1,1]){
          // Opposed padded jaws grip both faces without floating away from the post.
          clamps.push({position:p.clone().addScaledVector(normal,side*(panel.width/2+.16)),axis:horizontal,size:new THREE.Vector3(.72,1.12,.22)});
          pads.push({position:p.clone().addScaledVector(normal,side*(panel.width/2+.035)),axis:horizontal,size:new THREE.Vector3(.6,.85,.07)});
          cylinder(bolts,p.clone().addScaledVector(normal,side*(panel.width/2+.31)),normal,.11,.07);
        }
      }
      for(const height of [-panel.depth/2,panel.depth/2]){
        const p=first.clone().add(new THREE.Vector3(0,height,0)),q=last.clone().add(new THREE.Vector3(0,height,0));
        cylinder(edges,p.clone().add(q).multiplyScalar(.5),q.clone().sub(p),.035,p.distanceTo(q));
      }
    }
    if(data.railingType==='Cable')for(const cable of model.railing.balusters){
      const a=vec(cable.a),b=vec(cable.b),axis=b.clone().sub(a),length=axis.length();if(length<4)continue;axis.normalize();
      cylinder(cables,a.clone().add(b).multiplyScalar(.5),axis,cable.width/2,length);
      for(const [end,sign]of [[a,1],[b,-1]] as const){
        const inward=axis.clone().multiplyScalar(sign);
        cylinder(grommets,end.clone().addScaledVector(inward,1.8),inward,.23,.12);
        cylinder(barrels,end.clone().addScaledVector(inward,2.4),inward,.17,1.1);
        cylinder(nuts,end.clone().addScaledVector(inward,1.96),inward,.25,.22);
        cylinder(barrels,end.clone().addScaledVector(inward,3.08),inward,.095,.48);
      }
      // Shared post locations identify real intermediate pass-throughs.
      for(const post of model.railing.posts){
        const p=vec(post),along=p.clone().sub(a).dot(axis),point=a.clone().addScaledVector(axis,along);
        // The cable height differs from the post base, so compare only plan distance.
        const planDen=axis.x*axis.x+axis.z*axis.z;if(planDen<.01)continue;
        const d=((post.x-a.x)*axis.x+(post.z-a.z)*axis.z)/planDen;
        if(d<4||d>length-4)continue;point.copy(a).addScaledVector(axis,d);
        if(Math.hypot(point.x-post.x,point.z-post.z)>.2||point.y<post.y||point.y>post.y+model.railing.height)continue;
        for(const side of [-1,1])cylinder(grommets,point.clone().addScaledVector(axis,side*1.8),axis,.19,.1);
      }
    }
    return {glass,clamps,pads,bolts,cables,barrels,nuts,grommets,edges};
  },[data.railingType,model]);
  if(data.railingType!=='Glass Panels'&&data.railingType!=='Cable')return null;
  return <group name="railing-product-details">
    {layout.glass.length>0&&<GlassBatch matrices={layout.glass} material={materials.glass}/>}
    <FittingBatch parts={layout.clamps} shape="box" material={materials.dark} name="glass-clamp-jaws"/>
    <FittingBatch parts={layout.pads} shape="box" material={materials.rubber} name="glass-clamp-pads"/>
    <FittingBatch parts={layout.bolts} shape="hex" material={materials.stainless} name="glass-clamp-screws"/>
    <FittingBatch parts={layout.edges} shape="cylinder" material={materials.edge} name="polished-glass-edges"/>
    <FittingBatch parts={layout.cables} shape="cylinder" material={materials.stainless} name="one-eighth-inch-stainless-cables"/>
    <FittingBatch parts={layout.barrels} shape="cylinder" material={materials.stainless} name="cable-tensioner-barrels"/>
    <FittingBatch parts={layout.nuts} shape="hex" material={materials.stainless} name="cable-lock-nuts"/>
    <FittingBatch parts={layout.grommets} shape="cylinder" material={materials.rubber} name="cable-post-grommets"/>
  </group>;
}
