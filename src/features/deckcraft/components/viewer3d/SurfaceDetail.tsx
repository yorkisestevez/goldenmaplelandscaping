import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {DeckData} from '../../types';
import type {LandscapeObject,LandscapePoint} from '../../landscapeTypes';
import {landscapeSurfaceCells} from '../../landscapeSurfaceGeometry';
import {landscapeSurfaceDepth,puttingCupWorld} from '../../landscapeSurfaces';
import {useRenderQuality} from './SceneRenderQuality';
import {useFixtureLit} from './fixtureLighting';
import {addMaterialPatch} from './materialPatches';
import {coverInstances,detailProfile,detailHash,type DetailKind} from './groundCoverDetail';

const geometries=new Map<DetailKind,{geometry:THREE.BufferGeometry;refs:number}>();
function acquireGeometry(kind:DetailKind){let item=geometries.get(kind);if(!item){
 let g:THREE.BufferGeometry;
 if(kind==='blade'){
  const positions:number[]=[],colors:number[]=[];
  for(let b=0;b<9;b++){const a=b*2.399,cs=Math.cos(a),sn=Math.sin(a),ox=Math.cos(a)*.6,oz=Math.sin(a)*.28,h=.65+b*.045;for(let j=0;j<3;j++){const v=(k:number,side:number)=>{const t=k/3,w=.085*(1-t)+.003,x=side*w,z=t*t*.3;return [ox+cs*x-sn*z,t*h,oz+sn*x+cs*z];};for(const [k,s] of [[j,-1],[j,1],[j+1,1],[j,-1],[j+1,1],[j+1,-1]]){positions.push(...v(k,s));const c=.65+.35*k/3;colors.push(c,c,c*.94);}}}
  g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
 }else{
  g=kind==='chip'?new THREE.BoxGeometry(1,.12,.18):new THREE.SphereGeometry(.5,kind==='round'?12:7,kind==='round'?8:4);
  const a=g.getAttribute('position');for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i),n=(kind==='round'?.96:.85)+detailHash(Math.round(x*100),Math.round(z*100),Math.round(y*100))*(kind==='round'?.08:.3);a.setXYZ(i,x*n,y*n,z*n);}g.computeVertexNormals();
 }
 item={geometry:g,refs:0};geometries.set(kind,item);
 }item.refs++;const value=item;return {geometry:value.geometry,dispose:()=>{if(--value.refs===0){value.geometry.dispose();geometries.delete(kind);}}};}

export default function SurfaceDetail({data,object,polys}:{data:DeckData;object:LandscapeObject;polys:LandscapePoint[][]}){
 const q=useRenderQuality(),camera=useThree(s=>s.camera),invalidate=useThree(s=>s.invalidate),ref=useRef<THREE.InstancedMesh>(null),last=useRef('');
 const [view,setView]=useState({x:0,z:0,height:10000}),scratch=useMemo(()=>({p:new THREE.Vector3(),d:new THREE.Vector3()}),[]);
 useFrame(()=>{camera.getWorldPosition(scratch.p);camera.getWorldDirection(scratch.d);const reach=Math.min(15,Math.max(0,scratch.p.y/Math.max(.25,-scratch.d.y))),x=Math.round((scratch.p.x+scratch.d.x*reach)/3)*36,z=Math.round((scratch.p.z+scratch.d.z*reach)/3)*36,height=Math.round(scratch.p.y*2)*6,key=x+':'+z+':'+height;if(key!==last.current){last.current=key;setView({x,z,height});}});
 const radius=q.tier==='high'?216:q.tier==='balanced'?144:84,weights=(data.landscapeObjects??[]).filter(o=>o.enabled&&o.kind==='bed').map(o=>({id:o.id,w:1/(1+(Math.max(0,Math.hypot(o.xIn-view.x,o.zIn-view.z)-Math.hypot(o.widthIn,o.depthIn)/2)/60)**4)})),weight=weights.find(o=>o.id===object.id)?.w??0,budget=Math.max(1,Math.floor((q.tier==='high'?65000:q.tier==='balanced'?22000:6000)*weight/Math.max(1,weights.reduce((s,o)=>s+o.w,0)))),profile=detailProfile(object.assetId);
 const cells=useMemo(()=>landscapeSurfaceCells(data,polys,object),[data,polys,object]);
 const instances=useMemo(()=>Math.abs(view.height-(cells[0]?.plane.constant??0)-(cells[0]?.plane.x??0)*view.x-(cells[0]?.plane.z??0)*view.z)>radius*1.5?[]:coverInstances(object.assetId,polys,cells,landscapeSurfaceDepth(object),view,radius,budget,(object.puttingCups??[]).map(c=>puttingCupWorld(object,c))),[object,polys,cells,view,radius,budget]);
 const resource=useMemo(()=>acquireGeometry(profile.kind),[profile.kind]);useEffect(()=>()=>resource.dispose(),[resource]);
 const appearance=object.assetId==='mulch-bed'?'#8a4e2c':object.assetId==='black-mulch-bed'?'#241f1c':object.assetId==='cedar-mulch-bed'?'#b56b38':profile.color;
 const material=useMemo(()=>{
  const m=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:profile.kind==='blade',roughness:profile.kind==='round'?.87:.97,flatShading:profile.kind==='angular',side:profile.kind==='blade'?THREE.DoubleSide:THREE.FrontSide});
  addMaterialPatch(m,{key:'cover-detail-dither-'+profile.kind+'-'+radius,apply:shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>\nfloat detailFade=1.-smoothstep(${(radius/12*.55).toFixed(2)},${(radius/12*1.3).toFixed(2)},length(vViewPosition));\nif(fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)>detailFade)discard;`);if(profile.kind==='chip'){shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vChipUv;').replace('#include <uv_vertex>','#include <uv_vertex>\nvChipUv=uv;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vChipUv;').replace('#include <map_fragment>','#include <map_fragment>\nfloat grain=sin(vChipUv.x*110.+sin(vChipUv.y*13.)*2.);diffuseColor.rgb*=.9+.1*grain;');}if(profile.kind==='blade')shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\n reflectedLight.indirectDiffuse+=diffuseColor.rgb*.12;');}});return m;
 },[profile.kind,radius]);useFixtureLit(material);useEffect(()=>()=>material.dispose(),[material]);
 useLayoutEffect(()=>{const mesh=ref.current;if(!mesh)return;const matrix=new THREE.Matrix4(),up=new THREE.Vector3(0,1,0),normal=new THREE.Vector3(),rotation=new THREE.Quaternion(),yaw=new THREE.Quaternion(),base=new THREE.Color(appearance);instances.forEach((p,i)=>{normal.set(p.nx,1,p.nz).normalize();rotation.setFromUnitVectors(up,normal);yaw.setFromAxisAngle(up,p.yaw);rotation.multiply(yaw);matrix.compose(new THREE.Vector3(p.x/12,p.y/12,p.z/12),rotation,new THREE.Vector3(p.width/12,p.height/12,p.depth/12));mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,base.clone().multiplyScalar(p.tone).multiply(new THREE.Color().setRGB(1+p.warm*.12,1,1-p.warm*.12)));});mesh.count=instances.length;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();invalidate();},[instances,appearance,invalidate]);
 useEffect(()=>{const mesh=ref.current;return ()=>mesh?.dispose();},[budget,resource,material]);
 return <instancedMesh ref={ref} args={[resource.geometry,material,budget]} dispose={null} name={'surface-detail-'+object.id} receiveShadow raycast={()=>{}} userData={{coversGround:false,renderOnly:true,materialId:object.assetId}}/>;
}
