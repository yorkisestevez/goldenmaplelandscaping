import type {PricingRequest} from './optionPricing';
type Job=Extract<PricingRequest,{job:number}>;
/** Keep lazy private costing outside the public worker; cancelled loads never resurrect an option job. */
export function createQuoteAwarePricingReceiver(receive:(request:PricingRequest)=>void,load:()=>Promise<unknown>,unavailable:(job:Job)=>void){
 const waiting=new Map<number,Job>();let ready=false,loading:Promise<void>|null=null;
 return (request:PricingRequest)=>{
  if('cancel'in request){waiting.delete(request.cancel);receive(request);return;}
  waiting.delete(request.job);
  if(!request.data.quoteResolutions?.length||ready){receive(request);return;}
  waiting.set(request.job,request);
  loading??=load().then(()=>{ready=true;},error=>{loading=null;throw error;});
  void loading.then(()=>{if(waiting.get(request.job)!==request)return;waiting.delete(request.job);receive(request);},()=>{if(waiting.get(request.job)!==request)return;waiting.delete(request.job);unavailable(request);});
 };
}
