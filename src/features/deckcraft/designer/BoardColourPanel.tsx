import {useMemo,useState} from 'react';
import {accentCollections,boardFinishPlan,colourName,colourRef,deckColourRef,type BoardPaintChoice} from '../boardFinishes';
import {describeBoardPlace,paintAddress} from '../boardPaint';
import type {DeckTakeoff} from '../deckTakeoff';
import type {DeckData} from '../types';
import {MaterialSwatch,NumberField,type Update} from './fields';

// The page paints 3D clicks with this once the panel has loaded (it is never needed before).
export {paintBoard} from '../boardPaint';

/**
 * Accent boards (loaded on demand, on the finish step): pick a real product colour, then click boards on the 3D
 * deck, one at a time or a whole row. The deck's own colour erases. Rows can also be painted by number, which
 * works from the keyboard and without 3D. Every choice is listed with a remove button; choices that no longer
 * meet a board after a change are kept, not moved, and can be cleared.
 */
export default function BoardColourPanel({data,update,model,paint,setPaint,message}:{data:DeckData;update:Update;model:DeckTakeoff;paint:BoardPaintChoice|null;setPaint:(paint:BoardPaintChoice|null)=>void;message:string}){
  const plan=useMemo(()=>boardFinishPlan(data,model),[data,model]);
  const main=deckColourRef(data),collections=accentCollections(data),list=data.boardColours??[];
  const [scope,setScope]=useState<'piece'|'course'>(paint?.scope??'piece');
  const [rowNumber,setRowNumber]=useState(1);
  // Straight rows on the main deck, counted from the house, for painting by number.
  const rows=useMemo(()=>plan.addresses[0]?.filter(a=>a?.role==='field'&&/^r\d+$/.test(a.course)).reduce((n,a)=>Math.max(n,Number(a!.course.slice(1))+1),0)??0,[plan]);
  const byRow=data.pattern==='Herringbone'?'piece':scope;
  const choose=(ref:string)=>setPaint(paint?.colour===ref?null:{colour:ref,scope:byRow});
  const setScopeTo=(next:'piece'|'course')=>{setScope(next);if(paint)setPaint({...paint,scope:next});};
  const save=(next:typeof data.boardColours)=>update({boardColours:next?.length?next:undefined});
  const [rowMessage,setRowMessage]=useState('');
  const paintRow=()=>{
    if(!paint){setRowMessage('Pick a colour first.');return;}
    const n=Math.min(rows,Math.max(1,Math.round(rowNumber))),address=plan.addresses[0]?.find(a=>a?.role==='field'&&a.course===`r${n-1}`);
    if(!address){setRowMessage('That row is not on the deck.');return;}
    const next=paintAddress(data,address,paint.colour,'course');
    if(next===null){setRowMessage('This design already holds as many accent choices as it can. Clear some boards first.');return;}
    setRowMessage('');save(next);
  };
  return <section className="dd-accents" aria-labelledby="dd-accents-title">
    <h3 id="dd-accents-title">Accent boards</h3>
    <p className="dd-note">Pick a colour, then click boards on the 3D deck: one board, or a whole row. Only real product colours are offered. Each accent colour is ordered as its own boards at its collection’s price, and fitting them is quoted by the builder.</p>
    {data.pattern!=='Herringbone'&&<div className="dd-view-toggle dd-accent-scope" role="group" aria-label="What a click paints"><button type="button" aria-pressed={byRow==='piece'} onClick={()=>setScopeTo('piece')}>One board</button><button type="button" aria-pressed={byRow==='course'} onClick={()=>setScopeTo('course')}>Whole row</button></div>}
    {collections.map((m,i)=><details key={m.id} className="dd-accent-collection" open={i===0}>
      <summary>{m.name}{i===0?' · your decking':''}{m.costPerSqft===null&&<small className="dd-quote-badge">Supplier quote required</small>}</summary>
      <div className="dd-colours">{m.colors.map(c=>{const ref=colourRef(m.id,c.name),own=ref===main;
        return <button key={c.name} type="button" aria-pressed={paint?.colour===ref} aria-label={own?`${c.name}: the deck colour, removes accents`:`Paint with ${c.name} (${m.name})`} onClick={()=>choose(ref)}><MaterialSwatch file={c.swatch} alt=""/><span>{c.name}{own&&<small> · deck colour, erases</small>}</span></button>;})}</div>
    </details>)}
    {paint&&<p className="dd-paint-status" role="status">Painting with <strong>{colourName(paint.colour)}</strong>. Click boards in the 3D view. <button type="button" className="dd-linklike" onClick={()=>setPaint(null)}>Done</button></p>}
    {message&&<p className="dd-note" role="alert">{message}</p>}
    {rows>0&&<div className="dd-accent-row"><NumberField label="Row from the house" value={rowNumber} min={1} max={rows} unit="" increment={1} onValue={setRowNumber}/><button type="button" className="dd-secondary" onClick={paintRow}>Paint this row</button></div>}
    {rowMessage&&<p className="dd-note" role="alert">{rowMessage}</p>}
    {plan.matched.length>0&&<>
      <h4>Your accent boards · {plan.pieces} board{plan.pieces===1?'':'s'}</h4>
      <ul className="dd-accent-list">{plan.matched.map((o,i)=>{const place=describeBoardPlace(o);
        return <li key={`${o.course}-${o.at??'row'}-${i}`}><span>{place} · {colourName(o.colour)}</span><button type="button" className="dd-linklike" aria-label={`Remove: ${place}`} onClick={()=>save(list.filter(x=>x!==o))}>Remove</button></li>;})}</ul>
      <button type="button" className="dd-secondary" onClick={()=>save(undefined)}>Clear all accent boards</button>
    </>}
    {plan.unmatched.length>0&&<div className="dd-quote-notice" role="status"><p>{plan.unmatched.length} accent choice{plan.unmatched.length===1?' no longer lines':'s no longer line'} up with a board after a change (or no longer suit{plan.unmatched.length===1?'s':''} this decking). {plan.unmatched.length===1?'It is':'They are'} not shown or priced.</p><button type="button" className="dd-secondary" onClick={()=>save(plan.matched)}>Clear {plan.unmatched.length===1?'it':'them'}</button></div>}
  </section>;
}
