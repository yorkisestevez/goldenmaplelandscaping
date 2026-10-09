import {useMemo,useEffect,useRef} from 'react';
import * as THREE from 'three';
import {useThree,type ThreeEvent} from '@react-three/fiber';
import {pergolaVertices,PERGOLA_FACES,pergolaParts,type PergolaPart} from '../../pergolaGeometry';
import {draggedPergola} from '../../pergolaTransform';
import type {PergolaSelection} from '../../pergolaCatalog';
import type {pergolaLayout} from '../../pergolaLayout';
import type {DeckData} from '../../types';
export interface PergolaInteraction{
 selected:boolean;mode:'move'|'rotate';onSelect:()=>void;
 onDraft:(patch:Partial<PergolaSelection>|null)=>void;onCommit:(patch:Partial<PergolaSelection>)=>void;
}
function Part({part,glow}:{part:PergolaPart;glow:number}){
 const geometry=useMemo(()=>{const vs=pergolaVertices(part),positions=PERGOLA_FACES.flatMap(f=>[f[0],f[1],f[2],f[0],f[2],f[3]]).flatMap(i=>[vs[i].x,vs[i].y,vs[i].z]);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;},[part]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 const louver=part.role==='louver';
 // Louvers are aluminium blades. A reflective white plane was picking up the lawn and reading as a flat green roof.
 return <mesh geometry={geometry} castShadow receiveShadow name={`aluminum-pergola-${part.role}`}><meshStandardMaterial color={part.color} metalness={part.role==='LED'?0:louver?.72:.5} roughness={part.role==='LED'?.45:louver?.4:.38} envMapIntensity={louver?.22:1} emissive={part.role==='LED'?'#ffd09a':'#000000'} emissiveIntensity={part.role==='LED'?glow:0} transparent={part.role==='screen'} opacity={part.role==='screen'?.72:1}/></mesh>;
}
export default function Pergola3D({layout,data,interaction}:{layout:ReturnType<typeof pergolaLayout>;data:DeckData;interaction?:PergolaInteraction}){
 const parts=useMemo(()=>layout?pergolaParts(data,layout):[],[data,layout]);
 const controls=useThree(s=>s.controls),gl=useThree(s=>s.gl);
 const drag=useRef<{pointer:number;plane:THREE.Plane;start:THREE.Vector3;selection:PergolaSelection;patch:Partial<PergolaSelection>;enabled:boolean;capture:Element;mode:'move'|'rotate'}|null>(null);
 const restore=()=>{const active=drag.current;if(!active)return;drag.current=null;if(controls&&'enabled' in controls)controls.enabled=active.enabled;gl.domElement.style.cursor='';try{active.capture.releasePointerCapture(active.pointer);}catch{/* Capture may already be lost. */}};
 const cancel=()=>{if(!drag.current)return;restore();interaction?.onDraft(null);};
 useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&drag.current){e.preventDefault();cancel();}};const canvas=gl.domElement;window.addEventListener('keydown',escape);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);return()=>{window.removeEventListener('keydown',escape);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('lostpointercapture',cancel);cancel();};},[controls,gl]);
 useEffect(()=>{cancel();},[data.pergola?.productId,data.pergola?.variantId]);
 const outline=useMemo(()=>{if(!layout||!interaction?.selected)return null;const points:number[]=[];layout.footprint.forEach((p,i)=>{const q=layout.footprint[(i+1)%4];points.push(p.x,layout.roofHigh+1,p.y,q.x,layout.roofHigh+1,q.y);});const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));return g;},[layout,interaction?.selected]);
 useEffect(()=>()=>outline?.dispose(),[outline]);
 if(!layout||!data.pergola)return null;
 const selection=data.pergola,glow=data.lightingPreviewOn===false?0:data.sceneLighting==='Evening'?4:1,lit=parts.filter(p=>p.role==='LED');
 const start=(e:ThreeEvent<PointerEvent>)=>{if(!interaction?.selected||e.button!==0||drag.current||!e.isPrimary)return;e.stopPropagation();drag.current={pointer:e.pointerId,plane:new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0,1,0),e.point),start:e.point.clone(),selection:{...selection},patch:{},capture:e.target as unknown as Element,mode:interaction.mode,enabled:!controls||!('enabled' in controls)||controls.enabled!==false};if(controls&&'enabled' in controls)controls.enabled=false;gl.domElement.style.cursor='grabbing';(e.target as unknown as Element).setPointerCapture(e.pointerId);};
 const move=(e:ThreeEvent<PointerEvent>)=>{const active=drag.current;if(!active||active.pointer!==e.pointerId)return;e.stopPropagation();const hit=e.ray.intersectPlane(active.plane,new THREE.Vector3());if(!hit)return;active.patch=draggedPergola(active.selection,active.start,hit,active.mode);interaction?.onDraft(active.patch);};
 const end=(e:ThreeEvent<PointerEvent>)=>{const active=drag.current;if(!active||active.pointer!==e.pointerId)return;e.stopPropagation();const patch=active.patch;restore();interaction?.onDraft(null);if(Object.entries(patch).some(([key,value])=>active.selection[key as keyof PergolaSelection]!==value))interaction?.onCommit(patch);};
 return <group userData={{pickPartId:'pergola:main'}} name="aluminum-pergola" onClick={interaction?e=>{if(e.delta<4){e.stopPropagation();interaction.onSelect();}}:undefined} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerOver={interaction?()=>{if(!drag.current)gl.domElement.style.cursor=interaction.selected?'grab':'pointer';}:undefined} onPointerOut={()=>{if(!drag.current)gl.domElement.style.cursor='';}}>
 {parts.map((p,i)=><Part key={i} part={p} glow={glow}/>)}
 {data.sceneLighting==='Evening'&&glow>0&&lit.map((p,i)=><pointLight key={i} name="pergola-led-light-spread" position={[p.x,p.y-2,p.z]} color="#ffd09a" intensity={45} distance={14} decay={2}/>)}
 {outline&&<lineSegments name="picked-pergola-outline" geometry={outline} renderOrder={10}><lineBasicMaterial color="#e39a24" depthTest={false} depthWrite={false}/></lineSegments>}
 </group>;
}
