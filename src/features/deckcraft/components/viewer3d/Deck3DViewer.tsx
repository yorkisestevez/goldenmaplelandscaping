import {pergolaLayout} from '../../pergolaLayout';
import Pergola3D,{type PergolaInteraction} from './Pergola3D';
import PergolaTools from './PergolaTools';
import type {Update} from '../../designer/fields';
import type {PergolaSelection} from '../../pergolaCatalog';
import NotchedStringers from './NotchedStringers';
import {Suspense,useCallback,useEffect,useMemo,useLayoutEffect,useRef,useState} from 'react';
import {Canvas,useThree,type ThreeEvent} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {type DeckData} from '../../types';
import {DECKING_CATALOGUE} from '../../manufacturerCatalog';
import {type DeckTakeoff,type Member,type Box} from '../../deckTakeoff';
import {swatchUrl} from '../../lib/swatches';
import {useSwatchTexture} from './useSwatchTexture';
import {boardVariation,boxVariant} from './surfaceShaders';
import {Environment3D} from './Environment3D';
import HardwareDetails from './HardwareDetails';
import FootingDetails from './FootingDetails';
import {getMaterialFallbackColor} from '../../lib/deckGeometry';
import {extrasLayout} from '../../extrasLayout';
import LightingFixtures,{MAX_PREVIEW_LIGHTS,isIlluminatingFixture} from './LightingFixtures';
import {sceneBounds} from './sceneBounds';
import {getStairBoards} from '../../stairBoards';
import {houseLayout} from './houseLayout';
import {getHouseBlocks} from '../../houseFootprint';
import RailingDetails from './RailingDetails';
import FramelessGlass3D from './FramelessGlass3D';
import {catalogueAccessoryLayout} from '../../catalogueAccessories';
import {activeLightingItems} from '../../lightingSystem';
import type {HouseInteraction} from './houseInteraction';
import {buildYardModel,type YardModel} from '../../yardModel';
import Yard3D from './Yard3D';
import {stairVeneerLayout} from '../../stairVeneerLayout';
import {hasSimplifiedPaving} from './yardPreview';
import PrivacyScreens3D from './PrivacyScreens3D';
import Skirting3D from './Skirting3D';
import {boardFinishPlan,darkSlateBorder,parseColourRef} from '../../boardFinishes';
import {partRef,railingFinish} from '../../deckPartFinishes';
import {railingScreenHex} from '../../railingScreenColours';
import type {BoardAddress} from '../../lib/boardAddress';
import RenderPipeline,{pipelineFor} from './renderPipeline';
import {SCENE_LOOK} from './sceneLook';
import Sky3D,{StudioLight} from './Sky3D';

/** Powder-coated aluminium (railings, frames, flashing): paint at metalness 0 with a clear coat, so dark finishes
 * catch the sky instead of reading as flat silhouettes. */
const powderCoat=(color:string)=>new THREE.MeshPhysicalMaterial({color,...SCENE_LOOK.powderCoat});

