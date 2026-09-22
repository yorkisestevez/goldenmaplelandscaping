import type {DeckData} from './types';
import {getHouseConfig} from './houseSettings';

/** The house footprint along the deck's back line (plan inches; the deck-facing wall is y = 0). */
export interface HouseFootprint{x0:number;x1:number;widthIn:number;depthIn:number;
  /** False when the design never positioned the house: it is centred, as it always was. */
  placed:boolean}

/** Minimum house wall kept against an attached deck so it always has a ledger. */
export const MIN_HOUSE_OVERLAP_IN=24;

/** A positioned house narrower than the deck splits the deck's back (house-line) edge at the
 * house corners, so every outline edge is either wholly against the house or wholly exposed. */
export function splitAtHouseCorners(data:DeckData,outline:{x:number;y:number}[]){
  if(!data.housePlacement)return outline;
  const {x0,x1}=getHousePlacement(data),out:{x:number;y:number}[]=[];
  outline.forEach((a,i)=>{
    out.push(a);const b=outline[(i+1)%outline.length];
    if(Math.abs(a.y)<.5&&Math.abs(b.y)<.5&&b.x>a.x)for(const x of [x0,x1])if(x>a.x+.5&&x<b.x-.5)out.push({x,y:0});
  });
  return out.length===outline.length?outline:out;
}

export function getHousePlacement(data:DeckData):HouseFootprint{
  const house=getHouseConfig(data),W=Math.max(12,(Number(data.width)||0)*12),HW=house.widthFt*12,depthIn=house.depthFt*12;
  const p=data.housePlacement;
  if(!p)return {x0:W/2-HW/2,x1:W/2+HW/2,widthIn:HW,depthIn,placed:false};
  // offsetIn always shifts the house to the right (+) or left (−) of its anchor.
  const wanted=p.anchor==='left'?p.offsetIn:p.anchor==='right'?W+p.offsetIn-HW:W/2-HW/2+p.offsetIn;
  const overlap=Math.min(MIN_HOUSE_OVERLAP_IN,W,HW),x0=Math.min(W-overlap,Math.max(overlap-HW,wanted));
  return {x0,x1:x0+HW,widthIn:HW,depthIn,placed:true};
}
