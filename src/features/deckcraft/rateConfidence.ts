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
    {id:'tt-reserve',rate:'TimberTech PRO Reserve decking',value:`${perSqft('tt_reserve')} (the same as Terrain+)`,status:'unconfirmed',where:'types.ts MATERIAL_TIERS (tt_reserve)',
      note:'The price book lists Reserve on the Terrain+ price ladder. Confirm the Reserve price with Carr.'},
    {id:'tt-terrain',rate:'TimberTech Terrain decking',value:perSqft('tt_terrain'),status:'unconfirmed',where:'manufacturerCatalog.ts (tt_terrain)',
      note:'The legacy price-book entry was labelled Terrain+; the rate is kept pending supplier confirmation.'},
    {id:'angled-corner-labour',rate:'Angled front corner labour',value:`×${one.toFixed(2)} one corner, ×${two.toFixed(2)} two`,status:'owner-decision',where:'lib/cornerChamfers.ts chamferLabourFactor',
      note:'Reuses the L-Shape and Multi-corner labour factors. Awaiting the owner\'s sign-off.'},
    {id:'porch-wrap-labour',rate:'Porch wrap labour premium',value:'Builder quote (labour priced at the two-corner wrap factor)',status:'owner-decision',where:'calculations.ts (porch wrap)',
      note:'Listed for a builder quote until the owner sets a factor.'},
  ];
}
