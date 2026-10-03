import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {useFixtureLit} from './fixtureLighting';
import {addMaterialPatch} from './materialPatches';
import {LAWN_MEAN} from './lawnSurface';
import type {LawnTuft} from './lawnTufts';

/** A bounded render-only blade batch shared by the lawn and finished wall banks. */
export default function GrassBlades({tufts,budget,name='close-view-grass-blades'}:{tufts:LawnTuft[];budget:number;name?:string}){
 const ref=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate);
 const material=useMemo(()=>{
  const m=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.95,side:THREE.DoubleSide,transparent:true,depthWrite:false});
  addMaterialPatch(m,{key:'mown-grass-distance-v1',apply:shader=>{
   shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>','#include <alphamap_fragment>\n diffuseColor.a*=1.-smoothstep(18.,55.,length(vViewPosition));');
  }});return m;
 },[]);
 useFixtureLit(material);useEffect(()=>()=>material.dispose(),[material]);
 const blade=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.055,0,0,.055,0,0,.035,.55,.055,-.055,0,0,.035,.55,.055,-.045,.55,.055,-.045,.55,.055,.035,.55,.055,.025,1,.18],3));g.setAttribute('color',new THREE.Float32BufferAttribute([.75,.75,.75,.75,.75,.75,1,1,1,.75,.75,.75,1,1,1,1,1,1,1,1,1,1,1,1.12,1.12,1.12],3));g.computeVertexNormals();return g;},[]);
 useEffect(()=>()=>blade.dispose(),[blade]);
 useLayoutEffect(()=>{if(!ref.current)return;const m=new THREE.Matrix4(),q=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);
  tufts.slice(0,budget).forEach((t,i)=>{q.setFromAxisAngle(axis,t.yaw);m.compose(new THREE.Vector3(t.x,t.y,t.z),q,new THREE.Vector3(t.width,t.height,t.width));ref.current!.setMatrixAt(i,m);ref.current!.setColorAt(i,new THREE.Color(LAWN_MEAN[0]*t.tone,LAWN_MEAN[1]*t.tone,LAWN_MEAN[2]*t.tone));});
  ref.current.count=Math.min(tufts.length,budget);ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();invalidate();
 },[tufts,budget,invalidate]);
 if(budget<1)return null;
 return <instancedMesh name={name} ref={ref} args={[blade,undefined,budget]} receiveShadow userData={{coversGround:false}}><primitive object={material} attach="material"/></instancedMesh>;
}
