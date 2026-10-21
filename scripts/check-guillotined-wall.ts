// Guillotined armour stone walls (Simcoe County research, 2026-10-20): Carr's guillotined wallstone in Orillia Grey or
// Dark Grey, laid in 10, 14, 16 or 20 in courses of random 24-48 in stones with staggered joints, priced by weight
// from Carr's 2025 trade price with the engine's material markup; the rest of the wall stays a builder quote.
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {loadAdvancedYardRuntime,buildYardModel,needsAdvancedYard,yardSignedArea} from '../src/features/deckcraft/yardModel';
import type {YardModel,YardBox} from '../src/features/deckcraft/yardModel';
import {buildYardTakeoff} from '../src/features/deckcraft/yardTakeoff';
import {yardWallCourses} from '../src/features/deckcraft/yardElevations';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import {WALL_PRODUCTS} from '../src/features/deckcraft/yardSettings';
import {GUILLOTINED_WALL,WALL_STONES,WALL_STONE_COURSES_IN,LIMESTONE_LB_PER_FT3,wallStoneOf,wallStoneProblem} from '../src/features/deckcraft/wallStones';
import {STONE_JOINT_IN,STONE_JOINT_CLEARANCE_IN,STONE_LENGTH_IN} from '../src/features/deckcraft/wallStoneCourses';
import WallStoneEditor,{wallProductPatch,withoutStaleStone} from '../src/features/deckcraft/WallStoneEditor';
import baseline from '../src/data/engine-baseline.json';
import {createDeckAgentController,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';
import {buildAssistantContext,validateAssistantContext} from '../src/features/deckcraft/designer/assistantPlan';

await loadAdvancedYardRuntime();
let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;},near=(a:number,b:number,m:string,tolerance=1e-6)=>ok(Math.abs(a-b)<=tolerance,`${m}: ${a} vs ${b}`);
const flat=(features:YardFeature[]):DeckData=>({...structuredClone(DEFAULT_DECK),houseVisible:false,yardFeatures:features});
const wall=(over:Partial<YardFeature>={}):YardFeature=>({id:'gw',kind:'retaining-wall',name:'Guillotined wall',enabled:true,xFt:0,zFt:40,widthFt:20,depthFt:14/12,heightIn:30,rotationDeg:0,productId:GUILLOTINED_WALL,color:'#a7a399',wallStone:{stoneId:'carr-orillia-grey',courseIn:14},...over});
const blocks=(m:YardModel,id='gw')=>m.features.find(f=>f.config.id===id)!.boxes.filter(b=>b.role==='wall-block');
const rowOf=(b:YardBox)=>Number(b.unitId!.split('-wall-block-')[1].split('-')[0]);
const xs=(b:YardBox)=>b.polygon!.map(p=>p.x);

// 1. The product, its stones and courses.
ok(WALL_PRODUCTS.some(p=>p.id===GUILLOTINED_WALL&&p.name==='Guillotined armour stone wall'),'The wall product list offers the guillotined wall');
ok(WALL_STONES.map(s=>s.name).join()==='Orillia Grey,Dark Grey','Carr Orillia Grey (default) and Dark Grey are offered');
near(WALL_STONES[0].tradePerLb,.125,'Orillia Grey is Carr 2025 trade $0.125/lb');near(WALL_STONES[1].tradePerLb,.153,'Dark Grey is Carr 2025 trade $0.153/lb');
ok(WALL_STONE_COURSES_IN.join()==='10,14,16,20','Courses are 10, 14, 16 and 20 in');
ok(wallStoneOf(wall({wallStone:undefined})).stone.id==='carr-orillia-grey'&&wallStoneOf(wall({wallStone:undefined})).courseIn===14,'Absent stone choice means Orillia Grey in 14 in courses');

// 2. Validation and save/reload.
ok(wallStoneProblem(wall())==='','A Carr stone in a listed course is valid');
ok(wallStoneProblem(wall({wallStone:{stoneId:'quarry-x',courseIn:14}}))!=='','An unknown stone is rejected');
ok(wallStoneProblem(wall({wallStone:{stoneId:'carr-dark-grey',courseIn:12}}))!=='','An unlisted course is rejected');
ok(wallStoneProblem(wall({productId:'armour-stone'}))!=='','Only the guillotined wall carries a stone choice');
const saved=parseDesign(serializeDesign(flat([wall({wallStone:{stoneId:'carr-dark-grey',courseIn:20},depthFt:20/12})])));
ok(saved.yardFeatures?.[0].wallStone?.stoneId==='carr-dark-grey'&&saved.yardFeatures[0].wallStone.courseIn===20,'The stone choice survives a save and reload');
assert.throws(()=>validateDesign(flat([wall({wallStone:{stoneId:'carr-dark-grey',courseIn:12}})])),/stone/i);checks++;
assert.throws(()=>validateDesign(flat([wall({productId:'segmental-concrete'})])),/stone/i);checks++;

// 3. Courses: the chosen height, no cap course.
for(const courseIn of WALL_STONE_COURSES_IN){const c=yardWallCourses(wall({wallStone:{stoneId:'carr-orillia-grey',courseIn}}),0);ok(c.course===courseIn&&c.cap===0,`${courseIn} in courses with no cap`);}
ok(needsAdvancedYard(flat([wall()])),'A guillotined wall is laid by the advanced yard runtime');

