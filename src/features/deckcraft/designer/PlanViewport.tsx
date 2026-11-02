import {useArchitectKeys} from './architectKeys';
import {useEffect,useRef,useState,type PointerEvent,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Hand,Maximize,Minus,Plus} from 'lucide-react';
import type {PlanFrame} from '../ConstructionPlan';
import {useDesignerMode} from './designerMode';
import ProRulers from './pro/ProRulers';
import './planViewport.css';

const limit=(value:number)=>Math.max(.15,Math.min(3,value));
// The site plan's smallest labels (edge figures), in drawing units.
const SMALLEST_LABEL=6.5;
/** A zoomed or panned sheet stays until Fit. Refitting it under the same zoom percentage jumps every handle.
 * At the fitted view, an edit that changes the sheet (a typed width, a new outline) drops that hold so the
 * drawing and its dimension buttons follow the design. */
const frameStamp=(frame:PlanFrame)=>`${frame.viewBox}|${frame.dims?.width.inches??''}|${frame.dims?.depth.inches??''}`;
const swipeable=(target:Element,viewport:Element)=>{
  if(target.closest('button,a,input,select,textarea,label,[role="slider"],[role="button"],[tabindex]:not(.dd-plan-viewport)'))return false;
  for(let el:Element|null=target;el&&el!==viewport;el=el.parentElement)if(getComputedStyle(el).touchAction!=='auto')return false;
  return true;
};
/** Navigation changes only the view: neither pricing nor the design's undo history. The Pro workspace docks the
 * navigation controls in its tool strip (`navigationTarget`); they keep working the same way there. */
export default function PlanViewport({children,frame,navigationTarget,fitToken,labelPx,openArea}:{children:(zoom:number,frame:PlanFrame)=>ReactNode;frame:PlanFrame;navigationTarget?:HTMLElement|null;/** When this value changes, fit the drawing (Draw my own / outline tool). */fitToken?:string|number;
  /** Open zoomed onto the deck so the smallest labels read at this many pixels (the new look's phones); Fit still shows
   *  the whole design. */labelPx?:number;
  /** The screen band the drawing shows between controls over it (top and bottom, in viewport pixels); the zoomed deck
   *  is centred there; null until the controls around it are laid out. With fit, the deck also fits the band whole (a
   *  phone's tool drawer is open), even if its labels then read smaller. */openArea?:()=>{top:number;bottom:number;fit?:boolean}|null}){
  const box=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null);
  // Designer Mode (the Pro workspace) adds rulers in feet along the top and left edges.
  const rulers=useDesignerMode();
  const [view,setView]=useState({zoom:1,x:0,y:0}),[pan,setPan]=useState(false),[panning,setPanning]=useState(false);
  const live=useRef(view);live.current=view;
  const gesture=useRef<{id:number;x:number;y:number;originX:number;originY:number;tapPan?:boolean}|null>(null);
  const frozen=useRef<PlanFrame|null>(null);
  const fitted=view.zoom===1&&view.x===0&&view.y===0;
  if(frozen.current&&fitted&&frameStamp(frozen.current)!==frameStamp(frame))frozen.current=null;
  const freeze=()=>{frozen.current??=frame;};
  const zoom=(factor:number,at?:{x:number;y:number})=>setView(old=>{
    const next=limit(old.zoom*factor),ratio=next/old.zoom;
    return {zoom:next,x:at?at.x-(at.x-old.x)*ratio:old.x*ratio,y:at?at.y-(at.y-old.y)*ratio:old.y*ratio};
  });
  const fit=()=>{frozen.current=frame;gesture.current=null;setPanning(false);setView({zoom:1,x:0,y:0});};

  useArchitectKeys({z:fit});
  // Once the drawing has a size: the zoom that brings its smallest labels up to labelPx, centred on the deck and its
  // stairs. The drawing fits its stage (preserveAspectRatio meet), so a drawing unit is the smaller of the two ratios.
  // The page around the drawing may still be settling (its stylesheet, the controls over it): each resize looks again.
  const opened=useRef(false),[,settle]=useState(0);
  useEffect(()=>{
    const el=stage.current;if(!labelPx||!el)return;
    const observer=new ResizeObserver(()=>{if(!opened.current)settle(n=>n+1);});observer.observe(el);return()=>observer.disconnect();
  },[!!labelPx]);
  useEffect(()=>{
    if(!labelPx||opened.current)return;
    const r=stage.current?.querySelector('svg.dd-site-plan')?.getBoundingClientRect(),s=stage.current?.getBoundingClientRect(),area=openArea?openArea():undefined;
    if(!r?.width||!r.height||!s||area===null)return;
    opened.current=true;
    const unit=Math.min(r.width/frame.w,r.height/frame.h),margin=72/* room for the edge dimensions outside the deck */;
    const whole=area?.fit?Math.min((s.width-2*margin)/((frame.b.maxX-frame.b.minX)*unit),(area.bottom-area.top-2*margin)/((frame.b.maxZ-frame.b.minZ)*unit)):Infinity;
    // Fitting the deck may mean zooming out a little; otherwise the plan only ever opens zoomed in.
    const next=limit(Math.min(labelPx/(SMALLEST_LABEL*unit),whole));if(next<=1&&!area?.fit)return;
    const dx=((frame.b.minX+frame.b.maxX)/2-frame.x-frame.w/2)*unit,dy=((frame.b.minZ+frame.b.maxZ)/2-frame.y-frame.h/2)*unit;
    const aim=area?(area.top+area.bottom)/2-(s.top+s.height/2):0;
    frozen.current=frame;setView({zoom:next,x:-dx*next,y:aim-dy*next});
  });
  // A phone opens on its own view (labelPx, above), so the token only fits when it changes after that.
  const fitTokenSeen=useRef<string|number|undefined>(labelPx?fitToken:undefined);
  useEffect(()=>{
    if(fitToken===undefined||fitTokenSeen.current===fitToken)return;
    fitTokenSeen.current=fitToken;fit();
  },[fitToken,frame]);
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
    // The new look's phones (labelPx) have no page to scroll, so a finger swiping over the drawing pans it; controls, and
    // editors that take their own touches (touch-action), keep them.
    const hardscapePan=!!(event.target as Element).closest('.dd-hardscape-plan-picks,[data-area-pick]')||!!labelPx&&event.pointerType==='touch'&&swipeable(event.target as Element,event.currentTarget);
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
