import {ARMOUR_STEP_MARK} from './armourStepMark';
import type {ReactElement} from 'react';
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
/** Natural armour-slab steps as a crew sets them: one thick rectangular slab per riser, each bedded on the bank and
 * lapping 3 in onto the slab below, with boulder cheek walls both sides. Replaces the app's flat stone-step boxes
 * for flights coloured ARMOUR_STEP_MARK. */
const SLAB_TINTS=['#b5a48d','#ab9a84','#bcab94','#a69580'];
/** A split armour slab: subdivided box with chipped edges, a gently cupped top and per-vertex tan/grey mottling. */
function slabGeometry(w:number,t:number,l:number,seed:number,tint:string){
 const g=new THREE.BoxGeometry(w,t,l,10,3,8),p=g.attributes.position as THREE.BufferAttribute,r=rnd(seed),c=new THREE.Color(tint),col=new Float32Array(p.count*3),v=new THREE.Vector3();
 const ph=[r()*6,r()*6,r()*6];
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const ex=Math.abs(v.x)>w/2-.01,ez=Math.abs(v.z)>l/2-.01,top=v.y>t/2-.01;
  const n=Math.sin(v.x*5.3+ph[0])*Math.cos(v.z*4.1+ph[1])+.5*Math.sin((v.x+v.z)*11+ph[2]);
  if(ex)v.x+=Math.sign(v.x)*(.035*n+.02*Math.sin(v.y*40+v.z*9));
  if(ez)v.z+=Math.sign(v.z)*(.035*n+.02*Math.sin(v.y*40+v.x*9));
  if(top)v.y+=.018*n-((ex||ez)?.035:0);
  p.setXYZ(i,v.x,v.y,v.z);
  const k=.86+.14*n+(r()-.5)*.08,cool=.5+.5*Math.sin(v.x*2.2+v.z*1.7+ph[0]);
  col[i*3]=c.r*k*(1-.05*cool);col[i*3+1]=c.g*k*(1-.03*cool);col[i*3+2]=c.b*k*(1+.04*cool);}
 g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();return g;
}
function StoneStepBlocks({data}:{data:DeckData}){
 const flights=(data.yardFeatures??[]).filter(f=>f.enabled&&f.stoneSteps&&f.color===ARMOUR_STEP_MARK);
 const base=(data.terrainConfig?.elevationIn??0)/12;
 const geo=useMemo(boulderGeometry,[]);
 return <group name="armour-slab-steps">{flights.map(f=>{const s=f.stoneSteps!,n=s.riserCount,rise=((f.finishedElevationIn??0)-s.lowerElevationIn)/n/12,run=s.treadRunIn/12,rot=(f.rotationDeg??0)*Math.PI/180;
  const dir=Math.cos(rot)<0?1:-1,z0=f.zFt-dir*f.depthFt/2,w=Math.min(f.widthFt,5),lap=.25,thick=rise+.08,r=rnd(911);
  const parts:ReactElement[]=[];
  // Compacted bank under the flight: a dark soil wedge so no slab ever shows daylight beneath it.
  for(let k=0;k<n;k++){const zA=z0+dir*k*run,zB=z0+dir*(n*run+1);parts.push(<mesh key={'bank'+k} position={[f.xFt,base+(k*rise)/2,(zA+zB)/2]} receiveShadow><boxGeometry args={[w-.5,Math.max(.01,k*rise-.05),Math.abs(zB-zA)-.3]}/><meshStandardMaterial color="#3a332c" roughness={1}/></mesh>);}
  for(let k=0;k<n;k++){const top=base+rise*(k+1),zA=z0+dir*k*run-dir*.04,len=run+lap+.04,zc=zA+dir*len/2;
   parts.push(<mesh key={'slab'+k} geometry={slabGeometry(w,thick,len,77+k*13,SLAB_TINTS[k%4])} position={[f.xFt,top-thick/2,zc]} castShadow receiveShadow><meshStandardMaterial vertexColors color="#ffffff" roughness={.96} flatShading/></mesh>);
   // Cheek boulders, both sides, stepping up with the flight.
   for(const side of [-1,1]){const sz=1.5+r()*.5,h=rise*(k+1)+.6+r()*.3;
    parts.push(<mesh key={'cheek'+k+side} geometry={geo} position={[f.xFt+side*(w/2+sz*.42),base+h/2-.15,zA+dir*run/2]} rotation={[r()*.4,r()*6.28,r()*.4]} scale={[sz*.55,h/2+.1,run*.62+.1]} castShadow receiveShadow><meshStandardMaterial color={['#6b645a','#736a5e','#5f5a52'][(k+side+3)%3]} roughness={.95}/></mesh>);}
  }
  return <group key={f.id}>{parts}</group>;})}</group>;
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
