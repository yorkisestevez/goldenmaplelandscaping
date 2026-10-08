import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {DeckData} from '../types';
import type {EstimateResult} from '../calculations';
import {dollars} from '../designFacts';
import {
  DEFAULT_FEATURE_LABOUR,
  FEATURE_LABOUR_LABELS,
  FEATURE_LABOUR_SCOPES,
  mergeFeatureLabour,
  readFeatureLabourDefaults,
  saveFeatureLabourDefaults,
  validateFeatureLabour,
  type FeatureLabourScope,
  type FeatureLabourSettings,
} from '../featureLabour';
import {DEFAULT_CREW_MEMBERS,DEFAULT_PERSON_HOUR_RATE,quoteCostFromCrewHours} from './quoteLabourHours';
import {OWNER_COST_LIMITS,bookInstallationLabour,parseOwnerMarkup,parseOwnerMoney} from './ownerCostLimits';
import './ownerCostEditor.css';

type Props={
  data:DeckData;
  estimate:EstimateResult;
  onUpdate:(patch:Partial<DeckData>)=>void;
  onClose?:()=>void;
  /** Inline block in Proposal & files, or a modal from the price bar. */
  variant?:'inline'|'dialog';
};

const MATERIAL_SECTIONS=/^(Foundation|Structural Framing|Decking|Hardware|Railing|Stairs|Add-ons|Accent|Deck-part|Skirting|Under-deck|Stair and level cladding|Picture-frame|Custom board)/i;
const LABOUR_ITEM='Installation Labour';

