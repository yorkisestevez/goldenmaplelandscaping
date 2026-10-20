import {useEffect,useLayoutEffect,useMemo,useSyncExternalStore} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {DeckData} from '../../types';
import type {LandscapeObject} from '../../landscapeTypes';
import {landscapePlacement} from '../../landscapeModelRuntime';
import type {PlantSeat} from './plantSeating';
import {getShowcaseFlags,subscribeShowcase} from '../../showcaseMode';
import {applyBloomLighting,plantColorHash} from './foliageLighting';
import {useFixtureLit} from './fixtureLighting';
import {plantSeasonLook,type FlowerHead,type FlowerLook,type Season} from './plantSeasons';

/** Flower colour sits on its own cards so the foliage tint cannot wash it out. Each head is drawn as its real shape. */
/** face: crossed upright cards and a level one; tall: a spike rising from its point; out: one disc facing out of a crown. */
type Card='face'|'tall'|'out';
interface HeadStyle {card:Card;aspect?:number;width?:number;disc?:number;shell?:boolean}
const HEADS:Record<FlowerHead,HeadStyle>={
 daisy:{card:'face',disc:.36},drooping:{card:'face',disc:.42},trumpet:{card:'face'},whorl:{card:'face'},
 spike:{card:'tall',aspect:3.4,width:.42},panicle:{card:'tall',aspect:1.35,shell:true},cone:{card:'tall',aspect:1.5},
 mop:{card:'out',shell:true},flat:{card:'out',shell:true},blossom:{card:'out',shell:true},seed:{card:'face',disc:.55},
};
interface BloomPoint {kind:FlowerHead|'stem';petals:string;center:string;x:number;y:number;z:number;yaw:number;pitch:number;size:number;object:LandscapeObject;out?:[number,number,number]}

