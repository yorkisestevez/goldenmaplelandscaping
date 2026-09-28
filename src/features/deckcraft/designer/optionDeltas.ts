import type {PergolaQuoteContext} from '../pergolaPricing';
import type {DeckEstimate} from '../designFacts';
import type {DeckData} from '../types';
import type {OptionGroup} from './optionGroups';
import {priceOption,type EstimateFigures,type PricingItem,type PricingResult} from './optionPricing';
import {priceLedger,type QuoteKind} from './priceLedgerModel';
import {signedDollars,wholeDollarChange} from './useChangeLedger';

/**
 * The price effect of each option (R6): what picking it would do to the priced subtotal, beside the option. Loaded on
 * demand, never with the page. A delta is one engine run on the design with that option picked, the way the page picks
 * it (the section's patch, then the automatic lighting sync; optionPricing.ts), minus the page's live estimate. Only the
 * open section's groups are priced, one option at a time: in a worker, so no engine run holds up the page, or where a
 * worker cannot start, one option per idle slice on the page. Each result is cached by the design's estimate key and the
 * option's patch, so a delta is never shown for any design but the one it was priced for. No engine or price change.
 */

/**
 * The design a delta is measured from: the page's live estimate (its priced subtotal, its quotes and its schedule lines'
 * priced amounts) and the estimate key it was priced under.
 */
export interface DeltaBase{key:string;subtotal:number;quotes:readonly string[];lines:readonly {title:string;amount:number}[]}
/** An option's price effect in words: "+$1,240", "−$380", "no change", or "supplier quote" (never "$0"). */
export interface DeltaView{kind:'up'|'down'|'none'|'quote';text:string;amount:number}
/** What the design would cost with the option picked: its priced subtotal, every selection still to be quoted, and the
 * schedule lines that are only a quote. */
export interface Priced{subtotal:number;quotes:{label:string;kind:QuoteKind}[];quotedLines:string[]}

/** An option's figures as the schedule reads them (priceLedger reads only these figures, never the model). */
export function summarize(figures:EstimateFigures):Priced{
  const ledger=priceLedger(figures as DeckEstimate);
  return {subtotal:figures.subtotal,quotes:ledger.quotes.map(({label,kind})=>({label,kind})),quotedLines:ledger.lines.filter(l=>l.quotes.length&&l.amount<.005).map(l=>l.title)};
}

/**
 * "+$1,240", "−$380", "no change", or a quote, never "$0" for one. An option that turns a priced line of the schedule
 * into a quote reads "supplier quote" (or "builder quote") alone: its figure would only be the priced part leaving the
 * total. One that adds a quote beside priced work reads "+$1,240 + supplier quote". One that leaves selections off the
 * quote list says how many, as "Your changes" does, because its figure is then no comparison with what those will cost.
 */
export function describeDelta(base:DeltaBase,next:Priced):DeltaView{
  const had=new Set(base.quotes),added=next.quotes.filter(q=>!had.has(q.label));
  const amount=wholeDollarChange(base.subtotal,next.subtotal);
  if(added.length){
    const kinds=new Set(added.map(q=>q.kind)),quote=kinds.size>1?'supplier and builder quotes':`${[...kinds][0]} quote`;
    const flips=next.quotedLines.some(title=>base.lines.some(l=>l.title===title&&l.amount>=.005));
    return {kind:'quote',amount,text:flips||!amount?quote:`${signedDollars(amount)} + ${quote}`};
  }
  const dropped=[...had].filter(q=>!next.quotes.some(n=>n.label===q)).length,fewer=dropped?` · ${dropped} fewer to quote`:'';
  if(!amount)return {kind:'none',amount,text:`no change${fewer}`};
  return {kind:amount>0?'up':'down',amount,text:`${signedDollars(amount)}${fewer}`};
}

// Priced options, by the design's estimate key and the option's patch (oldest dropped first).
const cache=new Map<string,Priced>();
const MAX_CACHED=600;
/** A patch as text; a field it clears (undefined) is kept, so {} and {catalogueRailingId:undefined} differ. */
const patchText=(patch:Partial<DeckData>)=>JSON.stringify(patch,(_key,value:unknown)=>value===undefined?'\u0000cleared':value);
export const deltaKey=(base:DeltaBase,patch:Partial<DeckData>)=>`${base.key}\u0001${patchText(patch)}`;
function remember(key:string,priced:Priced){
  if(cache.size>=MAX_CACHED)cache.delete(cache.keys().next().value!);
  cache.set(key,priced);
  return priced;
}
const price=(base:DeltaBase,data:DeckData,patch:Partial<DeckData>)=>{const key=deltaKey(base,patch);return cache.get(key)??remember(key,summarize(priceOption(data,patch)));};
/** An option's delta if it has been priced for this very design (its estimate key), else undefined. */
export function cachedDelta(base:DeltaBase,patch:Partial<DeckData>):DeltaView|undefined{
  const hit=cache.get(deltaKey(base,patch));
  return hit&&describeDelta(base,hit);
}
/** An option's delta, priced now if it has not been. `data` is the design `base` was priced from. */
export const optionDelta=(base:DeltaBase,data:DeckData,patch:Partial<DeckData>)=>describeDelta(base,price(base,data,patch));
/** A result from the pricing queue (the worker): kept under its own design's key, whichever run asked for it. */
export function acceptPriced({key,figures}:Pick<PricingResult,'key'|'figures'>){if(figures)remember(key,summarize(figures));}
/** Forgets every priced option (the checks). */
export const clearDeltaCache=()=>cache.clear();

