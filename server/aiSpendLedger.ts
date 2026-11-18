/**
 * Hard spend controls for DeckCraft's cloud AI (the AI Site Designer and the edit assistant on Claude Opus 5.5):
 * a monthly USD ledger priced from each response's `usage` (input, cache writes, cache reads, output; per fallback
 * attempt from `usage.iterations`), a hard cap that refuses new turns before they could cross it (each turn reserves
 * its worst case first, then settles at the real cost), a once-a-month alert at 80 % and at 100 % (logged, plus a hook
 * the owner can wire to email or the CRM; nothing is sent from here), and a per-visitor daily turn limit (a first-party
 * cookie id and the hashed IP, never stored raw).
 *
 * Storage is a small conditional key-value interface: Netlify Blobs (strong consistency, ETag compare-and-swap) in
 * production, an in-memory or JSON-file store for local development and tests.
 */
import {createHash,timingSafeEqual} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';

// ---------------------------------------------------------------------------------------------------------------
// Rates

/** USD per million tokens. Source: the claude-api skill's model table and its "Migrating to Claude Opus 5.5 → What
 * carries over → Pricing" (cached 2026-09-25): Claude Opus 5.5 $4 input / $20 output, 5-minute cache writes $5,
 * 1-hour cache writes $8, cache reads $0.20. Server-side fallback ("default") can serve a refused turn on Claude Opus 5
 * or Claude Opus 4.8 at $5 / $25 (writes 1.25x and 2x input, reads 0.1x). A model not listed here is priced at
 * `unknown` (the Fable 5.1 tier, the most expensive listed) so the cap can only over-count. Re-check these against
 * https://platform.claude.com/docs/en/about-claude/pricing before changing models. */
export const MODEL_RATES_USD_PER_MTOK={
 'claude-opus-5-5':{input:4,output:20,cacheWrite5m:5,cacheWrite1h:8,cacheRead:.2},
 'claude-opus-5':{input:5,output:25,cacheWrite5m:6.25,cacheWrite1h:10,cacheRead:.5},
 'claude-opus-4-8':{input:5,output:25,cacheWrite5m:6.25,cacheWrite1h:10,cacheRead:.5},
 unknown:{input:10,output:50,cacheWrite5m:12.5,cacheWrite1h:20,cacheRead:1},
} as const;
type Rates={input:number;output:number;cacheWrite5m:number;cacheWrite1h:number;cacheRead:number};
export const ratesFor=(model:string|null|undefined):Rates=>(model&&Object.hasOwn(MODEL_RATES_USD_PER_MTOK,model)?MODEL_RATES_USD_PER_MTOK[model as keyof typeof MODEL_RATES_USD_PER_MTOK]:MODEL_RATES_USD_PER_MTOK.unknown);

/** The token counts of one attempt (BetaUsage or one entry of usage.iterations). */
export interface UsagePart {input_tokens:number;output_tokens:number;cache_creation_input_tokens?:number|null;cache_read_input_tokens?:number|null;
 cache_creation?:{ephemeral_5m_input_tokens:number;ephemeral_1h_input_tokens:number}|null;model?:string|null;type?:string}
export interface UsageLike extends UsagePart {iterations?:UsagePart[]|null}
const n=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0?v:0;
function partCost(p:UsagePart,model:string|null|undefined):number{
 const r=ratesFor(p.model??model),written=n(p.cache_creation_input_tokens),split=p.cache_creation,w1h=split?n(split.ephemeral_1h_input_tokens):0,w5m=split?Math.max(n(split.ephemeral_5m_input_tokens),written-w1h):written;
 return (n(p.input_tokens)*r.input+w5m*r.cacheWrite5m+w1h*r.cacheWrite1h+n(p.cache_read_input_tokens)*r.cacheRead+n(p.output_tokens)*r.output)/1e6;
}
/** What a response cost in USD. With server-side fallback, `usage.iterations` is the per-attempt source of truth (each
 * attempt at its own model's rates) and the top-level counts cover only the attempt that answered, so they are not added. */
export function usageCostUsd(usage:UsageLike|null|undefined,model:string|null|undefined):number{
 if(!usage)return 0;
 const parts=Array.isArray(usage.iterations)&&usage.iterations.length?usage.iterations:[usage];
 return Math.round(parts.reduce((s,p)=>s+partCost(p,model),0)*1e6)/1e6;
}
/** The most a turn can cost, reserved before the call: for each attempt it can make (the requested model, then a
 * server-side fallback after a mid-stream refusal, both billed), every input token at the 1-hour cache-write rate (the
 * dearest input rate) and every output token the request allows. */
