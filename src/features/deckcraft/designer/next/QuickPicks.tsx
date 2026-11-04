import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {yardAllowancesPatch} from '../../backyard';
import {availableStairSides,deckAttachesToHouse} from '../../houseContact';
import {MAX_FIXTURE_QTY} from '../../lightingSystem';
import {DECKING_CATALOGUE} from '../../manufacturerRuntimeCatalogue';
import {MAX_PRIVACY_SCREENS,newPrivacyScreen} from '../../privacyScreens';
import type {DeckData,DeckShape,YardAllowances,YardFeatureKind} from '../../types';
import {NO_ALLOWANCES,TURF_SQFT,newYardFeature} from '../../yardSettings';
import type {AutoCounts,PlanTool} from '../constants';
import {SHAPES,chooseShape,levelsPatch} from '../deckShapeActions';
import {MaterialSwatch,type Update} from '../fields';
import type {HomeTabId} from '../homeTabs';
import {BOARD_LAYOUTS,BORDER_ROWS,COLLECTIONS,DECK_TYPES,FASTENERS,FOUNDATIONS,RAILING_STYLES,STAIR_FLIGHTS,STAIR_LAYOUTS,collectionPatch} from '../optionGroups';
import {selectPatch} from '../selectPatch';
import {loadHardscapeCatalogue} from '../../hardscapeLookup';
import './quickPicks.css';

/**
 * The new look's quick picks (docs/deckcraft/ui-redesign-2026-10/PLAN.md, S2): a rail group's few big choices as
 * pictures and buttons, above its sections under More. Each pick applies the patch its full editor applies (selectPatch,
 * the option groups, the shape and yard actions), so the price, the drawing and undo treat it the same way.
 */
export interface QuickPicksProps{
  group:HomeTabId;data:DeckData;update:Update;
  /** A wrap-around on both sides sets the width; the post and step light counts; whether one more screen fits. */
  wrapWidth:boolean;autoCounts:AutoCounts;canAddScreen:boolean;
  /** A new yard feature is the selected one, as in the Backyard editor; a plan tool opens on the plan. */
  onSelectYard:(id:string)=>void;onPlanTool:(tool:PlanTool)=>void;
}

export default function QuickPicks(props:QuickPicksProps){
  switch(props.group){
    case 'shape':return <ShapePicks {...props}/>;
    case 'boards':return <BoardPicks {...props}/>;
    case 'stairs':return <StairPicks {...props}/>;
    case 'yard':return <YardPicks {...props}/>;
    case 'extras':return <ExtraPicks {...props}/>;
    default:return null;
  }
}

// The full editors' limits (DimensionsStep, StairsStep, YardEditor).
const DECK_FT={min:4,max:60},HEIGHT_IN={min:8,max:144},STAIR_WIDTH_IN={min:36,max:120},MAX_YARD_FEATURES=20;

interface Item{text:ReactNode;name?:string;pressed?:boolean;disabled?:boolean;onClick:()=>void}
type Look='tiles'|'photos'|'segments'|'actions';
/** A labelled group of buttons: tiles (a picture over each name), photo swatches, a row of segments, or plain actions. */
function Group({label,look='segments',items}:{label:string;look?:Look;items:readonly Item[]}){
  const id=useId();
  return <div className="dd-next-pick"><p id={id} className="dd-next-pick-label">{label}</p><div role="group" aria-labelledby={id} className={`dd-next-${look}`}>{items.map((item,i)=><button key={i} type="button" aria-label={item.name} aria-pressed={item.pressed} disabled={item.disabled} onClick={item.onClick}>{item.text}</button>)}</div></div>;
}
type Option<T>=readonly [value:T,text:ReactNode,name?:string];
/** One choice among several: the current one is pressed, and picking it again changes nothing (as a select does). */
function Choices<T extends string|number>({label,look,options,value,onPick,disabled}:{label:string;look?:Look;options:readonly Option<T>[];value:T|undefined;onPick:(value:T)=>void;disabled?:boolean}){
  return <Group label={label} look={look} items={options.map(([v,text,name])=>({text,name,pressed:value===v,disabled,onClick:()=>{if(value!==v)onPick(v);}}))}/>;
}
const Tile=({d,name}:{d:string;name:string})=><><svg viewBox="0 0 28 28" aria-hidden="true"><path d={d}/></svg><span>{name}</span></>;
const Photo=({file,name}:{file?:string;name:string})=><><MaterialSwatch file={file} alt=""/><span>{name}</span></>;

