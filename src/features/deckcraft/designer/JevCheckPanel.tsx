import {useState,type CSSProperties} from 'react';

/**
 * Staff-only design-rule check, shown when the designer is opened with `?jevcheck=1`. It posts the current design
 * JSON to the internal route (server/jevDesignCheck.ts) and lists the rules that fail or need a look.
 *
 * The route needs the internal token. It is typed once and kept in sessionStorage for this tab; it is never put in
 * the page, a URL or a design file. Nothing here opens a proposal, a share link, the send form or the AI assistant.
 * The styles are inline so the designer's own stylesheet does not grow.
 */
const ROUTE='/.netlify/functions/jev-design-check',TOKEN_KEY='deckcraft.jev-route-token';
interface Rule {id:string;label:string;applies:boolean;pass:boolean;confidence:number;unsure:boolean;note?:string;evidence:string[]}
interface Report {pass:boolean;needsReview:boolean;rules:Rule[];warnings:string[];model:string;costUsd:number}
type State={status:'idle'|'busy'}|{status:'done';report:Report}|{status:'error';message:string};

const card:CSSProperties={position:'fixed',left:12,bottom:12,zIndex:60,width:'min(360px, calc(100vw - 24px))',maxHeight:'70vh',overflow:'auto',padding:12,borderRadius:8,border:'1px solid #c9c2b4',background:'#fffdf8',color:'#1f2a22',font:'13px/1.4 system-ui, sans-serif',boxShadow:'0 6px 24px rgba(0,0,0,.18)'};
const button:CSSProperties={padding:'6px 10px',borderRadius:6,border:'1px solid #1f2a22',background:'#1f2a22',color:'#fffdf8',font:'inherit',cursor:'pointer'};
const tone=(rule:Rule)=>!rule.pass?'#9b1c1c':rule.unsure?'#8a5a00':'#1d6b3a';

function storedToken():string{try{return sessionStorage.getItem(TOKEN_KEY)??'';}catch{return '';}}
function keepToken(value:string){try{if(value)sessionStorage.setItem(TOKEN_KEY,value);else sessionStorage.removeItem(TOKEN_KEY);}catch{/* private window: ask again next time */}}

export default function JevCheckPanel({design}:{design:()=>string}){
 const [state,setState]=useState<State>({status:'idle'});
 async function run(){
  const token=storedToken()||window.prompt('Internal design-check token')?.trim()||'';
  if(!token)return;
  setState({status:'busy'});
  try{
   const response=await fetch(ROUTE,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:design()});
   const body=await response.json().catch(()=>null) as (Report&{ok?:boolean;error?:{message?:string}})|null;
   if(response.status===401){keepToken('');setState({status:'error',message:'That token was not accepted. Press the button to enter it again.'});return;}
   keepToken(token);
   // A dev server without functions answers 404 or 405 with no JSON.
   if(!body&&(response.status===404||response.status===405)){setState({status:'error',message:'The check route is not served here. It runs on the deployed site or under netlify dev.'});return;}
   if(!response.ok||!body?.ok){setState({status:'error',message:body?.error?.message??`The check could not run (${response.status}).`});return;}
   setState({status:'done',report:body});
  }catch{setState({status:'error',message:'The check could not be reached. It runs on the deployed site or under netlify dev.'});}
 }
 const report=state.status==='done'?state.report:null,flagged=report?report.rules.filter(r=>!r.pass||r.unsure):[];
 return <aside style={card} aria-label="Design rule check">
  <button type="button" style={{...button,opacity:state.status==='busy'?.6:1}} disabled={state.status==='busy'} onClick={()=>void run()}>{state.status==='busy'?'Checking…':'Check design rules'}</button>
  {state.status==='error'&&<p role="alert" style={{margin:'8px 0 0',color:'#9b1c1c'}}>{state.message}</p>}
  {report&&<div role="status" style={{marginTop:8}}>
   <p style={{margin:'0 0 6px',fontWeight:600,color:report.pass?'#1d6b3a':'#9b1c1c'}}>{report.pass?`All ${report.rules.length} rules pass${report.needsReview?', some need a look':''}.`:`${report.rules.filter(r=>!r.pass).length} of ${report.rules.length} rules fail.`}</p>
   <ul style={{margin:0,padding:0,listStyle:'none'}}>{flagged.map(rule=><li key={rule.id} style={{margin:'0 0 8px'}}>
    <strong style={{color:tone(rule)}}>{rule.pass?'Check':'Fails'}: {rule.label}</strong> <span>({Math.round(rule.confidence*100)}% sure)</span>
    {rule.note&&<div>{rule.note}</div>}
    {rule.evidence.length>0&&<ul style={{margin:'2px 0 0',paddingLeft:16}}>{rule.evidence.map(line=><li key={line}>{line}</li>)}</ul>}
   </li>)}</ul>
   {report.warnings.map(line=><p key={line} style={{margin:'0 0 6px',color:'#8a5a00'}}>{line}</p>)}
   <p style={{margin:0,color:'#5b6259'}}>{report.model} · ${report.costUsd.toFixed(4)}</p>
  </div>}
 </aside>;
}
