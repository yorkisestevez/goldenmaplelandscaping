/**
 * The deck designer is the site's one deck price (owner decision 2026-09-23). The cost estimator and the
 * home-page quick estimator never price a deck themselves: they hand it to /deck-designer with its area,
 * and the designer starts from a 4:3 deck of about that area. No imports, so the estimator stays light.
 */
export const DECK_AREA={min:100,max:2000} as const;

/** A 4:3 deck (width across the house, depth out from it) of about the given area, in whole feet. */
export function deckSizeForArea(sqft:number){
  const length=Math.min(40,Math.max(8,Math.round(Math.sqrt(sqft*3/4))));
  return {width:Math.min(60,Math.max(8,Math.round(sqft/length))),length};
}

const inRange=(sqft:unknown):sqft is number=>typeof sqft==='number'&&Number.isFinite(sqft)&&sqft>=DECK_AREA.min&&sqft<=DECK_AREA.max;

/** The deck designer, starting from the given deck area when there is one. */
export const deckDesignerHref=(sqft?:unknown)=>inRange(sqft)?`/deck-designer?sqft=${Math.round(sqft)}`:'/deck-designer';

/** The deck area handed over in a page's query string (?sqft=300), or null. */
export function readDeckArea(search:string):number|null{
  const value=new URLSearchParams(search).get('sqft');
  if(!value||!/^\d{3,4}$/.test(value))return null;
  const sqft=Number(value);
  return inRange(sqft)?sqft:null;
}
