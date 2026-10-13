/**
 * Browser client of the AI Site Designer (lazy: import it dynamically). The UI calls runDesignerTurn(): the engine
 * composes its concepts, the AI (Claude on the site's server, or the owner's local model) chooses one and tunes it,
 * the engine rebuilds and prices that choice (conceptFromChoice), and when the engine finds problems the AI gets
 * exactly one revision turn. Whatever happens, the engine's own concepts remain available: when the AI is not
 * configured, over its monthly budget, out of turns for today, or cannot produce a valid choice, the result says so
 * and carries the engine's concepts unchanged. Nothing is applied here: the UI previews the concept's patch.
 */
import type {DeckData} from '../types';
import type {SiteBrief} from '../siteBrief';
import type {SiteConcept,SiteGoal} from '../siteConcepts';
import type {DesignerAiConceptSummary,DesignerAiRequest,DesignerAiResponse,DesignerAiStatus,DesignerAiTurn} from './siteDesignerAiContract';
import {moveParamAllowed} from '../siteMoveParams';
import {internalModeOn} from '../internalMode';

export const DESIGNER_AI_ENDPOINT='/.netlify/functions/deck-designer-ai';
type Reason=NonNullable<DesignerAiStatus['reason']>;
/** Why the AI could not answer; `reason` maps onto DesignerAiStatus so the panel can say it plainly. */
export class DesignerAiError extends Error {constructor(public reason:Reason,message:string,public code:string){super(message);this.name='DesignerAiError';}}
const REASONS:Record<string,Reason>={not_configured:'not_configured',cap_reached:'cap_reached',rate_limited:'rate_limited'};
const FALLBACK_MESSAGE='The AI designer is not available right now. The engine’s concepts still work.';
const bounded=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
const cancelled=(signal?:AbortSignal)=>signal?.reason??new DOMException('Cancelled','AbortError');
const wait=(ms:number,signal?:AbortSignal)=>new Promise<void>((resolve,reject)=>{if(signal?.aborted){reject(cancelled(signal));return;}const t=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve();},ms),stop=()=>{clearTimeout(t);reject(cancelled(signal));};signal?.addEventListener('abort',stop,{once:true});});

export interface DesignerAiClientOptions {fetch?:typeof globalThis.fetch;
 /** How long to wait for a turn in all (default 240 s: a design turn at high effort can take a minute or two). */
 timeoutMs?:number}
async function call(method:'GET'|'POST',query:string,body:unknown,signal:AbortSignal|undefined,opts:DesignerAiClientOptions,timeoutMs:number):Promise<{status:number;record:Record<string,unknown>}>{
 const abort=new AbortController(),cancel=()=>abort.abort(cancelled(signal));if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(()=>abort.abort(new DOMException('The AI designer took too long.','TimeoutError')),timeoutMs);
 try{
  const response=await (opts.fetch??globalThis.fetch)(DESIGNER_AI_ENDPOINT+query,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:abort.signal});
  const text=await response.text();if(text.length>65536)throw new DesignerAiError('unavailable','The AI designer returned an oversized answer.','oversized');
  let record:unknown;try{record=JSON.parse(text);}catch{throw new DesignerAiError('unavailable',FALLBACK_MESSAGE,'invalid_json');}
  if(!record||typeof record!=='object'||Array.isArray(record))throw new DesignerAiError('unavailable',FALLBACK_MESSAGE,'invalid_json');
  return {status:response.status,record:record as Record<string,unknown>};
 }catch(e){if(signal?.aborted)throw cancelled(signal);if(e instanceof DesignerAiError)throw e;if(abort.signal.aborted)throw new DesignerAiError('unavailable','The AI designer took too long. The engine’s concepts still work.','ai_timeout');throw new DesignerAiError('unavailable',FALLBACK_MESSAGE,'network');}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
function failure(status:number,record:Record<string,unknown>):DesignerAiError{
 const error=(record.error??{}) as {code?:unknown;message?:unknown},code=typeof error.code==='string'?error.code:`http_${status}`;
 return new DesignerAiError(REASONS[code]??'unavailable',bounded(error.message,300)||FALLBACK_MESSAGE,code);
}

/** Whether the AI designer can be asked now (configured, under the monthly cap, turns left today). */
export async function designerAiStatus(signal?:AbortSignal,opts:DesignerAiClientOptions={}):Promise<DesignerAiStatus>{
 if(internalModeOn())return {available:false,reason:'unavailable'};
 try{const {record}=await call('GET','',undefined,signal,opts,8000);
  if(record.available===true)return {available:true,...(typeof record.remainingTurnsToday==='number'?{remainingTurnsToday:record.remainingTurnsToday}:{})};
  const reason=typeof record.reason==='string'&&['not_configured','cap_reached','rate_limited','unavailable'].includes(record.reason)?record.reason as Reason:'unavailable';
  return {available:false,reason};}
 catch(e){if(signal?.aborted)throw e;return {available:false,reason:e instanceof DesignerAiError?e.reason:'unavailable'};}
}

