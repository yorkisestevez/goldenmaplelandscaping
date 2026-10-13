/**
 * Typed client for TypeSafe's System One endpoint (the Jev decision model).
 *
 * Jev does not write text. It reads a `state` (a string or JSON) and answers typed questions about it: a noul is the
 * probability that a yes/no statement is true, a choice picks one option, a score rates along ordered levels.
 *
 * Contract checked against docs.typesafe.ai on 2026-10-13 (api.md, models.md, confidence.md):
 * - POST https://api.typesafe.ai/v1/systemone, `Authorization: Bearer <key>`, body {state, model, questions}.
 * - The response is {model, answers, usage:{input_tokens, output_tokens}}, answers keyed by the question ids.
 * - A noul answer is {type:'noul', noul}. It has no `confidence`; the docs give |2p − 1| as the matching measure.
 *   Choice and score answers carry `probabilities` and `confidence`.
 * - 401 bad key, 422 bad request, 429 rate limit, 529 overloaded. 429 and 529 are retried after a short wait.
 * - jev-1.13.0 takes 64k tokens per request and 32k for the state plus the longest question. It is billed per input
 *   token ($0.042 per million); output tokens are free.
 *
 * The key comes from process.env.JEV_API_KEY and is only ever placed in the Authorization header. Nothing here logs,
 * and no error carries the key or the request.
 */
import {z} from 'zod';

export const JEV_ENDPOINT='https://api.typesafe.ai/v1/systemone';
/** Pinned: an alias such as jev-latest moves when TypeSafe ships a release, which would shift tuned thresholds. */
export const JEV_MODEL='jev-1.13.0';
/** USD per million input tokens for jev-1.13.0 (docs.typesafe.ai/models, 2026-10-13). Output tokens are free. */
export const JEV_USD_PER_MTOK=.042;
export const JEV_LIMITS={timeoutMs:10_000,retries:1,retryWaitMs:400,maxRetryWaitMs:5_000,
 /** The docs give limits in tokens and publish no tokenizer, so the state is capped by size: 90,000 characters is
  * about 30k tokens at 3 characters a token, under the 32k limit for the state plus one question. */
 stateChars:90_000,questions:120} as const;

export type JevJson=string|number|boolean|null|JevJson[]|{[key:string]:JevJson};
/** Instructions and criteria take a string, or JSON that holds the question in one field and its data in others. */
export type JevText=string|JevJson[]|{[key:string]:JevJson};
export interface JevNoulQuestion {type:'noul';instructions:JevText;criteria?:{true?:JevText;false?:JevText}}
export interface JevChoiceQuestion {type:'choice';instructions:JevText;criteria:Record<string,JevText|null>}
export interface JevScoreQuestion {type:'score';instructions:JevText;criteria:JevText[]}
export type JevQuestion=JevNoulQuestion|JevChoiceQuestion|JevScoreQuestion;
export type JevQuestions=Record<string,JevQuestion>;

// Probabilities are floats, so a hair outside 0–1 is rounding, not a broken response.
const probability=z.number().min(-1e-6).max(1+1e-6).transform(v=>Math.min(1,Math.max(0,v)));
const noulAnswer=z.object({type:z.literal('noul'),noul:probability});
const choiceAnswer=z.object({type:z.literal('choice'),choice:z.string(),probabilities:z.record(z.string(),probability),confidence:probability});
const scoreAnswer=z.object({type:z.literal('score'),score:z.number(),legend:z.record(z.string(),z.unknown()),probabilities:z.record(z.string(),probability),confidence:probability});
const responseSchema=z.object({
 model:z.string().min(1).max(100),
 answers:z.record(z.string(),z.discriminatedUnion('type',[noulAnswer,choiceAnswer,scoreAnswer])),
 usage:z.object({input_tokens:z.number().int().nonnegative(),output_tokens:z.number().int().nonnegative()}),
});
export type JevNoulAnswer=z.infer<typeof noulAnswer>;
export type JevChoiceAnswer=z.infer<typeof choiceAnswer>;
export type JevScoreAnswer=z.infer<typeof scoreAnswer>;
export type JevAnswerFor<Q extends JevQuestion>=Q extends JevNoulQuestion?JevNoulAnswer:Q extends JevChoiceQuestion?JevChoiceAnswer:JevScoreAnswer;
export interface JevResult<Q extends JevQuestions> {
 /** The versioned model that answered. */
 model:string;answers:{[K in keyof Q]:JevAnswerFor<Q[K]>};
 usage:{inputTokens:number;outputTokens:number};
 /** Input tokens at the published rate. */
 costUsd:number;attempts:number}

export type JevErrorCode='not_configured'|'request_too_large'|'timeout'|'network'|'unauthorized'|'bad_request'|'rate_limited'|'overloaded'|'http_error'|'invalid_response'|'cancelled';
export class JevError extends Error {
 constructor(public code:JevErrorCode,message:string,public status?:number){super(message);this.name='JevError';}
}
/** How sure a noul is, on the same 0–1 scale as choice and score confidence (docs.typesafe.ai/confidence). */
export const noulConfidence=(p:number)=>Math.abs(2*p-1);
export const jevCostUsd=(inputTokens:number)=>Math.round(inputTokens*JEV_USD_PER_MTOK)/1e6;

