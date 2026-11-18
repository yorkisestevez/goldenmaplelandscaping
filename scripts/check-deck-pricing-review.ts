import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate} from '../src/features/deckcraft/deckRelease';
import {getLightingProduct,LIGHTING_CATALOGUE} from '../src/features/deckcraft/lightingCatalogue';
import {LIGHTING_TRADE_RATES,DECKING_RATE_SOURCES,CARR_PAVER_TRADE_2026,carrPaverFreight2026} from '../src/features/deckcraft/supplierRates';
import {fasciaSupply} from '../src/features/deckcraft/fasciaPricing';
import {priceLedger} from '../src/features/deckcraft/designer/priceLedgerModel';
const close=(a:number,b:number)=>assert(Math.abs(a-b)<.001,`${a} != ${b}`);
const stair=(width:number)=>calculateDeckReleaseEstimate({...structuredClone(DEFAULT_DECK),stairWidth:width,railingType:'None'});
const base=stair(48),wide=stair(96),narrow=stair(36),stairs=(e:typeof base)=>e.sections.find(s=>s.title==='Stairs')!.total;
close(stairs(wide),stairs(base)*2);close(stairs(narrow),stairs(base)*.75);
assert(wide.total>base.total&&wide.manHours>base.manHours,'Wider stairs increase labour and price when railing is held constant');
const split=calculateDeckReleaseEstimate({...structuredClone(DEFAULT_DECK),levels:2,level2FullStep:true,height2:29,width2:16});
assert(split.model.flights.some(f=>f.kind==='connection'&&f.width>=192),'The sample actually contains a full-width connection');
assert(stairs(split)>stairs(base),'Full-width level steps must not use the narrow-stair allowance');
for(const [id,cost] of Object.entries(LIGHTING_TRADE_RATES)){
  const p=getLightingProduct(id);assert(p,`${id}: no catalogue product`);close(p.cost!,cost);assert(p.rateSource?.currency==='CAD');
}
const light=calculateDeckReleaseEstimate({...structuredClone(DEFAULT_DECK),lightingSystem:{wireDistance:0,selectedItems:[{productId:'evo_hyde_550',qty:2}]}});
const s=light.sections.find(s=>s.title==='in-lite® Lighting System')!;
close(s.total,132*2*1.35);close(s.items.reduce((n,i)=>n+(i.cost??0),0),s.total);
assert(s.items.some(i=>i.cost===null&&/installation/.test(i.name))&&light.quoteRequired.some(q=>/installation \(builder quote\)/.test(q)));
const ledger=priceLedger(light),line=ledger.lines.find(l=>l.title===s.title)!;
assert(line.amount>0&&line.quotes.includes('builder')&&line.text.includes('+ quote'),'Known supply and unknown installation are both visible');
assert(!LIGHTING_TRADE_RATES.evo_hyde&&!LIGHTING_TRADE_RATES.hyve_22,'Do not guess an ambiguous legacy fixture or ring configuration');
assert(LIGHTING_CATALOGUE.filter(p=>p.rateSource).length===Object.keys(LIGHTING_TRADE_RATES).length);
const reserve=DECKING_RATE_SOURCES.tt_reserve,terrain=DECKING_RATE_SOURCES.tt_terrain;
for(const id of ['tt_reserve','tt_terrain'] as const){
  const e=calculateDeckReleaseEstimate({...structuredClone(DEFAULT_DECK),deckingMaterial:id,boardWidth:3.5});
  close(e.sections.find(s=>s.title==='Decking')!.total,e.stockSchedule[0].orderedLf*DECKING_RATE_SOURCES[id].boardPrice/12*1.35);
  assert(e.quoteRequired.includes('Custom-width decking fabrication'),'Narrow custom cuts keep full stock supply cost and separate fabrication');
}
assert(reserve.boardPrice>terrain.boardPrice&&reserve.basis.includes('retail')&&terrain.basis.includes('retail'));
const fascia=fasciaSupply('tt_prime_plus:Coconut Husk',[{lengthIn:144,heightIn:10}],1.35)!;
assert(fascia.boards===2,'One full stock board plus the 10% order allowance rounds to a spare');close(fascia.cost,2*153.09*1.35);
const cocoa=fasciaSupply('tt_prime_plus:Dark Cocoa',[{lengthIn:144,heightIn:10}],1.35)!;
assert(cocoa.rate.sku==='TT12EDFDC'&&cocoa.boards===2,'Dark Cocoa uses its own DeckMart fascia SKU');close(cocoa.cost,2*153.09*1.35);
assert(fasciaSupply('tt_harvest:Kona',[{lengthIn:144,heightIn:10}],1.35)===null,'Never invent a fascia price for an unsourced colour');
const cladding=base.sections.find(s=>s.title==='Stair and level cladding')!;
assert(cladding.total>0&&cladding.items.every(i=>i.cost!==null)&&cladding.items.some(i=>i.name==='Stair and level cladding labour'),'Known cladding supply and finish (labour/fasteners/delivery) are priced');
close(CARR_PAVER_TRADE_2026['permacon-melville'].rate,5.22);
close(carrPaverFreight2026(120),189);close(carrPaverFreight2026(800),650);close(carrPaverFreight2026(1400),700);
console.log(`PRICING REVIEW OK: ${Object.keys(LIGHTING_TRADE_RATES).length} sourced supply rates; exact supply totals; builder quote retained; narrow, wide and full-width stair costs; retail/trade bases explicit.`);
