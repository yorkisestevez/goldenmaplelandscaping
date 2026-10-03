import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import {buildSkirting,DEFAULT_SKIRTING,validateSkirting,type SkirtingSelection} from './skirting';

export default function SkirtingEditor({data,model,onChange}:{data:DeckData;model:DeckTakeoff;onChange:(patch:Partial<DeckData>)=>void}){
 const s=validateSkirting(data.skirting)??DEFAULT_SKIRTING,layout=buildSkirting(data,model),change=(patch:Partial<SkirtingSelection>)=>onChange({skirting:{...s,...patch}});
 return <section className="dd-screen-editor" aria-label="Deck skirting editor">
  <h3>Deck skirting & backing</h3>
  <p className="dd-note">Close selected exposed deck or landing edges. Stair access and adjoining deck sections stay open automatically; railing visibility has no effect.</p>
  <label className="dd-screen-check"><input type="checkbox" checked={s.enabled} onChange={e=>change({enabled:e.target.checked})}/> Include deck skirting</label>
  {s.enabled&&<>
   <div className="dd-screen-fields">
    <label className="dd-field">Board direction<select aria-label="Skirting board direction" value={s.orientation} onChange={e=>change({orientation:e.target.value as SkirtingSelection['orientation']})}><option>Horizontal</option><option>Vertical</option></select></label>
    <label className="dd-field">Default board colour<input type="color" aria-label="Skirting default colour" value={s.color} onChange={e=>change({color:e.target.value})}/></label>
    <label className="dd-field">Ground clearance (in)<input type="number" aria-label="Skirting ground clearance" min={2} max={36} step={.5} value={s.groundClearanceIn} onChange={e=>{const n=Number(e.target.value);if(n>=2&&n<=36)change({groundClearanceIn:n});}}/></label>
    <label className="dd-field">Gap between boards (in)<input type="number" aria-label="Skirting board gap" min={.125} max={2} step={.125} value={s.gapIn} onChange={e=>{const n=Number(e.target.value);if(n>=.125&&n<=2)change({gapIn:n});}}/></label>
    <label className="dd-field">Maximum backing spacing (in)<input type="number" aria-label="Skirting backing spacing" min={8} max={24} step={1} value={s.frameSpacingIn} onChange={e=>{const n=Number(e.target.value);if(n>=8&&n<=24)change({frameSpacingIn:n});}}/></label>
   </div>
   <p className="dd-note">{s.orientation==='Horizontal'?'Vertical backing studs support horizontal boards, with double studs at stock-length joints.':'Horizontal backing rails support vertical boards, with end stiles and joint backing.'} This is a non-load-bearing framing concept, not an approved installation specification.</p>
   <fieldset><legend>Skirting edges — uncheck to leave an edge open</legend>{layout.edges.map(e=><label className="dd-screen-check" key={e.id}><input type="checkbox" checked={!s.excludedEdgeIds.includes(e.id)} onChange={event=>change({excludedEdgeIds:event.target.checked?s.excludedEdgeIds.filter(id=>id!==e.id):[...s.excludedEdgeIds,e.id]})}/>{e.label} · {(e.available.reduce((n,[a,b])=>n+b-a,0)/12).toFixed(1)} ft exposed</label>)}</fieldset>
   {layout.staleExclusions.length>0&&<button type="button" className="dd-secondary" onClick={()=>change({excludedEdgeIds:s.excludedEdgeIds.filter(id=>!layout.staleExclusions.includes(id))})}>Clear unavailable saved edge exclusions</button>}
   <p role="status" className="dd-screen-status">{layout.boards.length} cladding pieces · {layout.framing.length} backing members · supplier quote required</p>
   <details><summary>Installation, ventilation & access review</summary>{layout.issues.map((issue,i)=><p className="dd-note" key={i}>{issue}</p>)}</details>
  </>}
 </section>;
}