/** Unit boxes (Members, Boxes) take a swatch material's box-projected grain (surfaceShaders.ts): along each piece, never stretched. */
function useBoxMaterial(material:THREE.Material){return useMemo(()=>boxVariant(material),[material]);}
function Members({items,material:given,name}:{items:Member[];material:THREE.Material;name:string}){
  const ref=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate),material=useBoxMaterial(given);
  useLayoutEffect(()=>{
    if(!ref.current)return;const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
    items.forEach((m,i)=>{const a=new THREE.Vector3(m.a.x,m.a.y,m.a.z),b=new THREE.Vector3(m.b.x,m.b.y,m.b.z),dir=b.clone().sub(a);const axis=dir.clone().normalize(),normal=new THREE.Vector3(0,1,0);if(Math.abs(axis.y)>0.99)normal.set(1,0,0);const side=new THREE.Vector3().crossVectors(axis,normal).normalize(),vertical=new THREE.Vector3().crossVectors(side,axis).normalize();q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(axis,vertical,side));matrix.compose(a.add(b).multiplyScalar(0.5),q,new THREE.Vector3(Math.max(0.01,dir.length()),m.depth,m.width));ref.current!.setMatrixAt(i,matrix);});
    ref.current.count=items.length;ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere();invalidate();
  },[items,invalidate]);
  return <instancedMesh name={name} castShadow receiveShadow key={items.length} ref={ref} args={[undefined,undefined,Math.max(1,items.length)]} material={material}><boxGeometry args={[1,1,1]}/></instancedMesh>;
}
function Boxes({items,material:given,name}:{items:Box[];material:THREE.Material;name:string}){
  const ref=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate),material=useBoxMaterial(given);
  useLayoutEffect(()=>{if(!ref.current)return;const matrix=new THREE.Matrix4(),q=new THREE.Quaternion();items.forEach((b,i)=>{q.setFromAxisAngle(new THREE.Vector3(0,1,0),b.angle||0);matrix.compose(new THREE.Vector3(b.x,b.y,b.z),q,new THREE.Vector3(b.w,b.h,b.d));ref.current!.setMatrixAt(i,matrix);});ref.current.count=items.length;ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere();invalidate();},[items,invalidate]);
  return <instancedMesh name={name} castShadow receiveShadow ref={ref} key={items.length} args={[undefined,undefined,Math.max(1,items.length)]} material={material}><boxGeometry args={[1,1,1]}/></instancedMesh>;
}
type FinishBox=Box&{polygon?:{x:number;y:number}[];role?:string;
  /** Where the piece is in the model (level, board) and its accent colour, for the accent-board tool. */
  ref?:{level:number;index:number};accent?:string|null};
