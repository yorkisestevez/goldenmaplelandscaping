import {landscapeSurfaceCells,landscapeCellTriangles,raisedBedTop} from '../../landscapeSurfaceGeometry';
import {landscapeSurfaceDepth,puttingCupWorld} from '../../landscapeSurfaces';
import {createLandscapeSurfaceMaterial} from './landscapeSurfaceMaterial';
import {getPoolModels} from '../../poolModel';
import {lazy,Suspense,useEffect,useLayoutEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {useGLTF,useTexture} from '@react-three/drei';
import * as THREE from 'three';
import type {DeckData} from '../../types';
import type {LandscapeObject,LandscapePoint} from '../../landscapeTypes';
import {landscapeAsset,plantFoliageTint} from '../../landscapeCatalogue';
import {applyFoliageLighting,tintPlantInstance} from './foliageLighting';
import PlantBlooms from './plantBlooms';
import {activePuttingCups,landscapeBedAreas,landscapePlacement,landscapeRenderLods} from '../../landscapeModelRuntime';
import {createSiteSurface,siteClip,siteSolidCells,sitePlaneHeight} from '../../siteSurfaceEngine';
import {getTerrainConfig} from '../../yardSettings';
import {useRenderQuality} from './SceneRenderQuality';
import {getShowcaseFlags,subscribeShowcase} from './showcaseMode';
import {useFixtureLit} from './fixtureLighting';
import {meshYawRad} from '../../furnitureFacing';

const SurfaceDetail=lazy(()=>import('./SurfaceDetail'));
/** A raised bed's soil face, timber or steel edging (where no linked wall holds it): loaded with the first raised bed. */
const RaisedBedFaces3D=lazy(()=>import('./RaisedBedFaces3D'));

/** World-foot transforms from planned inch envelopes, independently of the
 * downloaded glTF's source metres, source origin or quantisation matrices. */
export function landscapeInstanceMatrix(data:DeckData,o:LandscapeObject,normalization:THREE.Matrix4,source:THREE.Matrix4){
 const p=landscapePlacement(data,o),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-o.rotationDeg*Math.PI/180);
 const meshYaw=meshYawRad(o.assetId);if(meshYaw)q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),meshYaw));
 if(p.normal)q.premultiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(p.normal.x,p.normal.y,p.normal.z)));
 return new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),q,new THREE.Vector3(o.widthIn/12,o.heightIn/12,o.depthIn/12)).multiply(normalization).multiply(source);
}
/** Steel landscape edging: 4 in tall, 1/8 in thick, following the bed outline in feet. */
export function steelEdgingGeometry(points:THREE.Vector3[]){
 const half=0.125/24,rise=4/12,positions:number[]=[];
 const add=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3)=>positions.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
 for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<1e-6)continue;
  const nx=-dz/len*half,nz=dx/len*half,at=(p:THREE.Vector3,s:number,y:number)=>new THREE.Vector3(p.x+nx*s,p.y+y,p.z+nz*s);
  const a0=at(a,1,0),a1=at(a,-1,0),b0=at(b,1,0),b1=at(b,-1,0),a2=at(a,1,rise),a3=at(a,-1,rise),b2=at(b,1,rise),b3=at(b,-1,rise);
  add(a0,b0,b2);add(a0,b2,a2);add(b1,a1,a3);add(b1,a3,b3);add(a2,b2,b3);add(a2,b3,a3);add(a1,b1,b0);add(a1,b0,a0);add(a1,a0,a2);add(a1,a2,a3);add(b0,b1,b3);add(b0,b3,b2);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();return geometry;
}
function InstancePart({data,items,source,normalization,lod}:{data:DeckData;items:LandscapeObject[];source:THREE.Mesh;normalization:THREE.Matrix4;lod:number}){
 const q=useRenderQuality(),invalidate=useThree(s=>s.invalidate),original=Array.isArray(source.material)?source.material[0]:source.material;
 const foliage=items[0]?.kind==='plant';
 const material=useMemo(()=>{const m=original.clone();if(foliage)applyFoliageLighting(m);return m;},[original,foliage]);useFixtureLit(material);
 const instance=useMemo(()=>new THREE.InstancedMesh(source.geometry,material,Math.max(1,items.length)),[source.geometry,material,items.length]);
 useEffect(()=>()=>{instance.dispose();},[instance]);useEffect(()=>()=>material.dispose(),[material]);
 useLayoutEffect(()=>{
  const color=new THREE.Color();
  items.forEach((o,i)=>{instance.setMatrixAt(i,landscapeInstanceMatrix(data,o,normalization,source.matrixWorld));instance.setColorAt(i,o.kind==='plant'?tintPlantInstance(color,plantFoliageTint(o.speciesRecord?.id),o.id):color.set(plantFoliageTint(o.speciesRecord?.id)));});instance.count=items.length;instance.instanceMatrix.needsUpdate=true;if(instance.instanceColor)instance.instanceColor.needsUpdate=true;instance.computeBoundingBox();instance.computeBoundingSphere();
  instance.name='landscape-'+items[0]?.assetId+'-lod'+lod;instance.userData={landscapeIds:items.map(o=>o.id),pickPartIds:items.map(o=>'landscape/'+o.id),genericVisualProxy:true,unmeasuredElevationIds:items.filter(o=>!landscapePlacement(data,o).measured).map(o=>o.id)};
  instance.castShadow=q.tier!=='constrained'&&lod<2;instance.receiveShadow=true;
  const standard=material as THREE.MeshStandardMaterial;if(standard.alphaTest>0){standard.transparent=false;standard.depthWrite=true;standard.side=THREE.DoubleSide;standard.alphaToCoverage=q.msaaSamples>0;standard.needsUpdate=true;}for(const t of [standard.map,standard.normalMap,standard.roughnessMap,standard.metalnessMap])if(t){t.anisotropy=q.anisotropy;t.needsUpdate=true;}invalidate();
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
export function landscapeBedGeometry(data:DeckData,polys:LandscapePoint[][],depthIn:number,object?:LandscapeObject){
 const {positions,uv}=landscapeCellTriangles(landscapeSurfaceCells(data,polys,object),depthIn);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
function Bed({data,object,polys,material}:{data:DeckData;object:LandscapeObject;polys:LandscapePoint[][];material:THREE.Material}){
 const geometry=useMemo(()=>landscapeBedGeometry(data,polys,landscapeSurfaceDepth(object),object),[data,polys,object]);useEffect(()=>()=>geometry.dispose(),[geometry]);
 const steel=useMemo(()=>new THREE.MeshStandardMaterial({color:'#3a3e42',metalness:.62,roughness:.42}),[]);useEffect(()=>()=>steel.dispose(),[steel]);
 const top=useMemo(()=>raisedBedTop(data,object),[data,object]),surfaceY=(xIn:number,zIn:number)=>top!==undefined?top/12:landscapePlacement(data,{...object,xIn,zIn}).y;
 const edges=useMemo(()=>polys.map(p=>{const points=[...p,p[0]].map(v=>new THREE.Vector3(v.x/12,surfaceY(v.x,v.z)+((landscapeSurfaceDepth(object))+.1)/12,v.z/12));return steelEdgingGeometry(points);}),[data,polys,object,top]);useEffect(()=>()=>edges.forEach(g=>g.dispose()),[edges]);
 return <group name={'landscape-bed-'+object.id} userData={{landscapeIds:[object.id]}}><mesh geometry={geometry} material={material} receiveShadow dispose={null} userData={{pickPartId:'landscape/'+object.id,landscapeIds:[object.id]}}/>{activePuttingCups(object,polys).map((cup,i)=>{const p=puttingCupWorld(object,cup),h=surfaceY(p.x,p.z)+(landscapeSurfaceDepth(object)+.09)/12;return <group key={i} position={[p.x/12,h,p.z/12]} userData={{pickPartId:'landscape/'+object.id,landscapeIds:[object.id]}}><mesh rotation={[-Math.PI/2,0,0]}><circleGeometry args={[2.125/12,32]}/><meshStandardMaterial color="#242b22" roughness={.9}/></mesh><mesh position={[0,1.4,0]}><cylinderGeometry args={[.018,.018,2.8,8]}/><meshStandardMaterial color="#eee9dc"/></mesh><mesh position={[.2,2.65,0]}><planeGeometry args={[.4,.25]}/><meshStandardMaterial color="#c7ab58" side={THREE.DoubleSide}/></mesh></group>;})}{object.edging&&edges.map((g,i)=><mesh key={i} geometry={g} material={steel} castShadow receiveShadow/>)}{top!==undefined&&<Suspense fallback={null}><RaisedBedFaces3D data={data} object={object} polys={polys}/></Suspense>}</group>;
}
function SurfaceBed({data,object,polys}:{data:DeckData;object:LandscapeObject;polys:LandscapePoint[][]}){
 const q=useRenderQuality(),invalidate=useThree(s=>s.invalidate),resource=useMemo(()=>createLandscapeSurfaceMaterial(object.assetId,q.anisotropy),[object.assetId,q.anisotropy]);useFixtureLit(resource.material);
 useEffect(()=>{resource.loadPhotos(invalidate);return ()=>resource.dispose();},[resource,invalidate]);
 return <><Bed data={data} object={object} polys={polys} material={resource.material}/><Suspense fallback={null}><SurfaceDetail data={data} object={object} polys={polys}/></Suspense></>;
}
function Beds({data,objects}:{data:DeckData;objects:LandscapeObject[]}){
 const areas=useMemo(()=>landscapeBedAreas(objects,data),[objects,data]),beds=objects.filter(o=>o.enabled&&o.kind==='bed');
 return <>{beds.map(o=><SurfaceBed key={o.id} data={data} object={o} polys={areas.get(o.id)??[]}/>)}</>;
}
function MatureSpread({data,objects}:{data:DeckData;objects:LandscapeObject[]}){
 const geometry=useMemo(()=>{const points:number[]=[];for(const o of objects.filter(o=>o.enabled&&o.kind==='plant'&&o.speciesRecord)){const r=o.speciesRecord!.matureSpreadIn[1]/2;for(let i=0;i<64;i++){for(const n of [i,i+1]){const a=n/64*Math.PI*2,xIn=o.xIn+Math.cos(a)*r,zIn=o.zIn+Math.sin(a)*r,p=landscapePlacement(data,{...o,xIn,zIn});points.push(p.x,p.y+.035,p.z);}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));return g;},[data,objects]);useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <lineSegments name="landscape-mature-overlay" geometry={geometry} renderOrder={5}><lineBasicMaterial color="#dfa72b" depthTest={false} transparent opacity={.8}/></lineSegments>;
}
/** Mount at the scene's world origin, OUTSIDE an inch-scaled deck group. Assets
 * load only when selected. Instanced batches share geometry and local textures. */
export default function Landscape3D({data,showMatureSpread=false}:{data:DeckData;showMatureSpread?:boolean}){
 const objects=data.landscapeObjects??[],q=useRenderQuality(),camera=useThree(s=>s.camera),size=useThree(s=>s.size),[lods,setLods]=useState(new Map<string,0|1|2>()),last=useRef(''),[mature,setMature]=useState(showMatureSpread);
 const showcase=useSyncExternalStore(subscribeShowcase,()=>getShowcaseFlags().quality,()=>false);
 useEffect(()=>{const listener=(e:Event)=>setMature(!!(e as CustomEvent<{show:boolean}>).detail?.show);window.addEventListener('deckcraft:landscape-mature-spread',listener);window.dispatchEvent(new CustomEvent('deckcraft:landscape-mature-request'));return()=>window.removeEventListener('deckcraft:landscape-mature-spread',listener);},[]);
 useFrame(()=>{const live=getShowcaseFlags().quality;const next=landscapeRenderLods(objects,camera.position,size.height,q.tier,live),key=[...next].map(([id,lod])=>id+':'+lod).join('|');if(last.current!==key){last.current=key;setLods(next);}});
 const groups=new Map<string,{items:LandscapeObject[];lod:0|1|2}>();for(const o of objects.filter(o=>o.enabled&&o.kind!=='bed'&&!landscapePlacement(data,o).pendingReason)){const lod=showcase?0:(lods.get(o.id)??2),key=o.assetId+':'+lod,g=groups.get(key)??{items:[],lod};g.items.push(o);groups.set(key,g);}
 return <group name="landscape-designed-objects" userData={{designedObjectCount:objects.filter(o=>o.enabled).length,renderTier:q.tier,genericVisualProxies:true}}>{[...groups].map(([key,g])=><Suspense key={key} fallback={null}><AssetInstances data={data} items={g.items} lod={g.lod}/></Suspense>)}<PlantBlooms data={data} objects={objects} lods={lods}/>{objects.some(o=>o.enabled&&o.kind==='bed')&&<Suspense fallback={null}><Beds data={data} objects={objects}/></Suspense>}{(showMatureSpread||mature)&&<MatureSpread data={data} objects={objects}/>}</group>;
}
