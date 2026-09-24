import {colourName,deckColourRef,parseColourRef,partAllowed} from './boardFinishes';
import {RAILING_CATALOGUE,type CatalogueRailing} from './manufacturerCatalog';
import type {ColourRef,DeckData,DeckFinishes} from './types';

/**
 * Deck-part finishes: the border boards, the fascia over the rim, and the stair treads and risers, each in a real
 * product colour of the deck's own kind (partCollections in boardFinishes.ts: composite with composite; a wood deck
 * keeps its species), and the railing in one of its system's manufacturer colours. All optional: a design without
 * `deckFinishes` prices, saves and draws exactly as before.
 * - Border: its boards are ordered as their own stock at their collection's rate (boardFinishPlan), in place of Dark Slate.
 * - Fascia: fascia boards over the exposed rim are a supplier quote (the price book has no fascia rate); a chosen
 *   manufacturer fascia takes the colour instead.
 * - Treads and risers: the per-riser stair allowance takes the dearest category of the two (stairTreadKey); a line
 *   without a rate makes the Stairs section a supplier quote.
 * - Railing colour: from railing-finish-provenance.json (the owner approved the list on 2026-09-23). The rate is unchanged;
 *   the supplier confirms availability and any colour premium. The screen colour is illustrative only.
 */
export const DECK_PARTS=['border','fascia','treads','risers'] as const;
export type DeckPart=(typeof DECK_PARTS)[number];
export const PART_NAMES:Record<DeckPart,string>={border:'border boards',fascia:'fascia',treads:'stair treads',risers:'stair risers'};
/** A part's own colour, when it is set and this deck can take it (otherwise the part is in the deck's colour). */
export function partRef(data:DeckData,part:DeckPart):ColourRef|undefined{const r=data.deckFinishes?.[part];return r&&partAllowed(data,r)?r:undefined;}

const CLASSIC=['White','Matte White','Matte Black','Matte Espresso'],IMPRESSION=['White','Black','Dark Bronze'],TEXTURED=['Textured Black','Textured White'];
/** Each manufacturer railing system's rail and post colour names, in the manufacturer's order (railing-finish-provenance.json,
 * which scripts/check-deck-part-finishes.ts holds this table to, system by system). Listed in RAILING_CATALOGUE's order:
 * TimberTech Classic Composite (balusters, cable, glass), Impression Rail Express (balusters, cable, glass), Pinnacle,
 * Statement, Fulton, Reliance, Advantage; Deckorators Contemporary, Rapid Rail, Pre-assembled, Composite, Classic
 * Composite, Contemporary Composite, Contemporary Cable, Glass. Their screen colours are in railingScreenColours.ts. */
export const RAILING_COLOURS:Record<string,readonly string[]>=Object.fromEntries(([
  CLASSIC,CLASSIC,CLASSIC,IMPRESSION,IMPRESSION,IMPRESSION,['White'],['White'],['Black'],['Matte White','Khaki'],['Matte White','Matte Black','Matte Espresso'],
  ['Bronze',...TEXTURED],TEXTURED,['Matte Black','Textured White'],['White'],['White'],['Black','White','Gray','Brown'],[...TEXTURED,'Bronze'],['Textured Black'],
] as string[][]).map((names,i)=>[RAILING_CATALOGUE[i].id,names]));
/** Lines not confirmed as sold in Canada. The owner chose to offer them (2026-09-23); a colour on one asks the supplier. */
export const UNCONFIRMED_RAILING_LINES=['tt_pinnacle','tt_statement','tt_fulton','tt_reliance','tt_advantage','dk_preassembled','dk_classic_composite','dk_contemporary_composite'];
export const railingColours=(id?:string):readonly string[]=>id&&Object.hasOwn(RAILING_COLOURS,id)?RAILING_COLOURS[id]:[];
/** The railing colour in force: a colour (name) of the design's manufacturer railing system. */
export function railingFinish(data:DeckData):{system:CatalogueRailing;colour:string;unconfirmed:boolean}|null{
  const colour=data.deckFinishes?.railingColor,system=colour?RAILING_CATALOGUE.find(r=>r.id===data.catalogueRailingId):undefined;
  return system&&railingColours(system.id).includes(colour!)?{system,colour:colour!,unconfirmed:UNCONFIRMED_RAILING_LINES.includes(system.id)}:null;
}

/**
 * Drops, quietly, a part colour this deck can no longer take (its decking changed kind) and a railing colour its
 * railing no longer offers (another system, or none); a border colour replaces a Dark Slate border. Loading and every
 * edit run it (pruneEdgeNames), so nothing the controls no longer show stays in force. Nothing set, nothing kept.
 */
export function pruneDeckFinishes(data:DeckData):DeckData{
  const f=data.deckFinishes;if(!f)return data;
  const next:DeckFinishes={};
  for(const part of DECK_PARTS){const r=partRef(data,part);if(r)next[part]=r;}
  if(railingFinish(data))next.railingColor=f.railingColor;
  const slate=!!next.border&&data.borderFinish==='Dark Slate',keys=Object.keys(next);
  if(!slate&&keys.length&&keys.length===Object.keys(f).length&&keys.every(k=>next[k as keyof DeckFinishes]===f[k as keyof DeckFinishes]))return data;
  const {deckFinishes:_finishes,...rest}=data;
  return {...rest,...(keys.length?{deckFinishes:next}:{}),...(slate?{borderFinish:'Matching' as const}:{})};
}

/** A decking collection's per-riser stair category in STAIR_TREAD_COSTS. */
export const treadCategory=(m:{id:string;isComposite:boolean})=>m.isComposite?'composite':m.id==='cedar'?'cedar':'pine';
/** The per-riser stair allowance's category when the treads and risers may have their own finishes: the dearest of the
 * two parts' categories, a part without a finish being the deck's (`deckKey`). */
export function stairTreadKey(deckKey:string,parts:(ColourRef|undefined)[],costs:Record<string,number>):string{
  const rate=(k:string)=>costs[k]||24;
  return parts.map(r=>{const p=r?parseColourRef(r):null;return p?treadCategory(p.material):deckKey;}).reduce((a,b)=>rate(b)>rate(a)?b:a);
}

/** Part colours to bring as samples: each in its own collection's words, apart from the deck's own colour. */
export function partSamples(data:DeckData):string[]{
  const main=deckColourRef(data);
  return [...new Set(DECK_PARTS.map(p=>partRef(data,p)).filter((r):r is ColourRef=>!!r&&r!==main).map(colourName))];
}
/** Words for the design facts and the proposal, e.g. "Deck parts: fascia in Dark Cocoa (TimberTech EDGE Prime+)". */
export function partWords(data:DeckData):string[]{
  const parts=DECK_PARTS.flatMap(p=>{const r=partRef(data,p);return r?[`${PART_NAMES[p]} in ${colourName(r)}`]:[];}),rail=railingFinish(data);
  return [...(parts.length?[`Deck parts: ${parts.join('; ')}`]:[]),...(rail?[`Railing colour: ${rail.colour} (${rail.system.name}); screen colour illustrative`]:[])];
}
