import {landscapeSurfaceCells,landscapeCellTriangles} from '../../landscapeSurfaceGeometry';
import {landscapeSurfaceDepth,puttingCupWorld} from '../../landscapeSurfaces';
import {createLandscapeSurfaceMaterial} from './landscapeSurfaceMaterial';
import {getPoolModels} from '../../poolModel';
import {Suspense,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {useGLTF,useTexture} from '@react-three/drei';
import * as THREE from 'three';
import type {DeckData} from '../../types';
import type {LandscapeObject,LandscapePoint} from '../../landscapeTypes';
import {landscapeAsset} from '../../landscapeCatalogue';
import {activePuttingCups,landscapeBedAreas,landscapePlacement,landscapeRenderLods} from '../../landscapeModelRuntime';
import {createSiteSurface,siteClip,siteSolidCells,sitePlaneHeight} from '../../siteSurfaceEngine';
import {getTerrainConfig} from '../../yardSettings';
import {useRenderQuality} from './SceneRenderQuality';
import {useFixtureLit} from './fixtureLighting';

/** World-foot transforms from planned inch envelopes, independently of the
 * downloaded glTF's source metres, source origin or quantisation matrices. */
export function landscapeInstanceMatrix(data:DeckData,o:LandscapeObject,normalization:THREE.Matrix4,source:THREE.Matrix4){
 const p=landscapePlacement(data,o),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-o.rotationDeg*Math.PI/180);
 if(p.normal)q.premultiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(p.normal.x,p.normal.y,p.normal.z)));
 return new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),q,new THREE.Vector3(o.widthIn/12,o.heightIn/12,o.depthIn/12)).multiply(normalization).multiply(source);
}
function InstancePart({data,items,source,normalization,lod}:{data:DeckData;items:LandscapeObject[];source:THREE.Mesh;normalization:THREE.Matrix4;lod:number}){
 const q=useRenderQuality(),invalidate=useThree(s=>s.invalidate),original=Array.isArray(source.material)?source.material[0]:source.material;
 const material=useMemo(()=>original.clone(),[original]);useFixtureLit(material);
 const instance=useMemo(()=>new THREE.InstancedMesh(source.geometry,material,Math.max(1,items.length)),[source.geometry,material,items.length]);
 useEffect(()=>()=>{instance.dispose();},[instance]);useEffect(()=>()=>material.dispose(),[material]);
 useLayoutEffect(()=>{
  items.forEach((o,i)=>instance.setMatrixAt(i,landscapeInstanceMatrix(data,o,normalization,source.matrixWorld)));instance.count=items.length;instance.instanceMatrix.needsUpdate=true;instance.computeBoundingBox();instance.computeBoundingSphere();
  instance.name='landscape-'+items[0]?.assetId+'-lod'+lod;instance.userData={landscapeIds:items.map(o=>o.id),pickPartIds:items.map(o=>'landscape/'+o.id),genericVisualProxy:true,unmeasuredElevationIds:items.filter(o=>!landscapePlacement(data,o).measured).map(o=>o.id)};
  instance.castShadow=q.tier!=='constrained'&&lod<2;instance.receiveShadow=true;
  const standard=material as THREE.MeshStandardMaterial;for(const t of [standard.map,standard.normalMap,standard.roughnessMap,standard.metalnessMap])if(t){t.anisotropy=q.anisotropy;t.needsUpdate=true;}invalidate();
 },[data,items,instance,source,normalization,lod,q,material,invalidate]);
 return <primitive object={instance} dispose={null}/>;
}
function AssetInstances({data,items,lod}:{data:DeckData;items:LandscapeObject[];lod:0|1|2}){
 const a=landscapeAsset(items[0].assetId),url=lod===0?a.modelURL!:lod===1?a.lowModelURL!:a.farModelURL!,gltf=useGLTF(url);
 const source=useMemo(()=>{gltf.scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());const normalization=new THREE.Matrix4().makeScale(1/Math.max(.0001,size.x),1/Math.max(.0001,size.y),1/Math.max(.0001,size.z)).multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z)),meshes:THREE.Mesh[]=[];gltf.scene.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});return {normalization,meshes};},[gltf.scene]);
 return <group name={'landscape-asset-'+a.id} userData={{sourceURL:a.sourceURL,genericVisualProxy:true}}>{source.meshes.map((m,i)=><InstancePart key={i} data={data} items={items} source={m} normalization={source.normalization} lod={lod}/>)}</group>;
}
/** Clip each bed into the proposed TIN faces. This follows exact measured
 * elevation and grading breaks, including holes left by overlapping beds. */
