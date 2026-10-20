import {useContext,useEffect,useLayoutEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {useThree} from '@react-three/fiber';
import {useTexture} from '@react-three/drei';
import * as THREE from 'three';
import type {DeckData} from '../../../types';
import type {LandscapeObject} from '../../../landscapeTypes';
import {landscapePlacement} from '../../../landscapeModelRuntime';
import {hydrangeaCultivar,type HydrangeaCultivar} from '../../../hydrangeaCultivars';
import {getShowcaseFlags,subscribeShowcase} from '../../../showcaseMode';
import type {PlantSeat} from '../plantSeating';
import {useRenderQuality} from '../SceneRenderQuality';
import {FixtureLightContext,litMaterial} from '../fixtureLighting';
import {applyFoliageLighting,leafTransmitUniform,plantColorHash} from '../foliageLighting';
import {addMaterialPatch} from '../materialPatches';
import {buildHydrangea,hydrangeaLod,panicleRadius,type HydrangeaPlant} from './hydrangeaModel';
import {HYDRANGEA_SPECS} from './hydrangeaSpecs';
import {HYDRANGEA_CULTIVARS,HYDRANGEA_FILL,HYDRANGEA_TEXTURES,atlasCell} from './hydrangeaTextures';

const UP=new THREE.Vector3(0,1,0),IN_TO_FT=1/12;
/** Leaf cards bend: the halves fold up from the midrib and the tip curls back (share of the card's length). */
const LEAF_FOLD=.05,LEAF_CURL=.07;
/** A head's core (the mass of fertile florets and stems under the sterile ones) fills this share of the head: less of a
 * panicle, whose sterile florets stand out from its branches. */
const CORE_SHARE={dome:.76,panicle:.66} as const;
/** Sides of a cane's tube at each level of detail; petioles are drawn close up only. */
const CANE_SIDES=[5,4,3] as const,PETIOLE_SIDES=3,PETIOLE_RADIUS_IN=.05;

/** Plant inches to world feet: the placed point (lifted or sunk by its seat in the mulch), the object's turn and the ground's tilt. */
function plantMatrix(data:DeckData,o:LandscapeObject,seats:Map<string,PlantSeat>){
 const placed=landscapePlacement(data,o),q=new THREE.Quaternion().setFromAxisAngle(UP,-o.rotationDeg*Math.PI/180);
 if(placed.normal)q.premultiply(new THREE.Quaternion().setFromUnitVectors(UP,new THREE.Vector3(placed.normal.x,placed.normal.y,placed.normal.z)));
 return new THREE.Matrix4().compose(new THREE.Vector3(placed.x,placed.y+(seats.get(o.id)?.dyIn??0)*IN_TO_FT,placed.z),q,new THREE.Vector3(IN_TO_FT,IN_TO_FT,IN_TO_FT));
}

function leafGeometry(folded:boolean){
 const xs=folded?[-.5,0,.5]:[-.5,.5],ys=folded?[0,.5,1]:[0,1],positions:number[]=[],uvs:number[]=[],index:number[]=[];
 for(const y of ys)for(const x of xs){positions.push(x,y,LEAF_FOLD*Math.abs(2*x)-LEAF_CURL*y*y);uvs.push(x+.5,y);}
 const row=xs.length;
 for(let j=0;j<ys.length-1;j++)for(let i=0;i<row-1;i++){const a=j*row+i;index.push(a,a+1,a+row+1,a,a+row+1,a+row);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(index);g.computeVertexNormals();return g;
}
/** A head's core, coarser at a distance, where cluster cards cover it. */
function coreGeometry(shape:'dome'|'panicle',lod:0|1|2){
 const around=lod===0?10:6;
 if(shape==='dome')return new THREE.SphereGeometry(1,around,lod===0?6:4);
 const steps=lod===0?8:4,profile=Array.from({length:steps+1},(_,i)=>new THREE.Vector2(i===steps?0:panicleRadius(i/steps),i/steps));
 return new THREE.LatheGeometry([new THREE.Vector2(0,0),...profile],around);
}
/** One plant's canes (and, close up, its petioles) as thin tubes in plant inches. */
function stemGeometry(plant:HydrangeaPlant,lod:0|1|2){
 const positions:number[]=[],index:number[]=[];
 const tube=(path:THREE.Vector3[],radii:number[],sides:number)=>{
  const base=positions.length/3;
  path.forEach((p,i)=>{
   const along=(i<path.length-1?path[i+1].clone().sub(p):p.clone().sub(path[i-1])).normalize();
   const side=new THREE.Vector3().crossVectors(along,Math.abs(along.y)>.95?new THREE.Vector3(1,0,0):UP).normalize(),side2=new THREE.Vector3().crossVectors(along,side);
   for(let s=0;s<sides;s++){const a=s/sides*Math.PI*2,c=Math.cos(a)*radii[i],d=Math.sin(a)*radii[i];positions.push(p.x+side.x*c+side2.x*d,p.y+side.y*c+side2.y*d,p.z+side.z*c+side2.z*d);}
  });
  for(let i=0;i<path.length-1;i++)for(let s=0;s<sides;s++){const a=base+i*sides+s,b=base+i*sides+(s+1)%sides;index.push(a,b,b+sides,a,b+sides,a+sides);}
 };
 for(const c of plant.canes)tube(c.points.map(p=>new THREE.Vector3(...p)),c.radii,CANE_SIDES[lod]);
 if(lod===0)for(const l of plant.leaves){const p=new THREE.Vector3(...l.p),dir=new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion(...l.q));tube([p,p.clone().addScaledVector(dir,l.petioleIn)],[PETIOLE_RADIUS_IN,PETIOLE_RADIUS_IN*.8],PETIOLE_SIDES);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(index);g.computeVertexNormals();g.computeBoundingSphere();return g;
}

/** A plant at one level of detail, in its own inches: instance matrices (16 per card), linear instance colours (3 per
 * card), each leaf's crown-out direction, and its stems. */
interface PlantParts {leaf:Float32Array;leafColor:Float32Array;leafOut:Float32Array;floret:Float32Array;floretColor:Float32Array;core:Float32Array;coreColor:Float32Array;stems:THREE.BufferGeometry}
function plantParts(o:LandscapeObject,plant:HydrangeaPlant,lod:0|1|2):PlantParts{
 const cultivar=plant.cultivar,spec=HYDRANGEA_SPECS[cultivar],view=hydrangeaLod(plant,lod),[leafFillW,leafFillH]=HYDRANGEA_FILL.leaves[cultivar],floretFill=lod>0?1:HYDRANGEA_FILL.florets[cultivar][0];
 const m=new THREE.Matrix4(),lift=new THREE.Matrix4(),color=new THREE.Color(),pos=new THREE.Vector3(),rot=new THREE.Quaternion(),scale=new THREE.Vector3();
 const leaf=new Float32Array(view.leaves.length*16),leafColor=new Float32Array(view.leaves.length*3),leafOut=new Float32Array(view.leaves.length*3);
 view.leaves.forEach((l,i)=>{
  // The cut-out sits centred in its cell: drop the card so the blade's base meets the petiole's end.
  const height=l.bladeIn/leafFillH,width=l.widthIn/leafFillW,base=(1-leafFillH)/2*height;
  m.compose(pos.set(...l.p),rot.set(...l.q),scale.set(width,height,height)).multiply(lift.makeTranslation(0,(l.petioleIn-base)/height,0)).toArray(leaf,i*16);
  const tone=l.shade*(.9+.14*plantColorHash(o.id,i));leafColor.set([tone,tone,tone],i*3);leafOut.set(l.out,i*3);
 });
 const floret=new Float32Array(view.florets.length*16),floretColor=new Float32Array(view.florets.length*3);
 view.florets.forEach((f,i)=>{
  const s=f.sizeIn/floretFill;m.compose(pos.set(...f.p),rot.set(...f.q),scale.set(s,s,s)).toArray(floret,i*16);
  color.setRGB(f.color[0],f.color[1],f.color[2],THREE.SRGBColorSpace);floretColor.set([color.r,color.g,color.b],i*3);
 });
 const core=new Float32Array(plant.heads.length*16),coreColor=new Float32Array(plant.heads.length*3);
 plant.heads.forEach((h,i)=>{
  const axis=new THREE.Vector3(...h.axis),share=CORE_SHARE[h.shape],r=h.widthIn/2*share;
  rot.setFromUnitVectors(UP,axis);
  if(h.shape==='dome')m.compose(pos.set(...h.p).addScaledVector(axis,h.lengthIn*.35),rot,scale.set(r,h.lengthIn/2*share,r));
  else m.compose(pos.set(...h.p).addScaledVector(axis,-.08*h.lengthIn),rot,scale.set(r,h.lengthIn*.94,r));
  m.toArray(core,i*16);color.set(spec.head.core).multiplyScalar(.92+.12*plantColorHash(o.id,i+50));coreColor.set([color.r,color.g,color.b],i*3);
 });
 return {leaf,leafColor,leafOut,floret,floretColor,core,coreColor,stems:stemGeometry(plant,lod)};
}
/** A cell of an atlas, as sRGB colour (R3F marks a texture sRGB only when it is set through JSX props). */
function atlasMap(source:THREE.Texture,cultivar:HydrangeaCultivar,row:0|1){
 source.colorSpace=THREE.SRGBColorSpace;
 const t=source.clone(),[u,v,ru,rv]=atlasCell(cultivar,row);t.offset.set(u,v);t.repeat.set(ru,rv);t.needsUpdate=true;return t;
}
function cardMaterial(map:THREE.Texture,side:THREE.Side,name:string){
 return new THREE.MeshStandardMaterial({map,alphaTest:.5,side,name,transparent:false,depthWrite:true});
}

/** Materials for one cultivar, shared by every plant of it. A leaf is one double-sided card: its back face samples the
 * underside row of the atlas (half the atlas below the upper side). Florets never cast and never let light through. */
interface CultivarMaterials {leaf:THREE.MeshStandardMaterial;floret:THREE.MeshStandardMaterial;cluster:THREE.MeshStandardMaterial;core:THREE.MeshStandardMaterial;stem:THREE.MeshStandardMaterial}
const UNDERSIDE_ROW=new THREE.Vector2(0,-.5);
function cultivarMaterials(cultivar:HydrangeaCultivar,florets:THREE.Texture,leaves:THREE.Texture):CultivarMaterials{
 const spec=HYDRANGEA_SPECS[cultivar];
 const leaf=cardMaterial(atlasMap(leaves,cultivar,0),THREE.DoubleSide,'hydrangea-leaf');
 applyFoliageLighting(leaf,{center:new THREE.Vector3(),bend:.6,outAttribute:true});leaf.roughness=spec.leaf.roughness;
 addMaterialPatch(leaf,{key:'hydrangea-leaf-underside-v1',apply(shader){
  shader.uniforms.uUnderside={value:UNDERSIDE_ROW};
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec2 uUnderside;')
   .replace('#include <map_fragment>',THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )','texture2D( map, gl_FrontFacing ? vMapUv : vMapUv + uUnderside )'));
 }});
 const floretCard=(row:0|1)=>{const m=cardMaterial(atlasMap(florets,cultivar,row),THREE.DoubleSide,'hydrangea-floret');applyFoliageLighting(m,{center:new THREE.Vector3(),bend:0});leafTransmitUniform(m).value=0;return m;};
 return {leaf,floret:floretCard(0),cluster:floretCard(1),core:new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.88,name:'hydrangea-head-core'}),stem:new THREE.MeshStandardMaterial({color:spec.stem,roughness:.8,name:'hydrangea-stem'})};
}
const materialList=(m:CultivarMaterials)=>[m.leaf,m.floret,m.cluster,m.core,m.stem];
/** A plant is picked, and outlined when selected, by one box around its envelope: never drawn (material.visible false
 * keeps it out of every render list) and left out of Photo mode. Its thousands of cards take no part in picking, so a
 * selection draws one outline, not one per card. */
