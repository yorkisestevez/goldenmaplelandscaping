import {splitSubtotal} from '../backyard';
import {dollars,type DeckEstimate} from '../designFacts';
import {priceBookLabel} from '../priceBook';
import {sectionOfTitle,type DesignSection,type SectionId} from './sections';

/**
 * The price schedule, built from the estimate alone: every figure is an engine number, in the engine's section order
 * and under the engine's section titles (the same as the proposal and the PDF), in whole dollars. An unpriced item or
 * a quoted section never reads "$0": it carries a supplier or builder quote tag. Pure: the estimate in, rows out.
 */
export type QuoteKind='supplier'|'builder';
type EstimateSection=DeckEstimate['sections'][number];
type EstimateItem=EstimateSection['items'][number];

/**
 * A builder quote says so in the engine's own words: "(builder quote)" in its name, or "Builder quote required" in its
 * spec (as the labour, skirting and yard allowance lines word it). Every other unpriced line is a supplier quote.
 */
export const isBuilderQuote=(item:Pick<EstimateItem,'name'|'spec'>)=>/\(builder quote\)/i.test(item.name)||/builder quote required/i.test(item.spec);
/** "Supplier quote", "Builder quote", or both. */
export const quoteTag=(kinds:readonly QuoteKind[])=>kinds.includes('supplier')?kinds.includes('builder')?'Supplier & builder quotes':'Supplier quote':'Builder quote';

export interface LedgerItem{name:string;qty:string;unit:string;quote:QuoteKind|null}
export interface LedgerLine{
  /** The engine's section title. */
  title:string;
  /** The design section that owns it (sections.ts); null only if no section owns the title. */
  section:SectionId|null;
  /** The priced part, as the engine totals it (0 when all of it is quoted). */
  amount:number;
  /** The kinds of quote in it; empty when it is fully priced. */
  quotes:QuoteKind[];
  /** "$6,420", "$14,200 + quote", or a quote tag ("Supplier quote"). */
  text:string;
  items:LedgerItem[];
}
export interface LedgerQuote{label:string;kind:QuoteKind}
export interface Ledger{
  stamp:string;lines:LedgerLine[];
  /** Deck and backyard subtotals, only when the design has a priced backyard. */
  split:{deck:number;backyard:number}|null;
  subtotal:number;hstTitle:string;hst:number;total:number;
  /** "Priced portion including HST", or "Including HST" when nothing is quoted. */
  totalLabel:string;
  /** Every selection still to be quoted (the estimate's quoteRequired), each once, tagged. */
  quotes:LedgerQuote[];
}

const qtyText=(qty:number|string)=>typeof qty==='number'?String(Math.round(qty*100)/100):qty;
const amountText=(amount:number)=>amount>0&&amount<.5?'Under $1':dollars(amount);

export function priceLedger(estimate:DeckEstimate):Ledger{
  const hstSection=estimate.sections.find(s=>/^HST/.test(s.title));
  const lines=estimate.sections.filter(s=>s!==hstSection&&(s.total>=.005||s.items.some(i=>Number(i.qty)>0))).map((s):LedgerLine=>{
    const items=s.items.filter(i=>Number(i.qty)>0).map(i=>({name:i.name,qty:qtyText(i.qty),unit:i.unit,quote:i.cost===null&&!i.quoteResolved?(isBuilderQuote(i)?'builder':'supplier'):null}) as LedgerItem);
    const kinds=[...new Set(items.flatMap(i=>i.quote?[i.quote]:[]))];
    const quotes=kinds.length?kinds:s.quoteRequired?['supplier' as const]:[];
    const priced=s.total>=.005,covered=s.items.some(i=>i.quoteResolved)&&!quotes.length&&!priced;
    return {title:s.title,section:sectionOfTitle(s.title)?.id??null,amount:s.total,quotes,items,text:covered?'Included in confirmed scope':!quotes.length?amountText(s.total):priced?`${amountText(s.total)} + quote`:quoteTag(quotes)};
  });
  const split=splitSubtotal(estimate);
  // A quote's kind: its own label, else the wording of the unpriced item it names.
  const unpriced=estimate.sections.flatMap(s=>s.items.filter(i=>i.cost===null&&!i.quoteResolved));
  const quotes=[...new Set(estimate.quoteRequired)].map(label=>({label,kind:/\(builder quote\)/i.test(label)||unpriced.some(i=>i.name===label&&isBuilderQuote(i))?'builder':'supplier'} as LedgerQuote));
  return {
    stamp:`${priceBookLabel()} · CAD · before HST`,lines,
    split:split.backyard?split:null,
    subtotal:estimate.subtotal,hstTitle:hstSection?.title??'HST (13%)',hst:estimate.hst,total:estimate.total,
    totalLabel:quotes.length?'Priced portion including HST':'Including HST',quotes,
  };
}

/** A quote's label without the "(builder quote)" or "(supplier quote)" its tag already says. */
export const quoteLabel=(label:string)=>label.replace(/\s*\((builder|supplier) quote\)$/i,'');

export interface PriceEffect{kind:'amount'|'quote'|'none'|'note';text:string}
/**
 * A section row's price effect: the whole-dollar total of the schedule lines it owns, "+ quote" when part of them is
 * a quote, or a supplier or builder quote tag when none of it is priced. House looks are never priced; the proposal
 * owns no price of its own (null).
 */
export function sectionPriceEffect(section:DesignSection,ledger:Ledger):PriceEffect|null{
  if(section.id==='house')return {kind:'note',text:'Looks never priced; size can move the ledger'};
  if(!section.ledger.length)return null;
  const owned=ledger.lines.filter(l=>l.section===section.id),total=owned.reduce((n,l)=>n+l.amount,0),kinds=[...new Set(owned.flatMap(l=>l.quotes))];
  if(!kinds.length)return total>=.5?{kind:'amount',text:dollars(total)}:{kind:'none',text:'Adds nothing yet'};
  return total>=.5?{kind:'amount',text:`${dollars(total)} + quote`}:{kind:'quote',text:quoteTag(kinds)};
}