/**
 * A number between − and + (or the arrow keys). Tapping it selects it, so typing replaces it; Enter or leaving it commits,
 * held to the limits. A typed number is kept as typed, as the full editor keeps it; a step lands on a clean number.
 */
function Stepper({label,value,min,max,step,unit,disabled,hint,onValue}:{label:string;value:number;min:number;max:number;step:number;unit:string;disabled?:boolean;hint?:string;onValue:(n:number)=>void}){
  const id=useId(),[draft,setDraft]=useState(String(value)),focused=useRef(false);
  useEffect(()=>setDraft(String(value)),[value]);
  const set=(n:number)=>{const next=Math.min(max,Math.max(min,n));setDraft(String(next));if(next!==value)onValue(next);};
  const typed=()=>{const text=draft.trim().replace(',','.'),n=Number(text);return text&&Number.isFinite(n)?n:undefined;};
  const commit=()=>{const n=typed();if(n===undefined)setDraft(String(value));else set(n);};
  // The ends stay focusable (aria-disabled), so reaching a limit never drops the keyboard focus. The arrow keys step from
  // a number being typed, as − and + do once leaving the field has committed it.
  const low=disabled||value<=min,high=disabled||value>=max,stepFrom=(from:number,dir:1|-1)=>set(Number((from+dir*step).toFixed(6)));
  const stepBy=(dir:1|-1)=>{if(!(dir<0?low:high))stepFrom(value,dir);};
  const name=label.toLowerCase();
  return <div className="dd-next-stepper" role="group" aria-label={label}>
    <label htmlFor={id}>{label}{hint&&<small>{hint}</small>}</label>
    <button type="button" aria-label={`Decrease ${name}`} aria-disabled={low} onClick={()=>stepBy(-1)}>−</button>
    {/* The click that focuses the number would put the caret back on mouse-up and lose the selection. */}
    <span className="dd-next-number"><input id={id} type="text" inputMode="decimal" value={draft} disabled={disabled} onFocus={e=>{focused.current=true;e.currentTarget.select();}} onMouseUp={e=>{if(focused.current)e.preventDefault();focused.current=false;}} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();stepFrom(typed()??value,e.key==='ArrowUp'?1:-1);}}}/><span>{unit}</span></span>
    <button type="button" aria-label={`Increase ${name}`} aria-disabled={high} onClick={()=>stepBy(1)}>+</button>
  </div>;
}

