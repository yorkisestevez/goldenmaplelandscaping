import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {getHardwareLayout} from '../src/features/deckcraft/hardwareLayout';
import {planStock,deckBoardStock} from '../src/features/deckcraft/stockPlan';
import type {DeckData} from '../src/features/deckcraft/types';
const ref=readFileSync('src/features/deckcraft/referenceConstruction.ts','utf8');
for(const commercial of ['class PriceBook','function computeQuote','function quickPrice','price-book/v1','foundSale','costPerSqft'])assert(!ref.includes(commercial),`Reference price leak: ${commercial}`);
let cases=0;
for(const width of [8,16,24,30,40])for(const length of [8,12,24])for(const deckType of ['Attached','Freestanding'] as const)for(const pattern of ['Straight','Picture Frame','Diagonal'] as const){
 const d:DeckData={...structuredClone(DEFAULT_DECK),width,length,deckType,pattern};
 const model=buildDeckTakeoff(d),q=model.quantities,estimate=calculateEstimate(d,DECK_SETTINGS),stock=deckBoardStock(model,1.1),hardware=getHardwareLayout(d,model);
 assert.equal(q.footings,model.levels.flatMap(l=>l.supports).length);
 assert.equal(q.joists,model.levels.flatMap(l=>l.joists).length);
 assert.equal(q.stringers,model.stringers.length);
 assert.equal(q.stairTreads,model.treads.length);
 assert(model.levels.every(l=>l.boards.every(b=>b.length>0&&b.length<=model.stockLength+.001)));
 assert.equal(stock.unresolved.length,0);
 assert(stock.orderedLf>=stock.installedLf);
 assert(stock.bins.every(b=>b.usedIn<=b.lengthIn+.001));
 assert(Number.isFinite(estimate.total)&&estimate.total>0);
 assert(Math.abs(estimate.total-estimate.sections.reduce((n,s)=>n+s.total,0))<.001);
 const footing=estimate.sections.find(s=>s.title==='Foundation & Footings')!;assert.equal(footing.items[0].qty,q.footings);
 const hangers=estimate.sections.find(s=>s.title==='Hardware & Fasteners')!.items.find(i=>i.name==='Joist Hangers')!;assert.equal(hangers.qty,hardware.hangers.length);
 assert(Math.abs(Number(hangers.cost)-hardware.hangers.length*4.5*1.35)<.001,'Deck Craft Pro hanger rate preserved');
 assert.equal(model.levels[0].supports.length,model.levels[0].reference.posts.length);
 cases++;
}
assert.equal(planStock([100,100],192).bins.length,2);
assert.equal(planStock([96,96],192).bins.length,2,'Kerf prevents an impossible exact double cut');
assert.equal(planStock([192],192).bins.length,1);
assert.deepEqual(planStock([240],192).unresolved,[240]);
const base=buildDeckTakeoff({...DEFAULT_DECK,width:16,length:12});assert.equal(base.quantities.footings,3);assert.equal(base.quantities.stringers,6);assert.equal(base.quantities.stairTreads,4);
const wide=buildDeckTakeoff({...DEFAULT_DECK,width:30,length:12});assert(wide.quantities.breakerBoards>0);assert(wide.levels[0].joists.length>wide.levels[0].reference.jCount);
console.log(`DECK CONSTRUCTION OK — ${cases} geometry/quantity/price scenarios, stock/kerf checks, no reference prices imported.`);

