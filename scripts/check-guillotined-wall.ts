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

console.log(`GUILLOTINED WALL OK — ${checks} checks`);
