import type {ReactNode} from 'react';
import ConstructionPlan from './ConstructionPlan';
import {dollars,type DeckEstimate} from './designFacts';
import {isBuilderQuote,lineBasis,priceLedger,quoteLabel,quoteTag,type Ledger,type LedgerLine,type LedgerQuote,type QuoteKind} from './designer/priceLedgerModel';
import {exteriorSummary} from './houseLooks';
import {PRICE_BOOK,priceBookLabel} from './priceBook';
import {eyebrowNumber,investmentSheets,underDeckCostSplit,proposalAddress,proposalContact,proposalCoverTitle,proposalFeatures,proposalFinishes,proposalRunningTitle,proposalSummary,PROPOSAL_WORDS,SHEET_EYEBROWS,type FeatureGroupId,type ProposalShot} from './proposalModel';
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
/** Small line drawings for the feature groups, in gold. */
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
const LOGO='/logo-mark.png';
/** The gold GM and maple-leaf mark, inside the thin gold ring the estimate PDF draws (no disc behind it). */
const Emblem=()=><span className="dd-proposal-emblem"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="31.4" fill="none" stroke="currentColor" strokeWidth=".8"/></svg><img src={LOGO} alt="" width={46} height={37}/></span>;
/** The gold rule with a small diamond that the estimate PDF sets under its wordmark. */
const Ornament=()=><span className="dd-proposal-ornament" aria-hidden="true"><i/></span>;
type Contact=ReturnType<typeof proposalContact>;
const RunHead=({contact,title}:{contact:Contact;title:string})=><header className="dd-proposal-runhead">
  <span className="dd-proposal-brand"><img src={LOGO} alt="" width={22} height={18}/>{contact.name}</span><span className="dd-proposal-headtitle">{title}</span>
</header>;
const Heading=({number,eyebrow,children,lede}:{number:number;eyebrow:string;children:ReactNode;lede?:ReactNode})=><>
  <p className="dd-proposal-eyebrow">{eyebrowNumber(number)} · {eyebrow}</p>
  <h2>{children}</h2>
  {lede&&<p className="dd-proposal-lede">{lede}</p>}
</>;

/** One presentation sheet (Letter), as the estimate PDF sets its inner pages: running head, content, contact footer. */
function Sheet({label,number,head,contact,children}:{label:string;number:number;head:string;contact:Contact;children:ReactNode}){
  return <section className="dd-proposal-page" aria-label={label}>
    <RunHead contact={contact} title={head}/>
    <div className="dd-proposal-content">{children}</div>
    <footer className="dd-proposal-foot">
      <p>{contact.site} · {contact.phone} · {contact.email}</p>
      <p className="dd-proposal-foot-sub">Deck design proposal · {contact.area}</p>
      <span className="dd-proposal-pageno">Page {eyebrowNumber(number)}</span>
    </footer>
  </section>;
}

/** The schedule's priced lines, in the engine's order: a quote tag where a line is not priced at all, never $0. */
const LedgerLines=({lines,underDeck}:{lines:LedgerLine[];underDeck:ReturnType<typeof underDeckCostSplit>})=><table className="dd-proposal-ledger">
  <thead><tr><th scope="col">Item</th><th scope="col">Amount (CAD)</th></tr></thead>
  <tbody>{lines.map(l=><tr key={l.title}><th scope="row">{l.title}{l.title==='Under-deck options'&&<small className="dd-proposal-included-costs">{underDeck.map(g=><span key={g.label}>{g.label}: {dollars(g.amount)}</span>)}</small>}</th><td>{l.quotes.length&&l.amount<.005?<Tag kinds={l.quotes}/>:<>{l.text}{lineBasis(l)&&<small className="dd-proposal-included-costs">{lineBasis(l)}</small>}</>}</td></tr>)}</tbody>
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
    <p className="dd-proposal-callout">{PROPOSAL_WORDS.notFinal} {priceBookLabel()} · CAD.</p>
  </div>;
}
const Quotes=({quotes,continued}:{quotes:LedgerQuote[];continued:boolean})=><section className="dd-proposal-quotes" aria-label={continued?'Still to be quoted, continued':'Still to be quoted'}>
  <h3>Still to be quoted{continued?', continued':''}</h3>
  {!continued&&<p className="dd-proposal-fine">{PROPOSAL_WORDS.quotesNote}</p>}
  <ul>{quotes.map(q=><li key={q.label}><Tag kinds={[q.kind]}/> {quoteLabel(q.label)}</li>)}</ul>
</section>;

/**
 * The luxury proposal (R8), in the Golden Maple estimate branding (R9): the same family as the estimate PDF Golden
 * Maple sends its customers (the CRM's ReportLab engine, theme GM_LANDSCAPING). A compact forest masthead with the GM
 * mark above a generous project introduction and the actual 3D view; warm paper inner sheets with the
 * running head, gold section eyebrows, serif headings, forest-headed tables, gold callouts and the contact footer with
 * its page number. The sheets: the cover, more views, the lighting and features, the manufacturer finishes, the site
 * plan, the investment (itemized from the price schedule, priceLedgerModel.ts, with every selection still to be
 * quoted tagged, never $0), next steps and, at the back in smaller type, the appendix for the builder.
 *
 * Everything on it comes from the live design and its estimate; the business name and contact details come only from
 * the published fields in src/data/business.ts. It is a planning estimate, never a contract or a final quote, and
 * nothing is sent anywhere: the customer prints it, or saves it as a PDF from the print window.
 */