const PICK_MATERIAL=new THREE.MeshBasicMaterial({visible:false,name:'hydrangea-pick'}),PICK_GEOMETRY=new THREE.BoxGeometry(1,1,1).translate(0,.5,0),NO_RAYCAST=()=>{};
function pickBox(o:LandscapeObject){
 const box=new THREE.Mesh(PICK_GEOMETRY,PICK_MATERIAL);box.scale.set(o.widthIn,o.heightIn,o.depthIn);box.updateMatrix();box.matrixAutoUpdate=false;
 box.name='landscape-hydrangea-pick';box.userData={pickPartId:'landscape/'+o.id,landscapeIds:[o.id],photoSkip:true};return box;
}
const CARD_GEOMETRY=new THREE.PlaneGeometry(1,1),LEAF_GEOMETRY=[leafGeometry(true),leafGeometry(false)] as const;
const CORE_GEOMETRY={dome:[coreGeometry('dome',0),coreGeometry('dome',1)],panicle:[coreGeometry('panicle',0),coreGeometry('panicle',1)]} as const;

/** One level of one plant: instanced cards over its own plant-inch arrays, uploaded once and kept while the plant stays. */
interface Level {meshes:THREE.Object3D[];leaves:THREE.InstancedMesh;florets:THREE.InstancedMesh;cores:THREE.InstancedMesh;stems:THREE.Mesh;leafGeometry:THREE.BufferGeometry}
function buildLevel(o:LandscapeObject,plant:HydrangeaPlant,lod:0|1|2,materials:CultivarMaterials):Level{
 const p=plantParts(o,plant,lod);
 const instanced=(geometry:THREE.BufferGeometry,material:THREE.Material,matrices:Float32Array,colors:Float32Array)=>{
  const mesh=new THREE.InstancedMesh(geometry,material,matrices.length/16);
  mesh.instanceMatrix=new THREE.InstancedBufferAttribute(matrices,16);mesh.instanceColor=new THREE.InstancedBufferAttribute(colors,3);
  mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.matrixAutoUpdate=false;mesh.raycast=NO_RAYCAST;mesh.userData={landscapeIds:[o.id]};
  return mesh;
 };
 const leafGeometry=LEAF_GEOMETRY[lod===0?0:1].clone();leafGeometry.setAttribute('aCrownOut',new THREE.InstancedBufferAttribute(p.leafOut,3));
 const leaves=instanced(leafGeometry,materials.leaf,p.leaf,p.leafColor);
 const florets=instanced(CARD_GEOMETRY,lod===0?materials.floret:materials.cluster,p.floret,p.floretColor);
 const cores=instanced(CORE_GEOMETRY[plant.heads[0]?.shape??'dome'][lod===0?0:1],materials.core,p.core,p.coreColor);
 const stems=new THREE.Mesh(p.stems,materials.stem);stems.matrixAutoUpdate=false;stems.raycast=NO_RAYCAST;stems.userData={landscapeIds:[o.id]};
 return {meshes:[leaves,florets,cores,stems],leaves,florets,cores,stems,leafGeometry};
}
function disposeLevel(level:Level){
 for(const m of [level.leaves,level.florets,level.cores])m.dispose();
 level.leafGeometry.dispose();level.stems.geometry.dispose();
}
/** A placed hydrangea: built once (the scene keeps an unchanged design's objects), each near level made the first time
 * it is shown. Moving between near levels as the camera orbits shows one set of meshes and hides another; nothing is
 * uploaded again. Far away it joins its cultivar's batch (one draw per part for every far plant), whose small arrays are
 * rebuilt only when a plant joins or leaves it. */
