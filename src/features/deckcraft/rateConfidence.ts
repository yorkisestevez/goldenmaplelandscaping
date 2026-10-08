import {chamferLabourFactor} from './lib/cornerChamfers';
import {FASCIA_RETAIL_RATES} from './supplierRates';
import {MATERIAL_TIERS} from './types';

/**
 * Rates the deck estimate uses today that the owner has not confirmed: the list to settle with the owner.
 * Nothing public shows it (`npm run deck:rates` prints it). Values are read from the live tables, so the
 * list cannot drift from what the estimate actually charges.
 *
 * Confirming a rate as it stands changes nothing. Changing one is a price change: run
 * `tsx scripts/check-deck-legacy-parity.ts --report` to see its effect on every legacy design, then, with
 * the owner's approval, update the golden (--update) and PRICE_BOOK (priceBook.ts).
 */
export type RateStatus='conflict'|'estimate'|'unconfirmed'|'owner-decision';
/** Rates the owner has confirmed as they stand, kept out of the list (and why). */
export const CONFIRMED_RATES=[{id:'crew-day-rate',on:'2026-09-23',note:'Crew day rate: $3,700/day in every area.'}] as const;
export interface RateNote{id:string;rate:string;value:string;status:RateStatus;where:string;note:string}

const tier=(id:string)=>MATERIAL_TIERS.find(m=>m.id===id);
const perSqft=(id:string)=>`$${tier(id)?.costPerSqft?.toFixed(2)}/sq ft`;

export function unconfirmedRates():RateNote[]{
  const one=chamferLabourFactor({leftIn:48,rightIn:0,reduced:false,shrunk:false}),two=chamferLabourFactor({leftIn:48,rightIn:48,reduced:false,shrunk:false});
  return [
    {id:'cedar',rate:'Western Red Cedar decking',value:perSqft('cedar'),status:'estimate',where:'types.ts MATERIAL_TIERS (cedar)',
      note:'A market-rate estimate: cedar is not stocked at Carr. Confirm with a supplier.'},
    {id:'tt-reserve',rate:'TimberTech PRO Reserve decking',value:perSqft('tt_reserve'),status:'estimate',where:'supplierRates.ts DECKING_RATE_SOURCES (tt_reserve)',
      note:'2026-10-08 DeckMart recheck: RCGV5412AL still $103.54 regular retail. Confirm colour, profile, lengths and delivery on order; this is not a Carr trade quote.'},
    {id:'tt-terrain',rate:'TimberTech Terrain decking',value:perSqft('tt_terrain'),status:'estimate',where:'supplierRates.ts DECKING_RATE_SOURCES (tt_terrain)',
      note:'2026-10-08 DeckMart recheck: TCGV5412SM sale $59.25 / compare-at $74.06 — book keeps $74.06 (clearance excluded). Terrain+ remains its own collection. Confirm the configured supply order.'},
    {id:'angled-corner-labour',rate:'Angled front corner labour',value:`×${one.toFixed(2)} one corner, ×${two.toFixed(2)} two`,status:'owner-decision',where:'lib/cornerChamfers.ts chamferLabourFactor',
      note:'Reuses the L-Shape and Multi-corner labour factors. Awaiting the owner\'s sign-off.'},
    {id:'porch-wrap-labour',rate:'Porch wrap labour premium',value:'+0.15 on the one- or two-corner wrap labour factor',status:'owner-decision',where:'lib/wrapGeometry.ts wrapLabourFactor',
      note:'Owner 2026-10-08: porch wraps add ×0.15 instead of a separate builder-quote line. Confirm in the field before locking long-term.'},
    {id:'accent-board-labour',rate:'Accent-colour board labour',value:'Man-hours + materials by default (2 people × 0.25 h/board @ $3,700÷27); editable per user in Owner costs',status:'owner-decision',where:'featureLabour.ts; calculations.ts (accent-colour boards)',
      note:'Owner 2026-10-08: defaults to crew-hours. Boards priced at collection rate. Edit crew/hours/materials or switch to builder-quote mode in Owner costs · Inlays & special features (Save as my defaults for this device).'},
    {id:'inlay-labour',rate:'Decorative inlay labour',value:'Breaker-board rate (1.5 crew-hours per 10 ft) on each frame\'s fitted edge and each cut-in band\'s length, plus the inside at its pattern\'s labour factor over the deck\'s',status:'owner-decision',where:'lib/inlayGeometry.ts inlayCrewDays',
      note:'Reuses existing rates, as the owner chose on 2026-09-23. A band of recoloured rows across a straight deck adds none. Medallion/custom fabrication uses featureLabour defaults instead.'},
    {id:'medallion-labour',rate:'Medallion inlay labour',value:'Man-hours + materials by default (2 people × 4 h/medallion @ $3,700÷27); editable per user in Owner costs',status:'owner-decision',where:'featureLabour.ts; calculations.ts (medallion inlays)',
      note:'Owner 2026-10-08: defaults to crew-hours. Boards and solid blocking are priced. Edit or switch to quote mode in Owner costs · Inlays & special features.'},
    {id:'custom-inlay-labour',rate:'Custom inlay fabrication labour',value:'Man-hours + materials by default (2 people × 6 h/inlay @ $3,700÷27); editable per user in Owner costs',status:'owner-decision',where:'featureLabour.ts; calculations.ts (custom inlays)',
      note:'Owner 2026-10-08: defaults to crew-hours for custom/rotated fabrication. Edit crew/hours/materials or switch to builder-quote mode in Owner costs · Inlays & special features (Save as my defaults for this device).'},
    {id:'skirting',rate:'Deck skirting (face, backing, access panels and labour)',value:'Priced: face supply, $3.85/lf backing, $145/panel, $32/lf labour',status:'owner-decision',where:'skirtingPricing.ts SKIRTING_RATES',
      note:'Owner 2026-10-08: skirting is priced from SKIRTING_RATES. Face uses fascia retail when the colour matches. Confirm supplier stock and install before a final quote.'},
    {id:'fascia-boards',rate:'Fascia boards in a chosen colour',value:`${Object.keys(FASCIA_RETAIL_RATES).length} TimberTech colour SKUs have dated DeckMart retail benchmarks; Deckorators and unmatched colours need a supplier quote`,status:'estimate',where:'supplierRates.ts FASCIA_RETAIL_RATES',
      note:'Owner 2026-10-08: expanded from DeckMart product.js (regular retail; sale/compare-at excluded). Stock cutting and a 10% ordering allowance. Fascia fitting stays in existing labour. Stair/level cladding fitting, fasteners and delivery stay as Quote Review crew-hours — no fixed install rate. Harvest Kona, Vintage Cypress and Deckorators fascia still need a quote.'},
    {id:'railing-colour',rate:'Manufacturer railing colours',value:'No change to the railing rate; the supplier confirms availability and any colour premium',status:'owner-decision',where:'deckPartFinishes.ts (railing colours)',
      note:'Eight lines (five TimberTech, three Deckorators) are not confirmed as sold in Canada; the owner chose to offer them with a supplier-confirmation note. Intake: npm run deck:rate-intake.'},
    {id:'frameless-glass',rate:'Frameless glass railing (glass, shoe or spigots, stair handrail)',value:'Supplier quote; installation labour on the Glass Panels basis (20 ft per crew-day and its ×1.40 on the job)',status:'owner-decision',where:'calculations.ts (frameless glass)',
      note:'The price book and the Carr data have no frameless glass rate. The owner chose on 2026-09-25 to list it for a supplier quote and reuse the Glass Panels labour until a rate is set; setting one is a price-book change. Intake: npm run deck:rate-intake.'},
  ];
}
