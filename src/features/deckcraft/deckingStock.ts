import type {DeckData} from './types';
/** Manufacturer-listed square-edge decking lengths, checked 2026-10-04.
 * Local colour/profile inventory and prices still require supplier confirmation.
 * TimberTech: https://www.timbertech.com/product/edge-prime-plus-collection/
 * Deckorators: https://www.deckorators.com/en-ca/collections/decking/products/voyage-decking
 */
export function deckingStock(id:string,width=5.5){
 const confirmed=width===5.5&&(id==='tt_prime_plus'||id==='deck_voyage');
 const lengthsIn=confirmed?[192,240]:[id==='cedar'?144:192];
 return {lengthsIn,maxLengthIn:Math.max(...lengthsIn),confirmed};
}
/** A shared blank must fit every selected decking finish; never stretch an unverified accent product. */
export function designStockLength(data:DeckData){
 const refs=[data.deckFinishes?.border,data.deckFinishes?.treads,...(data.boardColours??[]).map(b=>b.colour),...(data.inlays??[]).flatMap(i=>[i.fill,'frame' in i?i.frame:undefined])];
 const ids=[data.deckingMaterial,...refs.filter((r):r is string=>!!r).map(r=>r.split(':')[0]),...(data.borderFinish==='Dark Slate'&&!data.deckFinishes?.border?['dark-slate']:[])];
 return Math.min(...ids.map(id=>deckingStock(id,data.boardWidth).maxLengthIn));
}
