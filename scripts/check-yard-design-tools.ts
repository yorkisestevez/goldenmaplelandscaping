import assert from 'node:assert/strict';
import {applyYardStarter,curveYardEdge,wallMinimumRadiusIn,YARD_PATIO_STARTERS,YARD_WALL_STARTERS,YARD_CURVE_TOLERANCE} from '../src/features/deckcraft/yardDesignTools';
import {arcGeometry} from '../src/features/deckcraft/circularArcs';
import {inspectArcShape} from '../src/features/deckcraft/circularArcShape';
import {yardShapeCurveWorldPoints,yardShapeLocalPoints,yardShapeWorldPoints,yardShapeWorldPoint,yardShapeRunIn,yardShapeProblem,yardShapeSignedArea} from '../src/features/deckcraft/yardShapeEditing';
import {HARDSCAPE_PRODUCTS,hardscapeBody,hardscapeProblem} from '../src/features/deckcraft/hardscapeCatalogue';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {parseDesign,serializeDesign} from '../src/features/deckcraft/designPersistence';
import type {PlanPoint} from '../src/features/deckcraft/lib/deckGeometry';
import type {YardFeature} from '../src/features/deckcraft/types';

let checks=0;
const check=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};
const equal=(a:unknown,b:unknown,m:string)=>{assert.deepEqual(a,b,m);checks++;};
const near=(a:number,b:number,m:string,t=1e-7)=>check(Math.abs(a-b)<=t,`${m}: ${a} vs ${b}`);
const same=(a:PlanPoint,b:PlanPoint,m:string)=>{near(a.x,b.x,m);near(a.y,b.y,m);};
const reject=(fn:()=>unknown,m:string)=>{assert.throws(fn,undefined,m);checks++;};
const pavingProduct=HARDSCAPE_PRODUCTS.find(p=>p.category!=='wall'&&p.finishes.some(f=>f.units.some(u=>hardscapeBody(u.role)&&!u.shape)))!,pavingFinish=pavingProduct.finishes.find(f=>f.units.some(u=>hardscapeBody(u.role)&&!u.shape))!,pavingUnit=pavingFinish.units.find(u=>hardscapeBody(u.role)&&!u.shape)!,pavingColor=pavingFinish.colors.find(c=>!pavingUnit.colorIds||pavingUnit.colorIds.includes(c.id))!;
const patio:YardFeature={id:'drawing-patio',kind:'patio',name:'Drawing patio',enabled:true,xFt:14.5,zFt:28.25,widthFt:16,depthFt:12,heightIn:3,rotationDeg:37,productId:'permacon-melville',color:'#aaa69b',inlays:[{id:'kept-inlay',name:'Existing inlay',shape:'rectangle',xIn:-18,yIn:12,widthIn:24,depthIn:24,rotationDeg:11,productId:pavingProduct.id,color:'#555555',hardscape:{finishId:pavingFinish.id,colorId:pavingColor.id,unitId:pavingUnit.id,patternId:'running-bond',angleDeg:0,jointMm:3}}]};
const {inlays:unusedInlays,...patioBase}=patio;
const wall:YardFeature={...patioBase,id:'drawing-wall',name:'Drawing wall',kind:'retaining-wall',widthFt:16,depthFt:1,heightIn:24,baseElevationIn:-3,wallConstruction:{geogridLengthIn:60,geogridEveryCourses:1},productId:'segmental-concrete'};
const originalPatio=JSON.stringify(patio),originalWall=JSON.stringify(wall);
const roundtrip=(f:YardFeature)=>{
 const saved=parseDesign(serializeDesign({...structuredClone(DEFAULT_DECK),yardFeatures:[f]})).yardFeatures![0];
 equal(saved.outline,f.outline,'Drawing outline survives save/load');equal(saved.wallPath,f.wallPath,'Wall path survives save/load');
 equal(saved.hardscape,f.hardscape,'Stock variant survives save/load');equal(saved.baseElevationIn,f.baseElevationIn,'Wall grade survives save/load');equal(saved.wallConstruction,f.wallConstruction,'Reinforcement inputs survive save/load');
 same({x:saved.xFt,y:saved.zFt},{x:f.xFt,y:f.zFt},'Placement survives save/load');
};

