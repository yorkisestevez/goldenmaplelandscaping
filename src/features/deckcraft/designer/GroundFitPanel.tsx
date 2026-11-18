import {useEffect,useRef,useState} from 'react';
import type {DeckData,YardFeature} from '../types';
import type {GroundFitBaseline,GroundFitMetrics,GroundFitOption,GroundFitResult} from '../groundFit';
import {GROUND_FIT_RATES} from '../groundFitRates';
import {dollars} from '../designFacts';
import {elevationLabel} from '../elevationDatum';
import {isObjectLocked} from '../editorOrganization';
import type {Update} from './fields';
import {useHardscapePreview} from './useHardscapePreview';
import './groundFitPanel.css';

/** A yard-model message about a patio and the measured ground beside it (G1 contact gaps, G2 bank coverage). */
const GROUND=/: (?:the measured ground beside it|its finished surface stands up to|its graded bank runs past)/;
const EARTH=/earth|bank|grad|fill|haul|dig/i;
const fitPatios=(data:DeckData)=>(data.yardFeatures??[]).filter(f=>f.kind==='patio'&&f.enabled&&!f.stoneSteps&&!f.stepAssembly);
const signed=(n:number)=>`${n>0?'+':'−'}${dollars(Math.abs(n))}`;
const unpricedEarthwork=(m:GroundFitMetrics)=>m.bankCutYd3+m.bankFillYd3>=.05&&(GROUND_FIT_RATES.cutHaulPerYd3===null||GROUND_FIT_RATES.fillCompactionPerYd3===null);
/** Lines still to quote, with the bank earthwork counted once when its rates are not set. */
function quoteLines(o:GroundFitOption){const earth=unpricedEarthwork(o.metrics)&&!o.quotes.some(q=>EARTH.test(q));return earth?[...o.quotes,'Bank earthwork (digging and fill rates not set yet)']:o.quotes;}
/**
 * The option's price effect against the design as it stands (`result.baseline`), in the option-delta words: "+$1,240",
 * "−$380", "no change", never "$0" beside a quote; the 'current' card says what grading round the patio adds ("+$53 to
 * grade round the landing, plus earthwork by quote"). The dollars are the option's subtotal less the baseline, each
 * rounded as shown, so the baseline plus the effect is always the card's subtotal. Quote lines count against the
 * baseline's own.
 */
