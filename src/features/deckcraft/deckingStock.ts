import type {DeckData} from './types';
import {usesCurrentBuildRules} from './buildRules';
/** Lengths the manufacturer lists for its 5.5 in standard deck board, in inches, in both grooved and square-edge
 * profiles. Sources, check dates and colour/profile exceptions are in deckingStockSources.ts (kept out of the pricing
 * worker). Local colour/profile inventory and prices still require supplier confirmation. */
const LISTED:Record<string,number[]>={tt_prime_plus:[192,240],tt_terrain:[192,240],tt_reserve:[192,240],tt_legacy:[192,240],tt_harvest:[192,240],tt_landmark:[192,240],tt_vintage:[192,240],deck_voyage:[192,240],deck_vista:[192,240],'dark-slate':[252]};
/** End-trim margin a cut keeps on a manufacturer-listed board (2026-10 rules): an exact 16 ft course is cut from a 20 ft board. */
export const STOCK_TRIM_IN=.5;
export function deckingStock(id:string,width=5.5){
 const listed=width===5.5?LISTED[id]:undefined;
 const lengthsIn=listed??[id==='cedar'?144:192];
 return {lengthsIn,maxLengthIn:Math.max(...lengthsIn),confirmed:!!listed};
}
/** A shared blank must fit every selected decking finish; never stretch an unverified accent product. */
export type StockData=Pick<DeckData,'deckingMaterial'|'boardWidth'|'deckFinishes'|'boardColours'|'inlays'|'borderFinish'|'boardLayout'|'buildRules'>;
/** Designs saved before the 2026-10 rules keep the one 16 ft (cedar 12 ft) stock length they were quoted with. */
const legacyStockLength=(data:Pick<DeckData,'deckingMaterial'>)=>data.deckingMaterial==='cedar'?144:192;
/** The longest cut a product's board yields: a listed board keeps the trim margin, an allowance length is used whole. */
const usableLength=(id:string,width:number)=>{const s=deckingStock(id,width);return s.maxLengthIn-(s.confirmed?STOCK_TRIM_IN:0);};
/** The longest cut the board layout uses (split length, breaker spacing, inlay pieces, stair treads). */
export function designStockLength(data:StockData){
 if(!usesCurrentBuildRules(data))return legacyStockLength(data);
 const layout=data.boardLayout,refs=[data.deckFinishes?.border,data.deckFinishes?.treads,...(data.boardColours??[]).map(b=>b.colour),...(data.inlays??[]).flatMap(i=>[i.fill,'frame' in i?i.frame:undefined]),...[...(layout?.regions??[]),...(layout?.breakers??[]),...(layout?.pieces??[])].map(r=>r.colour)];
 const ids=[data.deckingMaterial,...refs.filter((r):r is string=>!!r).map(r=>r.split(':')[0]),...(data.borderFinish==='Dark Slate'&&!data.deckFinishes?.border?['dark-slate']:[])];
 return Math.min(...ids.map(id=>usableLength(id,data.boardWidth)));
}
/** What a product's cuts are bought from: its listed board lengths (ascending) and the end-trim margin each cut keeps.
 * Legacy designs buy every product at the single legacy length with no margin, exactly as they were quoted. */
export function productStock(data:StockData,id:string):{lengthsIn:number[];trimIn:number}{
 if(!usesCurrentBuildRules(data))return {lengthsIn:[legacyStockLength(data)],trimIn:0};
 const s=deckingStock(id,data.boardWidth);
 return {lengthsIn:[...s.lengthsIn].sort((a,b)=>a-b),trimIn:s.confirmed?STOCK_TRIM_IN:0};
}
/** The main decking product's board lengths, ascending: legacy [192] (cedar [144]); a listed product all its lengths. */
export const designStockLengths=(data:StockData):number[]=>productStock(data,data.deckingMaterial).lengthsIn;
