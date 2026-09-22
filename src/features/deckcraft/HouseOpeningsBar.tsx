import {useState} from 'react';
import type {DeckData} from './types';
import {getHouseConfig} from './houseSettings';
import {getHouseBlocks,openingWallId,wallLabel} from './houseFootprint';
import {addHouseOpening,MAX_HOUSE_OPENINGS,OPENING_PRESETS,openableWalls,openingLabel,removeHouseOpening,restyleHouseOpening,stylesFor} from './houseOpenings';

/**
 * Doors and windows, from any step: add one in any style on any visible wall, pick one (here or by
 * clicking it in 3D) to restyle or remove it. Looks only; nothing here changes the price.
 */
export default function HouseOpeningsBar({data,selectedId,onSelect,onChange,onEditDetails}:{data:DeckData;selectedId:string;onSelect:(id:string)=>void;onChange:(patch:Partial<DeckData>)=>void;onEditDetails:()=>void}){
  const house=getHouseConfig(data),walls=openableWalls(data),selected=house.openings.find(o=>o.id===selectedId);
  const hasGarage=getHouseBlocks(data).some(b=>b.kind==='garage');
  const [presetKey,setPresetKey]=useState('Window:Double-hung');
  const [wantedWall,setWall]=useState('main-front');
  // A new opening goes on the wall picked here, or the selected opening's wall, or the deck-facing wall.
  const wallId=walls.some(w=>w.id===wantedWall)?wantedWall:walls[0]?.id??'main-front';
  const full=house.openings.length>=MAX_HOUSE_OPENINGS;
  if(data.houseVisible===false)return null;
  const add=()=>{const {houseConfig,added}=addHouseOpening(data,presetKey,wallId);if(!added)return;onChange({houseConfig});onSelect(added.id);};
  const group=(type:'Door'|'Window'|'Garage',label:string)=><optgroup label={label}>{OPENING_PRESETS.filter(p=>p.type===type).map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</optgroup>;
  return <section className="dd-openings" aria-label="House doors and windows">
    <div className="dd-openings-head"><strong>Doors &amp; windows</strong><span>{house.openings.length} of {MAX_HOUSE_OPENINGS} · looks only, never priced</span></div>
    <div className="dd-openings-row">
      <label className="dd-field"><span>Add</span><select aria-label="Style of the new door or window" value={presetKey} onChange={e=>setPresetKey(e.target.value)}>{group('Door','Doors')}{group('Window','Windows')}{hasGarage&&group('Garage','Garage doors')}</select></label>
      <label className="dd-field"><span>On</span><select aria-label="Wall for the new door or window" value={wallId} onChange={e=>setWall(e.target.value)}>{walls.map(w=><option key={w.id} value={w.id}>{wallLabel(w.id,house)}</option>)}</select></label>
      <button type="button" className="dd-secondary" disabled={full} onClick={add}>Add</button>
    </div>
    {full&&<p className="dd-note">The preview supports up to {MAX_HOUSE_OPENINGS} doors and windows. Remove one to add another.</p>}
    {house.openings.length>0&&<label className="dd-field"><span>Selected</span><select aria-label="Pick a door or window" value={selected?.id??''} onChange={e=>onSelect(e.target.value)}><option value="">None: click one in the 3D view</option>{house.openings.map((o,i)=><option key={o.id} value={o.id}>{i+1}. {openingLabel(o)} · {wallLabel(openingWallId(o,house),house)}</option>)}</select></label>}
    {selected&&<div className="dd-openings-row" role="group" aria-label="Selected door or window">
      <label className="dd-field"><span>Style</span><select aria-label="Style of the selected door or window" value={selected.style??''} onChange={e=>onChange({houseConfig:restyleHouseOpening(house,selected.id,(e.target.value||undefined) as typeof selected.style)})}>{stylesFor(selected.type).map(p=><option key={p.key} value={p.style??''}>{p.label}</option>)}</select></label>
      <button type="button" className="dd-secondary" onClick={()=>{onChange({houseConfig:removeHouseOpening(house,selected.id)});onSelect('');}}>Remove</button>
      <button type="button" className="dd-secondary" onClick={onEditDetails}>Size &amp; position</button>
      <button type="button" className="dd-secondary" onClick={()=>onSelect('')}>Done</button>
    </div>}
    {!selected&&house.openings.length>0&&<p className="dd-note">Click a door or window in the 3D view to restyle or remove it; drag it to slide it along its wall.</p>}
  </section>;
}
