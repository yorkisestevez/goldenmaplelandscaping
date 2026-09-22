import type {DeckData} from '../types';
import {getHouseConfig} from '../houseSettings';
import type {PlanPoint} from './deckGeometry';

/**
 * Wrap-around decks: side wings around one or both house corners.
 *
 * Plan space as everywhere else (inches, +x along the deck width, +y toward the yard, y = 0 the
 * house's deck-facing wall, the house at y < 0). A wing runs back along a house side wall to
 * y = −run and reaches out `width` from it. Each wrapped corner is a mitred corner: a doubled hip
 * runs corner-to-corner, from the house corner to the deck's outside corner. It is a true 45°
 * mitre only when the wing width equals the main deck depth.
 *
 * Each region framed off one house wall is a zone with its own frame: `local = (lx, lz)` with lz
 * measured away from that zone's ledger (the joist direction) and lx along it. The main zone's
 * frame is the plan itself; the wings are rotated a quarter turn, so their local outlines keep a
 * positive (counter-clockwise) winding.
 */
export const WRAP_WING_WIDTH_FT=[4,24] as const;
export const WRAP_RUN_FT=[2,100] as const;
/** Deck-facing wall kept as main-deck ledger beside a single wrapped corner. */
export const WRAP_MIN_MAIN_LEDGER_IN=48;

export type WrapSide='left'|'right';
export interface WrapFrame{origin:PlanPoint;ux:PlanPoint;uz:PlanPoint}
export interface WrapZoneGeometry{id:'main'|'wingL'|'wingR';label:string;outline:PlanPoint[];frame:WrapFrame;local:PlanPoint[];size:{w:number;h:number}}
/** The hip centre line, from the house corner `a` to the deck's outside corner `b`. */
export interface WrapHip{side:WrapSide;a:PlanPoint;b:PlanPoint;
  /** Angle between the hip and the deck-facing wall, degrees (45 = true mitre). */
  angleDeg:number}
export interface ActiveWrap{W:number;L:number;x0:number;x1:number;houseDepthIn:number;
  left?:{widthIn:number;runIn:number};right?:{widthIn:number;runIn:number}}

const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const num=(v:unknown,fallback:number)=>Number.isFinite(Number(v))?Number(v):fallback;

/** Why a requested wrap cannot be built with the current settings (empty = it can). */
export function wrapBlockers(data:DeckData):string[]{
  const w=data.wrap;if(!w||(!w.left&&!w.right))return [];
  const out:string[]=[];
  if(data.deckType!=='Attached'&&data.deckType!=='Add-on')out.push('A wrap-around is fastened to the house walls, so the deck must be attached (or an add-on).');
  if(data.levels>1)out.push('Wrap-arounds are single-level decks; remove the second level.');
  if(data.shape!=='Rectangle')out.push('The main deck must be a rectangle; the wings replace the corner cut-outs.');
  if(data.pattern==='Diagonal'||data.pattern==='Herringbone')out.push('Diagonal and herringbone boards would run along the corner hip; choose straight or picture-frame boards.');
  if(data.hasInlay)out.push('A centre inlay does not continue across the mitred corners; remove the inlay.');
  return out;
}

/** The wrap as built, in inches, or null when there is none or it is paused by `wrapBlockers`. */
export function activeWrap(data:DeckData):ActiveWrap|null{
  const w=data.wrap;if(!w||(!w.left&&!w.right)||wrapBlockers(data).length)return null;
  const house=getHouseConfig(data),HW=house.widthFt*12,HD=house.depthFt*12,L=Math.max(12,num(data.length,12)*12);
  const wing=(g?:{widthFt:number;runFt:number})=>g?{widthIn:clamp(num(g.widthFt,8)*12,WRAP_WING_WIDTH_FT[0]*12,WRAP_WING_WIDTH_FT[1]*12),runIn:clamp(num(g.runFt,8)*12,Math.min(WRAP_RUN_FT[0]*12,HD),HD)}:undefined;
  const left=wing(w.left),right=wing(w.right);
  if(left&&right)return {W:left.widthIn+HW+right.widthIn,L,x0:left.widthIn,x1:left.widthIn+HW,houseDepthIn:HD,left,right};
  const W=Math.max(12,num(data.width,12)*12),one=(left??right)!;
  one.widthIn=Math.min(one.widthIn,W-WRAP_MIN_MAIN_LEDGER_IN);
  if(one.widthIn<WRAP_WING_WIDTH_FT[0]*12)return null;
  return right?{W,L,x0:W-right.widthIn-HW,x1:W-right.widthIn,houseDepthIn:HD,right}:{W,L,x0:left!.widthIn,x1:left!.widthIn+HW,houseDepthIn:HD,left};
}

