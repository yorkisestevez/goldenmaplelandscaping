// Guillotined armour stone walls (Simcoe County research, 2026-10-20): Carr's guillotined wallstone in Orillia Grey or
// Dark Grey, laid in 10, 14, 16 or 20 in courses of random 24-48 in stones with staggered joints, priced by weight
// from Carr's 2025 trade price with the engine's material markup; the rest of the wall stays a builder quote.
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {loadAdvancedYardRuntime,advancedYardRuntimeReady,buildYardModel,needsAdvancedYard,yardSignedArea,yardClip} from '../src/features/deckcraft/yardModel';
import type {YardModel,YardBox} from '../src/features/deckcraft/yardModel';
import {buildYardTakeoff} from '../src/features/deckcraft/yardTakeoff';
import {yardWallCourses} from '../src/features/deckcraft/yardElevations';
import {loadWallStationRuntime} from '../src/features/deckcraft/yardPathGeometry';
import {ensureLiveDesignExtensions,hasAdvancedYard} from '../src/features/deckcraft/designExtensions';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {arcGeometry} from '../src/features/deckcraft/circularArcs';
import {loadSiteEngine} from '../src/features/deckcraft/siteSurface';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import {WALL_PRODUCTS} from '../src/features/deckcraft/yardSettings';
import {GUILLOTINED_WALL,WALL_STONES,WALL_STONE_COURSES_IN,LIMESTONE_LB_PER_FT3,wallStoneOf,wallStoneProblem} from '../src/features/deckcraft/wallStones';
import {STONE_JOINT_IN,STONE_JOINT_CLEARANCE_IN,STONE_LENGTH_IN,stoneCourseJoints} from '../src/features/deckcraft/wallStoneCourses';
import WallStoneEditor,{wallProductPatch,withoutStaleStone} from '../src/features/deckcraft/WallStoneEditor';
import baseline from '../src/data/engine-baseline.json';
import {createDeckAgentController,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';
import {buildAssistantContext,validateAssistantContext} from '../src/features/deckcraft/designer/assistantPlan';
import * as THREE from 'three';
import {drawnSplit,edgeBreak,mergeStonePieces,nextStoneCacheRound,splitFaceFeatures,splitFaceStoneGeometry,splitFaceStoneMesh,splitStoneMaterial,stoneCache,stoneNeighbours,stoneOutlines} from '../src/features/deckcraft/components/viewer3d/splitFaceStone';

let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;},near=(a:number,b:number,m:string,tolerance=1e-6)=>ok(Math.abs(a-b)<=tolerance,`${m}: ${a} vs ${b}`);
const flat=(features:YardFeature[],extra:Partial<DeckData>={}):DeckData=>({...structuredClone(DEFAULT_DECK),houseVisible:false,yardFeatures:features,...extra});
const wall=(over:Partial<YardFeature>={}):YardFeature=>({id:'gw',kind:'retaining-wall',name:'Guillotined wall',enabled:true,xFt:0,zFt:40,widthFt:20,depthFt:14/12,heightIn:30,rotationDeg:0,productId:GUILLOTINED_WALL,color:'#a7a399',wallStone:{stoneId:'carr-orillia-grey',courseIn:14},...over});
const blocks=(m:YardModel,id='gw')=>m.features.find(f=>f.config.id===id)!.boxes.filter(b=>b.role==='wall-block');
const rowOf=(b:YardBox)=>Number(b.unitId!.split('-wall-block-')[1].split('-')[0]);
const runKeyOf=(b:YardBox)=>b.unitId!.split('-wall-block-')[1].split('-')[1];
const xs=(b:YardBox)=>b.polygon!.map(p=>p.x);
/** One run's stones per course, merged by stone id, as [lo,hi] inches along `dir` (a unit vector in plan). */
const courses=(stones:YardBox[],dir:{x:number;y:number},run?:string)=>{
 const byRow=new Map<number,Map<string,{lo:number;hi:number}>>();
 for(const b of stones){if(run!==undefined&&runKeyOf(b)!==run)continue;const along=b.polygon!.map(p=>p.x*dir.x+p.y*dir.y),row=byRow.get(rowOf(b))??new Map(),s=row.get(b.unitId!)??{lo:Infinity,hi:-Infinity};s.lo=Math.min(s.lo,...along);s.hi=Math.max(s.hi,...along);row.set(b.unitId!,s);byRow.set(rowOf(b),row);}
 return [...byRow].sort((a,b)=>a[0]-b[0]).map(([row,m])=>({row,stones:[...m.values()].sort((a,b)=>a.lo-b.lo)}));
};
const interior=(stones:{lo:number;hi:number}[])=>stones.slice(1).map((s,i)=>(stones[i].hi+s.lo)/2);
/** Joints closer than the clearance to a joint in the course directly below. */
const stackedJoints=(rows:ReturnType<typeof courses>,toleranceIn=1e-6)=>rows.flatMap((r,i)=>i>0&&rows[i-1].row===r.row-1?interior(r.stones).filter(j=>interior(rows[i-1].stones).some(b=>Math.abs(j-b)<STONE_JOINT_CLEARANCE_IN-toleranceIn)):[]);
/** Each stone's share of its course (joint centre to joint centre, course ends at the stone faces). */
const pitches=(stones:{lo:number;hi:number}[])=>{const stations=[stones[0].lo,...interior(stones),stones.at(-1)!.hi];return stations.slice(1).map((s,i)=>s-stations[i]);};

// 0. A saved design whose only advanced feature is a guillotined wall loads its geometry on open (cold start).
ok(!advancedYardRuntimeReady(),'The advanced yard runtime starts unloaded');
const cold=flat([wall()]);
ok(hasAdvancedYard(cold)&&needsAdvancedYard(cold),'Opening a design discovers a guillotined wall needs the advanced yard runtime, as the model does');
await ensureLiveDesignExtensions(cold);
ok(buildYardModel(cold).features[0].boxes.some(b=>b.role==='wall-block'),'After the design extensions load, the wall builds without "Geometry is loading"');
await Promise.all([loadAdvancedYardRuntime(),loadWallStationRuntime(),loadSiteEngine()]);
const {validateWallTopSteps}=await import('../src/features/deckcraft/wallTopStepsRuntime');