export function worstCaseUsd(inputTokens:number,maxTokens:number,attempts:readonly string[]=['claude-opus-5-5','claude-opus-5']):number{
 return money(attempts.map(ratesFor).reduce((s,x)=>s+(inputTokens*x.cacheWrite1h+maxTokens*x.output)/1e6,0));
}

// ---------------------------------------------------------------------------------------------------------------
// Storage

export interface KvEntry {value:unknown;etag:string}
/** A conditional key-value store: `set` writes only when the entry is new (`ifNew`) or unchanged (`ifMatch`), and
 * says whether it wrote. */
export interface AiKv {get(key:string):Promise<KvEntry|null>;set(key:string,value:unknown,cond?:{ifMatch?:string;ifNew?:boolean}):Promise<boolean>;delete(key:string):Promise<void>}
let etagSeq=0;
const nextEtag=()=>`${Date.now().toString(36)}-${(++etagSeq).toString(36)}`;
export function memoryKv():AiKv&{dump():Record<string,unknown>}{
 const map=new Map<string,{json:string;etag:string}>();
 return {
  async get(key){const e=map.get(key);return e?{value:JSON.parse(e.json),etag:e.etag}:null;},
  async set(key,value,cond={}){const e=map.get(key);if(cond.ifNew&&e||cond.ifMatch!==undefined&&e?.etag!==cond.ifMatch)return false;map.set(key,{json:JSON.stringify(value),etag:nextEtag()});return true;},
  async delete(key){map.delete(key);},
  dump(){return Object.fromEntries([...map].map(([k,v])=>[k,JSON.parse(v.json)]));},
 };
}
/** A single JSON file (local development): survives restarts; one process at a time. */
export function fileKv(path:string):AiKv{
 const load=():Record<string,{json:string;etag:string}>=>{try{return existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{};}catch{return {};}};
 const save=(all:Record<string,{json:string;etag:string}>)=>{mkdirSync(dirname(path),{recursive:true});const tmp=`${path}.${process.pid}.tmp`;writeFileSync(tmp,JSON.stringify(all));renameSync(tmp,path);};
 return {
  async get(key){const e=load()[key];return e?{value:JSON.parse(e.json),etag:e.etag}:null;},
  async set(key,value,cond={}){const all=load(),e=all[key];if(cond.ifNew&&e||cond.ifMatch!==undefined&&e?.etag!==cond.ifMatch)return false;all[key]={json:JSON.stringify(value),etag:nextEtag()};save(all);return true;},
  async delete(key){const all=load();delete all[key];save(all);},
 };
}
/** Netlify Blobs (site-wide store, strong consistency, ETag compare-and-swap). Works inside Netlify Functions without
 * configuration; `netlify dev` uses its local sandboxed store. */
export async function blobsKv(storeName='deck-ai'):Promise<AiKv>{
 const {getStore}=await import('@netlify/blobs');
 const store=getStore({name:storeName,consistency:'strong'});
 return {
  async get(key){const e=await store.getWithMetadata(key,{type:'json',consistency:'strong'});return e&&e.data!==null&&e.data!==undefined?{value:e.data,etag:e.etag??''}:null;},
  async set(key,value,cond={}){const r=cond.ifNew?await store.setJSON(key,value,{onlyIfNew:true}):cond.ifMatch!==undefined?await store.setJSON(key,value,{onlyIfMatch:cond.ifMatch}):await store.setJSON(key,value);return r.modified;},
  async delete(key){await store.delete(key);},
 };
}
/** Read, change, compare-and-swap; retried on a concurrent write. `change` returns undefined to leave it as is. */
export async function kvUpdate<T>(kv:AiKv,key:string,change:(current:T|null)=>T|undefined):Promise<{value:T|null;written:boolean}>{
 for(let attempt=0;attempt<12;attempt++){
  const entry=await kv.get(key),current=(entry?.value??null) as T|null,next=change(current===null?null:structuredClone(current));
  if(next===undefined)return {value:current,written:false};
  if(await kv.set(key,next,entry?{ifMatch:entry.etag}:{ifNew:true}))return {value:next,written:true};
  await new Promise(resolve=>setTimeout(resolve,5+Math.random()*25*(attempt+1)));
 }
 throw new Error('The AI ledger is busy. Try again.');
}

// ---------------------------------------------------------------------------------------------------------------
// Monthly spend ledger

export interface SpendAlert {month:string;thresholdPct:80|100;spentUsd:number;capUsd:number}
const alertHooks:((alert:SpendAlert)=>void|Promise<void>)[]=[];
/** Register what should happen when the month's spend first reaches 80 % (and 100 %) of the cap: e.g. an email or a
 * CRM task. Called once per threshold per month, after the ledger records the crossing. Nothing is wired by default
 * beyond a server log line. */
export function onSpendAlert(hook:(alert:SpendAlert)=>void|Promise<void>):()=>void{alertHooks.push(hook);return ()=>{const i=alertHooks.indexOf(hook);if(i>=0)alertHooks.splice(i,1);};}