const SHAPE_ICONS:Record<DeckShape,string>={
  Rectangle:'M5 8h18v12H5z','L-Shape':'M5 8h18v6h-8v6H5z','Multi-corner':'M5 8h18v5h-4v3h-5v4H5z',
  Curved:'M5 8h18v7c0 3-4 5-9 5s-9-2-9-5z',Custom:'M5 8h18v7l-5 5H9l-4-4z',
};
function ShapePicks({data,update,wrapWidth,onPlanTool}:QuickPicksProps){
  const id=useId(),free=!!data.deckOutlines?.main,custom=data.shape==='Custom'&&!free;
  const fixed=wrapWidth?'Set by the wrap-around':custom?'Set by the outline':undefined;
  return <>
    <Choices look="tiles" label="Deck shape" value={free?undefined:data.shape} options={SHAPES.map(([v,name])=>[v,<Tile d={SHAPE_ICONS[v]} name={name}/>] as const)} onPick={shape=>update(chooseShape(data,shape))}/>
    {free&&<p className="dd-next-note">This deck follows your own points. <button type="button" className="dd-linklike" onClick={()=>onPlanTool('outline')}>Edit them on the plan</button></p>}
    <div className="dd-next-pick"><p id={id} className="dd-next-pick-label">Size</p><div role="group" aria-labelledby={id} className="dd-next-steppers">
      <Stepper label="Width" value={data.width} {...DECK_FT} step={1} unit="ft" disabled={wrapWidth||custom} hint={fixed} onValue={width=>update({width})}/>
      <Stepper label="Depth" value={data.length} {...DECK_FT} step={1} unit="ft" disabled={custom} hint={custom?fixed:undefined} onValue={length=>update({length})}/>
      <Stepper label="Height" value={data.height} {...HEIGHT_IN} step={1} unit="in" onValue={height=>update({height})}/>
    </div></div>
    <Choices label="How it connects" value={data.deckType} options={DECK_TYPES.map(v=>[v,v] as const)} onPick={v=>update(selectPatch('deckType',v))}/>
    <Choices label="Levels" value={data.levels} disabled={custom} options={[1,2,3].map(n=>[n,String(n),`${n} ${n===1?'level':'levels'}`] as const)} onPick={n=>update(levelsPatch(data,n))}/>
  </>;
}

const LAYOUT_ICONS:Record<(typeof BOARD_LAYOUTS)[number],string>={
  Straight:'M5 5h18v18H5zM5 9.5h18M5 14h18M5 18.5h18',Diagonal:'M5 5h18v18H5zM5 12l7-7M5 19L19 5M9 23L23 9M16 23l7-7',
  'Picture Frame':'M5 5h18v18H5zM9 9h10v10H9zM9 12.3h10M9 15.6h10',Herringbone:'M5 5h18v18H5zM5 11l4.5-4 4.5 4 4.5-4 4.5 4M5 18l4.5-4 4.5 4 4.5-4 4.5 4',
};
function BoardPicks({data,update}:QuickPicksProps){
  // The colours of the collection a design uses, even one no longer offered; picking a collection takes its first colour.
  const material=DECKING_CATALOGUE.find(m=>m.id===data.deckingMaterial);
  return <>
    {material&&<Choices look="photos" label="Colour" value={data.deckingColor} options={material.colors.map(c=>[c.name,<Photo file={c.swatch} name={c.name}/>,c.name] as const)} onPick={deckingColor=>update({deckingColor})}/>}
    <Choices look="tiles" label="Board layout" value={data.pattern} options={BOARD_LAYOUTS.map(v=>[v,<Tile d={LAYOUT_ICONS[v]} name={v}/>] as const)} onPick={v=>update(selectPatch('pattern',v))}/>
    <Choices label="Border" value={data.pictureFrameRows} options={BORDER_ROWS.map(n=>[n,n===0?'No border':`${n} ${n===1?'row':'rows'}`] as const)} onPick={n=>update(selectPatch('pictureFrameRows',n))}/>
    <Choices label="Fasteners" value={data.fasteningSystem} options={FASTENERS.map(v=>[v,v] as const)} onPick={v=>update(selectPatch('fasteningSystem',v))}/>
    <Choices look="photos" label="Collection" value={data.deckingMaterial} options={COLLECTIONS.map(m=>[m.id,<Photo file={m.colors[0]?.swatch} name={m.name}/>,m.name] as const)} onPick={id=>update(collectionPatch(COLLECTIONS.find(m=>m.id===id)!))}/>
  </>;
}

