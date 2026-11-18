import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate as calculate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {estimateConfidence,materialMarginPercent,priceStatus} from '../src/features/deckcraft/designer/estimateConfidence';
const a=calculate(structuredClone(DEFAULT_DECK)),b=calculate({...structuredClone(DEFAULT_DECK),width:24,length:20});
const c=estimateConfidence(a),d=estimateConfidence(b);
assert.notEqual(a.subtotal,b.subtotal);assert.notEqual(a.manHours,b.manHours);
assert.notDeepEqual(c.stock.map(r=>r.orderedLf),d.stock.map(r=>r.orderedLf));
assert(Math.abs(c.totals.allowance+c.totals.confirmed-a.subtotal)<.01);
assert.equal(c.totals.confirmed,0);assert.equal(c.pending,a.quoteRequired.length);
for(const r of c.stock)assert(r.extraLf>=0);
assert.equal(priceStatus({name:'x',spec:'',qty:1,unit:'ea',cost:null}),'pending');
assert.equal(priceStatus({name:'x',spec:'',qty:1,unit:'ea',cost:100}),'allowance');
assert.equal(priceStatus({name:'x',spec:'',qty:1,unit:'ea',cost:null,quoteResolved:true}),'confirmed');
assert.equal(materialMarginPercent(0),0);assert.equal(materialMarginPercent(100),50);assert.equal(materialMarginPercent(NaN),null);
assert(Math.abs(materialMarginPercent(35)!-25.9259259)<.0001);
console.log('Live estimate: quantities, labour, reconciliation, statuses and material margin passed.');

const override=calculate({...structuredClone(DEFAULT_DECK),customOverrides:{'Installation Labour':{qty:0,cost:1234}}});
const overrideConfidence=estimateConfidence(override);assert(Math.abs(overrideConfidence.totals.allowance+overrideConfidence.totals.confirmed-override.subtotal)<.01);

const {quoteScopeReview}=await import('../src/features/deckcraft/designer/quoteReviewModel');
const {confirmQuoteScope}=await import('../src/features/deckcraft/quoteResolutionValidation');
const design=deckReleaseData(structuredClone(DEFAULT_DECK)),scope=quoteScopeReview(design,a).scopes[0];
const record=confirmQuoteScope(scope,{supplyCost:100,installationCost:50,confirmedOn:'2026-10-03',source:'Test supplier',note:'Additional test scope only'});
const confirmed=calculate({...design,quoteResolutions:[record]}),confirmedCost=estimateConfidence(confirmed);
assert(Math.abs(confirmedCost.totals.confirmed-(100*(1+(design.materialMarkup??35)/100)+50))<.01);
assert(Math.abs(confirmedCost.totals.confirmed+confirmedCost.totals.allowance-confirmed.subtotal)<.01);
const changedQuote=calculate({...design,width:24,length:20,quoteResolutions:[record]});assert.equal(estimateConfidence(changedQuote).totals.confirmed,0);assert.equal(changedQuote.quoteResolutionReview?.inactive,1);
console.log('Confirmed scope totals and stale quote invalidation passed.');

// Honest pricing in every output: decking delivery is listed for a supplier quote once and never priced; ledger lines
// say allowance until a quote is recorded; the CSV keeps allowance, confirmed and quote-required apart; the default
// one-row picture frame reaches the proposal's finishes.
const {DECKING_DELIVERY_QUOTE}=await import('../src/features/deckcraft/calculations');
const {priceLedger,lineBasis}=await import('../src/features/deckcraft/designer/priceLedgerModel');
const {exportDeckCsv}=await import('../src/features/deckcraft/cadExports');
const {proposalFinishes}=await import('../src/features/deckcraft/proposalModel');
assert.equal(a.quoteRequired.filter(q=>q===DECKING_DELIVERY_QUOTE).length,1);
const delivery=a.sections.flatMap(s=>s.items).filter(i=>i.name===DECKING_DELIVERY_QUOTE);
assert.equal(delivery.length,1);assert.equal(delivery[0].cost,null);
const ledgerA=priceLedger(a),deckLine=ledgerA.lines.find(l=>l.title==='Decking')!;
assert.equal(lineBasis(deckLine),'Planning allowance');assert(deckLine.text.endsWith('+ quote'));
assert(ledgerA.lines.every(l=>l.amount<.005?lineBasis(l)===null:lineBasis(l)!==null));
const confirmedLedger=priceLedger(confirmed);assert(confirmedLedger.lines.some(l=>lineBasis(l)==='Confirmed'||l.items.some(i=>i.status==='confirmed')));
const materials=exportDeckCsv(a,'materials');
assert(materials.includes('"allowance"')&&materials.includes('"quote required"')&&!materials.includes('"priced"'));
assert(exportDeckCsv(confirmed,'materials').includes('"confirmed"'));
assert.equal(DEFAULT_DECK.pattern,'Straight');assert(DEFAULT_DECK.pictureFrameRows>0);
assert(proposalFinishes(DEFAULT_DECK,a.model).some(t=>t.uses.includes('Border')),'The default one-row picture frame is listed in the proposal finishes');
assert(!proposalFinishes({...structuredClone(DEFAULT_DECK),pictureFrameRows:0},a.model).some(t=>t.uses.includes('Border')));
console.log('Honest pricing: decking delivery quoted once, allowance/confirmed line basis, three CSV statuses and the default border passed.');