const SIZE=256;
function canvas(w=SIZE,h=SIZE){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d')!;g.clearRect(0,0,w,h);return {c,g};}
/** Grey shades of white: the instance colour tints them, so a texture carries only light and shadow. */
const grey=(v:number,a=1)=>`rgba(${Math.round(v*255)},${Math.round(v*255)},${Math.round(v*255)},${a})`;
function petal(g:CanvasRenderingContext2D,cx:number,cy:number,angle:number,r0:number,r1:number,width:number,base=.72){
 g.save();g.translate(cx,cy);g.rotate(angle);
 const grd=g.createLinearGradient(r0,0,r1,0);grd.addColorStop(0,grey(base));grd.addColorStop(.6,grey(1));grd.addColorStop(1,grey(.94));
 g.fillStyle=grd;g.beginPath();g.moveTo(r0,0);g.bezierCurveTo(r0+(r1-r0)*.3,-width,r0+(r1-r0)*.85,-width*.9,r1,-width*.15);
 g.lineTo(r1-width*.25,0);g.lineTo(r1,width*.15);g.bezierCurveTo(r0+(r1-r0)*.85,width*.9,r0+(r1-r0)*.3,width,r0,0);g.fill();
 g.strokeStyle=grey(base*.9,.5);g.lineWidth=1;g.beginPath();g.moveTo(r0,0);g.lineTo(r1*.9,0);g.stroke();
 g.restore();
}
/** A floret: four or five round petals about a darker eye. */
function floret(g:CanvasRenderingContext2D,x:number,y:number,r:number,petals=4,shade=1){
 for(let i=0;i<petals;i++){const a=i/petals*Math.PI*2+x*.1;g.fillStyle=grey(Math.min(1,.86*shade+.14));g.beginPath();g.ellipse(x+Math.cos(a)*r*.55,y+Math.sin(a)*r*.55,r*.55,r*.42,a,0,Math.PI*2);g.fill();}
 g.fillStyle=grey(Math.min(1,.72*shade));g.beginPath();g.arc(x,y,r*.2,0,Math.PI*2);g.fill();
}
const rand=(seed:number)=>()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
const DRAW:Record<string,()=>HTMLCanvasElement>={
 rays:()=>{const {c,g}=canvas();for(let i=0;i<13;i++)petal(g,128,128,i/13*Math.PI*2,26,122,15);return c;},
 drooping:()=>{const {c,g}=canvas();for(let i=0;i<15;i++)petal(g,128,128,i/15*Math.PI*2+.1,30,124,9,.6);return c;},
 trumpet:()=>{const {c,g}=canvas();for(let i=0;i<6;i++)petal(g,128,128,i/6*Math.PI*2+(i%2?.52:0),8,i%2?112:122,i%2?24:30,.55);
  const throat=g.createRadialGradient(128,128,0,128,128,46);throat.addColorStop(0,grey(.45));throat.addColorStop(1,grey(.85,0));g.fillStyle=throat;g.beginPath();g.arc(128,128,46,0,Math.PI*2);g.fill();return c;},
 whorl:()=>{const {c,g}=canvas(),r=rand(7);g.lineCap='round';for(let i=0;i<44;i++){const a=i/44*Math.PI*2+r()*.12,l=70+r()*44;g.strokeStyle=grey(.8+r()*.2);g.lineWidth=7+r()*3;g.beginPath();g.moveTo(128+Math.cos(a)*30,128+Math.sin(a)*30);g.lineTo(128+Math.cos(a+.15)*l,128+Math.sin(a+.15)*l);g.stroke();}
  g.fillStyle=grey(.5);g.beginPath();g.arc(128,128,30,0,Math.PI*2);g.fill();return c;},
 spike:()=>{const {c,g}=canvas(96,SIZE*1.5),r=rand(11),h=c.height;g.strokeStyle=grey(.5);g.lineWidth=2;g.beginPath();g.moveTo(48,h);g.lineTo(48,4);g.stroke();
  // Whorls of small two-lipped florets up the stem, thinning to a bud tip, with a little stem showing between whorls.
  for(let i=0;i<26;i++){const t=i/25,y=h*(.96-t*.93),w=(1-t*.7)*30;for(let k=0;k<3;k++){const x=48+(k-1)*w*.62+(r()-.5)*5;g.fillStyle=grey(.84+r()*.16);g.beginPath();g.ellipse(x,y,w*.3+2,6.5,(k-1)*.6,0,Math.PI*2);g.fill();g.fillStyle=grey(.62);g.beginPath();g.arc(x,y+4,2.2,0,Math.PI*2);g.fill();}}return c;},
 panicle:()=>{const {c,g}=canvas(SIZE,SIZE*1.5),r=rand(5),h=c.height;for(let i=0;i<190;i++){const t=Math.sqrt(r()),y=h*(.98-t*.94),half=(1-t*.85)*104*Math.sqrt(1-(1-t)**4*.5),x=128+(r()*2-1)*half;floret(g,x,y,12+r()*4,4,.8+t*.2);}return c;},
 mop:()=>{const {c,g}=canvas(),r=rand(3),dome=g.createRadialGradient(112,108,8,128,128,108);dome.addColorStop(0,grey(.97));dome.addColorStop(1,grey(.8));
  // A solid dome under the florets, so a mophead has no holes, then florets over it, lighter at the crown.
  g.fillStyle=dome;g.beginPath();g.arc(128,128,100,0,Math.PI*2);g.fill();
  for(let i=0;i<170;i++){const a=r()*Math.PI*2,d=Math.sqrt(r())*104;floret(g,128+Math.cos(a)*d,128+Math.sin(a)*d*.94,12+r()*4,4,1.06-d/104*.22);}return c;},
 flat:()=>{const {c,g}=canvas(),r=rand(9);for(let i=0;i<170;i++){const a=r()*Math.PI*2,d=Math.sqrt(r())*108;floret(g,128+Math.cos(a)*d,128+Math.sin(a)*d*.62,8+r()*3,5,1-d/108*.35);}return c;},
 blossom:()=>{const {c,g}=canvas();for(const [x,y,s] of [[96,100,46],[164,92,42],[124,164,48],[180,170,34],[70,170,32]])for(let i=0;i<5;i++){const a=i/5*Math.PI*2+x;g.fillStyle=grey(.9+i%2*.1);g.beginPath();g.ellipse(x+Math.cos(a)*s*.42,y+Math.sin(a)*s*.42,s*.42,s*.3,a,0,Math.PI*2);g.fill();g.fillStyle=grey(.6);g.beginPath();g.arc(x,y,s*.14,0,Math.PI*2);g.fill();}return c;},
 disc:()=>{const {c,g}=canvas(),r=rand(13),dome=g.createRadialGradient(110,104,10,128,128,120);dome.addColorStop(0,grey(1));dome.addColorStop(.75,grey(.7));dome.addColorStop(1,grey(.5));g.fillStyle=dome;g.beginPath();g.arc(128,128,118,0,Math.PI*2);g.fill();
  for(let i=0;i<260;i++){const a=i*2.39996,d=Math.sqrt(i/260)*112;g.fillStyle=grey(.35+r()*.3);g.beginPath();g.arc(128+Math.cos(a)*d,128+Math.sin(a)*d,4+r()*2,0,Math.PI*2);g.fill();}return c;},
};
const TEXTURE_OF:Record<FlowerHead,string>={daisy:'rays',drooping:'drooping',trumpet:'trumpet',whorl:'whorl',spike:'spike',panicle:'panicle',cone:'panicle',mop:'mop',flat:'flat',blossom:'blossom',seed:'disc'};
function flowerTexture(name:string){const tex=new THREE.CanvasTexture(DRAW[name]());tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;tex.needsUpdate=true;return tex;}

function quads(list:{n:[number,number,number];corner:(sx:number,sy:number)=>[number,number,number]}[]){
 const positions:number[]=[],uvs:number[]=[],normals:number[]=[],indices:number[]=[];
 for(const q of list){const base=positions.length/3;for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){positions.push(...q.corner(sx,sy));uvs.push(sx*.5+.5,sy*.5+.5);normals.push(...q.n);}indices.push(base,base+1,base+2,base,base+2,base+3);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(indices);return g;
}
/** A face-up flower: two crossed upright cards and one level card, so it reads from the side and from the deck above. */
const faceCards=()=>quads([
 {n:[0,0,1],corner:(sx,sy)=>[sx*.5,sy*.5,0]},{n:[-1,0,0],corner:(sx,sy)=>[0,sy*.5,sx*.5]},{n:[0,1,0],corner:(sx,sy)=>[sx*.5,0,-sy*.5]},
]);
/** A spike or panicle: two crossed upright cards rising from the point. */
const tallCards=()=>quads([{n:[0,0,1],corner:(sx,sy)=>[sx*.5,sy*.5+.5,0]},{n:[-1,0,0],corner:(sx,sy)=>[0,sy*.5+.5,sx*.5]}]);
/** A crown-surface flower: one disc whose face points along +y, turned to face out of the crown when placed. */
const outCard=()=>quads([{n:[0,1,0],corner:(sx,sy)=>[sx*.5,0,-sy*.5]}]);
const stemCards=()=>quads([{n:[0,0,1],corner:(sx,sy)=>[sx*.25,sy*.5+.5,0]},{n:[-1,0,0],corner:(sx,sy)=>[0,sy*.5+.5,sx*.25]}]);

function pushCard(out:BloomPoint[],spec:FlowerLook,o:LandscapeObject,x:number,y:number,z:number,yaw:number,pitch:number,size:number,kind:BloomPoint['kind']=spec.head){
 out.push({kind,petals:spec.petals,center:spec.center,x,y,z,yaw,pitch,size,object:o});
}
function place(o:LandscapeObject,spec:FlowerLook):BloomPoint[]{
 const out:BloomPoint[]=[],style=HEADS[spec.head];
 // Shrub and tree flowers sit on the outside of the crown. A shrub is a mound from the ground up, so its crown is the
 // whole envelope and y0–y1 only picks the band that flowers; a tree's crown is the y0–y1 band itself.
 if(style.shell){
  const tree=spec.head==='blossom',mid=tree?(spec.y0+spec.y1)/2:.5,half=tree?(spec.y1-spec.y0)/2:.52;
  for(let i=0;i<spec.count;i++){
   const h=plantColorHash(o.id,i+1),h2=plantColorHash(o.id,i+40),h3=plantColorHash(o.id,i+80);
   const y=tree?mid+(h3*2-1)*half*.92:spec.y0+h3*(spec.y1-spec.y0),ring=Math.sqrt(Math.max(0,1-((y-mid)/half)**2)),ang=i*2.39996+h,rad=spec.spread*ring*(.82+h2*.2);
   const x=Math.cos(ang)*rad,z=Math.sin(ang)*rad;pushCard(out,spec,o,x,y,z,ang+h,(h2-.5)*.5,spec.size*(.8+h*.4));
   out[out.length-1].out=[x,(y-mid)*.8+.25*half,z];
  }
  return out;
 }
 for(let i=0;i<spec.count;i++){
  const h=plantColorHash(o.id,i+1),h2=plantColorHash(o.id,i+40),h3=plantColorHash(o.id,i+80);
  const ang=h*Math.PI*2,rad=Math.sqrt(h2)*spec.spread,y=spec.y0+h3*(spec.y1-spec.y0);
  const x=Math.cos(ang)*rad,z=Math.sin(ang)*rad,size=spec.size*(.8+h2*.35);
  pushCard(out,spec,o,x,y,z,h*Math.PI,(h3-.5)*.4,size);
  // A stem carries its own colour: green under a flower, brown under a seed head.
  if(spec.stems)pushCard(out,{...spec,petals:spec.head==='seed'?'#5a4a34':'#3e6a32'},o,x,y,z,h*Math.PI,0,size,'stem');
 }
 return out;
}
type Role='petal'|'center'|'stem';
function BloomMesh({data,points,map,role,card,aspect=1,width=1,disc=.36,seats}:{data:DeckData;points:BloomPoint[];map:THREE.Texture|null;role:Role;card:Card;aspect?:number;width?:number;disc?:number;seats?:Map<string,PlantSeat>}){
 const invalidate=useThree(s=>s.invalidate);
 const geometry=useMemo(()=>role==='stem'?stemCards():card==='tall'?tallCards():card==='out'?outCard():faceCards(),[role,card]);
 const material=useMemo(()=>{
  const m=new THREE.MeshStandardMaterial({map:role==='stem'?null:map??undefined,color:'#ffffff',roughness:role==='stem'?.8:.55,metalness:0,side:THREE.DoubleSide,transparent:false,depthWrite:true,alphaTest:role==='stem'?0:.45});
  if(role!=='stem')applyBloomLighting(m);return m;
 },[map,role]);
 useFixtureLit(material);useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
 const mesh=useMemo(()=>new THREE.InstancedMesh(geometry,material,Math.max(1,points.length)),[geometry,material,points.length]);
 useEffect(()=>()=>mesh.dispose(),[mesh]);
 useLayoutEffect(()=>{
  const color=new THREE.Color(),outward=new THREE.Vector3(),q=new THREE.Quaternion(),spin=new THREE.Quaternion(),tilt=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),axis=new THREE.Vector3(1,0,0),local=new THREE.Matrix4(),plant=new THREE.Matrix4(),scale=new THREE.Vector3();
  points.forEach((p,i)=>{
   const placed=landscapePlacement(data,p.object),o=p.object;
   q.setFromAxisAngle(up,-o.rotationDeg*Math.PI/180);
   if(placed.normal)q.premultiply(new THREE.Quaternion().setFromUnitVectors(up,new THREE.Vector3(placed.normal.x,placed.normal.y,placed.normal.z)));
   scale.set(o.widthIn/12,o.heightIn/12,o.depthIn/12);
   plant.compose(new THREE.Vector3(placed.x,placed.y+(seats?.get(o.id)?.dyIn??0)/12,placed.z),q,scale);
   if(p.out&&card==='out')spin.setFromUnitVectors(up,outward.set(...p.out).normalize()).multiply(tilt.setFromAxisAngle(up,p.yaw));
   else {spin.setFromAxisAngle(up,p.yaw);tilt.setFromAxisAngle(axis,p.pitch);spin.multiply(tilt);}
   const stemBase=.08,s=role==='center'?p.size*disc:p.size;
   // A disc sits just above its rays so the level cards do not fight; a stem runs from the crown base to its flower.
   if(role==='stem')local.compose(new THREE.Vector3(p.x,stemBase,p.z),spin,new THREE.Vector3(.02,Math.max(.05,p.y-stemBase),.02));
   // The plant's envelope is scaled by its width across and its height up: undo that on the card, so a flower is round.
   else {const round=o.widthIn/Math.max(1,o.heightIn);local.compose(new THREE.Vector3(p.x,p.y+(role==='center'?s*.12*round:0),p.z),spin,new THREE.Vector3(s*width,s*round*(card==='tall'?aspect:1),s*width));}
   mesh.setMatrixAt(i,plant.multiply(local));
   mesh.setColorAt(i,color.set(role==='center'?p.center:p.petals).offsetHSL(0,0,(plantColorHash(o.id,i+3)-.5)*.06));
  });
  mesh.count=points.length;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=false;mesh.receiveShadow=true;mesh.raycast=()=>{};invalidate();
 },[data,points,mesh,role,invalidate,seats,card,aspect,width,disc]);
 if(!points.length)return null;
 return <primitive object={mesh} dispose={null}/>;
}
/** Alpha-tested flowers for the plants in bloom in the season shown, and the seed heads and dried hydrangeas that stand
 * after them. Distant impostors skip them, except tree blossom, which a whole crown carries. */
