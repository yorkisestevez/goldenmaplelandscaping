import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BUSINESS,canPublish,publicContact} from '../src/data/business';
import {calculateDeckReleaseEstimate} from '../src/features/deckcraft/deckRelease';
import {describeDesign,dollars} from '../src/features/deckcraft/designFacts';
import {priceLedger,quoteLabel,quoteTag} from '../src/features/deckcraft/designer/priceLedgerModel';
import {exteriorSummary} from '../src/features/deckcraft/houseLooks';
import {PRICE_BOOK,priceBookLabel} from '../src/features/deckcraft/priceBook';
import {ProposalSheet,type ProposalProps} from '../src/features/deckcraft/ProposalSheet';
import {investmentSheets,lightingLines,proposalFeatures,proposalFinishes,PROPOSAL_WORDS,type ProposalShot} from '../src/features/deckcraft/proposalModel';
import type {DeckData} from '../src/features/deckcraft/types';
import {PROPOSAL_CASES} from './deck-proposal-cases';

/**
 * The luxury proposal (R8), rendered as the dialog and the print show it. It has every sheet (cover, views, lighting
 * and features, materials and finishes, site plan, investment, next steps, appendix); its investment is the price
 * schedule's figures exactly (lines in the engine's order, subtotals, HST once, the total), every quote tagged, never
 * $0; the cover never says "Not provided"; contact facts come only from business.ts; and no rating, review, WSIB,
 * insurance, warranty or "instant quote" claim appears.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const root=new URL('../',import.meta.url),read=(path:string)=>readFileSync(new URL(path,root),'utf8');
const unescape=(s:string)=>s.replace(/&quot;/g,'"').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&#x27;|&apos;/g,"'").replace(/&amp;/g,'&');
const text=(html:string)=>unescape(html.replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ');
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
/** "$0" standing alone, never shown for anything unpriced. */
const ZERO=/\$0(?![\d.,])/;
/** The site's claim gate (scripts/check-rendered-business-claims.py) and the wider list this page has always kept to. */
const CLAIMS=[/5\.0\s*(GOOGLE RATING|·\s*8 REVIEWS)/i,/8 VERIFIED GOOGLE REVIEWS/i,/WSIB CERTIFIED/i,/\$5M\s*LIABILITY/i,/5-year craftsmanship warranty|Every build is backed by a 5-year/i,
  /\b5\.0\b|\bstars?\b|\brated\b|\breviews\b|warrant|WSIB|insur|licen[sc]ed|guarantee/i,/instant quote|24\/7|never miss/i];
