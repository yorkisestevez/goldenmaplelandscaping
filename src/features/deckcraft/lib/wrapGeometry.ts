import type {DeckData} from '../types';
import {getHouseConfig} from '../houseSettings';
import {blockKindLabel,normalizeHouseBlocks,openingWallId} from '../houseFootprint';
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
export const WRAP_PORCH_DEPTH_FT=[4,24] as const;
export const WRAP_PORCH_RUN_FT=[4,100] as const;
/** Two porches must stop at least this far apart along the street wall, so the deck never closes into a ring. */
export const WRAP_PORCH_GAP_IN=36;
/** Deck-facing wall kept as main-deck ledger beside a single wrapped corner. */
export const WRAP_MIN_MAIN_LEDGER_IN=48;
/** A bump-out on the deck-facing wall stays this far from a wrapped corner, where the hip starts. */
export const WRAP_CORNER_CLEAR_IN=24;

export type WrapSide='left'|'right';
export type WrapZoneId='main'|'wingL'|'wingR'|'porchL'|'porchR';
export interface WrapFrame{origin:PlanPoint;ux:PlanPoint;uz:PlanPoint}
export interface WrapZoneGeometry{id:WrapZoneId;label:string;outline:PlanPoint[];frame:WrapFrame;local:PlanPoint[];size:{w:number;h:number}}
/** The hip centre line, from the house corner `a` to the deck's outside corner `b`. */
export interface WrapHip{side:WrapSide;
  /** 'front': where a wing meets the main deck; 'far': where a porch meets its wing. */
  corner:'front'|'far';
  a:PlanPoint;b:PlanPoint;
  /** Angle between the hip and the house wall it leaves (deck-facing or street side), degrees (45 = true mitre). */
  angleDeg:number;
  /** The two framing zones that meet on this hip. */
  zones:[WrapZoneId,WrapZoneId]}
export interface ActiveWrap{W:number;L:number;x0:number;x1:number;houseDepthIn:number;
  left?:{widthIn:number;runIn:number};right?:{widthIn:number;runIn:number};
  porchLeft?:{depthIn:number;runIn:number};porchRight?:{depthIn:number;runIn:number}}

const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const num=(v:unknown,fallback:number)=>Number.isFinite(Number(v))?Number(v):fallback;

/** Why a requested wrap cannot be built with the current settings (empty = it can). */
export function wrapBlockers(data:DeckData):string[]{
  const w=data.wrap;if(!w||(!w.left&&!w.right))return [];
  const out:string[]=[];
  if(data.deckType!=='Attached'&&data.deckType!=='Add-on')out.push('A wrap-around is fastened to the house walls, so the deck must be attached (or an add-on).');
  if(data.shape!=='Rectangle')out.push('The main deck must be a rectangle; the wings replace the corner cut-outs.');
  if(data.pattern==='Diagonal'||data.pattern==='Herringbone')out.push('Diagonal and herringbone boards would run along the corner hip; choose straight or picture-frame boards.');
  if(data.hasInlay)out.push('A centre inlay does not continue across the mitred corners; remove the inlay.');
  // Attached house blocks the wings or porches would run into. Measured against the main block's
  // walls in inches, before any wrap clamping, so this never depends on the wrap it decides.
  const house=getHouseConfig(data),HW=house.widthFt*12;
  for(const b of normalizeHouseBlocks(house)){
    const o=b.offsetFt*12,e=o+b.widthFt*12,name=blockKindLabel(b).toLowerCase();
    for(const side of ['left','right'] as const){
      const wing=w[side];if(!wing)continue;
      const porch=side==='left'?w.porchLeft:w.porchRight,run=porch?house.depthFt*12:wing.runFt*12,wingIn=wing.widthFt*12;
      if(b.wall===(side==='left'?'Left':'Right')&&o<run&&e>0)out.push(`The ${side} wing would run into the ${name} on the ${side} wall; move the ${name} back past the wing or remove the ${side} wrap.`);
      // Front walls measure from the left corner; a left porch runs from it, a right porch from the right corner.
      const porchSpan:[number,number]|null=porch?(side==='left'?[-wingIn,porch.runFt*12]:[HW-porch.runFt*12,HW+wingIn]):null;
      if(b.wall==='Back'&&porchSpan&&o<porchSpan[1]&&e>porchSpan[0])out.push(`The ${side} porch would run into the ${name} on the street-side wall; move the ${name} or shorten the porch.`);
      if(b.wall==='Front'&&(side==='left'?o<WRAP_CORNER_CLEAR_IN:e>HW-WRAP_CORNER_CLEAR_IN))out.push(`A bump-out on the deck-facing wall must stay at least ${WRAP_CORNER_CLEAR_IN/12} ft from the wrapped ${side} corner, where the corner hip starts.`);
    }
  }
  return out;
}

