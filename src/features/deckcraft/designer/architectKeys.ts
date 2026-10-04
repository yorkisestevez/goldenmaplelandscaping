import {useEffect,useRef} from 'react';
export function architectKey(e:Pick<KeyboardEvent,'key'|'ctrlKey'|'metaKey'|'altKey'|'shiftKey'>){if(e.altKey)return '';return ((e.ctrlKey||e.metaKey)?'ctrl+':'')+(e.shiftKey?'shift+':'')+e.key.toLowerCase();}
export function useArchitectKeys(actions:Record<string,()=>void|boolean>,enabled=true,inDialog=false){
 const latest=useRef(actions);latest.current=actions;
 useEffect(()=>{if(!enabled)return;const key=(e:KeyboardEvent)=>{
  const t=e.target as HTMLElement|null;if(e.defaultPrevented||e.isComposing||t?.closest('input,textarea,select,[contenteditable=true],[role=textbox]'))return;
  if(!inDialog&&document.querySelector('dialog[open],[role=dialog]'))return;
  if(inDialog&&e.key!=='F1'&&document.querySelector('dialog[open]'))return;
  const fn=latest.current[architectKey(e)];if(!fn||e.repeat)return;
  if(e.key==='Enter'&&t?.closest('button,summary,a'))return;
  if(fn()!==false){e.preventDefault();e.stopPropagation();}
 };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[enabled,inDialog]);
}
export function revealControl(el:HTMLElement|null){if(!el)return false;let p:HTMLElement|null=el;while(p){if(p instanceof HTMLDetailsElement)p.open=true;p=p.parentElement;}el.scrollIntoView({block:'nearest'});el.focus();}
