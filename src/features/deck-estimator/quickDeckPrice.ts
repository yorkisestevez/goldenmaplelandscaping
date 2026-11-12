import engineBaseline from '../../data/engine-baseline.json';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../deckcraft/deckRelease';
import {NEW_DECK,DECK_SETTINGS} from '../deckcraft/defaults';
import {decodeDesignLink} from '../deckcraft/designLink';
import {drawnDeck,estimatorDeckFor} from '../deckcraft/estimatorDeck';
import type {EstimatorDeck} from '../deckcraft/estimatorHandoff';
import type {DeckData} from '../deckcraft/types';
import {QUICK_MATERIALS,normalizeQuickDeck,type QuickDeck} from './quickDeck';

/**
 * The light deck estimator's price: its choices made into the designer's own design (the patch each of the designer's
 * editors applies, on the designer's new deck) and priced by the designer's engine, so the site still has one deck
 * price. The estimator loads this module beside the form; it is the same engine a full backyard's deck already uses.
 */
const HST_RATE=engineBaseline.facts.hstRate;

/** The deck as the designer would hold it. */
export function quickDeckData(q:QuickDeck):DeckData{
  const {width,length,height,deckType,material,railing,stairs,skirting,removeOld,border}=normalizeQuickDeck(q);
  const colour=QUICK_MATERIALS.find(m=>m.id===material)!.colour;
  const deck:DeckData={
    ...structuredClone(NEW_DECK),width,length,height,deckType,
    deckingMaterial:material,deckingColor:colour,
    railingType:railing,catalogueRailingId:undefined,
    stairFlights:stairs,hasDemo:removeOld,
    pictureFrameRows:border?1:0,...(border?{}:{borderFinish:'Matching' as const}),
  };
  if(!skirting)delete deck.skirting;
  return deckReleaseData(deck);
}

export interface QuickDeckPrice{
  /** The deck as the cost estimate carries it (subtotal before HST, label, what is left to a quote). */
  deck:EstimatorDeck;
  hstCents:number;
  totalCents:number;
}

/** The deck's price: the engine's subtotal, HST on it and the total, in cents. */
export function priceQuickDeck(q:QuickDeck):QuickDeckPrice{
  const data=quickDeckData(q);
  const deck=estimatorDeckFor(data,calculateDeckReleaseEstimate(data,DECK_SETTINGS),'design');
  const hstCents=Math.round(deck.subtotalCents*HST_RATE);
  return {deck,hstCents,totalCents:deck.subtotalCents+hstCents};
}

/** The deck handed to an estimate or a saved link: priced as shown, with the designer's share link that reopens it. */
export async function quickDeckWithLink(q:QuickDeck):Promise<EstimatorDeck>{
  const data=quickDeckData(q);
  return drawnDeck(data,calculateDeckReleaseEstimate(data,DECK_SETTINGS));
}

/** The nearest light deck to a designer design: its outer size, nearest height, and its choices where the form has them. */
export function quickDeckFromData(data:DeckData):QuickDeck{
  return normalizeQuickDeck({
    width:data.width,length:data.length,height:data.height,
    deckType:data.deckType==='Attached'?'Attached':'Freestanding',
    material:data.deckingMaterial,railing:data.railingType as QuickDeck['railing'],
    stairs:data.stairFlights as QuickDeck['stairs'],
    skirting:!!data.skirting,removeOld:!!data.hasDemo,border:(data.pictureFrameRows??0)>0,
  });
}

/**
 * A deck link (`#d=…`, from this form, a saved estimate or the designer) as the form's choices. `exact` is false when the
 * design holds more than the form can show (another shape, levels, height, railing, materials or backyard), which the
 * form then tells the visitor: its price is for the nearest deck, not the linked one. Rejects a link that is not a deck.
 */
export async function openDesign(payload:string):Promise<{deck:QuickDeck;exact:boolean}>{
  const data=await decodeDesignLink(payload),deck=quickDeckFromData(data);
  const linked=estimatorDeckFor(data,calculateDeckReleaseEstimate(data,DECK_SETTINGS),'design');
  return {deck,exact:priceQuickDeck(deck).deck.subtotalCents===linked.subtotalCents};
}
