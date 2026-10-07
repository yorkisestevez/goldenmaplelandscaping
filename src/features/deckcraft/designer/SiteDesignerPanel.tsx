import {useEffect,useRef,useState} from 'react';
import type {CompassPoint,DeckData} from '../types';
import type {SiteConcept,SiteConceptsResult,SiteGoal} from '../siteConcepts';
import type {SiteMoveKind} from '../siteDesignMoves';
import type {DesignerAiStatus,DesignerAiTurn} from './siteDesignerAiContract';
import type {DesignerTurnResult} from './siteDesignerAiClient';
import {COMPASS_POINTS,COMPASS_WORDS} from '../permitSite';
import {DESIGN_TRENDS_STATUS} from '../designTrends';
import {dollars} from '../designFacts';
import type {Update} from './fields';
import {useHardscapePreview} from './useHardscapePreview';
import './siteDesignerPanel.css';

/**
 * S5 "Design from my ground": the AI Site Designer's panel. Lazy everywhere it is mounted; the site brief loads on open
 * and the concept engine (siteConcepts.ts) on "Show concepts". Preview stages a concept through the shared guarded
 * preview (the 3D shows it, nothing is written); Apply sends its patch once, so one Undo restores the design. Any design
 * change drops the concepts and stops a run in progress. The AI designer (siteDesignerAiClient.ts, loaded on demand) is
 * optional: a turn always carries the engine's concepts, and when the AI is not available the panel says why in one line
 * while the engine's concepts work on their own.
 */

type AiReason=NonNullable<DesignerAiStatus['reason']>;
/** Reasons that switch the AI designer off for this visit (not configured, the monthly cap, today's turns). */
const AI_OFF:readonly AiReason[]=['not_configured','cap_reached','rate_limited'];
/** Why the AI designer cannot be asked, in one plain line; the engine's concepts always still work. */
export function aiUnavailableLine(reason?:string):string{
 switch(reason){
  case 'not_configured':return 'The AI designer isn’t switched on for this site yet, so these concepts come from your measured ground alone.';
  case 'cap_reached':return 'The AI designer is resting until next month. The concepts below still come from your measured ground.';
  case 'rate_limited':return 'You’ve used today’s AI designer turns. Try again tomorrow; the concepts below still work.';
  default:return 'The AI designer isn’t available right now. The concepts below still come from your measured ground.';
 }
}
/** What the panel shows for one AI designer turn (siteDesignerAiClient.ts runDesignerTurn), by its status:
 * designed → the AI designer's pick, built and priced by the engine; clarify → its questions; fallback → the engine's own
 * concept it started from, with a plain note; engine-only → one line (and, for not configured, the monthly cap or today's
 * turns, the AI designer switched off for this visit); pending → one line. `remaining`: the turns left today, from the
 * answer's own count when it has one. */
export interface DesignerTurnOutcome {show:'pick'|'fallback'|'clarify'|'line';line?:string;off?:AiReason;remaining?:number}
export function designerTurnOutcome(a:Pick<DesignerTurnResult,'status'|'concept'|'reason'|'message'|'response'|'warnings'>):DesignerTurnOutcome{
 const left=a.response?.meta?.remainingTurnsToday,remaining=typeof left==='number'&&Number.isFinite(left)?Math.max(0,Math.floor(left)):undefined;
 const out=(o:DesignerTurnOutcome):DesignerTurnOutcome=>({...o,...(remaining!==undefined?{remaining}:{})});
 switch(a.status){
  case 'designed':return a.concept?out({show:'pick'}):out({show:'line',line:aiUnavailableLine('unavailable')});
  case 'fallback':return a.concept?out({show:'fallback',line:a.message||'The AI designer’s choice did not check out on your measured ground, so this is the engine’s own concept it started from.'}):out({show:'line',line:aiUnavailableLine('unavailable')});
  case 'clarify':return out({show:'clarify'});
  case 'engine-only':{const r=a.reason;
   if(r&&AI_OFF.includes(r))return out({show:'line',off:r,line:aiUnavailableLine(r),...(r==='rate_limited'?{remaining:0}:{})});
   return out({show:'line',line:a.message||aiUnavailableLine(r)});}
  default:return out({show:'line',line:a.warnings[0]??'The AI designer needs measured ground first: import survey readings, then ask again.'});
 }
}

