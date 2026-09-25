import type {ReactNode} from 'react';
import ConstructionPlan from './ConstructionPlan';
import {dollars,type DeckEstimate} from './designFacts';
import {isBuilderQuote,priceLedger,quoteLabel,quoteTag,type Ledger,type LedgerLine,type LedgerQuote,type QuoteKind} from './designer/priceLedgerModel';
import {exteriorSummary} from './houseLooks';
import {DECKING_CATALOGUE} from './manufacturerCatalog';
import {PRICE_BOOK,priceBookLabel} from './priceBook';
import {investmentSheets,proposalAddress,proposalContact,proposalFeatures,proposalFinishes,proposalTitle,PROPOSAL_WORDS,type FeatureGroupId,type ProposalShot} from './proposalModel';
import type {DeckData} from './types';

/** The estimate the proposal shows: the engine's whole result (calculateEstimate). */
export type ProposalEstimate=DeckEstimate;
export interface ProposalProps{
  data:DeckData;estimate:DeckEstimate;
  /** describeDesign's proposal facts (designFacts.ts); the house's exterior line is added here. */
  facts:string[];reviewItems:string[];
  /** One 3D picture (the cover), for callers that have a single snapshot; `shots` takes over when given. */
  image:string|null;
  date:string;
  /** The 3D views, the cover first (DeckDesigner's captureViews). */
  shots?:ProposalShot[];
  /** A manufacturer swatch file's URL (the browser build gives it; without it a finish shows its name only). */
  swatchSrc?:(file:string)=>string;
}

const Tag=({kinds}:{kinds:readonly QuoteKind[]})=><span className="dd-proposal-tag" data-kind={kinds.length>1?'both':kinds[0]}>{quoteTag(kinds)}</span>;
/** Small line drawings for the feature groups (gold, square-ended, like the drawing's dimension lines). */
const ICONS:Record<FeatureGroupId,string>={
  deck:'M2 6h12M2 9h12M2 12h12M4 12v2.5M12 12v2.5',
  lighting:'M8 1.5v2M3.2 3.2l1.4 1.4M12.8 3.2l-1.4 1.4M5.4 9.2a2.6 2.6 0 1 1 5.2 0c0 1.1-.8 1.6-1 2.6H6.4c-.2-1-1-1.5-1-2.6zM6.5 14h3',
  railing:'M2 3.5h12M2 14h12M3.5 3.5V14M6.5 3.5V14M9.5 3.5V14M12.5 3.5V14',
  boards:'M2 3h12v10H2zM2 6.3h12M2 9.7h12M8 3v3.3M5 6.3v3.4M11 6.3v3.4M8 9.7V13',
  living:'M1.5 5h13M3 5v9M13 5v9M4.5 2.5V5M7 2.5V5M9.5 2.5V5M12 2.5V5',
  house:'M2 8l6-5 6 5M3.5 6.8V14h9V6.8M6.5 14v-3.5h3V14',
  more:'M8 3v10M3 8h10',
};
const Icon=({id}:{id:FeatureGroupId})=><svg className="dd-proposal-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d={ICONS[id]} fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>;
const Mark=()=><span className="dd-proposal-mark">Golden Maple<span>Deck Studio</span></span>;

/** One presentation sheet (Letter): the running head, its content, and the title strip along the foot. */
function Sheet({label,number,total,project,date,dark,children}:{label:string;number:number;total:number;project:string;date:string;dark?:boolean;children:ReactNode}){
  return <section className={`dd-proposal-page${dark?' dd-proposal-dark':''}`} aria-label={label}>
    <header className="dd-proposal-runhead"><Mark/><span>{project}</span></header>
    <div className="dd-proposal-content">{children}</div>
    <dl className="dd-proposal-strip">
      <div><dt>Project</dt><dd>{project}</dd></div>
      <div><dt>Sheet</dt><dd>{label}</dd></div>
      <div><dt>Date</dt><dd>{date}</dd></div>
      <div><dt>No.</dt><dd>{number} / {total}</dd></div>
    </dl>
  </section>;
}

