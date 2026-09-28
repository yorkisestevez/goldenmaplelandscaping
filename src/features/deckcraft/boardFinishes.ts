import {DECKING_CATALOGUE,type CatalogueDecking} from './manufacturerCatalog';
import type {DeckTakeoff} from './deckTakeoff';
import {modelAddresses,type BoardAddress} from './lib/boardAddress';
import type {BoardColour,BoardPattern,ColourRef,DeckData,DeckInlay,MaterialColor} from './types';

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
/** Collections whose colours can finish a deck part (border, fascia, stair treads and risers; deckPartFinishes.ts): the
 * deck's own, then every other one of its kind, supplier-quote lines included (priced as a quote, never $0). */
export function partCollections(data:Pick<DeckData,'deckingMaterial'>):CatalogueDecking[]{
  const main=deckMaterial(data);
  return [main,...DECKING_CATALOGUE.filter(m=>m.id!==main.id&&!m.isHidden&&main.isComposite&&m.isComposite)];
}
export function partAllowed(data:Pick<DeckData,'deckingMaterial'>,ref:ColourRef){
  const parsed=parseColourRef(ref);return !!parsed&&partCollections(data).some(m=>m.id===parsed.material.id);
}
/** The border boards' own colour (deckFinishes.border) when this deck can take it. It replaces a Dark Slate border. */
export const borderFinishRef=(data:DeckData):ColourRef|undefined=>{const b=data.deckFinishes?.border;return b&&partAllowed(data,b)?b:undefined;};
/** Deckorators Dark Slate border boards: chosen, and not replaced by a border colour. */
export const darkSlateBorder=(data:DeckData)=>data.borderFinish==='Dark Slate'&&!borderFinishRef(data);
/** A colour that sets an inlay off: the first other colour of the deck's own collection (undefined if it has one). */
export function contrastColour(data:Pick<DeckData,'deckingMaterial'|'deckingColor'>):ColourRef|undefined{
  const own=deckMaterial(data),main=deckColourRef(data),c=own.colors.find(x=>colourRef(own.id,x.name)!==main);
  return c?colourRef(own.id,c.name):undefined;
}

export interface AccentGroup{ref:ColourRef;material:CatalogueDecking;color:MaterialColor;boards:{level:number;index:number}[]}
/** Boards bought together: an accent colour (at the deck's waste allowance), the border boards in their own colour
 * (deckFinishes.border, at the deck's allowance), or one colour of one part of the inlays at the allowance of what it
 * is: a frame is picture-frame work, an inside its own pattern, a band straight boards, and a medallion (cut to its
 * wedges and 16 sides) the herringbone allowance. */
export interface StockGroup extends AccentGroup{kind:'accent'|'inlay'|'border';wasteKey?:BoardPattern;part?:InlayPart}
export type InlayPart='frame'|'inside'|'band'|'medallion';
/** Which part of its inlay an inlay board is, and the waste allowance it is ordered at. */
export function inlayPart(inlay:DeckInlay|undefined,role:string|undefined):{part:InlayPart;wasteKey:BoardPattern}{
  if(inlay?.kind==='medallion')return {part:'medallion',wasteKey:'Herringbone'};
  if(inlay?.kind==='band')return {part:'band',wasteKey:'Straight'};
  return role==='inlay-frame'?{part:'frame',wasteKey:'Picture Frame'}:{part:'inside',wasteKey:inlay?.pattern??'Straight'};
}
export interface BoardFinishPlan{
  /** Every board's address, by model level then board (null where boards take no accent colour). */
  addresses:(BoardAddress|null)[][];
  /** Each board's accent colour, or null for the deck's own colour. */
  colours:(ColourRef|null)[][];
  /** Boards drawn in a colour other than the deck's (accents and coloured inlays), by colour. */
  groups:AccentGroup[];
  /** Boards ordered apart from the main decking: accent colours, and every inlay board (in any colour). */
  stock:StockGroup[];
  /** Saved choices that colour at least one board, and those that no longer do (never moved to another board). */
  matched:BoardColour[];unmatched:BoardColour[];
  /** Boards in an accent colour (not counting inlays or the border colour), and inlay boards. */
  pieces:number;inlayPieces:number;
  /** Border boards in the border's own colour (deckFinishes.border). */
  borderPieces:number;
}

const sameRow=(o:BoardColour,a:{lv:number;role:string;course:string})=>o.lv===a.lv&&o.role===a.role&&o.course===a.course;
const spans=(o:BoardColour,a:BoardAddress)=>o.at!==undefined&&o.at>=a.from-.01&&o.at<=a.to+.01;

