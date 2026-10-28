import {Suspense,useEffect,type ReactNode} from 'react';
import type {DeckData} from '../types';
import {dollars} from '../designFacts';
import ShareDesignLink from '../ShareDesignLink';
import {SECTIONS,SECTION_BY_ID,type SectionId} from './sections';
import {sectionPriceEffect,quoteLabel,type Ledger} from './priceLedgerModel';
import {sectionSummary} from './sectionSummaries';
import {phoneLayout,type HomeTab} from './homeTabs';
import {WorkspaceIcon} from './WorkspaceNavigation';
import './homePanel.css';

export interface HomePanelProps{
  /** Put away (Hide panel, Draw, back to the drawing on a phone); it stays mounted so it reopens where it was. */
  hidden:boolean;
  tab:HomeTab;data:DeckData;ledger:Ledger;
  /** The one section open in the panel, if any. */
  expanded?:SectionId;onExpand:(id:SectionId)=>void;onCollapse:()=>void;renderBody:(id:SectionId)=>ReactNode;
  onClose:()=>void;
  /** Jump to a section (Price & send's Edit links and each section's next link), which takes the focus. Price & send: send
   *  the design, download the PDF, and the share link's warm-lead ping. */
  onEdit:(id:SectionId)=>void;onSend:()=>void;onDownloadPdf:()=>void;pdfBusy:boolean;onWarmShare?:()=>void;
  /** A section opened from elsewhere, to bring into view and focus once it shows; then `onFocused` clears it. */
  focus?:SectionId;onFocused:()=>void;
}

/**
 * The open tab's panel (homeTabs.ts): docked beside the drawing on desktop and a drawer over the foot of the screen on
 * phones, so the deck stays in view while a choice is made. Its sections open one at a time and keep the section ids and
 * regions the rest of the page and the agent interface use. Price & send starts with a quote-style summary.
 */
export default function HomePanel({hidden,tab,data,ledger,expanded,onExpand,onCollapse,renderBody,onClose,onEdit,onSend,onDownloadPdf,pdfBusy,onWarmShare,focus,onFocused}:HomePanelProps){
  const home=tab;
  // Phones: the drawer covers the foot of the screen, so the drawing moves up under the header, above it.
  useEffect(()=>{if(!hidden&&phoneLayout())document.querySelector('#deck-live-preview .dd-canvas')?.scrollIntoView({block:'start'});},[tab.id,hidden]);
  // A section opened from an Edit or next link, a warning or the plan takes the focus, since what opened it may be gone. On
  // the panel's first open this waits for it to load.
  useEffect(()=>{
    if(!focus||hidden||expanded!==focus)return;
    document.getElementById(`dd-section-${focus}`)?.scrollIntoView({block:'start'});
    document.getElementById(`dd-section-${focus}-body`)?.focus({preventScroll:true});
    onFocused();
  },[focus,hidden,expanded]);
  return <aside id="dd-home-panel" className="dd-home-panel" aria-labelledby="dd-home-panel-title" hidden={hidden}>
    <div className="dd-home-panel-top"><h2 id="dd-home-panel-title">{home.name}</h2><button type="button" className="dd-linklike" onClick={onClose}>Hide panel</button></div>
    {tab.id==='send'&&<PriceAndSend data={data} ledger={ledger} onEdit={onEdit} onSend={onSend} onDownloadPdf={onDownloadPdf} pdfBusy={pdfBusy} onWarmShare={onWarmShare}/>}
    {home.sections.map(id=>{
      const section=SECTION_BY_ID[id],related=SECTION_BY_ID[section.related.id],price=sectionPriceEffect(section,ledger),open=expanded===id;
      return <section key={id} id={`dd-section-${id}`} className="dd-home-section">
        <button type="button" className="dd-home-row" aria-expanded={open} aria-controls={open?`dd-section-${id}-body`:undefined} onClick={()=>open?onCollapse():onExpand(id)}><WorkspaceIcon id={id}/><span><strong id={`dd-section-${id}-name`}>{section.name}</strong><small>{sectionSummary(section,data)}</small></span>{price&&<em data-kind={price.kind}>{price.text}</em>}</button>
        {open&&<div id={`dd-section-${id}-body`} className="dd-panel dd-section-body" role="region" aria-labelledby={`dd-section-${id}-name`} tabIndex={-1}><Suspense fallback={<p className="dd-note" role="status">Loading {section.name}…</p>}>{renderBody(id)}<p className="dd-section-next"><button type="button" className="dd-linklike" aria-label={`${section.related.text}: open ${related.name}`} onClick={()=>onEdit(related.id)}>{section.related.text} <span aria-hidden="true">→</span> {related.name}</button></p></Suspense></div>}
      </section>;
    })}
  </aside>;
}

/** Each choice with its price effect and an Edit link, the planning total, what is still to quote, then Send. */
function PriceAndSend({data,ledger,onEdit,onSend,onDownloadPdf,pdfBusy,onWarmShare}:Pick<HomePanelProps,'data'|'ledger'|'onEdit'|'onSend'|'onDownloadPdf'|'pdfBusy'|'onWarmShare'>){
  return <div className="dd-home-quote">
    <ul className="dd-home-quote-list" aria-label="Your design">{SECTIONS.filter(s=>s.id!=='proposal').map(section=>{
      const price=sectionPriceEffect(section,ledger);
      // A quote lists prices: the House section's note ("Looks never priced…") stays on its own panel row.
      return <li key={section.id}><span><strong>{section.name}</strong><small>{sectionSummary(section,data)}</small></span>{price&&price.kind!=='note'&&<em data-kind={price.kind}>{price.text}</em>}<button type="button" className="dd-linklike" aria-label={`Edit ${section.name}`} onClick={()=>onEdit(section.id)}>Edit</button></li>;
    })}</ul>
    <p className="dd-home-quote-total"><span>Planning estimate</span><strong>{dollars(ledger.subtotal)}</strong><small>Priced portion · before HST</small></p>
    {ledger.quotes.length>0&&<div className="dd-home-quote-open"><strong>Still to quote, not in this total</strong><ul>{ledger.quotes.map(q=><li key={`${q.kind}-${q.label}`}>{quoteLabel(q.label)}</li>)}</ul></div>}
    <div className="dd-home-quote-actions">
      <button type="button" className="dd-primary" aria-haspopup="dialog" onClick={onSend}>Send my design</button>
      <ShareDesignLink data={data} label="Copy design link" onWarm={onWarmShare}/>
      <button type="button" className="dd-secondary" onClick={onDownloadPdf} disabled={pdfBusy}>{pdfBusy?'Making your PDF…':'Download PDF'}</button>
    </div>
  </div>;
}
