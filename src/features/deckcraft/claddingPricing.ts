/**
 * Stair/level cladding and stair picture-frame fabrication rates (owner 2026-10-08 finish pass).
 * Fascia board supply stays on fasciaSupply / DeckMart retail when the colour is sourced.
 * Changing these is a price-book change (scripts/check-deck-price-book.ts).
 */
export const CLADDING_RATES={
  /** Barrie install allowance to fit fascia cladding on stair sides, step ends and level drops. */
  labourPerSqft:28,
  /** Colour-matched fastener / trim allowance on clad faces. */
  fastenersPerSqft:1.85,
  /** Planning delivery/handling when cladding boards are on the order. */
  delivery:85,
} as const;

/**
 * Stair picture-frame detail: the Stairs riser allowance already covers generic tread supply/install.
 * These rates are the net premium for mitred border fabrication, fasteners and delivery.
 * A border from a different collection also charges that collection's board supply.
 */
export const STAIR_FRAME_RATES={
  mitreLabourPerLf:22,
  fastenersPerLf:1.5,
  delivery:65,
} as const;

/** Fascia fastener packs + delivery when rim fascia supply is already priced. */
export const FASCIA_FINISH_RATES={
  fastenersPerBoard:12.5,
  delivery:75,
} as const;

const round2=(n:number)=>Math.round(n*100)/100;

export type PricedRow={name:string;spec:string;qty:number;unit:string;cost:number};

/** Install, fasteners and delivery for stair/level cladding once supply is known. */
export function pricedCladdingFinish(sqft:number,boards:number,markup:number):PricedRow[]{
  const area=round2(sqft);
  if(area<.1)return [];
  return [
    {name:'Stair and level cladding labour',spec:`Fit ${area} sq ft of fascia cladding (stair sides, step ends, level drops) at $${CLADDING_RATES.labourPerSqft}/sq ft Barrie install allowance.`,qty:area,unit:'sqft',cost:round2(area*CLADDING_RATES.labourPerSqft*markup)},
    {name:'Stair and level cladding fasteners',spec:`Colour-matched fastener / trim allowance at $${CLADDING_RATES.fastenersPerSqft.toFixed(2)}/sq ft.`,qty:area,unit:'sqft',cost:round2(area*CLADDING_RATES.fastenersPerSqft*markup)},
    ...(boards>0?[{name:'Stair and level cladding delivery',spec:`Planning delivery/handling allowance $${CLADDING_RATES.delivery} when cladding boards are on the order.`,qty:1,unit:'allowance',cost:round2(CLADDING_RATES.delivery*markup)}]:[]),
  ];
}

/** Mitre premium (+ optional different-collection board supply) for stair picture-frame borders. */
export function pricedStairFrameDetail(opts:{
  installedLf:number;
  orderedLf:number;
  orderedPieces:number;
  section:string;
  markup:number;
  /** Board supply CAD before markup when the border is a different collection than field treads; null when credited in the stair allowance. */
  borderSupplyCad:number|null;
}):PricedRow[]{
  const lf=round2(opts.installedLf);
  if(lf<.05)return [];
  const rows:PricedRow[]=[
    {name:'Stair picture-frame mitre labour',spec:`Mitre, backing and fit ${lf} lf of stair picture-frame border at $${STAIR_FRAME_RATES.mitreLabourPerLf}/lf. Credits the Stairs assembly allowance for generic tread install — this is the net fabrication premium. ${opts.section}`,qty:lf,unit:'lf',cost:round2(lf*STAIR_FRAME_RATES.mitreLabourPerLf*opts.markup)},
    {name:'Stair picture-frame fasteners',spec:`Colour-matched fastener allowance at $${STAIR_FRAME_RATES.fastenersPerLf.toFixed(2)}/lf on the framed stair border.`,qty:lf,unit:'lf',cost:round2(lf*STAIR_FRAME_RATES.fastenersPerLf*opts.markup)},
    {name:'Stair picture-frame delivery',spec:`Planning delivery/handling allowance $${STAIR_FRAME_RATES.delivery} for the framed stair border stock.`,qty:1,unit:'allowance',cost:round2(STAIR_FRAME_RATES.delivery*opts.markup)},
  ];
  if(opts.borderSupplyCad!==null&&opts.borderSupplyCad>0){
    rows.unshift({name:'Stair picture-frame border boards',spec:`Border collection supply for ${opts.orderedPieces} stock boards (${opts.orderedLf.toFixed(1)} lf ordered). Different collection from field treads — not credited in the generic stair allowance. ${opts.section}`,qty:opts.orderedPieces,unit:'boards',cost:round2(opts.borderSupplyCad*opts.markup)});
  }
  return rows;
}

export function pricedFasciaFinish(boards:number,markup:number):PricedRow[]{
  if(boards<=0)return [];
  return [
    {name:'Fascia fasteners',spec:`Colour-matched fascia fastener packs at $${FASCIA_FINISH_RATES.fastenersPerBoard.toFixed(2)}/board planning allowance.`,qty:boards,unit:'boards',cost:round2(boards*FASCIA_FINISH_RATES.fastenersPerBoard*markup)},
    {name:'Fascia delivery',spec:`Planning delivery/handling allowance $${FASCIA_FINISH_RATES.delivery} for fascia stock.`,qty:1,unit:'allowance',cost:round2(FASCIA_FINISH_RATES.delivery*markup)},
  ];
}
