import {fasciaSupply} from './fasciaPricing';
import type {SkirtingPlan} from './skirting';

/**
 * Skirting rates (owner 2026-10-08): face supply from fascia/decking benchmarks where known,
 * backing and labour as Barrie install allowances. Access panels are a fixed fabrication rate.
 * Changing these is a price-book change (scripts/check-deck-price-book.ts).
 */
export const SKIRTING_RATES={
  backingPerLf:3.85,
  labourPerLf:32,
  accessPanelEach:145,
  latticeFacePerSqft:9.5,
  boardFacePerSqft:14.5,
} as const;

const round2=(n:number)=>Math.round(n*100)/100;

/** Priced skirting schedule rows. Face uses fascia retail when the colour matches; otherwise the board/lattice allowance. */
export function pricedSkirtingRows(plan:SkirtingPlan,markup:number):{name:string;spec:string;qty:number;unit:string;cost:number|null}[]{
  if(!plan.runs.length)return [];
  const lf=round2(plan.lengthFt),face=round2(plan.faceSqft),n=plan.accessPanels.placed;
  const fascia=plan.style!=='Lattice'?fasciaSupply(plan.colour,plan.faces.map(f=>{
    const len=Math.hypot(f.b.x-f.a.x,f.b.y-f.a.y),h=Math.max(f.topA-f.bottomA,f.topB-f.bottomB);
    return {lengthIn:len,heightIn:h};
  }),markup):null;
  const faceCost=fascia?.cost??face*(plan.style==='Lattice'?SKIRTING_RATES.latticeFacePerSqft:SKIRTING_RATES.boardFacePerSqft)*markup;
  const faceSpec=fascia
    ?`Fascia-matched face from DeckMart retail benchmark (${fascia.rate.sku}); ${fascia.boards} × 12 ft boards including 10% order allowance. Confirm colour and profile on order.`
    :`${plan.style==='Lattice'?'Lattice panels':'Solid deck boards'} in the chosen skirting colour, from the rim to the clearance above grade. Confirm supplier stock.`;
  return [
    {name:'Skirting face',spec:faceSpec+(plan.foldedCorners?' Folded solid-board corners: confirm fabrication with the builder.':''),qty:fascia?.boards??face,unit:fascia?'boards':'sq ft',cost:round2(faceCost)},
    {name:'Skirting backing',spec:`Pressure-treated 2×4 backing at $${SKIRTING_RATES.backingPerLf.toFixed(2)}/lf.`,qty:round2(plan.backingLf),unit:'lf',cost:round2(plan.backingLf*SKIRTING_RATES.backingPerLf*markup)},
    ...(n?[{name:'Skirting access panels',spec:`Framed removable panels, ${plan.accessPanels.widthIn} in wide, at $${SKIRTING_RATES.accessPanelEach}/panel fabrication allowance.`,qty:n,unit:n===1?'panel':'panels',cost:round2(n*SKIRTING_RATES.accessPanelEach*markup)}]:[]),
    {name:'Skirting labour',spec:`Frame and fit ${lf} ft of skirting at $${SKIRTING_RATES.labourPerLf}/lf (Barrie install allowance).`,qty:lf,unit:'lf',cost:round2(lf*SKIRTING_RATES.labourPerLf*markup)},
  ];
}
