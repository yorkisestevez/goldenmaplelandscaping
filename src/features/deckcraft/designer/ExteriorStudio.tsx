import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import type {DeckData,HouseCladding,HouseConfig,RoofFinish} from '../types';
import type {Update} from './fields';
import {getHouseConfig,HOUSE_CLADDINGS,ORIGINAL_HOUSE_CLADDINGS,ROOF_FINISHES,ROOF_FINISH_LABELS} from '../houseSettings';
import {DOOR_SLAB_COLOR,GARAGE_DOOR_COLOR,HOUSE_COLOUR_FIELDS,WINDOW_FRAME_COLOR,openingColors,shade,type HouseColourField} from '../houseFinishes';
import {HOUSE_PALETTE,PALETTE_FOR,PALETTE_NOTE,paletteName,type PaletteGroup} from '../housePalette';
import {openingLabel} from '../houseOpenings';
import {openingWallId,wallLabel} from '../houseFootprint';
import {houseWallSpecs} from '../components/viewer3d/houseGeometry';
import {openingShapes,wallSkin} from '../components/viewer3d/houseCladdingSkins';

/**
 * The exterior studio (loaded on demand): whole-house cladding, the roof, and trim, door and window colours.
 * Appearance only, never priced: nothing here reaches the estimate (houseConfig sits outside the estimate key).
 */
type Tab='walls'|'roof'|'trim';
const COLOUR_FIELDS:Record<HouseColourField,{label:string;hint:string;follows:'trim'|'original'}>={
  fasciaColor:{label:'Fascia',hint:'The rake boards along the gables',follows:'trim'},
  soffitColor:{label:'Soffit',hint:'Under the eaves',follows:'trim'},
  gutterColor:{label:'Gutters',hint:'Gutters and downspouts',follows:'trim'},
  doorColor:{label:'Doors',hint:'Door slabs and the frames of glass doors',follows:'original'},
  windowColor:{label:'Window frames',hint:'Frames and bars',follows:'original'},
  garageDoorColor:{label:'Garage doors',hint:'The door face and its panels',follows:'original'},
};
const ORIGINAL:Partial<Record<HouseColourField,string>>={doorColor:DOOR_SLAB_COLOR,windowColor:WINDOW_FRAME_COLOR,garageDoorColor:GARAGE_DOOR_COLOR};

/** A small picture of each cladding in its colour, for its tile. */
function claddingSwatch(c:HouseCladding,hex:string):CSSProperties{
  const dark=shade(hex,-.35),light=shade(hex,.12),mortar='#b8b2a7';
  const lines=(deg:number,a:number,b:number,base=hex,line=dark)=>`repeating-linear-gradient(${deg}deg,${base} 0 ${a}px,${line} ${a}px ${b}px)`;
  switch(c){
    case 'Siding':case 'Fibre-cement lap':return {backgroundImage:lines(180,6,7.5)};
    case 'Horizontal metal':return {backgroundImage:lines(180,10,11.5,hex,shade(hex,-.5))};
    case 'Board & batten':return {backgroundImage:lines(90,9,12,hex,light)};
    case 'Vertical siding':return {backgroundImage:lines(90,5,6.5)};
    case 'Brick':case 'Norman brick':case 'Roman brick':{const h=c==='Roman brick'?3:4,w=c==='Brick'?10:16;return {backgroundImage:`repeating-linear-gradient(180deg,transparent 0 ${h}px,${mortar} ${h}px ${h+1}px),repeating-linear-gradient(90deg,${hex} 0 ${w}px,${mortar} ${w}px ${w+1}px)`};}
    case 'Cedar shakes':return {backgroundImage:`repeating-linear-gradient(180deg,transparent 0 8px,${dark} 8px 9px),repeating-linear-gradient(90deg,${hex} 0 5px,${dark} 5px 6px,${light} 6px 13px,${dark} 13px 14px)`};
    case 'Ledgestone':return {backgroundImage:`repeating-linear-gradient(180deg,${hex} 0 3px,${dark} 3px 4px,${light} 4px 6px,${dark} 6px 7px)`};
    case 'Stone':case 'Fieldstone':return {backgroundColor:c==='Stone'?'#8f8a80':'#aaa497',backgroundImage:`radial-gradient(circle at 30% 30%,${light} 0 5px,transparent 6px),radial-gradient(circle at 72% 68%,${hex} 0 6px,transparent 7px)`,backgroundSize:'16px 16px'};
    case 'Stucco':return {backgroundColor:hex};
  }
}
function roofSwatch(f:RoofFinish,hex:string):CSSProperties{
  const dark=shade(hex,-.4),light=shade(hex,.15);
  switch(f){
    case 'Shingles':case 'Architectural shingles':return {backgroundImage:`repeating-linear-gradient(180deg,transparent 0 6px,${dark} 6px 7.5px),repeating-linear-gradient(90deg,${hex} 0 ${f==='Shingles'?9:6}px,${dark} ${f==='Shingles'?9:6}px ${f==='Shingles'?10:7}px,${light} ${f==='Shingles'?10:7}px ${f==='Shingles'?19:15}px)`};
    case 'Metal':return {backgroundImage:`repeating-linear-gradient(90deg,${hex} 0 9px,${light} 9px 10px,${dark} 10px 11px)`};
    case 'Cedar shakes':return {backgroundImage:`repeating-linear-gradient(180deg,transparent 0 9px,${dark} 9px 10.5px),repeating-linear-gradient(90deg,${hex} 0 4px,${dark} 4px 5px,${light} 5px 12px,${dark} 12px 13px)`};
    case 'Slate':return {backgroundImage:`repeating-linear-gradient(180deg,transparent 0 8px,${dark} 8px 9px),repeating-linear-gradient(90deg,${hex} 0 8px,${dark} 8px 9px)`};
    case 'Clay tile':case 'Concrete tile':return {backgroundImage:`repeating-linear-gradient(180deg,transparent 0 9px,${dark} 9px 11px),repeating-linear-gradient(90deg,${dark} 0,${light} 4px,${dark} 8px)`};
  }
}