interface Node {group:THREE.Group;plant:HydrangeaPlant;levels:(Level|undefined)[];far?:PlantParts}
/** One viewer's plants and far batches, made with that viewer's materials and dropped with them. */
interface Store {nodes:Map<LandscapeObject,Node>;batches:Map<HydrangeaCultivar,FarBatch>}
const disposeNode=(node:Node)=>{for(const level of node.levels)if(level)disposeLevel(level);node.far?.stems.dispose();};
function forget(store:Store,keep:Set<LandscapeObject>){
 for(const [o,node] of store.nodes)if(!keep.has(o)){disposeNode(node);node.group.removeFromParent();store.nodes.delete(o);}
}
/** Instanced meshes grow in steps, so a plant joining a batch does not rebuild them every time. */
const capacityFor=(n:number)=>Math.max(64,2**Math.ceil(Math.log2(Math.max(1,n))));
interface FarBatch {group:THREE.Group;leaves:THREE.InstancedMesh;florets:THREE.InstancedMesh;cores:THREE.InstancedMesh;stems:THREE.Mesh;key:string}
function farBatch(cultivar:HydrangeaCultivar,materials:CultivarMaterials,leaves:number,florets:number,cores:number,old?:FarBatch):FarBatch{
 const fits=old&&old.leaves.instanceMatrix.count>=leaves&&old.florets.instanceMatrix.count>=florets&&old.cores.instanceMatrix.count>=cores;
 if(old&&fits)return old;
 if(old)disposeBatch(old);
 const make=(geometry:THREE.BufferGeometry,material:THREE.Material,count:number)=>{const mesh=new THREE.InstancedMesh(geometry,material,capacityFor(count));mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(capacityFor(count)*3),3);return mesh;};
 const leafGeometry=LEAF_GEOMETRY[1].clone();leafGeometry.setAttribute('aCrownOut',new THREE.InstancedBufferAttribute(new Float32Array(capacityFor(leaves)*3),3));
 const batch={group:new THREE.Group(),leaves:make(leafGeometry,materials.leaf,leaves),florets:make(CARD_GEOMETRY,materials.cluster,florets),cores:make(CORE_GEOMETRY[HYDRANGEA_SPECS[cultivar].head.shape][1],materials.core,cores),stems:new THREE.Mesh(new THREE.BufferGeometry(),materials.stem),key:''};
 batch.group.add(batch.leaves,batch.florets,batch.cores,batch.stems);
 return batch;
}
function disposeBatch(batch:FarBatch){
 batch.leaves.geometry.dispose();batch.stems.geometry.dispose();
 for(const m of [batch.leaves,batch.florets,batch.cores])m.dispose();
 batch.group.removeFromParent();
}
/** World matrices for every far plant of a cultivar (its placement times its cached plant-inch matrices), and its stems
 * merged in world feet. */
