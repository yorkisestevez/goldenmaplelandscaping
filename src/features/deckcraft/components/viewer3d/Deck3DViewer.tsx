import {Suspense,lazy,useCallback,useContext,useEffect,useMemo,useLayoutEffect,useRef,useState} from 'react';
import ScenePresentationTools from './ScenePresentationTools';

import SavedCameraBridge from './SavedCameraBridge';

import {landscapeCamera} from './landscapeCamera';

import type {SavedSceneCamera} from '../../scenePresentation';

import {getPoolModels} from '../../poolModel';

const Pool3D=lazy(()=>import('./Pool3D'));
const Fire3D=lazy(()=>import('./Fire3D'));

import {foundationSolids} from '../../foundationSolids';

const Landscape3D=lazy(()=>import('./Landscape3D'));

import {landscapePlacement,landscapeFootprint} from '../../landscapeModel';

import SceneStillExport from './SceneStillExport';

import {isObjectVisible} from '../../editorOrganization';

import {pergolaLayout} from '../../pergolaLayout';

import Pergola3D,{type PergolaInteraction} from './Pergola3D';

import PergolaTools from './PergolaTools';

import type {Update} from '../../designer/fields';

import type {PergolaSelection} from '../../pergolaCatalog';

import NotchedStringers from './NotchedStringers';

const SceneEditHandles=lazy(()=>import('./SceneEditHandles'));
import type {SceneEditInteraction} from '../../designer/sceneEditTypes';
import SelectionBridge,{type ObjectPick} from './SelectionBridge';

import type {SelectionState} from '../../designer/selectionState';



import {Canvas,useThree,type ThreeEvent} from '@react-three/fiber';

import {OrbitControls} from '@react-three/drei';

import * as THREE from 'three';

import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import {type DeckData} from '../../types';

import {DECKING_CATALOGUE} from '../../manufacturerRuntimeCatalogue';

import {type DeckTakeoff,type Member,type Box} from '../../deckTakeoff';

import {swatchUrl} from '../../lib/swatches';

import {useSwatchTexture,waitForSwatchTextures} from './useSwatchTexture';

import {boardVariation,boxVariant} from './surfaceShaders';

import {Environment3D} from './Environment3D';

import HardwareDetails from './HardwareDetails';

import FootingDetails from './FootingDetails';

import {getMaterialFallbackColor} from '../../lib/deckGeometry';

import {extrasLayout} from '../../extrasLayout';

import LightingFixtures,{MAX_PREVIEW_LIGHTS} from './LightingFixtures';

import FixtureGlows from './FixtureGlows';

import {FixtureLightContext,createFixtureLighting,useFixtureLit} from './fixtureLighting';

import {packFixtureLights} from '../../fixtureLight';

import {castsPreviewLight} from '../../lightingPreview';

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

import Skirting3D,{Slabs} from './Skirting3D';

import {fasciaSlabs,accessoryFasciaSlabs} from './fasciaSlabs';

import Cladding3D from './Cladding3D';

import {drawnRiserBoards} from '../../stairCladding';

import {boardFinishPlan,darkSlateBorder,borderFinishRef,parseColourRef} from '../../boardFinishes';

import {hasBoardLayout} from '../../boardLayoutPricing';

import {partRef,railingFinish} from '../../deckPartFinishes';

import {railingScreenHex} from '../../railingScreenColours';

import type {BoardAddress} from '../../lib/boardAddress';

import RenderPipeline,{pipelineFor} from './renderPipeline';

import {SCENE_LOOK} from './sceneLook';

import Sky3D,{StudioLight} from './Sky3D';

import RenderQuality,{ShowcaseModeSync} from './SceneRenderQuality';

import {exposedWallEnvelope} from './wallFraming';

import {cameraSetback,overviewCamera} from './cameraFraming';

import EasedRails from './EasedRails';



/** Powder-coated aluminium (railings, frames, flashing): paint at metalness 0 with a clear coat, so dark finishes

 * catch the sky instead of reading as flat silhouettes. */

const powderCoat=(color:string)=>new THREE.MeshPhysicalMaterial({color,...SCENE_LOOK.powderCoat});



/** Unit boxes (Members, Boxes) take a swatch material's box-projected grain (surfaceShaders.ts): along each piece, never stretched. */

// The box-projected variant is its own material (a clone), so it takes the fixture light patch itself.

function useBoxMaterial(material:THREE.Material){const box=useMemo(()=>boxVariant(material),[material]);useFixtureLit(box);return box;}

function Members({items,material:given,name,partIds}:{items:Member[];material:THREE.Material;name:string;partIds?:string[]}){

  const ref=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate),material=useBoxMaterial(given);

  useLayoutEffect(()=>{

    if(!ref.current)return;const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);

    items.forEach((m,i)=>{const a=new THREE.Vector3(m.a.x,m.a.y,m.a.z),b=new THREE.Vector3(m.b.x,m.b.y,m.b.z),dir=b.clone().sub(a);const axis=dir.clone().normalize(),normal=new THREE.Vector3(0,1,0);if(Math.abs(axis.y)>0.99)normal.set(1,0,0);const side=new THREE.Vector3().crossVectors(axis,normal).normalize(),vertical=new THREE.Vector3().crossVectors(side,axis).normalize();q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(axis,vertical,side));matrix.compose(a.add(b).multiplyScalar(0.5),q,new THREE.Vector3(Math.max(0.01,dir.length()),m.depth,m.width));ref.current!.setMatrixAt(i,matrix);});

    ref.current.count=items.length;ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere();invalidate();

  },[items,invalidate]);

  return <instancedMesh userData={{pickPartIds:partIds}} name={name} castShadow receiveShadow key={items.length} ref={ref} args={[undefined,undefined,Math.max(1,items.length)]} material={material}><boxGeometry args={[1,1,1]}/></instancedMesh>;

}

