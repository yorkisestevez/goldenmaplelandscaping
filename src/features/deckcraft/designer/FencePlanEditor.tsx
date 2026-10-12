import {useMemo,useRef,useState,type PointerEvent,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import type {PlanFrame} from '../ConstructionPlan';
import type {DeckTakeoff} from '../deckTakeoff';
import {FENCE_STYLES,FENCE_STYLE_IDS,FROST_FOOTING_NOTE,POOL_ENCLOSURE_NOTE,addFenceGate,fencePostCounts,fenceQuantities,newFenceRun,restyleFence,runLengthIn,validateFences,type FencePoint,type FenceRun,type FenceStyleId} from '../fenceTypes';
import {samplePath} from '../shapeTools';
import type {DeckData} from '../types';
import {fenceSnapTargets} from './fenceSnap';
import ShapeDrawTool,{type DrawResult} from './ShapeDrawTool';
import './landscapeEditing.css';
import './shapeDrawTool.css';

const feet=(inches:number)=>`${(Math.round(inches/12*10)/10).toFixed(1)} ft`;
function spaced(points:{x:number;y:number}[]):FencePoint[]{
  if(points.length<2)throw Error('A fence run needs at least two points.');
  const out:FencePoint[]=[{x:points[0].x,y:points[0].y}];
  for(const p of points.slice(1,-1))if(Math.hypot(p.x-out.at(-1)!.x,p.y-out.at(-1)!.y)>=12)out.push({x:p.x,y:p.y});
  const end=points.at(-1)!;
  if(Math.hypot(end.x-out.at(-1)!.x,end.y-out.at(-1)!.y)<12){
    if(out.length<2)throw Error('A fence run must be at least 4 feet long.');
    const prev=out[out.length-2];
    if(Math.hypot(end.x-prev.x,end.y-prev.y)<12)throw Error('Leave at least 12 inches between fence points.');
    out[out.length-1]={x:end.x,y:end.y};
  }else out.push({x:end.x,y:end.y});
  if(out.length>64)throw Error('A fence run supports up to 64 points.');
  return out;
}

export default function FencePlanEditor({data,frame,zoom,onApply,toolbar,model}:{data:DeckData;frame:PlanFrame;zoom:number;onApply:(patch:Partial<DeckData>)=>void;toolbar:RefObject<HTMLDivElement|null>;model:DeckTakeoff}){
  const runs=data.fences??[];
  const [selected,setSelected]=useState(()=>runs[0]?.id??'');
  const [drawing,setDrawing]=useState(false);
  const [style,setStyle]=useState<FenceStyleId>('cedar-horizontal');
  const [notice,setNotice]=useState('');
  const [point,setPoint]=useState(-1);
  const [host,setHost]=useState<HTMLDivElement|null>(null);
  const [draft,setDraft]=useState<FencePoint[]|null>(null);
  const svg=useRef<SVGSVGElement>(null),drag=useRef<{id:number;index:number}|null>(null);
  const run=runs.find(r=>r.id===selected)??runs[0];
  const snaps=useMemo(()=>fenceSnapTargets(data,model),[data,model]);
  const qty=fenceQuantities(runs);
  const counts=fencePostCounts(runs);
  const commit=(next:FenceRun[])=>{
    try{const clean=next.length?validateFences(next):undefined;onApply({fences:clean});setNotice('');return true;}
    catch(e){setNotice(e instanceof Error?e.message:'That fence could not be saved.');return false;}
  };
  const replace=(next:FenceRun)=>commit(runs.map(r=>r.id===next.id?next:r));
  const world=(e:{clientX:number;clientY:number})=>{const m=svg.current?.getScreenCTM();if(!m)throw Error('Wait for the plan to finish loading.');const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());return {x:p.x,y:p.y};};
  const snap=(p:FencePoint,skip?:FencePoint)=>{
    const reach=Math.max(8,22/Math.max(zoom,.05));let best=p,d=reach;
    for(const t of snaps){if(skip&&Math.hypot(t.x-skip.x,t.y-skip.y)<1e-3)continue;const n=Math.hypot(t.x-p.x,t.y-p.y);if(n<d){best={x:t.x,y:t.y};d=n;}}
    return best;
  };
  const finish=({path}:DrawResult)=>{
    try{
      const raw=path.edges.some(e=>e.kind==='arc'&&e.bulgeIn)?samplePath(path,6):path.points;
      const points=spaced(raw),id=`fence-${crypto.randomUUID()}`;
      const next=newFenceRun(style,points,id);
      if(commit([...runs,next])){setSelected(id);setPoint(-1);setDrawing(false);}
    }catch(e){setNotice(e instanceof Error?e.message:'That fence line could not be saved.');}
  };
  const move=(e:PointerEvent<SVGSVGElement>)=>{
    const g=drag.current;if(!g||g.id!==e.pointerId||!run)return;
    try{const points=(draft??run.points).map((p,i)=>i===g.index?snap(world(e),run.points[g.index]):p);setDraft(points);}catch{/* plan not ready */}
  };
  const up=(e:PointerEvent<SVGSVGElement>)=>{
    if(drag.current?.id!==e.pointerId)return;drag.current=null;
    if(draft&&run){const next={...run,points:draft,gates:run.gates.filter(g=>{try{return validateFences([{...run,points:draft,gates:[g]}]);}catch{return false;}})};if(!replace(next))setNotice('That point would make the fence too short or leave a gate off a straight section.');setDraft(null);}
  };
  const shown=run&&draft?{...run,points:draft}:run;
  const gapLocked=run?.style==='board-on-board'||run?.style==='glass';
  const controls=<div className="dd-area-panel" data-plan-editor-ui="true">
    <strong>Fence</strong>
    <div className="dd-area-fields">
      <label>Style<select aria-label="Fence style" value={run?.style??style} onChange={e=>{const id=e.target.value as FenceStyleId;setStyle(id);if(run){try{replace(restyleFence(run,id));}catch(err){setNotice(err instanceof Error?err.message:'That style does not fit this fence.');}}}}>{FENCE_STYLE_IDS.map(id=><option key={id} value={id}>{FENCE_STYLES[id].name}</option>)}</select></label>
      <label>Run<select aria-label="Fence run" value={run?.id??''} onChange={e=>{setSelected(e.target.value);setPoint(-1);}}><option value="">Choose a run</option>{runs.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
    </div>
    <div className="dd-area-actions"><button type="button" onClick={()=>setDrawing(true)}>Draw fence run</button>{run&&<button type="button" onClick={()=>{const next=runs.filter(r=>r.id!==run.id);commit(next);setSelected(next[0]?.id??'');setPoint(-1);}}>Delete run</button>}</div>
    {run&&shown&&<>
      <div className="dd-area-fields">
        <label>Name<input aria-label="Fence name" value={run.name} onChange={e=>replace({...run,name:e.target.value})}/></label>
        <label>Height<select aria-label="Fence height" value={run.heightFt} onChange={e=>replace({...run,heightFt:Number(e.target.value)})}>{[4,5,6,7,8].map(h=><option key={h} value={h}>{h} ft</option>)}</select></label>
        <label>Post spacing (ft)<input aria-label="Post spacing" type="number" min={4} max={10} step={.5} value={run.postSpacingFt} onChange={e=>{const n=Number(e.target.value);if(n>=4&&n<=10)replace({...run,postSpacingFt:n});}}/></label>
        <label>Slat gap (in)<input aria-label="Slat gap" type="number" min={0} max={6} step={.125} disabled={gapLocked} value={gapLocked?0:run.slatGapIn} onChange={e=>{const n=Number(e.target.value);if(n>=0&&n<=6)replace({...run,slatGapIn:n});}}/></label>
        <label>Infill colour<input aria-label="Infill colour" type="color" value={run.infillColor} onChange={e=>replace({...run,infillColor:e.target.value})}/></label>
        <label>Post colour<input aria-label="Post colour" type="color" value={run.postColor} onChange={e=>replace({...run,postColor:e.target.value})}/></label>
        <label>Finish<select aria-label="Fence finish" value={run.finish} onChange={e=>replace({...run,finish:e.target.value})}>{FENCE_STYLES[run.style].finishes.map(f=><option key={f}>{f}</option>)}</select></label>
      </div>
      <label className="dd-designer-toggle"><input type="checkbox" checked={run.poolEnclosure} onChange={e=>{const pool=e.target.checked;replace({...run,poolEnclosure:pool,gates:pool?run.gates.map(g=>({...g,selfClosing:true,latching:true})):run.gates});}}/> Pool enclosure</label>
      <p className="dd-area-hint">{feet(runLengthIn(shown.points))} on this run · {counts.get(run.id)??0} posts · {counts.get(run.id)??0} concrete footings. {qty.linearFt.toFixed(1)} ft of fence in the design. Gate openings are included in the length. Supply, posts, gates and footings are supplier quotes.</p>
      <div className="dd-area-actions">
        <button type="button" onClick={()=>{try{replace(addFenceGate(run,'single',`gate-${crypto.randomUUID()}`));}catch(e){setNotice(e instanceof Error?e.message:'A single gate does not fit.');}}}>Add single gate</button>
        <button type="button" onClick={()=>{try{replace(addFenceGate(run,'double',`gate-${crypto.randomUUID()}`));}catch(e){setNotice(e instanceof Error?e.message:'A double gate does not fit.');}}}>Add double gate</button>
        {point>=0&&shown.points.length>2&&<button type="button" onClick={()=>{const points=run.points.filter((_,i)=>i!==point);const next={...run,points,gates:run.gates.filter(g=>{try{validateFences([{...run,points,gates:[g]}]);return true;}catch{return false;}})};if(replace(next))setPoint(-1);}}>Delete point</button>}
      </div>
      {run.gates.map(g=><div key={g.id} className="dd-area-fields">
        <label>{g.kind==='double'?'Double':'Single'} gate<select aria-label={`${g.kind} gate hardware`} value={`${g.selfClosing?'close':''}${g.latching?'latch':''}`} onChange={e=>{const v=e.target.value;replace({...run,gates:run.gates.map(x=>x.id===g.id?{...x,selfClosing:v.includes('close'),latching:v.includes('latch')}:x)});}}><option value="closelatch">Self-closing and latching</option><option value="close">Self-closing</option><option value="latch">Latching</option><option value="">Neither</option></select></label>
        <button type="button" onClick={()=>replace({...run,gates:run.gates.filter(x=>x.id!==g.id)})}>Remove gate</button>
      </div>)}
      <p className="dd-area-hint">{FROST_FOOTING_NOTE}</p>
      {run.poolEnclosure&&<p className="dd-area-hint">{POOL_ENCLOSURE_NOTE}</p>}
    </>}
    {!run&&<p className="dd-area-hint">Draw a fence along a lot line, a patio or a pool. Height, spacing, gap, colour and gates are set on the run. {FROST_FOOTING_NOTE}</p>}
    {notice&&<p role="status" className="dd-area-error">{notice}</p>}
  </div>;
  return <>
    {toolbar.current&&createPortal(controls,toolbar.current)}
    <div ref={setHost} className="dd-landscape-plan dd-fence-plan" data-drawing={drawing||undefined}>
      {shown&&<svg ref={svg} viewBox={frame.viewBox} preserveAspectRatio="xMidYMid meet" onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{drag.current=null;setDraft(null);}}>
        {runs.filter(r=>r.enabled||r.id===shown.id).map(r=>{
          const pts=r.id===shown.id?shown.points:r.points,active=r.id===shown.id;
          return <g key={r.id}>
            <path data-area-pick="true" d={pts.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ')} fill="none" stroke={active?'#df962e':r.infillColor} strokeWidth={(active?4:2)/Math.max(zoom,.2)} onClick={e=>{e.stopPropagation();setSelected(r.id);setPoint(-1);}}/>
            {active&&pts.map((p,i)=><circle key={i} data-area-handle="true" cx={p.x} cy={p.y} r={Math.max(5,8/zoom)} fill={point===i?'#df962e':'#fff'} stroke="#263c2c" strokeWidth={1/zoom} aria-label={`Fence point ${i+1}`} onPointerDown={e=>{if(e.button!==0)return;e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,index:i};setPoint(i);setSelected(r.id);}}/>)}
            {active&&pts.slice(0,-1).map((p,i)=>{const q=pts[i+1];return <circle key={`mid-${i}`} data-area-handle="true" cx={(p.x+q.x)/2} cy={(p.y+q.y)/2} r={Math.max(4,6/zoom)} fill="#f0dca9" stroke="#263c2c" strokeWidth={1/zoom} aria-label={`Insert fence point after ${i+1}`} onClick={e=>{e.stopPropagation();const points=[...run.points];points.splice(i+1,0,{x:(p.x+q.x)/2,y:(p.y+q.y)/2});const next={...run,points,gates:run.gates.filter(g=>{try{validateFences([{...run,points,gates:[g]}]);return true;}catch{return false;}})};if(replace(next))setPoint(i+1);}}/>;})}
          </g>;
        })}
      </svg>}
      {drawing&&host&&createPortal(<ShapeDrawTool frame={frame} mode="polygon" closed={false} label="Fence run" snapPoints={snaps} panelHost={toolbar.current} onFinish={finish} onCancel={()=>setDrawing(false)}/>,host)}
    </div>
  </>;
}
