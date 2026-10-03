import {useState} from 'react';
import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import {getFramelessSystem} from './framelessSystems';
import {buildRailingJobPack,railingReviewStatus,validateRailingReview,validReviewDate,RAILING_MUNICIPAL_REFERENCES,type RailingReviewId} from './railingJobPack';

export default function RailingDocumentsPanel({data,model,onChange}:{data:DeckData;model:DeckTakeoff;onChange:(patch:Partial<DeckData>)=>void}){
 const review=railingReviewStatus(data),system=getFramelessSystem(data);
 const [stageId,setStageId]=useState<RailingReviewId>('site'),[reference,setReference]=useState(''),[reviewer,setReviewer]=useState(''),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[message,setMessage]=useState('');
 const stage=review.stages.find(s=>s.id===stageId)!;
 const select=(id:RailingReviewId)=>{const record=review.stages.find(s=>s.id===id)?.record;setStageId(id);setReference(record?.reference??'');setReviewer(record?.reviewer??'');setDate(record?.date??new Date().toISOString().slice(0,10));setMessage('');};
 const record=()=>{
  if(!reference.trim()||!reviewer.trim()||!validReviewDate(date)){setMessage('Enter a document reference, responsible reviewer and valid date.');return;}
  const records=review.stages.flatMap(s=>s.record&&s.id!==stageId?[s.record]:[]);
  const next=validateRailingReview({records:[...records,{id:stageId,reference,reviewer,date,designKey:review.key}]});
  if(!next.records.some(r=>r.id===stageId)){setMessage('Reference could not be saved. Shorten text or review this design with the project coordinator.');return;}
  onChange({railingReview:next});setMessage('Reference recorded for this design revision. This is not a verified document or approval.');
 };
 const download=()=>{const blob=new Blob([buildRailingJobPack(data,model)],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='deckcraft-railing-job-pack.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Job pack downloaded. Open the HTML and use your browser’s Print → Save as PDF. Referenced documents are not embedded.');};
 return <section aria-label="Railing documents and job pack" style={{borderTop:'1px solid #cad5d9',paddingTop:16,marginTop:20}}>
  <h3>Builder handoff &amp; document register</h3>
  <p className="dd-note">Track the evidence a supplier, designer and crew need. A reference is not an uploaded document, engineering verification or permit approval.</p>
  <p role="status"><strong>{review.recorded} / 8 recorded</strong> · {review.missing} missing · {review.stale} stale</p>
  <p className="dd-note">Design changes invalidate affected review references. Recheck and record each stage individually. This tracker never certifies a design as permit-ready.</p>
  <details open><summary>Document and responsibility register</summary>
   <div style={{display:'grid',gap:6,margin:'12px 0'}}>{review.stages.map(s=><button type="button" key={s.id} className="dd-secondary" style={{textAlign:'left'}} aria-pressed={s.id===stageId} onClick={()=>select(s.id)}>{s.title} · {s.status}</button>)}</div>
   <h4>{stage.title}</h4><p className="dd-note"><strong>{stage.owner}</strong> — {stage.task}</p>
   {stage.record&&<p className="dd-note">Saved reference: {stage.record.reference}<br/>{stage.record.reviewer} · {stage.record.date} · {stage.status}{stage.status==='stale'?' — review changed design before reconfirming':''}</p>}
   <label className="dd-field">Document / revision or project record reference<input aria-label="Railing document reference" maxLength={240} value={reference} placeholder="e.g. Supplier shop drawing R2 / project folder reference" onChange={e=>setReference(e.target.value)}/></label>
   <label className="dd-field">Responsible reviewer<input aria-label="Railing responsible reviewer" maxLength={240} value={reviewer} placeholder="Name and role" onChange={e=>setReviewer(e.target.value)}/></label>
   <label className="dd-field">Review date<input type="date" aria-label="Railing review date" value={date} onChange={e=>setDate(e.target.value)}/></label>
   <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" className="dd-secondary" onClick={record}>Record reference for current design</button>{stage.record&&<button type="button" className="dd-secondary" onClick={()=>{onChange({railingReview:{records:review.stages.flatMap(s=>s.record&&s.id!==stageId?[s.record]:[])}});setReference('');setMessage('Reference removed. This stage is missing.');}}>Remove reference</button>}</div>
  </details>
  <details style={{margin:'16px 0'}}><summary>Installation hold points &amp; source documents</summary>
   <ol className="dd-note">{(system?.installationNotes??['Obtain the exact model’s installation manual and project-specific guard anchorage/substrate detail.']).map(n=><li key={n}>{n}</li>)}</ol>
   {system?.limitations.map(n=><p className="dd-note" key={n}>{n}</p>)}
   <ul>{[...(system?.documents??[]),...RAILING_MUNICIPAL_REFERENCES].map(d=><li key={d.url}><a href={d.url} target="_blank" rel="noreferrer">{d.title}</a></li>)}</ul>
   <p className="dd-note">Guelph Eramosa’s 2024 package requests pre-engineered details for non-wood guards. It is a local example, not a province-wide permit checklist. Confirm current requirements with your municipality.</p>
  </details>
  <button type="button" className="dd-secondary" onClick={download}>Download printable railing job pack</button>
  <p className="dd-note">Includes the design snapshot, schematic section schedule, missing/stale references, installation hold points and source links. Open the HTML and print to PDF. Not construction drawings or an approval package.</p>
  {message&&<p role="status" className="dd-note">{message}</p>}
 </section>;
}
