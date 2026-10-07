import {useArchitectKeys} from './architectKeys';
import {useEffect,useRef,useState,type PointerEvent,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Hand,Maximize,Minus,Plus} from 'lucide-react';
import type {PlanFrame} from '../ConstructionPlan';
import {useDesignerMode} from './designerMode';
import ProRulers from './pro/ProRulers';
import './planViewport.css';

const limit=(value:number)=>Math.max(.15,Math.min(3,value));
/** Zoom and pan keep the frame they started on. A new object with the same drawing is ignored; a design
 * edit changes the view box or the width and depth figures, and that frozen frame is dropped. */
const frameStamp=(frame:PlanFrame)=>`${frame.viewBox}|${frame.dims?.width.inches??''}|${frame.dims?.depth.inches??''}`;
/** Navigation changes only the view: neither pricing nor the design's undo history. The Pro workspace docks the
 * navigation controls in its tool strip (`navigationTarget`); they keep working the same way there. */
export default function PlanViewport({children,frame,navigationTarget}:{children:(zoom:number,frame:PlanFrame)=>ReactNode;frame:PlanFrame;navigationTarget?:HTMLElement|null}){
  const box=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null);
  // Designer Mode (the Pro workspace) adds rulers in feet along the top and left edges.
  const rulers=useDesignerMode();
  const [view,setView]=useState({zoom:1,x:0,y:0}),[pan,setPan]=useState(false),[panning,setPanning]=useState(false);
  const live=useRef(view);live.current=view;
  const gesture=useRef<{id:number;x:number;y:number;originX:number;originY:number;tapPan?:boolean}|null>(null);
  const frozen=useRef<PlanFrame|null>(null);
  if(frozen.current&&frameStamp(frozen.current)!==frameStamp(frame))frozen.current=null;
  const freeze=()=>{frozen.current??=frame;};
  const zoom=(factor:number,at?:{x:number;y:number})=>setView(old=>{
    const next=limit(old.zoom*factor),ratio=next/old.zoom;
    return {zoom:next,x:at?at.x-(at.x-old.x)*ratio:old.x*ratio,y:at?at.y-(at.y-old.y)*ratio:old.y*ratio};
  });
  const fit=()=>{frozen.current=frame;gesture.current=null;setPanning(false);setView({zoom:1,x:0,y:0});};
  useArchitectKeys({z:fit});
  useEffect(()=>{
    const el=box.current;if(!el)return;
    const wheel=(event:WheelEvent)=>{
      if(event.altKey)return;
      if((event.target as HTMLElement).closest('button,input,select'))return;
      event.preventDefault();freeze();const b=el.getBoundingClientRect(),stage=el.firstElementChild as HTMLElement;
      zoom(Math.exp(-event.deltaY*.003),{x:event.clientX-b.x-stage.offsetLeft-stage.offsetWidth/2,y:event.clientY-b.y-stage.offsetTop-stage.offsetHeight/2});
    };
    el.addEventListener('wheel',wheel,{passive:false});return ()=>el.removeEventListener('wheel',wheel);
  },[frame]);
  const down=(event:PointerEvent<HTMLDivElement>)=>{
    // Portalled editing controls are outside the canvas even though React bubbles through it.
    if(!event.currentTarget.contains(event.target as Node))return;
    freeze();
    // An explicit insertion tool takes precedence over a previously enabled camera pan.
    if(event.button!==1&&(event.target as Element).closest('.dd-landscape-plan[data-drawing],.dd-boundary-editor[data-add-pull],.dd-yard-shape-editor[data-add-pull],.dd-yard-shape-editor[data-drawing],.dd-inlay-plan-editor[data-placement],.dd-patio-inlay-overlay[data-placing]')){if(pan)setPan(false);return;}
    const hardscapePan=!!(event.target as Element).closest('.dd-hardscape-plan-picks,[data-area-pick]');
    if(!pan&&event.button!==1&&!hardscapePan)return;
    if((event.target as HTMLElement).closest(event.button===1?'.dd-plan-navigation,input,select,button':'.dd-plan-navigation,.dd-boundary-inline,[data-plan-editor-ui],[role="toolbar"]'))return;
    if(gesture.current&&gesture.current.id!==event.pointerId){gesture.current=null;setPanning(false);return;}
    if(hardscapePan&&!pan&&event.button===0){gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,originX:live.current.x,originY:live.current.y,tapPan:true};return;}
    event.preventDefault();event.stopPropagation();
    event.currentTarget.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,originX:live.current.x,originY:live.current.y};setPanning(true);
  };
  const move=(event:PointerEvent<HTMLDivElement>)=>{
    const g=gesture.current;if(!g||g.id!==event.pointerId)return;
    if(g.tapPan&&Math.hypot(event.clientX-g.x,event.clientY-g.y)<5)return;
    if(g.tapPan){g.tapPan=false;event.currentTarget.setPointerCapture(event.pointerId);setPanning(true);}
    event.preventDefault();setView(old=>({...old,x:g.originX+event.clientX-g.x,y:g.originY+event.clientY-g.y}));
  };
  const end=(event:PointerEvent<HTMLDivElement>)=>{if(gesture.current?.id!==event.pointerId)return;gesture.current=null;setPanning(false);};
  const navigation=<div className="dd-plan-navigation" role="group" aria-label="Drawing navigation">
    <button type="button" aria-label="Pan drawing" aria-pressed={pan} title="Pan the view without changing your deck" onClick={()=>setPan(old=>!old)}><Hand size={17}/></button>
    <span className="dd-plan-navigation-divider" aria-hidden="true"/>
    <button type="button" aria-label="Zoom out" disabled={view.zoom<=.15} onClick={()=>{freeze();zoom(.8);}}><Minus size={17}/></button>
    <output aria-label="Drawing zoom">{Math.round(view.zoom*100)}%</output>
    <button type="button" aria-label="Zoom in" disabled={view.zoom>=3} onClick={()=>{freeze();zoom(1.25);}}><Plus size={17}/></button>
    <button type="button" aria-label="Fit drawing" title="Fit the entire design" onClick={fit}><Maximize size={17}/></button>
  </div>;
  return <div ref={box} className="dd-plan-viewport" data-pan={pan||undefined} data-panning={panning||undefined} data-rulers={rulers||undefined} tabIndex={0} aria-label="Deck drawing canvas" onPointerDownCapture={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDownCapture={freeze} onKeyDown={event=>{
    if(event.target!==event.currentTarget)return;
    if(event.key==='+'||event.key==='='){event.preventDefault();zoom(1.25);}
    else if(event.key==='-'){event.preventDefault();zoom(.8);}
    else if(event.key==='0'){event.preventDefault();fit();}
    else if(event.key==='Escape'){setPan(false);gesture.current=null;setPanning(false);}
  }}>
    <div ref={stage} className="dd-plan-stage" style={{transform:`translate(${view.x}px,${view.y}px) scale(${view.zoom})`}}>{children(view.zoom,frozen.current??frame)}</div>
    {rulers&&<ProRulers stage={stage} frame={frozen.current??frame} view={view}/>}
    {navigationTarget?createPortal(navigation,navigationTarget):navigation}
    {pan&&<p className="dd-plan-pan-hint" role="status">Drag the canvas to look around. Turn Pan off to edit points.</p>}
  </div>;
}
