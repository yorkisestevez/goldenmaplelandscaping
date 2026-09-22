import {useEffect,useMemo,useRef} from 'react';
import {useThree,type ThreeEvent} from '@react-three/fiber';
import * as THREE from 'three';
import type {HouseConfig,HouseOpening} from '../../types';
import type {Box} from '../../deckTakeoff';
import HouseParts from './HouseParts';
import {houseWallParts} from './houseWallParts';
import type {HouseInteraction} from './houseInteraction';
import {DOOR_SLAB_COLOR,GARAGE_DOOR_COLOR,WINDOW_FRAME_COLOR} from './houseGeometry';

const NONE:[number,number][]=[];
type Shape=HouseOpening&{x:number;y:number;w:number;h:number};

/** Removes [l, r] stretches from a list of [a, b] stretches. */
const cut=(spans:[number,number][],l:number,r:number):[number,number][]=>spans.flatMap(([a,b])=>(r<=a||l>=b?[[a,b]]:[...(l>a?[[a,l]]:[]),...(r<b?[[r,b]]:[])]) as [number,number][]);
/** Deterministic 0..1 noise so stone courses look the same on every render. */
const noise=(i:number,j:number)=>Math.abs(Math.sin(i*127.1+j*311.7)*43758.5453)%1;

/**
 * Procedural cladding for the newer finishes (brick and lap siding keep their own code):
 * - Stone: courses of 5–9 in with stones 9–22 in long, laid over a darker mortar wall.
 * - Stucco: a plain wall in the cladding colour (nothing added).
 * - Board & batten: 2½ in battens every 16 in over the wall.
 * - Vertical siding: 5⅝ in boards on a 6 in module with a shadow groove between them.
 * Openings and stretches hidden inside another house block are left clear.
 */
function claddingSkin(cladding:HouseConfig['cladding'],span:number,height:number,shapes:Shape[],hidden:[number,number][]):Box[]{
 const boxes:Box[]=[];
 if(cladding==='Stone'){
  let row=0;
  for(let bottom=0;bottom<height;row++){
   const course=5+Math.round(noise(row,1)*4),h=Math.min(course-.4,height-bottom),y=bottom+h/2;
   let segments:[number,number][]=[[-span/2,span/2]];for(const [l,r] of hidden)segments=cut(segments,l,r);
   for(const o of shapes)if(bottom+h>o.y-o.h/2&&bottom<o.y+o.h/2)segments=cut(segments,o.x-o.w/2,o.x+o.w/2);
   for(const [a,b] of segments){let x=a,i=0;while(x<b-.5){const len=Math.min(b-x,9+noise(row,i++)*13);boxes.push({x:x+len/2,y,z:.5,w:Math.max(.5,len-.4),h,d:1});x+=len;}}
   bottom+=course;
  }
  return boxes;
 }
 const [pitch,width,z,d]=cladding==='Board & batten'?[16,2.5,.6,1.2]:cladding==='Vertical siding'?[6,5.625,.3,.6]:[0,0,0,0];
 if(!pitch)return boxes;
 for(let x=-span/2+pitch/2;x<span/2;x+=pitch){
  if(hidden.some(([l,r])=>x>l&&x<r))continue;
  let runs:[number,number][]=[[0,height]];
  for(const o of shapes)if(x+width/2>o.x-o.w/2&&x-width/2<o.x+o.w/2)runs=cut(runs,o.y-o.h/2,o.y+o.h/2);
  for(const [lo,hi] of runs)if(hi-lo>.5)boxes.push({x,y:(lo+hi)/2,z,w:width,h:hi-lo,d});
 }
 return boxes;
}

function Glass({x,y,z,w,h}:{x:number;y:number;z:number;w:number;h:number}){
 return <mesh position={[x,y,z]}><boxGeometry args={[Math.max(1,w),Math.max(1,h),.24]}/><meshPhysicalMaterial color="#c1d1d3" roughness={.08} transmission={.25} transparent opacity={.48} thickness={.24} ior={1.5} clearcoat={1} envMapIntensity={1.4} depthTest depthWrite={false}/></mesh>;
}

/**
 * Window looks, in the facade frame (appearance only, never priced). The exported faces come from
 * `openingFaces`; this adds sash frames, rails and hardware.
 */
