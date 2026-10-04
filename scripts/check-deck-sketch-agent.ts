import assert from 'node:assert/strict';
import {createDeckAgentController,type DeckAgentHostState,type AgentResponse} from '../src/features/deckcraft/designer/deckAgentController';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {deckReleaseData,serializeDeckReleaseDesign,parseDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import {emptyHistory,recordChange,undoChange} from '../src/features/deckcraft/designer/designHistory';
import type {DeckData} from '../src/features/deckcraft/types';
import type {SketchDocument} from '../src/features/deckcraft/sketch/sketchTypes';

let checks=0;
const check=(condition:unknown,message:string)=>{assert.ok(condition,message);checks++;};
const success=(r:AgentResponse)=>{if('error' in r)throw new Error(`${r.error.code}: ${r.error.message}`);return r;};
const rectangle=(x:number,y:number,w:number,h:number)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const document:SketchDocument={version:1,shapes:[
  {id:'house',kind:'house',label:'Existing house',points:rectangle(100,100,360,200)},
  {id:'deck',kind:'deck',label:'New deck',points:rectangle(100,300,240,144),widthFt:20,depthFt:12,heightIn:30},
]};
const initial=deckReleaseData({...structuredClone(DEFAULT_DECK),customerName:'Private local name',projectAddress:'Private address',materialMarkup:19.75,underDeck:{drainage:'none',ceiling:'pvc',scope:'main',gravel:true,gravelDepthIn:4,floorMesh:true},boardLayout:{regions:[{id:'old-region',level:1,angleDeg:33,polygon:rectangle(0,0,100,100)}],pieces:[],breakers:[]}});
let state:DeckAgentHostState={data:initial,view:'plan',openSections:[],canUndo:false,canRedo:false,ready:true},history=emptyHistory<DeckData>(),commits=0;
const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{history=recordChange(history,state.data,`replace:${++commits}`,commits);state={...state,data:next,canUndo:true,canRedo:false};},undo:()=>{const next=undoChange(history,state.data);assert.ok(next);history=next.history;state={...state,data:next.design,canUndo:history.past.length>0,canRedo:true};},redo:()=>{},setView:()=>{},openSection:()=>{},waitForRender:async test=>{assert.ok(test(state),'Host must acknowledge actual applied geometry');}});
const before=serializeDeckReleaseDesign(state.data),start=api.read();
const request={id:'sketch-test',expectedRevision:start.revision,commands:[{type:'sketch.generate' as const,document}]};
const preview=success(await api.preview(request));
check(preview.snapshot.design.width===20&&preview.snapshot.design.length===12&&preview.snapshot.design.height===30,'Measured deck dimensions generate exact editable fields');
check(preview.snapshot.quantities.area===240,'Generated polygon takeoff uses the measured 240 sq ft deck');
check(preview.snapshot.design.houseConfig?.widthFt===30,'House position and dimensions use the same calibration');
check(!preview.snapshot.design.boardLayout&&!!preview.interpretation?.warnings.length,'Replaced geometry resets obsolete board edits and discloses it');
check(!('customerName' in preview.snapshot.design)&&!JSON.stringify(preview).includes('Private local'),'Sketch snapshots preserve privacy');
check(serializeDeckReleaseDesign(state.data)===before&&commits===0&&history.past.length===0,'Preview never touches design, autosave source or undo history');
const applied=success(await api.execute(request));
check(commits===1&&history.past.length===1&&applied.changed,'Sketch application is one atomic replacement');
check(state.data.customerName===initial.customerName&&state.data.projectAddress===initial.projectAddress&&state.data.materialMarkup===19.75,'Customer fields and contractor markup stay local and unchanged');
check(state.data.deckingMaterial===initial.deckingMaterial&&JSON.stringify(state.data.underDeck)===JSON.stringify(initial.underDeck),'Current product and under-deck selections are retained');
check(parseDeckReleaseDesign(serializeDeckReleaseDesign(state.data)).deckOutlines?.main?.length===4,'Generated outline survives saving and restoring');
check(success(await api.execute(request)).replayed&&commits===1,'Retry of same command id cannot apply again');
success(await api.execute({id:'sketch-undo',commands:[{type:'history.undo'}]}));
check(serializeDeckReleaseDesign(state.data)===before,'One Undo restores full pre-sketch geometry and options');
for(const badDocument of [
  {...document,shapes:[...document.shapes,{...document.shapes[1],id:'disconnected',points:rectangle(800,500,80,80),widthFt:6,depthFt:6}]},
  {...document,shapes:document.shapes.map(s=>({...s,widthFt:NaN}))},
  {...document,shapes:document.shapes.map(s=>({...s,unknownField:'ignore-me'}))},
  {...document,version:2},
]){
  const unchanged=serializeDeckReleaseDesign(state.data),oldCommits=commits;
  const response=await api.execute({id:`bad-sketch-${checks}`,commands:[{type:'sketch.generate',document:badDocument}]});
  check(!response.ok,'Invalid, disconnected and unknown sketch data are rejected');
  check(serializeDeckReleaseDesign(state.data)===unchanged&&commits===oldCommits,'Rejected sketch cannot change live design');
}
check(!('error' in await api.preview({id:'sketch-after-undo',commands:[{type:'sketch.generate',document}]})),'Preview remains available after undo');
const atomicBefore=serializeDeckReleaseDesign(state.data),atomicCommits=commits;
const failedBatch=await api.execute({id:'sketch-invalid-tail',commands:[{type:'sketch.generate',document},{type:'design.patch',patch:{height:-1}}]});
check(!failedBatch.ok&&commits===atomicCommits&&serializeDeckReleaseDesign(state.data)===atomicBefore,'A failed edit after generation cannot partially apply the sketch');
check(api.describe().commands.includes('sketch.generate')&&api.describe().sketch.schema,'Agents can discover the measured sketch document schema');
const stale=await api.execute({...request,id:'stale-sketch'});
check('error' in stale&&stale.error.code==='stale_revision','Old generated sketch revision cannot overwrite newer state');
// Conversion now loads on demand; changing the host during that async boundary must abort before any commit.
const oldCommits=commits;
const racing=api.execute({id:'race-sketch',commands:[{type:'sketch.generate',document}]});
queueMicrotask(()=>{state={...state,data:{...state.data,length:21}};api.notify();});
const raced=await racing;
check('error' in raced&&raced.error.code==='stale_revision'&&commits===oldCommits&&state.data.length===21,'Concurrent human edit wins while async sketch conversion is preparing');
api.dispose();
console.log(`DECK SKETCH AGENT OK — ${checks} checks of measured generation, pricing, privacy, atomic undo, persistence, replay and async revision guards.`);
