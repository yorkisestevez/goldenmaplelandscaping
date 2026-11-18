import {useEffect,useLayoutEffect,useRef} from 'react';
import './easyEditTools.css';
import {designIssues} from './reviewNotes';
/** The design's name and save state. It also counts the review issues for the price bar, which links to them: the count
 * needs reviewNotes, which stays out of the page's first load. The assistant, saved jobs and issues are in Designer Mode's menus. */
export default function EasyEditTools({onIssueCount,issues,autosaveState,savedAt,jobLabel}:{onIssueCount:(count:number)=>void;issues:readonly string[];autosaveState:'loading'|'saving'|'saved'|'error';savedAt:string;jobLabel:string}){
  const tools=useRef<HTMLElement>(null),count=designIssues(issues).length;
  useEffect(()=>{onIssueCount(count);},[count,onIssueCount]);
  useLayoutEffect(()=>{
    const element=tools.current,workspace=element?.closest<HTMLElement>('.deck-designer');if(!element||!workspace)return;
    const measure=()=>workspace.style.setProperty('--dd-easy-tools-height',`${element.getBoundingClientRect().height}px`);
    measure();const observer=new ResizeObserver(measure);observer.observe(element);
    return ()=>{observer.disconnect();workspace.style.removeProperty('--dd-easy-tools-height');};
  },[]);
  return <section ref={tools} className="dd-easy-tools" aria-label="Contractor job tools">
    <div><strong>{jobLabel||'Current design'}</strong><span role="status" data-autosave-state={autosaveState}>{autosaveState==='saved'?`Saved on this device${savedAt?` at ${new Date(savedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:''}`:autosaveState==='saving'?'Saving changes…':autosaveState==='error'?'Not saved · use Save JSON':'Restoring design…'}</span></div>
  </section>;
}
