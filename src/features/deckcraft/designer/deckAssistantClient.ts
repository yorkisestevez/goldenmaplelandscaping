import type {AgentRequest,AgentSnapshot} from './deckAgentController';
import type {AssistedSelection} from './naturalLanguageCommands';
import type {ExpertId} from './expertAgents';


export interface AssistantTurn {role:'user'|'assistant';content:string}
/** `cloud-ai`: Claude on the site's server (monthly cap and daily turns apply); `local-ai`: the owner's local model. */
export type AssistantSource='local-ai'|'cloud-ai';
export interface AssistantAvailability {ready:boolean;source:AssistantSource|'exact-only';model?:string;message:string}
export type AssistantInterpretation=
 |{kind:'edit';request:AgentRequest;summary:string[];assumptions:string[];source:AssistantSource|'exact';model?:string;message:string}
 |{kind:'clarify';question:string;choices:string[];source:AssistantSource|'exact';model?:string;message:string}
 |{kind:'advice';message:string;assumptions:string[];question:string;choices:string[];source:AssistantSource|'exact';model?:string};
const ENDPOINT='/.netlify/functions/deck-assistant';
const unavailable='AI interpretation is not connected here. Measured instructions still work; try “make the deck 20 by 14 feet”.';
const boundedText=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):'';
const isSource=(v:unknown):v is AssistantSource=>v==='local-ai'||v==='cloud-ai';
/** The cloud assistant answers a POST with a job to poll (a Claude turn can outlast a 60 s function). */
const POLL_LIMIT_MS=200_000;

async function jsonRequest(method:'GET'|'POST',body:unknown,signal?:AbortSignal,query=''):Promise<Record<string,unknown>>{
 const abort=new AbortController(),cancel=()=>abort.abort(signal?.reason);if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(()=>abort.abort(new DOMException('AI interpretation took too long. Please try again.','TimeoutError')),method==='GET'?(query?15000:6000):65000);
 try{
  const response=await fetch(ENDPOINT+query,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:abort.signal});
  const text=await response.text();if(text.length>65536)throw Error('The assistant returned an oversized response. No edit was applied.');
  let result:unknown;try{result=JSON.parse(text);}catch{throw Error(unavailable);}
  if(!result||typeof result!=='object'||Array.isArray(result))throw Error('The assistant returned an invalid response. No edit was applied.');
  const record=result as Record<string,unknown>;if(!response.ok){const error=record.error as {message?:unknown}|undefined;throw Error(boundedText(error?.message,240)||unavailable);}return record;
 }catch(error){if(abort.signal.aborted)throw abort.signal.reason??new DOMException('Cancelled','AbortError');throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
const wait=(ms:number,signal?:AbortSignal)=>new Promise<void>((resolve,reject)=>{if(signal?.aborted){reject(signal.reason??new DOMException('Cancelled','AbortError'));return;}const t=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve();},ms),stop=()=>{clearTimeout(t);reject(signal!.reason??new DOMException('Cancelled','AbortError'));};signal?.addEventListener('abort',stop,{once:true});});
/** Polls a pending cloud job until it finishes, fails or runs out of time. */
async function untilDone(first:Record<string,unknown>,signal?:AbortSignal):Promise<Record<string,unknown>>{
 let record=first;const started=Date.now();
 while(record.status==='pending'){
  const job=typeof first.job==='string'&&/^[0-9a-f-]{36}$/.test(first.job)?first.job:'';if(!job)throw Error('AI interpretation did not complete. No edit was applied.');
  if(Date.now()-started>POLL_LIMIT_MS)throw Error('AI interpretation took too long. Please try again. No edit was applied.');
  await wait(Math.min(5000,Math.max(1000,Number(record.pollMs)||1500)),signal);
  record=await jsonRequest('GET',undefined,signal,`?job=${job}`);
 }
 return record;
}

export async function checkAssistantAvailability(signal?:AbortSignal):Promise<AssistantAvailability>{
 try{const result=await jsonRequest('GET',undefined,signal);
  if(result.ready===true&&result.source==='local-ai')return {ready:true,source:'local-ai',model:boundedText(result.model,100),message:'AI interpretation is connected on this computer.'};
  if(result.ready===true&&result.source==='cloud-ai')return {ready:true,source:'cloud-ai',model:boundedText(result.model,100),message:'AI interpretation is connected (Claude).'};
  return {ready:false,source:'exact-only',message:boundedText(result.message??result.reason,240)||unavailable};}
 catch(error){if(signal?.aborted)throw error;return {ready:false,source:'exact-only',message:unavailable};}
}

/** Model proposals never directly mutate the design. The UI previews through the existing controller. */
export async function interpretAssistantRequest(text:string,snapshot:AgentSnapshot,selection:AssistedSelection,conversation:AssistantTurn[]=[],signal?:AbortSignal,expert:ExpertId='general'):Promise<AssistantInterpretation>{
 if(signal?.aborted)throw signal.reason??new DOMException('Cancelled','AbortError');
 if(!snapshot.ready)throw Error('Wait until the design has finished restoring.');
 if(typeof text!=='string'||!text.trim()||text.length>1200)throw Error('Describe the change in up to 1,200 characters.');
 if(!Array.isArray(conversation)||conversation.length>8||conversation.some(t=>!t||!['user','assistant'].includes(t.role)||typeof t.content!=='string'||t.content.length>1200)||conversation.reduce((n,t)=>n+t.content.length,0)>8000)throw Error('This conversation is too long. Start a new request.');
 if(!conversation.length){const {parseNaturalLanguageCommands}=await import('./naturalLanguageCommands');if(signal?.aborted)throw signal.reason??new DOMException('Cancelled','AbortError');const exact=parseNaturalLanguageCommands(text,snapshot,selection);if(exact.ok===true)return {kind:'edit',request:exact.request,summary:exact.summary,assumptions:[],source:'exact',message:'Understood as a measured edit.'};if(exact.localOnly)return {kind:'clarify',question:exact.clarification,choices:[],source:'exact',message:exact.clarification};}
 const {buildAssistantContext,parseAssistantPlan,assistantPlanRequest}=await import('./assistantPlan');
 const response=await untilDone(await jsonRequest('POST',{prompt:text.trim(),context:buildAssistantContext(snapshot,selection),conversation:conversation.map(t=>({role:t.role,content:t.content})),expert},signal),signal);
 if(response.ok!==true||!isSource(response.source))throw Error('AI interpretation did not complete. No edit was applied.');
 const source=response.source,parsed=parseAssistantPlan(response.plan);if(parsed.ok===false)throw Error(`The proposed edit was not valid: ${parsed.error}`);
 const plan=parsed.plan,model=boundedText(response.model,100);
 if(plan.kind==='clarify')return {kind:'clarify',question:plan.question,choices:plan.choices,message:plan.message,source,model};
 if(plan.kind==='advice')return {kind:'advice',message:plan.message,assumptions:plan.assumptions,question:plan.question,choices:plan.choices,source,model};
 return {kind:'edit',request:assistantPlanRequest(plan,{id:`assistant-${crypto.randomUUID()}`,expectedRevision:snapshot.revision,snapshot,selection,requestText:text}),summary:[plan.message],assumptions:plan.assumptions,source,model,message:plan.message};
}
