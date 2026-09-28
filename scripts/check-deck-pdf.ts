import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {jsPDF} from 'jspdf';
import {BUSINESS,canPublish,publicContact} from '../src/data/business';
import {calculateDeckReleaseEstimate} from '../src/features/deckcraft/deckRelease';
import {describeDesign,dollars} from '../src/features/deckcraft/designFacts';
import {priceLedger,quoteLabel,quoteTag} from '../src/features/deckcraft/designer/priceLedgerModel';
import {exteriorSummary} from '../src/features/deckcraft/houseLooks';
import {PRICE_BOOK} from '../src/features/deckcraft/priceBook';
import {buildProposalPdf,pdfText,PROPOSAL_PDF_NAME,type ProposalPdfInput} from '../src/features/deckcraft/proposalPdf';
import {eyebrowNumber,lightingLines,proposalContact,proposalCoverTitle,proposalFeatures,proposalFinishes,proposalRunningTitle,PROPOSAL_WORDS,SHEET_EYEBROWS} from '../src/features/deckcraft/proposalModel';
import {ATTACH_PROPOSAL_PDF} from '../src/features/deckcraft/sendDesign';
import type {DeckData} from '../src/features/deckcraft/types';
import {PROPOSAL_CASES} from './deck-proposal-cases';
import {designerSource} from './deck-designer-source';

/**
 * The proposal PDF (R8) says what the printable proposal says, sheet for sheet: the cover, views, lighting and
 * features, finishes, site plan, the investment exactly as the price schedule has it (quote lines tagged, never $0,
 * HST once), next steps and the appendix; it wears the Golden Maple estimate branding (R9): the cover's eyebrow,
 * wordmark and honest document name, a running head and a contact footer with "PAGE 0N" on every page after the
 * cover, gold section eyebrows, and no italic type; contact details only from business.ts; no unapproved claims (nor
 * the customer estimate's warranty footer, tagline or validity); and it survives any design, with or without its
 * pictures.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const root=new URL('../',import.meta.url),read=(path:string)=>readFileSync(new URL(path,root),'utf8');
/** A 2 × 2 RGB PNG made here, standing in for the 3D views, plans, logo and swatches. */
function testPng():string{
  const crc32=(buf:Buffer)=>{let c=~0;for(const byte of buf){c^=byte;for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return (~c)>>>0;};
  const chunk=(type:string,data:Buffer)=>{const body=Buffer.concat([Buffer.from(type,'ascii'),data]),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(body));return Buffer.concat([len,body,crc]);};
  const header=Buffer.alloc(13);header.writeUInt32BE(2,0);header.writeUInt32BE(2,4);header[8]=8;header[9]=2;
  const pixels=Buffer.from([0,200,120,40,90,60,30,0,40,40,40,250,245,236]);
  return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}
