// AI Site Designer, wave 2: the agent's create/edit commands for the site elements and the site brief it reads.
// yard.create (patio, retaining wall, seat wall on a patio, fire bowl on a patio), yard.update (fire product refit, seat
// flag), raised beds through landscape.edit, read().siteBrief / siteWarnings on the real Craighurst survey
// (e2e/fixtures/craighurst-ground-fit.json), the assistant context (brief first, price summary, within 20 KB), plan
// compilation of the new commands, and every request as one commit and one undo step.
import '../src/features/deckcraft/siteModelRuntime';
import '../src/features/deckcraft/siteSurfaceEngine';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {parseDesign} from '../src/features/deckcraft/designPersistence';
import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
import {createDeckAgentController,type AgentCommand,type AgentResponse,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';
import {ASSISTANT_SYSTEM_PROMPT,assistantPlanRequest,assistantPlanSchemaForContext,buildAssistantContext,parseAssistantPlan} from '../src/features/deckcraft/designer/assistantPlan';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {deckReleaseData,calculateDeckReleaseEstimate} from '../src/features/deckcraft/deckRelease';
import {PATIO_PRODUCTS} from '../src/features/deckcraft/yardSettings';
import {newLandscapeObject} from '../src/features/deckcraft/landscapeCatalogue';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';

await loadAdvancedYardRuntime();
let checks=0,n=0;
const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;},eq=(a:unknown,b:unknown,m:string)=>{assert.deepEqual(a,b,m);checks++;};
const bytes=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v)).length;
const req=(commands:AgentCommand[],expectedRevision?:number)=>({id:`site-cmd-${++n}`,...(expectedRevision!==undefined?{expectedRevision}:{}),commands});
const good=(r:AgentResponse)=>{if(r.ok===false)throw Error(`${r.error.code}: ${r.error.message}`);return r;};
const bad=(r:AgentResponse,pattern:RegExp,m:string)=>ok(r.ok===false&&pattern.test(r.error.message),`${m} (${r.ok===false?r.error.message:'accepted'})`);
function host(data:DeckData){
 let state:DeckAgentHostState={data,view:'plan',openSections:[],canUndo:false,canRedo:false,ready:true},commits=0;const past:DeckData[]=[];
 const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{commits++;past.push(state.data);state={...state,data:next,canUndo:true,canRedo:false};},
  undo:()=>{state={...state,data:past.pop()!,canUndo:past.length>0,canRedo:true};},redo:()=>{},setView:()=>{},openSection:()=>{},
  waitForRender:async p=>{assert.ok(p(state),'Host acknowledges the committed state');}});
 return {api,get data(){return state.data;},get commits(){return commits;}};
}
const yard=(d:DeckData,id:string)=>d.yardFeatures?.find(f=>f.id===id);
const model=(d:DeckData,id:string)=>calculateDeckReleaseEstimate(d).yardModel.features.find(f=>f.config.id===id)!;

// A measured, gently falling yard well clear of the deck (no house), 100 ft across and out.
const points=[];for(let x=-600;x<=600;x+=120)for(let z=-120;z<=1200;z+=120)points.push({id:`S${x}_${z}`,xIn:x,zIn:z,elevationIn:+(-z*.02).toFixed(2)});
const flat=deckReleaseData({...structuredClone(DEFAULT_DECK),houseVisible:false,siteModel:{version:1,points,grading:[]}});
await ensureLiveDesignExtensions(flat);

// 1. Descriptor and schema.
{const f=host(flat),d=f.api.describe();
 ok(d.commands.includes('yard.create')&&d.commands.includes('yard.update'),'The descriptor lists yard.create and yard.update');
 ok(/yard\.create kind patio\|retaining-wall\|fire-feature/.test(d.units.yard)&&/siteBrief/.test(JSON.stringify(d.units)),'The descriptor explains creation and the site brief');
 ok(JSON.stringify(d.fieldSchema.yardFeatures).includes('supportFeatureId')&&JSON.stringify(d.fieldSchema.yardFeatures).includes('freestanding'),'Field schema carries fire support and the seat flag');
}

