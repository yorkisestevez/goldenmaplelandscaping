/**
 * Owner / supplier data intake for every rate still open in rateConfidence.
 * Prints a fillable worksheet (and optional JSON) — does not change the price book.
 *
 *   npm run deck:rate-intake
 *   npm run deck:rate-intake -- --json > /tmp/deck-rate-intake.json
 */
import {writeFileSync} from 'node:fs';
import {UNCONFIRMED_RAILING_LINES,RAILING_COLOURS} from '../src/features/deckcraft/deckPartFinishes';
import {RAILING_CATALOGUE} from '../src/features/deckcraft/manufacturerRuntimeCatalogue';
import {PRICE_BOOK,priceBookLabel} from '../src/features/deckcraft/priceBook';
import {unconfirmedRates} from '../src/features/deckcraft/rateConfidence';
import {DECKING_RATE_SOURCES,FASCIA_RETAIL_RATES} from '../src/features/deckcraft/supplierRates';
import {SKIRTING_RATES} from '../src/features/deckcraft/skirtingPricing';

const json=process.argv.includes('--json');
const outIdx=process.argv.indexOf('--out');
const outPath=outIdx>=0?process.argv[outIdx+1]:null;

const rates=unconfirmedRates();
const railingLines=UNCONFIRMED_RAILING_LINES.map(id=>{
  const system=RAILING_CATALOGUE.find(r=>r.id===id);
  return {id,name:system?.name??id,colours:[...(RAILING_COLOURS[id]??[])],soldInCanada:'' as ''|'yes'|'no',colourPremiumCad:'' as string|number,notes:''};
});

const intake={
  generatedOn:new Date().toISOString().slice(0,10),
  priceBook:priceBookLabel(),
  fingerprint:PRICE_BOOK.fingerprint,
  howTo:'Fill decision or supplierQuote on each item. Lock means keep the current value in the price book. Change means set newValue and run legacy parity --report before updating the golden. Supplier quotes go into Review quote costs or the private supplier ratebook CSV.',
  sourced:{
    decking:DECKING_RATE_SOURCES,
    fasciaSkuCount:Object.keys(FASCIA_RETAIL_RATES).length,
    fasciaColours:Object.keys(FASCIA_RETAIL_RATES).sort(),
    fasciaGaps:['tt_harvest:Kona','tt_vintage:Cypress','all Deckorators fascia colours'],
    skirting:SKIRTING_RATES,
  },
  items:rates.map(r=>({
    id:r.id,
    rate:r.rate,
    status:r.status,
    currentValue:r.value,
    where:r.where,
    note:r.note,
    decision:'' as ''|'lock'|'change'|'supplier-quote'|'crew-hours',
    newValue:'',
    supplier:'',
    quoteCad:'',
    effectiveDate:'',
    ownerInitials:'',
    signedOn:'',
  })),
  railingCanadaConfirm:railingLines,
  framelessGlassQuote:{
    glassPerPanelCad:'',
    shoePerLfCad:'',
    spigotEachCad:'',
    stairHandrailPerLfCad:'',
    supplier:'',
    effectiveDate:'',
    installLabour:'Glass Panels basis (20 ft / crew-day, ×1.40) — lock or replace',
  },
  labourLockIns:[
    {id:'angled-corner-labour',propose:'×1.10 one corner, ×1.25 two (reuse L-Shape / Multi-corner)',decision:''},
    {id:'porch-wrap-labour',propose:'+0.15 on one-/two-corner wrap factor',decision:''},
    {id:'inlay-labour',propose:'Breaker-board rate on frame edge + band length; pattern factor inside',decision:''},
    {id:'skirting',propose:`backing $${SKIRTING_RATES.backingPerLf}/lf, panel $${SKIRTING_RATES.accessPanelEach}, labour $${SKIRTING_RATES.labourPerLf}/lf`,decision:''},
    {id:'accent-board-labour',propose:'Crew-hours in Quote Review (no fixed book rate)',decision:''},
    {id:'medallion-labour',propose:'Crew-hours in Quote Review (no fixed book rate)',decision:''},
  ],
};

if(json||outPath){
  const body=JSON.stringify(intake,null,2);
  if(outPath)writeFileSync(outPath,body);
  if(json)console.log(body);
  else console.log(`Wrote ${outPath}`);
  process.exit(0);
}

console.log(`${intake.priceBook} (${intake.fingerprint}) — rate intake\n`);
console.log(intake.howTo);
console.log(`\nSourced fascia SKUs: ${intake.sourced.fasciaSkuCount}. Still need a quote: ${intake.sourced.fasciaGaps.join('; ')}.`);
console.log(`Terrain/Reserve decking benchmarks rechecked ${DECKING_RATE_SOURCES.tt_terrain.checkedOn} (sale prices ignored).\n`);
console.log('— Open rates —');
for(const r of intake.items){
  console.log(`\n[${r.status}] ${r.id}`);
  console.log(`  ${r.rate}: ${r.currentValue}`);
  console.log(`  ${r.note}`);
  console.log(`  decision: [ ] lock  [ ] change → ______  [ ] supplier-quote $______  [ ] crew-hours`);
  console.log(`  supplier / date / initials: ______________`);
}
console.log('\n— Unconfirmed railing lines (Canada) —');
for(const r of intake.railingCanadaConfirm){
  console.log(`  ${r.id} · ${r.name}: ${r.colours.join(', ')}`);
  console.log(`    sold in Canada? [ ] yes [ ] no    colour premium CAD: ______`);
}
console.log('\n— Frameless glass supplier quote —');
console.log('  glass / panel $______   shoe / lf $______   spigot each $______   stair handrail / lf $______');
console.log('  supplier ______________  effective ______  install labour: lock Glass Panels basis? [ ] yes [ ] replace');
console.log('\n— Labour lock-ins —');
for(const r of intake.labourLockIns)console.log(`  ${r.id}: ${r.propose}  → [ ] lock [ ] change`);
console.log('\nRefresh live DeckMart deltas: npm run deck:fetch-rates');
console.log('JSON worksheet: npm run deck:rate-intake -- --json');
