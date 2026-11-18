import {createPricingQueue,type PricingRequest,type PricingResult} from './optionPricing';
import {createQuoteAwarePricingReceiver} from './quoteAwarePricingReceiver';

/**
 * The option deltas' worker (R6): prices options off the main thread, one per task, so no option's engine run (a
 * herringbone layout on a large wrap-around takes well over 50 ms) ever holds up the page.
 */
const scope=self as unknown as {postMessage:(result:PricingResult)=>void;addEventListener:(type:'message',listener:(event:MessageEvent<PricingRequest>)=>void)=>void};
const receive=createPricingQueue(result=>scope.postMessage(result),step=>setTimeout(step,0));
const quoteAware=createQuoteAwarePricingReceiver(receive,data=>Promise.all([import('../designExtensions').then(module=>module.ensureLiveDesignExtensions(data)),...(data.quoteResolutions?.length?[import('../quoteResolutions')]:[])]),job=>job.items.forEach(item=>scope.postMessage({job:job.job,key:item.key,figures:null})));
scope.addEventListener('message',event=>quoteAware(event.data));
