import {pergolaQuoteKey,type PergolaQuoteContext} from '../pergolaPricing';
import {calculateDeckReleasePrices,deckReleaseData} from '../deckReleaseCore';
import {DECK_SETTINGS} from '../defaults';
import {pruneEdgeNames} from '../edgeNames';
import {extrasLayout} from '../extrasLayout';
import {syncAutoLighting} from '../lightingSystem';
import type {DeckData} from '../types';

/**
 * Pricing one option for its price effect (R6): the design with the option picked, the way the page picks it, priced by
 * the engine and settled as the page settles it. Engine only, no page code (the sections, the ledger, React), so the
 * option deltas' worker runs it off the main thread. No engine or price change: this only calls the engine.
 */

/** The design with one option picked, as the page's update makes it (useDeckDesign). */
export const applyOption=(data:DeckData,patch:Partial<DeckData>)=>pruneEdgeNames(deckReleaseData({...data,...patch}));
/** The estimate the page settles on for a design: after the post, step and screen lights follow the modelled mounts. */
export function settledEstimate(design:DeckData,context?:PergolaQuoteContext){
  const settings={...DECK_SETTINGS,pergolaQuote:context?.key===pergolaQuoteKey(design)?context.quote:undefined};
  const estimate=calculateDeckReleasePrices(design,settings);
  const extras=extrasLayout(design,estimate.model),counts={posts:estimate.model.railing.posts.length,stairs:estimate.model.treads.length,privacy:extras.privacyMounts.length,border:extras.borderMounts.length};
  const lights=syncAutoLighting(design,counts);
  if(JSON.stringify(lights)===JSON.stringify(design.lightingSystem.selectedItems))return estimate;
  return calculateDeckReleasePrices(deckReleaseData({...design,lightingSystem:{...design.lightingSystem,selectedItems:lights}}),settings);
}
type Estimate=ReturnType<typeof calculateDeckReleasePrices>;
/** An estimate without its model (the takeoff): all the price schedule reads, small enough to post between threads. */
export type EstimateFigures=Pick<Estimate,'sections'|'subtotal'|'hst'|'total'|'quoteRequired'>;
/** The option picked on the design, priced and settled. */
export function priceOption(data:DeckData,patch:Partial<DeckData>,context?:PergolaQuoteContext):EstimateFigures{
  const {sections,subtotal,hst,total,quoteRequired}=settledEstimate(applyOption(data,patch),context);
  return {sections,subtotal,hst,total,quoteRequired};
}

/** One option to price: its cache key and its patch. */
export interface PricingItem{key:string;patch:Partial<DeckData>}
/** To the pricing queue: price a job's options on its design, or cancel a job. */
export type PricingRequest={job:number;data:DeckData;items:PricingItem[];pergolaQuote?:PergolaQuoteContext}|{cancel:number};
/** From the pricing queue: one option's figures (or that it could not be priced). */
export type PricingResult={job:number;key:string;figures:EstimateFigures|null};

/**
 * The worker's queue: jobs in the order they came, one option per task (`defer` between options), so a new job or a
 * cancel is read between any two options. A cancelled job prices nothing more. Pure, so the checks drive it by hand.
 */
export function createPricingQueue(post:(result:PricingResult)=>void,defer:(step:()=>void)=>void){
  const jobs=new Map<number,{data:DeckData;items:PricingItem[];pergolaQuote?:PergolaQuoteContext}>();
  let waiting=false;
  const step=()=>{
    waiting=false;
    const next=jobs.entries().next();
    if(next.done)return;
    const [job,{data,items,pergolaQuote}]=next.value,item=items.shift()!;
    if(!items.length)jobs.delete(job);
    let figures:EstimateFigures|null=null;
    try{figures=priceOption(data,item.patch,pergolaQuote);}catch{/* Left unpriced: the option shows no figure. */}
    post({job,key:item.key,figures});
    if(jobs.size&&!waiting){waiting=true;defer(step);}
  };
  return (request:PricingRequest)=>{
    if('cancel' in request){jobs.delete(request.cancel);return;}
    if(!request.items.length)return;
    jobs.set(request.job,{data:request.data,items:[...request.items],pergolaQuote:request.pergolaQuote});
    if(!waiting){waiting=true;defer(step);}
  };
}
