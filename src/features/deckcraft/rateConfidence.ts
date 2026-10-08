import {CLADDING_RATES,FASCIA_FINISH_RATES,STAIR_FRAME_RATES} from './claddingPricing';
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
export const CONFIRMED_RATES=[
  {id:'crew-day-rate',on:'2026-09-23',note:'Crew day rate: $3,700/day in every area.'},
  {id:'angled-corner-labour',on:'2026-10-08',note:'Angled front corner labour reuses L-Shape / Multi-corner factors as priced.'},
  {id:'porch-wrap-labour',on:'2026-10-08',note:'Porch wraps add ×0.15 on the wrap labour factor; no separate builder-quote line.'},
  {id:'accent-board-labour',on:'2026-10-08',note:'Accent boards default to crew-hours in featureLabour; editable per user.'},
  {id:'inlay-labour',on:'2026-10-08',note:'Decorative inlay labour reuses breaker-board / pattern factors as priced.'},
  {id:'medallion-labour',on:'2026-10-08',note:'Medallion inlays default to crew-hours in featureLabour; editable per user.'},
  {id:'custom-inlay-labour',on:'2026-10-08',note:'Custom inlay fabrication defaults to crew-hours in featureLabour; editable per user.'},
  {id:'skirting',on:'2026-10-08',note:'Deck skirting priced from SKIRTING_RATES (face, backing, panels, labour).'},
  {id:'railing-colour',on:'2026-10-08',note:'Manufacturer railing colours offered with supplier-confirmation note; no rate premium in the book.'},
  {id:'frameless-glass',on:'2026-10-08',note:'Frameless glass supply stays a supplier quote; install labour uses the Glass Panels basis until a glass package rate is set.'},
  {id:'hd-connectors',on:'2026-10-08',note:'Home Depot Canada framing connector retail benchmarks priced on 2026-10 designs.'},
  {id:'hd-posts',on:'2026-10-08',note:'Home Depot Canada PT 6×6 support post stock priced on 2026-10 designs.'},
  {id:'g-tape',on:'2026-10-08',note:'G-Tape 3040BK framing protection priced from Deck Shoppe Canada retail on 2026-10 designs.'},
  {id:'stair-cladding-finish',on:'2026-10-08',note:`Stair/level cladding finish: labour $${CLADDING_RATES.labourPerSqft}/sq ft, fasteners $${CLADDING_RATES.fastenersPerSqft}/sq ft, delivery $${CLADDING_RATES.delivery} when supply is priced.`},
  {id:'stair-frame-detail',on:'2026-10-08',note:`Stair picture-frame net premium: mitre $${STAIR_FRAME_RATES.mitreLabourPerLf}/lf, fasteners $${STAIR_FRAME_RATES.fastenersPerLf}/lf, delivery $${STAIR_FRAME_RATES.delivery}; different-collection border boards supplied separately.`},
  {id:'fascia-finish',on:'2026-10-08',note:`Fascia fasteners $${FASCIA_FINISH_RATES.fastenersPerBoard}/board and delivery $${FASCIA_FINISH_RATES.delivery} when fascia supply is priced.`},
  {id:'manufacturer-accessories',on:'2026-10-08',note:'Selected manufacturer deck accessories stay supplier quotes for branded product pricing.'},
  {id:'under-deck-site-quotes',on:'2026-10-08',note:'Under-deck supply can be priced; site discharge, waterproofing and ground/freight confirmations stay builder quotes.'},
] as const;
export interface RateNote{id:string;rate:string;value:string;status:RateStatus;where:string;note:string}

const tier=(id:string)=>MATERIAL_TIERS.find(m=>m.id===id);
const perSqft=(id:string)=>`$${tier(id)?.costPerSqft?.toFixed(2)}/sq ft`;

/** Still open: order-specific retail benches that need supplier confirmation on the configured colour/stock. */
export function unconfirmedRates():RateNote[]{
  return [
    {id:'cedar',rate:'Western Red Cedar decking',value:perSqft('cedar'),status:'estimate',where:'types.ts MATERIAL_TIERS (cedar)',
      note:'A market-rate estimate: cedar is not stocked at Carr. Confirm with a supplier.'},
    {id:'tt-reserve',rate:'TimberTech PRO Reserve decking',value:perSqft('tt_reserve'),status:'estimate',where:'supplierRates.ts DECKING_RATE_SOURCES (tt_reserve)',
      note:'2026-10-08 DeckMart recheck: RCGV5412AL still $103.54 regular retail. Confirm colour, profile, lengths and delivery on order; this is not a Carr trade quote.'},
    {id:'tt-terrain',rate:'TimberTech Terrain decking',value:perSqft('tt_terrain'),status:'estimate',where:'supplierRates.ts DECKING_RATE_SOURCES (tt_terrain)',
      note:'2026-10-08 DeckMart recheck: TCGV5412SM sale $59.25 / compare-at $74.06 — book keeps $74.06 (clearance excluded). Terrain+ remains its own collection. Confirm the configured supply order.'},
    {id:'fascia-boards',rate:'Fascia boards in a chosen colour',value:`${Object.keys(FASCIA_RETAIL_RATES).length} TimberTech colour SKUs have dated DeckMart retail benchmarks; Deckorators and unmatched colours need a supplier quote`,status:'estimate',where:'supplierRates.ts FASCIA_RETAIL_RATES',
      note:'Owner 2026-10-08: DeckMart fascia retail benchmarks. Fitting in labour; fasteners and delivery priced when supply is known. Harvest Kona, Vintage Cypress and Deckorators fascia still need a quote.'},
  ];
}
