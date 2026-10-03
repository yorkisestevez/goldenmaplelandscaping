import {needsAdvancedYard} from '../yardModel';
import type {DeckData} from '../types';
import type {PricingRequest} from './optionPricing';
type Job=Extract<PricingRequest,{job:number}>;
const extensions=(data:DeckData)=>(data.quoteResolutions?.length?1:0)|(data.siteModel!==undefined?2:0)|(data.landscapeObjects!==undefined?4:0)|(data.editorOrganization!==undefined?8:0)|(data.landscapeObjects?.length?16:0)|(data.stairTargets!==undefined?32:0)|(data.yardFeatures?.some(f=>f.wallTopSteps!==undefined)?64:0)|(needsAdvancedYard(data)?128:0)|(data.pools?.length?256:0)|(data.poolQuoteInputs!==undefined?512:0);
/** A pending load is shared only when it covers the requested extension set.
 * Cancelled or superseded jobs never resume, and a later optional field still
 * loads its own engine even after an earlier private quote job completed. */
export function createQuoteAwarePricingReceiver(receive:(request:PricingRequest)=>void,load:(data:DeckData)=>Promise<unknown>,unavailable:(job:Job)=>void){
 const waiting=new Map<number,Job>(),loading=new Map<number,Promise<void>>();let ready=0;
 return (request:PricingRequest)=>{
  if('cancel'in request){waiting.delete(request.cancel);receive(request);return;}
  waiting.delete(request.job);const required=extensions(request.data);
  if((ready&required)===required){receive(request);return;}
  waiting.set(request.job,request);
  let pending=[...loading].find(([mask])=>(mask&required)===required)?.[1];
  if(!pending){pending=load(request.data).then(()=>{loading.delete(required);ready|=required;},error=>{loading.delete(required);throw error;});loading.set(required,pending);}
  void pending.then(()=>{if(waiting.get(request.job)!==request)return;waiting.delete(request.job);receive(request);},()=>{if(waiting.get(request.job)!==request)return;waiting.delete(request.job);unavailable(request);});
 };
}