export default function PlantBlooms({data,objects,lods,seats,season}:{data:DeckData;objects:LandscapeObject[];lods:Map<string,0|1|2>;seats?:Map<string,PlantSeat>;season:Season}){
 const showcase=useSyncExternalStore(subscribeShowcase,()=>getShowcaseFlags().quality,()=>false);
 const points=useMemo(()=>objects.flatMap(o=>{
  const spec=o.enabled&&o.kind==='plant'?plantSeasonLook(o.speciesRecord?.id,o.assetId,season).flowers:undefined;
  const lod=showcase?0:(lods.get(o.id)??2);
  if(!spec||lod>1&&spec.head!=='blossom'||landscapePlacement(data,o).pendingReason)return [];
  return place(o,spec);
 }),[data,objects,lods,showcase,season]);
 // Textures are drawn once per set of flower shapes, not again each time the plants or their level of detail change.
 const headKey=[...new Set(points.flatMap(p=>p.kind==='stem'?[]:[p.kind]))].sort().join(),heads=useMemo(()=>headKey?headKey.split(',') as FlowerHead[]:[],[headKey]);
 const textures=useMemo(()=>{
  const names=new Set(heads.map(h=>TEXTURE_OF[h]));if(heads.some(h=>HEADS[h].disc))names.add('disc');
  return new Map([...names].map(n=>[n,flowerTexture(n)]));
 },[heads]);
 useEffect(()=>()=>{for(const t of textures.values())t.dispose();},[textures]);
 const stems=points.filter(p=>p.kind==='stem');
 return <>
  {heads.map(head=>{const style=HEADS[head],own=points.filter(p=>p.kind===head);return <group key={head} name={'plant-blooms-'+head}>
   {head!=='seed'&&<BloomMesh data={data} points={own} map={textures.get(TEXTURE_OF[head])??null} role="petal" card={style.card} aspect={style.aspect} width={style.width} seats={seats}/>}
   {style.disc&&<BloomMesh data={data} points={own} map={textures.get('disc')??null} role="center" card="face" disc={style.disc} seats={seats}/>}
  </group>;})}
  <BloomMesh data={data} points={stems} map={null} role="stem" card="face" seats={seats}/>
 </>;
}