const PNG=testPng();
const SHOTS=[{label:'Corner view at night',src:PNG},{label:'Front view',src:PNG},{label:'Overview',src:PNG},{label:'Corner view by day',src:PNG}];
/** The text drawn in an uncompressed jsPDF file, one string per Tj operator. */
function drawn(pdf:string):string[]{
  return [...pdf.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map(m=>m[1].replace(/\\([0-7]{3})/g,(_,o)=>String.fromCharCode(parseInt(o,8))).replace(/\\([()\\])/g,'$1'));
}
/** "$0" standing alone, never shown for anything unpriced. */
const ZERO=/\$0(?![\d.,])/;
const CLAIMS=[/5\.0\s*(GOOGLE RATING|·\s*8 REVIEWS)/i,/8 VERIFIED GOOGLE REVIEWS/i,/WSIB CERTIFIED/i,/\$5M\s*LIABILITY/i,/5-year craftsmanship warranty|Every build is backed by a 5-year/i,
  /\b5\.0\b|\bstars?\b|\brated\b|\breviews\b|warrant|WSIB|insur|licen[sc]ed|guarantee/i,/instant quote|24\/7|never miss/i,
  /structural warranty|built right|backed for years|valid (for )?\d+ days/i];
const CONTACT=proposalContact(),BRAND=CONTACT.name.toUpperCase();
function build(d:DeckData,extra:Partial<ProposalPdfInput>={}){
  const estimate=calculateDeckReleaseEstimate(d),{proposalFacts}=describeDesign(d,estimate),exterior=exteriorSummary(d);
  const facts=exterior?[...proposalFacts,exterior]:proposalFacts;
  const bytes=Buffer.from(buildProposalPdf(jsPDF,{data:d,estimate,facts,reviewItems:estimate.flags,date:'September 24, 2026',...extra},{compress:false}));
  const raw=bytes.toString('latin1'),strings=drawn(raw);
  // Each page's running head and footer are drawn after its body (once the pages are laid out): they are read on their
  // own, so body text that runs from one sheet onto the next is matched without them. A page's chrome is five strings:
  // the spaced name, the document's title, the contact line, the footer's second line and "PAGE 0N".
  const head:string[]=[],body:string[]=[];
  for(let i=0;i<strings.length;i++){
    if(strings[i]===BRAND&&/^PAGE \d\d$/.test(strings[i+4]??'')){head.push(...strings.slice(i,i+5),'|');i+=4;continue;}
    body.push(strings[i]);
  }
  const join=(list:string[])=>list.join(' ').replace(/\s+/g,' ');
  return {bytes,raw,text:join(body),heads:join(head),estimate,facts,ledger:priceLedger(estimate),pages:(raw.match(/\/Type \/Page\b/g)??[]).length,images:(raw.match(/\/Subtype \/Image/g)??[]).length};
}
const has=(text:string,phrase:string)=>text.includes(pdfText(phrase).replace(/\s+/g,' '));

// 1. Every design makes a valid PDF with every sheet, and the same content as the printable proposal.
for(const [name,make] of Object.entries(PROPOSAL_CASES)){
  const d=make(),{bytes,raw,text,heads,estimate,facts,ledger,pages}=build(d,{shots:SHOTS});
  ok(raw.startsWith('%PDF-')&&raw.trimEnd().endsWith('%%EOF'),`${name}: a complete PDF file`);
  ok(pages>=10&&bytes.length<700_000,`${name}: ${pages} pages, ${bytes.length} bytes`);
  // The estimate's chrome on every page after the cover: the spaced name, the document's title, the published site,
  // phone and email, and the page number; nothing after the cover lacks it.
  const contact=CONTACT,backyard=!!ledger.split,running=proposalRunningTitle(d,backyard).toUpperCase();
  const chrome=`${BRAND} ${pdfText(running)} ${contact.site} · ${contact.phone} · ${contact.email} DECK DESIGN PROPOSAL · ${contact.area.toUpperCase()}`.replace(/\s+/g,' ');
  for(let p=2;p<=pages;p++)ok(heads.includes(`${chrome} PAGE ${eyebrowNumber(p)} |`),`${name}: page ${p} has the running head and the contact footer with "PAGE ${eyebrowNumber(p)}"`);
  ok(!heads.includes('PAGE 01')&&(heads.match(/\|/g)??[]).length===pages-1,`${name}: the cover has no running head; the ${pages-1} pages after it each have one`);
  // The cover: the eyebrow, the spaced wordmark, the hero, the document, the project, who it is for, the date and price
  // book, and the published contact line.
  const title=proposalCoverTitle(d,backyard),customer=d.customerName.trim();
  ok(text.startsWith(`${PROPOSAL_WORDS.eyebrow.toUpperCase()} ${contact.wordmark.top.toUpperCase()} ${contact.wordmark.sub.toUpperCase()} `)&&`${contact.wordmark.top} ${contact.wordmark.sub}`===BUSINESS.publicName.value,`${name}: the cover opens with "${PROPOSAL_WORDS.eyebrow}" and the ${BUSINESS.publicName.value} wordmark`);
  ok(has(text,`${SHOTS[0].label} · ${PROPOSAL_WORDS.illustration} ${PROPOSAL_WORDS.doctype.toUpperCase()} ${title}`),`${name}: the cover view, a design illustration, "${PROPOSAL_WORDS.doctype}", then the project: ${title}`);
  ok(has(text,`${customer?`PREPARED FOR ${customer} `:''}PROPOSAL DATE September 24, 2026 PRICE BOOK ${PRICE_BOOK.version} ${BRAND} ${contact.area} · ${contact.phone} · ${contact.email} · ${contact.site}`),`${name}: ${customer?'who it is prepared for, ':''}the date, the price book and the cover's contact line`);
  ok(customer||!text.includes('PREPARED FOR'),`${name}: "Prepared for" only with the customer's own name`);
  ok(d.projectAddress.trim()?has(text,d.projectAddress.trim().toUpperCase()):true,`${name}: the address when one was given`);
  ok(!/Not provided/i.test(text),`${name}: never "Not provided"`);
  // Views, features, finishes, the site plan.
  ok(has(text,'Views Your design from three more angles.')&&SHOTS.slice(1).every(s=>has(text,s.label.toUpperCase())),`${name}: three more views, captioned`);
  // The gold eyebrows, numbered in the order the sheets come.
  const eyebrows=[SHEET_EYEBROWS.views,SHEET_EYEBROWS.features,SHEET_EYEBROWS.finishes,SHEET_EYEBROWS.site,SHEET_EYEBROWS.investment,SHEET_EYEBROWS.next,SHEET_EYEBROWS.appendix];
  let from=0;
  ok(eyebrows.every((e,i)=>{const at=text.indexOf(`${eyebrowNumber(i+1)} · ${e.toUpperCase()}`,from);from=at;return at>=0;}),`${name}: the gold eyebrows, 01 to 07, in order`);
  const lights=lightingLines(d);
  for(const fact of facts)if(!(/^Lighting:/.test(fact)&&lights.length))ok(has(text,fact),`${name}: feature on the PDF: ${fact.slice(0,60)}`);
  for(const line of lights)ok(has(text,line),`${name}: fixtures by zone: ${line}`);
  ok(proposalFeatures(d,facts).every(g=>has(text,g.title)),`${name}: every feature group has its heading`);
  const tiles=proposalFinishes(d,estimate.model);
  ok(tiles.every(t=>has(text,t.colour)&&has(text,t.collection.split(' · ')[0]))&&has(text,PROPOSAL_WORDS.colours),`${name}: ${tiles.length} finishes with their manufacturer names; colours vary by screen`);
  ok(has(text,`Site plan ${d.width} × ${d.length} ft deck against your house`),`${name}: the site plan sheet`);
  // The investment: the price schedule's lines, in order, with their figures or quote tags; the totals; the quotes.
  let at=text.indexOf('Investment Planning estimate before HST');
  ok(at>0,`${name}: the investment sheet`);
  for(const line of ledger.lines){
    const value=line.quotes.length&&line.amount<.005?quoteTag(line.quotes).toUpperCase():line.text,next=text.indexOf(pdfText(`${line.title} ${value}`),at);
    ok(next>=at,`${name}: ${line.title} reads ${value}, in the engine's order`);at=next;
  }
  ok(!ZERO.test(text),`${name}: no "$0" anywhere`);
  ok(has(text,`${ledger.quotes.length?'Priced subtotal':'Subtotal'} ${dollars(ledger.subtotal)} ${PROPOSAL_WORDS.estimate}`)&&has(text,`${ledger.hstTitle} ${dollars(ledger.hst)}`)&&has(text,`${ledger.totalLabel} ${dollars(ledger.total)}`),`${name}: subtotal, HST and total are the schedule's`);
  ok((text.match(/HST \(13%\)/g)??[]).length===1&&Math.abs(ledger.lines.reduce((n,l)=>n+l.amount,0)-ledger.subtotal)<.01,`${name}: HST once; the lines add up to the subtotal`);
  ok(ledger.split?has(text,`Deck subtotal ${dollars(ledger.split.deck)}`)&&has(text,`Backyard subtotal ${dollars(ledger.split.backyard)}`):!text.includes('Backyard subtotal'),`${name}: deck and backyard subtotals exactly when there is a backyard`);
  ok(has(text,PROPOSAL_WORDS.notFinal),`${name}: "${PROPOSAL_WORDS.notFinal}"`);
  if(ledger.quotes.length){
    ok(has(text,'Still to be quoted'),`${name}: the quotes list`);
    for(const q of ledger.quotes)ok(has(text,`${quoteTag([q.kind]).toUpperCase()} ${quoteLabel(q.label)}`),`${name}: ${q.kind} quote: ${quoteLabel(q.label).slice(0,50)}`);
  }
  // Next steps and contact: published facts only; no unapproved claims.
  ok(has(text,contact.call)&&has(text,`${publicContact.email} · ${contact.site} · ${contact.area}`)&&has(text,contact.book),`${name}: ${contact.call}; email, site, service area; book a call`);
  ok(canPublish(BUSINESS.contact.primaryPhone)===has(text,'Call or text Sophie, our AI receptionist'),`${name}: Sophie is named only while the public number is confirmed as hers`);
  ok(text.includes(BUSINESS.publicName.value)&&text.includes(publicContact.phoneDisplay),`${name}: the business name and phone`);
  ok(!text.includes(BUSINESS.contact.legacyPhone.value.display)&&!/\bL4N\b/.test(text),`${name}: no legacy phone or postal code`);
  for(const claim of CLAIMS)ok(!claim.test(text)&&!claim.test(heads),`${name}: no claim matching ${claim.source.slice(0,40)}, in the body or the running head and footer`);
  ok(!/final price/i.test(text.slice(0,text.indexOf('Appendix For you and your builder'))),`${name}: no "final price" before the appendix`);
  // The appendix, at the back: what to confirm, the construction plan, the material list with quote tags.
  const appendix=text.slice(text.indexOf('Appendix For you and your builder'));
  for(const item of estimate.flags)ok(has(appendix,item),`${name}: review item in the appendix`);
  ok(has(appendix,'Construction plan')&&has(appendix,'Material and hardware list'),`${name}: the construction plan and material list`);
  const unpriced=estimate.sections.flatMap(s=>s.items.filter(i=>Number(i.qty)>0&&i.cost===null));
  ok((appendix.slice(appendix.indexOf('Material and hardware list')).match(/\b(SUPPLIER|BUILDER) QUOTE\b/g)??[]).length===unpriced.length,`${name}: ${unpriced.length} unpriced materials, each tagged for a quote`);
  ok(!text.includes('?'),`${name}: every character drew (nothing replaced)`);
  ok(!/NaN|undefined|\[object/.test(text),`${name}: no NaN, undefined or objects on the page`);
}

// 2. Customer details print only when the customer typed them; a blank design is "Your deck".
{
  const named=build(PROPOSAL_CASES.named()).text,blank=build(PROPOSAL_CASES.default()).text;
  ok(named.includes('PREPARED FOR Pat Example')&&named.includes('1 SAMPLE ROAD, BARRIE'),'Typed name and address are printed');
  ok(blank.includes('DESIGN PROPOSAL 16 × 12 ft Deck')&&!blank.includes('PREPARED FOR')&&!/Not provided/.test(blank),'A blank design is titled by its size, with no "Prepared for", never "Not provided"');
}

// 3. Pictures: embedded when given, a note when missing or unreadable, never an error.
{
  const d=PROPOSAL_CASES.showcase(),files=proposalFinishes(d,calculateDeckReleaseEstimate(d).model).flatMap(t=>t.swatch?[t.swatch]:[]);
  const all=build(d,{shots:SHOTS,sitePlan:PNG,plan:PNG,logo:PNG,swatches:Object.fromEntries(files.map(f=>[f,PNG]))});
  ok(all.images>=1&&!has(all.text,'not available on this device')&&!has(all.text,'could not be drawn'),'Views, plans, logo and swatches are embedded, with no "unavailable" notes');
  const one=build(PROPOSAL_CASES.default(),{snapshot:PNG});
  ok(one.text.includes('Corner view · Design illustration')&&!one.text.includes('Views Your design'),'A single snapshot is the cover, with no views sheet');
  const none=build(PROPOSAL_CASES.default());
  ok(has(none.text,'The 3D view is not available on this device')&&has(none.text,'The site plan could not be drawn')&&has(none.text,'The construction plan could not be drawn'),'Without pictures the PDF says so');
  const planOnly=build(PROPOSAL_CASES.default(),{sitePlan:PNG});
  ok(has(planOnly.text,'The 3D view is not available on this device: the site plan shows the layout.'),'Without a 3D view the cover shows the site plan and says why');
  const broken=build(PROPOSAL_CASES.default(),{shots:[{label:'Corner view',src:'data:image/jpeg;base64,AAAA'}],sitePlan:'not-an-image',plan:'not-an-image',logo:'data:image/png;base64,AAAA',swatches:{'tt-primeplus-coconut-husk.jpg':'nonsense'}});
  ok(has(broken.text,'The 3D view is not available')&&broken.pages>=9,'Unreadable pictures fall back to the notes');
}

// 4. Typographic punctuation becomes plain text the built-in fonts can draw.
{
  ok(pdfText('Deck — 16 × 12 ft · ½ in, 10° “quoted” it’s ≤ 3 → next')==='Deck - 16 × 12 ft · ½ in, 10° "quoted" it\'s <= 3 -> next','Dashes, quotes and arrows are simplified; Latin-1 symbols stay');
  ok([...pdfText('Any ☃ text 中')].every(c=>c.charCodeAt(0)<=0xff),'Nothing outside Latin-1 reaches the PDF');
}

// 5. The page loads jsPDF and the builder only on demand; the attachment switch and the form schema agree.
{
  const page=designerSource(),pdf=read('src/features/deckcraft/proposalPdf.ts'),forms=read('public/__forms.html'),dialog=read('src/features/deckcraft/SendDesignDialog.tsx');
  // Any static form (import x from 'jspdf', import 'jspdf') would put it in the page bundle; only import('jspdf') may appear.
  ok(page.includes("import('jspdf')")&&!/^\s*import\s+(?!\()[^;]*['"]jspdf['"]/m.test(page)&&!/require\(['"]jspdf/.test(page),'The page imports jsPDF lazily, never in the initial bundle');
  ok(page.includes("import('../features/deckcraft/proposalPdf')")&&page.includes("import('../features/deckcraft/pdfAssets')")&&!/^import[^;]*(proposalPdf|pdfAssets)'/m.test(page),'The PDF builder and its pictures load with jsPDF, not with the page');
  ok(/^import type \{jsPDF as JsPDF\} from 'jspdf';/m.test(pdf)&&(pdf.match(/from 'jspdf'/g)??[]).length===1,'The PDF builder takes jsPDF as a type only');
  ok(!/['"](bold)?italic['"]/i.test(pdf)&&!/addFont|\.ttf|\.woff/i.test(pdf),'The PDF sets nothing in italics and embeds no font files (jsPDF built-ins only)');
  ok(page.includes('Download PDF')&&page.includes("trackDeck('deckcraft_output','deck_pdf')")&&page.includes('PROPOSAL_PDF_NAME')&&PROPOSAL_PDF_NAME.endsWith('.pdf'),'Proposal & files downloads the PDF and reports it');
  ok(/assets\.planImage\(estimate\.model,data,2000,'site'\)/.test(page)&&/assets\.swatchImages\(data,estimate\.model\)/.test(page)&&/shots,sitePlan,plan,logo,swatches/.test(page),'The page hands the builder the views, both plans, the logo and the swatch photos');
  ok(dialog.includes('onDownloadPdf')&&page.includes('onDownloadPdf={downloadPdf}'),'The send confirmation offers the PDF');
  const declared=/<form name="deck-design"[\s\S]*?<\/form>/.exec(forms)?.[0]??'';
  ok(ATTACH_PROPOSAL_PDF===declared.includes('name="proposal_pdf"'),`The proposal_pdf file field is declared exactly when attaching is on (attach=${ATTACH_PROPOSAL_PDF})`);
  ok(/if\(ATTACH_PROPOSAL_PDF\)try\{/.test(page)&&/if\(!sent\)\{/.test(page),'An attachment attempt always falls back to the plain submission');
}

console.log(`DECK PDF OK — ${Object.keys(PROPOSAL_CASES).length} designs: every sheet, the estimate's chrome (cover wordmark, running head, contact footer, PAGE 0N, eyebrows, no italics), the cover (no "Not provided"), features, finishes, the investment equal to the price schedule (no $0, HST once, quotes tagged), contact facts, claims, pictures and lazy loading; ${checks} checks.`);
