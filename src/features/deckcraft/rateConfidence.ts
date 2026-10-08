import {chamferLabourFactor} from './lib/cornerChamfers';
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
      note:'September 26 review uses the current DeckMart retail benchmark, not the copied Terrain rate. Confirm colour, profile, lengths and delivery on order; this is not a Carr trade quote.'},
    {id:'tt-terrain',rate:'TimberTech Terrain decking',value:perSqft('tt_terrain'),status:'estimate',where:'supplierRates.ts DECKING_RATE_SOURCES (tt_terrain)',
      note:'September 26 review uses the current DeckMart regular retail benchmark for Terrain; clearance pricing excluded. Terrain+ remains its own collection. Confirm the configured supply order.'},
    {id:'angled-corner-labour',rate:'Angled front corner labour',value:`×${one.toFixed(2)} one corner, ×${two.toFixed(2)} two`,status:'owner-decision',where:'lib/cornerChamfers.ts chamferLabourFactor',
      note:'Reuses the L-Shape and Multi-corner labour factors. Awaiting the owner\'s sign-off.'},
    {id:'porch-wrap-labour',rate:'Porch wrap labour premium',value:'+0.15 on the one- or two-corner wrap labour factor',status:'owner-decision',where:'lib/wrapGeometry.ts wrapLabourFactor',
      note:'Owner 2026-10-08: porch wraps add ×0.15 instead of a separate builder-quote line. Confirm in the field before locking long-term.'},
    {id:'accent-board-labour',rate:'Accent-colour board labour',value:'Crew-hours entry in Quote Review (boards priced at their collection rate)',status:'owner-decision',where:'calculations.ts (accent-colour boards); designer/quoteLabourHours.ts',
      note:'Owner 2026-10-08: no fixed price-book labour rate. Enter crew members × extra hours × person-hour rate (default $3,700/27) and any extra materials in Review quote costs.'},
    {id:'inlay-labour',rate:'Decorative inlay labour',value:'Breaker-board rate (1.5 crew-hours per 10 ft) on each frame\'s fitted edge and each cut-in band\'s length, plus the inside at its pattern\'s labour factor over the deck\'s',status:'owner-decision',where:'lib/inlayGeometry.ts inlayCrewDays',
      note:'Reuses existing rates, as the owner chose on 2026-09-23. A band of recoloured rows across a straight deck adds none. A dedicated inlay rate would replace it.'},
    {id:'medallion-labour',rate:'Medallion inlay labour',value:'Crew-hours entry in Quote Review (boards and solid blocking are priced)',status:'owner-decision',where:'calculations.ts (medallion inlays); designer/quoteLabourHours.ts',
      note:'Owner 2026-10-08: no fixed price-book labour rate. Enter crew members × extra hours × person-hour rate (default $3,700/27) and any extra materials in Review quote costs.'},
    {id:'skirting',rate:'Deck skirting (face, backing, access panels and labour)',value:'Priced: face supply, $3.85/lf backing, $145/panel, $32/lf labour',status:'owner-decision',where:'skirtingPricing.ts SKIRTING_RATES',
      note:'Owner 2026-10-08: skirting is priced from SKIRTING_RATES. Face uses fascia retail when the colour matches. Confirm supplier stock and install before a final quote.'},
    {id:'fascia-boards',rate:'Fascia boards in a chosen colour',value:'Two exact colour SKUs have dated retail supply benchmarks; all others need a supplier quote',status:'estimate',where:'supplierRates.ts FASCIA_RETAIL_RATES',
      note:'Prime+ Coconut Husk and Reserve Antique Leather supply use stock cutting and a 10% ordering allowance. Fascia fitting stays in existing labour. Stair/level cladding fitting, fasteners and delivery stay as Quote Review crew-hours (or total) entries — no fixed install rate in the book.'},
    {id:'railing-colour',rate:'Manufacturer railing colours',value:'No change to the railing rate; the supplier confirms availability and any colour premium',status:'owner-decision',where:'deckPartFinishes.ts (railing colours)',
      note:'Eight lines (five TimberTech, three Deckorators) are not confirmed as sold in Canada; the owner chose to offer them with a supplier-confirmation note.'},
    {id:'frameless-glass',rate:'Frameless glass railing (glass, shoe or spigots, stair handrail)',value:'Supplier quote; installation labour on the Glass Panels basis (20 ft per crew-day and its ×1.40 on the job)',status:'owner-decision',where:'calculations.ts (frameless glass)',
      note:'The price book and the Carr data have no frameless glass rate. The owner chose on 2026-09-25 to list it for a supplier quote and reuse the Glass Panels labour until a rate is set; setting one is a price-book change.'},
  ];
}