const SHOTS:ProposalShot[]=[{label:'Corner view at night',src:'data:image/jpeg;base64,AAAA'},{label:'Front view',src:'data:image/jpeg;base64,BBBB'},{label:'Overview',src:'data:image/jpeg;base64,CCCC'},{label:'Corner view by day',src:'data:image/jpeg;base64,DDDD'}];
function render(data:DeckData,extra:Partial<ProposalProps>={}){
  const estimate=calculateDeckReleaseEstimate(data),{proposalFacts}=describeDesign(data,estimate);
  const props:ProposalProps={data,estimate,facts:proposalFacts,reviewItems:estimate.flags,image:null,date:'September 24, 2026',...extra};
  // React's separators between adjacent text nodes are left out, so the markup reads as the page shows it.
  const html=renderToStaticMarkup(createElement(ProposalSheet,props)).replace(/<!-- -->/g,'');
  return {html,t:text(html),estimate,facts:props.facts,ledger:priceLedger(estimate)};
}
/** The markup of one sheet (by its aria-label), up to the next sheet. */
const sheetOf=(html:string,label:string)=>{const i=html.indexOf(`aria-label="${esc(label)}"`);if(i<0)return '';const next=html.slice(i+1).search(/<section class="dd-proposal-(page|appendix)/);return html.slice(i,next<0?undefined:i+1+next);};

for(const [name,make] of Object.entries(PROPOSAL_CASES)){
  const data=make(),{html,t,estimate,facts,ledger}=render(data,{shots:SHOTS,swatchSrc:f=>`/swatches/${f}`});
  // 1. Every sheet, in order, each numbered; the appendix at the back.
  const order=['Cover','Views','Lighting &amp; features','Materials &amp; finishes','Site plan','Investment','Next steps','Appendix'].map(l=>html.indexOf(`aria-label="${l}"`));
  ok(order.every(i=>i>0)&&order.every((i,k)=>!k||i>order[k-1]),`${name}: cover, views, features, finishes, site plan, investment, next steps and appendix, in that order`);
  const pages=(html.match(/<section class="dd-proposal-page/g)??[]).length,numbers=[...html.matchAll(/<dt>No\.<\/dt><dd>(\d+) \/ (\d+)<\/dd>/g)];
  ok(numbers.length===pages-1&&numbers.every((m,i)=>Number(m[1])===i+2&&Number(m[2])===pages),`${name}: ${pages} sheets, numbered 2 to ${pages} of ${pages} after the cover`);
  // 2. The cover: the wordmark, the 3D hero, the project, the date and the price book; never "Not provided".
  const cover=sheetOf(html,'Cover');
  ok(/Golden Maple<span>Deck Studio<\/span>/.test(cover)&&cover.includes('>Proposal<'),`${name}: the Golden Maple wordmark with Deck Studio and Proposal`);
  ok(cover.includes(`src="${SHOTS[0].src}"`)&&cover.includes(`alt="3D view of the proposed deck, corner view at night"`)&&cover.includes(`${SHOTS[0].label} · ${PROPOSAL_WORDS.illustration}`),`${name}: the cover is the first view, marked a design illustration`);
  ok(cover.includes(`<h2>${esc(data.customerName.trim()||'Your deck')}</h2>`),`${name}: the project is the customer's name or "Your deck"`);
  ok(/<dt>Date<\/dt><dd>September 24, 2026<\/dd>/.test(cover)&&cover.includes(`<dt>Price book</dt><dd>${PRICE_BOOK.version}</dd>`),`${name}: the date and the price-book stamp`);
  ok(data.projectAddress.trim()?cover.includes(`dd-proposal-address">${esc(data.projectAddress.trim())}<`):!cover.includes('dd-proposal-address'),`${name}: the address line only when one was given`);
  ok(!/Not provided/i.test(t),`${name}: never "Not provided"`);
  // 3. Views: the other cameras, each captioned.
  const views=sheetOf(html,'Views');
  ok(SHOTS.slice(1).every(s=>views.includes(`src="${s.src}"`)&&views.includes(`<figcaption>${s.label}</figcaption>`))&&!views.includes(SHOTS[0].src),`${name}: three more views, captioned, without the cover`);
  // 4. Lighting & features: every describeDesign fact (the short lighting fact gives way to the fixtures by zone).
  const features=text(sheetOf(html,'Lighting & features')),lights=lightingLines(data),exterior=exteriorSummary(data);
  for(const fact of facts)if(!(/^Lighting:/.test(fact)&&lights.length))ok(features.includes(fact),`${name}: feature listed: ${fact.slice(0,60)}`);
  for(const line of lights)ok(features.includes(line),`${name}: fixtures by zone: ${line}`);
  ok(!exterior||features.includes(exterior),`${name}: the house's exterior line, appearance only`);
  ok(proposalFeatures(data,facts,exterior).every(g=>features.includes(g.title)),`${name}: every feature group has its heading`);
  // 5. Materials & finishes: the manufacturer's names and real swatch photos; colours vary by screen.
  const finishes=sheetOf(html,'Materials & finishes'),tiles=proposalFinishes(data,estimate.model);
  ok(tiles.length>0&&tiles.every(tile=>finishes.includes(`<strong>${esc(tile.colour)}</strong><span>${esc(tile.collection)}</span>`)),`${name}: ${tiles.length} finishes, each with its manufacturer's collection and colour`);
  ok(tiles.every(tile=>tile.swatch?finishes.includes(`src="/swatches/${tile.swatch}"`):!!tile.hex),`${name}: every finish shows its swatch photo (the railing colour, its illustrative chip)`);
  ok(finishes.includes(PROPOSAL_WORDS.colours),`${name}: "${PROPOSAL_WORDS.colours}"`);
  // 6. The site plan: the drawing-set plan (the house, the deck, gold dimensions).
  ok(sheetOf(html,'Site plan').includes('aria-label="Site plan: the deck against the house"'),`${name}: the site plan`);
  // 7. The investment equals the price schedule: lines in the engine's order, each once, a tag for a quote, never $0.
  const invest=[...html.matchAll(/aria-label="Investment(, continued)?"[\s\S]*?(?=<section class="dd-proposal-page)/g)].map(m=>m[0]).join('');
  const rows=[...invest.matchAll(/<tr><th scope="row">(.*?)<\/th><td>(.*?)<\/td><\/tr>/g)].map(m=>[unescape(m[1]),text(m[2]).trim()]);
  ok(JSON.stringify(rows.slice(0,ledger.lines.length).map(r=>r[0]))===JSON.stringify(ledger.lines.map(l=>l.title)),`${name}: ${ledger.lines.length} priced lines in the engine's order, each once`);
  for(const line of ledger.lines){
    const shown=rows.find(r=>r[0]===line.title)?.[1]??'';
    ok(line.quotes.length&&line.amount<.005?shown===quoteTag(line.quotes)&&!shown.includes('$'):shown===line.text,`${name}: ${line.title} reads ${shown}`);
  }
  ok(!ZERO.test(text(invest)),`${name}: no "$0" anywhere in the investment`);
  const sums=text(invest);
  ok(sums.includes(`${ledger.quotes.length?'Priced subtotal':'Subtotal'} ${PROPOSAL_WORDS.estimate} ${dollars(ledger.subtotal)}`)&&sums.includes(`${ledger.hstTitle} ${dollars(ledger.hst)}`)&&sums.includes(`${ledger.totalLabel} ${dollars(ledger.total)}`),`${name}: subtotal, HST and total are the schedule's`);
  ok((sums.match(/HST \(13%\)/g)??[]).length===1&&Math.abs(ledger.lines.reduce((n,l)=>n+l.amount,0)-ledger.subtotal)<.01,`${name}: HST once; the lines add up to the subtotal`);
  ok(ledger.split?sums.includes(`Deck subtotal ${dollars(ledger.split.deck)}`)&&sums.includes(`Backyard subtotal ${dollars(ledger.split.backyard)}`):!sums.includes('Backyard subtotal'),`${name}: deck and backyard subtotals exactly when there is a backyard`);
  ok(sums.includes(PROPOSAL_WORDS.estimate)&&sums.includes(PROPOSAL_WORDS.notFinal)&&sums.includes(priceBookLabel()),`${name}: "${PROPOSAL_WORDS.estimate}", "${PROPOSAL_WORDS.notFinal}" and the price book`);
  const quoted=[...invest.matchAll(/<li><span class="dd-proposal-tag" data-kind="(\w+)">[^<]*<\/span> (.*?)<\/li>/g)].map(m=>[m[1],unescape(m[2])]);
  ok(quoted.length===ledger.quotes.length&&ledger.quotes.every((q,i)=>quoted[i][0]===q.kind&&quoted[i][1]===quoteLabel(q.label)),`${name}: ${ledger.quotes.length} selections still to be quoted, each once, tagged supplier or builder`);
  ok(investmentSheets(ledger).length===(html.match(/aria-label="Investment(, continued)?"/g)??[]).length,`${name}: the investment takes ${investmentSheets(ledger).length} sheet(s)`);
  // 8. Next steps and contact: published facts only.
  const next=text(sheetOf(html,'Next steps'));
  ok(next.includes(publicContact.phoneDisplay)&&next.includes(publicContact.email)&&t.includes(BUSINESS.publicName.value)&&next.includes(`${BUSINESS.addressPolicy.value.publicLocality}, ${BUSINESS.addressPolicy.value.region}`),`${name}: phone, email, name and service area from business.ts`);
  ok(canPublish(BUSINESS.contact.primaryPhone)===next.includes(`Call or text Sophie, our AI receptionist, at ${publicContact.phoneDisplay}`),`${name}: Sophie is named only while the public number is confirmed as hers`);
  ok(next.includes('Book a call')&&next.includes('goldenmaplelandscaping.ca/book')&&next.includes('Send us your design'),`${name}: book a call or send the design`);
  ok(!t.includes(BUSINESS.contact.legacyPhone.value.display)&&!/\bL4N\b/.test(t),`${name}: no legacy phone, street address or postal code`);
  for(const claim of CLAIMS)ok(!claim.test(t),`${name}: no claim matching ${claim.source.slice(0,40)}`);
  // The proposal's own sheets never speak of a final price; the appendix may quote the engine's notes that it comes later.
  ok(!/final price/i.test(text(html.slice(0,html.indexOf('aria-label="Appendix"')))),`${name}: no "final price" on the presentation sheets`);
  // 9. The appendix: every review item, the builder's construction plan and the material list, in smaller type.
  const appendix=html.slice(html.indexOf('aria-label="Appendix"'));
  ok(estimate.flags.every(f=>text(appendix).includes(text(esc(f)).trim())),`${name}: every "confirm before construction" item is in the appendix`);
  ok(appendix.includes('aria-label="Deck construction plan from the shared model"')&&appendix.includes('Material and hardware list'),`${name}: the construction plan and the material list are at the back`);
  const unpriced=estimate.sections.flatMap(s=>s.items.filter(i=>Number(i.qty)>0&&i.cost===null));
  ok((appendix.match(/class="dd-proposal-tag"/g)??[]).length===unpriced.length,`${name}: ${unpriced.length} unpriced materials, each tagged for a quote`);
}

// 10. One picture only, and none (no WebGL): no views sheet; without any, the cover shows the site plan and says so.
{
  const data=PROPOSAL_CASES.default(),one=render(data,{image:'data:image/jpeg;base64,AAAA'}),none=render(data);
  ok(!one.html.includes('aria-label="Views"')&&one.html.includes('src="data:image/jpeg;base64,AAAA"'),'A single snapshot is the cover; there is no views sheet');
  ok(!none.html.includes('aria-label="Views"')&&sheetOf(none.html,'Cover').includes('Site plan: the deck against the house')&&none.t.includes('The 3D view is not available on this device'),'Without a snapshot the cover shows the site plan and says why');
  ok(one.t.includes('Your deck')&&!ZERO.test(none.t),'A blank design is "Your deck", and nothing reads $0');
}

// 11. Wiring: the dialog and its styles load on demand; the sheet stays renderable here (no CSS, no bundler-only imports).
{
  const page=read('src/pages/DeckDesigner.tsx'),dialog=read('src/features/deckcraft/ProposalDialog.tsx'),sheet=read('src/features/deckcraft/ProposalSheet.tsx'),css=read('src/pages/DeckDesigner.css'),own=read('src/features/deckcraft/proposal.css');
  ok(page.includes("const loadProposalDialog=()=>import('../features/deckcraft/ProposalDialog');")&&!/^import[^;]*ProposalDialog/m.test(page),'The page loads the proposal dialog on demand');
  ok(dialog.includes("import './proposal.css';")&&dialog.includes('swatchSrc={swatchUrl}')&&!/\.css'|lib\/swatches/.test(sheet),'The dialog brings the proposal styles and swatch photos; the sheet itself imports neither');
  ok(!css.includes('.dd-proposal-page')&&own.includes('.dd-proposal-page{')&&/@media print\{[\s\S]*@page\{size:letter;margin:0\}/.test(own)&&/break-after:page/.test(own),'The proposal styles (one Letter page a sheet in print) live only in proposal.css');
  ok(!/border-radius:(?!0)|box-shadow:(?!none)/.test(own),'Square corners and no shadows');
  ok(/captureViews\(\)/.test(page)&&/setSnapshotLighting\(view\.light\)/.test(page)&&/setMode\(previous\);setSnapshotLighting\(null\);/.test(page),'The views come from camera presets in day or night, and the visitor\'s view comes back afterwards');
}
console.log(`DECK PROPOSAL OK — ${Object.keys(PROPOSAL_CASES).length} designs: sheets and numbering, cover (no "Not provided"), views, features from the facts, finishes with swatches, site plan, investment equal to the price schedule (no $0, HST once, quotes tagged), next steps, appendix, contact facts and claims; ${checks} checks.`);
