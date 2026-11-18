import type {DeckEstimate} from '../designFacts';
import {dollars} from '../designFacts';
import {optionScopeComparison} from './optionScopeComparison';
export default function OptionScopeChanges({before,after}:{before:DeckEstimate;after:DeckEstimate}){
 const changes=optionScopeComparison(before,after),qty=(n:number)=>n.toLocaleString('en-CA',{maximumFractionDigits:2});
 return <section aria-label="What changes between options"><h4>What changes</h4><p>{changes.area>=0?'+':''}{qty(changes.area)} sq ft · {changes.personHours>=0?'+':''}{qty(changes.personHours)} planned person-hours</p>
 {changes.amounts.map(r=><p key={r.title}><strong>{r.title}</strong><br/>{dollars(r.before)} → {dollars(r.after)} · {r.delta>=0?'+':''}{dollars(r.delta)} before HST{r.pending?' · quote scope remains':''}</p>)}
 <details><summary>Changed quantities ({changes.quantities.length})</summary>{changes.quantities.length?changes.quantities.map((r,i)=><p key={i}><strong>{r.name}</strong><br/>{qty(r.before)} → {qty(r.after)} {r.unit} · {r.section}</p>):<p>No measured quantity changes.</p>}</details>
 {!!changes.addedQuotes.length&&<><h4>New quote requirements</h4><ul>{changes.addedQuotes.map(q=><li key={q}>{q}</li>)}</ul></>}
 {!!changes.removedQuotes.length&&<><h4>Requirements no longer listed</h4><p>Scope may have been removed or confirmed; this does not certify construction readiness.</p><ul>{changes.removedQuotes.map(q=><li key={q}>{q}</li>)}</ul></>}
 </section>;
}
