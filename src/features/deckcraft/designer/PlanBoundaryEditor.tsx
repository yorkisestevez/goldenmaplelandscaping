import {useEffect,useLayoutEffect,useMemo,useRef,useState,type CSSProperties,type KeyboardEvent,type MouseEvent,type PointerEvent,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {planFrame,type PlanFrame} from '../ConstructionPlan';
import type {DeckTakeoff} from '../deckTakeoff';
import type {PlanPoint} from '../lib/deckGeometry';
import type {DeckData} from '../types';
import type {Update} from './fields';
import {boundaryPatch,boundaryProblem,editableBoundaries,insertBoundaryPoint,insertBoundaryPointAt,moveBoundary,removeBoundaryPoint} from './boundaryEditMath';
import {parseContractorLength,reconcileBoundaryLocks,setBoundaryDimension,validateBoundaryLocks} from './boundaryDimensions';
import {snapBoundaryMove,type BoundarySnapGuide,type BoundarySnapContext} from './boundarySnap';
import {getHouseWalls} from '../houseFootprint';
import {placeBoundaryLabel,type LabelRect} from './boundaryLabelPlacement';
import {keyboardBoundaryPull,projectBoundaryPull,pullDirectionVector,type PullDirection} from './boundaryPullDirection';
import './planBoundaryEditor.css';

type Boundary=ReturnType<typeof editableBoundaries>[number];
type Kind='point'|'edge'|'area';
interface Selection{level:Boundary['level'];kind:Kind;index:number}
interface Drag{selection:Selection;pointer:number;x:number;y:number;scale:number;frame:PlanFrame;boundary:Boundary;points:PlanPoint[];problem:string;moved:boolean;guides:BoundarySnapGuide[];direction:PullDirection;angle:number}
interface InsertTap{boundary:Boundary;index:number;pointer:number;x:number;y:number;cancelled:boolean}
interface DimensionDraft {boundary:Boundary;index:number}
const same=(a:PlanPoint[],b:PlanPoint[])=>a.length===b.length&&a.every((p,i)=>Math.abs(p.x-b[i].x)<1e-6&&Math.abs(p.y-b[i].y)<1e-6);
const ft=(inches:number)=>String(Math.round(inches/12*1000)/1000);
const angleText=(angle:number)=>String(Math.round(angle*1000)/1000);
const lockProblem='A saved edge is locked. Move both of its endpoints together, or unlock it before changing its length, angle or topology.';
const world=(b:Boundary,p:PlanPoint)=>({x:p.x+b.offset.x,y:p.y+b.offset.y});
const centre=(points:PlanPoint[])=>({x:points.reduce((n,p)=>n+p.x,0)/points.length,y:points.reduce((n,p)=>n+p.y,0)/points.length});
const description=(s:Selection)=>s.kind==='point'?`Point ${s.index+1}`:s.kind==='edge'?`Edge ${s.index+1}`:'Whole level';

export interface PlanBoundaryEditorProps{
  data:DeckData;model:DeckTakeoff;update:Update;onEdited?:()=>void;onStatus?:(message:string)=>void;
  /** Under the drawing, outside the absolute overlay. Omit to use the built-in toolbar position. */
  toolbar?:RefObject<HTMLElement|null>;
  /** View navigation zoom; handles stay at least 44 screen pixels and gesture distances use the true scale. */
  viewZoom?:number;
  viewportFrame?:PlanFrame;
  /** A selected physical deck part can route editing to its actual level. */
  requestedLevel?:1|2|3;
}

/** Every boundary point moves freely in the plan's x/y axes. Pointer gestures keep the price and undo history unchanged until release. */
export default function PlanBoundaryEditor({data,model,update,onEdited,onStatus,toolbar,viewZoom=1,viewportFrame,requestedLevel}:PlanBoundaryEditorProps){
  const boundaries=useMemo(()=>editableBoundaries(data,model),[data,model]);
  const [selection,setSelection]=useState<Selection>({level:1,kind:'point',index:0});
  const box=useRef<HTMLDivElement>(null),[size,setSize]=useState<{w:number;h:number}|null>(null);
  const gesture=useRef<Drag|null>(null),[live,setLive]=useState<Drag|null>(null),[notice,setNotice]=useState(''),[noticeInvalid,setNoticeInvalid]=useState(false);
  const [draftX,setDraftX]=useState(''),[draftY,setDraftY]=useState('');
  const [draftLength,setDraftLength]=useState(''),[draftAngle,setDraftAngle]=useState('');
  const [freeMovement,setFreeMovement]=useState(false),[editing,setEditing]=useState<DimensionDraft|null>(null),[dimensionDirty,setDimensionDirty]=useState(false);
  const [addArmed,setAddArmed]=useState(false),[pullDirection,setPullDirection]=useState<PullDirection>('any'),[pullAngle,setPullAngle]=useState('45');
  const insertTap=useRef<InsertTap|null>(null),activePointers=useRef(new Set<number>());
  const dimensionLabels=useRef<Record<string,HTMLButtonElement|null>>({}),dimensionInput=useRef<HTMLInputElement|null>(null);
  const dimensionPanel=useRef<HTMLElement|null>(null),[inlineHeight,setInlineHeight]=useState(300);
  const [inlinePosition,setInlinePosition]=useState<CSSProperties|undefined>();
  const [labelPositions,setLabelPositions]=useState<Record<string,{left:number;top:number}>>({});
  const handles=useRef<Record<string,HTMLButtonElement|null>>({}),focusNext=useRef<string|null>(null);
  const id=(s:Selection)=>`${s.level}-${s.kind}-${s.index}`;
  const cancel=()=>{gesture.current=null;insertTap.current=null;setLive(null);};
  const announce=(text:string,invalid=false)=>{setNotice(text);setNoticeInvalid(invalid);onStatus?.(text);};
  useEffect(()=>{
    const down=(e:globalThis.PointerEvent)=>{activePointers.current.add(e.pointerId);if(activePointers.current.size>1&&insertTap.current)insertTap.current.cancelled=true;};
    const end=(e:globalThis.PointerEvent)=>{activePointers.current.delete(e.pointerId);if(e.type==='pointercancel'&&insertTap.current)insertTap.current.cancelled=true;};
    const escape=(e:globalThis.KeyboardEvent)=>{if(e.key==='Escape'&&addArmed){e.preventDefault();cancel();setAddArmed(false);announce('Adding a pull point cancelled.');}};
    document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',end,true);document.addEventListener('pointercancel',end,true);document.addEventListener('keydown',escape,true);
    return()=>{document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',end,true);document.removeEventListener('pointercancel',end,true);document.removeEventListener('keydown',escape,true);};
  },[addArmed]);
  useEffect(()=>{if(requestedLevel!==undefined){cancel();setEditing(null);setDimensionDirty(false);setSelection({level:requestedLevel,kind:'edge',index:0});setNotice('');setNoticeInvalid(false);}},[requestedLevel]);
  useLayoutEffect(()=>{
    const el=box.current;if(!el)return;
    const measure=()=>setSize(old=>old&&old.w===el.clientWidth&&old.h===el.clientHeight?old:{w:el.clientWidth,h:el.clientHeight});
    measure();const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;observer?.observe(el);return ()=>observer?.disconnect();
  },[]);
  useEffect(()=>{if(gesture.current||insertTap.current)cancel();},[data,model]);
  useLayoutEffect(()=>{const key=focusNext.current;if(key&&handles.current[key]){handles.current[key]!.focus({preventScroll:true});focusNext.current=null;}});
  const current=boundaries.find(b=>b.level===selection.level)??boundaries[0];
  const activeSelection:Selection=current?{...selection,level:current.level,index:Math.min(selection.index,Math.max(0,current.points.length-1))}:selection;
  const point=current?.points[activeSelection.index];
  const endpoint=current?.points[(activeSelection.index+1)%current.points.length],edgeLength=point&&endpoint?Math.hypot(endpoint.x-point.x,endpoint.y-point.y):0,edgeAngle=point&&endpoint?Math.atan2(endpoint.y-point.y,endpoint.x-point.x)*180/Math.PI:0;
  const selectedLock=data.boundaryLocks?.find(l=>l.level===current?.level&&l.edge===activeSelection.index);
  useEffect(()=>{setDraftX(point?ft(point.x):'');setDraftY(point?ft(point.y):'');},[point?.x,point?.y,activeSelection.level,activeSelection.index]);
  useEffect(()=>{if(!dimensionDirty){setDraftLength(ft(edgeLength));setDraftAngle(angleText(edgeAngle));}},[edgeLength,edgeAngle,activeSelection.level,activeSelection.index,editing,dimensionDirty]);
  useEffect(()=>{if(editing)dimensionInput.current?.focus({preventScroll:true});},[editing]);
  useLayoutEffect(()=>{const panel=dimensionPanel.current;if(!editing||!panel)return;const measure=()=>setInlineHeight(old=>old===panel.offsetHeight?old:panel.offsetHeight);measure();const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;observer?.observe(panel);return()=>observer?.disconnect();},[editing]);
  const frame=live?.frame??viewportFrame??planFrame(model,{data,variant:'site'});
  const scale=size?Math.min(size.w/frame.w,size.h/frame.h):0,ox=size?(size.w-frame.w*scale)/2:0,oy=size?(size.h-frame.h*scale)/2:0;
  const at=(p:PlanPoint)=>({left:ox+(p.x-frame.x)*scale,top:oy+(p.y-frame.y)*scale});
  const choose=(next:Selection)=>{setEditing(null);setDimensionDirty(false);setSelection(next);setNotice('');setNoticeInvalid(false);};
  const directionAngle=()=>{if(pullDirection==='custom'&&!pullAngle.trim())throw Error('Enter a pull angle from −360° to 360°.');const angle=Number(pullAngle);pullDirectionVector(pullDirection,angle);return angle;};
  const commit=(boundary:Boundary,points:PlanPoint[],next:Selection=activeSelection)=>{
    const problem=boundaryProblem(points);if(problem){announce(problem,true);return false;}
    if(!reconcileBoundaryLocks(data,boundary.level,boundary.points,points)){announce(lockProblem,true);return false;}
    if(same(boundary.points,points))return false;
    const patch=boundaryPatch(data,boundary.level,points,boundary.offset,model);
    if(!patch){announce('This outline cannot be applied. Keep its edges clear of each other.');return false;}
    update(patch);setSelection(next);onEdited?.();announce(`${boundary.name} updated.`);return true;
  };
  const down=(boundary:Boundary,kind:Kind,index:number)=>(e:PointerEvent<HTMLButtonElement>)=>{
    if(addArmed){if(kind==='edge')beginInsert(boundary,index,e);else{e.preventDefault();announce('Tap a deck edge to place the new pull point.');}return;}
    if((e.pointerType==='mouse'&&e.button!==0)||!scale||gesture.current)return;
    e.preventDefault();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture?.(e.pointerId);
    let angle:number;try{angle=directionAngle();}catch(error){announce((error as Error).message,true);return;}
    const target={level:boundary.level,kind,index};choose(target);
    // CSS can give the canvas fractional dimensions. clientWidth/Height round them, changing an exact
    // twelve-inch gesture into 12.00002 inches. Use the rendered editor surface, including viewport zoom.
    // The child SVG's GPU-rounded bbox can differ slightly from this actual CSS coordinate surface.
    const svg=box.current?.querySelector('svg'),rendered=box.current?.getBoundingClientRect(),view=svg?.viewBox.baseVal,screenScale=rendered&&view?Math.min(rendered.width/view.width,rendered.height/view.height):scale*viewZoom;
    const drag:Drag={selection:target,pointer:e.pointerId,x:e.clientX,y:e.clientY,scale:screenScale,frame,boundary,points:boundary.points.map(p=>({...p})),problem:'',moved:false,guides:[],direction:pullDirection,angle};
    gesture.current=drag;setLive(drag);
  };
  const move=(e:PointerEvent)=>{
    if(insertTap.current){if(e.pointerId===insertTap.current.pointer&&Math.hypot(e.clientX-insertTap.current.x,e.clientY-insertTap.current.y)>8)insertTap.current.cancelled=true;return;}
    const g=gesture.current;if(!g||e.pointerId!==g.pointer)return;
    const delta=projectBoundaryPull((e.clientX-g.x)/g.scale,(e.clientY-g.y)/g.scale,g.direction,g.angle),dx=delta.x,dy=delta.y;
    const local=(p:PlanPoint)=>({x:p.x-g.boundary.offset.x,y:p.y-g.boundary.offset.y});
    const context:BoundarySnapContext={corners:boundaries.filter(b=>b.level!==g.boundary.level).flatMap(b=>b.points.map((p,i)=>({point:local(world(b,p)),label:`${b.name} corner ${i+1}`}))),lines:[]};
    for(const boundary of boundaries)if(boundary.level!==g.boundary.level)boundary.points.forEach((p,index)=>context.lines.push({a:local(world(boundary,p)),b:local(world(boundary,boundary.points[(index+1)%boundary.points.length])),label:`${boundary.name} edge ${index+1}`}));
    if(data.houseVisible!==false)for(const wall of getHouseWalls(data))for(const [from,to] of wall.exposed){const u={x:(wall.b.x-wall.a.x)/wall.lengthIn,y:(wall.b.y-wall.a.y)/wall.lengthIn},a=local({x:wall.a.x+u.x*from,y:wall.a.y+u.y*from}),b=local({x:wall.a.x+u.x*to,y:wall.a.y+u.y*to});context.lines.push({a,b,label:'house wall'});context.corners.push({point:a,label:'House corner'},{point:b,label:'House corner'});}
    const snapped=g.direction!=='any'||freeMovement||e.altKey?{points:moveBoundary(g.boundary.points,g.selection.kind,g.selection.index,dx,dy),guides:[]}:snapBoundaryMove(g.boundary.points,g.selection.kind,g.selection.index,dx,dy,context,8/g.scale);
    const points=snapped.points,problem=boundaryProblem(points)||(!reconcileBoundaryLocks(data,g.boundary.level,g.boundary.points,points)?lockProblem:'');
    const next={...g,points,guides:snapped.guides,problem,moved:!same(g.boundary.points,points)};gesture.current=next;setLive(next);
  };
  const up=(e:PointerEvent)=>{
    if(insertTap.current){finishInsert(e);return;}
    const g=gesture.current;if(!g||e.pointerId!==g.pointer)return;
    // Include the release coordinate even if a browser coalesced the final move event.
    move(e);const final=gesture.current!;cancel();
    if(final.problem){announce(final.problem,true);return;}if(final.moved)commit(final.boundary,final.points,final.selection);
  };
  const lost=(e:PointerEvent)=>{if(gesture.current?.pointer===e.pointerId||insertTap.current?.pointer===e.pointerId)cancel();};
  const remove=(boundary:Boundary,index:number)=>{if(boundary.points.length<=3){announce('Keep at least three points.');return;}const next={level:boundary.level,kind:'point' as const,index:Math.min(index,boundary.points.length-2)};if(commit(boundary,removeBoundaryPoint(boundary.points,index),next))focusNext.current=id(next);};
  const key=(boundary:Boundary,kind:Kind,index:number)=>(e:KeyboardEvent<HTMLButtonElement>)=>{
    if(e.key==='Escape'&&gesture.current){e.preventDefault();cancel();announce('Move cancelled.');return;}
    if(gesture.current)return;
    if(e.key==='Delete'||e.key==='Backspace'){if(kind==='point'){e.preventDefault();remove(boundary,index);}return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    try{const d=keyboardBoundaryPull(e.key,e.shiftKey?12:1,pullDirection,directionAngle());if(!d)return;e.preventDefault();if(addArmed){announce('Tap an edge first, or cancel Add pull point to move existing points.');return;}commit(boundary,moveBoundary(boundary.points,kind,index,d.x,d.y),{level:boundary.level,kind,index});}catch(error){e.preventDefault();announce((error as Error).message,true);}
  };
  const add=()=>{if(!current)return;const index=activeSelection.index,points=insertBoundaryPoint(current.points,index),next={level:current.level,kind:'point' as const,index:index+1};if(commit(current,points,next))focusNext.current=id(next);};
  const beginInsert=(boundary:Boundary,index:number,e:PointerEvent)=>{
    if(!addArmed||e.button!==0||gesture.current||insertTap.current)return;e.preventDefault();e.stopPropagation();
    if(e.isPrimary===false||activePointers.current.size>1){announce('Use one finger or pen to add a pull point.',true);return;}
    e.currentTarget.setPointerCapture?.(e.pointerId);insertTap.current={boundary,index,pointer:e.pointerId,x:e.clientX,y:e.clientY,cancelled:false};
  };
  const finishInsert=(e:PointerEvent)=>{
    const tap=insertTap.current;if(!tap||e.pointerId!==tap.pointer)return;e.preventDefault();e.stopPropagation();insertTap.current=null;
    if(tap.cancelled||Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>8){announce('Point not added. Tap one edge without dragging, then pull its new handle.');return;}
    const actual=boundaries.find(b=>b.level===tap.boundary.level);if(!actual||!same(actual.points,tap.boundary.points)||actual.offset.x!==tap.boundary.offset.x||actual.offset.y!==tap.boundary.offset.y){announce('The outline changed. Tap its current edge again.',true);return;}
    const matrix=box.current?.querySelector('svg')?.getScreenCTM();if(!matrix)return;
    const cursor=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
    try{const points=insertBoundaryPointAt(actual.points,tap.index,{x:cursor.x-actual.offset.x,y:cursor.y-actual.offset.y}),next={level:actual.level,kind:'point' as const,index:tap.index+1};if(commit(actual,points,next)){setAddArmed(false);focusNext.current=id(next);announce(`Pull point ${next.index+1} added to ${actual.name}. Drag its handle or use arrow keys.`);}}catch(error){announce((error as Error).message,true);}
  };
  const addAt=(boundary:Boundary,index:number,event:MouseEvent<SVGLineElement>)=>{
    if(gesture.current)return;event.preventDefault();event.stopPropagation();
    const matrix=event.currentTarget.getScreenCTM();if(!matrix)return;
    const cursor=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    try{const points=insertBoundaryPointAt(boundary.points,index,{x:cursor.x-boundary.offset.x,y:cursor.y-boundary.offset.y}),next={level:boundary.level,kind:'point' as const,index:index+1};if(commit(boundary,points,next))focusNext.current=id(next);}catch(error){announce((error as Error).message,true);}
  };
  const toggleLock=()=>{
    if(!current||live)return;
    const target={level:current.level,kind:'edge' as const,index:activeSelection.index};
    if(selectedLock){const remaining=(data.boundaryLocks??[]).filter(l=>l!==selectedLock);update({boundaryLocks:remaining.length?remaining:undefined});setSelection(target);onEdited?.();announce(`Edge ${activeSelection.index+1} unlocked.`);return;}
    // Unlike ordinary no-op commits, locking first saves the exact editable vertices and house/world origins.
    const patch=boundaryPatch(data,current.level,current.points,current.offset,model);
    if(!patch){announce('Save a valid outline before locking this edge.',true);return;}
    const a=current.points[activeSelection.index],b=current.points[(activeSelection.index+1)%current.points.length];
    try{const boundaryLocks=validateBoundaryLocks([...(data.boundaryLocks??[]),{level:current.level,edge:activeSelection.index,dxIn:b.x-a.x,dyIn:b.y-a.y}],{...data,...patch});update({...patch,boundaryLocks});setSelection(target);onEdited?.();announce(`Edge ${activeSelection.index+1} locked at ${ft(edgeLength)} ft and ${angleText(edgeAngle)}°. Both endpoints may move together.`);}catch(error){announce(error instanceof Error?error.message:'The edge could not be locked.',true);}
  };
  const openDimension=(boundary:Boundary,index:number)=>{
    cancel();setAddArmed(false);setSelection({level:boundary.level,kind:'edge',index});setDimensionDirty(false);setNotice('');setNoticeInvalid(false);
    const a=boundary.points[index],b=boundary.points[(index+1)%boundary.points.length];setDraftLength(ft(Math.hypot(b.x-a.x,b.y-a.y)));setDraftAngle(angleText(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI));
    setEditing({boundary:{...boundary,points:boundary.points.map(p=>({...p}))},index});
  };
  const closeDimension=()=>{const previous=editing;setEditing(null);setDimensionDirty(false);setNotice('');setNoticeInvalid(false);if(previous)requestAnimationFrame(()=>dimensionLabels.current[`${previous.boundary.level}-${previous.index}`]?.focus({preventScroll:true}));};
  const dimensionProposal=(()=>{
    const boundary=editing?.boundary??current,index=editing?.index??activeSelection.index;
    if(!boundary||!dimensionDirty&&!editing)return null;
    try{
      const a=boundary.points[index],b=boundary.points[(index+1)%boundary.points.length],length=Math.hypot(b.x-a.x,b.y-a.y),angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
      if(!draftAngle.trim()||!Number.isFinite(Number(draftAngle)))throw Error('Enter a number for the edge angle.');
      const points=setBoundaryDimension(boundary.points,index,draftLength===ft(length)?length:parseContractorLength(draftLength),draftAngle===angleText(angle)?angle:Number(draftAngle));
      const actual=boundaries.find(v=>v.level===boundary.level),stale=editing&&(!actual||!same(actual.points,boundary.points)||Math.abs(actual.offset.x-boundary.offset.x)>1e-6||Math.abs(actual.offset.y-boundary.offset.y)>1e-6);
      return {boundary,index,points,problem:stale?'This outline changed while the draft was open. Cancel and tap the current edge to review again.':boundaryProblem(points)||(!reconcileBoundaryLocks(data,boundary.level,boundary.points,points)?lockProblem:'')};
    }catch(error){return {boundary,index,points:null,problem:error instanceof Error?error.message:'Enter a valid edge dimension.'};}
  })();
  const applyDimension=()=>{
    if(!dimensionProposal){announce('This edge already has those dimensions.');return;}
    if(dimensionProposal.problem||!dimensionProposal.points){announce(dimensionProposal.problem,true);return;}
    if(commit(dimensionProposal.boundary,dimensionProposal.points,{level:dimensionProposal.boundary.level,kind:'edge',index:dimensionProposal.index})||same(dimensionProposal.boundary.points,dimensionProposal.points)){const label=`${dimensionProposal.boundary.level}-${dimensionProposal.index}`;setEditing(null);setDimensionDirty(false);requestAnimationFrame(()=>dimensionLabels.current[label]?.focus({preventScroll:true}));}
  };
  const blockingLocks=dimensionProposal?.points?(data.boundaryLocks??[]).filter(l=>l.level===dimensionProposal.boundary.level&&(()=>{const p=dimensionProposal.points!,a=p[l.edge],b=p[(l.edge+1)%p.length];return !a||!b||Math.abs(b.x-a.x-l.dxIn)>1e-6||Math.abs(b.y-a.y-l.dyIn)>1e-6;})()):[];
  const unlockBlocking=()=>{const remaining=(data.boundaryLocks??[]).filter(l=>!blockingLocks.includes(l));update({boundaryLocks:remaining.length?remaining:undefined});announce('Blocking edges unlocked. Your dimension draft is retained; review and Apply it explicitly.');};
  const dimensionFields=(inline=false)=><>
    {!inline&&<label>Edge<select aria-label="Selected boundary edge" disabled={!!live} value={activeSelection.index} onChange={e=>choose({level:current!.level,kind:'edge',index:Number(e.target.value)})}>{current!.points.map((_,index)=><option key={index} value={index}>Edge {index+1}{data.boundaryLocks?.some(l=>l.level===current!.level&&l.edge===index)?' · locked':''}</option>)}</select></label>}
    <label>Length<input ref={inline?dimensionInput:undefined} aria-label="Selected edge length" type="text" inputMode="text" autoComplete="off" disabled={!!live} value={draftLength} onChange={e=>{setDraftLength(e.target.value);setDimensionDirty(true);}} placeholder={'16\' 5 1/2"'} aria-describedby={inline?'dd-inline-dimension-help':'dd-boundary-length-help'}/></label>
    <label>Angle (°)<input aria-label="Selected edge angle in degrees" type="number" inputMode="decimal" min="-360" max="360" step="any" disabled={!!live} value={draftAngle} onChange={e=>{setDraftAngle(e.target.value);setDimensionDirty(true);}}/></label>
    <button type="submit" disabled={!!live}>Apply edge dimension</button>
  </>;
  const measureInlinePosition=()=>{
    if(!editing||!size||!box.current)return undefined;
    const a=editing.boundary.points[editing.index],b=editing.boundary.points[(editing.index+1)%editing.boundary.points.length],pos=at(world(editing.boundary,{x:(a.x+b.x)/2,y:(a.y+b.y)/2}));
    const rect=box.current.getBoundingClientRect(),viewport=box.current.closest('.dd-plan-viewport'),clip=viewport?.getBoundingClientRect()??rect,width=Math.min(300,clip.width-24);
    const x=rect.left+pos.left*viewZoom,y=rect.top+pos.top*viewZoom,navigation=viewport?.querySelector('.dd-plan-navigation')?.getBoundingClientRect(),bottom=navigation?Math.min(clip.bottom,navigation.top-8):clip.bottom,height=Math.min(inlineHeight,bottom-clip.top-24);
    const clampX=(v:number)=>Math.max(clip.left+12,Math.min(clip.right-width-12,v)),clampY=(v:number)=>Math.max(clip.top+12,Math.min(bottom-height-12,v));
    let left=clampX(x-width/2),top=clampY(y+30);
    // An endpoint that is present in the SVG must also remain visible beside the editor when space permits.
    if(dimensionProposal?.points){const p=at(world(editing.boundary,dimensionProposal.points[(editing.index+1)%dimensionProposal.points.length])),endpoint={x:rect.left+p.left*viewZoom,y:rect.top+p.top*viewZoom},clear=(l:number,t:number)=>endpoint.x<l-12||endpoint.x>l+width+12||endpoint.y<t-12||endpoint.y>t+height+12;
      if(!clear(left,top)){const alternatives=[{left:clampX(endpoint.x-width-16),top},{left:clampX(endpoint.x+16),top},{left,top:clampY(endpoint.y-height-16)},{left,top:clampY(endpoint.y+16)}].filter(v=>clear(v.left,v.top)).sort((a,b)=>(a.left-left)**2+(a.top-top)**2-((b.left-left)**2+(b.top-top)**2));if(alternatives[0])({left,top}=alternatives[0]);}
    }
    return {left:(left-rect.left)/viewZoom,top:(top-rect.top)/viewZoom,width,maxHeight:Math.max(120,bottom-clip.top-24),transform:`scale(${1/viewZoom})`};
  };
  // Measure after the parent applies pan/zoom transforms; keep the form above navigation controls.
  useLayoutEffect(()=>{const next=measureInlinePosition();setInlinePosition(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);});
  const controls=<div className="dd-boundary-controls" aria-label="Deck outline controls">
    {boundaries.length>1&&<div className="dd-boundary-levels" role="group" aria-label="Deck level">{boundaries.map(b=><button key={b.level} type="button" aria-pressed={current?.level===b.level} disabled={!!live} onClick={()=>choose({level:b.level,kind:'point',index:0})}>{b.name}</button>)}</div>}
    <div className="dd-boundary-actions"><span>{current?.name} · {description(activeSelection)}</span><button type="button" disabled={!current||!!live} aria-pressed={addArmed} onClick={()=>{cancel();setEditing(null);setAddArmed(v=>!v);announce(addArmed?'Adding a pull point cancelled.':'Tap any highlighted deck edge to place a pull point. Then drag its new handle.');}}>Add pull point</button><button type="button" disabled={!current||!!live||addArmed} onClick={add}>Add point</button><button type="button" disabled={!current||activeSelection.kind!=='point'||current.points.length<=3||!!live||addArmed} onClick={()=>current&&remove(current,activeSelection.index)}>Remove point</button></div>
    <p className="dd-boundary-help">Tap an edge length to type a dimension. Drag a point or edge; guides show nearby alignments. Double-tap an edge to add a point. Arrow keys move 1 in; Shift moves 1 ft.</p>
    <label className="dd-boundary-free"><input type="checkbox" role="switch" checked={freeMovement} onChange={e=>setFreeMovement(e.target.checked)} disabled={!!live}/>Free movement <span>{freeMovement?'Guides off':'Snaps to nearby geometry · hold Alt to bypass'}</span></label>
    <div className="dd-boundary-pull-direction"><label>Pull direction<select aria-label="Pull direction" value={pullDirection} disabled={!!live} onChange={e=>{cancel();setPullDirection(e.target.value as PullDirection);}}><option value="any">Any direction</option><option value="x">Across only (X)</option><option value="y">Out only (Y)</option><option value="custom">Custom angle</option></select></label>{pullDirection==='custom'&&<label>Pull angle (°)<input aria-label="Custom pull angle in degrees" type="number" inputMode="decimal" min="-360" max="360" step="any" value={pullAngle} disabled={!!live} onChange={e=>{cancel();setPullAngle(e.target.value);}}/></label>}<p>{pullDirection==='any'?'Pull freely; existing snapping or Free movement applies.':'Alignment snapping is off for this direction. Arrows move 1 inch along it; Shift moves 1 foot. 0° is across, 90° is out.'}</p></div>
    {current&&!editing&&<section className="dd-boundary-dimensions" aria-label="Contractor edge dimensions">
      <div className="dd-boundary-dimension-heading"><strong>Edge dimensions</strong><span className="dd-boundary-lock-state" data-locked={!!selectedLock||undefined}>{selectedLock?'Length & direction locked':'Unlocked'}</span></div>
      <form onSubmit={event=>{event.preventDefault();applyDimension();}}>{dimensionFields()}</form>
      <div className="dd-boundary-lock-actions"><button type="button" disabled={!!live} aria-pressed={!!selectedLock} onClick={toggleLock}>{selectedLock?'Unlock edge':'Lock edge'}</button><span>Starts at Point {activeSelection.index+1}; moves Point {(activeSelection.index+1)%current.points.length+1}. Adjacent edges can change.</span></div>
      {blockingLocks.some(l=>l!==selectedLock)&&<button type="button" onClick={unlockBlocking}>Unlock blocking edges {blockingLocks.map(l=>l.edge+1).join(', ')}</button>}
      <p id="dd-boundary-length-help">Bare numbers are feet. Feet/inches and fractions work: 16.5 or 16′ 5 1/2″. 0° runs right; 90° runs toward the yard. A lock keeps the exact edge vector, not the whole outline.</p>
    </section>}
    {point&&<span className="dd-boundary-position" aria-label="Selected point position">X {ft((live?.boundary.level===current?.level?live.points:current!.points)[activeSelection.index].x)} ft · Y {ft((live?.boundary.level===current?.level?live.points:current!.points)[activeSelection.index].y)} ft</span>}
    {current&&<details className="dd-boundary-fine"><summary>Fine adjust a point</summary><form onSubmit={e=>{e.preventDefault();const target=current.points[activeSelection.index],x=draftX===ft(target.x)?target.x:Number(draftX)*12,y=draftY===ft(target.y)?target.y:Number(draftY)*12;if(!draftX.trim()||!draftY.trim()||!Number.isFinite(x)||!Number.isFinite(y)){announce('Enter a number for both coordinates.');return;}commit(current,moveBoundary(current.points,'point',activeSelection.index,x-target.x,y-target.y),{...activeSelection,kind:'point'});}}>
      <label>Point<select aria-label="Selected boundary point" disabled={!!live} value={activeSelection.index} onChange={e=>choose({level:current.level,kind:'point',index:Number(e.target.value)})}>{current.points.map((_,i)=><option key={i} value={i}>Point {i+1}</option>)}</select></label>
      <label>X (ft)<input aria-label="Selected point X in feet" type="number" inputMode="decimal" step="any" disabled={!!live} value={draftX} onChange={e=>setDraftX(e.target.value)}/></label><label>Y (ft)<input aria-label="Selected point Y in feet" type="number" inputMode="decimal" step="any" disabled={!!live} value={draftY} onChange={e=>setDraftY(e.target.value)}/></label><button type="submit" disabled={!!live}>Apply</button>
    </form><p>Position within this level. Negative coordinates are allowed.</p></details>}
    {(live?.problem||notice)&&<p className="dd-boundary-notice" role="status" data-invalid={!!live?.problem||noticeInvalid||undefined}>{live?.problem||notice}</p>}
  </div>;
  const shown=[...boundaries.filter(b=>b.level!==current?.level),...boundaries.filter(b=>b.level===current?.level)];
  useLayoutEffect(()=>{
    const el=box.current;if(!size||!el)return;const rect=el.getBoundingClientRect(),viewport=el.closest('.dd-plan-viewport'),clip=viewport?.getBoundingClientRect()??rect;
    const obstacles:LabelRect[]=[...el.closest('.dd-preview')?.querySelectorAll('.dd-plan-tools,.dd-plan-navigation,[data-select-stairs]')??[]].map(node=>node.getBoundingClientRect()).filter(r=>r.left<clip.right&&r.right>clip.left&&r.top<clip.bottom&&r.bottom>clip.top);
    // Keep translated labels off the real point/edge handles, so their drag targets stay usable.
    for(const handle of Object.values(handles.current))if(handle){const r=handle.getBoundingClientRect();obstacles.push({left:r.left+7,right:r.right-7,top:r.top+7,bottom:r.bottom-7});}
    const next:Record<string,{left:number;top:number}>={};
    for(const boundary of shown)boundary.points.forEach((p,index)=>{const end=boundary.points[(index+1)%boundary.points.length],dx=end.x-p.x,dy=end.y-p.y,len=Math.hypot(dx,dy),key=`${boundary.level}-${index}`,label=dimensionLabels.current[key],pos=at(world(boundary,{x:(p.x+end.x)/2,y:(p.y+end.y)/2})),width=label?.offsetWidth??70,height=label?.offsetHeight??44;
      const point=placeBoundaryLabel({x:rect.left+pos.left*viewZoom+dy/len*34,y:rect.top+pos.top*viewZoom-dx/len*34},width,height,clip,obstacles);
      next[key]={left:(point.x-rect.left)/viewZoom,top:(point.y-rect.top)/viewZoom};obstacles.push({left:point.x-width/2,right:point.x+width/2,top:point.y-height/2,bottom:point.y+height/2});
    });
    // Ignore sub-pixel layout rounding; moving a label must not schedule another identical layout pass.
    setLabelPositions(old=>Object.keys(old).length===Object.keys(next).length&&Object.entries(next).every(([key,p])=>old[key]&&Math.abs(old[key].left-p.left)*viewZoom<.5&&Math.abs(old[key].top-p.top)*viewZoom<.5)?old:next);
  });
  return <div ref={box} className="dd-boundary-editor" data-dragging={!!live||undefined} data-add-pull={addArmed||undefined}>
    <svg viewBox={frame.viewBox} aria-hidden="true" focusable="false">{shown.map(b=><g key={b.level}><polygon className="dd-boundary-outline" data-level={b.level} data-selected={b.level===current?.level||undefined} points={b.points.map(p=>{const q=world(b,p);return `${q.x},${q.y}`;}).join(' ')}/>{b.points.map((p,index)=>{const a=world(b,p),end=world(b,b.points[(index+1)%b.points.length]),lock=data.boundaryLocks?.find(l=>l.level===b.level&&l.edge===index);return <g key={index}>{lock&&<><line className="dd-boundary-locked-edge" x1={a.x} y1={a.y} x2={end.x} y2={end.y}/><text className="dd-boundary-lock-label" x={(a.x+end.x)/2} y={(a.y+end.y)/2} dy={-30/(Math.max(scale,.01)*viewZoom)} textAnchor="middle" fontSize={12/(Math.max(scale,.01)*viewZoom)}>{ft(Math.hypot(lock.dxIn,lock.dyIn))} ft · locked</text></>}<line className="dd-boundary-insert-target" style={addArmed?{strokeWidth:44/viewZoom}:undefined} data-level={b.level} data-edge={index} x1={a.x} y1={a.y} x2={end.x} y2={end.y} onDoubleClick={e=>addAt(b,index,e)} onPointerDown={e=>beginInsert(b,index,e)} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={lost}/></g>;})}</g>)}{live&&<polygon className="dd-boundary-ghost" data-invalid={!!live.problem||undefined} points={live.points.map(p=>{const q=world(live.boundary,p);return `${q.x},${q.y}`;}).join(' ')}/>}</svg>
    <svg className="dd-boundary-feedback" viewBox={frame.viewBox} aria-hidden="true" focusable="false">
      {live?.guides.map((guide,index)=>{const a=world(live.boundary,guide.a),b=world(live.boundary,guide.b);return <g key={index}><line className="dd-boundary-snap-guide" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><text x={(a.x+b.x)/2} y={(a.y+b.y)/2} dy={-12/Math.max(.01,scale*viewZoom)} textAnchor="middle" fontSize={11/Math.max(.01,scale*viewZoom)}>{guide.label}</text></g>;})}
      {dimensionProposal?.points&&<><polygon className="dd-boundary-dimension-preview" data-invalid={!!dimensionProposal.problem||undefined} points={dimensionProposal.points.map(p=>{const q=world(dimensionProposal.boundary,p);return `${q.x},${q.y}`;}).join(' ')}/>{(()=>{const p=world(dimensionProposal.boundary,dimensionProposal.points![(dimensionProposal.index+1)%dimensionProposal.points!.length]);return <circle className="dd-boundary-dimension-endpoint" data-invalid={!!dimensionProposal.problem||undefined} cx={p.x} cy={p.y} r={8/Math.max(.01,scale*viewZoom)}/>;})()}</>}
    </svg>
    {size&&<svg className="dd-boundary-label-leaders" aria-hidden="true" focusable="false">{shown.flatMap(b=>b.points.map((p,index)=>{const end=b.points[(index+1)%b.points.length],edge=at(world(b,{x:(p.x+end.x)/2,y:(p.y+end.y)/2})),label=labelPositions[`${b.level}-${index}`];return label?<line key={`${b.level}-${index}`} x1={edge.left} y1={edge.top} x2={label.left} y2={label.top}/>:null;}))}</svg>}
    {size&&shown.flatMap(b=>b.points.map((p,index)=>{
      const end=b.points[(index+1)%b.points.length],dx=end.x-p.x,dy=end.y-p.y,len=Math.hypot(dx,dy),pos=at(world(b,{x:(p.x+end.x)/2,y:(p.y+end.y)/2})),locked=data.boundaryLocks?.some(l=>l.level===b.level&&l.edge===index),label=`${b.level}-${index}`;
      return <button key={label} ref={el=>{dimensionLabels.current[label]=el;}} type="button" className="dd-boundary-dimension-label" data-plan-editor-ui data-level={b.level} data-locked={locked||undefined} aria-label={`Edit ${b.name} edge ${index+1} dimension`} aria-haspopup="dialog" aria-expanded={editing?.boundary.level===b.level&&editing.index===index} style={{...(labelPositions[label]??{left:pos.left+dy/len*34/viewZoom,top:pos.top-dx/len*34/viewZoom}),transform:`translate(-50%,-50%) scale(${1/viewZoom})`}} onClick={()=>openDimension(b,index)}>{ft(len)} ft{locked&&<span aria-hidden="true"> · locked</span>}</button>;
    }))}
    {live?.guides.length?<div className="dd-boundary-snap-status" role="status">{[...new Set(live.guides.map(g=>g.label))].join(' · ')}</div>:null}
    {editing&&<section ref={dimensionPanel} role="dialog" aria-label="Edit edge dimension" aria-modal="false" className="dd-boundary-inline dd-boundary-controls" style={inlinePosition} onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeDimension();}}}>
      <div className="dd-boundary-inline-heading"><strong>{editing.boundary.name} · Edge {editing.index+1}</strong><button type="button" aria-label="Cancel edge dimension" onClick={closeDimension}>×</button></div>
      <p id="dd-inline-dimension-help">Start stays fixed. The highlighted endpoint moves. Decimal feet or feet/inches.</p>
      <form onSubmit={e=>{e.preventDefault();applyDimension();}}>{dimensionFields(true)}</form>
      <div className="dd-boundary-inline-actions"><button type="button" onClick={closeDimension}>Cancel</button>{selectedLock&&<button type="button" onClick={toggleLock}>Unlock edge</button>}</div>
      {blockingLocks.some(l=>l!==selectedLock)&&<button type="button" onClick={unlockBlocking}>Unlock blocking edges {blockingLocks.map(l=>l.edge+1).join(', ')}</button>}
      {dimensionProposal?.problem&&<p className="dd-boundary-notice" role="status" data-invalid>{dimensionProposal.problem}</p>}
    </section>}
    {size&&shown.flatMap(b=>{
      const points=live?.boundary.level===b.level?live.points:b.points;
      const list:{kind:Kind;index:number;point:PlanPoint}[]=[...points.map((p,index)=>({kind:'point' as const,index,point:p})),...points.map((p,index)=>({kind:'edge' as const,index,point:{x:(p.x+points[(index+1)%points.length].x)/2,y:(p.y+points[(index+1)%points.length].y)/2}})),{kind:'area',index:0,point:centre(points)}];
      return list.map(h=>{const target={level:b.level,kind:h.kind,index:h.index},selected=id(activeSelection)===id(target),active=live&&id(live.selection)===id(target);return <button key={id(target)} ref={el=>{handles.current[id(target)]=el;}} type="button" className={`dd-boundary-handle dd-boundary-${h.kind}`} data-level={b.level} data-selected={selected||undefined} data-level-selected={b.level===current?.level||undefined} data-locked={h.kind==='edge'&&data.boundaryLocks?.some(l=>l.level===b.level&&l.edge===h.index)||undefined} data-active={!!active||undefined} data-invalid={!!active&&!!live?.problem||undefined} style={{...at(world(b,h.point)),transform:`translate(-50%,-50%) scale(${1/viewZoom})`}} aria-label={`${b.name} ${h.kind==='area'?'move whole level':h.kind==='point'?`point ${h.index+1}`:`edge ${h.index+1}`}`} aria-pressed={selected} aria-description={h.kind==='edge'&&data.boundaryLocks?.some(l=>l.level===b.level&&l.edge===h.index)?'Edge length and direction locked. Move both endpoints together.':undefined} aria-describedby="dd-boundary-key-help" onFocus={()=>{if(!selected)choose(target);}} onClick={e=>{if(e.detail===0)choose(target);}} onPointerDown={down(b,h.kind,h.index)} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={lost} onKeyDown={key(b,h.kind,h.index)}><span aria-hidden="true">{h.kind==='point'?'':h.kind==='edge'?'↔':'Move'}</span></button>;});
    })}
    <span id="dd-boundary-key-help" className="dd-boundary-sr">Drag in any direction, or use arrow keys for one inch and Shift with arrows for one foot. Escape cancels a move. Delete removes a point.</span>
    {toolbar?.current?createPortal(controls,toolbar.current):<div className="dd-boundary-toolbar">{controls}</div>}
  </div>;
}