/** Accent-board tool: a click (not an orbit drag) paints the piece; hovering outlines what a click would paint. */
interface BoardPick{onPick:(box:FinishBox)=>void;onHover:(box:FinishBox|null)=>void}
function pickHandlers(pick:BoardPick|undefined,itemAt:(e:ThreeEvent<MouseEvent>|ThreeEvent<PointerEvent>)=>FinishBox|undefined){
  if(!pick)return {};
  return {
    onClick:(e:ThreeEvent<MouseEvent>)=>{if(e.delta>4)return;const item=itemAt(e);if(!item)return;e.stopPropagation();pick.onPick(item);},
    onPointerMove:(e:ThreeEvent<PointerEvent>)=>{const item=itemAt(e);if(!item)return;e.stopPropagation();pick.onHover(item);},
    onPointerOut:()=>pick.onHover(null),
  };
}
/** A piece's plan corners (inches, level offset applied). */
function boxCorners(b:FinishBox){
  if(b.polygon)return b.polygon;
  const a=-(b.angle||0),u={x:Math.cos(a),y:Math.sin(a)},n={x:-u.y,y:u.x};
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,t])=>({x:b.x+u.x*b.w/2*s+n.x*b.d/2*t,y:b.z+u.y*b.w/2*s+n.y*b.d/2*t}));
}
function BoardBatch({items,material,pick}:{items:FinishBox[];material:THREE.Material;pick?:BoardPick}){
  const ref=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate);
  const first=items[0];
  const geometry=useMemo(()=>{
    // An eased 1/8 in edge, as milled boards have: it catches the light, so boards read one by one at a distance.
    const g=new RoundedBoxGeometry(first.w,first.h,first.d,1,.125),pos=g.getAttribute('position'),uv=g.getAttribute('uv');
    // Consistent grain scale in inches, along the board rather than stretching a photo per piece.
    for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+first.w/2)/48,first.h>first.d?(pos.getY(i)+first.h/2)/first.h:(pos.getZ(i)+first.d/2)/first.d);
    return g;
  },[first.w,first.h,first.d]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useLayoutEffect(()=>{if(!ref.current)return;const m=new THREE.Matrix4(),q=new THREE.Quaternion(),variation=new Float32Array(items.length*4);items.forEach((b,i)=>{q.setFromAxisAngle(new THREE.Vector3(0,1,0),b.angle||0);m.compose(new THREE.Vector3(b.x,b.y,b.z),q,new THREE.Vector3(1,1,1));ref.current!.setMatrixAt(i,m);variation.set(boardVariation(b.x,b.z),i*4);
    // Each board a touch lighter or darker, centred on the product's own colour.
    const shade=.97+.06*((Math.sin(b.x*12.3+b.z*7.9)*437.1)%1+1)/2;ref.current!.setColorAt(i,new THREE.Color(shade,shade,shade));});
    // Which strip of the swatch atlas, how far along and which way round (surfaceShaders.ts).
    geometry.setAttribute('aVar',new THREE.InstancedBufferAttribute(variation,4));
    ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();invalidate();},[items,geometry,invalidate]);
  return <instancedMesh ref={ref} args={[geometry,material,items.length]} castShadow receiveShadow {...pickHandlers(pick,e=>items[e.instanceId??-1])}/>;
}
function PolygonBoard({item,material,pick}:{item:FinishBox;material:THREE.Material;pick?:BoardPick}){
  const geometry=useMemo(()=>{const shape=new THREE.Shape();item.polygon!.forEach((p,i)=>i?shape.lineTo(p.x,p.y):shape.moveTo(p.x,p.y));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:item.h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,item.y+item.h/2,0);const pos=g.getAttribute('position'),uv=g.getAttribute('uv'),a=item.angle||0,cu=item.x*Math.cos(a)-item.z*Math.sin(a),cv=item.x*Math.sin(a)+item.z*Math.cos(a);for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)*Math.cos(a)-pos.getZ(i)*Math.sin(a)-cu+item.w/2)/48,(pos.getX(i)*Math.sin(a)+pos.getZ(i)*Math.cos(a)-cv+item.d/2)/item.d);const variation=boardVariation(item.x,item.z);g.setAttribute('aVar',new THREE.Float32BufferAttribute(Array.from({length:uv.count},()=>variation).flat(),4));return g;},[item]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} material={material} castShadow receiveShadow {...pickHandlers(pick,()=>item)}/>;
}
function FinishedBoards({items,material,pick}:{items:FinishBox[];material:THREE.Material;pick?:BoardPick}){
  const layout=useMemo(()=>{const groups=new Map<string,FinishBox[]>(),polygons:FinishBox[]=[];for(const b of items){const area=b.polygon?Math.abs(b.polygon.reduce((s,p,i)=>{const q=b.polygon![(i+1)%b.polygon!.length];return s+p.x*q.y-q.x*p.y;},0))/2:0;if(b.polygon&&(b.polygon.length!==4||Math.abs(area-b.w*b.d)>.01)){polygons.push(b);continue;}const key=[b.w,b.h,b.d].map(n=>n.toFixed(4)).join(':');const group=groups.get(key);if(group)group.push(b);else groups.set(key,[b]);}return {groups:[...groups.entries()],polygons};},[items]);
  return <group name="installed-deck-board-pieces">{layout.groups.map(([key,items])=><BoardBatch key={key} items={items} material={material} pick={pick}/>)}{layout.polygons.map((item,i)=><PolygonBoard key={i} item={item} material={material} pick={pick}/>)}</group>;
}
/** Boards in one accent colour, with that product's own swatch. */
function AccentBoards({colour,items,pick}:{colour:string;items:FinishBox[];pick?:BoardPick}){
  const parsed=parseColourRef(colour),material=useSwatchTexture(parsed?swatchUrl(parsed.color.swatch):'',getMaterialFallbackColor(parsed?.material.id??''));
  return <FinishedBoards items={items} material={material} pick={pick}/>;
}
/** A deck part's own finish (deckPartFinishes.ts) as a swatch material; with none set, the part uses the deck's boards. */
function usePartMaterial(ref:string|undefined,board:THREE.Material):THREE.Material{
  const parsed=ref?parseColourRef(ref):null,material=useSwatchTexture(parsed?swatchUrl(parsed.color.swatch):'',getMaterialFallbackColor(parsed?.material.id??''));
  return parsed?material:board;
}
/** Outlines the board (or the row) under the pointer while the accent-board tool is on. It keeps its own state,
 * so hovering never re-renders the rest of the scene. */