// 1. The product, its stones and courses.
ok(WALL_PRODUCTS.some(p=>p.id===GUILLOTINED_WALL&&p.name==='Guillotined armour stone wall'),'The wall product list offers the guillotined wall');
ok(WALL_STONES.map(s=>s.name).join()==='Orillia Grey,Dark Grey','Carr Orillia Grey (default) and Dark Grey are offered');
near(WALL_STONES[0].tradePerLb,.125,'Orillia Grey is Carr 2025 trade $0.125/lb');near(WALL_STONES[1].tradePerLb,.153,'Dark Grey is Carr 2025 trade $0.153/lb');
ok(WALL_STONE_COURSES_IN.join()==='10,14,16,20','Courses are 10, 14, 16 and 20 in');
ok(wallStoneOf(wall({wallStone:undefined})).stone.id==='carr-orillia-grey'&&wallStoneOf(wall({wallStone:undefined})).courseIn===14,'Absent stone choice means Orillia Grey in 14 in courses');

// 2. Validation and save/reload. A stone choice left on another product is dropped on load.
ok(wallStoneProblem(wall().wallStone)==='','A Carr stone in a listed course is valid');
ok(wallStoneProblem({stoneId:'quarry-x',courseIn:14})!=='','An unknown stone is rejected');
ok(wallStoneProblem({stoneId:'carr-dark-grey',courseIn:12})!=='','An unlisted course is rejected');
ok(wallStoneProblem(null)!==''&&wallStoneProblem({stoneId:'carr-dark-grey',courseIn:14,extra:1})!=='','A null or padded stone choice is rejected');
const saved=parseDesign(serializeDesign(flat([wall({wallStone:{stoneId:'carr-dark-grey',courseIn:20},depthFt:20/12})])));
ok(saved.yardFeatures?.[0].wallStone?.stoneId==='carr-dark-grey'&&saved.yardFeatures[0].wallStone.courseIn===20,'The stone choice survives a save and reload');
assert.throws(()=>validateDesign(flat([wall({wallStone:{stoneId:'carr-dark-grey',courseIn:12}})])),/stone/i);checks++;
ok(!('wallStone' in validateDesign(flat([wall({productId:'segmental-concrete',depthFt:1})])).yardFeatures![0]),'A stone choice left on a segmental wall is dropped on load');
let reads=0;const flaky={stoneId:'carr-orillia-grey',get courseIn(){return ++reads===1?14:12;}};
ok(validateDesign(flat([wall({wallStone:flaky as {stoneId:string;courseIn:number}})])).yardFeatures![0].wallStone?.courseIn===14&&reads===1,'A stone choice is read once, so it cannot change after it is checked');

// 3. Courses: the chosen height, no cap course; wall top steps use the same course.
for(const courseIn of WALL_STONE_COURSES_IN){const c=yardWallCourses(wall({wallStone:{stoneId:'carr-orillia-grey',courseIn}}),0);ok(c.course===courseIn&&c.cap===0,`${courseIn} in courses with no cap`);}
ok(needsAdvancedYard(flat([wall()])),'A guillotined wall is laid by the advanced yard runtime');
const stepped=wall({finishedElevationIn:48});
ok(validateWallTopSteps(stepped,[{stationIn:120,elevationIn:34}]).length===1,'A wall top step of one whole 14 in course is accepted');
assert.throws(()=>validateWallTopSteps(stepped,[{stationIn:120,elevationIn:36}]),/14/);checks++;

// 4. The model: random 24-48 in stones (the last one too), staggered joints, a visible joint, deterministic.
const model=buildYardModel(flat([wall({finishedElevationIn:30})])),stones=blocks(model);
ok(stones.length>0&&!model.features[0].boxes.some(b=>b.role==='wall-cap'),'The wall is stones only, with no cap course');
ok(stones.every(b=>Math.abs(b.h-(14-.03))<1e-6),'Every stone is one 14 in course high');
const wallStart=-120,wallEnd=120,straight=courses(stones,{x:1,y:0});
ok(straight.length>=3,'A 30 in wall with its buried course has at least three courses');
for(const {stones:run} of straight){
 for(const length of pitches(run))ok(length>=STONE_LENGTH_IN.min-1e-6&&length<=STONE_LENGTH_IN.max+1e-6,`Stone ${length.toFixed(2)} in is within 24-48 in, the last one included`);
 near(run[0].lo,wallStart,'Each course starts flush at the wall end',1e-6);near(run.at(-1)!.hi,wallEnd,'…and ends flush at the other end',1e-6);
 for(let i=1;i<run.length;i++)near(run[i].lo-run[i-1].hi,STONE_JOINT_IN,'Neighbouring stones keep a visible joint',1e-6);
}
ok(new Set(straight.flatMap(r=>pitches(r.stones)).map(l=>l.toFixed(2))).size>3,'Stone lengths vary, not one repeated block');
ok(stackedJoints(straight).length===0,'Every joint clears the joints in the course below by 6 in');
const again=blocks(buildYardModel(flat([wall({finishedElevationIn:30})])));
ok(JSON.stringify(again.map(b=>b.polygon))===JSON.stringify(stones.map(b=>b.polygon)),'The same wall lays the same stones every time');
const other=blocks(buildYardModel(flat([wall({id:'gw2',finishedElevationIn:30})])),'gw2');
ok(JSON.stringify(other.map(b=>xs(b)))!==JSON.stringify(stones.map(b=>xs(b))),'Another wall gets its own stone pattern');
// The course generator: a course may start anywhere (a foundation step), it is balanced so its last stone is a whole
// 24-48 in stone, and its joints clear the course below in shared stations.
{const run=stoneCourseJoints('unit'),[below]=run(0,[[0,300]]),[above]=run(1,[[137,300]]),step=above.slice(1).map((j,i)=>j-above[i]);
 ok(above[0]===137&&above.at(-1)===300&&step.every(l=>l>=STONE_LENGTH_IN.min-1e-9&&l<=STONE_LENGTH_IN.max+1e-9),'A course starting at a step still lays whole 24-48 in stones to its end');
 ok(above.slice(1,-1).every(j=>below.every(b=>Math.abs(j-b)>=STONE_JOINT_CLEARANCE_IN)),'…with every joint clear of the course below at the same stations');
 const gapped=stoneCourseJoints('gap')(0,[[0,100],[160,300]]);ok(gapped.length===2&&gapped.every(list=>list.slice(1).every((j,i)=>j-list[i]>=STONE_LENGTH_IN.min-1e-9)),'A course broken by a foundation step ends each stretch in whole stones');
 const short=stoneCourseJoints('short'),r0=short(0,[[0,60]])[0],r1=short(1,[[0,60]])[0],r2=short(2,[[0,60]])[0];
 ok(r0.length===3&&r1.length===3&&r2.length===3&&Math.abs(r1[1]-r0[1])>=STONE_JOINT_CLEARANCE_IN&&Math.abs(r2[1]-r1[1])>=STONE_JOINT_CLEARANCE_IN,'A 60 in run alternates its one joint so each clears the course below');
 const tight=stoneCourseJoints('tight')(0,[[0,50]])[0];ok(tight.slice(1).every((j,i)=>j-tight[i]>=STONE_LENGTH_IN.min-1e-9),'A 50 in run is two whole stones');
 ok(stoneCourseJoints('tiny')(0,[[0,20]])[0].length===2,'A run under 24 in is one stone');
 ok(Array.isArray(stoneCourseJoints('nan')(0,[[Number.NaN,40]])[0]),'A non-finite stretch lays nothing rather than throwing');}

