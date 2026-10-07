// LIVE evaluation of the AI Site Designer against the real Claude API. It SPENDS MONEY: run it only with the owner's
// OK. It refuses to start without ANTHROPIC_API_KEY in the shell and --confirm-spend, and it stops at its own cap
// (--cap=USD, default 2) through the same ledger the site uses (in memory here; nothing is written to Netlify Blobs).
//
//   ANTHROPIC_API_KEY=... npx tsx scripts/eval-designer-ai-live.ts --confirm-spend [--cap=2] [--prompts=4]
//
// It runs canned homeowner requests on e2e/fixtures/craighurst-extended.json through the real path (engine concepts →
// Claude → conceptFromChoice → at most one revision), through the HTTP service and the browser client, and prints for
// each: the outcome, the chosen concept and moves, the engine's findings, the cost, and the prompt-cache tokens read
// and written (the second request onward should read the cached system prompt).
import '../src/features/deckcraft/siteModelRuntime';
import '../src/features/deckcraft/siteSurfaceEngine';
import {readFileSync} from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import type {BetaUsage} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {parseDesign} from '../src/features/deckcraft/designPersistence';
import {claudeProvider,type ClaudeClientLike} from '../server/siteDesignerAi';
import {createSpendLedger,createVisitorLimiter,memoryKv} from '../server/aiSpendLedger';
import {createAiTurnService,inlineDispatch,DESIGNER_AI_PATH,type AiTurnService} from '../server/aiTurnService';

const arg=(name:string)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.split('=')[1];
const key=process.env.ANTHROPIC_API_KEY?.trim();
if(!key||!process.argv.includes('--confirm-spend')){console.error('Live eval not started: it calls the paid Claude API. Set ANTHROPIC_API_KEY in this shell and pass --confirm-spend (owner approval required).');process.exit(2);}
const cap=Math.min(10,Math.max(.5,Number(arg('cap')??2))),count=Math.min(8,Math.max(1,Number(arg('prompts')??4)));
const PROMPTS=['We want a place to sit round a fire with friends on summer evenings.','Keep it simple and as affordable as possible; the slope is the main problem.','I would love a vegetable garden and somewhere the kids can play.','A gas fire table, not a bowl, and no raised patio please.','Something low-maintenance that makes the back yard usable.','We have about $15,000 to spend. What gives us the most?','A place to grow tomatoes near the house.','Make the yard look finished from the deck.'];

const usages:BetaUsage[]=[];const real=new Anthropic({apiKey:key,timeout:5*60_000,maxRetries:1});
const client:ClaudeClientLike={beta:{messages:{stream(params,options){const s=real.beta.messages.stream(params,options);return {async finalMessage(){const m=await s.finalMessage();usages.push(m.usage);return m;}};}}}};
const kv=memoryKv(),inflight=new Set<Promise<unknown>>();let svc:AiTurnService|undefined;
svc=createAiTurnService('designer',{provider:claudeProvider({client}),kv,now:Date.now,log:l=>console.log(l),ledger:createSpendLedger({kv,capUsd:cap}),limiter:createVisitorLimiter({kv,dailyTurns:100,salt:'live-eval'}),dispatch:inlineDispatch(()=>svc,inflight)});
const origin='https://goldenmaplelandscaping.ca';let jar='';
const fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{const headers=new Headers(init?.headers);if(jar)headers.set('cookie',jar);if(init?.method==='POST')headers.set('origin',origin);
 const res=await svc!.handle(new Request(new URL(String(input),origin),{method:init?.method??'GET',headers,body:init?.body}),{ip:'127.0.0.1'});const set=res.headers.get('set-cookie');if(set)jar=set.split(';')[0];return res;}) as typeof globalThis.fetch;

const fixture=JSON.parse(readFileSync(new URL('../e2e/fixtures/craighurst-extended.json',import.meta.url),'utf8'));await ensureLiveDesignExtensions(fixture);
const data=parseDesign(JSON.stringify(fixture));await ensureLiveDesignExtensions(data);
const {runDesignerTurn,askDesignerAi}=await import('../src/features/deckcraft/designer/siteDesignerAiClient');
console.log(`Live eval: ${count} prompts, cap $${cap}, endpoint ${DESIGNER_AI_PATH} (in process).`);
for(const prompt of PROMPTS.slice(0,count)){
 const from=usages.length,t=Date.now();
 const turn=await runDesignerTurn(data,prompt,{ask:(r,s)=>askDesignerAi(r,s,{fetch})});
 const used=usages.slice(from);
 console.log(JSON.stringify({prompt,status:turn.status,reason:turn.reason??null,concept:turn.concept?.id??null,moves:turn.concept?.moves.map(m=>[m.kind,m.params])??null,subtotal:turn.concept?.subtotal??null,revised:turn.revised,findings:turn.findings,
  explanation:turn.explanation,questions:turn.questions,seconds:Math.round((Date.now()-t)/1000),cacheRead:used.map(u=>u.cache_read_input_tokens??0),cacheWrite:used.map(u=>u.cache_creation_input_tokens??0),outputTokens:used.map(u=>u.output_tokens)},null,1));
}
const s=await createSpendLedger({kv,capUsd:cap}).snapshot();
console.log(`Spent $${s.spentUsd.toFixed(4)} of the $${cap} eval cap over ${s.turns} model turns.`);
