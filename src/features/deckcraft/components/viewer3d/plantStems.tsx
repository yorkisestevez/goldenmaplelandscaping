import {useEffect,useLayoutEffect,useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {DeckData} from '../../types';
import type {LandscapeObject} from '../../landscapeTypes';
import {landscapePlacement} from '../../landscapeModelRuntime';
import type {PlantSeat} from './plantSeating';
import {plantColorHash} from './foliageLighting';
import {useFixtureLit} from './fixtureLighting';
import {useRenderQuality} from './SceneRenderQuality';
import {plantSeasonLook,type Season} from './plantSeasons';

const STEMS=18,SEGMENTS=3,BASE_WIDTH=.022,TIP_WIDTH=.006;
/** A vase of bare stems in the plant's unit envelope (x, z within ±0.5, y 0–1): each stem leans out from the crown and
 * forks once, thinning to the tip. Built once and shared by every bare plant. */
export function stemClumpGeometry(){
 const positions:number[]=[];
 const prism=(a:THREE.Vector3,b:THREE.Vector3,wa:number,wb:number)=>{
  const along=b.clone().sub(a).normalize(),side=new THREE.Vector3(0,1,0).cross(along);
  if(side.lengthSq()<1e-6)side.set(1,0,0);side.normalize();const front=along.clone().cross(side).normalize();
  const ring=(p:THREE.Vector3,w:number)=>[side,front,side.clone().negate(),front.clone().negate()].map(d=>p.clone().addScaledVector(d,w/2));
  const ra=ring(a,wa),rb=ring(b,wb);
  for(let i=0;i<4;i++){const j=(i+1)%4;for(const v of [ra[i],ra[j],rb[j],ra[i],rb[j],rb[i]])positions.push(v.x,v.y,v.z);}
 };
 const curve=(from:THREE.Vector3,to:THREE.Vector3,lift:number)=>(t:number)=>from.clone().lerp(to,t).add(new THREE.Vector3(0,Math.sin(t*Math.PI)*lift,0));
 for(let s=0;s<STEMS;s++){
  const u=(s+.5)/STEMS,a=s*2.39996,h=.62+.38*((s*7919)%13)/12,reach=.22+.24*Math.sqrt(u);
  const base=new THREE.Vector3(Math.cos(a)*.05*u,0,Math.sin(a)*.05*u),tip=new THREE.Vector3(Math.cos(a)*reach,h,Math.sin(a)*reach);
  const path=curve(base,tip,-.06);
  for(let k=0;k<SEGMENTS;k++){const t0=k/SEGMENTS,t1=(k+1)/SEGMENTS;prism(path(t0),path(t1),BASE_WIDTH+(TIP_WIDTH-BASE_WIDTH)*t0,BASE_WIDTH+(TIP_WIDTH-BASE_WIDTH)*t1);}
  const fork=path(.55),b=a+(s%2?.7:-.7),twig=fork.clone().add(new THREE.Vector3(Math.cos(b)*.14,.18,Math.sin(b)*.14));
  prism(fork,twig,TIP_WIDTH*1.6,TIP_WIDTH*.8);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();return geometry;
}

/** Bare stems for the season's leafless shrubs and cut-back perennials: red-osier dogwood's red, ninebark's brown. */
export default function PlantStems({data,objects,seats,season}:{data:DeckData;objects:LandscapeObject[];seats:Map<string,PlantSeat>;season:Season}){
 const invalidate=useThree(s=>s.invalidate),quality=useRenderQuality();
 const bare=useMemo(()=>objects.flatMap(o=>{
  if(!o.enabled||o.kind!=='plant'||landscapePlacement(data,o).pendingReason)return [];
  const stems=plantSeasonLook(o.speciesRecord?.id,o.assetId,season).stems;
  return stems?[{object:o,stems}]:[];
 }),[data,objects,season]);
 const geometry=useMemo(()=>stemClumpGeometry(),[]);
 const material=useMemo(()=>new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.86,metalness:0}),[]);
 useFixtureLit(material);
 useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
 const mesh=useMemo(()=>new THREE.InstancedMesh(geometry,material,Math.max(1,bare.length)),[geometry,material,bare.length]);
 useEffect(()=>()=>mesh.dispose(),[mesh]);
 useLayoutEffect(()=>{
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),color=new THREE.Color();
  bare.forEach(({object:o,stems},i)=>{
   const placed=landscapePlacement(data,o);
   q.setFromAxisAngle(up,-o.rotationDeg*Math.PI/180+plantColorHash(o.id,5)*Math.PI*2);
   matrix.compose(new THREE.Vector3(placed.x,placed.y+(seats.get(o.id)?.dyIn??0)/12,placed.z),q,new THREE.Vector3(o.widthIn/12,o.heightIn*stems.height/12,o.depthIn/12));
   mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.set(stems.color).offsetHSL(0,0,(plantColorHash(o.id,7)-.5)*.06));
  });
  mesh.count=bare.length;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();
  mesh.name='landscape-bare-stems';mesh.castShadow=quality.tier!=='constrained';mesh.receiveShadow=true;
  mesh.userData={landscapeIds:bare.map(b=>b.object.id),pickPartIds:bare.map(b=>'landscape/'+b.object.id),genericVisualProxy:true};
  invalidate();
 },[data,bare,mesh,seats,invalidate,quality.tier]);
 if(!bare.length)return null;
 return <primitive object={mesh} dispose={null}/>;
}
