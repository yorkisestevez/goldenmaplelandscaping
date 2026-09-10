import {useEffect,useMemo,useRef} from 'react';
import {useThree,type ThreeEvent} from '@react-three/fiber';
import * as THREE from 'three';
import type {HouseConfig,HouseOpening} from '../../types';
import type {Box} from '../../deckTakeoff';
import HouseParts from './HouseParts';
import {houseWallParts} from './houseWallParts';
import type {HouseInteraction} from './houseInteraction';

export default function HouseFacade({span,height,openings,config,evening,selectedHouseOpeningId,onSelectHouseOpening,onMoveHouseOpening}:{span:number;height:number;openings:HouseOpening[];config:HouseConfig;evening:boolean}&HouseInteraction){
 const facadeRef=useRef<THREE.Group>(null),controls=useThree(s=>s.controls),drag=useRef<{opening:HouseOpening;start:THREE.Vector3;plane:THREE.Plane;inverse:THREE.Matrix4}|null>(null);
 const restoreControls=()=>{drag.current=null;if(controls&&'enabled' in controls)controls.enabled=true;};
 useEffect(()=>restoreControls,[controls]);
 const startDrag=(e:ThreeEvent<PointerEvent>,opening:HouseOpening)=>{if(!onSelectHouseOpening&&!onMoveHouseOpening)return;e.stopPropagation();onSelectHouseOpening?.(opening.id);if(!onMoveHouseOpening||!facadeRef.current)return;facadeRef.current.updateWorldMatrix(true,false);const world=facadeRef.current.matrixWorld,inverse=world.clone().invert(),normal=new THREE.Vector3(0,0,1).transformDirection(world);drag.current={opening:{...opening},start:e.point.clone().applyMatrix4(inverse),plane:new THREE.Plane().setFromNormalAndCoplanarPoint(normal,e.point),inverse};if(controls&&'enabled' in controls)controls.enabled=false;(e.target as unknown as {setPointerCapture:(id:number)=>void}).setPointerCapture(e.pointerId);};
 const moveDrag=(e:ThreeEvent<PointerEvent>)=>{const active=drag.current;if(!active)return;e.stopPropagation();const hit=e.ray.intersectPlane(active.plane,new THREE.Vector3());if(!hit)return;hit.applyMatrix4(active.inverse);onMoveHouseOpening?.(active.opening.id,{offsetPct:active.opening.offsetPct+(hit.x-active.start.x)/span*100,bottomIn:active.opening.bottomIn+hit.y-active.start.y});};
 const endDrag=(e:ThreeEvent<PointerEvent>)=>{if(!drag.current)return;e.stopPropagation();restoreControls();(e.target as unknown as {releasePointerCapture:(id:number)=>void}).releasePointerCapture(e.pointerId);};
 const shapes=useMemo(()=>openings.map(o=>({...o,x:-span/2+span*o.offsetPct/100,y:o.bottomIn+o.heightIn/2,w:o.widthIn,h:o.heightIn})),[span,openings]);
 const wall=useMemo(()=>houseWallParts(span,height,openings),[span,height,openings]);
 const brick=config.cladding==='Brick';
 const skin=useMemo(()=>{const boxes:Box[]=[],pitch=brick?2.625:7,partH=brick?2.25:6.8;let row=0;for(let bottom=0;bottom<height;bottom+=pitch,row++){
   const h=Math.min(partH,height-bottom),y=bottom+h/2;let segments:[number,number][]=[[-span/2,span/2]];
   for(const o of shapes)if(bottom+h>o.y-o.h/2&&bottom<o.y+o.h/2)segments=segments.flatMap(([a,b])=>o.x+o.w/2<=a||o.x-o.w/2>=b?[[a,b]]:[...(o.x-o.w/2>a?[[a,o.x-o.w/2]]:[]),...(o.x+o.w/2<b?[[o.x+o.w/2,b]]:[])] as [number,number][]);
   for(const [a,b] of segments){if(!brick){if(b>a)boxes.push({x:(a+b)/2,y,z:.3,w:b-a,h,d:.6});continue;}
     const start=-span/2-(row%2)*4;for(let x=start+Math.floor((a-start)/8)*8;x<b;x+=8){const lo=Math.max(a,x+.1875),hi=Math.min(b,x+7.8125);if(hi>lo)boxes.push({x:(lo+hi)/2,y,z:.38,w:hi-lo,h,d:.76});}
   }
  }return boxes;},[span,height,shapes,brick]);
 const trim=useMemo(()=>{const boxes:Box[]=[];for(const o of shapes){for(const side of [-1,1])boxes.push({x:o.x+side*(o.w/2+1.5),y:o.y,z:1.8,w:3,h:o.h+6,d:2.2});for(const side of [-1,1])boxes.push({x:o.x,y:o.y+side*(o.h/2+1.5),z:1.8,w:o.w,h:3,d:2.2});}for(const x of [-span/2+1.5,span/2-1.5])boxes.push({x,y:height/2,z:1.2,w:3,h:height,d:1.8});boxes.push({x:0,y:height-2,z:1.5,w:span,h:4,d:2});return boxes;},[span,height,shapes]);
 return <group ref={facadeRef}>
  <HouseParts name="wall-with-actual-opening-cutouts" items={wall} color={brick?'#b8b2a7':config.claddingColor}/>
  <HouseParts items={skin} color={config.claddingColor} name={brick?'individual-brick-courses':'siding-courses'} variation={brick}/>
  <HouseParts items={trim} color={config.trimColor} name="opening-and-corner-trim"/>
  {shapes.map(o=><group key={o.id} name={`${o.facade}-${o.type}-${o.id}`} onPointerDown={e=>startDrag(e,o)} onPointerMove={moveDrag} onPointerUp={endDrag} onLostPointerCapture={restoreControls}>
    {o.id===selectedHouseOpeningId&&<mesh position={[o.x,o.y,3.2]}><boxGeometry args={[o.w+7,o.h+7,.6]}/><meshBasicMaterial color="#df9b30" wireframe depthTest/></mesh>}
    <mesh position={[o.x,o.y,-12]}><boxGeometry args={[o.w,o.h,.5]}/><meshStandardMaterial color={evening?'#9b7b54':'#414947'} emissive={evening?'#efb873':'#000000'} emissiveIntensity={evening?.16:0} roughness={1}/></mesh>
    <mesh position={[o.x,o.y,.8]}><boxGeometry args={[Math.max(1,o.w-3),Math.max(1,o.h-3),.24]}/><meshPhysicalMaterial color="#c1d1d3" roughness={.08} transmission={.25} transparent opacity={.48} thickness={.24} ior={1.5} clearcoat={1} envMapIntensity={1.4} depthTest depthWrite={false}/></mesh>
    <HouseParts items={[...(o.w>42?[{x:o.x,y:o.y,z:1.2,w:1.5,h:o.h,d:1.8}]:[]),...(o.type==='Window'?[{x:o.x,y:o.y,z:1.2,w:o.w,h:1.2,d:1.8}]:[])]} color="#38413f" name="opening-mullions"/>
    {o.type==='Door'&&<HouseParts items={[{x:o.x+(o.w>42?3:o.w/2-5),y:o.bottomIn+Math.min(36,o.h/2),z:3,w:.8,h:8,d:1.6},{x:o.x,y:o.bottomIn-.7,z:3,w:o.w+7,h:1.4,d:7}]} color="#68716d" name="door-handle-and-threshold"/>}
  </group>)}
 </group>;
}
