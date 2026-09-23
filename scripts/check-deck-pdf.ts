import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {jsPDF} from 'jspdf';
import {BUSINESS,publicContact} from '../src/data/business';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {describeDesign,dollars} from '../src/features/deckcraft/designFacts';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {MANUFACTURER_ACCESSORIES,RAILING_CATALOGUE} from '../src/features/deckcraft/manufacturerCatalog';
import {buildProposalPdf,pdfText,PROPOSAL_PDF_NAME} from '../src/features/deckcraft/proposalPdf';
import {ATTACH_PROPOSAL_PDF} from '../src/features/deckcraft/sendDesign';
import type {DeckData} from '../src/features/deckcraft/types';
import {designerSource} from './deck-designer-source';

/**
 * The proposal PDF says what the printable proposal says: the same facts, estimate and supplier-quote
 * wording, contact details only from business.ts, no unapproved claims, and it survives any design.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const root=new URL('../',import.meta.url),read=(path:string)=>readFileSync(new URL(path,root),'utf8');
const house=getHouseConfig({...structuredClone(DEFAULT_DECK),width:20});
const design=(patch:Partial<DeckData>={}):DeckData=>deckReleaseData({...structuredClone(DEFAULT_DECK),...patch});
/** A 2 × 2 RGB PNG made here, standing in for the snapshot, plan and logo pictures. */
function testPng():string{
  const crc32=(buf:Buffer)=>{let c=~0;for(const byte of buf){c^=byte;for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return (~c)>>>0;};
  const chunk=(type:string,data:Buffer)=>{const body=Buffer.concat([Buffer.from(type,'ascii'),data]),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(body));return Buffer.concat([len,body,crc]);};
  const header=Buffer.alloc(13);header.writeUInt32BE(2,0);header.writeUInt32BE(2,4);header[8]=8;header[9]=2;
  const pixels=Buffer.from([0,200,120,40,90,60,30,0,40,40,40,250,245,236]);
  return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}