// 4. The model: random 24-48 in stones, staggered joints, a visible joint, deterministic.
const model=buildYardModel(flat([wall({finishedElevationIn:30})])),stones=blocks(model);
ok(stones.length>0&&!model.features[0].boxes.some(b=>b.role==='wall-cap'),'The wall is stones only, with no cap course');
ok(stones.every(b=>Math.abs(b.h-(14-.03))<1e-6),'Every stone is one 14 in course high');
const rows=[...new Set(stones.map(rowOf))].sort((a,b)=>a-b),wallStart=-120,wallEnd=120;
ok(rows.length>=3,'A 30 in wall with its buried course has at least three courses');
const runs=rows.map(r=>stones.filter(b=>rowOf(b)===r).map(b=>({lo:Math.min(...xs(b)),hi:Math.max(...xs(b))})).sort((a,b)=>a.lo-b.lo));
for(const run of runs){
 const stations=[wallStart,...run.slice(0,-1).map(s=>s.hi+STONE_JOINT_IN/2)];
 for(let i=1;i<stations.length;i++){const length=stations[i]-stations[i-1];ok(length>=STONE_LENGTH_IN.min-1e-6&&length<=STONE_LENGTH_IN.max+1e-6,`Stone ${length.toFixed(2)} in is within 24-48 in`);}
 near(run[0].lo,wallStart,'Each course starts flush at the wall end',1e-6);near(run.at(-1)!.hi,wallEnd,'…and ends flush at the other end',1e-6);
 for(let i=1;i<run.length;i++)near(run[i].lo-run[i-1].hi,STONE_JOINT_IN,'Neighbouring stones keep a visible joint',1e-6);
}
ok(new Set(runs.flat().slice(0,-1).map(s=>(s.hi-s.lo).toFixed(2))).size>3,'Stone lengths vary, not one repeated block');
const joints=(run:{lo:number;hi:number}[])=>run.slice(0,-1).map(s=>s.hi+STONE_JOINT_IN/2).filter(x=>x>wallStart+1&&x<wallEnd-1);
for(let r=1;r<runs.length;r++)for(const j of joints(runs[r]))ok(joints(runs[r-1]).every(below=>Math.abs(j-below)>=STONE_JOINT_CLEARANCE_IN-1e-6),`Course ${r} joint at ${j.toFixed(1)} in clears every joint below by 6 in`);
const again=blocks(buildYardModel(flat([wall({finishedElevationIn:30})])));
ok(JSON.stringify(again.map(b=>b.polygon))===JSON.stringify(stones.map(b=>b.polygon)),'The same wall lays the same stones every time');
const other=blocks(buildYardModel(flat([wall({id:'gw2',finishedElevationIn:30})])),'gw2');
ok(JSON.stringify(other.map(b=>xs(b)))!==JSON.stringify(stones.map(b=>xs(b))),'Another wall gets its own stone pattern');

// 5. Weight: modelled stone volume (buried course included) at 165 lb/cu ft.
const volumeIn3=stones.reduce((n,b)=>n+Math.abs(yardSignedArea(b.polygon!))*b.h,0),lb=volumeIn3/1728*LIMESTONE_LB_PER_FT3;
near(model.features[0].quantities.wallStoneLb,lb,'The model weighs its own stones',1e-6);

// 6. Estimate: stone priced at Carr trade × markup, the rest quoted.
const takeoff=buildYardTakeoff(flat([wall({finishedElevationIn:30})]),model),row=takeoff.sections.find(s=>s.id==='wall-stone-gw');
ok(row&&row.amountCents===Math.round(Math.round(lb*.125*100)*baseline.facts.materialMarkup),'Orillia Grey is priced at $0.125/lb trade with the 1.35 material markup, in cents');
ok(row!.label==='Guillotined wall: Guillotined armour stone, Orillia Grey, 14 in courses'&&row!.unit==='tons'&&Math.abs(row!.quantity!-lb/2000)<1e-9,'The row names the stone and course and counts tons');
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
const away=withoutStaleStone(wall(),{productId:'segmental-concrete'});
ok('wallStone' in away&&away.wallStone===undefined,'Moving the wall to another product drops the stone choice');
ok(!('wallStone' in withoutStaleStone(wall(),{heightIn:36})),'Other edits keep the stone choice');
const html=renderToStaticMarkup(createElement(WallStoneEditor,{feature:wall(),onChange:()=>{}}));
ok(/Orillia Grey/.test(html)&&/Dark Grey/.test(html)&&/10 in/.test(html)&&/20 in/.test(html)&&/confirm/i.test(html)&&/Carr/.test(html),'The editor offers both stones, the four courses and says to confirm sizes with Carr');

// 9. Agents: a design with a guillotined wall goes through the agent API, and the assistant schema knows the stones.
let state:DeckAgentHostState={data:flat([]),view:'plan',openSections:[],canUndo:false,canRedo:false,ready:true};
const agent=createDeckAgentController({getState:()=>state,commitDesign:next=>{state={...state,data:next};},undo:()=>{},redo:()=>{},setView:()=>{},openSection:()=>{},waitForRender:async()=>{}});
const agentResult=await agent.execute({id:'gw-agent',commands:[{type:'design.patch',patch:{yardFeatures:[wall({finishedElevationIn:30})]}}]});
ok(agentResult.ok&&state.data.yardFeatures?.[0].wallStone?.courseIn===14,`The agent API accepts a guillotined wall with its stone choice (${JSON.stringify(agentResult).slice(0,160)})`);
const context=validateAssistantContext(buildAssistantContext(agent.read()));
ok((context.design.yardFeatures as unknown as YardFeature[])[0].wallStone?.stoneId==='carr-orillia-grey','The assistant accepts a design with a guillotined wall as its context');

console.log(`GUILLOTINED WALL OK — ${checks} checks`);
