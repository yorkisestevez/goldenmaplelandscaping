import {useEffect,useLayoutEffect,useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {DeckData} from '../../types';
import type {LandscapeObject} from '../../landscapeTypes';
import {landscapePlacement} from '../../landscapeModelRuntime';
import {applyBloomLighting,plantColorHash} from './foliageLighting';
import {useFixtureLit} from './fixtureLighting';

type Head='daisy'|'mop'|'whorl'|'spike'|'cone';
interface BloomSpec {petals:string;center:string;count:number;y0:number;y1:number;spread:number;size:number;head:Head}
/** Summer flower colour sits on its own cards so the foliage tint cannot wash it out. */
const BLOOMS:Record<string,BloomSpec>={
 'echinacea-purpurea':{petals:'#7a3d8c',center:'#d06a18',count:22,y0:.52,y1:.98,spread:.46,size:.2,head:'daisy'},
 'rudbeckia-hirta':{petals:'#e2a010',center:'#24180c',count:20,y0:.48,y1:.96,spread:.44,size:.18,head:'daisy'},
 'monarda-fistulosa':{petals:'#c6a8dc',center:'#7d5c98',count:18,y0:.5,y1:.98,spread:.48,size:.16,head:'whorl'},
 'hydrangea-arborescens-annabelle':{petals:'#f7f4ee',center:'#f3efe6',count:28,y0:.32,y1:.94,spread:.78,size:.22,head:'mop'},
 'hydrangea-paniculata':{petals:'#f4f0e4',center:'#efe4c4',count:18,y0:.42,y1:.96,spread:.58,size:.16,head:'cone'},
 'hemerocallis':{petals:'#e39a22',center:'#c46a12',count:9,y0:.38,y1:.86,spread:.42,size:.18,head:'daisy'},
 'nepeta-faassenii':{petals:'#b7a6dc',center:'#8e78b8',count:16,y0:.32,y1:.9,spread:.55,size:.09,head:'whorl'},
 'salvia-nemorosa':{petals:'#6d4ea3',center:'#4a3278',count:14,y0:.42,y1:.98,spread:.28,size:.1,head:'spike'},
};
interface BloomPoint {kind:Head;petals:string;center:string;x:number;y:number;z:number;yaw:number;size:number;object:LandscapeObject}

function flowerTexture(kind:'daisy'|'mop'|'whorl'){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const g=canvas.getContext('2d')!,cx=64,cy=64;
 const blob=(x:number,y:number,rx:number,ry:number,rot:number)=>{
  const grd=g.createRadialGradient(x,y,1,x,y,Math.max(rx,ry));
  grd.addColorStop(0,'rgba(255,255,255,1)');grd.addColorStop(.62,'rgba(255,255,255,.9)');grd.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=grd;g.beginPath();g.ellipse(x,y,rx,ry,rot,0,Math.PI*2);g.fill();
 };
 if(kind==='mop'){for(let i=0;i<16;i++){const a=i*2.399;blob(cx+Math.cos(a)*(8+(i%4)*6),cy+Math.sin(a)*(6+(i%4)*5),15,13,a);}}
 else if(kind==='whorl'){for(let i=0;i<11;i++){const a=i/11*Math.PI*2;blob(cx+Math.cos(a)*16,cy+Math.sin(a)*12,9,20,a);}}
 else {for(let i=0;i<10;i++){const a=i/10*Math.PI*2-Math.PI/2;blob(cx+Math.cos(a)*20,cy+Math.sin(a)*20,11,24,a+Math.PI/2);}}
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.needsUpdate=true;return tex;
}
function crossedCards(){
 const positions:number[]=[],uvs:number[]=[],normals:number[]=[],indices:number[]=[];
 const quad=(rx:number,rz:number)=>{
  const base=positions.length/3,n=new THREE.Vector3(-rz,0,rx).normalize();
  for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){positions.push(rx*sx,sy*.5,rz*sx);uvs.push(sx*.5+.5,sy*.5+.5);normals.push(n.x,n.y,n.z);}
  indices.push(base,base+1,base+2,base,base+2,base+3);
 };
 quad(1,0);quad(0,1);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(indices);return g;
}
function place(o:LandscapeObject,spec:BloomSpec):BloomPoint[]{
 const out:BloomPoint[]=[];
 for(let i=0;i<spec.count;i++){
  const h=plantColorHash(o.id,i+1),h2=plantColorHash(o.id,i+40),h3=plantColorHash(o.id,i+80);
  let ang=h*Math.PI*2,rad=Math.sqrt(h2)*spec.spread,y=spec.y0+h3*(spec.y1-spec.y0);
  if(spec.head==='cone'){const t=i/Math.max(1,spec.count-1);ang=i*2.399;rad=spec.spread*(1-t)*.55*(.6+h);y=spec.y0+t*(spec.y1-spec.y0);}
  else if(spec.head==='spike'){const stem=i%3,t=Math.floor(i/3)/Math.max(1,Math.ceil(spec.count/3)-1);ang=stem/3*Math.PI*2+h;rad=spec.spread*.4;y=spec.y0+t*(spec.y1-spec.y0);}
  out.push({kind:spec.head,petals:spec.petals,center:spec.center,x:Math.cos(ang)*rad,y,z:Math.sin(ang)*rad,yaw:h*Math.PI,size:spec.size*(.78+h2*.4),object:o});
 }
 return out;
}
function BloomMesh({data,points,map,center}:{data:DeckData;points:BloomPoint[];map:THREE.Texture|null;center?:boolean}){
 const invalidate=useThree(s=>s.invalidate);
 const geometry=useMemo(()=>crossedCards(),[]);
 const material=useMemo(()=>{
  const m=new THREE.MeshStandardMaterial({map:map??undefined,color:'#ffffff',roughness:.55,metalness:0,side:THREE.DoubleSide,transparent:false,depthWrite:true,alphaTest:.35});
  applyBloomLighting(m);return m;
 },[map]);
 useFixtureLit(material);useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
 const mesh=useMemo(()=>new THREE.InstancedMesh(geometry,material,Math.max(1,points.length)),[geometry,material,points.length]);
 useEffect(()=>()=>mesh.dispose(),[mesh]);
 useLayoutEffect(()=>{
  const color=new THREE.Color(),q=new THREE.Quaternion(),leaf=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),local=new THREE.Matrix4(),plant=new THREE.Matrix4(),scale=new THREE.Vector3();
  points.forEach((p,i)=>{
   const placed=landscapePlacement(data,p.object),o=p.object;
   q.setFromAxisAngle(up,-o.rotationDeg*Math.PI/180);
   if(placed.normal)q.premultiply(new THREE.Quaternion().setFromUnitVectors(up,new THREE.Vector3(placed.normal.x,placed.normal.y,placed.normal.z)));
   scale.set(o.widthIn/12,o.heightIn/12,o.depthIn/12);
   plant.compose(new THREE.Vector3(placed.x,placed.y,placed.z),q,scale);
   leaf.setFromAxisAngle(up,p.yaw);
   const s=center?p.size*.42:p.size;
   local.compose(new THREE.Vector3(p.x,p.y,p.z),leaf,new THREE.Vector3(s,center?s:s*.72,s));
   mesh.setMatrixAt(i,plant.multiply(local));mesh.setColorAt(i,color.set(center?p.center:p.petals));
  });
  mesh.count=points.length;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=false;mesh.receiveShadow=true;mesh.raycast=()=>{};invalidate();
 },[data,points,mesh,center,invalidate]);
 if(!points.length)return null;
 return <primitive object={mesh} dispose={null}/>;
}
/** Alpha-tested flower heads for the species in bloom. Distant impostors skip them. */
export default function PlantBlooms({data,objects,lods}:{data:DeckData;objects:LandscapeObject[];lods:Map<string,0|1|2>}){
 const points=useMemo(()=>objects.flatMap(o=>{
  const spec=o.enabled&&o.kind==='plant'&&o.speciesRecord?BLOOMS[o.speciesRecord.id]:undefined;
  if(!spec||(lods.get(o.id)??2)>1||landscapePlacement(data,o).pendingReason)return [];
  return place(o,spec);
 }),[data,objects,lods]);
 const textures=useMemo(()=>({daisy:flowerTexture('daisy'),mop:flowerTexture('mop'),whorl:flowerTexture('whorl')}),[]);
 useEffect(()=>()=>{textures.daisy.dispose();textures.mop.dispose();textures.whorl.dispose();},[textures]);
 const daisy=points.filter(p=>p.kind==='daisy'||p.kind==='cone'),mop=points.filter(p=>p.kind==='mop'),whorl=points.filter(p=>p.kind==='whorl'||p.kind==='spike');
 return <>
  <BloomMesh data={data} points={daisy} map={textures.daisy}/>
  <BloomMesh data={data} points={mop} map={textures.mop}/>
  <BloomMesh data={data} points={whorl} map={textures.whorl}/>
  <BloomMesh data={data} points={points} map={textures.daisy} center/>
 </>;
}
