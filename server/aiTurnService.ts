/**
 * The cloud AI turn service behind /.netlify/functions/deck-designer-ai (the AI Site Designer) and, when Claude is
 * configured, /.netlify/functions/deck-assistant (the edit assistant).
 *
 * Netlify limits (docs.netlify.com, checked 2026-10-06): synchronous functions and streamed responses stop at 60 s
 * (not configurable); background functions run up to 15 min, answer 202 at once, accept 256 KB and are retried twice
 * on failure. A Claude Opus 5.5 turn at effort high can take 30–90 s, so a turn is a job: POST validates the request,
 * counts the visitor's turn, reserves the worst-case cost against the monthly cap, stores a job record in Netlify
 * Blobs and hands its id to the background function (deck-ai-background), then answers 202 with the job id; the
 * browser polls GET ?job=. The background function claims the job (ETag compare-and-swap, so a retry never calls the
 * model twice), calls the model, settles the real cost and stores the validated result. It never throws.
 *
 * Same-origin only (Origin and Sec-Fetch-Site checked, JSON content type required); jobs belong to the visitor that
 * made them (first-party cookie or hashed IP); the background function also needs the job's random dispatch token.
 */
import {randomBytes,randomUUID} from 'node:crypto';
import type {DesignerAiRequest,DesignerAiStatus} from '../src/features/deckcraft/designer/siteDesignerAiContract';
import {aiLimitsFromEnv,blobsKv,createSpendLedger,createVisitorLimiter,fileKv,sameToken,type AiKv,type SpendLedger,type VisitorId,type VisitorLimiter} from './aiSpendLedger';
import {AiError,DESIGNER_LIMITS,DESIGNER_RESPONSE_SCHEMA,DESIGNER_SYSTEM_PROMPT,claudeProvider,designerTask,ollamaProvider,parseDesignerOutput,validateDesignerRequest,type AiProvider,type AiTask,type ClaudeClientLike} from './siteDesignerAi';
import {assistantTask,parseAssistantCloudInput,parseAssistantOutput,ASSISTANT_CLOUD_SYSTEM,ASSISTANT_WIRE_SCHEMA,ASSISTANT_CLOUD_LIMITS} from './deckAssistantCloud';
import {DECK_ASSISTANT_PATH,createDeckAssistantService,unconfiguredDeckAssistant} from './deckAssistantBackend';

export const DESIGNER_AI_PATH='/.netlify/functions/deck-designer-ai';
export const AI_BACKGROUND_PATH='/.netlify/functions/deck-ai-background';
export const VISITOR_COOKIE='dc_ai';
/** A job not finished by then died with its background run (15 min limit). */
export const JOB_EXPIRY_MS=16*60_000;
const MODEL_TIMEOUT_MS=12*60_000,POLL_MS=1500;
type Route='designer'|'assistant';
interface Job {v:1;id:string;route:Route;status:'queued'|'running'|'done'|'error';owner:string;token:string;createdAt:number;updatedAt:number;
 month:string;reservedUsd:number;remainingTurnsToday:number;input:unknown;result?:unknown;error?:{code:string;message:string};model?:string|null;costUsd?:number|null}

export interface AiRuntime {provider:AiProvider|null;kv:AiKv;ledger:SpendLedger;limiter:VisitorLimiter;
 /** Starts a queued job: the background function in production, the same process locally. */
 dispatch(job:{id:string;token:string},origin:string):Promise<void>;now:()=>number;log:(line:string)=>void}

