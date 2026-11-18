import {zipSync,strToU8} from 'fflate';
import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import {exportDeckCsv} from './cadExports';
import {deckReleaseData} from './deckRelease';
import {PRICE_BOOK} from './priceBook';
import type {EstimateResult} from './calculations';

export type CrewPackMeta={date:string;materialName:string;railingName:string;reviewItems?:readonly string[]};

/** One ZIP for the crew: cut list, connectors, materials, permit drawings, and a short build readme. */
export async function buildCrewPackZip(data:DeckData,estimate:EstimateResult,meta:CrewPackMeta):Promise<Uint8Array>{
  const model=estimate.model as DeckTakeoff;
  const released=deckReleaseData(data);
  const cuts=exportDeckCsv(estimate,'cuts');
  const connectors=exportDeckCsv(estimate,'connectors');
  const materials=exportDeckCsv(estimate,'materials');
  const [{buildPermitSet},{buildPermitDxf},{jsPDF},{buildPermitPdf}]=await Promise.all([
    import('./drawings/permitSheets'),
    import('./drawings/renderDxf'),
    import('jspdf'),
    import('./drawings/renderPdf'),
  ]);
  const set=buildPermitSet({
    data,model,reviewItems:[...(meta.reviewItems??estimate.flags??[])],
    materialName:meta.materialName,railingName:meta.railingName,date:meta.date,priceBook:PRICE_BOOK.version,
  });
  const permitPdf=new Uint8Array(buildPermitPdf(jsPDF,set));
  const permitDxf=strToU8(buildPermitDxf(set));
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
    '- golden-maple-deck-permit-drawings.pdf — planning permit set (11 × 17)',
    '- golden-maple-deck-permit-plans.dxf — layered CAD plans',
    '- design-stamp.json — price book and geometry stamp',
    '',
    'Quantities follow the modeled design; confirm stock lengths and bearing with the lead carpenter before cutting.',
    'The municipality’s review decides what may be built. Keep this pack with the job on site.',
  ].join('\n');
  const files:Record<string,Uint8Array>={
    'README.txt':strToU8(readme),
    'golden-maple-deck-cuts.csv':strToU8(typeof cuts==='string'?cuts:String(cuts)),
    'golden-maple-deck-connectors.csv':strToU8(typeof connectors==='string'?connectors:String(connectors)),
    'golden-maple-deck-materials.csv':strToU8(typeof materials==='string'?materials:String(materials)),
    'golden-maple-deck-permit-drawings.pdf':permitPdf,
    'golden-maple-deck-permit-plans.dxf':permitDxf,
    'design-stamp.json':strToU8(JSON.stringify({priceBook:PRICE_BOOK.version,width:released.width,length:released.length,levels:released.levels,pattern:released.pattern,wrap:released.wrap??null},null,2)),
  };
  void model;
  return zipSync(files,{level:6});
}