// 2. A patio, a seat wall on it and a fire bowl on it: one request, one commit, one undo step.
{const f=host(flat),before=JSON.stringify(f.data);
 const preview=good(await f.api.preview(req([{type:'yard.create',kind:'patio',id:'terrace',name:'Terrace',xFt:8,zFt:25,widthFt:16,depthFt:12}])));
 ok(preview.changed&&f.commits===0&&JSON.stringify(f.data)===before,'Preview creates nothing live');
 const r=good(await f.api.execute(req([
  {type:'yard.create',kind:'patio',id:'terrace',name:'Terrace',xFt:8,zFt:25,widthFt:16,depthFt:12},
  {type:'yard.create',kind:'retaining-wall',id:'seat',freestanding:true,supportFeatureId:'terrace',xFt:8,zFt:29,widthFt:8},
  {type:'yard.create',kind:'fire-feature',id:'fire',supportFeatureId:'terrace',xFt:8,zFt:23},
 ],f.api.read().revision)));
 ok(f.commits===1&&r.snapshot.history.canUndo,'Three creations are one commit');
 const patio=yard(f.data,'terrace')!,seat=yard(f.data,'seat')!,fire=yard(f.data,'fire')!;
 ok(patio.kind==='patio'&&patio.productId===PATIO_PRODUCTS[0].id&&patio.xFt===8&&patio.zFt===25&&patio.widthFt===16&&patio.depthFt===12,'Patio built with the Backyard defaults at the requested place and size');
 eq(patio.groundFit,{slopeRatio:3},'New patio on measured ground gets the default 3:1 ground fit');
 ok(patio.finishedElevationIn===-6,`Patio top is the measured ground at its centre, to 1/4 in (${patio.finishedElevationIn})`);
 eq(seat.wallConstruction,{freestanding:true},'Seat wall is freestanding');
 ok(seat.heightIn===18&&seat.name==='Seat wall'&&seat.finishedElevationIn===undefined&&seat.supportFeatureId===undefined,'Seat wall: 18 in, follows the paving, no link saved');
 ok(fire.kind==='fire-feature'&&fire.productId==='fire-gas-bowl'&&fire.supportFeatureId==='terrace'&&fire.widthFt===3.5&&fire.name==='Fire bowl','Gas fire bowl by default, on the patio');
 const seatModel=model(f.data,'seat'),fireModel=model(f.data,'fire');
 ok(!seatModel.excluded&&seatModel.warnings.some(w=>w.startsWith('Freestanding seat wall on Terrace')),`The seat wall stands on the paving (${seatModel.warnings.join(' | ')})`);
 ok(!fireModel.excluded&&!fireModel.boxes.some(b=>b.role==='fire-pad'),'The fire bowl stands on the patio, not on a pad of its own');
 ok(r.snapshot.wallConstruction.some(w=>w.featureId==='seat'),'Snapshot reports the seat wall construction');
 // Undo: the whole batch in one step.
 good(await f.api.execute(req([{type:'history.undo'}])));
 ok(JSON.stringify(f.data)===before,'One undo removes all three');
}
// 3. yard.update: "make it a gas table", a size change, support removed, the seat flag off, a raised patio.
{const f=host(flat);
 good(await f.api.execute(req([{type:'yard.create',kind:'patio',id:'terrace',xFt:8,zFt:25,widthFt:16,depthFt:12},{type:'yard.create',kind:'fire-feature',id:'fire',supportFeatureId:'terrace',xFt:8,zFt:23},{type:'yard.create',kind:'retaining-wall',id:'seat',freestanding:true,supportFeatureId:'terrace',xFt:8,zFt:29,widthFt:8}])));
 const commits=f.commits;
 good(await f.api.execute(req([{type:'yard.update',id:'fire',productId:'fire-gas-linear'}])));
 const table=yard(f.data,'fire')!;
 ok(table.productId==='fire-gas-linear'&&table.widthFt===4&&table.depthFt===2&&table.name==='Fire table'&&table.supportFeatureId==='terrace','Gas table: refit to 48 × 24 in and renamed, still on the patio');
 ok(f.commits===commits+1,'An update is one commit');
 good(await f.api.execute(req([{type:'yard.update',id:'fire',widthFt:6}])));
 ok(yard(f.data,'fire')!.widthFt===6&&yard(f.data,'fire')!.depthFt===2,'A 72 in table keeps its depth');
 good(await f.api.execute(req([{type:'yard.update',id:'fire',unset:['supportFeatureId'],xFt:20,zFt:40}])));
 ok(yard(f.data,'fire')!.supportFeatureId===undefined&&!model(f.data,'fire').excluded&&model(f.data,'fire').boxes.some(b=>b.role==='fire-pad'),'Support removed: the table moves to its own pad');
 good(await f.api.execute(req([{type:'yard.update',id:'seat',freestanding:false,heightIn:24}])));
 ok(yard(f.data,'seat')!.wallConstruction===undefined&&yard(f.data,'seat')!.heightIn===24,'Seat flag off and taller');
 good(await f.api.execute(req([{type:'yard.update',id:'terrace',heightIn:6}])));
 ok(yard(f.data,'terrace')!.finishedElevationIn===0&&yard(f.data,'terrace')!.heightIn===6,'A raised patio moves its fixed top by the difference');
 good(await f.api.execute(req([{type:'yard.update',id:'terrace',unset:['groundFit']}])));
 ok(yard(f.data,'terrace')!.groundFit===undefined,'unset removes the ground fit');

 // 4. A wall along a world-inch path.
 good(await f.api.execute(req([{type:'yard.create',kind:'retaining-wall',id:'back-wall',wallPath:[{x:-120,y:600},{x:120,y:600},{x:120,y:720}],heightIn:30}])));
 const w=yard(f.data,'back-wall')!;
 ok(w.xFt===0&&w.zFt===55&&w.widthFt===30&&w.rotationDeg===0&&JSON.stringify(w.wallPath)===JSON.stringify([{x:-120,y:-60},{x:120,y:-60},{x:120,y:60}]),'wallPath recentred to local inches; run 30 ft');
 ok(Math.abs(w.finishedElevationIn!-(-660*.02+30))<1e-9,`Fixed wall top is the measured ground plus its height (${w.finishedElevationIn})`);

 // 5. Rejections, all atomic.
 const before=JSON.stringify(f.data),c0=f.commits;
 bad(await f.api.execute(req([{type:'yard.create',kind:'fire-feature',supportFeatureId:'nowhere',xFt:8,zFt:23}])),/current patio/,'Fire on a missing patio');
 bad(await f.api.execute(req([{type:'yard.create',kind:'retaining-wall',freestanding:true,supportFeatureId:'terrace',xFt:8,zFt:40,widthFt:8}])),/inside/,'Seat wall off its patio');
 bad(await f.api.execute(req([{type:'yard.create',kind:'retaining-wall',supportFeatureId:'terrace',xFt:8,zFt:25,widthFt:8}])),/seat \(freestanding\)/,'Only a seat wall stands on a patio');
 bad(await f.api.execute(req([{type:'yard.create',kind:'patio',xFt:80,zFt:25}])),/off the measured survey/,'A patio off the survey');
 bad(await f.api.execute(req([{type:'yard.create',kind:'patio',xFt:47,zFt:25,widthFt:12,depthFt:12}])),/off the measured survey/,'A patio partly off the survey');
 bad(await f.api.execute(req([{type:'yard.create',kind:'fire-feature',productId:'fire-wood-ring',widthFt:6,xFt:20,zFt:60}])),/36 to 48 in/,'A fire ring outside its sizes');
 bad(await f.api.execute(req([{type:'yard.create',kind:'water-feature',xFt:8,zFt:40} as never])),/Create a patio/,'Water features are not created');
 bad(await f.api.execute(req([{type:'yard.create',kind:'patio',id:'terrace',xFt:8,zFt:40}])),/new id/,'Duplicate id');
 bad(await f.api.execute(req([{type:'yard.create',kind:'patio',xFt:8,zFt:40,color:'#000000'} as never])),/unknown or private field/,'Unknown field refused by the schema');
 bad(await f.api.execute(req([{type:'yard.create',kind:'retaining-wall',wallPath:[{x:0,y:600},{x:120,y:600}],rotationDeg:30}])),/rotationDeg/,'A world path with a rotation');
 bad(await f.api.execute(req([{type:'yard.update',id:'missing',widthFt:4}])),/not present/,'Update of a missing feature');
 bad(await f.api.execute(req([{type:'yard.update',id:'terrace',freestanding:true}])),/retaining walls/,'Seat flag on a patio');
 bad(await f.api.execute(req([{type:'yard.update',id:'terrace',groundFit:{slopeRatio:3},unset:['groundFit']}])),/unset/,'Set and unset together');
 bad(await f.api.execute(req([{type:'yard.update',id:'fire',productId:'fire-gas-log'}])),/fire product/,'Unknown fire product');
 ok(JSON.stringify(f.data)===before&&f.commits===c0,'Rejected commands leave the design and history untouched');

 // 6. Raised beds through landscape.edit: create, raise with a timber edge, then a wall edge.
 const object={...newLandscapeObject('mulch-bed','bed-1',-240,480)};
 good(await f.api.execute(req([{type:'landscape.edit',id:'bed-1',edit:{action:'create',object}}])));
 good(await f.api.execute(req([{type:'landscape.edit',id:'bed-1',edit:{action:'patch',patch:{raisedIn:18,edge:{kind:'timber'}}}}])));
 const bed=f.data.landscapeObjects!.find(o=>o.id==='bed-1')!;
 ok(bed.raisedIn===18&&bed.edge?.kind==='timber','landscape.edit raises a bed with a timber edge');
 good(await f.api.execute(req([{type:'landscape.edit',id:'bed-1',edit:{action:'patch',patch:{edge:{kind:'wall',wallFeatureId:'back-wall'}}}}])));
 ok(f.data.landscapeObjects!.find(o=>o.id==='bed-1')!.edge?.wallFeatureId==='back-wall','…or a wall edge linked to a yard wall');
 bad(await f.api.execute(req([{type:'landscape.edit',id:'bed-1',edit:{action:'patch',patch:{raisedIn:40}}}])),/./,'A bed over 36 in is refused');
 bad(await f.api.execute(req([{type:'landscape.edit',id:'bed-1',edit:{action:'patch',patch:{edge:{kind:'stone' as never}}}}])),/./,'An unknown edge is refused');

 // 7. siteWarnings: the fire table's pad and clearances are visible to the agent.
 const s=f.api.read();
 ok(s.ready&&s.siteBrief&&Array.isArray(s.siteBrief.lines),'A measured design reads ready with its site brief');
 ok(!s.siteWarnings||s.siteWarnings.every(w=>w.length<=240)&&s.siteWarnings.length<=12,'siteWarnings are trimmed');
}