function checkResponse(v:unknown):DesignerAiResponse{
 const r=v as DesignerAiResponse|undefined;
 if(!r||(r.kind!=='choice'&&r.kind!=='clarify')||typeof r.explanation!=='string'||!Array.isArray(r.highlights)||r.kind==='choice'&&(!r.choice||typeof r.choice.base!=='string'||!Array.isArray(r.choice.include)||!r.choice.params||typeof r.choice.params!=='object'))throw new DesignerAiError('unavailable','The AI designer returned an answer the engine cannot use.','invalid_ai_response');
 return r;
}
/** One AI turn: POST, then poll the job until the answer is ready. Throws DesignerAiError (never a raw fetch error). */
export async function askDesignerAi(req:DesignerAiRequest,signal?:AbortSignal,opts:DesignerAiClientOptions={}):Promise<DesignerAiResponse>{
 if(internalModeOn())throw new DesignerAiError('unavailable','Internal mode is on. This turn was not sent to the AI.','internal_mode');
 const deadline=Date.now()+(opts.timeoutMs??240_000);
 let {status,record}=await call('POST','',req,signal,opts,30_000);
 if(status>=400||record.ok!==true)throw failure(status,record);
 const job=typeof record.job==='string'&&/^[0-9a-f-]{36}$/.test(record.job)?record.job:'';
 while(record.status==='pending'){
  if(!job)throw new DesignerAiError('unavailable',FALLBACK_MESSAGE,'no_job');
  if(Date.now()>deadline)throw new DesignerAiError('unavailable','The AI designer took too long. The engine’s concepts still work.','ai_timeout');
  await wait(Math.min(5000,Math.max(750,Number(record.pollMs)||1500)),signal);
  ({status,record}=await call('GET',`?job=${job}`,undefined,signal,opts,20_000));
  if(status>=400||record.ok!==true)throw failure(status,record);
 }
 if(record.status!=='done')throw new DesignerAiError('unavailable',FALLBACK_MESSAGE,'unknown_status');
 return checkResponse(record.response);
}

/** The engine's concepts as the AI sees them: only bounded, tunable params; labels of quoted items are not sent. */
export function conceptSummaries(concepts:SiteConcept[]):DesignerAiConceptSummary[]{
 return concepts.slice(0,3).map(c=>({id:c.id,title:c.title.slice(0,120),goal:c.goal,
  moves:c.moves.map(m=>({kind:m.kind,title:m.title.slice(0,160),params:Object.fromEntries(Object.entries(m.params).filter(([k,v])=>moveParamAllowed(m.kind,k,v)))})),
  skipped:c.skipped.slice(0,8).map(s=>({kind:s.kind,reason:s.reason.slice(0,600)})),
  subtotal:Math.max(0,c.subtotal),delta:c.delta,newQuotes:c.newQuotes.length,scores:{cost:c.scores.cost,execution:c.scores.execution,trend:c.scores.trend},
  reasons:c.reasons.slice(0,12).map(r=>r.slice(0,700))}));
}
/** The brief within the 4 KB the server accepts (siteBrief aims for it; the plain-words lines go first if not). */
export function fitBrief(brief:SiteBrief):SiteBrief{
 const size=(b:SiteBrief)=>new TextEncoder().encode(JSON.stringify(b)).length;let b=brief;
 while(size(b)>4096&&b.lines.length)b={...b,lines:b.lines.slice(0,-1)};
 if(size(b)>4096)b={...b,designWarnings:b.designWarnings.slice(0,2),coverageWarnings:b.coverageWarnings.slice(0,2)};
 return b;
}

export interface DesignerTurnOptions {
 /** The most to add to the design as it stands (CAD before HST). */
 budget?:number;goals?:SiteGoal[];northDeg?:number;
 /** Earlier turns of this design conversation (at most eight). */
 conversation?:DesignerAiTurn[];signal?:AbortSignal;onProgress?:(done:number,total:number)=>void;
 /** Replaces askDesignerAi (tests, previews). */
 ask?:(req:DesignerAiRequest,signal?:AbortSignal)=>Promise<DesignerAiResponse>}
export interface DesignerTurnResult {
 /** designed: the AI's choice, built and valid. clarify: the AI asks first. fallback: the AI's choice could not be made
  * valid in its one revision, so `concept` is the engine's own concept it started from. engine-only: no AI (see
  * reason). pending: no measured site yet. */
 status:'designed'|'clarify'|'fallback'|'engine-only'|'pending';
 /** The concept to preview and apply (its patch, subtotal, quotes, validation), or null. */
 concept:SiteConcept|null;
 /** The engine's concepts, always. */
 concepts:SiteConcept[];
 /** The AI answer behind `concept` (the revision's when there was one). */
 response:DesignerAiResponse|null;
 explanation:string;highlights:string[];questions:string[];
 /** What the engine found wrong with the AI's choice (empty when it stood). */
 findings:string[];revised:boolean;
 reason?:DesignerAiStatus['reason'];message?:string;warnings:string[];
 brief:SiteBrief|null;baseline?:{subtotal:number;quotes:string[]}}

