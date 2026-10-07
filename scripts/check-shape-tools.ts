// Designer shape engine: exact arcs, fillets, chamfers, offsets, walkway outlines, booleans with true-arc recovery,
// mirroring and the patio/wall/landscape adapters, checked against analytic answers.
import assert from 'node:assert/strict';
import {arcGeometry} from '../src/features/deckcraft/circularArcs';
import type {YardFeature} from '../src/features/deckcraft/types';
import type {LandscapeObject} from '../src/features/deckcraft/landscapeTypes';
import {
 applyPathToYardFeature,applyWalkway,chamferCorner,circlePath,edgeTangent,landscapeRingFromPath,landscapeRingPath,mirrorPath,offsetPath,pathArea,pathLength,
 pathOutline,pathProblem,rectanglePath,reversePath,roundCorner,setEdge,shapeBoolean,tangentArcBulge,threePointBulge,yardFeaturePath,yardSpinePath,type ShapePath,
} from '../src/features/deckcraft/shapeTools';

let checks=0;
const test=(name:string,fn:()=>void)=>{try{fn();checks++;console.log('PASS '+name);}catch(e){console.log('FAIL '+name+': '+(e as Error).message);process.exitCode=1;}};
const near=(a:number,b:number,tol:number,what:string)=>assert.ok(Math.abs(a-b)<=tol,`${what}: ${a} vs ${b} (tol ${tol})`);
const rel=(a:number,b:number,frac:number,what:string)=>near(a,b,Math.abs(b)*frac,what);
const arcs=(p:ShapePath)=>p.edges.flatMap((e,i)=>e.kind==='arc'?[arcGeometry(p.points[i],p.points[(i+1)%p.points.length],e.bulgeIn)]:[]);
const rect=rectanglePath({x:0,y:0},{x:120,y:96});

