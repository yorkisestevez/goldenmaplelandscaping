import {landscapeSurfaceCells,landscapeCellTriangles,raisedBedTop} from '../../landscapeSurfaceGeometry';
import {landscapeSurfaceDepth,puttingCupWorld} from '../../landscapeSurfaces';
import {createLandscapeSurfaceMaterial} from './landscapeSurfaceMaterial';
import {getPoolModels} from '../../poolModel';
import {lazy,Suspense,useEffect,useLayoutEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {useGLTF,useTexture} from '@react-three/drei';
import * as THREE from 'three';
import type {DeckData} from '../../types';
import type {DeckTakeoff} from '../../deckTakeoff';
import type {YardModel} from '../../yardModel';
import type {LandscapeObject,LandscapePoint} from '../../landscapeTypes';
import {landscapeAsset,plantFoliageTint} from '../../landscapeCatalogue';
import {SEASON_VARIETY,applyFoliageLighting,applyLeafRecolor,crownBend,isLeafMaterial,leafTransmitUniform,tintPlantInstance} from './foliageLighting';
import PlantBlooms from './plantBlooms';
import {hydrangeaCultivar} from '../../hydrangeaCultivars';
import PlantStems from './plantStems';
import FallenLeaves from './fallenLeaves';
import {plantSeasonLook,type Season} from './plantSeasons';
import {useSeason} from './sceneSeason';
import {activePuttingCups,landscapeBedAreas,landscapePlacement,landscapeRenderLods} from '../../landscapeModelRuntime';
import {createSiteSurface,siteClip,siteSolidCells,sitePlaneHeight} from '../../siteSurfaceEngine';
import {getTerrainConfig} from '../../yardSettings';
import {useRenderQuality} from './SceneRenderQuality';
import {getShowcaseFlags,subscribeShowcase} from '../../showcaseMode';
import {useFixtureLit} from './fixtureLighting';
import {meshYawRad} from '../../furnitureFacing';
import {edgingRuns} from './bedEdging';
import {addSheetAttributes,bedReliefGeometry,bedReliefs,flushEdgingPoints,soilTint,type BedRelief} from './bedRelief';
import {plantSeats,type PlantSeat} from './plantSeating';
import {chipClearance,collarGeometry,PlantShadeRings} from './plantContactDecals';
import {useGroundOcclusion} from './groundOcclusion';
import {weatheredSteelMaterial} from './weatheredSteel';
import {landscapeStructureExclusions} from '../../landscapeFill';

const SurfaceDetail=lazy(()=>import('./SurfaceDetail'));
/** Hydrangeas built from their botany, with their photo atlases: loaded with the first hydrangea. */
const Hydrangeas3D=lazy(()=>import('./hydrangea/Hydrangeas3D'));
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
/** How a placed model draws in the season shown: today's summer leaves, its leaves recoloured, or bare (no leaf cards). */
type SeasonMode='summer'|'recolor'|'bare';
function seasonMode(o:LandscapeObject,season:Season):SeasonMode{
 if(o.kind!=='plant')return 'summer';
 const leaves=plantSeasonLook(o.speciesRecord?.id,o.assetId,season).leaves;
 return leaves===null?'bare':leaves==='summer'?'summer':'recolor';
}
function InstancePart({data,items,source,normalization,lod,seats,season,mode}:{data:DeckData;items:LandscapeObject[];source:THREE.Mesh;normalization:THREE.Matrix4;lod:number;seats:Map<string,PlantSeat>;season:Season;mode:SeasonMode}){
 const q=useRenderQuality(),invalidate=useThree(s=>s.invalidate),original=Array.isArray(source.material)?source.material[0]:source.material;
 const foliage=items[0]?.kind==='plant';
 const assetId=items[0]?.assetId;
 // Card normals lean out from the centre of this part's own leaves (its geometry bounds), so a canopy shades as a volume.
 // Out of summer a leaf part may take the season's colour (applyLeafRecolor); summer materials stay exactly as they were.
 const recolor=foliage&&mode==='recolor'&&isLeafMaterial(original),tone=recolor?season:'summer';
 const material=useMemo(()=>{const m=original.clone();if(foliage){source.geometry.computeBoundingBox();applyFoliageLighting(m,{center:source.geometry.boundingBox!.getCenter(new THREE.Vector3()),bend:crownBend(assetId??'')});if(recolor)applyLeafRecolor(m,SEASON_VARIETY[tone]);}return m;},[original,foliage,source.geometry,assetId,recolor,tone]);
 // The species tint is a leaf colour: textured bark and trunks keep their own (an untextured trunk keeps the tint it had).
 const leafTint=foliage&&(isLeafMaterial(original)||!(original as THREE.MeshStandardMaterial).map);useFixtureLit(material);
 // A recoloured leaf takes the season's colour for its species; everything else keeps the species tint.
 const leafColor=(o:LandscapeObject)=>{const look=recolor?plantSeasonLook(o.speciesRecord?.id,o.assetId,tone).leaves:null;return look&&look!=='summer'?look:plantFoliageTint(o.speciesRecord?.id);};
 const instance=useMemo(()=>new THREE.InstancedMesh(source.geometry,material,Math.max(1,items.length)),[source.geometry,material,items.length]);
 useEffect(()=>()=>{instance.dispose();},[instance]);useEffect(()=>()=>material.dispose(),[material]);
 useLayoutEffect(()=>{
  const color=new THREE.Color(),seat=new THREE.Matrix4();
  // A plant's seat in the drawn mulch (plantSeating.ts) lifts or sinks the whole placed model.
  items.forEach((o,i)=>{instance.setMatrixAt(i,seat.makeTranslation(0,(seats.get(o.id)?.dyIn??0)/12,0).multiply(landscapeInstanceMatrix(data,o,normalization,source.matrixWorld)));instance.setColorAt(i,o.kind==='plant'?(leafTint?tintPlantInstance(color,leafColor(o),o.id):color.set('#ffffff')):color.set(plantFoliageTint(o.speciesRecord?.id)));});instance.count=items.length;instance.instanceMatrix.needsUpdate=true;if(instance.instanceColor)instance.instanceColor.needsUpdate=true;instance.computeBoundingBox();instance.computeBoundingSphere();
  instance.name='landscape-'+items[0]?.assetId+'-lod'+lod;instance.userData={landscapeIds:items.map(o=>o.id),pickPartIds:items.map(o=>'landscape/'+o.id),genericVisualProxy:true,unmeasuredElevationIds:items.filter(o=>!landscapePlacement(data,o).measured).map(o=>o.id)};
  instance.castShadow=q.tier!=='constrained'&&lod<2;instance.receiveShadow=true;
  if(foliage)leafTransmitUniform(material).value=instance.castShadow?1:0;
  const standard=material as THREE.MeshStandardMaterial;if(standard.alphaTest>0){standard.transparent=false;standard.depthWrite=true;standard.side=THREE.DoubleSide;standard.alphaToCoverage=q.msaaSamples>0;standard.needsUpdate=true;}for(const t of [standard.map,standard.normalMap,standard.roughnessMap,standard.metalnessMap])if(t){t.anisotropy=q.anisotropy;t.needsUpdate=true;}invalidate();
 },[data,items,instance,source,normalization,lod,q,material,invalidate,leafTint,seats,recolor,tone]);
 return <primitive object={instance} dispose={null}/>;
}
function AssetInstances({data,items,lod,seats,season,mode}:{data:DeckData;items:LandscapeObject[];lod:0|1|2;seats:Map<string,PlantSeat>;season:Season;mode:SeasonMode}){
 const a=landscapeAsset(items[0].assetId),url=lod===0?a.modelURL!:lod===1?a.lowModelURL!:a.farModelURL!,gltf=useGLTF(url);
 const source=useMemo(()=>{gltf.scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());const normalization=new THREE.Matrix4().makeScale(1/Math.max(.0001,size.x),1/Math.max(.0001,size.y),1/Math.max(.0001,size.z)).multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z)),meshes:THREE.Mesh[]=[];gltf.scene.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});return {normalization,meshes};},[gltf.scene]);
 // A bare plant draws no leaf cards: a winter maple keeps its branches and trunk, a shrub leaves its stems to PlantStems.
 const parts=mode==='bare'?source.meshes.filter(m=>!isLeafMaterial(Array.isArray(m.material)?m.material[0]:m.material)):source.meshes;
 return <group name={'landscape-asset-'+a.id} userData={{sourceURL:a.sourceURL,genericVisualProxy:true}}>{parts.map(m=><InstancePart key={source.meshes.indexOf(m)} data={data} items={items} source={m} normalization={source.normalization} lod={lod} seats={seats} season={season} mode={mode}/>)}</group>;
}
/** Clip each bed into the proposed TIN faces. This follows exact measured
 * elevation and grading breaks, including holes left by overlapping beds. */