interface Reservation {usd:number;at:number;expired?:boolean}
export interface MonthRecord {v:1;month:string;spentUsd:number;turns:number;reserved:Record<string,Reservation>;alerts:{'80'?:string;'100'?:string}}
export interface LedgerSnapshot {month:string;capUsd:number;spentUsd:number;reservedUsd:number;remainingUsd:number;turns:number;alerts:MonthRecord['alerts']}
export interface SpendLedger {capUsd:number;
 snapshot():Promise<LedgerSnapshot>;
 /** Reserves a turn's worst case, or refuses when spent + reserved + this would pass the cap. */
 reserve(id:string,usd:number):Promise<{ok:true;month:string}|{ok:false;reason:'cap_reached'}>;
 /** Replaces the reservation with what the turn really cost (null: unknown, keep the worst case as spent). */
 settle(id:string,month:string,actualUsd:number|null):Promise<void>}
/** UTC month: Anthropic bills in UTC. */
export const monthOf=(t:number)=>new Date(t).toISOString().slice(0,7);
const money=(v:number)=>Math.round(v*1e6)/1e6;
export function createSpendLedger(opts:{kv:AiKv;capUsd:number;now?:()=>number;
 /** Reservations older than this (the turn died without settling) count as spent at their worst case. */
 staleMs?:number;log?:(line:string)=>void}):SpendLedger{
 const {kv,capUsd}=opts,now=opts.now??Date.now,staleMs=opts.staleMs??20*60_000,log=opts.log??((line:string)=>console.warn(line));
 const empty=(month:string):MonthRecord=>({v:1,month,spentUsd:0,turns:0,reserved:{},alerts:{}});
 const key=(month:string)=>`spend/${month}`;
 /** Stale reservations become spent (worst case); settled-after-expiry entries older than two days are dropped. */
 function age(r:MonthRecord,t:number){for(const [id,x] of Object.entries(r.reserved)){if(!x.expired&&t-x.at>staleMs){x.expired=true;r.spentUsd=money(r.spentUsd+x.usd);}else if(x.expired&&t-x.at>2*86400_000)delete r.reserved[id];}}
 const reservedOf=(r:MonthRecord)=>money(Object.values(r.reserved).filter(x=>!x.expired).reduce((s,x)=>s+x.usd,0));
 /** Marks thresholds crossed in this write; the caller fires them only when its write wins. */
 function cross(r:MonthRecord,t:number):SpendAlert[]{const out:SpendAlert[]=[];for(const pct of [80,100] as const){const k=String(pct) as '80'|'100';if(!r.alerts[k]&&capUsd>0&&r.spentUsd>=capUsd*pct/100){r.alerts[k]=new Date(t).toISOString();out.push({month:r.month,thresholdPct:pct,spentUsd:r.spentUsd,capUsd});}}return out;}
 async function fire(alerts:SpendAlert[]){for(const a of alerts){log(JSON.stringify({event:'deck_ai_spend_alert',...a}));for(const hook of alertHooks){try{await hook(a);}catch{/* a failing hook never blocks a turn */}}}}
 return {capUsd,
  async snapshot(){const t=now(),m=monthOf(t),e=await kv.get(key(m)),r=(e?.value as MonthRecord|undefined)??empty(m);age(r,t);const reservedUsd=reservedOf(r);
   return {month:m,capUsd,spentUsd:r.spentUsd,reservedUsd,remainingUsd:money(Math.max(0,capUsd-r.spentUsd-reservedUsd)),turns:r.turns,alerts:r.alerts};},
  async reserve(id,usd){
   const t=now(),m=monthOf(t);let refused=false,alerts:SpendAlert[]=[];
   await kvUpdate<MonthRecord>(kv,key(m),current=>{const r=current??empty(m);refused=false;alerts=[];age(r,t);alerts=cross(r,t);
    if(capUsd<=0||r.spentUsd+reservedOf(r)+usd>capUsd+1e-9){refused=true;return alerts.length?r:undefined;}
    r.reserved[id]={usd:money(usd),at:t};r.turns++;return r;});
   await fire(alerts);
   return refused?{ok:false,reason:'cap_reached'}:{ok:true,month:m};
  },
  async settle(id,month,actualUsd){
   const t=now();let alerts:SpendAlert[]=[];
   await kvUpdate<MonthRecord>(kv,key(month),current=>{const r=current??empty(month);alerts=[];const x=r.reserved[id];
    if(x){const spent=actualUsd===null?x.usd:Math.max(0,actualUsd);r.spentUsd=money(r.spentUsd+(x.expired?spent-x.usd:spent));delete r.reserved[id];}
    else if(actualUsd!==null&&actualUsd>0)r.spentUsd=money(r.spentUsd+actualUsd);
    else return undefined;
    age(r,t);alerts=cross(r,t);return r;});
   await fire(alerts);
  }};
}