function Boxes({items,material:given,name,partIds}:{items:Box[];material:THREE.Material;name:string;partIds?:(string|undefined)[]}){

  const ref=useRef<THREE.InstancedMesh>(null),invalidate=useThree(s=>s.invalidate),material=useBoxMaterial(given);

  useLayoutEffect(()=>{if(!ref.current)return;const matrix=new THREE.Matrix4(),q=new THREE.Quaternion();items.forEach((b,i)=>{q.setFromAxisAngle(new THREE.Vector3(0,1,0),b.angle||0);matrix.compose(new THREE.Vector3(b.x,b.y,b.z),q,new THREE.Vector3(b.w,b.h,b.d));ref.current!.setMatrixAt(i,matrix);});ref.current.count=items.length;ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere();invalidate();},[items,invalidate]);

  return <instancedMesh userData={{pickPartIds:partIds}} name={name} castShadow receiveShadow ref={ref} key={items.length} args={[undefined,undefined,Math.max(1,items.length)]} material={material}><boxGeometry args={[1,1,1]}/></instancedMesh>;

}

type FinishBox=Box&{polygon?:{x:number;y:number}[];role?:string;

  /** Where the piece is in the model (level, board) and its accent colour, for the accent-board tool. */

  ref?:{level:number;index:number};partId?:string;accent?:string|null};

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

    // A small milled edge catches light without making the capped board look inflated.

    const g=new RoundedBoxGeometry(first.w,first.h,first.d,1,.065),pos=g.getAttribute('position'),uv=g.getAttribute('uv');

    // Consistent grain scale in inches, along the board rather than stretching a photo per piece.

    for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+first.w/2)/48,first.h>first.d?(pos.getY(i)+first.h/2)/first.h:(pos.getZ(i)+first.d/2)/first.d);

    // A mounted attribute owns one GPU buffer. Replacing it during each edit

    // would strand its old buffer until the whole renderer is disposed.

    g.setAttribute('aVar',new THREE.InstancedBufferAttribute(new Float32Array(items.length*4),4));

    return g;

  },[first.w,first.h,first.d,items.length]);

  useEffect(()=>()=>geometry.dispose(),[geometry]);

  useLayoutEffect(()=>{if(!ref.current)return;const m=new THREE.Matrix4(),q=new THREE.Quaternion(),variation=geometry.getAttribute('aVar') as THREE.InstancedBufferAttribute;items.forEach((b,i)=>{q.setFromAxisAngle(new THREE.Vector3(0,1,0),b.angle||0);m.compose(new THREE.Vector3(b.x,b.y,b.z),q,new THREE.Vector3(1,1,1));ref.current!.setMatrixAt(i,m);variation.setXYZW(i,...boardVariation(b.x,b.z));

    // Each board a touch lighter or darker, centred on the product's own colour.

    const shade=.97+.06*((Math.sin(b.x*12.3+b.z*7.9)*437.1)%1+1)/2;ref.current!.setColorAt(i,new THREE.Color(shade,shade,shade));});

    // Which strip of the swatch atlas, how far along and which way round (surfaceShaders.ts).

    variation.needsUpdate=true;

    ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();invalidate();},[items,geometry,invalidate]);

  return <instancedMesh userData={{pickBoards:items.map(b=>b.ref),pickPartIds:items.map(b=>b.partId)}} ref={ref} args={[geometry,material,items.length]} castShadow receiveShadow {...pickHandlers(pick,e=>items[e.instanceId??-1])}/>;

}

function PolygonBoard({item,material,pick}:{item:FinishBox;material:THREE.Material;pick?:BoardPick}){

  const geometry=useMemo(()=>{const shape=new THREE.Shape();item.polygon!.forEach((p,i)=>i?shape.lineTo(p.x,p.y):shape.moveTo(p.x,p.y));shape.closePath();const minEdge=Math.min(...item.polygon!.map((p,i)=>{const q=item.polygon![(i+1)%item.polygon!.length];return Math.hypot(q.x-p.x,q.y-p.y);})),c=Math.min(.065,item.h/6,minEdge/8);const g=new THREE.ExtrudeGeometry(shape,{depth:item.h-2*c,bevelEnabled:true,bevelThickness:c,bevelSize:c,bevelOffset:-c,bevelSegments:1,curveSegments:1});g.rotateX(Math.PI/2);g.translate(0,item.y+item.h/2-c,0);const pos=g.getAttribute('position'),uv=g.getAttribute('uv'),a=item.angle||0,cu=item.x*Math.cos(a)-item.z*Math.sin(a),cv=item.x*Math.sin(a)+item.z*Math.cos(a);for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)*Math.cos(a)-pos.getZ(i)*Math.sin(a)-cu+item.w/2)/48,(pos.getX(i)*Math.sin(a)+pos.getZ(i)*Math.cos(a)-cv+item.d/2)/item.d);const variation=boardVariation(item.x,item.z);g.setAttribute('aVar',new THREE.Float32BufferAttribute(Array.from({length:uv.count},()=>variation).flat(),4));return g;},[item]);

  useEffect(()=>()=>geometry.dispose(),[geometry]);

  return <mesh userData={{pickBoard:item.ref,pickPartId:item.partId}} geometry={geometry} material={material} castShadow receiveShadow {...pickHandlers(pick,()=>item)}/>;

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

