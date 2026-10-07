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
  const m=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.95,side:THREE.DoubleSide,transparent:false,depthWrite:true});
  addMaterialPatch(m,{key:'mown-grass-distance-v1',apply:shader=>{
   shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>','#include <alphamap_fragment>\n float grassFade=1.-smoothstep(18.,55.,length(vViewPosition));if(fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)>grassFade)discard;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.indirectDiffuse+=diffuseColor.rgb*.12;');
  }});return m;
 },[]);
 useFixtureLit(material);useEffect(()=>()=>material.dispose(),[material]);
 const blade=useMemo(()=>{const positions:number[]=[],colors:number[]=[];for(let b=0;b<9;b++){const angle=b*2.399,c=Math.cos(angle),s=Math.sin(angle),height=.7+b*.035;for(let j=0;j<3;j++){const vertex=(k:number,side:number)=>{const t=k/3,w=.045*(1-t)+.001,x=side*w,z=t*t*.3;return [c*x-s*z+c*.65,t*height,s*x+c*z+s*.65];};for(const [k,side] of [[j,-1],[j,1],[j+1,1],[j,-1],[j+1,1],[j+1,-1]]){positions.push(...vertex(k,side));const light=.7+k*.13;colors.push(light,light,light*.93);}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;},[]);
 useEffect(()=>()=>blade.dispose(),[blade]);
 useLayoutEffect(()=>{if(!ref.current)return;const m=new THREE.Matrix4(),q=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);
  tufts.slice(0,budget).forEach((t,i)=>{q.setFromAxisAngle(axis,t.yaw);m.compose(new THREE.Vector3(t.x,t.y,t.z),q,new THREE.Vector3(t.width,t.height,t.width));ref.current!.setMatrixAt(i,m);ref.current!.setColorAt(i,new THREE.Color(LAWN_MEAN[0]*t.tone,LAWN_MEAN[1]*t.tone,LAWN_MEAN[2]*t.tone));});
  ref.current.count=Math.min(tufts.length,budget);ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();invalidate();
 },[tufts,budget,invalidate]);
 if(budget<1)return null;
 return <instancedMesh name={name} ref={ref} args={[blade,undefined,budget]} receiveShadow raycast={()=>{}} userData={{coversGround:false,renderOnly:true}}><primitive object={material} attach="material"/></instancedMesh>;
}
