import {useEffect,useLayoutEffect,useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {YardBox,YardModel,YardRole} from '../../yardModel';
import {yardPreviewBoxes} from './yardPreview';
import {scanMaterial} from './houseSurfaces';
import {occlusionUv,useGroundOcclusion,type SharedOcclusion} from './groundOcclusion';
import {useLawnMaterial} from './Turf';
import {GRADED_ROLES,bankGeometry,seatOnLawn} from './finishedGrade';

function surfaceTexture(){const n=128,bytes=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const v=.77+.23*(Math.abs(Math.sin(x*127.1+y*311.7)*43758.5453)%1),i=(y*n+x)*4;bytes[i]=bytes[i+1]=bytes[i+2]=v*255;bytes[i+3]=255;}const t=new THREE.DataTexture(bytes,n,n);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.needsUpdate=true;return t;}
const PAVER_CHAMFER_IN=.2;
function boxGeometry(b:YardBox){
 if(b.role==='rock'){const g=new THREE.IcosahedronGeometry(1,1),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const k=.88+.12*(Math.abs(Math.sin(p.getX(i)*91+p.getY(i)*71+p.getZ(i)*31))%1);p.setXYZ(i,p.getX(i)*b.w*.5*k,p.getY(i)*b.h*.5*k,p.getZ(i)*b.d*.5*k);}g.translate(b.x,b.y,b.z);g.computeVertexNormals();return g;}
 if(b.polygon?.length){const shape=new THREE.Shape();b.polygon.forEach((p,i)=>i?shape.lineTo(p.x,p.y):shape.moveTo(p.x,p.y));shape.closePath();
  // A paver's top edge is chamfered (PAVER_CHAMFER_IN), which is what shows its joints from across the yard.
  const c=b.role==='paver'&&!b.illustrative&&Math.min(b.w,b.d)>PAVER_CHAMFER_IN*4&&b.h>PAVER_CHAMFER_IN*3?PAVER_CHAMFER_IN:0;
  const g=new THREE.ExtrudeGeometry(shape,c?{depth:b.h-2*c,bevelEnabled:true,bevelThickness:c,bevelSize:c,bevelOffset:-c,bevelSegments:1}:{depth:b.h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,b.y+b.h/2-c,0);return g;}
 const g=new THREE.BoxGeometry(b.w,b.h,b.d);g.rotateY(b.angle||0);g.translate(b.x,b.y,b.z);return g.toNonIndexed();
}
/**
 * Hardscape surfaces (Real Life G5): each piece's faces are projected in their own plane, slid to the piece's own spot,
 * so pavers, wall blocks, caps and rocks show scanned detail (houseSurfaces.ts scanMaterial) in the product's colour.
 * The simplified paving preview draws the sample paver's joints instead. Base, bedding, gravel, liner and pipes keep
 * their plain bumped look. Hardscape is shaded from the sky under a deck like the lawn (groundOcclusion.ts).
 * In the finished views (not the construction views) the earthwork is finished (finishedGrade.ts): the ground a
 * retaining wall holds is a graded lawn bank and rocks are set into the lawn; and the joint sand between pavers reads
 * in its shade, darker than the pavers. Quantities, exports and the construction views are unchanged. Hardscape and the
 * bank lie on the ground, so they don't count as covering it in the occlusion map.
 */
