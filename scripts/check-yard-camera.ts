import assert from 'node:assert/strict';
import * as THREE from 'three';
import {overviewCamera} from '../src/features/deckcraft/components/viewer3d/cameraFraming';

let checks=0;
for(const [w,d,height] of [[16,12,6],[65,95,16],[100,20,28],[12,160,12],[180,180,36],[6,6,32]]){
 for(const aspect of [.5,.72,1,1.72,2.4,3.5]){
  const cx=-37,cz=61,frame=overviewCamera({w,d,height,cx,cz,aspect});
  const camera=new THREE.PerspectiveCamera(38,aspect,.01,10000);
  camera.position.set(...frame.position);camera.lookAt(...frame.target);camera.updateMatrixWorld(true);
  for(const x of [cx-w/2,cx+w/2])for(const y of [-1,height])for(const z of [cz-d/2,cz+d/2]){
   const projected=new THREE.Vector3(x,y,z).project(camera);
   assert.ok(Math.abs(projected.x)<=1/1.12+1e-6&&Math.abs(projected.y)<=1/1.12+1e-6,`Complete envelope stays in frame: ${w} × ${d} × ${height}, aspect ${aspect}`);
   assert.ok(projected.z>-1&&projected.z<1);checks+=2;
  }
 }
}
const points:{x:number;y:number;z:number}[]=[];
for(const x of [0,24])for(const z of [-24,0])for(const y of [-1,18])points.push({x,y,z});
for(const x of [-12,42])for(const z of [20,62])for(const y of [-1,3])points.push({x,y,z});
for(const aspect of [.72,1.72]){
 const envelope={w:54,d:86,cx:15,cz:19,height:18,aspect},global=overviewCamera(envelope),fit=overviewCamera({...envelope,points});
 const distance=(frame:typeof fit)=>Math.hypot(...frame.position.map((p,i)=>p-frame.target[i]));
 console.log(`Visible-envelope fit at aspect ${aspect}: ${distance(fit).toFixed(1)} ft versus ${distance(global).toFixed(1)} ft for the global box`);
 assert.ok(distance(fit)<distance(global),'Individual envelopes give a closer fit than filling the entire yard with roof-height corners');checks++;
 const camera=new THREE.PerspectiveCamera(38,aspect,.01,10000);camera.position.set(...fit.position);camera.lookAt(...fit.target);camera.updateMatrixWorld(true);
 for(const p of points){const projected=new THREE.Vector3(p.x,p.y,p.z).project(camera);assert.ok(Math.abs(projected.x)<=1/1.12+1e-6&&Math.abs(projected.y)<=1/1.12+1e-6);checks++;}
}
console.log(`Yard camera passed: ${checks} assertions using actual Three perspective projection across wide, narrow, long and tall designs, including a closer fit for separate visible envelopes.`);