// ---- Words ----
const MOVE_LABEL:Record<SiteMoveKind,string>={'ground-fit':'Ground fit','raised-patio':'Raised patio','fire-room':'Fire room','seat-wall':'Seat wall','terraced-beds':'Terraced beds','raised-beds':'Raised beds','planting':'Planting','stone-steps':'Stone steps'};
const GOALS:readonly [SiteGoal,string,string][]=[['value','Value for money','fit the slope for less'],['entertaining','Entertaining','a patio room round a fire'],['garden','Gardening','beds and terraces']];
const GOAL_LABEL=Object.fromEntries(GOALS.map(([g,l])=>[g,l])) as Record<SiteGoal,string>;
const signed=(n:number)=>`${n>0?'+':'−'}${dollars(Math.abs(n))}`;
/** Compass bearing (degrees clockwise from north) the back yard faces, as siteBrief's northDegFromYardFaces. */
const bearing=(p:CompassPoint)=>COMPASS_POINTS.indexOf(p)*45;
const title=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
const plural=(n:number,one:string,many=`${one}s`)=>`${n} ${n===1?one:many}`;
const pluralWord=(w:string)=>/[^aeiou]y$/i.test(w)?`${w.slice(0,-1)}ies`:/(?:s|x|z|ch|sh)$/i.test(w)?`${w}es`:`${w}s`;

/** One thing still to quote, and the estimate's own quote lines behind it. */
export interface QuoteKind {kind:string;labels:string[]}
const QUOTE_SUBJECT=/^(.+?)(?::\s+|\s+—\s+)(.+)$/;
/**
 * Quote lines grouped by what they are for, so a concept with two terrace walls reads "plus 3 items by quote", not "plus
 * 46 lines by quote": the feature named before ": " or " — " with its number taken off is the item ("Terrace wall 1:
 * Geogrid installation" and "Terrace wall 2: Drain outlet fittings" are both "Terrace walls"); a line with no feature
 * name is an item of its own. In first-seen order; each item keeps its exact lines. siteConcepts.ts quoteKindCount
 * counts the same way for the engine's own words (keep the two in step).
 */
