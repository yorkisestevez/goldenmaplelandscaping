/**
 * Homeowners who open a proposal or download a PDF without sending the design are warm leads.
 * Track once per kind per visit and optionally ping the CRM form so Sophie/Yorkis can follow up.
 */
import {trackDeck} from './deckAnalytics';

const KEY='gm_deckcraft_warm_lead';
const FORM='deck-warm-lead';

export type WarmLeadKind='proposal'|'pdf'|'share';

function remembered():Set<string>{
  try{return new Set(JSON.parse(sessionStorage.getItem(KEY)??'[]') as string[]);}catch{return new Set();}
}
function remember(sent:Set<string>){
  try{sessionStorage.setItem(KEY,JSON.stringify([...sent]));}catch{/* in-memory still de-dupes this visit */}
}

/** Record a warm-lead moment. Fires GA once per kind per visit; posts a lightweight CRM ping in production. */
export function noteWarmLead(kind:WarmLeadKind,detail:{pricedSubtotal?:number;hasName?:boolean;hasAddress?:boolean}={}){
  const sent=remembered(),tag=`warm_${kind}`;
  if(!sent.has(tag)){
    sent.add(tag);remember(sent);
    trackDeck('deckcraft_output',`deck_warm_${kind}`);
  }
  if(import.meta.env.DEV){
    // eslint-disable-next-line no-console
    console.log('[dev] warm lead',kind,detail);
    return;
  }
  // Soft ping: no PII required. Attribution rides with the site's form fields when available.
  void (async()=>{
    try{
      const {getAttributionFields}=await import('../../utils/utmCapture');
      const {getBehaviorFields}=await import('../../utils/behavior');
      const body=new URLSearchParams({
        'form-name':FORM,
        kind,
        priced_subtotal:detail.pricedSubtotal!=null?String(Math.round(detail.pricedSubtotal)):'',
        has_name:detail.hasName?'1':'0',
        has_address:detail.hasAddress?'1':'0',
        path:typeof location!=='undefined'?location.pathname:'/deck-designer',
        ...getAttributionFields(),
        ...getBehaviorFields(),
      });
      await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString(),keepalive:true});
    }catch{/* follow-up is best-effort */}
  })();
}