function HoverOutline({boards,addresses,scope,register}:{boards:FinishBox[];addresses?:(BoardAddress|null)[][];scope:'piece'|'course';register:(set:(box:FinishBox|null)=>void)=>void}){
  const [hover,setHover]=useState<FinishBox|null>(null),invalidate=useThree(s=>s.invalidate),gl=useThree(s=>s.gl);
  useEffect(()=>{register(box=>setHover(prev=>prev?.ref?.level===box?.ref?.level&&prev?.ref?.index===box?.ref?.index?prev:box));},[register]);
  useEffect(()=>{gl.domElement.style.cursor=hover?'crosshair':'';invalidate();},[hover,gl,invalidate]);
  useEffect(()=>()=>{gl.domElement.style.cursor='';},[gl]);
  const geometry=useMemo(()=>{
    const at=(b:FinishBox)=>b.ref?addresses?.[b.ref.level]?.[b.ref.index]:undefined,a=hover&&at(hover);
    if(!hover||!a)return null;
    const lit=scope==='course'&&a.rowPaint?boards.filter(b=>{const o=at(b);return !!o&&o.lv===a.lv&&o.role===a.role&&o.course===a.course;}):[hover];
    const points:number[]=[];
    for(const b of lit){const c=boxCorners(b),y=b.y+b.h/2+.3;c.forEach((p,i)=>{const q=c[(i+1)%c.length];points.push(p.x,y,p.y,q.x,y,q.y);});}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));return g;
  },[hover,addresses,boards,scope]);
  useEffect(()=>()=>geometry?.dispose(),[geometry]);
  return geometry?<lineSegments geometry={geometry} renderOrder={10}><lineBasicMaterial color="#e39a24" depthTest={false} depthWrite={false} transparent/></lineSegments>:null;
}
/** The accent-board tool as the viewer takes it: the row or single-board choice and what a click paints. */
export interface BoardPaint{scope:'piece'|'course';onPaint:(target:{level:number;index:number})=>void}
function CameraView({view,w,d,cx,cz,height,depth}:{view:string;w:number;d:number;cx:number;cz:number;height:number;depth:number}){
 const {camera,controls,invalidate}=useThree();
 useEffect(()=>{const r=Math.max(w,d),target=new THREE.Vector3(cx,view==='foundation'?-depth/24:height*.5,cz);camera.position.set(cx+r*.9,height+r*.7,cz+r*1.3);if(view==='front')camera.position.set(cx,height*.6,cz+r*1.8);if(view==='top')camera.position.set(cx,r*2+.1,cz+.01);if(view==='hardware')camera.position.set(cx+r*.6,height*.25,cz+r*1.2);if(view==='foundation')camera.position.set(cx+r*.9,height+r*.65,cz+r*1.4);camera.lookAt(target);if(controls&&'target' in controls){(controls as any).target.copy(target);(controls as any).update();}invalidate();},[view,w,d,cx,cz,height,depth,camera,controls,invalidate]);return null;
}
function Scene({data,model,structure,cutaway,inspection,yard,onMovePrivacyScreen,boardPaint,pergolaInteraction,...interaction}:{data:DeckData;model:DeckTakeoff;structure:boolean;cutaway:boolean;inspection:boolean;yard:YardModel;pergolaInteraction?:PergolaInteraction;onMovePrivacyScreen?:(id:string,offsetPct:number)=>void;boardPaint?:BoardPaint}&HouseInteraction){
  const material=DECKING_CATALOGUE.find(m=>m.id===data.deckingMaterial)||DECKING_CATALOGUE[0];
  const swatch=material.colors.find(c=>c.name===data.deckingColor)||material.colors[0];
  const board=useSwatchTexture(swatchUrl(swatch.swatch),getMaterialFallbackColor(material.id));
  const darkBorder=darkSlateBorder(data);
  const borderMaterial=useSwatchTexture(darkBorder?swatchUrl('dk-border-dark-slate.jpg'):'','#343635');
  const extras=useMemo(()=>extrasLayout(data,model),[data,model]);
  const catalogueExtras=useMemo(()=>catalogueAccessoryLayout(data,model),[data,model]);
  const stairBoards=useMemo(()=>getStairBoards(data,model),[data,model]);
  const stairVeneer=useMemo(()=>stairVeneerLayout(data,model),[data,model]);
  // Framing lumber (posts, joists, beams, stringers): the pressure-treated swatch, box-projected along each piece.
  const framing=useSwatchTexture(swatchUrl('wood-pressure-treated.jpg'),'#8a7356');
  const shared=useMemo(()=>({inlay:new THREE.MeshStandardMaterial({color:'#514236',roughness:.7}),inlayFraming:new THREE.MeshStandardMaterial({color:'#c08a3e',roughness:.8}),metal:powderCoat(SCENE_LOOK.powderCoatColor),concrete:new THREE.MeshStandardMaterial({color:'#a5a49a',roughness:0.9}),glass:new THREE.MeshPhysicalMaterial({color:'#cbdfe3',roughness:0.08,metalness:0.1,transparent:true,opacity:0.23,depthWrite:false})}),[]);
  useEffect(()=>()=>Object.values(shared).forEach(m=>m.dispose()),[shared]);
  const materials=useMemo(()=>({...shared,wood:framing}),[shared,framing]);
  // Accent boards (boardFinishes.ts): worked out only when the design has some, or while the tool is on.
  const painting=!!boardPaint&&!structure;
  const finish=useMemo(()=>data.boardColours?.length||data.inlays?.length||data.deckFinishes?.border||painting?boardFinishPlan(data,model):null,[model,data.boardColours,data.inlays,data.deckingMaterial,data.deckingColor,data.pattern,data.boardWidth,data.borderFinish,data.deckFinishes?.border,painting]);
  // Deck parts in their own colour (the border is drawn with the accent groups above); the railing in its colour's
  // screen approximation, illustrative only.
  const fasciaMat=usePartMaterial(partRef(data,'fascia'),board),treadMat=usePartMaterial(partRef(data,'treads'),board),riserMat=usePartMaterial(partRef(data,'risers'),board);
  const rail=railingFinish(data),railHex=rail?railingScreenHex(rail.system.id,rail.colour):undefined;
  const railColour=useMemo(()=>railHex?powderCoat(railHex):null,[railHex]);
  useEffect(()=>()=>railColour?.dispose(),[railColour]);
  const boards:FinishBox[]=useMemo(()=>model.levels.flatMap((l,li)=>l.boards.map((b,bi)=>{const cut=b as typeof b&{width?:number;polygon?:{x:number;y:number}[];role?:string};return {x:b.cx+l.offset.x,y:l.top-0.5,z:b.cy+l.offset.z,w:b.length,h:1,d:cut.width??data.boardWidth,angle:-b.angleDeg*Math.PI/180,role:cut.role,polygon:cut.polygon?.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z})),ref:{level:li,index:bi},accent:finish?.colours[li]?.[bi]??null};})),[model,data.boardWidth,finish]);
  const hoverSet=useRef<(box:FinishBox|null)=>void>(()=>{}),registerHover=useCallback((set:(box:FinishBox|null)=>void)=>{hoverSet.current=set;},[]);
  const pick=useMemo<BoardPick|undefined>(()=>{
    if(!painting)return undefined;
    const paintable=(b:FinishBox)=>!!b.ref&&!!finish?.addresses[b.ref.level]?.[b.ref.index];
    return {onPick:b=>{if(paintable(b))boardPaint!.onPaint(b.ref!);},onHover:b=>hoverSet.current(b&&paintable(b)?b:null)};
  },[painting,boardPaint,finish]);
  const postBase=data.foundation==='Deck Blocks'?6.5:4.5;
  const supportPosts:Box[]=model.levels.flatMap(l=>l.supports.filter(p=>p.y>postBase).map(p=>({x:p.x,y:(p.y+postBase)/2,z:p.z,w:5.5,h:p.y-postBase,d:5.5})));
  const railPosts:Box[]=model.railing.posts.map(p=>({x:p.x,y:p.y+model.railing.height/2,z:p.z,w:3.5,h:model.railing.height,d:3.5}));
  const edgeMembers:Member[]=model.levels.flatMap(l=>l.rim??[]);
  const railMat=railColour??(data.railingType==='Wood Picket'?board:materials.metal);
  return <group scale={1/12}>
    {!structure&&<><FinishedBoards items={boards.filter(b=>b.role!=='inlay'&&!b.accent&&(!darkBorder||b.role!=='border'))} material={board} pick={pick}/><FinishedBoards items={boards.filter(b=>b.role==='inlay')} material={materials.inlay}/>{darkBorder&&<FinishedBoards items={boards.filter(b=>b.role==='border')} material={borderMaterial}/>}{finish?.groups.map(g=><AccentBoards key={g.ref} colour={g.ref} items={boards.filter(b=>b.accent===g.ref)} pick={pick}/>)}{painting&&<HoverOutline boards={boards} addresses={finish?.addresses} scope={boardPaint!.scope} register={registerHover}/>}</>}
    <Members items={model.levels.flatMap(l=>l.joists)} material={materials.wood} name="joists"/>
    <Members items={model.levels.flatMap(l=>l.blocking.filter(b=>!b.role?.startsWith('inlay-')))} material={materials.wood} name="blocking"/>
    {/* Framing under decorative inlays (inlayFraming.ts), in its own colour so it reads in the Framing view. */}
    <Members items={model.levels.flatMap(l=>l.blocking.filter(b=>b.role?.startsWith('inlay-')))} material={materials.inlayFraming} name="inlay-blocking"/>
    <Members items={model.levels.flatMap(l=>l.beams)} material={materials.wood} name="beams"/>
    <Members items={edgeMembers} material={structure?materials.wood:fasciaMat} name="rim-and-fascia"/>
    {!structure&&<Members items={catalogueExtras.fascia} material={fasciaMat} name="selected-manufacturer-fascia"/>}
    {inspection&&<><Boxes items={catalogueExtras.tape} material={materials.metal} name="selected-joist-tape"/><Boxes items={catalogueExtras.flashing} material={materials.metal} name="selected-ledger-flashing"/></>}
    <Boxes items={supportPosts} material={materials.wood} name="support-posts"/>
    {/* Skirting (skirting.ts): its face in the finished views; the framing and below-ground views show its backing. */}
    {data.skirting&&<Skirting3D data={data} model={model} finished={!structure&&!cutaway} wood={materials.wood}/>}
    <HardwareDetails data={data} model={model} inspection={inspection}/><FootingDetails data={data} model={model} cutaway={cutaway}/>
    <FinishedBoards items={stairBoards} material={treadMat}/>
    {!structure&&<group name="closed-stair-riser-boards"><FinishedBoards items={model.riserBoards} material={riserMat}/></group>}
    <NotchedStringers model={model} material={materials.wood}/>
    <Boxes items={stairVeneer.woodBoxes} material={materials.wood} name="terrain-stair-veneer-support-blocks"/>
    {inspection&&<Boxes items={stairVeneer.bracketBoxes} material={materials.metal} name="terrain-stair-veneer-support-angles"/>}
    <Boxes items={railPosts} material={railMat} name="railing-posts"/>
    <Members items={model.railing.rails} material={railMat} name="railing-runs"/>
    {data.railingType!=='Cable'&&<Members items={model.railing.balusters} material={railMat} name="railing-infill"/>}
    <RailingDetails data={data} model={model}/>
    {model.railing.frameless&&<FramelessGlass3D layout={model.railing.frameless}/>}
    <Boxes items={extras.wood} material={board} name="benches-privacy-pergola"/>
    <Pergola3D data={data} layout={extras.pergola??null} interaction={pergolaInteraction}/><Boxes items={extras.metal} material={materials.metal} name="accessory-frames"/>
    <Boxes items={extras.drainage} material={materials.metal} name="under-deck-drainage"/>
    <PrivacyScreens3D panels={extras.panels} handles={extras.screenHandles} onMove={onMovePrivacyScreen}/>
    <LightingFixtures items={extras.fixtures} evening={data.sceneLighting==='Evening'} enabled={data.lightingPreviewOn!==false}/>
    <Yard3D model={yard} inspection={inspection||cutaway}/>
    <Environment3D data={data} footprint={model.levels[0].footprint} topY={data.height} planKey={JSON.stringify(model.quantities)} cutaway={cutaway} yard={yard} {...interaction}/>
  </group>;
}
/** Hands the page a function that renders the current view and returns it as an image (for the
 * printable proposal). Rendering right before reading keeps the drawing buffer valid without
 * preserveDrawingBuffer on every frame. The outline of a wall picked in the exterior studio is left out.
 * Asked for a longer edge than the canvas has (the proposal's print pictures, R8), it draws that one picture at a
 * higher pixel ratio (at most 3 times), then puts the ratio back and redraws the view on screen. */
