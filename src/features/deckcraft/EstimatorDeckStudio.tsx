import {useEffect,useRef,useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import {DeckCraftWorkspace} from '../../pages/DeckDesigner';
import {dollars,type DeckEstimate} from './designFacts';
import {drawnDeck} from './estimatorDeck';
import type {EstimatorDeck} from './estimatorHandoff';
import type {DeckData} from './types';
import './estimatorStudio.css';

/**
 * The deck designer inside the cost estimator. `deck`: a deck on its own. The designer is the whole estimate, and the
 * visitor can carry the deck on into a full backyard. `full`: the deck of a full backyard. "Use this deck" hands the
 * drawn deck, as the designer priced it, back to the estimate. The design autosaves on this device like the
 * /deck-designer page, which is the same designer.
 */
export default function EstimatorDeckStudio({mode,onBack,onUse}:{
  mode:'deck'|'full';
  onBack:()=>void;
  onUse:(deck:EstimatorDeck)=>void;
}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const live=useRef(true);
  useEffect(()=>{live.current=true;window.scrollTo(0,0);return()=>{live.current=false;};},[]);
  async function use(data:DeckData,estimate:DeckEstimate){
    setBusy(true);setError('');
    try{const deck=await drawnDeck(data,estimate);if(live.current)onUse(deck);}
    catch{if(live.current)setError('Your deck could not be added just now. Please try again.');}
    finally{if(live.current)setBusy(false);}
  }
  return <DeckCraftWorkspace embed={{renderBar:({data,estimate})=>{
    const partial=(estimate.quoteRequired?.length??0)>0;
    return <div className="dd-estimator-bar bg-brand-burgundy text-brand-porcelain border-b border-brand-gold/20" role="region" aria-label="Cost estimator">
      <button type="button" onClick={onBack} className="dd-estimator-back text-brand-porcelain-soft hover:text-brand-gold">
        <ArrowLeft size={15} aria-hidden="true"/>
        <span>{mode==='full'?'Back to your estimate':'Project types'}</span>
      </button>
      <p className="dd-estimator-price">
        <span className="text-brand-porcelain-soft">Cost estimator · deck</span>
        <strong className="tabular-nums">{dollars(estimate.subtotal)}</strong>
        <small className="text-brand-porcelain-soft">{partial?'priced portion ':''}+ HST</small>
      </p>
      {error&&<p role="alert" className="dd-estimator-error">{error}</p>}
      <button type="button" disabled={busy} onClick={()=>void use(data,estimate)} className="dd-estimator-use bg-brand-gold text-brand-black hover:bg-brand-porcelain">
        {busy?'Adding…':mode==='full'?'Use this deck in my estimate':'Add patio, walls & more'}
      </button>
    </div>;
  }}}/>;
}