/** The schedule's priced lines, in the engine's order: a quote tag where a line is not priced at all, never $0. */
const LedgerLines=({lines}:{lines:LedgerLine[]})=><table className="dd-proposal-ledger">
  <thead><tr><th scope="col">Item</th><th scope="col">Amount</th></tr></thead>
  <tbody>{lines.map(l=><tr key={l.title}><th scope="row">{l.title}</th><td>{l.quotes.length&&l.amount<.005?<Tag kinds={l.quotes}/>:l.text}</td></tr>)}</tbody>
</table>;
function Totals({ledger}:{ledger:Ledger}){
  const row=(label:string,value:number,className?:string)=><tr className={className}><th scope="row">{label}</th><td>{dollars(value)}</td></tr>;
  return <div className="dd-proposal-sums">
    <table className="dd-proposal-totals"><tbody>
      {ledger.split&&<>{row('Deck subtotal',ledger.split.deck)}{row('Backyard subtotal',ledger.split.backyard)}</>}
      <tr className="dd-proposal-subtotal"><th scope="row">{ledger.quotes.length?'Priced subtotal':'Subtotal'} <span>{PROPOSAL_WORDS.estimate}</span></th><td>{dollars(ledger.subtotal)}</td></tr>
      {row(ledger.hstTitle,ledger.hst)}
      {row(ledger.totalLabel,ledger.total,'dd-proposal-total')}
    </tbody></table>
    <p className="dd-proposal-fine">{PROPOSAL_WORDS.notFinal} {priceBookLabel()} · CAD.</p>
  </div>;
}
const Quotes=({quotes,continued}:{quotes:LedgerQuote[];continued:boolean})=><section className="dd-proposal-quotes" aria-label={continued?'Still to be quoted, continued':'Still to be quoted'}>
  <h3>Still to be quoted{continued?', continued':''}</h3>
  {!continued&&<p className="dd-proposal-fine">{PROPOSAL_WORDS.quotesNote}</p>}
  <ul>{quotes.map(q=><li key={q.label}><Tag kinds={[q.kind]}/> {quoteLabel(q.label)}</li>)}</ul>
</section>;

/**
 * The luxury proposal (R8): a presentation in Letter sheets, printable from the browser and shown in the proposal
 * dialog. A full-bleed 3D cover; more views; the lighting and features; the manufacturer finishes; the site plan with
 * its gold dimensions; the investment, itemized from the price schedule (priceLedgerModel.ts), with every selection
 * still to be quoted tagged, never $0; next steps; and, at the back in smaller type, the items to confirm before
 * construction, the construction plan and the material list.
 *
 * Everything on it comes from the live design and its estimate; the business name and contact details come only from
 * the published fields in src/data/business.ts. It is a planning estimate, never a contract or a final quote, and
 * nothing is sent anywhere: the customer prints it, or saves it as a PDF from the print window.
 */