// 4b. Real ground and real shapes: stepped foundations, a battered corner, a curved corner.
const slope=buildYardModel(flat([wall({id:'w12',xFt:60,zFt:60,widthFt:30,finishedElevationIn:102,rotationDeg:-90})],{terrainConfig:{widthFt:250,depthFt:250,elevationIn:0,slopePct:10}}));
const slopeRows=courses(blocks(slope,'w12'),{x:0,y:-1});
ok(slopeRows.length>3&&new Set(slopeRows.map(r=>r.stones[0].lo.toFixed(1))).size>1,'On falling ground the lower courses start partway along the wall (stepped foundation)');
ok(stackedJoints(slopeRows).length===0,'…and their joints still clear the course below by 6 in');
ok(slopeRows.every(r=>r.stones.at(-1)!.hi-r.stones[0].lo<STONE_LENGTH_IN.min||pitches(r.stones).every(l=>l>=STONE_LENGTH_IN.min-1e-6)),'…with no stone shorter than 24 in, at either end of a course');
const battered=blocks(buildYardModel(flat([wall({id:'bw',widthFt:280/12,heightIn:60,finishedElevationIn:60,wallPath:[{x:-120,y:0},{x:0,y:0},{x:0,y:-160}],wallConstruction:{setbackPerCourseIn:2}})])),'bw');
ok(stackedJoints(courses(battered,{x:1,y:0},'0')).length===0&&stackedJoints(courses(battered,{x:0,y:-1},'1')).length===0,'A battered L wall keeps 6 in joint clearance on both legs');
// A curved wall with a batter: courses on concentric arcs keep their joints 6 in apart, measured by angle about the
// arc centre as arc length at course 0's radius.
{const arc=arcGeometry({x:-120,y:0},{x:120,y:0},40),bent=blocks(buildYardModel(flat([wall({id:'bend',widthFt:arc.lengthIn/12,heightIn:60,finishedElevationIn:60,wallPath:[{x:-120,y:0},{x:120,y:0}],curves:[{edge:0,bulgeIn:40}],wallConstruction:{setbackPerCourseIn:2}})])),'bend');
 const cx=arc.center.x,cy=480+arc.center.y,mid=Math.atan2(480+40-cy,0-cx),byAngle=new Map<number,Map<string,{lo:number;hi:number}>>();
 for(const b of bent){const s=b.polygon!.map(v=>{let a=Math.atan2(v.y-cy,v.x-cx)-mid;a=Math.atan2(Math.sin(a),Math.cos(a));return a*arc.radius;}),row=byAngle.get(rowOf(b))??new Map(),st=row.get(b.unitId!)??{lo:Infinity,hi:-Infinity};st.lo=Math.min(st.lo,...s);st.hi=Math.max(st.hi,...s);row.set(b.unitId!,st);byAngle.set(rowOf(b),row);}
 const arcRows=[...byAngle].sort((a,b)=>a[0]-b[0]).map(([row,m])=>({row,stones:[...m.values()].sort((a,b)=>a.lo-b.lo)}));
 // Joints are square to each facet, not exactly radial, so measuring them by angle reads within about 0.1 in.
 ok(arcRows.length>=4&&stackedJoints(arcRows,.25).length===0,`A battered curved wall keeps 6 in joint clearance between concentric courses (${stackedJoints(arcRows,.25).map(j=>j.toFixed(1)).join(', ')})`);}
// A straight-curved-straight wall with a batter: the straight legs keep exact 6 in clearance (only an arc's own run
// is mapped by angle).
{const mixed=blocks(buildYardModel(flat([wall({id:'mix',widthFt:30,heightIn:60,finishedElevationIn:60,wallPath:[{x:-180,y:0},{x:-60,y:0},{x:60,y:0},{x:180,y:0}],curves:[{edge:1,bulgeIn:30}],wallConstruction:{setbackPerCourseIn:2}})])),'mix');
 ok(stackedJoints(courses(mixed,{x:1,y:0},'0')).length===0&&stackedJoints(courses(mixed,{x:1,y:0},'2')).length===0,'The straight legs of a battered wall with an arc keep 6 in joint clearance');}
// A battered L whose second leg is split in line (as a wall top step or a hand-added point splits it): both legs keep
// exact 6 in clearance and whole stones (the split is not an arc).
{const split=blocks(buildYardModel(flat([wall({id:'split',widthFt:280/12,heightIn:100,finishedElevationIn:100,wallPath:[{x:-120,y:0},{x:0,y:0},{x:0,y:-80},{x:0,y:-160}],wallConstruction:{setbackPerCourseIn:2}})])),'split');
 const legA=courses(split,{x:1,y:0},'0'),legB=courses(split,{x:0,y:-1},'1');
 ok(legA.length>4&&stackedJoints(legA).length===0&&stackedJoints(legB).length===0,`A battered L split in line keeps 6 in joint clearance (${[...stackedJoints(legA),...stackedJoints(legB)].map(j=>j.toFixed(1)).join(', ')})`);
 ok([...legA,...legB].every(r=>r.stones.slice(1,-1).every(st=>st.hi-st.lo>=STONE_LENGTH_IN.min-STONE_JOINT_IN-1e-6)),'…with whole stones between its ends');}
// Run lengths from 24 to 120 in: whole 24-48 in stones, and 6 in clearance wherever a run has room for it (54 in up).
{const misses:string[]=[];for(let len=24;len<=120;len+=2){const run=stoneCourseJoints(`len${len}`),lists=[0,1,2].map(row=>run(row,[[0,len]])[0]);
  if(lists.some(l=>l.slice(1).some((j,i)=>j-l[i]<STONE_LENGTH_IN.min-1e-9||j-l[i]>STONE_LENGTH_IN.max+1e-9)))misses.push(`${len} length`);
  if(len>=54&&lists.some((l,i)=>i>0&&l.slice(1,-1).some(j=>lists[i-1].slice(1,-1).some(b=>Math.abs(j-b)<STONE_JOINT_CLEARANCE_IN-1e-9))))misses.push(`${len} clearance`);}
 ok(misses.length===0,`Runs of 24-120 in lay whole stones and clear the course below from 54 in (${misses.join(', ')})`);}
