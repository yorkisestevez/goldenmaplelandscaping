import {unnotchedMainOutline} from '../lib/deckGeometry';
import {activeCornerChamfers} from '../lib/cornerChamfers';
import {frontFromOutline,outlineProblems,rectangleFront} from '../lib/customOutline';
import {boundaryBounds,boundaryProblem,savedBoundary} from '../lib/freeOutline';
import type {DeckData,DeckShape,HouseConfig,WrapPorch,WrapWing} from '../types';

/**
 * The deck's shape actions, as pure functions of the design: each returns the patch to hand to `update` (and, for a
 * wing, the status line to show), and none reads or sets page state. The footprint fields and the plan's named
 * shape shortcuts use them. Draw my own is drawOwnOutline, not the Deck menu's Custom outline.
 */
type Side='left'|'right';
type HouseSize=Pick<HouseConfig,'widthFt'|'depthFt'>;

/**
 * A new shape from the Deck menu. "Custom outline" is the constrained front (square or 45° edges, shape presets,
 * keyboard edge moves). It starts from the deck as drawn now, or from the outline it already had, and clears any free
 * point outline so that editor is the one on screen. Other shapes clear the free outline too. Draw my own on the plan
 * is `drawOwnOutline`: that one keeps the real footprint as free points.
 */
export function chooseShape(data:DeckData,shape:DeckShape):Partial<DeckData>{
  const deckOutlines=data.deckOutlines?{...data.deckOutlines,main:undefined}:undefined;
  if(shape!=='Custom')return {shape,...(data.deckOutlines?{deckOutlines}:{})};
  const kept=data.customFront&&!outlineProblems(data.customFront).length?data.customFront:null;
  return {shape,deckOutlines,customFront:kept??frontFromOutline(unnotchedMainOutline(data))??rectangleFront(data.width,data.length),levels:1};
}

/**
 * Draw my own: seed a free-form outline (`deckOutlines.main`) from the deck as drawn now so the plan's point editor
 * can pull any corner — including L-shapes, wraps and already-edited outlines — without collapsing them to a
 * constrained front or a rectangle. An existing valid free outline is kept.
 */
export function drawOwnOutline(data:DeckData):Partial<DeckData>{
  if(data.deckOutlines?.main&&!boundaryProblem(data.deckOutlines.main.map(p=>({x:p.x*12,y:p.y*12})))){
    return {shape:'Custom',levels:1,customFront:undefined};
  }
  const outline=unnotchedMainOutline(data);
  const problem=boundaryProblem(outline);
  const points=problem?(()=>{const W=Math.max(4,Number(data.width)||16),L=Math.max(4,Number(data.length)||12);return [{x:0,y:0},{x:W*12,y:0},{x:W*12,y:L*12},{x:0,y:L*12}];})():outline;
  const bounds=boundaryBounds(points);
  return {
    shape:'Custom',
    levels:1,
    width:Math.round(bounds.w/12*1000)/1000,
    length:Math.round(bounds.h/12*1000)/1000,
    deckOutlines:{...data.deckOutlines,main:savedBoundary(points)},
    customFront:undefined,
    wrap:undefined,
    cornerChamfers:undefined,
  };
}

/** What a wrap-around needs before its corner can be mitred: a rectangle, no inlay, straight boards and square front corners. */
export const wrapFix=(data:DeckData):Partial<DeckData>=>({shape:'Rectangle',hasInlay:false,...(data.deckOutlines?{deckOutlines:{...data.deckOutlines,main:undefined}}:{}),...(data.pattern==='Diagonal'||data.pattern==='Herringbone'?{pattern:'Straight' as const}:{}),...(data.cornerChamfers?{cornerChamfers:undefined}:{})});
/** The changes `wrapFix` makes to this design, in words. */
export const wrapFixNames=(data:DeckData)=>[data.shape!=='Rectangle'&&'a rectangle',data.hasInlay&&'no inlay',(data.pattern==='Diagonal'||data.pattern==='Herringbone')&&'straight boards',activeCornerChamfers({...data,shape:'Rectangle'})&&'square front corners'].filter(Boolean) as string[];
/** The status line after `wrapFix`. */
export const wrapFixStatus=(names:string[])=>`Switched to ${names.join(', ')} so the corner can be mitred.`;

/**
 * Wrap-around: a side wing round one house corner, on or off. Turning a wing on applies `wrapFix` and says what it
 * changed; turning it off also drops that side's porch.
 */
export function setWing(data:DeckData,house:HouseSize,side:Side,on:boolean):{patch:Partial<DeckData>;status:string}{
  const current=data.wrap??{},next={...current};
  if(on)next[side]=current[side]??{widthFt:8,runFt:Math.min(8,house.depthFt)};else{delete next[side];delete next[side==='left'?'porchLeft':'porchRight'];}
  const changed=on?wrapFixNames(data):[];
  return {status:changed.length?wrapFixStatus(changed):'',patch:{wrap:next.left||next.right?next:undefined,...(on?wrapFix(data):{})}};
}
/** A wing's width or run; nothing when that side has no wing. */
export function setWingSize(data:DeckData,side:Side,patch:Partial<WrapWing>):Partial<DeckData>|null{
  const wing=data.wrap?.[side];
  return wing?{wrap:{...data.wrap,[side]:{...wing,...patch}}}:null;
}

/** The porch that continues a wing round the far corner of the house. */
export const porchKey=(side:Side)=>side==='left'?'porchLeft' as const:'porchRight' as const;
/** A porch, on or off. It starts 45° mitred (as deep as its wing is wide) and leaves room for the other porch. */
export function setPorch(data:DeckData,house:HouseSize,side:Side,on:boolean):Partial<DeckData>{
  const next={...data.wrap},key=porchKey(side),other=next[porchKey(side==='left'?'right':'left')];
  if(on)next[key]=next[key]??{depthFt:Math.min(24,Math.max(4,next[side]?.widthFt??8)),runFt:Math.max(4,Math.min(12,house.widthFt-3-(other?.runFt??0)))};else delete next[key];
  return {wrap:next};
}
/** A porch's depth or run; nothing when that side has no porch. */
export function setPorchSize(data:DeckData,side:Side,patch:Partial<WrapPorch>):Partial<DeckData>|null{
  const key=porchKey(side),porch=data.wrap?.[key];
  return porch?{wrap:{...data.wrap,[key]:{...porch,...patch}}}:null;
}

/** Split level: a lower section one step down across the whole front, joined by a full-width step. */
export const splitLevel=(data:DeckData):Partial<DeckData>=>({levels:Math.max(2,data.levels),level2Position:'Front',level2EdgeId:undefined,level2Offset:50,height2:Math.max(8,data.height-7),width2:Math.min(40,Math.max(4,data.width)),length2:Math.min(40,Math.max(6,Math.round(data.length*1.5)/2)),level2FullStep:true});
