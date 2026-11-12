import {DECKING_CATALOGUE} from '../deckcraft/manufacturerRuntimeCatalogue';
import {GUARD_REQUIRED_ABOVE_IN} from '../deckcraft/designRules';
import {deckSizeForArea} from '../deckcraft/estimatorHandoff';
import type {RailingType} from '../deckcraft/types';

/**
 * The light deck estimator's choices: a handful of questions a homeowner can answer in a minute, each one a real
 * DeckCraft deck (quickDeckPrice.ts turns them into the designer's own design and prices it with the designer's engine).
 * This module draws the form, so it imports only the decking catalogue (a few KB), never the engine or the 3D designer.
 */

/** Freestanding covers the designer's floating and add-on decks, which it prices the same way. */
export type QuickDeckType='Attached'|'Freestanding';
/** The railings the engine prices in full. Frameless glass is left out: its shoe and glass are a supplier quote. */
export type QuickRailing=Exclude<RailingType,'Frameless Glass'|'Trex Select'|'Trex Transcend'>;

export interface QuickDeck{
  /** Along the house, in whole feet. */
  width:number;
  /** Out from the house, in whole feet. */
  length:number;
  /** Above the ground, in inches: one of QUICK_HEIGHTS. */
  height:number;
  deckType:QuickDeckType;
  /** A QUICK_MATERIALS collection id. */
  material:string;
  railing:QuickRailing;
  stairs:0|1|2;
  skirting:boolean;
  removeOld:boolean;
  /** A one-row picture-frame border. */
  border:boolean;
}

/** Deck size limits, in feet (the designer allows more; past these a deck is a site-visit job). */
export const QUICK_DECK_FT={width:{min:8,max:60},length:{min:8,max:40}} as const;

export const QUICK_HEIGHTS=[
  {inches:18,label:'Low',hint:'Under 2 ft'},
  {inches:36,label:'Raised',hint:'About 3 ft'},
  {inches:60,label:'High',hint:'About 5 ft'},
  {inches:96,label:'Walkout',hint:'About 8 ft'},
] as const;

export const QUICK_RAILINGS:readonly {value:QuickRailing;label:string}[]=[
  {value:'Aluminum',label:'Aluminum'},
  {value:'Fortress AL13',label:'Fortress AL13'},
  {value:'TT Impression',label:'TimberTech Impression'},
  {value:'TT Classic',label:'TimberTech Classic'},
  {value:'Glass Panels',label:'Glass panels'},
  {value:'Cable',label:'Cable'},
  {value:'Wood Picket',label:'Wood picket'},
  {value:'None',label:'No railing'},
];

/** The composite and PVC collections the price book has a rate for, in the designer's order. */
export const QUICK_MATERIALS=DECKING_CATALOGUE.filter(m=>!m.isHidden&&m.isComposite&&m.costPerSqft!==null).map(m=>({
  id:m.id,name:m.name,tier:m.tier,colour:m.colors[0]?.name??'',swatch:m.colors[0]?.swatch,
}));

/** The designer's new deck (defaults.ts NEW_DECK): 16 × 12 ft, 36 in up, AZEK Harvest, aluminum railing, one stair. */
export const QUICK_DECK_DEFAULT:QuickDeck={width:16,length:12,height:36,deckType:'Attached',material:'tt_harvest',railing:'Aluminum',stairs:1,skirting:true,removeOld:false,border:true};

/** A deck may go without a railing only where the building code does not require a guard (600 mm). */
export const railingAllowed=(railing:QuickRailing,heightIn:number)=>railing!=='None'||heightIn<=GUARD_REQUIRED_ABOVE_IN;

const clamp=(n:number,{min,max}:{min:number;max:number})=>Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):min;
const nearestHeight=(inches:number)=>QUICK_HEIGHTS.reduce((best,h)=>Math.abs(h.inches-inches)<Math.abs(best-inches)?h.inches:best,QUICK_HEIGHTS[0].inches as number);

/** Holds a deck to what the form offers: whole-foot sizes in range, a listed height, collection and railing, at most two stairs. */
export function normalizeQuickDeck(q:QuickDeck):QuickDeck{
  const height=nearestHeight(q.height);
  const listed=QUICK_RAILINGS.some(r=>r.value===q.railing);
  const railing=listed&&railingAllowed(q.railing,height)?q.railing:QUICK_DECK_DEFAULT.railing;
  return {
    width:clamp(q.width,QUICK_DECK_FT.width),
    length:clamp(q.length,QUICK_DECK_FT.length),
    height,
    deckType:q.deckType==='Attached'?'Attached':'Freestanding',
    material:QUICK_MATERIALS.some(m=>m.id===q.material)?q.material:QUICK_DECK_DEFAULT.material,
    railing,
    stairs:Math.min(2,Math.max(0,Math.round(q.stairs)||0)) as QuickDeck['stairs'],
    skirting:!!q.skirting,
    removeOld:!!q.removeOld,
    border:!!q.border,
  };
}

/** The default deck at about the given area (the designer's 4:3 starter size), or the default deck. */
export function quickDeckForArea(sqft:number|null):QuickDeck{
  return sqft===null?{...QUICK_DECK_DEFAULT}:normalizeQuickDeck({...QUICK_DECK_DEFAULT,...deckSizeForArea(sqft)});
}