const STAIR_ICONS:Record<(typeof STAIR_LAYOUTS)[number],string>={
  Straight:'M10 4h8v20h-8zM10 9h8M10 14h8M10 19h8',Landing:'M5 4h8v10h10v8H5zM5 8h8M17 14v8M20 14v8M5 14h8',
  Winder:'M5 4h8v10h10v8H5zM5 8h8M13 14l-8 3M13 14l-4 8M13 14l4 8M13 14h10',
};
const POSTS='M5 7v15M23 7v15M5 8h18M5 21h18';
const RAIL_ICONS:Record<(typeof RAILING_STYLES)[number],string>={
  None:'M3 21h22','Wood Picket':`${POSTS}M9 9v11M12.5 9v11M16 9v11M19.5 9v11`,Aluminum:`${POSTS}M8 9v11M10.5 9v11M13 9v11M15.5 9v11M18 9v11M20.5 9v11`,
  Cable:`${POSTS}M6 11h16M6 14h16M6 17h16`,'Glass Panels':`${POSTS}M7.5 10h13v9h-13z`,'Frameless Glass':'M4 7h20v12H4zM3 21h22',
  'Fortress AL13':`${POSTS}M9 9v11M11 9v11M13 9v11M15 9v11M17 9v11M19 9v11`,'TT Classic':`${POSTS}M9.5 9v11M14 9v11M18.5 9v11`,
  'TT Impression':`${POSTS}M3 6h22M9.5 9v11M14 9v11M18.5 9v11`,
};
// The mini plan's sides in reading order: behind the deck, then either side, then the front.
const SIDES=['Back','Left','Right','Front'] as const;
function StairPicks({data,update}:QuickPicksProps){
  const id=useId(),open=availableStairSides(data),side=data.stairEdgeId?undefined:data.stairPosition;
  return <>
    {data.stairPath?<p className="dd-next-note">These stairs follow the edge you drew. Change them under More.</p>:<>
      <Choices label="Stairs" value={data.stairFlights} options={STAIR_FLIGHTS.map(n=>[n,n?String(n):'No stairs',n?`${n} ${n===1?'flight':'flights'}`:undefined] as const)} onPick={n=>update(selectPatch('stairFlights',n))}/>
      {data.stairFlights>0&&<>
        <Choices look="tiles" label="Stair layout" value={data.stairType} options={STAIR_LAYOUTS.map(v=>[v,<Tile d={STAIR_ICONS[v]} name={v}/>] as const)} onPick={v=>update(selectPatch('stairType',v))}/>
        {/* The deck from above, the house behind it: picking a side follows it, dropping an edge picked under More. */}
        <div className="dd-next-pick"><p id={id} className="dd-next-pick-label">Stair side</p><div role="group" aria-labelledby={id} className="dd-next-sides">
          {deckAttachesToHouse(data)&&<span className="dd-next-sides-house" aria-hidden="true">House</span>}
          <span className="dd-next-sides-deck" aria-hidden="true"/>
          {SIDES.filter(s=>open.includes(s)).map(s=><button key={s} type="button" data-side={s} aria-pressed={side===s} onClick={()=>update({...selectPatch('stairPosition',s),stairEdgeId:undefined})}>{s}</button>)}
        </div></div>
        <Stepper label="Stair width" value={data.stairWidth} {...STAIR_WIDTH_IN} step={6} unit="in" onValue={stairWidth=>update({stairWidth})}/>
      </>}
    </>}
    <Choices look="tiles" label="Railing" value={data.railingType} options={RAILING_STYLES.map(v=>[v,<Tile d={RAIL_ICONS[v]} name={v}/>] as const)} onPick={v=>update(selectPatch('railingType',v))}/>
  </>;
}