export function quoteKinds(labels:readonly string[]):QuoteKind[]{
 const groups=new Map<string,{base:string;subjects:Set<string>;labels:string[]}>();
 for(const label of labels){
  const m=QUOTE_SUBJECT.exec(label),subject=(m?m[1]:label).trim(),base=(m?subject.replace(/\s*#?\d+$/,''):subject)||subject,key=base.toLowerCase();
  const g=groups.get(key)??{base,subjects:new Set<string>(),labels:[]};g.subjects.add(subject);if(!g.labels.includes(label))g.labels.push(label);groups.set(key,g);
 }
 return [...groups.values()].map(g=>({kind:g.subjects.size>1?pluralWord(g.base):g.base,labels:g.labels}));
}

/**
 * A concept's price effect against the design as it stands, in the option-delta words: "+$12,340", "−$380", "no change",
 * never "$0" beside a quote ("+$13,860 plus 3 items by quote", "1 item by quote"). Quoted work is counted by what it is
 * for (quoteKinds), not per wall or bed. With the baseline, the dollars are the concept's subtotal less the baseline's,
 * each rounded as shown, so the baseline plus the effect is the card's subtotal.
 */
export function conceptPriceEffect(c:Pick<SiteConcept,'subtotal'|'delta'|'quotes'|'newQuotes'>,baseline?:{subtotal:number;quotes:readonly string[]}):{kind:'up'|'down'|'none'|'quote';text:string}{
 const amount=baseline?Math.round(c.subtotal)-Math.round(baseline.subtotal):Math.round(c.delta),added=quoteKinds(c.newQuotes).length,dropped=baseline?quoteKinds(baseline.quotes.filter(q=>!c.quotes.includes(q))).length:0;
 const extra=added?`${plural(added,'item')} by quote`:'',fewer=dropped?` · ${dropped} fewer to quote`:'';
 if(amount)return {kind:extra?'quote':amount>0?'up':'down',text:`${signed(amount)}${extra?` plus ${extra}`:''}${fewer}`};
 if(extra)return {kind:'quote',text:`${extra}${fewer}`};
 return {kind:'none',text:`no change${fewer}`};
}
/**
 * The engine's cost and execution scores as plain words, never raw numbers: "lowest cost" and "easiest to build" mark the
 * best of the cards shown; otherwise the build is "straightforward", "moderate" or "bigger". With a budget, whether the
 * concept stays within it. Trend words only once the owner approves the trend table (DESIGN_TRENDS_STATUS).
 */
export function conceptStrengths(c:SiteConcept,all:readonly SiteConcept[],budget?:number):string[]{
 const out:string[]=[],many=all.length>1&&all.includes(c),best=(f:(x:SiteConcept)=>number)=>{const v=all.map(f),top=Math.max(...v);return many&&f(c)===top&&top>Math.min(...v)&&v.filter(x=>x===top).length===1;};
 if(budget!==undefined)out.push(c.delta<=budget?'within your budget':`${dollars(c.delta-budget)} over your budget`);
 if(best(x=>x.scores.cost))out.push('lowest cost');
 if(best(x=>x.scores.execution))out.push('easiest to build');
 else out.push(c.scores.execution>=.85?'straightforward to build':c.scores.execution>=.6?'a moderate build':'a bigger build');
 if((DESIGN_TRENDS_STATUS as string)==='approved'&&c.scores.trend!==null&&c.scores.trend>=.5)out.push('in step with this year’s outdoor design');
 return out;
}
/** The engine's reasons less what the card says elsewhere: the measured summary (the brief above), the price line, Barrie. */
const cardReasons=(c:SiteConcept)=>c.reasons.filter(r=>!/^Measured: /.test(r)&&!/^It (?:prices|adds) /.test(r)&&!/Barrie/.test(r));
/** The Barrie fire rule for a concept with a fire feature: the engine's own sentence (with its distances), else the move's. */
function fireNote(c:SiteConcept){
 const fire=c.moves.find(m=>m.kind==='fire-room');if(!fire)return '';
 return c.reasons.find(r=>/Barrie/.test(r))??fire.notes.find(n=>/Barrie/.test(n))??'Barrie: a wood fire needs a City of Barrie permit and its clearances; a gas fire table needs none, but its hook-up is by a licensed gas contractor.';
}
/** "Measure about N ft further …" guidance from the moves the concepts could not place, once each. */
export function measureGuidance(result:Pick<SiteConceptsResult,'concepts'|'warnings'>){
 const out:string[]=[];
 for(const line of [...result.concepts.flatMap(c=>c.skipped.map(s=>`${MOVE_LABEL[s.kind]}: ${s.reason}`)),...result.warnings])if(/Measure about/.test(line)&&!out.includes(line))out.push(line);
 return out;
}
/** Zones are read on a coarser grid over a big survey (about 2000 cells), as the agent controller reads them. */
function gridFor(data:DeckData){
 const pts=data.siteModel?.points??[];if(!pts.length)return 24;
 const xs=pts.map(p=>p.xIn),zs=pts.map(p=>p.zIn);
 return Math.min(120,Math.max(24,Math.ceil(Math.sqrt((Math.max(...xs)-Math.min(...xs))*(Math.max(...zs)-Math.min(...zs))/2000))||24));
}
/** The budget box: blank is no budget; "$35,000" reads as 35000. */
function parseBudget(text:string):number|undefined|null{
 const t=text.replace(/[$,\s]/g,'');if(!t)return undefined;
 const n=Number(t);return Number.isFinite(n)&&n>0&&n<=10_000_000?Math.round(n):null;
}
/** The design conversation sent with the next turn: the last eight turns, within the 8000 characters the server takes. */
function keepTalk(turns:DesignerAiTurn[]):DesignerAiTurn[]{
 let t=turns.filter(x=>x.text.trim()).map(x=>({role:x.role,text:x.text.slice(0,2000)})).slice(-8);
 while(t.length&&(t.reduce((n,x)=>n+x.text.length,0)>7600||t[0].role!=='user'))t=t.slice(1);
 return t;
}

type Run={state:'idle'}|{state:'running';done:number;total:number}|{state:'done';result:SiteConceptsResult;source:DeckData;budget?:number;byGoals:boolean}|{state:'error';message:string};
type Ai={state:'checking'}|{state:'ready';remaining?:number}|{state:'off';reason?:AiReason};
type Turn={state:'idle'}|{state:'asking';done:number;total:number}|{state:'done';answer:DesignerTurnResult;outcome:DesignerTurnOutcome;source:DeckData;budget?:number}|{state:'error';message:string};
type Brief={lines:string[];coverage:string[]};
type Applied={title:string};
/** How a card came from the AI designer: its pick, or the engine's own concept when the pick did not check out. */
export interface ConceptPick {kind:'ai'|'fallback';explanation?:string;highlights?:string[];questions?:string[];note?:string;findings?:string[];revised?:boolean}

/** One concept card: price effect, strengths in words, reasons, moves, what was left out and why, what is still to quote
 * (by item, with the exact lines behind them), Preview and Apply. */
export function SiteConceptCard({concept:c,all,budget,baseline,pick,previewing,canPreview,applyDisabled,onPreview,onApply}:{concept:SiteConcept;all:readonly SiteConcept[];budget?:number;baseline?:{subtotal:number;quotes:readonly string[]};
 /** From the AI designer: highlighted, with its explanation, highlights and questions, or the fallback note. */
 pick?:ConceptPick;previewing?:boolean;canPreview?:boolean;applyDisabled?:boolean;onPreview?:()=>void;onApply?:()=>void}){
 const effect=conceptPriceEffect(c,baseline),strengths=conceptStrengths(c,all,budget),reasons=cardReasons(c),fire=fireNote(c),problems=[...c.validation.unexplained,...c.validation.overlaps];
 const notes=[...new Set(c.moves.flatMap(m=>m.notes).filter(n=>!/Barrie/.test(n)))],id=`dd-sd-${pick?`${pick.kind}-`:''}${c.id.replace(/[^a-z0-9-]/gi,'-')}`,kinds=quoteKinds(c.newQuotes);
 const highlights=pick?.highlights??[],questions=pick?.questions??[],findings=pick?.findings??[];
 return <li className="dd-site-concept" data-concept-id={c.id} data-goal={c.goal} data-pick={pick?.kind} data-previewing={previewing?'true':'false'} aria-labelledby={id}>
  {pick&&<p className="dd-sd-pick-label" data-kind={pick.kind}>{pick.kind==='ai'?'AI designer’s pick':'The engine’s concept'}</p>}
  <h5 id={id}>{c.title}</h5>
  <p className="dd-note">For {GOAL_LABEL[c.goal].toLowerCase()}.</p>
  <p>Price effect before HST: <span className="dd-sd-price" data-kind={effect.kind}>{effect.text}</span> · priced subtotal <span className="dd-sd-subtotal">{dollars(c.subtotal)}</span>.</p>
  {strengths.length>0&&<p className="dd-sd-strengths">{title(strengths.join(' · '))}</p>}
  {pick&&<div className="dd-sd-pick" data-kind={pick.kind}>
   {pick.note&&<p className="dd-sd-pick-note">{pick.note}</p>}
   {pick.explanation&&<p>{pick.explanation}</p>}
   {highlights.length>0&&<ul aria-label="Highlights">{highlights.map(h=><li key={h}>{h}</li>)}</ul>}
   {questions.length>0&&<><p className="dd-note">The AI designer asks:</p><ul aria-label="Questions from the AI designer">{questions.map(q=><li key={q}>{q}</li>)}</ul></>}
   {pick.kind==='ai'&&pick.revised&&<p className="dd-note">The engine checked the AI designer’s first choice on your measured ground, and it was revised once to fix what the engine found.</p>}
   {findings.length>0&&<details><summary>What the engine found ({findings.length})</summary><ul>{findings.map(f=><li key={f}>{f}</li>)}</ul></details>}
  </div>}
  {fire&&<p className="dd-sd-fire">{fire}</p>}
  {reasons.length>0&&<ul aria-label="Why this concept">{reasons.map(r=><li key={r}>{r}</li>)}</ul>}
  <p className="dd-sd-subhead">What it adds</p>
  <ul aria-label="What it adds">{c.moves.map(m=><li key={m.id}>{m.title}</li>)}</ul>
  {c.skipped.length>0&&<><p className="dd-sd-subhead">Left out, and why</p><ul aria-label="Left out">{c.skipped.map(s=><li key={s.kind}><strong>{MOVE_LABEL[s.kind]}:</strong> {s.reason}</li>)}</ul></>}
  {problems.length>0&&<p className="dd-note" role="note">Check with us before building: {problems.join('; ')}.</p>}
  {(!c.validation.priced||!c.validation.roundTrip)&&<p className="dd-note">This price could not be confirmed to the cent; we confirm it at the site visit.</p>}
  {kinds.length?<details className="dd-sd-quotes"><summary>{plural(kinds.length,'item')} still to quote</summary>
   <p className="dd-note">Priced by quote, so not in any figure above: we confirm them at the site visit.</p>
   <ul aria-label="Items still to quote">{kinds.map(k=><li key={k.kind}>{k.kind}{k.labels.length>1?<span className="dd-sd-lines"> · {plural(k.labels.length,'line')}</span>:null}</li>)}</ul>
   {c.newQuotes.length>kinds.length&&<details><summary>Every quote line ({c.newQuotes.length})</summary><ul aria-label="Quote lines">{c.newQuotes.map(q=><li key={q}>{q}</li>)}</ul></details>}
  </details>:<p className="dd-note">Adds nothing by quote.</p>}
  {notes.length>0&&<details><summary>Notes for the build ({notes.length})</summary><ul>{notes.map(n=><li key={n}>{n}</li>)}</ul></details>}
  <div className="dd-sd-actions">
   {canPreview&&<button type="button" className="dd-secondary" aria-pressed={!!previewing} aria-label={`Preview in 3D: ${c.title}`} onClick={onPreview}>Preview in 3D</button>}
   <button type="button" className="dd-primary" aria-label={`Apply: ${c.title}`} disabled={applyDisabled} onClick={onApply}>Apply</button>
  </div>
 </li>;
}

/** The AI designer's questions when it asks before it designs (a clarify turn), or its words beside no concept. */
export function DesignerQuestions({answer}:{answer:Pick<DesignerTurnResult,'explanation'|'highlights'|'questions'>}){
 return <div className="dd-sd-pick" aria-label="The AI designer’s answer">
  {answer.explanation&&<p>{answer.explanation}</p>}
  {answer.highlights.length>0&&<ul>{answer.highlights.map(h=><li key={h}>{h}</li>)}</ul>}
  {answer.questions.length>0&&<><p className="dd-note">The AI designer asks:</p><ul aria-label="Questions from the AI designer">{answer.questions.map(q=><li key={q}>{q}</li>)}</ul></>}
  <p className="dd-note">Answer in your words above and ask again; nothing was changed.</p>
 </div>;
}

/**
 * Design from my ground: the measured yard in plain words, then 2–3 whole yard concepts built on it (each priced against
 * the design as it stands), and, when it is switched on, the AI designer's pick from the visitor's own words.
 */
export default function SiteDesignerPanel({data,update,onGeometry}:{data:DeckData;update:Update;onGeometry?:(data:DeckData|null)=>void}){
 const [budgetText,setBudgetText]=useState(''),[goals,setGoals]=useState<SiteGoal[]>([]),[localFaces,setLocalFaces]=useState<CompassPoint|''>('');
 const [brief,setBrief]=useState<Brief|'loading'|'error'|null>('loading'),[run,setRun]=useState<Run>({state:'idle'}),[ai,setAi]=useState<Ai>({state:'checking'}),[turn,setTurn]=useState<Turn>({state:'idle'});
 const [prompt,setPrompt]=useState(''),[previewId,setPreviewId]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[applied,setApplied]=useState<Applied|null>(null);
 const job=useRef<AbortController|undefined>(undefined),ask=useRef<AbortController|undefined>(undefined),keep=useRef(false),current=useRef(data),heading=useRef<HTMLHeadingElement>(null),talk=useRef<DesignerAiTurn[]>([]);current.current=data;
 const flow=useHardscapePreview(data,update,onGeometry);
 const saved=!!data.permitSite,faces:CompassPoint|''=data.permitSite?.yardFaces??(saved?'':localFaces),northDeg=faces?bearing(faces):undefined;
 const budget=parseBudget(budgetText);
 const stop=()=>{job.current?.abort();job.current=undefined;},stopAsk=()=>{ask.current?.abort();ask.current=undefined;};
 useEffect(()=>()=>{stop();stopAsk();},[]);
 // Concepts are priced for one design: any change (including Apply) drops them and stops a run in progress.
 useEffect(()=>{stop();stopAsk();setRun({state:'idle'});setTurn(t=>t.state==='done'||t.state==='asking'?{state:'idle'}:t);setPreviewId('');setError('');if(keep.current)keep.current=false;else{setMessage('');setApplied(null);}},[data]);
 // The site brief: what the survey says, in plain words (lazy; on a coarser grid over a big survey).
 useEffect(()=>{
  if(!data.siteModel){setBrief(null);return;}
  let live=true;setBrief(b=>b&&typeof b==='object'?b:'loading');
  const t=setTimeout(async()=>{try{const m=await import('../siteBrief');await m.loadSiteBriefRuntime();if(!live)return;const b=m.siteBrief(data,{maxBytes:4096,gridIn:gridFor(data),...(northDeg!==undefined?{northDeg}:{})});if(live)setBrief(b?{lines:b.lines,coverage:b.coverageWarnings}:null);}catch{if(live)setBrief('error');}},0);
  return()=>{live=false;clearTimeout(t);};
 },[data,northDeg]);
 // Whether the AI designer can be asked: checked once, when the panel opens (the client loads on demand).
 useEffect(()=>{
  if(!data.siteModel)return;
  const ac=new AbortController();
  void (async()=>{try{const {designerAiStatus}=await import('./siteDesignerAiClient');const s=await designerAiStatus(ac.signal);if(ac.signal.aborted)return;
   setAi(s.available?(s.remainingTurnsToday===0?{state:'off',reason:'rate_limited'}:{state:'ready',...(typeof s.remainingTurnsToday==='number'?{remaining:s.remainingTurnsToday}:{})}):{state:'off',reason:s.reason??'unavailable'});}
   catch{if(!ac.signal.aborted)setAi({state:'off',reason:'unavailable'});}})();
  return()=>ac.abort();
 },[!!data.siteModel]);

 if(!data.siteModel)return <section className="dd-site-designer" aria-label="Design from my ground"><h4>Design from my ground</h4><p className="dd-note">This needs measured ground. Import survey readings under Ground &amp; grading, then come back for whole-yard concepts built on them, each priced.</p></section>;

 const busy=run.state==='running'||turn.state==='asking';
 const toggleGoal=(g:SiteGoal,on:boolean)=>setGoals(list=>on?[...list.filter(x=>x!==g),g]:list.filter(x=>x!==g));
 const setFaces=(value:CompassPoint|'')=>{
  if(!data.permitSite){setLocalFaces(value);stop();setRun({state:'idle'});return;}
  const next={...data.permitSite};if(value)next.yardFaces=value;else delete next.yardFaces;
  try{update({permitSite:next});}catch(e){setError((e as Error)?.message||'The direction could not be saved.');}
 };
 const options=()=>({...(budget!==undefined&&budget!==null?{budget}:{}),...(goals.length?{goals}:{}),...(northDeg!==undefined?{northDeg}:{})});
 const show=async()=>{
  if(budget===null)return;
  stop();const ac=new AbortController(),snapshot=data;job.current=ac;
  flow.cancel();setPreviewId('');setMessage('');setError('');setApplied(null);setRun({state:'running',done:0,total:0});
  try{
   const {siteConcepts}=await import('../siteConcepts');if(ac.signal.aborted)return;
   const result=await siteConcepts(snapshot,{...options(),signal:ac.signal,onProgress:(done,total)=>{if(!ac.signal.aborted)setRun(r=>r.state==='running'?{state:'running',done,total}:r);}});
   if(ac.signal.aborted||current.current!==snapshot)return;
   setRun({state:'done',result,source:snapshot,byGoals:goals.length>0,...(budget!==undefined&&budget!==null?{budget}:{})});
  }catch(e){if(!ac.signal.aborted)setRun({state:'error',message:(e as Error)?.message||'The concepts could not be worked out.'});}
  finally{if(job.current===ac)job.current=undefined;}
 };
 const askAi=async()=>{
  const words=prompt.trim().slice(0,2000);if(!words||ai.state!=='ready'||budget===null)return;
  stopAsk();const ac=new AbortController(),snapshot=data;ask.current=ac;
  if(previewId.startsWith('ai:')){flow.cancel();setPreviewId('');}
  setMessage('');setError('');setApplied(null);setTurn({state:'asking',done:0,total:0});
  try{
   const {runDesignerTurn}=await import('./siteDesignerAiClient');if(ac.signal.aborted)return;
   const answer=await runDesignerTurn(snapshot,words,{...options(),...(talk.current.length?{conversation:talk.current}:{}),signal:ac.signal,
    onProgress:(done,total)=>{if(!ac.signal.aborted)setTurn(t=>t.state==='asking'?{state:'asking',done,total}:t);}});
   if(ac.signal.aborted||current.current!==snapshot)return;
   const outcome=designerTurnOutcome(answer),usedBudget=budget!==undefined?{budget}:{};
   setTurn({state:'done',answer,outcome,source:snapshot,...usedBudget});
   // The engine's concepts come with every answer: they stand below whether or not the AI could design.
   if(answer.status!=='pending'&&answer.brief&&answer.concepts.length)setRun(r=>r.state==='done'&&r.source===snapshot?r:{state:'done',result:{status:'ready',brief:answer.brief,concepts:answer.concepts,warnings:answer.warnings,...(answer.baseline?{baseline:answer.baseline}:{})},source:snapshot,byGoals:goals.length>0,...usedBudget});
   if(answer.response){const said=[answer.response.explanation,...(answer.response.questions??[])].filter(Boolean).join(' ');talk.current=keepTalk([...talk.current,{role:'user',text:words},...(said?[{role:'assistant' as const,text:said}]:[])]);}
   if(outcome.off)setAi({state:'off',reason:outcome.off});
   else if(outcome.remaining!==undefined)setAi(outcome.remaining<=0?{state:'off',reason:'rate_limited'}:{state:'ready',remaining:outcome.remaining});
  }catch(e){
   if(ac.signal.aborted)return;
   setTurn({state:'error',message:(e as Error)?.message||'The AI designer could not answer.'});
  }finally{if(ask.current===ac)ask.current=undefined;}
 };
 const result=run.state==='done'?run.result:undefined,concepts=result?.concepts??[],baseline=result?.baseline;
 const done=turn.state==='done'?turn:undefined,pickConcept=done&&(done.outcome.show==='pick'||done.outcome.show==='fallback')?done.answer.concept:null;
 const keyOf=(c:SiteConcept,isPick:boolean)=>`${isPick?'ai:':''}${c.id}`;
 const previewing=previewId?(previewId.startsWith('ai:')?pickConcept??undefined:concepts.find(c=>keyOf(c,false)===previewId)):undefined,shown=previewing&&(flow.busy||flow.candidate)?previewId:'';
 const preview=(c:SiteConcept,isPick:boolean)=>{
  const key=keyOf(c,isPick);setError('');if(shown===key){flow.cancel();setPreviewId('');return;}
  const patch=JSON.parse(JSON.stringify(c.patch)),unset=Object.keys(c.patch).filter(k=>c.patch[k as keyof DeckData]===undefined) as (keyof DeckData)[];
  setPreviewId(key);void flow.preview([{type:'design.patch',patch,...(unset.length?{unset}:{})}]);
 };
 const apply=(c:SiteConcept,isPick:boolean)=>{
  const source=isPick?done?.source:(run.state==='done'?run.source:undefined);
  if(source!==current.current){if(isPick)setTurn({state:'idle'});else setRun({state:'idle'});setError(`The design changed since ${isPick?'the AI designer answered. Ask again':'these concepts were worked out. Show concepts again'}.`);return;}
  flow.cancel();
  try{keep.current=true;update(c.patch);setApplied({title:c.title});setMessage(`Applied: ${c.title}. Undo puts the design back as it was in one step.`);heading.current?.focus();}
  catch(e){keep.current=false;setError((e as Error)?.message||'This concept could not be applied.');}
 };
 const pickOf=(t:NonNullable<typeof done>):ConceptPick=>t.outcome.show==='pick'
  ?{kind:'ai',explanation:t.answer.explanation,highlights:t.answer.highlights,questions:t.answer.questions,revised:t.answer.revised}
  :{kind:'fallback',...(t.outcome.line?{note:t.outcome.line}:{}),findings:t.answer.findings};
 const card=(c:SiteConcept,isPick:boolean)=><SiteConceptCard key={keyOf(c,isPick)} concept={c} all={isPick?[c]:concepts} budget={isPick?done?.budget:(run.state==='done'?run.budget:undefined)} baseline={isPick?done?.answer.baseline??baseline:baseline}
  {...(isPick&&done?{pick:pickOf(done)}:{})} previewing={shown===keyOf(c,isPick)} canPreview={!!onGeometry} applyDisabled={flow.busy}
  onPreview={()=>preview(c,isPick)} onApply={()=>apply(c,isPick)}/>;
 const status=run.state==='running'?'Working out concepts for your measured ground…'
  :turn.state==='asking'?'The AI designer is working on your request…'
  :message||(result?(result.status==='pending'?result.warnings[0]??'The concepts aren’t available yet.':concepts.length?`${plural(concepts.length,'concept')} for your measured ground, priced against the design as it stands.`:'No concept fits the measured ground yet.'):'');
 const shownBrief=brief&&typeof brief==='object'?brief:null,further=result?measureGuidance(result):[],notes=result?result.warnings.filter(w=>!/Measure about/.test(w)):[];
 const coverage=shownBrief?shownBrief.coverage.filter(w=>!shownBrief.lines.includes(w)):[];
 const progress=(done:number,total:number,label:string)=>total?<progress aria-label={label} max={total} value={done}/>:<progress aria-label={label}/>;
 return <section className="dd-site-designer" aria-label="Design from my ground" data-state={run.state} data-ai={ai.state==='off'?`off:${ai.reason??'unavailable'}`:ai.state} data-turn={done?`done:${done.answer.status}`:turn.state}>
  <h4 ref={heading} tabIndex={-1}>Design from my ground</h4>
  <p>Whole-yard concepts built on your measured ground: where the flattest spot is, how the slope falls, how far the door sits above the yard. Each is priced against the design as it stands, and you can see it in 3D before you apply it.</p>
  <h5>What the survey says</h5>
  {brief==='loading'&&<p className="dd-note">Reading the measured ground…</p>}
  {brief==='error'&&<p className="dd-note">The survey summary could not be read. The concepts below still use the measured ground.</p>}
  {shownBrief&&<ul className="dd-sd-brief" aria-label="What the survey says">{shownBrief.lines.map(l=><li key={l}>{l}</li>)}</ul>}
  {(coverage.length>0||further.length>0)&&<>
   <h5>Where the survey falls short</h5>
   <ul className="dd-sd-coverage" aria-label="Where the survey falls short">{coverage.map(w=><li key={w}>{w}</li>)}{further.map(w=><li key={w}>{w}</li>)}</ul>
   {further.length>0&&<p className="dd-note">Measuring that ground lets the designer place what it had to leave out.</p>}
  </>}
  <fieldset className="dd-sd-inputs" disabled={busy}>
   <legend>What matters to you</legend>
   <label className="dd-sd-field">Budget to add, before HST (optional)
    <span className="dd-sd-money"><span aria-hidden="true">$</span><input type="text" inputMode="numeric" autoComplete="off" aria-label="Budget to add, before HST (optional)" placeholder="e.g. 35,000" value={budgetText} aria-invalid={budget===null} onChange={e=>setBudgetText(e.target.value)}/></span>
   </label>
   {budget===null&&<p className="dd-note" role="alert">Enter the budget as a number of dollars, or leave it blank.</p>}
   <p className="dd-sd-legend">Goals (tick any; the first you tick comes first)</p>
   <div className="dd-sd-goals">{GOALS.map(([g,label,hint])=><label key={g} className="dd-sd-check"><input type="checkbox" checked={goals.includes(g)} onChange={e=>toggleGoal(g,e.target.checked)}/><span>{label}<small>{hint}</small></span></label>)}</div>
   <label className="dd-sd-field">Which way does the back yard face? (optional)
    <select aria-label="Which way does the back yard face?" value={faces} onChange={e=>setFaces(e.target.value as CompassPoint|'')}><option value="">Not set</option>{COMPASS_POINTS.map(p=><option key={p} value={p}>{title(COMPASS_WORDS[p])}</option>)}</select>
   </label>
   <p className="dd-note" data-faces-saved={saved?'design':'local'}>{saved?'Saved with the design; it also turns the north arrow on the permit site plan.':'Kept for this visit only: the design has no lot details yet, so there is nowhere to save it. Enter the lot for the permit site plan to keep it.'}{faces?'':' Without it, nothing is said about sun and shade.'}</p>
  </fieldset>
  <div className="dd-sd-actions">
   {run.state==='running'?<button type="button" className="dd-secondary" onClick={()=>{stop();setRun({state:'idle'});setMessage('Stopped. Nothing was changed.');}}>Stop</button>
    :<button type="button" className={run.state==='done'?'dd-secondary':'dd-primary'} disabled={turn.state==='asking'||budget===null} onClick={()=>void show()}>{run.state==='done'?'Show concepts again':'Show concepts'}</button>}
  </div>
  {run.state==='running'&&progress(run.done,run.total,'Concepts worked out')}
  {run.state==='running'&&run.total>0&&<p className="dd-note" aria-hidden="true">{run.done} of {run.total} steps done</p>}
  <p role="status" className="dd-note dd-sd-status">{status}</p>
  {run.state==='error'&&<p role="alert">{run.message} Nothing was changed. Try again, or add patios, walls and beds by hand.</p>}
  {error&&<p role="alert">{error}</p>}
  {flow.error&&previewing&&<p role="alert">The preview could not be shown: {flow.error}</p>}
  {shown&&previewing&&<p className="dd-note">{flow.candidate?`Showing “${previewing.title}” in the 3D view. Apply it, or press Escape to go back.`:'Preparing the 3D preview…'}</p>}
  {applied&&<p className="dd-sd-next">Now make it yours: everything it added is an ordinary patio, wall, bed or fire feature. Select one on the plan to move or resize it, change it in its own editor, or ask the design assistant to change it: e.g. ‘make the fire pit a gas table’.</p>}

  <section className="dd-sd-ai" aria-label="AI designer">
   <h5>AI designer</h5>
   {ai.state==='checking'&&<p className="dd-note">Checking whether the AI designer is available…</p>}
   {ai.state==='off'&&<p className="dd-note dd-sd-ai-off" data-reason={ai.reason??'unavailable'}>{aiUnavailableLine(ai.reason)}</p>}
   {ai.state==='ready'&&<>
    <p className="dd-note">Say what you want in your own words: who uses the yard, what matters most, what to avoid. It chooses from the concepts built on your measured ground and adjusts them; the prices come from the same price book, never from the AI.</p>
    <label className="dd-sd-field">Your words
     <textarea aria-label="Your words for the AI designer" rows={3} maxLength={2000} placeholder="A fire pit for evenings with friends, some vegetable beds, under $35,000" value={prompt} disabled={turn.state==='asking'} onChange={e=>setPrompt(e.target.value)}/>
    </label>
    {typeof ai.remaining==='number'&&<p className="dd-note dd-sd-turns">{plural(ai.remaining,'AI designer turn')} left today.</p>}
    <div className="dd-sd-actions">
     {turn.state==='asking'?<button type="button" className="dd-secondary" onClick={()=>{stopAsk();setTurn({state:'idle'});setMessage('Stopped the AI designer. Nothing was changed.');}}>Stop</button>
      :<button type="button" className="dd-primary" disabled={!prompt.trim()||run.state==='running'||budget===null} onClick={()=>void askAi()}>Ask the AI designer</button>}
    </div>
    {turn.state==='asking'&&progress(turn.done,turn.total,'AI designer progress')}
   </>}
   {turn.state==='error'&&<p role="alert">The AI designer could not answer: {turn.message} Nothing was changed; the concepts below still work.</p>}
   {done?.outcome.show==='clarify'&&<DesignerQuestions answer={done.answer}/>}
   {done?.outcome.show==='line'&&!done.outcome.off&&<p className="dd-note dd-sd-ai-line" data-status={done.answer.status}>{done.outcome.line}</p>}
   {pickConcept&&<ul className="dd-sd-concepts" aria-label={done?.outcome.show==='pick'?'The AI designer’s pick':'The engine’s concept'}>{card(pickConcept,true)}</ul>}
  </section>

  {result&&concepts.length>0&&<>
   {baseline&&<p className="dd-note" data-baseline="">The design as it stands prices at <span className="dd-sd-subtotal">{dollars(baseline.subtotal)}</span> before HST; each card shows its change from that and its own priced subtotal.</p>}
   <ul className="dd-sd-concepts" aria-label="Concepts for your measured ground">{concepts.map(c=>card(c,false))}</ul>
   <p className="dd-note">{run.state==='done'&&run.byGoals?'Concepts follow the goals you ticked, most wanted first. Work by quote is not in any figure.':'Work by quote is not in any figure, so concepts that add work by quote come after those that don’t.'}</p>
  </>}
  {notes.length>0&&<ul className="dd-note dd-sd-notes" aria-label="Notes from the designer">{notes.map(w=><li key={w}>{w}</li>)}</ul>}
 </section>;
}
