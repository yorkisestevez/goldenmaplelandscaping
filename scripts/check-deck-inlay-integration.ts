import '../src/features/deckcraft/lib/inlayGeometryRuntime';
import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData,serializeDeckReleaseDesign,parseDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import {createDeckAgentController,type DeckAgentHostState,type AgentResponse,type AgentCommand} from '../src/features/deckcraft/designer/deckAgentController';
import {parseAssistantPlan,assistantPlanRequest,buildAssistantContext,assistantPlanSchemaForContext} from '../src/features/deckcraft/designer/assistantPlan';
import {createInlayPreset,INLAY_PRESETS} from '../src/features/deckcraft/lib/inlayPresets';
import {boardFinishPlan} from '../src/features/deckcraft/boardFinishes';
import {quoteScopeReview} from '../src/features/deckcraft/designer/quoteReviewModel';
import {confirmQuoteScope} from '../src/features/deckcraft/quoteResolutionValidation';
import type {DeckData} from '../src/features/deckcraft/types';

let checks=0;
const check=(v:unknown,message:string)=>{assert.ok(v,message);checks++;};
const ok=(r:AgentResponse)=>{if('error'in r)throw Error(r.error.message);checks++;return r;};
const base=deckReleaseData({...structuredClone(DEFAULT_DECK),width:24,length:20,stairFlights:0,pictureFrameRows:1});
let state:DeckAgentHostState={data:base,view:'plan',openSections:[],ready:true,canUndo:false,canRedo:false},commits=0;
const past:DeckData[]=[],future:DeckData[]=[];
const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{past.push(state.data);future.length=0;state={...state,data:next,canUndo:true,canRedo:false};commits++;},undo:()=>{future.push(state.data);state={...state,data:past.pop()!,canUndo:past.length>0,canRedo:true};},redo:()=>{past.push(state.data);state={...state,data:future.pop()!,canUndo:true,canRedo:future.length>0};},setView:view=>{state={...state,view};},openSection:section=>{state={...state,openSections:[section]};},waitForRender:async predicate=>{check(predicate(state),'Host acknowledges the applied current state');}});
let counter=0;
const request=(commands:AgentCommand[])=>({id:`inlay-integration-${++counter}`,expectedRevision:api.read().revision,commands});
const original=serializeDeckReleaseDesign(base);
check(api.describe().catalogue.inlayPresets.length===12,'All twelve presets are discoverable by an agent');
const add=request([{type:'inlay.preset',id:'rose-one',presetId:'compass-rose',level:1,point:{x:96,y:96}}]);
const preview=ok(await api.preview(add));
check(commits===0&&serializeDeckReleaseDesign(state.data)===original&&past.length===0,'Preset preview never saves or changes history');
check(preview.snapshot.inlayShapes[0].status==='ok','Preview plans actual rose geometry');
check(preview.snapshot.quotes.includes('Medallion inlay labour (builder quote)'),'Decorative labour remains outstanding in preview');
const applied=ok(await api.execute(add));
check(commits===1&&past.length===1,'One preset placement is one design commit');
check(applied.snapshot.design.inlays?.[0].kind==='medallion','Compass rose is a real medallion configuration');
check(applied.snapshot.inlayShapes[0].coordinateSpace==='level-local-inches','Agent geometry names its coordinate system');
const replay=ok(await api.execute(add));
check(replay.replayed&&commits===1,'A replay cannot duplicate an inlay');
const stored=serializeDeckReleaseDesign(state.data);
for(const command of [
 {type:'inlay.move',id:'rose-one',dxIn:900,dyIn:0},
 {type:'inlay.rotate',id:'rose-one',rotationDeg:361},
 {type:'inlay.preset',id:'rose-one',presetId:'compass',level:1,point:{x:220,y:140}},
 {type:'inlay.preset',id:'bad-level',presetId:'hexagon',level:3,point:{x:96,y:96}},
 {type:'inlay.preset',id:'bad-shape',presetId:'invented',level:1,point:{x:96,y:96}},
 {type:'inlay.place',inlay:{kind:'custom',id:'empty',points:[]},level:1,point:{x:220,y:160}},
 {type:'inlay.remove',id:'missing'},
] as AgentCommand[]){const result=await api.execute(request([command]));check(!result.ok,'Invalid placement, target or rotation is rejected');check(serializeDeckReleaseDesign(state.data)===stored&&commits===1,'Rejected edit preserves geometry, price basis and history');}
let accessed=false;
const poison={id:'unsafe',kind:'custom',points:[{x:-24,y:-24},{x:24,y:-24},{x:24,y:24},{x:-24,y:24}]};
Object.defineProperty(poison,'name',{enumerable:true,get(){accessed=true;return 'unsafe';}});
const malicious=await api.execute({id:'poison',commands:[{type:'inlay.place',inlay:poison,level:1,point:{x:240,y:156}}]});
check(!malicious.ok&&!accessed,'The agent API never invokes supplied getters');
const custom=createInlayPreset('hexagon','custom-one');
ok(await api.execute(request([{type:'inlay.place',inlay:custom,level:1,point:{x:240,y:156}}])));
check(state.data.inlays?.length===2,'Custom preset preserves the existing rose');
const beforeMove=state.data;
ok(await api.execute(request([{type:'inlay.move',id:'custom-one',dxIn:-12,dyIn:0},{type:'inlay.rotate',id:'custom-one',rotationDeg:30}])));
check(commits===3&&state.data.inlays?.[1].kind==='custom'&&state.data.inlays[1].rotationDeg===30,'Move and rotation share one atomic batch');
ok(await api.execute(request([{type:'history.undo'}])));
check(serializeDeckReleaseDesign(state.data)===serializeDeckReleaseDesign(beforeMove),'Undo restores exact local points, position and rotation');
ok(await api.execute(request([{type:'history.redo'}])));
const estimate=calculateDeckReleaseEstimate(state.data),finish=boardFinishPlan(state.data,estimate.model);
check(finish.inlayPieces>0&&finish.stock.some(s=>s.kind==='inlay'),'Inlay boards use the actual separate stock calculation');
check(estimate.model.levels[0].blocking.some(b=>b.role==='inlay-solid'),'Complex shapes include modelled solid support quantities');
const labour=estimate.sections.find(s=>s.title==='Labour (Construction & Build)')!;
check(labour.items.some(i=>i.name==='Custom inlay fabrication labour'&&i.cost===null),'Custom fabrication is a null-cost quote row, never fake free labour');
check(labour.items.some(i=>i.name==='Medallion inlay labour'&&i.cost===null),'Medallion labour keeps the legacy scope');
check(estimate.subtotal>0&&Math.abs(estimate.total-estimate.subtotal-estimate.hst)<1e-6,'Pricing arithmetic balances with pending scopes');
const scope=quoteScopeReview(state.data,estimate).scopes.find(s=>s.name==='Custom inlay fabrication labour')!;
check(!!scope&&scope.rows.length===1,'Custom fabrication has one resolvable quote scope');
const record=confirmQuoteScope(scope,{supplyCost:0,installationCost:250,confirmedOn:'2026-09-27',source:'Local regression fixture',note:'Decorative fitting only, excludes priced deck and blocking.'});
const quoted={...state.data,quoteResolutions:[record]},confirmed=calculateDeckReleaseEstimate(quoted);
check(Math.abs(confirmed.subtotal-estimate.subtotal-250)<1e-6,'Confirmed installation adds once with no material markup');
check(!confirmed.quoteRequired.includes('Custom inlay fabrication labour (builder quote)'),'Only the explicitly confirmed scope clears');
const moved={...quoted,inlays:quoted.inlays!.map(i=>i.id==='custom-one'&&i.kind!=='band'?{...i,dxFt:(i.dxFt??0)-.5}:i)};
const changed=calculateDeckReleaseEstimate(moved),without=calculateDeckReleaseEstimate({...moved,quoteResolutions:undefined});
check(Math.abs(changed.total-without.total)<1e-6,'Repositioning invalidates an old quote fingerprint');
const loaded=parseDeckReleaseDesign(serializeDeckReleaseDesign(state.data));
check(JSON.stringify(loaded.inlays)===JSON.stringify(state.data.inlays),'Saved/shareable designs retain custom geometry, orientation and colour');
const context=buildAssistantContext(api.read());
check(Array.isArray(context.design.inlays)&&context.design.inlays.length===2,'Natural-language context includes current inlay targets');
const schema=assistantPlanSchemaForContext(context);
check(JSON.stringify(schema).includes('rose-one'),'Model schema restricts existing inlay edits to supplied IDs');
const plan=parseAssistantPlan({kind:'edit',message:'Move the hexagon one inch left.',assumptions:[],commands:[{type:'inlay.move',id:'custom-one',dxIn:-1,dyIn:0}]});
check(plan.ok&&plan.plan.kind==='edit','Natural-language plans accept the shared measured inlay command');
if(plan.ok){const compiled=assistantPlanRequest(plan.plan,{id:'inlay-natural',expectedRevision:api.read().revision,snapshot:api.read()});const result=ok(await api.preview(compiled));check(result.snapshot.design.inlays?.length===2,'Assistant preview preserves unrelated inlays');}
const beforeDelete=state.data;
ok(await api.execute(request([{type:'inlay.remove',id:'custom-one'}])));
check(state.data.inlays?.length===1&&state.data.inlays[0].id==='rose-one','Deletion removes only the selected inlay');
ok(await api.execute(request([{type:'history.undo'}])));
check(serializeDeckReleaseDesign(state.data)===serializeDeckReleaseDesign(beforeDelete),'Deletion is fully undoable');
for(const preset of INLAY_PRESETS){const inlay=createInlayPreset(preset.id,`test-${preset.id}`),e=calculateDeckReleaseEstimate({...base,inlays:[inlay]});check(e.model.levels[0].inlays?.[0].status==='ok',`${preset.id} fits a sufficiently large deck`);check(Number.isFinite(e.total),`${preset.id} has finite quantities and accounting`);}
api.dispose();
console.log(`DECK INLAY INTEGRATION OK — ${checks} placement, atomic agent/history, persistence, stock, support and honest fabrication pricing checks.`);
