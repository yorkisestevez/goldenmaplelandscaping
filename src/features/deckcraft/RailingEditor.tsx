import {useState} from 'react';
import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import RailingSystemSelector from './RailingSystemSelector';
import RailingDocumentsPanel from './RailingDocumentsPanel';

export default function RailingEditor({data,model,onChange}:{data:DeckData;model:DeckTakeoff;onChange:(patch:Partial<DeckData>)=>void}){
  const [undo,setUndo]=useState<string[]|null>(null),sections=model.railing.sections;
  const removed=data.removedRailingSections??[],count=sections.filter(s=>!s.enabled).length;
  const unresolved=new Set(model.railing.unmodeledSectionIds);
  const change=(next:string[])=>{setUndo([...removed]);onChange({removedRailingSections:next});};
  const toggle=(id:string)=>change(removed.includes(id)?removed.filter(x=>x!==id):[...removed,id]);
  const points=sections.flatMap(s=>[s.a,s.b]);
  const minX=Math.min(0,...points.map(p=>p.x)),maxX=Math.max(12,...points.map(p=>p.x)),minZ=Math.min(0,...points.map(p=>p.z)),maxZ=Math.max(12,...points.map(p=>p.z));
  return <section aria-label="Railing section editor">
    <RailingSystemSelector data={data} onChange={onChange}/>
    <p className="dd-note">Tap a numbered section on the map, or use its button below, to remove it. Tap again to restore it. For post-supported systems, shared posts stay where an adjoining section needs them.</p>
    {data.railingType==='None'?<p className="dd-quote-notice">Railing style is set to None. Choose a railing style in Stairs &amp; railings to edit individual sections.</p>:<>
      <svg className="dd-edit-map" viewBox={`${minX-24} ${minZ-30} ${maxX-minX+48} ${maxZ-minZ+54}`} aria-label="Railing section map, top view">
        <text x={(minX+maxX)/2} y={minZ-16} textAnchor="middle" fontSize="7" fill="#5c554b">HOUSE / BACK</text>
        {model.levels.map((l,i)=><polygon key={i} points={l.footprint.outline.map(p=>`${p.x+l.offset.x},${p.y+l.offset.z}`).join(' ')} fill="#e8dfcf" stroke="#b6a890" strokeWidth="1"/>)}
        {sections.map((s,i)=><g key={s.id} role="button" tabIndex={0} aria-label={`${s.enabled?'Remove':'Restore'} ${s.label.toLowerCase()} on map`} aria-pressed={!s.enabled} onClick={()=>toggle(s.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(s.id);}}}>
          <line x1={s.a.x} y1={s.a.z} x2={s.b.x} y2={s.b.z} stroke="transparent" strokeWidth="16"/>
          <line x1={s.a.x} y1={s.a.z} x2={s.b.x} y2={s.b.z} stroke={!s.enabled?'#ae4935':unresolved.has(s.id)?'#996114':'#24685b'} strokeWidth="3" strokeDasharray={s.enabled&&!unresolved.has(s.id)?undefined:'4 3'}/>
          <circle cx={(s.a.x+s.b.x)/2} cy={(s.a.z+s.b.z)/2} r="7" fill={!s.enabled?'#ae4935':unresolved.has(s.id)?'#996114':'#24685b'}/>
          <text x={(s.a.x+s.b.x)/2} y={(s.a.z+s.b.z)/2+2.5} fill="white" textAnchor="middle" fontSize="7">{i+1}</text>
        </g>)}
      </svg>
      <p className="dd-note">Solid green = modeled. Dashed amber = selected but unresolved / not drawn. Dashed red = removed. Numbers match the list.</p>
      <p role="status">{sections.length-count-unresolved.size} modeled · {unresolved.size} unresolved · {count} removed · {model.quantities.railingLf.toFixed(1)} ft selected scope</p>
      <div className="dd-summary-actions"><button className="dd-secondary" disabled={!removed.length} onClick={()=>change([])}>Restore all sections</button><button className="dd-secondary" disabled={undo===null} onClick={()=>{if(undo){onChange({removedRailingSections:undo});setUndo(null);}}}>Undo last railing edit</button></div>
      <div className="dd-section-list">{sections.map((s,i)=><button className="dd-section-toggle" key={s.id} aria-label={`${s.enabled?'Remove':'Restore'} ${s.label.toLowerCase()}`} aria-pressed={!s.enabled} onClick={()=>toggle(s.id)}><span><strong>{i+1}. {s.label.replace(/ section \d+$/,'')}</strong><small>{(s.lengthIn/12).toFixed(1)} ft · {!s.enabled?'Removed':unresolved.has(s.id)?'Unresolved / not drawn':'Modeled'}</small></span><span>{s.enabled?'Remove':'Restore'}</span></button>)}</div>
    </>}
    <RailingDocumentsPanel data={data} model={model} onChange={onChange}/>
    {count>0&&<p className="dd-quote-notice" role="status">Removed sections can leave unprotected edges. This is a design edit, not confirmation that a guard or stair handrail can safely be omitted. Review before construction.</p>}
    {model.railing.staleRemovalIds.length>0&&data.railingType!=='None'&&<p className="dd-note">The layout changed. {model.railing.staleRemovalIds.length} previous removal(s) no longer match and were not applied. Review the map or Restore all sections to clear them.</p>}
  </section>;
}
