import {MAX_FIXTURE_QTY,STAIR_LIGHT_STYLES} from '../lightingSystem';
import type {DeckData} from '../types';
import type {AutoCounts} from './constants';
import {Field,type Update} from './fields';
import {BORDER_LIGHTING,borderLightingSelected} from '../borderLighting';

/** One-tap deck lighting (post caps and under-step lights), shown on the stairs step and the extras step. */
export default function SimpleLighting({data,update,autoCounts}:{data:DeckData;update:Update;autoCounts:AutoCounts}){
  const stairStyle=data.autoLighting?.stairStyle??'evo_hyde';
  return <fieldset className="dd-simple-lighting"><legend>Deck lighting</legend>
    <label className="dd-check"><input type="checkbox" checked={!!data.autoLighting?.posts} disabled={!data.autoLighting?.posts&&!autoCounts.posts} onChange={e=>update({autoLighting:{...data.autoLighting,posts:e.target.checked}})}/><span>Cap light on each railing post{autoCounts.posts?` (${Math.min(autoCounts.posts,MAX_FIXTURE_QTY)})`:data.railingType==='Frameless Glass'?' · a frameless glass railing has no posts':' · add a railing first'}</span></label>
    <label className="dd-check"><input type="checkbox" checked={!!data.autoLighting?.stairs} disabled={!data.autoLighting?.stairs&&!autoCounts.stairs} onChange={e=>update({autoLighting:{...data.autoLighting,stairs:e.target.checked}})}/><span>Light under each step{autoCounts.stairs?` (${Math.min(autoCounts.stairs,MAX_FIXTURE_QTY)})`:' · add a stair flight first'}</span></label>
    <label className="dd-check"><input type="checkbox" aria-label="Light under the picture-frame deck edge" checked={!!data.autoLighting?.border} disabled={!data.autoLighting?.border&&!autoCounts.border} onChange={e=>update({autoLighting:{...data.autoLighting,border:e.target.checked},...(e.target.checked?{pictureFrameRows:data.pictureFrameRows||1}:{}),lightingPreviewOn:true})}/><span>Light under the picture-frame deck edge{autoCounts.border?` (${autoCounts.border} EVO HYDE 550)`:' · no exposed span fits this fixture'}</span></label>
    {data.autoLighting?.border&&<p className="dd-quote-notice">{borderLightingSelected(data)?`${BORDER_LIGHTING.mountingSpaceIn} in custom mounting-space preview under the border. Known fixture supply is included; installation, extra support, connections and wiring need a builder quote.`:'Add a picture-frame border to place these edge lights.'} This is a supported/recessed detail to design with your builder; the preview does not verify extra framing or a 2.5 in board cantilever. <a href="https://in-lite.com/en-CA/evo-hyde-550-black" target="_blank" rel="noreferrer">Fixture mounting requirements ↗</a></p>}
    <Field label="Under-step light" hint={STAIR_LIGHT_STYLES[stairStyle].note}><select aria-label="Under-step light style" value={stairStyle} onChange={e=>update({autoLighting:{...data.autoLighting,stairStyle:e.target.value as keyof typeof STAIR_LIGHT_STYLES}})}>{Object.entries(STAIR_LIGHT_STYLES).map(([id,style])=><option key={id} value={id}>{style.label}</option>)}</select></Field>
    {stairStyle==='evo_flex'&&data.stairWidth<44&&<p className="dd-quote-notice">A 1 m EVO FLEX strip is longer than these {data.stairWidth} in steps can hold. Widen the stairs to about 44 in, or choose EVO HYDE.</p>}
    <p className="dd-note">Post caps use PUCK lights, with a HUB-100 transformer, from our existing price book. Switch the preview to Night to see them.</p>
  </fieldset>;
}