function StyledWindow({o}:{o:Shape}){
 const w=Math.max(1,o.w-3),h=Math.max(1,o.h-3),bottom=o.y-h/2,frame:Box[]=[],hardware:Box[]=[];
 const sash=(cx:number,cy:number,sw:number,sh:number,z:number)=>frame.push({x:cx-sw/2+1,y:cy,z,w:2,h:sh,d:1.2},{x:cx+sw/2-1,y:cy,z,w:2,h:sh,d:1.2},{x:cx,y:cy-sh/2+1,z,w:sw,h:2,d:1.2},{x:cx,y:cy+sh/2-1,z,w:sw,h:2,d:1.2});
 const panes:{x:number;y:number;z:number;w:number;h:number}[]=[];
 if(o.style==='Double-hung'){
  // Upper sash behind, lower sash in front, each framed, meeting on a rail with a sash lock.
  panes.push({x:o.x,y:o.y+h/4,z:.8,w,h:h/2},{x:o.x,y:o.y-h/4,z:1.6,w,h:h/2});sash(o.x,o.y+h/4,w,h/2,1.1);sash(o.x,o.y-h/4,w,h/2,1.9);
  hardware.push({x:o.x,y:o.y,z:2.6,w:3,h:.8,d:.8});
 }else if(o.style==='Slider'){
  panes.push({x:o.x-w/4,y:o.y,z:.8,w:w/2,h},{x:o.x+w/4,y:o.y,z:1.6,w:w/2,h});sash(o.x-w/4,o.y,w/2,h,1.1);sash(o.x+w/4,o.y,w/2,h,1.9);
  hardware.push({x:o.x+3,y:o.y,z:2.6,w:.8,h:4,d:.8});
 }else if(o.style==='Casement'){
  // One leaf, or two meeting on a mullion when the window is wide; a crank at the bottom of each.
  const leaves=w>40?2:1;
  for(let i=0;i<leaves;i++){const cx=o.x-w/2+w*(i+.5)/leaves;panes.push({x:cx,y:o.y,z:.8,w:w/leaves,h});sash(cx,o.y,w/leaves,h,1.2);hardware.push({x:cx,y:bottom+3,z:2.4,w:3,h:1,d:1.4});}
 }else if(o.style==='Awning'){
  // Hinged at the top, the sash tips out at the bottom.
  sash(o.x,o.y,w,h,1.2);hardware.push({x:o.x,y:bottom+3,z:2.4,w:4,h:1,d:1.4});
  return <><mesh position={[o.x,o.y,1.2+Math.sin(.12)*h/2]} rotation={[-.12,0,0]}><boxGeometry args={[w,h,.24]}/><meshPhysicalMaterial color="#c1d1d3" roughness={.08} transmission={.25} transparent opacity={.48} thickness={.24} ior={1.5} clearcoat={1} envMapIntensity={1.4} depthTest depthWrite={false}/></mesh><HouseParts items={frame} color={WINDOW_FRAME_COLOR} name="awning-window-sash"/><HouseParts items={hardware} color="#68716d" name="window-hardware"/></>;
 }else{
  // Picture window: one fixed pane in a heavier frame over a deeper sill.
  panes.push({x:o.x,y:o.y,z:.8,w,h});sash(o.x,o.y,w,h,1.3);frame.push({x:o.x,y:bottom-1,z:2.2,w:w+4,h:1.5,d:3});
 }
 return <>{panes.map((p,i)=><Glass key={i} {...p}/>)}<HouseParts items={frame} color={WINDOW_FRAME_COLOR} name={`${(o.style??'').toLowerCase()}-window-frames`}/>{hardware.length>0&&<HouseParts items={hardware} color="#68716d" name="window-hardware"/>}</>;
}

/** Door looks, in the facade frame (appearance only, never priced). The exported faces come from
 * `openingFaces`; this adds the panels, muntins, frames and handles. */