// ---------------------------------------------------------------------------------------------------------------
// Per-visitor daily turns

export interface VisitorId {cookie?:string|null;ip?:string|null}
export interface VisitorLimiter {dailyTurns:number;
 remaining(v:VisitorId):Promise<number>;
 /** Counts one turn against the visitor (cookie and IP), or refuses when either has none left today. */
 take(v:VisitorId):Promise<{ok:boolean;remaining:number}>;
 /** Gives a turn back (the turn could not be started). */
 refund(v:VisitorId):Promise<void>;
 /** A stable, anonymous owner key for this visitor's jobs. */
 owner(v:VisitorId):string}
/** The visitor's calendar day in Barrie (America/Toronto). */
export function dayOf(t:number):string{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));}catch{return new Date(t).toISOString().slice(0,10);}}
export const hashId=(salt:string,value:string)=>createHash('sha256').update(`${salt}\u0000${value}`).digest('hex').slice(0,32);
export function createVisitorLimiter(opts:{kv:AiKv;dailyTurns:number;
 /** Turns per hashed IP per day: a household or office shares an address. Default 3x dailyTurns. */
 ipDailyTurns?:number;salt:string;now?:()=>number}):VisitorLimiter{
 const {kv,dailyTurns,salt}=opts,ipTurns=opts.ipDailyTurns??dailyTurns*3,now=opts.now??Date.now;
 const keys=(v:VisitorId)=>{const day=dayOf(now()),out:{key:string;limit:number}[]=[];
  if(v.cookie)out.push({key:`turns/${day}/c/${hashId(salt,`cookie:${v.cookie}`)}`,limit:dailyTurns});
  // The IP hash also carries the day, so it cannot be followed from one day to the next.
  if(v.ip)out.push({key:`turns/${day}/i/${hashId(salt,`ip:${day}:${v.ip}`)}`,limit:v.cookie?ipTurns:dailyTurns});
  if(!out.length)out.push({key:`turns/${day}/anonymous`,limit:dailyTurns});
  return out;};
 const count=async(key:string)=>{const e=await kv.get(key);return typeof (e?.value as {turns?:unknown})?.turns==='number'?(e!.value as {turns:number}).turns:0;};
 const remaining=async(v:VisitorId)=>{let left=Infinity;for(const k of keys(v))left=Math.min(left,k.limit-await count(k.key));return Math.max(0,left===Infinity?dailyTurns:left);};
 return {dailyTurns,remaining,
  async take(v){const ks=keys(v);for(const k of ks)if(await count(k.key)>=k.limit)return {ok:false,remaining:0};
   for(const k of ks)await kvUpdate<{turns:number}>(kv,k.key,c=>({turns:(c?.turns??0)+1}));
   return {ok:true,remaining:await remaining(v)};},
  async refund(v){for(const k of keys(v))await kvUpdate<{turns:number}>(kv,k.key,c=>c&&c.turns>0?{turns:c.turns-1}:undefined);},
  owner(v){return v.cookie?hashId(salt,`owner:cookie:${v.cookie}`):hashId(salt,`owner:ip:${dayOf(now())}:${v.ip??'unknown'}`);}};
}

// ---------------------------------------------------------------------------------------------------------------
// Configuration

export interface AiLimits {capUsd:number;dailyTurns:number;ipDailyTurns:number;salt:string}
const num=(v:string|undefined,fallback:number,min:number,max:number)=>{const x=v===undefined||v.trim()===''?NaN:Number(v);return Number.isFinite(x)?Math.min(max,Math.max(min,x)):fallback;};
/** DECK_AI_MONTHLY_CAP_USD (default 25; 0 turns the cloud AI off), DECK_AI_DAILY_TURNS (default 10 per visitor),
 * DECK_AI_DAILY_TURNS_PER_IP (default 3x), DECK_AI_HASH_SALT (optional; hashes visitor ids). */
export function aiLimitsFromEnv(env:Record<string,string|undefined>):AiLimits{
 const capUsd=num(env.DECK_AI_MONTHLY_CAP_USD,25,0,1000),dailyTurns=Math.round(num(env.DECK_AI_DAILY_TURNS,10,0,200));
 return {capUsd,dailyTurns,ipDailyTurns:Math.round(num(env.DECK_AI_DAILY_TURNS_PER_IP,dailyTurns*3,0,1000)),salt:env.DECK_AI_HASH_SALT?.trim()||'deckcraft-ai-visitors-v1'};
}
/** Constant-time comparison of two ASCII tokens. */
export function sameToken(a:string,b:string):boolean{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