/** The wrap as built, in inches, or null when there is none or it is paused by `wrapBlockers`. */
export function activeWrap(data:DeckData):ActiveWrap|null{
  const w=data.wrap;if(!w||(!w.left&&!w.right)||wrapBlockers(data).length)return null;
  const house=getHouseConfig(data),HW=house.widthFt*12,HD=house.depthFt*12,L=Math.max(12,num(data.length,12)*12);
  const wing=(g?:{widthFt:number;runFt:number})=>g?{widthIn:clamp(num(g.widthFt,8)*12,WRAP_WING_WIDTH_FT[0]*12,WRAP_WING_WIDTH_FT[1]*12),runIn:clamp(num(g.runFt,8)*12,Math.min(WRAP_RUN_FT[0]*12,HD),HD)}:undefined;
  const left=wing(w.left),right=wing(w.right);
  // A porch continues its wing round the far corner: the wing then runs the full house depth, and
  // the two porch runs stop at least WRAP_PORCH_GAP_IN apart so the deck never becomes a ring.
  const porch=(g:{depthFt:number;runFt:number}|undefined,along:{runIn:number}|undefined)=>g&&along?{depthIn:clamp(num(g.depthFt,8)*12,WRAP_PORCH_DEPTH_FT[0]*12,WRAP_PORCH_DEPTH_FT[1]*12),runIn:clamp(num(g.runFt,8)*12,WRAP_PORCH_RUN_FT[0]*12,HW)}:undefined;
  const porchLeft=porch(w.porchLeft,left),porchRight=porch(w.porchRight,right);
  if(porchLeft)left!.runIn=HD;
  if(porchRight)right!.runIn=HD;
  const room=HW-WRAP_PORCH_GAP_IN,total=(porchLeft?.runIn??0)+(porchRight?.runIn??0);
  if(total>room)for(const p of [porchLeft,porchRight])if(p)p.runIn=Math.max(WRAP_PORCH_RUN_FT[0]*12,p.runIn*room/total);
  const porches={...(porchLeft?{porchLeft}:{}),...(porchRight?{porchRight}:{})};
  if(left&&right)return {W:left.widthIn+HW+right.widthIn,L,x0:left.widthIn,x1:left.widthIn+HW,houseDepthIn:HD,left,right,...porches};
  const W=Math.max(12,num(data.width,12)*12),one=(left??right)!;
  one.widthIn=Math.min(one.widthIn,W-WRAP_MIN_MAIN_LEDGER_IN);
  if(one.widthIn<WRAP_WING_WIDTH_FT[0]*12)return null;
  return right?{W,L,x0:W-right.widthIn-HW,x1:W-right.widthIn,houseDepthIn:HD,right,...porches}:{W,L,x0:left!.widthIn,x1:left!.widthIn+HW,houseDepthIn:HD,left,...porches};
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
export function wrapLabourFactor(wrap:ActiveWrap|null){return !wrap?1:wrapHips(wrap).length>=2?1.5:1.25;}
/** Porch wraps add labour the price book has no factor for yet: listed for a builder quote. */
export const hasPorchWrap=(wrap:ActiveWrap|null)=>!!(wrap?.porchLeft||wrap?.porchRight);

/** Plain names for exposed wrap edges (stair and screen pickers, the plan). */
export const WRAP_EDGE_NAMES:Record<string,string>={
  'main-front':'Front edge','main-left':'Left end','main-right':'Right end','main-back-exposed':'Back edge past the house',
  'wingL-side':'Left wing, outer side','wingL-end':'Left wing, back end','wingR-side':'Right wing, outer side','wingR-end':'Right wing, back end',
  'main-ledger':'Ledger on the deck-facing wall','wingL-ledger':'Ledger on the left side wall','wingR-ledger':'Ledger on the right side wall',
  'porchL-street':'Left porch, street edge','porchL-end':'Left porch end','porchR-street':'Right porch, street edge','porchR-end':'Right porch end',
  'porchL-ledger':'Ledger on the street-side wall (left porch)','porchR-ledger':'Ledger on the street-side wall (right porch)',
};

/** The deck outline around the house corners, with an id per edge (edge i runs from point i to i + 1). */
export function wrapOutline(wrap:ActiveWrap):{outline:PlanPoint[];edgeIds:string[]}{
  const {W,L,x0,x1,left,right,porchLeft:pl,porchRight:pr,houseDepthIn:HD}=wrap,outline:PlanPoint[]=[],edgeIds:string[]=[];
  const add=(p:PlanPoint,id:string)=>{outline.push(p);edgeIds.push(id);};
  if(left&&pl){add({x:x0+pl.runIn,y:-HD},'porchL-ledger');add({x:x0,y:-HD},'wingL-ledger');add({x:x0,y:0},'main-ledger');}
  else if(left){add({x:0,y:-left.runIn},'wingL-end');add({x:x0,y:-left.runIn},'wingL-ledger');add({x:x0,y:0},'main-ledger');}
  else if(x0>.5){add({x:0,y:0},'main-back-exposed');add({x:x0,y:0},'main-ledger');}
  else add({x:0,y:0},'main-ledger');
  if(right&&pr){add({x:x1,y:0},'wingR-ledger');add({x:x1,y:-HD},'porchR-ledger');add({x:x1-pr.runIn,y:-HD},'porchR-end');add({x:x1-pr.runIn,y:-HD-pr.depthIn},'porchR-street');add({x:W,y:-HD-pr.depthIn},'wingR-side');}
  else if(right){add({x:x1,y:0},'wingR-ledger');add({x:x1,y:-right.runIn},'wingR-end');add({x:W,y:-right.runIn},'wingR-side');}
  else if(x1<W-.5){add({x:x1,y:0},'main-back-exposed');add({x:W,y:0},'main-right');}
  else add({x:W,y:0},'main-right');
  add({x:W,y:L},'main-front');
  add({x:0,y:L},left?'wingL-side':'main-left');
  if(left&&pl){add({x:0,y:-HD-pl.depthIn},'porchL-street');add({x:x0+pl.runIn,y:-HD-pl.depthIn},'porchL-end');}
  return {outline,edgeIds};
}

export function wrapHips(wrap:ActiveWrap):WrapHip[]{
  const {W,L,x0,x1,left,right,porchLeft:pl,porchRight:pr,houseDepthIn:HD}=wrap,hips:WrapHip[]=[],deg=(a:number,b:number)=>Math.atan2(a,b)*180/Math.PI;
  if(left)hips.push({side:'left',corner:'front',a:{x:x0,y:0},b:{x:0,y:L},angleDeg:deg(L,left.widthIn),zones:['main','wingL']});
  if(right)hips.push({side:'right',corner:'front',a:{x:x1,y:0},b:{x:W,y:L},angleDeg:deg(L,right.widthIn),zones:['main','wingR']});
  if(left&&pl)hips.push({side:'left',corner:'far',a:{x:x0,y:-HD},b:{x:0,y:-HD-pl.depthIn},angleDeg:deg(pl.depthIn,left.widthIn),zones:['wingL','porchL']});
  if(right&&pr)hips.push({side:'right',corner:'far',a:{x:x1,y:-HD},b:{x:W,y:-HD-pr.depthIn},angleDeg:deg(pr.depthIn,right.widthIn),zones:['wingR','porchR']});
  return hips;
}

export const toPlan=(f:WrapFrame,p:PlanPoint):PlanPoint=>({x:f.origin.x+p.x*f.ux.x+p.y*f.uz.x,y:f.origin.y+p.x*f.ux.y+p.y*f.uz.y});
export const toLocal=(f:WrapFrame,p:PlanPoint):PlanPoint=>{const dx=p.x-f.origin.x,dy=p.y-f.origin.y;return {x:dx*f.ux.x+dy*f.ux.y,y:dx*f.uz.x+dy*f.uz.y};};

/** Framing zones: the main deck off the deck-facing wall and one wing off each wrapped side wall. */
export function wrapZones(wrap:ActiveWrap):WrapZoneGeometry[]{
  const {W,L,x0,x1,left,right,porchLeft:pl,porchRight:pr,houseDepthIn:HD}=wrap,zones:WrapZoneGeometry[]=[];
  const zone=(id:WrapZoneId,label:string,outline:PlanPoint[],frame:WrapFrame,size:{w:number;h:number})=>zones.push({id,label,outline,frame,local:outline.map(p=>toLocal(frame,p)),size});
  const back=[...(left?[{x:x0,y:0}]:[{x:0,y:0}]),...(right?[{x:x1,y:0}]:[{x:W,y:0}])];
  zone('main','Main deck',[...back,{x:W,y:L},{x:0,y:L}],{origin:{x:0,y:0},ux:{x:1,y:0},uz:{x:0,y:1}},{w:W,h:L});
  // A wing with a porch ends on the far hip instead of a square end; it spans the whole house depth plus the porch depth.
  if(left){const far=pl?HD+pl.depthIn:left.runIn;zone('wingL','Left wing',[{x:0,y:-far},pl?{x:x0,y:-HD}:{x:x0,y:-far},{x:x0,y:0},{x:0,y:L}],{origin:{x:x0,y:-far},ux:{x:0,y:1},uz:{x:-1,y:0}},{w:far+L,h:left.widthIn});}
  if(right){const far=pr?HD+pr.depthIn:right.runIn;zone('wingR','Right wing',[pr?{x:x1,y:-HD}:{x:x1,y:-far},{x:W,y:-far},{x:W,y:L},{x:x1,y:0}],{origin:{x:x1,y:L},ux:{x:0,y:-1},uz:{x:1,y:0}},{w:L+far,h:right.widthIn});}
  // Porches are framed off the street-side wall: joists run away from it (toward the street).
  if(left&&pl)zone('porchL','Left porch',[{x:0,y:-HD-pl.depthIn},{x:x0+pl.runIn,y:-HD-pl.depthIn},{x:x0+pl.runIn,y:-HD},{x:x0,y:-HD}],{origin:{x:x0+pl.runIn,y:-HD},ux:{x:-1,y:0},uz:{x:0,y:-1}},{w:pl.runIn+left.widthIn,h:pl.depthIn});
  if(right&&pr)zone('porchR','Right porch',[{x:x1-pr.runIn,y:-HD-pr.depthIn},{x:W,y:-HD-pr.depthIn},{x:x1,y:-HD},{x:x1-pr.runIn,y:-HD}],{origin:{x:W,y:-HD},ux:{x:-1,y:0},uz:{x:0,y:-1}},{w:right.widthIn+pr.runIn,h:pr.depthIn});
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
  const hips=wrapHips(wrap),ft=(inches:number)=>(inches/12).toFixed(1).replace(/\.0$/,'');
  const angle=(side:WrapSide,corner:'front'|'far')=>{const hip=hips.find(h=>h.side===side&&h.corner===corner)!;return Math.abs(hip.angleDeg-45)<.5?'mitred at 45°':`corner-to-corner hip at ${hip.angleDeg.toFixed(0)}° to the ${corner==='front'?'back':'street-side'} wall`;};
  const part=(side:WrapSide)=>{const g=wrap[side]!,p=side==='left'?wrap.porchLeft:wrap.porchRight;
    return `${side} wing ${ft(g.widthIn)} ft out × ${ft(g.runIn)} ft along the side wall, ${angle(side,'front')}${p?`, continuing as a porch ${ft(p.depthIn)} ft deep × ${ft(p.runIn)} ft along the street side, ${angle(side,'far')}`:''}`;};
  const sides=(['left','right'] as const).filter(s=>wrap[s]);
  return `Wraps ${sides.length===2?'both house corners':`the ${sides[0]} house corner`}${hasPorchWrap(wrap)?' and round to the street side':''}: ${sides.map(part).join('; ')}`;
}

/**
 * Front entry: where a street-side door (a 'Back' facade opening) faces a porch, the primary stair
 * can open off that porch's street edge, centred on the door. Openings on the street-side wall run
 * from the house's right corner (0 %) to its left corner (100 %), as the house geometry draws them.
 */
export function porchStairForDoor(data:DeckData):{edgeId:string;offsetPct:number;doorId:string}|null{
  const wrap=activeWrap(data);if(!wrap||!(wrap.porchLeft||wrap.porchRight))return null;
  const house=getHouseConfig(data),HW=house.widthFt*12,{outline,edgeIds}=wrapOutline(wrap),width=Math.max(24,num(data.stairWidth,48));
  for(const door of house.openings.filter(o=>o.type==='Door'&&openingWallId(o,house)==='main-back')){
    const x=wrap.x1-HW*door.offsetPct/100;
    for(const id of ['porchL-street','porchR-street']){
      const i=edgeIds.indexOf(id);if(i<0)continue;
      const a=outline[i],b=outline[(i+1)%outline.length],x0=Math.min(a.x,b.x),len=Math.abs(b.x-a.x);
      if(x<x0+width/2||x>x0+len-width/2||len<=width)continue;
      return {edgeId:id,offsetPct:clamp((x-width/2-x0)/(len-width)*100,0,100),doorId:door.id};
    }
  }
  return null;
}
