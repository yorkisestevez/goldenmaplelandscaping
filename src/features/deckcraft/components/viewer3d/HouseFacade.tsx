import {createContext,useContext,useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {useLoader,useThree,type ThreeEvent} from '@react-three/fiber';
import * as THREE from 'three';
import type {HouseOpening} from '../../types';
import type {Box} from '../../deckTakeoff';
import HouseParts from './HouseParts';
import {houseWallParts} from './houseWallParts';
import type {HouseInteraction} from './houseInteraction';
import {openingColour,openingColors,type OpeningColors} from '../../houseFinishes';
import type {FacadeFinish} from '../../houseWallFinishes';
import {facadeSkins,openingShapes,type OpeningShape} from './houseCladdingSkins';
import {splitAtBand} from './houseWainscot';
import {paneGeometry,createWindowGlass,type WindowRoom} from './windowGlass';
import {reflectionBinding,registerWindowReflection,type WindowReflection} from './windowReflections';
import {backingSurface,claddingSurface} from './houseSurfaceKinds';
import {getShowcaseFlags,getShowcaseServerFlags,subscribeShowcase} from './showcaseMode';
import roomPhoto from './assets/room-atelier.webp';

const NONE:[number,number][]=[];
const WindowContext=createContext<{reflection:WindowReflection;room:WindowRoom}|null>(null);
type Shape=OpeningShape;

/** A 2 in frame just inside an opening's glass, for the original (unstyled) glass doors and windows. */
const openingFrame=(o:Shape):Box[]=>{const w=Math.max(1,o.w-3),h=Math.max(1,o.h-3);return [{x:o.x-w/2+1,y:o.y,z:1.2,w:2,h,d:1.2},{x:o.x+w/2-1,y:o.y,z:1.2,w:2,h,d:1.2},{x:o.x,y:o.y-h/2+1,z:1.2,w,h:2,d:1.2},{x:o.x,y:o.y+h/2-1,z:1.2,w,h:2,d:1.2}];};
/** Showcase stills: a painted metal frame instead of the editor's flat matte casing. */
const frameFinish=(polish:boolean)=>polish?{roughness:.42,metalness:.18}:{roughness:.82,metalness:0};

/** A glass pane (windowGlass.ts): reflective glass with a room behind it, lit in the evening. */
function Glass({x,y,z,w,h,evening,tilt=0}:{x:number;y:number;z:number;w:number;h:number;evening:boolean;tilt?:number}){
 const photo=useLoader(THREE.TextureLoader,roomPhoto);
 useMemo(()=>{photo.colorSpace=THREE.SRGBColorSpace;photo.wrapS=THREE.RepeatWrapping;photo.needsUpdate=true;},[photo]);
 const geometry=useMemo(()=>paneGeometry(w,h),[w,h]);
 const context=useContext(WindowContext);
 const fallback=useMemo(()=>reflectionBinding(),[]);
 const material=useMemo(()=>createWindowGlass(evening,photo,{reflection:context?.reflection??fallback,room:context?.room??{x,y,w,h,door:false},offset:[x-(context?.room.x??x),y-(context?.room.y??y),z]}),[evening,photo,context,fallback,x,y,z,w,h]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 useEffect(()=>()=>material.dispose(),[material]);
 return <mesh userData={{houseWindow:true}} position={[x,y,z]} rotation={[tilt,0,0]} geometry={geometry} material={material}/>;
}

/**
 * Window looks, in the facade frame (appearance only, never priced). The exported faces come from
 * `openingFaces`; this adds sash frames, rails and hardware.
 */
function StyledWindow({o,c,evening,polish=false}:{o:Shape;c:OpeningColors;evening:boolean;polish?:boolean}){
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
  return <><Glass x={o.x} y={o.y} z={1.2+Math.sin(.12)*h/2} w={w} h={h} evening={evening} tilt={-.12}/><HouseParts items={frame} color={c.windowFrame} name="awning-window-sash" {...frameFinish(polish)}/><HouseParts items={hardware} color={c.hardware} name="window-hardware"/></>;
 }else{
  // Picture window: one fixed pane in a heavier frame over a deeper sill.
  panes.push({x:o.x,y:o.y,z:.8,w,h});sash(o.x,o.y,w,h,1.3);frame.push({x:o.x,y:bottom-1,z:2.2,w:w+4,h:1.5,d:3});
 }
 return <>{panes.map((p,i)=><Glass key={i} {...p} evening={evening}/>)}<HouseParts items={frame} color={c.windowFrame} name={`${(o.style??'').toLowerCase()}-window-frames`} {...frameFinish(polish)}/>{hardware.length>0&&<HouseParts items={hardware} color={c.hardware} name="window-hardware"/>}</>;
}

/** Door looks, in the facade frame (appearance only, never priced). The exported faces come from
 * `openingFaces`; this adds the panels, muntins, frames and handles. */
function StyledDoor({o,c,evening,polish=false}:{o:Shape;c:OpeningColors;evening:boolean;polish?:boolean}){
 const w=Math.max(1,o.w-3),h=Math.max(1,o.h-3),bottom=o.y-h/2,frame:Box[]=[],handles:Box[]=[];
 if(o.style==='Single'){
  // A painted slab: two raised panels below a glass lite, handle on the latch side.
  for(const col of [-1,1])frame.push({x:o.x+col*w/4,y:bottom+h*.22,z:1.8,w:w/2-5,h:h*.32,d:.5});
  handles.push({x:o.x+w/2-4,y:bottom+36,z:2.2,w:.8,h:8,d:1.6});
  return <><mesh position={[o.x,o.y,.8]}><boxGeometry args={[w,h,1.75]}/><meshStandardMaterial color={c.slab} roughness={polish?.42:.55} metalness={polish?.12:0}/></mesh><Glass x={o.x} y={o.y+h*.22} z={1.7} w={w*.5} h={h*.3} evening={evening}/><HouseParts items={frame} color={c.doorPanels} name="door-panels" {...frameFinish(polish)}/><HouseParts items={handles} color={c.handle} name="door-handle"/></>;
 }
 if(o.style==='French'){
  // Two glazed leaves meeting on a centre stile, each with a 2 × 4 muntin grid.
  frame.push({x:o.x,y:o.y,z:1.2,w:3,h,d:1.75});
  for(const side of [-1,1]){const cx=o.x+side*w/4,lw=w/2-1.5;frame.push({x:cx,y:o.y,z:1.1,w:1,h,d:1});for(let r=1;r<4;r++)frame.push({x:cx,y:bottom+h*r/4,z:1.1,w:lw,h:1,d:1});handles.push({x:o.x+side*3.5,y:bottom+36,z:2.2,w:.8,h:8,d:1.6});}
  return <><Glass x={o.x} y={o.y} z={.8} w={w} h={h} evening={evening}/><HouseParts items={frame} color={c.frenchFrames} name="french-door-stiles-and-muntins" {...frameFinish(polish)}/><HouseParts items={handles} color={c.handle} name="door-handles"/></>;
 }
 // Sliding patio door: a fixed pane and a sliding sash set further out, each in its own frame.
 for(const [cx,z] of [[o.x-w/4-.5,.8],[o.x+w/4+.5,2.2]] as const){const pw=w/2+1;frame.push({x:cx-pw/2+1,y:o.y,z:z+.3,w:2,h,d:1.2},{x:cx+pw/2-1,y:o.y,z:z+.3,w:2,h,d:1.2},{x:cx,y:bottom+1,z:z+.3,w:pw,h:2,d:1.2},{x:cx,y:bottom+h-1,z:z+.3,w:pw,h:2,d:1.2});}
 handles.push({x:o.x+4,y:bottom+36,z:3,w:.8,h:10,d:1.4});
 return <><Glass x={o.x-w/4-.5} y={o.y} z={.8} w={w/2+1} h={h} evening={evening}/><Glass x={o.x+w/4+.5} y={o.y} z={2.2} w={w/2+1} h={h} evening={evening}/><HouseParts items={frame} color={c.slidingFrames} name="sliding-door-frames" {...frameFinish(polish)}/><HouseParts items={handles} color={c.handle} name="door-handle"/></>;
}

/** Garage door face by style, in the facade frame (appearance only, never priced). */
function GarageDoor({o,c}:{o:Shape;c:OpeningColors}){
 const style=o.style??'Panel',w=Math.max(1,o.w-3),h=Math.max(1,o.h-3),bottom=o.y-h/2,parts:Box[]=[],glass:Box[]=[];
 const sections=Math.max(3,Math.round(h/21)),rows=[...Array(sections-1).keys()].map(i=>bottom+h*(i+1)/sections);
 if(style==='Panel'){for(const y of rows)parts.push({x:o.x,y,z:1.25,w,h:.8,d:.5});const cols=Math.max(2,Math.round(w/24));for(let r=0;r<sections;r++)for(let c=0;c<cols;c++)parts.push({x:o.x-w/2+w*(c+.5)/cols,y:bottom+h*(r+.5)/sections,z:1.25,w:w/cols-4,h:h/sections-4,d:.4});}
 if(style==='Carriage'){for(let x=-w/2+5;x<w/2;x+=5)parts.push({x:o.x+x,y:o.y,z:1.25,w:.5,h,d:.4});parts.push({x:o.x,y:o.y,z:1.4,w:1.5,h,d:.6});for(let c=0;c<4;c++)glass.push({x:o.x-w/2+w*(c+.5)/4,y:bottom+h*.86,z:1.3,w:w/4-5,h:h*.16,d:.3});}
 if(style==='Glass'){const cols=Math.max(3,Math.round(w/22));for(let r=0;r<sections;r++)for(let c=0;c<cols;c++)glass.push({x:o.x-w/2+w*(c+.5)/cols,y:bottom+h*(r+.5)/sections,z:1.3,w:w/cols-2.5,h:h/sections-2.5,d:.3});}
 return <>
  <mesh position={[o.x,o.y,.8]}><boxGeometry args={[w,h,1.5]}/><meshStandardMaterial color={style==='Glass'?c.glassGarage:c.garage} roughness={style==='Flush'?.45:.7}/></mesh>
  {parts.length>0&&<HouseParts items={parts} color={style==='Carriage'?c.carriagePanels:c.garagePanels} name="garage-door-panels"/>}
  {glass.length>0&&<HouseParts items={glass} color={c.garageGlass} name="garage-door-glass"/>}
 </>;
}

const PICKED='#df9b30';
/** The outline round a wall picked in the exterior studio, never in the way of a click. */
function PickedWall({span,height}:{span:number;height:number}){
 const bars:Box[]=[{x:0,y:height-1.5,z:3,w:span,h:3,d:.6},{x:0,y:1.5,z:3,w:span,h:3,d:.6},{x:-span/2+1.5,y:height/2,z:3,w:3,h:height,d:.6},{x:span/2-1.5,y:height/2,z:3,w:3,h:height,d:.6}];
 return <group name="picked-wall-outline">
  {bars.map((b,i)=><mesh key={i} position={[b.x,b.y,b.z]} raycast={()=>null}><boxGeometry args={[b.w,b.h,b.d]}/><meshBasicMaterial color={PICKED}/></mesh>)}
  <mesh position={[0,height/2,2.8]} raycast={()=>null}><planeGeometry args={[span,height]}/><meshBasicMaterial color={PICKED} transparent opacity={.16} depthWrite={false}/></mesh>
 </group>;
}

export default function HouseFacade({span,height,openings,hidden=NONE,finish,evening,wallId,blockId,selectedHouseOpeningId,onSelectHouseOpening,onMoveHouseOpening,selectedHouseWallId,onSelectHouseWall}:{span:number;height:number;openings:HouseOpening[];hidden?:[number,number][];/** The wall's finish, resolved by House3D (houseWallFinishes.ts `facadeFinish`); appearance only. */
 finish:FacadeFinish;evening:boolean;
 /** This wall ('main-front', 'garage1-back') and its block, for picking it in the exterior studio. */
 wallId:string;blockId:string}&HouseInteraction){
 const facadeRef=useRef<THREE.Group>(null),controls=useThree(s=>s.controls),invalidate=useThree(s=>s.invalidate),drag=useRef<{opening:HouseOpening;start:THREE.Vector3;plane:THREE.Plane;inverse:THREE.Matrix4}|null>(null);
 const restoreControls=()=>{drag.current=null;if(controls&&'enabled' in controls)controls.enabled=true;};
 useEffect(()=>restoreControls,[controls]);
 const startDrag=(e:ThreeEvent<PointerEvent>,opening:HouseOpening)=>{if(!onSelectHouseOpening&&!onMoveHouseOpening)return;e.stopPropagation();onSelectHouseOpening?.(opening.id);if(!onMoveHouseOpening||!facadeRef.current)return;facadeRef.current.updateWorldMatrix(true,false);const world=facadeRef.current.matrixWorld,inverse=world.clone().invert(),normal=new THREE.Vector3(0,0,1).transformDirection(world);drag.current={opening:{...opening},start:e.point.clone().applyMatrix4(inverse),plane:new THREE.Plane().setFromNormalAndCoplanarPoint(normal,e.point),inverse};if(controls&&'enabled' in controls)controls.enabled=false;(e.target as unknown as {setPointerCapture:(id:number)=>void}).setPointerCapture(e.pointerId);};
 const moveDrag=(e:ThreeEvent<PointerEvent>)=>{const active=drag.current;if(!active)return;e.stopPropagation();const hit=e.ray.intersectPlane(active.plane,new THREE.Vector3());if(!hit)return;hit.applyMatrix4(active.inverse);onMoveHouseOpening?.(active.opening.id,{offsetPct:active.opening.offsetPct+(hit.x-active.start.x)/span*100,bottomIn:active.opening.bottomIn+hit.y-active.start.y});};
 const endDrag=(e:ThreeEvent<PointerEvent>)=>{if(!drag.current)return;e.stopPropagation();restoreControls();(e.target as unknown as {releasePointerCapture:(id:number)=>void}).releasePointerCapture(e.pointerId);};
 const shapes=useMemo(()=>openingShapes(span,openings),[span,openings]);
 const scene=useThree(s=>s.scene),reflection=useMemo(()=>reflectionBinding(),[]);
 const hasGlass=shapes.some(o=>o.type!=='Garage');
 useEffect(()=>{if(!facadeRef.current||!hasGlass)return;const remove=registerWindowReflection(scene,facadeRef.current,reflection);invalidate();return remove;},[scene,reflection,hasGlass,invalidate]);
 const rooms=useMemo(()=>{
   const anchor=shapes.filter(o=>o.type==='Door'&&o.style!=='Single').sort((a,b)=>b.w-a.w)[0];
   const shared=anchor?{x:anchor.x,y:anchor.y,w:span,h:anchor.h,door:true}:null;
   return new Map(shapes.map(o=>[o.id,{reflection,room:shared&&o.bottomIn>=anchor!.bottomIn&&o.y<anchor!.bottomIn+108?shared:{x:o.x,y:o.y,w:o.w,h:o.h,door:o.type==='Door'}}]));
 },[shapes,reflection,span]);
 const wall=useMemo(()=>houseWallParts(span,height,openings,hidden),[span,height,openings,hidden]);
 // The cladding over the wall (houseCladdingSkins.ts); a very large wall in a newer cladding is drawn plain. A wainscot
 // splits the wall at its top: the band in its own cladding under a trim cap, the wall's cladding above.
 const {wall:look,wainscot,trim:trimColor,openings:colours}=finish;
 const skins=useMemo(()=>facadeSkins(look.cladding,span,height,shapes,hidden,wainscot),[look.cladding,span,height,shapes,hidden,wainscot?.cladding,wainscot?.heightIn]);
 const band=skins.band,split=useMemo(()=>band?splitAtBand(wall,band.top):null,[wall,band]);
 // Exterior studio: a click on the wall (not an orbit drag) picks it; its outline shows while it is picked.
 const pick=onSelectHouseWall&&((e:ThreeEvent<MouseEvent>)=>{if(e.delta>4)return;e.stopPropagation();onSelectHouseWall(wallId);invalidate();});
 const picked=!!selectedHouseWallId&&(selectedHouseWallId===wallId||selectedHouseWallId===blockId);
 const trim=useMemo(()=>{const boxes:Box[]=[];for(const o of shapes){for(const side of [-1,1])boxes.push({x:o.x+side*(o.w/2+1.5),y:o.y,z:1.8,w:3,h:o.h+6,d:2.2});for(const side of [-1,1])boxes.push({x:o.x,y:o.y+side*(o.h/2+1.5),z:1.8,w:o.w,h:3,d:2.2});}for(const x of [-span/2+1.5,span/2-1.5])boxes.push({x,y:height/2,z:1.2,w:3,h:height,d:1.8});boxes.push({x:0,y:height-2,z:1.5,w:span,h:4,d:2});return boxes;},[span,height,shapes]);
 const flags=useSyncExternalStore(subscribeShowcase,getShowcaseFlags,getShowcaseServerFlags),polish=flags.quality&&flags.post;
 return <group ref={facadeRef} userData={{pickPartId:`wall:${wallId}`}} onClick={pick}>
  <HouseParts name="wall-with-actual-opening-cutouts" items={split?split.upper:wall} color={look.backing} surface={backingSurface(look.cladding)}/>
  <HouseParts items={skins.skin.pieces} color={look.color} name={look.partName} variation={look.variation} roughness={look.roughness} metalness={look.metalness} surface={claddingSurface(look.cladding)}/>
  {band&&split&&wainscot&&<>
   <HouseParts name="wainscot-wall" items={split.lower} color={wainscot.backing} surface={backingSurface(wainscot.cladding)}/>
   <HouseParts items={band.skin.pieces} color={wainscot.color} name={`wainscot-${wainscot.partName}`} variation={wainscot.variation} roughness={wainscot.roughness} metalness={wainscot.metalness} surface={claddingSurface(wainscot.cladding)}/>
   <HouseParts items={band.cap} color={trimColor} name="wainscot-cap"/>
  </>}
  <HouseParts items={trim} color={trimColor} name="opening-and-corner-trim" roughness={polish?.5:.82} metalness={polish?.12:0}/>
  {picked&&<PickedWall span={span} height={height}/>}
  {shapes.map(o=>{const c=openingColors(colours,o);return <group key={o.id} userData={{pickPartId:`opening:${o.id}`}} name={`${o.facade}-${o.type}-${o.id}`} onPointerDown={e=>startDrag(e,o)} onPointerMove={moveDrag} onPointerUp={endDrag} onLostPointerCapture={restoreControls}>
    {o.id===selectedHouseOpeningId&&<mesh position={[o.x,o.y,3.2]}><boxGeometry args={[o.w+7,o.h+7,.6]}/><meshBasicMaterial color="#df9b30" wireframe depthTest/></mesh>}
    <mesh position={[o.x,o.y,-12]}><boxGeometry args={[o.w,o.h,.5]}/><meshStandardMaterial color={evening?'#9b7b54':'#414947'} emissive={evening?'#efb873':'#000000'} emissiveIntensity={evening?.16:0} roughness={1}/></mesh>
    <WindowContext.Provider value={rooms.get(o.id)!}>
    {o.type==='Garage'?<GarageDoor o={o} c={c}/>:o.type==='Door'&&o.style?<StyledDoor o={o} c={c} evening={evening} polish={polish}/>:o.type==='Window'&&o.style?<StyledWindow o={o} c={c} evening={evening} polish={polish}/>:<Glass x={o.x} y={o.y} z={.8} w={o.w-3} h={o.h-3} evening={evening}/>}
    </WindowContext.Provider>
    {/* The original glass door or window gets a frame only once a colour is chosen for it (it has none otherwise). */}
    {o.type!=='Garage'&&!o.style&&openingColour(colours,o)&&<HouseParts items={openingFrame(o)} color={o.type==='Door'?c.slab:c.windowFrame} name="opening-frame" {...frameFinish(polish)}/>}
    {o.type==='Window'&&polish&&<HouseParts items={[{x:o.x,y:o.y-o.h/2-1.1,z:2.5,w:o.w+8,h:1.7,d:3.4},{x:o.x,y:o.y+o.h/2+1.5,z:2.3,w:o.w+5,h:.8,d:2.2}]} color={c.windowFrame} name="window-sill-and-head-flashing" {...frameFinish(true)}/>}
    <HouseParts items={[...(o.w>42&&o.type!=='Garage'&&!o.style?[{x:o.x,y:o.y,z:1.2,w:1.5,h:o.h,d:1.8}]:[]),...(o.type==='Window'&&!o.style?[{x:o.x,y:o.y,z:1.2,w:o.w,h:1.2,d:1.8}]:[])]} color={c.mullions} name="opening-mullions"/>
    {o.type==='Door'&&<HouseParts items={[...(o.style?[]:[{x:o.x+(o.w>42?3:o.w/2-5),y:o.bottomIn+Math.min(36,o.h/2),z:3,w:.8,h:8,d:1.6}]),{x:o.x,y:o.bottomIn-.7,z:3,w:o.w+7,h:1.4,d:7}]} color={c.hardware} name="door-handle-and-threshold"/>}
  </group>;})}
 </group>;
}
