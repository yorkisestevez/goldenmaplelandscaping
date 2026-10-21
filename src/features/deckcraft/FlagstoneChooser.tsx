import type {YardFeature,YardFlagstone} from './types';
import {BOULDER_STONES} from './boulderStones';
import {DEFAULT_FLAGSTONE,FLAGSTONE_CHIPS,FLAGSTONE_PRODUCT_ID} from './flagstone';
import './FlagstoneChooser.css';

const JOINTS=[1,1.25,1.5,2,2.5,3] as const,CHIP_NAMES={black:'Black',tan:'Tan',grey:'Grey'} as const;

/** Natural flagstone for a patio or walkway: big stones cut to fit with one even joint of permeable chips. */
export default function FlagstoneChooser({feature,onChange}:{feature:YardFeature;onChange:(patch:Partial<YardFeature>)=>void}){
 const spec=feature.flagstone,set=(next:YardFlagstone)=>onChange({productId:FLAGSTONE_PRODUCT_ID,flagstone:next,hardscape:undefined,color:BOULDER_STONES.find(s=>s.id===next.stone)!.colour});
 return <fieldset className="dd-flagstone"><legend>Natural flagstone</legend>
  <p className="dd-flagstone-note">Large natural stones cut to fit, with one even joint of permeable chips, on a 1 in chip bed over clear stone. Supply and setting are quoted.</p>
  <div className="dd-flagstone-choices" role="group" aria-label="Flagstone stone">{BOULDER_STONES.map(s=><button type="button" key={s.id} aria-pressed={spec?.stone===s.id} onClick={()=>set({...(spec??DEFAULT_FLAGSTONE),stone:s.id})}><i style={{background:s.colour}} aria-hidden="true"/>{s.name}</button>)}</div>
  {spec&&<>
   <label className="dd-flagstone-field"><span>Joint width</span><select value={spec.jointIn} onChange={e=>set({...spec,jointIn:Number(e.target.value)})}>{JOINTS.map(j=><option key={j} value={j}>{j} in</option>)}{!(JOINTS as readonly number[]).includes(spec.jointIn)&&<option value={spec.jointIn}>{spec.jointIn} in</option>}</select></label>
   <div className="dd-flagstone-choices" role="group" aria-label="Joint chips">{(Object.keys(FLAGSTONE_CHIPS) as YardFlagstone['jointColour'][]).map(c=><button type="button" key={c} aria-pressed={spec.jointColour===c} onClick={()=>set({...spec,jointColour:c})}><i style={{background:FLAGSTONE_CHIPS[c]}} aria-hidden="true"/>{CHIP_NAMES[c]} chips</button>)}</div>
  </>}
 </fieldset>;
}
