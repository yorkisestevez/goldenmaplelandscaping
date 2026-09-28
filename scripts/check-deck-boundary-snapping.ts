import assert from 'node:assert/strict';
import {snapBoundaryMove,type BoundarySnapContext} from '../src/features/deckcraft/designer/boundarySnap';
import {reconcileBoundaryLocks} from '../src/features/deckcraft/designer/boundaryDimensions';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {savedBoundary} from '../src/features/deckcraft/lib/freeOutline';
import type {PlanPoint} from '../src/features/deckcraft/lib/deckGeometry';
import {placeBoundaryLabel} from '../src/features/deckcraft/designer/boundaryLabelPlacement';
let checks=0;const ok=(v:unknown,label:string)=>{assert.ok(v,label);checks++;},eq=(a:unknown,b:unknown,label:string)=>{assert.deepEqual(a,b,label);checks++;};
const near=(a:number,b:number)=>Math.abs(a-b)<1e-7;
const blank:BoundarySnapContext={corners:[],lines:[]};
for(const width of [360,760])for(const height of [250,390,620])for(const x of [-400,20,width/2,width-20,width+400])for(const y of [-300,10,height/2,height-10,height+300]){
 const clip={left:0,top:0,right:width,bottom:height},obstacles=[{left:0,top:0,right:width,bottom:48},{left:width-280,top:height-66,right:width-10,bottom:height-10}],p=placeBoundaryLabel({x,y},76,44,clip,obstacles);
 ok(p.x>=44&&p.x<=width-44&&p.y>=28&&p.y<=height-28,'Every edge label stays within visible clipping bounds despite offscreen preferred position');
 ok(obstacles.every(r=>p.x+38<=r.left||p.x-38>=r.right||p.y+22<=r.top||p.y-22>=r.bottom),'Labels avoid toolbar/navigation instead of raising over them');
}
const rect:PlanPoint[]=[{x:0,y:20},{x:100,y:20},{x:100,y:144},{x:0,y:144}];
const context:BoundarySnapContext={corners:[{point:{x:100,y:0},label:'House corner'}],lines:[{a:{x:0,y:0},b:{x:300,y:0},label:'house wall'}]};
const immutable=JSON.stringify({rect,context});rect.forEach(Object.freeze);Object.freeze(rect);context.corners.forEach(Object.freeze);context.lines.forEach(Object.freeze);
const corner=snapBoundaryMove(rect,'point',1,1,-18,context,3);eq(corner.points[1],{x:100,y:0},'Near house corner snaps both coordinates to actual target');ok(corner.guides.some(g=>g.label==='House corner'),'Actual house-corner guide identified');
const wall=snapBoundaryMove(rect,'point',1,30,-18,{corners:[],lines:context.lines},3);eq(wall.points[1],{x:130,y:0},'Point projects to finite house wall');ok(wall.guides.some(g=>g.label==='On house wall'),'Actual wall guide identified');
const beyond=snapBoundaryMove(rect,'point',1,250,-18,{corners:[],lines:context.lines},3);eq(beyond.points[1],{x:350,y:2},'Wall snapping never extends unsupported wall beyond its endpoints');
const free=snapBoundaryMove(rect,'point',1,1,-18,context,0);eq(free.points[1],{x:101,y:2},'Disabled snapping preserves exact free movement');eq(free.guides,[],'Disabled snapping produces no guide');
const equal=snapBoundaryMove([{x:0,y:0},{x:103,y:80},{x:200,y:0}],'point',1,0,0,blank,4);eq(equal.points[1],{x:100,y:80},'Equal spacing uses actual adjacent-corner distances');ok(near(Math.hypot(equal.points[1].x,equal.points[1].y),Math.hypot(equal.points[1].x-200,equal.points[1].y)),'Equal-distance geometry independently verified');ok(equal.guides.length===2&&equal.guides.every(g=>/Equal distance/.test(g.label)),'Both equal-distance legs shown');
const diag:BoundarySnapContext={corners:[],lines:[{a:{x:-300,y:-300},b:{x:-200,y:-200},label:'other level edge'}]};
const parallel=snapBoundaryMove([{x:0,y:0},{x:101,y:102},{x:200,y:200},{x:0,y:300}],'point',1,0,0,diag,2);ok(near(parallel.points[1].x,parallel.points[1].y),'Arbitrary 45-degree parallel snap changes actual endpoint geometry');ok(parallel.guides.some(g=>/Parallel/.test(g.label)),'Parallel guide explains relation');
const perpendicular=snapBoundaryMove([{x:0,y:0},{x:-99,y:101},{x:200,y:0}],'point',1,0,0,diag,2);ok(near(perpendicular.points[1].x+perpendicular.points[1].y,0),'Perpendicular snap has zero dot product with arbitrary reference edge');ok(perpendicular.guides.some(g=>/Perpendicular/.test(g.label)),'Perpendicular guide explains relation');
const other=snapBoundaryMove(rect,'point',1,27,9,{corners:[{point:{x:128,y:800},label:'Level 2 corner'}],lines:[]},2);ok(near(other.points[1].x,128),'Alignment to another level uses its actual local-converted corner');ok(other.guides.some(g=>/Level 2/.test(g.label)),'Other-level guide remains attributable');
for(let step=0;step<101;step++)for(const kind of ['edge','area'] as const){
 const dx=step*.31-15,dy=step*.17-8,result=snapBoundaryMove(rect,kind,0,dx,dy,context,100),moving=kind==='area'?[0,1,2,3]:[0,1];
 ok(Math.hypot(result.dxIn-dx,result.dyIn-dy)<=6+1e-7,'Soft snap never moves farther than six physical inches');
 ok(moving.every(i=>near(result.points[i].x-rect[i].x,result.dxIn)&&near(result.points[i].y-rect[i].y,result.dyIn)),'A moved edge/area receives one rigid translation, never endpoint distortion');
 ok(near(result.points[1].x-result.points[0].x,100)&&near(result.points[1].y-result.points[0].y,0),'Locked edge vector survives soft rigid snapping');
 ok(!!reconcileBoundaryLocks({...DEFAULT_DECK,levels:1,deckOutlines:{main:savedBoundary(rect)},boundaryLocks:[{level:1,edge:0,dxIn:100,dyIn:0}]},1,rect,result.points),'Existing lock reconciliation accepts rigid snapped gestures');
 ok(result.guides.every(g=>[g.a.x,g.a.y,g.b.x,g.b.y].every(Number.isFinite)),'Guide coordinates remain finite');
}
eq(JSON.stringify({rect,context}),immutable,'Snapping never mutates immutable design or context');
const lockedPoint=snapBoundaryMove(rect,'point',1,30,-18,context,3);eq(reconcileBoundaryLocks({...DEFAULT_DECK,levels:1,deckOutlines:{main:savedBoundary(rect)},boundaryLocks:[{level:1,edge:0,dxIn:100,dyIn:0}]},1,rect,lockedPoint.points),null,'Snapping never supplies an implicit unlock for a changing vector');
console.log(`Deck boundary snapping: ${checks} geometry, alignment, lock and immutable-input checks passed.`);
