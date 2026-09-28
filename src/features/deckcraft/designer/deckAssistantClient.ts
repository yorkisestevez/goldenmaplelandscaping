import type {AgentRequest,AgentSnapshot} from './deckAgentController';
import {parseNaturalLanguageCommands,type AssistedSelection} from './naturalLanguageCommands';
import {buildAssistantContext,parseAssistantPlan,assistantPlanRequest} from './assistantPlan';

export interface AssistantTurn {role:'user'|'assistant';content:string}
export interface AssistantAvailability {ready:boolean;source:'local-ai'|'exact-only';model?:string;message:string}
export type AssistantInterpretation=
 |{kind:'edit';request:AgentRequest;summary:string[];assumptions:string[];source:'local-ai'|'exact';model?:string;message:string}
 |{kind:'clarify';question:string;choices:string[];source:'local-ai'|'exact';model?:string;message:string};
const ENDPOINT='/.netlify/functions/deck-assistant';
const unavailable='AI interpretation is not connected here. Measured instructions still work; try “make the deck 20 by 14 feet”.';
const boundedText=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):'';

async function jsonRequest(method:'GET'|'POST',body:unknown,signal?:AbortSignal):Promise<Record<string,unknown>>{
 const abort=new AbortController(),cancel=()=>abort.abort(signal?.reason);if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(()=>abort.abort(new DOMException('AI interpretation took too long. Please try again.','TimeoutError')),method==='GET'?6000:65000);
 try{
  const response=await fetch(ENDPOINT,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:abort.signal});
  const text=await response.text();if(text.length>65536)throw Error('The assistant returned an oversized response. No edit was applied.');
  let result:unknown;try{result=JSON.parse(text);}catch{throw Error(unavailable);}
  if(!result||typeof result!=='object'||Array.isArray(result))throw Error('The assistant returned an invalid response. No edit was applied.');
  const record=result as Record<string,unknown>;if(!response.ok){const error=record.error as {message?:unknown}|undefined;throw Error(boundedText(error?.message,240)||unavailable);}return record;
 }catch(error){if(abort.signal.aborted)throw abort.signal.reason??new DOMException('Cancelled','AbortError');throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}

export async function checkAssistantAvailability(signal?:AbortSignal):Promise<AssistantAvailability>{
 try{const result=await jsonRequest('GET',undefined,signal);if(result.ready===true&&result.source==='local-ai')return {ready:true,source:'local-ai',model:boundedText(result.model,100),message:'AI interpretation is connected on this computer.'};return {ready:false,source:'exact-only',message:boundedText(result.message??result.reason,240)||unavailable};}
 catch(error){if(signal?.aborted)throw error;return {ready:false,source:'exact-only',message:unavailable};}
}

/** Model proposals never directly mutate the design. The UI previews through the existing controller. */
export async function interpretAssistantRequest(text:string,snapshot:AgentSnapshot,selection:AssistedSelection,conversation:AssistantTurn[]=[],signal?:AbortSignal):Promise<AssistantInterpretation>{
 if(signal?.aborted)throw signal.reason??new DOMException('Cancelled','AbortError');
 if(!snapshot.ready)throw Error('Wait until the design has finished restoring.');
 if(typeof text!=='string'||!text.trim()||text.length>1200)throw Error('Describe the change in up to 1,200 characters.');
 if(!Array.isArray(conversation)||conversation.length>8||conversation.some(t=>!t||!['user','assistant'].includes(t.role)||typeof t.content!=='string'||t.content.length>1200)||conversation.reduce((n,t)=>n+t.content.length,0)>8000)throw Error('This conversation is too long. Start a new request.');
 if(!conversation.length){const exact=parseNaturalLanguageCommands(text,snapshot,selection);if(exact.ok===true)return {kind:'edit',request:exact.request,summary:exact.summary,assumptions:[],source:'exact',message:'Understood as a measured edit.'};}
 const response=await jsonRequest('POST',{prompt:text.trim(),context:buildAssistantContext(snapshot,selection),conversation:conversation.map(t=>({role:t.role,content:t.content}))},signal);
 if(response.ok!==true||response.source!=='local-ai')throw Error('AI interpretation did not complete. No edit was applied.');
 const parsed=parseAssistantPlan(response.plan);if(parsed.ok===false)throw Error(`The proposed edit was not valid: ${parsed.error}`);
 const plan=parsed.plan,model=boundedText(response.model,100);
 if(plan.kind==='clarify')return {kind:'clarify',question:plan.question,choices:plan.choices,message:plan.message,source:'local-ai',model};
 return {kind:'edit',request:assistantPlanRequest(plan,{id:`assistant-${crypto.randomUUID()}`,expectedRevision:snapshot.revision,snapshot,selection,requestText:text}),summary:[plan.message],assumptions:plan.assumptions,source:'local-ai',model,message:plan.message};
}