test('tangent arc leaves along the given direction (semicircle case exact)',()=>{
 const b=tangentArcBulge({x:0,y:1},{x:0,y:0},{x:100,y:0});near(b,50,1e-12,'bulge');const g=arcGeometry({x:0,y:0},{x:100,y:0},b);near(g.radius,50,1e-9,'radius');near(g.sweep,Math.PI,1e-9,'sweep');
 for(const d of [{x:1,y:.3},{x:.2,y:-1},{x:-.4,y:1}]){const a={x:5,y:7},e={x:83,y:-21},p:ShapePath={points:[a,e],edges:[{kind:'arc',bulgeIn:tangentArcBulge(d,a,e)}],closed:false},t=edgeTangent(p,0),u=Math.hypot(d.x,d.y);near(t.x,d.x/u,1e-9,'tangent x');near(t.y,d.y/u,1e-9,'tangent y');}
});
test('tangent arc refuses to turn back on itself',()=>assert.throws(()=>tangentArcBulge({x:-1,y:0},{x:0,y:0},{x:100,y:0}),/turn back/));
test('3-point arc reproduces its circle, minor and major',()=>{
 const c={x:10,y:20},r=30,at=(deg:number)=>({x:c.x+r*Math.cos(deg*Math.PI/180),y:c.y+r*Math.sin(deg*Math.PI/180)});
 const g1=arcGeometry(at(0),at(120),threePointBulge(at(0),at(60),at(120)));near(g1.radius,r,1e-9,'minor radius');near(g1.center.x,c.x,1e-9,'cx');near(g1.center.y,c.y,1e-9,'cy');near(g1.sweep,2*Math.PI/3,1e-9,'minor sweep');
 const g2=arcGeometry(at(0),at(90),threePointBulge(at(0),at(225),at(90)));near(g2.radius,r,1e-9,'major radius');near(g2.sweep,1.5*Math.PI,1e-9,'major sweep');
 assert.throws(()=>threePointBulge({x:0,y:0},{x:50,y:0},{x:100,y:0}),/off the straight line/);
});
test('round corner: true arc of the requested radius, tangent to both edges, exact area',()=>{
 const r=24,p=roundCorner(rect,1,r),[g]=arcs(p);assert.equal(p.points.length,5);near(g.radius,r,1e-9,'radius');near(g.sweep,Math.PI/2,1e-9,'sweep');
 const tIn=edgeTangent(p,1),before=edgeTangent(p,0,true),tOut=edgeTangent(p,1,true),next=edgeTangent(p,2);near(tIn.x,before.x,1e-9,'tangent in');near(tIn.y,before.y,1e-9,'tangent in y');near(tOut.x,next.x,1e-9,'tangent out');near(tOut.y,next.y,1e-9,'tangent out y');
 near(pathArea(p),120*96-r*r*(1-Math.PI/4),1e-7,'area');assert.equal(pathProblem(p),'');
 assert.throws(()=>roundCorner(rect,1,100),/largest radius that fits is/);
});
test('round all four corners, then a corner next to an arc is refused',()=>{
 let p=rect;for(let k=0;k<4;k++){const corner=p.points.findIndex((q,i)=>i>=0&&p.edges[(i+p.points.length-1)%p.points.length].kind==='line'&&p.edges[i].kind==='line');p=roundCorner(p,corner,12);}
 near(pathArea(p),120*96-4*144*(1-Math.PI/4),1e-7,'area');assert.equal(arcs(p).length,4);assert.throws(()=>roundCorner(p,1,6),/Straighten the neighbouring arc/);
});
test('chamfer removes exactly d²/2',()=>{const p=chamferCorner(rect,2,18);near(pathArea(p),120*96-18*18/2,1e-9,'area');assert.throws(()=>chamferCorner(rect,2,200),/at most/);});
test('setEdge bends and straightens one edge',()=>{const p=setEdge(rect,0,{kind:'arc',bulgeIn:-12});assert.equal(p.edges[0].kind,'arc');assert.equal(setEdge(p,0,{kind:'line'}).edges[0].kind,'line');assert.equal(pathProblem(p),'');});
test('offset outward: round joins add πd², mitred joins make a rectangle',()=>{
 const d=12;near(pathArea(offsetPath(rect,d)),120*96+2*d*(120+96)+Math.PI*d*d,1e-7,'round');near(pathArea(offsetPath(rect,d,'miter')),(120+2*d)*(96+2*d),1e-7,'miter');
 const back=offsetPath(rect,-d);near(pathArea(back),(120-2*d)*(96-2*d),1e-7,'inward');assert.equal(back.points.length,4);
});
test('offset keeps true arcs: circle radius ± d exactly',()=>{
 const c=circlePath({x:300,y:-40},60);near(pathArea(c),Math.PI*3600,1e-6,'circle area');
 const out=offsetPath(c,12),inn=offsetPath(c,-12);near(pathArea(out),Math.PI*72*72,1e-6,'out area');near(pathArea(inn),Math.PI*48*48,1e-6,'in area');
 for(const g of arcs(out))near(g.radius,72,1e-9,'out radius');for(const g of arcs(inn))near(g.radius,48,1e-9,'in radius');
 assert.throws(()=>offsetPath(c,-61),/radius/);
});
test('offset of a rounded rectangle inward shrinks fillets exactly',()=>{
 let p=rect;for(let k=0;k<4;k++){const corner=p.points.findIndex((_,i)=>p.edges[(i+p.points.length-1)%p.points.length].kind==='line'&&p.edges[i].kind==='line');p=roundCorner(p,corner,24);}
 const q=offsetPath(p,-12);near(pathArea(q),(120-24)*(96-24)-4*144*(1-Math.PI/4),1e-6,'area');for(const g of arcs(q))near(g.radius,12,1e-9,'fillet radius');
});
test('offset of an open path keeps its length on straight runs and refuses a collapse',()=>{
 const spine:ShapePath={points:[{x:0,y:0},{x:240,y:0},{x:240,y:120}],edges:[{kind:'line'},{kind:'line'}],closed:false};
 const right=offsetPath(spine,24);assert.equal(right.closed,false);near(right.points[0].y,-24,1e-12,'right side');
 near(pathLength(right),240+120+Math.PI*24/2,1e-9,'outer side gets a round join');near(pathLength(offsetPath(spine,-24)),216+96,1e-9,'inner side is trimmed');
});
test('walkway outline: square ends, round ends, and a curved walk',()=>{
 const straight:ShapePath={points:[{x:0,y:0},{x:240,y:0}],edges:[{kind:'line'}],closed:false};
 near(pathArea(pathOutline(straight,48)),240*48,1e-7,'square');near(pathArea(pathOutline(straight,48,'round')),240*48+Math.PI*24*24,1e-6,'round');
 const R=120,curved:ShapePath={points:[{x:0,y:0},{x:R,y:R}],edges:[{kind:'arc',bulgeIn:tangentArcBulge({x:1,y:0},{x:0,y:0},{x:R,y:R})}],closed:false};
 const walk=pathOutline(curved,48);near(pathArea(walk),Math.PI/2*R*48,1e-6,'annular sector');assert.equal(pathProblem(walk),'');
 assert.throws(()=>pathOutline({...curved,points:[{x:0,y:0},{x:20,y:20}],edges:[{kind:'arc',bulgeIn:tangentArcBulge({x:1,y:0},{x:0,y:0},{x:20,y:20})}]},48),/radius|too tight/);
});
test('boolean difference: rectangle minus circle keeps a true-arc hole',()=>{
 const [r,...extra]=shapeBoolean({outer:rectanglePath({x:0,y:0},{x:120,y:120}),holes:[]},{outer:circlePath({x:60,y:60},30),holes:[]},'difference');
 assert.equal(extra.length,0);assert.equal(r.outer.points.length,4);assert.equal(r.holes.length,1);
 rel(pathArea(r.outer)+pathArea(r.holes[0]),14400-Math.PI*900,.001,'area');assert.ok(r.holes[0].points.length<=8,'hole refitted as a few arcs');for(const g of arcs(r.holes[0]))near(g.radius,30,.1,'hole radius');
});
test('boolean union and intersection match analytic areas',()=>{
 const [u]=shapeBoolean({outer:rectanglePath({x:0,y:0},{x:120,y:120}),holes:[]},{outer:rectanglePath({x:60,y:60},{x:180,y:180}),holes:[]},'union');near(pathArea(u.outer),25200,.01,'union');assert.equal(u.outer.points.length,8);
 const [q]=shapeBoolean({outer:rectanglePath({x:0,y:0},{x:120,y:120}),holes:[]},{outer:circlePath({x:120,y:120},60),holes:[]},'intersection');rel(pathArea(q.outer),Math.PI*3600/4,.001,'quarter circle');
 assert.equal(q.outer.edges.filter(e=>e.kind==='arc').length,1);for(const g of arcs(q.outer))near(g.radius,60,.1,'quarter radius');
});
test('boolean difference that splits returns both pieces',()=>{const parts=shapeBoolean({outer:rectanglePath({x:0,y:0},{x:240,y:60}),holes:[]},{outer:rectanglePath({x:100,y:-10},{x:140,y:70}),holes:[]},'difference');assert.equal(parts.length,2);for(const p of parts)near(pathArea(p.outer),6000,.01,'piece');});
test('mirror and reverse keep area and arcs',()=>{const p=roundCorner(rect,1,24),m=mirrorPath(p,'across',{x:60,y:0});near(pathArea(m),pathArea(p),1e-9,'mirror area');near(arcs(m)[0].radius,24,1e-9,'mirror radius');near(pathArea(reversePath(p)),-pathArea(p),1e-9,'reverse');});
test('self-crossing outline is reported',()=>assert.match(pathProblem({points:[{x:0,y:0},{x:120,y:120},{x:120,y:0},{x:0,y:120}],edges:[0,1,2,3].map(()=>({kind:'line' as const})),closed:true}),/crosses itself/));