export function ProposalSheet({data,estimate,facts,reviewItems,image,date,shots,swatchSrc}:ProposalProps){
  const pictures=shots?.length?shots:image?[{label:'Corner view',src:image}]:[];
  const cover=pictures[0],views=pictures.slice(1,4);
  const address=proposalAddress(data),contact=proposalContact(),name=data.customerName.trim();
  const ledger=priceLedger(estimate),invest=investmentSheets(ledger),backyard=!!ledger.split;
  const title=proposalCoverTitle(data,backyard),head=proposalRunningTitle(data,backyard);
  const groups=proposalFeatures(data,facts,exteriorSummary(data)),finishes=proposalFinishes(data,estimate.model);
  // Sheets: the cover is page 1; the views (with more than one picture), features, finishes, the site plan, the
  // investment's sheets and next steps follow, numbered. The appendix follows on as many pages as it needs.
  let page=1,section=0;
  const sheet=(label:string,children:ReactNode)=>{page++;return <Sheet key={page} label={label} number={page} head={head} contact={contact}>{children}</Sheet>;};
  const next=()=>++section;
  const alt=(label:string)=>`3D view of the proposed deck, ${label.toLowerCase()}`;
  const materials=estimate.sections.filter(s=>!/^HST/.test(s.title)).map(s=>({title:s.title,items:s.items.filter(i=>Number(i.qty)>0)})).filter(s=>s.items.length);
  return <article className="dd-proposal" aria-label="Deck proposal">
    <section className="dd-proposal-page dd-proposal-cover" aria-label="Cover">
      <div className="dd-proposal-cover-inner">
        <header className="dd-proposal-cover-head">
          <Emblem/>
          <p className="dd-proposal-cover-eyebrow">{PROPOSAL_WORDS.eyebrow}</p>
          <p className="dd-proposal-wordmark">{contact.wordmark.top}{contact.wordmark.sub&&<span>{contact.wordmark.sub}</span>}</p>
          <Ornament/>
        </header>
        <figure className="dd-proposal-hero">
          <div className="dd-proposal-hero-frame">{cover?<img src={cover.src} alt={alt(cover.label)}/>:<div className="dd-proposal-hero-plan"><ConstructionPlan model={estimate.model} data={data} variant="site"/></div>}</div>
          <figcaption>{cover?`${cover.label} · ${PROPOSAL_WORDS.illustration}`:'The 3D view is not available on this device: the site plan shows the layout.'}</figcaption>
        </figure>
        <div className="dd-proposal-cover-body">
          <p className="dd-proposal-doctype">{PROPOSAL_WORDS.doctype}</p>
          <h2>{title}</h2>
          <p className="dd-proposal-summary">{proposalSummary(data,estimate.model.quantities.area,backyard)}</p>
          {address&&<p className="dd-proposal-address">{address}</p>}
        </div>
        <dl className="dd-proposal-meta">
          {name&&<div><dt>Prepared for</dt><dd>{name}</dd></div>}
          <div><dt>Proposal date</dt><dd>{date}</dd></div>
          <div><dt>Price book</dt><dd>{PRICE_BOOK.version}</dd></div>
        </dl>
        <footer className="dd-proposal-cover-foot">
          <p>{contact.name}</p>
          <p>{contact.area} · {contact.phone} · {contact.email} · {contact.site}</p>
        </footer>
      </div>
    </section>
    {views.length>0&&sheet('Views',<>
      <Heading number={next()} eyebrow={SHEET_EYEBROWS.views} lede={`Your design from ${views.length===1?'another angle':`${views.length===2?'two':'three'} more angles`}.`}>Views</Heading>
      <div className={`dd-proposal-views dd-proposal-views-${views.length}`}>{views.map(v=><figure key={v.label}><img src={v.src} alt={alt(v.label)}/><figcaption>{v.label}</figcaption></figure>)}</div>
      <p className="dd-proposal-note">{PROPOSAL_WORDS.illustration}s, drawn from your design in the 3D view.</p>
    </>)}
    {sheet('Lighting & features',<>
      <Heading number={next()} eyebrow={SHEET_EYEBROWS.features} lede="Everything in this design, as you built it.">Lighting &amp; features</Heading>
      <div className="dd-proposal-features">{groups.map(g=><section key={g.id} className="dd-proposal-feature" aria-label={g.title}>
        <h3><Icon id={g.id}/>{g.title}</h3>
        <ul>{g.items.map(item=><li key={item}>{item}</li>)}</ul>
      </section>)}</div>
    </>)}
    {sheet('Materials & finishes',<>
      <Heading number={next()} eyebrow={SHEET_EYEBROWS.finishes} lede="The manufacturer colours in your design, and where each one goes.">Materials &amp; finishes</Heading>
      <ul className={`dd-proposal-finishes${finishes.length>12?' dd-proposal-finishes-dense':finishes.length<=6?' dd-proposal-finishes-few':''}`}>{finishes.map(t=>{
        const src=t.swatch&&swatchSrc?swatchSrc(t.swatch):'';
        return <li key={t.key}>
          <span className="dd-proposal-swatch">{src?<img src={src} alt=""/>:<span className="dd-proposal-chip" style={t.hex?{background:t.hex}:undefined}/>}</span>
          <strong>{t.colour}</strong><span>{t.collection}</span><small>{t.uses.join(' · ')}{t.note?` · ${t.note}`:''}</small>
        </li>;})}</ul>
      <p className="dd-proposal-note">{PROPOSAL_WORDS.colours}</p>
    </>)}
    {sheet('Site plan',<>
      <Heading number={next()} eyebrow={SHEET_EYEBROWS.site} lede={`${data.width} × ${data.length} ft deck against your house, ${data.height} in above grade.`}>Site plan</Heading>
      <figure className="dd-proposal-siteplan"><ConstructionPlan model={estimate.model} data={data} variant="site"/></figure>
      <p className="dd-proposal-note">Dimensions in feet. Measurements and connections are confirmed on site.</p>
    </>)}
    {invest.map((parts,i)=>sheet(i?'Investment, continued':'Investment',<>
      <Heading number={i?section:next()} eyebrow={SHEET_EYEBROWS.investment} lede={i===0?`${PROPOSAL_WORDS.estimate} · ${priceBookLabel()} · CAD`:undefined}>Investment{i>0&&<small> continued</small>}</Heading>
      {parts.map((part,k)=>part.kind==='lines'?<LedgerLines key={k} lines={part.lines} underDeck={underDeckCostSplit(estimate)}/>:part.kind==='totals'?<Totals key={k} ledger={ledger}/>:<Quotes key={k} quotes={part.quotes} continued={part.continued}/>)}
    </>))}
    {sheet('Next steps',<>
      <Heading number={next()} eyebrow={SHEET_EYEBROWS.next} lede="From this design to your written quote.">Next steps</Heading>
      <ol className="dd-proposal-steps">
        <li><h3>Send us your design</h3><p>Use “Send my design” in the deck designer. It reaches our team with a link that reopens exactly what you built, plus a summary and this estimate.</p></li>
        <li><h3>Book a call</h3><p>Talk it through with us at <a href="/book">{contact.book}</a>. Book from your design, and the link comes with you.</p></li>
        <li><h3>Confirm it on site</h3><p>Measurements, connections and engineering are confirmed on site before your written quote.</p></li>
      </ol>
      <div className="dd-proposal-contact">
        <p className="dd-proposal-call">{contact.call}</p>
        <p>{contact.email} · {contact.site} · {contact.area}</p>
      </div>
      <div className="dd-proposal-signoff"><Emblem/><p className="dd-proposal-wordmark">{contact.wordmark.top}{contact.wordmark.sub&&<span>{contact.wordmark.sub}</span>}</p></div>
    </>)}
    <section className="dd-proposal-appendix" aria-label="Appendix">
      <RunHead contact={contact} title={head}/>
      <Heading number={next()} eyebrow={SHEET_EYEBROWS.appendix} lede="For you and your builder: what to confirm before construction, the construction plan and the modelled material list.">Appendix</Heading>
      {reviewItems.length>0&&<section aria-label="Confirm before construction"><h3>Confirm before construction</h3><ul className="dd-proposal-review">{reviewItems.map(f=><li key={f}>{f}</li>)}</ul></section>}
      <section className="dd-proposal-appendix-plan" aria-label="Construction plan"><h3>Construction plan</h3>
        <figure><ConstructionPlan model={estimate.model} data={data}/></figure>
        <p className="dd-proposal-fine">Drawn from the same design model as the estimate. Dimensions and connections need site confirmation before construction.</p>
      </section>
      <section aria-label="Material and hardware list"><h3>Material and hardware list</h3>
        <p className="dd-proposal-fine">Quantities follow the modelled parts. Priced lines are planning allowances from the price book unless marked confirmed; your written quote confirms them. Items without a rate are listed for a quote and are not in the estimate.</p>
        <div className="dd-proposal-materials">{materials.map(s=><section key={s.title}><h4>{s.title}</h4><ul>{s.items.map((item,k)=><li key={k}>
          <span>{item.name}{item.spec&&<small> {item.spec}</small>}</span> <span className="dd-proposal-qty">{item.qty} {item.unit}</span>{item.cost===null&&!item.quoteResolved&&<> <Tag kinds={[isBuilderQuote(item)?'builder':'supplier']}/></>}
        </li>)}</ul></section>)}</div>
      </section>
      <p className="dd-proposal-fine dd-proposal-endline">{contact.name} · {contact.phone} · {contact.email} · {contact.site} · {contact.area}</p>
    </section>
  </article>;
}
