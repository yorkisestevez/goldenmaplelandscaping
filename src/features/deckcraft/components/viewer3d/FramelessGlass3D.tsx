import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {GLASS_FINISH_HEX,type FramelessGlassLayout} from '../../framelessGlass';
import {SCENE_LOOK} from './sceneLook';
import {framelessGlassParts} from './framelessGlassParts';
import {railingGlassMaterial} from './railingGlass';

function Batch({matrices,shape,material,name,shadow=true,order}:{matrices:THREE.Matrix4[];shape:'box'|'cylinder'|'hex';material:THREE.Material;name:string;shadow?:boolean;order?:number}){
  const mesh=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate);
  useLayoutEffect(()=>{
    if(!mesh.current)return;matrices.forEach((m,i)=>mesh.current!.setMatrixAt(i,m));
    mesh.current.count=matrices.length;mesh.current.instanceMatrix.needsUpdate=true;mesh.current.computeBoundingSphere();invalidate();
  },[matrices,invalidate]);
  if(!matrices.length)return null;
  return <instancedMesh ref={mesh} key={matrices.length} args={[undefined,material,matrices.length]} castShadow={shadow} receiveShadow={shadow} name={name} renderOrder={order}>
    {shape==='box'?<boxGeometry args={[1,1,1]}/>:<cylinderGeometry args={[1,1,1,shape==='hex'?6:20]}/>}
  </instancedMesh>;
}

/**
 * A frameless glass railing (framelessGlass.ts): 1/2 in panels with polished edges standing in a base shoe (on the deck
 * or on the rim face) or on spigots, and on the stairs a round handrail on glass brackets. No posts, no top rail.
 */
export default function FramelessGlass3D({layout}:{layout:FramelessGlassLayout}){
  const hex=GLASS_FINISH_HEX[layout.finish];
  const materials=useMemo(()=>{
    // The same glass as the framed glass panels (railingGlass.ts).
    const glass=railingGlassMaterial();
    const metal=layout.finish==='Black'?new THREE.MeshPhysicalMaterial({color:hex,...SCENE_LOOK.powderCoat}):new THREE.MeshStandardMaterial({color:hex,metalness:.9,roughness:.3});
    return {glass,metal,
      edge:new THREE.MeshStandardMaterial({color:'#6d9b88',metalness:.1,roughness:.18,transparent:true,opacity:.32}),
      rubber:new THREE.MeshStandardMaterial({color:'#19201f',metalness:0,roughness:.85}),
      stainless:new THREE.MeshStandardMaterial({color:'#bdc4c6',metalness:.93,roughness:.24})};
  },[layout.finish,hex]);
  useEffect(()=>()=>Object.values(materials).forEach(m=>m.dispose()),[materials]);
  const parts=useMemo(()=>framelessGlassParts(layout),[layout]);
  return <group name="frameless-glass-railing">
    <Batch matrices={parts.glass} shape="box" material={materials.glass} name="frameless-glass-panels" shadow={false} order={2}/>
    <Batch matrices={parts.edges} shape="cylinder" material={materials.edge} name="frameless-glass-polished-edges" shadow={false}/>
    <Batch matrices={parts.shoes} shape="box" material={materials.metal} name="frameless-glass-base-shoe"/>
    <Batch matrices={parts.gaskets} shape="box" material={materials.rubber} name="frameless-glass-shoe-gaskets"/>
    <Batch matrices={parts.bolts} shape="hex" material={materials.stainless} name="frameless-glass-shoe-anchors"/>
    <Batch matrices={parts.spigots} shape="cylinder" material={materials.metal} name="frameless-glass-spigots"/>
    <Batch matrices={parts.plates} shape="cylinder" material={materials.metal} name="frameless-glass-spigot-plates"/>
    <Batch matrices={parts.rails} shape="cylinder" material={materials.metal} name="frameless-glass-handrail"/>
    <Batch matrices={parts.brackets} shape="cylinder" material={materials.metal} name="frameless-glass-handrail-brackets"/>
  </group>;
}
