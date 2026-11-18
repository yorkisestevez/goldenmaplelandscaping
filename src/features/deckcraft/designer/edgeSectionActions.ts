import type {DeckData,PrivacyScreen,RailSection} from '../types';
import {buildDeckTakeoff,guardRuns,type DeckTakeoff,type RailRun} from '../deckTakeoff';
import {edgeFacing,type PlanPoint} from '../lib/deckGeometry';
import {edgeSectionId} from '../lib/edgeSections';
import {validateDesign} from '../designPersistence';
import {extrasLayout} from '../extrasLayout';
import {syncAutoLighting} from '../lightingSystem';
import {migrateLegacyPrivacy,MAX_PRIVACY_SCREENS,screenLengthIn} from '../privacyScreens';

export interface EdgeInterval {startPct:number;endPct:number}
export interface EdgeSectionEdge {id:string;level:1|2|3;edgeId:string;label:string;a:PlanPoint;b:PlanPoint;lengthIn:number;eligible:EdgeInterval[];railings:EdgeInterval[]}
export type EdgeSectionEdit=
 |{action:'rail';level:1|2|3;edgeId:string;startPct:number;endPct:number;enabled:boolean}
 |{action:'screen-add';level:1|2|3;edgeId:string;startPct:number;endPct:number;heightFt?:4|5|6}
 |{action:'screen-toggle';id:string;enabled:boolean}
 |{action:'screen-remove';id:string}
 |{action:'rail-reset';level:1|2|3;edgeId:string}
 |{action:'rail-remove';id:string};