const MESSAGES:Record<string,{status:number;message:string}>={
 not_configured:{status:503,message:'The AI is not switched on here. The engine’s concepts and measured edits still work.'},
 cap_reached:{status:503,message:'The AI has reached this month’s budget. The engine’s concepts and measured edits still work.'},
 rate_limited:{status:429,message:'You have used today’s AI turns. They reset tomorrow; the engine’s concepts still work.'},
 busy:{status:503,message:'The AI is busy. Try again in a minute.'},
 ai_unavailable:{status:503,message:'The AI is unavailable right now. Try again shortly.'},
 refused:{status:422,message:'The AI could not help with that request. Try describing the yard you want.'},
 incomplete:{status:502,message:'The AI’s answer was cut off. Try a shorter request.'},
 invalid_ai_response:{status:502,message:'The AI returned a choice the engine cannot use. The engine’s concepts still stand.'},
 invalid_ai_plan:{status:502,message:'The AI plan contains unsupported or invalid changes. Try clarifying the request.'},
 ai_error:{status:502,message:'The AI could not complete this request.'},
 ai_timeout:{status:504,message:'The AI took too long. Try again.'},
 cancelled:{status:499,message:'The request was cancelled.'},
 not_found:{status:404,message:'That AI request was not found.'},
};
const known=(code:string)=>MESSAGES[code]??MESSAGES.ai_error;
interface RouteSpec {bodyBytes:number;parse(raw:unknown):unknown;task(input:unknown):AiTask;output(text:string,input:unknown):unknown}
const ROUTES:Record<Route,RouteSpec>={
 designer:{bodyBytes:DESIGNER_LIMITS.bodyBytes,parse:validateDesignerRequest,task:input=>designerTask(input as DesignerAiRequest),output:(text,input)=>parseDesignerOutput(text,input as DesignerAiRequest)},
 assistant:{bodyBytes:128*1024,parse:parseAssistantCloudInput,task:input=>assistantTask(input as ReturnType<typeof parseAssistantCloudInput>),output:text=>parseAssistantOutput(text)},
};
/** A typical large turn per route: what status checks against the remaining budget. */
const REFERENCE:Record<Route,AiTask>={
 designer:{route:'designer',system:DESIGNER_SYSTEM_PROMPT,messages:[{role:'user',content:'x'.repeat(16000)}],schema:DESIGNER_RESPONSE_SCHEMA as unknown as Record<string,unknown>,effort:'high',maxTokens:DESIGNER_LIMITS.designMaxTokens,localMaxTokens:DESIGNER_LIMITS.localMaxTokens},
 assistant:{route:'assistant',system:ASSISTANT_CLOUD_SYSTEM,messages:[{role:'user',content:'x'.repeat(24000)}],schema:ASSISTANT_WIRE_SCHEMA as unknown as Record<string,unknown>,effort:'medium',maxTokens:ASSISTANT_CLOUD_LIMITS.maxTokens,localMaxTokens:ASSISTANT_CLOUD_LIMITS.localMaxTokens},
};

const json=(value:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const errorBody=(code:string,extra:Record<string,unknown>={})=>({ok:false,status:'error',error:{code,message:known(code).message},...extra});
async function readBounded(request:Request,max:number):Promise<string>{
 const length=request.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>max))throw new AiError('payload_too_large','The request is too large.',413);
 if(!request.body)return '';const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const c=await reader.read();if(c.done)break;size+=c.value.length;if(size>max)throw new AiError('payload_too_large','The request is too large.',413);chunks.push(c.value);}}finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
 const all=new Uint8Array(size);let at=0;for(const c of chunks){all.set(c,at);at+=c.length;}
 try{return new TextDecoder('utf-8',{fatal:true}).decode(all);}catch{throw new AiError('invalid_json','Send valid UTF-8 JSON.',400);}
}
/** The visitor: a first-party random id cookie (set when missing) and the client IP Netlify reports. */
function visitorOf(request:Request,ip?:string):{id:VisitorId;cookie?:string}{
 const raw=request.headers.get('cookie')??'',match=raw.split(/;\s*/).map(p=>p.split('=')).find(([k])=>k===VISITOR_COOKIE)?.[1];
 const cookie=match&&/^[a-f0-9]{32}$/.test(match)?match:undefined;
 const address=ip??request.headers.get('x-nf-client-connection-ip')??request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??null;
 if(cookie)return {id:{cookie,ip:address}};
 const fresh=randomBytes(16).toString('hex'),secure=new URL(request.url).protocol==='https:';
 return {id:{cookie:fresh,ip:address},cookie:`${VISITOR_COOKIE}=${fresh}; Path=/.netlify/functions; Max-Age=31536000; HttpOnly; SameSite=Strict${secure?'; Secure':''}`};
}