function usePartMaterial(ref:string|undefined,board:THREE.Material,relief=1):THREE.Material{

  const parsed=ref?parseColourRef(ref):null,material=useSwatchTexture(parsed?swatchUrl(parsed.color.swatch):'',getMaterialFallbackColor(parsed?.material.id??''));

  // The grain photograph carries colour; its derived normals should read as fine capped-board embossing.

  useMemo(()=>material.normalScale.set(relief,relief),[material,relief]);

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

function CameraView({view,w,d,cx,cz,height,depth,points,sceneFrame,saved}:{view:string;w:number;d:number;cx:number;cz:number;height:number;depth:number;points:{x:number;y:number;z:number}[];sceneFrame?:{target:[number,number,number];position:[number,number,number]};saved?:SavedSceneCamera}){

 const {camera,controls,invalidate,set,size}=useThree();

 const aspect=size.width/Math.max(1,size.height),setback=cameraSetback(aspect);

 const frame=saved?{target:saved.targetIn.map(n=>n/12) as [number,number,number],position:saved.positionIn.map(n=>n/12) as [number,number,number]}:sceneFrame??(view==='overview'?overviewCamera({w,d,cx,cz,height,aspect,points},38):undefined);

 // Above uses an orthographic camera so board widths read true (no foreshortening) for sales and plan checks.
 useLayoutEffect(()=>{
  const r=Math.max(w,d),target=new THREE.Vector3(cx,view==='foundation'?-depth/24:height*.5,cz);
  const wantOrtho=view==='top'&&!frame&&!saved;
  let cam=camera;
  if(wantOrtho!==(cam instanceof THREE.OrthographicCamera)){
   cam=wantOrtho
    ?new THREE.OrthographicCamera(-10,10,10,-10,SCENE_LOOK.sky.cameraNear,SCENE_LOOK.sky.cameraFar)
    :new THREE.PerspectiveCamera(saved?.fov??38,aspect,SCENE_LOOK.sky.cameraNear,SCENE_LOOK.sky.cameraFar);
   set({camera:cam});
  }
  cam.position.set(cx+r*.9,height+r*.7,cz+r*1.3);if(view==='3d')cam.position.y=height*.65+r*.4;if(view==='front')cam.position.set(cx,height*.6,cz+r*1.8);if(view==='top')cam.position.set(cx,Math.max(r*2,height+8),cz);if(view==='hardware')cam.position.set(cx+r*.6,height*.25,cz+r*1.2);if(view==='foundation')cam.position.set(cx+r*.9,height+r*.65,cz+r*1.4);if(frame){target.set(...frame.target);cam.position.set(...frame.position);}else if(!(cam instanceof THREE.OrthographicCamera))cam.position.sub(target).multiplyScalar(setback).add(target);
  if(cam instanceof THREE.PerspectiveCamera){cam.fov=saved?.fov??38;cam.aspect=aspect;cam.updateProjectionMatrix();}
  if(cam instanceof THREE.OrthographicCamera){const half=Math.max(w,d)*.55/Math.max(.5,setback*.85);cam.left=-half*aspect;cam.right=half*aspect;cam.top=half;cam.bottom=-half;cam.near=SCENE_LOOK.sky.cameraNear;cam.far=SCENE_LOOK.sky.cameraFar;cam.updateProjectionMatrix();}
  cam.lookAt(target);if(controls&&'target' in controls){(controls as any).target.copy(target);(controls as any).update();}invalidate();
 },[view,w,d,cx,cz,height,depth,setback,aspect,frame?.position[0],frame?.position[1],frame?.position[2],frame?.target[0],frame?.target[1],frame?.target[2],saved?.fov,camera,controls,invalidate,set,size.width,size.height]);return null;

}

function LandscapeCameraView({preset,saved,yard,pools,...props}:{preset?:'terrace'|'pool'|'wall';saved?:SavedSceneCamera;yard:YardModel;pools:ReturnType<typeof getPoolModels>}&Parameters<typeof CameraView>[0]){

 const aspect=useThree(s=>s.size.width/Math.max(1,s.size.height));

 const frame=useMemo(()=>preset?landscapeCamera(preset,{...yard,features:yard.features.filter(f=>!f.excluded)},pools,aspect):undefined,[preset,yard,pools,aspect]);

 return <CameraView {...props} sceneFrame={frame} saved={saved}/>;

}

function Scene({data,model,showMatureSpread=false,structure,cutaway,inspection,yard,onMovePrivacyScreen,boardPaint,pergolaInteraction,...interaction}:{data:DeckData;model:DeckTakeoff;showMatureSpread?:boolean;structure:boolean;cutaway:boolean;inspection:boolean;yard:YardModel;pergolaInteraction?:PergolaInteraction;onMovePrivacyScreen?:(id:string,offsetPct:number)=>void;boardPaint?:BoardPaint}&HouseInteraction){

  const material=DECKING_CATALOGUE.find(m=>m.id===data.deckingMaterial)||DECKING_CATALOGUE[0];

  const swatch=material.colors.find(c=>c.name===data.deckingColor)||material.colors[0];

  const board=useSwatchTexture(swatchUrl(swatch.swatch),getMaterialFallbackColor(material.id));

  const darkBorder=darkSlateBorder(data);

  const borderRef=borderFinishRef(data),borderColour=borderRef?parseColourRef(borderRef):null,stairBorder=darkBorder||!!borderColour;
  const borderMaterial=useSwatchTexture(darkBorder?swatchUrl('dk-border-dark-slate.jpg'):borderColour?swatchUrl(borderColour.color.swatch):'','#343635');

  const extras=useMemo(()=>extrasLayout(data,model),[data,model]);

  const evening=data.sceneLighting==='Evening',lightsOn=data.lightingPreviewOn!==false;

  // Every near-field fixture lights its surroundings at night, with no count limit: only the texture is re-uploaded.

  const fx=useContext(FixtureLightContext),invalidate=useThree(s=>s.invalidate);

  useLayoutEffect(()=>{if(!fx)return;fx.update(packFixtureLights(extras.fixtures,{evening,enabled:lightsOn}));invalidate();},[fx,extras.fixtures,evening,lightsOn,invalidate]);

  const catalogueExtras=useMemo(()=>catalogueAccessoryLayout(data,model),[data,model]);

  const stairBoards=useMemo(()=>{const primary=model.flights.find(f=>f.kind==='grade');return getStairBoards(data,model).map(b=>{if(!primary)return b;const dx=primary.end.x-primary.start.x,dz=primary.end.z-primary.start.z,length=Math.hypot(dx,dz);if(!length)return b;const x=b.x-primary.start.x,z=b.z-primary.start.z,along=(x*dx+z*dz)/length,cross=(x*dz-z*dx)/length;return along>=-.01&&along<=length+.01&&Math.abs(cross)<=primary.width/2+1&&b.y<=primary.start.y&&b.y>=primary.end.y?{...b,partId:'stairs:primary'}:b;});},[data,model]);

  const stairVeneer=useMemo(()=>stairVeneerLayout(data,model),[data,model]);

  // Framing lumber (posts, joists, beams, stringers): the pressure-treated swatch, box-projected along each piece.

  const framing=useSwatchTexture(swatchUrl('wood-pressure-treated.jpg'),'#8a7356');

  const shared=useMemo(()=>({inlay:new THREE.MeshStandardMaterial({color:'#514236',roughness:.7}),inlayFraming:new THREE.MeshStandardMaterial({color:'#c08a3e',roughness:.8}),metal:powderCoat(SCENE_LOOK.powderCoatColor),concrete:new THREE.MeshStandardMaterial({color:'#a5a49a',roughness:0.9}),glass:new THREE.MeshPhysicalMaterial({color:'#cbdfe3',roughness:0.08,metalness:0.1,transparent:true,opacity:0.23,depthWrite:false})}),[]);

  useEffect(()=>()=>Object.values(shared).forEach(m=>m.dispose()),[shared]);

  const materials=useMemo(()=>({...shared,wood:framing}),[shared,framing]);

  // Near-field fixtures (under-step, post and screen-post lights) light these (fixtureLighting.ts); glass stays as it is.

  useFixtureLit(materials.wood);useFixtureLit(materials.inlay);useFixtureLit(materials.inlayFraming);useFixtureLit(materials.metal);useFixtureLit(materials.concrete);

  // Accent boards (boardFinishes.ts): worked out only when the design has some, or while the tool is on.

  const painting=!!boardPaint&&!structure;

  // The top riser of each flight stands on the rim's face (stairCladding.ts), never inside the rim or in its plane.

  const drawnRisers=useMemo(()=>drawnRiserBoards(data,model),[data,model]);

  const finish=useMemo(()=>data.boardColours?.length||data.inlays?.length||data.deckFinishes?.border||hasBoardLayout(data)||painting?boardFinishPlan(data,model):null,[model,data,painting]);

  // Deck parts in their own colour (the border is drawn with the accent groups above); the railing in its colour's

  // screen approximation, illustrative only.

  const fasciaMat=usePartMaterial(partRef(data,'fascia')??`${material.id}:${swatch.name}`,board,.4),treadMat=usePartMaterial(partRef(data,'treads'),board),riserMat=usePartMaterial(partRef(data,'risers'),board);

  const rail=railingFinish(data),railHex=rail?railingScreenHex(rail.system.id,rail.colour):undefined;

  const railColour=useMemo(()=>railHex?powderCoat(railHex):null,[railHex]);

  useEffect(()=>()=>railColour?.dispose(),[railColour]);

  useFixtureLit(railColour);

  const boards:(FinishBox&{layoutColour?:boolean})[]=useMemo(()=>model.levels.flatMap((l,li)=>l.boards.map((b,bi)=>{const cut=b as typeof b&{width?:number;polygon?:{x:number;y:number}[];role?:string;layoutColour?:string};return {x:b.cx+l.offset.x,y:l.top-0.5,z:b.cy+l.offset.z,w:b.length,h:1,d:cut.width??data.boardWidth,angle:-b.angleDeg*Math.PI/180,role:cut.role,polygon:cut.polygon?.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z})),ref:l.kind==='deck'?{level:li,index:bi}:undefined,accent:finish?.colours[li]?.[bi]??null,...(cut.layoutColour?{layoutColour:true}:{})};})),[model,data.boardWidth,finish]);

  const hoverSet=useRef<(box:FinishBox|null)=>void>(()=>{}),registerHover=useCallback((set:(box:FinishBox|null)=>void)=>{hoverSet.current=set;},[]);

  const pick=useMemo<BoardPick|undefined>(()=>{

    if(!painting)return undefined;

    const paintable=(b:FinishBox)=>!!b.ref&&!!finish?.addresses[b.ref.level]?.[b.ref.index];

    return {onPick:b=>{if(paintable(b))boardPaint!.onPaint(b.ref!);},onHover:b=>hoverSet.current(b&&paintable(b)?b:null)};

  },[painting,boardPaint,finish]);

  const supportPosts:Box[]=model.foundationSupports.flatMap(f=>foundationSolids(f).boxes.filter(b=>b.part==='post'));

  const supportPostIds=model.foundationSupports.filter(f=>f.postHeightIn!==null&&f.postHeightIn>0).map(f=>`post:${f.levelIndex}:${f.supportIndex}`);

  const railPosts:Box[]=model.railing.posts.map(p=>({x:p.x,y:p.y+model.railing.height/2,z:p.z,w:3.5,h:model.railing.height,d:3.5}));

  const edgeMembers:Member[]=model.levels.flatMap(l=>l.rim??[]);

  const finishedFascia=useMemo(()=>fasciaSlabs(model),[model]);

  const accessoryFascia=useMemo(()=>accessoryFasciaSlabs(catalogueExtras.fascia),[catalogueExtras.fascia]);

  const railMat=railColour??(data.railingType==='Wood Picket'?board:materials.metal);

  const mainBoards=boards.filter(b=>!b.layoutColour&&b.role!=='inlay'&&!b.accent&&(!darkBorder||b.role!=='border'));

  const ownLayoutBoards=boards.filter(b=>b.layoutColour&&!b.accent);

  return <><group scale={1/12}><group visible={isObjectVisible(data.editorOrganization,'deck')}>

    {!structure&&<><FinishedBoards items={[...mainBoards,...ownLayoutBoards]} material={board} pick={pick}/><FinishedBoards items={boards.filter(b=>b.role==='inlay'&&!b.layoutColour)} material={materials.inlay}/>{darkBorder&&<FinishedBoards items={boards.filter(b=>b.role==='border'&&!b.layoutColour)} material={borderMaterial}/>}{finish?.groups.map(g=><AccentBoards key={g.ref} colour={g.ref} items={boards.filter(b=>b.accent===g.ref)} pick={pick}/>)}{painting&&<HoverOutline boards={boards} addresses={finish?.addresses} scope={boardPaint!.scope} register={registerHover}/>}</>}

    <Members items={model.levels.flatMap(l=>l.joists)} material={materials.wood} name="joists"/>

    <Members items={model.levels.flatMap(l=>l.blocking.filter(b=>!b.role?.startsWith('inlay-')))} material={materials.wood} name="blocking"/>

    {/* Framing under decorative inlays (inlayFraming.ts), in its own colour so it reads in the Framing view. */}

    <Members items={model.levels.flatMap(l=>l.blocking.filter(b=>b.role?.startsWith('inlay-')))} material={materials.inlayFraming} name="inlay-blocking"/>

    <Members items={model.levels.flatMap(l=>l.beams)} partIds={model.levels.flatMap((l,li)=>l.beams.map((_,bi)=>`beam:${li}:${bi}`))} material={materials.wood} name="beams"/>

    {structure?<Members items={edgeMembers} material={materials.wood} name="rim-and-fascia"/>:<Slabs slabs={finishedFascia} material={fasciaMat} courses={false} eased name="rim-and-fascia"/>}

    {!structure&&<Slabs slabs={accessoryFascia} material={fasciaMat} courses={false} eased name="selected-manufacturer-fascia"/>}

    {inspection&&<><Boxes items={catalogueExtras.tape} material={materials.metal} name="selected-joist-tape"/><Boxes items={catalogueExtras.flashing} material={materials.metal} name="selected-ledger-flashing"/></>}

    <Boxes items={supportPosts} partIds={supportPostIds} material={materials.wood} name="support-posts"/>

    {/* Skirting (skirting.ts): its face in the finished views; the framing and below-ground views show its backing. */}

    {data.skirting&&<Skirting3D data={data} model={model} finished={!structure&&!cutaway} wood={materials.wood}/>}

    <HardwareDetails data={data} model={model} inspection={inspection}/><FootingDetails data={data} model={model} cutaway={cutaway}/>

    <FinishedBoards items={stairBoards.filter(b=>!stairBorder||b.role!=='border')} material={treadMat}/>{stairBorder&&<FinishedBoards items={stairBoards.filter(b=>b.role==='border')} material={borderMaterial}/>}

    {!structure&&<group name="closed-stair-riser-boards"><FinishedBoards items={drawnRisers} material={riserMat}/></group>}

    {!structure&&<Cladding3D data={data} model={model} material={fasciaMat} finished={!cutaway}/>}

    <NotchedStringers model={model} material={materials.wood}/>

    <Boxes items={stairVeneer.woodBoxes} material={materials.wood} name="terrain-stair-veneer-support-blocks"/>

    {inspection&&<Boxes items={stairVeneer.bracketBoxes} material={materials.metal} name="terrain-stair-veneer-support-angles"/>}

    {data.railingType==='Wood Picket'?<><Boxes items={railPosts} material={railMat} name="railing-posts"/><Members items={model.railing.rails} material={railMat} name="railing-runs"/><Members items={model.railing.balusters} material={railMat} name="railing-infill"/></>:<EasedRails posts={railPosts} rails={model.railing.rails} balusters={data.railingType==='Cable'?[]:model.railing.balusters} material={railMat}/>}

    <RailingDetails data={data} model={model}/>

    {model.railing.frameless&&<FramelessGlass3D layout={model.railing.frameless}/>}

    <Boxes items={extras.wood} partIds={extras.wood.map(b=>(b as Box&{screenId?:string}).screenId?`screen:${(b as Box&{screenId:string}).screenId}`:undefined)} material={board} name="benches-privacy-pergola"/>

    <Pergola3D data={data} layout={extras.pergola??null} interaction={pergolaInteraction}/>

    <Boxes items={extras.metal} partIds={extras.metal.map(b=>(b as Box&{screenId?:string}).screenId?`screen:${(b as Box&{screenId:string}).screenId}`:undefined)} material={materials.metal} name="accessory-frames"/>

    <Boxes items={extras.drainage} material={materials.metal} name="under-deck-drainage"/>

    <PrivacyScreens3D panels={extras.panels} handles={extras.screenHandles} onMove={onMovePrivacyScreen}/>

    <LightingFixtures items={extras.fixtures} evening={evening} enabled={lightsOn}/>

    </group>{data.pools?.some(p=>p.enabled)&&<Suspense fallback={null}><Pool3D pools={getPoolModels(data,model).filter(p=>isObjectVisible(data.editorOrganization,p.config.id))} inspection={inspection||cutaway}/></Suspense>}<Yard3D model={{...yard,features:yard.features.filter(f=>isObjectVisible(data.editorOrganization,f.config.id)),boxes:yard.boxes.filter(b=>isObjectVisible(data.editorOrganization,b.featureId)),members:yard.members.filter(m=>isObjectVisible(data.editorOrganization,m.featureId))}} inspection={inspection||cutaway} plantingBeds={(data.landscapeObjects??[]).filter(o=>o.enabled&&o.kind==='bed'&&isObjectVisible(data.editorOrganization,o.id)).map(o=>landscapeFootprint(o).map(v=>({x:v.x,y:v.z})))}/>{yard.features.some(f=>f.config.kind==='fire-feature')&&<Suspense fallback={null}><Fire3D yard={yard} data={data} inspection={inspection||cutaway}/></Suspense>}

    <Environment3D data={{...data,houseVisible:data.houseVisible!==false&&isObjectVisible(data.editorOrganization,'house')}} footprint={model.levels[0].footprint} topY={data.height} planKey={JSON.stringify(model.quantities)} cutaway={cutaway} finished={!inspection} yard={yard} {...interaction}/>

  </group><Suspense fallback={null}><Landscape3D data={{...data,landscapeObjects:data.landscapeObjects?.filter(o=>isObjectVisible(data.editorOrganization,o.id))}} showMatureSpread={showMatureSpread}/></Suspense><FixtureGlows items={extras.fixtures} evening={evening} enabled={lightsOn}/></>;

}