/** The whole designer turn the panel runs: engine concepts → AI choice → engine rebuild → at most one revision. */
export async function runDesignerTurn(data:DeckData,prompt:string,opts:DesignerTurnOptions={}):Promise<DesignerTurnResult>{
 const {siteConcepts,conceptFromChoice}=await import('../siteConcepts');
 const engine=await siteConcepts(data,{...(opts.budget!==undefined?{budget:opts.budget}:{}),...(opts.goals?{goals:opts.goals}:{}),...(opts.northDeg!==undefined?{northDeg:opts.northDeg}:{}),...(opts.signal?{signal:opts.signal}:{}),...(opts.onProgress?{onProgress:opts.onProgress}:{})});
 const base={concepts:engine.concepts,brief:engine.brief,...(engine.baseline?{baseline:engine.baseline}:{}),warnings:[...engine.warnings],findings:[] as string[],revised:false,highlights:[] as string[],questions:[] as string[]};
 if(engine.status==='pending'||!engine.brief)return {...base,status:'pending',concept:null,response:null,explanation:''};
 if(!engine.concepts.length)return {...base,status:'engine-only',concept:null,response:null,explanation:'',message:'No concept fits the measured ground yet, so there is nothing for the AI to choose from.'};
 const ask=opts.ask??((req:DesignerAiRequest,signal?:AbortSignal)=>askDesignerAi(req,signal));
 const words=(prompt??'').trim().slice(0,2000)||'Suggest the best design for this yard.';
 const req:DesignerAiRequest={version:1,mode:'design',prompt:words,brief:fitBrief(engine.brief),concepts:conceptSummaries(engine.concepts),
  baseline:{subtotal:Math.max(0,engine.baseline?.subtotal??0),quoteCount:engine.baseline?.quotes.length??0},
  ...(opts.budget!==undefined?{budget:opts.budget}:{}),...(opts.goals?.length?{goals:opts.goals.slice(0,3)}:{}),...(opts.conversation?.length?{conversation:opts.conversation.slice(-8)}:{})};
 const engineOnly=(e:unknown):DesignerTurnResult=>{if(opts.signal?.aborted)throw cancelled(opts.signal);const x=e instanceof DesignerAiError?e:new DesignerAiError('unavailable',FALLBACK_MESSAGE,'error');return {...base,status:'engine-only',concept:null,response:null,explanation:'',reason:x.reason,message:x.message};};
 const clarify=(r:DesignerAiResponse,revised:boolean,findings:string[]=[]):DesignerTurnResult=>({...base,status:'clarify',concept:null,response:r,explanation:r.explanation,highlights:r.highlights,questions:r.questions??[],findings,revised});
 const rebuild=(r:DesignerAiResponse)=>conceptFromChoice(data,r.choice!,{...(opts.budget!==undefined?{budget:opts.budget}:{}),...(opts.northDeg!==undefined?{northDeg:opts.northDeg}:{}),...(opts.signal?{signal:opts.signal}:{})});
 let first:DesignerAiResponse;try{first=await ask(req,opts.signal);}catch(e){return engineOnly(e);}
 if(first.kind==='clarify'||!first.choice)return clarify(first,false);
 const built=await rebuild(first);
 if(built.status==='pending')return {...base,status:'pending',concept:null,response:first,explanation:first.explanation,warnings:[...base.warnings,...built.warnings]};
 if(built.concept&&!built.findings.length)return {...base,status:'designed',concept:built.concept,response:first,explanation:first.explanation,highlights:first.highlights,questions:first.questions??[],warnings:[...base.warnings,...built.warnings]};
 // One revision: the engine's findings go back once.
 const findings=(built.findings.length?built.findings:['None of the chosen moves could be placed.']).slice(0,12).map(f=>f.slice(0,400));
 const fallback=(why:string,r:DesignerAiResponse|null,f:string[]):DesignerTurnResult=>{const own=engine.concepts.find(c=>c.id===first.choice!.base)??engine.concepts[0];
  return {...base,status:'fallback',concept:own,response:r,explanation:'',findings:f,revised:!!r&&r!==first,message:why};};
 let second:DesignerAiResponse;
 try{second=await ask({...req,mode:'revise',previous:{choice:first.choice,findings}},opts.signal);}
 catch(e){if(opts.signal?.aborted)throw cancelled(opts.signal);return fallback('The AI’s design needed changes it could not make just now, so this is the engine’s own concept it started from.',null,findings);}
 if(second.kind==='clarify'||!second.choice)return clarify(second,true,findings);
 const again=await rebuild(second);
 if(again.status==='pending')return {...base,status:'pending',concept:null,response:second,explanation:second.explanation,findings};
 if(again.concept&&!again.findings.length)return {...base,status:'designed',concept:again.concept,response:second,explanation:second.explanation,highlights:second.highlights,questions:second.questions??[],findings,revised:true,warnings:[...base.warnings,...again.warnings]};
 return fallback('The AI’s revised design still did not check out on the measured ground, so this is the engine’s own concept it started from.',second,again.findings.length?again.findings:findings);
}
