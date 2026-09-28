import assert from 'node:assert/strict';
import {centerInlaySketch,finishInlaySketch,inlaySketchArea,inlaySketchBounds,inlaySketchCorner,inlaySketchProblem,moveInlaySketchPoint,resizeInlaySketch,INLAY_SKETCH_LIMITS} from '../src/features/deckcraft/sketch/inlaySketchGeometry';
import {INLAY_LIMITS} from '../src/features/deckcraft/lib/inlayGeometry';
import type {OutlinePoint} from '../src/features/deckcraft/types';
let checks=0;
function check(value:unknown,message:string){assert.ok(value,message);checks++;}
const l:OutlinePoint[]=[{x:20,y:20},{x:116,y:20},{x:116,y:56},{x:68,y:56},{x:68,y:92},{x:20,y:92}],saved=JSON.stringify(l);
const centered=centerInlaySketch(l),b=inlaySketchBounds(centered);
check(b.w===96&&b.h===72&&b.x===-48&&b.y===-36,'Offset drawing becomes centered inches without resizing');
check(inlaySketchArea(centered)===5184,'Concave L area preserved');
assert.deepEqual(centerInlaySketch([...l].reverse()),centered);checks++;
const calibrated=resizeInlaySketch(centered,126,78),c=inlaySketchBounds(calibrated);
check(c.w===126&&c.h===78,'10ft6in by6ft6in becomes exact inches');
check(Math.abs(inlaySketchArea(calibrated)-inlaySketchArea(centered)*126/96*78/72)<1e-6,'Calibration scales real polygon area rather than rectangular envelope');
const moved=moveInlaySketchPoint(centered,2,-4,3);
check(moved[2].x===centered[2].x-4&&moved[2].y===centered[2].y+3,'Point move changes both axes');
for(const i of [0,1,3,4,5]){assert.deepEqual(moved[i],centered[i]);checks++;}
check(JSON.stringify(l)===saved,'No helper mutates input');
assert.deepEqual(inlaySketchCorner([{x:0,y:0},{x:24,y:0}],{x:26,y:25},true),{x:24,y:25});checks++;
assert.deepEqual(inlaySketchCorner([{x:0,y:0}],{x:12,y:8},false),{x:12,y:8});checks++;
const closed=finishInlaySketch([{x:0,y:0},{x:72,y:0},{x:72,y:36}],true);
check(closed.length===4&&closed[3].x===0&&closed[3].y===36,'Square guide closes missing final corner without repeat endpoint');
check(!inlaySketchProblem(closed),'Guided outline valid');
for(const points of [[],[{x:0,y:0},{x:12,y:0}], [{x:0,y:0},{x:12,y:12},{x:0,y:12},{x:12,y:0}], [{x:0,y:0},{x:12,y:0},{x:6,y:0}], [{x:0,y:0},{x:12,y:0},{x:12,y:12},{x:0,y:0}], [{x:NaN,y:0},{x:12,y:0},{x:12,y:12}], [{x:0,y:0},{x:241,y:0},{x:241,y:12},{x:0,y:12}]])check(!!inlaySketchProblem(points),'Malformed/crossed/zero-area/repeated/oversized draft rejected');
const circle=Array.from({length:64},(_,i)=>({x:100*Math.cos(i*Math.PI/32),y:100*Math.sin(i*Math.PI/32)}));
check(!inlaySketchProblem(circle),'All64 genuine corners supported');
check(!!inlaySketchProblem([...circle,{x:101,y:0}]),'65th corner rejected');
check(!inlaySketchProblem([{x:-120,y:-120},{x:120,y:-120},{x:120,y:120},{x:-120,y:120}]),'Exact20ft span accepted without clamping');
for(const n of [0,-12,Infinity,NaN,240.01]){assert.throws(()=>resizeInlaySketch(l,n,36));checks++;}
check(INLAY_SKETCH_LIMITS.points===INLAY_LIMITS.customPoints&&INLAY_SKETCH_LIMITS.spanIn===INLAY_LIMITS.customSpanIn&&INLAY_SKETCH_LIMITS.coordinateIn===INLAY_LIMITS.customCoordinateIn,'Sketch/core bounds stay aligned');
console.log(JSON.stringify({status:'passed',checks}));