export function landscapeBedGeometry(data:DeckData,polys:LandscapePoint[][],depthIn:number){
 const {positions,uv}=landscapeCellTriangles(landscapeSurfaceCells(data,polys),depthIn);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
function Bed({data,object,polys,material}:{data:DeckData;object:LandscapeObject;polys:LandscapePoint[][];material:THREE.Material}){
 const geometry=useMemo(()=>landscapeBedGeometry(data,polys,landscapeSurfaceDepth(object)),[data,polys,object]);useEffect(()=>()=>geometry.dispose(),[geometry]);
 const edges=useMemo(()=>polys.map(p=>{const points=[...p,p[0]].map(v=>{const pos=landscapePlacement(data,{...object,xIn:v.x,zIn:v.z});return new THREE.Vector3(v.x/12,pos.y+((landscapeSurfaceDepth(object))+.1)/12,v.z/12);});return new THREE.BufferGeometry().setFromPoints(points);}),[data,polys,object]);useEffect(()=>()=>edges.forEach(g=>g.dispose()),[edges]);
 return <group name={'landscape-bed-'+object.id} userData={{landscapeIds:[object.id]}}><mesh geometry={geometry} material={material} receiveShadow dispose={null} userData={{pickPartId:'landscape/'+object.id,landscapeIds:[object.id]}}/>{activePuttingCups(object,polys).map((cup,i)=>{const p=puttingCupWorld(object,cup),h=landscapePlacement(data,{...object,xIn:p.x,zIn:p.z}).y+(landscapeSurfaceDepth(object)+.09)/12;return <group key={i} position={[p.x/12,h,p.z/12]} userData={{pickPartId:'landscape/'+object.id,landscapeIds:[object.id]}}><mesh rotation={[-Math.PI/2,0,0]}><circleGeometry args={[2.125/12,32]}/><meshStandardMaterial color="#242b22" roughness={.9}/></mesh><mesh position={[0,1.4,0]}><cylinderGeometry args={[.018,.018,2.8,8]}/><meshStandardMaterial color="#eee9dc"/></mesh><mesh position={[.2,2.65,0]}><planeGeometry args={[.4,.25]}/><meshStandardMaterial color="#c7ab58" side={THREE.DoubleSide}/></mesh></group>;})}{object.edging&&edges.map((g,i)=><lineLoop key={i} geometry={g}><lineBasicMaterial color="#675443"/></lineLoop>)}</group>;
}
function MulchBeds({data,objects}:{data:DeckData;objects:LandscapeObject[]}){
 const q=useRenderQuality(),textures=useTexture(['/deckcraft/landscape/mulch-diffuse.jpg','/deckcraft/landscape/mulch-normal.jpg','/deckcraft/landscape/mulch-roughness.jpg']),areas=useMemo(()=>landscapeBedAreas(objects,data),[objects,data]);
 const material=useMemo(()=>{const [map,normalMap,roughnessMap]=textures;map.colorSpace=THREE.SRGBColorSpace;for(const t of textures){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=q.anisotropy;t.needsUpdate=true;}return new THREE.MeshStandardMaterial({map,normalMap,normalScale:new THREE.Vector2(.45,.45),roughnessMap,roughness:.95});},[textures,q.anisotropy]);useFixtureLit(material);useEffect(()=>()=>material.dispose(),[material]);
 return <>{objects.filter(o=>o.enabled&&o.kind==='bed'&&o.assetId==='mulch-bed').map(o=><Bed key={o.id} data={data} object={o} polys={areas.get(o.id)??[]} material={material}/>)}</>;
}
function SurfaceBed({data,object,polys}:{data:DeckData;object:LandscapeObject;polys:LandscapePoint[][]}){
 const q=useRenderQuality(),resource=useMemo(()=>createLandscapeSurfaceMaterial(object.assetId,q.anisotropy),[object.assetId,q.anisotropy]);useFixtureLit(resource.material);useEffect(()=>()=>resource.dispose(),[resource]);
 return <Bed data={data} object={object} polys={polys} material={resource.material}/>;
}
function Beds({data,objects}:{data:DeckData;objects:LandscapeObject[]}){
 const areas=useMemo(()=>landscapeBedAreas(objects,data),[objects,data]),legacy=objects.filter(o=>o.enabled&&o.kind==='bed'&&o.assetId==='mulch-bed'),newBeds=objects.filter(o=>o.enabled&&o.kind==='bed'&&o.assetId!=='mulch-bed');
 return <>{legacy.length>0&&<Suspense fallback={null}><MulchBeds data={data} objects={objects}/></Suspense>}{newBeds.map(o=><SurfaceBed key={o.id} data={data} object={o} polys={areas.get(o.id)??[]}/>)}</>;
}
function MatureSpread({data,objects}:{data:DeckData;objects:LandscapeObject[]}){
 const geometry=useMemo(()=>{const points:number[]=[];for(const o of objects.filter(o=>o.enabled&&o.kind==='plant'&&o.speciesRecord)){const r=o.speciesRecord!.matureSpreadIn[1]/2;for(let i=0;i<64;i++){for(const n of [i,i+1]){const a=n/64*Math.PI*2,xIn=o.xIn+Math.cos(a)*r,zIn=o.zIn+Math.sin(a)*r,p=landscapePlacement(data,{...o,xIn,zIn});points.push(p.x,p.y+.035,p.z);}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));return g;},[data,objects]);useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <lineSegments name="landscape-mature-overlay" geometry={geometry} renderOrder={5}><lineBasicMaterial color="#dfa72b" depthTest={false} transparent opacity={.8}/></lineSegments>;
}
/** Mount at the scene's world origin, OUTSIDE an inch-scaled deck group. Assets
 * load only when selected. Instanced batches share geometry and local textures. */
export default function Landscape3D({data,showMatureSpread=false}:{data:DeckData;showMatureSpread?:boolean}){
 const objects=data.landscapeObjects??[],q=useRenderQuality(),camera=useThree(s=>s.camera),size=useThree(s=>s.size),[lods,setLods]=useState(new Map<string,0|1|2>()),last=useRef(''),[mature,setMature]=useState(showMatureSpread);
 useEffect(()=>{const listener=(e:Event)=>setMature(!!(e as CustomEvent<{show:boolean}>).detail?.show);window.addEventListener('deckcraft:landscape-mature-spread',listener);window.dispatchEvent(new CustomEvent('deckcraft:landscape-mature-request'));return()=>window.removeEventListener('deckcraft:landscape-mature-spread',listener);},[]);
 useFrame(()=>{const next=landscapeRenderLods(objects,camera.position,size.height,q.tier),key=[...next].map(([id,lod])=>id+':'+lod).join('|');if(last.current!==key){last.current=key;setLods(next);}});
 const groups=new Map<string,{items:LandscapeObject[];lod:0|1|2}>();for(const o of objects.filter(o=>o.enabled&&o.kind!=='bed'&&!landscapePlacement(data,o).pendingReason)){const lod=lods.get(o.id)??2,key=o.assetId+':'+lod,g=groups.get(key)??{items:[],lod};g.items.push(o);groups.set(key,g);}
 return <group name="landscape-designed-objects" userData={{designedObjectCount:objects.filter(o=>o.enabled).length,renderTier:q.tier,genericVisualProxies:true}}>{[...groups].map(([key,g])=><Suspense key={key} fallback={null}><AssetInstances data={data} items={g.items} lod={g.lod}/></Suspense>)}{objects.some(o=>o.enabled&&o.kind==='bed')&&<Suspense fallback={null}><Beds data={data} objects={objects}/></Suspense>}{(showMatureSpread||mature)&&<MatureSpread data={data} objects={objects}/>}</group>;
}
