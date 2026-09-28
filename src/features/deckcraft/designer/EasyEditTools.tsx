import {useLayoutEffect,useRef} from 'react';
import './easyEditTools.css';
export default function EasyEditTools({onAsk,onJobs,onIssues,issues,ready,autosaveState,savedAt,jobLabel}:{onAsk:()=>void;onJobs:()=>void;onIssues:()=>void;issues:number;ready:boolean;autosaveState:'loading'|'saving'|'saved'|'error';savedAt:string;jobLabel:string}){
  const tools=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{
    const element=tools.current,workspace=element?.closest<HTMLElement>('.deck-designer');if(!element||!workspace)return;
    const measure=()=>workspace.style.setProperty('--dd-easy-tools-height',`${element.getBoundingClientRect().height}px`);
    measure();const observer=new ResizeObserver(measure);observer.observe(element);
    return ()=>{observer.disconnect();workspace.style.removeProperty('--dd-easy-tools-height');};
  },[]);
  return <section ref={tools} className="dd-easy-tools" aria-label="Contractor job tools">
    <div><strong>{jobLabel||'Current design'}</strong><span role="status" data-autosave-state={autosaveState}>{autosaveState==='saved'?`Saved on this device${savedAt?` at ${new Date(savedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:''}`:autosaveState==='saving'?'Saving changes…':autosaveState==='error'?'Not saved · use Save JSON':'Restoring design…'}</span></div>
    <div><button type="button" className="dd-easy-ask" disabled={!ready} onClick={onAsk}>Describe a change</button><button type="button" disabled={!ready} onClick={onJobs}>Jobs &amp; versions</button><button type="button" disabled={!ready} onClick={onIssues}>Review {issues} {issues===1?'issue':'issues'}</button></div>
  </section>;
}
