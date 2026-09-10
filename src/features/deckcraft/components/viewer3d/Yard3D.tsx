import {useEffect,useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {YardBox,YardModel,YardRole} from '../../yardModel';
import {yardPreviewBoxes} from './yardPreview';

function surfaceTexture(){const n=128,bytes=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const v=.77+.23*(Math.abs(Math.sin(x*127.1+y*311.7)*43758.5453)%1),i=(y*n+x)*4;bytes[i]=bytes[i+1]=bytes[i+2]=v*255;bytes[i+3]=255;}const t=new THREE.DataTexture(bytes,n,n);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.needsUpdate=true;return t;}
function boxGeometry(b:YardBox){
 if(b.role==='rock'){const g=new THREE.IcosahedronGeometry(1,1),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const k=.88+.12*(Math.abs(Math.sin(p.getX(i)*91+p.getY(i)*71+p.getZ(i)*31))%1);p.setXYZ(i,p.getX(i)*b.w*.5*k,p.getY(i)*b.h*.5*k,p.getZ(i)*b.d*.5*k);}g.translate(b.x,b.y,b.z);g.computeVertexNormals();return g;}
 if(b.polygon?.length){const shape=new THREE.Shape();b.polygon.forEach((p,i)=>i?shape.lineTo(p.x,p.y):shape.moveTo(p.x,p.y));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:b.h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,b.y+b.h/2,0);return g;}
 const g=new THREE.BoxGeometry(b.w,b.h,b.d);g.rotateY(b.angle||0);g.translate(b.x,b.y,b.z);return g.toNonIndexed();
}
function YardBatch({items,color,role}:{items:YardBox[];color:string;role:YardRole}){
 const geometry=useMemo(()=>{const pieces=items.map((b,i)=>{let g=boxGeometry(b);if(g.index){const converted=g.toNonIndexed();g.dispose();g=converted;}const p=g.getAttribute('position'),uv=new THREE.Float32BufferAttribute(new Float32Array(p.count*2),2),c=new THREE.Float32BufferAttribute(new Float32Array(p.count*3),3),shade=.93+.07*(Math.abs(Math.sin(i*89.3))%1);for(let v=0;v<p.count;v++){uv.setXY(v,p.getX(v)/18,p.getZ(v)/18);c.setXYZ(v,shade,shade,shade);}g.setAttribute('uv',uv);g.setAttribute('color',c);return g;});const merged=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());return merged;},[items]);
 const map=useMemo(surfaceTexture,[]),water=role==='water';
 useEffect(()=>()=>geometry?.dispose(),[geometry]);
 useEffect(()=>()=>map.dispose(),[map]);
 if(!geometry)return null;
 return <mesh name={`yard-${role}`} geometry={geometry} castShadow={!water} receiveShadow>{water?<meshPhysicalMaterial color={color} roughness={.12} metalness={.06} transmission={.4} transparent opacity={.67} thickness={8} ior={1.333} envMapIntensity={1.1} clearcoat={1} depthWrite={false}/>:<meshStandardMaterial color={color} vertexColors bumpMap={map} bumpScale={role==='rock'?.35:.08} roughness={role==='liner'?.65:.92} metalness={role==='pump'?.25:0}/>}</mesh>;
}
function WaterMotion({model}:{model:YardModel}){
 const invalidate=useThree(s=>s.invalidate);
 const jets=useMemo(()=>model.features.filter(f=>!f.excluded&&f.config.kind==='water-feature'&&f.config.productId==='fountain').map(f=>{const x=f.config.xFt*12,z=f.config.zFt*12,top=Math.max(f.topIn,...f.boxes.filter(b=>b.role==='rock').map(b=>b.y+b.h/2));const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(x,top,z),new THREE.Vector3(x,top+16,z),new THREE.Vector3(x+9,f.topIn-2,z+7));return new THREE.TubeGeometry(curve,24,.32,6,false);}),[model]);
 useEffect(()=>()=>jets.forEach(g=>g.dispose()),[jets]);
 // A static stream envelope remains compatible with demand rendering and exported conceptual water geometry.
 useEffect(()=>invalidate(),[model,invalidate]);
 return <group name="illustrative-fountain-streams">{jets.map((g,i)=><mesh key={i} geometry={g}><meshPhysicalMaterial color="#c4e5eb" transparent opacity={.64} transmission={.5} roughness={.12} ior={1.333} depthWrite={false}/></mesh>)}</group>;
}
export default function Yard3D({model,inspection=false}:{model:YardModel;inspection?:boolean}){
 const hidden=new Set<YardRole>(['pump','drain-pipe','water-pipe']);
 const groups=useMemo(()=>{const map=new Map<string,YardBox[]>();for(const b of yardPreviewBoxes(model,inspection)){if(!inspection&&hidden.has(b.role))continue;const key=b.role+':'+b.color;if(map.has(key))map.get(key)!.push(b);else map.set(key,[b]);}return [...map.entries()];},[model,inspection]);
 return <group name="combined-yard-features">{groups.map(([key,items])=><YardBatch key={key} items={items} role={items[0].role} color={items[0].color}/>)}<WaterMotion model={model}/>{inspection&&model.members.map(m=>{const a=new THREE.Vector3(m.a.x,m.a.y,m.a.z),b=new THREE.Vector3(m.b.x,m.b.y,m.b.z),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return <mesh key={m.id} position={a.clone().add(b).multiplyScalar(.5)} quaternion={q}><cylinderGeometry args={[m.width/2,m.width/2,a.distanceTo(b),10]}/><meshStandardMaterial color={m.color} roughness={.65}/></mesh>;})}</group>;
}
