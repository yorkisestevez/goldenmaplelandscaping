import {useLayoutEffect,useState,type RefObject} from 'react';
import type {PlanFrame} from '../../ConstructionPlan';
import './proRulers.css';

/** Ruler thickness in screen pixels (the CSS insets the pan hint by the same amount). */
const SIZE=20;
/** The smallest gap between two labelled ticks, so their figures never run together. */
const LABEL_GAP=40;
/** Below this many pixels a foot, single-foot ticks would only smear into a solid bar. */
const MINOR_GAP=4;

interface Layout{box:{w:number;h:number};stage:{left:number;top:number;w:number;h:number}}
/** One axis as a straight line from plan inches to ruler pixels: px = scale * inches + offset. */
interface Axis{scale:number;offset:number;length:number}
interface Tick{px:number;ft:number;kind:'major'|'mid'|'minor'}

/** Plan units are inches. The site plan's SVG fills the stage and fits its viewBox (the frame) inside it, centred
 * (`xMidYMid meet`), and the stage's transform then pans and scales it about the stage's centre. */
function axes({box,stage}:Layout,frame:PlanFrame,view:{zoom:number;x:number;y:number}):{x:Axis;y:Axis}{
  const fit=Math.min(stage.w/frame.w,stage.h/frame.h);
  const along=(size:number,extent:number,start:number,pan:number,origin:number,length:number):Axis=>{
    const pad=(size-extent*fit)/2,centre=size/2;
    return {scale:fit*view.zoom,offset:origin+centre+(pad-start*fit-centre)*view.zoom+pan,length};
  };
  return {x:along(stage.w,frame.w,frame.x,view.x,stage.left,box.w),y:along(stage.h,frame.h,frame.y,view.y,stage.top,box.h)};
}

/** Labelled ticks every 5 ft, or every 10 ft once 5 ft gets cramped (coarser only when zoomed far out), with a tick at
 * every foot between them. The corner square is left clear. */
function ticks({scale,offset,length}:Axis):Tick[]{
  const foot=scale*12;if(!(foot>0))return [];
  const major=[5,10,20,50,100].find(step=>step*foot>=LABEL_GAP)??100;
  const minor=foot>=MINOR_GAP?1:5*foot>=MINOR_GAP?5:major;
  const from=Math.ceil((SIZE-offset)/foot/minor)*minor,to=Math.floor((length-offset)/foot);
  const out:Tick[]=[];
  for(let ft=from;ft<=to;ft+=minor){
    const kind=ft%major===0?'major':major>=10&&ft%(major/2)===0?'mid':'minor';
    out.push({px:Math.round(offset+ft*foot)+.5,ft,kind});
  }
  return out;
}
const length={major:SIZE-6,mid:7,minor:4};
const label=(ft:number)=>`${ft}'`;

/** CAD rulers in feet along the plan's top and left edges (Pro workspace only). They follow pan, zoom and Fit, take no
 * pointer events and are hidden from screen readers: the drawing already announces its dimensions. */
export default function ProRulers({stage,frame,view}:{stage:RefObject<HTMLDivElement|null>;frame:PlanFrame;view:{zoom:number;x:number;y:number}}){
  const [layout,setLayout]=useState<Layout|null>(null);
  useLayoutEffect(()=>{
    const el=stage.current,box=el?.parentElement;if(!el||!box)return;
    const measure=()=>setLayout(old=>{
      const next={box:{w:box.clientWidth,h:box.clientHeight},stage:{left:el.offsetLeft,top:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight}};
      return old&&JSON.stringify(old)===JSON.stringify(next)?old:next;
    });
    measure();
    const watch=new ResizeObserver(measure);watch.observe(el);watch.observe(box);
    return ()=>watch.disconnect();
  },[stage]);
  if(!layout||layout.stage.w<=0||layout.stage.h<=0||frame.w<=0||frame.h<=0)return null;
  const {x,y}=axes(layout,frame,view),top=ticks(x),left=ticks(y);
  return <div className="dd-pro-rulers" aria-hidden="true">
    <svg className="dd-pro-ruler dd-pro-ruler-x" width={layout.box.w} height={SIZE} data-px-per-ft={(x.scale*12).toFixed(3)}>
      {top.map(t=><line key={t.ft} x1={t.px} x2={t.px} y1={SIZE} y2={SIZE-length[t.kind]} data-kind={t.kind}/>)}
      {top.filter(t=>t.kind==='major').map(t=><text key={t.ft} x={t.px+3} y={9} data-at={t.px} data-ft={t.ft}>{label(t.ft)}</text>)}
    </svg>
    <svg className="dd-pro-ruler dd-pro-ruler-y" width={SIZE} height={layout.box.h} data-px-per-ft={(y.scale*12).toFixed(3)}>
      {left.map(t=><line key={t.ft} y1={t.px} y2={t.px} x1={SIZE} x2={SIZE-length[t.kind]} data-kind={t.kind}/>)}
      {left.filter(t=>t.kind==='major').map(t=><text key={t.ft} x={9} y={t.px-3} transform={`rotate(-90 9 ${t.px-3})`} data-at={t.px} data-ft={t.ft}>{label(t.ft)}</text>)}
    </svg>
    <span className="dd-pro-ruler-corner"/>
  </div>;
}
