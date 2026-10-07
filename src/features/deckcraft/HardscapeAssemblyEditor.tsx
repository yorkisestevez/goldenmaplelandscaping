import {useEffect,useState} from 'react';
import type {DeckData,YardFeature} from './types';
import type {StoneSteps} from './stoneSteps';
import {validateYardFinishedSettings,loadYardAssembliesRuntime,yardAssembliesReady} from './yardFinishedSettings';
import {yardSurfaceIn} from './yardElevations';

export default function HardscapeAssemblyEditor({data,feature:f,onPreview,disabled=false}:{data:DeckData;feature:YardFeature;onPreview:(f:YardFeature)=>void;disabled?:boolean}){
 const upper=f.finishedElevationIn??yardSurfaceIn(data,f),defaults:StoneSteps={lowerElevationIn:upper-24,riserCount:4,treadRunIn:24,stockWidthIn:48,stockDepthIn:24,stockThicknessIn:6,baseDepthIn:6,settingBedIn:1,jointIn:.125,productName:'Custom cut-stone planning stock',support:{kind:'full-step',courses:[0,1,2,3]}};
 const [ready,setReady]=useState(yardAssembliesReady);
 useEffect(()=>{let live=true;loadYardAssembliesRuntime().then(()=>{if(live)setReady(true);},e=>{if(live)setError(String(e));});return()=>{live=false;};},[]);
 const [stairs,setStairs]=useState<StoneSteps>(f.stoneSteps??defaults),[top,setTop]=useState(upper),[joint,setJoint]=useState(f.pavingInterface?.jointIn??.375),[note,setNote]=useState(f.pavingInterface?.supportNote??''),[error,setError]=useState('');
 useEffect(()=>{setStairs(f.stoneSteps??defaults);setTop(upper);setJoint(f.pavingInterface?.jointIn??.375);setNote(f.pavingInterface?.supportNote??'');setError('');},[f.id,f.stoneSteps,f.finishedElevationIn,f.pavingInterface]);
 const preview=(next:YardFeature)=>{try{onPreview(validateYardFinishedSettings(next));setError('');}catch(e){setError((e as Error).message);}};
 const changeNumber=(key:keyof StoneSteps,value:number)=>setStairs(previous=>{
  const next={...previous,[key]:value};
  if(key==='riserCount'&&Number.isInteger(value)&&value>=1&&value<=20&&previous.support)next.support={...previous.support,courses:Array.from({length:value},(_,i)=>previous.support!.courses[i]??i)};
  return next;
 });
 const field=(label:string,key:keyof StoneSteps)=><label className="dd-field"><span>{label}</span><input aria-label={label} type="number" step="any" value={String(stairs[key])} onChange={e=>changeNumber(key,Number(e.target.value))}/></label>;
 const supportKind=stairs.support?.kind??'aggregate';
 const changeSupport=(kind:string)=>setStairs(previous=>{
  const next={...previous},courses=previous.support?.courses??Array.from({length:Number.isInteger(previous.riserCount)&&previous.riserCount>=1&&previous.riserCount<=20?previous.riserCount:0},(_,i)=>i);
  if(kind==='aggregate')delete next.support;
  else if(kind==='full-step')next.support={kind:'full-step',courses};
  else next.support=previous.support?.kind==='filler'?previous.support:{kind:'filler',courses,stockWidthIn:48,stockDepthIn:24,stockThicknessIn:6,jointIn:.125,productName:''};
  return next;
 });
 const changeFiller=(patch:Partial<Extract<NonNullable<StoneSteps['support']>,{kind:'filler'}>>)=>setStairs(previous=>previous.support?.kind==='filler'?{...previous,support:{...previous.support,...patch}}:previous);
 const setFlight=()=>{const next={...f,finishedElevationIn:top,depthFt:((stairs.riserCount-1)*stairs.treadRunIn+stairs.stockDepthIn)/12,stoneSteps:stairs};delete next.patioSlope;delete next.hardscape;delete next.inlays;preview(next);};
 return <section className="dd-yard-elevations" aria-label="Stone stairs and paving connections"><fieldset disabled={disabled||!ready}><legend>{f.kind==='retaining-wall'?'Paving connection':'Solid stone stairs'}</legend>
 {f.kind==='retaining-wall'?<>
  <p>Paving can meet the wall after its excavation and reinforcement are installed. The finished joint and support detail are recorded separately from working clearance.</p>
  <label className="dd-field"><span>Paving-to-wall joint (in)</span><input aria-label="Paving-to-wall joint (in)" type="number" min="0" max="6" step=".125" value={joint} onChange={e=>setJoint(Number(e.target.value))}/></label>
  <label className="dd-field"><span>Support and drainage specification</span><textarea aria-label="Paving connection specification" maxLength={800} value={note} onChange={e=>setNote(e.target.value)}/></label>
  <button type="button" className="dd-secondary" onClick={()=>preview({...f,pavingInterface:{jointIn:joint,...(note.trim()?{supportNote:note.trim()}:{})}})}>Preview paving connection</button>
  {f.pavingInterface&&<button type="button" className="dd-secondary" onClick={()=>{const next={...f};delete next.pavingInterface;preview(next);}}>Preview construction setback</button>}
  <p className="dd-quote-notice">Support, drainage, reinforcement cover and edge restraint stay pending until an execution detail is confirmed. The preview partitions material volumes at the paving formation.</p>
 </>:<>
  <p>One flight with fixed landing levels, rigid stock units, equal risers and measured support layers. Supplier and site requirements remain explicit.</p>
  <div className="dd-fields"><label className="dd-field"><span>Stone stair upper elevation (in)</span><input aria-label="Stone stair upper elevation (in)" type="number" step="any" value={top} onChange={e=>setTop(Number(e.target.value))}/></label>
  {field('Stone stair lower elevation (in)','lowerElevationIn')}{field('Stone stair riser count','riserCount')}{field('Stone tread run (in)','treadRunIn')}{field('Step stock width (in)','stockWidthIn')}{field('Step stock depth (in)','stockDepthIn')}{field('Step stock thickness (in)','stockThicknessIn')}{field('Step compacted base depth (in)','baseDepthIn')}{field('Step setting-bed depth (in)','settingBedIn')}{field('Step unit joint (in)','jointIn')}</div>
  <label className="dd-field"><span>Step stock or planning product</span><input aria-label="Step stock or planning product" maxLength={160} value={stairs.productName} onChange={e=>setStairs({...stairs,productName:e.target.value})}/></label>
  <label className="dd-field"><span>Support beneath treads</span><select aria-label="Support beneath treads" value={supportKind} onChange={e=>changeSupport(e.target.value)}><option value="aggregate">Aggregate</option><option value="full-step">Full-size steps</option><option value="filler">Filler blocks</option></select></label>
  {stairs.support&&<><div className="dd-fields">{stairs.support.courses.map((course,i)=><label className="dd-field" key={i}><span>Supporting courses beneath tread row {i+1}</span><input aria-label={`Supporting courses beneath tread row ${i+1}`} type="number" min="0" max="20" step="1" value={course} onChange={e=>{const value=Number(e.target.value);setStairs(previous=>previous.support?{...previous,support:{...previous.support,courses:previous.support.courses.map((n,j)=>j===i?value:n)}}:previous);}}/></label>)}</div>
  <small>Rows start at the lower landing. Changing the riser count updates this draft: existing course counts are kept; new rows start with one additional course per row.</small></>}
  {stairs.support?.kind==='filler'&&<><div className="dd-fields">{(['stockWidthIn','stockDepthIn','stockThicknessIn','jointIn'] as const).map((key,i)=>{const label=['Filler stock width (in)','Filler stock depth (in)','Filler stock thickness (in)','Filler unit joint (in)'][i];return <label className="dd-field" key={key}><span>{label}</span><input aria-label={label} type="number" step="any" value={stairs.support?.kind==='filler'?stairs.support[key]:''} onChange={e=>changeFiller({[key]:Number(e.target.value)})}/></label>;})}</div>
  <label className="dd-field"><span>Filler stock or planning product</span><input aria-label="Filler stock or planning product" maxLength={160} value={stairs.support.productName} onChange={e=>changeFiller({productName:e.target.value})}/></label>
  <label className="dd-field"><span>Filler specification source (HTTPS)</span><input aria-label="Filler specification source (HTTPS)" type="url" value={stairs.support.sourceURL??''} onChange={e=>setStairs(previous=>{if(previous.support?.kind!=='filler')return previous;const support={...previous.support};if(e.target.value.trim())support.sourceURL=e.target.value;else delete support.sourceURL;return {...previous,support};})}/></label>
  <small>These dimensions are entered planning values. Record the filler product before previewing; confirm its bearing and installation detail.</small></>}
  <p className="dd-quote-notice">{supportKind==='aggregate'?'Aggregate support is retained until you select solid supporting units.':supportKind==='full-step'?'Supporting full-size steps reuse the selected tread stock.':'Fillers use their separately entered stock dimensions.'} Each row’s bearing elevation is derived from its fixed tread underside and supporting courses. Bedding and base sit below that stack; the preview shows foundation and excavation changes. Bearing and installation details remain pending.</p>
  <label className="dd-field"><span>Stair support specification</span><textarea aria-label="Stair support specification" maxLength={800} value={stairs.supportNote??''} onChange={e=>{const next={...stairs};if(e.target.value.trim())next.supportNote=e.target.value;else delete next.supportNote;setStairs(next);}}/></label>
  <button type="button" className="dd-secondary" onClick={()=>setStairs({...stairs,productName:'Techo-Bloc Raffinato Step — nominal stock',stockWidthIn:1067/25.4,stockDepthIn:368/25.4,stockThicknessIn:180/25.4,treadRunIn:368/25.4,sourceURL:'https://www.techo-bloc.com/shop/steps/raffinato-step'})}>Load documented Raffinato stock</button>
  <button type="button" className="dd-secondary" disabled={!!f.outline||!!f.curves?.length} onClick={setFlight}>Preview stone-stair assembly</button>
  {f.stoneSteps&&<button type="button" className="dd-secondary" onClick={()=>{const next={...f};delete next.stoneSteps;preview(next);}}>Preview conversion to paving</button>}
  {(!!f.outline||!!f.curves?.length)&&<p>Choose a rectangular feature for a stone-stair flight.</p>}
  <p className="dd-quote-notice">Loaded stock preserves the entered landing elevations. An incompatible rise, overlapping stock or unsupported flight is rejected. Local stair requirements, bearing, drainage and lifting need confirmation.</p>
 </>}
 </fieldset>{error&&<p role="alert">{error}</p>}</section>;
}
