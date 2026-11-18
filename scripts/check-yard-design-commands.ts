import assert from 'node:assert/strict';
import {createDeckAgentController,type DeckAgentHostState,type AgentCommand,type AgentResponse} from '../src/features/deckcraft/designer/deckAgentController';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {deckReleaseData,calculateDeckReleaseEstimate,serializeDeckReleaseDesign,parseDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import {emptyHistory,recordChange,undoChange,redoChange} from '../src/features/deckcraft/designer/designHistory';
import {HARDSCAPE_PRODUCTS,hardscapeBody,rectangularUnit,hardscapeSelection} from '../src/features/deckcraft/hardscapeCatalogue';
import {yardShapeWorldPoints,yardShapeWorldPoint,yardShapeRunIn} from '../src/features/deckcraft/yardShapeEditing';
import {decodeDesignLink,designLinkFromHash} from '../src/features/deckcraft/designLink';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';

let checks=0,counter=0;
const check=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};
const equal=(a:unknown,b:unknown,m:string)=>{assert.deepEqual(a,b,m);checks++;};
const near=(a:number,b:number,m:string)=>check(Math.abs(a-b)<1e-7,`${m}: ${a} vs ${b}`);
const request=(commands:AgentCommand[],expectedRevision?:number)=>({id:`drawing-command-${++counter}`,commands,...(expectedRevision===undefined?{}:{expectedRevision})});
const success=(r:AgentResponse)=>{if('error'in r)throw Error(`${r.error.code}: ${r.error.message}`);check(r.ok,'Command succeeded');return r;};

function fixture(initial:DeckData){
 let state:DeckAgentHostState={data:deckReleaseData(initial),view:'plan',openSections:[],canUndo:false,canRedo:false,ready:true},history=emptyHistory<DeckData>(),commits=0,rendered=false;
 const queued=new Set<{test:(s:DeckAgentHostState)=>boolean;done:()=>void}>();
 const schedule=(next:DeckAgentHostState)=>{rendered=false;setTimeout(()=>{state=next;rendered=true;for(const w of queued)if(w.test(state)){queued.delete(w);w.done();}},5);};
 const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{commits++;history=recordChange(history,state.data,`drawing:${commits}`,commits*1000);schedule({...state,data:next,canUndo:true,canRedo:false});},undo:()=>{const u=undoChange(history,state.data);assert.ok(u);history=u.history;schedule({...state,data:u.design,canUndo:history.past.length>0,canRedo:true});},redo:()=>{const r=redoChange(history,state.data);assert.ok(r);history=r.history;schedule({...state,data:r.design,canUndo:true,canRedo:history.future.length>0});},setView:view=>schedule({...state,view}),openSection:section=>schedule({...state,openSections:[...state.openSections,section]}),waitForRender:test=>test(state)?Promise.resolve():new Promise(resolve=>queued.add({test,done:resolve})),shareOrigin:'http://localhost:4320'});
 return {api,get state(){return state;},get commits(){return commits;},get history(){return history;},get rendered(){return rendered;}};
}