export type EdgeSectionResult={ok:true;patch:Partial<DeckData>;message:string;selectedScreenId?:string}|{ok:false;error:string};
const EPS=.000001;
const unique=(prefix:string,ids:readonly string[])=>{let n=1;while(ids.includes(`${prefix}-${n}`))n++;return `${prefix}-${n}`;};
function merge(ranges:EdgeInterval[]):EdgeInterval[]{const result:EdgeInterval[]=[];for(const r of ranges.sort((a,b)=>a.startPct-b.startPct)){const prev=result.at(-1);if(prev&&r.startPct<=prev.endPct+EPS)prev.endPct=Math.max(prev.endPct,r.endPct);else result.push({...r});}return result;}
function projected(runs:RailRun[],a:PlanPoint,b:PlanPoint,top:number):EdgeInterval[]{
 const dx=b.x-a.x,dz=b.y-a.y,len=Math.hypot(dx,dz),len2=len*len;
 return merge(runs.flatMap(r=>{if(Math.abs(r.a.y-top)>.01||Math.abs(r.b.y-top)>.01)return [];const cross=(p:typeof r.a)=>Math.abs((p.x-a.x)*dz-(p.z-a.y)*dx)/len;if(cross(r.a)>.05||cross(r.b)>.05)return [];const t=(p:typeof r.a)=>((p.x-a.x)*dx+(p.z-a.y)*dz)/len2*100;const startPct=Math.max(0,Math.min(t(r.a),t(r.b))),endPct=Math.min(100,Math.max(t(r.a),t(r.b)));return endPct-startPct>EPS?[{startPct,endPct}]:[];}));
}
/** Physical deck edges in world-plan inches. Eligibility comes from unmodified real guards after house, stair and level cuts. */
export function listEdgeSections(data:DeckData,model:DeckTakeoff):EdgeSectionEdge[]{
 const baseline=buildDeckTakeoff({...data,railSections:undefined,railDefault:undefined,railingType:data.railingType==='None'?'Aluminum':data.railingType}),eligible=guardRuns(baseline),actual=guardRuns(model);
 return baseline.levels.filter(l=>l.kind==='deck'&&l.index!==undefined&&l.index<3).flatMap(l=>l.footprint.outline.flatMap((p,i)=>{const q=l.footprint.outline[(i+1)%l.footprint.outline.length],a={x:p.x+l.offset.x,y:p.y+l.offset.z},b={x:q.x+l.offset.x,y:q.y+l.offset.z},lengthIn=Math.hypot(b.x-a.x,b.y-a.y);if(lengthIn<.01)return [];const level=(l.index!+1) as 1|2|3,edgeId=edgeSectionId(l.footprint,i),side=edgeFacing({x:(b.y-a.y)/lengthIn,y:-(b.x-a.x)/lengthIn});return [{id:`${level}:${edgeId}`,level,edgeId,label:`${level===1?'Main deck':`Level ${level}`} - ${side} edge ${i+1}`,a,b,lengthIn,eligible:projected(eligible,a,b,l.top),railings:projected(actual,a,b,l.top)}];}));
}
function fields(edit:unknown):Record<string,unknown>{
 if(!edit||typeof edit!=='object'||Array.isArray(edit)||![Object.prototype,null].includes(Object.getPrototypeOf(edit))||Object.getOwnPropertySymbols(edit).length)throw Error('Provide a plain section operation.');
 const descriptors=Object.getOwnPropertyDescriptors(edit);for(const [key,d] of Object.entries(descriptors))if(!('value'in d)||!d.enumerable)throw Error(`Unsupported section field: ${key}.`);
 const action=descriptors.action?.value,allowed:Record<string,string[]>={rail:['action','level','edgeId','startPct','endPct','enabled'],'screen-add':['action','level','edgeId','startPct','endPct','heightFt'],'screen-toggle':['action','id','enabled'],'screen-remove':['action','id'],'rail-reset':['action','level','edgeId'],'rail-remove':['action','id']};
 if(typeof action!=='string'||!Object.hasOwn(allowed,action))throw Error('Choose a supported railing or screen operation.');for(const key of Object.keys(descriptors))if(!allowed[action].includes(key))throw Error(`Unsupported section field: ${key}.`);return edit as Record<string,unknown>;
}
function interval(edit:Record<string,unknown>):EdgeInterval {const {startPct,endPct}=edit;if(typeof startPct!=='number'||typeof endPct!=='number'||!Number.isFinite(startPct)||!Number.isFinite(endPct)||startPct<0||endPct>100||endPct-startPct<=EPS)throw Error('Choose a finite section from 0 to 100%, with its end after its start.');return {startPct,endPct};}
function covers(edge:EdgeSectionEdge,range:EdgeInterval){return edge.eligible.some(r=>range.startPct>=r.startPct-EPS&&range.endPct<=r.endPct+EPS);}
function cleanPatch(data:DeckData,patch:Partial<DeckData>):Partial<DeckData>{const normalized=validateDesign({...data,...patch}),result:Partial<DeckData>={};for(const key of Object.keys(patch) as (keyof DeckData)[])(result as Record<string,unknown>)[key]=normalized[key];return result;}
function screenClear(candidate:DeckData,id:string,prior:DeckData){
 const screen=candidate.privacyScreens?.find(s=>s.id===id);if(!screen||screen.enabled===false)return;
 const layout=extrasLayout(candidate,buildDeckTakeoff(candidate)),actual=layout.screenHandles,handle=actual.find(h=>h.id===id);
 const index=candidate.privacyScreens!.findIndex(s=>s.id===id),warning=layout.warnings.find(w=>w.startsWith(`Privacy screen ${index+1} (`));
 if(!handle||Math.abs(handle.w-screenLengthIn(screen))>.01)throw Error(warning??'This screen does not fit its exposed edge without clipping. Shorten it or choose a clear section.');
 const previous=extrasLayout(prior,buildDeckTakeoff(prior)).screenHandles;
 if(previous.some(h=>h.id!==id&&candidate.privacyScreens?.some(s=>s.id===h.id&&s.enabled!==false)&&!actual.some(a=>a.id===h.id)))throw Error('This screen overlaps another enabled screen on the same level. Choose a clear section.');
 const line=(h:typeof handle)=>{const dx=Math.cos(h!.angle)*h!.w/2,dz=-Math.sin(h!.angle)*h!.w/2;return [{x:h!.x-dx,y:h!.z-dz},{x:h!.x+dx,y:h!.z+dz}] as [PlanPoint,PlanPoint];};
 const [a,b]=line(handle),cross=(p:PlanPoint,q:PlanPoint,r:PlanPoint)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
 for(const other of actual){if(other.id===id||Math.abs(handle.y-handle.h/2-(other.y-other.h/2))>.1)continue;const [c,d]=line(other),parallel=Math.abs(Math.cos(handle.angle-other.angle))>.9999;
  if(parallel){const dx=other.x-handle.x,dz=other.z-handle.z,normal=dx*Math.sin(handle.angle)+dz*Math.cos(handle.angle),along=dx*Math.cos(handle.angle)-dz*Math.sin(handle.angle);if(Math.abs(normal)<.1&&Math.abs(along)+.01<(handle.w+other.w)/2)throw Error('This screen overlaps another enabled screen on the same level. Choose a clear section.');}
  else if(cross(a,b,c)*cross(a,b,d)<-EPS&&cross(c,d,a)*cross(c,d,b)<-EPS)throw Error('This screen crosses another enabled screen on the same level. Choose a clear section.');
 }

}
/** All-or-nothing operation; changed public fields and actual mount-count lighting sync commit in one history step. */
export function applyEdgeSectionEdit(data:DeckData,model:DeckTakeoff,edit:EdgeSectionEdit):EdgeSectionResult {
 try{
  const input=fields(edit),action=input.action;let patch:Partial<DeckData>={},selectedScreenId:string|undefined,message='';
  if(action==='rail-remove'){
   if(typeof input.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(input.id)||!data.railSections?.some(s=>s.id===input.id))throw Error('That railing override is no longer in this design. Select it again.');patch.railSections=data.railSections.filter(s=>s.id!==input.id);message='Removed the saved railing section definition. Its edge now follows the default setting.';
  }else if(action==='screen-toggle'||action==='screen-remove'){
   if(typeof input.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(input.id))throw Error('Choose a current privacy screen.');const screens=data.privacyScreens??[],screen=screens.find(s=>s.id===input.id);if(!screen)throw Error('That screen is no longer in this design. Select it again.');
   if(action==='screen-toggle'){if(typeof input.enabled!=='boolean')throw Error('Choose whether the screen is on or off.');patch.privacyScreens=screens.map(s=>s.id===screen.id?{...s,enabled:input.enabled as boolean}:s);selectedScreenId=screen.id;message=`Privacy screen ${input.enabled?'enabled':'disabled'}; its saved product and dimensions are retained.`;}else{patch.privacyScreens=screens.filter(s=>s.id!==screen.id);message='Removed the selected privacy screen.';}
   patch.privacySqft=0;
  }else{
   if(![1,2,3].includes(input.level as number)||typeof input.edgeId!=='string')throw Error('Choose an actual deck level and edge.');const edge=listEdgeSections(data,model).find(e=>e.level===input.level&&e.edgeId===input.edgeId);if(!edge)throw Error('That edge is no longer in the current deck. Select it again.');
   if(action==='rail-reset'){patch.railSections=(data.railSections??[]).filter(s=>s.level!==edge.level||s.edgeId!==edge.edgeId);message='Restored this edge to the current default railing setting.';}
   else {const range=interval(input);
    if(action==='rail'){
     if(typeof input.enabled!=='boolean')throw Error('Choose whether the railing section is enabled.');const spans=edge.eligible.flatMap(r=>{const startPct=Math.max(range.startPct,r.startPct),endPct=Math.min(range.endPct,r.endPct);return endPct-startPct>EPS?[{startPct,endPct}]:[];});if(!spans.length)throw Error('This section is blocked by the house, stairs or a level connection. Choose an exposed section.');
     let sections:RailSection[]=[...(data.railSections??[])];for(const span of spans){const next:RailSection[]=[];for(const prior of sections){if(prior.level!==edge.level||prior.edgeId!==edge.edgeId||prior.endPct<=span.startPct+EPS||prior.startPct>=span.endPct-EPS){next.push(prior);continue;}if(prior.startPct<span.startPct-EPS)next.push({...prior,endPct:span.startPct});if(prior.endPct>span.endPct+EPS){const id=unique('rail-section',[...sections,...next].map(s=>s.id));next.push({...prior,id,startPct:span.endPct});}}const id=unique('rail-section',[...sections,...next].map(s=>s.id));next.push({id,level:edge.level,edgeId:edge.edgeId,...span,enabled:input.enabled});sections=next;}
     if(sections.length>64)throw Error('A design supports up to 64 separate railing overrides. Restore an edge before adding more.');patch.railSections=sections;
     if(input.enabled&&data.railingType==='None'){patch.railingType='Aluminum';patch.railDefault=false;}
     const length=spans.reduce((sum,r)=>sum+(r.endPct-r.startPct)/100*edge.lengthIn,0)/12;message=`${input.enabled?'Added':'Removed'} railing on ${length.toFixed(2)} ft of exposed edge. House, stair and level openings stay clear.`;
    }else{
     if(input.heightFt!==undefined&&![4,5,6].includes(input.heightFt as number))throw Error('Choose a screen height of 4, 5 or 6 feet.');if(!covers(edge,range))throw Error('A privacy screen must stay within one clear exposed section, away from the house, stairs and level openings.');
     const lengthFt=edge.lengthIn*(range.endPct-range.startPct)/1200;if(lengthFt<=0||lengthFt>60)throw Error('A privacy screen must be no longer than 60 feet.');const screens=data.privacyScreens??migrateLegacyPrivacy(data);if(screens.length>=MAX_PRIVACY_SCREENS)throw Error(`A design supports up to ${MAX_PRIVACY_SCREENS} privacy screens.`);const id=unique('edge-screen',screens.map(s=>s.id)),dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,side=edgeFacing({x:dy/edge.lengthIn,y:-dx/edge.lengthIn}),roomPct=100-(range.endPct-range.startPct),offsetPct=roomPct>EPS?range.startPct/roomPct*100:0;
     const screen:PrivacyScreen={id,side,level:edge.level,edgeId:edge.edgeId,lengthFt,heightFt:(input.heightFt??6) as 4|5|6,offsetPct,lights:false,enabled:true};patch={privacyScreens:[...screens,screen],privacySqft:0};selectedScreenId=id;message=`Added a ${lengthFt.toFixed(2)} ft privacy screen on the selected physical edge.`;
    }
   }
  }
  if(action==='rail'||action==='rail-reset'||action==='rail-remove')patch.railingLf=0;
  const normalized=cleanPatch(data,patch),candidate={...data,...normalized};if(selectedScreenId&&candidate.privacyScreens?.find(s=>s.id===selectedScreenId)?.enabled!==false){const screen=candidate.privacyScreens!.find(s=>s.id===selectedScreenId)!;if(screen.edgeId){const edge=listEdgeSections(candidate,buildDeckTakeoff(candidate)).find(e=>e.level===(screen.level??1)&&e.edgeId===screen.edgeId);if(!edge)throw Error('This saved screen edge is no longer present. Restore its edge before enabling it.');const widthPct=screenLengthIn(screen)/edge.lengthIn*100,startPct=(100-widthPct)*screen.offsetPct/100;if(!covers(edge,{startPct,endPct:startPct+widthPct}))throw Error('This screen is blocked by the house, stairs or a level opening. Choose a clear section before enabling it.');}screenClear(candidate,selectedScreenId,data);}
  const finalModel=buildDeckTakeoff(candidate),finalExtras=extrasLayout(candidate,finalModel),selectedItems=syncAutoLighting(candidate,{posts:finalModel.railing.posts.length,stairs:finalModel.treads.length,privacy:finalExtras.privacyMounts.length,border:finalExtras.borderMounts.length});
  if(JSON.stringify(selectedItems)!==JSON.stringify(candidate.lightingSystem.selectedItems))normalized.lightingSystem={...candidate.lightingSystem,selectedItems};
  return {ok:true,patch:normalized,message,...(selectedScreenId?{selectedScreenId}:{})};
 }catch(error){return {ok:false,error:error instanceof Error?error.message:'The edge section edit could not be applied.'};}
}