/** Hands the page a function that renders the current view and returns it as an image (for the

 * printable proposal). Rendering right before reading keeps the drawing buffer valid without

 * preserveDrawingBuffer on every frame. The outline of a wall picked in the exterior studio is left out.

 * Asked for a longer edge than the canvas has (the proposal's print pictures, R8), it draws that one picture at a

 * higher pixel ratio (at most 3 times), then puts the ratio back and redraws the view on screen. */

export type DeckSnapshotCapture=((longEdgePx?:number)=>string|null)&{ready?:()=>Promise<boolean>};

function SnapshotBridge({onReady}:{onReady?:(capture:DeckSnapshotCapture|null)=>void}){

  const gl=useThree(s=>s.gl),scene=useThree(s=>s.scene),camera=useThree(s=>s.camera),invalidate=useThree(s=>s.invalidate);

  useEffect(()=>{

    if(!onReady)return;

    let active=true;

    const capture:DeckSnapshotCapture=(longEdgePx?:number)=>{

      const picked:THREE.Object3D[]=[];scene.traverse(o=>{if((o.name==='picked-wall-outline'||o.name==='selection-outline'||o.name==='picked-pergola-outline')&&o.visible){o.visible=false;picked.push(o);}});

      const ratio=gl.getPixelRatio(),edge=Math.max(gl.domElement.width,gl.domElement.height),scale=longEdgePx&&edge&&longEdgePx>edge?Math.min(3,longEdgePx/edge):1;

      try{if(scale>1)gl.setPixelRatio(ratio*scale);const pipeline=pipelineFor(gl);if(pipeline)pipeline.capture(scale);else gl.render(scene,camera);return gl.domElement.toDataURL('image/jpeg',.9);}catch{return null;}

      finally{for(const o of picked)o.visible=true;if(scale>1){gl.setPixelRatio(ratio);invalidate();}}

    };

    capture.ready=async()=>{

      if(!active||gl.getContext().isContextLost())return false;

      const applied=await waitForSwatchTextures(gl);

      return active&&applied&&!gl.getContext().isContextLost();

    };

    onReady(capture);

    return ()=>{active=false;onReady(null);};

  },[gl,scene,camera,invalidate,onReady]);

  return null;

}

