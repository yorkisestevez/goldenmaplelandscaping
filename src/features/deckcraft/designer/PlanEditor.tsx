import {useLayoutEffect,useMemo,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import {planFrame} from '../ConstructionPlan';
import {trackDeck} from '../deckAnalytics';
import type {DeckTakeoff} from '../deckTakeoff';
import {getFootprint} from '../lib/deckGeometry';
import type {DeckData} from '../types';
import type {Update} from './fields';
import {DECK_SIZE_FT,beginGesture,clampFt,endGesture,fmtFt,gestureFigure,ghostShift,handlePatch,keyValue,moveGesture,planHandles,type Gesture,type PlanHandle,type PlanHandleId} from './planEditMath';
export {planShortcut} from './planEditMath';

type Dim='width'|'depth';

/**
 * Draw it on your house: gold handles over the site plan (ConstructionPlan variant="site"), in the plan's own frame
 * (planFrame), so they sit on the drawing at any size. Loaded once the page is running; the plan itself is already in
 * the prerendered page.
 * - Handles are sliders: drag one, or use the arrow keys (0.5 ft, Shift 1 ft) and Home/End. A drag shows a ghost outline
 *   with the new figures and changes the design once, when it ends: one estimate, one undo step.
 * - The width and depth figures are buttons that open a number box, clamped as the Deck section's fields are.
 * - Only the handles take the pointer away from the page (touch-action:none), so a phone still scrolls over the plan.
 */
export default function PlanEditor({data,model,update,onEdited}:{data:DeckData;model:DeckTakeoff;update:Update;onEdited?:()=>void}){
  const frame=useMemo(()=>planFrame(model,{data,variant:'site'}),[model,data]);
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
  const [typing,setTyping]=useState<Dim|null>(null),[draft,setDraft]=useState(''),cancelled=useRef(false);
  const dimButtons=useRef<Partial<Record<Dim,HTMLButtonElement|null>>>({});
  const outline=model.levels[0].footprint.outline;
  // While a handle is dragged, the deck is drawn as it will be (a ghost), where it will sit; the design is untouched.
  const ghost=useMemo(()=>{
    if(!live||live.value===live.start)return null;
    const next={...data,...handlePatch(data,live.id,live.value)},shift=ghostShift(data,live.id,live.value,live.start);
    return {data:next,shift,outline:getFootprint(next,1).outline.map(p=>({x:p.x+shift,y:p.y})),figure:gestureFigure(data,live.id,live.value)};
  },[live,data]);
  const handles=useMemo(()=>{
    const idle=planHandles(data,outline),shown=ghost?planHandles(ghost.data,ghost.outline):idle;
    // The handle being dragged always stays under the pointer's capture, even if the ghost would not have it.
    const all=live&&!shown.some(h=>h.id===live.id)?[...shown,...idle.filter(h=>h.id===live.id)]:shown;
    return all.map(h=>h.id===live?.id?{...h,value:live.value}:h);
  },[ghost,data,outline,live]);
  const commit=(id:PlanHandleId,value:number)=>{update(handlePatch(data,id,value));onEdited?.();trackDeck('deckcraft_plan','deck_plan_drag');};
  const cancel=()=>{gesture.current=null;setLive(null);};
  const onPointerDown=(h:PlanHandle)=>(e:PointerEvent<HTMLDivElement>)=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture?.(e.pointerId);
    const g=beginGesture(h,e.pointerId,e.clientX,e.clientY);gesture.current=g;setLive(g);
  };
  const onPointerMove=(e:PointerEvent)=>{
    const g=gesture.current;if(!g||e.pointerId!==g.pointerId||!scale)return;
    const next=moveGesture(g,(e.clientX-g.x)/scale,(e.clientY-g.y)/scale);
    if(next!==g){gesture.current=next;setLive(next);}
  };
  const onPointerUp=(e:PointerEvent)=>{
    const g=gesture.current;if(!g||e.pointerId!==g.pointerId)return;
    cancel();const value=endGesture(g);if(value!==null)commit(g.id,value);
  };
  const onKeyDown=(h:PlanHandle)=>(e:KeyboardEvent)=>{
    if(e.key==='Escape'&&gesture.current){e.preventDefault();cancel();return;}
    const value=keyValue(e.key,e.shiftKey,h.value,h.min,h.max);if(value===null)return;
    e.preventDefault();if(value!==h.value&&!gesture.current)commit(h.id,value);
  };
  // The width and depth figures: a custom outline sets both, and a two-sided wrap-around sets the width.
  const has=(id:PlanHandleId)=>handles.some(h=>h.id===id);
  const dims:{id:Dim;inches:number;x:number;y:number;label:string}[]=frame.dims&&data.shape!=='Custom'?[
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
  return <div className="dd-plan-editor" ref={box}>
    <svg viewBox={frame.viewBox} aria-hidden="true" focusable="false">
      {ghost&&<polygon className="dd-plan-ghost" points={ghost.outline.map(p=>`${p.x},${p.y}`).join(' ')}/>}
    </svg>
    {/* The drag's live figures (the slider's value text says the same to a screen reader). */}
    {ghost&&<p className="dd-plan-readout" aria-hidden="true">{ghost.figure}</p>}
    {size&&handles.map(h=><div key={h.id} role="slider" tabIndex={0} className="dd-plan-handle" data-handle={h.id} data-active={live?.id===h.id||undefined} aria-label={h.label} aria-orientation={h.orientation} aria-valuemin={h.min} aria-valuemax={h.max} aria-valuenow={h.value} aria-valuetext={live?.id===h.id&&ghost?ghost.figure:h.text} style={px(h.x,h.y)} onPointerDown={onPointerDown(h)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={cancel} onLostPointerCapture={e=>{if(gesture.current?.pointerId===e.pointerId)cancel();}} onKeyDown={onKeyDown(h)}/>)}
    {size&&!live&&dims.map(d=>{const at=px(d.x,d.y);
      return typing===d.id?<form key={d.id} className="dd-plan-type" noValidate style={{left:Math.min(Math.max(at.left,74),size.w-74),top:Math.min(Math.max(at.top,30),size.h-30)}} onSubmit={e=>{e.preventDefault();close(d.id,true);}}>
        <label><span className="dd-sr">{`Type the ${d.label.toLowerCase()} in feet`}</span><input type="number" inputMode="decimal" min={DECK_SIZE_FT[0]} max={DECK_SIZE_FT[1]} step={0.5} value={draft} autoFocus onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();close(d.id,false);}}} onBlur={()=>{if(!cancelled.current)close(d.id,true,false);}}/></label>
        <span aria-hidden="true">ft</span>
      </form>:<button key={d.id} ref={el=>{dimButtons.current[d.id]=el;}} type="button" className="dd-plan-dim" data-dim={d.id} style={at} aria-label={`${d.label} ${fmtFt(d.inches/12)} ft: type a new ${d.id}`} onClick={()=>open(d.id)}/>;})}
  </div>;
}
