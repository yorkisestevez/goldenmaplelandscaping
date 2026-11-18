import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {YardFeature} from '../types';
import {applyYardStarter,curveYardEdge,type YardStarterPreset} from '../yardDesignTools';
import {yardShapeSignedArea,yardShapeRunIn,yardShapeCurveWorldPoints} from '../yardShapeEditing';
import {parseYardElevation} from './YardElevationEditor';

const STARTERS:{id:YardStarterPreset;name:string;kind:'patio'|'retaining-wall'}[]=[
 {id:'rectangle',name:'Rectangle',kind:'patio'},{id:'chamfered',name:'Cut corners',kind:'patio'},{id:'l-shape',name:'L-shaped patio',kind:'patio'},{id:'rounded',name:'Rounded patio',kind:'patio'},
 {id:'straight',name:'Straight wall',kind:'retaining-wall'},{id:'wall-l',name:'L-shaped wall',kind:'retaining-wall'},{id:'arc',name:'Curved wall',kind:'retaining-wall'},
];
export interface CurveDraft {feature:YardFeature;bulgeIn:number}
export default function YardDrawingTools({feature,index,curveDepth,onCurveDepth,onPreview,onApply,onAdd,canAdd,disabled,onStatus}:{feature?:YardFeature;index:number;curveDepth:string|null;onCurveDepth:(value:string|null)=>void;onPreview:(draft:CurveDraft|null)=>void;onApply:(next:YardFeature)=>void;onAdd:(kind:'patio'|'retaining-wall',preset:YardStarterPreset)=>void;canAdd:boolean;disabled:boolean;onStatus:(text:string,bad?:boolean)=>void}){
 const [starter,setStarter]=useState<YardStarterPreset>('rectangle');
 const opener=useRef<HTMLButtonElement>(null),depthInput=useRef<HTMLInputElement>(null),mounted=useRef(false),curveOpen=curveDepth!==null;
 useLayoutEffect(()=>{if(mounted.current)(curveOpen?depthInput.current:opener.current)?.focus({preventScroll:true});else mounted.current=true;},[curveOpen]);
 const curve=useMemo(()=>{if(!feature||curveDepth===null)return null;try{const bulgeIn=parseYardElevation(curveDepth);return {feature:curveYardEdge(feature,index,bulgeIn),bulgeIn,error:''};}catch(e){return {feature,bulgeIn:0,error:e instanceof Error?e.message:'Enter a valid curve depth.'};}},[feature,index,curveDepth]);
 useEffect(()=>{onPreview(curve&&!curve.error?curve:null);},[curve,onPreview]);
 const replace=(preset:YardStarterPreset)=>{if(!feature)return;try{onApply(applyYardStarter(feature,preset));onCurveDepth(null);}catch(e){onStatus(e instanceof Error?e.message:'That shape could not be applied.',true);}};
 const values=curve&&!curve.error?yardShapeCurveWorldPoints(curve.feature):[],amount=values.length?(feature?.kind==='patio'?`${(yardShapeSignedArea(values)/144).toFixed(1)} sq ft`:`${(yardShapeRunIn(values)/12).toFixed(1)} ft total run`):'';
 return <div className="dd-yard-drawing-tools">
  <div className="dd-yard-start"><label>Start with a shape<select aria-label="New landscape starter shape" value={starter} disabled={disabled} onChange={e=>setStarter(e.target.value as YardStarterPreset)}>{STARTERS.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><button type="button" disabled={!canAdd||disabled} onClick={()=>{const s=STARTERS.find(s=>s.id===starter)!;onAdd(s.kind,s.id);}}>Add shape</button></div>
  {feature&&<>
   <details className="dd-yard-replace"><summary>Replace selected outline</summary><p>Keep its position, material, elevation and construction settings. This replaces its editable points; Undo restores them.</p><div className="dd-yard-shape-actions">{STARTERS.filter(s=>s.kind===feature.kind).map(s=><button type="button" key={s.id} disabled={disabled} onClick={()=>replace(s.id)}>{s.name}</button>)}</div></details>
   {curveDepth===null?<button ref={opener} type="button" className="dd-yard-curve-open" disabled={disabled} onClick={()=>onCurveDepth('24')}>Curve selected edge</button>:<section className="dd-yard-curve" aria-label="Curve edge preview">
    <strong>Curve edge {index+1}</strong><p>Endpoints stay fixed. Drag the bend handle or enter its depth. The dotted line is a preview.</p>
    <div className="dd-yard-start"><label>Curve depth · inches or ft / in<input ref={depthInput} aria-label="Landscape curve depth" value={curveDepth} disabled={disabled} onChange={e=>onCurveDepth(e.target.value)} inputMode="decimal"/></label><button type="button" disabled={disabled} onClick={()=>{try{onCurveDepth(String(-parseYardElevation(curveDepth)));}catch(e){onStatus((e as Error).message,true);}}}>Flip curve</button></div>
    {curve?.error?<p role="alert" className="dd-yard-shape-notice" data-invalid>{curve.error}</p>:<p className="dd-yard-curve-measure" role="status">Preview: {amount}. Estimate updates when applied.</p>}
    <div className="dd-yard-shape-actions"><button type="button" disabled={disabled||!curve||!!curve.error||curve.feature===feature} onClick={()=>{if(curve&&!curve.error){onApply(curve.feature);onCurveDepth(null);}}}>Apply curve</button><button type="button" onClick={()=>onCurveDepth(null)}>Cancel curve</button></div>
    <small>Applied arcs retain their exact radius and endpoints. Wall minimum radii, block joints and cap cuts need confirmation for the selected system.</small>
   </section>}
  </>}
 </div>;
}
