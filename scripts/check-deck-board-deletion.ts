import assert from 'node:assert/strict';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {deckReleaseData,calculateDeckReleaseEstimate} from '../src/features/deckcraft/deckRelease';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {parseDesign,serializeDesign} from '../src/features/deckcraft/designPersistence';
import {validateBoardLayout} from '../src/features/deckcraft/boardLayout';
import {selectableBoards,emptyBoardLayout} from '../src/features/deckcraft/designer/boardLayoutActions';
import {deleteSelectedBoards} from '../src/features/deckcraft/designer/boardRemovalActions';
import {createDeckAgentController,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';
import type {DeckData} from '../src/features/deckcraft/types';
let checks=0,sequence=0;const ok=(v:unknown,label:string)=>{assert(v,label);checks++;};
const base=(patch:Partial<DeckData>={}):DeckData=>deckReleaseData({...structuredClone(DEFAULT_DECK),deckType:'Freestanding',houseVisible:false,stairFlights:0,railingType:'None',width:20,length:12,pictureFrameRows:2,deckingMaterial:'tt_prime_plus',materialMarkup:.17,...patch});
const target=(data:DeckData,id?:string)=>{const model=buildDeckTakeoff(data),board=selectableBoards(data,model).find(b=>id?b.run.layoutId===id:b.run.role==='border')!;assert(board);return {model,board,t:{level:board.modelLevel,index:board.index}};};
for(const pattern of ['Straight','Diagonal','Picture Frame','Herringbone'] as const)for(const boardWidth of [3.5,5.5] as const){
 const data=base({pattern,boardWidth,levels:2,width2:8,length2:8}),frozen=JSON.stringify(data),{model,board,t}=target(data),result=deleteSelectedBoards(data,model,[t],()=>`delete-${++sequence}`),next={...data,...result.patch},built=buildDeckTakeoff(next),region=next.boardLayout!.regions[0];
 ok(region.replaceBorder===true&&JSON.stringify(region.polygon)===JSON.stringify(board.polygon),'Selected frame cut, not a global row or new rectangular envelope, is replaced');
 ok(next.pictureFrameRows===2,'Deleting one frame board preserves the global frame rows');
 ok(JSON.stringify(built.levels[1].boards)===JSON.stringify(model.levels[1].boards),'Other levels remain byte-for-byte unchanged');
 ok(built.levels[0].boards.some(b=>b.layoutId===region.id&&b.role==='field'),'Replacement has real field stock in the physical model');
 const others=model.levels[0].boards.filter((b,index)=>index!==board.index&&b.role==='border');
 const retained=built.levels[0].boards.filter(b=>b.role==='border');
 ok(retained.length===others.length,'Only the selected physical frame board is removed');
 for(const original of others){const actual=retained.find(b=>b.cx===original.cx&&b.cy===original.cy&&b.angleDeg===original.angleDeg);ok(!!actual&&JSON.stringify(actual.polygon)===JSON.stringify(original.polygon)&&actual.length===original.length&&actual.width===original.width,'Every unselected frame silhouette and stock dimension remains exact');}
 ok(built.quantities.area===model.quantities.area,'Deleting trim keeps the actual deck outline/area');
 ok(JSON.stringify(data)===frozen,'Removal planning does not mutate the source');
 ok(JSON.stringify(parseDesign(serializeDesign(next)).boardLayout)===JSON.stringify(next.boardLayout),'Exact replacement survives strict JSON save/reload');
 const priced=calculateDeckReleaseEstimate(next,DECK_SETTINGS);ok(Number.isFinite(priced.total)&&priced.total>0,'Replacement uses the actual estimate');
}
{
 const layout={...emptyBoardLayout(),breakers:[{id:'finite',level:1 as const,start:{x:65,y:20},end:{x:65,y:125}}]},data=base({boardLayout:layout}),{model,t}=target(data,'finite');
 const runs=selectableBoards(data,model).filter(b=>b.run.layoutId==='finite');assert(runs.length);
 const result=deleteSelectedBoards(data,model,[t,t,...runs.map(b=>({level:b.modelLevel,index:b.index}))],()=>`unused-${++sequence}`);
 ok(result.removedIds.length===1&&result.patch.boardLayout!.breakers.length===0,'One saved breaker is deleted once across physical fragments and repeated targets');
 ok(JSON.stringify(buildDeckTakeoff({...data,...result.patch}))===JSON.stringify(buildDeckTakeoff(base())),'Removing the only added breaker restores the exact base model');
 const field=selectableBoards(data,model).find(b=>b.run.role==='field'&&!b.run.layoutId)!;
 assert.throws(()=>deleteSelectedBoards(data,model,[t,{level:field.modelLevel,index:field.index}],()=>`bad-${++sequence}`),/Only added/);checks++;
 assert.throws(()=>deleteSelectedBoards(data,model,[{level:9,index:999}],()=>''),/changed/);checks++;
}
{
 const invalid={...emptyBoardLayout(),regions:[{id:'bad',level:1,polygon:[{x:0,y:0},{x:20,y:0},{x:20,y:20}],angleDeg:0,replaceBorder:false}]};
 assert.throws(()=>validateBoardLayout(invalid,5.5),/must be true/);checks++;
}
{
 const data=base(),history:DeckData[]=[];let state:DeckAgentHostState={data,view:'plan',openSections:[],canUndo:false,canRedo:false,ready:true},commits=0;
 const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{history.push(state.data);commits++;state={...state,data:next,canUndo:true};},undo:()=>{state={...state,data:history.pop()!,canUndo:history.length>0,canRedo:true};},redo:()=>{},setView:()=>{},openSection:()=>{},waitForRender:predicate=>{assert(predicate(state));return Promise.resolve();}});
 const board=api.read().boards.find(b=>b.role==='border')!,revision=api.read().revision,command={type:'layout.deleteBoard',modelLevel:board.modelLevel,index:board.index,replacementId:'agent-frame'};
 ok(api.describe().commands.includes('layout.deleteBoard'),'Agent descriptor advertises deletion');
 const preview=await api.preview({id:'delete-preview',expectedRevision:revision,commands:[command]});ok(preview.ok&&commits===0,'Agent deletion preview writes no geometry/history');
 ok(!(await api.preview({id:'delete-multiple',expectedRevision:revision,commands:[command,{...command,index:2,replacementId:'second-frame'}]})).ok&&commits===0,'Multiple deletions cannot retarget shifted inventory indices inside one request');
 ok(!(await api.execute({id:'delete-mixed',expectedRevision:revision,commands:[{type:'design.patch',patch:{width:24}},command]})).ok&&commits===0,'Mixing geometry changes with index deletion rejects atomically');
 const applied=await api.execute({id:'delete-apply',expectedRevision:revision,commands:[command]});ok(applied.ok&&commits===1,'Agent deletion commits once');
 if(preview.ok&&applied.ok)ok(preview.snapshot.pricing.total===applied.snapshot.pricing.total,'Preview and Apply exact total agree');
 ok(state.data.materialMarkup===.17,'Private pricing is retained by deletion');
 ok(!(await api.execute({id:'delete-stale',expectedRevision:revision,commands:[command]})).ok&&commits===1,'Stale board deletion cannot retarget a changed inventory');
 await api.execute({id:'delete-undo',commands:[{type:'history.undo'}]});ok(JSON.stringify(state.data)===JSON.stringify(data),'One Undo restores exact data');api.dispose();
}
console.log(`BOARD DELETION OK: ${checks} exact cut, stock, levels, save, atomic and agent checks.`);
