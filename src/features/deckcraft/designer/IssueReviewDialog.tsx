import {useEffect,useMemo,useRef,useState} from 'react';
import type {DeckData} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import {actionableIssues,type IssueAction} from './actionableIssues';
import './easyEditTools.css';
import {SECTION_BY_ID,type SectionId} from './sections';

export default function IssueReviewDialog({data,model,messages,onLocate,onClose}:{data:DeckData;model:DeckTakeoff;messages:readonly string[];onLocate:(action:IssueAction)=>void;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),opener=useRef(document.activeElement as HTMLElement|null);
  const issues=useMemo(()=>actionableIssues(data,model,messages),[data,model,messages]);
  const [filter,setFilter]=useState<SectionId|'all'>('all');
  const sections=[...new Set(issues.map(i=>i.actions[0].section))];
  const visible=filter==='all'?issues:issues.filter(i=>i.actions.some(a=>a.section===filter));
  useEffect(()=>{dialog.current?.showModal();return ()=>{dialog.current?.close();opener.current?.focus();};},[]);
  return <dialog ref={dialog} className="dd-easy-dialog" aria-labelledby="dd-issue-review-title" onCancel={e=>{e.preventDefault();onClose();}}>
    <header><div><small>DESIGN REVIEW</small><h2 id="dd-issue-review-title">Construction readiness</h2></div><button type="button" aria-label="Close issue review" onClick={onClose}>×</button></header>
    <div className="dd-easy-dialog-body"><p>Choose a notice to reach the relevant part or settings. Site measurements stay unchanged until you explicitly apply an edit.</p><p><strong>{issues.length} review items</strong> · {issues.filter(i=>i.actions.some(a=>a.partIds?.length)).length} located in the design. This checklist does not certify engineering or permit approval.</p><label>Review area<select aria-label="Review area" value={filter} onChange={e=>setFilter(e.target.value as SectionId|'all')}><option value="all">All areas ({issues.length})</option>{sections.map(id=><option key={id} value={id}>{SECTION_BY_ID[id].name} ({issues.filter(i=>i.actions.some(a=>a.section===id)).length})</option>)}</select></label>
    {!issues.length?<p role="status">No current design warnings. Supplier and site quotes may still be required.</p>:<ul className="dd-issue-list">{visible.map(issue=><li key={issue.id} data-issue-id={issue.id}><p>{issue.message}</p>{issue.actions.map(action=><div key={action.label}><button type="button" onClick={()=>onLocate(action)}>{action.label}</button><small>{action.guidance}</small></div>)}</li>)}</ul>}</div>
    <footer><button type="button" onClick={onClose}>Back to design</button></footer>
  </dialog>;
}
