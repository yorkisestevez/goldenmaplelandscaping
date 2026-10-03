import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {lawnHeight} from '../src/features/deckcraft/components/viewer3d/lawnSurface';
import {pathBankGeometry} from '../src/features/deckcraft/components/viewer3d/finishedGrade';
import {yardFinishGeometry} from '../src/features/deckcraft/components/viewer3d/yardFinishGeometry';
import type {YardBox} from '../src/features/deckcraft/yardModel';
let triangles=0,checks=0;const ok=(v:unknown)=>{assert.ok(v);checks++;};
for(const role of ['wall-block','wall-cap'] as const){
 const b:YardBox={id:'test',featureId:'test',role,color:'#aaa',x:0,y:20,z:0,w:30,d:14,h:role==='wall-cap'?2.36:7.087,polygon:[{x:-15,y:-7},{x:15,y:-7},{x:15,y:7},{x:-15,y:7}]};
 const g=yardFinishGeometry(b);g.computeBoundingBox();const bounds=g.boundingBox!;ok(Math.abs(bounds.max.y-(b.y+b.h/2))<1e-5);ok(Math.abs(bounds.min.y-(b.y-b.h/2))<1e-5);ok(Math.abs(bounds.min.x+15)<1e-5);ok(Math.abs(bounds.max.z-7)<1e-5);ok(g.getAttribute('position').count>36);g.dispose();
}
const cut=[{x:-35,y:40},{x:35,y:40},{x:35,y:70},{x:-35,y:70}];
for(const path of [
 [{x:-120,y:0},{x:120,y:0}],
 [{x:-100,y:0},{x:0,y:0},{x:-90,y:35}],
 Array.from({length:25},(_,i)=>({x:144*Math.cos(i/24*Math.PI),y:144*Math.sin(i/24*Math.PI)})),
 Array.from({length:40},(_,i)=>({x:i*18,y:Math.sin(i*.35)*110})),
]){
 const start=performance.now(),g=pathBankGeometry(path,10,28,{elevationIn:0,slopePct:0},undefined,[cut])!;ok(g);const p=g.getAttribute('position'),n=g.getAttribute('normal'),ix=g.index!,seen=new Set<string>();
 for(let i=0;i<p.count;i++){const key=`${p.getX(i).toFixed(4)}:${p.getZ(i).toFixed(4)}`;assert.ok(!seen.has(key),`duplicate ${key}`);checks++;seen.add(key);assert.ok(Number.isFinite(n.getX(i)+n.getY(i)+n.getZ(i)),`normal ${i}`);checks++;assert.ok(p.getY(i)<=28.00001&&p.getY(i)>=lawnHeight({elevationIn:0,slopePct:0},p.getZ(i))-1.00001,`height ${p.getY(i)}`);checks++;}
 // Every plan triangle is nondegenerate, faces up, and obeys the patio mask.
 for(let i=0;i<ix.count;i+=3){const a=ix.getX(i),b=ix.getX(i+1),c=ix.getX(i+2),cross=(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a))-(p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a));assert.ok(cross>1e-7,`triangle cross ${cross}`);checks++;const x=(p.getX(a)+p.getX(b)+p.getX(c))/3,z=(p.getZ(a)+p.getZ(b)+p.getZ(c))/3;ok(!(x>-35.00001&&x<34.99999&&z>40.00001&&z<69.99999));triangles++;}
 // With one globally indexed height field, there cannot be two heights at one
 // plan vertex or the folded offset rows that the stress screenshot exposed.
 console.log(`Bank: ${path.length} path points, ${p.count} vertices, ${ix.count/3} triangles, ${(performance.now()-start).toFixed(0)}ms`);g.dispose();
}
console.log(`Wall finish graphics passed: ${checks} assertions, ${triangles} triangles across straight, acute, curved and winding banks.`);