// A hump in the ground: the lower courses stop either side of it, and each stretch still ends in whole stones.
{const points=[];for(let x=-240;x<=600;x+=30)for(let z=240;z<=720;z+=60)points.push({id:`H${x}_${z}`,xIn:x,zIn:z,elevationIn:+(30*Math.max(0,1-Math.abs(x)/70)).toFixed(3)});
 const humped=blocks(buildYardModel(flat([wall({id:'hump',heightIn:40,finishedElevationIn:66})],{siteModel:{version:1,points,grading:[]}})),'hump');
 const stretchRows=courses(humped,{x:1,y:0}).map(r=>({row:r.row,groups:r.stones.reduce((g,s)=>{const last=g.at(-1);if(last&&s.lo-last.at(-1)!.hi<=STONE_JOINT_IN+.01)last.push(s);else g.push([s]);return g;},[] as {lo:number;hi:number}[][])}));
 ok(stretchRows.some(r=>r.groups.length>1),'Over the hump a lower course stops and starts again');
 ok(stretchRows.every(r=>r.groups.every(g=>g.at(-1)!.hi-g[0].lo<STONE_LENGTH_IN.min||pitches(g).every(l=>l>=STONE_LENGTH_IN.min-1e-6))),'…and each stretch of it ends in whole stones, not cut ones');}
// A curved wall's stones cover the same body as natural armour stone of the same shape, bar the thin joints.
const curved=wall({id:'cw',finishedElevationIn:30,wallPath:[{x:-120,y:0},{x:0,y:0},{x:0,y:120}],curves:[{edge:1,bulgeIn:20}]}),curvedStones=blocks(buildYardModel(flat([curved])),'cw');
const curvedArmour=blocks(buildYardModel(flat([{...curved,productId:'armour-stone',wallStone:undefined}])),'cw'),jointArea=2*STONE_JOINT_IN*curved.depthFt*12;// a joint widens on the outside of an arc; the corner notch was about 33 sq in
for(const r of [...new Set(curvedStones.map(rowOf))]){const missing=yardClip(yardClip(curvedArmour.filter(b=>rowOf(b)===r).map(b=>b.polygon!)),yardClip(curvedStones.filter(b=>rowOf(b)===r).map(b=>b.polygon!)),'difference').filter(p=>Math.abs(yardSignedArea(p))>jointArea);ok(missing.length===0,`Course ${r} of a curved wall has no open notch (${missing.map(p=>Math.abs(yardSignedArea(p)).toFixed(1)).join(', ')} sq in)`);}

// 5. Weight: modelled stone volume (buried course included) at 165 lb/cu ft.
const volumeIn3=stones.reduce((n,b)=>n+Math.abs(yardSignedArea(b.polygon!))*b.h,0),lb=volumeIn3/1728*LIMESTONE_LB_PER_FT3;
near(model.features[0].quantities.wallStoneLb,lb,'The model weighs its own stones',1e-6);

// 6. Estimate: stone priced at Carr trade × markup, the rest quoted; the public note names no trade price or markup.
const takeoff=buildYardTakeoff(flat([wall({finishedElevationIn:30})]),model),row=takeoff.sections.find(s=>s.id==='wall-stone-gw');
ok(row&&row.amountCents===Math.round(Math.round(lb*.125*100)*baseline.facts.materialMarkup),'Orillia Grey is priced at $0.125/lb trade with the 1.35 material markup, in cents');
ok(row!.label==='Guillotined wall: Guillotined armour stone, Orillia Grey, 14 in courses'&&row!.unit==='tons'&&Math.abs(row!.quantity!-lb/2000)<1e-9,'The row names the stone and course and counts tons');
ok(!/trade|markup|margin/i.test(row!.note??'')&&/Carr/.test(row!.note??''),'The homeowner-facing note names the supplier but no trade price, markup or margin');
ok(!takeoff.sections.some(s=>s.id==='wall-body-gw'),'No separate wall-body supply quote for a priced stone');
ok(takeoff.sections.some(s=>s.id==='wall-installation-gw'&&s.amountCents===null),'Setting the stone stays a builder quote');
ok(takeoff.quoteRequired,'The wall still needs a quote for labour and the rest');
const dark=buildYardTakeoff(flat([wall({finishedElevationIn:30,wallStone:{stoneId:'carr-dark-grey',courseIn:14},color:'#6e6c68'})])),darkRow=dark.sections.find(s=>s.id==='wall-stone-gw')!;
ok(darkRow.amountCents===Math.round(Math.round(lb*.153*100)*baseline.facts.materialMarkup),'Dark Grey is priced at $0.153/lb trade');
ok(dark.knownSubtotalCents-takeoff.knownSubtotalCents===darkRow.amountCents!-row!.amountCents!,'The stone row is part of the known subtotal');

// 7. Existing walls keep their stock.
const armour=blocks(buildYardModel(flat([wall({id:'aw',productId:'armour-stone',wallStone:undefined,depthFt:3,finishedElevationIn:30})])),'aw');
ok(armour.length>0&&armour.every(b=>Math.abs(b.h-(18-.03))<1e-6),'Natural armour stone keeps its 18 in courses');
ok(!buildYardTakeoff(flat([wall({id:'aw',productId:'armour-stone',wallStone:undefined,depthFt:3,finishedElevationIn:30})])).sections.some(s=>s.id.startsWith('wall-stone-')),'Natural armour stone keeps its allowance, with no stone row');

// 8. Editor: picking the product sets the Carr default, depth and colour; the stone and course choices.
const picked=wallProductPatch(wall({productId:'armour-stone',wallStone:undefined,depthFt:3}),GUILLOTINED_WALL);
ok(picked.wallStone?.stoneId==='carr-orillia-grey'&&picked.wallStone.courseIn===14&&Math.abs(picked.depthFt!-14/12)<1e-9&&picked.color===WALL_STONES[0].hex,'Picking the guillotined wall sets Orillia Grey, 14 in courses, a 14 in bed and its colour');
const html=renderToStaticMarkup(createElement(WallStoneEditor,{feature:wall(),onChange:()=>{}}));
ok(/Orillia Grey/.test(html)&&/Dark Grey/.test(html)&&/10 in/.test(html)&&/20 in/.test(html)&&/confirm/i.test(html)&&/Carr/.test(html),'The editor offers both stones, the four courses and says to confirm sizes with Carr');