export function createAiTurnService(route:Route,runtime:AiRuntime,path:string=route==='designer'?DESIGNER_AI_PATH:DECK_ASSISTANT_PATH){
 const spec=ROUTES[route],{kv,ledger,limiter,now,log}=runtime;
 const jobKey=(id:string)=>`jobs/${id}`;
 async function availability(v:VisitorId):Promise<{ok:boolean;remaining:number;code:'ok'|'not_configured'|'cap_reached'|'rate_limited'|'unavailable'}>{
  const provider=runtime.provider;if(!provider)return {ok:false,remaining:0,code:'not_configured'};
  try{const s=await ledger.snapshot();if(s.remainingUsd<provider.reserveUsd(REFERENCE[route]))return {ok:false,remaining:0,code:'cap_reached'};
   const remaining=await limiter.remaining(v);return remaining>0?{ok:true,remaining,code:'ok'}:{ok:false,remaining:0,code:'rate_limited'};}
  catch{return {ok:false,remaining:0,code:'unavailable'};}
 }
 async function status(v:VisitorId,headers:Record<string,string>):Promise<Response>{
  const a=await availability(v);
  if(route==='designer'){const body:DesignerAiStatus=a.ok?{available:true,remainingTurnsToday:a.remaining}:{available:false,reason:a.code as NonNullable<DesignerAiStatus['reason']>};return json(body,200,headers);}
  if(a.ok)return json({ready:true,source:runtime.provider!.source,model:runtime.provider!.model,remainingTurnsToday:a.remaining},200,headers);
  return json({ready:false,source:runtime.provider?.source??'cloud-ai',model:null,code:a.code,reason:a.code==='unavailable'?MESSAGES.ai_unavailable.message:known(a.code).message},503,headers);
 }
 function present(job:Job){
  const meta={model:String(job.model??runtime.provider?.model??''),...(typeof job.costUsd==='number'?{costUsd:job.costUsd}:{}),remainingTurnsToday:job.remainingTurnsToday};
  return route==='designer'?{ok:true,status:'done',response:{...(job.result as object),meta}}:{ok:true,status:'done',source:runtime.provider?.source??'cloud-ai',model:meta.model,plan:job.result,remainingTurnsToday:job.remainingTurnsToday};
 }
 async function poll(id:string,v:VisitorId,headers:Record<string,string>):Promise<Response>{
  if(!/^[0-9a-f-]{36}$/.test(id))return json(errorBody('not_found'),404,headers);
  const entry=await kv.get(jobKey(id)),job=entry?.value as Job|undefined;
  if(!entry||!job||job.route!==route||job.owner!==limiter.owner(v))return json(errorBody('not_found'),404,headers);
  if(job.status==='queued'||job.status==='running'){
   if(now()-job.createdAt<=JOB_EXPIRY_MS)return json({ok:true,status:'pending',pollMs:POLL_MS*1.5},200,headers);
   // The background run died: the reservation already counts as spent when it goes stale.
   await kv.set(jobKey(id),{...job,status:'error',updatedAt:now(),input:null,error:{code:'ai_timeout',message:MESSAGES.ai_timeout.message}},{ifMatch:entry.etag});
   return json(errorBody('ai_timeout'),MESSAGES.ai_timeout.status,headers);
  }
  if(job.status==='done')return json(present(job),200,headers);
  const code=job.error?.code??'ai_error';return json(errorBody(code),known(code).status,headers);
 }
 return {route,
  async handle(request:Request,info:{ip?:string}={}):Promise<Response>{
   let headers:Record<string,string>={};
   try{
    const url=new URL(request.url);if(url.pathname!==path)return json(errorBody('not_found'),404);
    const origin=request.headers.get('origin');
    if(origin&&origin!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return json({ok:false,status:'error',error:{code:'origin_rejected',message:'Use the AI from this site.'}},403);
    if(request.method!=='GET'&&request.method!=='POST')return json({ok:false,status:'error',error:{code:'method_not_allowed',message:'Use GET or POST.'}},405,{Allow:'GET, POST'});
    const visitor=visitorOf(request,info.ip);if(visitor.cookie)headers={'Set-Cookie':visitor.cookie};
    if(request.method==='GET'){const id=url.searchParams.get('job');return id?poll(id,visitor.id,headers):status(visitor.id,headers);}
    if(!/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(request.headers.get('content-type')??''))return json({ok:false,status:'error',error:{code:'content_type',message:'Send application/json.'}},415,headers);
    const provider=runtime.provider;if(!provider)return json(errorBody('not_configured'),503,headers);
    let raw:unknown;const body=await readBounded(request,spec.bodyBytes);try{raw=JSON.parse(body);}catch{throw new AiError('invalid_json','Send a valid JSON request.',400);}
    const input=spec.parse(raw),task=spec.task(input),reserve=provider.reserveUsd(task);
    const take=await limiter.take(visitor.id);if(!take.ok)return json(errorBody('rate_limited',{remainingTurnsToday:0}),429,headers);
    const id=randomUUID(),token=randomBytes(24).toString('hex'),held=await ledger.reserve(id,reserve);
    if(!held.ok){await limiter.refund(visitor.id);return json(errorBody('cap_reached'),503,headers);}
    const t=now(),job:Job={v:1,id,route,status:'queued',owner:limiter.owner(visitor.id),token,createdAt:t,updatedAt:t,month:held.month,reservedUsd:reserve,remainingTurnsToday:take.remaining,input};
    try{if(!await kv.set(jobKey(id),job,{ifNew:true}))throw new Error('job id clash');await runtime.dispatch({id,token},url.origin);}
    catch{await ledger.settle(id,held.month,0);await limiter.refund(visitor.id);await kv.set(jobKey(id),{...job,status:'error',input:null,error:{code:'ai_unavailable',message:MESSAGES.ai_unavailable.message}}).catch(()=>{});log(JSON.stringify({event:'deck_ai_dispatch_failed',route}));return json(errorBody('ai_unavailable'),503,headers);}
    return json({ok:true,status:'pending',job:id,pollMs:POLL_MS,remainingTurnsToday:take.remaining},202,headers);
   }catch(e){
    if(e instanceof AiError)return json({ok:false,status:'error',error:{code:e.code,message:e.message}},e.status,headers);
    log(JSON.stringify({event:'deck_ai_error',route,where:'handle'}));return json(errorBody('ai_error'),500,headers);
   }
  },
  /** Runs one queued job (the background function, or inline locally). Never throws. */
  async runJob(id:string,token:string):Promise<'missing'|'forbidden'|'skipped'|'done'|'error'>{
   const started=now();
   try{
    const entry=await kv.get(jobKey(id)),job=entry?.value as Job|undefined;
    if(!entry||!job)return 'missing';if(typeof job.token!=='string'||!sameToken(job.token,token))return 'forbidden';
    if(job.status!=='queued')return 'skipped';
    const claimed:Job={...job,status:'running',updatedAt:now()};
    if(!await kv.set(jobKey(id),claimed,{ifMatch:entry.etag}))return 'skipped';
    const route=ROUTES[job.route],provider=runtime.provider;let final:Job;
    if(!provider){await ledger.settle(id,job.month,0);final={...claimed,status:'error',error:{code:'not_configured',message:MESSAGES.not_configured.message}};}
    else{
     const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),MODEL_TIMEOUT_MS);
     let outcome;try{outcome=await provider.run(route.task(job.input),controller.signal);}finally{clearTimeout(timer);}
     await ledger.settle(id,job.month,outcome.costUsd);
     if(outcome.ok){
      try{final={...claimed,status:'done',result:route.output(outcome.text,job.input),model:outcome.model,costUsd:outcome.costUsd};}
      catch(e){const code=e instanceof AiError?e.code:'invalid_ai_response';final={...claimed,status:'error',error:{code,message:known(code).message},model:outcome.model,costUsd:outcome.costUsd};}
     }else final={...claimed,status:'error',error:{code:outcome.code,message:known(outcome.code).message},model:outcome.model,costUsd:outcome.costUsd};
    }
    // The visitor's words and brief are not kept once the turn is over.
    final={...final,input:null,updatedAt:now()};
    await kv.set(jobKey(id),final);
    log(JSON.stringify({event:'deck_ai_turn',route:job.route,status:final.status,code:final.error?.code??null,model:final.model??null,costUsd:final.costUsd??null,ms:now()-started}));
    return final.status==='done'?'done':'error';
   }catch{
    log(JSON.stringify({event:'deck_ai_error',where:'runJob'}));
    try{const e=await kv.get(jobKey(id));const job=e?.value as Job|undefined;if(job&&job.status!=='done')await kv.set(jobKey(id),{...job,status:'error',input:null,updatedAt:now(),error:{code:'ai_error',message:MESSAGES.ai_error.message}});}catch{/* the poll expires it */}
    return 'error';
   }
  }};
}
export type AiTurnService=ReturnType<typeof createAiTurnService>;