function fillBatch(batch:FarBatch,cultivar:HydrangeaCultivar,members:{o:LandscapeObject;parts:PlantParts;matrix:THREE.Matrix4}[],shadows:boolean){
 const m=new THREE.Matrix4(),out=batch.leaves.geometry.getAttribute('aCrownOut') as THREE.InstancedBufferAttribute,at={leaves:0,florets:0,cores:0};
 const copy=(mesh:THREE.InstancedMesh,local:Float32Array,colors:Float32Array,P:THREE.Matrix4,start:number)=>{
  const n=local.length/16,target=mesh.instanceMatrix.array as Float32Array;
  for(let i=0;i<n;i++)m.fromArray(local,i*16).premultiply(P).toArray(target,(start+i)*16);
  (mesh.instanceColor!.array as Float32Array).set(colors,start*3);
  return n;
 };
 const positions:number[]=[],index:number[]=[],v=new THREE.Vector3();
 for(const {parts,matrix} of members){
  const leaves=copy(batch.leaves,parts.leaf,parts.leafColor,matrix,at.leaves);(out.array as Float32Array).set(parts.leafOut,at.leaves*3);
  const florets=copy(batch.florets,parts.floret,parts.floretColor,matrix,at.florets),cores=copy(batch.cores,parts.core,parts.coreColor,matrix,at.cores);
  at.leaves+=leaves;at.florets+=florets;at.cores+=cores;
  const p=parts.stems.getAttribute('position'),base=positions.length/3,idx=parts.stems.index!;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);positions.push(v.x,v.y,v.z);}
  for(let i=0;i<idx.count;i++)index.push(base+idx.getX(i));
 }
 batch.stems.geometry.dispose();
 const stems=new THREE.BufferGeometry();stems.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));stems.setIndex(index);stems.computeVertexNormals();stems.computeBoundingSphere();batch.stems.geometry=stems;
 const named=members.length?'lod2':'idle';
 for(const [key,mesh] of [['leaves',batch.leaves],['florets',batch.florets],['cores',batch.cores]] as const){
  mesh.count=at[key];mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor!.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
  mesh.name=`landscape-hydrangea-${cultivar}-${key}-${named}`;mesh.userData={landscapeIds:members.map(x=>x.o.id)};mesh.receiveShadow=true;mesh.raycast=NO_RAYCAST;
 }
 out.needsUpdate=true;
 batch.leaves.castShadow=shadows;batch.florets.castShadow=false;batch.cores.castShadow=false;
 batch.stems.name=`landscape-hydrangea-${cultivar}-stems`;batch.stems.receiveShadow=true;batch.stems.raycast=NO_RAYCAST;
}

