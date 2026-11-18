import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {poolTypesReady} from '../src/features/deckcraft/poolTypes';
import {poolModelReady} from '../src/features/deckcraft/poolModel';
import {poolQuoteReady} from '../src/features/deckcraft/poolQuoteRegistry';
import {poolDrawingsReady} from '../src/features/deckcraft/poolDrawings';
import {poolQuoteTypesReady} from '../src/features/deckcraft/poolQuoteTypes';
import {ensureLiveDesignExtensions,designExtensionsReady,hasAdvancedYard} from '../src/features/deckcraft/designExtensions';
import {validateDesign} from '../src/features/deckcraft/designPersistence';
import {createQuoteAwarePricingReceiver} from '../src/features/deckcraft/designer/quoteAwarePricingReceiver';
import type {PricingRequest} from '../src/features/deckcraft/designer/optionPricing';
let checks=0;const check=(v:unknown,m:string)=>{assert.ok(v,m);checks++;},tick=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
async function main(){
 const ready=()=>[poolTypesReady(),poolModelReady(),poolQuoteReady(),poolDrawingsReady(),poolQuoteTypesReady()];check(ready().every(v=>!v),'Pool runtimes initially cold');await ensureLiveDesignExtensions(DEFAULT_DECK);check(ready().every(v=>!v),'Legacy designs do not load pool tooling');
 const empty={...structuredClone(DEFAULT_DECK),pools:[]};validateDesign(empty);await ensureLiveDesignExtensions(empty);check(designExtensionsReady(empty)&&ready().every(v=>!v),'Empty pool collections validate without optional loads');
 let calls=0;const unsafe={...DEFAULT_DECK};Object.defineProperty(unsafe,'pools',{enumerable:true,get(){calls++;throw Error('Unsafe pool getter');}});await ensureLiveDesignExtensions(unsafe);check(!calls,'Extension discovery never invokes pool getters');assert.throws(()=>validateDesign(unsafe));checks++;check(!calls,'Validation rejects pool accessor before invocation');
 const proxy=new Proxy([{}],{get(){calls++;throw Error('Unsafe pool array read');}});check(hasAdvancedYard({...DEFAULT_DECK,pools:proxy})&&!calls,'Pool presence detection reads array descriptors only');
 const received:PricingRequest[]=[],failed:number[]=[],pending:{resolve:()=>void;reject:(e:Error)=>void}[]=[];
 const receiver=createQuoteAwarePricingReceiver(r=>received.push(r),()=>new Promise<void>((resolve,reject)=>pending.push({resolve,reject})),r=>failed.push(r.job));
 const slope={...structuredClone(DEFAULT_DECK),terrainConfig:{widthFt:80,depthFt:80,elevationIn:1,slopePct:0}},job=(n:number,data=slope):PricingRequest=>({job:n,data,items:[{key:`job-${n}`,patch:{width:18}}]});
 receiver(job(1));pending[0].resolve();await tick();check(received.some(r=>'job'in r&&r.job===1),'Existing advanced terrain prepares separately');
 const pools={...slope,pools:[{}] as any};receiver(job(2,pools));check(pending.length===2&&!received.some(r=>'job'in r&&r.job===2),'Previously prepared terrain cannot bypass later pool loading');receiver({cancel:2});pending[1].resolve();await tick();check(!received.some(r=>'job'in r&&r.job===2),'Cancelled pool load cannot publish results');
 const prices={...pools,poolQuoteInputs:{version:1 as const,scopes:[],packages:[]}};receiver(job(3,prices));check(pending.length===3,'Later private quote inputs require their own preparation');pending[2].reject(Error('simulated pool import failure'));await tick();check(failed.includes(3)&&!received.some(r=>'job'in r&&r.job===3),'Failed private preparation never emits fallback quantities');receiver(job(4,prices));pending[3].resolve();await tick();check(received.some(r=>'job'in r&&r.job===4),'Optional preparation retries successfully');
 console.log(`Pool cold readiness and stale worker guards: ${checks} checks passed.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
