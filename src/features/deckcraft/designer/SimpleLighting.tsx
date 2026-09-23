import {MAX_FIXTURE_QTY,STAIR_LIGHT_STYLES} from '../lightingSystem';
import type {DeckData} from '../types';
import type {AutoCounts} from './constants';
import {Field,type Update} from './fields';

/** One-tap deck lighting (post caps and under-step lights), shown on the stairs step and the extras step. */
export default function SimpleLighting({data,update,autoCounts}:{data:DeckData;update:Update;autoCounts:AutoCounts}){
  const stairStyle=data.autoLighting?.stairStyle??'evo_hyde';
  return <fieldset className="dd-simple-lighting"><legend>Deck lighting</legend>
    <label className="dd-check"><input type="checkbox" checked={!!data.autoLighting?.posts} disabled={!data.autoLighting?.posts&&!autoCounts.posts} onChange={e=>update({autoLighting:{...data.autoLighting,posts:e.target.checked}})}/><span>Cap light on each railing post{autoCounts.posts?` (${Math.min(autoCounts.posts,MAX_FIXTURE_QTY)})`:' · add a railing first'}</span></label>
    <label className="dd-check"><input type="checkbox" checked={!!data.autoLighting?.stairs} disabled={!data.autoLighting?.stairs&&!autoCounts.stairs} onChange={e=>update({autoLighting:{...data.autoLighting,stairs:e.target.checked}})}/><span>Light under each step{autoCounts.stairs?` (${Math.min(autoCounts.stairs,MAX_FIXTURE_QTY)})`:' · add a stair flight first'}</span></label>
    <Field label="Under-step light" hint={STAIR_LIGHT_STYLES[stairStyle].note}><select aria-label="Under-step light style" value={stairStyle} onChange={e=>update({autoLighting:{...data.autoLighting,stairStyle:e.target.value as keyof typeof STAIR_LIGHT_STYLES}})}>{Object.entries(STAIR_LIGHT_STYLES).map(([id,style])=><option key={id} value={id}>{style.label}</option>)}</select></Field>
    {stairStyle==='evo_flex'&&data.stairWidth<44&&<p className="dd-quote-notice">A 1 m EVO FLEX strip is longer than these {data.stairWidth} in steps can hold. Widen the stairs to about 44 in, or choose EVO HYDE.</p>}
    <p className="dd-note">Post caps use PUCK lights, with a HUB-100 transformer, from our existing price book. Switch the preview to Night to see them.</p>
  </fieldset>;
}