// 9. Agents: a design with a guillotined wall goes through the agent API (and back to another product), and the
// assistant accepts it as context.
let state:DeckAgentHostState={data:flat([]),view:'plan',openSections:[],canUndo:false,canRedo:false,ready:true};
const agent=createDeckAgentController({getState:()=>state,commitDesign:next=>{state={...state,data:next};},undo:()=>{},redo:()=>{},setView:()=>{},openSection:()=>{},waitForRender:async()=>{}});
const agentResult=await agent.execute({id:'gw-agent',commands:[{type:'design.patch',patch:{yardFeatures:[wall({finishedElevationIn:30})]}}]});
ok(agentResult.ok&&state.data.yardFeatures?.[0].wallStone?.courseIn===14,`The agent API accepts a guillotined wall with its stone choice (${JSON.stringify(agentResult).slice(0,160)})`);
const context=validateAssistantContext(buildAssistantContext(agent.read()));
ok((context.design.yardFeatures as unknown as YardFeature[])[0].wallStone?.stoneId==='carr-orillia-grey','The assistant accepts a design with a guillotined wall as its context');
// The editors (Backyard, landscape workspace, Designer Mode inspector) preview a material-picker change as a strict
// design.patch of the whole wall; moving a guillotined wall to a supplier wall must come through canonical.
const picker={productId:'techo-raffinato-wall',color:'#222222',depthFt:249/304.8,hardscape:{finishId:'smooth',colorId:'onyx-black',unitId:'double-sided-397-249-90',patternId:'running-bond',angleDeg:0,jointMm:0}};
const current=state.data.yardFeatures![0],patch=withoutStaleStone(current,picker),merged:Record<string,unknown>={...current,...patch};for(const k of Object.keys(patch))if(merged[k]===undefined)delete merged[k];// as HardscapeInspector merges
const inspected=await agent.preview({id:'gw-inspector',commands:[{type:'design.patch',patch:{yardFeatures:[merged as unknown as YardFeature]}}]});
ok(inspected.ok,`A material-picker change moves a guillotined wall to a supplier wall through the strict agent patch (${JSON.stringify(inspected).slice(0,200)})`);
ok(!('wallStone' in wallProductPatch(wall(),'segmental-concrete'))||wallProductPatch(wall(),'segmental-concrete').wallStone===undefined,'Picking another product from the list drops the stone choice');
const switched=await agent.execute({id:'gw-agent-switch',commands:[{type:'yard.update',id:'gw',productId:'segmental-concrete'}]});
ok(switched.ok&&state.data.yardFeatures?.[0].productId==='segmental-concrete'&&state.data.yardFeatures[0].wallStone===undefined,`An agent can move a guillotined wall to another product (${JSON.stringify(switched).slice(0,160)})`);

