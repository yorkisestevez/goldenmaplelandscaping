import {BUSINESS,publicContact} from '../../data/business';
import {designLinkJson} from './designLink';
import type {DeckEstimate} from './designFacts';
import type {DeckData} from './types';

/**
 * "Send my design to Golden Maple": the `deck-design` Netlify form. Netlify stores the submission and
 * its `submission-created` function relays it to the CRM, which keeps name, email, phone, address,
 * details and value. So `details` carries what the team needs: a link that reopens the exact design,
 * the plain-language summary with the priced estimate, the review items, the customer's notes and
 * the consent record. Every key built here is declared in public/__forms.html, the form's only schema.
 */
export const DECK_DESIGN_FORM='deck-design';
/** The CRM infers the lead source from this: it contains "website", so the lead is filed under Website. */
export const DECK_DESIGN_SOURCE='website-deck-designer';
export const MAX_DETAILS_CHARS=12_000;
/** Every form field besides the honeypot and the shared attribution and behaviour fields. */
export const DECK_DESIGN_FIELDS=['name','email','phone','address','details','value','source','event_id','design_link','design_json','estimate_subtotal','estimate_hst','estimate_total','quote_required','review_items','marketing_consent','consent_text','consent_version','consent_at'] as const;

export interface SendDesignFields{name:string;email:string;phone:string;address:string;notes:string;offers:boolean;botField:string}
export interface OffersConsent{version:string;text:string}

/** Shown above the send button: sending is the customer's request to be contacted about this design. */
export const CONTACT_REQUEST_TEXT=`By sending, you ask ${BUSINESS.publicName.value} to contact you about this deck design.`;

/**
 * The offers-consent wording, or null when there is no mailing address to show. A request for consent
 * must name the business, give a mailing address and a phone, email or web address, and say consent
 * can be withdrawn (SOR/2012-36 s.4).
 */
export function offersConsent(mailingAddress:string|null=BUSINESS.contact.mailingAddress.value):OffersConsent|null{
  const address=mailingAddress?.trim();
  if(!address)return null;
  const site=BUSINESS.canonicalUrl.replace(/^https?:\/\//,'');
  return {version:'2026-09-v1',text:`Also send me occasional deck and landscaping offers from ${BUSINESS.publicName.value}, ${address}, ${publicContact.phoneDisplay}, ${site}. You can withdraw this consent at any time.`};
}

/**
 * What is wrong with the customer's entries, or null. It follows the CRM's intake rules (a name with a
 * letter and no link; a phone, when given, with at least 7 digits) so a real customer is never dropped
 * after Netlify has already said "thank you".
 */
export function sendFieldsProblem(f:SendDesignFields):string|null{
  const name=f.name.trim();
  if(name.length<2||!/[a-zA-Z]/.test(name))return 'Please enter your name.';
  if(/https?:|www\.|[<>]/i.test(name))return 'Please enter just your name.';
  if(name.length>120)return 'Please shorten your name to 120 characters.';
  const email=f.email.trim();
  if(email.length>180||!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))return 'Please enter a valid email address so we can reply.';
  const digits=f.phone.replace(/\D/g,'');
  if(f.phone.trim()&&(digits.length<7||digits.length>15))return 'Please check the phone number, or leave it blank.';
  if(f.address.trim().length>200)return 'Please shorten the project address to 200 characters.';
  if(f.notes.trim().length>2000)return 'Please keep your notes under 2,000 characters.';
  return null;
}

export interface SendContext{data:DeckData;estimate:DeckEstimate;summary:string;reviewItems:string[];link:string;sentAt:Date;consent:OffersConsent|null}

/** The deck-design submission. Offers consent is only ever "yes" when the wording was on screen and ticked. */
export function buildDeckDesignSubmission(f:SendDesignFields,ctx:SendContext):Record<string,string>{
  const offers=!!(ctx.consent&&f.offers),at=ctx.sentAt.toISOString();
  const consentLine=!ctx.consent?'Offers consent: not asked (no mailing address set)':offers?`Offers consent: yes (wording ${ctx.consent.version}, ${at})`:'Offers consent: no';
  const head=[`DeckCraft design sent from the website deck designer on ${at.slice(0,10)}.`,`Open the exact design: ${ctx.link}`,'',ctx.summary];
  const tail=['',`Customer notes: ${f.notes.trim()||'none'}`,consentLine];
  const review=ctx.reviewItems.length?['','Confirm before construction:',...ctx.reviewItems.map(item=>`- ${item}`)]:[];
  let details=[...head,...review,...tail].join('\n');
  // Review items are the only long part; the link, summary, notes and consent always fit.
  if(details.length>MAX_DETAILS_CHARS)details=[...head,'',`Confirm before construction: ${ctx.reviewItems.length} items (listed on the design).`,...tail].join('\n');
  return {
    'form-name':DECK_DESIGN_FORM,'bot-field':f.botField,
    name:f.name.trim(),email:f.email.trim(),phone:f.phone.trim(),address:f.address.trim(),
    source:DECK_DESIGN_SOURCE,details,value:String(Math.round(ctx.estimate.subtotal)),
    design_link:ctx.link,design_json:designLinkJson(ctx.data),
    estimate_subtotal:ctx.estimate.subtotal.toFixed(2),estimate_hst:ctx.estimate.hst.toFixed(2),estimate_total:ctx.estimate.total.toFixed(2),
    quote_required:(ctx.estimate.quoteRequired??[]).join('; '),review_items:ctx.reviewItems.join(' | '),
    marketing_consent:offers?'yes':'no',consent_text:ctx.consent?.text??'',consent_version:ctx.consent?.version??'',consent_at:offers?at:'',
  };
}

/** Booking notes when the customer books a call right after sending. */
export const bookingNotesFor=(link:string)=>`I sent my deck design from the online designer. Reopen it here: ${link}`;
