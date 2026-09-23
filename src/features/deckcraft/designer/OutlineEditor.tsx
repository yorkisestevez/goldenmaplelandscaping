import {useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import {activeCustomFront,customEdgeName,customOutline,customShapeWords,type OutlinePoint} from '../lib/customOutline';
import {addStep,angleCorner,frontEdges,moveEdge,OUTLINE_PRESETS,outlinePreset,removeStep,squareCorner} from '../lib/outlineEdits';
import type {DeckData} from '../types';
import type {Update} from './fields';

type Selection={kind:'edge';index:number}|{kind:'point';index:number}|null;
const REFUSED='That change does not fit the outline rules: edges at least 2 ft across (steps 1 ft), every part of the deck 3 to 40 ft out from the house, and square or 45° corners.';

/**
 * The custom outline editor (loaded only for shape 'Custom'). The back is fixed along the house; everything
 * else is edited by moving whole edges along their normal on a 6 in grid, so every corner stays square or 45°:
 * drag an edge, or select it (click, tap or Tab) and use the arrow keys or the buttons. A point can be cut at
 * 45°, a 45° edge squared off, an across edge split with a step, and a step removed. Every edit goes through
 * the rules in lib/customOutline.ts; one that breaks them is refused and the outline stays as it was.
 */
export default function OutlineEditor({data,update}:{data:DeckData;update:Update}){
  const front=activeCustomFront(data)!,edges=frontEdges(front),W=front[0].x,D=Math.max(...front.map(p=>p.y));
  const [selected,setSelected]=useState<Selection>(null),[message,setMessage]=useState('');
  const svgRef=useRef<SVGSVGElement>(null),drag=useRef<{edge:number;start:{x:number;y:number};base:OutlinePoint[];applied:number}|null>(null);
  const apply=(next:OutlinePoint[]|null)=>{if(next){update({customFront:next});setMessage('');return true;}setMessage(REFUSED);return false;};
  // The designer's edge ids: back, right side, the front edges, left side (edge i here is id i + 1).
  const ids=customOutline(front).edgeIds,edgeLabel=(i:number)=>customEdgeName(ids[i+1])??`Edge ${i}`;
  const describeEdge=(i:number)=>{const e=edges[i];return `${edgeLabel(i)}, ${e.lengthFt} ft${e.kind==='angled'?' at 45°':''}`;};
  // A positive move takes an across or 45° edge toward the yard and a step or the right side to the right.
  const across=(i:number)=>edges[i].kind==='across'||edges[i].kind==='angled';
  const move=(i:number,delta:number)=>{if(i>=front.length)return;const next=moveEdge(front,i,delta)??(edges[i].kind==='angled'?moveEdge(front,i,delta*2):null);apply(next);};
  const onKey=(i:number)=>(e:KeyboardEvent)=>{
    const step=e.shiftKey?1:.5,keys:Record<string,number>=across(i)?{ArrowUp:-step,ArrowDown:step}:{ArrowLeft:-step,ArrowRight:step};
    if(e.key in keys){e.preventDefault();setSelected({kind:'edge',index:i});move(i,keys[e.key]);}
    else if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected({kind:'edge',index:i});}
  };
  const toPlan=(e:PointerEvent)=>{const svg=svgRef.current,m=svg?.getScreenCTM();if(!svg||!m)return null;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());return {x:p.x,y:p.y};};
  const startDrag=(i:number)=>(e:PointerEvent<SVGGElement>)=>{setSelected({kind:'edge',index:i});if(i>=front.length)return;const start=toPlan(e);if(!start)return;
    (e.target as Element).setPointerCapture?.(e.pointerId);drag.current={edge:i,start,base:front,applied:0};};
  const onDrag=(e:PointerEvent)=>{
    const d=drag.current,p=d&&toPlan(e);if(!d||!p)return;
    const dx=p.x-d.start.x,dy=p.y-d.start.y,kind=edges[d.edge]?.kind,a=edges[d.edge]?.a,b=edges[d.edge]?.b;
    const raw=kind==='across'?dy:kind==='angled'&&a&&b?((b.x-a.x)*(b.y-a.y)<0?dx+dy:dy-dx):dx,snapped=Math.round(raw*2)/2;
    if(snapped===d.applied)return;
    const next=moveEdge(d.base,d.edge,snapped);if(next){d.applied=snapped;update({customFront:next});setMessage('');}
  };
  const endDrag=()=>{drag.current=null;};
  const sel=selected,edgeSel=sel?.kind==='edge'&&sel.index<=front.length?sel.index:null,pointSel=sel?.kind==='point'&&sel.index<front.length?sel.index:null;
  const pad=2.5,view=`${-pad} ${-pad-1.5} ${W+pad*2} ${D+pad*2+1.5}`;
  return <fieldset className="dd-wrap dd-outline"><legend>Custom outline</legend>
    <p className="dd-note">The back runs straight along the house. Shape the rest by moving edges: drag one, or select it and use the arrow keys (Shift for 1 ft). Corners stay square or at 45°, on a 6 in grid.</p>
    <div className="dd-outline-presets" role="group" aria-label="Start from a shape">{OUTLINE_PRESETS.map(p=>{const next=outlinePreset(p.id,W,D);return <button key={p.id} type="button" className="dd-secondary" disabled={!next} onClick={()=>{setSelected(null);apply(next);}}>{p.name}</button>;})}</div>
    <svg ref={svgRef} className="dd-outline-plan" viewBox={view} role="group" aria-label={`Deck outline, ${W} × ${D} ft overall`} onPointerMove={onDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <defs><pattern id="dd-outline-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#dedfd5" strokeWidth=".04"/></pattern></defs>
      <rect x={-pad} y={-pad-1.5} width={W+pad*2} height={D+pad*2+1.5} fill="url(#dd-outline-grid)"/>
      <rect x={-pad} y={-1.5} width={W+pad*2} height={1.5} fill="#d9d4c7"/><text x={W/2} y={-.45} textAnchor="middle" fontSize=".9" fill="#5a3f2c">House</text>
      <polygon points={[{x:0,y:0},{x:W,y:0},...front].map(p=>`${p.x},${p.y}`).join(' ')} fill="#e8d3b5" stroke="#5a3f2c" strokeWidth=".08"/>
      {edges.map((e,i)=>{const on=edgeSel===i,fixed=i>=front.length,mid={x:(e.a.x+e.b.x)/2,y:(e.a.y+e.b.y)/2};
        return <g key={i} role="button" tabIndex={0} aria-pressed={on} aria-label={`${describeEdge(i)}.${fixed?' The left side stays on the house corner.':across(i)?' Up and down arrows move it.':' Left and right arrows move it.'}`} className="dd-outline-edge" onPointerDown={startDrag(i)} onKeyDown={onKey(i)} onFocus={()=>setSelected({kind:'edge',index:i})}>
          <line x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y} stroke="transparent" strokeWidth="1.2" style={{cursor:fixed?'default':across(i)?'ns-resize':'ew-resize'}}/>
          <line x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y} stroke={on?'#b8862f':'#5a3f2c'} strokeWidth={on?.3:.12} pointerEvents="none"/>
          {e.lengthFt>=2&&(()=>{const len=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y)||1,n={x:(e.b.y-e.a.y)/len,y:-(e.b.x-e.a.x)/len};// just outside the edge
            return <text x={mid.x+n.x*.9} y={mid.y+n.y*.9+.27} textAnchor={n.x>.5?'start':n.x<-.5?'end':'middle'} fontSize=".75" fill="#3d2a1c" pointerEvents="none">{e.lengthFt} ft</text>;})()}
        </g>;})}
      {front.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={pointSel===i?.45:.3} fill={pointSel===i?'#b8862f':'#fff'} stroke="#5a3f2c" strokeWidth=".08" role="button" tabIndex={0} aria-label={`Corner ${i+1}, ${p.x} ft across and ${p.y} ft out`} aria-pressed={pointSel===i} style={{cursor:'pointer'}} onPointerDown={ev=>{ev.stopPropagation();setSelected({kind:'point',index:i});}} onKeyDown={ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();setSelected({kind:'point',index:i});}}}/>)}
    </svg>
    <div className="dd-outline-actions" role="group" aria-label="Edit the selection">
      {edgeSel!==null&&<><strong>{describeEdge(edgeSel)}</strong>
        {edgeSel<front.length&&(across(edgeSel)?<><button type="button" className="dd-secondary" onClick={()=>move(edgeSel,-.5)}>Toward the house</button><button type="button" className="dd-secondary" onClick={()=>move(edgeSel,.5)}>Toward the yard</button></>:<><button type="button" className="dd-secondary" onClick={()=>move(edgeSel,-.5)}>Move left</button><button type="button" className="dd-secondary" onClick={()=>move(edgeSel,.5)}>Move right</button></>)}
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
