import {useEffect,useId,useState} from 'react';
import type {CompassPoint,PermitSite} from '../types';
import {COMPASS_POINTS,COMPASS_WORDS,FT_PER_M,PERMIT_SITE_LIMITS,validatePermitSite} from '../permitSite';
import {feetInches} from './drawingTypes';
import {feetAndMetres} from './sitePlan';

type Measure=keyof typeof PERMIT_SITE_LIMITS;
type Draft=Record<Measure,string>&{yardFaces:CompassPoint|'';corner:'left'|'right'|''};
const MEASURES:[Measure,string,string][]=[
  ['lotWidthFt','Lot width','Along the house: the frontage on the survey'],
  ['lotDepthFt','Lot depth','From the front lot line to the rear lot line'],
  ['leftYardFt','Left side yard','From the left lot line to the closest house wall, garage included'],
  ['rearYardFt','Rear yard','From the wall the deck is on to the rear lot line'],
];
const shown=(ft:number|undefined,unit:'ft'|'m')=>ft===undefined?'':String(Number((unit==='m'?ft/FT_PER_M:ft).toFixed(2)));
const draftOf=(site:PermitSite|undefined,unit:'ft'|'m'):Draft=>({lotWidthFt:shown(site?.lotWidthFt,unit),lotDepthFt:shown(site?.lotDepthFt,unit),leftYardFt:shown(site?.leftYardFt,unit),rearYardFt:shown(site?.rearYardFt,unit),yardFaces:site?.yardFaces??'',corner:site?.corner??''});

/**
 * The lot for the site plan (sheet A-0), from the plan of survey: its width and depth, and where the house sits on it.
 * A survey in metres can be typed as it is; the design keeps feet. Nothing is saved until all four measurements are in
 * and valid, and the other two yards are shown as the house model leaves them. A lot already entered opens folded to
 * one line, so the sheet stays in view.
 */