const YARD_ADDS:readonly (readonly [YardFeatureKind,string,string])[]=[
  ['patio','Patio','M4 7h20v14H4zM4 14h20M11 7v7M17 14v7'],['retaining-wall','Wall','M3 20h22v-5H3zM3 15h22v-5H3zM10 20v-5M17 20v-5M7 15v-5M14 15v-5M21 15v-5'],
  ['fire-feature','Fire feature','M14 4c4 5 6 8 6 11a6 6 0 0 1-12 0c0-2 1-4 3-6 0 3 1 4 3 4 0-3-1-6 0-9zM6 24h16'],['water-feature','Water feature','M3 12c3-3 5-3 8 0s5 3 8 0 4-2 6 0M3 18c3-3 5-3 8 0s5 3 8 0 4-2 6 0'],
];
function YardPicks({data,update,onSelectYard,onPlanTool}:QuickPicksProps){
  const features=data.yardFeatures??[],a=data.yardAllowances??NO_ALLOWANCES,[error,setError]=useState('');
  // A first patio or wall is checked and priced at once, so the supplier catalogue (lazy, hardscapeLookup.ts) comes first.
  const add=async(kind:YardFeatureKind)=>{try{await loadHardscapeCatalogue();const feature=newYardFeature(kind,data);update({yardFeatures:[...features,feature]});onSelectYard(feature.id);setError('');}catch(e){setError((e as Error).message);}};
  const allow=(patch:Partial<YardAllowances>)=>update(yardAllowancesPatch(data,patch));
  return <>
    <Group look="tiles" label="Add to the yard" items={YARD_ADDS.map(([kind,name,d])=>({text:<Tile d={d} name={name}/>,name:`Add a ${name.toLowerCase()}`,disabled:features.length>=MAX_YARD_FEATURES,onClick:()=>void add(kind)}))}/>
    {error&&<p className="dd-next-note" role="alert">{error}</p>}
    <Group look="actions" label="Draw on the plan" items={[{text:'Patios & walls',onClick:()=>onPlanTool('yard')},{text:'Landscape areas',onClick:()=>onPlanTool('landscape')}]}/>
    <Choices label="Fire pit" value={a.firePit} options={[['none','None'],['wood','Wood'],['gas','Gas']] as const} onPick={firePit=>allow({firePit})}/>
    <Choices label="Outdoor kitchen" value={a.kitchen} options={[['none','None'],['basic','Basic'],['full','Full build']] as const} onPick={kitchen=>allow({kitchen})}/>
    <Group label="Turf & lighting" items={[{text:'Artificial turf',pressed:a.turfSqft>0,onClick:()=>allow({turfSqft:a.turfSqft>0?0:TURF_SQFT.default})},{text:'Yard lighting',pressed:a.lighting,onClick:()=>allow({lighting:!a.lighting})}]}/>
  </>;
}

function ExtraPicks({data,update,autoCounts,canAddScreen}:QuickPicksProps){
  const lights=data.autoLighting,screens=data.privacyScreens??[];
  const count=(n:number,none:string)=><> <small>{n?Math.min(n,MAX_FIXTURE_QTY):none}</small></>;
  return <>
    <Group label="Deck lighting" items={[
      {text:<>Post lights{count(autoCounts.posts,data.railingType==='Frameless Glass'?'No posts':'Add a railing')}</>,pressed:!!lights?.posts,disabled:!lights?.posts&&!autoCounts.posts,onClick:()=>update({autoLighting:{...lights,posts:!lights?.posts}})},
      {text:<>Step lights{count(autoCounts.stairs,'Add stairs')}</>,pressed:!!lights?.stairs,disabled:!lights?.stairs&&!autoCounts.stairs,onClick:()=>update({autoLighting:{...lights,stairs:!lights?.stairs}})},
    ]}/>
    <Group label="Around the deck" items={[
      {text:<>Add a privacy screen{screens.length>0&&<> <small>{screens.length} of {MAX_PRIVACY_SCREENS}</small></>}</>,disabled:!canAddScreen,onClick:()=>update({privacyScreens:[...screens,newPrivacyScreen(data,screens)]})},
      {text:'Remove an existing deck',pressed:data.hasDemo,onClick:()=>update({hasDemo:!data.hasDemo})},
    ]}/>
    <Choices label="Foundation" value={data.foundation} options={FOUNDATIONS.map(v=>[v,v] as const)} onPick={v=>update(selectPatch('foundation',v))}/>
  </>;
}