export function groundFitPriceEffect(o:GroundFitOption,baseline?:GroundFitBaseline):{kind:'up'|'down'|'none'|'quote';text:string}{
 const amount=baseline?Math.round(o.subtotal)-Math.round(baseline.subtotal):Math.round(o.deltaFromCurrent),had=new Set(baseline?.quotes??[]),earthwork=unpricedEarthwork(o.metrics);
 const added=o.quotes.filter(q=>!had.has(q)&&!(earthwork&&EARTH.test(q))).length,dropped=[...had].filter(q=>!o.quotes.includes(q)).length;
 const extra=[earthwork?'earthwork by quote':'',added?`${added} more ${added===1?'line':'lines'} by quote`:''].filter(Boolean).join(' and '),fewer=dropped?` · ${dropped} fewer to quote`:'';
 const what=o.kind==='current'?` to grade round the ${o.metrics.risers!==null?'landing':'patio'}`:'',join=what?', plus':' plus';
 if(amount)return {kind:extra?'quote':amount>0?'up':'down',text:`${signed(amount)}${what}${extra?`${join} ${extra}`:''}${fewer}`};
 if(extra)return {kind:'quote',text:`${extra}${fewer}`};
 return {kind:'none',text:`no change${fewer}`};
}
type Row=[label:string,before:string,after:string];
const yd=(n:number)=>`${n.toFixed(1)} yd³`;
/** Before → after for the figures the owner compares: steps, levels, the stair's place, dug and filled ground, the edge. */
function compareRows(c:GroundFitMetrics|undefined,o:GroundFitMetrics):Row[]{
 const rows:Row[]=[],add=(label:string,f:(m:GroundFitMetrics)=>string,always=false)=>{const after=f(o),before=c?f(c):after;if(always||before!==after)rows.push([label,before,after]);};
 add('Steps',m=>m.risers==null?'no stair lands here':`${m.risers} at ${(m.riseIn??0).toFixed(2)} in`,true);
 add('Landing',m=>elevationLabel(m.landingIn),true);
 add('Deck top',m=>elevationLabel(m.deckTopIn));
 add('Stair along its edge',m=>m.stairOffsetPct==null?'—':`${Math.round(m.stairOffsetPct)}%`);
 add('Dug out',m=>yd(m.bankCutYd3),true);
 add('Filled',m=>yd(m.bankFillYd3),true);
 add('Bank reaches',m=>`${(m.bankRunIn/12).toFixed(1)} ft`);
 add('Stone edge',m=>m.edgeLf>0?`${m.edgeLf.toFixed(1)} ft, up to ${m.edgeMaxIn.toFixed(1)} in`:'none');
 return rows;
}
/** The design as it stands, in the same words the cards use (the e2e reads this line before and after Apply). */
function nowLine(data:DeckData,patio:YardFeature){
 const t=data.stairTargets?.find(s=>s.surface==='patio'&&s.patioId===patio.id);
 return `Now: ${t?`${t.riserCount} ${t.riserCount===1?'step':'steps'} down to`:'no stair lands on'} ${patio.name} at ${elevationLabel(patio.finishedElevationIn)}; main deck top ${elevationLabel(data.height)}.`;
}
type Run={state:'idle'}|{state:'running';done:number;total:number}|{state:'done';result:GroundFitResult;source:DeckData}|{state:'error';message:string};

/**
 * Ground fit (G3): priced ways to make a patio, its stair and the deck meet the measured ground. Lazy everywhere it is
 * mounted; the solver loads on "Find options". Preview stages an option through the shared guarded preview (the 3D shows
 * it, nothing is written); Apply sends its patch once, so one Undo restores the design. Any design change drops the options.
 */
