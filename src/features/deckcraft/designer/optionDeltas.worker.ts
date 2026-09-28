import {createPricingQueue,type PricingRequest,type PricingResult} from './optionPricing';

/**
 * The option deltas' worker (R6): prices options off the main thread, one per task, so no option's engine run (a
 * herringbone layout on a large wrap-around takes well over 50 ms) ever holds up the page.
 */
const scope=self as unknown as {postMessage:(result:PricingResult)=>void;addEventListener:(type:'message',listener:(event:MessageEvent<PricingRequest>)=>void)=>void};
const receive=createPricingQueue(result=>scope.postMessage(result),step=>setTimeout(step,0));
scope.addEventListener('message',event=>receive(event.data));
