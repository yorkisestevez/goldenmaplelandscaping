import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {newLandscapeObject} from '../src/features/deckcraft/landscapeCatalogue';
import {landscapeInstanceMatrix} from '../src/features/deckcraft/components/viewer3d/Landscape3D';
import {FURNITURE_MESH_YAW_DEG,furnitureFacingIssues,rotationDegFacing,seatFront} from '../src/features/deckcraft/furnitureFacing';
import {ontarioShowcaseDesign} from '../src/features/deckcraft/showcaseSample';
import type {LandscapeAssetId} from '../src/features/deckcraft/landscapeTypes';

const seating:LandscapeAssetId[]=['outdoor-chair','outdoor-sofa','lounge-chair'];
(globalThis as {self?:unknown}).self=globalThis;
const loader=new GLTFLoader();
function load(file:string){
 const buf=readFileSync(file);
 return new Promise<THREE.Group>((resolve,reject)=>loader.parse(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),'',g=>resolve(g.scene),reject));
}
function measuredFront(scene:THREE.Object3D){
 scene.updateMatrixWorld(true);
 const pos:THREE.Vector3[]=[];
 scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;const attr=mesh.geometry.getAttribute('position');for(let i=0;i<attr.count;i++)pos.push(new THREE.Vector3().fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld));});
 const box=new THREE.Box3().setFromPoints(pos),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const tall=pos.filter(p=>p.y>box.min.y+size.y*.7);
 assert.ok(tall.length>20, 'backrest sample');
 const mx=tall.reduce((s,p)=>s+p.x,0)/tall.length,mz=tall.reduce((s,p)=>s+p.z,0)/tall.length;
 const dx=center.x-mx,dz=center.z-mz,len=Math.hypot(dx,dz);
 assert.ok(len>Math.min(size.x,size.z)*.2, 'the tall end is not centred, so the seat has a front');
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
  const front=measuredFront(scene),yaw=yawOf(front);
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
const groups={
 dining:design.landscapeObjects?.filter(o=>o.assetId==='outdoor-chair'&&o.supportFeatureId==='terrace').length,
 sofas:design.landscapeObjects?.filter(o=>o.assetId==='outdoor-sofa').length,
 pool:design.landscapeObjects?.filter(o=>o.assetId==='lounge-chair').length,
};
assert.equal(groups.dining,8);
assert.equal(groups.sofas,2);
assert.equal(groups.pool,4);
console.log('FURNITURE FACING OK — chair mesh yaw 180°, sofa and chaise already +Z; dining, fire lounge and pool seats face their targets.');
