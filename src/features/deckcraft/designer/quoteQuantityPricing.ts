import type {QuoteScope} from '../quoteResolutions';
import {QUOTE_RESOLUTION_LIMITS} from '../quoteResolutionValidation';

/** One measured row can accept a rate in its own unit. Mixed scope bundles need a total. */
export function quoteUnitBasis(scope:QuoteScope){
 const row=scope.rows.length===1?scope.rows[0]:undefined,quantity=Number(row?.qty);
 return row&&Number.isFinite(quantity)&&quantity>0&&!/^(scope|allowance|assembly|system quote|order|design review|layout)$/.test(row.unit)?{quantity,unit:row.unit}:null;
}
export function quoteCostFromUnitRates(scope:QuoteScope,supplyRate:string,installationRate:string){
 const basis=quoteUnitBasis(scope);if(!basis)throw Error('Use a total quote for this scope.');
 const amount=(value:string)=>{if(!value.trim())return 0;const rate=Number(value);if(!Number.isFinite(rate)||rate<0||rate>QUOTE_RESOLUTION_LIMITS.amount||Math.abs(rate*100-Math.round(rate*100))>1e-6)throw Error('Use a nonnegative CAD unit rate with at most two decimals.');const total=Math.round(rate*basis.quantity*100)/100;if(total>QUOTE_RESOLUTION_LIMITS.amount)throw Error('The measured quote amount exceeds the cost limit.');return total;};
 return {supplyCost:amount(supplyRate),installationCost:amount(installationRate),basis};
}
