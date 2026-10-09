import {useMemo} from 'react';
import {accentCollections,colourRef,deckColourRef,parseColourRef} from '../boardFinishes';
import type {DeckTakeoff} from '../deckTakeoff';
import {newSkirting,SKIRTING_LIMITS,SKIRTING_STYLE_NAMES,SKIRTING_STYLES,skirtingPlan,foldedBoardCandidate} from '../skirting';
import type {DeckData,SkirtingConfig,SkirtingStyle} from '../types';
import {NumberField,type Update} from './fields';

const capital=(text:string)=>text.charAt(0).toUpperCase()+text.slice(1);

/**
 * Skirting under the deck (loaded on demand, on the site step): the style, a real product colour (the deck's own
 * collection, or another priced one of the same kind), the gap above the ground, access panels and which sides are
 * skirted. Edges against the house, where levels meet and across stair openings are never skirted (skirting.ts).
 * Every input is clamped to the range a saved design accepts. Face, backing, access panels and labour are priced from the skirting rate table.
 */
export default function SkirtingEditor({data,update,model}:{data:DeckData;update:Update;model:DeckTakeoff}){
  const config=data.skirting;
  const plan=useMemo(()=>config?skirtingPlan(data,model):null,[config,data,model]);
  const main=deckColourRef(data);
  const colours=accentCollections(data).flatMap(m=>m.colors.map(c=>({ref:colourRef(m.id,c.name),label:`${c.name} (${m.name})`}))).filter(c=>c.ref!==main);
  const [cmin,cmax]=SKIRTING_LIMITS.clearanceIn,[pmin,pmax]=SKIRTING_LIMITS.accessPanels;
  // Saved in the same shape loading gives it: optional parts left out when empty.
  const save=(patch:Partial<SkirtingConfig>)=>{
    if(!config)return;const next={...config,...patch};
    const canFold=next.style==='Horizontal boards'&&foldedBoardCandidate(next.colour??main);
    update({skirting:{style:next.style,...(next.colour?{colour:next.colour}:{}),clearanceIn:Math.min(cmax,Math.max(cmin,next.clearanceIn)),...(next.openEdges?.length?{openEdges:next.openEdges}:{}),...(next.accessPanels?{accessPanels:Math.round(Math.min(pmax,Math.max(pmin,next.accessPanels)))}:{}),...(canFold&&next.cornerTreatment?{cornerTreatment:next.cornerTreatment}:{})}});
  };
  const setSide=(id:string,skirted:boolean)=>{const rest=(config?.openEdges??[]).filter(e=>e!==id);save({openEdges:skirted?rest:[...rest,id].slice(-SKIRTING_LIMITS.openEdges)});};
  const colourValue=config?.colour&&colours.some(c=>c.ref===config.colour)?config.colour:'';
  const panels=plan?.accessPanels.placed??0;
  return <section className="dd-skirting" aria-labelledby="dd-skirting-title">
    <h3 id="dd-skirting-title">Skirting under the deck</h3>
    <p className="dd-note">Close in the space between the deck and the ground with boards or lattice. Edges against the house, where deck levels meet and across stair openings stay open. Face, backing, access panels and install labour are in the priced total, from the skirting rate table.</p>
    <label className="dd-check"><input type="checkbox" checked={!!config} onChange={e=>update({skirting:e.target.checked?newSkirting():undefined})}/><span>Add skirting under the deck</span></label>
    {config&&plan&&<>
      <div className="dd-fields">
        <label className="dd-field"><span>Skirting style</span><select aria-label="Skirting style" value={config.style} onChange={e=>save({style:e.target.value as SkirtingStyle})}>{SKIRTING_STYLES.map(s=><option key={s} value={s}>{SKIRTING_STYLE_NAMES[s]}</option>)}</select></label>
        <label className="dd-field"><span>Skirting colour</span><select aria-label="Skirting colour" value={colourValue} onChange={e=>save({colour:e.target.value||undefined})}><option value="">The deck colour</option>{colours.map(c=><option key={c.ref} value={c.ref}>{c.label}</option>)}</select></label>
        <NumberField label="Gap above the ground" value={plan.clearanceIn} min={cmin} max={cmax} unit="in" increment={.5} hint="Lets air and water out from under the deck; 2 in is typical." onValue={clearanceIn=>save({clearanceIn})}/>
        <NumberField label="Access panels" value={config.accessPanels??0} min={pmin} max={pmax} unit="" increment={1} hint="Framed, removable panels to reach under the deck." onValue={n=>save({accessPanels:Math.round(n)})}/>
      </div>
      {config.style==='Horizontal boards'&&parseColourRef(plan.colour)?.material.isComposite&&<>
        <label className="dd-field"><span>Skirting corners</span><select aria-label="Skirting corners" value={plan.foldedCorners?'Folded solid boards':''} onChange={e=>save({cornerTreatment:e.target.value?'Folded solid boards':undefined})}><option value="">Mitred board joins</option><option value="Folded solid boards" disabled={!foldedBoardCandidate(plan.colour)}>Folded solid boards (custom fabrication)</option></select></label>
        {!foldedBoardCandidate(plan.colour)&&<p className="dd-note">This collection has a scalloped profile. For custom folded corners, choose a full-profile composite or PVC skirting colour; a square board edge alone does not make the core solid.</p>}
        {plan.foldedCorners&&<p className="dd-note">A solid deck board wraps around each outside corner with continuous grain. Requires solid-profile stock and builder confirmation of the selected product and fabrication method. Heat-folding and warranty coverage are not assumed. Custom fabrication stays in the priced skirting total; it is not a separate quote.</p>}
      </>}
      {plan.edges.length>0&&<fieldset className="dd-skirting-sides"><legend>Sides to skirt</legend>
        {plan.edges.map(e=><label key={e.id} className="dd-check"><input type="checkbox" checked={!e.open} onChange={ev=>setSide(e.id,ev.target.checked)}/><span>{capital(e.label)} · {e.lengthFt.toFixed(1)} ft</span></label>)}
      </fieldset>}
      <p className="dd-skirting-status" role="status">{plan.runs.length
        ?`Skirting ${plan.lengthFt.toFixed(1)} ft, ${Math.round(plan.faceSqft)} sq ft of face${panels?` with ${panels} access panel${panels===1?'':'s'}`:''}. Priced from the skirting rate table.`
        :plan.edges.some(e=>e.open)?'No side is skirted: turn a side on above.':'No deck edge has room for skirting: the framing sits too close to the ground.'}</p>
      {plan.notes.length>0&&<details className="dd-advanced"><summary>Ventilation, access and drainage</summary><ul className="dd-review-flags">{plan.notes.map(n=><li key={n}>{n}</li>)}</ul></details>}
    </>}
  </section>;
}