export default function Deck3DViewer({data:rawData,model,yardModel:calculatedYard,deckOnly=false,structure=false,cutaway=false,view="3d",onContextLost,onMovePrivacyScreen,onSnapshotReady,boardPaint,onUpdate,selection,selectionEnabled=false,onObjectPick,editInteraction,...interaction}:{onUpdate?:Update;data:DeckData;model:DeckTakeoff;selection?:SelectionState;selectionEnabled?:boolean;editInteraction?:SceneEditInteraction;onObjectPick?:(pick:ObjectPick,toggle:boolean)=>void;yardModel?:YardModel;deckOnly?:boolean;structure?:boolean;cutaway?:boolean;view?:string;onContextLost?:()=>void;onMovePrivacyScreen?:(id:string,offsetPct:number)=>void;onSnapshotReady?:(capture:DeckSnapshotCapture|null)=>void;boardPaint?:BoardPaint}&HouseInteraction){

  const [selected,setSelected]=useState(false),[pergolaMode,setPergolaMode]=useState<'move'|'rotate'>('move'),[draft,setDraft]=useState<Partial<PergolaSelection>|null>(null);

  const placedData=draft&&rawData.pergola?{...rawData,pergola:{...rawData.pergola,...draft}}:rawData;

  const data=useMemo<DeckData>(()=>{if(!deckOnly)return placedData;const {yardFeatures:_yard,terrainConfig:_terrain,siteModel:_site,landscapeObjects:_landscape,pools:_pools,...deck}=placedData;return deck;},[placedData,deckOnly]);

  const yard=useMemo(()=>!deckOnly&&calculatedYard?calculatedYard:buildYardModel(data,model),[deckOnly,calculatedYard,model,data.yardFeatures,data.pools,data.terrainConfig,data.siteModel,data.width,data.length,data.houseConfig?.widthFt,data.houseConfig?.depthFt,data.houseConfig?.footprint,data.housePlacement,data.houseVisible,data.deckType]);

  const pergola=useMemo(()=>pergolaLayout(rawData,model,[],false),[rawData,model]);

  const bounds=sceneBounds(model),house=houseLayout(data,model.levels[0].footprint.bounds.w);

  const overviewPoints:{x:number;y:number;z:number}[]=[],addEnvelope=(x0:number,x1:number,z0:number,z1:number,top:number)=>{for(const x of [x0,x1])for(const z of [z0,z1])for(const y of [-12,top])overviewPoints.push({x:x/12,y:y/12,z:z/12});};

  addEnvelope(bounds.minX,bounds.maxX,bounds.minZ,bounds.maxZ,bounds.top+48);

  if(pergola){for(const p of pergola.footprint){for(const y of [0,pergola.roofHigh])overviewPoints.push({x:p.x/12,y:y/12,z:p.y/12});bounds.minX=Math.min(bounds.minX,p.x);bounds.maxX=Math.max(bounds.maxX,p.x);bounds.minZ=Math.min(bounds.minZ,p.y);bounds.maxZ=Math.max(bounds.maxZ,p.y);}bounds.top=Math.max(bounds.top,pergola.roofHigh);}

  if(view==='overview'&&house.visible){addEnvelope(house.minX-14,house.maxX+14,-house.depth-14,0,house.wallHeight+house.roofRise);bounds.minX=Math.min(bounds.minX,house.minX-14);bounds.maxX=Math.max(bounds.maxX,house.maxX+14);bounds.minZ=Math.min(bounds.minZ,-house.depth-14);bounds.top=Math.max(bounds.top,house.wallHeight+house.roofRise);for(const {rect:b,wallHeightIn} of getHouseBlocks(data).slice(1)){addEnvelope(b.x0-14,b.x1+14,b.y0-14,b.y1+14,wallHeightIn+house.roofRise);bounds.minX=Math.min(bounds.minX,b.x0-14);bounds.maxX=Math.max(bounds.maxX,b.x1+14);bounds.minZ=Math.min(bounds.minZ,b.y0-14);bounds.top=Math.max(bounds.top,wallHeightIn+house.roofRise);}}

  if(view==='overview'||view==='3d')for(const feature of yard.features.filter(f=>!f.excluded)){const top=Math.max(feature.topIn,...feature.boxes.map(b=>b.y+b.h/2));for(const p of feature.footprints.flat()){for(const y of [-12,top])overviewPoints.push({x:p.x/12,y:y/12,z:p.y/12});bounds.minX=Math.min(bounds.minX,p.x);bounds.maxX=Math.max(bounds.maxX,p.x);bounds.minZ=Math.min(bounds.minZ,p.y);bounds.maxZ=Math.max(bounds.maxZ,p.y);}for(const b of feature.boxes)bounds.top=Math.max(bounds.top,b.y+b.h/2);}

  if(view==='overview'||view==='3d')for(const point of exposedWallEnvelope(yard.features.filter(f=>!f.excluded).flatMap(f=>f.boxes),yard.terrain)){overviewPoints.push(point);bounds.minX=Math.min(bounds.minX,point.x*12);bounds.maxX=Math.max(bounds.maxX,point.x*12);bounds.minZ=Math.min(bounds.minZ,point.z*12);bounds.maxZ=Math.max(bounds.maxZ,point.z*12);bounds.top=Math.max(bounds.top,point.y*12);}

  if(view==='overview'||view==='3d'||view==='top')for(const o of data.landscapeObjects??[]){if(!o.enabled||!isObjectVisible(data.editorOrganization,o.id))continue;const placement=landscapePlacement(data,o),p=landscapeFootprint(o),xs=p.map(v=>v.x),zs=p.map(v=>v.z),top=placement.y*12+o.heightIn;addEnvelope(Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs),top);bounds.minX=Math.min(bounds.minX,...xs);bounds.maxX=Math.max(bounds.maxX,...xs);bounds.minZ=Math.min(bounds.minZ,...zs);bounds.maxZ=Math.max(bounds.maxZ,...zs);bounds.top=Math.max(bounds.top,top);}

  if(view==='overview'||view==='3d'||view==='top')for(const p of getPoolModels(data,model).filter(p=>isObjectVisible(data.editorOrganization,p.config.id))){const v=p.permanentExclusionFootprints.flat(),xs=v.map(q=>q.x),zs=v.map(q=>q.y);if(!v.length)continue;addEnvelope(Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs),p.copingTopElevationIn);bounds.minX=Math.min(bounds.minX,...xs);bounds.maxX=Math.max(bounds.maxX,...xs);bounds.minZ=Math.min(bounds.minZ,...zs);bounds.maxZ=Math.max(bounds.maxZ,...zs);bounds.top=Math.max(bounds.top,p.copingTopElevationIn);}

  const w=(bounds.maxX-bounds.minX)/12,d=(bounds.maxZ-bounds.minZ)/12,cx=(bounds.maxX+bounds.minX)/24,cz=(bounds.maxZ+bounds.minZ)/24,r=Math.max(w,d),height=bounds.top/12,evening=data.sceneLighting==='Evening';

  // Only long-throw fixtures take real preview lights; the rest all light through the fixture light patch.

  const lights=activeLightingItems(data).reduce((n,item)=>n+(castsPreviewLight(item.productId,item.zone)?item.qty:0),0);

  const fixtureLight=useMemo(()=>createFixtureLighting(),[]);

  useEffect(()=>()=>fixtureLight.dispose(),[fixtureLight]);

  const presentation=data.scenePresentation,inspection=structure||view==='hardware'||presentation?.viewMode==='inspection',preset=presentation?.cameraPreset;

  const savedCamera=presentation?.cameras?.find(c=>c.id===presentation.activeCameraId),cameraPools=getPoolModels(data,model).filter(p=>isObjectVisible(data.editorOrganization,p.config.id));

  const terrainWarnings=yard.warnings.filter(w=>/grading|transition|survey.*cover|terrain.*intersect/i.test(w));

  const simplifiedPaving=!structure&&!cutaway&&view!=='hardware'&&hasSimplifiedPaving(yard);

  return <>{onUpdate&&!structure&&!cutaway&&<ScenePresentationTools data={data} update={onUpdate}/>} {!editInteraction&&onUpdate&&!structure&&!cutaway&&!boardPaint&&<PergolaTools data={data} selected={selected} setSelected={setSelected} mode={pergolaMode} setMode={setPergolaMode} update={onUpdate}/>}<div className="w-full aspect-square md:aspect-video relative overflow-hidden" role="region" aria-label="Interactive deck construction model">

    {data.siteModel&&<p className="absolute top-3 right-3 z-10 rounded bg-white/90 p-2 text-xs">Ground outside surveyed triangles is illustrative.</p>}<Canvas shadows="percentage" frameloop="demand" dpr={[1,1.5]} camera={{fov:38,near:SCENE_LOOK.sky.cameraNear,far:SCENE_LOOK.sky.cameraFar}} gl={{antialias:false,toneMapping:THREE.NeutralToneMapping,toneMappingExposure:SCENE_LOOK.exposure}} onCreated={({gl})=>{const canvas=gl.domElement;canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();

        // Leaving 3D (e.g. for the Plan view) disposes the renderer and also fires this event;

        // only a canvas still on the page has really lost its GPU context.

        setTimeout(()=>{if(canvas.isConnected)onContextLost?.();},0);},false);}}>

      <color attach="background" args={[evening?'#28374a':'#e9edf0']}/>

      {/* The real sky (Real Life G3); the studio light stands in while it loads. */}

      <Suspense fallback={<StudioLight evening={evening}/>}><Sky3D evening={evening}/></Suspense>

      <fogExp2 attach="fog" args={['#8a8b80',SCENE_LOOK.sky.fogDensity]}/>

      <LandscapeCameraView preset={preset} saved={savedCamera} yard={yard} pools={cameraPools} view={view} w={w} d={d} cx={cx} cz={cz} height={height} depth={data.foundationDepthIn??48} points={overviewPoints}/>

      <FixtureLightContext.Provider value={fixtureLight}><Scene data={data} model={model} showMatureSpread={view==='top'} structure={structure} cutaway={cutaway} inspection={inspection} yard={yard} onMovePrivacyScreen={onMovePrivacyScreen} boardPaint={boardPaint} pergolaInteraction={!editInteraction&&onUpdate&&rawData.pergola&&!boardPaint&&!structure&&!cutaway?{selected,mode:pergolaMode,onSelect:()=>setSelected(true),onDraft:setDraft,onCommit:patch=>onUpdate({pergola:{...rawData.pergola!,...patch}})}:undefined} {...interaction}/></FixtureLightContext.Provider>

      {editInteraction&&selection&&<Suspense fallback={null}><SceneEditHandles data={rawData} model={model} selection={selection} interaction={editInteraction}/></Suspense>}<SavedCameraBridge data={data} update={onUpdate}/><SelectionBridge enabled={!boardPaint} hardscapeOnly={!selectionEnabled} revision={calculatedYard??model} selection={selection??{partIds:[],boards:[]}} onPick={onObjectPick}/><SnapshotBridge onReady={onSnapshotReady}/><SceneStillExport revision={rawData}/>
      <ShowcaseModeSync/><RenderQuality/><RenderPipeline evening={evening}/>

      <OrbitControls makeDefault target={savedCamera||preset||view==='overview'?undefined:[cx,cutaway?-(data.foundationDepthIn??48)/24:height*.4,cz]} maxPolarAngle={cutaway?Math.PI*.7:Math.PI/2-.04} minDistance={savedCamera||preset?1:r*.25} maxDistance={view==='overview'?Math.max(r*8,height*4):r*4} enableDamping={false}/>

    </Canvas>{simplifiedPaving&&<p className="absolute top-3 left-3 right-3 w-fit rounded-md bg-white/95 px-3 py-2 text-xs text-[#38413b] shadow-sm pointer-events-none">Simplified paving preview · {yard.quantities.paverPieces.toLocaleString()} pavers retained in quantities, construction view and exports.</p>}<p className={`absolute bottom-3 left-4 right-4 text-[10px] pointer-events-none ${evening?'text-white':'text-[#474c43]'}`}>Drag to orbit · pinch or scroll to zoom{evening&&data.lightingPreviewOn!==false&&lights>MAX_PREVIEW_LIGHTS?` · ${lights} fixtures shown; light spread preview limited to ${MAX_PREVIEW_LIGHTS} fixtures`:''}</p>

  </div>{terrainWarnings.length>0&&<details open className="text-xs py-2" aria-label="Terrain conflicts"><summary>Terrain needs attention · {terrainWarnings.length}</summary><ul>{terrainWarnings.map(w=><li key={w}>{w}</li>)}</ul></details>}</>;

}
