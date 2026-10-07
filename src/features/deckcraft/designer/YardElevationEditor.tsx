import FinishedLevelEditor from './FinishedLevelEditor';
import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import type {DeckData,YardFeature} from '../types';
import {hardscapeSelection,rectangularUnit} from '../hardscapeCatalogue';
import {yardElevationEdit,yardGradeIn,yardSurfaceIn,type YardElevationField} from '../yardElevations';
import {parseContractorLength} from './boundaryDimensions';
import './yardElevationEditor.css';
import {wallConstructionForPath} from '../wallFoundation';
import {designSiteSurface} from '../siteSurface';
import type {SiteFeaturePadModel} from '../siteFeatureGrading';
import {editYardFinished} from '../yardFinishedEdits';
import {yardWallPath} from '../yardPathGeometry';
import {getTerrainConfig} from '../yardSettings';
const WallConstructionEditor=lazy(()=>import('../WallConstructionEditor'));

const shown=(n:number)=>Number.isFinite(n)?String(Math.round(n*10000)/10000):'Pending survey';
/** Ground fit (G2): grade the measured ground round a patio at a run:rise ratio. Preview, then apply as one undo step. */
const yd=(n:number)=>n.toFixed(1),RATIOS=[2,3,4,6];
function fitLine(ratio:number|undefined,m:SiteFeaturePadModel|undefined,known:boolean){if(!ratio)return 'Ground left as measured round this patio.';const r=`${ratio}:1`;if(!m)return known?`Ground set to grade at ${r}. It applies while the patio is on and sits over measured ground.`:`Ground graded to the patio at ${r}. Dug and filled amounts show once the site is calculated.`;if(m.status==='pending')return `Ground at ${r} can’t be graded yet.`;return `Ground graded to the patio at ${r} — ${yd(m.cutYd3)} yd³ dug, ${yd(m.fillYd3)} yd³ filled${m.status==='partial'?'. Part of the bank runs past the measured ground':''}.`;}
function GroundFit({data,f,onApply,disabled}:{data:DeckData;f:YardFeature;onApply:(next:YardFeature)=>void;disabled:boolean}){
 const [preview,setPreview]=useState<{next:YardFeature;source:DeckData;lines:string[]}>(),[error,setError]=useState('');
 useEffect(()=>{setPreview(undefined);setError('');},[data,f]);
 const models=(d:DeckData)=>{try{return designSiteSurface(d)?.featurePadModels;}catch{return undefined;}},current=useMemo(()=>models(data),[data]),m=current?.find(p=>p.featureId===f.id),ratio=f.groundFit?.slopeRatio;
 const choose=(value:string)=>{setError('');if(value===String(ratio??'')){setPreview(undefined);return;}try{const next=editYardFinished(data,f,{action:'groundFit',slopeRatio:value?Number(value):null}),after=models({...data,yardFeatures:data.yardFeatures?.map(q=>q.id===f.id?next:q)}),nm=after?.find(p=>p.featureId===f.id);setPreview({next,source:data,lines:[fitLine(next.groundFit?.slopeRatio,nm,!!after),...(f.finishedElevationIn===undefined&&next.finishedElevationIn!==undefined?[`This also fixes the patio top at ${shown(next.finishedElevationIn)} in · site datum.`]:[]),...(nm?.warnings??[])]});}catch(e){setPreview(undefined);setError((e as Error).message);}};
 return <div className="dd-yard-ground-fit"><div className="dd-yard-elevation-match"><label>Ground round this patio<select aria-label="Ground round this patio" value={preview?String(preview.next.groundFit?.slopeRatio??''):String(ratio??'')} disabled={disabled} onChange={e=>choose(e.target.value)}><option value="">Off · leave the ground as measured</option>{[...new Set([...RATIOS,...(ratio?[ratio]:[])])].sort((a,b)=>a-b).map(r=><option key={r} value={r}>Graded at {r}:1</option>)}</select><small>3:1 drops 1 ft for every 3 ft out from the patio edge.</small></label></div>
  <p role="status">{fitLine(ratio,m,!!current)}</p>{m?.warnings.map(w=><p key={w}>{w}</p>)}
  {preview&&<div aria-label="Ground fit preview">{preview.lines.map((l,i)=><p key={i}>{i?l:<strong>Preview: {l}</strong>}</p>)}<div className="dd-yard-elevation-match"><button type="button" disabled={disabled} onClick={()=>{if(preview.source!==data){setPreview(undefined);setError('Design changed. Choose the ground option again.');return;}onApply(preview.next);setPreview(undefined);}}>Apply ground fit</button><button type="button" onClick={()=>setPreview(undefined)}>Discard</button></div></div>}
  {error&&<p role="alert">{error}</p>}
 </div>;
}
export function parseYardElevation(text:string){
 const raw=text.trim(),negative=raw.startsWith('-'),value=raw.replace(/^[+-]\s*/, '');
 if(!value)throw Error('Enter an elevation in inches, or feet and inches.');
 if(/^0+(?:\.0+)?(?:\s*(?:in|inch|inches|"))?$/i.test(value))return 0;
 const explicit=/[a-z'"′″’“”]/i.test(value),n=parseContractorLength(explicit?value:`${value} in`);
 return negative?-n:n;
}
export default function YardElevationEditor({data,feature:f,onChange,onApply,disabled=false}:{data:DeckData;feature:YardFeature;onChange:(next:YardFeature)=>void;onApply?:(next:YardFeature)=>void;disabled?:boolean}){
 const [height,setHeight]=useState(shown(f.heightIn)),[base,setBase]=useState(shown(f.baseElevationIn??0)),[slide,setSlide]=useState(f.heightIn),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{setHeight(shown(f.heightIn));setBase(shown(f.baseElevationIn??0));setSlide(f.heightIn);setError('');setMessage('');},[f.id,f.heightIn,f.baseElevationIn]);
 const wall=f.kind==='retaining-wall',s=hardscapeSelection(f),t=getTerrainConfig(data),surface=designSiteSurface(data),grade=yardGradeIn(data,f),path=yardWallPath(f),referenceReady=Number.isFinite(grade),pathMissing=!!surface&&(!referenceReady||!surface.extrema([path]).complete),courses=wallConstructionForPath(f,referenceReady?grade:0,path,(z,x=0)=>surface?.sample(x,z)??t.elevationIn+z*t.slopePct/100,pathMissing?undefined:surface),step=wall?courses.course:1,min=wall?6:-24,max=wall?72:48;
 const change=(field:YardElevationField,n:number)=>{try{const next=yardElevationEdit(f,field,n);if(next!==f){onChange(next);setMessage(`${f.name} ${field==='baseElevationIn'?'base elevation':wall?'height':'surface elevation'} updated. Undo restores it.`);}setError('');}catch(e){setError((e as Error).message);setSlide(f.heightIn);}};
 const exact=(field:YardElevationField,text:string)=>{try{const current=field==='heightIn'?f.heightIn:f.baseElevationIn??0;change(field,text===shown(current)?current:parseYardElevation(text));}catch(e){setError((e as Error).message);}};
 return <section className="dd-yard-elevations" aria-label="Patio and wall elevations">
  <FinishedLevelEditor data={data} feature={f} onChange={onApply??onChange} disabled={disabled}/>
  <div className="dd-yard-elevation-heading"><strong>{wall?'Wall height & elevation':'Patio elevation'}</strong><span>{Number.isFinite(yardSurfaceIn(data,f))?`Top ${shown(yardSurfaceIn(data,f))} in · site datum${referenceReady?'':' · ground pending outside survey'}`:'Top pending · outside measured coverage'}</span></div>
  {f.kind==='patio'&&!!data.siteModel&&!f.stoneSteps&&!f.stepAssembly&&<GroundFit data={data} f={f} onApply={onApply??onChange} disabled={disabled}/>}
  {f.finishedElevationIn===undefined&&<>
  <form className="dd-yard-elevation-row" onSubmit={e=>{e.preventDefault();exact('heightIn',height);}}>
   <label>{wall?'Wall exposed height':'Patio surface above local grade'}<input aria-label={wall?'Wall exposed height':'Patio surface elevation'} value={height} onChange={e=>setHeight(e.target.value)} disabled={disabled} inputMode="decimal"/><small>Inches, or 2′ 6″</small></label>
   <button type="button" disabled={disabled||f.heightIn-step<min||(!!s?.cap&&f.heightIn-step<s.cap.heightMm/25.4)} onClick={()=>change('heightIn',f.heightIn-step)} aria-label={wall?'Remove one wall course':'Lower patio 1 inch'}>{wall?'− Course':'− 1 in'}</button>
   <button type="button" disabled={disabled||f.heightIn+step>max} onClick={()=>change('heightIn',f.heightIn+step)} aria-label={wall?'Add one wall course':'Raise patio 1 inch'}>{wall?'+ Course':'+ 1 in'}</button>
   <button type="submit" disabled={disabled}>Apply {wall?'height':'elevation'}</button>
  </form>
  <label className="dd-yard-elevation-slider">{wall?'Slide wall height':'Slide patio elevation'} · {shown(slide)} in<input aria-label={wall?'Slide wall height':'Slide patio elevation'} type="range" min={min} max={max} step="any" value={slide} disabled={disabled} onChange={e=>setSlide(Number(e.target.value))} onPointerUp={e=>change('heightIn',Number(e.currentTarget.value))} onKeyUp={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key))change('heightIn',Number(e.currentTarget.value));}} onPointerCancel={()=>setSlide(f.heightIn)}/></label>
  {wall&&<form className="dd-yard-elevation-row" onSubmit={e=>{e.preventDefault();exact('baseElevationIn',base);}}><label>Wall base datum above local grade<input aria-label="Wall base elevation" value={base} onChange={e=>setBase(e.target.value)} disabled={disabled} inputMode="decimal"/><small>Inches · front grade; buried courses sit below</small></label><button type="button" disabled={disabled||(f.baseElevationIn??0)<=-120} onClick={()=>change('baseElevationIn',(f.baseElevationIn??0)-1)} aria-label="Lower wall 1 inch">− 1 in</button><button type="button" disabled={disabled||(f.baseElevationIn??0)>=120} onClick={()=>change('baseElevationIn',(f.baseElevationIn??0)+1)} aria-label="Raise wall 1 inch">+ 1 in</button><button type="submit" disabled={disabled}>Apply base</button></form>}
  <div className="dd-yard-elevation-match"><label>Match finished top<select aria-label="Match yard finished elevation" value="" disabled={disabled||!referenceReady} onChange={e=>{const id=e.target.value;if(!id)return;const target=id==='grade'?yardGradeIn(data,f):id==='deck'?data.height:yardSurfaceIn(data,data.yardFeatures!.find(q=>`feature:${q.id}`===id)!);change('heightIn',target-yardGradeIn(data,f)-(wall?(f.baseElevationIn??0):0));}}><option value="">Choose a reference…</option>{!wall&&<option value="grade">Local grade</option>}<option value="deck">Main deck surface</option>{(data.yardFeatures??[]).filter(q=>q.id!==f.id&&q.enabled&&q.kind!=='water-feature').map(q=><option key={q.id} disabled={!Number.isFinite(yardSurfaceIn(data,q))} value={`feature:${q.id}`}>{q.name} · {shown(yardSurfaceIn(data,q))} in</option>)}</select></label>{wall&&<button type="button" disabled={disabled||(f.baseElevationIn??0)===0} onClick={()=>change('baseElevationIn',0)}>Base at local grade</button>}</div>
  </>}
  {pathMissing&&<p role="status">Measured elevation coverage is incomplete here. Matching heights is unavailable without a measured reference; course details are planning values until the wall envelope is surveyed.</p>}{s?<p className="dd-yard-stock-size">{s.product.brand} {s.product.name} · {s.unit.widthMm} × {s.unit.lengthMm} × {s.unit.heightMm} mm ({wall?'face × depth × course':'width × length × thickness'}). {wall?`${courses.count} body courses including burial at the reference datum · ${shown(courses.burialIn)} in buried.`:'Stock sizes stay fixed as the outline or elevation changes.'}{!rectangularUnit(s.unit)&&' Shaped-unit profile remains an illustrative envelope.'}</p>:wall?<p>Concept wall uses {shown(courses.course)} in courses. Choose a supplier system for documented block sizes.</p>:<p>Elevation changes move the paving and base together. Choose a supplier stock unit to inspect its nominal dimensions.</p>}
  {wall&&<Suspense fallback={<p role="status">Loading wall construction inputs…</p>}><WallConstructionEditor data={data} feature={f} onChange={onApply??onChange} disabled={disabled}/></Suspense>}
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 </section>;
}