function StyledDoor({o}:{o:Shape}){
 const w=Math.max(1,o.w-3),h=Math.max(1,o.h-3),bottom=o.y-h/2,frame:Box[]=[],handles:Box[]=[];
 if(o.style==='Single'){
  // A painted slab: two raised panels below a glass lite, handle on the latch side.
  for(const col of [-1,1])frame.push({x:o.x+col*w/4,y:bottom+h*.22,z:1.8,w:w/2-5,h:h*.32,d:.5});
  handles.push({x:o.x+w/2-4,y:bottom+36,z:2.2,w:.8,h:8,d:1.6});
  return <><mesh position={[o.x,o.y,.8]}><boxGeometry args={[w,h,1.75]}/><meshStandardMaterial color={DOOR_SLAB_COLOR} roughness={.55}/></mesh><Glass x={o.x} y={o.y+h*.22} z={1.7} w={w*.5} h={h*.3}/><HouseParts items={frame} color="#56615f" name="door-panels"/><HouseParts items={handles} color="#8e958f" name="door-handle"/></>;
 }
 if(o.style==='French'){
  // Two glazed leaves meeting on a centre stile, each with a 2 × 4 muntin grid.
  frame.push({x:o.x,y:o.y,z:1.2,w:3,h,d:1.75});
  for(const side of [-1,1]){const cx=o.x+side*w/4,lw=w/2-1.5;frame.push({x:cx,y:o.y,z:1.1,w:1,h,d:1});for(let r=1;r<4;r++)frame.push({x:cx,y:bottom+h*r/4,z:1.1,w:lw,h:1,d:1});handles.push({x:o.x+side*3.5,y:bottom+36,z:2.2,w:.8,h:8,d:1.6});}
  return <><Glass x={o.x} y={o.y} z={.8} w={w} h={h}/><HouseParts items={frame} color="#f0eee6" name="french-door-stiles-and-muntins"/><HouseParts items={handles} color="#8e958f" name="door-handles"/></>;
 }
 // Sliding patio door: a fixed pane and a sliding sash set further out, each in its own frame.
 for(const [cx,z] of [[o.x-w/4-.5,.8],[o.x+w/4+.5,2.2]] as const){const pw=w/2+1;frame.push({x:cx-pw/2+1,y:o.y,z:z+.3,w:2,h,d:1.2},{x:cx+pw/2-1,y:o.y,z:z+.3,w:2,h,d:1.2},{x:cx,y:bottom+1,z:z+.3,w:pw,h:2,d:1.2},{x:cx,y:bottom+h-1,z:z+.3,w:pw,h:2,d:1.2});}
 handles.push({x:o.x+4,y:bottom+36,z:3,w:.8,h:10,d:1.4});
 return <><Glass x={o.x-w/4-.5} y={o.y} z={.8} w={w/2+1} h={h}/><Glass x={o.x+w/4+.5} y={o.y} z={2.2} w={w/2+1} h={h}/><HouseParts items={frame} color="#3c4442" name="sliding-door-frames"/><HouseParts items={handles} color="#8e958f" name="door-handle"/></>;
}

/** Garage door face by style, in the facade frame (appearance only, never priced). */
function GarageDoor({o}:{o:HouseOpening&{x:number;y:number;w:number;h:number}}){
 const style=o.style??'Panel',w=Math.max(1,o.w-3),h=Math.max(1,o.h-3),bottom=o.y-h/2,parts:Box[]=[],glass:Box[]=[];
 const sections=Math.max(3,Math.round(h/21)),rows=[...Array(sections-1).keys()].map(i=>bottom+h*(i+1)/sections);
 if(style==='Panel'){for(const y of rows)parts.push({x:o.x,y,z:1.25,w,h:.8,d:.5});const cols=Math.max(2,Math.round(w/24));for(let r=0;r<sections;r++)for(let c=0;c<cols;c++)parts.push({x:o.x-w/2+w*(c+.5)/cols,y:bottom+h*(r+.5)/sections,z:1.25,w:w/cols-4,h:h/sections-4,d:.4});}
 if(style==='Carriage'){for(let x=-w/2+5;x<w/2;x+=5)parts.push({x:o.x+x,y:o.y,z:1.25,w:.5,h,d:.4});parts.push({x:o.x,y:o.y,z:1.4,w:1.5,h,d:.6});for(let c=0;c<4;c++)glass.push({x:o.x-w/2+w*(c+.5)/4,y:bottom+h*.86,z:1.3,w:w/4-5,h:h*.16,d:.3});}
 if(style==='Glass'){const cols=Math.max(3,Math.round(w/22));for(let r=0;r<sections;r++)for(let c=0;c<cols;c++)glass.push({x:o.x-w/2+w*(c+.5)/cols,y:bottom+h*(r+.5)/sections,z:1.3,w:w/cols-2.5,h:h/sections-2.5,d:.3});}
 return <>
  <mesh position={[o.x,o.y,.8]}><boxGeometry args={[w,h,1.5]}/><meshStandardMaterial color={style==='Glass'?'#50585a':GARAGE_DOOR_COLOR} roughness={style==='Flush'?.45:.7}/></mesh>
  {parts.length>0&&<HouseParts items={parts} color={style==='Carriage'?'#cfccc2':'#d6d3ca'} name="garage-door-panels"/>}
  {glass.length>0&&<HouseParts items={glass} color="#9fb2b5" name="garage-door-glass"/>}
 </>;
}

