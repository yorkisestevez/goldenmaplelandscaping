import type {DeckTakeoff} from './deckTakeoff';
import type {DeckData} from './types';
import {useEffect,useState} from 'react';
import {buildInstallationPlan, exportInstallationHTML, FRAMING_OPTIONS, type InstallationSelection} from './installationSystem';

function InstallationNumber({label,value,min,max,onChange}:{label:string;value?:number;min:number;max:number;onChange:(n:number|undefined)=>void}){
  const [draft,setDraft]=useState(value===undefined?'':String(value));
  useEffect(()=>setDraft(value===undefined?'':String(value)),[value]);
  const commit=()=>{if(draft.trim()===''){onChange(undefined);return;}const n=Number(draft);if(Number.isFinite(n)&&n>=min&&n<=max)onChange(n);else setDraft(value===undefined?'':String(value));};
  return <label className="dd-field"><span>{label}</span><input aria-label={label} type="number" min={min} max={max} step="any" value={draft} placeholder="Not supplied" onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>;
}
export default function InstallationPanel({data,model,onChange}:{data:DeckData;model?:DeckTakeoff;onChange:(patch:Partial<DeckData>)=>void}){
  const plan=buildInstallationPlan(data), value=plan.selection;
  const set=(patch:Partial<InstallationSelection>)=>onChange({installation:{...value,...patch}});
  const download=()=>{
    const url=URL.createObjectURL(new Blob([exportInstallationHTML(data,model)],{type:'text/html;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='deckcraft-installation-planning.html';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const numeric=(key:'thicknessMm'|'temperatureC'|'sideGapMm'|'endGapMm'|'ventilationMm',label:string,min:number,max:number)=>
    <InstallationNumber label={label} value={value[key]} min={min} max={max} onChange={n=>set({[key]:n})}/>;
  return <section aria-label="Installation system" className="dd-installation">
    <h3>Installation system</h3><p className="dd-note">Choose the assembly behind the finish. These inputs are saved with your design and included in a printable planning package.</p>
    <div className="dd-fields">
      <label className="dd-field"><span>Framing material</span><select aria-label="Framing material" value={value.framing} onChange={e=>set({framing:e.target.value as InstallationSelection['framing'],framingSystem:'',fastenerProduct:''})}>{FRAMING_OPTIONS.map(f=><option key={f}>{f}</option>)}</select></label>
      <label className="dd-field"><span>Framing manufacturer / member series</span><input maxLength={160} value={value.framingSystem??''} onChange={e=>set({framingSystem:e.target.value})} placeholder="Exact system, species / grade"/></label>
      <label className="dd-field"><span>Exact board SKU</span><input maxLength={160} value={value.boardSku??''} onChange={e=>set({boardSku:e.target.value})} placeholder="Collection, profile and SKU"/></label>
      <label className="dd-field"><span>Board profile</span><select value={value.profile} onChange={e=>set({profile:e.target.value as InstallationSelection['profile']})}>{['Unknown','Solid','Scalloped'].map(p=><option key={p}>{p}</option>)}</select></label>
      <label className="dd-field"><span>Board edge</span><select value={value.edge} onChange={e=>set({edge:e.target.value as InstallationSelection['edge']})}>{['Unknown','Grooved','Square'].map(p=><option key={p}>{p}</option>)}</select></label>
      {numeric('thicknessMm','Actual board thickness (mm)',5,80)}
      {numeric('temperatureC','Installation temperature (C)',-40,70)}
      <label className="dd-field"><span>Exact fastener / clip product</span><input maxLength={160} value={value.fastenerProduct??''} onChange={e=>set({fastenerProduct:e.target.value})} placeholder="Product and substrate approval"/></label>
      {numeric('sideGapMm','Proposed side gap (mm)',0,25)}
      {numeric('endGapMm','Proposed end gap (mm)',0,50)}
      {numeric('ventilationMm','Proposed ventilation clearance (mm)',0,3000)}
    </div>
    <div className="dd-quote-notice" role="status"><strong>Review required - not construction-ready</strong><p>{plan.geometryNote}</p>{!plan.timberModel&&<p>Steel, aluminum and engineered framing require their own model, engineering and supplier quote. The displayed estimate must not be used to price this framing selection.</p>}</div>
    <h4>Product-specific instruction basis</h4>{plan.familyNotes.map(n=><p className="dd-note" key={n}>{n}</p>)}
    <details className="dd-advanced"><summary>{plan.issues.length} installation and compatibility checks</summary><ul className="dd-review-flags">{plan.issues.map(i=><li key={i.id}><strong>{i.severity==='blocker'?'Hold: ':'Review: '}</strong>{i.message}</li>)}</ul></details>
    <details className="dd-advanced"><summary>Assembly sequence and inspection checkpoints</summary>{plan.steps.map(s=><section key={s.title}><h4>{s.title}</h4><p className="dd-note">{s.instruction}</p></section>)}</details>
    <details className="dd-advanced"><summary>Manufacturer references</summary><p className="dd-note">References checked {plan.sourceCheckedOn}. Reconfirm current revision and applicability; a source link does not approve the assembly.</p>{plan.sources.map(s=><p key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a></p>)}{plan.sources.length===0&&<p>Obtain species, grade and treatment documentation from the supplier.</p>}</details>
    <button type="button" className="dd-secondary" onClick={download}>Download installation planning package</button><p className="dd-note">Print-ready HTML. Open locally, then Print / Save as PDF. This is a checklist with unresolved items, not a certified installation manual.</p>
  </section>;
}
