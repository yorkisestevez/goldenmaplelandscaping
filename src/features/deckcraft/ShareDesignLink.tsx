import {useEffect,useState} from 'react';
import {trackDeck} from './deckAnalytics';
import {encodeDesignLink} from './designLink';
import type {DeckData} from './types';

const PRIVACY_NOTE='Anyone with the link can open a copy of this design. Your name and project address are not included.';
const onShared=(how:'copied'|'shared'|'shown')=>trackDeck('deckcraft_link',`deck_link_${how}`);

/** Builds a link that reopens this design, copies it, and offers the phone's share sheet where there is one. */
export default function ShareDesignLink({data,label='Share link',onWarm}:{data:DeckData;label?:string;onWarm?:()=>void}){
  const [link,setLink]=useState('');
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  // A link describes the design it was made from; any change retires it.
  useEffect(()=>{setLink('');setStatus('');},[data]);
  async function make(){
    setBusy(true);setStatus('');
    try{
      const url=await encodeDesignLink(data);setLink(url);
      try{await navigator.clipboard.writeText(url);setStatus(`Link copied. ${PRIVACY_NOTE}`);onShared('copied');onWarm?.();}
      catch{setStatus(`Copy the link below. ${PRIVACY_NOTE}`);onShared('shown');onWarm?.();}
    }catch{setStatus('A link could not be made on this device. Use Save JSON to share the design file instead.');}
    finally{setBusy(false);}
  }
  async function share(){
    try{await navigator.share({title:'My Golden Maple deck design',url:link});onShared('shared');onWarm?.();}
    catch{/* The share sheet was closed; the link is still on screen. */}
  }
  const canShare=typeof navigator!=='undefined'&&typeof navigator.share==='function';
  return <div className="dd-share">
    <button type="button" className="dd-secondary" onClick={()=>void make()} disabled={busy}>{busy?'Making the link…':label}</button>
    {link&&<div className="dd-share-link">
      <input readOnly value={link} aria-label="Link to this design" onFocus={e=>e.currentTarget.select()}/>
      {canShare&&<button type="button" className="dd-secondary" onClick={()=>void share()}>Share…</button>}
    </div>}
    {status&&<p className="dd-note" role="status">{status}</p>}
  </div>;
}
