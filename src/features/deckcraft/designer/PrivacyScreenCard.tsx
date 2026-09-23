import {MAX_SCREEN_PANELS,PRIVACY_HEIGHTS,PRIVACY_PRODUCTS,PRIVACY_SIDES,screenFaceSqft,screenOn,screenProduct,withPrivacyProduct} from '../privacyScreens';
import type {PrivacyProductId,PrivacyScreen} from '../types';
import {Field,NumberField} from './fields';

/** One privacy screen's settings: product, edge, size or panels, position along the edge, lights. */
export default function PrivacyScreenCard({screen:s,index:i,sides,setScreen,writeScreen,onRemove}:{screen:PrivacyScreen;index:number;sides:readonly string[];setScreen:(id:string,patch:Partial<PrivacyScreen>)=>void;writeScreen:(id:string,make:(s:PrivacyScreen)=>PrivacyScreen)=>void;onRemove:()=>void}){
  const product=screenProduct(s),on=screenOn(s),n=i+1;
  return <fieldset className={`dd-screen${on?'':' dd-screen-off'}`}>
    <legend>Screen {n} · {Math.round(screenFaceSqft(s))} sq ft{on?'':' · off'}</legend>
    <label className="dd-check"><input type="checkbox" role="switch" aria-label={`Screen ${n} on`} checked={on} onChange={e=>setScreen(s.id,{enabled:e.target.checked})}/><span>{on?'Screen on':'Screen off'}<small>{on?'Shown, lit and included in your estimate.':'Kept in your design, but hidden and left out of the estimate.'}</small></span></label>
    <div className="dd-fields">
      <Field label="Screen product"><select aria-label={`Screen ${n} product`} value={product.id} onChange={e=>writeScreen(s.id,o=>withPrivacyProduct(o,e.target.value as PrivacyProductId))}>{PRIVACY_PRODUCTS.map(p=><option key={p.id} value={p.id}>{p.name}{p.pricedBySqft?'':' (supplier quote)'}</option>)}</select></Field>
      <Field label="Deck edge"><select aria-label={`Screen ${n} deck edge`} value={s.side} onChange={e=>setScreen(s.id,{side:e.target.value as PrivacyScreen['side']})}>{PRIVACY_SIDES.map(side=><option key={side} value={side} disabled={!sides.includes(side)}>{side}{sides.includes(side)?'':' (house wall)'}</option>)}</select></Field>
      {product.panel?<>
        <Field label="Design"><select aria-label={`Screen ${n} design`} value={s.design??product.designs[0]} onChange={e=>setScreen(s.id,{design:e.target.value})}>{product.designs.map(d=><option key={d} value={d}>{d}</option>)}</select></Field>
        {product.finishes.length>0&&<Field label="Finish"><select aria-label={`Screen ${n} finish`} value={s.finish??product.finishes[0]} onChange={e=>setScreen(s.id,{finish:e.target.value as 'Black'|'White'})}>{product.finishes.map(f=><option key={f} value={f}>{product.finishLabels?.[f]??f}</option>)}</select></Field>}
        <NumberField label={`Screen ${n} panels`} value={s.panels??1} min={1} max={MAX_SCREEN_PANELS} unit="" increment={1} hint={`${product.panel.widthIn} × ${product.panel.heightIn} in stock panels`} onValue={panels=>setScreen(s.id,{panels:Math.round(panels)})}/>
      </>:<>
        <Field label="Height"><select aria-label={`Screen ${n} height`} value={s.heightFt} onChange={e=>setScreen(s.id,{heightFt:Number(e.target.value) as PrivacyScreen['heightFt']})}>{PRIVACY_HEIGHTS.map(h=><option key={h} value={h}>{h} ft</option>)}</select></Field>
        <NumberField label={`Screen ${n} length`} value={s.lengthFt} min={2} max={60} unit="ft" increment={0.5} onValue={lengthFt=>setScreen(s.id,{lengthFt})}/>
      </>}
    </div>
    <div className="dd-screen-move" role="group" aria-label={`Move screen ${n} along its edge`}>
      <span>Move along the edge</span>
      <button type="button" className="dd-secondary" aria-label={`Move screen ${n} toward the start of the edge`} onClick={()=>setScreen(s.id,{offsetPct:Math.max(0,s.offsetPct-5)})}>‹</button>
      <input type="range" min={0} max={100} step={1} value={s.offsetPct} aria-label={`Screen ${n} position along the edge`} onChange={e=>setScreen(s.id,{offsetPct:Number(e.target.value)})}/>
      <button type="button" className="dd-secondary" aria-label={`Move screen ${n} toward the end of the edge`} onClick={()=>setScreen(s.id,{offsetPct:Math.min(100,s.offsetPct+5)})}>›</button>
      <output>{Math.round(s.offsetPct)}%</output>
    </div>
    {product.panel&&<div className="dd-quote-notice"><strong>{product.maker}</strong><p>{product.notes} The cut pattern in the preview is illustrative. <a href={product.sourceUrl} target="_blank" rel="noreferrer">Manufacturer details ↗</a></p><small className="dd-quote-badge">Supplier quote required</small></div>}
    <label className="dd-check"><input type="checkbox" checked={s.lights} disabled={!on} onChange={e=>setScreen(s.id,{lights:e.target.checked})}/><span>Light this screen<small>BLINK on each screen post · existing price-book allowance</small></span></label>
    <button type="button" className="dd-secondary" onClick={onRemove}>Remove screen {n}</button>
  </fieldset>;
}