// 10. The stone looks real (render only): flat top and bed, a split face with relief, crisp arrises broken by chips, its own
// shade of the limestone. It is carved inward from its laid stone, so nothing leaves the stone's footprint or course except,
// behind the face, its ends reaching the middle of a joint to meet the next stone's. Positions are 32-bit floats, so heights
// and outlines are compared to a thousandth of an inch. Edge and face depths are measured from the stone as drawn
// (straight, where it was laid on an arc).
type Plan={x:number;y:number};
const rings=(b:YardBox)=>(b.renderContours??[b.polygon!]).filter(r=>yardSignedArea(r)>0);
const edgeDistance=(ring:Plan[],q:Plan)=>Math.min(...ring.map((a,i)=>{const c=ring[(i+1)%ring.length],dx=c.x-a.x,dy=c.y-a.y,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(a.x+t*dx-q.x,a.y+t*dy-q.y);}));
const insideRing=(ring:Plan[],q:Plan)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],c=ring[j];if((a.y>q.y)!==(c.y>q.y)&&q.x<(c.x-a.x)*(q.y-a.y)/(c.y-a.y)+a.x)hit=!hit;}return hit||edgeDistance(ring,q)<1e-3;};
const lWall=blocks(buildYardModel(flat([wall({id:'lw',xFt:-40,finishedElevationIn:30,wallPath:[{x:-120,y:0},{x:0,y:0},{x:0,y:120}]})])),'lw');
// Also a wall split in line by a top step, and two walls laid end to end.
const topStepWall=blocks(buildYardModel(flat([wall({id:'ts',zFt:120,finishedElevationIn:48,heightIn:48,wallTopSteps:[{stationIn:130,elevationIn:34}]})])),'ts');
const endToEnd=[...blocks(buildYardModel(flat([wall({id:'wa',xFt:-10,zFt:80,finishedElevationIn:30})])),'wa'),...blocks(buildYardModel(flat([wall({id:'wb',xFt:10,zFt:80,finishedElevationIn:30})])),'wb')];
// (Each test wall stands on its own, some in the same place, so neighbours are found wall by wall, the end-to-end pair together.)
const tightArc=blocks(buildYardModel(flat([wall({id:'ta',zFt:160,finishedElevationIn:30,wallPath:[{x:-120,y:0},{x:0,y:0},{x:0,y:120}],curves:[{edge:1,bulgeIn:50}]})])),'ta');
const fixtures=[stones,battered,curvedStones,lWall,topStepWall,endToEnd,tightArc].map(mergeStonePieces),laidStones=fixtures.flat(),nextTo=new Map(fixtures.flatMap(g=>[...stoneNeighbours(g)])),sample=laidStones.filter(b=>!b.renderDuplicate),halfJoint=STONE_JOINT_IN/2+1e-3;
const look=(b:YardBox,coarse=false,neighbours=nextTo.get(b)??[])=>{
 const g=splitFaceStoneGeometry(b,coarse,neighbours),p=g.getAttribute('position'),col=g.getAttribute('color'),index=g.index!,outline=rings(b),lo=b.y-b.h/2,hi=b.y+b.h/2;
 const at=(i:number)=>({x:p.getX(i),y:p.getY(i),z:p.getZ(i)}),plan=(i:number)=>({x:p.getX(i),y:p.getZ(i)}),inset=(i:number)=>Math.min(...outline.map(r=>edgeDistance(r,plan(i)))),drawn=stoneOutlines(b),depth=(i:number)=>Math.min(...drawn.map(r=>edgeDistance(r,plan(i))));
 let volume=0,topArea=0,bedArea=0;const edges=new Map<string,number>(),key=(v:{x:number;y:number;z:number})=>`${Math.round(v.x*1e3)},${Math.round(v.y*1e3)},${Math.round(v.z*1e3)}`;
 for(let t=0;t<index.count;t+=3){const tri=[at(index.getX(t)),at(index.getX(t+1)),at(index.getX(t+2))],[a,c,d]=tri;volume+=(a.x*(c.y*d.z-c.z*d.y)-a.y*(c.x*d.z-c.z*d.x)+a.z*(c.x*d.y-c.y*d.x))/6;const flatArea=Math.abs((c.x-a.x)*(d.z-a.z)-(d.x-a.x)*(c.z-a.z))/2;if(tri.every(v=>Math.abs(v.y-hi)<1e-3))topArea+=flatArea;if(tri.every(v=>Math.abs(v.y-lo)<1e-3))bedArea+=flatArea;tri.forEach((v,k)=>{const e=key(v)+'>'+key(tri[(k+1)%3]);edges.set(e,(edges.get(e)??0)+1);});}
 const all=[...Array(p.count).keys()],tone=(i:number)=>(col.getX(i)+col.getY(i)+col.getZ(i))/3,onSeam=(k:string)=>{const [x,,z]=k.split(',').map(Number);return outline.filter(r=>edgeDistance(r,{x:x/1e3,y:z/1e3})<.1).length>1;},open=[...edges].filter(([e,n])=>{const [a,c]=e.split('>');return (edges.get(c+'>'+a)??0)!==n&&!(onSeam(a)&&onSeam(c));}).length;
 return {g,lo,hi,outline,drawn,all,at,plan,inset,depth,volume,topArea,bedArea,col,tone,open,area:outline.reduce((n,r)=>n+yardSignedArea(r),0),drawnArea:drawn.reduce((n,r)=>n+yardSignedArea(r),0),triangles:index.count/3};
};
const rect=(over:Partial<YardBox>={}):YardBox=>({id:'r',featureId:'gw',role:'wall-block',color:'#a7a399',x:0,y:7,z:0,w:48,h:14,d:14,polygon:[{x:-24,y:-7},{x:24,y:-7},{x:24,y:7},{x:-24,y:7}],unitId:'gw-wall-block-0-0-3',...over});
const range=(v:number[])=>`${Math.min(...v).toFixed(2)}-${Math.max(...v).toFixed(2)}`;
for(const coarse of [false,true]){
 const tier=coarse?'below the high render tier':'in full',misses={carved:[] as string[],flatBeds:[] as string[],brokenTops:[] as string[],splitFaces:[] as string[],solid:[] as string[],open:[] as string[],joints:[] as string[]};
 for(const b of sample){
  const s=look(b,coarse),id=b.unitId!,beside=nextTo.get(b)??[];
  // Outside its laid stone only in a joint, with a neighbour across it (on an arc a little wider or narrower than laid), and
  // never by more than half the laid joint.
  if(!s.all.every(i=>{const v=s.at(i),q=s.plan(i);return v.y>=s.lo-1e-3&&v.y<=s.hi+1e-3&&(s.outline.some(r=>insideRing(r,q))||(s.inset(i)<=halfJoint&&beside.some(r=>edgeDistance(r,q)<=.6)));}))misses.carved.push(id);
  if(s.topArea<.5*s.area||s.bedArea<.5*s.area)misses.flatBeds.push(`${id} top ${(s.topArea/s.area).toFixed(2)} bed ${(s.bedArea/s.area).toFixed(2)}`);
  // Where a stone laid in pieces continues into its next piece, its edge stays put.
  const seam=(i:number)=>s.outline.filter(r=>edgeDistance(r,s.plan(i))<.1).length>1,top=s.all.filter(i=>Math.abs(s.at(i).y-s.hi)<1e-3&&!seam(i)).map(s.depth),mid=s.all.filter(i=>{const y=s.at(i).y;return y>s.lo+.35*b.h&&y<s.hi-.35*b.h&&!seam(i);}).map(s.depth);
  if(s.area>=200&&!(Math.max(...top)-Math.min(...top)>=.5&&top.reduce((n,v)=>n+v,0)/top.length>=.2&&Math.max(...top)<=4.5))misses.brokenTops.push(`${id} ${range(top)} in`);
  // The coarse stone samples its face less often, so it shows a little less of the relief.
  if(s.area>=200&&!(Math.max(...mid)>=(coarse?.5:.6)&&Math.max(...mid)<=3.5&&Math.max(...mid)-Math.min(...mid)>=.4))misses.splitFaces.push(`${id} ${range(mid)} in`);
  if(!(s.volume>=.6*s.drawnArea*b.h&&s.volume<=s.area*b.h+1e-6))misses.solid.push(`${id} ${(s.volume/(s.drawnArea*b.h)).toFixed(2)}`);
  if(s.open)misses.open.push(`${id} ${s.open} open edges`);
  // Every joint closes behind the face at every height: some point of the stone reaches the middle of it.
  const levels=[...new Set(s.all.map(i=>Math.round(s.at(i).y*1e3)))];
  // (A joint: at least an inch of the stone's edge lies across one from the neighbour, not a corner touching a corner.)
  for(const r of beside.filter(r=>s.drawn.reduce((n,d)=>n+d.reduce((m,p,i)=>{const q=d[(i+1)%d.length];return edgeDistance(r,{x:(p.x+q.x)/2,y:(p.y+q.y)/2})<STONE_JOINT_IN+.1?m+Math.hypot(q.x-p.x,q.y-p.y):m;},0),0)>=1))for(const y of levels)if(!s.all.some(i=>Math.round(s.at(i).y*1e3)===y&&edgeDistance(r,s.plan(i))<=halfJoint)){misses.joints.push(`${id} at ${(y/1e3).toFixed(2)}`);break;}
  s.g.dispose();
 }
 ok(!misses.carved.length,`Every stone stays inside its own laid course and footprint, bar its ends meeting the next stone's in the joint (straight, battered L, L and arc walls, ${tier}): ${misses.carved.join()}`);
 ok(!misses.flatBeds.length,`Every stone keeps a flat top and bed, as the guillotine leaves them (${tier}): ${misses.flatBeds.join()}`);
 ok(!misses.brokenTops.length,`Every stone's top edge is broken, never a straight arris (${tier}): ${misses.brokenTops.join()}`);
 ok(!misses.splitFaces.length,`Every stone's face is split rock with relief, not a flat plane (${tier}): ${misses.splitFaces.join()}`);
 ok(!misses.solid.length,`Every stone is a solid of most of its drawn volume, within its laid volume (${tier}): ${misses.solid.join()}`);
 // (Where a stone laid in pieces meets itself, its pieces' sides stand against each other and aren't counted.)
 ok(!misses.open.length,`Every stone is closed, its surfaces never folding over at a sharp corner (${tier}): ${misses.open.join()}`);
 ok(!misses.joints.length,`Every joint, mitred corners included, closes up behind the face at every height, so none shows the sky through the wall (${tier}): ${misses.joints.join()}`);
}
// A stone the model laid in two pieces where a top step splits the run in line is drawn as one stone, no joint at the split.
const splitInLine=topStepWall.filter(b=>!b.renderDuplicate&&topStepWall.filter(o=>!o.renderDuplicate&&o.unitId===b.unitId).length>1),mergedTopStep=mergeStonePieces(topStepWall).filter(b=>!b.renderDuplicate);
ok(splitInLine.length>0&&new Set(mergedTopStep.map(b=>b.unitId)).size===mergedTopStep.length&&mergedTopStep.filter(b=>splitInLine.some(o=>o.unitId===b.unitId)).every(b=>stoneOutlines(b).length===1&&(nextTo.get(b)??[]).length<=2),`A stone split in line by a wall top step is drawn as one straight stone (${splitInLine.length} pieces)`);
// Where two guillotined walls meet end to end, their end stones meet in the joint like any others.
const meeting=laidStones.filter(b=>(b.featureId==='wa'&&Math.max(...b.polygon!.map(p=>p.x))>-1)||(b.featureId==='wb'&&Math.min(...b.polygon!.map(p=>p.x))<1));
ok(meeting.length>=4&&meeting.every(b=>(nextTo.get(b)??[]).some(r=>r.some(p=>Math.abs(p.x)<1))),`Two walls laid end to end close the joint between them (${meeting.length} end stones)`);
// The split stones' material patches compile against the three.js installed.
const stoneMaterial=splitStoneMaterial(new THREE.MeshStandardMaterial()),compiled={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};
stoneMaterial.onBeforeCompile(compiled as never,{} as never);
ok(stoneMaterial.shadowSide===THREE.BackSide&&!compiled.vertexShader.includes('#include <shadowmap_vertex>')&&compiled.vertexShader.includes('directionalLightShadows[ i ].shadowNormalBias + 0.1')&&compiled.fragmentShader.includes('vec3( 0.5 ) / max( sampledDiffuseColor.rgb'),'The split stones\' shadow and detail patches apply to this three.js');
// The 3D view's batch keeps the stones it drew in its last build: a rebuilt design that lays the same stone reuses it, and a
// stone not drawn for two builds is let go.
const kept=stoneCache(),first=splitFaceStoneMesh(rect(),false,[],kept).getAttribute('position');nextStoneCacheRound(kept);
const reused=splitFaceStoneMesh(rect(),false,[],kept).getAttribute('position');nextStoneCacheRound(kept);nextStoneCacheRound(kept);
ok(reused===first&&splitFaceStoneMesh(rect(),false,[],kept).getAttribute('position')!==first&&kept.now.size===1&&kept.before.size===0,'A rebuilt design reuses the stones its batch drew last time, and lets go of older ones');
// A wall's free ends have no joint: they break like a face and stay on the laid stone.
ok(stones.filter(b=>!b.renderDuplicate).every(b=>{const s=look(b),inside=s.all.every(i=>Math.abs(s.plan(i).x)<=120+1e-3);s.g.dispose();return inside;}),'A wall\'s free ends stay on the laid stone, with no joint to reach into');
// A stone no longer than it is deep (a short stretch, a 20 in course) still has its faces on the wall faces and its ends at
// its joints.
for(const [length,deep] of [[12,14],[16,20]]){
 const b=rect({polygon:[{x:-length/2,y:-deep/2},{x:length/2,y:-deep/2},{x:length/2,y:deep/2},{x:-length/2,y:deep/2}],w:length,d:deep,h:deep,y:deep/2}),end=length/2+STONE_JOINT_IN,beside=[[{x:-end-24,y:-deep/2},{x:-end,y:-deep/2},{x:-end,y:deep/2},{x:-end-24,y:deep/2}],[{x:end,y:-deep/2},{x:end+24,y:-deep/2},{x:end+24,y:deep/2},{x:end,y:deep/2}]];
 const s=look(b,false,beside),reach=Math.max(...s.all.map(i=>Math.abs(s.plan(i).x)));
 ok(s.all.every(i=>Math.abs(s.plan(i).y)<=deep/2+1e-3)&&Math.abs(reach-(length/2+STONE_JOINT_IN/2))<1e-3,`A ${length} in stone in a ${deep} in course keeps its faces on the wall faces and its ends at its joints (reaches ${reach.toFixed(3)} in)`);
 s.g.dispose();
}
ok(look(rect()).triangles<=1100&&look(rect(),true).triangles<=500,`A 48 in stone stays within 1,100 triangles, 500 below the high render tier (${look(rect()).triangles}, ${look(rect(),true).triangles})`);
const remnant=look(rect({polygon:[{x:-1.5,y:-7},{x:1.5,y:-7},{x:1.5,y:7},{x:-1.5,y:7}],w:3}));
ok(remnant.volume>0&&remnant.all.every(i=>insideRing(remnant.outline[0],remnant.plan(i))),'A 3 in cut remnant is still a solid inside its footprint');
const positions=(b:YardBox,beside=nextTo.get(b)??[])=>[...splitFaceStoneGeometry(b,false,beside).getAttribute('position').array];
ok(positions(rect()).join()===positions(rect()).join(),'The same stone always looks the same');
ok(positions(rect()).join()!==positions(rect({unitId:'gw-wall-block-0-0-4'})).join(),'Each stone looks different from the next');
// Moving the wall moves its stones without changing how any stone looks, whichever way the wall runs.
for(const [rotationDeg,dx,dz] of [[0,10,0],[90,3.7,-2.2],[270,-25,13]]){
 const before=blocks(buildYardModel(flat([wall({id:'mw',rotationDeg,finishedElevationIn:30})])),'mw'),after=blocks(buildYardModel(flat([wall({id:'mw',rotationDeg,xFt:dx,zFt:40+dz,finishedElevationIn:30})])),'mw'),n0=stoneNeighbours(before),n1=stoneNeighbours(after);
 ok(before.filter(b=>!b.renderDuplicate).every(b=>{const m=after.find(o=>o.unitId===b.unitId&&!o.renderDuplicate);if(!m)return false;const a=positions(b,n0.get(b)),c=positions(m,n1.get(m));return a.length===c.length&&a.every((v,i)=>Math.abs(v+(i%3===0?dx*12:i%3===2?dz*12:0)-c[i])<1e-3);}),`Moving a wall that runs at ${rotationDeg}° changes no stone's look`);
}
// The top edge breaks back from the face just below it (a small straight break, now and then a chip).
const breaks=sample.flatMap(b=>{
 const s=look(b),levels=[...new Set(s.all.map(i=>Math.round(s.at(i).y*1e3)))].sort((p,q)=>p-q),count=s.all.length/(levels.length+2),below=levels.findIndex(y=>Math.abs(y/1e3-(s.hi-.9))<1e-3);
 if(s.area<200||!Number.isInteger(count)||below<0){s.g.dispose();return [];}
 const top=levels.length-1,list=Array.from({length:count},(_,i)=>s.depth(top*count+i)-s.depth(below*count+i));s.g.dispose();
 return [list.reduce((n,v)=>n+v,0)/list.length];
});
ok(breaks.length>=40&&breaks.reduce((n,v)=>n+v,0)/breaks.length>=.15,`Each top edge breaks back from the face (${breaks.length} stones, mean ${(breaks.reduce((n,v)=>n+v,0)/breaks.length).toFixed(2)} in)`);
ok(Math.abs(edgeBreak(0,0)-.2)<1e-9&&Math.abs(edgeBreak(.7,.999)-.45)<1e-3&&edgeBreak(.72,0)===edgeBreak(0,0)&&Math.abs(edgeBreak(.9999,0)-1.8)<1e-3,'The edge breaks back 0.2-0.45 in, and up to 1.6 in more where a chip breaks out');
// On an arc a stone is still straight: each face that followed the curve is one straight face (the chord outside the curve,
// a line across the deepest point inside it), inside the laid stone, so a curved wall facets like a real one.
// The arc runs from the corner (0, 480) to (0, 600): a 120 in chord bowed 20 in, so radius 100 in about (80, 540), the
// stones 14 in deep. Stones wholly on it (not the straight leg, nor the corner wedges where the leg meets it):
const onArc=(p:Plan)=>Math.abs(Math.abs(Math.atan2(p.y-540,p.x-80))-Math.PI)<=Math.asin(.6)+.01&&Math.abs(Math.hypot(p.y-540,p.x-80)-100)<=7.5;
const arcStones=curvedStones.filter(b=>!b.renderDuplicate&&rings(b).flat().every(onArc));
const turns=(ring:Plan[])=>ring.filter((p,i)=>{const a=ring[(i+ring.length-1)%ring.length],c=ring[(i+1)%ring.length],ux=p.x-a.x,uy=p.y-a.y,vx=c.x-p.x,vy=c.y-p.y;return Math.abs(Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy))>.004;}).length;
ok(arcStones.length>=8,`The arc wall has stones laid in facets (${arcStones.length})`);
const bent=arcStones.flatMap(b=>{const laid=rings(b),drawn=stoneOutlines(b),area=yardSignedArea(drawn[0])/laid.reduce((n,r)=>n+yardSignedArea(r),0);return drawn.length===1&&turns(drawn[0])<=4&&area>=.8&&area<=1+1e-6&&drawn[0].every(p=>laid.some(r=>insideRing(r,p)))?[]:[`${b.unitId} ${drawn.length} pieces, ${turns(drawn[0])} corners, ${area.toFixed(3)} of its area`];});
// A stone whose laid outline is notched (the model's clipping near the ends of the curve leaves gaps about a joint wide)
// can't be squared up without crossing into the joint, so it keeps its laid pieces.
ok(bent.length<=arcStones.length/4,`Stones on the arc are drawn straight and in one piece, four-cornered, inside their laid stone (${arcStones.length-bent.length}/${arcStones.length}; kept as laid: ${bent.join()})`);
// Colour: each stone its own shade, warm or cool; recesses darker and the top weathered lighter; the swatch's own lightness.
const shades=sample.map(b=>{const s=look(b),mean=(f:(i:number)=>number,list=s.all)=>list.reduce((n,i)=>n+f(i),0)/list.length,top=s.all.filter(i=>Math.abs(s.at(i).y-s.hi)<1e-3),face=s.all.filter(i=>{const y=s.at(i).y;return y>s.lo+.3*b.h&&y<s.hi-.3*b.h;});const r={tone:mean(s.tone),warm:mean(i=>s.col.getX(i)-s.col.getZ(i)),top:mean(s.tone,top),face:mean(s.tone,face),lo:Math.min(...s.all.map(s.tone)),hi:Math.max(...s.all.map(s.tone))};s.g.dispose();return r;});
ok(Math.max(...shades.map(s=>s.tone))-Math.min(...shades.map(s=>s.tone))>=.1,'Stones differ in shade, as quarried limestone does');
ok(shades.some(s=>s.warm>.01)&&shades.some(s=>s.warm<-.01),'Some stones are warmer (buff) and some cooler (blue-grey)');
ok(shades.every(s=>s.lo>=.5&&s.hi<=1.6),'No part of a stone strays far from the chosen colour (a bleached stone\'s weathered top is the lightest)');
const wallTone=shades.reduce((n,s)=>n+s.tone,0)/shades.length;
ok(wallTone>=.9&&wallTone<=1.02,`The wall keeps the swatch's own lightness, so Orillia Grey stays light and Dark Grey dark (${wallTone.toFixed(3)})`);
ok(shades.filter(s=>s.top>s.face).length>=.8*shades.length,'Tops are weathered lighter than the faces');
// Only guillotined stones take this look; every other wall, cap, paver and rock is drawn exactly as before.
const mixed=buildYardModel(flat([wall({finishedElevationIn:30}),wall({id:'aw',xFt:30,productId:'armour-stone',wallStone:undefined,depthFt:3,finishedElevationIn:30}),wall({id:'sw',xFt:-30,productId:'segmental-concrete',wallStone:undefined,depthFt:1,finishedElevationIn:30})])),splitWalls=splitFaceFeatures(mixed);
ok([...splitWalls].join()==='gw','Only the guillotined wall is drawn as split stone');
ok(mixed.boxes.every(b=>drawnSplit(b,splitWalls)===(b.featureId==='gw'&&b.role==='wall-block'))&&mixed.boxes.some(b=>b.featureId!=='gw'&&b.role==='wall-block'),'Only its body stones are drawn split; the other walls\' stones, and every other part, are drawn as before');

console.log(`GUILLOTINED WALL OK — ${checks} checks`);
