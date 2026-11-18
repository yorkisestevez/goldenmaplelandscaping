/**
 * The deck designer's engine is the site's one deck price (owner decision 2026-09-23). The cost estimator never prices a
 * deck with a rate of its own: it opens the light deck estimator inside itself (/cost-estimator?type=deck,
 * features/deck-estimator), which prices with that engine, and a full backyard carries that deck (estimatorDeck.ts,
 * loaded on demand). The 3D designer itself is the owner's private tool (local builds only, owner decision 2026-11-11);
 * it still takes a deck area and starts from a 4:3 deck of about that area. No imports, so the estimator stays light.
 */
export const DECK_AREA={min:100,max:2000} as const;

/** A 4:3 deck (width across the house, depth out from it) of about the given area, in whole feet. */
export function deckSizeForArea(sqft:number){
  const length=Math.min(40,Math.max(8,Math.round(Math.sqrt(sqft*3/4))));
  return {width:Math.min(60,Math.max(8,Math.round(sqft/length))),length};
}

const inRange=(sqft:unknown):sqft is number=>typeof sqft==='number'&&Number.isFinite(sqft)&&sqft>=DECK_AREA.min&&sqft<=DECK_AREA.max;

/** The cost estimator with the deck estimator open inside it, starting from the given deck area when there is one. */
export const estimatorDeckHref=(sqft?:unknown)=>inRange(sqft)?`/cost-estimator?type=deck&sqft=${Math.round(sqft)}`:'/cost-estimator?type=deck';

/** The address hash that opens a drawn deck in the designer (designLink.ts reads `#d=`, its DESIGN_LINK_PARAM). */
export const designHash=(payload:string)=>`#d=${payload}`;

/** The deck link in an address hash, read as designLink.ts reads it, or null. */
export function designFromHash(hash:string):string|null{
  return new URLSearchParams(hash.replace(/^#/,'')).get('d')||null;
}

/** The deck area handed over in a page's query string (?sqft=300), or null. */
export function readDeckArea(search:string):number|null{
  const value=new URLSearchParams(search).get('sqft');
  if(!value||!/^\d{3,4}$/.test(value))return null;
  const sqft=Number(value);
  return inRange(sqft)?sqft:null;
}

/** The deck a cost estimate carries, exactly as the deck designer priced it (built by estimatorDeck.ts). */
export interface EstimatorDeck{
  /** The designer's priced portion before HST, in cents. */
  subtotalCents:number;
  /** The part of it for backyard features drawn in the designer (patios, walls, water features), in cents. */
  backyardCents:number;
  /** Deck area as modelled, in square feet. */
  areaSqft:number;
  /** The deck in one line: size, height, decking and railing. */
  label:string;
  /** What the designer leaves to a supplier quote; none of it is in the price. */
  quoteRequired:string[];
  /** 'starter': a plain 4:3 deck of the estimate's area. 'design': the deck the visitor set in the deck estimator (or, in older estimates, drew in the 3D designer). */
  source:'starter'|'design';
  /** The deck's share-link payload (the designer's #d=…), so a saved estimate reopens that exact deck. */
  design?:string;
}