// ---------------------------------------------------------------------------------------------------------------
// Runtime from the environment

export interface RuntimeOptions {kv?:AiKv;dispatch?:AiRuntime['dispatch'];claudeClient?:ClaudeClientLike;fetch?:typeof globalThis.fetch;now?:()=>number;log?:(line:string)=>void}
/** ANTHROPIC_API_KEY → Claude (claude-opus-5-5); else DECK_ASSISTANT_OLLAMA_URL (loopback only) → local Ollama
 * (DECK_ASSISTANT_OLLAMA_MODEL, default qwen3:14b); else none (503 not_configured). */
export function selectProvider(env:Record<string,string|undefined>,opts:RuntimeOptions={}):AiProvider|null{
 const key=env.ANTHROPIC_API_KEY?.trim();if(key)return claudeProvider({apiKey:key,client:opts.claudeClient,log:opts.log});
 const url=env.DECK_ASSISTANT_OLLAMA_URL?.trim();if(url)return ollamaProvider({url,model:env.DECK_ASSISTANT_OLLAMA_MODEL?.trim()||undefined,fetch:opts.fetch});
 return null;
}
/** Hands a job to the background function on the same site and deploy. */
export function backgroundDispatch(fetcher:typeof globalThis.fetch=globalThis.fetch):AiRuntime['dispatch']{
 return async(job,origin)=>{
  const response=await fetcher(new URL(AI_BACKGROUND_PATH,origin),{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','X-Deck-Ai-Token':job.token},body:JSON.stringify({job:job.id})});
  if(response.status!==202&&!response.ok)throw new Error(`background dispatch ${response.status}`);
 };
}
export async function aiRuntimeFromEnv(env:Record<string,string|undefined>,opts:RuntimeOptions={}):Promise<AiRuntime>{
 const limits=aiLimitsFromEnv(env),now=opts.now??Date.now,log=opts.log??((line:string)=>console.warn(line));
 // DECK_AI_STORE_FILE: a JSON file instead of Netlify Blobs (local development only).
 const kv=opts.kv??(env.DECK_AI_STORE_FILE?.trim()?fileKv(env.DECK_AI_STORE_FILE.trim()):await blobsKv('deck-ai'));
 return {provider:selectProvider(env,opts),kv,now,log,
  ledger:createSpendLedger({kv,capUsd:limits.capUsd,now,log}),
  limiter:createVisitorLimiter({kv,dailyTurns:limits.dailyTurns,ipDailyTurns:limits.ipDailyTurns,salt:limits.salt,now}),
  dispatch:opts.dispatch??backgroundDispatch(opts.fetch)};
}
/** Runs a job in this process (local server, tests): the promise is kept so callers can await it. */
export function inlineDispatch(service:()=>AiTurnService|undefined,inflight:Set<Promise<unknown>>=new Set()):AiRuntime['dispatch']{
 return async job=>{const s=service();if(!s)throw new Error('service not ready');const p=s.runJob(job.id,job.token);inflight.add(p);void p.finally(()=>inflight.delete(p));};
}

// ---------------------------------------------------------------------------------------------------------------
// Netlify entry points (one runtime per warm function instance)

interface NetlifyContext {ip?:string}
const env=()=>process.env as Record<string,string|undefined>;
let runtime:Promise<AiRuntime>|undefined;
const sharedRuntime=()=>runtime??=aiRuntimeFromEnv(env()).catch(e=>{runtime=undefined;throw e;});
let designer:AiTurnService|undefined,assistant:AiTurnService|undefined,localAssistant:ReturnType<typeof createDeckAssistantService>|undefined;
const unavailable=(code:string)=>json(errorBody(code),known(code).status);

export async function designerAiFunction(request:Request,context?:NetlifyContext):Promise<Response>{
 // No provider configured: answer honestly without touching storage.
 if(!env().ANTHROPIC_API_KEY?.trim()&&!env().DECK_ASSISTANT_OLLAMA_URL?.trim())return request.method==='GET'&&!new URL(request.url).searchParams.has('job')?json({available:false,reason:'not_configured'} satisfies DesignerAiStatus):unavailable('not_configured');
 try{designer??=createAiTurnService('designer',await sharedRuntime());}catch{return unavailable('ai_unavailable');}
 return designer.handle(request,{ip:context?.ip});
}
/** deck-assistant: Claude when ANTHROPIC_API_KEY is set (job + polling, same cap and limits), else the local Ollama
 * assistant when DECK_ASSISTANT_OLLAMA_URL is set (synchronous, as before), else not configured. */
export async function deckAssistantFunction(request:Request,context?:NetlifyContext):Promise<Response>{
 const e=env();
 if(e.ANTHROPIC_API_KEY?.trim()){try{assistant??=createAiTurnService('assistant',await sharedRuntime());}catch{return unavailable('ai_unavailable');}return assistant.handle(request,{ip:context?.ip});}
 if(e.DECK_ASSISTANT_OLLAMA_URL?.trim()){try{localAssistant??=createDeckAssistantService({ollamaUrl:e.DECK_ASSISTANT_OLLAMA_URL.trim(),model:e.DECK_ASSISTANT_OLLAMA_MODEL?.trim()||'qwen3:14b'});}catch{return unconfiguredDeckAssistant.handle(request);}return localAssistant.handle(request);}
 return unconfiguredDeckAssistant.handle(request);
}
/** deck-ai-background: { job } plus the job's dispatch token. Always answers (Netlify ignores the body). */
export async function backgroundAiFunction(request:Request):Promise<Response>{
 try{
  if(request.method!=='POST')return new Response(null,{status:405});
  const token=request.headers.get('x-deck-ai-token')??'',body=JSON.parse(await readBounded(request,1024)) as {job?:unknown};
  if(typeof body.job!=='string'||!/^[0-9a-f-]{36}$/.test(body.job)||!/^[a-f0-9]{48}$/.test(token))return new Response(null,{status:400});
  const rt=await sharedRuntime(),entry=await rt.kv.get(`jobs/${body.job}`),route=(entry?.value as Job|undefined)?.route;
  if(route!=='designer'&&route!=='assistant')return new Response(null,{status:404});
  const service=route==='designer'?(designer??=createAiTurnService('designer',rt)):(assistant??=createAiTurnService('assistant',rt));
  await service.runJob(body.job,token);
 }catch{console.warn(JSON.stringify({event:'deck_ai_error',where:'background'}));}
 return new Response(null,{status:202});
}
