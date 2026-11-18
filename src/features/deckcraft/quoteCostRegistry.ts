import type {applyQuoteResolutions as Apply} from './quoteResolutions';
export type {QuoteResolutionReview} from './quoteResolutions';
let costing:typeof Apply|undefined;
/** Private quote origins load this applicator before introducing records into a design. */
export function registerQuoteCosting(apply:typeof Apply){costing=apply;}
export function applyQuoteResolutions(...args:Parameters<typeof Apply>):ReturnType<typeof Apply>{
 if(!args[0].quoteResolutions?.length)return undefined;
 if(!costing)throw Error('Load the private quote-cost review before pricing saved quote records.');
 return costing(...args);
}
