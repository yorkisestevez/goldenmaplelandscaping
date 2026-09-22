import NotchedStringers from './NotchedStringers';
import {useEffect,useMemo,useLayoutEffect,useRef} from 'react';
import {Canvas,useThree} from '@react-three/fiber';
import {OrbitControls,Environment,Lightformer} from '@react-three/drei';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {type DeckData} from '../../types';
import {DECKING_CATALOGUE} from '../../manufacturerCatalog';
import {type DeckTakeoff,type Member,type Box} from '../../deckTakeoff';
import {swatchUrl} from '../../lib/swatches';
import {useSwatchTexture} from './useSwatchTexture';
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
import {catalogueAccessoryLayout} from '../../catalogueAccessories';
import {activeLightingItems} from '../../lightingSystem';
import type {HouseInteraction} from './houseInteraction';
import {buildYardModel,type YardModel} from '../../yardModel';
import Yard3D from './Yard3D';
import {stairVeneerLayout} from '../../stairVeneerLayout';
import {hasSimplifiedPaving} from './yardPreview';
import PrivacyScreens3D from './PrivacyScreens3D';

function Members({items,material,name}:{items:Member[];material:THREE.Material;name:string}){
  const ref=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate);
  useLayoutEffect(()=>{
    if(!ref.current)return;const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
    items.forEach((m,i)=>{const a=new THREE.Vector3(m.a.x,m.a.y,m.a.z),b=new THREE.Vector3(m.b.x,m.b.y,m.b.z),dir=b.clone().sub(a);const axis=dir.clone().normalize(),normal=new THREE.Vector3(0,1,0);if(Math.abs(axis.y)>0.99)normal.set(1,0,0);const side=new THREE.Vector3().crossVectors(axis,normal).normalize(),vertical=new THREE.Vector3().crossVectors(side,axis).normalize();q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(axis,vertical,side));matrix.compose(a.add(b).multiplyScalar(0.5),q,new THREE.Vector3(Math.max(0.01,dir.length()),m.depth,m.width));ref.current!.setMatrixAt(i,matrix);});
    ref.current.count=items.length;ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere();invalidate();
  },[items,invalidate]);
  return <instancedMesh name={name} castShadow receiveShadow key={items.length} ref={ref} args={[undefined,undefined,Math.max(1,items.length)]} material={material}><boxGeometry args={[1,1,1]}/></instancedMesh>;
}
function Boxes({items,material,name}:{items:Box[];material:THREE.Material;name:string}){
  const ref=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate);
  useLayoutEffect(()=>{if(!ref.current)return;const matrix=new THREE.Matrix4(),q=new THREE.Quaternion();items.forEach((b,i)=>{q.setFromAxisAngle(new THREE.Vector3(0,1,0),b.angle||0);matrix.compose(new THREE.Vector3(b.x,b.y,b.z),q,new THREE.Vector3(b.w,b.h,b.d));ref.current!.setMatrixAt(i,matrix);});ref.current.count=items.length;ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere();invalidate();},[items,invalidate]);
  return <instancedMesh name={name} castShadow receiveShadow ref={ref} key={items.length} args={[undefined,undefined,Math.max(1,items.length)]} material={material}><boxGeometry args={[1,1,1]}/></instancedMesh>;
}
type FinishBox=Box&{polygon?:{x:number;y:number}[];role?:string};
function BoardBatch({items,material}:{items:FinishBox[];material:THREE.Material}){
  const ref=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate);
  const first=items[0];
  const geometry=useMemo(()=>{
    const g=new RoundedBoxGeometry(first.w,first.h,first.d,1,.045),pos=g.getAttribute('position'),uv=g.getAttribute('uv');
    // Consistent grain scale in inches, along the board rather than stretching a photo per piece.
    for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+first.w/2)/48,first.h>first.d?(pos.getY(i)+first.h/2)/first.h:(pos.getZ(i)+first.d/2)/first.d);
    return g;
  },[first.w,first.h,first.d]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useLayoutEffect(()=>{if(!ref.current)return;const m=new THREE.Matrix4(),q=new THREE.Quaternion();items.forEach((b,i)=>{q.setFromAxisAngle(new THREE.Vector3(0,1,0),b.angle||0);m.compose(new THREE.Vector3(b.x,b.y,b.z),q,new THREE.Vector3(1,1,1));ref.current!.setMatrixAt(i,m);const shade=.92+.08*((Math.sin(b.x*12.3+b.z*7.9)*437.1)%1+1)/2;ref.current!.setColorAt(i,new THREE.Color(shade,shade,shade));});ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();invalidate();},[items,invalidate]);
  return <instancedMesh ref={ref} args={[geometry,material,items.length]} castShadow receiveShadow/>;
}
function PolygonBoard({item,material}:{item:FinishBox;material:THREE.Material}){
  const geometry=useMemo(()=>{const shape=new THREE.Shape();item.polygon!.forEach((p,i)=>i?shape.lineTo(p.x,p.y):shape.moveTo(p.x,p.y));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:item.h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,item.y+item.h/2,0);const pos=g.getAttribute('position'),uv=g.getAttribute('uv'),a=item.angle||0,cu=item.x*Math.cos(a)-item.z*Math.sin(a),cv=item.x*Math.sin(a)+item.z*Math.cos(a);for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)*Math.cos(a)-pos.getZ(i)*Math.sin(a)-cu+item.w/2)/48,(pos.getX(i)*Math.sin(a)+pos.getZ(i)*Math.cos(a)-cv+item.d/2)/item.d);return g;},[item]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} material={material} castShadow receiveShadow/>;
}
function FinishedBoards({items,material}:{items:FinishBox[];material:THREE.Material}){
  const layout=useMemo(()=>{const groups=new Map<string,FinishBox[]>(),polygons:FinishBox[]=[];for(const b of items){const area=b.polygon?Math.abs(b.polygon.reduce((s,p,i)=>{const q=b.polygon![(i+1)%b.polygon!.length];return s+p.x*q.y-q.x*p.y;},0))/2:0;if(b.polygon&&(b.polygon.length!==4||Math.abs(area-b.w*b.d)>.01)){polygons.push(b);continue;}const key=[b.w,b.h,b.d].map(n=>n.toFixed(4)).join(':');const group=groups.get(key);if(group)group.push(b);else groups.set(key,[b]);}return {groups:[...groups.entries()],polygons};},[items]);
  return <group name="installed-deck-board-pieces">{layout.groups.map(([key,items])=><BoardBatch key={key} items={items} material={material}/>)}{layout.polygons.map((item,i)=><PolygonBoard key={i} item={item} material={material}/>)}</group>;
}
function CameraView({view,w,d,cx,cz,height,depth}:{view:string;w:number;d:number;cx:number;cz:number;height:number;depth:number}){
 const {camera,controls,invalidate}=useThree();
 useEffect(()=>{const r=Math.max(w,d),target=new THREE.Vector3(cx,view==='foundation'?-depth/24:height*.5,cz);camera.position.set(cx+r*.9,height+r*.7,cz+r*1.3);if(view==='front')camera.position.set(cx,height*.6,cz+r*1.8);if(view==='top')camera.position.set(cx,r*2+.1,cz+.01);if(view==='hardware')camera.position.set(cx+r*.6,height*.25,cz+r*1.2);if(view==='foundation')camera.position.set(cx+r*.9,height+r*.65,cz+r*1.4);camera.lookAt(target);if(controls&&'target' in controls){(controls as any).target.copy(target);(controls as any).update();}invalidate();},[view,w,d,cx,cz,height,depth,camera,controls,invalidate]);return null;
}
function Scene({data,model,structure,cutaway,inspection,yard,onMovePrivacyScreen,...interaction}:{data:DeckData;model:DeckTakeoff;structure:boolean;cutaway:boolean;inspection:boolean;yard:YardModel;onMovePrivacyScreen?:(id:string,offsetPct:number)=>void}&HouseInteraction){
  const material=DECKING_CATALOGUE.find(m=>m.id===data.deckingMaterial)||DECKING_CATALOGUE[0];
  const swatch=material.colors.find(c=>c.name===data.deckingColor)||material.colors[0];
  const board=useSwatchTexture(swatchUrl(swatch.swatch),getMaterialFallbackColor(material.id));
  const darkBorder=data.borderFinish==='Dark Slate';
  const borderMaterial=useSwatchTexture(darkBorder?swatchUrl('dk-border-dark-slate.jpg'):'','#343635');
  const extras=useMemo(()=>extrasLayout(data,model),[data,model]);
  const catalogueExtras=useMemo(()=>catalogueAccessoryLayout(data,model),[data,model]);
  const stairBoards=useMemo(()=>getStairBoards(data,model),[data,model]);
  const stairVeneer=useMemo(()=>stairVeneerLayout(data,model),[data,model]);
  const materials=useMemo(()=>({wood:new THREE.MeshStandardMaterial({color:'#8a7356',roughness:0.86}),inlay:new THREE.MeshStandardMaterial({color:'#514236',roughness:.7}),metal:new THREE.MeshStandardMaterial({color:'#242829',roughness:0.36,metalness:0.5}),concrete:new THREE.MeshStandardMaterial({color:'#a5a49a',roughness:0.9}),glass:new THREE.MeshPhysicalMaterial({color:'#cbdfe3',roughness:0.08,metalness:0.1,transparent:true,opacity:0.23,depthWrite:false})}),[]);
  useEffect(()=>()=>Object.values(materials).forEach(m=>m.dispose()),[materials]);
  const boards:FinishBox[]=useMemo(()=>model.levels.flatMap(l=>l.boards.map(b=>{const cut=b as typeof b&{width?:number;polygon?:{x:number;y:number}[];role?:string};return {x:b.cx+l.offset.x,y:l.top-0.5,z:b.cy+l.offset.z,w:b.length,h:1,d:cut.width??data.boardWidth,angle:-b.angleDeg*Math.PI/180,role:cut.role,polygon:cut.polygon?.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))};})),[model,data.boardWidth]);
  const postBase=data.foundation==='Deck Blocks'?6.5:4.5;
  const supportPosts:Box[]=model.levels.flatMap(l=>l.supports.filter(p=>p.y>postBase).map(p=>({x:p.x,y:(p.y+postBase)/2,z:p.z,w:5.5,h:p.y-postBase,d:5.5})));
  const railPosts:Box[]=model.railing.posts.map(p=>({x:p.x,y:p.y+model.railing.height/2,z:p.z,w:3.5,h:model.railing.height,d:3.5}));
  const edgeMembers:Member[]=model.levels.flatMap(l=>l.rim??[]);
  const railMat=data.railingType==='Wood Picket'?board:materials.metal;
  return <group scale={1/12}>
    {!structure&&<><FinishedBoards items={boards.filter(b=>b.role!=='inlay'&&(!darkBorder||b.role!=='border'))} material={board}/><FinishedBoards items={boards.filter(b=>b.role==='inlay')} material={materials.inlay}/>{darkBorder&&<FinishedBoards items={boards.filter(b=>b.role==='border')} material={borderMaterial}/>}</>}
    <Members items={model.levels.flatMap(l=>l.joists)} material={materials.wood} name="joists"/>
    <Members items={model.levels.flatMap(l=>l.blocking)} material={materials.wood} name="blocking"/>
    <Members items={model.levels.flatMap(l=>l.beams)} material={materials.wood} name="beams"/>
    <Members items={edgeMembers} material={structure?materials.wood:board} name="rim-and-fascia"/>
    {!structure&&<Members items={catalogueExtras.fascia} material={board} name="selected-manufacturer-fascia"/>}
    {inspection&&<><Boxes items={catalogueExtras.tape} material={materials.metal} name="selected-joist-tape"/><Boxes items={catalogueExtras.flashing} material={materials.metal} name="selected-ledger-flashing"/></>}
    <Boxes items={supportPosts} material={materials.wood} name="support-posts"/>
    <HardwareDetails data={data} model={model} inspection={inspection}/><FootingDetails data={data} model={model} cutaway={cutaway}/>
    <FinishedBoards items={stairBoards} material={board}/>
    {!structure&&<group name="closed-stair-riser-boards"><FinishedBoards items={model.riserBoards} material={board}/></group>}
    <NotchedStringers model={model} material={materials.wood}/>
    <Boxes items={stairVeneer.woodBoxes} material={materials.wood} name="terrain-stair-veneer-support-blocks"/>
    {inspection&&<Boxes items={stairVeneer.bracketBoxes} material={materials.metal} name="terrain-stair-veneer-support-angles"/>}
    <Boxes items={railPosts} material={railMat} name="railing-posts"/>
    <Members items={model.railing.rails} material={railMat} name="railing-runs"/>
    {data.railingType!=='Cable'&&<Members items={model.railing.balusters} material={railMat} name="railing-infill"/>}
    <RailingDetails data={data} model={model}/>
    <Boxes items={extras.wood} material={board} name="benches-privacy-pergola"/>
    <Boxes items={extras.metal} material={materials.metal} name="accessory-frames"/>
    <Boxes items={extras.drainage} material={materials.metal} name="under-deck-drainage"/>
    <PrivacyScreens3D panels={extras.panels} handles={extras.screenHandles} onMove={onMovePrivacyScreen}/>
    <LightingFixtures items={extras.fixtures} evening={data.sceneLighting==='Evening'} enabled={data.lightingPreviewOn!==false}/>
    <Yard3D model={yard} inspection={inspection||cutaway}/>
    <Environment3D data={data} footprint={model.levels[0].footprint} topY={data.height} planKey={JSON.stringify(model.quantities)} cutaway={cutaway} yard={yard} {...interaction}/>
  </group>;
}
/** Hands the page a function that renders the current view and returns it as an image (for the
 * printable proposal). Rendering right before reading keeps the drawing buffer valid without
 * preserveDrawingBuffer on every frame. */