export function ProposalSheet({data,estimate,facts,reviewItems,image,date,shots,swatchSrc}:ProposalProps){
  const pictures=shots?.length?shots:image?[{label:'Corner view',src:image}]:[];
  const cover=pictures[0],views=pictures.slice(1,4);
  const project=proposalTitle(data),address=proposalAddress(data),contact=proposalContact();
  const ledger=priceLedger(estimate),invest=investmentSheets(ledger);
  const groups=proposalFeatures(data,facts,exteriorSummary(data)),finishes=proposalFinishes(data,estimate.model);
  const material=DECKING_CATALOGUE.find(m=>m.id===data.deckingMaterial)??DECKING_CATALOGUE[0];
  const summary=[`${Math.round(estimate.model.quantities.area)} sq ft of deck`,data.levels>1?`${data.levels} levels`:'one level',`${material.name}, ${data.deckingColor}`,...(ledger.split?['with a backyard']:[])].join(' · ');
  // Sheets: the cover, the views (with more than one picture), features, finishes, the site plan, the investment's
  // sheets and next steps. The appendix follows, unnumbered, on as many pages as it needs.
  const total=5+(views.length?1:0)+invest.length;
  let n=1;
  const sheet=(label:string,children:ReactNode,dark=false)=>{n++;return <Sheet key={n} label={label} number={n} total={total} project={project} date={date} dark={dark}>{children}</Sheet>;};
  const alt=(label:string)=>`3D view of the proposed deck, ${label.toLowerCase()}`;
  const materials=estimate.sections.filter(s=>!/^HST/.test(s.title)).map(s=>({title:s.title,items:s.items.filter(i=>Number(i.qty)>0)})).filter(s=>s.items.length);
  return <article className="dd-proposal" aria-label="Deck proposal">
    <section className="dd-proposal-page dd-proposal-cover" aria-label="Cover">
      <header className="dd-proposal-cover-head">
        <div className="dd-proposal-lockup"><img src="/logo-mark.png" alt="" width={52} height={42}/><p className="dd-proposal-wordmark">Golden Maple<span>Deck Studio</span></p></div>
        <p className="dd-proposal-kicker">Proposal</p>
      </header>
      <figure className="dd-proposal-hero">
        {cover?<img src={cover.src} alt={alt(cover.label)}/>:<div className="dd-proposal-hero-plan"><ConstructionPlan model={estimate.model} data={data} variant="site"/></div>}
        <figcaption>{cover?`${cover.label} · ${PROPOSAL_WORDS.illustration}`:'The 3D view is not available on this device: the site plan shows the layout.'}</figcaption>
      </figure>
      <div className="dd-proposal-cover-body">
        <h2>{project}</h2>
        {address&&<p className="dd-proposal-address">{address}</p>}
        <p className="dd-proposal-summary">{summary}</p>
        <dl className="dd-proposal-meta">
          <div><dt>Date</dt><dd>{date}</dd></div>
          <div><dt>Price book</dt><dd>{PRICE_BOOK.version}</dd></div>
          <div><dt>Prepared by</dt><dd>{contact.name}</dd></div>
        </dl>
      </div>
    </section>
    {views.length>0&&sheet('Views',<>
      <h2>Views</h2>
      <p className="dd-proposal-lede">Your design from {views.length===1?'another angle':`${views.length===2?'two':'three'} more angles`}.</p>
      <div className={`dd-proposal-views dd-proposal-views-${views.length}`}>{views.map(v=><figure key={v.label}><img src={v.src} alt={alt(v.label)}/><figcaption>{v.label}</figcaption></figure>)}</div>
      <p className="dd-proposal-note">{PROPOSAL_WORDS.illustration}s, drawn from your design in the 3D view.</p>
    </>)}
    {sheet('Lighting & features',<>
      <h2>Lighting &amp; features</h2>
      <p className="dd-proposal-lede">Everything in this design, as you built it.</p>
      <div className="dd-proposal-features">{groups.map(g=><section key={g.id} className="dd-proposal-feature" aria-label={g.title}>
        <h3><Icon id={g.id}/>{g.title}</h3>
        <ul>{g.items.map(item=><li key={item}>{item}</li>)}</ul>
      </section>)}</div>
    </>)}
    {sheet('Materials & finishes',<>
      <h2>Materials &amp; finishes</h2>
      <p className="dd-proposal-lede">The manufacturer colours in your design, and where each one goes.</p>
      <ul className={`dd-proposal-finishes${finishes.length>12?' dd-proposal-finishes-dense':finishes.length<=6?' dd-proposal-finishes-few':''}`}>{finishes.map(t=>{
        const src=t.swatch&&swatchSrc?swatchSrc(t.swatch):'';
        return <li key={t.key}>
          <span className="dd-proposal-swatch">{src?<img src={src} alt=""/>:<span className="dd-proposal-chip" style={t.hex?{background:t.hex}:undefined}/>}</span>
          <strong>{t.colour}</strong><span>{t.collection}</span><small>{t.uses.join(' · ')}{t.note?` · ${t.note}`:''}</small>
        </li>;})}</ul>
      <p className="dd-proposal-note">{PROPOSAL_WORDS.colours}</p>
    </>)}
    {sheet('Site plan',<>
      <h2>Site plan</h2>
      <p className="dd-proposal-lede">{data.width} × {data.length} ft deck against your house, {data.height} in above grade.</p>
      <figure className="dd-proposal-siteplan"><ConstructionPlan model={estimate.model} data={data} variant="site"/></figure>
      <p className="dd-proposal-note">Dimensions in feet. Measurements and connections are confirmed on site.</p>
    </>)}
    {invest.map((parts,i)=>sheet(i?'Investment, continued':'Investment',<>
      <h2>Investment{i>0&&<small> continued</small>}</h2>
      {i===0&&<p className="dd-proposal-lede">{PROPOSAL_WORDS.estimate} · {priceBookLabel()} · CAD</p>}
      {parts.map((part,k)=>part.kind==='lines'?<LedgerLines key={k} lines={part.lines}/>:part.kind==='totals'?<Totals key={k} ledger={ledger}/>:<Quotes key={k} quotes={part.quotes} continued={part.continued}/>)}
    </>))}
    {sheet('Next steps',<>
      <h2>Next steps</h2>
      <ol className="dd-proposal-steps">
        <li><h3>Send us your design</h3><p>Use “Send my design” in the deck designer. It reaches our team with a link that reopens exactly what you built, plus a summary and this estimate.</p></li>
        <li><h3>Book a call</h3><p>Talk it through with us at <a href="/book">{contact.book}</a>. Book from your design, and the link comes with you.</p></li>
        <li><h3>Confirm it on site</h3><p>Measurements, connections and engineering are confirmed on site before your written quote.</p></li>
      </ol>
      <div className="dd-proposal-contact">
        <p className="dd-proposal-call">{contact.call}</p>
        <p>{contact.email} · {contact.site} · {contact.area}</p>
      </div>
      <div className="dd-proposal-signoff"><img src="/logo-mark.png" alt="" width={62} height={50}/><p className="dd-proposal-wordmark">Golden Maple<span>Deck Studio</span></p></div>
    </>,true)}
    <section className="dd-proposal-appendix" aria-label="Appendix">
      <header className="dd-proposal-runhead"><Mark/><span>{project}</span></header>
      <h2>Appendix</h2>
      <p className="dd-proposal-lede">For you and your builder: what to confirm before construction, the construction plan and the modelled material list.</p>
      {reviewItems.length>0&&<section aria-label="Confirm before construction"><h3>Confirm before construction</h3><ul className="dd-proposal-review">{reviewItems.map(f=><li key={f}>{f}</li>)}</ul></section>}
      <section className="dd-proposal-appendix-plan" aria-label="Construction plan"><h3>Construction plan</h3>
        <figure><ConstructionPlan model={estimate.model} data={data}/></figure>
        <p className="dd-proposal-fine">Drawn from the same design model as the estimate. Dimensions and connections need site confirmation before construction.</p>
      </section>
      <section aria-label="Material and hardware list"><h3>Material and hardware list</h3>
        <p className="dd-proposal-fine">Quantities follow the modelled parts. Items without a confirmed rate are listed for a quote and are not in the estimate.</p>
        <div className="dd-proposal-materials">{materials.map(s=><section key={s.title}><h4>{s.title}</h4><ul>{s.items.map((item,k)=><li key={k}>
          <span>{item.name}{item.spec&&<small> {item.spec}</small>}</span> <span className="dd-proposal-qty">{item.qty} {item.unit}</span>{item.cost===null&&<> <Tag kinds={[isBuilderQuote(item)?'builder':'supplier']}/></>}
        </li>)}</ul></section>)}</div>
      </section>
      <p className="dd-proposal-fine dd-proposal-endline">{contact.name} · {contact.phone} · {contact.email} · {contact.site} · {contact.area}</p>
    </section>
  </article>;
}
