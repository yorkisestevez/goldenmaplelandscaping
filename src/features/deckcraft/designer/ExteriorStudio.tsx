import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import type {DeckData,HouseCladding,HouseConfig,HouseFinish,RoofFinish} from '../types';
import type {Update} from './fields';
import {getHouseConfig,HOUSE_CLADDINGS,ORIGINAL_HOUSE_CLADDINGS,ROOF_FINISHES,ROOF_FINISH_LABELS} from '../houseSettings';
import {DOOR_SLAB_COLOR,GARAGE_DOOR_COLOR,HOUSE_COLOUR_FIELDS,WINDOW_FRAME_COLOR,openingColors,shade,type HouseColourField} from '../houseFinishes';
import {HOUSE_PALETTE,PALETTE_FOR,PALETTE_NOTE,paletteName,type PaletteGroup} from '../housePalette';
import {openingLabel} from '../houseOpenings';
import {normalizeHouseBlocks,openingWallId,wallLabel} from '../houseFootprint';
import {houseWallSpecs} from '../components/viewer3d/houseGeometry';
import {facadeSkins,openingShapes} from '../components/viewer3d/houseCladdingSkins';
import {blockFinishFor,finishSource,houseFinishFor,isGableEnd,wholeHouseFinish} from '../houseWallFinishes';
import {EXTERIOR_LOOKS,applyLook,ownFinishes,wearsLook,withoutOwnFinishes,type ExteriorLook} from '../houseLooks';
import {WAINSCOT_HEIGHT_IN} from '../designPersistence';

/**
 * The exterior studio (loaded on demand): wall finishes for the whole house, a block or one wall (cladding, colour,
 * wainscot and gable accent), the roof, trim, door and window colours, and whole-house looks. Appearance only,
 * never priced: nothing here reaches the estimate (houseConfig sits outside the estimate key).
 */
type Tab='walls'|'roof'|'trim'|'looks';
/** Wainscot heights offered, 6 in apart. */
const WAINSCOT_HEIGHTS=Array.from({length:(WAINSCOT_HEIGHT_IN[1]-WAINSCOT_HEIGHT_IN[0])/6+1},(_,i)=>WAINSCOT_HEIGHT_IN[0]+i*6);
/** What a newly added wainscot or gable accent starts as. */
const NEW_WAINSCOT={cladding:'Fieldstone' as HouseCladding,color:'#8e8b84',heightIn:36},NEW_GABLE={cladding:'Cedar shakes' as HouseCladding,color:'#b59b78'};
/** Drops keys set to undefined, so a cleared field leaves no trace in the saved design. */
function clean<T extends object>(h:T):T{const next={...h} as T&Record<string,unknown>;for(const k of Object.keys(next))if(next[k]===undefined)delete next[k];return next;}
/** The house with no wall finishes of its own, or only none on one block's walls ('' keeps none at all). */
function withoutWalls(h:HouseConfig,blockId?:string):HouseConfig{
  const kept=Object.entries(h.wallFinishes??{}).filter(([id])=>blockId!==undefined&&blockId!==''&&!id.startsWith(`${blockId}-`));
  const {wallFinishes:_walls,...rest}=h;
  return kept.length?{...rest,wallFinishes:Object.fromEntries(kept)}:rest;
}
/** The house with no block finishes, or only none on one block. */
function withoutBlockFinishes(h:HouseConfig,only?:string):HouseConfig{
  return h.footprint?{...h,footprint:{rects:h.footprint.rects.map(({finish,...b})=>only!==undefined&&b.id!==only&&finish?{...b,finish}:b)}}:h;
}
const houseFields=(f:HouseFinish):Partial<HouseConfig>=>({cladding:f.cladding,claddingColor:f.color,wainscot:f.wainscot,gableAccent:f.gable});
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

/** A look's tile: its roof colour over its walls, over its wainscot. */
const lookSwatch=({set}:ExteriorLook):CSSProperties=>({...claddingSwatch(set.cladding,set.claddingColor),borderTop:`9px solid ${set.roofColor}`,...(set.wainscot&&{borderBottom:`8px solid ${set.wainscot.color}`})});