const JOINT_SHADE=.5;
const SCANNED:Partial<Record<YardRole,{set:'masonry'|'rock';repeatIn:number;normalScale:number;roughness:number}>>={
 paver:{set:'masonry',repeatIn:14,normalScale:.6,roughness:.85},
 'wall-block':{set:'rock',repeatIn:18,normalScale:.8,roughness:.9},
 'wall-cap':{set:'masonry',repeatIn:18,normalScale:.5,roughness:.85},
 rock:{set:'rock',repeatIn:20,normalScale:1,roughness:.9},
};
const WHITE=(()=>{const t=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);t.needsUpdate=true;t.channel=1;return t;})();
/** Paver joints for the simplified preview: one paver per repeat, a quarter-inch dark joint round it. */
function jointTexture(){const n=64,bytes=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const edge=Math.min(x,y,n-1-x,n-1-y)<1.5,v=edge?.55:1,i=(y*n+x)*4;bytes[i]=bytes[i+1]=bytes[i+2]=v*255;bytes[i+3]=255;}const t=new THREE.DataTexture(bytes,n,n);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;}
/** A colour darkened to a share of its brightness (joint sand in its own shade). */
const shade=(hex:string,k:number)=>`#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;
const hash=(k:number)=>{const v=Math.sin(k*127.1+311.7)*43758.5453;return v-Math.floor(v);};
/** UVs for one piece (non-indexed): each triangle in the plane of its facing axis, in repeats, shifted by the piece's own
 * offset; or, for a simplified paving slab, in pavers of the sample's size along its angle. */
function pieceUvs(g:THREE.BufferGeometry,b:YardBox,i:number,repeatIn:number,paver?:{w:number;d:number;angle:number}){
 const p=g.getAttribute('position'),uv=new Float32Array(p.count*2),a=new THREE.Vector3(),c=new THREE.Vector3(),d=new THREE.Vector3(),n=new THREE.Vector3(),su=hash(i+.37),sv=hash(i+.71);
 for(let t=0;t<p.count;t+=3){
  a.fromBufferAttribute(p,t);c.fromBufferAttribute(p,t+1).sub(a);d.fromBufferAttribute(p,t+2).sub(a);n.crossVectors(c,d);
  const ax=Math.abs(n.x),ay=Math.abs(n.y),az=Math.abs(n.z);
  for(let k=0;k<3;k++){
   const x=p.getX(t+k),y=p.getY(t+k),z=p.getZ(t+k);
   if(paver){const cos=Math.cos(paver.angle),sin=Math.sin(paver.angle),u=(x-b.x)*cos-(z-b.z)*sin,v=(x-b.x)*sin+(z-b.z)*cos;uv[(t+k)*2]=u/paver.w;uv[(t+k)*2+1]=v/paver.d;continue;}
   const [s,q]=ay>=ax&&ay>=az?[x,z]:ax>=az?[z,y]:[x,y];
   uv[(t+k)*2]=s/repeatIn+su;uv[(t+k)*2+1]=q/repeatIn+sv;
  }
 }
 return new THREE.Float32BufferAttribute(uv,2);
}
function YardBatch({items,color,role,occlusion,paverSize}:{items:YardBox[];color:string;role:YardRole;occlusion:SharedOcclusion;paverSize?:{w:number;d:number;angle:number}}){
 const scanned=SCANNED[role],simplified=role==='paver'&&!!paverSize&&items.every(b=>b.illustrative),water=role==='water';
 const geometry=useMemo(()=>{const pieces=items.map((b,i)=>{let g=boxGeometry(b);if(g.index){const converted=g.toNonIndexed();g.dispose();g=converted;}const p=g.getAttribute('position'),c=new THREE.Float32BufferAttribute(new Float32Array(p.count*3),3),shade=.93+.07*(Math.abs(Math.sin(i*89.3))%1);
  if(scanned||simplified)g.setAttribute('uv',pieceUvs(g,b,i,scanned?.repeatIn??48,simplified?paverSize:undefined));
  else{const uv=new THREE.Float32BufferAttribute(new Float32Array(p.count*2),2);for(let v=0;v<p.count;v++)uv.setXY(v,p.getX(v)/(water?RIPPLE_IN:18),p.getZ(v)/(water?RIPPLE_IN:18));g.setAttribute('uv',uv);}
  // The lawn's occlusion map's UVs, for hardscape under the deck.
  const uv1=new THREE.Float32BufferAttribute(new Float32Array(p.count*2),2);if(occlusion)for(let v=0;v<p.count;v++)uv1.setXY(v,...occlusionUv(occlusion.bounds,p.getX(v),p.getZ(v)));g.setAttribute('uv1',uv1);
  for(let v=0;v<p.count;v++)c.setXYZ(v,shade,shade,shade);g.setAttribute('color',c);return g;});const merged=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());return merged;},[items,scanned,simplified,paverSize,water,occlusion?.bounds]);
 const invalidate=useThree(s=>s.invalidate),gl=useThree(s=>s.gl);
 const material=useMemo<THREE.Material>(()=>{
  if(water)return new THREE.MeshPhysicalMaterial({color,roughness:.06,metalness:0,transmission:.4,transparent:true,opacity:.67,thickness:8,ior:1.333,envMapIntensity:1,clearcoat:1,depthWrite:false,normalMap:rippleTexture(),normalScale:new THREE.Vector2(.15,.15)});
  if(simplified)return new THREE.MeshStandardMaterial({color,vertexColors:true,roughness:.85,map:jointTexture()});
  if(scanned)return scanMaterial(scanned.set,color,{roughness:scanned.roughness,normalScale:scanned.normalScale,vertexColors:true,anisotropy:Math.min(8,gl.capabilities.getMaxAnisotropy()),onLoad:invalidate});
  return new THREE.MeshStandardMaterial({color,vertexColors:true,bumpMap:surfaceTexture(),bumpScale:.08,roughness:role==='liner'?.65:.92,metalness:role==='pump'?.25:0});
 },[water,simplified,scanned,color,role,gl,invalidate]);
 // Hardscape takes the lawn's shade from the sky; a one-pixel white stand-in keeps the program the same until it arrives.
 useLayoutEffect(()=>{if(water||!(material instanceof THREE.MeshStandardMaterial))return;material.aoMap=occlusion?.texture??WHITE;material.aoMapIntensity=.75;invalidate();},[material,occlusion,water,invalidate]);
 useEffect(()=>()=>geometry?.dispose(),[geometry]);
 useEffect(()=>()=>{const m=material as THREE.MeshStandardMaterial;if(m.normalMap&&water)m.normalMap.dispose();if(simplified||(!scanned&&!water)){m.map?.dispose();m.bumpMap?.dispose();}material.dispose();},[material,water,simplified,scanned]);
 if(!geometry)return null;
 return <mesh name={`yard-${role}`} geometry={geometry} material={material} castShadow={!water} receiveShadow userData={GROUND_LEVEL}/>;
}
/** Still water's small ripples: a normal map made in code from waves that each fit the tile a whole number of times,
 * so it repeats without a seam, in directions and sizes that don't line up into a visible pattern. */
const RIPPLE_IN=96,RIPPLE_WAVES:[number,number,number,number][]=[[3,1,1,0],[-1,4,.8,1.3],[5,-2,.55,2.1],[-2,7,.4,.7],[7,3,.3,4.2],[-9,5,.2,5.5],[11,-6,.14,.4]];
function rippleTexture(){const n=128,bytes=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){let dx=0,dy=0;for(const [k,l,a,phase] of RIPPLE_WAVES){const w=2*Math.PI/n,c=Math.cos(w*(k*x+l*y)+phase)*a*w*1.5;dx+=c*k;dy+=c*l;}const len=Math.hypot(dx,dy,1),i=(y*n+x)*4;bytes[i]=(-dx/len*.5+.5)*255;bytes[i+1]=(-dy/len*.5+.5)*255;bytes[i+2]=(1/len*.5+.5)*255;bytes[i+3]=255;}const t=new THREE.DataTexture(bytes,n,n);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;}
const GROUND_LEVEL={coversGround:false};
/** The graded lawn over each retaining wall's drainage and backfill, in the finished views (finishedGrade.ts). */
function RetainedBanks({model,occlusion}:{model:YardModel;occlusion:SharedOcclusion}){
 const material=useLawnMaterial(),invalidate=useThree(s=>s.invalidate);
 const geometry=useMemo(()=>{
  const parts=model.features.filter(f=>!f.excluded&&f.config.kind==='retaining-wall').map(f=>{const drainage=f.boxes.find(b=>b.role==='wall-drainage'),backfill=f.boxes.find(b=>b.role==='backfill');return drainage&&backfill?bankGeometry(drainage,backfill,model.terrain,occlusion?.bounds):null;}).filter((g):g is THREE.BufferGeometry=>!!g);
  if(!parts.length)return null;const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());return merged;
 },[model,occlusion?.bounds]);
 useLayoutEffect(()=>{material.aoMap=occlusion?.texture??WHITE;material.aoMapIntensity=.75;invalidate();},[material,occlusion,invalidate]);
 useEffect(()=>()=>geometry?.dispose(),[geometry]);
 if(!geometry)return null;
 return <mesh name="yard-retained-bank" geometry={geometry} material={material} castShadow receiveShadow userData={GROUND_LEVEL}/>;
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
 const groups=useMemo(()=>{const map=new Map<string,YardBox[]>();for(const box of yardPreviewBoxes(model,inspection)){if(!inspection&&(hidden.has(box.role)||GRADED_ROLES.includes(box.role)))continue;const b=inspection?box:seatOnLawn(box,model.terrain);const key=b.role+':'+b.color+(b.illustrative?':simplified':'');if(map.has(key))map.get(key)!.push(b);else map.set(key,[b]);}return [...map.entries()];},[model,inspection]);
 // The simplified paving preview draws the sample paver's joints (yardPreview.ts keeps its size and angle).
 const paverSize=useMemo(()=>{const sample=model.boxes.find(b=>b.role==='paver');return sample?{w:sample.w,d:sample.d,angle:sample.angle||0}:undefined;},[model]);
 const occlusion=useGroundOcclusion();
 return <group name="combined-yard-features">{groups.map(([key,items])=><YardBatch key={key} items={items} role={items[0].role} color={!inspection&&items[0].role==='bedding'?shade(items[0].color,JOINT_SHADE):items[0].color} occlusion={occlusion} paverSize={items[0].illustrative?paverSize:undefined}/>)}{!inspection&&<RetainedBanks model={model} occlusion={occlusion}/>}<WaterMotion model={model}/>{inspection&&model.members.map(m=>{const a=new THREE.Vector3(m.a.x,m.a.y,m.a.z),b=new THREE.Vector3(m.b.x,m.b.y,m.b.z),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return <mesh key={m.id} position={a.clone().add(b).multiplyScalar(.5)} quaternion={q}><cylinderGeometry args={[m.width/2,m.width/2,a.distanceTo(b),10]}/><meshStandardMaterial color={m.color} roughness={.65}/></mesh>;})}</group>;
}
