import {useDeferredValue,useMemo,useState} from 'react';
import type {DeckData,YardAllowances,YardFeature} from './types';
import {FIRE_PRODUCTS,fireProduct} from './fireFeatures';
import {FIRE_CLEARANCE} from './designRules';
import {validateYardFinishedSettings} from './yardFinishedSettings';
import {isObjectLocked} from './editorOrganization';
import {buildYardModel} from './yardModel';
import {buildDeckTakeoff} from './deckTakeoff';
import {ALLOWANCE_FINISHES,NO_ALLOWANCES} from './yardSettings';
import {HARDSCAPE_PRODUCTS} from './hardscapeCatalogue';

/**
 * The selected fire feature in the Backyard section (a lazy chunk of YardEditor): product, size, height, what it stands
 * on, position, stone colour and finish level, with the model's clearance and level notes for it. Every control is one
 * change (one undo step); a change the model cannot build is refused with its reason and nothing is saved.
 */
const TALL={minHeight:44} as const;
const DEFAULT_NAMES:Record<string,string>={'fire-wood-ring':'Fire pit','fire-gas-bowl':'Fire bowl','fire-gas-linear':'Fire table'};
const title=(s:string)=>s.toLowerCase().replace(/\b\w/g,m=>m.toUpperCase());
/** Stone tones from the catalogue's wall products (two per product, eight in all) after the generic yard grey. */
const STONES=(()=>{
 const out=[{hex:'#aaa69b',name:'Natural grey'}],seen=new Set(['#aaa69b']);
 for(const p of HARDSCAPE_PRODUCTS){if(p.category!=='wall')continue;let taken=0;
  for(const c of p.finishes.flatMap(v=>v.colors)){const hex=c.hex?.toLowerCase();if(!hex||!/^#[0-9a-f]{6}$/.test(hex)||seen.has(hex)||taken>=2||out.length>=9)continue;seen.add(hex);taken++;out.push({hex,name:`${p.brand} ${title(p.name)}, ${c.id.replaceAll('-',' ')}`});}}
 return out;
})();
function Number_({label,value,min,max,step=1,unit,onChange,disabled}:{label:string;value:number;min:number;max:number;step?:number;unit:string;onChange:(n:number)=>void;disabled:boolean}){
 return <label className="dd-field"><span>{label}</span><span className="dd-number"><input key={value} aria-label={label} disabled={disabled} type="number" min={min} max={max} step={step} defaultValue={Math.round(value*100)/100} style={TALL}
  onBlur={e=>{const n=Number(e.target.value);if(e.target.value.trim()&&Number.isFinite(n)){const v=Math.min(max,Math.max(min,n));if(v!==value)onChange(v);else e.target.value=String(Math.round(value*100)/100);}else e.target.value=String(Math.round(value*100)/100);}}
  onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><span>{unit}</span></span></label>;
}
export default function FireFeatureEditor({data,feature,onChange}:{data:DeckData;feature:YardFeature;onChange:(patch:Partial<DeckData>)=>void}){
 const [error,setError]=useState(''),locked=isObjectLocked(data.editorOrganization,feature.id),product=fireProduct(feature)??FIRE_PRODUCTS[0];
 const widthIn=Math.round(feature.widthFt*1200)/100,depthIn=Math.round(feature.depthFt*1200)/100;
 const patios=(data.yardFeatures??[]).filter(f=>f.kind==='patio'&&!f.stoneSteps&&!f.stepAssembly);
 const apply=(patch:Partial<YardFeature>)=>{try{
  if(locked)throw Error('Unlock this feature or its layer before editing.');
  const next:YardFeature={...feature,...patch};if(next.supportFeatureId===undefined)delete next.supportFeatureId;
  onChange({yardFeatures:(data.yardFeatures??[]).map(f=>f.id===feature.id?validateYardFinishedSettings(next):f)});setError('');
 }catch(e){setError(e instanceof Error?e.message:'This change could not be made.');}};
 const chooseProduct=(id:string)=>{const p=fireProduct({productId:id});if(!p)return;
  const width=Math.min(p.max,Math.max(p.min,widthIn)),depth=p.round?width:product.round?20:Math.min(24,Math.max(18,depthIn));
  apply({productId:id,widthFt:width/12,depthFt:depth/12,...(feature.name===DEFAULT_NAMES[feature.productId]?{name:DEFAULT_NAMES[id]}:{})});};
 const stand=(id:string)=>{const patio=patios.find(p=>p.id===id);apply(patio?{supportFeatureId:patio.id,xFt:patio.xFt,zFt:patio.zFt}:{supportFeatureId:undefined});};
 // The model's notes for this feature (clearances, level, support), from the same geometry the estimate uses.
 const deferred=useDeferredValue(data);
 const report=useMemo(()=>{try{return buildYardModel(deferred,buildDeckTakeoff(deferred)).features.find(m=>m.config.id===feature.id)??null;}catch{return null;}},[deferred,feature.id]);
 const finish=data.yardAllowances?.finish??'mid';
 return <section className="dd-fire-feature-editor" aria-label="Fire feature">
  <label className="dd-check" style={TALL}><input type="checkbox" checked={feature.enabled} disabled={locked} onChange={e=>apply({enabled:e.target.checked})}/><span>Include this fire feature in the design and estimate</span></label>
  <div className="dd-fields">
   <label className="dd-field"><span>Feature name</span><input aria-label="Fire feature name" maxLength={80} disabled={locked} value={feature.name} style={TALL} onChange={e=>apply({name:e.target.value})}/></label>
   <label className="dd-field"><span>Fire feature</span><select aria-label="Fire feature product" disabled={locked} value={product.id} style={TALL} onChange={e=>chooseProduct(e.target.value)}>{FIRE_PRODUCTS.map(p=><option key={p.id} value={p.id}>{p.name}, {p.min} to {p.max} in</option>)}</select></label>
   {product.round?<Number_ label="Diameter" unit="in" value={widthIn} min={product.min} max={product.max} disabled={locked} onChange={v=>apply({widthFt:v/12,depthFt:v/12})}/>
    :<><Number_ label="Length" unit="in" value={widthIn} min={product.min} max={product.max} disabled={locked} onChange={v=>apply({widthFt:v/12})}/><Number_ label="Depth" unit="in" value={depthIn} min={18} max={24} disabled={locked} onChange={v=>apply({depthFt:v/12})}/></>}
   <Number_ label="Body height" unit="in" value={feature.heightIn} min={12} max={24} disabled={locked} onChange={heightIn=>apply({heightIn})}/>
   <label className="dd-field"><span>Stands on</span><select aria-label="Fire feature stands on" disabled={locked} value={feature.supportFeatureId??''} style={TALL} onChange={e=>stand(e.target.value)}><option value="">Its own 4 in gravel pad</option>{feature.supportFeatureId&&!patios.some(p=>p.id===feature.supportFeatureId)&&<option value={feature.supportFeatureId}>A patio no longer in the design</option>}{patios.map(p=><option key={p.id} value={p.id}>{p.name}{p.enabled?'':' (excluded)'}</option>)}</select><small>Choosing a patio centres the fire feature on it.</small></label>
   <Number_ label="Centre across yard" unit="ft" step={.5} value={feature.xFt} min={-150} max={150} disabled={locked} onChange={xFt=>apply({xFt})}/>
   <Number_ label="Centre out into yard" unit="ft" step={.5} value={feature.zFt} min={-150} max={200} disabled={locked} onChange={zFt=>apply({zFt})}/>
   {!product.round&&<Number_ label="Rotation" unit="°" value={feature.rotationDeg} min={0} max={359} disabled={locked} onChange={rotationDeg=>apply({rotationDeg})}/>}
   <label className="dd-field"><span>Finish level</span><select aria-label="Fire feature finish level" value={finish} style={TALL} onChange={e=>onChange({yardAllowances:{...(data.yardAllowances??NO_ALLOWANCES),finish:e.target.value as YardAllowances['finish']}})}>{ALLOWANCE_FINISHES.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select><small>Sets its allowance, as in the cost estimator, with the kitchen and lighting allowances.</small></label>
  </div>
  <fieldset className="dd-fields" disabled={locked}><legend>Stone colour</legend>
   {STONES.map(s=><label key={s.hex} className="dd-check" style={TALL}><input type="radio" name={`fire-stone-${feature.id}`} checked={feature.color.toLowerCase()===s.hex} onChange={()=>apply({color:s.hex})}/><span aria-hidden="true" style={{display:'inline-block',width:28,height:28,borderRadius:6,border:'1px solid #6b6a66',background:s.hex}}/><span>{s.name}</span></label>)}
   <small>Illustrative tones from the wall products in our catalogue, not a verified stone colour.</small>
  </fieldset>
  {error&&<p role="alert">{error}</p>}
  {!feature.enabled?<p className="dd-note">Not in the design or estimate while it is excluded.</p>
   :report?.warnings.length?<div className="dd-quote-notice" role="status"><strong>Check before it is built</strong><ul>{report.warnings.map(w=><li key={w}>{w}</li>)}</ul></div>
   :report?<p className="dd-note" role="status">Clear of the house and deck, and on a level base.</p>:null}
  <p className="dd-note">Priced at the cost estimator&rsquo;s fire pit allowance for the finish level; a gas feature includes its gas line. It replaces any fire pit allowance chosen below, so it is never charged twice. A second fire feature needs its own builder quote.</p>
  <p className="dd-note">A wood-burning fire ring here is an approved enclosed wood-burning appliance: keep it {FIRE_CLEARANCE.woodFt} ft from the house and deck{FIRE_CLEARANCE.confirmedValues.woodFt?' (City of Barrie rule)':' (unconfirmed)'}. Open wood fire pits need a City of Barrie permit and {Math.round(FIRE_CLEARANCE.openWoodFireFt*.3048)} m from any building. A gas feature needs no burn permit; its hook-up is by a licensed gas contractor (quote), and it keeps {Math.round(FIRE_CLEARANCE.gasFt*12)} in from combustibles{FIRE_CLEARANCE.confirmedValues.gasFt?'':' (an unconfirmed default)'}. Confirm with Barrie Fire.</p>
 </section>;
}