for(const angle of [0,37,90,179,273])for(const width of [2,16,60])for(const depth of [2,12,60])for(const preset of YARD_PATIO_STARTERS){
 const f={...patio,rotationDeg:angle,widthFt:width,depthFt:depth},next=applyYardStarter(f,preset.id),points=yardShapeLocalPoints(next);
 check(!yardShapeProblem('patio',points),`${preset.id} patio is valid at dimensional extremes`);check(points.length<=64,'Starter stays within handle budget');
 near(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),width*12,'Patio starter retains width');near(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y)),depth*12,'Patio starter retains depth');
 check(yardShapeSignedArea(points)>0,'Patio starter retains plan orientation');
 equal(next.inlays,f.inlays,'Starter leaves inlay coordinates exact');near(next.xFt,f.xFt,'Starter centre across remains exact');near(next.zFt,f.zFt,'Starter centre out remains exact');equal(next.rotationDeg,f.rotationDeg,'Starter keeps rotation');equal(next.heightIn,f.heightIn,'Starter keeps finished elevation');
 equal(applyYardStarter(next,preset.id),next,'Reapplying same starter is a no-op');
 if(width===16&&depth===12&&angle===37)roundtrip(next);
}
for(const angle of [0,37,90,273])for(const run of [2,16,80])for(const preset of YARD_WALL_STARTERS){
 const f={...wall,widthFt:run,rotationDeg:angle},next=applyYardStarter(f,preset.id),points=yardShapeLocalPoints(next);
 check(!yardShapeProblem('retaining-wall',points,next.curves),'Wall starter is valid at run limits');near(inspectArcShape(points,next.curves,false).lengthIn,run*12,'Wall starter retains exact measured total run');
 equal(next.depthFt,f.depthFt,'Wall starter retains physical thickness');equal(next.baseElevationIn,f.baseElevationIn,'Wall starter keeps front grade datum');equal(next.wallConstruction,f.wallConstruction,'Wall starter keeps reinforcement choices');
 near(next.xFt,f.xFt,'Wall starter centre across remains exact');near(next.zFt,f.zFt,'Wall starter centre out remains exact');equal(next.rotationDeg,f.rotationDeg,'Wall starter keeps rotation');
 if(run===16&&angle===37)roundtrip(next);
}

