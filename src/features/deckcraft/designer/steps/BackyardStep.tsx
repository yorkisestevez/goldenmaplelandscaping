import YardEditor from '../../YardEditor';
import {dollars,type DeckEstimate} from '../../designFacts';
import {splitSubtotal} from '../../backyard';
import type {DeckData} from '../../types';
import type {Update} from '../fields';

/** Step 5: patios, retaining walls and water features around the deck, with their own subtotal. */
export default function BackyardStep({data,update,estimate,earlierYard,onRestoreEarlierYard,onDismissEarlierYard}:{data:DeckData;update:Update;estimate:DeckEstimate;earlierYard:number;onRestoreEarlierYard:()=>void;onDismissEarlierYard:()=>void}){
  const active=(data.yardFeatures??[]).filter(f=>f.enabled),split=splitSubtotal(estimate),yard=estimate.yardTakeoff;
  return <>
    {earlierYard>0&&<div className="dd-quote-notice" role="status"><strong>Your earlier design had a backyard</strong><p>It had {earlierYard} backyard feature{earlierYard===1?'':'s'} (patios, walls or water). Add {earlierYard===1?'it':'them'} back to this design?</p><div className="dd-summary-actions"><button type="button" className="dd-primary" onClick={onRestoreEarlierYard}>Add {earlierYard===1?'it':'them'} back</button><button type="button" className="dd-secondary" onClick={onDismissEarlierYard}>No thanks</button></div></div>}
    <YardEditor data={data} onChange={update}/>
    {active.length>0&&<p className="dd-note dd-backyard-subtotal" role="status">Backyard subtotal: <strong>{dollars(split.backyard)}</strong> + HST{yard.quoteRequired?' (the priced portion; some items need a supplier quote)':''}. It is shown separately from the deck on your estimate and proposal.</p>}
  </>;
}
