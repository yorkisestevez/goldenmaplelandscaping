import type {DeckData} from '../types';
import {isCustomAngledEdgeId} from './customOutline';

/**
 * 45° angled front corners on the main deck (the corners away from the house). Each leg is cut back
 * equally along the front edge and the side edge; the angled face is leg × √2. Rectangles only: a stored
 * value on another shape is kept but inactive, as corner cut-outs are. Every consumer reads the ACTIVE
 * value from here, never data.cornerChamfers directly. Pure data, no three.js.
 */
export const CORNER_CHAMFER_FT=[2,30] as const;
/** A leg that clamping shrinks below this is dropped rather than drawn as a sliver. */
const MIN_BUILT_LEG_IN=12;
/** `shrunk`: a built leg is shorter than asked. `dropped`: a corner that was asked for but is too small
 * to cut, so it stays square. `reduced`: either. */
export interface ActiveChamfers{leftIn:number;rightIn:number;reduced:boolean;shrunk:boolean;dropped?:'front left'|'front right'}

/** The angled corners as built, in inches, or null for square corners. Clamped to fit the deck:
 * each leg leaves at least 36 in of straight side edge, and the two legs leave 24 in of front edge.
 * A corner too small to cut stays square and gives its share of the front back to the other corner. */
export function activeCornerChamfers(data:DeckData):ActiveChamfers|null{
  const c=data.cornerChamfers;
  if(!c||data.shape!=='Rectangle')return null;
  const asked={l:Math.max(0,Number(c.frontLeftFt)||0)*12,r:Math.max(0,Number(c.frontRightFt)||0)*12};
  if(asked.l<=0&&asked.r<=0)return null;
  const W=Math.max(12,(Number(data.width)||0)*12),L=Math.max(12,(Number(data.length)||0)*12);
  const maxLeg=Math.max(0,L-36),room=Math.max(0,W-24);
  let l=Math.min(asked.l,maxLeg),r=Math.min(asked.r,maxLeg);
  if(l+r>room){const k=room/(l+r);l*=k;r*=k;}
  if(l<MIN_BUILT_LEG_IN&&r>=MIN_BUILT_LEG_IN)r=Math.min(asked.r,maxLeg,room);
  if(r<MIN_BUILT_LEG_IN&&l>=MIN_BUILT_LEG_IN)l=Math.min(asked.l,maxLeg,room);
  if(l<MIN_BUILT_LEG_IN)l=0;
  if(r<MIN_BUILT_LEG_IN)r=0;
  if(!l&&!r)return null;
  const dropped=asked.l>0&&!l?'front left' as const:asked.r>0&&!r?'front right' as const:undefined;
  const shrunk=(l>0&&l<asked.l-.01)||(r>0&&r<asked.r-.01);
  return {leftIn:l,rightIn:r,reduced:shrunk||!!dropped,shrunk,...(dropped?{dropped}:{})};
}

export const chamferCount=(a:ActiveChamfers|null)=>!a?0:(a.leftIn>0?1:0)+(a.rightIn>0?1:0);
/** Labour reuses existing shape factors, no new rate: one angled corner prices like an L-shape
 * (×1.10), two like a multi-corner deck (×1.25). */
export const chamferLabourFactor=(a:ActiveChamfers|null)=>[1,1.10,1.25][chamferCount(a)];
/** An angled (45°) edge of the main deck: an angled corner's face, or a custom outline's 45° edge. They share
 * the angled framing, the skewed hangers and the one-straight-flight stair rule. */
export const isChamferEdgeId=(id?:string)=>!!id&&(id.startsWith('main-chamfer-')||isCustomAngledEdgeId(id));

const ft=(inches:number)=>(Math.round(inches/12*10)/10).toString();
/** Plain words for the design facts, the proposal and a sent design. */
export function describeChamfers(a:ActiveChamfers):string{
  const parts=[a.leftIn>0&&`${ft(a.leftIn)} ft front left`,a.rightIn>0&&`${ft(a.rightIn)} ft front right`].filter(Boolean);
  const notes=[a.shrunk&&'reduced to fit the deck',a.dropped&&`the ${a.dropped} corner is too small to cut and stays square`].filter(Boolean);
  return `45° angled front corner${parts.length>1?'s':''}: ${parts.join(', ')}${notes.length?` (${notes.join('; ')})`:''}`;
}
/** "an angled front corner" or "angled front corners", for the shape headline and the proposal. */
export const chamferShapeWords=(a:ActiveChamfers)=>chamferCount(a)>1?'angled front corners':'an angled front corner';
/** The angled face length of a leg, in feet. */
export const chamferFaceFt=(legIn:number)=>Math.round(legIn*Math.SQRT2/12*10)/10;

/** The main deck takes the grade stairs only when it is lower than every other level (a lower level, or
 * an equal one, takes them otherwise; see the exit level in deckTakeoff.ts). */
const mainDeckTakesGradeStairs=(data:Pick<DeckData,'levels'|'height'|'height2'|'level3'>)=>{
  const h=Number(data.height)||0;
  return data.levels<2||(h<(Number(data.height2)||0)&&(data.levels<3||!data.level3||h<(Number(data.level3.heightIn)||0)));
};
/** A stair may open on an angled face only as one straight flight (no landing or winder, at most 14
 * risers) from the main deck: landings and turns are laid out square to the deck. */
export const angledStairAllowed=(data:Pick<DeckData,'stairType'|'height'|'levels'|'height2'|'level3'>)=>data.stairType==='Straight'&&Math.ceil((Number(data.height)||0)/7.75)<=14&&mainDeckTakesGradeStairs(data);
/** An angled face takes the stair only if it is at least as wide as the stair (and 36 in). */
export const angledStairFits=(faceIn:number,stairWidthIn:number)=>faceIn>=Math.max(36,Number(stairWidthIn)||0)-1e-6;
