import './fenceShapeEditor.css';
import {useEffect,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import type {DeckData} from '../types';
import type {Fence,FencePoint} from '../fences';
import {isObjectLocked} from '../editorOrganization';
import {fenceStations,fenceWithPoints,newFence,runPointAt,runStationAt,validateFences} from '../fenceRuntime';

/** Corners snap to 6 in, like the yard editor's grid; Shift places them freely. */
const SNAP_IN=6;
const snap=(v:number,free:boolean)=>free?Math.round(v):Math.round(v/SNAP_IN)*SNAP_IN;
type Drag={fence:string;kind:'corner'|'gate';index:number;id?:string;pointer:number;moved:boolean};

/**
 * Fences on the plan, with the Patios & walls tool (S9b): drag a corner or a gate along its fence, or draw a new fence
 * corner by corner. Drags preview locally; only a release or a finished drawing changes the design (one undo step), and
 * a change the fence checks refuse puts the fence back and says why.
 */
export default function FenceShapeEditor({data,update,viewBox,viewZoom=1,drawing,onDrawn,onStatus,toolbar}:{data:DeckData;update:(patch:Partial<DeckData>)=>void;viewBox:string;viewZoom?:number;drawing:boolean;onDrawn:()=>void;onStatus:(message:string)=>void;
  /** The tool's controls card, where the drawing bar goes (as the patio and wall drawing bars do). */
  toolbar?:HTMLElement|null}){
  const fences=data.fences??[],svg=useRef<SVGSVGElement>(null),drag=useRef<Drag|null>(null);
  const [preview,setPreview]=useState<Fence[]|null>(null),[draft,setDraft]=useState<FencePoint[]>([]),[cursor,setCursor]=useState<FencePoint|null>(null);
  const shown=preview??fences;
  // Handles keep a steady size on screen whatever the plan's zoom: px is screen pixels per plan inch.
  const [px,setPx]=useState(1),touch=typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches,grip=touch?22:11;
  useEffect(()=>{const el=svg.current;if(!el)return;const measure=()=>setPx(el.getScreenCTM()?.a||1);measure();const watch=new ResizeObserver(measure);watch.observe(el);return()=>watch.disconnect();},[viewZoom,viewBox]);
  useEffect(()=>{setPreview(null);},[data.fences]);
  useEffect(()=>{if(drawing){setDraft([]);setCursor(null);svg.current?.focus({preventScroll:true});onStatus('Click each corner of the new fence. Double-click, Enter or Finish fence to end; Esc cancels.');}},[drawing]);
  const world=(e:{clientX:number;clientY:number;shiftKey?:boolean}):FencePoint=>{const m=svg.current?.getScreenCTM();if(!m)return {xIn:0,zIn:0};const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());return {xIn:snap(p.x,!!e.shiftKey),zIn:snap(p.y,!!e.shiftKey)};};
  const commit=(next:Fence[],done:string)=>{try{update({fences:next.length?validateFences(next):undefined});onStatus(done);return true;}catch(e){setPreview(null);onStatus(e instanceof Error?e.message:'This fence change could not be made.');return false;}};

  // Drawing a new fence, corner by corner.
  const finish=()=>{
    // A double-click to finish also places its own clicks: corners closer than 1 ft to the last one are dropped.
    const points=draft.filter((p,i)=>i===0||Math.hypot(p.xIn-draft[i-1].xIn,p.zIn-draft[i-1].zIn)>=12);
    if(points.length<2){onStatus('A fence needs at least two corners. Keep clicking, or press Esc to stop.');return;}
    const fence={...newFence(data),points};
    if(commit([...fences,fence],`${fence.name} drawn: ${Math.round(fenceStations(points).lengthIn/12*10)/10} ft. Set its style, height and gates in Pools & backyard.`)){setDraft([]);onDrawn();}
  };
  const stop=()=>{setDraft([]);setCursor(null);onDrawn();onStatus('Fence drawing cancelled. The design is unchanged.');};
  const drawKeys=(e:KeyboardEvent)=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();stop();}
    else if(e.key==='Enter'){e.preventDefault();finish();}
    else if(e.key==='Backspace'&&draft.length){e.preventDefault();setDraft(draft.slice(0,-1));}
  };

  // Moving a corner or a gate.
  const start=(e:PointerEvent,d:Omit<Drag,'pointer'|'moved'>)=>{
    if(drawing||e.pointerType==='mouse'&&e.button!==0)return;
    if(isObjectLocked(data.editorOrganization,d.fence)){onStatus('This fence is locked. Unlock it or its layer first.');return;}
    e.preventDefault();e.stopPropagation();(e.currentTarget as Element).setPointerCapture(e.pointerId);drag.current={...d,pointer:e.pointerId,moved:false};
  };
  const move=(e:PointerEvent)=>{
    const d=drag.current;if(!d||d.pointer!==e.pointerId)return;d.moved=true;const p=world(e);
    setPreview(fences.map(f=>f.id!==d.fence?f:d.kind==='corner'?fenceWithPoints(f,f.points.map((q,i)=>i===d.index?p:q)):{...f,gates:f.gates.map(g=>g.id===d.id?{...g,atIn:Math.round(runStationAt(f.points,p))}:g)}));
  };
  const release=(e:PointerEvent)=>{
    const d=drag.current;if(!d||d.pointer!==e.pointerId)return;drag.current=null;
    if(d.moved&&preview)commit(preview,d.kind==='corner'?`Corner ${d.index+1} moved.`:'Gate moved along the fence.');else setPreview(null);
  };
  // Keys on a focused corner: arrows nudge 1 in (Shift 1 ft); Delete removes it while the fence keeps two corners.
  const unlocked=(e:KeyboardEvent,f:Fence)=>{if(!isObjectLocked(data.editorOrganization,f.id))return true;e.preventDefault();e.stopPropagation();onStatus('This fence is locked. Unlock it or its layer first.');return false;};
  const cornerKeys=(e:KeyboardEvent,f:Fence,i:number)=>{
    const step=e.shiftKey?12:1,by=({ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]} as Record<string,[number,number]>)[e.key],remove=(e.key==='Delete'||e.key==='Backspace')&&f.points.length>2;
    if(!(by||remove)||!unlocked(e,f))return;e.preventDefault();e.stopPropagation();
    if(by)commit(fences.map(x=>x.id!==f.id?x:fenceWithPoints(x,x.points.map((q,j)=>j===i?{xIn:q.xIn+by[0],zIn:q.zIn+by[1]}:q))),`Corner ${i+1} moved.`);
    else commit(fences.map(x=>x.id!==f.id?x:fenceWithPoints(x,x.points.filter((_,j)=>j!==i))),`Corner ${i+1} removed.`);
  };
  // Keys on a focused gate: left and right slide it along the fence, 1 in (Shift 1 ft).
  const gateKeys=(e:KeyboardEvent,f:Fence,id:string)=>{
    const by=({ArrowLeft:-1,ArrowRight:1} as Record<string,number>)[e.key];
    if(!by||!unlocked(e,f))return;e.preventDefault();e.stopPropagation();
    commit(fences.map(x=>x.id!==f.id?x:{...x,gates:x.gates.map(g=>g.id===id?{...g,atIn:g.atIn+by*(e.shiftKey?12:1)}:g)}),'Gate moved along the fence.');
  };

  const bar=drawing&&<section className="dd-fence-draw" aria-label="Draw a fence">
      <strong>New fence · {draft.length} corner{draft.length===1?'':'s'}{draft.length>1?` · ${Math.round(fenceStations(draft).lengthIn/12*10)/10} ft`:''}</strong>
      <button type="button" onClick={finish} disabled={draft.length<2}>Finish fence</button>
      <button type="button" onClick={stop}>Cancel</button>
    </section>;
  const xy=(points:readonly FencePoint[])=>points.map(p=>`${p.xIn},${p.zIn}`).join(' ');
  return <div className="dd-fence-shape" data-drawing={drawing||undefined}>
    <svg ref={svg} viewBox={viewBox} tabIndex={drawing?0:undefined} aria-label={drawing?'Fence drawing surface':'Fence corners and gates'} onKeyDown={drawing?drawKeys:undefined}
      onPointerDown={e=>{if(!drawing||e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();e.stopPropagation();setDraft([...draft,world(e)]);}}
      onPointerMove={e=>{if(drawing)setCursor(world(e));else move(e);}} onPointerUp={release} onPointerCancel={()=>{drag.current=null;setPreview(null);}}
      onDoubleClick={e=>{if(drawing){e.preventDefault();finish();}}}>
      {shown.map(f=><g key={f.id} data-fence-handles={f.id}>
        {preview&&<polyline className="dd-fence-shape-line" strokeWidth={3/px} points={xy(f.points)}/>}
        {f.points.map((p,i)=><circle key={i} className="dd-fence-shape-corner" cx={p.xIn} cy={p.zIn} r={grip/px} strokeWidth={2/px} tabIndex={drawing?-1:0} role="button" aria-label={`${f.name} corner ${i+1}`} onPointerDown={e=>start(e,{fence:f.id,kind:'corner',index:i})} onKeyDown={e=>cornerKeys(e,f,i)}/>)}
        {f.gates.map((g,i)=>{const c=runPointAt(f.points,g.atIn),r=(grip-1)/px;return <rect key={g.id} className="dd-fence-shape-gate" x={c.xIn-r} y={c.zIn-r} width={r*2} height={r*2} strokeWidth={2/px} transform={`rotate(45 ${c.xIn} ${c.zIn})`} role="button" tabIndex={drawing?-1:0} aria-label={`${f.name} gate ${i+1}: drag or use the arrow keys to move it along the fence`} onPointerDown={e=>start(e,{fence:f.id,kind:'gate',index:i,id:g.id})} onKeyDown={e=>gateKeys(e,f,g.id)}/>;})}
      </g>)}
      {drawing&&<><polyline className="dd-fence-shape-draft" strokeWidth={3/px} points={xy([...draft,...(cursor&&draft.length?[cursor]:[])])}/>{draft.map((p,i)=><circle key={i} className="dd-fence-shape-draft-corner" cx={p.xIn} cy={p.zIn} r={6/px}/>)}</>}
    </svg>
    {bar&&(toolbar?createPortal(bar,toolbar):<div className="dd-fence-draw-dock">{bar}</div>)}
  </div>;
}