function selected(kind:'patio'|'retaining-wall'):YardFeature{
 const product=HARDSCAPE_PRODUCTS.find(p=>kind==='retaining-wall'?p.category==='wall'&&p.id.includes('raffinato'):p.category!=='wall'&&p.id.includes('blu60'))!;
 check(!!product,'Manufacturer fixture is available');
 const suitable=(u:(typeof product.finishes)[number]['units'][number])=>hardscapeBody(u.role)&&(kind==='patio'?rectangularUnit(u)&&u.heightMm===60:u.heightMm===90);
 const finish=product.finishes.find(f=>f.units.some(suitable))!,unit=finish.units.find(suitable)!,color=finish.colors.find(c=>!unit.colorIds||unit.colorIds.includes(c.id))!;
 const f:YardFeature={id:kind==='patio'?'command-patio':'command-wall',kind,name:kind==='patio'?'Command patio':'Command wall',enabled:true,xFt:kind==='patio'?30:65,zFt:kind==='patio'?30:55,widthFt:16,depthFt:kind==='patio'?12:unit.lengthMm/304.8,heightIn:kind==='patio'?0:30,rotationDeg:37,productId:product.id,color:color.hex??'#888888',hardscape:{finishId:finish.id,colorId:color.id,unitId:unit.id,patternId:'running-bond',angleDeg:0,jointMm:kind==='patio'?3:0}};
 if(kind==='retaining-wall'){f.baseElevationIn=-3;f.wallConstruction={geogridLengthIn:60,geogridEveryCourses:1};const cap=hardscapeSelection(f)!.caps[0];check(!!cap,'Fixture has an actual compatible cap');f.hardscape!.capUnitId=cap.id;}
 else f.inlays=[{id:'kept-accent',name:'Kept paving accent',shape:'rectangle',xIn:-36,yIn:-24,widthIn:24,depthIn:24,rotationDeg:0,productId:f.productId,color:f.color,hardscape:{...f.hardscape!}}];
 return f;
}
const patio=selected('patio'),wall=selected('retaining-wall');
const data=(features=[patio,wall]):DeckData=>({...structuredClone(DEFAULT_DECK),houseVisible:false,yardFeatures:structuredClone(features),yardEarthwork:{soilReusePct:0,spoilSwellPct:25,looseSpoilTonnesPerYd3:1.4,binPayloadTonnes:12,binVolumeYd3:14}});

