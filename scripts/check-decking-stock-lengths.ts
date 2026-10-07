import assert from 'node:assert/strict';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {deckingStock,designStockLength,designStockLengths,productStock,STOCK_TRIM_IN} from '../src/features/deckcraft/deckingStock';
import type {DeckData} from '../src/features/deckcraft/types';
import {DECKING_STOCK_SOURCES} from '../src/features/deckcraft/deckingStockSources';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {DECKING_CATALOGUE} from '../src/features/deckcraft/manufacturerRuntimeCatalogue';
import {levelInlayContext} from '../src/features/deckcraft/lib/inlayGeometry';
import {inlayPlanLevel} from '../src/features/deckcraft/designer/inlayActions';
import {stockRowId} from '../src/features/deckcraft/schedule';
let checks=0;const ok=(cond:unknown,msg:string)=>{assert(cond,msg);checks++;};
ok(DEFAULT_DECK.pictureFrameOverhangIn===0,'New decks do not assume an unsupported border overhang');
ok(JSON.stringify(deckingStock('tt_prime_plus').lengthsIn)==='[192,240]','Prime+ lists 16 and 20 ft');
ok(!deckingStock('unknown').confirmed,'An unknown product stays an allowance');
ok(!deckingStock('tt_prime_plus',3.5).confirmed,'A narrow board is not covered by the standard-width listing');

