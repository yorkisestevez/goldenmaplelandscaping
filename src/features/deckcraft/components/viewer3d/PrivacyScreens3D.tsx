import {useEffect,useMemo,useRef} from 'react';
import * as THREE from 'three';
import {useThree,type ThreeEvent} from '@react-three/fiber';
import {screenOffsetFromPoint,type PrivacyPanelBox,type PrivacyScreenHandle} from '../../extrasLayout';

const FINISH_COLOR={Black:'#1f2222',White:'#ebe7dc'} as const;
// Illustrative cut families only; each manufacturer design has its own artwork.
const CUT_FAMILY:Record<string,'rows'|'stalks'|'cells'|null>={Solid:null,Horizon:'rows',Dash:'rows',Rain:'rows',Bamboo:'stalks',Branch:'stalks',Breeze:'stalks',Driftwood:'stalks'};

/** Alpha map for a laser-cut look: white = metal, black = open. A solid frame border is kept. */
function cutAlphaMap(design:string){
  const family=design in CUT_FAMILY?CUT_FAMILY[design]:'cells';
  if(!family)return null;
  const c=document.createElement('canvas');c.width=72;c.height=136;const g=c.getContext('2d')!;
  g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.fillStyle='#000';
  let seed=[...design].reduce((n,ch)=>(n*31+ch.charCodeAt(0))>>>0,7);const rand=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
  if(family==='rows')for(let y=8;y<c.height-8;y+=6)for(let x=6;x<c.width-6;){const w=6+rand()*22;g.fillRect(x,y,Math.min(w,c.width-6-x),2.2);x+=w+3;}
  else if(family==='stalks')for(let x=7;x<c.width-7;x+=7)for(let y=6;y<c.height-6;){const h=10+rand()*26;g.fillRect(x,y,2.2,Math.min(h,c.height-6-y));y+=h+3;}
  else for(let y=9;y<c.height-6;y+=7)for(let x=((y/7)%2?9:5.5);x<c.width-6;x+=7){g.beginPath();g.arc(x,y,1.3+rand()*1.5,0,Math.PI*2);g.fill();}
  const tex=new THREE.CanvasTexture(c);tex.needsUpdate=true;return tex;
}

function Panel({panel}:{panel:PrivacyPanelBox}){
  const alpha=useMemo(()=>cutAlphaMap(panel.design),[panel.design]);
  useEffect(()=>()=>alpha?.dispose(),[alpha]);
  return <mesh position={[panel.x,panel.y,panel.z]} rotation={[0,panel.angle??0,0]} castShadow receiveShadow>
    <boxGeometry args={[panel.w,panel.h,Math.max(panel.d,.1)]}/>
    <meshStandardMaterial color={FINISH_COLOR[panel.finish]} metalness={.35} roughness={.6} alphaMap={alpha??undefined} alphaTest={alpha?.5:0} side={THREE.DoubleSide}/>
  </mesh>;
}

/** Invisible grab boxes: drag a screen to slide it along its deck edge (same pattern as house openings). */
function ScreenHandles({handles,onMove}:{handles:PrivacyScreenHandle[];onMove:(id:string,offsetPct:number)=>void}){
  const groupRef=useRef<THREE.Group>(null),controls=useThree(s=>s.controls),gl=useThree(s=>s.gl);
  const drag=useRef<{handle:PrivacyScreenHandle;plane:THREE.Plane;inverse:THREE.Matrix4;grabAlong:number}|null>(null);
  const restore=()=>{drag.current=null;if(controls&&'enabled' in controls)controls.enabled=true;};
  useEffect(()=>restore,[controls]);
  const start=(e:ThreeEvent<PointerEvent>,handle:PrivacyScreenHandle)=>{
    if(!groupRef.current)return;e.stopPropagation();
    groupRef.current.updateWorldMatrix(true,false);
    const inverse=groupRef.current.matrixWorld.clone().invert(),local=e.point.clone().applyMatrix4(inverse),{edge}=handle;
    // Keep the grab point under the pointer instead of snapping the screen's centre to it.
    const grabAlong=(local.x-handle.x)*edge.dx+(local.z-handle.z)*edge.dz;
    drag.current={handle,plane:new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0,1,0),e.point),inverse,grabAlong};
    if(controls&&'enabled' in controls)controls.enabled=false;
    gl.domElement.style.cursor='grabbing';
    (e.target as unknown as {setPointerCapture:(id:number)=>void}).setPointerCapture(e.pointerId);
  };
  const move=(e:ThreeEvent<PointerEvent>)=>{
    const active=drag.current;if(!active)return;e.stopPropagation();
    const hit=e.ray.intersectPlane(active.plane,new THREE.Vector3());if(!hit)return;hit.applyMatrix4(active.inverse);
    const {dx,dz}=active.handle.edge;
    const offsetPct=screenOffsetFromPoint(active.handle,hit.x-dx*active.grabAlong,hit.z-dz*active.grabAlong);
    if(offsetPct!==null)onMove(active.handle.id,offsetPct);
  };
  const end=(e:ThreeEvent<PointerEvent>)=>{if(!drag.current)return;e.stopPropagation();restore();gl.domElement.style.cursor='grab';(e.target as unknown as {releasePointerCapture:(id:number)=>void}).releasePointerCapture(e.pointerId);};
  return <group ref={groupRef} name="privacy-screen-drag-handles">{handles.map(h=><mesh key={h.id} name={`privacy-screen-handle-${h.id}`} position={[h.x,h.y,h.z]} rotation={[0,h.angle,0]}
    onPointerDown={e=>start(e,h)} onPointerMove={move} onPointerUp={end} onLostPointerCapture={restore}
    onPointerOver={e=>{e.stopPropagation();if(!drag.current)gl.domElement.style.cursor='grab';}} onPointerOut={()=>{if(!drag.current)gl.domElement.style.cursor='';}}>
    <boxGeometry args={[h.w,h.h,8]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/>
  </mesh>)}</group>;
}

export default function PrivacyScreens3D({panels,handles,onMove}:{panels:PrivacyPanelBox[];handles:PrivacyScreenHandle[];onMove?:(id:string,offsetPct:number)=>void}){
  return <group name="privacy-screens">
    <group name="manufacturer-privacy-panels">{panels.map((p,i)=><Panel key={`${p.screenId}-${i}`} panel={p}/>)}</group>
    {onMove&&<ScreenHandles handles={handles} onMove={onMove}/>}
  </group>;
}
