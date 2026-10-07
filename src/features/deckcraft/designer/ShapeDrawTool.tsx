import {useArchitectKeys,useDraftKeys,revealControl} from './architectKeys';
import {lockedSnap} from './drawingDirection';
import {useDrawingDirection} from './useDrawingDirection';
import {useEffect,useRef,useState,type FormEvent,type PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import type {PlanPoint} from '../lib/deckGeometry';
import type {PlanFrame} from '../ConstructionPlan';
import {parseContractorLength} from './boundaryDimensions';
import {arcGeometry} from '../circularArcs';
import {circlePath,edgeTangent,pathArea,pathLength,pathOutline,pathProblem,rectanglePath,samplePath,tangentArcBulge,threePointBulge,type ShapeEdge,type ShapePath} from '../shapeTools';
import './shapeDrawTool.css';
import {drawingSnap} from './drawingSnap';

/** Designer drawing surface shared by the patio/wall and landscape plan editors. Polygons and walkway centrelines are
 * drawn edge by edge as straight lines, tangent arcs (continuing the last edge) or 3-point arcs (middle, then end);
 * rectangles and circles take two clicks. Points snap to existing corners, 15° directions and a grid (Shift holds the current
 * direction); an exact length and direction can be typed. Nothing reaches the design until the shape is finished. */
export type DrawMode='polygon'|'rectangle'|'circle'|'path';
type Segment='line'|'tangent'|'arc3';
export interface DrawResult {path:ShapePath;widthIn?:number;ends?:'square'|'round'}
interface Props {frame:PlanFrame;mode:DrawMode;closed:boolean;label:string;snapPoints:PlanPoint[];panelHost?:HTMLElement|null;onFinish:(result:DrawResult)=>void;onCancel:()=>void}
const LINE:ShapeEdge={kind:'line'};
const GRIDS=[0,1,3,6,12];
const dist=(a:PlanPoint,b:PlanPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
export const feetInches=(inches:number)=>{const sign=inches<0?'−':'',total=Math.round(Math.abs(inches)*10)/10,ft=Math.floor(total/12),inch=Math.round((total-ft*12)*10)/10;return `${sign}${ft}′ ${inch}″`;};
const points=(p:PlanPoint[])=>p.map(q=>`${q.x},${q.y}`).join(' ');

export default function ShapeDrawTool({frame,mode,closed,label,snapPoints,panelHost,onFinish,onCancel}:Props){
 const [pts,setPts]=useState<PlanPoint[]>([]),[edges,setEdges]=useState<ShapeEdge[]>([]),[mid,setMid]=useState<PlanPoint|undefined>();
 const [cursor,setCursor]=useState<PlanPoint|null>(null),[segment,setSegment]=useState<Segment>('line'),[grid,setGrid]=useState(1),[angleSnap,setAngleSnap]=useState(true);
 const [typedLength,setTypedLength]=useState(''),[typedAngle,setTypedAngle]=useState('0'),[width,setWidth]=useState('4\''),[ends,setEnds]=useState<'square'|'round'>('square'),[notice,setNotice]=useState('');
 const svg=useRef<SVGSVGElement>(null),tap=useRef<{id:number;x:number;y:number}|null>(null),scale=useRef(1);
 const directionPoint=useDrawingDirection(pts);
 const panelRef=useRef<HTMLElement>(null),previousGrid=useRef(1);
 const polyline=mode==='polygon'||mode==='path',draft:ShapePath={points:pts,edges,closed:false};
 const fail=(e:unknown)=>setNotice(e instanceof Error?e.message:'That point could not be placed.');
 const worldAt=(e:{clientX:number;clientY:number})=>{const m=svg.current?.getScreenCTM();if(!m)throw Error('Wait for the plan to finish loading.');scale.current=Math.max(1e-6,Math.hypot(m.a,m.b));const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());return {x:p.x,y:p.y};};
 /** The edge from the last point to `to`, in the current segment mode. */
 const pending=(to:PlanPoint):ShapeEdge=>{const from=pts.at(-1);if(!from||!polyline)return LINE;if(segment==='tangent'&&edges.length)return {kind:'arc',bulgeIn:tangentArcBulge(edgeTangent(draft,edges.length-1,true),from,to)};if(segment==='arc3'&&mid)return {kind:'arc',bulgeIn:threePointBulge(from,mid,to)};return LINE;};
 const normalSnap=(raw:PlanPoint):PlanPoint=>{
  const reach=22/scale.current,targets=[...(closed&&pts.length>2?[pts[0]]:[]),...pts,...snapPoints];
  const hit=drawingSnap(raw,pts,targets,closed,reach);if(hit.closing||hit.snapped)return {...hit.point};
  const from=pts.at(-1);
  if(angleSnap&&from&&polyline&&segment==='line'){const d=dist(from,raw),step=Math.PI/12,a=Math.round(Math.atan2(raw.y-from.y,raw.x-from.x)/step)*step,L=grid?Math.max(grid,Math.round(d/grid)*grid):d;return {x:from.x+Math.cos(a)*L,y:from.y+Math.sin(a)*L};}
  return grid?{x:Math.round(raw.x/grid)*grid,y:Math.round(raw.y/grid)*grid}:raw;
 };
 const snap=(raw:PlanPoint,shift:boolean)=>{
  const from=polyline?pts.at(-1):undefined;if(!shift||!polyline)return directionPoint(from,normalSnap(raw),false);
  // Shift holds the bearing; the first point still closes the outline and other points still set the length.
  return lockedSnap(directionPoint(from,raw,true),p=>drawingSnap(p,pts,[...pts,...snapPoints],closed,22/scale.current),p=>directionPoint(from,p,true)).point;
 };
 const finish=(path:ShapePath)=>{const problem=pathProblem(path);if(problem)throw Error(problem);const widthIn=mode==='path'?parseContractorLength(width):undefined;onFinish(mode==='path'?{path,widthIn,ends}:{path});};
 const place=(p:PlanPoint)=>{try{
  setNotice('');
  if(mode==='rectangle'||mode==='circle'){if(!pts.length){setPts([p]);return;}finish(mode==='rectangle'?rectanglePath(pts[0],p):circlePath(pts[0],dist(pts[0],p)));return;}
  if(!pts.length){setPts([p]);return;}
  const from=pts.at(-1)!;
  if(closed&&pts.length>=3&&dist(p,pts[0])<1e-6){finish({points:pts,edges:[...edges,pending(pts[0])],closed:true});return;}
  if(dist(from,p)<1)throw Error('Place the next point at least 1 inch away.');
  if(segment==='arc3'&&polyline&&!mid){setMid(p);setNotice('Arc middle set. Now click where the arc ends.');return;}
  if(pts.length>=(mode==='path'?32:64))throw Error(`Finish this shape before adding more than ${mode==='path'?32:64} points.`);
  const edge=pending(p);setPts([...pts,p]);setEdges([...edges,edge]);setMid(undefined);
 }catch(e){fail(e);}};
 const finishDraft=()=>{try{
  if(!polyline)throw Error('Click the second point to finish.');
  if(closed){if(pts.length<3)throw Error('Place at least three points, or click the first point to close the outline.');finish({points:pts,edges:[...edges,LINE],closed:true});}
  else{if(pts.length<2)throw Error('Place at least two points.');finish({points:pts,edges,closed:false});}
 }catch(e){fail(e);}};
 const undo=()=>{if(mid){setMid(undefined);return;}setPts(pts.slice(0,-1));setEdges(edges.slice(0,-1));setNotice('');};
 const placeTyped=(e?:FormEvent)=>{e?.preventDefault();try{const from=pts.at(-1);if(!from)throw Error('Place the first point on the plan, then type the next edge.');const L=parseContractorLength(typedLength),a=Number(typedAngle)*Math.PI/180;if(!Number.isFinite(a))throw Error('Enter the direction in degrees: 0 runs across, 90 runs out into the yard.');place({x:from.x+Math.cos(a)*L,y:from.y+Math.sin(a)*L});setTypedLength('');}catch(err){fail(err);}};
 useArchitectKeys({'ctrl+a':()=>setAngleSnap(v=>!v),'ctrl+g':()=>setGrid(v=>{if(v){previousGrid.current=v;return 0;}return previousGrid.current;}),g:()=>revealControl(panelRef.current?.querySelector('[aria-label="Snap grid"]')??null),enter:()=>revealControl(panelRef.current?.querySelector('[aria-label="Typed edge length"]')??null)});
 // While drawing, Ctrl+Z steps back through the draft (not the saved design); L, T and A pick the next edge; C closes.
 useDraftKeys({'ctrl+z':()=>{if(!pts.length&&!mid)return false;undo();},...(polyline?{l:()=>{setSegment('line');setMid(undefined);},t:()=>{setSegment('tangent');setMid(undefined);},a:()=>{setSegment('arc3');setMid(undefined);},c:()=>{if(!pts.length)return false;finishDraft();}}:{})});
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{const typing=['INPUT','SELECT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
   if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey)return;
   if(e.key==='Escape'){e.preventDefault();onCancel();return;}if(typing)return;
   if(e.key==='Backspace'){e.preventDefault();undo();}
  };
  window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);
 });
 const down=(e:PointerEvent<SVGSVGElement>)=>{if(e.button!==0)return;e.preventDefault();
  // Take focus from the panel's fields so Enter, Backspace and L/T/A act on the drawing again.
  e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);tap.current={id:e.pointerId,x:e.clientX,y:e.clientY};};
 const up=(e:PointerEvent<SVGSVGElement>)=>{const t=tap.current;tap.current=null;if(!t||t.id!==e.pointerId)return;try{if(Math.hypot(e.clientX-t.x,e.clientY-t.y)>8&&(!pts.length||dist(worldAt({clientX:t.x,clientY:t.y}),pts.at(-1)!)>22/scale.current))return;place(snap(worldAt(e),e.shiftKey));}catch(err){fail(err);}};
 const move=(e:PointerEvent<SVGSVGElement>)=>{try{setCursor(snap(worldAt(e),e.shiftKey));}catch{/* plan not ready */}};

 // Preview: the drawn edges, the pending edge to the cursor, and a walkway band or rectangle/circle outline.
 let preview:PlanPoint[]=[],readout='',band:PlanPoint[]|null=null;
 try{
  if(cursor&&pts.length){
   if(mode==='rectangle'){preview=samplePath(rectanglePath(pts[0],cursor));const w=Math.abs(cursor.x-pts[0].x),h=Math.abs(cursor.y-pts[0].y);readout=`${feetInches(w)} × ${feetInches(h)} · ${(w*h/144).toFixed(1)} sq ft`;}
   else if(mode==='circle'){const r=dist(pts[0],cursor);preview=samplePath(circlePath(pts[0],r));readout=`radius ${feetInches(r)} · ${(Math.PI*r*r/144).toFixed(1)} sq ft`;}
   else{const from=pts.at(-1)!,edge=segment==='arc3'&&mid&&dist(cursor,mid)<=1e-6?LINE:pending(cursor);preview=samplePath({points:[from,cursor],edges:[edge],closed:false},.5);const a=Math.atan2(cursor.y-from.y,cursor.x-from.x)*180/Math.PI;
    readout=edge.kind==='arc'?`arc ${feetInches(arcGeometry(from,cursor,edge.bulgeIn).lengthIn)} · radius ${feetInches(arcGeometry(from,cursor,edge.bulgeIn).radius)}`:`${feetInches(dist(from,cursor))} at ${((a+360)%360).toFixed(1)}°`;
    if(mode==='path'&&pts.length>=1){try{band=samplePath(pathOutline({points:[...pts,cursor],edges:[...edges,edge],closed:false},parseContractorLength(width),ends),.5);}catch{band=null;}}}
  }
 }catch(e){readout=(e as Error).message;}
 const drawn=pts.length>1?samplePath(draft,.5):pts;
 const total=pts.length>1?(closed&&pts.length>2?`${(Math.abs(pathArea({points:pts,edges:[...edges,LINE],closed:true}))/144).toFixed(1)} sq ft enclosed`:`${feetInches(pathLength(draft))} drawn`):'';
 const r=6/scale.current,closing=!!(closed&&pts.length>=3&&cursor&&dist(cursor,pts[0])<1e-6);
 const panel=<section ref={panelRef} className="dd-shape-draw-panel" aria-label={`Designer drawing: ${label}`} data-plan-editor-ui>
  <strong>{label}</strong><span className="dd-shape-draw-count">{pts.length} point{pts.length===1?'':'s'}{total?` · ${total}`:''}</span>
  {polyline&&<div className="dd-shape-draw-segments" role="group" aria-label="Next edge">{([['line','Line','L'],['tangent','Tangent arc','T'],['arc3','3-point arc','A']] as const).map(([id,name,k])=><button key={id} type="button" aria-pressed={segment===id} onClick={()=>{setSegment(id);setMid(undefined);}}>{name}</button>)}</div>}
  <details><summary>Exact length, angle & snapping</summary><div className="dd-shape-draw-snap"><label>Grid<select aria-label="Snap grid" value={grid} onChange={e=>setGrid(Number(e.target.value))}>{GRIDS.map(g=><option key={g} value={g}>{g?`${g} in`:'Off'}</option>)}</select></label><label><input type="checkbox" aria-label="Snap to 15° directions" checked={angleSnap} onChange={e=>setAngleSnap(e.target.checked)}/> 15° directions</label></div>
  {polyline&&<form className="dd-shape-draw-typed" onSubmit={placeTyped}><label>Length<input aria-label="Typed edge length" placeholder="12' 6&quot;" value={typedLength} onChange={e=>setTypedLength(e.target.value)}/></label><label>Direction °<input aria-label="Typed edge direction in degrees" inputMode="decimal" value={typedAngle} onChange={e=>setTypedAngle(e.target.value)}/></label><button type="submit" disabled={!pts.length||!typedLength.trim()}>Place</button></form>}
  </details>
  {mode==='path'&&<div className="dd-shape-draw-snap"><label>Walkway width<input aria-label="Walkway width" value={width} onChange={e=>setWidth(e.target.value)}/></label><label>Ends<select aria-label="Walkway ends" value={ends} onChange={e=>setEnds(e.target.value as 'square'|'round')}><option value="square">Square</option><option value="round">Round</option></select></label></div>}
  {readout&&<p className="dd-shape-draw-readout" role="status">{readout}</p>}
  <div className="dd-shape-draw-actions">{polyline&&<button type="button" onClick={finishDraft} disabled={pts.length<(closed?3:2)}>Finish</button>}<button type="button" onClick={undo} disabled={!pts.length&&!mid}>Undo point</button><button type="button" onClick={onCancel}>Cancel</button></div>
  <p className="dd-shape-draw-hint">{polyline?`Click to place points${closed?'; join the first point to close (tap it or drag from the last point)' :''}. Enter edits length and angle; right-click or C finishes. Backspace or Ctrl+Z undoes a point, Esc cancels. L, T and A pick line, tangent arc or 3-point arc. Hold Shift to keep the current line angle while changing its length.`:mode==='rectangle'?'Click one corner, then the opposite corner.':'Click the centre, then a point on the edge.'}</p>
  {notice&&<p className="dd-shape-draw-notice" role="alert">{notice}</p>}
 </section>;
 return <>
  <svg ref={svg} className="dd-shape-draw-surface" tabIndex={0} viewBox={frame.viewBox} aria-label={`${label} drawing surface`} data-plan-editor-ui onPointerDown={down} onPointerUp={up} onPointerMove={move} onPointerCancel={()=>{tap.current=null;}} onPointerLeave={()=>setCursor(null)} onDoubleClick={e=>{e.preventDefault();finishDraft();}} onContextMenu={e=>{e.preventDefault();finishDraft();}}>
   {band&&<polygon className="dd-shape-draw-band" points={points(band)}/>}
   {drawn.length>1&&<polyline className="dd-shape-draw-path" points={points(drawn)}/>}
   {preview.length>1&&<polyline className="dd-shape-draw-preview" points={points(preview)}/>}
   {pts.map((p,i)=><circle key={i} className="dd-shape-draw-point" data-first={i===0&&closed||undefined} cx={p.x} cy={p.y} r={i===0&&closed&&pts.length>2?r*1.6:r}/>)}
   {closed&&pts.length>=3&&<circle className="dd-drawing-join" data-closing={closing||undefined} cx={pts[0].x} cy={pts[0].y} r={22/scale.current}/>}
   {closing&&<text className="dd-shape-draw-label" x={pts[0].x+24/scale.current} y={pts[0].y+24/scale.current} fontSize={14/scale.current}>Join to close</text>}
   {mid&&<circle className="dd-shape-draw-mid" cx={mid.x} cy={mid.y} r={r}/>}
   {cursor&&<circle className="dd-shape-draw-cursor" cx={cursor.x} cy={cursor.y} r={r*.7}/>}
   {cursor&&readout&&<text className="dd-shape-draw-label" x={cursor.x+12/scale.current} y={cursor.y-12/scale.current} fontSize={13/scale.current}>{readout}</text>}
  </svg>
  {panelHost?createPortal(panel,panelHost):<div className="dd-shape-draw-floating">{panel}</div>}
 </>;
}
