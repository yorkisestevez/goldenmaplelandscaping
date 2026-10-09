import {useEffect,useLayoutEffect,useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {DeckData} from '../../types';
import type {LandscapeObject} from '../../landscapeTypes';
import {landscapePlacement} from '../../landscapeModelRuntime';
import {applyBloomLighting,plantColorHash} from './foliageLighting';
import {useFixtureLit} from './fixtureLighting';

type Head='daisy'|'mop'|'whorl'|'spike'|'cone';
interface BloomSpec {petals:string;center:string;count:number;y0:number;y1:number;spread:number;size:number;head:Head;stems?:boolean}
/** Summer flower colour sits on its own cards so the foliage tint cannot wash it out. */
const BLOOMS:Record<string,BloomSpec>={
 'echinacea-purpurea':{petals:'#7a3d8c',center:'#d06a18',count:7,y0:.62,y1:.9,spread:.26,size:.12,head:'daisy',stems:true},
 'rudbeckia-hirta':{petals:'#e2a010',center:'#24180c',count:6,y0:.58,y1:.88,spread:.24,size:.11,head:'daisy',stems:true},
 'monarda-fistulosa':{petals:'#c6a8dc',center:'#7d5c98',count:10,y0:.55,y1:.9,spread:.32,size:.11,head:'whorl'},
 'hydrangea-arborescens-annabelle':{petals:'#f6f3ec',center:'#f6f3ec',count:6,y0:.48,y1:.74,spread:.3,size:.1,head:'mop'},
 'hydrangea-paniculata':{petals:'#f4f0e4',center:'#efe4c4',count:5,y0:.52,y1:.8,spread:.26,size:.08,head:'cone'},
 'hemerocallis':{petals:'#e39a22',center:'#c46a12',count:5,y0:.5,y1:.82,spread:.28,size:.13,head:'daisy',stems:true},
 'nepeta-faassenii':{petals:'#b7a6dc',center:'#8e78b8',count:12,y0:.4,y1:.86,spread:.4,size:.07,head:'whorl'},
 'salvia-nemorosa':{petals:'#6d4ea3',center:'#4a3278',count:12,y0:.48,y1:.94,spread:.22,size:.08,head:'spike'},
};
interface BloomPoint {kind:Head|'stem';petals:string;center:string;x:number;y:number;z:number;yaw:number;pitch:number;size:number;object:LandscapeObject}

function maskCircle(g:CanvasRenderingContext2D,size:number){
 const img=g.getImageData(0,0,size,size),c=size/2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const d=Math.hypot(x-c+.5,y-c+.5)/(c-1),i=(y*size+x)*4;
  const m=d>=1?0:d>.84?(1-d)/.16:1;
  img.data[i+3]=Math.round(img.data[i+3]*m);
 }
 g.putImageData(img,0,0);
}
function flowerTexture(kind:'daisy'|'mop'|'whorl'){
 const size=256,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const g=canvas.getContext('2d')!,cx=size/2,cy=size/2;
 g.clearRect(0,0,size,size);
 const blob=(x:number,y:number,r:number)=>{
  const grd=g.createRadialGradient(x,y,r*.15,x,y,r);
  grd.addColorStop(0,'rgba(255,255,255,1)');grd.addColorStop(.55,'rgba(255,255,255,.95)');grd.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=grd;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();
 };
 if(kind==='mop'){for(let i=0;i<22;i++){const a=i*2.399,rad=(i%5)*14+6;blob(cx+Math.cos(a)*rad,cy+Math.sin(a)*rad*.92,i%4===0?22:16);}}
 else if(kind==='whorl'){for(let i=0;i<12;i++){const a=i/12*Math.PI*2;blob(cx+Math.cos(a)*28,cy+Math.sin(a)*22,18);}}
 else {for(let i=0;i<12;i++){const a=i/12*Math.PI*2-Math.PI/2;blob(cx+Math.cos(a)*46,cy+Math.sin(a)*46,28);}blob(cx,cy,22);}
 maskCircle(g,size);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.needsUpdate=true;return tex;
}
function crossedCards(){
 const positions:number[]=[],uvs:number[]=[],normals:number[]=[],indices:number[]=[];
 const quad=(rx:number,rz:number)=>{
  const base=positions.length/3,n=new THREE.Vector3(-rz,0,rx).normalize();
  for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){positions.push(rx*sx*.5,sy*.5,rz*sx*.5);uvs.push(sx*.5+.5,sy*.5+.5);normals.push(n.x,n.y,n.z);}
  indices.push(base,base+1,base+2,base,base+2,base+3);
 };
 quad(1,0);quad(0,1);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(indices);return g;
}
function stemCards(){
 const positions:number[]=[],uvs:number[]=[],normals:number[]=[],indices:number[]=[];
 const quad=(rx:number,rz:number)=>{
  const base=positions.length/3;
  for(const [sx,sy] of [[-1,0],[1,0],[1,1],[-1,1]]){positions.push(rx*sx,sy,rz*sx);uvs.push(sx*.5+.5,sy);normals.push(-rz,0,rx);}
  indices.push(base,base+1,base+2,base,base+2,base+3);
 };
 quad(.08,0);quad(0,.08);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(indices);return g;
}
function pushCard(out:BloomPoint[],spec:BloomSpec,o:LandscapeObject,x:number,y:number,z:number,yaw:number,pitch:number,size:number,kind:BloomPoint['kind']=spec.head){
 out.push({kind,petals:spec.petals,center:spec.center,x,y,z,yaw,pitch,size,object:o});
}
function place(o:LandscapeObject,spec:BloomSpec):BloomPoint[]{
 const out:BloomPoint[]=[];
 if(spec.head==='mop'||spec.head==='cone'){
  for(let c=0;c<spec.count;c++){
   const h=plantColorHash(o.id,c+3),h2=plantColorHash(o.id,c+19);
   const ang=h*Math.PI*2,rad=(spec.head==='cone'?(1-c/spec.count):Math.sqrt(h2))*spec.spread;
   const y=spec.head==='cone'?spec.y0+(c/Math.max(1,spec.count-1))*(spec.y1-spec.y0):spec.y0+h2*(spec.y1-spec.y0);
   const cx=Math.cos(ang)*rad,cz=Math.sin(ang)*rad;
   for(let f=0;f<4;f++){
    const a=f/4*Math.PI,p=plantColorHash(o.id,c*10+f);
    pushCard(out,spec,o,cx+Math.cos(a)*spec.size*.35,y+(p-.5)*spec.size*.4,cz+Math.sin(a)*spec.size*.35,a+p, (f-1.5)*.45, spec.size*(.85+p*.3));
   }
  }
  return out;
 }
 for(let i=0;i<spec.count;i++){
  const h=plantColorHash(o.id,i+1),h2=plantColorHash(o.id,i+40),h3=plantColorHash(o.id,i+80);
  let ang=h*Math.PI*2,rad=Math.sqrt(h2)*spec.spread,y=spec.y0+h3*(spec.y1-spec.y0);
  if(spec.head==='spike'){const stem=i%3,t=Math.floor(i/3)/Math.max(1,Math.ceil(spec.count/3)-1);ang=stem/3*Math.PI*2+h;rad=spec.spread*.35;y=spec.y0+t*(spec.y1-spec.y0);}
  const x=Math.cos(ang)*rad,z=Math.sin(ang)*rad,size=spec.size*(.8+h2*.35);
  pushCard(out,spec,o,x,y,z,h*Math.PI,(h3-.5)*.4,size);
  if(spec.stems)pushCard(out,spec,o,x,y,z,h*Math.PI,0,size,'stem');
 }
 return out;
}
function BloomMesh({data,points,map,role}:{data:DeckData;points:BloomPoint[];map:THREE.Texture|null;role:'petal'|'center'|'stem'}){
 const invalidate=useThree(s=>s.invalidate);
 const geometry=useMemo(()=>role==='stem'?stemCards():crossedCards(),[role]);
 const material=useMemo(()=>{
  const m=new THREE.MeshStandardMaterial({map:role==='stem'?null:map??undefined,color:role==='stem'?'#3f6b34':'#ffffff',roughness:role==='stem'?.8:.55,metalness:0,side:THREE.DoubleSide,transparent:false,depthWrite:true,alphaTest:role==='stem'?0:.45});
  if(role!=='stem')applyBloomLighting(m);return m;
 },[map,role]);
 useFixtureLit(material);useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
 const mesh=useMemo(()=>new THREE.InstancedMesh(geometry,material,Math.max(1,points.length)),[geometry,material,points.length]);
 useEffect(()=>()=>mesh.dispose(),[mesh]);
 useLayoutEffect(()=>{
  const color=new THREE.Color(),q=new THREE.Quaternion(),spin=new THREE.Quaternion(),tilt=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),axis=new THREE.Vector3(1,0,0),local=new THREE.Matrix4(),plant=new THREE.Matrix4(),scale=new THREE.Vector3();
  points.forEach((p,i)=>{
   const placed=landscapePlacement(data,p.object),o=p.object;
   q.setFromAxisAngle(up,-o.rotationDeg*Math.PI/180);
   if(placed.normal)q.premultiply(new THREE.Quaternion().setFromUnitVectors(up,new THREE.Vector3(placed.normal.x,placed.normal.y,placed.normal.z)));
   scale.set(o.widthIn/12,o.heightIn/12,o.depthIn/12);
   plant.compose(new THREE.Vector3(placed.x,placed.y,placed.z),q,scale);
   spin.setFromAxisAngle(up,p.yaw);tilt.setFromAxisAngle(axis,p.pitch);spin.multiply(tilt);
   const s=role==='center'?p.size*.38:role==='stem'?.08:p.size;
   const stemBase=.08;
   local.compose(new THREE.Vector3(p.x,role==='stem'?stemBase:p.y,p.z),spin,role==='stem'?new THREE.Vector3(s,Math.max(.05,p.y-stemBase),s):new THREE.Vector3(s,s,s));
   mesh.setMatrixAt(i,plant.multiply(local));mesh.setColorAt(i,color.set(role==='center'?p.center:role==='stem'?'#3e6a32':p.petals));
  });
  mesh.count=points.length;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=false;mesh.receiveShadow=true;mesh.raycast=()=>{};invalidate();
 },[data,points,mesh,role,invalidate]);
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
 const daisy=points.filter(p=>p.kind==='daisy'),mop=points.filter(p=>p.kind==='mop'||p.kind==='cone'),whorl=points.filter(p=>p.kind==='whorl'||p.kind==='spike'),stems=points.filter(p=>p.kind==='stem'),centers=daisy;
 return <>
  <BloomMesh data={data} points={daisy} map={textures.daisy} role="petal"/>
  <BloomMesh data={data} points={mop} map={textures.mop} role="petal"/>
  <BloomMesh data={data} points={whorl} map={textures.whorl} role="petal"/>
  <BloomMesh data={data} points={centers} map={textures.daisy} role="center"/>
  <BloomMesh data={data} points={stems} map={null} role="stem"/>
 </>;
}
