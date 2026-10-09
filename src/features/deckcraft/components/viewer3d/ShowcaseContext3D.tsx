import {useEffect,useLayoutEffect,useMemo,useState} from 'react';
import {useThree} from '@react-three/fiber';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import type {DeckData} from '../../types';
import {getShowcaseFlags,getShowcaseServerFlags,subscribeShowcase} from './showcaseMode';
import {useSyncExternalStore} from 'react';
import {SHOWCASE_TREES,buildShowcaseContext,type ContextTree,type GroundGrid,type GroundVertex,type NeighbourHome} from './showcaseContext';

function noRay(){/* Presentation dressing is not pickable. */}

function fenceGeometry(runs:[number,number,number,number][],baseY:number){
 const boards:THREE.BufferGeometry[]=[],rand=(()=>{let s=7>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};})(),col=new THREE.Color();
 const add=(g:THREE.BufferGeometry,c:THREE.Color)=>{
  const n=g.attributes.position.count,colors=new Float32Array(n*3);
  for(let i=0;i<n;i++){colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;}
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));boards.push(g.toNonIndexed());g.dispose();
 };
 for(const [ax,az,bx,bz] of runs){
  const len=Math.hypot(bx-ax,bz-az),ang=Math.atan2(bz-az,bx-ax),posts=Math.max(1,Math.ceil(len/8));
  for(let i=0;i<=posts;i++){const t=i/posts,g=new THREE.BoxGeometry(.32,6.35,.32);g.translate(ax+(bx-ax)*t,baseY+3.15,az+(bz-az)*t);add(g,col.set('#6b4a32'));}
  for(let k=0;k<11;k++){const g=new THREE.BoxGeometry(len+.04,.42,.08);g.rotateY(-ang);g.translate((ax+bx)/2,baseY+.28+k*.5,(az+bz)/2);col.set('#a8754c').offsetHSL(0,(rand()-.5)*.06,(rand()-.5)*.07);add(g,col.clone());}
  const cap=new THREE.BoxGeometry(len+.08,.14,.42);cap.rotateY(-ang);cap.translate((ax+bx)/2,baseY+6.15,(az+bz)/2);add(cap,col.set('#5e412c'));
 }
 let n=0;for(const g of boards)n+=g.attributes.position.count;
 const pos=new Float32Array(n*3),norm=new Float32Array(n*3),color=new Float32Array(n*3);let o=0;
 for(const g of boards){const count=g.attributes.position.count;pos.set(g.attributes.position.array as Float32Array,o*3);norm.set(g.attributes.normal.array as Float32Array,o*3);color.set(g.attributes.color.array as Float32Array,o*3);o+=count;g.dispose();}
 const merged=new THREE.BufferGeometry();merged.setAttribute('position',new THREE.BufferAttribute(pos,3));merged.setAttribute('normal',new THREE.BufferAttribute(norm,3));merged.setAttribute('color',new THREE.BufferAttribute(color,3));return merged;
}

function Fence({runs,baseY}:{runs:[number,number,number,number][];baseY:number}){
 const geometry=useMemo(()=>fenceGeometry(runs,baseY),[runs,baseY]);
 const material=useMemo(()=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:.84,metalness:0}),[]);
 useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
 return <mesh name="showcase-fence" geometry={geometry} material={material} castShadow receiveShadow raycast={noRay}/>;
}