/** The groups' options not yet priced for this design, once each, in page order; never the current choice. */
function queueFor(base:DeltaBase,groups:readonly OptionGroup[]):PricingItem[]{
  const queued=new Set<string>();
  return groups.flatMap(g=>g.choices.filter(c=>c.value!==g.current)).flatMap(({patch})=>{
    const key=deltaKey(base,patch);
    if(cache.has(key)||queued.has(key))return [];
    queued.add(key);return [{key,patch}];
  });
}

/** Runs `work` when the browser is idle (a timer where it has no idle callback); returns a cancel. */
export type Schedule=(work:()=>void)=>()=>void;
const whenIdle:Schedule=work=>{
  if(typeof requestIdleCallback==='function'){const id=requestIdleCallback(()=>work(),{timeout:1000});return ()=>cancelIdleCallback(id);}
  const id=setTimeout(work,16);return ()=>clearTimeout(id);
};
/** Each option's work on the page is a user-timing measure of this name (cleared at once; an observer still sees it). */
export const DELTA_MEASURE='deckcraft-option-delta';
function measured(start:number){
  try{performance.measure(DELTA_MEASURE,{start,end:performance.now()});performance.clearMeasures(DELTA_MEASURE);}catch{/* Timing is optional. */}
}
interface Run{base:DeltaBase;data:DeckData;groups:readonly OptionGroup[];onPriced:()=>void;pergolaQuote?:PergolaQuoteContext}

/** On the page: one option per idle slice, then `onPriced`. Returns a cancel. */
function runOnPage({base,data,groups,onPriced,pergolaQuote}:Run,schedule:Schedule):()=>void{
  const queue=queueFor(base,groups);
  let stopped=false,cancel:(()=>void)|null=null;
  const next=()=>{
    cancel=null;
    if(stopped||!queue.length)return;
    cancel=schedule(()=>{
      if(stopped)return;
      const start=performance.now(),{key,patch}=queue.shift()!;
      try{if(!cache.has(key))remember(key,summarize(priceOption(data,patch,pergolaQuote)));}catch{/* Left unpriced: the option shows no figure. */}
      measured(start);
      onPriced();
      next();
    });
  };
  next();
  return ()=>{stopped=true;cancel?.();};
}

// The worker (optionDeltas.worker.ts), started with the first run; null where it cannot start.
let worker:Worker|null|undefined;
let jobs=0;
const running=new Map<number,Run&{onPage?:()=>void}>();
function pricingWorker():Worker|null{
  if(worker!==undefined)return worker;
  try{worker=typeof Worker==='function'?new Worker(new URL('./optionDeltas.worker.ts',import.meta.url),{type:'module'}):null;}catch{worker=null;}
  worker?.addEventListener('message',(event:MessageEvent<PricingResult>)=>{
    const start=performance.now();
    acceptPriced(event.data);
    running.get(event.data.job)?.onPriced();
    measured(start);
  });
  // A worker that fails to start leaves its runs to the page, one option per idle slice.
  worker?.addEventListener('error',()=>{
    worker?.terminate();worker=null;
    for(const run of running.values())run.onPage??=runOnPage(run,whenIdle);
  });
  return worker;
}

/**
 * Prices the groups' options that are not priced yet for this design, one at a time, in page order, and calls
 * `onPriced` after each: in the worker, or with `schedule` (the checks) or without a worker, on the page one per idle
 * slice. Returns a cancel: the page cancels the run when the design changes (its estimate key) or the section closes.
 */
export function runOptionDeltas({schedule,...run}:Run&{schedule?:Schedule}):()=>void{
  const pricing=schedule?null:pricingWorker();
  if(!pricing)return runOnPage(run,schedule??whenIdle);
  const job=++jobs,items=queueFor(run.base,run.groups),entry:Run&{onPage?:()=>void}={...run};
  running.set(job,entry);
  pricing.postMessage({job,data:run.data,items,pergolaQuote:run.pergolaQuote});
  return ()=>{running.delete(job);entry.onPage?.();worker?.postMessage({cancel:job});};
}