/**
 * Keeps a wrap design self-consistent. The house size is fixed explicitly (its default follows the
 * deck width, which a two-corner wrap derives from the house), and a two-corner deck is exactly
 * left wing + house + right wing wide. A design without a wrap is returned unchanged.
 */
export function normalizeWrap(data:DeckData):DeckData{
  const w=data.wrap;if(!w||(!w.left&&!w.right))return data;
  const next={...data,houseConfig:getHouseConfig(data)};
  const wrap=activeWrap(next);
  if(wrap&&wrap.left&&wrap.right)next.width=wrap.W/12;
  return next;
}

/** Wrap-arounds reuse the studio's existing labour factors, no new rate: one mitred corner prices
 * like Multi-corner (×1.25), two like Curved (×1.50). */
export function wrapLabourFactor(wrap:ActiveWrap|null){return !wrap?1:wrap.left&&wrap.right?1.5:1.25;}

/** Plain names for exposed wrap edges (stair and screen pickers, the plan). */
export const WRAP_EDGE_NAMES:Record<string,string>={
  'main-front':'Front edge','main-left':'Left end','main-right':'Right end','main-back-exposed':'Back edge past the house',
  'wingL-side':'Left wing, outer side','wingL-end':'Left wing, back end','wingR-side':'Right wing, outer side','wingR-end':'Right wing, back end',
  'main-ledger':'Ledger on the deck-facing wall','wingL-ledger':'Ledger on the left side wall','wingR-ledger':'Ledger on the right side wall',
};

/** The deck outline around the house corners, with an id per edge (edge i runs from point i to i + 1). */
export function wrapOutline(wrap:ActiveWrap):{outline:PlanPoint[];edgeIds:string[]}{
  const {W,L,x0,x1,left,right}=wrap,outline:PlanPoint[]=[],edgeIds:string[]=[];
  const add=(p:PlanPoint,id:string)=>{outline.push(p);edgeIds.push(id);};
  if(left){add({x:0,y:-left.runIn},'wingL-end');add({x:x0,y:-left.runIn},'wingL-ledger');add({x:x0,y:0},'main-ledger');}
  else if(x0>.5){add({x:0,y:0},'main-back-exposed');add({x:x0,y:0},'main-ledger');}
  else add({x:0,y:0},'main-ledger');
  if(right){add({x:x1,y:0},'wingR-ledger');add({x:x1,y:-right.runIn},'wingR-end');add({x:W,y:-right.runIn},'wingR-side');}
  else if(x1<W-.5){add({x:x1,y:0},'main-back-exposed');add({x:W,y:0},'main-right');}
  else add({x:W,y:0},'main-right');
  add({x:W,y:L},'main-front');
  add({x:0,y:L},left?'wingL-side':'main-left');
  return {outline,edgeIds};
}

export function wrapHips(wrap:ActiveWrap):WrapHip[]{
  const {W,L,x0,x1,left,right}=wrap,hips:WrapHip[]=[];
  if(left)hips.push({side:'left',a:{x:x0,y:0},b:{x:0,y:L},angleDeg:Math.atan2(L,left.widthIn)*180/Math.PI});
  if(right)hips.push({side:'right',a:{x:x1,y:0},b:{x:W,y:L},angleDeg:Math.atan2(L,right.widthIn)*180/Math.PI});
  return hips;
}