function ColourPicker({label,value,groups,onPick,reset,hint}:{label:string;value:string;groups:PaletteGroup['id'][];onPick:(hex:string)=>void;reset?:{label:string;active:boolean;onReset:()=>void};hint?:string}){
  const colours=groups.flatMap(id=>HOUSE_PALETTE.find(g=>g.id===id)?.colours??[]),current=reset?.active?reset.label:paletteName(value)??value.toUpperCase();
  return <fieldset className="dd-colour-pick"><legend>{label} <span>· {current}</span></legend>{hint&&<p className="dd-note">{hint}</p>}
    <div className="dd-chips">
      {reset&&<button type="button" className="dd-chip-reset" aria-pressed={reset.active} onClick={reset.onReset}>{reset.label}</button>}
      {colours.map(c=><button key={c.hex} type="button" className="dd-chip" title={c.name} aria-label={`${label}: ${c.name}`} aria-pressed={!reset?.active&&value.toLowerCase()===c.hex} style={{background:c.hex}} onClick={()=>onPick(c.hex)}/>)}
      <label className="dd-chip-custom"><input type="color" aria-label={`${label}: any colour`} value={value} onChange={e=>onPick(e.target.value)}/><span>Any colour</span></label>
    </div></fieldset>;
}

export default function ExteriorStudio({data,update,onClose,selectedOpeningId,onSelectOpening}:{data:DeckData;update:Update;onClose:()=>void;selectedOpeningId:string;onSelectOpening:(id:string)=>void}){
  const house=getHouseConfig(data),[tab,setTab]=useState<Tab>('walls'),ref=useRef<HTMLElement>(null);
  useEffect(()=>{ref.current?.scrollIntoView({behavior:'smooth',block:'nearest'});ref.current?.querySelector<HTMLElement>('h3')?.focus({preventScroll:true});},[]);
  // A field set back to its default is removed, so the design reads exactly as it did before.
  const change=(patch:Partial<HouseConfig>)=>{const next={...house,...patch} as HouseConfig&Record<string,unknown>;for(const k of Object.keys(patch))if(next[k]===undefined)delete next[k];update({houseConfig:next});};
  // Very large walls in the finer newer claddings are drawn plain in 3D, to keep the preview quick.
  const walls=useMemo(()=>houseWallSpecs(data,house),[data,house]);
  const wallKey=JSON.stringify([house.cladding,walls.map(w=>[w.span,w.height,w.hidden,w.openings.map(o=>[o.offsetPct,o.bottomIn,o.widthIn,o.heightIn])])]);
  const simplified=useMemo(()=>!ORIGINAL_HOUSE_CLADDINGS.includes(house.cladding)&&walls.some(w=>wallSkin(house.cladding,w.span,w.height,openingShapes(w.span,w.openings),w.hidden).simplified),[wallKey]);
  const selected=house.openings.find(o=>o.id===selectedOpeningId)??house.openings[0];
  const selectedColour=(o:NonNullable<typeof selected>)=>{const c=openingColors(house,o);return o.type==='Door'?c.slab:o.type==='Window'?c.windowFrame:c.garage;};
  const colourField=(key:HouseColourField)=>{const meta=COLOUR_FIELDS[key],value=house[key],fallback=meta.follows==='trim'?house.trimColor:ORIGINAL[key]!;
    return <ColourPicker key={key} label={meta.label} hint={meta.hint} value={value??fallback} groups={meta.follows==='trim'?PALETTE_FOR.trim:PALETTE_FOR.door} onPick={hex=>change({[key]:hex})} reset={{label:meta.follows==='trim'?'Match trim':'Original',active:value===undefined,onReset:()=>change({[key]:undefined})}}/>;};
  const tabButton=(id:Tab,label:string)=><button type="button" aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>;
  return <section ref={ref} className="dd-exterior" aria-label="Exterior finishes">
    <div className="dd-exterior-head"><h3 tabIndex={-1}>Exterior finishes</h3><span>Appearance only, never priced</span><button type="button" className="dd-secondary" onClick={onClose}>Done</button></div>
    <div className="dd-view-toggle" role="group" aria-label="Exterior finish sections">{tabButton('walls','Walls')}{tabButton('roof','Roof')}{tabButton('trim','Trim, doors & windows')}</div>
    <div className="dd-exterior-body">
      {tab==='walls'&&<>
        <p className="dd-note">One cladding for the whole house. These are generic types, not a particular manufacturer's product.</p>
        <div className="dd-exterior-tiles" role="group" aria-label="House cladding">{HOUSE_CLADDINGS.map(c=><button key={c} type="button" aria-pressed={house.cladding===c} onClick={()=>change({cladding:c})}><span className="dd-exterior-swatch" aria-hidden="true" style={claddingSwatch(c,house.claddingColor)}/><span>{c}</span></button>)}</div>
        {simplified&&<p className="dd-note" role="status">Some very large walls are shown plain in this cladding, to keep the 3D view quick.</p>}
        <ColourPicker label="Cladding colour" value={house.claddingColor} groups={PALETTE_FOR.cladding} onPick={claddingColor=>change({claddingColor})}/>
      </>}
      {tab==='roof'&&<>
        <div className="dd-exterior-tiles" role="group" aria-label="Roof finish">{ROOF_FINISHES.map(f=><button key={f} type="button" aria-pressed={house.roofFinish===f} onClick={()=>change({roofFinish:f})}><span className="dd-exterior-swatch" aria-hidden="true" style={roofSwatch(f,house.roofColor)}/><span>{ROOF_FINISH_LABELS[f]}</span></button>)}</div>
        {house.roofShape==='Flat'&&<p className="dd-note">A flat roof shows its finish only from above.</p>}
        <ColourPicker label="Roof colour" value={house.roofColor} groups={PALETTE_FOR.roof} onPick={roofColor=>change({roofColor})}/>
      </>}
      {tab==='trim'&&<>
        <ColourPicker label="Trim" hint="Casings round doors and windows, and the corner boards" value={house.trimColor} groups={PALETTE_FOR.trim} onPick={trimColor=>change({trimColor})}/>
        {HOUSE_COLOUR_FIELDS.map(colourField)}
        {selected&&<fieldset className="dd-colour-one"><legend>One door or window in its own colour</legend>
          <label className="dd-field"><span>Door or window</span><select aria-label="Door or window to colour" value={selected.id} onChange={e=>onSelectOpening(e.target.value)}>{house.openings.map((o,i)=><option key={o.id} value={o.id}>{i+1}. {openingLabel(o)} · {wallLabel(openingWallId(o,house),house)}</option>)}</select></label>
          <ColourPicker label={openingLabel(selected)} value={selectedColour(selected)} groups={PALETTE_FOR.door} onPick={color=>change({openings:house.openings.map(o=>o.id===selected.id?{...o,color}:o)})} reset={{label:'Same as the rest',active:selected.color===undefined,onReset:()=>change({openings:house.openings.map(o=>{if(o.id!==selected.id)return o;const {color:_color,...rest}=o;return rest;})})}}/>
        </fieldset>}
      </>}
    </div>
    <p className="dd-note">{PALETTE_NOTE} Finishes change the picture, never the price.</p>
  </section>;
}
