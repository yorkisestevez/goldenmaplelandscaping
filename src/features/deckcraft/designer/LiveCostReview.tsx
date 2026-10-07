import type {DeckData} from '../types';
import {dollars,type DeckEstimate} from '../designFacts';
import {estimateConfidence,materialMarginPercent} from './estimateConfidence';
export default function LiveCostReview({data,estimate}:{data:DeckData;estimate:DeckEstimate}){
 const cost=estimateConfidence(estimate),markup=data.materialMarkup??35,margin=materialMarginPercent(markup);
 return <details className="dd-advanced"><summary>Live quantities, costs &amp; margin</summary>
 <p>Updates with the design. CAD before HST. Confirmed amounts cover their recorded scope; allowances still need review.</p>
 <dl><dt>Confirmed scope included</dt><dd>{dollars(cost.totals.confirmed)}</dd><dt>Planning allowances included</dt><dd>{dollars(cost.totals.allowance)}</dd><dt>Still to quote</dt><dd>{cost.pending} requirements, excluded from the priced total</dd></dl>
 <h4>Labour</h4><p>{estimate.manHours.toFixed(1)} planned person-hours. Labour overrides change the price, not the modeled hours.</p>{cost.labour.map((r,i)=><p key={i}>{r.name}: {r.cost===null?'Awaiting builder quote':dollars(r.cost)} · {r.qty} {r.unit}<br/>{r.spec}</p>)}
 <h4>Waste &amp; ordering</h4><p>Extra stock below includes cuts, offcuts, spare boards and stock-length rounding. It is already in the takeoff; it is not an extra charge.</p>
 {cost.stock.map((r,i)=><p key={i}><strong>{r.name}</strong><br/>{r.installedLf.toFixed(1)} ft installed → {r.orderedLf.toFixed(1)} ft ordered ({r.orderedPieces} pieces); {r.extraLf.toFixed(1)} ft extra{r.installedLf>0?' · '+r.extraPercent.toFixed(1)+'%':''}.{r.unresolvedIn.length>0?' Stock lengths require confirmation.':''}</p>)}
 <h4>Delivery &amp; hauling</h4>{cost.delivery.length?cost.delivery.map((r,i)=><p key={i}>{r.name}: {r.status==='pending'?'Awaiting supplier / hauler quote':r.status==='confirmed'?'Covered by confirmed scope':'Planning allowance'}{r.cost!==null?' · '+dollars(r.cost):''}<br/>{r.spec}</p>):<p>No separate delivery amount is identified. Confirm freight and unloading; do not assume free delivery.</p>}
 <p>Some scopes bundle delivery with supply or site work. Reconcile shared deliveries once in the quote controls.</p>
 <h4>Material markup &amp; margin</h4><p>{markup}% material markup{margin!==null?' equals '+margin.toFixed(2)+'% margin on that marked-up material component':''}. Labour and bundled assemblies follow their own pricing basis. Whole-project profit cannot be inferred without complete actual costs.</p>
 <details><summary>Every priced quantity and its status</summary>{cost.rows.map((r,i)=><p key={i}><strong>{r.name}</strong> · {r.qty} {r.unit}<br/>{r.status==='confirmed'?'Confirmed scope':r.status==='allowance'?'Planning allowance':'Awaiting supplier / builder quote'} · {r.cost===null?r.quoteResolved?'Included in confirmed scope':'Not included':dollars(r.cost)}<br/>{r.spec}</p>)}</details>
 </details>;
}
