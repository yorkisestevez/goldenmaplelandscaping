import {useEffect,useState} from 'react';
import type {DeckData} from '../types';
import {elevationLabel} from '../elevationDatum';
import {splitLevel} from './deckShapeActions';
import type {Update} from './fields';
import {useHardscapePreview} from './useHardscapePreview';
import EditReview from './EditReview';

const levels=(data:DeckData)=>[
 {id:1,label:'Main deck',height:data.height,parent:0},
 ...(data.levels>1?[{id:2,label:'Second deck',height:data.height2,parent:1}]:[]),
 ...(data.levels>2&&data.level3?[{id:3,label:'Third deck',height:data.level3.heightIn,parent:data.level3.parent}]:[]),
];
const draftOf=(data:DeckData)=>Object.fromEntries(levels(data).map(l=>[l.id,String(l.height)]));

/** Stage all connected heights together so adjusting one level never drops another draft. */
export default function DeckElevationEditor({data,onApply,onGeometry}:{data:DeckData;onApply:Update;onGeometry:(data:DeckData|null)=>void}){
 const [draft,setDraft]=useState(()=>draftOf(data));
 const flow=useHardscapePreview(data,onApply,onGeometry,next=>{
  const patch:Partial<DeckData>={};
  // Preserve controller normalization (including connections) in the one atomic edit.
  for(const key of Object.keys(next) as (keyof DeckData)[])if(JSON.stringify(next[key])!==JSON.stringify(data[key]))(patch as Record<string,unknown>)[key]=next[key];
  return patch;
 });
 useEffect(()=>setDraft(draftOf(data)),[data]);
 const current=levels(data),proposed=flow.candidate?levels({...data,...flow.candidate.after.design}):null;
 const stage=(patch:Partial<DeckData>)=>void flow.preview([{type:'design.patch',patch:JSON.parse(JSON.stringify(patch)),unset:Object.keys(patch).filter(key=>patch[key as keyof DeckData]===undefined)}]);
 const preview=()=>{const patch:Partial<DeckData>={height:Number(draft[1])};if(data.levels>1)patch.height2=Number(draft[2]);if(data.levels>2&&data.level3)patch.level3={...data.level3,heightIn:Number(draft[3])};stage(patch);};
 return <section aria-label="Deck elevation review">
  <form onSubmit={e=>{e.preventDefault();preview();}}>
   <div className="dd-fields">{current.map(level=><label className="dd-field" key={level.id}><span>{level.label} finished elevation</span><span className="dd-number"><input aria-label={`${level.label} finished elevation`} type="number" required min={8} max={144} step="any" value={draft[level.id]??''} onChange={e=>{flow.cancel();setDraft(old=>({...old,[level.id]:e.target.value}));}}/><span>in</span></span></label>)}</div>
   <div className="dd-summary-actions"><button type="submit" className="dd-primary" disabled={flow.busy}>Preview deck elevations</button><button type="button" className="dd-secondary" onClick={()=>{flow.cancel();setDraft(draftOf(data));}}>Reset height edits</button></div>
  </form>
  {data.levels===1&&<button type="button" className="dd-secondary" disabled={flow.busy||!draft[1]?.trim()||!Number.isFinite(Number(draft[1]))||Number(draft[1])<8||Number(draft[1])>144||(data.shape==='Custom'&&!data.deckOutlines?.main)} onClick={()=>{const next={...data,height:Number(draft[1])};stage({...splitLevel(next),height:next.height});}}>Preview a split-level deck</button>}
  <div className="dd-elevation-table"><table aria-label="Deck elevation comparison"><caption>{proposed?'Review current and proposed finished heights':'Current finished heights'} · project datum</caption><thead><tr><th>Level</th><th>Current</th>{proposed&&<th>Proposed</th>}<th>Connection difference{proposed?' after Apply':''}</th></tr></thead><tbody>{(proposed??current).map(level=>{const rows=proposed??current,parent=rows.find(l=>l.id===level.parent),before=current.find(l=>l.id===level.id);return <tr key={level.id}><th>{level.label}</th><td>{before?elevationLabel(before.height):'New level'}</td>{proposed&&<td>{elevationLabel(level.height)}</td>}<td>{parent?`${elevationLabel(level.height-parent.height)} from ${parent.label.toLowerCase()}`:'Main reference'}</td></tr>;})}</tbody></table></div>
  <p className="dd-note">A negative connection difference is a step down from the parent deck. Review stair risers and landing support after changing heights.</p>
  <EditReview flow={flow} data={data} label="deck elevations"/>
 </section>;
}
