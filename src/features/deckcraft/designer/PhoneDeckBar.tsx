import {dollars} from '../designFacts';

/**
 * Phones only (CSS shows it under 760 px): the live price stays on screen while editing, with a button that
 * pins a compact deck preview to the top of the screen and one that sends the design. Pinning is the
 * visitor's choice, so the 3D view still waits until it is wanted (see useWhenNearAndIdle).
 */
export default function PhoneDeckBar({subtotal,priceLabel,docked,onToggleDock,onSend}:{subtotal:number;priceLabel:string;docked:boolean;onToggleDock:()=>void;onSend:()=>void}){
  return <div className="dd-phone-bar" role="region" aria-label="Live price">
    <div><small>{priceLabel} · before HST</small><strong>{dollars(subtotal)}</strong></div>
    <button type="button" className="dd-secondary" aria-pressed={docked} aria-controls="deck-live-preview" onClick={onToggleDock}>{docked?'Hide deck':'Show deck'}</button>
    <button type="button" className="dd-primary" onClick={onSend}>Send</button>
  </div>;
}