export default function ExteriorStudio({data,update,onClose,selectedOpeningId,onSelectOpening,target,onTarget}:{data:DeckData;update:Update;onClose:()=>void;selectedOpeningId:string;onSelectOpening:(id:string)=>void;
  /** The walls being finished: '' for the whole house, a block id for all its walls, or one wall's id. A click on a
   * wall in the 3D view sets it too. */
  target:string;onTarget:(target:string)=>void}){
  const house=getHouseConfig(data),[tab,setTab]=useState<Tab>('walls'),ref=useRef<HTMLElement>(null);
  useEffect(()=>{ref.current?.scrollIntoView({behavior:'smooth',block:'nearest'});ref.current?.querySelector<HTMLElement>('h3')?.focus({preventScroll:true});},[]);
  // A wall picked in the 3D view opens the walls tab on it.
  useEffect(()=>{if(target)setTab('walls');},[target]);
  // A field set back to its default is removed, so the design reads exactly as it did before.
  const change=(patch:Partial<HouseConfig>)=>{const next={...house,...patch} as HouseConfig&Record<string,unknown>;for(const k of Object.keys(patch))if(next[k]===undefined)delete next[k];update({houseConfig:next});};
  // Very large walls in the finer newer claddings are drawn plain in 3D, to keep the preview quick.
  const walls=useMemo(()=>houseWallSpecs(data,house),[data,house]);
  const finishes=walls.map(w=>houseFinishFor(house,w.wall.id));
  const wallKey=JSON.stringify([finishes.map(f=>[f.cladding,f.wainscot?.cladding,f.wainscot?.heightIn]),walls.map(w=>[w.span,w.height,w.hidden,w.openings.map(o=>[o.offsetPct,o.bottomIn,o.widthIn,o.heightIn])])]);
  const newer=(c?:HouseCladding)=>!!c&&!ORIGINAL_HOUSE_CLADDINGS.includes(c);
  const simplified=useMemo(()=>walls.some((w,i)=>{const f=finishes[i];if(!newer(f.cladding)&&!newer(f.wainscot?.cladding))return false;const s=facadeSkins(f.cladding,w.span,w.height,openingShapes(w.span,w.openings),w.hidden,f.wainscot);return s.skin.simplified||!!s.band?.skin.simplified;}),[wallKey]);
  // The walls being finished: the whole house, one added block (all its walls) or one wall. A target that has gone
  // (its block removed) falls back to the whole house.
  const blocks=normalizeHouseBlocks(house),block=blocks.find(b=>b.id===target),wall=walls.find(w=>w.wall.id===target);
  const kind=block?'block':wall?'wall':'house',blockName=(id:string)=>wallLabel(`${id}-front`,house).split(',')[0];
  const current:HouseFinish=kind==='block'?blockFinishFor(house,target):kind==='wall'?houseFinishFor(house,target):wholeHouseFinish(house);
  const setFinish=(next:HouseFinish)=>{
    if(kind==='house')change(houseFields(next));
    else if(kind==='block')change({footprint:{rects:house.footprint!.rects.map(b=>b.id===target?{...b,finish:next}:b)}});
    else change({wallFinishes:{...house.wallFinishes,[target]:next}});
  };
  const patch=(p:Partial<HouseFinish>)=>setFinish(clean({...current,...p}));
  // Apply to a block: the block takes this finish and its walls follow it (the main house's four walls each take it).
  const applyToBlock=(blockId:string)=>{
    if(blockId==='main'){change({wallFinishes:{...house.wallFinishes,...Object.fromEntries(['front','back','left','right'].map(side=>[`main-${side}`,current]))}});return;}
    const h=withoutWalls(house,blockId);update({houseConfig:{...h,footprint:{rects:h.footprint!.rects.map(b=>b.id===blockId?{...b,finish:current}:b)}}});onTarget(blockId);
  };
  // Apply to the whole house: every wall and block follows this finish.
  const applyToHouse=()=>{update({houseConfig:clean({...withoutBlockFinishes(withoutWalls(house)),...houseFields(current)})});onTarget('');};
  const resetBlock=(blockId:string)=>update({houseConfig:withoutBlockFinishes(withoutWalls(house,blockId),blockId)});
  const resetWall=()=>{const {[target]:_gone,...rest}=house.wallFinishes??{};const {wallFinishes:_walls,...h}=house;update({houseConfig:Object.keys(rest).length?{...h,wallFinishes:rest}:h});};
  const ownWalls=Object.keys(house.wallFinishes??{}),ownBlocks=blocks.filter(b=>b.finish),ownCount=ownWalls.length+ownBlocks.length;
  const source=kind==='wall'?finishSource(house,target):kind==='block'?(block!.finish?'wall':'house'):null;
  const targetName=kind==='block'?`the ${blockName(target).toLowerCase()}`:wallLabel(target,house);
  const gables=kind==='house'?walls.some(isGableEnd):kind==='block'?walls.some(w=>w.block.id===target&&isGableEnd(w)):!!wall&&isGableEnd(wall);
  const heights=[...new Set([...WAINSCOT_HEIGHTS,...(current.wainscot?[current.wainscot.heightIn]:[])])].sort((a,b)=>a-b);
  const selected=house.openings.find(o=>o.id===selectedOpeningId)??house.openings[0];
  const selectedColour=(o:NonNullable<typeof selected>)=>{const c=openingColors(house,o);return o.type==='Door'?c.slab:o.type==='Window'?c.windowFrame:c.garage;};
  const colourField=(key:HouseColourField)=>{const meta=COLOUR_FIELDS[key],value=house[key],fallback=meta.follows==='trim'?house.trimColor:ORIGINAL[key]!;
    return <ColourPicker key={key} label={meta.label} hint={meta.hint} value={value??fallback} groups={meta.follows==='trim'?PALETTE_FOR.trim:PALETTE_FOR.door} onPick={hex=>change({[key]:hex})} reset={{label:meta.follows==='trim'?'Match trim':'Original',active:value===undefined,onReset:()=>change({[key]:undefined})}}/>;};
  const tabButton=(id:Tab,label:string)=><button type="button" aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>;
  return <section ref={ref} className="dd-exterior" aria-label="Exterior finishes">
    <div className="dd-exterior-head"><h3 tabIndex={-1}>Exterior finishes</h3><span>Appearance only, never priced</span><button type="button" className="dd-secondary" onClick={onClose}>Done</button></div>
    <div className="dd-view-toggle" role="group" aria-label="Exterior finish sections">{tabButton('walls','Walls')}{tabButton('roof','Roof')}{tabButton('trim','Trim, doors & windows')}{tabButton('looks','Looks')}</div>
    <div className="dd-exterior-body">
      {tab==='walls'&&<>
        <p className="dd-note">Finish the whole house, one block or a single wall. The claddings are generic types, not a particular manufacturer's product.</p>
        <div className="dd-exterior-target">
          <label className="dd-field"><span>Walls to finish</span><select aria-label="Walls to finish" value={kind==='house'?'':target} onChange={e=>onTarget(e.target.value)}>
            <option value="">The whole house</option>
            {blocks.length>0&&<optgroup label="A whole block">{blocks.map(b=><option key={b.id} value={b.id}>{blockName(b.id)}: all its walls</option>)}</optgroup>}
            <optgroup label="One wall">{walls.filter(w=>w.wall.exposed.length>0).map(w=><option key={w.wall.id} value={w.wall.id}>{wallLabel(w.wall.id,house)}</option>)}</optgroup>
          </select></label>
          <p className="dd-note" role="status">{kind==='house'?`Every wall without a finish of its own${ownCount?` (${ownCount} ${ownCount===1?'wall or block has':'walls or blocks have'} one)`:''}. Or click a wall in the 3D view.`
            :source==='wall'?`${kind==='block'?'This block':'This wall'} has its own finish.`:source==='block'?`This wall follows the ${blockName(target.split('-')[0]).toLowerCase()}. A change gives it its own finish.`:`${kind==='block'?'This block':'This wall'} follows the whole house. A change gives it its own finish.`}</p>
        </div>
        <div className="dd-exterior-tiles" role="group" aria-label={kind==='house'?'House cladding':`Cladding: ${targetName}`}>{HOUSE_CLADDINGS.map(c=><button key={c} type="button" aria-pressed={current.cladding===c} onClick={()=>patch({cladding:c})}><span className="dd-exterior-swatch" aria-hidden="true" style={claddingSwatch(c,current.color)}/><span>{c}</span></button>)}</div>
        {simplified&&<p className="dd-note" role="status">Some very large walls are shown plain in their cladding, to keep the 3D view quick.</p>}
        <ColourPicker label="Cladding colour" value={current.color} groups={PALETTE_FOR.cladding} onPick={color=>patch({color})}/>
        <fieldset className="dd-colour-one"><legend>Wainscot</legend>
          <label className="dd-check"><input type="checkbox" checked={!!current.wainscot} onChange={e=>patch({wainscot:e.target.checked?NEW_WAINSCOT:undefined})}/><span>A band of another cladding along the bottom, under a trim cap</span></label>
          {current.wainscot&&<><div className="dd-fields">
            <label className="dd-field"><span>Wainscot cladding</span><select aria-label="Wainscot cladding" value={current.wainscot.cladding} onChange={e=>patch({wainscot:{...current.wainscot!,cladding:e.target.value as HouseCladding}})}>{HOUSE_CLADDINGS.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
            <label className="dd-field"><span>Wainscot height</span><select aria-label="Wainscot height" value={current.wainscot.heightIn} onChange={e=>patch({wainscot:{...current.wainscot!,heightIn:Number(e.target.value)}})}>{heights.map(h=><option key={h} value={h}>{h} in above grade</option>)}</select></label>
          </div>
          <ColourPicker label="Wainscot colour" value={current.wainscot.color} groups={['masonry','walls']} onPick={color=>patch({wainscot:{...current.wainscot!,color}})}/></>}
        </fieldset>
        <fieldset className="dd-colour-one"><legend>Gable accent</legend>
          <label className="dd-check"><input type="checkbox" checked={!!current.gable} onChange={e=>patch({gable:e.target.checked?NEW_GABLE:undefined})}/><span>Another cladding in the gable triangle above these walls</span></label>
          {!gables&&<p className="dd-note">{kind==='wall'?'This wall has no gable above it':'These walls have no gable above them'}: an accent shows where a gable roof ends over a wall.</p>}
          {current.gable&&<><label className="dd-field"><span>Gable cladding</span><select aria-label="Gable cladding" value={current.gable.cladding} onChange={e=>patch({gable:{...current.gable!,cladding:e.target.value as HouseCladding}})}>{HOUSE_CLADDINGS.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
          <ColourPicker label="Gable colour" value={current.gable.color} groups={PALETTE_FOR.cladding} onPick={color=>patch({gable:{...current.gable!,color}})}/></>}
        </fieldset>
        <div className="dd-summary-actions" role="group" aria-label="Apply or reset this finish">
          {kind==='wall'&&<button type="button" className="dd-secondary" onClick={()=>applyToBlock(wall!.block.id)}>{wall!.block.id==='main'?'Apply to every main-house wall':`Apply to the whole ${blockName(wall!.block.id).toLowerCase()}`}</button>}
          {kind!=='house'&&<button type="button" className="dd-secondary" onClick={applyToHouse}>Apply to the whole house</button>}
          {kind==='wall'&&<button type="button" className="dd-secondary" disabled={source!=='wall'} onClick={resetWall}>Reset this wall</button>}
          {kind==='block'&&<button type="button" className="dd-secondary" disabled={!block!.finish&&!ownWalls.some(id=>id.startsWith(`${target}-`))} onClick={()=>resetBlock(target)}>Reset the {blockName(target).toLowerCase()}</button>}
          {kind==='house'&&ownCount>0&&<button type="button" className="dd-secondary" onClick={()=>update({houseConfig:withoutBlockFinishes(withoutWalls(house))})}>Reset every wall and block to this</button>}
        </div>
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
      {tab==='looks'&&<>
        <p className="dd-note">A look dresses the whole house in one go: walls, roof, trim, doors and windows. It never changes a size or a shape. Brick or stone cladding can change the ledger and its price.</p>
        <div className="dd-exterior-looks" role="group" aria-label="Exterior looks">{EXTERIOR_LOOKS.map(l=><button key={l.id} type="button" aria-label={`${l.name} look`} aria-pressed={wearsLook(house,l)} onClick={()=>update({houseConfig:applyLook(house,l)})}><span className="dd-exterior-swatch" aria-hidden="true" style={lookSwatch(l)}/><strong>{l.name}</strong><span>{l.description}</span></button>)}</div>
        {ownFinishes(house)>0&&<p className="dd-note" role="status">{ownFinishes(house)} {ownFinishes(house)===1?'wall, block, door or window keeps its':'walls, blocks, doors or windows keep their'} own finish over the look. <button type="button" className="dd-linklike" onClick={()=>update({houseConfig:withoutOwnFinishes(house)})}>Reset them to the look</button></p>}
      </>}
    </div>
    <p className="dd-note">{PALETTE_NOTE} Finishes change the picture, never the price.</p>
  </section>;
}
