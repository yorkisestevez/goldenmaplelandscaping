import {useEffect,useRef,useState,type PointerEvent} from 'react';
import type {DeckData,YardFeature} from '../types';
import type {PlanFrame} from '../ConstructionPlan';
import type {DeckTakeoff} from '../deckTakeoff';
import {buildYardModel} from '../yardModel';
import {isObjectLocked,isObjectVisible} from '../editorOrganization';
import {stepAssemblyFootprints,validateStepAssembly} from '../stepAssemblyRuntime';
import {stepShapeContext,resizeStepSide,wrapStepCorner} from './stepShapeEdits';
import type {HardscapeSelection} from './selectionState';

export default function StepShapeHandles({data,model,frame,selection,onApply}:{data:DeckData;model:DeckTakeoff;frame:PlanFrame;selection?:HardscapeSelection;onApply:(patch:Partial<DeckData>)=>void}){
 const feature=selection?.kind==='yard'?data.yardFeatures?.find(f=>f.id===selection.id):undefined;
 const context=feature&&(feature.stepAssembly||feature.stoneSteps)?stepShapeContext(feature,selection?.flightId):null;
 const svg=useRef<SVGSVGElement>(null),[scale,setScale]=useState(1),[draft,setDraft]=useState<YardFeature|null>(null),[message,setMessage]=useState('');
 const drag=useRef<{id:number;side:-1|1;matrix:DOMMatrix;capture:SVGCircleElement;startX:number;startY:number;next:YardFeature|null}|null>(null);
 const cancel=()=>{const d=drag.current;drag.current=null;setDraft(null);if(d?.capture.hasPointerCapture(d.id))d.capture.releasePointerCapture(d.id);};
 useEffect(()=>{cancel();setMessage('');},[data,selection?.id,selection?.flightId]);
 useEffect(()=>{const stop=()=>cancel(),key=(e:KeyboardEvent)=>{if(e.key==='Escape'){cancel();setMessage('Resize cancelled.');}},hidden=()=>{if(document.hidden)cancel();};window.addEventListener('blur',stop);window.addEventListener('keydown',key);document.addEventListener('visibilitychange',hidden);return()=>{window.removeEventListener('blur',stop);window.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',hidden);};},[]);
 useEffect(()=>{const el=svg.current;if(!el)return;const measure=()=>{const m=el.getScreenCTM();if(m)setScale(Math.hypot(m.a,m.b));};measure();const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect();},[frame,!!context]);
 if(!context||!feature?.enabled||isObjectLocked(data.editorOrganization,feature.id)||!isObjectVisible(data.editorOrganization,feature.id)||context.flight.layout==='curved')return null;
 const commit=(next:YardFeature)=>{try{validateStepAssembly(next,next.stepAssembly);const yardFeatures=data.yardFeatures!.map(f=>f.id===feature.id?next:f),installed=buildYardModel({...data,yardFeatures},model).features.find(f=>f.config.id===feature.id);if(!installed||installed.excluded)throw Error(installed?.warnings.at(-1)??'This shape cannot be placed here.');if(JSON.stringify(next)!==JSON.stringify(feature))onApply({yardFeatures});setMessage('Step shape saved. Undo restores the previous shape.');}catch(e){setMessage(`Cannot change steps: ${(e as Error).message}`);}};
 const down=(side:-1|1)=>(e:PointerEvent<SVGCircleElement>)=>{if(e.button!==0||drag.current)return;const matrix=svg.current?.getScreenCTM()?.inverse();if(!matrix)return;e.preventDefault();e.stopPropagation();e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,side,matrix,capture:e.currentTarget,startX:e.clientX,startY:e.clientY,next:null};setMessage('');};
 const move=(e:PointerEvent)=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;e.stopPropagation();if(Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<3){d.next=null;setDraft(null);return;}const cursor=new DOMPoint(e.clientX,e.clientY).matrixTransform(d.matrix);d.next=resizeStepSide(context,d.side,context.local(cursor).x);setDraft(d.next);};
 const up=(e:PointerEvent)=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;move(e);const next=d.next;cancel();if(next)commit(next);};
 const shown=draft?stepShapeContext(draft,context.flight.id)!:context,p=shown.flight;
 const ghost=draft?stepAssemblyFootprints(draft):[];
 const cornerY=p.layout==='wraparound'?(p.wrapSides.includes('back')?-1:1)*p.wrapDepthIn/2:shown.depth/2;
 return <><svg ref={svg} viewBox={frame.viewBox} aria-label="Stone and paver step shape controls" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',overflow:'visible'}}>
 {ghost.map((poly,i)=><polygon key={i} points={poly.map(p=>`${p.x},${p.y}`).join(' ')} fill="#e7b964" fillOpacity=".3" stroke="#b06d25" vectorEffect="non-scaling-stroke"/>)}
 {([-1,1] as const).map(side=>{const point=shown.world(side*p.widthIn/2,0),corner=shown.world(side*p.widthIn/2,cornerY),name=side===-1?'left':'right';return <g key={side}>
 <circle cx={point.x} cy={point.y} r={9/scale} fill="#fff9ed" stroke="#9b613b" strokeWidth={2/scale}/><circle cx={point.x} cy={point.y} r={22/scale} fill="transparent" role="button" aria-label={`Resize step ${name} side`} tabIndex={0} style={{pointerEvents:'all',touchAction:'none',cursor:'ew-resize'}} onPointerDown={down(side)} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();commit(resizeStepSide(context,side,side*context.flight.widthIn/2+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?12:1)));}}><title>Pull to resize stair width</title></circle>
 {!(p.layout==='wraparound'&&p.wrapSides.includes(name))&&<g role="button" aria-label={`Wrap steps around ${name} corner`} tabIndex={0} style={{pointerEvents:'all',cursor:'pointer'}} onPointerDown={e=>e.stopPropagation()} onClick={()=>commit(wrapStepCorner(context,name))} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();commit(wrapStepCorner(context,name));}}}><circle cx={corner.x} cy={corner.y} r={16/scale} fill="#dcefc8" stroke="#376a33" strokeWidth={2/scale}/><text x={corner.x} y={corner.y} textAnchor="middle" dominantBaseline="central" fontSize={18/scale} fill="#244521">+</text><title>Wrap steps around {name} corner</title></g>}
 </g>;})}
 </svg>{(draft||message)&&<div role="status" style={{position:'absolute',bottom:8,left:8,maxWidth:'85%',padding:'6px 10px',background:'#fff9ed',color:'#302a20',borderRadius:8,pointerEvents:'none',fontSize:13}}>{draft?`Width ${(p.widthIn/12).toFixed(2)} ft · release to save`:message||'Pull the cream handles to widen steps. Green + wraps a corner.'}</div>}</>;
}
