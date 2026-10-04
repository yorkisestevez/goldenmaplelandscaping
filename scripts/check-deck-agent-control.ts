import assert from 'node:assert/strict';
import {createDeckAgentController,type DeckAgentHostState,type AgentCommand,type AgentResponse} from '../src/features/deckcraft/designer/deckAgentController';
import {applyWalkway} from '../src/features/deckcraft/shapeTools';
import type {YardFeature} from '../src/features/deckcraft/types';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {deckReleaseData,calculateDeckReleaseEstimate,serializeDeckReleaseDesign,parseDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import {emptyHistory,recordChange,undoChange,redoChange} from '../src/features/deckcraft/designer/designHistory';
import {decodeDesignLink,designLinkFromHash} from '../src/features/deckcraft/designLink';
import type {DeckData} from '../src/features/deckcraft/types';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';

let checks=0;
const check=(condition:unknown,message:string)=>{assert.ok(condition,message);checks++;};
function fixture(initial=deckReleaseData(structuredClone(DEFAULT_DECK))){
  let state:DeckAgentHostState={data:initial,view:'plan',openSections:[],canUndo:false,canRedo:false,ready:true},history=emptyHistory<DeckData>(),commits=0,actions=0,rendered=false;
  const queued=new Set<{test:(s:DeckAgentHostState)=>boolean;done:()=>void}>();
  const render=(next:DeckAgentHostState)=>{state=next;rendered=true;for(const w of queued)if(w.test(state)){queued.delete(w);w.done();}};
  const schedule=(next:DeckAgentHostState)=>{rendered=false;setTimeout(()=>render(next),5);};
  const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{commits++;history=recordChange(history,state.data,`replace:${commits}`,commits*1000);schedule({...state,data:next,canUndo:true,canRedo:false});},undo:()=>{const next=undoChange(history,state.data);assert.ok(next);history=next.history;schedule({...state,data:next.design,canUndo:history.past.length>0,canRedo:true});},redo:()=>{const next=redoChange(history,state.data);assert.ok(next);history=next.history;schedule({...state,data:next.design,canUndo:true,canRedo:history.future.length>0});},setView:view=>schedule({...state,view}),openSection:section=>schedule({...state,openSections:[...new Set([...state.openSections,section])]}),waitForRender:test=>test(state)?Promise.resolve():new Promise(resolve=>queued.add({test,done:resolve})),actions:{'review.open':()=>{actions++;},'export.obj':()=>{actions++;}},shareOrigin:'http://localhost:4187'});
  return {api,get state(){return state;},get commits(){return commits;},get actions(){return actions;},get rendered(){return rendered;},get history(){return history;},external:(patch:Partial<DeckAgentHostState>)=>{state={...state,...patch};api.notify();}};
}
let counter=0;
const request=(commands:AgentCommand[],expectedRevision?:number)=>({id:`check-${++counter}`,commands,...(expectedRevision===undefined?{}:{expectedRevision})});
const ok=(r:AgentResponse)=>{if('error' in r)throw new Error(`${r.error.code}: ${r.error.message}`);check(r.ok,'Command succeeds');return r;};
async function main(){
  const walkwayHost=fixture(),walk=applyWalkway({id:'walk-regression',name:'Walkway',kind:'patio',enabled:true,xFt:0,zFt:0,widthFt:10,depthFt:4,heightIn:0,rotationDeg:0,productId:'permacon-melville',color:'#aaaaaa'} as YardFeature,{points:[{x:360,y:360},{x:480,y:360}],edges:[{kind:'line'}],closed:false},48,'round');
  const walkPatch={yardFeatures:[walk]},preview=ok(await walkwayHost.api.preview(request([{type:'design.patch',patch:walkPatch}])));
  check(JSON.stringify(preview.snapshot.design.yardFeatures![0].pathSpine)===JSON.stringify(walk.pathSpine)&&walkwayHost.commits===0,'Walkway centreline passes preview without writes');
  ok(await walkwayHost.api.execute(request([{type:'design.patch',patch:walkPatch}])));
  check(JSON.stringify(walkwayHost.state.data.yardFeatures![0].pathSpine)===JSON.stringify(walk.pathSpine),'Applying a walkway preserves its centreline');
  for(const spine of [{...walk.pathSpine,widthIn:400},{...walk.pathSpine,ends:'invalid'},{...walk.pathSpine,extra:true}]){
    const count=walkwayHost.commits,bad={...walk,pathSpine:spine} as unknown as YardFeature;
    check(!(await walkwayHost.api.preview(request([{type:'design.patch',patch:{yardFeatures:[bad]}}]))).ok&&walkwayHost.commits===count,'Invalid walkway metadata stays rejected without writes');
  }
  const f=fixture(),start=f.api.read();
  check(Object.isFrozen(start)&&Object.isFrozen(start.design)&&Object.isFrozen(start.boundaries[0].points),'Read snapshots are recursively immutable');
  check(!('customerName' in start.design)&&!('materialMarkup' in start.design),'Read does not expose contact details or contractor overrides');
  check(f.api.describe().catalogue.decking.some(m=>m.id===start.design.deckingMaterial),'Descriptor exposes real current catalogue');
  const stored=serializeDeckReleaseDesign(f.state.data);
  const dry=ok(await f.api.preview(request([{type:'design.patch',patch:{width:24,skirting:{style:'Horizontal boards',clearanceIn:2}}}],start.revision)));
  check(dry.snapshot.pricing.total>start.pricing.total,'Preview calculates changed costs');
  check(dry.snapshot.quotes.some(q=>q.includes('skirting')),'Preview retains unpriced skirting scope');
  check(serializeDeckReleaseDesign(f.state.data)===stored&&f.commits===0&&f.history.past.length===0,'Preview changes neither persistence source, history nor host');
  const invalid:unknown[]=[
    {type:'design.patch',patch:{width:NaN}},{type:'design.patch',patch:{width:Infinity}},{type:'design.patch',patch:{width:3}},
    {type:'design.patch',patch:{width:'18'}},{type:'design.patch',patch:{unknown:123}},{type:'design.patch',patch:{customerName:'Secret'}},
    {type:'design.patch',patch:{materialMarkup:10}},{type:'design.patch',patch:{underDeck:{drainage:'bad',ceiling:'none',scope:'main',gravel:false,gravelDepthIn:4,floorMesh:false}}},
    {type:'design.patch',patch:{skirting:{style:'Horizontal boards',clearanceIn:2,unknown:true}}},
    {type:'design.patch',patch:{lightingSystem:{selectedItems:[],wireDistance:1,bogus:true}}},
    {type:'design.patch',patch:JSON.parse('{"__proto__":{"polluted":true}}')},
    {type:'design.patch',patch:Object.create({width:18})},{type:'design.patch',patch:{constructor:123}},
    {type:'design.patch',patch:{width:20},unset:['width']},{type:'design.patch',patch:{},unset:['shape']},
    {type:'view.set',view:'bad'},{type:'action',action:'send'},{type:'run',code:'alert(1)'},
  ];
  for(const command of invalid){const result=await f.api.execute({id:`invalid-${counter++}`,commands:[command]});check(!result.ok,'Invalid, unsafe and unknown commands are rejected');check(f.commits===0&&f.actions===0&&serializeDeckReleaseDesign(f.state.data)===stored,'Rejection has no host or persistence side effects');}
  const getter=Object.defineProperty({},'width',{get(){throw new Error('Getter was evaluated');},enumerable:true});
  check(!(await f.api.execute({id:'getter',commands:[{type:'design.patch',patch:getter}]})).ok,'Accessors are rejected without invocation');
  const house=getHouseConfig(f.state.data);house.openings[0].bottomIn=900;
  check(!(await f.api.execute(request([{type:'design.patch',patch:{houseConfig:house}}]))).ok,'House opening clamping is rejected instead of silently lowering an invalid opening');
  const unknownNested=JSON.parse('{"type":"design.patch","patch":{"houseConfig":{"constructor":"unsafe"}}}');
  check(!(await f.api.execute({id:'nested-prototype',commands:[unknownNested]})).ok,'Nested prototype-name fields are rejected');
  const sparse=new Array(2);sparse[1]={type:'history.undo'};
  check(!(await f.api.execute({id:'sparse',commands:sparse})).ok,'Sparse command arrays are rejected');
  const batch=request([{type:'design.patch',patch:{width:20}},{type:'design.patch',patch:{length:18}}],start.revision);
  const applied=ok(await f.api.execute(batch));check(f.rendered&&applied.snapshot.design.width===20&&applied.snapshot.design.length===18,'Execute waits for acknowledged rendered data');
  check(f.commits===1&&f.history.past.length===1,'Two edits commit as one history step');
  check(ok(await f.api.execute(batch)).replayed===true&&f.commits===1,'Repeated command id returns result without another commit');
  const conflict=await f.api.execute({...batch,commands:[{type:'design.patch',patch:{width:22}}]});check('error' in conflict&&conflict.error.code==='id_conflict','Conflicting replay cannot execute');
  const stale=await f.api.execute(request([{type:'design.patch',patch:{width:22}}],start.revision));check('error' in stale&&stale.error.code==='stale_revision','Stale revision is refused at execution time');
  ok(await f.api.execute(request([{type:'history.undo'}])));check(f.state.data.width===start.design.width&&f.state.data.length===start.design.length,'One undo reverses whole batch');
  ok(await f.api.execute(request([{type:'history.redo'}])));check(f.state.data.width===20&&f.state.data.length===18,'Redo restores atomic batch');
  const before=serializeDeckReleaseDesign(f.state.data),commits=f.commits;
  check(!(await f.api.execute(request([{type:'design.patch',patch:{width:30}},{type:'design.patch',patch:{height:-1}}]))).ok,'A later invalid batch step fails');
  check(serializeDeckReleaseDesign(f.state.data)===before&&f.commits===commits,'A failed batch has no partial edits');
  check(!(await f.api.execute(request([{type:'design.patch',patch:{width:30}},{type:'action',action:'review.open'}]))).ok,'Mixed edits and external actions are rejected atomically');
  const rev=f.api.read().revision;
  const results=await Promise.all([f.api.execute(request([{type:'design.patch',patch:{width:21}}],rev)),f.api.execute(request([{type:'design.patch',patch:{width:22}}],rev))]);
  check(results[0].ok&&'error' in results[1]&&results[1].error.code==='stale_revision','Queued concurrency compares revision after earlier render acknowledgement');
  const seq=await Promise.all([f.api.execute(request([{type:'design.patch',patch:{width:22}}])),f.api.execute(request([{type:'design.patch',patch:{length:20}}]))]);
  check(seq.every(r=>r.ok)&&f.state.data.width===22&&f.state.data.length===20,'Unconditional queued patches merge with latest design rather than stale closure');
  const action=request([{type:'action',action:'review.open'}]);await Promise.all([f.api.execute(action),f.api.execute(action)]);check(f.actions===1,'Concurrent identical action ids open review once');
  check(f.api.describe().actions.includes('permit.pdf')&&f.api.describe().actions.includes('export.dxf2d'),'Assistant describes both permit downloads');
  ok(await f.api.execute(request([{type:'view.set',view:'front'}])));check(f.api.read().view==='front','View commands await visible view');
  ok(await f.api.execute(request([{type:'section.open',section:'boards'}])));check(f.api.read().openSections.includes('boards'),'Section commands open semantic editor section');
  const share=ok(await f.api.execute(request([{type:'action',action:'share.create'}])));check(!!share.result?.url,'Share action returns a local generated URL');
  const decoded=await decodeDesignLink(designLinkFromHash(new URL(share.result!.url).hash)!);check(decoded.width===f.state.data.width&&decoded.customerName==='','Shared design reopens without personal details');
  const own={...f.state.data,customerName:'Private name',projectAddress:'Private address',scopeOfWork:'Private scope',materialMarkup:0.123};f.external({data:own});
  ok(await f.api.execute(request([{type:'design.patch',patch:{height:48}}])));check(f.state.data.customerName===own.customerName&&f.state.data.materialMarkup===own.materialMarkup,'Validated edits preserve local private fields and rate overrides');
  const redacted=f.api.read();check(!JSON.stringify(redacted).includes('Private'),'Snapshot remains redacted');
  ok(await f.api.execute(request([{type:'design.replace',design:{...redacted.design,length:21}}])));check(f.state.data.projectAddress==='Private address','Whole design replacement preserves private data');
  const parsed=parseDeckReleaseDesign(serializeDeckReleaseDesign(f.state.data));check(parsed.width===f.state.data.width&&parsed.length===21,'Accepted commands persist through release parser');
  for(const level of [1,2,3] as const){
    const levelData=deckReleaseData({...structuredClone(DEFAULT_DECK),levels:3,level3:{widthFt:8,lengthFt:8,heightIn:18,parent:2,position:'Front',offsetPct:50}}),g=fixture(levelData),old=g.api.read();
    const points=[{x:-24,y:-12},{x:144,y:-12},{x:180,y:84},{x:96,y:144},{x:-24,y:120}];
    const set=ok(await g.api.execute(request([{type:'boundary.set',level,points}])));check(set.snapshot.boundaries.find(b=>b.level===level)?.points.length===5,`Level ${level} accepts arbitrary angles and negative coordinates`);
    const lowerOrigins=old.boundaries.filter(b=>b.level!==level).map(b=>[b.level,b.offset]);
    if(level===1)check(JSON.stringify(set.snapshot.boundaries.filter(b=>b.level!==level).map(b=>[b.level,b.offset]))===JSON.stringify(lowerOrigins),'Main boundary changes preserve lower-level world origins');
    const add=ok(await g.api.execute(request([{type:'boundary.add',level,index:0}])));check(add.snapshot.boundaries.find(b=>b.level===level)?.points.length===6,'Collinear point insertion adds editable handle');
    check(add.snapshot.pricing.total===set.snapshot.pricing.total,'Collinear add does not invent material cost');
    ok(await g.api.execute(request([{type:'boundary.move',level,target:'point',index:1,dxIn:0,dyIn:12}])));
    ok(await g.api.execute(request([{type:'boundary.move',level,target:'edge',index:2,dxIn:12,dyIn:6}])));
    ok(await g.api.execute(request([{type:'boundary.move',level,target:'area',dxIn:-6,dyIn:6}])));
    ok(await g.api.execute(request([{type:'boundary.remove',level,index:1}])));
    const now=g.api.read(),e=calculateDeckReleaseEstimate(g.state.data);check(Math.abs(now.pricing.total-(e.subtotal+e.hst))<1e-8,'Boundary commands retain full accounting');
    const file=parseDeckReleaseDesign(serializeDeckReleaseDesign(g.state.data));check(JSON.stringify(file.deckOutlines)===JSON.stringify(g.state.data.deckOutlines),'All-level boundaries survive persistence');
    const failed=await g.api.execute(request([{type:'boundary.set',level,points:[{x:0,y:0},{x:120,y:120},{x:120,y:0},{x:0,y:120}]}]));check(!failed.ok&&g.api.read().revision===now.revision,'Crossing polygon rejected without mutation');
    check(!(await g.api.execute(request([{type:'boundary.move',level,target:'point',index:99,dxIn:1,dyIn:1}]))).ok,'Invalid point index rejected');
  }
  const inactive=fixture();inactive.external({ready:false});check(!(await inactive.api.execute(request([{type:'design.patch',patch:{width:22}}]))).ok,'Writes wait until initial restore completes');
  const auto=fixture(),autoPreview=ok(await auto.api.preview(request([{type:'design.patch',patch:{autoLighting:{posts:true,stairs:true},height:48}}])));
  check(autoPreview.snapshot.design.lightingSystem.selectedItems.some(i=>i.auto&&i.zone==='stairs'),'Preview synchronizes managed lighting against proposed geometry');
  const autoDone=ok(await auto.api.execute(request([{type:'design.patch',patch:{autoLighting:{posts:true,stairs:true},height:48}}])));
  check(JSON.stringify(autoPreview.snapshot.design.lightingSystem)===JSON.stringify(autoDone.snapshot.design.lightingSystem)&&autoPreview.snapshot.pricing.total===autoDone.snapshot.pricing.total,'Preview and execution agree after automatic lighting sync');
  const wrongLights=structuredClone(autoDone.snapshot.design.lightingSystem);wrongLights.selectedItems.find(i=>i.zone==='stairs')!.qty=1;
  check(!(await auto.api.execute(request([{type:'design.patch',patch:{lightingSystem:wrongLights}}]))).ok,'Contradictory explicitly supplied managed quantities are rejected');
  const generic=fixture(deckReleaseData({...structuredClone(DEFAULT_DECK),levels:3,level3:{widthFt:8,lengthFt:8,heightIn:18,parent:2,position:'Front',offsetPct:50}}));
  const genericBefore=generic.api.read(),genericAfter=ok(await generic.api.execute(request([{type:'design.patch',patch:{deckOutlines:{main:[{x:-1,y:0},{x:20,y:0},{x:18,y:12},{x:-1,y:12}]}}}])));
  check(JSON.stringify(genericAfter.snapshot.boundaries.slice(1).map(b=>b.offset))===JSON.stringify(genericBefore.boundaries.slice(1).map(b=>b.offset)),'Generic free-outline patches preserve neighboring origins too');
  check(!(await generic.api.execute(request([{type:'design.patch',patch:{width:17,deckOutlines:{main:[{x:0,y:0},{x:18,y:0},{x:18,y:12},{x:0,y:12}]}}}]))).ok,'Explicit dimension and polygon contradictions fail');
  inactive.api.dispose();check(!(await inactive.api.execute(request([{type:'action',action:'review.open'}]))).ok,'Disconnected controller cannot act');
  {
    const g=fixture(),before=g.api.read(),region={id:'test_area',level:1 as const,polygon:[{x:20,y:20},{x:90,y:20},{x:90,y:80},{x:20,y:80}],angleDeg:33},breaker={id:'test_breaker',level:1 as const,start:{x:100,y:12},end:{x:110,y:120}};
    const batch=request([{type:'layout.region',region},{type:'layout.breaker',breaker}],before.revision),preview=ok(await g.api.preview(batch));
    check(g.commits===0&&!g.state.data.boardLayout,'Layout preview has no writes');
    check(preview.snapshot.boards.some(b=>b.layoutId===region.id&&b.angleDeg===33),'Read inventory exposes actual rotated area boards');
    const applied=ok(await g.api.execute(batch));
    check(g.commits===1&&g.history.past.length===1,'Area and breaker apply atomically in one undo step');
    check(JSON.stringify(applied.snapshot.boards)===JSON.stringify(preview.snapshot.boards)&&applied.snapshot.pricing.total===preview.snapshot.pricing.total,'Preview and execute share exact geometry and pricing');
    ok(await g.api.execute(request([{type:'history.undo'}])));check(!g.state.data.boardLayout,'One undo restores both layout edits');
    ok(await g.api.execute(request([{type:'history.redo'}])));
    const board=g.api.read().boards.find(b=>!b.layoutId&&b.role==='field')!,old=g.api.read(),rotate=request([{type:'layout.board',modelLevel:board.modelLevel,index:board.index,pieceId:'test_piece',angleDeg:74}],old.revision);
    const rotated=ok(await g.api.execute(rotate));check(rotated.snapshot.design.boardLayout?.pieces.some(p=>p.id==='test_piece'&&p.angleDeg===74&&p.polygon?.length),'Selected board persists a physically rotated cut silhouette');
    check(rotated.snapshot.boards.some(b=>b.layoutId==='test_piece'&&Math.abs(b.angleDeg-74)<1e-5),'Selected board inventory reports physical new direction');
    check(!(await g.api.execute(request([{type:'layout.board',modelLevel:board.modelLevel,index:board.index,pieceId:'stale_piece',angleDeg:20}],old.revision))).ok,'Stale board indices are revision guarded');
    const saved=serializeDeckReleaseDesign(g.state.data),commits=g.commits;
    const invalid=request([{type:'layout.region',region:{...region,id:'rejected',angleDeg:Infinity}}]);
    check(!(await g.api.execute(invalid)).ok&&g.commits===commits&&serializeDeckReleaseDesign(g.state.data)===saved,'Invalid layout transaction has no history or geometry side effects');
    const prior=g.api.read().design.boardLayout!,moved=ok(await g.api.execute(request([{type:'boundary.move',level:1,target:'area',dxIn:-6,dyIn:3}]))).snapshot.design.boardLayout!;
    check(moved.regions[0].polygon[0].x===prior.regions[0].polygon[0].x-6&&moved.breakers[0].end.y===prior.breakers[0].end.y+3&&moved.pieces[0].cx===prior.pieces[0].cx-6&&moved.pieces[0].polygon![0].y===prior.pieces[0].polygon![0].y+3,'Whole-level moves carry area, breaker, physical piece and source cut anchors');
    const share=ok(await g.api.execute(request([{type:'action',action:'share.create'}]))),decoded=await decodeDesignLink(designLinkFromHash(new URL(share.result!.url).hash)!);
    check(JSON.stringify(decoded.boardLayout)===JSON.stringify(g.state.data.boardLayout),'Agent-edited layouts survive sharing');
    for(const id of ['test_area','test_breaker','test_piece'])ok(await g.api.execute(request([{type:'layout.remove',id}])));
    check(!g.state.data.boardLayout,'Removing the last layout canonicalizes to no custom layout');
    ok(await g.api.execute(request([{type:'design.patch',patch:{boardLayout:{regions:[],breakers:[],pieces:[]}}}])));
    check(!g.state.data.boardLayout,'Explicit empty layout is a valid canonical clear');
    const noLevelBefore=serializeDeckReleaseDesign(g.state.data);
    check(!(await g.api.preview(request([{type:'layout.region',region:{...region,id:'absent_area',level:2}}]))).ok&&!(await g.api.execute(request([{type:'layout.breaker',breaker:{...breaker,id:'absent_breaker',level:3}}]))).ok&&serializeDeckReleaseDesign(g.state.data)===noLevelBefore,'Explicit layout edits reject an absent level without mutation');
  }
  console.log(`PASS: ${checks} agent control checks (strict validation, atomic history, concurrency, previews, privacy, persistence, all three boundaries).`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
