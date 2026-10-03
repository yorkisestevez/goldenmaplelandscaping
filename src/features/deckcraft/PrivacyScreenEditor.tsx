import {useState} from 'react';
import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import {PRIVACY_SCREEN_PRODUCTS,PRIVACY_SCREEN_REVIEW,PRIVACY_SCREEN_SOURCES,privacyScreenLayout,type PrivacyScreenSelection} from './privacyScreens';

export default function PrivacyScreenEditor({data,model,onChange}:{data:DeckData;model:DeckTakeoff;onChange:(patch:Partial<DeckData>)=>void}){
 const [selectedId,setSelectedId]=useState(''),layout=privacyScreenLayout(data,model),rows=data.privacyScreens??[],selected=rows.find(r=>r.id===selectedId)??rows[0];
 const product=PRIVACY_SCREEN_PRODUCTS.find(p=>p.id===selected?.productId)??PRIVACY_SCREEN_PRODUCTS[0];
 const change=(patch:Partial<PrivacyScreenSelection>)=>selected&&onChange({privacyScreens:rows.map(r=>r.id===selected.id?{...r,...patch}:r)});
 const add=()=>{const edge=layout.edges.find(e=>e.available.some(([a,b])=>b-a>=42));if(!edge)return;const span=edge.available.find(([a,b])=>b-a>=42)!,room=edge.lengthIn-24-42,offsetPct=room>0?Math.min(100,Math.ceil((span[0]-12)/room*100)):0;const id=`screen-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;const row:PrivacyScreenSelection={id,productId:PRIVACY_SCREEN_PRODUCTS[0].id,levelIndex:edge.levelIndex,edgeIndex:edge.edgeIndex,offsetPct,count:1,finish:'Black',enabled:true};onChange({privacyScreens:[...rows,row]});setSelectedId(id);};
 const state=layout.rows.find(r=>r.id===selected?.id);
 return <section className="dd-screen-editor" aria-label="Privacy screen editor">
  <h3>Privacy screens</h3>
  <p className="dd-note">Choose a stock panel, then its deck edge and position. Screens sit inside the guard line; your railings stay in place.</p>
  <p role="status" className="dd-screen-status">{layout.drawnCount} of {layout.selectedCount} enabled panels placed · {layout.quoteRequired?'Supplier quote required':'No screen allowance'}</p>
  <div className="dd-screen-rows" role="group" aria-label="Screen rows">
   {rows.map((r,i)=><button type="button" key={r.id} className={`dd-secondary ${selected?.id===r.id?'active':''}`} aria-pressed={selected?.id===r.id} onClick={()=>setSelectedId(r.id)}>Row {i+1}{!r.enabled?' · off':''}</button>)}
   <button type="button" className="dd-secondary" onClick={add} disabled={rows.length>=12||!layout.edges.some(e=>e.available.some(([a,b])=>b-a>=42))}>+ Add screen row</button>
  </div>
  {selected&&<>
   <label className="dd-screen-check"><input type="checkbox" checked={selected.enabled} onChange={e=>change({enabled:e.target.checked})}/> Include this screen row</label>
   <label className="dd-field">Panel design<select aria-label="Privacy panel design" value={selected.productId} onChange={e=>{const p=PRIVACY_SCREEN_PRODUCTS.find(p=>p.id===e.target.value)!;change({productId:p.id,finish:p.finishes.includes(selected.finish)?selected.finish:p.finishes[0]});}}>{PRIVACY_SCREEN_PRODUCTS.map(p=><option key={p.id} value={p.id}>{p.manufacturer} {p.name} · 36 × 68 in</option>)}</select></label>
   <div className="dd-screen-pattern" aria-label={`${product.name} schematic pattern`} data-pattern={product.pattern}><span/><span/><span/><span/><span/></div>
   <p className="dd-note">Pattern preview is schematic—not exact manufacturer artwork. <a href={product.sourceUrl} target="_blank" rel="noreferrer">See actual panel and finish</a>.</p>
   <label className="dd-field">Deck edge<select aria-label="Screen deck edge" value={`${selected.levelIndex}:${selected.edgeIndex}`} onChange={e=>{const [levelIndex,edgeIndex]=e.target.value.split(':').map(Number);change({levelIndex,edgeIndex});}}>
    {!layout.edges.some(e=>e.levelIndex===selected.levelIndex&&e.edgeIndex===selected.edgeIndex)&&<option value={`${selected.levelIndex}:${selected.edgeIndex}`}>Saved edge unavailable—choose again</option>}
    {layout.edges.map(e=><option key={`${e.levelIndex}:${e.edgeIndex}`} value={`${e.levelIndex}:${e.edgeIndex}`}>{e.label} · {(e.lengthIn/12).toFixed(1)} ft</option>)}
   </select></label>
   <div className="dd-screen-fields">
    <label className="dd-field">Stock panels<input type="number" aria-label="Screen panel count" min={1} max={12} step={1} value={selected.count} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=12)change({count:n});}}/></label>
    <label className="dd-field">Finish<select aria-label="Screen finish" value={selected.finish} onChange={e=>change({finish:e.target.value as PrivacyScreenSelection['finish']})}>{product.finishes.map(f=><option key={f}>{f}</option>)}</select></label>
   </div>
   <label className="dd-field">Position along edge · {selected.offsetPct}%<input type="range" aria-label="Screen position along edge" min={0} max={100} step={1} value={selected.offsetPct} onChange={e=>change({offsetPct:Number(e.target.value)})}/></label>
   <div className="dd-screen-rows"><button type="button" className="dd-secondary" onClick={()=>change({offsetPct:0})}>Start</button><button type="button" className="dd-secondary" onClick={()=>change({offsetPct:50})}>Centre</button><button type="button" className="dd-secondary" onClick={()=>change({offsetPct:100})}>End</button></div>
   {state?.warning&&<p role="alert" className="dd-note dd-screen-warning">{state.warning}</p>}
   <p className="dd-note">Each continuous row includes one more post than panels, one bracket 2-pack per panel, and a separate anchorage/blocking allowance per post. All items are quote-required; no unverified price is added.</p>
   <button type="button" className="dd-secondary" onClick={()=>{onChange({privacyScreens:rows.filter(r=>r.id!==selected.id)});setSelectedId('');}}>Remove this screen row</button>
  </>}
  <p className="dd-note dd-screen-warning">{PRIVACY_SCREEN_REVIEW}</p>
  <details><summary>Other systems and installation limits</summary><p className="dd-note">HOFT post-and-board screens are available in Canada, but its 72-inch screen instructions restrict use above 60 cm / 23.62 in from the ground and prohibit use as a guard. They are research-only here, not interchangeable elevated-deck screens. <a href={PRIVACY_SCREEN_SOURCES.hoft} target="_blank" rel="noreferrer">Read HOFT installation guide</a>.</p><p className="dd-note">The preview uses a 12 in inward setback and access allowance. Verify site clearances and manufacturer shop drawings before installation; stock availability varies by Ontario supplier.</p></details>
 </section>;
}
