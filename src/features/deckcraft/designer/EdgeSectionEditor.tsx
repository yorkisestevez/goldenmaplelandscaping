import {useEffect,useLayoutEffect,useMemo,useRef,useState,type PointerEvent,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import type {DeckData} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import type {PlanFrame} from '../ConstructionPlan';
import {extrasLayout} from '../extrasLayout';
import {screenOn,screenProduct} from '../privacyScreens';
import {applyEdgeSectionEdit,listEdgeSections,type EdgeSectionEdit,type EdgeSectionEdge} from './edgeSectionActions';
import type {Update} from './fields';
import './edgeSectionEditor.css';

const rounded=(n:number)=>Math.round(n*10000)/10000;
const textFt=(n:number)=>String(rounded(n/12));
const interval=(edge:EdgeSectionEdge,start:number,end:number)=>({a:{x:edge.a.x+(edge.b.x-edge.a.x)*start/100,y:edge.a.y+(edge.b.y-edge.a.y)*start/100},b:{x:edge.a.x+(edge.b.x-edge.a.x)*end/100,y:edge.a.y+(edge.b.y-edge.a.y)*end/100}});
type ControlTap={id:number;x:number;y:number;button:HTMLButtonElement};
type Tap={id:number;edge:string;x:number;y:number;start:number;end:number;drag:boolean;wholeEnd:string};

/** One physical edge and measured range; edits share the same geometry and validator as agents. */
export default function EdgeSectionEditor({data,model,update,toolbar,viewportFrame,viewZoom=1,onOpenSettings}:{data:DeckData;model:DeckTakeoff;update:Update;toolbar?:RefObject<HTMLElement|null>;viewportFrame:PlanFrame;viewZoom?:number;onOpenSettings?:()=>void}){
 const edges=useMemo(()=>listEdgeSections(data,model),[data,model]);
 const levels=useMemo(()=>[...new Set(edges.map(e=>e.level))],[edges]);
 const [level,setLevel]=useState<1|2|3>(1),[edgeId,setEdgeId]=useState(''),[from,setFrom]=useState('0'),[to,setTo]=useState(''),[height,setHeight]=useState<4|5|6>(6);
 const [screenId,setScreenId]=useState(''),[notice,setNotice]=useState(''),[invalid,setInvalid]=useState(false);
 const svg=useRef<SVGSVGElement>(null),box=useRef<HTMLDivElement>(null),gesture=useRef<Tap|null>(null),pointers=useRef(new Set<number>()),prior=useRef(data),ownChange=useRef(false),controlTap=useRef<ControlTap|null>(null),consumedButtons=useRef(new WeakSet<HTMLButtonElement>());
 const [size,setSize]=useState({width:0,height:0});
 useLayoutEffect(()=>{const element=box.current;if(!element)return;const measure=()=>setSize(old=>old.width===element.clientWidth&&old.height===element.clientHeight?old:{width:element.clientWidth,height:element.clientHeight});measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();},[]);
 const physicalScale=Math.max(.01,Math.min(size.width/viewportFrame.w,size.height/viewportFrame.h)*viewZoom);
 const available=edges.filter(e=>e.level===level&&e.eligible.length>0),edge=available.find(e=>e.id===edgeId);
 const screens=(data.privacyScreens??[]).filter(s=>(s.level??1)===level),handles=useMemo(()=>extrasLayout(data,model).screenHandles,[data,model]);
 const announce=(message:string,error=false)=>{setNotice(message);setInvalid(error);};
 const choose=(chosen:EdgeSectionEdge)=>{gesture.current=null;setEdgeId(chosen.id);setScreenId('');setLevel(chosen.level);setFrom('0');setTo(textFt(chosen.lengthIn));announce(`${chosen.label} selected. Choose all of it or enter a shorter section.`);};
 useEffect(()=>{
  if(prior.current===data)return;prior.current=data;gesture.current=null;controlTap.current=null;pointers.current.clear();
  if(edgeId&&!edges.some(e=>e.id===edgeId)){setEdgeId('');setTo('');announce('That edge changed. Select its current position on the drawing.',true);}
  else if(!ownChange.current&&edgeId){setFrom('0');setTo(edge?textFt(edge.lengthIn):'');announce('The design changed. The section draft was reset to the current edge.');}
  if(screenId&&!data.privacyScreens?.some(s=>s.id===screenId))setScreenId('');
  ownChange.current=false;
 },[data,edges,edgeId,screenId,edge]);
 useEffect(()=>{if(levels.length&&!levels.includes(level)){setLevel(levels[0]);setEdgeId('');setScreenId('');}},[levels,level]);
 useEffect(()=>{
  const down=(event:globalThis.PointerEvent)=>{if(!pointers.current.size||event.pointerType==='mouse')consumedButtons.current=new WeakSet();pointers.current.add(event.pointerId);if(pointers.current.size>1)controlTap.current=null;if(pointers.current.size>1&&gesture.current){setFrom('0');setTo(gesture.current.wholeEnd);gesture.current=null;announce('Section gesture cancelled by a second pointer. Nothing changed.');}};
  const up=(event:globalThis.PointerEvent)=>{pointers.current.delete(event.pointerId);};
  const cancel=()=>{gesture.current=null;controlTap.current=null;pointers.current.clear();};
  document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);window.addEventListener('blur',cancel);
  return()=>{document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);window.removeEventListener('blur',cancel);};
 },[]);
 const commit=(edit:EdgeSectionEdit)=>{
  const result=applyEdgeSectionEdit(data,model,edit);
  if('error'in result){announce(result.error,true);return false;}
  try{ownChange.current=true;update(result.patch);if(result.selectedScreenId)setScreenId(result.selectedScreenId);announce(result.message);return true;}
  catch(error){ownChange.current=false;announce(error instanceof Error?error.message:'This change could not be applied.',true);return false;}
 };
 const range=()=>{
  if(!edge)throw new Error('Select an exposed deck edge first.');
  if(!from.trim()||!to.trim()||!Number.isFinite(Number(from))||!Number.isFinite(Number(to)))throw new Error('Enter measured start and end distances.');
  const a=Number(from)*12,b=Number(to)*12;
  if(a<0||b<=a||b>edge.lengthIn+.001)throw new Error(`Keep the section between 0 and ${textFt(edge.lengthIn)} ft, with its end after its start.`);
  return {level:edge.level,edgeId:edge.edgeId,startPct:a/edge.lengthIn*100,endPct:Math.min(100,b/edge.lengthIn*100)};
 };
 const changeRail=(enabled:boolean)=>{try{commit({action:'rail',...range(),enabled});}catch(error){announce((error as Error).message,true);}};
 const addScreen=()=>{try{commit({action:'screen-add',...range(),heightFt:height});}catch(error){announce((error as Error).message,true);}};
 const removeScreen=()=>{if(screenId&&commit({action:'screen-remove',id:screenId}))setScreenId('');};
 const local=(event:PointerEvent)=>{const matrix=svg.current?.getScreenCTM();if(!matrix)return null;return new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());};
 const pct=(chosen:EdgeSectionEdge,p:DOMPoint)=>Math.max(0,Math.min(100,((p.x-chosen.a.x)*(chosen.b.x-chosen.a.x)+(p.y-chosen.a.y)*(chosen.b.y-chosen.a.y))/chosen.lengthIn**2*100));
 const nearest=(p:DOMPoint)=>available.reduce<{edge:EdgeSectionEdge;distance:number}|null>((best,chosen)=>{const at=interval(chosen,pct(chosen,p),pct(chosen,p)).a,distance=Math.hypot(at.x-p.x,at.y-p.y);return !best||distance<best.distance?{edge:chosen,distance}:best;},null)?.edge;
 const down=(event:PointerEvent<SVGLineElement>)=>{
  if(!event.isPrimary||event.button!==0||pointers.current.size>1)return;
  const p=local(event),chosen=p?nearest(p):undefined;if(!p||!chosen)return;
  event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);svg.current?.focus({preventScroll:true});choose(chosen);
  gesture.current={id:event.pointerId,edge:chosen.id,x:event.clientX,y:event.clientY,start:pct(chosen,p),end:pct(chosen,p),drag:false,wholeEnd:textFt(chosen.lengthIn)};
 };
 const move=(event:PointerEvent<SVGLineElement>)=>{
  const g=gesture.current,p=local(event),chosen=g?edges.find(e=>e.id===g.edge):undefined;if(!g||g.id!==event.pointerId||!p||!chosen)return;
  if(Math.hypot(event.clientX-g.x,event.clientY-g.y)>8)g.drag=true;
  g.end=pct(chosen,p);if(g.drag){setFrom(textFt(chosen.lengthIn*Math.min(g.start,g.end)/100));setTo(textFt(chosen.lengthIn*Math.max(g.start,g.end)/100));}
 };
 const end=(event:PointerEvent<SVGLineElement>)=>{const g=gesture.current;if(!g||g.id!==event.pointerId)return;move(event);gesture.current=null;announce(g.drag?'Section selected. Add or remove railing, or add a screen here.':'Edge selected. Use the controls below to edit its section.');};
 const cancel=()=>{gesture.current=null;if(edge){setFrom('0');setTo(textFt(edge.lengthIn));}announce('Section gesture cancelled. Nothing in the design changed.');};
 const selectedRange=edge&&Number.isFinite(Number(from))&&Number.isFinite(Number(to))?interval(edge,Number(from)*12/edge.lengthIn*100,Number(to)*12/edge.lengthIn*100):undefined;
 const selectedScreen=screens.find(s=>s.id===screenId);
 const orphanRails=(data.railSections??[]).filter(r=>!edges.some(e=>e.level===r.level&&e.edgeId===r.edgeId));
 const controls=<section className="dd-edge-section-controls" aria-label="Railing and privacy screen controls" data-plan-editor-ui onPointerDown={event=>{
  if(event.pointerType==='mouse')return;const button=(event.target as Element).closest('button');if(button)consumedButtons.current.add(button);controlTap.current=event.isPrimary&&event.button===0&&pointers.current.size===1&&button instanceof HTMLButtonElement&&!button.disabled&&event.currentTarget.contains(button)?{id:event.pointerId,x:event.clientX,y:event.clientY,button}:null;
 }} onPointerMove={event=>{const tap=controlTap.current;if(tap?.id===event.pointerId&&Math.hypot(event.clientX-tap.x,event.clientY-tap.y)>8)controlTap.current=null;}} onPointerCancel={()=>{controlTap.current=null;}} onPointerUp={event=>{
  const tap=controlTap.current;controlTap.current=null;if(!tap||tap.id!==event.pointerId||tap.button.disabled||(event.target as Element).closest('button')!==tap.button||Math.hypot(event.clientX-tap.x,event.clientY-tap.y)>8)return;event.preventDefault();tap.button.click();
 }} onClickCapture={event=>{const button=(event.target as Element).closest('button'),type=(event.nativeEvent as globalThis.PointerEvent).pointerType;if(button&&(type==='touch'||type==='pen'||event.nativeEvent.isTrusted&&event.detail>0&&consumedButtons.current.has(button))){event.preventDefault();event.stopPropagation();}}} onKeyDown={event=>{
  if(event.key==='Escape'){gesture.current=null;setScreenId('');announce('Selection cleared.');}
  else if((event.key==='Delete'||event.key==='Backspace')&&screenId&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.nativeEvent.isComposing&&!(event.target as Element).closest('input,select,textarea,[contenteditable]')&&!document.querySelector('dialog[open],[role=dialog]')&&!gesture.current){event.preventDefault();removeScreen();}
 }}>
  <div className="dd-edge-section-intro"><strong>Choose the edge. Choose the section.</strong><p>Tap an edge for its full length, or drag along it to mark a shorter section. Railings and screens are separate choices.</p></div>
  <div className="dd-edge-section-fields"><label>Deck level<select aria-label="Railing and screen level" value={level} onChange={event=>{gesture.current=null;setLevel(Number(event.target.value) as 1|2|3);setEdgeId('');setScreenId('');setTo('');}}>{levels.map(l=><option key={l} value={l}>Level {l}</option>)}</select></label><label>Edge<select aria-label="Select deck edge" value={edgeId} onChange={event=>{const e=available.find(e=>e.id===event.target.value);if(e)choose(e);else{setEdgeId('');setScreenId('');}}}><option value="">Tap an edge or choose here</option>{available.map(e=><option key={e.id} value={e.id}>{e.label} · {textFt(e.lengthIn)} ft</option>)}</select></label></div>
  {edge&&<>
   <div className="dd-edge-section-heading"><strong>{edge.label}</strong><button type="button" onClick={()=>{setFrom('0');setTo(textFt(edge.lengthIn));}}>Whole edge</button></div>
   <div className="dd-edge-section-fields"><label>From (ft)<input type="number" step="any" min="0" max={edge.lengthIn/12} aria-label="Section start (ft)" value={from} onChange={event=>setFrom(event.target.value)}/></label><label>To (ft)<input type="number" step="any" min="0" max={edge.lengthIn/12} aria-label="Section end (ft)" value={to} onChange={event=>setTo(event.target.value)}/></label></div>
   <p>Measurements follow the arrow from A to B. Stair openings and shared level connections stay clear.</p>
   <div className="dd-edge-section-actions"><button type="button" className="dd-edge-section-primary" onClick={()=>changeRail(true)}>Add railing here</button><button type="button" onClick={()=>changeRail(false)}>Remove railing here</button><button type="button" onClick={()=>commit({action:'rail-reset',level:edge.level,edgeId:edge.edgeId})}>Restore edge railings</button></div>
   <div className="dd-edge-section-screen-add"><label>Screen height<select aria-label="New privacy screen height" value={height} onChange={event=>setHeight(Number(event.target.value) as 4|5|6)}>{[4,5,6].map(h=><option key={h} value={h}>{h} ft</option>)}</select></label><button type="button" className="dd-edge-section-primary" onClick={addScreen}>Add privacy screen here</button></div>
  </>}
  {screens.length>0&&<div className="dd-edge-section-screens" role="group" aria-label="Screens on this level">{screens.map((s,i)=><div key={s.id} className="dd-edge-section-screen" data-selected={screenId===s.id||undefined}><button type="button" aria-pressed={screenId===s.id} onClick={()=>{setScreenId(s.id);const e=edges.find(e=>e.level===(s.level??1)&&e.edgeId===s.edgeId);if(e){setEdgeId(e.id);setLevel(e.level);}announce(`Privacy screen ${i+1} selected.`);}}>Privacy screen {i+1}<small>{screenProduct(s).name}{!handles.some(h=>h.id===s.id)?' · not drawn':''}</small></button><label><input type="checkbox" role="switch" aria-label={`Privacy screen ${i+1} on`} checked={screenOn(s)} onChange={event=>commit({action:'screen-toggle',id:s.id,enabled:event.target.checked})}/>{screenOn(s)?'On':'Off'}</label><button type="button" aria-label={`Delete privacy screen ${i+1}`} onClick={()=>commit({action:'screen-remove',id:s.id})}>Delete</button></div>)}</div>}
  {(data.railSections??[]).some(r=>r.level===level)&&<div className="dd-edge-section-screens" role="group" aria-label="Saved railing sections">{(data.railSections??[]).filter(r=>r.level===level).map((r,i)=>{const e=edges.find(e=>e.level===r.level&&e.edgeId===r.edgeId);return <div key={r.id} className="dd-edge-section-screen"><button type="button" disabled={!e} onClick={()=>{if(!e)return;choose(e);setFrom(textFt(e.lengthIn*r.startPct/100));setTo(textFt(e.lengthIn*r.endPct/100));}}>Railing section {i+1}<small>{e?`${textFt(e.lengthIn*(r.endPct-r.startPct)/100)} ft · ${e.label}`:'Saved edge changed'}</small></button><label><input type="checkbox" role="switch" aria-label={`Railing section ${i+1} on`} disabled={!e} checked={r.enabled} onChange={event=>commit({action:'rail',level:r.level,edgeId:r.edgeId,startPct:r.startPct,endPct:r.endPct,enabled:event.target.checked})}/>{r.enabled?'On':'Off'}</label><button type="button" aria-label={`${e&&r.enabled?'Remove railing':e?'Reset railing':'Delete saved railing'} section ${i+1}`} onClick={()=>commit(e&&r.enabled?{action:'rail',level:r.level,edgeId:r.edgeId,startPct:r.startPct,endPct:r.endPct,enabled:false}:{action:'rail-remove',id:r.id})}>{e&&r.enabled?'Remove':e?'Reset':'Delete'}</button></div>;})}</div>}
  {selectedScreen&&<p>Selected screen: {screenProduct(selectedScreen).name}. Press Delete or use its Delete button to remove it. Turning it off keeps its settings for later.</p>}
  {orphanRails.length>0&&<p className="dd-edge-section-notice" data-invalid>Some saved railing sections belong to edges that changed. They do not move onto another edge. Delete their saved settings, then select the current edge to place them again.</p>}
  {notice&&<p className="dd-edge-section-notice" data-invalid={invalid||undefined} role="status">{notice}</p>}
  {onOpenSettings&&<button type="button" onClick={onOpenSettings}>Screen products & finishes</button>}
 </section>;
 return <div ref={box} className="dd-edge-section-editor" data-plan-editor-ui>
  <svg ref={svg} viewBox={viewportFrame.viewBox} role="group" aria-label="Select railing and screen sections" tabIndex={0} onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='Escape'){setScreenId('');cancel();}else if((event.key==='Delete'||event.key==='Backspace')&&screenId&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.nativeEvent.isComposing&&!gesture.current&&!document.querySelector('dialog[open],[role=dialog]')){event.preventDefault();removeScreen();}}}>
   {available.map(e=><g key={e.id}>{e.railings.map((r,i)=>{const span=interval(e,r.startPct,r.endPct);return <line key={i} className="dd-edge-section-rail" x1={span.a.x} y1={span.a.y} x2={span.b.x} y2={span.b.y}/>;})}<line className="dd-edge-section-outline" data-selected={edgeId===e.id||undefined} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}/><line data-edge-section-id={e.id} className="dd-edge-section-hit" x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y} role="button" tabIndex={0} aria-label={`Select ${e.label}`} aria-pressed={edgeId===e.id} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(e);}}} onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onLostPointerCapture={()=>{if(gesture.current)cancel();}}/></g>)}
   {selectedRange&&<><line className="dd-edge-section-range" x1={selectedRange.a.x} y1={selectedRange.a.y} x2={selectedRange.b.x} y2={selectedRange.b.y}/><text className="dd-edge-section-end" x={selectedRange.a.x} y={selectedRange.a.y-8}>A</text><text className="dd-edge-section-end" x={selectedRange.b.x} y={selectedRange.b.y-8}>B →</text></>}
   {screens.map((s,i)=>{const h=handles.find(h=>h.id===s.id);if(!screenOn(s)||!h)return null;return <g key={s.id} className="dd-edge-section-screen-marker" role="button" tabIndex={0} aria-label={`Select privacy screen ${i+1}`} aria-pressed={screenId===s.id} onClick={()=>{setScreenId(s.id);svg.current?.focus({preventScroll:true});}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setScreenId(s.id);svg.current?.focus({preventScroll:true});}}}><circle cx={h.x} cy={h.z} r={22/physicalScale}/><text x={h.x} y={h.z} style={{fontSize:11/physicalScale}} textAnchor="middle" dominantBaseline="central">S{i+1}</text></g>;})}
  </svg>
  {toolbar?.current?createPortal(controls,toolbar.current):<div className="dd-edge-section-toolbar">{controls}</div>}
 </div>;
}
