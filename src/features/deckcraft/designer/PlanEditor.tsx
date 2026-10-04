import {useEffect,useLayoutEffect,useMemo,useRef,useState,type KeyboardEvent,type PointerEvent,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {planFrame,type PlanFrame} from '../ConstructionPlan';
import {trackDeck} from '../deckAnalytics';
import type {DeckTakeoff} from '../deckTakeoff';
import type {YardModel} from '../yardModel';
import {customOutline,customShapeWords} from '../lib/customOutline';
import {getFootprint} from '../lib/deckGeometry';
import {OUTLINE_PRESETS} from '../lib/outlineEdits';
import type {DeckData} from '../types';
import type {PlanTool} from './constants';
import {chooseShape} from './deckShapeActions';
import type {Update} from './fields';
import {beginEdgeDrag,diagonal,edgeShift,edgeSliders,endEdgeDrag,moveEdgeDrag,presetFront,REFUSED,sliderKey,type EdgeDrag} from './outlineEditMath';
import {DECK_SIZE_FT,beginGesture,clampFt,endGesture,fmtFt,gestureFigure,ghostShift,handlePatch,houseHandles,keyValue,moveGesture,planGhost,planHandles,primaryStair,shapeHandles,stairFigure,stairGhost,stairHandle,stairTargets,type Gesture,type PlanHandle,type PlanHandleId,type StairTarget} from './planEditMath';
import type {StairEdge} from './steps/DimensionsStep';
import {useOutlineEdit} from './useOutlineEdit';
import {stairDragPlacement} from './stairDragPlacement';
import StairShapeEditor from './StairShapeEditor';
export {planShortcut} from './planEditMath';

type Dim='width'|'depth';
/** R4's handles: their ghost is the deck redrawn, and the other handles follow it. */
const SIZE_IDS=new Set<PlanHandleId>(['depth','width-right','width-left','slide','cutout-width','cutout-depth','cutout2-width','cutout2-depth']);
const ARROWS=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'];

/**
 * Draw it on your house: gold handles over the site plan (ConstructionPlan variant="site"), in the plan's own frame
 * (planFrame), so they sit on the drawing at any size. Loaded once the page is running; the plan itself is already in
 * the prerendered page. One tool at a time (the plan's tool strip):
 * - Size & place: the deck's depth, ends, slide along the wall and cut-outs (R4), and the second level's depth, the
 *   wrap-around wings' widths and the angled corners' cuts; the width and depth figures are buttons that open a number box.
 * - Draw outline: every edge of a custom outline is a handle (useOutlineEdit, as the Deck section's outline editor), with
 *   the starting shapes under the drawing.
 * - Stairs: the edges the page allows (its stairEdges, and houseContact's open sides) are marked; one tap puts the stairs
 *   there, and their handle slides them along it.
 * - House: the house's wall ends set its width.
 * Handles are sliders: drag one, or use the arrow keys (0.5 ft, Shift 1 ft; a stair 1 %, Shift 10 %) and Home/End. A drag
 * shows a ghost with the new figures and changes the design once, when it ends: one estimate, one undo step. Only the
 * handles take the pointer away from the page (touch-action:none), so a phone still scrolls over the plan.
 */
export default function PlanEditor({data,model,yard,update,onEdited,tool='size',stairEdges=[],onStatus,toolbar,onOpenSection,viewportFrame}:{
  viewportFrame?:PlanFrame;data:DeckData;model:DeckTakeoff;yard?:YardModel;update:Update;onEdited?:()=>void;tool?:PlanTool;
  /** The edges the page offers stairs on (the Stairs section's edge menu). */
  stairEdges?:StairEdge[];
  /** The plan's status line (what a tool did, or why it could not). */
  onStatus?:(text:string)=>void;
  /** Where the tool's own buttons go, under the drawing. */
  toolbar?:RefObject<HTMLElement|null>;onOpenSection?:(id:'deck'|'stairs'|'house')=>void;
}){
  const frame=useMemo(()=>viewportFrame??planFrame(model,{data,yard,variant:'site',wholeHouse:tool==='house'}),[model,data,yard,tool,viewportFrame]);
  const box=useRef<HTMLDivElement>(null),[size,setSize]=useState<{w:number;h:number}|null>(null);
  useLayoutEffect(()=>{
    const el=box.current;if(!el)return;
    const measure=()=>setSize(s=>s&&s.w===el.clientWidth&&s.h===el.clientHeight?s:{w:el.clientWidth,h:el.clientHeight});
    measure();
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;observer?.observe(el);
    return ()=>observer?.disconnect();
  },[]);
  // Plan inches to pixels in this box, as the plan's own SVG fits its viewBox (centred, whole drawing shown).
  const scale=size?Math.min(size.w/frame.w,size.h/frame.h):0,ox=size?(size.w-frame.w*scale)/2:0,oy=size?(size.h-frame.h*scale)/2:0;
  const px=(x:number,y:number)=>({left:ox+(x-frame.x)*scale,top:oy+(y-frame.y)*scale});
  const gesture=useRef<Gesture|null>(null),[live,setLive]=useState<Gesture|null>(null);
  const edgeDrag=useRef<EdgeDrag|null>(null),[liveEdge,setLiveEdge]=useState<EdgeDrag|null>(null);
  const stairDrag=useRef<{pointer:number;matrix:DOMMatrix;grab:{x:number;y:number};x:number;y:number;moved:boolean;proposal:ReturnType<typeof stairDragPlacement>}|null>(null);
  const [stairPreview,setStairPreview]=useState<ReturnType<typeof stairDragPlacement>>(null);
  const [typing,setTyping]=useState<Dim|null>(null),[draft,setDraft]=useState(''),cancelled=useRef(false);
  const [focused,setFocused]=useState('');
  const dimButtons=useRef<Partial<Record<Dim,HTMLButtonElement|null>>>({});
  const handleEls=useRef<Record<string,HTMLDivElement|null>>({}),focusNext=useRef<string|null>(null);
  useLayoutEffect(()=>{const id=focusNext.current,el=id?handleEls.current[id]:null;if(el){el.focus();focusNext.current=null;}});
  const main=model.levels[0],outline=main.footprint.outline,mx=main.offset.x,mz=main.offset.z;
  // Draw outline: the same edits as the Deck section's outline editor.
  const outlineEdit=useOutlineEdit(data,update,()=>{onEdited?.();trackDeck('deckcraft_plan','deck_plan_outline');});
  const front=outlineEdit.front,sliders=useMemo(()=>tool==='outline'&&front?edgeSliders(front):[],[tool,front]);
  // Stairs: where they are now, and the edges the page allows.
  const stair=useMemo(()=>tool==='stairs'?primaryStair(data,model,stairEdges):null,[tool,data,model,stairEdges]);
  const targets=useMemo(()=>tool==='stairs'?stairTargets(data,model,stairEdges):[],[tool,data,model,stairEdges]);
  const idle=useMemo(()=>tool==='size'?[...planHandles(data,outline),...shapeHandles(data,model)]:tool==='house'?houseHandles(data,frame.band):tool==='stairs'?[stairHandle(data,stair)].filter((h):h is PlanHandle=>!!h):[],[tool,data,outline,model,frame.band,stair]);
  // While a handle is dragged, what it changes is drawn as it will be (a ghost), where it will sit; the design is untouched.
  const ghost=useMemo(()=>{
    if(!live||live.value===live.start)return null;
    if(SIZE_IDS.has(live.id)){
      const next={...data,...handlePatch(data,live.id,live.value)},shift=ghostShift(data,live.id,live.value,live.start),deck=getFootprint(next,1).outline.map(p=>({x:p.x+shift,y:p.y}));
      return {data:next,outline:deck,polygons:[deck],figure:gestureFigure(data,live.id,live.value)};
    }
    if(live.id==='stair')return stair?{polygons:[stairGhost(stair,live.value)],figure:stairFigure(stair,live.value)}:null;
    return {polygons:planGhost(data,model,live.id,live.value,frame.band),figure:gestureFigure(data,live.id,live.value)};
  },[live,data,model,stair,frame.band]);
  const handles=useMemo(()=>{
    if(stairPreview)return idle.map(h=>h.id==='stair'?{...h,x:stairPreview.centre.x,y:stairPreview.centre.y}:h);
    if(!live)return idle;
    const dragged=idle.find(h=>h.id===live.id);
    if(SIZE_IDS.has(live.id)){
      const shown=ghost&&'data' in ghost&&ghost.data?planHandles(ghost.data,ghost.outline):idle;
      // The handle being dragged always stays under the pointer's capture, even if the ghost would not have it.
      const all=!shown.some(h=>h.id===live.id)&&dragged?[...shown,dragged]:shown;
      return all.map(h=>h.id===live.id?{...h,value:live.value}:h);
    }
    // One of R5's handles follows the pointer along its line; the others wait for the drag to end.
    return dragged?[{...dragged,value:live.value,x:dragged.x+(dragged.move?.x??0)*(live.value-live.start),y:dragged.y+(dragged.move?.y??0)*(live.value-live.start)}]:[];
  },[idle,live,ghost,stairPreview]);
  const commit=(id:PlanHandleId,value:number)=>{
    update(handlePatch(data,id,value));onEdited?.();
    if(id==='stair')trackDeck('deckcraft_plan','deck_plan_stairs');else if(id==='house-left'||id==='house-right')trackDeck('deckcraft_plan','deck_plan_house');else trackDeck('deckcraft_plan','deck_plan_drag');
  };
  const cancel=()=>{gesture.current=null;setLive(null);edgeDrag.current=null;setLiveEdge(null);stairDrag.current=null;setStairPreview(null);};
  useEffect(()=>{cancel();},[data,tool]);
  useEffect(()=>{const stop=()=>cancel(),hidden=()=>{if(document.hidden)cancel();};window.addEventListener('blur',stop);document.addEventListener('visibilitychange',hidden);return()=>{window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',hidden);};},[]);
  const onStairDown=(e:PointerEvent)=>{
    if(e.button!==0||!stair||stairDrag.current)return;
    const matrix=box.current?.querySelector('svg')?.getScreenCTM()?.inverse();if(!matrix)return;
    const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix);
    e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLElement).focus?.({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);
    stairDrag.current={pointer:e.pointerId,matrix,grab:{x:p.x-stair.centre.x,y:p.y-stair.centre.y},x:e.clientX,y:e.clientY,moved:false,proposal:null};
  };
  const onPointerDown=(h:PlanHandle)=>(e:PointerEvent<HTMLDivElement>)=>{
    if(h.id==='stair'){onStairDown(e);return;}
    if(e.pointerType==='mouse'&&e.button!==0)return;
    e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture?.(e.pointerId);
    const g=beginGesture(h,e.pointerId,e.clientX,e.clientY);gesture.current=g;setLive(g);
  };
  const onEdgeDown=(i:number)=>(e:PointerEvent<HTMLDivElement>)=>{
    if((e.pointerType==='mouse'&&e.button!==0)||!front)return;
    e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture?.(e.pointerId);
    const g=beginEdgeDrag(front,i,e.pointerId,e.clientX,e.clientY);edgeDrag.current=g;setLiveEdge(g);
  };
  // A pointer move only moves the ghost (a value, or an outline edge on its 6 in grid).
  const onPointerMove=(e:PointerEvent)=>{
    const sd=stairDrag.current;
    if(sd&&sd.pointer===e.pointerId){
      if(!sd.moved&&Math.hypot(e.clientX-sd.x,e.clientY-sd.y)<3)return;
      const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(sd.matrix);
      sd.moved=true;sd.proposal=stairDragPlacement(data,model,targets,{x:p.x-sd.grab.x,y:p.y-sd.grab.y},stair?.depth??24);setStairPreview(sd.proposal);return;
    }
    const matrix=box.current?.querySelector('svg')?.getScreenCTM(),dragScale=matrix?Math.hypot(matrix.a,matrix.b):scale;
    const g=gesture.current,d=edgeDrag.current;if(!dragScale)return;
    if(d&&e.pointerId===d.pointerId){const next=moveEdgeDrag(d,(e.clientX-d.x)/dragScale/12,(e.clientY-d.y)/dragScale/12);if(next!==d){edgeDrag.current=next;setLiveEdge(next);}return;}
    if(!g||e.pointerId!==g.pointerId)return;
    const next=moveGesture(g,(e.clientX-g.x)/dragScale,(e.clientY-g.y)/dragScale);
    if(next!==g){gesture.current=next;setLive(next);}
  };
  // The end of a drag changes the design once: the last outline that fitted under the pointer, or the handle's value.
  const onPointerUp=(e:PointerEvent)=>{
    const sd=stairDrag.current;if(sd&&sd.pointer===e.pointerId){onPointerMove(e);const proposal=sd.proposal;cancel();if(sd.moved&&proposal){const changed=Object.entries(proposal.patch).some(([k,v])=>data[k as keyof DeckData]!==v);if(changed){update(proposal.patch);onEdited?.();trackDeck('deckcraft_plan','deck_plan_stairs');onStatus?.('Stairs placed on the '+proposal.name+'.');}}return;}
    const d=edgeDrag.current;
    if(d&&e.pointerId===d.pointerId){cancel();const next=endEdgeDrag(d);if(next)outlineEdit.apply(next);if(d.refused)onStatus?.(REFUSED);return;}
    const g=gesture.current;if(!g||e.pointerId!==g.pointerId)return;
    cancel();const value=endGesture(g);if(value!==null)commit(g.id,value);
  };
  const onLost=(e:PointerEvent)=>{if(stairDrag.current?.pointer===e.pointerId||gesture.current?.pointerId===e.pointerId||edgeDrag.current?.pointerId===e.pointerId)cancel();};
  const onKeyDown=(h:PlanHandle)=>(e:KeyboardEvent)=>{
    if(e.key==='Escape'&&gesture.current){e.preventDefault();cancel();return;}
    const value=keyValue(e.key,e.shiftKey,h.value,h.min,h.max,h.step,h.bigStep);if(value===null)return;
    e.preventDefault();if(value!==h.value&&!gesture.current)commit(h.id,value);
  };
  const onEdgeKey=(i:number)=>(e:KeyboardEvent)=>{
    if(e.key==='Escape'&&edgeDrag.current){e.preventDefault();cancel();return;}
    if(!ARROWS.includes(e.key)||!front)return;
    e.preventDefault();if(edgeDrag.current)return;
    const edit=sliderKey(front,i,e.key,e.shiftKey);if(!edit)return;
    if('front' in edit)outlineEdit.apply(edit.front);else onStatus?.(REFUSED);
  };
  // Stairs: a tap puts them on the edge (the Stairs section's own choice), and the keyboard goes on to their handle.
  const place=(t:StairTarget)=>{
    update(t.patch);onEdited?.();trackDeck('deckcraft_plan','deck_plan_stairs');onStatus?.(`Stairs on the ${t.name}.`);
    focusNext.current='stair';setTimeout(()=>{focusNext.current=null;},600);
  };
  const stairShown=handles.some(h=>h.id==='stair'),current=stair?targets.find(t=>t.level===stair.level&&t.edge===stair.edge)?.key:undefined;
  // The width and depth figures: a custom outline sets both, and a two-sided wrap-around sets the width.
  const has=(id:PlanHandleId)=>handles.some(h=>h.id===id);
  const dims:{id:Dim;inches:number;x:number;y:number;label:string}[]=tool==='size'&&frame.dims&&data.shape!=='Custom'?[
    ...(has('width-right')||has('width-left')?[{id:'width' as const,...frame.dims.width,label:'Deck width'}]:[]),
    {id:'depth' as const,...frame.dims.depth,label:'Deck depth'},
  ]:[];
  const open=(id:Dim)=>{cancelled.current=false;setDraft(fmtFt(id==='width'?Number(data.width):Number(data.length)));setTyping(id);};
  // Enter applies the figure and Escape leaves it, both returning to the figure's button; leaving the box elsewhere
  // applies it and lets the focus go where it went.
  const close=(id:Dim,apply:boolean,refocus=true)=>{
    // The box goes away at once; a blur it fires on the way out must not apply it a second time.
    cancelled.current=true;
    setTyping(null);if(refocus)requestAnimationFrame(()=>dimButtons.current[id]?.focus());
    const n=Number(draft),current=id==='width'?Number(data.width):Number(data.length);
    if(!apply||draft.trim()===''||!Number.isFinite(n))return;
    const value=clampFt(n,...DECK_SIZE_FT);
    if(value!==current){update(handlePatch(data,id==='width'?'width-right':'depth',value));onEdited?.();trackDeck('deckcraft_plan','deck_plan_typed');}
  };
  const edgeGhost=liveEdge?.ghost?customOutline(liveEdge.ghost).outline.map(p=>({x:p.x+mx,y:p.y+mz})):null;
  const polygons=[...(stairPreview?[stairPreview.polygon]:[]),...(ghost?.polygons??[]),...(edgeGhost?[edgeGhost]:[])];
  const readout=stairPreview?'Release to place stairs on the '+stairPreview.name:ghost?.figure??(liveEdge?.refused?'The outline rules stop it here':liveEdge?.ghost?customShapeWords(liveEdge.ghost):null);
  const ftAt=(x:number,y:number)=>px(mx+x*12,mz+y*12);
  const link=(id:'deck'|'stairs'|'house',text:string)=>onOpenSection&&<button type="button" className="dd-linklike" onClick={()=>onOpenSection(id)}>{text}</button>;
  // The tool's own buttons under the drawing: the outline's starting shapes, and a way into the section with the rest.
  const extras=tool==='outline'?<>
    <div className="dd-outline-presets" role="group" aria-label="Outline shapes">{OUTLINE_PRESETS.map(p=><button key={p.id} type="button" className="dd-secondary" disabled={!presetFront(data,p.id)} onClick={()=>{if(outlineEdit.preset(p.id))onStatus?.(`Starting shape: ${p.name}. Drag an edge to change it.`);else onStatus?.(REFUSED);}}>{p.name}</button>)}</div>
    {!front&&<button type="button" className="dd-primary" onClick={()=>{update(chooseShape(data,'Custom'));onEdited?.();trackDeck('deckcraft_plan','deck_plan_outline');onStatus?.('Now your own outline, traced from the deck: drag its edges.');}}>Start from this deck</button>}
    {link('deck','Steps, 45° corners and every edge as a button: open Deck shape & size')}
  </>:tool==='stairs'?<>
    {!targets.length&&<p className="dd-note">{data.stairPath?'Edit stair path section widths, riser count and tread depth in Stairs & railings settings. Clear the path there to return to individual stair placement.':'This deck has no open edge for stairs.'}</p>}
    {stair&&<p className="dd-note">Drag the stairs or their handle to any highlighted deck edge. Release to place; Undo restores the previous position. Escape cancels.</p>}
    {link('stairs','Flights, width and layout: open Stairs & railings')}
  </>:tool==='house'?link('house','Doors, windows, roof and blocks: open House'):null;
  return <div className="dd-plan-editor" ref={box} data-tool={tool} onKeyDownCapture={e=>{if(e.key==='Escape'&&stairDrag.current){e.preventDefault();e.stopPropagation();cancel();onStatus?.('Stair move cancelled.');}}}>
    <svg viewBox={frame.viewBox} aria-hidden="true" focusable="false">
      {tool==='outline'&&!liveEdge&&<g className="dd-outline-plan">{sliders.map(s=><line key={s.index} className="dd-outline-edge" data-on={focused===`edge-${s.index}`||undefined} x1={mx+s.a.x*12} y1={mz+s.a.y*12} x2={mx+s.b.x*12} y2={mz+s.b.y*12}/>)}</g>}
      {tool==='stairs'&&<g className="dd-stair-targets">{targets.map(t=><line key={t.key} data-on={t.key===current||undefined} x1={t.a.x} y1={t.a.y} x2={t.b.x} y2={t.b.y}/>)}</g>}
      {tool==='stairs'&&stair&&<polygon data-stair-drag="true" points={stairGhost(stair,stair.offset).map(p=>p.x+','+p.y).join(' ')} style={{fill:'transparent',pointerEvents:'all',cursor:'grab',touchAction:'none'}} tabIndex={0} onPointerDown={onStairDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={cancel} onLostPointerCapture={onLost}/>}
      {polygons.map((p,i)=><polygon key={i} className="dd-plan-ghost" points={p.map(q=>`${q.x},${q.y}`).join(' ')}/>)}
    </svg>
    {tool==='stairs'&&<StairShapeEditor data={data} model={model} frame={frame} update={update} toolbar={toolbar}/>}
    {/* The drag's live figures (the slider's value text says the same to a screen reader). */}
    {readout&&<p className="dd-plan-readout" aria-hidden="true">{readout}</p>}
    {size&&handles.map(h=><div key={h.id} ref={el=>{handleEls.current[h.id]=el;}} role="slider" tabIndex={0} className="dd-plan-handle" data-handle={h.id} data-active={live?.id===h.id||undefined} aria-label={h.label} aria-orientation={h.orientation} aria-valuemin={h.min} aria-valuemax={h.max} aria-valuenow={h.value} aria-valuetext={live?.id===h.id&&ghost?ghost.figure:h.text} style={px(h.x,h.y)} onPointerDown={onPointerDown(h)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={cancel} onLostPointerCapture={onLost} onKeyDown={onKeyDown(h)}/>)}
    {size&&sliders.map(s=>{const id=`edge-${s.index}`,dragging=liveEdge?.edge===s.index;if(liveEdge&&!dragging)return null;
      const shift=dragging?edgeShift(s,liveEdge.applied):{x:0,y:0},m=ftAt((s.a.x+s.b.x)/2+shift.x,(s.a.y+s.b.y)/2+shift.y);
      return <div key={id} role="slider" tabIndex={0} className="dd-plan-handle" data-handle="edge" data-kind={s.kind==='angled'?`angled-${diagonal(s.a,s.b)}`:s.kind} data-active={dragging||undefined} aria-label={s.label} aria-orientation={s.orientation} aria-valuemin={s.min} aria-valuemax={s.max} aria-valuenow={s.value} aria-valuetext={s.text} style={m} onPointerDown={onEdgeDown(s.index)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={cancel} onLostPointerCapture={onLost} onKeyDown={onEdgeKey(s.index)} onFocus={()=>setFocused(id)} onBlur={()=>setFocused('')}/>;})}
    {size&&!live&&targets.filter(t=>!(t.key===current&&stairShown)).map(t=><button key={t.key} type="button" className="dd-plan-target" aria-pressed={t.key===current} aria-label={`Put the stairs on the ${t.name}`} style={px((t.a.x+t.b.x)/2,(t.a.y+t.b.y)/2)} onClick={()=>place(t)}/>)}
    {size&&!live&&dims.map(d=>{const at=px(d.x,d.y);
      return typing===d.id?<form key={d.id} className="dd-plan-type" noValidate style={{left:Math.min(Math.max(at.left,74),size.w-74),top:Math.min(Math.max(at.top,30),size.h-30)}} onSubmit={e=>{e.preventDefault();close(d.id,true);}}>
        <label><span className="dd-sr">{`Type the ${d.label.toLowerCase()} in feet`}</span><input type="number" inputMode="decimal" min={DECK_SIZE_FT[0]} max={DECK_SIZE_FT[1]} step={0.5} value={draft} autoFocus onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();close(d.id,false);}}} onBlur={()=>{if(!cancelled.current)close(d.id,true,false);}}/></label>
        <span aria-hidden="true">ft</span>
      </form>:<button key={d.id} ref={el=>{dimButtons.current[d.id]=el;}} type="button" className="dd-plan-dim" data-dim={d.id} style={at} aria-label={`${d.label} ${fmtFt(d.inches/12)} ft: type a new ${d.id}`} onClick={()=>open(d.id)}/>;})}
    {toolbar?.current&&extras&&createPortal(extras,toolbar.current)}
  </div>;
}
