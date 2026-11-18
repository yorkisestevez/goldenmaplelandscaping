import type {DeckData} from './types';
import {cleanPergolaQuote,pergolaQuoteKey,type PergolaQuoteContext} from './pergolaPricing';
export const PERGOLA_QUOTE_PREFIX='deckcraft.private-pergola-quote.v1.';
/** Private device storage is read only for explicit private revision capture. */
export function storedPergolaQuote(data:DeckData):PergolaQuoteContext|undefined {
 if(!data.pergola)return undefined;const key=pergolaQuoteKey(data);
 try{const text=localStorage.getItem(PERGOLA_QUOTE_PREFIX+key);if(text)return {key,quote:cleanPergolaQuote(JSON.parse(text))};}catch{/* Storage unavailable. */}
 return data.pergolaQuoteCosts?.key===key?data.pergolaQuoteCosts:undefined;
}
