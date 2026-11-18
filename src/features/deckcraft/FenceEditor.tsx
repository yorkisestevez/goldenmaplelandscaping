import './fenceEditor.css';
import {useState} from 'react';
import type {DeckData} from './types';
import type {Fence,FenceGate,FenceHeightFt,FencePoint,FenceStyle,FenceWood} from './fences';
import {isObjectLocked} from './editorOrganization';
import {FENCE_LIMITS,FENCE_STYLES,GATE_WIDTH_IN,fenceQuantities,fenceRates,fenceStations,fenceWithPoints,gateSegment,newFence,validateFences} from './fenceRuntime';

const ft=(inches:number)=>Math.round(inches/12*100)/100;
const money=(cents:number)=>(cents/100).toLocaleString('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0});
const newId=(prefix:string)=>`${prefix}-${crypto.randomUUID().slice(0,8)}`;

/** A number in feet, committed when the field is left (as the yard editor's own fields are); a refused value springs back. */
function Feet({label,value,onCommit}:{label:string;value:number;onCommit:(feet:number)=>boolean}){
  return <label className="dd-field"><span>{label}</span><span className="dd-number"><input key={value} aria-label={label} type="number" step={0.5} defaultValue={value} onBlur={e=>{const n=Number(e.target.value);if(e.target.value===''||!Number.isFinite(n)||n!==value&&!onCommit(n))e.target.value=String(value);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><small>ft</small></span></label>;
}

/**
 * Fences & gates in Pools & backyard: add a fence, pick its style and height, set its corners and its gates. Each change
 * is checked before it reaches the design, so a refused one says why and changes nothing.
 */
export default function FenceEditor({data,onChange}:{data:DeckData;onChange:(patch:Partial<DeckData>)=>void}){
  const fences=data.fences??[],[selectedId,setSelectedId]=useState(''),[message,setMessage]=useState('');
  const fence=fences.find(f=>f.id===selectedId)??fences[0];
  const commit=(next:Fence[],done='')=>{try{onChange({fences:next.length?validateFences(next):undefined});setMessage(done);return true;}catch(e){setMessage(e instanceof Error?e.message:'This fence change could not be made.');return false;}};
  const locked=!!fence&&isObjectLocked(data.editorOrganization,fence.id);
  const edit=(patch:Partial<Fence>)=>{if(!fence)return false;if(locked){setMessage(`${fence.name} is locked. Unlock it or its layer in Layers first.`);return false;}return commit(fences.map(f=>f.id===fence.id?{...f,...patch}:f));};
  const add=()=>{const next=newFence(data);if(commit([...fences,next],`${next.name} added across the yard. Set its corners below.`))setSelectedId(next.id);};
  // Corner changes keep each gate where it stands on the ground.
  const corners=(points:FencePoint[])=>!!fence&&edit({points,gates:fenceWithPoints(fence,points).gates});
  const point=(i:number,patch:Partial<FencePoint>)=>!!fence&&corners(fence.points.map((p,j)=>j===i?{...p,...patch}:p));
  // A new corner continues the last straight part by 8 ft.
  const addCorner=()=>{if(!fence)return;const [a,b]=fence.points.slice(-2),len=Math.hypot(b.xIn-a.xIn,b.zIn-a.zIn)||1;edit({points:[...fence.points,{xIn:Math.round(b.xIn+(b.xIn-a.xIn)/len*96),zIn:Math.round(b.zIn+(b.zIn-a.zIn)/len*96)}]});};
  const gate=(id:string,patch:Partial<FenceGate>)=>!!fence&&edit({gates:fence.gates.map(g=>g.id===id?{...g,...patch}:g)});
  // A new single gate goes in the middle of the longest straight part it fits in, clear of the other gates.
  const addGate=()=>{
    if(!fence)return;const {stations}=fenceStations(fence.points),order=stations.slice(1).map((end,i)=>({i,start:stations[i],length:end-stations[i]})).sort((a,b)=>b.length-a.length);
    for(const s of order){const g:FenceGate={id:newId('gate'),kind:'single',atIn:Math.round(s.start+s.length/2)};if(gateSegment(fence.points,g)>=0&&commit(fences.map(f=>f.id===fence.id?{...f,gates:[...f.gates,g]}:f),'Gate added. Move it along the fence below.'))return;}
    setMessage('There is no room for another 4 ft gate on this fence.');
  };
  const q=fence?fenceQuantities(fence,fenceRates(data)):undefined;
  return <section className="dd-fence-editor" aria-labelledby="dd-fence-title">
    <h3 id="dd-fence-title">Fences &amp; gates</h3>
    <p className="dd-note">A fence runs from corner to corner. Corners are measured from the deck’s back-left corner: across the house to the right, and out into the yard.</p>
    <div className="dd-summary-actions"><button type="button" className="dd-secondary" disabled={fences.length>=FENCE_LIMITS.fences} onClick={add}>Add a fence</button></div>
    {fence&&q&&<>
      {fences.length>1&&<label className="dd-field"><span>Selected fence</span><select aria-label="Selected fence" value={fence.id} onChange={e=>{setSelectedId(e.target.value);setMessage('');}}>{fences.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
      <div className="dd-fields">
        <label className="dd-field"><span>Fence name</span><input aria-label="Fence name" maxLength={80} defaultValue={fence.name} key={fence.id+fence.name} onBlur={e=>{const name=e.target.value.trim();if(name&&name!==fence.name)edit({name});else e.target.value=fence.name;}}/></label>
        <label className="dd-field"><span>Style</span><select aria-label="Fence style" value={fence.style} onChange={e=>{const style=e.target.value as FenceStyle;edit({style,wood:undefined});}}>{FENCE_STYLES.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        {fence.style==='wood-privacy'&&<label className="dd-field"><span>Wood</span><select aria-label="Fence wood" value={fence.wood??'pressure-treated'} onChange={e=>edit({wood:e.target.value==='cedar'?'cedar' as FenceWood:undefined})}><option value="pressure-treated">Pressure-treated</option><option value="cedar">Cedar</option></select></label>}
        <label className="dd-field"><span>Height</span><select aria-label="Fence height" value={fence.heightFt} onChange={e=>edit({heightFt:Number(e.target.value) as FenceHeightFt})}>{[6,5,4].map(h=><option key={h} value={h}>{h} ft</option>)}</select></label>
      </div>
      <fieldset className="dd-fence-points"><legend>Corners</legend>
        {fence.points.map((p,i)=><div key={i} className="dd-fence-row" role="group" aria-label={`Corner ${i+1}`}>
          <strong>{i+1}</strong>
          <Feet label={`Corner ${i+1} across`} value={ft(p.xIn)} onCommit={v=>point(i,{xIn:Math.round(v*12)})}/>
          <Feet label={`Corner ${i+1} out`} value={ft(p.zIn)} onCommit={v=>point(i,{zIn:Math.round(v*12)})}/>
          {fence.points.length>2&&<button type="button" className="dd-secondary" aria-label={`Remove corner ${i+1}`} onClick={()=>corners(fence.points.filter((_,j)=>j!==i))}>Remove</button>}
        </div>)}
        <button type="button" className="dd-secondary" disabled={fence.points.length>=FENCE_LIMITS.points} onClick={addCorner}>Add a corner</button>
      </fieldset>
      <fieldset className="dd-fence-gates"><legend>Gates</legend>
        {fence.gates.map((g,i)=><div key={g.id} className="dd-fence-row" role="group" aria-label={`Gate ${i+1}`}>
          <strong>{i+1}</strong>
          <label className="dd-field"><span>Gate {i+1} kind</span><select aria-label={`Gate ${i+1} kind`} value={g.kind} onChange={e=>gate(g.id,{kind:e.target.value as FenceGate['kind']})}><option value="single">Single, {GATE_WIDTH_IN.single/12} ft</option><option value="double">Double, {GATE_WIDTH_IN.double/12} ft</option></select></label>
          <Feet label={`Gate ${i+1} centre along the fence`} value={ft(g.atIn)} onCommit={v=>gate(g.id,{atIn:Math.round(v*12)})}/>
          <button type="button" className="dd-secondary" aria-label={`Remove gate ${i+1}`} onClick={()=>edit({gates:fence.gates.filter(x=>x.id!==g.id)})}>Remove</button>
        </div>)}
        <button type="button" className="dd-secondary" disabled={fence.gates.length>=FENCE_LIMITS.gates} onClick={addGate}>Add a gate</button>
      </fieldset>
      <p className="dd-note" aria-label="Fence summary">{Math.round(q.lengthLf*10)/10} ft long · {Math.round(q.fenceLf*10)/10} ft of fence{fence.gates.length?` and ${fence.gates.length} gate${fence.gates.length>1?'s':''}`:''} · {money(q.runCents+q.gateCents)} installed (standard rate, confirmed at the site visit)</p>
      <div className="dd-summary-actions"><button type="button" className="dd-secondary" disabled={locked} onClick={()=>{commit(fences.filter(f=>f.id!==fence.id),`${fence.name} removed.`);setSelectedId('');}}>Remove this fence</button></div>
    </>}
    {message&&<p role="status" className="dd-fence-message">{message}</p>}
  </section>;
}