// Check true circle geometry independently of the sagitta construction implementation.
for(const angle of [0,37,90,273])for(const bulge of [-120,-96,-60,-12,-1,1,12,60,96,120]){
 const f={...wall,rotationDeg:angle},before=yardShapeWorldPoints(f),next=curveYardEdge(f,0,bulge),p=yardShapeCurveWorldPoints(next),a=before[0],b=before[1],dx=b.x-a.x,dy=b.y-a.y,c=Math.hypot(dx,dy),nx=-dy/c,ny=dx/c,R=(c*c/4+bulge*bulge)/(2*Math.abs(bulge)),circle={x:(a.x+b.x)/2+nx*(bulge-Math.sign(bulge)*R),y:(a.y+b.y)/2+ny*(bulge-Math.sign(bulge)*R)};
 same(p[0],a,'Curved wall retains starting endpoint');same(p.at(-1)!,b,'Curved wall retains final endpoint');
 equal(next.curves,[{edge:0,bulgeIn:bulge}],'Curve retains exact signed requested bend');
 for(const q of p){check(Number.isFinite(q.x)&&Number.isFinite(q.y),'All curve points are finite');near(Math.hypot(q.x-circle.x,q.y-circle.y),R,'Every sample lies on independent circle',1e-6);}
 for(let i=1;i<p.length;i++){
  const chord=Math.hypot(p[i].x-p[i-1].x,p[i].y-p[i-1].y),segmentAngle=2*Math.asin(chord/(2*R));
  check(segmentAngle<=YARD_CURVE_TOLERANCE.maxAngleDeg*Math.PI/180+1e-10,'Curve chords span at most 5 degrees');check(R*(1-Math.cos(segmentAngle/2))<=.5+1e-7,'Curve chords stay within 0.5 inch of circle');
 }
 equal(next.depthFt,f.depthFt,'Curved wall retains thickness');equal(next.baseElevationIn,f.baseElevationIn,'Curved wall retains grade datum');equal(next.wallConstruction,f.wallConstruction,'Curve retains reinforcement choices');
 near(next.widthFt,arcGeometry(next.wallPath![0],next.wallPath![1],bulge).lengthIn/12,'Curved wall run is exact analytic length');
 if(bulge===12&&angle===37)roundtrip(next);
 equal(curveYardEdge(f,0,0),f,'Zero bulge preserves straight edge exactly');
}
// A closing patio edge can be curved without moving any original corner or decorative inlay in world space.
for(const index of [0,1,2,3])for(const bulge of [-12,12]){
 const before=yardShapeWorldPoints(patio),next=curveYardEdge(patio,index,bulge),p=yardShapeWorldPoints(next);
 for(const original of before)check(p.some(q=>Math.hypot(q.x-original.x,q.y-original.y)<1e-7),'Every unedited patio endpoint remains in world place');
 const oldInlay=patio.inlays![0],newInlay=next.inlays![0];same(yardShapeWorldPoint(patio,{x:oldInlay.xIn,y:oldInlay.yIn}),yardShapeWorldPoint(next,{x:newInlay.xIn,y:newInlay.yIn}),'Recentring keeps inlay world position');
 check(!yardShapeProblem('patio',next.outline),'Curved patio retains valid orientation and bounds');if(index===3&&bulge===12)roundtrip(next);
}
// The open L's preceding endpoint remains exact when only the last edge is curved.
const l=applyYardStarter(wall,'wall-l'),lBefore=yardShapeWorldPoints(l),lNext=curveYardEdge(l,1,12);same(yardShapeWorldPoints(lNext)[0],lBefore[0],'Bending final L edge retains first endpoint');
// Actual supplier body selection must remain dimensionally honest through every operation.
const product=HARDSCAPE_PRODUCTS.find(p=>p.category==='wall'&&p.finishes.some(f=>f.units.some(u=>hardscapeBody(u.role))))!,finish=product.finishes.find(f=>f.units.some(u=>hardscapeBody(u.role)))!,unit=finish.units.find(u=>hardscapeBody(u.role))!,color=finish.colors.find(c=>!unit.colorIds||unit.colorIds.includes(c.id))!;
const supplied:YardFeature={...wall,productId:product.id,depthFt:unit.lengthMm/304.8,hardscape:{finishId:finish.id,colorId:color.id,unitId:unit.id,patternId:'running-bond',angleDeg:0,jointMm:0}};
for(const next of [...YARD_WALL_STARTERS.map(p=>applyYardStarter(supplied,p.id)),curveYardEdge(supplied,0,12)]){equal(next.hardscape,supplied.hardscape,'Supplier choice is retained exactly');near(next.depthFt,unit.lengthMm/304.8,'Supplier wall thickness remains exact');check(!hardscapeProblem(next),'Drawn supplier wall remains catalogue-valid');roundtrip(next);}
const rp=HARDSCAPE_PRODUCTS.find(p=>p.id==='techo-raffinato-wall')!,rf=rp.finishes.find(f=>f.units.some(u=>hardscapeBody(u.role)))!,ru=rf.units.find(u=>hardscapeBody(u.role))!,rc=rf.colors.find(c=>!ru.colorIds||ru.colorIds.includes(c.id))!;
const raffinato={...wall,productId:rp.id,depthFt:ru.lengthMm/304.8,hardscape:{finishId:rf.id,colorId:rc.id,unitId:ru.id,patternId:'running-bond',angleDeg:0,jointMm:0},wallPath:[{x:-96,y:0},{x:0,y:0},{x:96,y:0}]};
equal(wallMinimumRadiusIn(raffinato),102,'Raffinato uses its published 8 ft 6 in minimum wall radius');
reject(()=>curveYardEdge(raffinato,0,18),'An 8 ft Raffinato edge cannot bend 18 in within the supplier minimum radius');
check(!!curveYardEdge(raffinato,0,8).wallPath,'A gentler Raffinato curve remains editable');
const raffinatoArc=applyYardStarter(raffinato,'arc'),arcRun=inspectArcShape(raffinatoArc.wallPath!,raffinatoArc.curves,false).lengthIn,arcChord=Math.hypot(raffinatoArc.wallPath!.at(-1)!.x-raffinatoArc.wallPath![0].x,raffinatoArc.wallPath!.at(-1)!.y-raffinatoArc.wallPath![0].y),arcBulge=raffinatoArc.curves![0].bulgeIn;
check(arcRun>arcChord&&arcBulge>0,'Raffinato starter still produces an arc');

