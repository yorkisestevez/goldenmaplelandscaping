import {useRef,useState} from 'react';
import {dollars} from '../designFacts';
import {LedgerDrawer} from './PriceLedger';
import type {Ledger} from './priceLedgerModel';
import type {ChangeRecord} from './useChangeLedger';

/**
 * Below 1280 px (CSS), where the price schedule has no column of its own: the priced amount and how many selections
 * are still to be quoted stay on screen, and tapping them opens the schedule in a drawer. Phones also get a button that
 * pins a compact deck preview to the top of the screen while editing, and one that sends the design. Pinning is the
 * visitor's choice, so the 3D view still waits until it is wanted (see useWhenNearAndIdle).
 */
export default function PhoneDeckBar({ledger,changes,onFullList,docked,onToggleDock,onSend}:{ledger:Ledger;changes:readonly ChangeRecord[];onFullList:()=>void;docked:boolean;onToggleDock:()=>void;onSend:()=>void}){
  const [open,setOpen]=useState(false);
  const opener=useRef<HTMLButtonElement>(null);
  const quotes=ledger.quotes.length;
  return <>
    <div className="dd-phone-bar" role="region" aria-label="Live price">
      <button ref={opener} type="button" className="dd-phone-price" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}>
        <small>Priced subtotal · before HST</small><strong>{dollars(ledger.subtotal)}</strong>
        <small>{quotes?`+ ${quotes} to quote · `:''}Price schedule <span aria-hidden="true">▴</span></small>
      </button>
      <button type="button" className="dd-secondary dd-phone-dock" aria-pressed={docked} aria-controls="deck-live-preview" onClick={onToggleDock}>{docked?'Hide deck':'Show deck'}</button>
      <button type="button" className="dd-primary" onClick={onSend}>Send</button>
    </div>
    {open&&<LedgerDrawer ledger={ledger} changes={changes} opener={opener} onClose={()=>setOpen(false)} onFullList={()=>{setOpen(false);onFullList();}}/>}
  </>;
}
