import {useLayoutEffect,useMemo} from 'react';
import * as THREE from 'three';
import type {DeckData,YardFeature} from '../../types';

/** Irregular stacked boulders for armour-stone retaining walls: each wall run is laid in courses of large natural
 * stones (varied length, height, depth, yaw and tint, grey to tan), so the face reads as a real armour-stone wall
 * rather than a flat band. World units are feet; the wall's own body stays underneath as the structure. */
const rnd=(seed:number)=>{let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};};
function boulderGeometry(){
 const g=new THREE.IcosahedronGeometry(.5,3),p=g.attributes.position as THREE.BufferAttribute,v=new THREE.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=1+.16*Math.sin(v.x*7.1+v.y*3.3)+.12*Math.sin(v.z*8.7-v.x*4.1)+.07*Math.sin(v.y*13+v.z*11);
  v.multiplyScalar(n);v.y=Math.sign(v.y)*Math.min(Math.abs(v.y),.4);// flattened beds and tops, like quarried armour stone
  // facet: snap a little toward planes
  v.x=Math.round(v.x*9)/9*.35+v.x*.65;v.z=Math.round(v.z*9)/9*.35+v.z*.65;p.setXYZ(i,v.x,v.y,v.z);}
 g.computeVertexNormals();return g;
}
interface Stone {x:number;y:number;z:number;sx:number;sy:number;sz:number;yaw:number;tilt:number;tint:string}
const TINTS=['#5f5a52','#6b645a','#736a5e','#5a5753','#7a7064','#655e55','#6e675f'];
export function armourStones(walls:YardFeature[],groundFt:number):Stone[]{
 const out:Stone[]=[];
 for(const [w,wall] of walls.entries()){
  const path=(wall.wallPath??[{x:-wall.widthFt*6,y:0},{x:wall.widthFt*6,y:0}]),rot=(wall.rotationDeg??0)*Math.PI/180,c=Math.cos(rot),s=Math.sin(rot);
  const world=path.map(p=>({x:wall.xFt+(p.x*c-p.y*s)/12,z:wall.zFt+(p.x*s+p.y*c)/12}));
  const hFt=wall.heightIn/12,courses=Math.max(1,Math.ceil(hFt/1.25)),r=rnd(9173+w*101);
  for(let k=1;k<world.length;k++){
   const a=world[k-1],b=world[k],len=Math.hypot(b.x-a.x,b.z-a.z),ux=(b.x-a.x)/len,uz=(b.z-a.z)/len,yaw=Math.atan2(-uz,ux);
   for(let course=0;course<=courses;course++){
    const top=course===courses,ch=hFt/courses;let t=course%2?-.9:0;
    while(t<len){
     const L=top?2.6+r()*2.4:2.8+r()*2.6;const mid=Math.min(len,Math.max(0,t+L/2));
     const back=top?-(.9+r()*.5):1.05+(r()-.5)*.3-course*.18; // positive = toward the house (the exposed face)
     const px=a.x+ux*mid+uz*back,pz=a.z+uz*mid-ux*back;
     const sy=top?1+r()*.5:ch*(1.3+r()*.35);
     out.push({x:px,y:groundFt+(top?hFt-sy*.3:ch*(course+.5)-.15),z:pz,sx:L*(1.02+r()*.12),sy,sz:top?2+r()*1.2:2.8+r()*.8,yaw:yaw+(r()-.5)*.22,tilt:(r()-.5)*.12,tint:TINTS[Math.floor(r()*TINTS.length)]});
     t+=L*(top?1.15+r()*.8:.86);
    }
   }
  }
 }
 return out;
}
/** Natural stone slab steps cut into an armour-stone bank: each tread is a solid stone block from the ground up to its
 * own top, running back into the bank, so the flight reads as stacked slabs set into the slope (no gap below). */
function StoneStepBlocks({data}:{data:DeckData}){
 const flights=(data.yardFeatures??[]).filter(f=>f.enabled&&f.stoneSteps&&f.productId&&(data.yardFeatures??[]).some(w=>w.productId==='armour-stone'));
 const base=(data.terrainConfig?.elevationIn??0)/12;
 return <group name="stone-step-blocks">{flights.flatMap(f=>{const s=f.stoneSteps!,n=s.riserCount,rise=((f.finishedElevationIn??0)-s.lowerElevationIn)/n/12,run=s.treadRunIn/12,rot=(f.rotationDeg??0)*Math.PI/180;
  // Local +z of a 180° flight runs toward the bank; treads climb from the lower edge.
  const dir=Math.cos(rot)<0?1:-1,z0=f.zFt-dir*f.depthFt/2;
  return Array.from({length:n},(_,k)=>{const top=rise*(k+1),zA=z0+dir*k*run,zB=z0+dir*(f.depthFt+1.5),zc=(zA+zB)/2,len=Math.abs(zB-zA),r=rnd(331+k);
   return <mesh key={f.id+k} position={[f.xFt+(r()-.5)*.25,base+top/2,zc]} rotation={[0,(r()-.5)*.05,0]} castShadow receiveShadow><boxGeometry args={[f.widthFt+.5+r()*.4,top,len]}/><meshStandardMaterial color={['#8b8378','#7d766c','#958c80'][k%3]} roughness={.92}/></mesh>;});
 })}</group>;
}
export default function ArmourStones3D({data}:{data:DeckData}){
 const walls=(data.yardFeatures??[]).filter(f=>f.enabled&&f.kind==='retaining-wall'&&f.productId==='armour-stone'&&!f.wallConstruction?.freestanding);
 const stones=useMemo(()=>armourStones(walls,(data.terrainConfig?.elevationIn??0)/12),[JSON.stringify(walls),data.terrainConfig?.elevationIn]);
 const geometry=useMemo(boulderGeometry,[]);
 const material=useMemo(()=>new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.93,metalness:0,flatShading:false}),[]);
 const mesh=useMemo(()=>new THREE.InstancedMesh(geometry,material,Math.max(1,stones.length)),[geometry,material,stones.length]);
 useLayoutEffect(()=>{const m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),col=new THREE.Color();
  stones.forEach((s,i)=>{e.set(s.tilt,s.yaw,s.tilt*.6);q.setFromEuler(e);m.compose(new THREE.Vector3(s.x,s.y,s.z),q,new THREE.Vector3(s.sx,s.sy,s.sz));mesh.setMatrixAt(i,m);mesh.setColorAt(i,col.set(s.tint));});
  mesh.count=stones.length;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='armour-stone-boulders';
 },[stones,mesh]);
 return <>{stones.length>0&&<primitive object={mesh} dispose={null}/>}<StoneStepBlocks data={data}/></>;
}
