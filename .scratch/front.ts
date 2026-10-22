import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
(globalThis as any).self=globalThis;
const loader=new GLTFLoader();
for(const lod of [0,1,2]){
 const buf=readFileSync(`public/deckcraft/landscape/swivel-lounge-chair-lod${lod}.glb`);
 const scene:any=await new Promise((r,j)=>loader.parse(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),'',g=>r(g.scene),j));
 scene.updateMatrixWorld(true);const pos:THREE.Vector3[]=[];
 scene.traverse((o:any)=>{if(!o.isMesh)return;const a=o.geometry.getAttribute('position');for(let i=0;i<a.count;i++)pos.push(new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld));});
 const box=new THREE.Box3().setFromPoints(pos),size=box.getSize(new THREE.Vector3()),c=box.getCenter(new THREE.Vector3());
 const tall=pos.filter(p=>p.y>box.min.y+size.y*.7);const mx=tall.reduce((s,p)=>s+p.x,0)/tall.length,mz=tall.reduce((s,p)=>s+p.z,0)/tall.length;
 console.log(lod,tall.length,(c.x-mx).toFixed(3),(c.z-mz).toFixed(3),(Math.hypot(c.x-mx,c.z-mz)/Math.min(size.x,size.z)).toFixed(3));
}
