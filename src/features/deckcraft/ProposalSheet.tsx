import {useEffect} from 'react';
import {createPortal} from 'react-dom';
import {BUSINESS,publicContact} from '../../data/business';
import ConstructionPlan from './ConstructionPlan';
import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';

/** The parts of the estimate the proposal shows (a subset of calculateEstimate's result). */
export interface ProposalEstimate{model:DeckTakeoff;sections:{title:string;total:number;quoteRequired?:boolean}[];subtotal:number;hst:number;total:number;quoteRequired?:string[]}
export interface ProposalProps{data:DeckData;estimate:ProposalEstimate;facts:string[];reviewItems:string[];image:string|null;date:string}

const dollars=(n:number)=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(n);
const area=`${BUSINESS.addressPolicy.value.publicLocality}, ${BUSINESS.addressPolicy.value.region}`;
const site=BUSINESS.canonicalUrl.replace(/^https?:\/\//,'');

/**
 * One-page, printable deck proposal. Everything on it comes from the live design and estimate; the
 * business name and contact details come only from the published fields in src/data/business.ts.
 * It is a planning estimate, never a contract, and nothing is sent anywhere: the customer prints it
 * or saves it as a PDF from the browser's print dialog.
 */
export function ProposalSheet({data,estimate,facts,reviewItems,image,date}:ProposalProps){
  const quotes=estimate.quoteRequired??[];
  // Content-driven density: large multi-level or wrap designs carry more lines, so they print denser.
  const compact=reviewItems.length>8||facts.length+estimate.sections.length>24||reviewItems.join('').length>1500;
  // HST is shown once, after the subtotal; the estimate also carries it as its own section.
  return <article className={`dd-proposal-sheet${compact?' dd-proposal-compact':''}`} aria-label="Deck proposal">
    <header className="dd-proposal-head">
      <div className="dd-proposal-brand"><img src="/logo-mark.png" alt="" width={44} height={44}/><div><strong>{BUSINESS.publicName.value}</strong><span>DECK PROPOSAL · PLANNING ESTIMATE</span></div></div>
      <dl className="dd-proposal-meta">
        <div><dt>Date</dt><dd>{date}</dd></div>
        <div><dt>Prepared for</dt><dd>{data.customerName.trim()||'Not provided'}</dd></div>
        <div><dt>Project address</dt><dd>{data.projectAddress.trim()||'Not provided'}</dd></div>
      </dl>
    </header>
    <div className="dd-proposal-visuals">
      <figure>{image?<img src={image} alt="3D view of the proposed deck"/>:<div className="dd-proposal-noimage">3D view unavailable on this device. The plan shows the layout.</div>}<figcaption>Design illustration</figcaption></figure>
      <figure className="dd-proposal-plan"><ConstructionPlan model={estimate.model} data={data}/><figcaption>Construction plan</figcaption></figure>
    </div>
    <div className="dd-proposal-body">
      <section><h2>Your deck</h2><ul className="dd-proposal-facts">{facts.map(f=><li key={f}>{f}</li>)}</ul></section>
      <section><h2>{quotes.length?'Planning estimate · priced portion':'Planning estimate'}</h2>
        <table className="dd-proposal-estimate"><tbody>
          {estimate.sections.filter(s=>!/^HST/.test(s.title)).map(s=><tr key={s.title}><th scope="row">{s.title}</th><td>{s.quoteRequired&&s.total===0?'Supplier quote':dollars(s.total)}</td></tr>)}
          <tr className="dd-proposal-sub"><th scope="row">Subtotal before HST</th><td>{dollars(estimate.subtotal)}</td></tr>
          <tr><th scope="row">HST</th><td>{dollars(estimate.hst)}</td></tr>
          <tr className="dd-proposal-total"><th scope="row">{quotes.length?'Priced portion including HST':'Total including HST'}</th><td>{dollars(estimate.total)}</td></tr>
        </tbody></table>
        {quotes.length>0&&<p className="dd-proposal-quote"><strong>Not a complete project price.</strong> Supplier quotes are still needed for: {quotes.join('; ')}.</p>}
      </section>
    </div>
    {reviewItems.length>0&&<section className="dd-proposal-review"><h2>Confirm before construction</h2><ul>{reviewItems.map(f=><li key={f}>{f}</li>)}</ul></section>}
    <footer className="dd-proposal-foot">
      <p>This is a planning estimate based on the selected design and Golden Maple&apos;s current price book. Final measurements, site conditions, permits, engineering and product availability are confirmed in your written quote.</p>
      <p className="dd-proposal-contact">{BUSINESS.publicName.value} · {publicContact.phoneDisplay} · {publicContact.email} · {site} · {area}</p>
    </footer>
  </article>;
}

/** On-screen preview with print controls; printing shows only the sheet. */
export default function ProposalDialog({onClose,...props}:ProposalProps&{onClose:()=>void}){
  useEffect(()=>{
    document.body.classList.add('dd-proposal-open');
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',key);
    return ()=>{document.body.classList.remove('dd-proposal-open');window.removeEventListener('keydown',key);};
  },[onClose]);
  return createPortal(<div className="dd-proposal-root" role="dialog" aria-modal="true" aria-label="Deck proposal preview">
    <div className="dd-proposal-toolbar dd-no-print">
      <div><strong>Your one-page proposal</strong><span>Print it, or choose “Save as PDF” in the print window. Nothing is sent to us.</span></div>
      <button type="button" className="dd-primary" onClick={()=>window.print()} autoFocus>Print / save as PDF</button>
      <button type="button" className="dd-secondary" onClick={onClose}>Close</button>
    </div>
    <ProposalSheet {...props}/>
  </div>,document.body);
}