// 8. Craighurst: read().siteBrief, siteWarnings, a fire bowl on its landing, nothing off the survey.
const FIXTURE=readFileSync(new URL('../e2e/fixtures/craighurst-ground-fit.json',import.meta.url),'utf8'),doc=JSON.parse(FIXTURE);
await ensureLiveDesignExtensions(doc);const craighurst=parseDesign(JSON.stringify(doc));
{const f=host(craighurst);f.api.read();
 good(await f.api.preview(req([{type:'yard.update',id:'landing',name:'Stone landing'}])));
 const s=f.api.read(),brief=s.siteBrief!;
 ok(s.ready&&brief&&brief.units==='in'&&Math.abs(brief.coverage.widthFt-14.6)<.1&&brief.lines.length>0,`Craighurst read() carries the site brief (${brief?.coverage.widthFt} ft wide)`);
 ok(bytes(brief)<=2048,'The brief stays within its 2 KB budget');
 ok(Array.isArray(s.siteWarnings)&&s.siteWarnings.length>0,'Craighurst reports ground/coverage warnings');
 const r=good(await f.api.execute(req([{type:'yard.create',kind:'fire-feature',id:'bowl',supportFeatureId:'landing',xFt:4,zFt:9.32,widthFt:2.5}])));
 ok(yard(f.data,'bowl')?.supportFeatureId==='landing'&&r.snapshot.siteBrief!==undefined,'A 30 in gas bowl on the stone landing');
 ok(r.snapshot.siteWarnings?.some(w=>/Fire bowl: .* ft from the (house|deck)/.test(w)),'Its clearance shortfall reaches siteWarnings');
 bad(await f.api.execute(req([{type:'yard.create',kind:'patio',xFt:30,zFt:30}])),/off the measured survey/,'Nothing is created off the Craighurst survey');

 // 9. The assistant context: the brief first, a price summary, within 20 KB; the raw survey only while it fits.
 const snap=f.api.read(),context=buildAssistantContext(snap),text=JSON.stringify(context);
 ok(Object.keys(context)[0]==='siteBrief'&&text.indexOf('"siteBrief"')<text.indexOf('"design"'),'The brief leads the context');
 ok(bytes(context)<=20000,`Context within 20 KB (${bytes(context)} bytes)`);
 eq(context.price,{subtotal:Math.round(snap.pricing.subtotal),quoteItems:snap.quotes.length},'Compact price summary: subtotal and quoted-line count');
 ok(!text.includes('priceBook')&&!text.includes('"sections"')&&!text.includes('customerName'),'No price book, price sections or customer details');
 ok(context.design.siteModel&&!context.siteDataOmitted,'The raw survey stays while it fits');
 eq(context.siteWarnings,snap.siteWarnings,'siteWarnings pass through');
 const many=structuredClone(snap) as typeof snap;(many.design.siteModel as {points:unknown[]}).points=Array.from({length:2000},(_,i)=>({id:`Q${i}`,xIn:i%50*12,zIn:Math.floor(i/50)*12,elevationIn:i/100}));
 const crowded=buildAssistantContext(many);
 ok(crowded.siteBrief&&!crowded.design.siteModel&&crowded.siteDataOmitted&&bytes(crowded)<=20000,'A large survey is dropped before the brief');

 // 10. Plan schema and compilation of the new commands.
 const choices=assistantPlanSchemaForContext(context).anyOf![0].properties!.commands.items!.anyOf!;
 const creates=choices.filter(c=>c.properties!.type.const==='yard.create');
 ok(creates.length===3&&creates.some(c=>c.properties!.kind.const==='fire-feature'&&JSON.stringify(c.properties!.productId.enum)===JSON.stringify(['fire-wood-ring','fire-gas-bowl','fire-gas-linear'])&&!c.properties!.wallPath),'yard.create offered per kind; fire products enumerated, no wall path');
 ok(choices.some(c=>c.properties!.type.const==='yard.update'&&c.properties!.id.const==='bowl'&&c.properties!.productId.enum)&&choices.some(c=>c.properties!.type.const==='yard.update'&&c.properties!.id.const==='landing'&&c.properties!.groundFit&&!c.properties!.supportFeatureId),'yard.update narrowed per current feature');
 const plan=(commands:unknown[])=>{const p=parseAssistantPlan({kind:'edit',message:'Add a gas fire bowl.',assumptions:[],commands});if(p.ok===false)throw Error(p.error);return p.plan;};
 const compiled=assistantPlanRequest(plan([{type:'yard.create',kind:'fire-feature',id:'table',productId:'fire-gas-linear',supportFeatureId:'landing',xFt:4,zFt:9.32}]),{id:'assistant-fire',expectedRevision:snap.revision,snapshot:snap});
 ok(compiled.commands.length===1&&compiled.commands[0].type==='yard.create','A yard.create plan compiles');
 const previewed=good(await f.api.preview(compiled));ok(previewed.snapshot.design.yardFeatures!.find(y=>y.id==='table')?.widthFt===4&&f.data.yardFeatures!.every(y=>y.id!=='table'),'…and previews through the controller (a 48 in table) without writing');
 const pair=assistantPlanRequest(plan([{type:'yard.create',kind:'patio',id:'firepad',xFt:9,zFt:9,widthFt:4,depthFt:3},{type:'yard.create',kind:'fire-feature',id:'bowl2',supportFeatureId:'firepad',xFt:9,zFt:9,widthFt:2.5}]),{id:'assistant-pair',expectedRevision:snap.revision,snapshot:snap});
 ok(pair.commands.length===2,'A fire bowl may stand on a patio created earlier in the same plan');
 assert.throws(()=>assistantPlanRequest(plan([{type:'yard.create',kind:'fire-feature',supportFeatureId:'nowhere',xFt:4,zFt:9}]),{id:'assistant-bad',expectedRevision:snap.revision,snapshot:snap}),/current patio/);checks++;
 assert.throws(()=>assistantPlanRequest(plan([{type:'yard.create',kind:'patio',id:'landing',xFt:4,zFt:9}]),{id:'assistant-dup',expectedRevision:snap.revision,snapshot:snap}),/unique id/);checks++;
 assert.throws(()=>assistantPlanRequest(plan([{type:'yard.create',kind:'fire-feature',wallPath:[{x:0,y:0},{x:24,y:0}],xFt:4,zFt:9}]),{id:'assistant-path',expectedRevision:snap.revision,snapshot:snap}),/visible yard command/);checks++;
 const gasTable=assistantPlanRequest(plan([{type:'yard.update',id:'bowl',productId:'fire-gas-linear'}]),{id:'assistant-table',expectedRevision:snap.revision,snapshot:snap});
 const tableRun=good(await f.api.execute(gasTable));ok(tableRun.snapshot.design.yardFeatures!.find(y=>y.id==='bowl')!.productId==='fire-gas-linear','"Make it a gas table" compiles to a product change and applies');
 const raised=parseAssistantPlan({kind:'edit',message:'Raise the bed.',assumptions:[],commands:[{type:'landscape.edit',id:'bed',edit:{action:'patch',patch:{raisedIn:18,edge:{kind:'steel'}}}}]});
 ok(raised.ok,'A raised-bed patch is a valid plan');
 ok(!parseAssistantPlan({kind:'edit',message:'x',assumptions:[],commands:[{type:'design.patch',patch:{yardFeatures:[]}}]}).ok,'design.patch still cannot replace yard features');
 ok(ASSISTANT_SYSTEM_PROMPT.includes('fire-gas-bowl')&&ASSISTANT_SYSTEM_PROMPT.includes('15 m')&&ASSISTANT_SYSTEM_PROMPT.includes('18-20')&&ASSISTANT_SYSTEM_PROMPT.includes('12-30')&&/never invent prices/.test(ASSISTANT_SYSTEM_PROMPT),'The prompt states the site rules');
}
// 11. Review S regressions: yard.create checked coverage only. Nothing stands on the deck or its stair (DEFAULT_DECK: the
// deck x 0–192, z 0–144 in; its stair x 72–120 from z 144.75 to 188); a fire on a patio stands wholly on it, one on its
// own pad clear of every patio; a seat wall on paving lies wholly on it and builds to the asked height.
{const f=host(flat),c0=f.commits;
 bad(await f.api.execute(req([{type:'yard.create',kind:'fire-feature',xFt:8,zFt:15}])),/Fire bowl would stand on the stair\. Place it clear of the house, the deck and its stairs/,'A fire bowl on the stair');
 bad(await f.api.execute(req([{type:'yard.create',kind:'patio',xFt:8,zFt:6,widthFt:8,depthFt:6}])),/would stand on the deck/,'A patio on the deck');
 bad(await f.api.execute(req([{type:'yard.create',kind:'retaining-wall',wallPath:[{x:-60,y:72},{x:60,y:72}]}])),/would stand on the deck/,'A wall through the deck');
 ok(f.commits===c0,'Nothing on the deck or stair is created');
 good(await f.api.execute(req([{type:'yard.create',kind:'patio',id:'foot',xFt:8,zFt:(187.5+24)/12,widthFt:6,depthFt:4}])));
 ok(!!yard(f.data,'foot'),'A landing patio may meet the stair foot (its last nosing laps it by half an inch)');
 good(await f.api.execute(req([{type:'yard.create',kind:'patio',id:'terrace',name:'Terrace',xFt:8,zFt:25,widthFt:16,depthFt:12}])));
 bad(await f.api.execute(req([{type:'yard.create',kind:'fire-feature',supportFeatureId:'terrace',xFt:8,zFt:19.5}])),/Place it wholly on Terrace: its 42 in body runs off the patio/,'A fire bowl whose centre is on the patio but body is not');
 bad(await f.api.execute(req([{type:'yard.create',kind:'fire-feature',xFt:8,zFt:30}])),/It overlaps Terrace: stand it on that patio \(supportFeatureId terrace\)/,'A fire bowl on its own pad over a patio');
 bad(await f.api.execute(req([{type:'yard.create',kind:'retaining-wall',freestanding:true,supportFeatureId:'terrace',wallPath:[{x:40,y:370},{x:150,y:370}]}])),/Keep the seat wall wholly inside Terrace: [\d.]+ sq ft of its 14 in cap would hang past/,'A seat wall on the patio straddling its edge');
 // The reviewer's repro: a path 0.1 in inside the patio's edge put the wall on the paving, half of it over the grass.
 bad(await f.api.execute(req([{type:'yard.create',kind:'retaining-wall',freestanding:true,wallPath:[{x:40,y:371.9},{x:150,y:371.9}]}])),/wholly inside Terrace/,'A seat wall without a support whose path lies just inside the edge');
 // …and one wholly on it builds to its asked 18 in as whole courses on the paving (21 in), not from the ground (27 in).
 good(await f.api.execute(req([{type:'yard.create',kind:'retaining-wall',id:'seat',freestanding:true,heightIn:18,wallPath:[{x:40,y:340},{x:150,y:340}]}])));
 const seat=yard(f.data,'seat')!,sm=model(f.data,'seat'),pm=model(f.data,'terrace');
 ok(seat.finishedElevationIn===undefined&&!sm.excluded&&Math.abs(sm.topIn-pm.topIn-21)<.05&&sm.warnings.some(w=>/^Freestanding seat wall on Terrace: it stands on the paving, 3 whole courses/.test(w)),`A seat wall on the paving without a support builds 21 in on it (${(sm.topIn-pm.topIn).toFixed(1)} in)`);
 good(await f.api.execute(req([{type:'yard.create',kind:'fire-feature',id:'fire',supportFeatureId:'terrace',xFt:8,zFt:25}])));
 bad(await f.api.execute(req([{type:'yard.update',id:'fire',zFt:19.9}])),/wholly on Terrace/,'Moving a fire on its patio partly off it');
 good(await f.api.execute(req([{type:'yard.update',id:'fire',unset:['supportFeatureId'],xFt:8,zFt:45}])));
 ok(yard(f.data,'fire')!.supportFeatureId===undefined,'Taken off its patio and clear of it, it stands on its own pad');
}
// Craighurst: the reviewer's 42 in bowl centred on the 66 × 38 in stone landing ran off it (onto a pad over the landing).
{const f=host(craighurst);
 bad(await f.api.execute(req([{type:'yard.create',kind:'fire-feature',supportFeatureId:'landing',xFt:4,zFt:9.32}])),/Place it wholly on Stone landing: its 42 in body runs off the patio/,'A 42 in bowl on the stone landing');
 good(await f.api.execute(req([{type:'yard.create',kind:'fire-feature',id:'small',supportFeatureId:'landing',xFt:4,zFt:9.32,widthFt:2.5}])));
 ok(!model(f.data,'small').boxes.some(b=>b.role==='fire-pad'),'A 30 in bowl stands wholly on it');
}

console.log(`Agent site commands: ${checks} checks passed (create/update patios, walls, seat walls and fire on a patio, raised beds, site brief and warnings in read(), brief-first context, plan compilation, one undo per request).`);
