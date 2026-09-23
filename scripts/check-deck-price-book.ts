import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {jsPDF} from 'jspdf';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {decodeDesignLink,decodeDesignLinkFile,designLinkFromHash,designLinkJson,encodeDesignLink} from '../src/features/deckcraft/designLink';
import {ProposalSheet} from '../src/features/deckcraft/ProposalSheet';
import {buildProposalPdf} from '../src/features/deckcraft/proposalPdf';
import {PRICE_BOOK,priceBookLabel,readPriceBookVersion} from '../src/features/deckcraft/priceBook';
import {DECK_DESIGN_FIELDS,buildDeckDesignSubmission} from '../src/features/deckcraft/sendDesign';
import {CREW_DAY_RATES,DEFAULT_ENGINEERING_FEE,INLITE_PRODUCTS,LIGHTING_COSTS,MATERIAL_TIERS,PERMIT_FEES,RAILING_COSTS,STAIR_LABOR_MULTIPLIER,STAIR_TREAD_COSTS,WASTE_FACTORS} from '../src/features/deckcraft/types';
import {DECKING_CATALOGUE,MANUFACTURER_ACCESSORIES,RAILING_CATALOGUE} from '../src/features/deckcraft/manufacturerCatalog';
import {LIGHTING_CATALOGUE} from '../src/features/deckcraft/lightingCatalogue';
import {PRIVACY_PRODUCTS} from '../src/features/deckcraft/privacyScreens';

/**
 * The price book stamp: a named version that proposals, the PDF, sent designs and design links carry, and a
 * fingerprint of every rate table plus the priced total of every legacy parity scenario. A rate change fails
 * here until PRICE_BOOK names the change, so no price moves without the stamp moving with it.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

// 1. The fingerprint: numbers in every rate table (names and wording can change freely) and every priced total.
const fnv=(s:string)=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16).padStart(8,'0');};
const numbersOnly=(value:unknown)=>JSON.stringify(value,(_k,v)=>typeof v==='string'?undefined:v);
const tables={MATERIAL_TIERS,WASTE_FACTORS,CREW_DAY_RATES,PERMIT_FEES,DEFAULT_ENGINEERING_FEE,RAILING_COSTS,STAIR_LABOR_MULTIPLIER,STAIR_TREAD_COSTS,LIGHTING_COSTS,INLITE_PRODUCTS,DECKING_CATALOGUE,RAILING_CATALOGUE,MANUFACTURER_ACCESSORIES,LIGHTING_CATALOGUE,PRIVACY_PRODUCTS};
const golden=JSON.parse(read('scripts/deck-legacy-golden.json')) as Record<string,{total?:number}>;
const totals=Object.keys(golden).sort().map(k=>`${k}=${golden[k].total}`).join('|');
ok(Object.keys(golden).length>=200&&Object.values(golden).every(g=>typeof g.total==='number'),'Every legacy scenario has a priced total');
const fingerprint=fnv(`${numbersOnly(tables)}#${totals}`);
ok(fingerprint===PRICE_BOOK.fingerprint,`The price book changed: with the owner's approval, set PRICE_BOOK in src/features/deckcraft/priceBook.ts to {version:'<date of the change>',fingerprint:'${fingerprint}'} (now ${PRICE_BOOK.fingerprint}).`);
ok(readPriceBookVersion(PRICE_BOOK.version)===PRICE_BOOK.version&&priceBookLabel()===`Golden Maple price book ${PRICE_BOOK.version}`,'The version is a date and reads as the Golden Maple price book');
ok(numbersOnly({a:'x',b:1})===numbersOnly({a:'y',b:1})&&numbersOnly({b:1})!==numbersOnly({b:2}),'Renaming a product leaves the fingerprint; changing a number moves it');

// 2. Design links record the price book; older links (without one) still open, with no price-change note.
{
  const d=deckReleaseData(structuredClone(DEFAULT_DECK));
  ok((JSON.parse(designLinkJson(d)) as {priceBook?:string}).priceBook===PRICE_BOOK.version,'A link records the price book it was priced with');
  const link=await encodeDesignLink(d,'https://example.test'),opened=await decodeDesignLinkFile(designLinkFromHash(new URL(link).hash)!);
  ok(opened.priceBook===PRICE_BOOK.version&&JSON.stringify(opened.design)===JSON.stringify(await decodeDesignLink(designLinkFromHash(new URL(link).hash)!)),'Opening a link returns the design and its price book');
  const file=JSON.parse(designLinkJson(d)) as Record<string,unknown>;delete file.priceBook;
  const bytes=new TextEncoder().encode(JSON.stringify(file)),old='1j'+Buffer.from(bytes).toString('base64url');
  ok((await decodeDesignLinkFile(old)).priceBook===null,'A link from before the stamp opens with no price book');
  file.priceBook='not a date';
  ok((await decodeDesignLinkFile('1j'+Buffer.from(new TextEncoder().encode(JSON.stringify(file))).toString('base64url'))).priceBook===null,'A malformed price book is ignored');
  ok(readPriceBookVersion('2026-01-05')==='2026-01-05'&&readPriceBookVersion(20260105)===null&&readPriceBookVersion('2026-1-5')===null,'Only an ISO date is read as a version');
  const hook=read('src/features/deckcraft/designer/useDeckDesign.ts');
  ok(/priceBook&&priceBook!==PRICE_BOOK\.version\?`This design was first priced with the \$\{priceBookLabel\(priceBook\)\}; prices have changed since/.test(hook),'A link from an earlier price book says prices have changed since');
}

// 3. Proposals, the PDF and a sent design carry it.
{
  const d=deckReleaseData(structuredClone(DEFAULT_DECK)),estimate=calculateDeckReleaseEstimate(d);
  const html=renderToStaticMarkup(createElement(ProposalSheet,{data:d,estimate,facts:[],reviewItems:[],image:null,date:'September 23, 2026'}));
  ok(/<dt>Price book<\/dt><dd>/.test(html)&&html.includes(PRICE_BOOK.version),'The printable proposal shows the price book');
  const pdf=Buffer.from(buildProposalPdf(jsPDF,{data:d,estimate,facts:[],reviewItems:[],date:'September 23, 2026'},{compress:false})).toString('latin1');
  ok(pdf.includes(`price book ${PRICE_BOOK.version}`),'The PDF shows the price book next to the date');
  const out=buildDeckDesignSubmission({name:'Pat Example',email:'pat@example.ca',phone:'',address:'',notes:'',offers:false,botField:'',timeline:'',budget:'',samples:false},{data:d,estimate,summary:'Summary',reviewItems:[],link:'https://example.test/deck-designer#d=1zabc',sentAt:new Date('2026-09-23T12:00:00Z'),consent:null});
  ok((DECK_DESIGN_FIELDS as readonly string[]).includes('price_book')&&out.price_book===PRICE_BOOK.version&&out.details.includes(`Priced with the ${priceBookLabel()}.`),'A sent design carries the price book, in its own field and in details');
  ok(/<form name="deck-design"[\s\S]*?name="price_book"[\s\S]*?<\/form>/.test(read('public/__forms.html')),'The form declares price_book');
}

console.log(`DECK PRICE BOOK OK — ${PRICE_BOOK.version} (${PRICE_BOOK.fingerprint}): ${Object.keys(tables).length} rate tables and ${Object.keys(golden).length} priced scenarios fingerprinted; links, proposal, PDF and lead carry it; ${checks} checks.`);
