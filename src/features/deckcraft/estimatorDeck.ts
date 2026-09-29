import {calculateDeckReleaseEstimate,deckReleaseData} from './deckRelease';
import {DEFAULT_DECK,DECK_SETTINGS} from './defaults';
import {splitSubtotal} from './backyard';
import {describeDesign,shapeWords,type DeckEstimate} from './designFacts';
import {decodeDesignLink,designLinkFromHash,encodeDesignLink} from './designLink';
import {activeWrap} from './lib/wrapGeometry';
import {deckSizeForArea,type EstimatorDeck} from './estimatorHandoff';
import type {DeckData} from './types';

/**
 * The deck in a cost estimate, priced by the deck designer's own engine (the site's one deck price). The estimator
 * loads this module only when a backyard has a deck, so the designer's engine never weighs on its first load.
 */
const cents=(dollars:number)=>Math.round(dollars*100);

/** The deck in one line: area and shape, size, height, decking and railing. */
export function deckLabel(data:DeckData,estimate:DeckEstimate):string{
  const {material,railingName}=describeDesign(data,estimate);
  const railing=/railing/i.test(railingName)?railingName:`${railingName} railing`;
  const area=Math.round(estimate.model.quantities.area);
  return `${area} sq ft ${shapeWords(data,!!activeWrap(data)).toLowerCase()} deck, ${data.width} × ${data.length} ft, ${data.height} in above grade · ${material.name} · ${railing}`;
}

/** A design and the designer's estimate for it, as the cost estimator carries it. */
export function estimatorDeckFor(data:DeckData,estimate:DeckEstimate,source:EstimatorDeck['source'],design?:string):EstimatorDeck{
  return {
    subtotalCents:cents(estimate.subtotal),
    backyardCents:cents(splitSubtotal(estimate).backyard),
    areaSqft:Math.round(estimate.model.quantities.area),
    label:deckLabel(data,estimate),
    quoteRequired:[...(estimate.quoteRequired??[])],
    source,
    ...(design?{design}:{}),
  };
}

/** The designer's default deck at about the given area (the same deck the designer opens at for that area), priced. */
export function starterDeck(sqft:number):EstimatorDeck{
  const data=deckReleaseData({...structuredClone(DEFAULT_DECK),...deckSizeForArea(sqft)});
  return estimatorDeckFor(data,calculateDeckReleaseEstimate(data,DECK_SETTINGS),'starter');
}

/** A deck drawn in the designer, priced as the designer showed it, with the share-link payload that reopens it. */
export async function drawnDeck(data:DeckData,estimate:DeckEstimate):Promise<EstimatorDeck>{
  const link=await encodeDesignLink(data);
  return estimatorDeckFor(data,estimate,'design',designLinkFromHash(new URL(link).hash)??undefined);
}

/** A saved estimate's drawn deck, reopened from its share-link payload and priced with today's price book. */
export async function deckFromDesign(payload:string):Promise<EstimatorDeck>{
  const data=await decodeDesignLink(payload);
  return estimatorDeckFor(data,calculateDeckReleaseEstimate(data,DECK_SETTINGS),'design',payload);
}
