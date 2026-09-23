import {chamferLabourFactor} from './lib/cornerChamfers';
import {CREW_DAY_RATES,MATERIAL_TIERS} from './types';

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
export interface RateNote{id:string;rate:string;value:string;status:RateStatus;where:string;note:string}

const tier=(id:string)=>MATERIAL_TIERS.find(m=>m.id===id);
const perSqft=(id:string)=>`$${tier(id)?.costPerSqft?.toFixed(2)}/sq ft`;

export function unconfirmedRates():RateNote[]{
  const areas=[...new Set(Object.values(CREW_DAY_RATES))];
  const one=chamferLabourFactor({leftIn:48,rightIn:0,reduced:false,shrunk:false}),two=chamferLabourFactor({leftIn:48,rightIn:48,reduced:false,shrunk:false});
  return [
    {id:'crew-day-rate',rate:'Crew day rate (all labour)',value:areas.length===1?`$${areas[0].toLocaleString('en-CA')}/day in every area`:areas.map(v=>`$${v}`).join(' / '),status:'conflict',where:'types.ts CREW_DAY_RATES',
      note:'The code comments say the owner set the deck crew day to $3,000 all-in on 2026-07-27, but every estimate uses the value shown. Confirm which is right; the parity report shows the effect of a change on every design.'},
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
