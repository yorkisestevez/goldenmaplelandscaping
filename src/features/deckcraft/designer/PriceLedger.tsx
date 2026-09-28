import {useEffect,useId,useRef,useState,type KeyboardEvent,type RefObject} from 'react';
import {dollars} from '../designFacts';
import {quoteLabel,quoteTag,type Ledger} from './priceLedgerModel';
import {announceChange,describeChange,type ChangeRecord} from './useChangeLedger';

const Tag=({kinds}:{kinds:readonly ('supplier'|'builder')[]})=><span className="dd-tag" data-kind={kinds.length>1?'both':kinds[0]}>{quoteTag(kinds)}</span>;

/**
 * The price schedule: the priced lines of the estimate under their engine titles, the subtotals, HST and the total, the
 * selections still to be quoted, and (column and drawer) what each change did to the price. The column sits beside
 * the drawing on wide screens; the drawer opens from the price bar below 1280 px; the full list, in Proposal & files,
 * lists every item with its quantity (amounts stay at section level). Every figure comes from the ledger model.
 */
export default function PriceLedger({ledger,variant,changes,onFullList}:{
  ledger:Ledger;variant:'column'|'drawer'|'full';
  /** Your changes, newest last (column and drawer). */
  changes?:readonly ChangeRecord[];
  /** Shows the full price list (in Proposal & files). */
  onFullList?:()=>void;
}){
  const id=useId(),full=variant==='full',H=full?'h3':'h2',Sub=full?'h4':'h3';
  const row=(label:string,value:string,className?:string)=><tr key={label} className={className}><th scope="row">{label}</th><td>{value}</td></tr>;
  return <section className={`dd-ledger dd-ledger-${variant}`} aria-labelledby={`${id}t`}>
    <H id={`${id}t`} className="dd-ledger-title">{full?'Full price list':'Price schedule'}</H>
    <p className="dd-ledger-stamp">{ledger.stamp}</p>
    <table className="dd-ledger-table">
      <tbody>{ledger.lines.map(line=><tr key={line.title} className="dd-ledger-line">
        <th scope="row">{line.title}{full&&<ul className="dd-ledger-items">{line.items.map((item,i)=><li key={i}><span>{item.name}</span> <span className="dd-ledger-qty">{item.qty} {item.unit}</span>{item.quote&&<> <Tag kinds={[item.quote]}/></>}</li>)}</ul>}</th>
        <td>{line.quotes.length&&line.amount<.005?<Tag kinds={line.quotes}/>:line.text}</td>
      </tr>)}</tbody>
      <tbody className="dd-ledger-sums">
        {/* With a backyard, the deck and backyard subtotals come before HST. */}
        {ledger.split&&<>{row('Deck subtotal',dollars(ledger.split.deck))}{row('Backyard subtotal',dollars(ledger.split.backyard))}</>}
        <tr className="dd-ledger-subtotal"><th scope="row" id={`${id}s`}>Priced subtotal</th><td><span role="status" aria-live="off" aria-labelledby={`${id}s`}>{dollars(ledger.subtotal)}</span></td></tr>
        {row(ledger.hstTitle,dollars(ledger.hst))}
        {row(ledger.totalLabel,dollars(ledger.total),'dd-ledger-total')}
      </tbody>
    </table>
    {ledger.quotes.length>0&&<div className="dd-ledger-quotes">
      <Sub id={`${id}q`}>Still to be quoted: not in the totals above</Sub>
      <ul aria-labelledby={`${id}q`}>{ledger.quotes.map(q=><li key={q.label}><Tag kinds={[q.kind]}/> {quoteLabel(q.label)}</li>)}</ul>
    </div>}
    {changes&&<div className="dd-ledger-changes">
      <Sub id={`${id}c`}>Your changes</Sub>
      {changes.length?<ol aria-labelledby={`${id}c`}>{[...changes].reverse().map(record=>{const d=describeChange(record);return <li key={record.id} data-kind={d.kind}>{d.effect&&<strong>{d.effect}</strong>} <span>{d.label}{d.note&&` (${d.note})`}</span></li>;})}</ol>
        :<p className="dd-note">Each change you make is listed here with what it does to the price.</p>}
    </div>}
    {onFullList&&<p><button type="button" className="dd-linklike dd-ledger-more" onClick={onFullList}>Full price list</button></p>}
    <p className="dd-note">This is a planning estimate, not a quote. Final measurements, site conditions, engineering and product availability are confirmed in your written quote.</p>
  </section>;
}

/** One polite announcement per gesture: the newest change, once it has settled (drags and the lighting sync included). */
export function ChangeAnnouncer({record}:{record?:ChangeRecord}){
  const [text,setText]=useState('');
  const next=record&&record.kind!=='loaded'?announceChange(record):'';
  useEffect(()=>{if(!next)return;const timer=setTimeout(()=>setText(next),700);return ()=>clearTimeout(timer);},[next]);
  return <p className="dd-sr" role="status">{text}</p>;
}

const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

/**
 * The schedule in a modal drawer (below 1280 px), with its focus trap spelled out rather than left to the browser's
 * modal dialog (which lets Tab leave for the page): focus goes to Close when it opens, Tab and Shift+Tab loop through
 * the drawer, Escape, Close or a tap outside shut it, and focus goes back to the opener in the price bar.
 */
export function LedgerDrawer({ledger,changes,onFullList,onClose,opener}:{ledger:Ledger;changes:readonly ChangeRecord[];onFullList:()=>void;onClose:()=>void;opener:RefObject<HTMLElement|null>}){
  const ref=useRef<HTMLDialogElement>(null),close=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const dialog=ref.current;if(dialog&&!dialog.open)dialog.showModal();
    close.current?.focus();
    return ()=>{opener.current?.focus();};
  },[opener]);
  const trap=(e:KeyboardEvent<HTMLDialogElement>)=>{
    if(e.key==='Escape'){e.preventDefault();onClose();return;}
    if(e.key!=='Tab')return;
    const dialog=e.currentTarget,items=[...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el=>el.getClientRects().length>0);
    const first=items[0],last=items.at(-1),inside=dialog.contains(document.activeElement)&&document.activeElement!==dialog;
    if(!first||!last){e.preventDefault();return;}
    if(e.shiftKey&&(!inside||document.activeElement===first)){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&(!inside||document.activeElement===last)){e.preventDefault();first.focus();}
  };
  return <dialog ref={ref} id="dd-ledger-drawer" className="dd-ledger-sheet" aria-label="Price schedule" onKeyDown={trap} onClose={onClose} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <button ref={close} type="button" className="dd-secondary dd-ledger-close" onClick={onClose}>Close</button>
    <PriceLedger ledger={ledger} variant="drawer" changes={changes} onFullList={onFullList}/>
  </dialog>;
}
