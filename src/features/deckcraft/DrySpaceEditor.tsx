import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import {buildDrySpace,DEFAULT_DRY_SPACE,DRY_SPACE_PRODUCTS,DRY_SPACE_ALTERNATIVES,type DrySpaceSelection} from './drySpace';

export default function DrySpaceEditor({data,model,onChange}:{data:DeckData;model:DeckTakeoff;onChange:(patch:Partial<DeckData>)=>void}){
 const selected=data.drySpace??DEFAULT_DRY_SPACE,layout=buildDrySpace(data,model),product=layout.product;
 const change=(patch:Partial<DrySpaceSelection>)=>onChange({drySpace:{...selected,...patch},hasDrainage:false});
 return <section className="dd-screen-editor" aria-label="Under-deck drainage editor">
  <h3>Under-deck rain management</h3>
  <p className="dd-note">Choose an above-joist system before decking, or a below-joist system for a retrofit. Drainage follows the real joist bays; the preview never removes structural blocking.</p>
  <label className="dd-screen-check"><input type="checkbox" checked={selected.enabled} onChange={e=>change({enabled:e.target.checked})}/> Include a manufacturer drainage system</label>
  {data.drySpace===undefined&&data.hasDrainage&&<p className="dd-warning">The older generic drainage allowance is still selected. Choosing a system replaces that allowance with quote-required parts.</p>}
  <label className="dd-field">System<select aria-label="Under-deck drainage system" value={selected.system} onChange={e=>{const p=DRY_SPACE_PRODUCTS.find(p=>p.id===e.target.value)!;change({system:p.id,finish:p.finishes[0],enabled:true});}}>{DRY_SPACE_PRODUCTS.map(p=><option key={p.id} value={p.id}>{p.name} · {p.position}</option>)}</select></label>
  <div className="dd-screen-fields">
   <label className="dd-field">Drainage finish<select aria-label="Drainage finish" value={selected.finish} onChange={e=>change({finish:e.target.value as DrySpaceSelection['finish']})}>{product.finishes.map(f=><option key={f}>{f}</option>)}</select></label>
   <label className="dd-field">Outlet end of each collection zone<select aria-label="Drainage outlet side" value={selected.outletSide} onChange={e=>change({outletSide:e.target.value as DrySpaceSelection['outletSide']})}><option>Left</option><option>Right</option></select></label>
  </div>
  <p role="status" className="dd-screen-status">{selected.enabled?`${layout.modeledBays} bays modeled · ${layout.blockedBays} bays unresolved · supplier quote required`:'Drainage system off'}</p>
  {selected.enabled&&<>
   <p className="dd-note">Run {(layout.runIn/12).toFixed(2)} ft · system fall {layout.fallIn.toFixed(2)} in ({product.pitchInPerFt} in/ft) · {layout.outletCount} collection outlets. Main deck only; stairs and landings are not covered.</p>
   <p className="dd-note">Turn decking off and drainage on in the layer controls to inspect the troughs, V-panels, gutters and unresolved framing. No finished ceiling or enclosed dry room is included.</p>
   {layout.issues.map((w,i)=><p className="dd-note" key={i}>{w}</p>)}
   <details><summary>Installation hold points and source documents</summary><ol>{layout.installationSteps.map(s=><li key={s}>{s}</li>)}</ol><p><a href={product.guide} target="_blank" rel="noreferrer">Manufacturer installation guide</a> · <a href={product.sheet} target="_blank" rel="noreferrer">Current instructions / detail library</a> · <a href={product.supplier} target="_blank" rel="noreferrer">Ontario supplier listing</a></p></details>
   <details><summary>Quote-required component schedule</summary>{layout.rows.length?<ul>{layout.rows.map(r=><li key={r.name}>{r.qty} {r.unit} — {r.name}. {r.spec}</li>)}</ul>:<p>No installable quantity is claimed until the unresolved layout is reviewed.</p>}</details>
  </>}
  <details><summary>Other Ontario / Canadian supply options</summary>{DRY_SPACE_ALTERNATIVES.map(p=><p key={p.name}><strong>{p.name}</strong> — {p.detail} <a href={p.source} target="_blank" rel="noreferrer">Manufacturer</a> · <a href={p.supplier} target="_blank" rel="noreferrer">Supply evidence</a></p>)}</details>
 </section>;
}
