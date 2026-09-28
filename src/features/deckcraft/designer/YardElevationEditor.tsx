import {useEffect,useState} from 'react';
import type {DeckData,YardFeature} from '../types';
import {hardscapeSelection,rectangularUnit} from '../hardscapeCatalogue';
import {yardElevationEdit,yardGradeIn,yardSurfaceIn,yardWallCourses,type YardElevationField} from '../yardElevations';
import {parseContractorLength} from './boundaryDimensions';
import './yardElevationEditor.css';

const shown=(n:number)=>String(Math.round(n*10000)/10000);
export function parseYardElevation(text:string){
 const raw=text.trim(),negative=raw.startsWith('-'),value=raw.replace(/^[+-]\s*/, '');
 if(!value)throw Error('Enter an elevation in inches, or feet and inches.');
 if(/^0+(?:\.0+)?(?:\s*(?:in|inch|inches|"))?$/i.test(value))return 0;
 const explicit=/[a-z'"′″’“”]/i.test(value),n=parseContractorLength(explicit?value:`${value} in`);
 return negative?-n:n;
}
export default function YardElevationEditor({data,feature:f,onChange,disabled=false}:{data:DeckData;feature:YardFeature;onChange:(next:YardFeature)=>void;disabled?:boolean}){
 const [height,setHeight]=useState(shown(f.heightIn)),[base,setBase]=useState(shown(f.baseElevationIn??0)),[slide,setSlide]=useState(f.heightIn),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{setHeight(shown(f.heightIn));setBase(shown(f.baseElevationIn??0));setSlide(f.heightIn);setError('');setMessage('');},[f.id,f.heightIn,f.baseElevationIn]);
 const wall=f.kind==='retaining-wall',s=hardscapeSelection(f),courses=yardWallCourses(f,yardGradeIn(data,f)),step=wall?courses.course:1,min=wall?6:-24,max=wall?72:48;
 const change=(field:YardElevationField,n:number)=>{try{const next=yardElevationEdit(f,field,n);if(next!==f){onChange(next);setMessage(`${f.name} ${field==='baseElevationIn'?'base elevation':wall?'height':'surface elevation'} updated. Undo restores it.`);}setError('');}catch(e){setError((e as Error).message);setSlide(f.heightIn);}};
 const exact=(field:YardElevationField,text:string)=>{try{const current=field==='heightIn'?f.heightIn:f.baseElevationIn??0;change(field,text===shown(current)?current:parseYardElevation(text));}catch(e){setError((e as Error).message);}};
 return <section className="dd-yard-elevations" aria-label="Patio and wall elevations">
  <div className="dd-yard-elevation-heading"><strong>{wall?'Wall height & elevation':'Patio elevation'}</strong><span>Top {shown(yardSurfaceIn(data,f))} in · site datum</span></div>
  <form className="dd-yard-elevation-row" onSubmit={e=>{e.preventDefault();exact('heightIn',height);}}>
   <label>{wall?'Wall exposed height':'Patio surface above local grade'}<input aria-label={wall?'Wall exposed height':'Patio surface elevation'} value={height} onChange={e=>setHeight(e.target.value)} disabled={disabled} inputMode="decimal"/><small>Inches, or 2′ 6″</small></label>
   <button type="button" disabled={disabled||f.heightIn-step<min||(!!s?.cap&&f.heightIn-step<s.cap.heightMm/25.4)} onClick={()=>change('heightIn',f.heightIn-step)} aria-label={wall?'Remove one wall course':'Lower patio 1 inch'}>{wall?'− Course':'− 1 in'}</button>
   <button type="button" disabled={disabled||f.heightIn+step>max} onClick={()=>change('heightIn',f.heightIn+step)} aria-label={wall?'Add one wall course':'Raise patio 1 inch'}>{wall?'+ Course':'+ 1 in'}</button>
   <button type="submit" disabled={disabled}>Apply {wall?'height':'elevation'}</button>
  </form>
  <label className="dd-yard-elevation-slider">{wall?'Slide wall height':'Slide patio elevation'} · {shown(slide)} in<input aria-label={wall?'Slide wall height':'Slide patio elevation'} type="range" min={min} max={max} step="any" value={slide} disabled={disabled} onChange={e=>setSlide(Number(e.target.value))} onPointerUp={e=>change('heightIn',Number(e.currentTarget.value))} onKeyUp={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key))change('heightIn',Number(e.currentTarget.value));}} onPointerCancel={()=>setSlide(f.heightIn)}/></label>
  {wall&&<form className="dd-yard-elevation-row" onSubmit={e=>{e.preventDefault();exact('baseElevationIn',base);}}><label>Wall base datum above local grade<input aria-label="Wall base elevation" value={base} onChange={e=>setBase(e.target.value)} disabled={disabled} inputMode="decimal"/><small>Inches · front grade; buried courses sit below</small></label><button type="button" disabled={disabled||(f.baseElevationIn??0)<=-120} onClick={()=>change('baseElevationIn',(f.baseElevationIn??0)-1)} aria-label="Lower wall 1 inch">− 1 in</button><button type="button" disabled={disabled||(f.baseElevationIn??0)>=120} onClick={()=>change('baseElevationIn',(f.baseElevationIn??0)+1)} aria-label="Raise wall 1 inch">+ 1 in</button><button type="submit" disabled={disabled}>Apply base</button></form>}
  <div className="dd-yard-elevation-match"><label>Match finished top<select aria-label="Match yard finished elevation" value="" disabled={disabled} onChange={e=>{const id=e.target.value;if(!id)return;const target=id==='grade'?yardGradeIn(data,f):id==='deck'?data.height:yardSurfaceIn(data,data.yardFeatures!.find(q=>`feature:${q.id}`===id)!);change('heightIn',target-yardGradeIn(data,f)-(wall?(f.baseElevationIn??0):0));}}><option value="">Choose a reference…</option>{!wall&&<option value="grade">Local grade</option>}<option value="deck">Main deck surface</option>{(data.yardFeatures??[]).filter(q=>q.id!==f.id&&q.enabled&&q.kind!=='water-feature').map(q=><option key={q.id} value={`feature:${q.id}`}>{q.name} · {shown(yardSurfaceIn(data,q))} in</option>)}</select></label>{wall&&<button type="button" disabled={disabled||(f.baseElevationIn??0)===0} onClick={()=>change('baseElevationIn',0)}>Base at local grade</button>}</div>
  {s?<p className="dd-yard-stock-size">{s.product.brand} {s.product.name} · {s.unit.widthMm} × {s.unit.lengthMm} × {s.unit.heightMm} mm ({wall?'face × depth × course':'width × length × thickness'}). {wall?`${courses.count} full body courses including burial · ${shown(courses.burialIn)} in buried.`:'Stock sizes stay fixed as the outline or elevation changes.'}{!rectangularUnit(s.unit)&&' Shaped-unit profile remains an illustrative envelope.'}</p>:wall?<p>Concept wall uses {shown(courses.course)} in courses. Choose a supplier system for documented block sizes.</p>:<p>Elevation changes move the paving and base together. Choose a supplier stock unit to inspect its nominal dimensions.</p>}
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 </section>;
}