/**
 * Hydrangeas drawn from their botany (hydrangeaModel.ts): canes, opposite real-size leaves with a photo upper side and
 * underside, and heads of real-photo florets around a core. Distant plants use fewer, larger leaf and floret-cluster
 * cards. Loads its two atlases on first use.
 */
export default function Hydrangeas3D({data,objects,lods,seats}:{data:DeckData;objects:LandscapeObject[];lods:Map<string,0|1|2>;seats:Map<string,PlantSeat>}){
 const showcase=useSyncExternalStore(subscribeShowcase,()=>getShowcaseFlags().quality,()=>false),q=useRenderQuality(),invalidate=useThree(s=>s.invalidate),fixtures=useContext(FixtureLightContext);
 const [floretAtlas,leafAtlas]=useTexture([HYDRANGEA_TEXTURES.florets,HYDRANGEA_TEXTURES.leaves]);
 const materials=useMemo(()=>new Map(HYDRANGEA_CULTIVARS.map(c=>[c,cultivarMaterials(c,floretAtlas,leafAtlas)])),[floretAtlas,leafAtlas]);
 const store=useMemo<Store>(()=>({nodes:new Map(),batches:new Map()}),[materials]);
 useLayoutEffect(()=>{
  // The atlases' own settings match their cells' (three caches uploads by them), so each atlas goes to the GPU once.
  for(const t of [floretAtlas,leafAtlas]){t.anisotropy=q.anisotropy;t.needsUpdate=true;}
  for(const set of materials.values())for(const m of materialList(set)){if(fixtures)litMaterial(m,fixtures);if(m.alphaTest>0){m.alphaToCoverage=q.msaaSamples>0;m.needsUpdate=true;}if(m.map){m.map.anisotropy=q.anisotropy;m.map.needsUpdate=true;}}
 },[materials,floretAtlas,leafAtlas,fixtures,q.msaaSamples,q.anisotropy]);
 // Materials outlive the plants that use them; when the view closes (or the atlases change) the plants built on them go too.
 useEffect(()=>()=>{
  for(const node of store.nodes.values())disposeNode(node);store.nodes.clear();
  for(const batch of store.batches.values())disposeBatch(batch);store.batches.clear();
  for(const set of materials.values())for(const m of materialList(set)){m.map?.dispose();m.dispose();}
 },[materials,store]);
 const shown=useMemo(()=>objects.filter(o=>hydrangeaCultivar(o.speciesRecord?.id)),[objects]);
 const [batchGroups,setBatchGroups]=useState<THREE.Group[]>([]);
 // Each plant's node exists before it mounts; its levels are made below, when it is shown at them.
 const placed=useMemo(()=>shown.map(o=>{
  let node=store.nodes.get(o);
  if(!node){node={group:new THREE.Group(),plant:buildHydrangea(hydrangeaCultivar(o.speciesRecord?.id)!,o),levels:[]};node.group.matrixAutoUpdate=false;node.group.userData={landscapeIds:[o.id]};node.group.add(pickBox(o));store.nodes.set(o,node);}
  return {o,node};
 }),[shown,store]);
 useLayoutEffect(()=>{
  forget(store,new Set(shown));
  // Light through a leaf needs the leaf's own shadow: none on the shadowless tier.
  const shadows=q.tier!=='constrained';
  for(const set of materials.values())leafTransmitUniform(set.leaf).value=shadows?1:0;
  const far=new Map<HydrangeaCultivar,{o:LandscapeObject;parts:PlantParts;matrix:THREE.Matrix4}[]>();
  for(const {o,node} of placed){
   const cultivar=node.plant.cultivar,lod=showcase?0:(lods.get(o.id)??2),matrix=plantMatrix(data,o,seats);
   node.group.matrix.copy(matrix);node.group.matrixWorldNeedsUpdate=true;
   if(lod===2){const list=far.get(cultivar)??[];list.push({o,parts:node.far??=plantParts(o,node.plant,2),matrix});far.set(cultivar,list);}
   const set=materials.get(cultivar)!,level=lod<2?node.levels[lod]??=buildLevel(o,node.plant,lod,set):undefined;
   for(const [i,other] of node.levels.entries())if(other){
    const active=i===lod;
    // Photo mode waits while anything named '-lod2' is in the scene, so a hidden level is named 'idle'.
    for(const m of other.meshes){m.visible=active;if(m.parent!==node.group)node.group.add(m);}
    other.leaves.name=`landscape-hydrangea-${cultivar}-leaves-${active?'lod'+i:'idle'}`;
    other.florets.name=`landscape-hydrangea-${cultivar}-florets-${active?'lod'+i:'idle'}`;other.cores.name=`landscape-hydrangea-${cultivar}-cores-${active?'lod'+i:'idle'}`;
    other.stems.name=`landscape-hydrangea-${cultivar}-stems`;
   }
   if(!level)continue;
   // Leaves and head cores cast; the florets, thousands of small alpha-tested cards over the cores, do not.
   level.leaves.castShadow=shadows;level.florets.castShadow=false;level.cores.castShadow=shadows;
   for(const m of [level.leaves,level.florets,level.cores,level.stems])m.receiveShadow=true;
  }
  for(const cultivar of HYDRANGEA_CULTIVARS){
   const members=far.get(cultivar)??[],old=store.batches.get(cultivar);
   if(!members.length&&!old)continue;
   const count=(pick:(p:PlantParts)=>Float32Array)=>members.reduce((n,x)=>n+pick(x.parts).length/16,0);
   const batch=farBatch(cultivar,materials.get(cultivar)!,count(p=>p.leaf),count(p=>p.floret),count(p=>p.core),old);
   // Rebuilt only when its plants, their placements or the shadow tier change, not on every level change elsewhere.
   const key=members.map(x=>x.o.id+':'+x.matrix.elements.join(',')).join('|')+(shadows?'+s':'');
   if(batch!==old||batch.key!==key){fillBatch(batch,cultivar,members,shadows);batch.key=key;}
   if(batch!==old)store.batches.set(cultivar,batch);
  }
  const groups=[...store.batches.values()].map(b=>b.group);
  setBatchGroups(prev=>prev.length===groups.length&&prev.every((g,i)=>g===groups[i])?prev:groups);
  invalidate();
 },[placed,shown,store,lods,showcase,data,seats,materials,q.tier,invalidate]);
 return <group name="landscape-hydrangeas">{placed.map(({o,node})=><primitive key={o.id} object={node.group} dispose={null}/>)}{batchGroups.map(g=><primitive key={g.uuid} object={g} dispose={null}/>)}</group>;
}
