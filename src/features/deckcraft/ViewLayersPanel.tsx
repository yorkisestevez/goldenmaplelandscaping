import {ALL_VIEW_LAYERS,VIEW_LAYER_LABELS,VIEW_PRESETS,allViewLayers,matchingViewPreset,type ViewLayers,type ViewPreset} from './viewLayers';

export default function ViewLayersPanel({layers,onChange,isPlan,expanded=false,onOpen}:{layers:ViewLayers;onChange:(layers:ViewLayers,preset?:ViewPreset)=>void;isPlan:boolean;expanded?:boolean;onOpen?:()=>void}){
  const selected=matchingViewPreset(layers),count=ALL_VIEW_LAYERS.filter(k=>layers[k]).length;
  return <section className="dd-view-layers" aria-label={expanded?'Layer switches':'3D visibility controls'}>
    {!expanded&&<><div className="dd-layer-presets" role="group" aria-label="3D view presets">{([['finished','Finished deck'],['framing','Framing only'],['foundations','Foundations'],['connections','Connections']] as const).map(([id,label])=><button type="button" key={id} aria-pressed={selected===id} onClick={()=>onChange({...VIEW_PRESETS[id]},id)}>{label}</button>)}</div><button type="button" className="dd-layer-open" onClick={onOpen}>Show / hide layers <span>{count}/{ALL_VIEW_LAYERS.length} on</span></button></>}
    {expanded&&<>
      <p className="dd-note">Visibility only — hiding a part does not remove it from the design, quantities, plans or exports. Camera angles keep your layer selection.{isPlan?' Selecting a layer returns to 3D.':''}</p>
      <div className="dd-layer-switches">{ALL_VIEW_LAYERS.map(key=><label className="dd-check" key={key}><input type="checkbox" role="switch" aria-label={VIEW_LAYER_LABELS[key]} checked={layers[key]} onChange={e=>onChange({...layers,[key]:e.target.checked})}/><span>{VIEW_LAYER_LABELS[key]}</span></label>)}</div>
      <div className="dd-summary-actions"><button className="dd-secondary" onClick={()=>onChange(allViewLayers(true))}>Show all layers</button><button className="dd-secondary" onClick={()=>onChange(allViewLayers(false))}>Hide all layers</button></div>
      {layers.ground&&layers.footings&&<button className="dd-layer-reveal" onClick={()=>onChange({...layers,ground:false,house:false,footings:true})}>Hide ground to reveal buried footings</button>}
      {!count&&<p className="dd-note" role="status">All layers are hidden. Choose a preset or turn a layer back on.</p>}
    </>}
  </section>;
}
