import {DECKING_CATALOGUE,type CatalogueDecking} from './manufacturerCatalog';
import type {DeckTakeoff} from './deckTakeoff';
import {modelAddresses,type BoardAddress} from './lib/boardAddress';
import type {BoardColour,ColourRef,DeckData,MaterialColor} from './types';

/**
 * Accent-colour deck boards: one board, or a whole row, in another real product colour. Only colours from
 * DECKING_CATALOGUE are offered: any colour of the deck's own collection, or of another priced collection of
 * the same kind (composite with composite; a wood deck keeps its own species, whose gap and stock length set
 * the layout). Each accent colour is ordered as its own boards at its own collection's rate (calculations.ts).
 * Nothing here runs for a design without `boardColours`, so existing designs are unchanged.
 */
export const MAX_BOARD_COLOURS=300;
/** The accent-board tool's current choice (page state, never saved): the colour and what a click paints. */
export interface BoardPaintChoice{colour:ColourRef;scope:'piece'|'course'}
export const colourRef=(materialId:string,colour:string):ColourRef=>`${materialId}:${colour}`;
export function parseColourRef(ref:unknown):{material:CatalogueDecking;color:MaterialColor}|null{
  if(typeof ref!=='string')return null;
  const i=ref.indexOf(':');if(i<1)return null;
  const material=DECKING_CATALOGUE.find(m=>m.id===ref.slice(0,i)),color=material?.colors.find(c=>c.name===ref.slice(i+1));
  return material&&color?{material,color}:null;
}
const deckMaterial=(data:Pick<DeckData,'deckingMaterial'>)=>DECKING_CATALOGUE.find(m=>m.id===data.deckingMaterial)||DECKING_CATALOGUE[0];
/** The deck's own colour as a colour reference. */
export function deckColourRef(data:Pick<DeckData,'deckingMaterial'|'deckingColor'>):ColourRef{
  const m=deckMaterial(data);return colourRef(m.id,(m.colors.find(c=>c.name===data.deckingColor)||m.colors[0]).name);
}
/** Board width plus the collection's gap: the row pitch buildDeckTakeoff lays boards on. */
export const boardPitch=(data:Pick<DeckData,'deckingMaterial'|'boardWidth'>)=>data.boardWidth+(deckMaterial(data).isComposite?.1875:.25);
/** Collections whose colours can be accents on this deck: its own, then every other priced one of its kind. */
export function accentCollections(data:Pick<DeckData,'deckingMaterial'>):CatalogueDecking[]{
  const main=deckMaterial(data);
  return [main,...DECKING_CATALOGUE.filter(m=>m.id!==main.id&&!m.isHidden&&m.costPerSqft!==null&&main.isComposite&&m.isComposite)];
}
export function accentAllowed(data:Pick<DeckData,'deckingMaterial'>,ref:ColourRef){
  const parsed=parseColourRef(ref);return !!parsed&&accentCollections(data).some(m=>m.id===parsed.material.id);
}

export interface AccentGroup{ref:ColourRef;material:CatalogueDecking;color:MaterialColor;boards:{level:number;index:number}[]}
export interface BoardFinishPlan{
  /** Every board's address, by model level then board (null where boards take no accent colour). */
  addresses:(BoardAddress|null)[][];
  /** Each board's accent colour, or null for the deck's own colour. */
  colours:(ColourRef|null)[][];
  groups:AccentGroup[];
  /** Saved choices that colour at least one board, and those that no longer do (never moved to another board). */
  matched:BoardColour[];unmatched:BoardColour[];
  /** Boards in an accent colour. */
  pieces:number;
}

const sameRow=(o:BoardColour,a:{lv:number;role:string;course:string})=>o.lv===a.lv&&o.role===a.role&&o.course===a.course;
const spans=(o:BoardColour,a:BoardAddress)=>o.at!==undefined&&o.at>=a.from-.01&&o.at<=a.to+.01;

/** Which colour every board takes. A single-board choice beats its row's; a later choice beats an earlier one. */
export function boardFinishPlan(data:DeckData,model:DeckTakeoff):BoardFinishPlan{
  const addresses=modelAddresses(model,{pattern:data.pattern,boardWidth:data.boardWidth,pitch:boardPitch(data)});
  const overrides=data.boardColours??[],main=deckColourRef(data),darkBorder=data.borderFinish==='Dark Slate';
  // Dark Slate borders are their own product, and a colour outside this deck's collections is not applied.
  const usable=overrides.map(o=>accentAllowed(data,o.colour)&&!(darkBorder&&o.role==='border'));
  const hit=overrides.map(()=>false);
  const colours=addresses.map(level=>level.map(a=>{
    if(!a)return null;
    let piece=-1,course=-1;
    overrides.forEach((o,i)=>{
      if(!usable[i]||!sameRow(o,a))return;
      if(o.scope==='course'){course=i;hit[i]=true;}
      else if(spans(o,a)){piece=i;hit[i]=true;}
    });
    const i=piece>=0?piece:course;
    return i<0||overrides[i].colour===main?null:overrides[i].colour;
  }));
  const byRef=new Map<ColourRef,AccentGroup>();
  colours.forEach((level,l)=>level.forEach((ref,index)=>{
    if(!ref)return;
    const parsed=parseColourRef(ref)!,group=byRef.get(ref)??{ref,...parsed,boards:[]};
    group.boards.push({level:l,index});byRef.set(ref,group);
  }));
  const groups=[...byRef.values()];
  return {addresses,colours,groups,matched:overrides.filter((_,i)=>hit[i]),unmatched:overrides.filter((_,i)=>!hit[i]),pieces:groups.reduce((n,g)=>n+g.boards.length,0)};
}

export function colourName(ref:ColourRef){const p=parseColourRef(ref);return p?`${p.color.name} (${p.material.name})`:ref;}
/** One line for the design facts, the proposal and a sent design, e.g. "Accent boards: 14 in Dark Cocoa (…)". */
export function accentWords(plan:BoardFinishPlan):string|undefined{
  if(!plan.pieces)return undefined;
  return `Accent boards: ${plan.groups.map(g=>`${g.boards.length} in ${g.color.name} (${g.material.name})`).join('; ')}`;
}