function SnapshotBridge({onReady}:{onReady?:(capture:(()=>string|null)|null)=>void}){
  const gl=useThree(s=>s.gl),scene=useThree(s=>s.scene),camera=useThree(s=>s.camera);
  useEffect(()=>{
    if(!onReady)return;
    onReady(()=>{try{gl.render(scene,camera);return gl.domElement.toDataURL('image/jpeg',.9);}catch{return null;}});
    return ()=>onReady(null);
  },[gl,scene,camera,onReady]);
  return null;
}
export default function Deck3DViewer({data:rawData,model,yardModel:calculatedYard,deckOnly=false,structure=false,cutaway=false,view="3d",onContextLost,onMovePrivacyScreen,onSnapshotReady,...interaction}:{data:DeckData;model:DeckTakeoff;yardModel?:YardModel;deckOnly?:boolean;structure?:boolean;cutaway?:boolean;view?:string;onContextLost?:()=>void;onMovePrivacyScreen?:(id:string,offsetPct:number)=>void;onSnapshotReady?:(capture:(()=>string|null)|null)=>void}&HouseInteraction){
  const data=useMemo<DeckData>(()=>{if(!deckOnly)return rawData;const {yardFeatures:_yard,terrainConfig:_terrain,...deck}=rawData;return deck;},[rawData,deckOnly]);
  const yard=useMemo(()=>!deckOnly&&calculatedYard?calculatedYard:buildYardModel(data,model),[deckOnly,calculatedYard,model,data.yardFeatures,data.terrainConfig,data.width,data.length,data.houseConfig?.widthFt,data.houseConfig?.depthFt,data.houseConfig?.footprint,data.housePlacement,data.houseVisible,data.deckType]);
  const bounds=sceneBounds(model),house=houseLayout(data,model.levels[0].footprint.bounds.w);
  if(view==='overview'&&house.visible){bounds.minX=Math.min(bounds.minX,house.minX-14);bounds.maxX=Math.max(bounds.maxX,house.maxX+14);bounds.minZ=Math.min(bounds.minZ,-house.depth-14);bounds.top=Math.max(bounds.top,house.wallHeight+house.roofRise);for(const {rect:b,wallHeightIn} of getHouseBlocks(data).slice(1)){bounds.minX=Math.min(bounds.minX,b.x0-14);bounds.maxX=Math.max(bounds.maxX,b.x1+14);bounds.minZ=Math.min(bounds.minZ,b.y0-14);bounds.top=Math.max(bounds.top,wallHeightIn+house.roofRise);}}
  if(view==='overview')for(const feature of yard.features.filter(f=>!f.excluded)){for(const p of feature.footprints.flat()){bounds.minX=Math.min(bounds.minX,p.x);bounds.maxX=Math.max(bounds.maxX,p.x);bounds.minZ=Math.min(bounds.minZ,p.y);bounds.maxZ=Math.max(bounds.maxZ,p.y);}for(const b of feature.boxes)bounds.top=Math.max(bounds.top,b.y+b.h/2);}
  const w=(bounds.maxX-bounds.minX)/12,d=(bounds.maxZ-bounds.minZ)/12,cx=(bounds.maxX+bounds.minX)/24,cz=(bounds.maxZ+bounds.minZ)/24,r=Math.max(w,d),height=bounds.top/12,evening=data.sceneLighting==='Evening';
  const lights=activeLightingItems(data).reduce((n,item)=>n+(isIlluminatingFixture(item.productId)?item.qty:0),0);
  const simplifiedPaving=!structure&&!cutaway&&view!=='hardware'&&hasSimplifiedPaving(yard);
  return <div className="w-full aspect-square md:aspect-video relative overflow-hidden" role="region" aria-label="Interactive deck construction model">
    <Canvas shadows frameloop="demand" dpr={[1,1.5]} camera={{fov:38,position:[cx+r*1.1,height+r*.85,cz+r*1.65],near:.1,far:1000}} gl={{antialias:true,toneMapping:THREE.NeutralToneMapping,toneMappingExposure:1}} onCreated={({gl})=>{const canvas=gl.domElement;canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();
        // Leaving 3D (e.g. for the Plan view) disposes the renderer and also fires this event;
        // only a canvas still on the page has really lost its GPU context.
        setTimeout(()=>{if(canvas.isConnected)onContextLost?.();},0);},false);}}>
      <color attach="background" args={[evening?'#28374a':'#e9edf0']}/>
      <Environment key={evening?'evening':'day'} resolution={128} frames={1} environmentIntensity={evening?.16:.4}><Lightformer intensity={3} position={[0,12,0]} rotation={[Math.PI/2,0,0]} scale={[20,20,1]}/><Lightformer intensity={2} position={[-15,6,8]} rotation={[0,Math.PI/2,0]} scale={[12,15,1]}/><Lightformer intensity={1} position={[12,5,-8]} rotation={[0,-Math.PI/2,0]} scale={[10,10,1]}/></Environment>
      <CameraView view={view} w={w} d={d} cx={cx} cz={cz} height={height} depth={data.foundationDepthIn??48}/>
      <Scene data={data} model={model} structure={structure} cutaway={cutaway} inspection={structure||view==='hardware'} yard={yard} onMovePrivacyScreen={onMovePrivacyScreen} {...interaction}/>
      <SnapshotBridge onReady={onSnapshotReady}/>
      <OrbitControls makeDefault target={[cx,cutaway?-(data.foundationDepthIn??48)/24:height*.4,cz]} maxPolarAngle={cutaway?Math.PI*.7:Math.PI/2-.04} minDistance={r*.25} maxDistance={r*4} enableDamping={false}/>
    </Canvas>{simplifiedPaving&&<p className="absolute top-3 left-3 right-3 w-fit rounded-md bg-white/95 px-3 py-2 text-xs text-[#38413b] shadow-sm pointer-events-none">Simplified paving preview · {yard.quantities.paverPieces.toLocaleString()} pavers retained in quantities, construction view and exports.</p>}<p className={`absolute bottom-3 left-4 right-4 text-[10px] pointer-events-none ${evening?'text-white':'text-[#474c43]'}`}>Drag to orbit · pinch or scroll to zoom{evening&&data.lightingPreviewOn!==false&&lights>MAX_PREVIEW_LIGHTS?` · ${lights} fixtures shown; light spread preview limited to ${MAX_PREVIEW_LIGHTS} fixtures`:''}</p>
  </div>;
}