export default function PermitSiteEditor({site,house,issues,onChange}:{
  site?:PermitSite;
  /** The house footprint's width along the lot and its depth from the wall the deck is on, inches. */
  house:{widthIn:number;depthIn:number};
  /** The site plan's open review items. */
  issues:string[];
  onChange:(site:PermitSite|undefined)=>void;
}){
  const id=useId(),[open,setOpen]=useState(()=>!site),[unit,setUnit]=useState<'ft'|'m'>('ft'),[draft,setDraft]=useState(()=>draftOf(site,'ft')),[error,setError]=useState('');
  // An undo, or a lot cleared elsewhere, shows through.
  useEffect(()=>{setDraft(draftOf(site,unit));setError('');},[site,unit]);
  function commit(next:Draft){
    if(MEASURES.some(([key])=>next[key].trim()==='')){setError('');return;}
    const feet=(v:string)=>{const n=Number(v);return Number.isFinite(n)?Math.round((unit==='m'?n*FT_PER_M:n)*100)/100:NaN;};
    // Each measurement's range, said in the units being typed.
    for(const [key,label] of MEASURES){const [min,max]=PERMIT_SITE_LIMITS[key],v=feet(next[key]);if(!(v>=min&&v<=max)){setError(`${label} must be between ${shown(min,unit)} and ${shown(max,unit)} ${unit==='ft'?'ft':'m'}.`);return;}}
    const lot=validatePermitSite({...Object.fromEntries(MEASURES.map(([key])=>[key,feet(next[key])])),...(next.yardFaces?{yardFaces:next.yardFaces}:{}),...(next.corner?{corner:next.corner}:{})});
    setError('');
    if(JSON.stringify(lot)!==JSON.stringify(site))onChange(lot);
  }
  const set=(patch:Partial<Draft>,now=false)=>{const next={...draft,...patch};setDraft(next);if(now)commit(next);};
  const right=site&&site.lotWidthFt*12-site.leftYardFt*12-house.widthIn,front=site&&site.lotDepthFt*12-site.rearYardFt*12-house.depthIn;
  const summary=site?`Lot ${feetInches(site.lotWidthFt*12)} × ${feetInches(site.lotDepthFt*12)}; the house ${feetInches(site.leftYardFt*12)} from the left and ${feetInches(site.rearYardFt*12)} from the rear lot line${site.yardFaces?`; the back yard faces ${COMPASS_WORDS[site.yardFaces]}`:''}.`:'Not entered yet.';
  return <section className="dd-permit-site" aria-labelledby={`${id}-title`} style={{border:'1px solid #e1e5da',borderRadius:12,padding:'12px 14px',margin:'8px 0 12px',background:'#fbfaf6'}}>
    <details open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary style={{cursor:'pointer'}}><h3 id={`${id}-title`} style={{display:'inline',fontSize:15,margin:0}}>Lot and setbacks</h3>{!open&&<span className="dd-note"> · {summary}</span>}</summary>
    <p className="dd-note" style={{margin:'4px 0 0'}}>Take these from your plan of survey. Left and right are as you look at the house from the back yard. The site plan measures the deck's distance to each lot line from them.</p>
    <div role="radiogroup" aria-label="Survey units" style={{display:'flex',gap:'.5rem',margin:'10px 0 0'}}>
      {(['ft','m'] as const).map(u=><button key={u} type="button" role="radio" aria-checked={unit===u} className={unit===u?'dd-primary':'dd-secondary'} onClick={()=>{if(u===unit)return;setUnit(u);setDraft(site?draftOf(site,u):{...draft,...Object.fromEntries(MEASURES.map(([key])=>[key,'']))});setError('');}}>{u==='ft'?'Feet':'Metres'}</button>)}
    </div>
    <form className="dd-fields" style={{margin:'10px 0'}} onSubmit={e=>{e.preventDefault();commit(draft);}}>
      {MEASURES.map(([key,label,hint])=><label key={key} className="dd-field"><span>{label}</span>
        <span className="dd-number"><input aria-label={`${label} (${unit==='ft'?'feet':'metres'})`} type="number" inputMode="decimal" min={0} step={unit==='ft'?.5:.01} value={draft[key]} onChange={e=>set({[key]:e.target.value} as Partial<Draft>)} onBlur={()=>commit(draft)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit(draft);}}}/><span>{unit}</span></span>
        <small>{hint}</small></label>)}
      <label className="dd-field"><span>The back yard faces</span>
        <select aria-label="The back yard faces" value={draft.yardFaces} onChange={e=>set({yardFaces:e.target.value as Draft['yardFaces']},true)}>
          <option value="">Choose, for the north arrow</option>{COMPASS_POINTS.map(c=><option key={c} value={c}>{COMPASS_WORDS[c][0].toUpperCase()+COMPASS_WORDS[c].slice(1)}</option>)}
        </select></label>
      <label className="dd-field"><span>Corner lot</span>
        <select aria-label="Corner lot" value={draft.corner} onChange={e=>set({corner:e.target.value as Draft['corner']},true)}>
          <option value="">No, one street in front</option><option value="left">Yes, a street on the left side</option><option value="right">Yes, a street on the right side</option>
        </select></label>
    </form>
    {site&&right!==undefined&&front!==undefined&&<p className="dd-note" style={{margin:'0 0 6px'}}>From the house model: right side yard {right>0?feetAndMetres(right):'none (the house reaches the lot line)'}, front yard {front>0?feetAndMetres(front):'none (the house reaches the lot line)'}.</p>}
    {site&&<button type="button" className="dd-secondary" onClick={()=>{onChange(undefined);setDraft(draftOf(undefined,unit));setError('');}}>Clear the lot</button>}
    </details>
    {error&&<p className="dd-error" role="alert" style={{margin:'6px 0 0'}}>{error}</p>}
    {issues.length>0&&<ul style={{margin:'6px 0 0',paddingLeft:18}}>{issues.map(i=><li key={i}>{i.replace(/^Site plan: /,'')}</li>)}</ul>}
  </section>;
}
