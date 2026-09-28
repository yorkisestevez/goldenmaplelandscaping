import {useEffect,useRef,type PointerEvent,type MouseEvent} from 'react';
/** Buttons only: native touch/pen activation with cancellation and compatibility-click deduplication. */
export function useAssistantButtonTaps(){
 const pointers=useRef(new Set<number>()),handled=useRef(new WeakSet<EventTarget>()),tap=useRef<{id:number;x:number;y:number;button:HTMLButtonElement}|null>(null);
 useEffect(()=>{const down=(e:globalThis.PointerEvent)=>{if(!pointers.current.size||e.pointerType==='mouse')handled.current=new WeakSet();pointers.current.add(e.pointerId);if(pointers.current.size>1)tap.current=null;},up=(e:globalThis.PointerEvent)=>{pointers.current.delete(e.pointerId);if(e.type==='pointercancel')tap.current=null;},reset=()=>{pointers.current.clear();tap.current=null;};document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);window.addEventListener('blur',reset);return()=>{document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);window.removeEventListener('blur',reset);};},[]);
 return {
  onPointerDown:(e:PointerEvent<HTMLElement>)=>{if(e.pointerType==='mouse'){tap.current=null;return;}const button=(e.target as Element).closest('button');if(button)handled.current.add(button);tap.current=e.isPrimary&&e.button===0&&pointers.current.size===1&&button instanceof HTMLButtonElement&&!button.disabled&&e.currentTarget.contains(button)?{id:e.pointerId,x:e.clientX,y:e.clientY,button}:null;},
  onPointerMove:(e:PointerEvent<HTMLElement>)=>{if(tap.current?.id===e.pointerId&&Math.hypot(e.clientX-tap.current.x,e.clientY-tap.current.y)>8)tap.current=null;},
  onPointerCancel:()=>{tap.current=null;},
  onPointerUp:(e:PointerEvent<HTMLElement>)=>{const candidate=tap.current;tap.current=null;if(!candidate||candidate.id!==e.pointerId||candidate.button.disabled||!candidate.button.isConnected||(e.target as Element).closest('button')!==candidate.button||Math.hypot(e.clientX-candidate.x,e.clientY-candidate.y)>8)return;e.preventDefault();candidate.button.click();},
  onClickCapture:(e:MouseEvent<HTMLElement>)=>{const button=(e.target as Element).closest('button'),type=(e.nativeEvent as globalThis.PointerEvent).pointerType;if(button&&(type==='touch'||type==='pen'||e.nativeEvent.isTrusted&&e.detail>0&&handled.current.has(button))){e.preventDefault();e.stopPropagation();}},
 };
}