export function landscapeBedGeometry(data:DeckData,polys:LandscapePoint[][],depthIn:number,object?:LandscapeObject){
 const {positions,uv}=landscapeCellTriangles(landscapeSurfaceCells(data,polys,object),depthIn);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
function Bed({data,object,polys,joins,material,relief,plants}:{data:DeckData;object:LandscapeObject;polys:LandscapePoint[][];joins:LandscapePoint[][];material:THREE.Material;relief?:BedRelief;plants:{object:LandscapeObject;seat:PlantSeat}[]}){
 const occlusion=useGroundOcclusion(),bounds=occlusion?.bounds;
 const geometry=useMemo(()=>relief?bedReliefGeometry(data,relief,bounds):addSheetAttributes(landscapeBedGeometry(data,polys,landscapeSurfaceDepth(object),object),bounds),[data,polys,object,relief,bounds]);useEffect(()=>()=>geometry.dispose(),[geometry]);
 const collars=useMemo(()=>plants.length?collarGeometry(data,plants,soilTint(object),polys,relief,bounds):null,[data,plants,object,polys,relief,bounds]);useEffect(()=>()=>collars?.dispose(),[collars]);
 // Plain beds' flush edging is weathered steel, as the raised beds' faces; raised and turf beds keep their ribbon's steel.
 const flush=!!relief,steel=useMemo(()=>flush?weatheredSteelMaterial():new THREE.MeshStandardMaterial({color:'#3a3e42',metalness:.62,roughness:.42}),[flush]);useEffect(()=>()=>steel.dispose(),[steel]);
 const top=useMemo(()=>raisedBedTop(data,object),[data,object]),surfaceY=(xIn:number,zIn:number)=>top!==undefined?top/12:landscapePlacement(data,{...object,xIn,zIn}).y;
 // A plain bed's edging is set 3.5 in into the ground, ½ in proud; raised and turf beds keep their ribbon on the finish.
 // It follows the outline less the stretches shared with a bed of the same surface (edgingRuns).
 const edges=useMemo(()=>polys.flatMap(p=>edgingRuns(p,joins)).map(run=>steelEdgingGeometry(flush?flushEdgingPoints(data,run,false):run.map(v=>new THREE.Vector3(v.x/12,surfaceY(v.x,v.z)+((landscapeSurfaceDepth(object))+.1)/12,v.z/12)))),[data,polys,object,top,flush,joins]);useEffect(()=>()=>edges.forEach(g=>g.dispose()),[edges]);
 return <group name={'landscape-bed-'+object.id} userData={{landscapeIds:[object.id]}}><mesh geometry={geometry} material={material} receiveShadow dispose={null} name={relief?'landscape-bed-relief':undefined} userData={{pickPartId:'landscape/'+object.id,landscapeIds:[object.id],coversGround:false}}/>{collars&&<mesh geometry={collars} material={material} receiveShadow dispose={null} name="landscape-bed-collars" userData={{pickPartId:'landscape/'+object.id,landscapeIds:[object.id],coversGround:false}}/>}{activePuttingCups(object,polys).map((cup,i)=>{const p=puttingCupWorld(object,cup),h=surfaceY(p.x,p.z)+(landscapeSurfaceDepth(object)+.09)/12;return <group key={i} position={[p.x/12,h,p.z/12]} userData={{pickPartId:'landscape/'+object.id,landscapeIds:[object.id]}}><mesh rotation={[-Math.PI/2,0,0]}><circleGeometry args={[2.125/12,32]}/><meshStandardMaterial color="#242b22" roughness={.9}/></mesh><mesh position={[0,1.4,0]}><cylinderGeometry args={[.018,.018,2.8,8]}/><meshStandardMaterial color="#eee9dc"/></mesh><mesh position={[.2,2.65,0]}><planeGeometry args={[.4,.25]}/><meshStandardMaterial color="#c7ab58" side={THREE.DoubleSide}/></mesh></group>;})}{object.edging&&edges.map((g,i)=><mesh key={i} geometry={g} material={steel} castShadow receiveShadow/>)}{top!==undefined&&<Suspense fallback={null}><RaisedBedFaces3D data={data} object={object} polys={polys}/></Suspense>}</group>;
}
/** The sky's occlusion map stands in where the lawn's has not been drawn yet. */
const NO_OCCLUSION=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);NO_OCCLUSION.channel=1;NO_OCCLUSION.needsUpdate=true;
function SurfaceBed({data,object,polys,joins,relief,plants}:{data:DeckData;object:LandscapeObject;polys:LandscapePoint[][];joins:LandscapePoint[][];relief?:BedRelief;plants:{object:LandscapeObject;seat:PlantSeat}[]}){
 const q=useRenderQuality(),invalidate=useThree(s=>s.invalidate),resource=useMemo(()=>createLandscapeSurfaceMaterial(object.assetId,q.anisotropy),[object.assetId,q.anisotropy]);useFixtureLit(resource.material);
 useEffect(()=>{resource.loadPhotos(invalidate);return ()=>resource.dispose();},[resource,invalidate]);
 // A bed beside the house is shaded from the sky as the lawn there is: the lawn's shared occlusion map (not owned here).
 const occlusion=useGroundOcclusion();useLayoutEffect(()=>{const m=resource.material;m.aoMap=occlusion?.texture??NO_OCCLUSION;m.aoMapIntensity=.75;m.needsUpdate=true;invalidate();},[resource,occlusion,invalidate]);
 const clearance=useMemo(()=>chipClearance(relief,plants,polys),[relief,plants,polys]);
 return <><Bed data={data} object={object} polys={polys} joins={joins} material={resource.material} relief={relief} plants={plants}/><Suspense fallback={null}><SurfaceDetail data={data} object={object} polys={polys} clearance={clearance}/></Suspense></>;
}
function Beds({data,objects,areas,reliefs,seats}:{data:DeckData;objects:LandscapeObject[];areas:Map<string,LandscapePoint[][]>;reliefs:Map<string,BedRelief>;seats:Map<string,PlantSeat>}){
 const beds=useMemo(()=>objects.filter(o=>o.enabled&&o.kind==='bed'),[objects]);
 // Ground-cover beds of the same surface that meet are one bed to the eye: no edging between them (edgingRuns).
 const joins=useMemo(()=>{const flat=(o:LandscapeObject)=>raisedBedTop(data,o)===undefined;return new Map(beds.map(o=>[o.id,flat(o)?beds.filter(b=>b!==o&&b.assetId===o.assetId&&flat(b)).flatMap(b=>areas.get(b.id)??[]):[]]));},[beds,areas,data]);
 const plants=useMemo(()=>{const byBed=new Map<string,{object:LandscapeObject;seat:PlantSeat}[]>();for(const o of objects){const seat=seats.get(o.id);if(!seat?.bed)continue;const list=byBed.get(seat.bed.id)??[];list.push({object:o,seat});byBed.set(seat.bed.id,list);}return byBed;},[objects,seats]);
 return <>{beds.map(o=><SurfaceBed key={o.id} data={data} object={o} polys={areas.get(o.id)??[]} joins={joins.get(o.id)??NO_JOINS} relief={reliefs.get(o.id)} plants={plants.get(o.id)??NO_PLANTS}/>)}</>;
}
const NO_PLANTS:{object:LandscapeObject;seat:PlantSeat}[]=[],NO_JOINS:LandscapePoint[][]=[];
function MatureSpread({data,objects,seats}:{data:DeckData;objects:LandscapeObject[];seats:Map<string,PlantSeat>}){
 const geometry=useMemo(()=>{const points:number[]=[];for(const o of objects.filter(o=>o.enabled&&o.kind==='plant'&&o.speciesRecord)){const r=o.speciesRecord!.matureSpreadIn[1]/2,dy=(seats.get(o.id)?.dyIn??0)/12;for(let i=0;i<64;i++){for(const n of [i,i+1]){const a=n/64*Math.PI*2,xIn=o.xIn+Math.cos(a)*r,zIn=o.zIn+Math.sin(a)*r,p=landscapePlacement(data,{...o,xIn,zIn});points.push(p.x,p.y+dy+.035,p.z);}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));return g;},[data,objects,seats]);useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <lineSegments name="landscape-mature-overlay" geometry={geometry} renderOrder={5}><lineBasicMaterial color="#dfa72b" depthTest={false} transparent opacity={.8}/></lineSegments>;
}
/** The scene hands over a fresh copy of the design on every render (its visible objects only). While nothing in it has
 * changed, keep the last copy, so per-design work (bed reliefs, plant seats, instance matrices) runs once per edit. */