export default function GroundFitPanel({data,update,featureId,onGeometry,warnings}:{data:DeckData;update:Update;featureId?:string;onGeometry?:(data:DeckData|null)=>void;warnings?:readonly string[]}){
 const patios=fitPatios(data),flagged=patios.find(p=>warnings?.some(w=>w.startsWith(`${p.name}:`)&&GROUND.test(w)));
 const [chosen,setChosen]=useState(''),[run,setRun]=useState<Run>({state:'idle'}),[previewId,setPreviewId]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('');
 const patio=featureId?patios.find(p=>p.id===featureId):patios.find(p=>p.id===chosen)??flagged??patios[0];
 const job=useRef<AbortController|undefined>(undefined),keep=useRef(false),current=useRef(data),heading=useRef<HTMLHeadingElement>(null);current.current=data;
 const flow=useHardscapePreview(data,update,onGeometry);
 const stop=()=>{job.current?.abort();job.current=undefined;};
 useEffect(()=>()=>stop(),[]);
 // Options are priced for one design: any change (including Apply) drops them and stops a run in progress.
 useEffect(()=>{stop();setRun({state:'idle'});setPreviewId('');setError('');if(keep.current)keep.current=false;else setMessage('');},[data,patio?.id]);
 if(!data.siteModel)return <section className="dd-ground-fit" aria-label="Ground fit"><h4>Fit to the ground</h4><p className="dd-note">Ground fit needs measured ground. Import survey readings under Ground &amp; grading, then compare priced ways to fit a patio, its stair and the deck to it.</p></section>;
 if(!patio)return <section className="dd-ground-fit" aria-label="Ground fit"><h4>Fit to the ground</h4><p className="dd-note">{featureId?'Ground fit works on an included patio without steps.':'Add a patio on the measured ground to compare ways of fitting it.'}</p></section>;
 const locked=isObjectLocked(data.editorOrganization,patio.id);
 const find=async()=>{
  stop();const ac=new AbortController(),snapshot=data,id=patio.id;job.current=ac;
  flow.cancel();setPreviewId('');setMessage('');setError('');setRun({state:'running',done:0,total:0});
  try{
   const {groundFitOptions}=await import('../groundFit');if(ac.signal.aborted)return;
   const result=await groundFitOptions(snapshot,{featureId:id,signal:ac.signal,onProgress:(done,total)=>{if(!ac.signal.aborted)setRun(r=>r.state==='running'?{state:'running',done,total}:r);}});
   if(ac.signal.aborted||current.current!==snapshot)return;
   setRun({state:'done',result,source:snapshot});
  }catch(e){if(!ac.signal.aborted)setRun({state:'error',message:(e as Error)?.message||'The options could not be worked out.'});}
  finally{if(job.current===ac)job.current=undefined;}
 };
 const options=run.state==='done'?run.result.options:[],base=options.find(o=>o.kind==='current'),alternatives=options.filter(o=>o.kind!=='current');
 // One baseline for every price on the panel: the design as it stands now (the patio as saved, lights settled).
 const baseline=run.state==='done'?run.result.baseline:undefined;
 const previewing=previewId?options.find(o=>o.id===previewId):undefined,shown=previewing&&(flow.busy||flow.candidate)?previewing:undefined;
 const preview=(o:GroundFitOption)=>{
  setError('');if(shown?.id===o.id){flow.cancel();setPreviewId('');return;}
  const patch=JSON.parse(JSON.stringify(o.patch)),unset=Object.keys(o.patch).filter(k=>o.patch[k as keyof DeckData]===undefined) as (keyof DeckData)[];
  setPreviewId(o.id);void flow.preview([{type:'design.patch',patch,...(unset.length?{unset}:{})}]);
 };
 const apply=(o:GroundFitOption)=>{
  if(run.state!=='done'||run.source!==current.current){setRun({state:'idle'});setError('The design changed since these options were worked out. Find options again.');return;}
  flow.cancel();
  try{keep.current=true;update(o.patch);setMessage(`Applied: ${o.title}. Undo puts the design back as it was in one step.`);heading.current?.focus();}
  catch(e){keep.current=false;setError((e as Error)?.message||'This option could not be applied.');}
 };
 const status=run.state==='running'?`Working out ground fit options for ${patio.name}…`
  :run.state==='done'?(run.result.status==='pending'?'Ground fit options aren’t available yet.':alternatives.length?`${alternatives.length} ${alternatives.length===1?'option':'options'} for ${patio.name}, priced against the design as it stands.`:`No other fit came out buildable for ${patio.name}.`)
  :message;
 const card=(o:GroundFitOption)=>{
  const isBase=o.kind==='current',effect=groundFitPriceEffect(o,baseline),quotes=quoteLines(o),titleId=`dd-gf-${o.id.replace(/[^a-z0-9-]/gi,'-')}`;
  return <li key={o.id} className="dd-ground-fit-card" data-kind={o.kind} data-option-id={o.id} data-previewing={shown?.id===o.id} aria-labelledby={titleId}>
   <h5 id={titleId}>{o.title}</h5>
   <p>Price effect before HST: <span className="dd-ground-fit-price" data-kind={effect.kind}>{effect.text}</span> · priced subtotal <span className="dd-ground-fit-subtotal">{dollars(o.subtotal)}</span>.</p>
   <dl className="dd-ground-fit-compare">{compareRows(isBase?undefined:base?.metrics,o.metrics).map(([label,before,after])=><div key={label}><dt>{label}</dt><dd>{before===after?after:<>{before}<span aria-hidden="true"> → </span><span className="dd-gf-sr"> becomes </span><strong>{after}</strong></>}</dd></div>)}</dl>
   {o.metrics.status==='partial'&&<p className="dd-note">Part of the bank runs past the measured ground; earthwork is counted only where it is measured.</p>}
   {o.lines.length>0&&<ul>{o.lines.map((l,i)=><li key={i}>{l}</li>)}</ul>}
   {quotes.length?<details><summary>{quotes.length} {quotes.length===1?'line':'lines'} still to quote</summary><ul>{quotes.map(q=><li key={q}>{q}</li>)}</ul></details>:<p className="dd-note">No lines left to quote on this option.</p>}
   {!isBase&&<div className="dd-ground-fit-actions">
    {onGeometry&&<button type="button" className="dd-secondary" aria-pressed={shown?.id===o.id} aria-label={`Preview in 3D: ${o.title}`} disabled={locked} onClick={()=>preview(o)}>Preview in 3D</button>}
    <button type="button" className="dd-primary" aria-label={`Apply: ${o.title}`} disabled={locked||flow.busy} onClick={()=>apply(o)}>Apply</button>
   </div>}
  </li>;
 };
 return <section className="dd-ground-fit" aria-label="Ground fit" data-state={run.state}>
  <h4 ref={heading} tabIndex={-1}>Fit to the ground</h4>
  <p>Compare priced ways to make a patio meet the measured ground: raise or lower the landing (fewer or more steps), slide the stair along the deck, set the deck 1–4 in below the door sill, or hold a raised side with a stone edge instead of a wide fill bank.</p>
  {!featureId&&patios.length>1?<label>Patio to fit<select aria-label="Patio to fit" value={patio.id} onChange={e=>{setChosen(e.target.value);setMessage('');}}>{patios.map(p=><option key={p.id} value={p.id}>{p.name}{p===flagged?' · ground needs work':''}</option>)}</select></label>:null}
  <p className="dd-note">{nowLine(data,patio)}</p>
  {locked&&<p className="dd-note">This patio is locked. Unlock it or its layer to apply an option.</p>}
  <div className="dd-ground-fit-actions">
   {run.state==='running'?<button type="button" className="dd-secondary" onClick={()=>{stop();setRun({state:'idle'});setMessage('Stopped. Nothing was changed.');}}>Stop</button>
    :<button type="button" className={run.state==='done'?'dd-secondary':'dd-primary'} onClick={()=>void find()}>{run.state==='done'?'Find options again':'Find options'}</button>}
  </div>
  {run.state==='running'&&(run.total?<progress aria-label="Ground fit options checked" max={run.total} value={run.done}/>:<progress aria-label="Ground fit options checked"/>)}
  {run.state==='running'&&run.total>0&&<p className="dd-note" aria-hidden="true">{run.done} of {run.total} checked</p>}
  <p role="status" className="dd-note">{status}</p>
  {run.state==='error'&&<p role="alert">{run.message} Nothing was changed. Try again, or change the patio level by hand under Patios, walls &amp; steps.</p>}
  {error&&<p role="alert">{error}</p>}
  {flow.error&&previewing&&<p role="alert">The preview could not be shown: {flow.error}</p>}
  {shown&&<p className="dd-note">{flow.candidate?`Showing “${shown.title}” in the 3D view. Apply it, or press Escape to go back.`:'Preparing the 3D preview…'}</p>}
  {run.state==='done'&&run.result.warnings.length>0&&<ul className="dd-note">{run.result.warnings.map(w=><li key={w}>{w}</li>)}</ul>}
  {run.state==='done'&&options.length>0&&<>
   {baseline&&<p className="dd-note" data-baseline="">The design as it stands prices at <span className="dd-ground-fit-subtotal">{dollars(baseline.subtotal)}</span> before HST; each card shows its change from that and its own priced subtotal.</p>}
   <ul className="dd-ground-fit-options" aria-label={`Ground fit options for ${patio.name}`}>{options.map(card)}</ul>
   <p className="dd-note">A line by quote is not in any figure, so options that add work by quote are listed after those that don’t.</p>
  </>}
  {run.state==='done'&&run.result.status==='ready'&&!alternatives.length&&<p className="dd-note">Raising or lowering the landing, moving the stair, the deck height and a stone edge were all checked; none gave a buildable fit here, so the design stays as it is.</p>}
 </section>;
}