export interface JevClientOptions {
 /** Defaults to process.env.JEV_API_KEY, read when a request is made. */
 apiKey?:string;endpoint?:string;model?:string;
 /** Per attempt. */
 timeoutMs?:number;
 /** Extra attempts after a timeout, a network failure, 429, 529 or a 5xx. */
 retries?:number;fetch?:typeof fetch;sleep?:(ms:number)=>Promise<void>}
export interface JevClient {model:string;configured():boolean;
 ask<Q extends JevQuestions>(state:JevText,questions:Q,opts?:{signal?:AbortSignal}):Promise<JevResult<Q>>}

const RETRY_STATUS=new Set([429,500,502,503,504,529]);
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
function httpError(status:number):JevError{
 if(status===401||status===403)return new JevError('unauthorized','TypeSafe rejected the API key.',status);
 if(status===400||status===422)return new JevError('bad_request','TypeSafe rejected the request as invalid.',status);
 if(status===413)return new JevError('request_too_large','The request is too large for Jev.',status);
 if(status===429)return new JevError('rate_limited','TypeSafe rate limit reached.',status);
 if(status===529)return new JevError('overloaded','TypeSafe is overloaded.',status);
 return new JevError('http_error',`TypeSafe answered ${status}.`,status);
}
/** `retry-after` in seconds, capped; otherwise a short wait with jitter. */
function retryWait(response:Response|null):number{
 const header=Number(response?.headers.get('retry-after'));
 if(Number.isFinite(header)&&header>0)return Math.min(JEV_LIMITS.maxRetryWaitMs,header*1000);
 return JEV_LIMITS.retryWaitMs+Math.random()*200;
}

export function createJevClient(opts:JevClientOptions={}):JevClient{
 const endpoint=opts.endpoint??JEV_ENDPOINT,model=opts.model??JEV_MODEL,timeoutMs=opts.timeoutMs??JEV_LIMITS.timeoutMs,retries=Math.max(0,opts.retries??JEV_LIMITS.retries),sleep=opts.sleep??pause;
 const key=()=>(opts.apiKey??process.env.JEV_API_KEY??'').trim();
 return {model,configured:()=>key().length>0,
  async ask<Q extends JevQuestions>(state:JevText,questions:Q,call:{signal?:AbortSignal}={}):Promise<JevResult<Q>>{
   const apiKey=key();if(!apiKey)throw new JevError('not_configured','JEV_API_KEY is not set.');
   const ids=Object.keys(questions);
   if(!ids.length||ids.length>JEV_LIMITS.questions)throw new JevError('bad_request',`Ask between 1 and ${JEV_LIMITS.questions} questions.`);
   const stateChars=typeof state==='string'?state.length:JSON.stringify(state).length;
   if(stateChars>JEV_LIMITS.stateChars)throw new JevError('request_too_large',`The state is ${stateChars} characters; the limit is ${JEV_LIMITS.stateChars}.`);
   const body=JSON.stringify({state,model,questions}),send=opts.fetch??fetch;
   let last:JevError=new JevError('network','TypeSafe could not be reached.');
   for(let attempt=1;attempt<=retries+1;attempt++){
    if(call.signal?.aborted)throw new JevError('cancelled','The request was cancelled.');
    const timer=new AbortController(),timeout=setTimeout(()=>timer.abort(),timeoutMs),onAbort=()=>timer.abort();
    call.signal?.addEventListener('abort',onAbort,{once:true});
    let response:Response|null=null;
    try{
     response=await send(endpoint,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json',Accept:'application/json'},body,signal:timer.signal});
     if(response.ok){
      // A body cut short by the timeout is a timeout, not a bad answer.
      let raw:unknown;try{raw=await response.json();}catch(error){if(timer.signal.aborted)throw error;throw new JevError('invalid_response','TypeSafe did not answer with JSON.');}
      const parsed=responseSchema.safeParse(raw);
      if(!parsed.success)throw new JevError('invalid_response','TypeSafe answered in an unexpected shape.');
      for(const id of ids){const answer=parsed.data.answers[id];if(!answer||answer.type!==questions[id].type)throw new JevError('invalid_response','TypeSafe left a question unanswered or answered it with the wrong type.');}
      const inputTokens=parsed.data.usage.input_tokens;
      return {model:parsed.data.model,answers:Object.fromEntries(ids.map(id=>[id,parsed.data.answers[id]])) as JevResult<Q>['answers'],usage:{inputTokens,outputTokens:parsed.data.usage.output_tokens},costUsd:jevCostUsd(inputTokens),attempts:attempt};
     }
     // The error body can repeat parts of the request, so it is read and dropped rather than kept on the error.
     await response.body?.cancel().catch(()=>{});
     last=httpError(response.status);
     if(!RETRY_STATUS.has(response.status))throw last;
    }catch(error){
     if(error instanceof JevError&&(error.code==='invalid_response'||!RETRY_STATUS.has(error.status??0)))throw error;
     if(!(error instanceof JevError)){
      if(call.signal?.aborted)throw new JevError('cancelled','The request was cancelled.');
      last=timer.signal.aborted?new JevError('timeout',`TypeSafe did not answer within ${timeoutMs} ms.`):new JevError('network','TypeSafe could not be reached.');
     }
    }finally{clearTimeout(timeout);call.signal?.removeEventListener('abort',onAbort);}
    if(attempt<=retries)await sleep(retryWait(response));
   }
   throw last;
  }};
}