/** Private owner editor for material markup, installation labour, and priced line overrides. */
export default function OwnerCostEditor({data,estimate,onUpdate,onClose,variant='dialog'}:Props){
  const [error,setError]=useState('');
  const [status,setStatus]=useState('');
  const [markupDraft,setMarkupDraft]=useState(String(data.materialMarkup??35));
  const [labourDraft,setLabourDraft]=useState(data.customLaborCost===undefined?'':String(data.customLaborCost));
  const [crewMembers,setCrewMembers]=useState(String(DEFAULT_CREW_MEMBERS));
  const [hours,setHours]=useState('');
  const [personHourRate,setPersonHourRate]=useState(String(DEFAULT_PERSON_HOUR_RATE));
  const [lineDrafts,setLineDrafts]=useState<Record<string,string>>({});
  const [feature,setFeature]=useState<FeatureLabourSettings>(()=>validateFeatureLabour(data.featureLabour));
  const closeRef=useRef(onClose);closeRef.current=onClose;

  useEffect(()=>setMarkupDraft(String(data.materialMarkup??35)),[data.materialMarkup]);
  useEffect(()=>setLabourDraft(data.customLaborCost===undefined?'':String(data.customLaborCost)),[data.customLaborCost]);
  useEffect(()=>setFeature(validateFeatureLabour(data.featureLabour)),[data.featureLabour]);
  useEffect(()=>{
    const next:Record<string,string>={};
    for(const [name,row] of Object.entries(data.customOverrides??{}))if(row.cost!==undefined)next[name]=String(row.cost);
    setLineDrafts(next);
  },[data.customOverrides]);

  const labourOverridden=data.customLaborCost!==undefined;
  const book=labourOverridden?0:bookInstallationLabour(estimate);
  const overrides=data.customOverrides??{};
  const commitFeature=(next:FeatureLabourSettings)=>{
    try{
      const clean=validateFeatureLabour(next);
      setFeature(clean);
      onUpdate({featureLabour:clean});
      setError('');setStatus('Inlay & special-feature labour updated for this job.');
    }catch(e){setFeature(validateFeatureLabour(data.featureLabour));setError(e instanceof Error?e.message:'Feature labour settings could not be saved.');}
  };
  const patchScope=(id:FeatureLabourScope,patch:Partial<FeatureLabourSettings['scopes'][FeatureLabourScope]>)=>{
    commitFeature(mergeFeatureLabour(feature,{scopes:{[id]:{...feature.scopes[id],...patch}} as FeatureLabourSettings['scopes']}));
  };

  const materialLines=useMemo(()=>estimate.sections
    .filter(s=>MATERIAL_SECTIONS.test(s.title))
    .flatMap(s=>s.items.filter(i=>i.cost!==null&&Number(i.qty)>0&&i.name!==LABOUR_ITEM).map(i=>({section:s.title,name:i.name,cost:i.cost as number,qty:i.qty,unit:i.unit}))),
  [estimate]);

  const commitMarkup=()=>{
    try{
      if(!markupDraft.trim()){onUpdate({materialMarkup:undefined});setMarkupDraft('35');setError('');return;}
      const n=parseOwnerMarkup(markupDraft);onUpdate({materialMarkup:n});setMarkupDraft(String(n));setError('');
    }catch(e){setMarkupDraft(String(data.materialMarkup??35));setError(e instanceof Error?e.message:'Material markup could not be saved.');}
  };

  const commitLabour=()=>{
    try{
      if(!labourDraft.trim()){onUpdate({customLaborCost:undefined});setError('');return;}
      const n=parseOwnerMoney(labourDraft,'Labour cost');onUpdate({customLaborCost:n});setLabourDraft(String(n));setError('');
    }catch(e){setLabourDraft(data.customLaborCost===undefined?'':String(data.customLaborCost));setError(e instanceof Error?e.message:'Labour cost could not be saved.');}
  };

  const commitLine=(name:string,raw:string)=>{
    try{
      const next={...overrides};
      if(!raw.trim()){
        const cur=next[name];
        if(cur?.qty!==undefined)next[name]={qty:cur.qty};else delete next[name];
      }else{
        next[name]={...next[name],cost:parseOwnerMoney(raw,name)};
      }
      if(Object.keys(next).length>OWNER_COST_LIMITS.overrideMax)throw Error(`At most ${OWNER_COST_LIMITS.overrideMax} line overrides.`);
      onUpdate({customOverrides:Object.keys(next).length?next:undefined});setError('');
    }catch(e){
      setLineDrafts(d=>{const copy={...d};const cur=overrides[name]?.cost;if(cur===undefined)delete copy[name];else copy[name]=String(cur);return copy;});
      setError(e instanceof Error?e.message:'That line cost could not be saved.');
    }
  };

  const applyCrewLabour=()=>{
    try{
      const costs=quoteCostFromCrewHours({crewMembers,hours,personHourRate,materials:0});
      onUpdate({customLaborCost:costs.installationCost});setLabourDraft(String(costs.installationCost));setError('');
    }catch(e){setError(e instanceof Error?e.message:'Crew-hours labour could not be applied.');}
  };

  const clearAll=()=>{
    onUpdate({materialMarkup:undefined,customLaborCost:undefined,customOverrides:undefined,featureLabour:undefined});
    setMarkupDraft('35');setLabourDraft('');setLineDrafts({});setFeature(validateFeatureLabour(undefined));setError('');setStatus('Owner costs reset to book defaults.');
  };
  const saveDeviceDefaults=async()=>{
    try{await saveFeatureLabourDefaults(feature);setStatus('Saved as your device defaults for new jobs.');setError('');}
    catch(e){setError(e instanceof Error?e.message:'Device defaults could not be saved.');}
  };
  const loadDeviceDefaults=async()=>{
    try{const next=await readFeatureLabourDefaults();commitFeature(next);setStatus('Loaded your device defaults onto this job.');}
    catch(e){setError(e instanceof Error?e.message:'Device defaults could not be loaded.');}
  };

  const body=<div className="dd-owner-costs" data-variant={variant}>
    <header className="dd-owner-costs-header">
      <div>
        <span className="dd-owner-costs-eyebrow">Golden Maple · Owner costs</span>
        <h3 id="dd-owner-costs-title">Edit your material &amp; labour costs</h3>
        <p>Private to this job. Changes the planning total; not written into public share links or design JSON.</p>
      </div>
      {onClose&&<button type="button" className="dd-owner-costs-close" onClick={onClose} aria-label="Close owner cost editor">×</button>}
    </header>

    <section aria-labelledby="dd-owner-materials-title">
      <h4 id="dd-owner-materials-title">Materials</h4>
      <label className="dd-owner-costs-field">Material markup
        <input aria-label="Material markup percent" type="number" min={OWNER_COST_LIMITS.markupMin} max={OWNER_COST_LIMITS.markupMax} step="0.1" value={markupDraft} onChange={e=>setMarkupDraft(e.target.value)} onBlur={commitMarkup} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur();}}/>
        <small>Percent on supply lines (book default 35%). Clear and leave the field to restore the default.</small>
      </label>
      <details className="dd-owner-costs-lines">
        <summary>Override priced material lines ({materialLines.length})</summary>
        <p>Type your CAD total for a line, then leave the field. Clear a field to restore the book amount. Quantities stay as modeled.</p>
        <ul>
          {materialLines.map(line=>{
            const own=overrides[line.name]?.cost!==undefined;
            return <li key={`${line.section}:${line.name}`}>
              <label>
                <span>{line.name}<small>{line.section} · {line.qty} {line.unit} · {own?`your override ${dollars(line.cost)}`:`priced ${dollars(line.cost)}`}</small></span>
                <input aria-label={`${line.name} cost override`} type="number" min={OWNER_COST_LIMITS.amountMin} max={OWNER_COST_LIMITS.amountMax} step=".01" placeholder={own?undefined:String(line.cost)} value={lineDrafts[line.name]??''} onChange={e=>setLineDrafts(d=>({...d,[line.name]:e.target.value}))} onBlur={e=>commitLine(line.name,e.target.value)} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur();}}/>
              </label>
            </li>;
          })}
        </ul>
      </details>
    </section>

    <section aria-labelledby="dd-owner-labour-title">
      <h4 id="dd-owner-labour-title">Labour</h4>
      <p role="status">{labourOverridden
        ?<>Your labour override is on. Modeled crew planning stays at <strong>{estimate.manHours.toFixed(1)} person-hours</strong>; clear the field to restore book labour.</>
        :<>Book installation labour: <strong>{dollars(book)}</strong> ({estimate.manHours.toFixed(1)} planned person-hours). Your override replaces that total only.</>}</p>
      <label className="dd-owner-costs-field">Your installation labour · CAD
        <input aria-label="Your installation labour cost" type="number" min={OWNER_COST_LIMITS.amountMin} max={OWNER_COST_LIMITS.amountMax} step=".01" placeholder={labourOverridden?undefined:String(Math.round(book*100)/100)} value={labourDraft} onChange={e=>setLabourDraft(e.target.value)} onBlur={commitLabour} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur();}}/>
        <small>{labourOverridden?'Override on.':'Using the book labour total.'}</small>
      </label>
      <div className="dd-owner-costs-actions">
        <button type="button" className="dd-secondary" onClick={()=>{setLabourDraft('');onUpdate({customLaborCost:undefined});setError('');}}>Use book labour</button>
      </div>
      <details className="dd-owner-costs-crew">
        <summary>Fill labour from crew × hours</summary>
        <p>Man-hours = crew members × hours × person-hour rate (default CAD {DEFAULT_PERSON_HOUR_RATE.toFixed(2)} from $3,700 ÷ 27).</p>
        <div className="dd-owner-costs-grid">
          <label>Crew members<input aria-label="Owner labour crew members" type="number" min="1" max="12" step="1" value={crewMembers} onChange={e=>setCrewMembers(e.target.value)}/></label>
          <label>Hours<input aria-label="Owner labour hours" type="number" min=".25" max="999" step=".25" value={hours} onChange={e=>setHours(e.target.value)}/></label>
          <label>Person-hour rate · CAD<input aria-label="Owner labour person-hour rate" type="number" min="0" max={OWNER_COST_LIMITS.amountMax} step=".01" value={personHourRate} onChange={e=>setPersonHourRate(e.target.value)}/></label>
        </div>
        <button type="button" className="dd-secondary" onClick={applyCrewLabour}>Apply as installation labour</button>
      </details>
    </section>

    <section aria-labelledby="dd-owner-features-title">
      <h4 id="dd-owner-features-title">Inlays &amp; special features</h4>
      <p>Accent boards, medallions and custom inlays default to man-hours plus any extra materials. Board supply stays on the material lines. Edit your rates here per job, or save them as this device’s defaults.</p>
      <label className="dd-owner-costs-field">Person-hour rate · CAD
        <input aria-label="Feature labour person-hour rate" type="number" min="0.01" max={OWNER_COST_LIMITS.amountMax} step=".01" value={feature.personHourRate} onChange={e=>setFeature(f=>({...f,personHourRate:Number(e.target.value)}))} onBlur={e=>commitFeature({...feature,personHourRate:Number(e.target.value)})} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur();}}/>
        <small>Default CAD {DEFAULT_FEATURE_LABOUR.personHourRate.toFixed(2)} from $3,700 ÷ 27.</small>
      </label>
      {FEATURE_LABOUR_SCOPES.map(id=>{
        const s=feature.scopes[id];
        return <details key={id} className="dd-owner-costs-crew" open={s.mode==='crew-hours'}>
          <summary>{FEATURE_LABOUR_LABELS[id]}</summary>
          <label className="dd-owner-costs-field">Pricing
            <select aria-label={`${FEATURE_LABOUR_LABELS[id]} pricing`} value={s.mode} onChange={e=>patchScope(id,{mode:e.target.value as 'crew-hours'|'quote'})}>
              <option value="crew-hours">Man-hours + materials (default)</option>
              <option value="quote">Builder quote (enter in Quote Review)</option>
            </select>
          </label>
          {s.mode==='crew-hours'&&<>
            <div className="dd-owner-costs-grid">
              <label>Crew members<input aria-label={`${FEATURE_LABOUR_LABELS[id]} crew`} type="number" min="1" max="12" step="1" value={s.crewMembers} onChange={e=>setFeature(f=>({...f,scopes:{...f.scopes,[id]:{...f.scopes[id],crewMembers:Number(e.target.value)}}))} onBlur={e=>patchScope(id,{crewMembers:Number(e.target.value)})}/></label>
              <label>Hours{s.hoursPerUnit?' / unit':''}<input aria-label={`${FEATURE_LABOUR_LABELS[id]} hours`} type="number" min=".25" max="999" step=".25" value={s.hours} onChange={e=>setFeature(f=>({...f,scopes:{...f.scopes,[id]:{...f.scopes[id],hours:Number(e.target.value)}}))} onBlur={e=>patchScope(id,{hours:Number(e.target.value)})}/></label>
              <label>Extra materials · CAD<input aria-label={`${FEATURE_LABOUR_LABELS[id]} materials`} type="number" min="0" max={OWNER_COST_LIMITS.amountMax} step=".01" value={s.materialsCad} onChange={e=>setFeature(f=>({...f,scopes:{...f.scopes,[id]:{...f.scopes[id],materialsCad:Number(e.target.value)}}))} onBlur={e=>patchScope(id,{materialsCad:Number(e.target.value)})}/></label>
            </div>
            <label className="dd-owner-costs-check"><input type="checkbox" checked={s.hoursPerUnit} onChange={e=>patchScope(id,{hoursPerUnit:e.target.checked})}/> Hours are per board / medallion / inlay</label>
          </>}
        </details>;
      })}
      <div className="dd-owner-costs-actions">
        <button type="button" className="dd-secondary" onClick={()=>void saveDeviceDefaults()}>Save as my defaults</button>
        <button type="button" className="dd-secondary" onClick={()=>void loadDeviceDefaults()}>Load my defaults</button>
        <button type="button" className="dd-secondary" onClick={()=>commitFeature(structuredClone(DEFAULT_FEATURE_LABOUR))}>Reset feature labour</button>
      </div>
    </section>

    <footer className="dd-owner-costs-footer">
      <button type="button" className="dd-secondary" onClick={clearAll}>Reset markup, labour &amp; line overrides</button>
      {onClose&&<button type="button" className="dd-primary" onClick={onClose}>Done</button>}
    </footer>
    {status&&<p className="dd-owner-costs-status" role="status">{status}</p>}
    {error&&<p className="dd-owner-costs-error" role="alert">{error}</p>}
  </div>;

  if(variant==='inline')return body;
  if(typeof document==='undefined')return null;
  return createPortal(<div className="dd-owner-costs-backdrop" role="presentation" onClick={e=>{if(e.target===e.currentTarget)closeRef.current?.();}}>
    <div className="dd-owner-costs-dialog" role="dialog" aria-modal="true" aria-labelledby="dd-owner-costs-title">{body}</div>
  </div>,document.body);
}
