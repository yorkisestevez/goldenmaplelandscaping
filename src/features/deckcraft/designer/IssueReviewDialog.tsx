import {useEffect,useMemo,useRef} from 'react';
import type {DeckData} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import {actionableIssues,type IssueAction} from './actionableIssues';
import './easyEditTools.css';

export default function IssueReviewDialog({data,model,messages,onLocate,onClose}:{data:DeckData;model:DeckTakeoff;messages:readonly string[];onLocate:(action:IssueAction)=>void;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),opener=useRef(document.activeElement as HTMLElement|null);
  const issues=useMemo(()=>actionableIssues(data,model,messages),[data,model,messages]);
  useEffect(()=>{dialog.current?.showModal();return ()=>{dialog.current?.close();opener.current?.focus();};},[]);
  return <dialog ref={dialog} className="dd-easy-dialog" aria-labelledby="dd-issue-review-title" onCancel={e=>{e.preventDefault();onClose();}}>
    <header><div><small>DESIGN REVIEW</small><h2 id="dd-issue-review-title">Find and resolve issues</h2></div><button type="button" aria-label="Close issue review" onClick={onClose}>×</button></header>
    <div className="dd-easy-dialog-body"><p>Choose a notice to reach the relevant part or settings. Site measurements stay unchanged until you explicitly apply an edit.</p>
    {!issues.length?<p role="status">No current design warnings. Supplier and site quotes may still be required.</p>:<ul className="dd-issue-list">{issues.map(issue=><li key={issue.id} data-issue-id={issue.id}><p>{issue.message}</p>{issue.actions.map(action=><div key={action.label}><button type="button" onClick={()=>onLocate(action)}>{action.label}</button><small>{action.guidance}</small></div>)}</li>)}</ul>}</div>
    <footer><button type="button" onClick={onClose}>Back to design</button></footer>
  </dialog>;
}