function SnapshotBridge({onReady}:{onReady?:(capture:((longEdgePx?:number)=>string|null)|null)=>void}){
  const gl=useThree(s=>s.gl),scene=useThree(s=>s.scene),camera=useThree(s=>s.camera),invalidate=useThree(s=>s.invalidate);
  useEffect(()=>{
    if(!onReady)return;
    onReady((longEdgePx?:number)=>{
      const picked:THREE.Object3D[]=[];scene.traverse(o=>{if((o.name==='picked-wall-outline'||o.name==='picked-pergola-outline')&&o.visible){o.visible=false;picked.push(o);}});
      const ratio=gl.getPixelRatio(),edge=Math.max(gl.domElement.width,gl.domElement.height),scale=longEdgePx&&edge&&longEdgePx>edge?Math.min(3,longEdgePx/edge):1;
      try{if(scale>1)gl.setPixelRatio(ratio*scale);const pipeline=pipelineFor(gl);if(pipeline)pipeline.capture(scale);else gl.render(scene,camera);return gl.domElement.toDataURL('image/jpeg',.9);}catch{return null;}
      finally{for(const o of picked)o.visible=true;if(scale>1){gl.setPixelRatio(ratio);invalidate();}}
    });
    return ()=>onReady(null);
  },[gl,scene,camera,invalidate,onReady]);
  return null;
}
export default function Deck3DViewer({data:rawData,model,yardModel:calculatedYard,deckOnly=false,structure=false,cutaway=false,view="3d",onContextLost,onMovePrivacyScreen,onSnapshotReady,boardPaint,onUpdate,...interaction}:{onUpdate?:Update;data:DeckData;model:DeckTakeoff;yardModel?:YardModel;deckOnly?:boolean;structure?:boolean;cutaway?:boolean;view?:string;onContextLost?:()=>void;onMovePrivacyScreen?:(id:string,offsetPct:number)=>void;onSnapshotReady?:(capture:((longEdgePx?:number)=>string|null)|null)=>void;boardPaint?:BoardPaint}&HouseInteraction){
  const [selected,setSelected]=useState(false),[pergolaMode,setPergolaMode]=useState<'move'|'rotate'>('move'),[draft,setDraft]=useState<Partial<PergolaSelection>|null>(null);
  const placedData=draft&&rawData.pergola?{...rawData,pergola:{...rawData.pergola,...draft}}:rawData;
  const data=useMemo<DeckData>(()=>{if(!deckOnly)return placedData;const {yardFeatures:_yard,terrainConfig:_terrain,...deck}=placedData;return deck;},[placedData,deckOnly]);
  const yard=useMemo(()=>!deckOnly&&calculatedYard?calculatedYard:buildYardModel(data,model),[deckOnly,calculatedYard,model,data.yardFeatures,data.terrainConfig,data.width,data.length,data.houseConfig?.widthFt,data.houseConfig?.depthFt,data.houseConfig?.footprint,data.housePlacement,data.houseVisible,data.deckType]);
  const pergola=useMemo(()=>pergolaLayout(rawData,model,[],false),[rawData,model]);
  const bounds=sceneBounds(model),house=houseLayout(data,model.levels[0].footprint.bounds.w);
  if(pergola){for(const p of pergola.footprint){bounds.minX=Math.min(bounds.minX,p.x);bounds.maxX=Math.max(bounds.maxX,p.x);bounds.minZ=Math.min(bounds.minZ,p.y);bounds.maxZ=Math.max(bounds.maxZ,p.y);}bounds.top=Math.max(bounds.top,pergola.roofHigh);}
  if(view==='overview'&&house.visible){bounds.minX=Math.min(bounds.minX,house.minX-14);bounds.maxX=Math.max(bounds.maxX,house.maxX+14);bounds.minZ=Math.min(bounds.minZ,-house.depth-14);bounds.top=Math.max(bounds.top,house.wallHeight+house.roofRise);for(const {rect:b,wallHeightIn} of getHouseBlocks(data).slice(1)){bounds.minX=Math.min(bounds.minX,b.x0-14);bounds.maxX=Math.max(bounds.maxX,b.x1+14);bounds.minZ=Math.min(bounds.minZ,b.y0-14);bounds.top=Math.max(bounds.top,wallHeightIn+house.roofRise);}}
  if(view==='overview')for(const feature of yard.features.filter(f=>!f.excluded)){for(const p of feature.footprints.flat()){bounds.minX=Math.min(bounds.minX,p.x);bounds.maxX=Math.max(bounds.maxX,p.x);bounds.minZ=Math.min(bounds.minZ,p.y);bounds.maxZ=Math.max(bounds.maxZ,p.y);}for(const b of feature.boxes)bounds.top=Math.max(bounds.top,b.y+b.h/2);}
  const w=(bounds.maxX-bounds.minX)/12,d=(bounds.maxZ-bounds.minZ)/12,cx=(bounds.maxX+bounds.minX)/24,cz=(bounds.maxZ+bounds.minZ)/24,r=Math.max(w,d),height=bounds.top/12,evening=data.sceneLighting==='Evening';
  const lights=activeLightingItems(data).reduce((n,item)=>n+(isIlluminatingFixture(item.productId)?item.qty:0),0);
  const simplifiedPaving=!structure&&!cutaway&&view!=='hardware'&&hasSimplifiedPaving(yard);
  return <>{onUpdate&&!structure&&!cutaway&&!boardPaint&&<PergolaTools data={data} selected={selected} setSelected={setSelected} mode={pergolaMode} setMode={setPergolaMode} update={onUpdate}/>}<div className="w-full aspect-square md:aspect-video relative overflow-hidden" role="region" aria-label="Interactive deck construction model">
    <Canvas shadows="percentage" frameloop="demand" dpr={[1,1.5]} camera={{fov:38,position:[cx+r*1.1,height+r*.85,cz+r*1.65],near:SCENE_LOOK.sky.cameraNear,far:SCENE_LOOK.sky.cameraFar}} gl={{antialias:false,toneMapping:THREE.NeutralToneMapping,toneMappingExposure:SCENE_LOOK.exposure}} onCreated={({gl})=>{const canvas=gl.domElement;canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();
        // Leaving 3D (e.g. for the Plan view) disposes the renderer and also fires this event;
        // only a canvas still on the page has really lost its GPU context.
        setTimeout(()=>{if(canvas.isConnected)onContextLost?.();},0);},false);}}>
      <color attach="background" args={[evening?'#28374a':'#e9edf0']}/>
      {/* The real sky (Real Life G3); the studio light stands in while it loads. */}
      <Suspense fallback={<StudioLight evening={evening}/>}><Sky3D evening={evening}/></Suspense>
      <fogExp2 attach="fog" args={['#8a8b80',SCENE_LOOK.sky.fogDensity]}/>
      <CameraView view={view} w={w} d={d} cx={cx} cz={cz} height={height} depth={data.foundationDepthIn??48}/>
      <Scene data={data} model={model} structure={structure} cutaway={cutaway} inspection={structure||view==='hardware'} yard={yard} onMovePrivacyScreen={onMovePrivacyScreen} boardPaint={boardPaint} pergolaInteraction={onUpdate&&rawData.pergola&&!boardPaint&&!structure&&!cutaway?{selected,mode:pergolaMode,onSelect:()=>setSelected(true),onDraft:setDraft,onCommit:patch=>onUpdate({pergola:{...rawData.pergola!,...patch}})}:undefined} {...interaction}/>
      <SnapshotBridge onReady={onSnapshotReady}/>
      <RenderPipeline evening={evening}/>
      <OrbitControls makeDefault target={[cx,cutaway?-(data.foundationDepthIn??48)/24:height*.4,cz]} maxPolarAngle={cutaway?Math.PI*.7:Math.PI/2-.04} minDistance={r*.25} maxDistance={r*4} enableDamping={false}/>
    </Canvas>{simplifiedPaving&&<p className="absolute top-3 left-3 right-3 w-fit rounded-md bg-white/95 px-3 py-2 text-xs text-[#38413b] shadow-sm pointer-events-none">Simplified paving preview · {yard.quantities.paverPieces.toLocaleString()} pavers retained in quantities, construction view and exports.</p>}<p className={`absolute bottom-3 left-4 right-4 text-[10px] pointer-events-none ${evening?'text-white':'text-[#474c43]'}`}>Drag to orbit · pinch or scroll to zoom{evening&&data.lightingPreviewOn!==false&&lights>MAX_PREVIEW_LIGHTS?` · ${lights} fixtures shown; light spread preview limited to ${MAX_PREVIEW_LIGHTS} fixtures`:''}</p>
  </div></>;
}