async function main(){
 const g=fixture(data()),start=g.api.read(),stored=serializeDeckReleaseDesign(g.state.data),descriptor=g.api.describe();
 check(descriptor.commands.includes('yard.preset')&&descriptor.commands.includes('yard.curve'),'Descriptor advertises both independent drawing commands');
 check(descriptor.units.yard.includes('positive to directed chord left'),'Descriptor identifies the signed curve coordinate convention');
 const batch=request([{type:'yard.preset',id:patio.id,presetId:'l-shape'},{type:'yard.curve',id:wall.id,index:0,bulgeIn:24}],start.revision),dry=success(await g.api.preview(batch));
 check(dry.changed,'Drawing preview reports a changed layout');check(g.commits===0&&g.history.past.length===0&&serializeDeckReleaseDesign(g.state.data)===stored,'Drawing preview causes no writes, autosave source or history');
 const dryPatio=dry.snapshot.design.yardFeatures!.find(f=>f.id===patio.id)!,dryWall=dry.snapshot.design.yardFeatures!.find(f=>f.id===wall.id)!;
 check(dryPatio.outline?.length===6,'L starter is visible in the preview drawing');check((dryWall.wallPath?.length??0)>2,'Circular wall edge is visible in preview');
 equal(dryWall.hardscape,wall.hardscape,'Preview retains selected body stock, colour, pattern and manufacturer cap');equal(dryWall.baseElevationIn,wall.baseElevationIn,'Preview retains wall front elevation');equal(dryWall.wallConstruction,wall.wallConstruction,'Preview retains reinforcement inputs');equal(dryWall.depthFt,wall.depthFt,'Preview retains stock thickness');
 const oldInlay=patio.inlays![0],previewInlay=dryPatio.inlays![0],oldLocation=yardShapeWorldPoint(patio,{x:oldInlay.xIn,y:oldInlay.yIn}),previewLocation=yardShapeWorldPoint(dryPatio,{x:previewInlay.xIn,y:previewInlay.yIn});near(oldLocation.x,previewLocation.x,'Starter retains decorative inlay world across');near(oldLocation.y,previewLocation.y,'Starter retains decorative inlay world out');
 const beforeWall=yardShapeWorldPoints(wall),afterWall=yardShapeWorldPoints(dryWall);for(const [a,b]of [[beforeWall[0],afterWall[0]],[beforeWall.at(-1)!,afterWall.at(-1)!]]){near(a.x,b.x,'Curve retains endpoint across');near(a.y,b.y,'Curve retains endpoint out');}
 const beforeQuantities=start.wallConstruction.find(f=>f.featureId===wall.id)!,plannedQuantities=dry.snapshot.wallConstruction.find(f=>f.featureId===wall.id)!;
 check(!!plannedQuantities,'Changed wall remains included in model');check(plannedQuantities.quantities.wallLengthLf>beforeQuantities.quantities.wallLengthLf,'Computed wall run accounts for the bowed path');
 near(plannedQuantities.quantities.wallLengthLf,yardShapeRunIn(dryWall.wallPath!)/12,'Snapshot wall run matches measured drawing');
 check(plannedQuantities.quantities.geogridOrderSqft>0&&plannedQuantities.quantities.wallBaseYd3>0&&plannedQuantities.quantities.drainageYd3>0,'Preview exposes grid, aggregate and drainage quantities');
 check(plannedQuantities.capOptions.some(c=>c.id===wall.hardscape!.capUnitId),'Selected manufacturer cap remains available in computed snapshot');
 check(dry.snapshot.yardEarthwork.bankYd3!==start.yardEarthwork.bankYd3,'Changed patio/wall geometry updates shared excavation');
 const done=success(await g.api.execute(batch));check(g.rendered,'Execute acknowledges host rendering before returning');check(g.commits===1&&g.history.past.length===1,'Two drawing commands commit as one history step');
 equal(done.snapshot.design,dry.snapshot.design,'Preview and execution produce identical persisted design');equal(done.snapshot.wallConstruction,dry.snapshot.wallConstruction,'Preview and execution compute identical wall quantities');equal(done.snapshot.yardEarthwork,dry.snapshot.yardEarthwork,'Preview and execution compute identical shared soil/haul quantities');equal(done.snapshot.pricing,dry.snapshot.pricing,'Preview and execution compute identical priced scope');
 const repeated=success(await g.api.execute(batch));check(repeated.replayed&&g.commits===1,'Replayed drawing request cannot duplicate history');
 const conflicting=await g.api.execute({...batch,commands:[{type:'yard.preset',id:patio.id,presetId:'rounded'}]});check('error'in conflicting&&conflicting.error.code==='id_conflict','Conflicting drawing request ID is rejected');
 const stale=await g.api.execute(request([{type:'yard.preset',id:wall.id,presetId:'straight'}],start.revision));check('error'in stale&&stale.error.code==='stale_revision','Stale shape edits cannot replace a newer design');
 success(await g.api.execute(request([{type:'history.undo'}])));equal(serializeDeckReleaseDesign(g.state.data),stored,'One undo restores both original drawing geometries and quantities');
 success(await g.api.execute(request([{type:'history.redo'}])));equal(g.api.read().design,done.snapshot.design,'One redo restores the complete drawing batch');
 const saved=parseDeckReleaseDesign(serializeDeckReleaseDesign(g.state.data));equal(saved.yardFeatures,g.state.data.yardFeatures,'Accepted drawn outlines and paths survive save/load');equal(saved.yardEarthwork,g.state.data.yardEarthwork,'Shared hauling inputs survive save/load');
 const share=success(await g.api.execute(request([{type:'action',action:'share.create'}]))),shared=await decodeDesignLink(designLinkFromHash(new URL(share.result!.url).hash)!);equal(shared.yardFeatures,g.state.data.yardFeatures,'Drawn supplier selections survive share-link reopening');
 const estimate=calculateDeckReleaseEstimate(g.state.data);equal(g.api.read().yardEarthwork,estimate.yardTakeoff.earthwork,'Snapshot soil quantities reflect the current full model');

 const invalid:unknown[]=[
  {type:'yard.preset',id:'absent',presetId:'rectangle'},{type:'yard.curve',id:'absent',index:0,bulgeIn:12},
  {type:'yard.preset',id:wall.id,presetId:'rounded'},{type:'yard.preset',id:patio.id,presetId:'arc'},{type:'yard.preset',id:patio.id,presetId:'unsupported'},{type:'yard.preset',id:patio.id,presetId:true},{type:'yard.preset',id:9,presetId:'rectangle'},
  {type:'yard.curve',id:wall.id,index:-1,bulgeIn:12},{type:'yard.curve',id:wall.id,index:999,bulgeIn:12},{type:'yard.curve',id:wall.id,index:.5,bulgeIn:12},{type:'yard.curve',id:wall.id,index:'0',bulgeIn:12},
  {type:'yard.curve',id:wall.id,index:0,bulgeIn:'12'},{type:'yard.curve',id:wall.id,index:0,bulgeIn:null},{type:'yard.curve',id:wall.id,index:0,bulgeIn:NaN},{type:'yard.curve',id:wall.id,index:0,bulgeIn:Infinity},{type:'yard.curve',id:wall.id,index:0,bulgeIn:961},
  {type:'yard.preset',id:patio.id,presetId:'rectangle',unknown:true},{type:'yard.curve',id:wall.id,index:0,bulgeIn:12,unknown:true},{type:'yard.preset',id:patio.id},{type:'yard.curve',id:wall.id,index:0},
 ];
 for(const c of invalid){const before=serializeDeckReleaseDesign(g.state.data),commits=g.commits,history=JSON.stringify(g.history),revision=g.api.read().revision;
  check(!(await g.api.preview({id:`invalid-preview-${++counter}`,commands:[c]})).ok,'Invalid drawing preview is rejected');check(!(await g.api.execute({id:`invalid-execute-${++counter}`,commands:[c]})).ok,'Invalid drawing execution is rejected');
  check(serializeDeckReleaseDesign(g.state.data)===before&&g.commits===commits&&JSON.stringify(g.history)===history&&g.api.read().revision===revision,'Invalid request changes no design, quantities or history');
 }
 const getter={type:'yard.curve',id:wall.id,index:0};let accessorRead=false;Object.defineProperty(getter,'bulgeIn',{get(){accessorRead=true;return 12;},enumerable:true});check(!(await g.api.execute({id:'unsafe-drawing-accessor',commands:[getter]})).ok&&!accessorRead,'Unsafe drawing fields reject without invoking getters');
 const atomicBefore=serializeDeckReleaseDesign(g.state.data),atomicCommits=g.commits;
 check(!(await g.api.execute(request([{type:'yard.preset',id:patio.id,presetId:'rounded'},{type:'yard.curve',id:wall.id,index:999,bulgeIn:12}]))).ok,'Later invalid drawing command rejects complete batch');
 check(serializeDeckReleaseDesign(g.state.data)===atomicBefore&&g.commits===atomicCommits,'Rejected batch cannot partly apply the first valid starter');
 check(!(await g.api.execute(request([{type:'yard.preset',id:patio.id,presetId:'rectangle'},{type:'view.set',view:'3d'}]))).ok,'Drawing mutations cannot be mixed with navigation');
 check(serializeDeckReleaseDesign(g.state.data)===atomicBefore&&g.state.view==='plan','Mixed invalid transaction changes neither design nor view');

 const noOp=fixture(data()),noOpBefore=serializeDeckReleaseDesign(noOp.state.data),zero=success(await noOp.api.execute(request([{type:'yard.curve',id:wall.id,index:0,bulgeIn:0}])));
 check(!zero.changed&&noOp.commits===0&&noOp.history.past.length===0&&serializeDeckReleaseDesign(noOp.state.data)===noOpBefore,'Zero bulge is a true no-op with no undo step');
 const max=fixture(data([{...wall,widthFt:80}])),maxBefore=serializeDeckReleaseDesign(max.state.data);check(!(await max.api.execute(request([{type:'yard.curve',id:wall.id,index:0,bulgeIn:12}]))).ok&&serializeDeckReleaseDesign(max.state.data)===maxBefore,'Maximum-run wall cannot exceed geometric limit through command API');
 for(const presetId of ['straight','wall-l','arc'] as const){const test=fixture(data([wall])),result=success(await test.api.execute(request([{type:'yard.preset',id:wall.id,presetId}]))),f=result.snapshot.design.yardFeatures![0];near(f.widthFt,wall.widthFt,'Wall command starter retains measured run');equal(f.hardscape,wall.hardscape,'Wall command starter retains selected manufacturer cap');equal(f.baseElevationIn,wall.baseElevationIn,'Wall command starter retains elevation');equal(f.wallConstruction,wall.wallConstruction,'Wall command starter retains reinforcement');check(result.snapshot.wallConstruction.length===1,'Wall starter retains an included computed model');test.api.dispose();}
 g.api.dispose();noOp.api.dispose();max.api.dispose();
 console.log(JSON.stringify({checks,status:'passed'}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
