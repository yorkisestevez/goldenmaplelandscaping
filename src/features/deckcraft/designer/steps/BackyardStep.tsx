import YardEditor from '../../YardEditor';
import {dollars,type DeckEstimate} from '../../designFacts';
import {hasYardAllowances,splitSubtotal} from '../../backyard';
import {ALLOWANCE_FINISHES,NO_ALLOWANCES,TURF_SQFT} from '../../yardSettings';
import type {DeckData,YardAllowances} from '../../types';
import {Field,NumberField,type Update} from '../fields';

/**
 * The Backyard section: patios, retaining walls and water features around the deck, plus a fire pit, outdoor kitchen, turf and
 * landscape lighting at the cost estimator's allowances, all with their own subtotal.
 */
export default function BackyardStep({data,update,onApplyElevation,estimate,earlierYard,onRestoreEarlierYard,onDismissEarlierYard,onDesign,selectedFeatureId,onSelectFeature,onGeometry}:{onGeometry?:(data:DeckData|null)=>void;data:DeckData;update:Update;onApplyElevation?:Update;estimate:DeckEstimate;earlierYard:number;onRestoreEarlierYard:()=>void;onDismissEarlierYard:()=>void;onDesign?:()=>void;selectedFeatureId?:string;onSelectFeature?:(id:string)=>void}){
  const active=(data.yardFeatures??[]).filter(f=>f.enabled),split=splitSubtotal(estimate),yard=estimate.yardTakeoff;
  const a=data.yardAllowances??NO_ALLOWANCES;
  // Switching the last allowance off removes them, so the design saves exactly as one without allowances.
  const setAllowance=(patch:Partial<YardAllowances>)=>{const next={...a,...patch};update({yardAllowances:hasYardAllowances(next)?next:undefined});};
  const hint=(...words:(string|undefined)[])=>words.filter(Boolean).join(' ');
  const amount=(id:string)=>{const row=yard.sections.find(s=>s.id===`allowance-${id}`);return row?row.amountCents===null?'Builder quote required':`Allowance: ${dollars(row.amountCents/100)}`:undefined;};
  return <>
    {earlierYard>0&&<div className="dd-quote-notice" role="status"><strong>Your earlier design had a backyard</strong><p>It had {earlierYard} backyard feature{earlierYard===1?'':'s'} (patios, walls or water). Add {earlierYard===1?'it':'them'} back to this design?</p><div className="dd-summary-actions"><button type="button" className="dd-primary" onClick={onRestoreEarlierYard}>Add {earlierYard===1?'it':'them'} back</button><button type="button" className="dd-secondary" onClick={onDismissEarlierYard}>No thanks</button></div></div>}
    {onDesign&&<div className="dd-summary-actions"><button type="button" className="dd-primary" onClick={onDesign}>Design patios &amp; walls on the plan</button></div>}
    <YardEditor onGeometry={onGeometry} data={data} onChange={update} onApplyElevation={onApplyElevation} selectedFeatureId={selectedFeatureId} onSelectFeature={onSelectFeature}/>
    <section className="dd-allowances" aria-labelledby="dd-allowances-title">
      <h3 id="dd-allowances-title">Fire pit, kitchen, turf and lighting</h3>
      <p className="dd-note">These are priced at the allowances in our online cost estimator: planning figures, not quotes. They are not drawn in 3D; we place them with you at the site visit.</p>
      <div className="dd-fields">
        <Field label="Fire pit" hint={hint('A gas fire pit includes its gas line.',amount('firepit'))}><select aria-label="Fire pit" value={a.firePit} onChange={e=>setAllowance({firePit:e.target.value as YardAllowances['firePit']})}><option value="none">None</option><option value="wood">Wood-burning</option><option value="gas">Natural gas or propane</option></select></Field>
        <Field label="Outdoor kitchen" hint={hint('Basic: counter, cabinet and a built-in grill. A full build adds services, appliances and finishes.',amount('kitchen'))}><select aria-label="Outdoor kitchen" value={a.kitchen} onChange={e=>setAllowance({kitchen:e.target.value as YardAllowances['kitchen']})}><option value="none">None</option><option value="basic">Basic</option><option value="full">Full build</option></select></Field>
      </div>
      <label className="dd-check"><input type="checkbox" checked={a.turfSqft>0} onChange={e=>setAllowance({turfSqft:e.target.checked?TURF_SQFT.default:0})}/><span>Artificial turf{amount('turf')&&<small>{amount('turf')}</small>}</span></label>
      {a.turfSqft>0&&<div className="dd-fields"><NumberField label="Turf area" value={a.turfSqft} min={TURF_SQFT.min} max={TURF_SQFT.max} unit="sq ft" increment={10} onValue={turfSqft=>setAllowance({turfSqft})}/></div>}
      <label className="dd-check"><input type="checkbox" checked={a.lighting} onChange={e=>setAllowance({lighting:e.target.checked})}/><span>Landscape lighting for the yard<small>{hint('Paths, planting and walls. Deck lighting is chosen in Outdoor lighting.',amount('lighting'))}</small></span></label>
      {(a.firePit!=='none'||a.kitchen!=='none'||a.lighting)&&<div className="dd-fields"><Field label="Finish level" hint="Sets the fire pit, kitchen and lighting allowances, as in the cost estimator."><select aria-label="Finish level" value={a.finish} onChange={e=>setAllowance({finish:e.target.value as YardAllowances['finish']})}>{ALLOWANCE_FINISHES.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></Field></div>}
    </section>
    {(active.length>0||hasYardAllowances(data.yardAllowances))&&<p className="dd-note dd-backyard-subtotal" role="status">Backyard subtotal: <strong>{dollars(split.backyard)}</strong> + HST{yard.quoteRequired?' (the priced portion; some items need a supplier quote)':''}. It is shown separately from the deck on your estimate and proposal.</p>}
  </>;
}
