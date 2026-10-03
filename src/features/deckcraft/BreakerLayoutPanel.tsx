import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import {exportFramingPlanSVG} from './framingPlanExport';

export default function BreakerLayoutPanel({data,model,onChange}:{data:DeckData;model:DeckTakeoff;onChange:(patch:Partial<DeckData>)=>void}){
  const assemblies=model.levels.flatMap(l=>l.breakerAssemblies??[]);
  const supported=!data.installation||data.installation.framing==='Pressure-treated lumber';
  const download=()=>{const url=URL.createObjectURL(new Blob([exportFramingPlanSVG(data,model)],{type:'image/svg+xml'}));const a=document.createElement('a');a.href=url;a.download='deckcraft-framing-coordination.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <section aria-label="Breaker boards and framing"><h3>Breaker boards &amp; framing</h3>
    <p className="dd-note">Long field runs need a supported joint strategy. Auto uses divider boards when the selected stock cannot cover the field; Center adds a centred divider for straight layouts. Neither is a universal permit rule.</p>
    <div className="dd-fields"><label className="dd-field"><span>Planning board stock length</span><select value={data.boardStockLengthIn??model.stockLength} onChange={e=>onChange({boardStockLengthIn:Number(e.target.value) as 144|192|240})}>{[144,192,240].map(v=><option key={v} value={v}>{v/12} ft - confirm SKU availability</option>)}</select></label>
    <label className="dd-field"><span>Breaker layout</span><select value={data.breakerLayout??'Auto'} onChange={e=>onChange({breakerLayout:e.target.value as 'Auto'|'Center'})}><option>Auto</option><option>Center</option></select></label></div>
    <p role="status">{assemblies.length} divider line(s) · {model.levels.flatMap(l=>l.joists).filter(j=>j.role==='breaker-field-support').length} field-end support joist pieces · {model.levels.flatMap(l=>l.blocking).filter(b=>b.role==='breaker-ladder').length} ladder blocks.</p>
    {assemblies.map(a=><p className="dd-note" key={a.id}><strong>{a.id}</strong>: {a.x.toFixed(2)} in from level origin; {a.reason==='stock-length'?'stock-length segmentation':'requested central divider'}; field/divider joint {a.jointGapIn.toFixed(3)} in. Ladder support and connections require review.</p>)}
    <p className="dd-note">Framing mode highlights these supports. Plan mode shows their locations. The same members enter the cut list, quantities and CAD exports. This is a planning ladder assembly, not a manufacturer-approved detail for every brand. Unverified gaps use a planning default; fractional TimberTech composite temperature-band transitions use the larger adjacent gap. Confirm stock availability, clearances and attachment details for the exact product.</p>
    {!supported&&<p className="dd-error">Timber reference only: these members do not represent your selected non-timber framing.</p>}
    <button type="button" className="dd-secondary" disabled={!supported} onClick={download}>Download framing coordination SVG</button>
  </section>;
}
