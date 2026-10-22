import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {newLandscapeObject} from '../src/features/deckcraft/landscapeCatalogue';
import {landscapeInstanceMatrix} from '../src/features/deckcraft/components/viewer3d/Landscape3D';
import {FURNITURE_MESH_YAW_DEG,furnitureFacingIssues,rotationDegFacing,seatFront} from '../src/features/deckcraft/furnitureFacing';
import {ontarioShowcaseDesign} from '../src/features/deckcraft/showcaseSample';
import type {LandscapeAssetId} from '../src/features/deckcraft/landscapeTypes';

const seating:LandscapeAssetId[]=['outdoor-chair','outdoor-sofa','lounge-chair','curved-sectional','swivel-lounge-chair','modular-sofa','woven-dining-chair','bar-stool'];
(globalThis as {self?:unknown}).self=globalThis;
const loader=new GLTFLoader();
// The landscape models are meshopt-compressed (PR 155).
loader.setMeshoptDecoder(MeshoptDecoder);
function load(file:string){
 const buf=readFileSync(file);
 return new Promise<THREE.Group>((resolve,reject)=>loader.parse(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),'',g=>resolve(g.scene),reject));
}
/** `wraps`: the back wraps round toward the front (barrel chair, curved sectional), so the tall end sits near the
 * middle and the front is read from the opening instead. */
function measuredFront(scene:THREE.Object3D,wraps=false,band=.7){
 scene.updateMatrixWorld(true);
 const pos:THREE.Vector3[]=[];
 scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;const attr=mesh.geometry.getAttribute('position');for(let i=0;i<attr.count;i++)pos.push(new THREE.Vector3().fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld));});
 const box=new THREE.Box3().setFromPoints(pos),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const tall=pos.filter(p=>p.y>box.min.y+size.y*band);
 assert.ok(tall.length>20, 'backrest sample');
 const mx=tall.reduce((s,p)=>s+p.x,0)/tall.length,mz=tall.reduce((s,p)=>s+p.z,0)/tall.length;
 let dx=center.x-mx,dz=center.z-mz,len=Math.hypot(dx,dz);
 if(wraps){
  // A back that wraps round the seat (barrel chair, curved sectional): the front is the middle of the widest open
  // arc in the tall band, seen from the plan centre.
  const angles=tall.map(p=>Math.atan2(p.x-center.x,p.z-center.z)).sort((a,b)=>a-b);
  let gap=0,mid=0;
  for(let i=0;i<angles.length;i++){const a=angles[i],b=i+1<angles.length?angles[i+1]:angles[0]+2*Math.PI;if(b-a>gap){gap=b-a;mid=(a+b)/2;}}
  assert.ok(gap>Math.PI/4, 'the wrapped back has a clear opening');
  dx=Math.sin(mid);dz=Math.cos(mid);len=1;
 }else assert.ok(len>Math.min(size.x,size.z)*.2, 'the tall end is not centred, so the seat has a front');
 // An asymmetric backrest shifts the centroid off the seat axis. The facing axis is the dominant one.
 if(Math.abs(dz)>Math.abs(dx)*2)return {x:0,z:Math.sign(dz)};
 if(Math.abs(dx)>Math.abs(dz)*2)return {x:Math.sign(dx),z:0};
 return {x:dx/len,z:dz/len};
}
function yawOf(front:{x:number;z:number}){
 const deg=-Math.atan2(front.x,front.z)*180/Math.PI;
 return ((deg+180)%360+360)%360-180;
}
for(const id of seating){
 const expected=FURNITURE_MESH_YAW_DEG[id]??0;
 for(const lod of [0,1,2]){
  const scene=await load(`public/deckcraft/landscape/${id}-lod${lod}.glb`);
  let front;try{// An armchair's arms and a bar stool's seat reach the 70% band, so read their backs from the top 15%.
  front=measuredFront(scene,['curved-sectional','swivel-lounge-chair'].includes(id),id==='woven-dining-chair'||id==='bar-stool'?.85:.7);}catch(e){throw Error(`${id} lod${lod}: ${(e as Error).message}`);}const yaw=yawOf(front);
  const delta=Math.abs(((yaw-expected+540)%360)-180);
  assert.ok(delta<15, `${id} lod${lod} front needs yaw ${yaw.toFixed(1)}°, recorded ${expected}°`);
 }
}
const chair=landscapeInstanceMatrix({...DEFAULT_DECK} as never,{...newLandscapeObject('outdoor-chair','chair',0,0),rotationDeg:0},new THREE.Matrix4(),new THREE.Matrix4());
const origin=new THREE.Vector3().applyMatrix4(chair);
const rawFront=new THREE.Vector3(0,0,-1).applyMatrix4(chair).sub(origin).normalize();
assert.ok(rawFront.z>.95&&Math.abs(rawFront.x)<.05, 'folding-chair seat front renders toward +Z at rotation 0');
const sofa=landscapeInstanceMatrix({...DEFAULT_DECK} as never,{...newLandscapeObject('outdoor-sofa','sofa',0,0),rotationDeg:0},new THREE.Matrix4(),new THREE.Matrix4());
const sofaFront=new THREE.Vector3(0,0,1).applyMatrix4(sofa).sub(new THREE.Vector3().applyMatrix4(sofa)).normalize();
assert.ok(sofaFront.z>.95&&Math.abs(sofaFront.x)<.05, 'sofa seat front renders toward +Z at rotation 0');
assert.ok(Math.abs(rotationDegFacing(0,1))<1e-6);
assert.ok(Math.abs(rotationDegFacing(-1,0)-90)<1e-6);
const east=seatFront(90);assert.ok(east.x<-.99&&Math.abs(east.z)<.01);
const design=ontarioShowcaseDesign(),issues=furnitureFacingIssues(design);
assert.deepEqual(issues, [], issues.join('; '));
const count=(pred:(o:NonNullable<typeof design.landscapeObjects>[number])=>boolean)=>design.landscapeObjects?.filter(pred).length;
assert.equal(count(o=>o.assetId==='woven-dining-chair'&&o.id.startsWith('dining-')),8);
assert.equal(count(o=>o.assetId==='outdoor-chair'||o.assetId==='outdoor-sofa'),0,'no folding chairs or legacy sofas in the showcase');
assert.equal(count(o=>(o.assetId==='modular-sofa'||o.assetId==='swivel-lounge-chair')&&o.supportFeatureId==='terrace'),3);
assert.equal(count(o=>(o.assetId==='curved-sectional'||o.assetId==='swivel-lounge-chair')&&o.supportFeatureId==='lounge'),3);
assert.equal(count(o=>o.assetId==='bar-stool'),4);
assert.equal(count(o=>o.assetId==='lounge-chair'),4);
// Dining chairs and bar stools square up to the edge in front of them, not the table centre.
for(const o of design.landscapeObjects??[])if(o.assetId==='woven-dining-chair'||o.assetId==='bar-stool')assert.ok(Math.abs(((o.rotationDeg%90)+90)%90)<0.5||Math.abs(((o.rotationDeg%90)+90)%90-90)<0.5,`${o.id} is square to its table`);
console.log('FURNITURE FACING OK — chair mesh yaw 180°, the other seats already +Z; dining, bar, terrace lounge, fire lounge and pool seats face their targets.');
