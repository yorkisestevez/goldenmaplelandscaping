import assert from 'node:assert/strict';
import {ASSISTANT_SYSTEM_PROMPT,assistantPlanRequest,assistantPlanSchemaForContext,buildAssistantContext,parseAssistantPlan,validateAssistantContext} from '../src/features/deckcraft/designer/assistantPlan';
import {createDeckAgentController,type DeckAgentHostState,type AgentSnapshot} from '../src/features/deckcraft/designer/deckAgentController';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {HARDSCAPE_PRODUCTS,hardscapeBody,hardscapeSelection,rectangularUnit} from '../src/features/deckcraft/hardscapeCatalogue';
import {yardShapeWorldPoints} from '../src/features/deckcraft/yardShapeEditing';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';

let checks=0;
const ok=(value:unknown,message:string)=>{assert.ok(value,message);checks++;};
const equal=(actual:unknown,expected:unknown,message:string)=>{assert.deepEqual(actual,expected,message);checks++;};
const rejects=(fn:()=>unknown,message:string)=>{assert.throws(fn,undefined,message);checks++;};
const edit=(commands:unknown[])=>({kind:'edit',message:'Propose a measured landscape edit for review.',assumptions:[],commands});
const plan=(commands:unknown[])=>{const parsed=parseAssistantPlan(edit(commands));if('error'in parsed)throw Error(parsed.error);return parsed.plan;};
const rejected=(commands:unknown[],message:string)=>ok(!parseAssistantPlan(edit(commands)).ok,message);