function useStableDesign(data:DeckData){
 const last=useRef(data),prev=last.current;
 if(prev!==data){
  const a=prev as unknown as Record<string,unknown>,b=data as unknown as Record<string,unknown>,keys=Object.keys(b);
  const same=keys.length===Object.keys(a).length&&keys.every(k=>{const x=a[k],y=b[k];return x===y||k==='landscapeObjects'&&Array.isArray(x)&&Array.isArray(y)&&x.length===y.length&&x.every((o,i)=>o===y[i]);});
  if(!same)last.current=data;
 }
 return last.current;
}
/** Mount at the scene's world origin, OUTSIDE an inch-scaled deck group. Assets
 * load only when selected. Instanced batches share geometry and local textures. */
/** source, model and yard: the view's own design (Landscape3D draws a copy with its visible objects) and the deck and yard
 * models it built, so structure footprints reuse its cached pool and yard geometry instead of rebuilding them per copy. */
export default function Landscape3D({data:fresh,showMatureSpread=false,source,model,yard}:{data:DeckData;showMatureSpread?:boolean;source?:DeckData;model?:DeckTakeoff;yard?:YardModel}){
 const data=useStableDesign(fresh),objects=data.landscapeObjects??[],q=useRenderQuality(),camera=useThree(s=>s.camera),size=useThree(s=>s.size),invalidate=useThree(s=>s.invalidate),[lods,setLods]=useState(new Map<string,0|1|2>()),last=useRef(''),[mature,setMature]=useState(showMatureSpread),shown=useRef(typeof performance!=='undefined'?performance.now():0);
 const showcase=useSyncExternalStore(subscribeShowcase,()=>getShowcaseFlags().quality,()=>false),season=useSeason();
 // Bed areas, the drawn tops of plain beds and where each plant meets them: one pass, shared by beds, plants and rings.
 const areas=useMemo(()=>landscapeBedAreas(objects,data),[objects,data]),structures=useMemo(()=>{if(!source||!model||!yard)return undefined;try{return landscapeStructureExclusions(source,{deck:model,yard});}catch{return undefined;}},[source,model,yard]),reliefs=useMemo(()=>bedReliefs(data,objects,areas,structures),[data,objects,areas,structures]),seats=useMemo(()=>plantSeats(data,objects,reliefs),[data,objects,reliefs]);
 // A plant that has died back for the season (a winter hosta) casts no contact shade.
 const seated=useMemo(()=>objects.flatMap(o=>{const seat=seats.get(o.id),look=plantSeasonLook(o.speciesRecord?.id,o.assetId,season);return seat&&(look.leaves!==null||look.stems)?[{object:o,seat}]:[];}),[objects,seats,season]);
 useEffect(()=>{const listener=(e:Event)=>setMature(!!(e as CustomEvent<{show:boolean}>).detail?.show);window.addEventListener('deckcraft:landscape-mature-spread',listener);window.dispatchEvent(new CustomEvent('deckcraft:landscape-mature-request'));return()=>window.removeEventListener('deckcraft:landscape-mature-spread',listener);},[]);
 // Far models (lod 2) draw immediately. Nearer models, which are much larger files, start once the view is up.
 useEffect(()=>{const timer=window.setTimeout(()=>invalidate(),1200);return()=>window.clearTimeout(timer);},[invalidate]);
 useFrame(()=>{if(performance.now()-shown.current<1200)return;const live=getShowcaseFlags().quality;const next=landscapeRenderLods(objects,camera.position,size.height,q.tier,live),key=[...next].map(([id,lod])=>id+':'+lod).join('|');if(last.current!==key){last.current=key;setLods(next);}});
  // Hydrangeas are built from their botany (hydrangea/), not the shared shrub model, its flower cards and season stems.
 const hydrangeas=useMemo(()=>objects.filter(o=>o.enabled&&o.kind==='plant'&&hydrangeaCultivar(o.speciesRecord?.id)&&!landscapePlacement(data,o).pendingReason),[objects,data]),others=useMemo(()=>hydrangeas.length?objects.filter(o=>!hydrangeas.includes(o)):objects,[objects,hydrangeas]);
 const groups=new Map<string,{items:LandscapeObject[];lod:0|1|2;mode:SeasonMode}>();for(const o of others.filter(o=>o.enabled&&o.kind!=='bed'&&!landscapePlacement(data,o).pendingReason)){const lod=showcase?0:(lods.get(o.id)??2),mode=seasonMode(o,season),key=o.assetId+':'+lod+(mode==='summer'?'':':'+mode),g=groups.get(key)??{items:[],lod,mode};g.items.push(o);groups.set(key,g);}
 return <group name="landscape-designed-objects" userData={{designedObjectCount:objects.filter(o=>o.enabled).length,renderTier:q.tier,genericVisualProxies:true}}>{[...groups].map(([key,g])=><Suspense key={key} fallback={null}><AssetInstances data={data} items={g.items} lod={g.lod} seats={seats} season={season} mode={g.mode}/></Suspense>)}<PlantBlooms data={data} objects={others} lods={lods} seats={seats} season={season}/>{hydrangeas.length>0&&<Suspense fallback={null}><Hydrangeas3D data={data} objects={hydrangeas} lods={lods} seats={seats} season={season}/></Suspense>}{season!=='summer'&&<PlantStems data={data} objects={others} seats={seats} season={season}/>}{season==='fall'&&<FallenLeaves data={data} objects={objects}/>}<PlantShadeRings data={data} plants={seated}/>{objects.some(o=>o.enabled&&o.kind==='bed')&&<Suspense fallback={null}><Beds data={data} objects={objects} areas={areas} reliefs={reliefs} seats={seats}/></Suspense>}{(showMatureSpread||mature)&&<MatureSpread data={data} objects={objects} seats={seats}/>}</group>;
}