/** Which colour every board takes. A single-board choice beats its row's; a later choice beats an earlier one. */
export function boardFinishPlan(data:DeckData,model:DeckTakeoff):BoardFinishPlan{
  const addresses=modelAddresses(model,{pattern:data.pattern,boardWidth:data.boardWidth,pitch:boardPitch(data)});
  const overrides=data.boardColours??[],main=deckColourRef(data),darkBorder=darkSlateBorder(data);
  // The border's own colour (deckFinishes.border) comes after a board's or row's accent choice, before the deck's.
  const border=borderFinishRef(data),borderColour=border&&border!==main?border:null,bordered=new Set<string>();
  // Dark Slate borders are their own product, and a colour outside this deck's collections is not applied.
  const usable=overrides.map(o=>accentAllowed(data,o.colour)&&!(darkBorder&&o.role==='border'));
  const hit=overrides.map(()=>false);
  // Inlay boards take their inlay's frame or fill colour (lib/inlayGeometry.ts); one this deck can't take is its own.
  const inlays=new Map((data.inlays??[]).map(i=>[i.id,i]));
  // (A band has no frame; a compass medallion's alternate wedges are 'inlay-frame' boards, in the frame colour.)
  const inlayColour=(role:string|undefined,id:string)=>{const i=inlays.get(id),ref=role==='inlay-frame'?(i&&i.kind!=='band'?i.frame:undefined):i?.fill;return ref&&ref!==main&&accentAllowed(data,ref)?ref:null;};
  const colours=addresses.map((level,l)=>level.map((a,bi)=>{
    const board=model.levels[l].boards[bi];if(board.inlay)return inlayColour(board.role,board.inlay);
    if(!a)return null;
    let piece=-1,course=-1;
    overrides.forEach((o,i)=>{
      if(!usable[i]||!sameRow(o,a))return;
      if(o.scope==='course'){course=i;hit[i]=true;}
      else if(spans(o,a)){piece=i;hit[i]=true;}
    });
    const i=piece>=0?piece:course;
    if(i>=0)return overrides[i].colour===main?null:overrides[i].colour;
    if(a.role==='border'&&borderColour){bordered.add(`${l}:${bi}`);return borderColour;}
    return null;
  }));
  const byRef=new Map<ColourRef,AccentGroup>();
  colours.forEach((level,l)=>level.forEach((ref,index)=>{
    if(!ref)return;
    const parsed=parseColourRef(ref)!,group=byRef.get(ref)??{ref,...parsed,boards:[]};
    group.boards.push({level:l,index});byRef.set(ref,group);
  }));
  const groups=[...byRef.values()],stock=new Map<string,StockGroup>();
  let pieces=0,inlayPieces=0,borderPieces=0;
  colours.forEach((level,l)=>level.forEach((ref,index)=>{
    const board=model.levels[l].boards[index];
    if(!board.inlay&&!ref)return;
    const part=board.inlay?inlayPart(inlays.get(board.inlay),board.role):undefined;
    const kind=board.inlay?'inlay' as const:bordered.has(`${l}:${index}`)?'border' as const:'accent' as const;
    const colour=ref??main,key=`${part?`${part.part}|${part.wasteKey}`:kind}|${colour}`,group=stock.get(key)??{ref:colour,...parseColourRef(colour)!,boards:[],kind,...(part?{wasteKey:part.wasteKey,part:part.part}:{})};
    group.boards.push({level:l,index});stock.set(key,group);
    if(board.inlay)inlayPieces++;else if(kind==='border')borderPieces++;else pieces++;
  }));
  return {addresses,colours,groups,stock:[...stock.values()],matched:overrides.filter((_,i)=>hit[i]),unmatched:overrides.filter((_,i)=>!hit[i]),pieces,inlayPieces,borderPieces};
}

export function colourName(ref:ColourRef){const p=parseColourRef(ref);return p?`${p.color.name} (${p.material.name})`:ref;}
/** One line for the design facts, the proposal and a sent design, e.g. "Accent boards: 14 in Dark Cocoa (…)". */
export function accentWords(plan:BoardFinishPlan):string|undefined{
  if(!plan.pieces)return undefined;
  return `Accent boards: ${plan.stock.filter(g=>g.kind==='accent').map(g=>`${g.boards.length} in ${g.color.name} (${g.material.name})`).join('; ')}`;
}
