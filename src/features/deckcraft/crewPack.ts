import {zipSync,strToU8} from 'fflate';
import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import {exportDeckCsv} from './cadExports';
import {deckReleaseData} from './deckRelease';
import {PRICE_BOOK} from './priceBook';
import type {EstimateResult} from './calculations';

/** One ZIP for the crew: cut list, connectors, materials, and a short build readme from the priced model. */
export function buildCrewPackZip(data:DeckData,estimate:EstimateResult,meta:{date:string;materialName:string;railingName:string}):Uint8Array{
  const model=estimate.model as DeckTakeoff;
  const released=deckReleaseData(data);
  const cuts=exportDeckCsv(estimate,'cuts');
  const connectors=exportDeckCsv(estimate,'connectors');
  const materials=exportDeckCsv(estimate,'materials');
  const readme=[
    `Golden Maple · DeckCraft crew pack`,
    `Date: ${meta.date}`,
    `Price book: ${PRICE_BOOK.version}`,
    `Deck: ${data.width} × ${data.length} ft · ${meta.materialName} · ${data.deckingColor??''}`,
    `Railing: ${meta.railingName}`,
    `Customer: ${data.customerName||'(not set)'}`,
    `Address: ${data.projectAddress||'(not set)'}`,
    '',
    'Contents',
    '- golden-maple-deck-cuts.csv — stock cut list (inches)',
    '- golden-maple-deck-connectors.csv — hardware schedule',
    '- golden-maple-deck-materials.csv — material takeoff',
    '',
    'Open the permit drawings PDF from the designer (Proposal → Permit drawings) and keep it with this pack on site.',
    'Quantities follow the modeled design; confirm stock lengths and bearing with the lead carpenter before cutting.',
  ].join('\n');
  const files:Record<string,Uint8Array>={
    'README.txt':strToU8(readme),
    'golden-maple-deck-cuts.csv':strToU8(typeof cuts==='string'?cuts:String(cuts)),
    'golden-maple-deck-connectors.csv':strToU8(typeof connectors==='string'?connectors:String(connectors)),
    'golden-maple-deck-materials.csv':strToU8(typeof materials==='string'?materials:String(materials)),
    'design-stamp.json':strToU8(JSON.stringify({priceBook:PRICE_BOOK.version,width:released.width,length:released.length,levels:released.levels,pattern:released.pattern,wrap:released.wrap??null},null,2)),
  };
  void model;
  return zipSync(files,{level:6});
}
