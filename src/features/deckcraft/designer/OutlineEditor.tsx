import type {KeyboardEvent} from 'react';
import {customShapeWords} from '../lib/customOutline';
import {addStep,angleCorner,OUTLINE_PRESETS,outlinePreset,removeStep,squareCorner} from '../lib/outlineEdits';
import type {DeckData} from '../types';
import type {Update} from './fields';
import {describeEdge,listKeyDelta,movesOut} from './outlineEditMath';
import {useOutlineEdit} from './useOutlineEdit';

/**
 * The custom outline's controls in the Deck section (loaded only for shape 'Custom'). The outline is drawn and dragged on
 * the site plan (its Draw outline tool); here every edit has a button, so it can all be done from the keyboard. The back
 * is fixed along the house; everything else is edited by moving whole edges along their normal on a 6 in grid, so every
 * corner stays square or 45°: select an edge and use the arrow keys or the buttons. A point can be cut at 45°, a 45°
 * edge squared off, an across edge split with a step, and a step removed. Every edit goes through useOutlineEdit (the
 * rules in lib/customOutline.ts); one that breaks them is refused and the outline stays as it was.
 */
export default function OutlineEditor({data,update,onDrawOnPlan}:{data:DeckData;update:Update;onDrawOnPlan?:()=>void}){
  const {front:active,edges,selected,setSelected,message,apply,move,preset}=useOutlineEdit(data,update);
  const front=active!,W=front[0].x,D=Math.max(...front.map(p=>p.y));
  const onKey=(i:number)=>(e:KeyboardEvent)=>{
    const delta=listKeyDelta(edges[i],e.key,e.shiftKey);
    if(delta!==null){e.preventDefault();setSelected({kind:'edge',index:i});move(i,delta);}
  };
  const sel=selected,edgeSel=sel?.kind==='edge'&&sel.index<=front.length?sel.index:null,pointSel=sel?.kind==='point'&&sel.index<front.length?sel.index:null;
  return <fieldset className="dd-wrap dd-outline"><legend>Custom outline</legend>
    <p className="dd-note">The back runs straight along the house. Shape the rest by moving edges: drag one on the plan with its Draw outline tool, or select it here and use the arrow keys (Shift for 1 ft). Corners stay square or at 45°, on a 6 in grid.</p>
    {onDrawOnPlan&&<div className="dd-summary-actions"><button type="button" className="dd-secondary" onClick={onDrawOnPlan}>Draw it on the plan</button></div>}
    <div className="dd-outline-presets" role="group" aria-label="Start from a shape">{OUTLINE_PRESETS.map(p=><button key={p.id} type="button" className="dd-secondary" disabled={!outlinePreset(p.id,W,D)} onClick={()=>preset(p.id)}>{p.name}</button>)}</div>
    <div className="dd-outline-edges" role="group" aria-label={`Edges of the outline, ${W} × ${D} ft overall`}>
      {edges.map((e,i)=>{const fixed=i>=front.length,name=describeEdge(front,i);
        return <button key={i} type="button" className="dd-secondary" aria-pressed={edgeSel===i} aria-label={`${name}.${fixed?' The left side stays on the house corner.':movesOut(e)?' Up and down arrows move it.':' Left and right arrows move it.'}`} onClick={()=>setSelected({kind:'edge',index:i})} onFocus={()=>setSelected({kind:'edge',index:i})} onKeyDown={onKey(i)}>{name}</button>;})}
    </div>
    <div className="dd-outline-edges" role="group" aria-label="Corners of the outline">
      {front.map((p,i)=><button key={i} type="button" className="dd-secondary" aria-pressed={pointSel===i} aria-label={`Corner ${i+1}, ${p.x} ft across and ${p.y} ft out`} onClick={()=>setSelected({kind:'point',index:i})}>Corner {i+1}</button>)}
    </div>
    <div className="dd-outline-actions" role="group" aria-label="Edit the selection">
      {edgeSel!==null&&<><strong>{describeEdge(front,edgeSel)}</strong>
        {edgeSel<front.length&&(movesOut(edges[edgeSel])?<><button type="button" className="dd-secondary" onClick={()=>move(edgeSel,-.5)}>Toward the house</button><button type="button" className="dd-secondary" onClick={()=>move(edgeSel,.5)}>Toward the yard</button></>:<><button type="button" className="dd-secondary" onClick={()=>move(edgeSel,-.5)}>Move left</button><button type="button" className="dd-secondary" onClick={()=>move(edgeSel,.5)}>Move right</button></>)}
        {edges[edgeSel].kind==='across'&&<button type="button" className="dd-secondary" onClick={()=>apply(addStep(front,edgeSel))}>Add a step</button>}
        {edges[edgeSel].kind==='angled'&&<button type="button" className="dd-secondary" onClick={()=>{if(apply(squareCorner(front,edgeSel)))setSelected(null);}}>Square this corner</button>}
        {edges[edgeSel].kind==='step'&&<button type="button" className="dd-secondary" onClick={()=>{if(apply(removeStep(front,edgeSel)))setSelected(null);}}>Remove this step</button>}</>}
      {pointSel!==null&&<><strong>Corner {pointSel+1} · {front[pointSel].x} ft across, {front[pointSel].y} ft out</strong><button type="button" className="dd-secondary" onClick={()=>{if(apply(angleCorner(front,pointSel)))setSelected(null);}}>Angle this corner at 45°</button></>}
      {!sel&&<span className="dd-note">Select an edge or a corner to change it.</span>}
    </div>
    {message&&<p className="dd-note" role="alert">{message}</p>}
    <p className="dd-note" role="status">{customShapeWords(front)}.</p>
  </fieldset>;
}