export default function HouseFacade({span,height,openings,hidden=NONE,config,evening,selectedHouseOpeningId,onSelectHouseOpening,onMoveHouseOpening}:{span:number;height:number;openings:HouseOpening[];hidden?:[number,number][];config:HouseConfig;evening:boolean}&HouseInteraction){
 const facadeRef=useRef<THREE.Group>(null),controls=useThree(s=>s.controls),drag=useRef<{opening:HouseOpening;start:THREE.Vector3;plane:THREE.Plane;inverse:THREE.Matrix4}|null>(null);
 const restoreControls=()=>{drag.current=null;if(controls&&'enabled' in controls)controls.enabled=true;};
 useEffect(()=>restoreControls,[controls]);
 const startDrag=(e:ThreeEvent<PointerEvent>,opening:HouseOpening)=>{if(!onSelectHouseOpening&&!onMoveHouseOpening)return;e.stopPropagation();onSelectHouseOpening?.(opening.id);if(!onMoveHouseOpening||!facadeRef.current)return;facadeRef.current.updateWorldMatrix(true,false);const world=facadeRef.current.matrixWorld,inverse=world.clone().invert(),normal=new THREE.Vector3(0,0,1).transformDirection(world);drag.current={opening:{...opening},start:e.point.clone().applyMatrix4(inverse),plane:new THREE.Plane().setFromNormalAndCoplanarPoint(normal,e.point),inverse};if(controls&&'enabled' in controls)controls.enabled=false;(e.target as unknown as {setPointerCapture:(id:number)=>void}).setPointerCapture(e.pointerId);};
 const moveDrag=(e:ThreeEvent<PointerEvent>)=>{const active=drag.current;if(!active)return;e.stopPropagation();const hit=e.ray.intersectPlane(active.plane,new THREE.Vector3());if(!hit)return;hit.applyMatrix4(active.inverse);onMoveHouseOpening?.(active.opening.id,{offsetPct:active.opening.offsetPct+(hit.x-active.start.x)/span*100,bottomIn:active.opening.bottomIn+hit.y-active.start.y});};
 const endDrag=(e:ThreeEvent<PointerEvent>)=>{if(!drag.current)return;e.stopPropagation();restoreControls();(e.target as unknown as {releasePointerCapture:(id:number)=>void}).releasePointerCapture(e.pointerId);};
 const shapes=useMemo(()=>openings.map(o=>({...o,x:-span/2+span*o.offsetPct/100,y:o.bottomIn+o.heightIn/2,w:o.widthIn,h:o.heightIn})),[span,openings]);
 const wall=useMemo(()=>houseWallParts(span,height,openings,hidden),[span,height,openings,hidden]);
 const brick=config.cladding==='Brick',stone=config.cladding==='Stone',coursed=brick||config.cladding==='Siding';
 const skin=useMemo(()=>{if(!coursed)return claddingSkin(config.cladding,span,height,shapes,hidden);const boxes:Box[]=[],pitch=brick?2.625:7,partH=brick?2.25:6.8;let row=0;for(let bottom=0;bottom<height;bottom+=pitch,row++){
   const h=Math.min(partH,height-bottom),y=bottom+h/2;let segments:[number,number][]=[[-span/2,span/2]];
   for(const [l,r] of hidden)segments=segments.flatMap(([a,b])=>r<=a||l>=b?[[a,b]]:[...(l>a?[[a,l]]:[]),...(r<b?[[r,b]]:[])] as [number,number][]);
   for(const o of shapes)if(bottom+h>o.y-o.h/2&&bottom<o.y+o.h/2)segments=segments.flatMap(([a,b])=>o.x+o.w/2<=a||o.x-o.w/2>=b?[[a,b]]:[...(o.x-o.w/2>a?[[a,o.x-o.w/2]]:[]),...(o.x+o.w/2<b?[[o.x+o.w/2,b]]:[])] as [number,number][]);
   for(const [a,b] of segments){if(!brick){if(b>a)boxes.push({x:(a+b)/2,y,z:.3,w:b-a,h,d:.6});continue;}
     const start=-span/2-(row%2)*4;for(let x=start+Math.floor((a-start)/8)*8;x<b;x+=8){const lo=Math.max(a,x+.1875),hi=Math.min(b,x+7.8125);if(hi>lo)boxes.push({x:(lo+hi)/2,y,z:.38,w:hi-lo,h,d:.76});}
   }
  }return boxes;},[span,height,shapes,brick,coursed,config.cladding,hidden]);
 const trim=useMemo(()=>{const boxes:Box[]=[];for(const o of shapes){for(const side of [-1,1])boxes.push({x:o.x+side*(o.w/2+1.5),y:o.y,z:1.8,w:3,h:o.h+6,d:2.2});for(const side of [-1,1])boxes.push({x:o.x,y:o.y+side*(o.h/2+1.5),z:1.8,w:o.w,h:3,d:2.2});}for(const x of [-span/2+1.5,span/2-1.5])boxes.push({x,y:height/2,z:1.2,w:3,h:height,d:1.8});boxes.push({x:0,y:height-2,z:1.5,w:span,h:4,d:2});return boxes;},[span,height,shapes]);
 return <group ref={facadeRef}>
  <HouseParts name="wall-with-actual-opening-cutouts" items={wall} color={brick?'#b8b2a7':stone?'#8f8a80':config.claddingColor}/>
  <HouseParts items={skin} color={config.claddingColor} name={brick?'individual-brick-courses':coursed?'siding-courses':`${config.cladding.toLowerCase().replace(/[^a-z]+/g,'-')}-cladding`} variation={brick||stone}/>
  <HouseParts items={trim} color={config.trimColor} name="opening-and-corner-trim"/>
  {shapes.map(o=><group key={o.id} name={`${o.facade}-${o.type}-${o.id}`} onPointerDown={e=>startDrag(e,o)} onPointerMove={moveDrag} onPointerUp={endDrag} onLostPointerCapture={restoreControls}>
    {o.id===selectedHouseOpeningId&&<mesh position={[o.x,o.y,3.2]}><boxGeometry args={[o.w+7,o.h+7,.6]}/><meshBasicMaterial color="#df9b30" wireframe depthTest/></mesh>}
    <mesh position={[o.x,o.y,-12]}><boxGeometry args={[o.w,o.h,.5]}/><meshStandardMaterial color={evening?'#9b7b54':'#414947'} emissive={evening?'#efb873':'#000000'} emissiveIntensity={evening?.16:0} roughness={1}/></mesh>
    {o.type==='Garage'?<GarageDoor o={o}/>:o.type==='Door'&&o.style?<StyledDoor o={o}/>:o.type==='Window'&&o.style?<StyledWindow o={o}/>:<mesh position={[o.x,o.y,.8]}><boxGeometry args={[Math.max(1,o.w-3),Math.max(1,o.h-3),.24]}/><meshPhysicalMaterial color="#c1d1d3" roughness={.08} transmission={.25} transparent opacity={.48} thickness={.24} ior={1.5} clearcoat={1} envMapIntensity={1.4} depthTest depthWrite={false}/></mesh>}
    <HouseParts items={[...(o.w>42&&o.type!=='Garage'&&!o.style?[{x:o.x,y:o.y,z:1.2,w:1.5,h:o.h,d:1.8}]:[]),...(o.type==='Window'&&!o.style?[{x:o.x,y:o.y,z:1.2,w:o.w,h:1.2,d:1.8}]:[])]} color="#38413f" name="opening-mullions"/>
    {o.type==='Door'&&<HouseParts items={[...(o.style?[]:[{x:o.x+(o.w>42?3:o.w/2-5),y:o.bottomIn+Math.min(36,o.h/2),z:3,w:.8,h:8,d:1.6}]),{x:o.x,y:o.bottomIn-.7,z:3,w:o.w+7,h:1.4,d:7}]} color="#68716d" name="door-handle-and-threshold"/>}
  </group>)}
 </group>;
}
