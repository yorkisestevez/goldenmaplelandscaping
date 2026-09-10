import {useMemo,useLayoutEffect,useRef} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {type DeckData} from '../../types';
import {type DeckTakeoff,type Box} from '../../deckTakeoff';
import {getHardwareLayout,type Fastener} from '../../hardwareLayout';
function Fasteners({items,radius,name}:{items:(Fastener&{yaw?:number})[];radius:number;name:string}){
  const ref=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate);
  useLayoutEffect(()=>{if(!ref.current)return;const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),yaw=new THREE.Quaternion();items.forEach((p,i)=>{q.setFromAxisAngle(new THREE.Vector3(1,0,0),p.axis==='front'?Math.PI/2:0);yaw.setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw||0);q.premultiply(yaw);matrix.compose(new THREE.Vector3(p.x,p.y,p.z),q,new THREE.Vector3(1,1,1));ref.current!.setMatrixAt(i,matrix);});ref.current.count=items.length;ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere();invalidate();},[items,invalidate]);
  return <instancedMesh name={name} castShadow ref={ref} key={items.length} args={[undefined,undefined,Math.max(1,items.length)]}><cylinderGeometry args={[radius,radius,.12,8]}/><meshStandardMaterial color="#5d6363" metalness={.8} roughness={.35} depthTest depthWrite transparent={false}/></instancedMesh>;
}
function Plates({items,name}:{items:Box[];name:string}){
  const ref=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate);
  useLayoutEffect(()=>{if(!ref.current)return;const m=new THREE.Matrix4(),q=new THREE.Quaternion();items.forEach((p,i)=>{q.setFromAxisAngle(new THREE.Vector3(0,1,0),p.angle||0);m.compose(new THREE.Vector3(p.x,p.y,p.z),q,new THREE.Vector3(p.w,p.h,p.d));ref.current!.setMatrixAt(i,m);});ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere();invalidate();},[items,invalidate]);
  return <instancedMesh name={name} ref={ref} key={items.length} args={[undefined,undefined,Math.max(1,items.length)]} castShadow><boxGeometry args={[1,1,1]}/><meshStandardMaterial color="#9da9af" roughness={.32} metalness={.8} depthTest depthWrite transparent={false}/></instancedMesh>;
}
export default function HardwareDetails({data,model,inspection=false}:{data:DeckData;model:DeckTakeoff;inspection?:boolean}){
  const hardware=useMemo(()=>getHardwareLayout(data,model),[data,model]);
  const depth=data.framingSize==='2x8'?7.25:data.framingSize==='2x12'?11.25:9.25;
  const at=(p:{x:number;y:number;z:number;yaw?:number},x:number,y:number,z:number)=>{const yaw=p.yaw||0;return {x:p.x+x*Math.cos(yaw)+z*Math.sin(yaw),y:p.y+y,z:p.z-x*Math.sin(yaw)+z*Math.cos(yaw),angle:yaw};};
  const plates=useMemo(()=>{const boxes:Box[]=[];
    for(const p of hardware.hangers){boxes.push({...at(p,0,-depth/2,0),w:2,h:.08,d:2.2});for(const side of [-1,1]){boxes.push({...at(p,side*.84,0,0),w:.08,h:depth,d:2.2});boxes.push({...at(p,side*1.7,0,-1.06),w:1.7,h:depth,d:.08});}}
    for(const p of hardware.beamTies){boxes.push({x:p.x+.85,y:p.y,z:p.z,w:.12,h:6,d:1.8});boxes.push({x:p.x+1.6,y:p.y-2.5,z:p.z,w:1.6,h:1,d:.12});}
    for(const p of hardware.blockingAngles){boxes.push({x:p.x,y:p.y,z:p.z,w:.1,h:3,d:1.5});boxes.push({x:p.x+.75,y:p.y,z:p.z+.75,w:1.5,h:3,d:.1});}
    for(const p of hardware.stringerConnectors){boxes.push({x:p.x,y:p.y,z:p.z,w:4,h:8,d:.12});boxes.push({x:p.x,y:p.y-3.5,z:p.z+1.5,w:3,h:.12,d:3});}
    return boxes;
  },[hardware,model,depth]);
  const exposedPlates=useMemo(()=>model.railing.posts.flatMap(p=>[{x:p.x,y:p.y+.15,z:p.z,w:5,h:.3,d:5},{x:p.x,y:p.y+model.railing.height+.15,z:p.z,w:3.8,h:.3,d:3.8}]),[model]);
  const postCaps=useMemo(()=>hardware.postCaps.flatMap(p=>{const level=model.levels.find(l=>l.supports.some(s=>Math.hypot(s.x-p.x,s.z-p.z)<.01)),beam=level?.beams.find(b=>Math.abs((b.a.z+b.b.z)/2-p.z)<6),yaw=beam?Math.atan2(beam.b.x-beam.a.x,beam.b.z-beam.a.z):Math.PI/2,base={...p,yaw},beamWidth=(level?.reference.bPly??3)*1.5;return [{...at(base,0,0,0),w:6,h:.15,d:6},...[-1,1].flatMap(side=>[{...at(base,side*(beamWidth/2+.07),2.5,0),w:.12,h:5,d:5},{...at(base,side*2.82,-2,0),w:.12,h:4,d:5}])];}),[hardware,model]);
  return <group name="construction-hardware">
    <Plates items={exposedPlates} name="exposed-railing-bases-and-caps"/>
    <Plates items={postCaps} name="exposed-beam-post-caps"/>
    <Fasteners items={hardware.railBolts.map(p=>({...p,axis:'up'}))} radius={.2} name="railing-anchor-bolts"/>
    {inspection&&<group name="concealed-hardware-inspection">
    <Plates items={plates} name="galvanized-connectors"/>
    <Fasteners items={hardware.screws} radius={hardware.hidden?.17:.11} name={hardware.hidden?'hidden-fastener-clips':'deck-screw-heads'}/>
    <Fasteners items={hardware.ledgerBolts} radius={.34} name="ledger-bolts"/>
    <Fasteners items={hardware.spliceBolts.map(p=>({...p,axis:'front'}))} radius={.34} name="stock-splice-bolts"/>
    <Fasteners items={hardware.hangers.flatMap(p=>[-1,1].flatMap(side=>[.2,.45,.7].map(h=>{const v=at(p,side*1.8,depth*(h-.5),-1);return {...v,yaw:v.angle,axis:'front' as const};})))} radius={.12} name="hanger-nails"/>
    </group>}
  </group>;
}