// Every manufacturer-listed product has a dated source, and every source is used: no silent promotion.
// Freshness is measured against a pinned review date, not the wall clock, so an unchanged tree never turns red on its own.
// Re-read the listings and move this date forward when the sources are re-verified.
const SOURCES_REVIEWED_ON='2026-10-06';
const listed=Object.keys(DECKING_STOCK_SOURCES);
for(const id of listed){
  const s=DECKING_STOCK_SOURCES[id],age=(Date.parse(SOURCES_REVIEWED_ON)-Date.parse(s.verifiedOn))/864e5;
  ok(deckingStock(id).confirmed,`${id}: its source is used by the stock planner`);
  ok(/^https:\/\/www\.(timbertech|deckorators)\.com\//.test(s.sourceUrl),`${id}: the source is the manufacturer's page`);
  ok(/^\d{4}-\d{2}-\d{2}$/.test(s.verifiedOn)&&age>=0&&age<=366,`${id}: its source is dated (${s.verifiedOn}) on or within a year before the ${SOURCES_REVIEWED_ON} review`);
  ok(deckingStock(id).lengthsIn.every(n=>s.listed.includes(`${n/12}`)),`${id}: every planned length appears in the quoted listing`);
}
for(const m of DECKING_CATALOGUE)ok(deckingStock(m.id).confirmed===listed.includes(m.id),`${m.id}: confirmed only with a recorded source`);
for(const id of ['cedar','pressure_treated','tt_prime','tt_premier','tt_premier_plus','tt_terrain_plus','tt_harvest_plus','deck_summit','deck_venture','deck_altitude'])ok(!deckingStock(id).confirmed,`${id}: no manufacturer listing was read, so it stays an allowance`);
ok(deckingStock('cedar').maxLengthIn===144&&deckingStock('pressure_treated').maxLengthIn===192,'Local lumber keeps its 12 and 16 ft allowances');

// Mixed finishes use the shortest shared length; listed accents and the 21 ft Dark Slate border never shorten Prime+.
// A listed board keeps a 1/2 in end-trim margin, so its longest cut is half an inch short of the board (owner, 2026-10-06).
const CUT20=240-STOCK_TRIM_IN;
ok(designStockLength(DEFAULT_DECK)===CUT20,'New Prime+ designs cut up to 20 ft less the 1/2 in trim margin');
ok(designStockLength({...DEFAULT_DECK,deckFinishes:{border:'tt_vintage:Coastline'}})===CUT20,'A listed Vintage border keeps 20 ft stock');
ok(designStockLength({...DEFAULT_DECK,deckFinishes:{border:'tt_prime:Maritime Gray'}})===192,'An unlisted accent limits the shared length to its allowance');
ok(designStockLength({...DEFAULT_DECK,boardLayout:{regions:[],breakers:[],pieces:[{id:'p',level:1,cx:0,cy:0,lengthIn:24,widthIn:5.5,angleDeg:0,colour:'tt_prime:Maritime Gray'}]}})===192,'An unlisted custom-layout colour limits the shared length too, so no cut is left without a board');
ok(designStockLength({...DEFAULT_DECK,borderFinish:'Dark Slate'})===CUT20,'Dark Slate (21 ft) does not shorten the 20 ft field');
ok(designStockLength({...DEFAULT_DECK,deckingMaterial:'pressure_treated',borderFinish:'Dark Slate'})===192,'The field allowance still limits a Dark Slate border');
ok(designStockLength({...DEFAULT_DECK,deckingMaterial:'cedar'})===144,'Cedar plans 12 ft stock');

// The takeoff, the inlay editor and the breaker wording all use the same length.
const m=buildDeckTakeoff({...DEFAULT_DECK,width:18});
ok(m.stockLength===CUT20&&m.levels[0].breakers.length===0,'An 18 ft Prime+ deck needs no breaker');
ok(m.levels[0].boards.every(b=>b.length<=240),'No board exceeds its stock');
for(const material of ['tt_prime_plus','tt_landmark','deck_vista','pressure_treated','cedar']){
  const data={...structuredClone(DEFAULT_DECK),deckingMaterial:material,width:30},model=buildDeckTakeoff(data),level=inlayPlanLevel(model,1)!;
  ok(levelInlayContext(data,level).stockLength===model.stockLength,`${material}: the inlay editor fits pieces to the takeoff's stock length`);
  const breaker=calculateEstimate(data).breakerInfo;
  ok(!breaker||breaker.standardLength===Math.max(...designStockLengths(data))/12,`${material}: breaker wording names its longest listed board (${Math.max(...designStockLengths(data))/12} ft)`);
}

// Build rules: a design saved before 2026-10 (no marker, or 'legacy') keeps 9b2ee11's one stock length and staggered rows.
const {buildRules:_rules,...unmarked}=structuredClone(DEFAULT_DECK),legacy:DeckData={...unmarked,buildRules:'legacy'};
for(const d of [legacy,unmarked as DeckData]){
  ok(designStockLength(d)===192&&designStockLength({...d,deckingMaterial:'cedar'})===144,'Legacy designs keep 16 ft (cedar 12 ft) stock');
  ok(designStockLength({...d,borderFinish:'Dark Slate'})===192&&designStockLength({...d,deckFinishes:{border:'tt_vintage:Coastline'}})===192,'Legacy finishes never lengthen or shorten the legacy stock');
  ok(JSON.stringify(designStockLengths(d))==='[192]'&&JSON.stringify(designStockLengths({...d,deckingMaterial:'cedar'}))==='[144]','Legacy designs buy one stock length');
  ok(JSON.stringify(productStock(d,'dark-slate'))==='{"lengthsIn":[192],"trimIn":0}','Legacy designs buy every product at the legacy length, with no trim margin');
}
ok(JSON.stringify(designStockLengths(DEFAULT_DECK))==='[192,240]'&&JSON.stringify(productStock(DEFAULT_DECK,'dark-slate'))==='{"lengthsIn":[252],"trimIn":0.5}','New designs buy each product in its own listed lengths: Dark Slate only in its 21 ft board');

// Purchasing (2026-10): each packed board is bought at the SHORTEST listed length holding its cuts, the 1/8 in kerf
// between them and the 1/2 in trim margin, recomputed here from the cut groups; spares are bought at the shortest length.
const boughtAt=(lengths:number[],group:number[])=>{const used=group.reduce((n,c)=>n+c,0)+.125*(group.length-1);return [...lengths].sort((a,b)=>a-b).find(n=>n-STOCK_TRIM_IN+1e-6>=used);};
const mainRow=(d:DeckData)=>calculateEstimate(d,DECK_SETTINGS).stockSchedule[0];
for(const [width,length,rows] of [[16,12,1],[24,12,1],[20,14,1],[40,16,1],[16,12,0]] as const){
  const d:DeckData={...structuredClone(DEFAULT_DECK),width,length,pictureFrameRows:rows,stairFlights:0},row=mainRow(d),bought=row.cutsIn.map(g=>boughtAt([192,240],g)),tag=`${width}x${length} rows ${rows}`;
  ok(row.stockLengthIn===240&&bought.every(Boolean)&&JSON.stringify(row.binLengthsIn)===JSON.stringify(bought),`${tag}: every board is bought at the shortest listed length that holds it`);
  ok(Math.abs(row.orderedLf-(bought.reduce((n,l)=>n+l!,0)+(row.orderedPieces-row.cutsIn.length)*192)/12)<1e-9,`${tag}: ordered feet are the bought boards plus 16 ft spares`);
}
// The main deck no longer buys every board at 20 ft: a 24 x 12 deck's halves either side of its breaker fit 16 ft boards.
const deck24=mainRow({...structuredClone(DEFAULT_DECK),width:24,length:12,stairFlights:0});
ok(deck24.binLengthsIn!.every(l=>l===192)&&deck24.orderedLf===deck24.orderedPieces*16,`24 x 12 Prime+ orders ${deck24.orderedLf} lf of 16 ft boards, not ${deck24.orderedPieces*20} lf of 20 ft boards`);
// An exact 16 ft course (a flush 16 ft deck) has no trim margin on a 16 ft board, so it is cut from a 20 ft board, in one piece.
const flush:DeckData={...structuredClone(DEFAULT_DECK),width:16,length:12,pictureFrameRows:0,stairFlights:0},flushModel=buildDeckTakeoff(flush),flushRow=mainRow(flush);
ok(flushModel.levels[0].boards.length===26&&flushModel.levels[0].boards.every(b=>Math.abs(b.length-192)<1e-6),'A flush 16 ft deck lays every course as one 192-inch board');
ok(flushRow.binLengthsIn!.length===26&&flushRow.binLengthsIn!.every(l=>l===240),'An exact 16 ft course is bought as a 20 ft board (1/2 in trim margin)');
// The same deck under the legacy rules: 9b2ee11's staggered 16 ft rows and order (29 boards, 464 lf).
const oldFlush:DeckData={...flush,buildRules:'legacy'},oldModel=buildDeckTakeoff(oldFlush),oldRow=mainRow(oldFlush);
ok(oldModel.stockLength===192&&oldModel.levels[0].boards.length===39&&oldModel.levels[0].boards.some(b=>Math.abs(b.length-96)<.01),'Legacy rows keep the alternating half-board stagger');
ok(oldRow.stockLengthIn===192&&!oldRow.binLengthsIn&&oldRow.orderedPieces===29&&oldRow.orderedLf===464,'Legacy designs order exactly as quoted: 29 boards, 464 lf of 16 ft stock');
// Legacy stair treads keep 9b2ee11's row wording, so a saved design's cut-list row ID (F-588307 in 9b's export) is unchanged.
const treadRow=(d:DeckData)=>calculateEstimate(d,DECK_SETTINGS).stockSchedule.find(r=>r.name.startsWith('Stair tread decking'))!;
for(const material of ['tt_prime_plus','pressure_treated']){
  const d:DeckData={...structuredClone(DEFAULT_DECK),deckingMaterial:material,width:24,length:12,pictureFrameRows:0,stairFlights:1},old=treadRow({...d,buildRules:'legacy'}),now=treadRow(d);
  ok(old.section==='5.5 in decking'&&old.stockLengthIn===192&&stockRowId(old)==='F-588307',`${material}: a legacy stair tread row keeps 9b2ee11's section, length and row ID`);
  ok(now.section.startsWith('5.5 in decking · ')&&stockRowId(now)!=='F-588307',`${material}: a new design's tread row names its product and offcuts`);
}
// Dark Slate is ordered only in its listed 21 ft board.
const slate=calculateEstimate({...structuredClone(DEFAULT_DECK),width:16,length:12,pictureFrameRows:1,borderFinish:'Dark Slate',stairFlights:0},DECK_SETTINGS).stockSchedule.find(r=>r.name.startsWith('Dark Slate border'))!;
ok(slate.stockLengthIn===252&&!slate.binLengthsIn&&slate.orderedLf===slate.orderedPieces*21,'The Dark Slate border is bought in 21 ft boards only');
console.log(`Product stock lengths: ${checks} checks passed; ${listed.length} manufacturer-listed products, the rest planning allowances.`);