for(const n of [NaN,Infinity,-Infinity])reject(()=>curveYardEdge(wall,0,n),'Non-finite bulge is rejected');
for(const n of [-1,.5,2,NaN])reject(()=>curveYardEdge(wall,n,12),'Invalid or nonexistent edge is rejected');
reject(()=>curveYardEdge({...wall,widthFt:80},0,12),'Curving a maximum run cannot silently exceed 80 ft');
reject(()=>curveYardEdge({...patio,widthFt:60},3,-12),'Outward curve cannot silently exceed 60 ft patio width');
reject(()=>curveYardEdge(patio,0,160),'Curve crossing other patio edges is rejected');
reject(()=>curveYardEdge(wall,0,500),'Huge curve needing more than 64 samples is rejected');
reject(()=>curveYardEdge(wall,0,1e-10),'Unmeasurable nonzero bulge is rejected');
const crowded={...wall,wallPath:Array.from({length:64},(_,i)=>({x:-126+i*4,y:0})),widthFt:21};check(curveYardEdge(crowded,20,1).wallPath!.length===64,'An arc retains 64 canonical controls without adding sampled handles');
const shortEdge={...wall,wallPath:[{x:-12,y:0},{x:-10,y:0},{x:12,y:0}],widthFt:2};check(curveYardEdge(shortEdge,0,1).curves?.[0].bulgeIn===1,'Short valid control edge can retain a circle independently of mesh subdivisions');
const unsafe=structuredClone(patio);let accessorRead=false;unsafe.outline=[{x:-96,y:-72},{x:96,y:-72},{x:96,y:72},{x:-96,y:72}];Object.defineProperty(unsafe.outline[0],'x',{get(){accessorRead=true;return -96;},enumerable:true});reject(()=>curveYardEdge(unsafe,0,12),'Unsafe stored shape is refused before geometry evaluation');check(!accessorRead,'Stored shape accessor was never invoked');
reject(()=>applyYardStarter({...supplied,depthFt:supplied.depthFt+.1},'arc'),'Invalid supplier thickness cannot enter starter geometry');
reject(()=>applyYardStarter(patio,'arc'),'Wall starter cannot be applied to a patio');reject(()=>applyYardStarter(wall,'rounded'),'Patio starter cannot be applied to a wall');
reject(()=>applyYardStarter({...wall,kind:'water-feature'},'straight'),'Unsupported feature cannot gain wall path');
equal(JSON.stringify(patio),originalPatio,'Drawing helpers do not mutate patio input');equal(JSON.stringify(wall),originalWall,'Drawing helpers do not mutate wall input');
console.log(JSON.stringify({checks,status:'passed'}));
