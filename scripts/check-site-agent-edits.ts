import assert from 'node:assert/strict';
import {createDeckAgentController,type AgentCommand,type AgentResponse,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {deckReleaseData,serializeDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import type {SiteModel,SiteGradingRegion} from '../src/features/deckcraft/siteModel';

let checks=0,id=0;
const check=(condition:unknown,message:string)=>{assert.ok(condition,message);checks++;};
const request=(commands:AgentCommand[])=>({id:`site-edit-${++id}`,commands});
const ok=(result:AgentResponse)=>{if('error' in result)throw Error(`${result.error.code}: ${result.error.message}`);check(result.ok,'Command succeeds');return result;};
function fixture(){
 let state:DeckAgentHostState={data:deckReleaseData({...structuredClone(DEFAULT_DECK),houseVisible:false,yardFeatures:[{id:'wall',name:'Test wall',kind:'retaining-wall',enabled:true,xFt:25,zFt:25,widthFt:8,depthFt:1,heightIn:24,rotationDeg:0,productId:'segmental-concrete',color:'#a0a0a0'}]}),view:'plan',openSections:[],canUndo:false,canRedo:false,ready:true},commits=0;
 const api=createDeckAgentController({getState:()=>state,commitDesign:data=>{commits++;state={...state,data,canUndo:true,canRedo:false};},undo:()=>{},redo:()=>{},setView:view=>{state={...state,view};},openSection:section=>{state={...state,openSections:[...state.openSections,section]};},waitForRender:async predicate=>{assert.ok(predicate(state),'Host acknowledges committed state');}});
 return {api,get state(){return state;},get commits(){return commits;}};
}
async function main(){
 const f=fixture(),site:SiteModel={version:1,points:[{id:'sw',xIn:-2000,zIn:-2000,elevationIn:0},{id:'se',xIn:2000,zIn:-2000,elevationIn:0},{id:'ne',xIn:2000,zIn:2000,elevationIn:0},{id:'nw',xIn:-2000,zIn:2000,elevationIn:0},{id:'center',xIn:0,zIn:0,elevationIn:0}],grading:[]};
 // Cold first-use: no schema/geometry runtime imported by this script.
 const before=serializeDeckReleaseDesign(f.state.data);
 ok(await f.api.preview(request([{type:'objects.edit',ids:['wall'],edit:{action:'lock',locked:true}}])));
 check(!f.state.data.editorOrganization&&f.commits===0&&serializeDeckReleaseDesign(f.state.data)===before,'First metadata preview loads validator without creating live organization');
 ok(await f.api.execute(request([{type:'objects.edit',ids:['wall'],edit:{action:'lock',locked:true}}])));
 check(f.state.data.editorOrganization?.objects[0]?.locked===true,'First lock command creates valid metadata');
 const locked=serializeDeckReleaseDesign(f.state.data),lockedCommits=f.commits;
 check(!(await f.api.execute(request([{type:'objects.edit',ids:['wall'],edit:{action:'move',dxIn:12,dzIn:0}}]))).ok,'Object lock refuses physical edit');
 check(f.commits===lockedCommits&&serializeDeckReleaseDesign(f.state.data)===locked,'Rejected lock edit is atomic');
 ok(await f.api.execute(request([{type:'objects.edit',ids:['wall'],edit:{action:'lock',locked:false}}])));
 ok(await f.api.execute(request([{type:'objects.edit',ids:['wall'],edit:{action:'move',dxIn:6,dzIn:-6}},{type:'objects.edit',ids:['wall'],edit:{action:'move',dxIn:6,dzIn:-6}}])));
 check(f.state.data.yardFeatures?.[0].xFt===26&&f.state.data.yardFeatures[0].zFt===24,'Object move batch uses current candidate');
 check(f.commits===lockedCommits+2,'Unlock commits once and physical batch commits once');
 ok(await f.api.execute(request([{type:'objects.edit',ids:['wall'],edit:{action:'group',name:'Retaining walls'}}])));
 check(f.state.data.editorOrganization?.groups[0]?.objectIds[0]==='wall','Object group execute persists membership');
 const start=f.commits;
 ok(await f.api.execute(request([{type:'design.patch',patch:{siteModel:site}}])));
 check(f.commits===start+1&&f.state.data.siteModel?.points.length===5,'First site patch initializes schema and geometry before validation/calculation');
 const initialSite=serializeDeckReleaseDesign(f.state.data);
 const preview=ok(await f.api.preview(request([{type:'site.point',id:'center',xIn:0,zIn:0,elevationIn:12}])));
 check(preview.snapshot.design.siteModel?.points.find(p=>p.id==='center')?.elevationIn===12,'Measured point preview calculates prospective design');
 check(serializeDeckReleaseDesign(f.state.data)===initialSite&&f.commits===start+1,'Measured point preview has no live writes');
 ok(await f.api.execute(request([{type:'site.point',id:'center',xIn:0,zIn:0,elevationIn:12}])));
 check(f.state.data.siteModel?.points.find(p=>p.id==='center')?.elevationIn===12,'Measured point execute is an accepted edit command');
 const grade:SiteGradingRegion={id:'terrace',name:'Terrace',boundary:[{x:200,y:200},{x:500,y:200},{x:500,y:500},{x:200,y:500}],originXIn:200,originZIn:200,elevationIn:6,slopeXPct:0,slopeZPct:1};
 ok(await f.api.execute(request([{type:'site.grade',region:grade}])));
 check(f.state.data.siteModel?.grading[0]?.elevationIn===6,'Explicit grading execute persists');
 ok(await f.api.execute(request([{type:'site.grade',region:{...grade,elevationIn:8}}])));
 check(f.state.data.siteModel?.grading.length===1&&f.state.data.siteModel.grading[0].elevationIn===8,'Grading ID updates existing region once');
 const valid=serializeDeckReleaseDesign(f.state.data),validCommits=f.commits;
 check(!(await f.api.execute(request([{type:'site.point',id:'center',xIn:1,zIn:1,elevationIn:4},{type:'site.point',id:'center',xIn:2000,zIn:2000,elevationIn:4}]))).ok,'Conflicting survey XY rejects a whole batch');
 check(f.commits===validCommits&&serializeDeckReleaseDesign(f.state.data)===valid,'Failed measured batch preserves design and commit count');
 check(!(await f.api.execute(request([{type:'site.point',id:'unknown',xIn:1,zIn:1,elevationIn:4}]))).ok,'Missing measured ID rejected');
 ok(await f.api.execute(request([{type:'site.remove',target:'grading',id:'terrace'},{type:'site.remove',target:'point',id:'center'}])));
 check(f.state.data.siteModel?.grading.length===0&&f.state.data.siteModel.points.length===4,'Site removal execute updates both measured collections atomically');
 check(f.commits===validCommits+1,'Successful site removal batch commits once');
 check(f.api.describe().commands.includes('site.point')&&f.api.describe().commands.includes('objects.edit'),'Synchronous descriptor exposes lazy edit command families');
 console.log(`Site/object lazy agent edits: ${checks} checks passed`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
