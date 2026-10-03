import {useEffect,useRef,useState,type PointerEvent} from 'react';
import type {DeckData,HouseConfig,HouseOpening} from './types';
import {getHouseConfig,clampHouseOpening} from './houseSettings';
import HouseEditor from './HouseEditor';

const facades=[['Front','Deck-facing'],['Back','Rear'],['Left','Left side'],['Right','Right side']] as const;
export default function HouseOpeningEditor({data,onChange,selectedId,onSelect}:{data:DeckData;onChange:(patch:Partial<DeckData>)=>void;selectedId:string;onSelect:(id:string)=>void}){
  const house=getHouseConfig(data),selected=house.openings.find(o=>o.id===selectedId)??house.openings[0];
  const [facade,setFacade]=useState<HouseOpening['facade']>(selected?.facade??'Front');
  const [undo,setUndo]=useState<HouseConfig|null>(null);
  const drag=useRef<{id:string;x:number;y:number;opening:HouseOpening}|null>(null);
  useEffect(()=>{const opening=house.openings.find(o=>o.id===selectedId);if(opening)setFacade(opening.facade);},[selectedId]);
  const span=(facade==='Front'||facade==='Back'?house.widthFt:house.depthFt)*12,height=house.storeys*house.storeyHeightIn;
  const shown=house.openings.filter(o=>o.facade===facade);
  const change=(patch:Partial<HouseConfig>,remember=true)=>{if(remember)setUndo(structuredClone(house));const next={...house,...patch};next.openings=next.openings.map(o=>clampHouseOpening(o,next));onChange({houseConfig:next});};
  const changeOpening=(patch:Partial<HouseOpening>,remember=true,id=selected?.id)=>{if(id)change({openings:house.openings.map(o=>o.id===id?{...o,...patch}:o)},remember);};
  const add=(type:HouseOpening['type'])=>{
    const opening:HouseOpening={id:`${type.toLowerCase()}-${crypto.randomUUID()}`,type,facade,offsetPct:50,bottomIn:type==='Door'?data.height:48,widthIn:type==='Door'?36:48,heightIn:type==='Door'?84:54};
    change({openings:[...house.openings,opening]});onSelect(opening.id);
  };
  const localPoint=(e:PointerEvent<SVGElement>)=>{const svg=e.currentTarget.ownerSVGElement??e.currentTarget as SVGSVGElement;const matrix=svg.getScreenCTM();return matrix?new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse()):null;};
  const selectedSpan=selected?(selected.facade==='Front'||selected.facade==='Back'?house.widthFt:house.depthFt)*12:span;
  const nudge=(dx:number,dy:number)=>changeOpening({offsetPct:selected!.offsetPct+dx/selectedSpan*100,bottomIn:selected!.bottomIn+dy});
  const overlapping=selected&&house.openings.some(o=>o.id!==selected.id&&o.facade===selected.facade&&Math.abs(o.offsetPct-selected.offsetPct)/100*selectedSpan<(o.widthIn+selected.widthIn)/2&&o.bottomIn<selected.bottomIn+selected.heightIn&&selected.bottomIn<o.bottomIn+o.heightIn);
  const number=(label:string,value:number,min:number,max:number,commit:(n:number)=>void)=><label className="dd-field"><span>{label}</span><span className="dd-number"><input key={`${selected?.id}:${value}`} aria-label={label} type="number" min={min} max={max} step="0.25" defaultValue={Number(value.toFixed(2))} onBlur={e=>{const n=Number(e.target.value);if(e.target.value.trim()&&Number.isFinite(n))commit(Math.min(max,Math.max(min,n)));else e.target.value=String(value);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><span>in</span></span></label>;
  return <section className="dd-house-editor" aria-label="Quick doors and windows editor">
    <p className="dd-note">Choose a wall, then select and drag an opening. Arrow keys move a focused opening 1 in; Shift + arrow moves 6 in. Dimensions and sliders below update the same 3D house.</p>
    <label className="dd-check"><input type="checkbox" checked={data.houseVisible!==false} onChange={e=>onChange({houseVisible:e.target.checked})}/><span>Show house</span></label>
    <div className="dd-wall-tabs" role="group" aria-label="Choose house wall">{facades.map(([value,label])=><button className="dd-secondary" key={value} aria-pressed={facade===value} onClick={()=>{setFacade(value);const first=house.openings.find(o=>o.facade===value);if(first)onSelect(first.id);}}>{label}</button>)}</div>
    <svg className="dd-edit-map dd-wall-elevation" viewBox={`-12 -12 ${span+24} ${height+36}`} aria-label={`${facades.find(([v])=>v===facade)?.[1]} wall elevation`} onPointerMove={e=>{const p=localPoint(e),d=drag.current;if(!p||!d)return;changeOpening({offsetPct:d.opening.offsetPct+(p.x-d.x)/span*100,bottomIn:d.opening.bottomIn-(p.y-d.y)},false,d.id);}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
      <rect width={span} height={height} fill={house.claddingColor} stroke="#867969" strokeWidth="1"/>
      {facade==='Front'&&<><line x1="0" y1={height-data.height} x2={span} y2={height-data.height} stroke="#78563e" strokeDasharray="4 3"/><text x="4" y={height-data.height-4} fontSize="7" fill="#292824" paintOrder="stroke" stroke="#fffdfa" strokeWidth="2">Deck surface</text></>}
      {shown.map(o=><g key={o.id} role="button" tabIndex={0} aria-label={`Select ${o.type.toLowerCase()} ${house.openings.indexOf(o)+1} on wall`} aria-pressed={selected?.id===o.id} onClick={()=>onSelect(o.id)} onPointerDown={e=>{if(e.button!==0)return;const p=localPoint(e);if(!p)return;e.preventDefault();onSelect(o.id);setUndo(structuredClone(house));drag.current={id:o.id,x:p.x,y:p.y,opening:o};e.currentTarget.setPointerCapture(e.pointerId);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(o.id);}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();onSelect(o.id);const d=e.shiftKey?6:1;changeOpening({offsetPct:o.offsetPct+(e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0)/span*100,bottomIn:o.bottomIn+(e.key==='ArrowUp'?d:e.key==='ArrowDown'?-d:0)},true,o.id);}}}>
        <rect x={span*o.offsetPct/100-o.widthIn/2} y={height-o.bottomIn-o.heightIn} width={o.widthIn} height={o.heightIn} fill={o.type==='Door'?'#c7ad89':'#d8edf0'} stroke={selected?.id===o.id?'#1d6556':'#5a554d'} strokeWidth={selected?.id===o.id?4:1.5}/>
        <text x={span*o.offsetPct/100} y={height-o.bottomIn-o.heightIn/2} textAnchor="middle" fontSize="8" fill="#292824">{o.type==='Door'?'D':'W'}{house.openings.indexOf(o)+1}</text>
      </g>)}
      <text x={span/2} y={height+17} textAnchor="middle" fontSize="8" fill="#5b554b">{span/12} ft wall · viewed from outside</text>
    </svg>
    <div className="dd-summary-actions"><button className="dd-secondary" disabled={house.openings.length>=24} onClick={()=>add('Door')}>Add door</button><button className="dd-secondary" disabled={house.openings.length>=24} onClick={()=>add('Window')}>Add window</button><button className="dd-secondary" disabled={!undo} onClick={()=>{if(undo){onChange({houseConfig:undo});setUndo(null);}}}>Undo last house edit</button></div>
    {!shown.length&&<p className="dd-note">No openings on this wall. Add a door or window here.</p>}
    {house.openings.length>=24&&<p className="dd-note">The preview supports up to 24 openings.</p>}
    {selected&&selected.facade===facade&&<>
      <label className="dd-field dd-opening-select"><span>Selected opening</span><select aria-label="Selected house opening" value={selected.id} onChange={e=>onSelect(e.target.value)}>{house.openings.map((o,i)=><option key={o.id} value={o.id}>{i+1}. {o.type} · {facades.find(([value])=>value===o.facade)?.[1]}</option>)}</select></label>
      <label className="dd-field"><span>House facade</span><select aria-label="House facade" value={selected.facade} onChange={e=>{const f=e.target.value as HouseOpening['facade'];setFacade(f);changeOpening({facade:f});}}>{facades.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label className="dd-field dd-opening-select"><span>Move along wall · {Math.round(selected.offsetPct)}%</span><input type="range" aria-label="Move opening along wall" min="0" max="100" step="0.25" value={selected.offsetPct} onChange={e=>changeOpening({offsetPct:Number(e.target.value)})}/></label>
      <div className="dd-fields">{number('Opening left edge from wall start',selectedSpan*selected.offsetPct/100-selected.widthIn/2,6,selectedSpan-selected.widthIn-6,left=>changeOpening({offsetPct:(left+selected.widthIn/2)/selectedSpan*100}))}{number('Opening bottom above grade',selected.bottomIn,0,height-selected.heightIn-6,bottomIn=>changeOpening({bottomIn}))}{number('Opening width',selected.widthIn,12,Math.min(180,selectedSpan-12),widthIn=>changeOpening({widthIn}))}{number('Opening height',selected.heightIn,12,Math.min(144,height-12),heightIn=>changeOpening({heightIn}))}</div>
      <div className="dd-opening-move" role="group" aria-label="Move selected house opening"><button className="dd-secondary" onClick={()=>nudge(-6,0)}>← Move 6 in</button><button className="dd-secondary" onClick={()=>nudge(6,0)}>Move 6 in →</button><button className="dd-secondary" onClick={()=>nudge(0,6)}>↑ Raise 6 in</button><button className="dd-secondary" onClick={()=>nudge(0,-6)}>↓ Lower 6 in</button><button className="dd-secondary" onClick={()=>changeOpening({offsetPct:50})}>Centre on wall</button>{selected.type==='Door'&&<button className="dd-secondary" onClick={()=>changeOpening({bottomIn:data.height})}>Align door to deck</button>}<button className="dd-secondary" onClick={()=>{change({openings:house.openings.filter(o=>o.id!==selected.id)});onSelect('');}}>Remove selected {selected.type.toLowerCase()}</button></div>
      {overlapping&&<p role="status" className="dd-quote-notice">The selected opening overlaps another opening. Move or resize it to match the house.</p>}
    </>}
    <details className="dd-advanced"><summary>All house dimensions &amp; finishes</summary><HouseEditor data={data} selectedId={selectedId} onSelect={onSelect} onChange={patch=>{setUndo(structuredClone(house));onChange(patch);}}/></details>
  </section>;
}