const patio:YardFeature={id:'p1',kind:'patio',name:'Patio',enabled:true,xFt:10,zFt:20,widthFt:10,depthFt:8,heightIn:0,rotationDeg:30,productId:'permacon-melville',color:'#b6b0a3'};
test('patio adapter: exact round trip through a rotated frame, dimensions from the outline',()=>{
 const world=roundCorner(yardFeaturePath(patio),2,18),next=applyPathToYardFeature(patio,world),back=yardFeaturePath(next);
 assert.equal(back.points.length,world.points.length);back.points.forEach((p,i)=>{near(p.x,world.points[i].x,1e-9,'x');near(p.y,world.points[i].y,1e-9,'y');});assert.deepEqual(back.edges,world.edges);
 const xs=next.outline!.map(p=>p.x),ys=next.outline!.map(p=>p.y);near(next.widthFt,(Math.max(...xs)-Math.min(...xs))/12,1e-12,'width');near(next.depthFt,(Math.max(...ys)-Math.min(...ys))/12,1e-12,'depth');assert.equal(next.curves?.length,1);
});
test('tangent arc neighbours pass the exact contact check (fillet beside an arc, round joins)',()=>{
 let p=setEdge(yardFeaturePath(patio),0,{kind:'arc',bulgeIn:-10});p=roundCorner(p,2,12);
 const grown=offsetPath(p,18),next=applyPathToYardFeature(patio,grown);assert.ok(next.curves!.length>=4,'arcs kept');
});
test('wall adapter: run length includes the arc exactly',()=>{
 const wall:YardFeature={...patio,id:'w1',kind:'retaining-wall',productId:'retaining-wall',widthFt:20,depthFt:1,heightIn:24,rotationDeg:0},path:ShapePath={points:[{x:0,y:0},{x:240,y:0}],edges:[{kind:'arc',bulgeIn:-30}],closed:false};
 const next=applyPathToYardFeature(wall,path);near(next.widthFt,pathLength(path)/12,1e-9,'run');assert.throws(()=>applyPathToYardFeature(wall,rect),/open path/);
});
test('walkway adapter keeps an editable centreline and a usable outline',()=>{
 const spine:ShapePath={points:[{x:0,y:240},{x:120,y:240},{x:240,y:360}],edges:[{kind:'line'},{kind:'arc',bulgeIn:tangentArcBulge({x:1,y:0},{x:120,y:240},{x:240,y:360})}],closed:false};
 const walk=applyWalkway({...patio,rotationDeg:0},spine,48,'round');assert.ok(walk.outline!.length<=64);assert.equal(walk.pathSpine?.widthIn,48);
 const back=yardSpinePath(walk)!;back.points.forEach((p,i)=>{near(p.x,spine.points[i].x,1e-9,'spine x');near(p.y,spine.points[i].y,1e-9,'spine y');});
 assert.equal(applyPathToYardFeature(walk,yardFeaturePath(walk)).pathSpine,undefined,'a free edit drops the centreline');
});
test('landscape ring adapter round trips through a rotated object',()=>{
 const o={xIn:400,zIn:300,rotationDeg:45} as LandscapeObject,world=offsetPath(circlePath({x:420,y:310},48),6),ring=landscapeRingFromPath(o,world),back=landscapeRingPath(o,ring);
 back.points.forEach((p,i)=>{near(p.x,world.points[i].x,1e-9,'x');near(p.y,world.points[i].y,1e-9,'z');});near(pathArea(back),Math.PI*54*54,1e-6,'area');
});
async function persistence(){
 const {DEFAULT_DECK}=await import('../src/features/deckcraft/defaults');
 const {ensureDesignExtensions,ensureLiveDesignExtensions}=await import('../src/features/deckcraft/designExtensions');
 const {parseDeckReleaseDesign,serializeDeckReleaseDesign}=await import('../src/features/deckcraft/deckRelease');
 const spine:ShapePath={points:[{x:0,y:360},{x:120,y:360},{x:240,y:480}],edges:[{kind:'line'},{kind:'arc',bulgeIn:tangentArcBulge({x:1,y:0},{x:120,y:360},{x:240,y:480})}],closed:false};
 const walk=applyWalkway({...patio,rotationDeg:0},spine,48,'round'),data={...structuredClone(DEFAULT_DECK),yardFeatures:[walk]} as typeof DEFAULT_DECK;
 await ensureLiveDesignExtensions(data);const text=serializeDeckReleaseDesign(data),raw=JSON.parse(text);await ensureDesignExtensions(raw);
 const back=parseDeckReleaseDesign(text).yardFeatures![0];
 test('a walkway centreline survives save and load',()=>{assert.deepEqual(back.pathSpine,walk.pathSpine);assert.deepEqual(back.outline,walk.outline);assert.deepEqual(back.curves,walk.curves);});
 const tamper=(mutate:(f:Record<string,unknown>)=>void)=>{const r=JSON.parse(text),f=r.configuration.yardFeatures[0];mutate(f);return JSON.stringify(r);};
 test('a tampered walkway centreline is refused on load',()=>{
  assert.throws(()=>parseDeckReleaseDesign(tamper(f=>{(f.pathSpine as {widthIn:number}).widthIn=400;})),/walkway/i);
  assert.throws(()=>parseDeckReleaseDesign(tamper(f=>{(f.pathSpine as {extra?:number}).extra=1;})),/walkway/i);
  assert.throws(()=>parseDeckReleaseDesign(tamper(f=>{(f.pathSpine as {points:unknown}).points=[{x:0,y:0}];})));
 });
}
await persistence();
console.log(`Shape tool checks passed: ${checks}`);
