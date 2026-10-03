import {useState} from 'react';
import type {DeckData} from './types';
import {FRAMELESS_SYSTEMS,getFramelessSystem} from './framelessSystems';
import {RAILING_CATALOGUE} from './manufacturerCatalog';

export default function RailingSystemSelector({data,onChange}:{data:DeckData;onChange:(p:Partial<DeckData>)=>void}){
  const system=getFramelessSystem(data),[undo,setUndo]=useState<Partial<DeckData>|null>(null);
  function choose(id:string){
    const next=RAILING_CATALOGUE.find(r=>r.id===id);
    setUndo({catalogueRailingId:data.catalogueRailingId,railingType:data.railingType,railingHardwareFinish:data.railingHardwareFinish});
    onChange(next?{catalogueRailingId:id,railingType:next.baseType,railingHardwareFinish:id==='tag_ninfa4'?'Satin':id==='nv_spigot'?data.railingHardwareFinish??'Black':undefined}:{catalogueRailingId:undefined,railingHardwareFinish:undefined});
  }
  return <section aria-label="Railing systems and mounting">
    <h3>Choose the complete railing system</h3>
    <p className="dd-note">Post-supported glass, individual spigots and continuous shoes are different assemblies. These options show level-deck envelopes; no selection authorizes fabrication or installation.</p>
    <div className="dd-frameless-choices">{FRAMELESS_SYSTEMS.map(s=><button type="button" key={s.id} className="dd-frameless-choice" aria-pressed={system?.id===s.id} onClick={()=>choose(s.id)}>
      <svg viewBox="0 0 180 85" aria-hidden="true"><path d="M8 77H172" stroke="#a98f68" strokeWidth="7"/>{[0,1,2].map(i=><rect key={i} x={12+i*54} y="8" width="50" height="65" fill="#b9dedc" fillOpacity=".45" stroke="#609a9a"/>)}{s.mount==='shoe'?<rect x="10" y="64" width="160" height="10" fill="#a0aaac"/>:[0,1,2,3,4,5].map(i=><rect key={i} x={20+i*27} y="62" width="5" height="14" rx="1" fill="#313638"/>)}</svg>
      <strong>{s.name}</strong><span>{s.mount==='spigot'?'Individual surface spigots':'Continuous surface base shoe'}</span><small>Level preview · supplier quote · engineering unresolved</small>
    </button>)}</div>
    <label className="dd-field"><span>All manufacturer railing systems</span><select aria-label="Quick railing system" value={data.catalogueRailingId??''} onChange={e=>choose(e.target.value)}><option value="">Generic {data.railingType} / existing allowance</option>{RAILING_CATALOGUE.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {system?.id==='nv_spigot'&&<label className="dd-field"><span>Spigot finish</span><select aria-label="Spigot finish" value={data.railingHardwareFinish??'Black'} onChange={e=>onChange({railingHardwareFinish:e.target.value as 'Black'|'Satin'})}><option>Black</option><option>Satin</option></select></label>}
    {system?.id==='tag_ninfa4'&&<p className="dd-note">Satin anodized finish for the referenced TAG SKU.</p>}
    {system&&<><p className="dd-note">{system.availability}</p><p className="dd-quote-notice">{system.dimensionNote}</p><p className="dd-note">Mounts are set 3 in inside the modeled platform, with corner clearances, for a supported visual envelope. This is not a supplier-approved edge distance or anchorage location.</p><p className="dd-quote-notice">Level glass only: stair guards and handrails remain unresolved and are not shown as completed assemblies. Existing removed sections remain removed; review their map after a system change.</p></>}
    <button type="button" className="dd-secondary" disabled={!undo} onClick={()=>{if(undo)onChange(undo);setUndo(null);}}>Undo system selection</button>
    <details className="dd-advanced"><summary>Other Ontario / Canadian glass systems and documents</summary>
      <p><strong>CLEARRAIL · Severn, Ontario.</strong> Spigot system with a public <a href="https://www.clearrail.ca/installation" target="_blank" rel="noreferrer">installation and deck-document register ↗</a>. Reference only; its linked 2018 blocking engineering states OBC 2012 and does not cover the complete guard. Current applicability must be reviewed.</p>
      <p><strong>Regal CrystalRail.</strong> Proprietary LED mounts, glass and above-grade bracing; not interchangeable with NorthVue spigots. <a href="https://crystalrail.regalideas.com/wp-content/uploads/2021/03/CrystalRail_Install_Instructions.pdf" target="_blank" rel="noreferrer">Installation manual ↗</a>. Reference only until braces, stair handrails and the selected system are modeled; confirm Ontario dealer supply.</p>
      <p><strong>Craft-Bilt topless glass.</strong> No horizontal top rail, but vertical posts/channels remain. <a href="https://craft-bilt.com/products/topless-glass-railing/" target="_blank" rel="noreferrer">Product details ↗</a>. Not a postless preview.</p>
      <p className="dd-note">Never mix another supplier's glass, blocking drawing or anchor schedule into the selected assembly.</p>
    </details>
  </section>;
}