function neighbourMaterial(){
 const eveningUniform={value:0};
 const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.94,metalness:0,vertexColors:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 material.userData.evening=eveningUniform;
 material.customProgramCacheKey=()=>'dc-neighbour-yard';
 material.onBeforeCompile=shader=>{
  shader.uniforms.uEvening=eveningUniform;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float drive;\nattribute float fade;\nvarying float vDrive;\nvarying float vFade;\nvarying vec2 vYard;').replace('#include <begin_vertex>','#include <begin_vertex>\n  vDrive=drive;vFade=fade;vYard=position.xz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vDrive;\nvarying float vFade;\nvarying vec2 vYard;\nuniform float uEvening;').replace('#include <color_fragment>',`#include <color_fragment>
    float mow=sin(vYard.x*.62+vYard.y*.18)*.5+.5;
    diffuseColor.rgb*=mix(.9,1.07,mow);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.17,.18),clamp(vDrive,0.,1.));
    diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.50,.56,.48),vec3(.07,.10,.15),uEvening),clamp(vFade,0.,1.)*(1.-clamp(vDrive,0.,1.)));`);
 };
 return material;
}

function groundGeometry(grid:GroundGrid){
 const {nx,nz,vertices}=grid,positions:number[]=[],colors:number[]=[],drives:number[]=[],fades:number[]=[];
 const a=new THREE.Color('#5c763c'),b=new THREE.Color('#6d8748'),c=new THREE.Color('#7c8650'),tone=new THREE.Color();
 const push=(v:GroundVertex)=>{positions.push(v.x,v.y,v.z);tone.copy(a).lerp(b,v.shade).lerp(c,v.shade*v.shade);colors.push(tone.r,tone.g,tone.b);drives.push(v.drive);fades.push(v.fade);};
 const stride=nx+1,index=(ix:number,iz:number)=>iz*stride+ix;
 for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
  const i00=vertices[index(ix,iz)],i10=vertices[index(ix+1,iz)],i01=vertices[index(ix,iz+1)],i11=vertices[index(ix+1,iz+1)];
  for(const v of [i00,i01,i10,i10,i01,i11])push(v);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.setAttribute('drive',new THREE.Float32BufferAttribute(drives,1));
 geometry.setAttribute('fade',new THREE.Float32BufferAttribute(fades,1));
 geometry.computeVertexNormals();
 return geometry;
}

function NeighbourGround({grids,evening}:{grids:GroundGrid[];evening:boolean}){
 const material=useMemo(neighbourMaterial,[]);
 const geometries=useMemo(()=>grids.map(groundGeometry),[grids]);
 useEffect(()=>()=>{for(const g of geometries)g.dispose();material.dispose();},[geometries,material]);
 material.userData.evening.value=evening?1:0;
 return <group name="showcase-neighbour-ground">{geometries.map((geometry,i)=><mesh key={grids[i].name} name={grids[i].name} geometry={geometry} material={material} receiveShadow raycast={noRay}/>)}</group>;
}

function gableGeometry(w:number,d:number,h:number,rise:number){
 const g=new THREE.BufferGeometry(),x=w/2+.04,y0=h,y1=h+rise,z0=-d/2,z1=d/2;
 g.setAttribute('position',new THREE.Float32BufferAttribute([-x,y0,z0,-x,y1,0,-x,y0,z1,x,y0,z0,x,y0,z1,x,y1,0],3));
 g.computeVertexNormals();return g;
}

function NeighbourHouse({home,evening}:{home:NeighbourHome;evening:boolean}){
 const rise=Math.min(home.w,home.d)*.22,slope=Math.atan2(rise,home.d/2),run=Math.hypot(home.d/2,rise),wallY=.7+home.h/2;
 const gable=useMemo(()=>gableGeometry(home.w,home.d,home.h+.7,rise),[home.w,home.d,home.h,rise]);
 useEffect(()=>()=>gable.dispose(),[gable]);
 const glass=evening?'#ffd7a8':'#7f97a8',glow=evening?1.7:0;
 const windows:{position:[number,number,number];frame:[number,number,number];pane:[number,number,number];out:[number,number,number]}[]=[];
 const cols=home.w>40?4:3,rows=home.floors,pane=(w:number,h:number,depth:number):[number,number,number]=>[w,h,depth];
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  if(row===0&&col===Math.floor(cols/2))continue;
  const x=-home.w/2+home.w*(col+.5)/cols,y=.7+(row===0?5.2:home.h*.72);
  windows.push({position:[x,y,-home.d/2-.08],frame:pane(3.5,4.8,.12),pane:pane(2.9,4.1,.08),out:[0,0,-1]});
  windows.push({position:[x,y,home.d/2+.08],frame:pane(3.5,4.8,.12),pane:pane(2.9,4.1,.08),out:[0,0,1]});
 }
 for(const side of [-1,1] as const)for(let i=0;i<2;i++)windows.push({position:[side*(home.w/2+.08),.7+(i===0?5.2:home.h*.72),-home.d*.2+i*home.d*.4],frame:pane(.12,4.4,3),pane:pane(.08,3.7,2.4),out:[side,0,0]});
 return <group name="showcase-neighbour" position={[home.x,0,home.z]} rotation={[0,home.yaw,0]}>
  <mesh position={[0,.35,0]} receiveShadow raycast={noRay}><boxGeometry args={[home.w+.5,.7,home.d+.5]}/><meshStandardMaterial color="#8a877f" roughness={.95}/></mesh>
  <mesh position={[0,wallY,0]} receiveShadow raycast={noRay}><boxGeometry args={[home.w,home.h,home.d]}/><meshStandardMaterial color={home.siding} roughness={.88}/></mesh>
  <mesh position={[0,home.h+.7+rise/2,-home.d/4]} rotation={[slope,0,0]} receiveShadow raycast={noRay}><boxGeometry args={[home.w+1.5,.28,run+.4]}/><meshStandardMaterial color={home.roof} roughness={.8}/></mesh>
  <mesh position={[0,home.h+.7+rise/2,home.d/4]} rotation={[-slope,0,0]} receiveShadow raycast={noRay}><boxGeometry args={[home.w+1.5,.28,run+.4]}/><meshStandardMaterial color={home.roof} roughness={.8}/></mesh>
  <mesh geometry={gable} raycast={noRay}><meshStandardMaterial color={home.siding} roughness={.9}/></mesh>
  <mesh position={[0,home.h+.55,-home.d/2-.02]} raycast={noRay}><boxGeometry args={[home.w+1.6,.28,.35]}/><meshStandardMaterial color={home.trim} roughness={.7}/></mesh>
  <mesh position={[0,1.1,-home.d/2-.08]} raycast={noRay}><boxGeometry args={[3.4,7.1,.12]}/><meshStandardMaterial color="#4a4038" roughness={.7}/></mesh>
  {windows.map((win,i)=><group key={i} position={win.position}>
   <mesh raycast={noRay}><boxGeometry args={win.frame}/><meshStandardMaterial color="#2c3134" roughness={.55}/></mesh>
   <mesh position={[win.out[0]*.08,0,win.out[2]*.08]} raycast={noRay}><boxGeometry args={win.pane}/><meshStandardMaterial color={glass} emissive={glass} emissiveIntensity={glow} roughness={.18} metalness={.05}/></mesh>
  </group>)}
  {home.chimney&&<mesh position={[home.w*.28,home.h+.7+rise*.55,home.d*.12]} raycast={noRay}><boxGeometry args={[2.1,rise+2.4,2.1]}/><meshStandardMaterial color="#6a6560" roughness={.9}/></mesh>}
  {home.garage&&<group position={[home.w/2+7,0,home.d*.08]}>
   <mesh position={[0,5.2,0]} receiveShadow raycast={noRay}><boxGeometry args={[13,10.4,home.d*.62]}/><meshStandardMaterial color={home.siding} roughness={.88}/></mesh>
   <mesh position={[0,10.7,0]} raycast={noRay}><boxGeometry args={[14.2,.4,home.d*.62+1]}/><meshStandardMaterial color={home.roof} roughness={.8}/></mesh>
   <mesh position={[0,3.3,-home.d*.31-.08]} raycast={noRay}><boxGeometry args={[8.5,6.4,.1]}/><meshStandardMaterial color="#3a3e42" roughness={.6}/></mesh>
  </group>}
 </group>;
}

function TreeSpecies({scene,items}:{scene:THREE.Object3D;items:ContextTree[]}){
 const invalidate=useThree(s=>s.invalidate);
 const prepared=useMemo(()=>{
  scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const normalization=new THREE.Matrix4().makeScale(1/Math.max(size.y,.0001),1/Math.max(size.y,.0001),1/Math.max(size.y,.0001)).multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
  const meshes:THREE.Mesh[]=[];scene.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
  return {normalization,meshes};
 },[scene]);
 return <group name="showcase-tree-species">{prepared.meshes.map((mesh,index)=><TreeMesh key={index} mesh={mesh} items={items} normalization={prepared.normalization} invalidate={invalidate}/>)}</group>;
}
function TreeMesh({mesh,items,normalization,invalidate}:{mesh:THREE.Mesh;items:ContextTree[];normalization:THREE.Matrix4;invalidate:()=>void}){
 const material=useMemo(()=>{const source=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;return source.clone();},[mesh]);
 const instance=useMemo(()=>new THREE.InstancedMesh(mesh.geometry,material,items.length),[mesh.geometry,material,items.length]);
 useEffect(()=>()=>{material.dispose();},[material]);
 useLayoutEffect(()=>{
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),s=new THREE.Vector3(),p=new THREE.Vector3();
  items.forEach((tree,i)=>{q.setFromAxisAngle(up,tree.rot);s.set(tree.heightFt,tree.heightFt,tree.heightFt);p.set(tree.x,0,tree.z);instance.setMatrixAt(i,matrix.compose(p,q,s).multiply(normalization).multiply(mesh.matrixWorld));});
  instance.count=items.length;instance.instanceMatrix.needsUpdate=true;instance.computeBoundingSphere();
  instance.name='showcase-tree-line';instance.receiveShadow=true;instance.castShadow=false;instance.raycast=noRay;instance.userData={presentationOnly:true,coversGround:false};
  invalidate();
 },[instance,items,mesh,normalization,invalidate]);
 return <primitive object={instance} raycast={noRay}/>;
}

function TreeLine({trees,showcase}:{trees:ContextTree[];showcase:boolean}){
 const lod=showcase?0:1,deciduous=trees.filter(t=>!t.conifer),conifer=trees.filter(t=>t.conifer);
 const [models,setModels]=useState<{deciduous:THREE.Object3D;conifer:THREE.Object3D}|null>(null);
 // Load outside render. useGLTF updates the still-export progress store during render.
 useEffect(()=>{
  let live=true;setModels(null);const loader=new GLTFLoader();
  Promise.all([loader.loadAsync(SHOWCASE_TREES.deciduous[lod]),loader.loadAsync(SHOWCASE_TREES.conifer[lod])]).then(([broadleaf,evergreen])=>{if(live)setModels({deciduous:broadleaf.scene,conifer:evergreen.scene});});
  return ()=>{live=false;};
 },[lod]);
 if(!models)return null;
 return <group name="showcase-tree-line" userData={{style:'sugar-maple-and-white-pine',presentationOnly:true}}>
  {deciduous.length>0&&<TreeSpecies scene={models.deciduous} items={deciduous}/>}
  {conifer.length>0&&<TreeSpecies scene={models.conifer} items={conifer}/>}
 </group>;
}

export default function ShowcaseContext3D({data}:{data:DeckData}){
 const context=useSyncExternalStore(subscribeShowcase,()=>getShowcaseFlags().context,()=>false);
 const showcase=useSyncExternalStore(subscribeShowcase,()=>getShowcaseFlags().quality,()=>false);
 const model=useMemo(()=>context?buildShowcaseContext(data):null,[context,data.landscapeObjects,data.yardFeatures,data.width,data.length,data.scenePresentation,data.terrainConfig]);
 if(!context||!model)return null;
 const evening=data.sceneLighting==='Evening';
 return <group name="showcase-context" scale={12} userData={{presentationOnly:true}}>
  <Fence runs={model.runs} baseY={model.baseY}/>
  <NeighbourGround grids={model.ground} evening={evening}/>
  <group name="showcase-neighbours">{model.homes.map((home,i)=><NeighbourHouse key={i} home={home} evening={evening}/>)}</group>
  <TreeLine trees={model.trees} showcase={showcase}/>
 </group>;
}
