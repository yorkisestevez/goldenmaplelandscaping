import {Suspense,lazy,useLayoutEffect,useRef,useState} from 'react';
import {dollars} from '../designFacts';
const LedgerDrawer=lazy(()=>import('./PriceLedger').then(m=>({default:m.LedgerDrawer})));
import {quoteLabel,type Ledger} from './priceLedgerModel';
import type {ChangeRecord} from './useChangeLedger';
export default function WorkspacePrice({ledger,changes,onFullList,onQuoteReview}:{ledger:Ledger;changes:readonly ChangeRecord[];onFullList:()=>void;onQuoteReview?:()=>void}){
  const [open,setOpen]=useState(false),opener=useRef<HTMLButtonElement>(null),bar=useRef<HTMLElement>(null);
  // On phones and tablets the bar is fixed over the page. Its measured height goes on the root element so the page can
  // reserve it at its end and scroll anything brought into view (by focus, a tap or scrollIntoView) clear of it.
  useLayoutEffect(()=>{
    const element=bar.current,root=document.documentElement;if(!element)return;
    const measure=()=>root.style.setProperty('--dd-price-height',`${element.getBoundingClientRect().height}px`);
    measure();const observer=new ResizeObserver(measure);observer.observe(element,{box:'border-box'});
    return ()=>{observer.disconnect();root.style.removeProperty('--dd-price-height');};
  },[]);
  return <><section ref={bar} className="dd-workspace-price" aria-label="Live price"><div className="dd-workspace-amount"><span>Planning estimate</span><strong role="status" aria-label="Priced subtotal" aria-live="off">{dollars(ledger.subtotal)}</strong><small>Priced portion · before HST</small></div><button ref={opener} type="button" className="dd-secondary" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}>Price schedule <span aria-hidden="true">↗</span></button>{ledger.quotes.length>0&&<details className="dd-workspace-quotes"><summary>{ledger.quotes.length} items still to quote</summary><ul aria-label="Still to be quoted: not in the planning total">{ledger.quotes.map(q=><li key={`${q.kind}-${q.label}`}><span className="dd-tag" data-kind={q.kind}>{q.kind==='builder'?'Builder':'Supplier'}</span>{quoteLabel(q.label)}</li>)}</ul><p>These costs are not included in the priced total.</p></details>}{onQuoteReview&&<button type="button" className="dd-quote-review-link" aria-haspopup="dialog" onClick={onQuoteReview}>Edit costs &amp; quotes</button>}</section>{open&&<Suspense fallback={<p role="status">Opening price schedule…</p>}><LedgerDrawer ledger={ledger} changes={changes} opener={opener} onClose={()=>setOpen(false)} onFullList={()=>{setOpen(false);onFullList();}}/></Suspense>}</>;
}
