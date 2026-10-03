import assert from 'node:assert/strict';
import {yardShapeDimension,yardShapeEdit,yardShapeFrame,yardShapeInsert,yardShapeLocalPoint,yardShapeLocalPoints,yardShapeMove,yardShapeProblem,yardShapePull,yardShapeRemove,yardShapeResize,yardShapeRunIn,yardShapeSignedArea,yardShapeWorldPoint,yardShapeWorldPoints} from '../src/features/deckcraft/yardShapeEditing';
import type {YardFeature} from '../src/features/deckcraft/types';
import type {PlanPoint} from '../src/features/deckcraft/lib/deckGeometry';

let checks=0;
const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};
const equal=(a:unknown,b:unknown,m:string)=>{assert.deepEqual(a,b,m);checks++;};
const near=(a:number,b:number,m:string)=>ok(Math.abs(a-b)<1e-7,m);
const samePoints=(a:PlanPoint[],b:PlanPoint[],m:string)=>{equal(a.length,b.length,m);a.forEach((p,i)=>{near(p.x,b[i].x,m);near(p.y,b[i].y,m);});};
const rejected=(fn:()=>unknown,m:string)=>{assert.throws(fn,undefined,m);checks++;};
const patio:YardFeature={id:'measured-patio',kind:'patio',name:'Measured patio',enabled:true,xFt:13.5,zFt:28.25,widthFt:16,depthFt:12,heightIn:3,rotationDeg:37,productId:'permacon-melville',color:'#aaa69b'};
const wall:YardFeature={...patio,id:'measured-wall',kind:'retaining-wall',name:'Measured wall',widthFt:16,depthFt:1,heightIn:24,productId:'segmental-concrete'};

// Legacy primitives retain absent custom fields for exact no-ops, movements and ordinary numeric dimensions.
for(const f of [patio,wall]){
 const before=JSON.stringify(f),local=yardShapeLocalPoints(f),world=yardShapeWorldPoints(f);
 ok(!yardShapeProblem(f.kind as 'patio'|'retaining-wall',local),'Legacy local shapes are valid');equal(yardShapeEdit(f,world),f,'A measured no-op preserves legacy configuration exactly');
 samePoints(world.map(p=>yardShapeLocalPoint(f,p)),local,'Rotation and translation round trip');samePoints(local.map(p=>yardShapeWorldPoint(f,p)),world,'Local points map to the same world drawing');
 const moved=yardShapeMove(f,12.25,-23.5);near(moved.xFt,f.xFt+12.25/12,'Whole movement uses world across inches');near(moved.zFt,f.zFt-23.5/12,'Whole movement uses world out inches');ok(!moved.outline&&!moved.wallPath,'Whole movement does not add custom shape fields');
 const resized=yardShapeResize(f,18,f.depthFt);equal(resized.widthFt,18,'Legacy numeric width remains a primitive dimension');ok(!resized.outline&&!resized.wallPath,'Legacy resizing keeps original primitive behavior');equal(JSON.stringify(f),before,'Geometry operations never mutate their source');
}

