import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {ProposalSheet,type ProposalProps} from '../src/features/deckcraft/ProposalSheet';
import {BUSINESS,publicContact} from '../src/data/business';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import type {DeckData} from '../src/features/deckcraft/types';

let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const dollars=(n:number)=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(n);
const text=(html:string)=>html.replace(/<[^>]+>/g,' ').replace(/&quot;/g,'"').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&#x27;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ');
function render(data:DeckData,extra:Partial<ProposalProps>={}){
  const estimate=calculateDeckReleaseEstimate(data);
  const props:ProposalProps={data,estimate,facts:['Deck area: 192 sq ft'],reviewItems:estimate.flags,image:null,date:'September 22, 2026',...extra};
  return {html:renderToStaticMarkup(createElement(ProposalSheet,props)),estimate};
}

// 1. Contact and brand facts come only from the published business fields; no unapproved claims.
{
  const {html}=render(deckReleaseData(structuredClone(DEFAULT_DECK))),t=text(html);
  ok(t.includes(publicContact.phoneDisplay)&&t.includes(publicContact.email)&&t.includes(BUSINESS.publicName.value),'Public phone, email and name from business.ts');
  ok(!t.includes(BUSINESS.contact.legacyPhone.value.display),'The unconfirmed legacy phone never appears');
  ok(!/\b5\.0\b|\bstars?\b|\brated\b|\breviews\b|warrant|WSIB|insur|licen[sc]ed|guarantee/i.test(t),'No rating, review, warranty, insurance or licensing claims');
  ok(t.includes(`${BUSINESS.addressPolicy.value.publicLocality}, ${BUSINESS.addressPolicy.value.region}`)&&!/\bL4N\b/.test(t),'Service area only; no street address or postal code');
  ok(/planning estimate/i.test(t)&&/written quote/i.test(t),'It is labelled a planning estimate, confirmed by a written quote');
  ok(t.includes('Prepared for Not provided')&&t.includes('Project address Not provided'),'Blank customer details print as "Not provided"');
  ok(html.includes('<svg')&&html.includes('Deck construction plan'),'The contractor plan is on the sheet');
  ok(html.includes('dd-proposal-noimage'),'Without a 3D snapshot the sheet says so and keeps the plan');
}

// 2. Numbers match the live estimate; HST appears once; supplier quotes are named, never priced at zero.
{
  const d=deckReleaseData({...structuredClone(DEFAULT_DECK),customerName:'Sample Customer',projectAddress:'12 Example Crescent'});
  const {html,estimate}=render(d,{image:'data:image/jpeg;base64,AAAA'}),t=text(html);
  ok(t.includes('Prepared for Sample Customer')&&t.includes('12 Example Crescent'),'Customer name and address are printed');
  ok(html.includes('alt="3D view of the proposed deck"'),'The 3D snapshot is on the sheet');
  ok(t.includes(dollars(estimate.total))&&t.includes(dollars(estimate.subtotal))&&t.includes(dollars(estimate.hst)),'Total, subtotal and HST match the estimate');
  ok((t.match(/\bHST\b/g)??[]).length===3,'HST is listed once (plus the subtotal and total labels)');
  const rows=estimate.sections.filter(s=>!/^HST/.test(s.title));
  ok(rows.every(s=>t.includes(s.title)),'Every priced section is listed');
  ok(Math.abs(rows.reduce((n,s)=>n+s.total,0)-estimate.subtotal)<.01,'Listed sections add up to the subtotal');
  ok((estimate.quoteRequired??[]).length>0&&(estimate.quoteRequired??[]).every(q=>t.includes(q))&&/Not a complete project price/.test(t),'Supplier-quote items are named on the sheet');
  ok(estimate.flags.every(f=>t.includes(text(f).trim())),'Every "confirm before construction" item is on the sheet');
}

// 3. Big designs print denser so the page still fits.
{
  const house={...getHouseConfig({...structuredClone(DEFAULT_DECK),width:20}),widthFt:24,depthFt:20};
  const big=deckReleaseData({...structuredClone(DEFAULT_DECK),houseConfig:house,wrap:{left:{widthFt:8,runFt:8},right:{widthFt:12,runFt:8}},levels:3,height2:29,width2:40,length2:9,level2FullStep:true,level3:{widthFt:40,lengthFt:8,heightIn:8,parent:2,position:'Front',offsetPct:50}});
  const {html}=render(big,{facts:Array.from({length:14},(_,i)=>`Fact ${i}`)});
  ok(html.includes('dd-proposal-compact'),'A large wrap with three levels uses the denser layout');
  ok(!render(deckReleaseData(structuredClone(DEFAULT_DECK))).html.includes('dd-proposal-compact'),'A typical deck uses the regular layout');
}
console.log(`DECK PROPOSAL OK — ${checks} contact-fact, claim, estimate, supplier-quote, review-item and layout checks.`);