const product=HARDSCAPE_PRODUCTS.find(p=>p.category==='paver'&&p.finishes.some(f=>f.units.some(u=>hardscapeBody(u.role)&&rectangularUnit(u)&&u.heightMm===60)))!;
const finish=product.finishes.find(f=>f.units.some(u=>hardscapeBody(u.role)&&rectangularUnit(u)&&u.heightMm===60))!;
const unit=finish.units.find(u=>hardscapeBody(u.role)&&rectangularUnit(u)&&u.heightMm===60)!,colour=finish.colors.find(c=>!unit.colorIds||unit.colorIds.includes(c.id))!;
const patio:YardFeature={id:'courtyard',kind:'patio',name:'Lower Courtyard',enabled:true,xFt:26,zFt:32,widthFt:18,depthFt:12,heightIn:6,rotationDeg:31,productId:product.id,color:'#a1a1a1',hardscape:{finishId:finish.id,colorId:colour.id,unitId:unit.id,patternId:'running-bond',angleDeg:17,jointMm:3},outline:[{x:-84,y:-72},{x:84,y:-72},{x:108,y:-48},{x:108,y:48},{x:84,y:72},{x:-84,y:72},{x:-108,y:48},{x:-108,y:-48}]};
patio.inlays=[{id:'centre-diamond',name:'Centre diamond',shape:'diamond',xIn:0,yIn:0,widthIn:36,depthIn:36,rotationDeg:14,productId:product.id,color:'#555555',hardscape:{...patio.hardscape!,angleDeg:27}}];
const wallProduct=HARDSCAPE_PRODUCTS.find(p=>p.id==='techo-raffinato-wall')!,wallFinish=wallProduct.finishes.find(f=>f.units.some(u=>hardscapeBody(u.role)))!;
const wallUnit=wallFinish.units.find(u=>hardscapeBody(u.role))!,wallColour=wallFinish.colors.find(c=>!wallUnit.colorIds||wallUnit.colorIds.includes(c.id))!;
const wall:YardFeature={id:'terrace-wall',kind:'retaining-wall',name:'Upper Terrace Wall',enabled:true,xFt:29,zFt:55,widthFt:10+Math.hypot(72,48)/12,depthFt:wallUnit.lengthMm/304.8,heightIn:30,baseElevationIn:-3,rotationDeg:19,productId:wallProduct.id,color:'#999999',wallPath:[{x:-96,y:-24},{x:24,y:-24},{x:96,y:24}],wallConstruction:{geogridLengthIn:96,geogridEveryCourses:1},hardscape:{finishId:wallFinish.id,colorId:wallColour.id,unitId:wallUnit.id,patternId:'running-bond',angleDeg:0,jointMm:0}};
wall.hardscape!.capUnitId=hardscapeSelection(wall)!.caps[0].id;
const primitive={...patio,id:'simple-patio',name:'Side Patio',xFt:55,outline:undefined,inlays:undefined};
const soil={soilReusePct:25,spoilSwellPct:30,looseSpoilTonnesPerYd3:.9,binPayloadTonnes:8,binVolumeYd3:14};
function fixture(){let state:DeckAgentHostState={data:deckReleaseData({...structuredClone(DEFAULT_DECK),houseVisible:false,customerName:'PRIVATE-YARD-CLIENT',projectAddress:'PRIVATE-YARD-ADDRESS',materialMarkup:38,customLaborCost:876543,yardFeatures:[patio,wall,primitive],yardEarthwork:soil,terrainConfig:{widthFt:250,depthFt:250,elevationIn:2,slopePct:1}}),ready:true,view:'plan',openSections:[],canUndo:false,canRedo:false},commits=0;
 const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{state={...state,data:next};commits++;},undo:()=>{},redo:()=>{},setView:()=>{},openSection:()=>{},waitForRender:test=>{if(!test(state))throw Error('Synchronous test host did not acknowledge design.');return Promise.resolve();}});
 return {api,get state(){return state;},get commits(){return commits;}};
}
async function main(){
 const f=fixture(),snapshot=f.api.read(),context=buildAssistantContext(snapshot),source=JSON.stringify(f.state.data);
 const current=(snapshot.design.yardFeatures??[]),visible=context.design.yardFeatures as unknown as YardFeature[];
 equal(visible,JSON.parse(JSON.stringify(current)),'Public context preserves every named feature, full custom vertices and supplier choices');
 equal(context.yardBoundaries,snapshot.yardBoundaries,'Context uses the actual measured world vertices for custom and primitive shapes');
 equal(context.design.yardEarthwork,soil,'Soil reuse, swell, density and hauling limits stay available to the assistant');
 const contextWall=visible.find(x=>x.id===wall.id)!;
 equal(contextWall.depthFt,wallUnit.lengthMm/304.8,'Supplier wall thickness is the actual stock dimension');
 equal(contextWall.hardscape,wall.hardscape,'Independent selected cap and exact supplier IDs remain visible');
 equal(contextWall.wallConstruction,wall.wallConstruction,'Reinforcement profile remains visible');
 equal(visible.find(x=>x.id===patio.id)!.inlays,patio.inlays,'Paving inlay layout and its supplier settings are retained');
 ok(new TextEncoder().encode(JSON.stringify(context)).length<=20000,'Yard context meets the actual 20KB budget');
 const text=JSON.stringify(context);for(const token of ['PRIVATE-YARD','materialMarkup','customLaborCost','priceBook','876543','quoteResolutions'])ok(!text.includes(token),`Public yard context excludes ${token}`);
 const leaked=structuredClone(snapshot) as any;leaked.design.yardFeatures[0].privateSupplierQuote={customerName:'PRIVATE-FEATURE-QUOTE',price:919191};leaked.design.yardFeatures[0].hardscape.internalPrice=717171;leaked.design.yardEarthwork.privateContract='PRIVATE-SOIL-CONTRACT';let getters=0;Object.defineProperty(leaked.design.yardFeatures[0],'secretAccessor',{enumerable:true,get(){getters++;return 'PRIVATE-GETTER';}});
 const clean=JSON.stringify(buildAssistantContext(leaked));for(const token of ['PRIVATE-FEATURE','919191','717171','internalPrice','PRIVATE-SOIL','secretAccessor'])ok(!clean.includes(token),`Nested feature metadata excludes ${token}`);equal(getters,0,'Unknown feature accessors are never evaluated');
 const accessor=structuredClone(snapshot);Object.defineProperty(accessor.design.yardFeatures![0],'outline',{enumerable:true,get(){getters++;return patio.outline;}});rejects(()=>buildAssistantContext(accessor),'A public field accessor is rejected');equal(getters,0,'Rejected public accessor is never executed');
 const choices=assistantPlanSchemaForContext(context).anyOf![0].properties!.commands.items!.anyOf!;
 const yardChoices=choices.filter(s=>String(s.properties!.type.const).startsWith('yard.'));
 ok(yardChoices.length>0,'The assistant now sees usable yard commands');
 ok(yardChoices.every(s=>visible.some(f=>f.id===s.properties!.id.const)),'Every generated yard target is a current visible exact ID');
 for(const feature of visible){const preset=yardChoices.find(s=>s.properties!.type.const==='yard.preset'&&s.properties!.id.const===feature.id)!;equal(preset.properties!.presetId.enum,feature.kind==='patio'?['rectangle','chamfered','l-shape','rounded']:['straight','wall-l','arc'],'Preset choices match the exact feature kind');const curve=yardChoices.find(s=>s.properties!.type.const==='yard.curve'&&s.properties!.id.const===feature.id)!;const boundary=context.yardBoundaries!.find(b=>b.id===feature.id)!;equal(curve.properties!.index.enum,boundary.points.map((_,i)=>i).slice(0,feature.kind==='patio'?boundary.points.length:boundary.points.length-1),'Curve addresses only actual segments, including patio closure but no phantom wall closure');}
 const designGrammar=choices.find(s=>s.properties!.type.const==='design.patch')!;ok(!designGrammar.properties!.patch.properties!.yardFeatures,'Generated plans cannot reconstruct and replace the whole yard feature array');
 const compile=(commands:unknown[],currentSnapshot:AgentSnapshot=snapshot,requestText?:string)=>assistantPlanRequest(plan(commands),{id:'yard-assistant-check',expectedRevision:currentSnapshot.revision,snapshot:currentSnapshot,requestText});
 rejects(()=>assistantPlanRequest(plan([{type:'yard.preset',id:wall.id,presetId:'arc'}]),{id:'no-context',expectedRevision:0}),'Shape presets require a current snapshot');
 rejects(()=>compile([{type:'yard.curve',id:'invented-wall',index:0,bulgeIn:12}]),'Nonexistent yard IDs cannot compile');
 rejects(()=>compile([{type:'yard.preset',id:wall.id,presetId:'rounded'}]),'Wall cannot receive a patio preset');
 rejects(()=>compile([{type:'yard.preset',id:patio.id,presetId:'arc'}]),'Patio cannot receive an open wall preset');
 rejects(()=>compile([{type:'yard.curve',id:wall.id,index:2,bulgeIn:12}]),'Wall has no last closing segment');
 rejects(()=>compile([{type:'yard.dimension',id:wall.id,index:2,lengthIn:120}]),'Existing dimension commands use the same real segment inventory');
 rejects(()=>compile([{type:'yard.move',id:wall.id,target:'point',index:99,dxIn:1,dyIn:0}]),'Existing point commands cannot invent indexes');
 rejects(()=>compile([{type:'yard.elevation',id:wall.id,field:'heightIn',valueIn:80}]),'Wall exposed heights remain within the supported range');
 rejects(()=>compile([{type:'yard.elevation',id:patio.id,field:'baseElevationIn',valueIn:2}]),'Patio surface elevation does not misuse a wall base datum');
 rejects(()=>compile([{type:'yard.preset',id:wall.id,presetId:'arc'}],snapshot,'Make this wall curved.'),'Missing current yard selection requires a named target clarification');
 rejects(()=>compile([{type:'yard.preset',id:patio.id,presetId:'rounded'}],snapshot,'Round the patio.'),'Multiple patios without an exact named target require clarification');
 ok(compile([{type:'yard.preset',id:wall.id,presetId:'arc'}],snapshot,'Make Upper Terrace Wall an arc.').commands.length===1,'An exact named target resolves the request');
 rejected([{type:'yard.move',id:wall.id,target:'edge',dxIn:0,dyIn:12}],'Point/edge movements require a measured index');
 rejected([{type:'yard.curve',id:wall.id,index:0,bulgeIn:Infinity}],'Curve magnitude must be finite');
 rejected([{type:'yard.curve',id:wall.id,index:0,bulgeIn:961}],'Curve magnitude remains bounded');
 rejected([{type:'yard.curve',id:wall.id,index:0,bulgeIn:12,execute:'unsafe'}],'New commands reject unknown fields');
 rejected([{type:'yard.preset',id:wall.id,presetId:'arc'},{type:'yard.curve',id:wall.id,index:0,bulgeIn:12}],'Shape replacement cannot silently shift later curve indexes');
 rejected([{type:'yard.curve',id:wall.id,index:0,bulgeIn:12},{type:'yard.curve',id:wall.id,index:1,bulgeIn:-12}],'Two same-wall curves cannot drift segment indexes in one batch');
 rejected([{type:'design.patch',patch:{yardFeatures:[wall]}}],'The static parser cannot replace a shortened yard feature array');
 rejected([{type:'design.patch',patch:{width:18},unset:['yardFeatures']}],'An assistant unset cannot discard every yard feature');
 rejected([{type:'design.patch',patch:{yardFeatures:[wall]}},{type:'yard.curve',id:wall.id,index:0,bulgeIn:12}],'Array replacement cannot invalidate targeted geometry addresses');
 for(const bulgeIn of [0,12,-12])ok(compile([{type:'yard.curve',id:primitive.id,index:0,bulgeIn}]).commands.length===1,'Primitive world vertices permit a measured signed curve, including zero');
 const huge=structuredClone(snapshot);huge.design.yardFeatures=Array.from({length:20},(_,i)=>({...structuredClone(patio),id:`large-${i}`,name:`Measured courtyard ${i}`,xFt:20+i,outline:Array.from({length:64},(_,k)=>({x:108*Math.cos(2*k*Math.PI/64),y:72*Math.sin(2*k*Math.PI/64)}))}));huge.yardBoundaries=huge.design.yardFeatures.map(feature=>({id:feature.id,kind:feature.kind,enabled:feature.enabled,points:yardShapeWorldPoints(feature),coordinateSpace:'world-inches'}));
 const bounded=buildAssistantContext(huge),kept=bounded.design.yardFeatures as unknown as YardFeature[];
 ok(bounded.truncated&&bounded.yardOmittedIds!.length>0,'Oversized yard context explicitly names omitted feature targets');
 ok(new TextEncoder().encode(JSON.stringify(bounded)).length<=20000,'Full 20-feature/64-vertex context remains bounded');
 ok(kept.length>0,'The context retains usable complete measured yard targets');
 equal(kept.map(x=>x.id),bounded.yardBoundaries!.map(x=>x.id),'Truncation keeps configuration and geometry targets synchronized');
 equal([...kept.map(x=>x.id),...bounded.yardOmittedIds!],huge.design.yardFeatures.map(x=>x.id),'Every omitted target is disclosed without inventing or silently merging features');
 for(const feature of kept){equal(feature,huge.design.yardFeatures.find(x=>x.id===feature.id),'Retained feature metadata and all 64 vertices stay exact');equal(bounded.yardBoundaries!.find(x=>x.id===feature.id),huge.yardBoundaries.find(x=>x.id===feature.id),'World geometry is never simplified to fit context');}
 rejects(()=>compile([{type:'yard.preset',id:bounded.yardOmittedIds![0],presetId:'rounded'}],huge),'An omitted feature ID cannot compile against the current bounded context');
 const inconsistent=structuredClone(bounded);inconsistent.yardBoundaries!.push(huge.yardBoundaries.find(x=>x.id===bounded.yardOmittedIds![0])!);rejects(()=>validateAssistantContext(inconsistent),'An omitted target cannot retain a contradictory visible boundary');
 const disclosure=structuredClone(bounded);disclosure.truncated=false;rejects(()=>validateAssistantContext(disclosure),'Feature omission cannot hide its truncation disclosure');
 const beforeStock=hardscapeSelection(wall)!;
 for(const command of [{type:'yard.preset',id:wall.id,presetId:'arc'},{type:'yard.curve',id:wall.id,index:0,bulgeIn:6},{type:'yard.preset',id:patio.id,presetId:'rounded'}]){
  const preview=await f.api.preview(compile([command]));ok(preview.ok,`Real controller previews ${command.type}`);if('error'in preview)throw Error(preview.error.message);
  const old=current.find(x=>x.id===command.id)!,changed=preview.snapshot.design.yardFeatures!.find(x=>x.id===command.id)!;
  for(const key of ['id','name','enabled','xFt','zFt','rotationDeg','heightIn','baseElevationIn','depthFt','productId','color','hardscape','wallConstruction','inlays'] as const)equal(changed[key],old[key],`Shape-only edit preserves ${key}`);
  equal(preview.snapshot.design.yardEarthwork,soil,'Geometry changes keep all soil and hauling inputs');
  if(changed.kind==='retaining-wall'){const stock=hardscapeSelection(changed)!;equal(stock.unit,beforeStock.unit,'Supplier stock dimensions remain unchanged after shape edit');equal(stock.cap,beforeStock.cap,'Exact compatible cap choice remains unchanged after shape edit');}
 }
 equal(f.commits,0,'Assistant compile and preview do not commit or publish any changes');equal(JSON.stringify(f.state.data),source,'All tests preserve the actual host design');
 ok(ASSISTANT_SYSTEM_PROMPT.includes('positive to the LEFT')&&ASSISTANT_SYSTEM_PROMPT.includes('ask which named patio/wall'),'Prompt states curve sign convention and missing target clarification');
 f.api.dispose();console.log(`PASS ${checks} landscape assistant checks: measured yard context, strict target grammar, privacy, complete-feature truncation and supplier-preserving previews.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
