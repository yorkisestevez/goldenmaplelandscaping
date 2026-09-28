import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {deckReleaseData,calculateDeckReleaseEstimate} from '../src/features/deckcraft/deckRelease';
import {createDeckAgentController,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';
import {encodeDesignLink,decodeDesignLink,designLinkFromHash} from '../src/features/deckcraft/designLink';

let checks=0;const ok=(condition:unknown,message:string)=>{assert(condition,message);checks++;};
const data=deckReleaseData({...structuredClone(DEFAULT_DECK),customerName:'Private local owner',projectAddress:'Local address',materialMarkup:.17});
let state:DeckAgentHostState={data,view:'plan',openSections:[],canUndo:false,canRedo:false,ready:true},commits=0,id=0;
const controller=createDeckAgentController({getState:()=>state,commitDesign:next=>{commits++;state={...state,data:next,canUndo:true,canRedo:false};},undo:()=>{},redo:()=>{},setView:view=>{state={...state,view};},openSection:section=>{state={...state,openSections:[section]};},waitForRender:predicate=>{assert(predicate(state));return Promise.resolve();}});
const request=(command:unknown)=>({id:`easy-batch-${++id}`,expectedRevision:controller.read().revision,commands:[command]});
const original=controller.read(),targets=original.boards.filter(b=>b.role==='field'&&b.modelLevel===0).slice(3,5);
ok(targets.length===2,'Two distinct actual original field boards available');
ok(controller.describe().commands.includes('layout.boards'),'Agent discovery includes frozen-target batch');
const command={type:'layout.boards',targets:targets.map(b=>({modelLevel:b.modelLevel,index:b.index})),angleDeg:37,idPrefix:'contractor-batch'};
const preview=await controller.preview(request(command));ok(preview.ok,'Actual multiple-board rotation previews');
ok(commits===0&&JSON.stringify(controller.read().design)===JSON.stringify(original.design),'Preview writes no design/history');
const result=await controller.execute(request(command));ok(result.ok,'Batch applies with exact same original inventory targets');
ok(commits===1,'Two stock edits commit once');
const pieces=state.data.boardLayout?.pieces??[];ok(pieces.length===2,'Both intended pieces are saved');
for(const [i,target] of targets.entries()){
 const piece=pieces[i];ok(piece.angleDeg===37&&piece.level===target.level,'Rotation and logical platform level are correct');
 ok(Math.abs(piece.cx-target.cx)<1e-7&&Math.abs(piece.cy-target.cy)<1e-7,'Second target center did not shift after first target edit');
 ok(piece.polygon!==undefined&&piece.polygon.length>=3,'Original cut silhouette is preserved');
}
ok(state.data.customerName===data.customerName&&state.data.projectAddress===data.projectAddress&&state.data.materialMarkup===.17,'Private job fields and rates preserved');
if(preview.ok&&result.ok){ok(preview.snapshot.pricing.total===result.snapshot.pricing.total,'Preview and applied totals agree exactly');ok(JSON.stringify(preview.snapshot.quotes)===JSON.stringify(result.snapshot.quotes),'Outstanding quotes agree exactly');}
const after=JSON.stringify(state.data),priorCommits=commits;
for(const bad of [
 {...command,targets:[]}, {...command,targets:[{modelLevel:0,index:999999}]}, {...command,targets:[{modelLevel:.5,index:1}]},
 {...command,targets:targets.map(b=>({modelLevel:b.modelLevel,index:b.index,hidden:'unknown'}))},
 {...command,angleDeg:361}, {...command,colour:{color:'red'}}, {...command,idPrefix:'bad space'},
 {...command,targets:Array.from({length:65},()=>({modelLevel:0,index:0}))}
]){ok(!(await controller.execute(request(bad))).ok,'Unsafe batch rejected');ok(commits===priorCommits&&JSON.stringify(state.data)===after,'Rejected batch has no partial mutation');}
const stale=await controller.execute({id:'easy-stale',expectedRevision:original.revision,commands:[command]});ok('error' in stale&&stale.error.code==='stale_revision','Old selection revision rejects');
const openings=controller.read().parts.filter(p=>p.kind==='opening').slice(0,2);
ok(openings.length===2,'Two actual openings available for batch');
const partCommand={type:'component.batch',ids:openings.map(p=>p.id),edit:{action:'update',fields:{widthIn:48}}};
const partPreview=await controller.preview(request(partCommand));ok(partPreview.ok,'Component batch previews');
const beforeParts=commits,partApply=await controller.execute(request(partCommand));ok(partApply.ok&&commits===beforeParts+1,'Component batch commits once');
ok(openings.every(p=>state.data.houseConfig?.openings.find(o=>`opening:${o.id}`===p.id)?.widthIn===48),'Both real measured openings updated');
if(partPreview.ok&&partApply.ok)ok(partPreview.snapshot.pricing.total===partApply.snapshot.pricing.total,'Component batch actual price agrees exactly');
const beforeInvalid=JSON.stringify(state.data);
ok(!(await controller.execute(request({...partCommand,edit:{action:'update',fields:{customerName:'Leak'}}}))).ok,'Batch rejects private fields');
ok(!(await controller.execute(request({...partCommand,ids:[openings[0].id,'deck:1']}))).ok,'Mixed unsupported kinds rejected');
ok(JSON.stringify(state.data)===beforeInvalid,'Bad part batch leaves full design unchanged');
const share=await encodeDesignLink(state.data,'http://localhost:4187'),roundtrip=await decodeDesignLink(designLinkFromHash(new URL(share).hash)!);
ok(JSON.stringify(roundtrip.boardLayout)===JSON.stringify(state.data.boardLayout),'Real batch geometry survives share');
ok(roundtrip.customerName===''&&roundtrip.projectAddress==='','Share strips customer data');
ok(calculateDeckReleaseEstimate(roundtrip).model.quantities.area===calculateDeckReleaseEstimate(state.data).model.quantities.area,'Public shared batch retains actual deck area');
controller.dispose();console.log(`EASY EDIT AGENT OK: ${checks} frozen-target, atomic, price, private-data, invalid-input and sharing checks.`);
