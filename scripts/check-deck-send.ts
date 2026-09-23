import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BUSINESS,publicContact} from '../src/data/business';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData,serializeDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import {describeDesign} from '../src/features/deckcraft/designFacts';
import {decodeDesignLink,designLinkFromHash,encodeDesignLink,withoutPersonalDetails} from '../src/features/deckcraft/designLink';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {CONTACT_REQUEST_TEXT,DECK_BUDGETS,DECK_DESIGN_FIELDS,DECK_DESIGN_FORM,DECK_DESIGN_SOURCE,DECK_TIMELINES,MAX_DETAILS_CHARS,OFFER_SAMPLE_REQUEST,bookingNotesFor,buildDeckDesignSubmission,deckLeadScore,designConditions,offersConsent,sendFieldsProblem,type SendDesignFields} from '../src/features/deckcraft/sendDesign';
import {PROJECT_BUDGET_RANGES} from '../src/data/projectBudgets';
import {scoreGoldenMapleLead} from '../src/utils/leadScoring';
import {SendDesignForm} from '../src/features/deckcraft/SendDesignDialog';
import type {DeckData} from '../src/features/deckcraft/types';
import {designerSource} from './deck-designer-source';

/**
 * "Send my design": every field reaches Netlify (and so the CRM), the consent record is honest, the
 * lead never fails the CRM's intake rules, and the design in the lead reopens exactly.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const root=new URL('../',import.meta.url),read=(path:string)=>readFileSync(new URL(path,root),'utf8');
const text=(html:string)=>html.replace(/<[^>]+>/g,' ').replace(/&#x27;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ');
const house=getHouseConfig({...structuredClone(DEFAULT_DECK),width:20});
const design=(patch:Partial<DeckData>={}):DeckData=>deckReleaseData({...structuredClone(DEFAULT_DECK),...patch});
const fields=(patch:Partial<SendDesignFields>={}):SendDesignFields=>({name:'Pat Example',email:'pat@example.ca',phone:'705 555 0142',address:'1 Sample Road, Barrie',notes:'',offers:false,botField:'',timeline:'',budget:'',samples:false,...patch});
const sentAt=new Date('2026-09-22T15:30:00.000Z');
async function submission(d:DeckData,f=fields(),consent=offersConsent('PO Box 000, Barrie ON')){
  const estimate=calculateDeckReleaseEstimate(d),{summary}=describeDesign(d,estimate),reviewItems=estimate.flags;
  const link=await encodeDesignLink(d,'https://example.test');
  return {out:buildDeckDesignSubmission(f,{data:d,estimate,summary,reviewItems,link,sentAt,consent}),estimate,summary,link,reviewItems};
}

// 1. Netlify keeps only declared fields, so every field the app sends is declared under deck-design.
const forms=read('public/__forms.html');
const block=/<form name="deck-design"([^>]*)>([\s\S]*?)<\/form>/.exec(forms);
ok(block,'public/__forms.html declares the deck-design form');
ok(/\bnetlify\b/.test(block![1])&&/netlify-honeypot="bot-field"/.test(block![1]),'The form is a Netlify form with the bot-field honeypot');
const declared=new Set([...block![2].matchAll(/name="([^"]+)"/g)].map(m=>m[1]));
const utm=read('src/utils/utmCapture.ts'),behavior=read('src/utils/behavior.ts');
const attributionKeys=[...(/interface AttributionPayload \{([\s\S]*?)\}/.exec(utm)?.[1]??'').matchAll(/(\w+)\?:/g)].map(m=>m[1]);
const behaviorFn=/export function getBehaviorFields[\s\S]*?\n\}/.exec(behavior)?.[0]??'';
const behaviorKeys=[...new Set([...behaviorFn.matchAll(/\bout\.(\w+)\s*=|^\s+(\w+):/gm)].map(m=>m[1]??m[2]))].filter(k=>k&&k!=='https');
ok(attributionKeys.length>=9&&behaviorKeys.length>=6,`Attribution (${attributionKeys.join(', ')}) and behaviour (${behaviorKeys.join(', ')}) keys were found`);
for(const key of [...DECK_DESIGN_FIELDS,...attributionKeys,...behaviorKeys])ok(declared.has(key),`deck-design declares ${key}`);
{
  const {out}=await submission(design());
  for(const key of Object.keys(out))if(key!=='form-name'&&key!=='bot-field')ok(declared.has(key),`The app's ${key} field is declared`);
  ok(out['form-name']===DECK_DESIGN_FORM&&'bot-field' in out,'The submission names its form and carries the honeypot');
}
ok(!read('src/features/deckcraft/SendDesignDialog.tsx').includes('data-netlify')&&!designerSource().includes('data-netlify'),'No runtime JSX self-registers the form (the __forms.html trap)');

// 2. The lead the CRM receives: source, value, details with the link, summary, review items, notes and consent.
{
  const d=design({width:20,length:14,customerName:'Should Not Travel',projectAddress:'9 Hidden Lane'});
  const {out,estimate,summary,link,reviewItems}=await submission(d,fields({notes:'Hoping to build in June.'}));
  ok(out.source===DECK_DESIGN_SOURCE&&/website/.test(out.source),'The CRM files the lead under Website');
  ok(out.value===String(Math.round(estimate.subtotal))&&out.estimate_subtotal===estimate.subtotal.toFixed(2)&&out.estimate_total===estimate.total.toFixed(2)&&out.estimate_hst===estimate.hst.toFixed(2),'Value and estimate fields match the estimate');
  ok(out.details.includes(`Open the exact design: ${link}`)&&out.details.includes(summary),'Details carry the reopen link and the plain-language summary');
  ok(reviewItems.every(item=>out.details.includes(`- ${item}`)),'Details list every confirm-before-construction item');
  ok(out.details.includes('Customer notes: Hoping to build in June.')&&out.details.includes('Offers consent: no'),'Details carry the notes and the consent line');
  ok(out.name==='Pat Example'&&out.email==='pat@example.ca'&&out.phone==='705 555 0142'&&out.address==='1 Sample Road, Barrie','Contact fields come from the form');
  ok(!out.design_json.includes('Should Not Travel')&&!out.design_json.includes('9 Hidden Lane')&&!out.design_link.includes('Should'),'The design file and link carry no name or address from the proposal fields');
  const reopened=await decodeDesignLink(designLinkFromHash(new URL(out.design_link).hash)!);
  assert.equal(serializeDeckReleaseDesign(reopened),serializeDeckReleaseDesign(withoutPersonalDetails(d)),'The link in the lead reopens the exact design');checks++;
  ok(Object.values(out).every(v=>typeof v==='string'&&!/undefined|NaN|\[object Object\]/.test(v)),'No field is undefined, NaN or an object');
  ok(out.quote_required===(estimate.quoteRequired??[]).join('; '),'Supplier-quote items travel by name');
}
// A design with a very long review list still fits, with the link, summary and consent intact.
{
  const d=design();const estimate=calculateDeckReleaseEstimate(d),{summary}=describeDesign(d,estimate);
  const out=buildDeckDesignSubmission(fields(),{data:d,estimate,summary,reviewItems:Array.from({length:200},(_,i)=>`Review item ${i} `+'x'.repeat(80)),link:'https://example.test/deck-designer#d=1zabc',sentAt,consent:null});
  ok(out.details.length<=MAX_DETAILS_CHARS&&out.details.includes('#d=1zabc')&&out.details.includes(summary)&&out.details.includes('200 items'),'Oversized review lists are summarised, never the link or summary');
}

// 3. Consent is honest: only "yes" when the wording was shown and ticked; the wording meets SOR/2012-36 s.4.
{
  ok(BUSINESS.contact.mailingAddress.value===null&&offersConsent()===null,'With no mailing address set, no offers consent is asked for');
  ok(offersConsent('')===null&&offersConsent('   ')===null,'A blank address asks for nothing');
  const consent=offersConsent('PO Box 000, Barrie ON')!;
  ok(consent.text.includes(BUSINESS.publicName.value)&&consent.text.includes('PO Box 000, Barrie ON')&&consent.text.includes(publicContact.phoneDisplay)&&consent.text.includes('goldenmaplelandscaping.ca')&&/withdraw this consent at any time/.test(consent.text),'The wording names the business, the mailing address, a phone and website, and says consent can be withdrawn');
  const yes=(await submission(design(),fields({offers:true}),consent)).out,no=(await submission(design(),fields(),consent)).out,unseen=(await submission(design(),fields({offers:true}),null)).out;
  ok(yes.marketing_consent==='yes'&&yes.consent_at===sentAt.toISOString()&&yes.consent_text===consent.text&&yes.consent_version===consent.version&&yes.details.includes(`Offers consent: yes (wording ${consent.version}`),'A ticked box records yes with the exact wording, version and time');
  ok(no.marketing_consent==='no'&&no.consent_at===''&&no.consent_text===consent.text,'An unticked box records no, with the wording that was shown');
  ok(unseen.marketing_consent==='no'&&unseen.consent_text===''&&unseen.details.includes('not asked'),'Consent can never be yes when no wording was shown');
  ok(CONTACT_REQUEST_TEXT.includes(BUSINESS.publicName.value)&&/contact you about this deck design/.test(CONTACT_REQUEST_TEXT),'Sending is stated as a request to be contacted about the design');
}

// 4. The form: the offers box starts unticked, appears only with a mailing address, and the request line is always there.
{
  const d=design(),estimate=calculateDeckReleaseEstimate(d),{summary}=describeDesign(d,estimate),noop=async()=>{};
  const props={data:d,estimate,summary,reviewItems:estimate.flags,send:noop,onPrint:()=>{},onClose:()=>{}};
  const withBox=renderToStaticMarkup(createElement(SendDesignForm,{...props,consent:offersConsent('PO Box 000, Barrie ON')}));
  const withoutBox=renderToStaticMarkup(createElement(SendDesignForm,props));
  const box=/<input type="checkbox"[^>]*><span>Also send me occasional/.exec(withBox)?.[0]??'';
  ok(box&&!/\bchecked\b/.test(box),'The offers box is on the form and starts unticked');
  ok(text(withBox).includes(offersConsent('PO Box 000, Barrie ON')!.text),'Its label is the exact consent wording');
  ok(!text(withoutBox).includes('occasional deck and landscaping offers'),'Without a mailing address there is no offers box');
  ok(text(withBox).includes(CONTACT_REQUEST_TEXT)&&text(withoutBox).includes(CONTACT_REQUEST_TEXT),'The contact-request line is always shown');
  ok(/name="bot-field"/.test(withoutBox)&&/dd-send-trap/.test(withoutBox)&&/aria-hidden="true"/.test(withoutBox),'The honeypot is hidden from people and screen readers');
  ok(/autoComplete|autocomplete="email"/i.test(withoutBox)&&/type="email"/.test(withoutBox)&&/type="tel"/.test(withoutBox),'Email and phone use the right input types');
}

// 5. Entries that the CRM would reject are caught before sending (Netlify says "thank you" either way).
{
  ok(sendFieldsProblem(fields())===null,'A normal entry passes');
  ok(sendFieldsProblem(fields({phone:''}))===null,'Phone is optional');
  for(const [patch,why] of [[{name:''},'no name'],[{name:'7'},'one character'],[{name:'12345'},'digits only'],[{name:'http://spam.example'},'a link as a name'],[{name:'Pat <b>'},'markup in the name'],[{email:''},'no email'],[{email:'pat@'},'a broken email'],[{phone:'555'},'a short phone'],[{notes:'x'.repeat(2001)},'long notes'],[{address:'x'.repeat(201)},'a long address']] as [Partial<SendDesignFields>,string][])
    ok(sendFieldsProblem(fields(patch))!==null,`Refused before sending: ${why}`);
}

// 5b. Timeline, budget and the site's shared lead score reach the CRM, in details as well as in their own fields.
{
  ok(DECK_BUDGETS===PROJECT_BUDGET_RANGES,'Deck budgets are the site\'s shared enquiry ranges');
  const d=design({width:24,length:20,levels:2,siteType:'Hillside',hasDrainage:true});
  ok(designConditions(d).join()==='levels,slope,drainage'&&designConditions(design()).length===0,'Site conditions are named in the words the lead scoring looks for');
  const f=fields({timeline:'within-6-months',budget:'25k-50k',notes:'Access is down the side of the house.'});
  const {out,estimate}=await submission(d,f);
  const want=scoreGoldenMapleLead({budget:'25k-50k',service:'deck',projectType:'deck',conditions:['levels','slope','drainage'],details:'Access is down the side of the house.',city:'1 Sample Road, Barrie',sqft:estimate.model.quantities.area,totalLow:estimate.subtotal,totalHigh:estimate.subtotal});
  ok(out.lead_score===String(want.score)&&out.lead_tier===want.tier&&out.lead_score_reasons===want.reasons.join(','),`The lead score is the site's shared score (${out.lead_tier} ${out.lead_score}: ${out.lead_score_reasons})`);
  ok(want.reasons.includes('premium_service_area')&&want.reasons.includes('complexity_protects_margin'),'A Barrie address and a sloped two-level design score as they do on other forms');
  ok(out.timeline==='within-6-months'&&out.budget==='25k-50k','Timeline and budget travel as their own fields');
  ok(out.details.includes(`Lead: tier ${want.tier} (score ${want.score}`)&&out.details.includes('Timeline: Within 6 months')&&out.details.includes('Budget: $25,000 – $50,000'),'Details carry the lead tier, timeline and budget in words (the CRM keeps only details)');
  const blank=(await submission(design())).out;
  ok(blank.timeline===''&&blank.budget===''&&blank.details.includes('Timeline: not given')&&blank.details.includes('Budget: not given'),'Blank qualifiers send empty fields and say so');
  ok(deckLeadScore(fields(),{data:design(),estimate:calculateDeckReleaseEstimate(design())}).tier===blank.lead_tier,'The score needs no qualifiers');
  ok(sendFieldsProblem(fields({timeline:'yesterday'}))!==null&&sendFieldsProblem(fields({budget:'a lot'}))!==null,'Unknown timeline or budget values are refused');
  ok(DECK_TIMELINES.every(t=>sendFieldsProblem(fields({timeline:t.value}))===null)&&DECK_BUDGETS.every(b=>sendFieldsProblem(fields({budget:b.value}))===null),'Every offered timeline and budget passes');
  // Samples are offered (the crew brings sample boards): the request and its colour reach the team.
  const asked=(await submission(design(),fields({samples:true}))).out,notAsked=(await submission(design(),fields())).out;
  ok(OFFER_SAMPLE_REQUEST&&asked.samples_requested==='yes'&&asked.details.includes(`Samples: please bring a ${design().deckingColor} sample`),'A sample request is sent with the colour to bring');
  ok(notAsked.samples_requested==='no'&&!notAsked.details.includes('Samples:'),'No request, no sample line');
  ok(deckLeadScore(fields(),{data:design(),estimate:calculateDeckReleaseEstimate(design())}).reasons.includes('priority_hardscape_scope'),'A deck is a priority service in the lead score (owner, 2026-09-23)');
  const props={data:design(),estimate:calculateDeckReleaseEstimate(design()),summary:'',reviewItems:[],send:async()=>{},onPrint:()=>{},onClose:()=>{}};
  const html=renderToStaticMarkup(createElement(SendDesignForm,props));
  ok(DECK_TIMELINES.every(t=>html.includes(`value="${t.value}"`))&&DECK_BUDGETS.every(b=>html.includes(`value="${b.value}"`))&&(html.match(/Prefer not to say/g)??[]).length===2,'The form offers every timeline and budget, each optional');
  ok(html.includes(`Please bring a sample of my decking colour (${design().deckingColor})`),'The form offers a sample of the chosen colour');
}

// 6. The designer offers it everywhere it matters, and the booking page picks up the design link.
{
  const page=designerSource(),booking=read('src/components/BookingScheduler.tsx'),privacy=read('src/pages/Privacy.tsx');
  ok(/<header className="dd-header">[\s\S]*?className="dd-send-top"[\s\S]*?Send my design[\s\S]*?<\/header>/.test(page),'The header offers "Send my design"');
  ok(page.includes('className="dd-send-card"')&&page.includes('<SendDesignDialog '),'The estimate step has the send card and the page mounts the dialog');
  ok(page.includes('trackLead(DECK_DESIGN_FORM')&&page.includes("fetch('/'")&&page.includes('getAttributionFields()'),'The page posts to Netlify with attribution and records the lead');
  ok(!page.includes('Talk through your design')&&!page.includes('Discuss this deck'),'The old contact-only links are gone');
  ok(/useLocation\(\)\.state/.test(booking)&&booking.includes('bookingNotes')&&!/searchParams/.test(booking),'The booking form reads the design link from router state, not the URL');
  ok(bookingNotesFor('https://example.test/x').includes('https://example.test/x'),'Booking notes carry the link');
  ok(/deck designer/.test(privacy),'The privacy policy names the deck designer');
}

console.log(`DECK SEND OK — ${declared.size} declared fields, lead content, honest consent, CRM intake rules and wiring; ${checks} checks.`);
