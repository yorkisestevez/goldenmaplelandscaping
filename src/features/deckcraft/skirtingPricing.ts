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
    ?`DeckMart ${fascia.rate.sku}; ${fascia.boards} × 12 ft boards, 10% order allowance.`
    :`${plan.style==='Lattice'?'Lattice':'Boards'} in the skirting colour.`;
  return [
    {name:'Skirting face',spec:faceSpec+(plan.foldedCorners?' Folded corners: confirm fabrication.':''),qty:fascia?.boards??face,unit:fascia?'boards':'sq ft',cost:round2(faceCost)},
    {name:'Skirting backing',spec:`2×4 backing at $${SKIRTING_RATES.backingPerLf.toFixed(2)}/lf.`,qty:round2(plan.backingLf),unit:'lf',cost:round2(plan.backingLf*SKIRTING_RATES.backingPerLf*markup)},
    ...(n?[{name:'Skirting access panels',spec:`${plan.accessPanels.widthIn} in panels at $${SKIRTING_RATES.accessPanelEach} each.`,qty:n,unit:n===1?'panel':'panels',cost:round2(n*SKIRTING_RATES.accessPanelEach*markup)}]:[]),
    {name:'Skirting labour',spec:`${lf} ft at $${SKIRTING_RATES.labourPerLf}/lf.`,qty:lf,unit:'lf',cost:round2(lf*SKIRTING_RATES.labourPerLf*markup)},
  ];
}