export const toPlan=(f:WrapFrame,p:PlanPoint):PlanPoint=>({x:f.origin.x+p.x*f.ux.x+p.y*f.uz.x,y:f.origin.y+p.x*f.ux.y+p.y*f.uz.y});
export const toLocal=(f:WrapFrame,p:PlanPoint):PlanPoint=>{const dx=p.x-f.origin.x,dy=p.y-f.origin.y;return {x:dx*f.ux.x+dy*f.ux.y,y:dx*f.uz.x+dy*f.uz.y};};

/** Framing zones: the main deck off the deck-facing wall and one wing off each wrapped side wall. */
export function wrapZones(wrap:ActiveWrap):WrapZoneGeometry[]{
  const {W,L,x0,x1,left,right}=wrap,zones:WrapZoneGeometry[]=[];
  const zone=(id:WrapZoneGeometry['id'],label:string,outline:PlanPoint[],frame:WrapFrame,size:{w:number;h:number})=>zones.push({id,label,outline,frame,local:outline.map(p=>toLocal(frame,p)),size});
  const back=[...(left?[{x:x0,y:0}]:[{x:0,y:0}]),...(right?[{x:x1,y:0}]:[{x:W,y:0}])];
  zone('main','Main deck',[...back,{x:W,y:L},{x:0,y:L}],{origin:{x:0,y:0},ux:{x:1,y:0},uz:{x:0,y:1}},{w:W,h:L});
  if(left)zone('wingL','Left wing',[{x:0,y:-left.runIn},{x:x0,y:-left.runIn},{x:x0,y:0},{x:0,y:L}],{origin:{x:x0,y:-left.runIn},ux:{x:0,y:1},uz:{x:-1,y:0}},{w:left.runIn+L,h:left.widthIn});
  if(right)zone('wingR','Right wing',[{x:x1,y:-right.runIn},{x:W,y:-right.runIn},{x:W,y:L},{x:x1,y:0}],{origin:{x:x1,y:L},ux:{x:0,y:-1},uz:{x:1,y:0}},{w:L+right.runIn,h:right.widthIn});
  return zones;
}

/** A large convex polygon covering the side of line a→b that holds `inside`, pulled `shift` in from the line. */
export function halfPlane(a:PlanPoint,b:PlanPoint,inside:PlanPoint,shift=0,big=1e5):PlanPoint[]{
  const len=Math.hypot(b.x-a.x,b.y-a.y),u={x:(b.x-a.x)/len,y:(b.y-a.y)/len};
  let n={x:-u.y,y:u.x};if((inside.x-a.x)*n.x+(inside.y-a.y)*n.y<0)n={x:-n.x,y:-n.y};
  const o={x:a.x+n.x*shift,y:a.y+n.y*shift};
  const quad=[{x:o.x-u.x*big,y:o.y-u.y*big},{x:o.x+u.x*big,y:o.y+u.y*big},{x:o.x+u.x*big+n.x*big,y:o.y+u.y*big+n.y*big},{x:o.x-u.x*big+n.x*big,y:o.y-u.y*big+n.y*big}];
  const area=quad.reduce((s,p,i)=>{const q=quad[(i+1)%4];return s+p.x*q.y-q.x*p.y;},0);
  return area<0?quad.reverse():quad;
}

/** Distance from a plan point to a segment. */
export function distanceToSegment(p:PlanPoint,a:PlanPoint,b:PlanPoint){
  const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
  return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
}

/** Plain-language description, e.g. "Wraps the right corner: side wing 10 × 8 ft, mitred at 45°". */
export function describeWrap(wrap:ActiveWrap):string{
  const hips=wrapHips(wrap),corner=(side:WrapSide)=>{const g=wrap[side]!,hip=hips.find(h=>h.side===side)!,angle=Math.abs(hip.angleDeg-45)<.5?'mitred at 45°':`corner-to-corner hip at ${hip.angleDeg.toFixed(0)}° to the back wall`;return `${side} wing ${(g.widthIn/12).toFixed(1).replace(/\.0$/,'')} ft out × ${(g.runIn/12).toFixed(1).replace(/\.0$/,'')} ft along the side wall, ${angle}`;};
  const sides=(['left','right'] as const).filter(s=>wrap[s]);
  return `Wraps ${sides.length===2?'both house corners':`the ${sides[0]} house corner`}: ${sides.map(corner).join('; ')}`;
}