// Point/edge pulls are world-coordinate motion at any rotation, and recentering does not drift other points.
const source=yardShapeWorldPoints(patio),pulled=yardShapePull(patio,'point',2,25.125,-8.75),world=yardShapeWorldPoints(pulled);
source.forEach((p,i)=>{near(world[i].x,p.x+(i===2?25.125:0),'Point pull moves only the chosen world X');near(world[i].y,p.y+(i===2?-8.75:0),'Point pull moves only the chosen world Y');});
equal(pulled.rotationDeg,patio.rotationDeg,'Point pulls retain selected rotation');equal(pulled.productId,patio.productId,'Point pulls retain selected product');equal(pulled.heightIn,patio.heightIn,'Point pulls retain selected surface elevation');equal(pulled.color,patio.color,'Point pulls retain selected visual finish');
const specified={...patio,hardscape:{finishId:'selected-finish',colorId:'selected-colour',unitId:'selected-unit',patternId:'selected-pattern',angleDeg:17.5,jointMm:3.25}};
for(const edited of [yardShapePull(specified,'point',2,18.25,12.5),yardShapeResize(specified,18,15),yardShapeMove(specified,12,-6),yardShapeInsert(specified,0)])equal(edited.hardscape,specified.hardscape,'Shape edits retain the exact selected finish, colour, unit, pattern, lay direction and joint size');
const edge=yardShapePull(patio,'edge',3,-17.125,9.625),edgeWorld=yardShapeWorldPoints(edge);source.forEach((p,i)=>{near(edgeWorld[i].x,p.x+([0,3].includes(i)?-17.125:0),'Closing edge pull moves both endpoints');near(edgeWorld[i].y,p.y+([0,3].includes(i)?9.625:0),'Closing edge pull leaves other endpoints exact');});
const added=yardShapeInsert(pulled,0),addedWorld=yardShapeWorldPoints(added);equal(addedWorld.length,5,'A collinear midpoint remains a real pull handle');near(addedWorld[1].x,(world[0].x+world[1].x)/2,'Inserted point stays on the selected edge');near(addedWorld[1].y,(world[0].y+world[1].y)/2,'Inserted point preserves the polygon silhouette');
const removed=yardShapeRemove(added,1);samePoints(yardShapeWorldPoints(removed),world,'Removing an added collinear pull point restores the same world outline');
const projected=yardShapeInsert(patio,0,{x:(source[0].x+source[1].x)/2+40,y:(source[0].y+source[1].y)/2-50});ok(!yardShapeProblem('patio',projected.outline),'Cursor insertion projects onto a finite actual edge');
rejected(()=>yardShapeInsert(patio,0,source[0]),'Insertion refuses a duplicate endpoint');rejected(()=>yardShapeRemove({...patio,outline:[{x:-60,y:-60},{x:60,y:-60},{x:0,y:60}]},0),'Triangles retain their minimum point count');

// A retaining-wall L has one open path, no phantom closing segment, and measured run is the sum of its segments.
const localL=[{x:-96,y:-72},{x:96,y:-72},{x:96,y:72}],l=yardShapeEdit(wall,localL.map(p=>yardShapeWorldPoint(wall,p)));
near(l.widthFt,28,'L wall run is 16 + 12 ft, rather than its rectangular bounding width');equal(l.depthFt,1,'Wall path edits keep its physical thickness');samePoints(l.wallPath!,localL,'World/local conversion keeps the open L corner exact');
const wallPoint=yardShapePull(l,'point',2,12.625,-6.75);samePoints(yardShapeWorldPoints(wallPoint).slice(0,2),yardShapeWorldPoints(l).slice(0,2),'A wall endpoint pull cannot move the start or turn');near(wallPoint.widthFt,yardShapeRunIn(wallPoint.wallPath!)/12,'Wall run updates after arbitrary endpoint pulls');
const wallEdge=yardShapePull(l,'edge',1,18,7);samePoints(yardShapeWorldPoints(wallEdge).slice(0,1),yardShapeWorldPoints(l).slice(0,1),'Pulling the final wall segment retains the first endpoint');
const wallAdded=yardShapeInsert(l,0);equal(wallAdded.wallPath?.length,4,'Walls support added collinear pull points');near(wallAdded.widthFt,28,'A wall midpoint cannot add phantom closing length');
rejected(()=>yardShapePull(l,'edge',2,1,0),'An open wall has no closing edge to pull');rejected(()=>yardShapeInsert(l,2),'An open wall has no phantom edge to insert into');
const longer=yardShapeResize(l,42,.25);near(longer.widthFt,42,'Numeric total wall run scales every path segment');near(yardShapeRunIn(longer.wallPath!),504,'Scaled wall points agree with typed total run');equal(longer.depthFt,.25,'Selected thin wall units retain actual physical thickness');
const ratio=42/28;l.wallPath!.forEach((p,i)=>{near(longer.wallPath![i].x,p.x*ratio,'Wall run scaling retains its L proportions');near(longer.wallPath![i].y,p.y*ratio,'Wall run scaling preserves both axes');});
const resized=yardShapeResize(pulled,20,15);near(resized.widthFt,20,'Patio width is measured along its local product grid');near(resized.depthFt,15,'Patio depth scales the same polygon');equal(resized.outline?.length,pulled.outline?.length,'Resizing cannot replace a custom patio with a rectangle');
const dimension=yardShapeDimension(patio,0,216),dp=yardShapeWorldPoints(dimension);near(Math.hypot(dp[1].x-dp[0].x,dp[1].y-dp[0].y),216,'Typed edge length reaches actual world geometry');samePoints([dp[0],dp[2],dp[3]],[source[0],source[2],source[3]],'An edge dimension keeps its start and all other corners fixed');
const turned=yardShapeDimension({...patio,rotationDeg:0},0,192,7);const tp=yardShapeWorldPoints(turned);near(Math.atan2(tp[1].y-tp[0].y,tp[1].x-tp[0].x)*180/Math.PI,7,'A typed direction permits arbitrary section angles');