const PNG=testPng();
/** The text drawn in an uncompressed jsPDF file, one string per Tj operator. */
function drawn(pdf:string):string[]{
  return [...pdf.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map(m=>m[1].replace(/\\([0-7]{3})/g,(_,o)=>String.fromCharCode(parseInt(o,8))).replace(/\\([()\\])/g,'$1'));
}
function build(d:DeckData,extra:{snapshot?:string|null;plan?:string|null;logo?:string|null}={}){
  const estimate=calculateDeckReleaseEstimate(d),{proposalFacts}=describeDesign(d,estimate);
  const bytes=Buffer.from(buildProposalPdf(jsPDF,{data:d,estimate,facts:proposalFacts,reviewItems:estimate.flags,date:'September 22, 2026',...extra},{compress:false}));
  const raw=bytes.toString('latin1'),strings=drawn(raw);
  // Footers are drawn onto each page after its body, so body text that runs across a page break is
  // matched without them; the footer lines are checked on their own.
  const footer=(s:string)=>/^Page \d+ of \d+$/.test(s)||s.startsWith(`${BUSINESS.publicName.value}  `);
  const text=strings.filter(s=>!footer(s)).join(' ').replace(/\s+/g,' '),footers=strings.filter(footer).join(' ');
  return {bytes,raw,strings,text:`${text} ${footers}`,body:text,footers,estimate,facts:proposalFacts,pages:(raw.match(/\/Type \/Page\b/g)??[]).length};
}
const has=(text:string,phrase:string)=>text.includes(pdfText(phrase).replace(/\s+/g,' '));

const designs:Record<string,DeckData>={
  default:design(),
  named:design({customerName:'Pat Example',projectAddress:'1 Sample Road, Barrie'}),
  wrapPorch:design({width:22,length:12,height:36,houseConfig:{...house,widthFt:26,depthFt:22},wrap:{left:{widthFt:8,runFt:8},right:{widthFt:8,runFt:8},porchLeft:{depthFt:8,runFt:14}}}),
  bumpGarage:design({width:30,length:16,houseConfig:{...house,widthFt:30,depthFt:24,floorHeightIn:40,footprint:{rects:[{id:'bump1',kind:'house',wall:'Front',offsetFt:8,widthFt:10,depthFt:4},{id:'garage1',kind:'garage',wall:'Left',offsetFt:-6,widthFt:20,depthFt:22}]}}}),
  threeLevels:design({levels:3,height:60,height2:36,width2:14,length2:10,level3:{widthFt:10,lengthFt:8,heightIn:12,parent:2,position:'Front',offsetPct:40},privacyScreens:[{id:'s1',side:'Left',lengthFt:8,heightFt:6,offsetPct:30,lights:true}],autoLighting:{posts:true,stairs:true}}),
  quotes:design({catalogueRailingId:RAILING_CATALOGUE[0].id,railingType:RAILING_CATALOGUE[0].baseType,catalogueAccessories:MANUFACTURER_ACCESSORIES.filter(a=>a.previewSupported&&a.kind!=='fastener').map(a=>a.id),pictureFrameRows:1,borderFinish:'Dark Slate'}),
};

// 1. Every design makes a valid, multi-page PDF with the proposal, the plan page and the material list.
for(const [name,d] of Object.entries(designs)){
  const {bytes,raw,text,estimate,facts,pages}=build(d);
  ok(raw.startsWith('%PDF-')&&raw.trimEnd().endsWith('%%EOF'),`${name}: a complete PDF file`);
  ok(pages>=3&&bytes.length<600_000,`${name}: ${pages} pages, ${bytes.length} bytes`);
  ok(has(text,'Construction plan')&&has(text,'Material and hardware list')&&text.includes(`Page 1 of ${pages}`)&&text.includes(`Page ${pages} of ${pages}`),`${name}: plan and material pages, numbered`);
  // Same facts and estimate as the printable proposal.
  for(const fact of facts)ok(has(text,fact),`${name}: fact on the PDF: ${fact.slice(0,60)}`);
  ok(text.includes(dollars(estimate.subtotal))&&text.includes(dollars(estimate.hst))&&text.includes(dollars(estimate.total)),`${name}: subtotal, HST and total match the estimate`);
  for(const s of estimate.sections.filter(s=>!/^HST/.test(s.title)))ok(has(text,s.title),`${name}: estimate row ${s.title}`);
  for(const item of estimate.flags)ok(has(text,item),`${name}: review item on the PDF`);
  const quotes=estimate.quoteRequired??[];
  if(quotes.length){ok(has(text,'Not a complete project price')&&quotes.every(q=>has(text,q))&&has(text,'Priced portion including HST'),`${name}: supplier quotes named, total labelled as the priced portion`);}
  for(const s of estimate.sections.filter(s=>s.quoteRequired&&s.total===0))ok(has(text,s.title)&&text.includes('Supplier quote required'),`${name}: ${s.title} reads "Supplier quote required", not $0`);
  const listed=estimate.sections.flatMap(s=>s.items.filter(i=>Number(i.qty)>0&&i.cost===null));
  if(listed.length)ok(text.includes('(supplier quote required)'),`${name}: unpriced materials are marked for a supplier quote`);
  // Contact and claims: only published business facts; no ratings, warranties, insurance or licences; no street address.
  ok(text.includes(BUSINESS.publicName.value)&&text.includes(publicContact.phoneDisplay)&&text.includes(publicContact.email)&&text.includes(`${BUSINESS.addressPolicy.value.publicLocality}, ${BUSINESS.addressPolicy.value.region}`),`${name}: name, phone, email and service area from business.ts`);
  ok(!text.includes(BUSINESS.contact.legacyPhone.value.display)&&!/\bL4N\b/.test(text),`${name}: no legacy phone or postal code`);
  ok(!/\b5\.0\b|\bstars?\b|\brated\b|\breviews\b|warrant|WSIB|insur|licen[sc]ed|guarantee/i.test(text),`${name}: no rating, review, warranty, insurance or licensing claims`);
  ok(/planning estimate/i.test(text)&&/written quote/i.test(text),`${name}: labelled a planning estimate confirmed by a written quote`);
  ok(!text.includes('?'),`${name}: every character drew (nothing replaced)`);
  ok(!/NaN|undefined|\[object/.test(text),`${name}: no NaN, undefined or objects on the page`);
}

// 2. Customer details print only when the customer typed them; blank details say so.
{
  const named=build(designs.named).text;
  ok(named.includes('Prepared for: Pat Example')&&named.includes('Project address: 1 Sample Road, Barrie'),'Typed name and address are printed');
  ok(build(designs.default).text.includes('Prepared for: Not provided'),'Blank details print as "Not provided"');
}

// 3. Pictures: embedded when given, a note when missing or unreadable, never an error.
{
  const withPictures=build(designs.default,{snapshot:PNG,plan:PNG,logo:PNG});
  ok((withPictures.raw.match(/\/Subtype \/Image/g)??[]).length>=1,'Snapshot, plan and logo are embedded');
  ok(!has(withPictures.text,'3D view unavailable')&&!has(withPictures.text,'The plan could not be drawn'),'With pictures there are no "unavailable" notes');
  const without=build(designs.default);
  ok(has(without.text,'3D view unavailable on this device')&&has(without.text,'The plan could not be drawn'),'Without pictures the PDF says so');
  const broken=build(designs.default,{snapshot:'data:image/jpeg;base64,AAAA',plan:'not-an-image',logo:'data:image/png;base64,AAAA'});
  ok(has(broken.text,'3D view unavailable')&&broken.pages>=3,'Unreadable pictures fall back to the notes');
}

// 4. Typographic punctuation becomes plain text the built-in fonts can draw.
{
  ok(pdfText('Deck — 16 × 12 ft · ½ in, 10° “quoted” it’s ≤ 3 → next')==='Deck - 16 × 12 ft · ½ in, 10° "quoted" it\'s <= 3 -> next','Dashes, quotes and arrows are simplified; Latin-1 symbols stay');
  ok([...pdfText('Any ☃ text 中')].every(c=>c.charCodeAt(0)<=0xff),'Nothing outside Latin-1 reaches the PDF');
}

// 5. The page loads jsPDF only on demand; the attachment switch and the form schema agree.
{
  const page=designerSource(),pdf=read('src/features/deckcraft/proposalPdf.ts'),forms=read('public/__forms.html'),dialog=read('src/features/deckcraft/SendDesignDialog.tsx');
  // Any static form (import x from 'jspdf', import 'jspdf') would put it in the page bundle; only import('jspdf') may appear.
  ok(page.includes("import('jspdf')")&&!/^\s*import\s+(?!\()[^;]*['"]jspdf['"]/m.test(page)&&!/require\(['"]jspdf/.test(page),'The page imports jsPDF lazily, never in the initial bundle');
  ok(/^import type \{jsPDF as JsPDF\} from 'jspdf';/m.test(pdf)&&(pdf.match(/from 'jspdf'/g)??[]).length===1,'The PDF builder takes jsPDF as a type only');
  ok(page.includes('Download PDF')&&page.includes("trackDeck('deckcraft_output','deck_pdf')")&&page.includes('PROPOSAL_PDF_NAME')&&PROPOSAL_PDF_NAME.endsWith('.pdf'),'The estimate step downloads the PDF and reports it');
  ok(dialog.includes('onDownloadPdf')&&page.includes('onDownloadPdf={downloadPdf}'),'The send confirmation offers the PDF');
  const declared=/<form name="deck-design"[\s\S]*?<\/form>/.exec(forms)?.[0]??'';
  ok(ATTACH_PROPOSAL_PDF===declared.includes('name="proposal_pdf"'),`The proposal_pdf file field is declared exactly when attaching is on (attach=${ATTACH_PROPOSAL_PDF})`);
  ok(/if\(ATTACH_PROPOSAL_PDF\)try\{/.test(page)&&/if\(!sent\)\{/.test(page),'An attachment attempt always falls back to the plain submission');
}

console.log(`DECK PDF OK — ${Object.keys(designs).length} designs: facts, estimate, supplier quotes, review items, contact facts, claims, pictures and lazy loading; ${checks} checks.`);