// Shared strict validation must fail before evaluation, and invalid gesture results never yield a partial feature.
for(const kind of ['patio','retaining-wall'] as const){
 const valid=kind==='patio'?yardShapeLocalPoints(patio):localL;
 for(const n of [NaN,Infinity,-Infinity,1200.25]){const p=structuredClone(valid);p[1].x=n;ok(!!yardShapeProblem(kind,p),'Non-finite or out-of-range local coordinates are rejected');}
 const unsafe=structuredClone(valid);let accessed=false;Object.defineProperty(unsafe[0],'x',{get(){accessed=true;return 1;},enumerable:true});ok(!!yardShapeProblem(kind,unsafe)&&!accessed,'Accessor point import is refused without evaluation');
 const sparse=structuredClone(valid);delete sparse[1];ok(!!yardShapeProblem(kind,sparse),'Sparse shape arrays fail explicitly');
 const extra=structuredClone(valid);Object.defineProperty(extra[0],'source',{value:'unsafe',enumerable:true});ok(!!yardShapeProblem(kind,extra),'Unknown point metadata cannot enter geometry');
}
ok(!!yardShapeProblem('patio',[{x:-96,y:-72},{x:96,y:72},{x:96,y:-72},{x:-96,y:72}]),'Crossing patio is rejected');
ok(!!yardShapeProblem('patio',yardShapeLocalPoints(patio).reverse()),'Reversed outlines are rejected rather than silently reindexing handles');
ok(!!yardShapeProblem('retaining-wall',[{x:0,y:0},{x:60,y:0},{x:30,y:0}]),'Wall double-back cannot duplicate run');
ok(!!yardShapeProblem('retaining-wall',[{x:0,y:0},{x:80,y:80},{x:0,y:80},{x:80,y:0}]),'Crossing open wall is rejected');
ok(!!yardShapeProblem('retaining-wall',[{x:0,y:0},{x:60,y:0},{x:60,y:60},{x:0,y:0}]),'Closed wall path cannot create a hidden duplicate endpoint');
rejected(()=>yardShapePull(patio,'point',0,Infinity,0),'A non-finite pull cannot return partial geometry');
rejected(()=>yardShapeMove(patio,3000,0),'Whole movement respects world yard coordinate limits');
rejected(()=>yardShapeEdit(wall,[{x:-1200,y:-1200},{x:1200,y:-1200},{x:1200,y:1200}]),'240 ft total wall path limit applies within valid point coordinates');
rejected(()=>yardShapeResize(pulled,61,12),'Patio numeric dimensions cannot exceed the pricing/editing envelope');
const fine=yardShapeLocalPoints(patio);fine.splice(1,0,{x:-95.5,y:-72});ok(!!yardShapeProblem('patio',fine),'Short pull-point segments are refused');
near(yardShapeSignedArea(yardShapeLocalPoints(patio))/144,192,'Independent rectangle area matches the legacy patio');
const frame={x:-40,y:-40,w:480,h:600,viewBox:'-40 -40 480 600',retainedMetadata:{scale:1}};
const fitted=yardShapeFrame(frame,[{...patio,enabled:false,xFt:-100,zFt:190}]);
for(const p of yardShapeWorldPoints({...patio,enabled:false,xFt:-100,zFt:190}))ok(p.x>=fitted.x+39.999&&p.x<=fitted.x+fitted.w-39.999&&p.y>=fitted.y+39.999&&p.y<=fitted.y+fitted.h-39.999,'Excluded features remain reachable inside the editing frame');
equal(fitted.retainedMetadata,frame.retainedMetadata,'Extending editing bounds retains the existing sheet metadata');
equal(frame.viewBox,'-40 -40 480 600','Extending editing bounds does not mutate the normal sheet');
equal(yardShapeFrame(frame,[]),frame,'No yard leaves the original frame exact');
equal(yardShapeFrame(frame,[{...patio,rotationDeg:0,xFt:16,zFt:20,widthFt:4,depthFt:4}]),frame,'Already fitted shapes do not regenerate the normal frame');
console.log(JSON.stringify({checks,status:'passed'}));
