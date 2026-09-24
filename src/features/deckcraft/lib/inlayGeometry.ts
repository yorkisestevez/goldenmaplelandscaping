import {DECKING_CATALOGUE} from '../manufacturerCatalog';
import type {BoardPattern,DeckData,DeckInlay,InlayFill} from '../types';
import {getBoardRows,getHerringboneRows,getPictureFrameRuns,type BoardRun,type FootprintPlan,type PlanPoint} from './deckGeometry';
import {boardOutline,offsetPolygons,polygonBoard,polygonCut,signedArea} from './polygonCuts';

/**
 * Decorative inlays (DeckInlay): a framed rectangle ('rug') or a framed square turned 45° ('diamond') set into the
 * field of a deck level. The frame is picture-frame boards around the inlay's outline; inside, the fill runs across
 * (front to back), at 45° or in a herringbone. Field, border and breaker boards are cut around the outline with the
 * board gap. Placement rules: an inlay sits inside the field with at least one full board of field around it, does
 * not overlap another inlay, and leaves room for two boards inside its frame; one that breaks a rule is kept but
 * not built, and says why. Plan inches, level-local; pure data, no three.js. Framing: inlayFraming.ts.
 */
export const INLAY_LIMITS={max:8,rugFt:[2,20] as const,diamondFt:[2,14] as const,offsetFt:[-30,30] as const};
export type InlayStatus='ok'|'outside'|'overlap'|'small'|'blocked';
export interface InlayPlan{
  id:string;kind:DeckInlay['kind'];status:InlayStatus;message?:string;
  /** Outer edge of the frame, and the edge of the fill inside it (positive shoelace area). */
  outline:PlanPoint[];inner:PlanPoint[];
  frameRows:1|2;pattern:InlayFill;
  /** Frame ('inlay-frame') and fill ('inlay-fill') pieces, before splitting to stock (empty unless ok). */
  boards:BoardRun[];
  /** The frame's fitted edge (its outer outline) in feet, and the fill's area in square feet. */
  edgeFt:number;fillSqft:number;
}
export interface InlayContext{
  /** The level's field: the decking footprint inside its border rows. */
  fieldPolygons:PlanPoint[][];
  boardWidth:number;gap:number;stockLength:number;
  /** The level's middle, where dxFt/dyFt are measured from. */
  centre:PlanPoint;
  /** A reason no inlay can be built on this level (a wrap-around deck, or the legacy centre stripe). */
  blocked?:string;
}

const MESSAGES:Record<Exclude<InlayStatus,'ok'|'blocked'>,string>={
  outside:'It reaches past the deck’s field. Keep one full board between it and the deck’s edge or border: make it smaller or move it.',
  overlap:'It overlaps another inlay. Move it or make it smaller.',
  small:'It is too small for its frame: the inside needs room for at least two boards.',
};
export const INLAY_KIND_NAMES:Record<DeckInlay['kind'],string>={rug:'framed rectangle',diamond:'diamond'};
const area=(polys:PlanPoint[][])=>polys.reduce((n,p)=>n+Math.abs(signedArea(p)),0);
const perimeter=(p:PlanPoint[])=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+Math.hypot(b.x-a.x,b.y-a.y);},0);

/** The inlay's outer outline in level-local plan inches. */
export function inlayOutline(inlay:DeckInlay,centre:PlanPoint):PlanPoint[]{
  const cx=centre.x+(inlay.dxFt??0)*12,cy=centre.y+(inlay.dyFt??0)*12;
  if(inlay.kind==='diamond'){const h=inlay.widthFt*12/Math.SQRT2;return [{x:cx,y:cy-h},{x:cx+h,y:cy},{x:cx,y:cy+h},{x:cx-h,y:cy}];}
  const w=inlay.widthFt*6,d=inlay.depthFt*6;
  return [{x:cx-w,y:cy-d},{x:cx+w,y:cy-d},{x:cx+w,y:cy+d},{x:cx-w,y:cy+d}];
}
/** The fill's boards run across (front to back, 90°), at 45°, or in a herringbone (45° and 135°). */
export const fillAngles=(pattern:InlayFill)=>pattern==='Straight'?[90]:pattern==='Diagonal'?[45]:[45,135];
/** The main field's board directions for a deck pattern. */
export const fieldAngles=(pattern:BoardPattern)=>pattern==='Diagonal'?[45]:pattern==='Herringbone'?[45,135]:[0];

/** Plan every inlay on a level, in order: later inlays that overlap an earlier one are not built. */
export function planInlays(inlays:DeckInlay[],ctx:InlayContext):InlayPlan[]{
  const {fieldPolygons,boardWidth,gap,stockLength,centre}=ctx,pitch=boardWidth+gap;
  // At least one full field board (plus its gap) between an inlay and the field's edge.
  const allowed=offsetPolygons(fieldPolygons,pitch),built:PlanPoint[][]=[];
  return inlays.map(inlay=>{
    const frameRows=inlay.frameRows??1,pattern=inlay.pattern??'Straight',outline=inlayOutline(inlay,centre);
    const inner=offsetPolygons([outline],frameRows*pitch)[0]??[];
    const base={id:inlay.id,kind:inlay.kind,frameRows,pattern,outline,inner,boards:[] as BoardRun[],edgeFt:perimeter(outline)/12,fillSqft:inner.length?Math.abs(signedArea(inner))/144:0};
    if(ctx.blocked)return {...base,status:'blocked' as const,message:ctx.blocked};
    let status:InlayStatus='ok';
    if(!inner.length||!offsetPolygons([inner],pitch*.99).length)status='small';
    else if(area(polygonCut([outline],allowed,true))>1)status='outside';
    else if(built.some(o=>area(polygonCut([outline],[o]))>1))status='overlap';
    if(status!=='ok')return {...base,status,message:MESSAGES[status]};
    built.push(outline);
    const fp=(poly:PlanPoint[]):FootprintPlan=>({outline:poly,bounds:{w:2*(centre.x+(inlay.dxFt??0)*12),h:2*(centre.y+(inlay.dyFt??0)*12)},isCurved:false});
    const frame=getPictureFrameRuns(fp(outline),frameRows,boardWidth,gap).map(b=>({...b,role:'inlay-frame' as const,inlay:inlay.id}));
    // Slivers under a square inch, where a pattern meets the frame, are a gap, not a board anyone would cut.
    const fill=(pattern==='Herringbone'?getHerringboneRows(fp(inner),boardWidth,gap,0):getBoardRows(fp(inner),{boardWidth,gap,angleDeg:pattern==='Diagonal'?45:90,inset:0,maxBoardLen:stockLength}))
      .filter(b=>!b.polygon||Math.abs(signedArea(b.polygon))>=1).map(b=>({...b,role:'inlay-fill' as const,inlay:inlay.id}));
    return {...base,status,boards:[...frame,...fill]};
  });
}

/** Cut the level's field, border and breaker boards around the built inlays (with the board gap) and add the
 * inlay boards. A board the inlays do not touch is kept exactly as it was. */
export function applyInlays(boards:BoardRun[],plans:InlayPlan[],boardWidth:number,gap:number):BoardRun[]{
  const built=plans.filter(p=>p.status==='ok');if(!built.length)return boards;
  const holes=built.map(p=>offsetPolygons([p.outline],-gap)[0]).filter(Boolean);
  const box=(poly:PlanPoint[])=>({x0:Math.min(...poly.map(p=>p.x)),x1:Math.max(...poly.map(p=>p.x)),y0:Math.min(...poly.map(p=>p.y)),y1:Math.max(...poly.map(p=>p.y))});
  const holeBoxes=holes.map(box),out:BoardRun[]=[];
  for(const b of boards){
    const poly=boardOutline(b,boardWidth),bb=box(poly);
    if(!holeBoxes.some(h=>h.x0<bb.x1&&h.x1>bb.x0&&h.y0<bb.y1&&h.y1>bb.y0)){out.push(b);continue;}
    const pieces=polygonCut([poly],holes,true);
    if(pieces.length===1&&Math.abs(Math.abs(signedArea(pieces[0]))-Math.abs(signedArea(poly)))<.01){out.push(b);continue;}
    for(const piece of pieces)if(Math.abs(signedArea(piece))>.5)out.push(polygonBoard(piece,b.angleDeg,b.role));
  }
  return [...out,...built.flatMap(p=>p.boards)];
}

/** The inlay context of a built deck level (for the editor's fit and status checks). */
export function levelInlayContext(data:Pick<DeckData,'deckingMaterial'|'boardWidth'|'pictureFrameRows'|'pattern'>,level:{footprint:FootprintPlan;deckingFootprint?:FootprintPlan}):InlayContext{
  const material=DECKING_CATALOGUE.find(m=>m.id===data.deckingMaterial)||DECKING_CATALOGUE[0];
  const gap=material.isComposite?.1875:.25,borders=data.pictureFrameRows||(data.pattern==='Picture Frame'?1:0);
  return {fieldPolygons:offsetPolygons([(level.deckingFootprint??level.footprint).outline],borders*(data.boardWidth+gap)),boardWidth:data.boardWidth,gap,stockLength:material.id==='cedar'?144:192,centre:{x:level.footprint.bounds.w/2,y:level.footprint.bounds.h/2}};
}

/** The nearest version of an inlay that fits, clear of the other inlays on its level: at its size, first moved
 * toward the middle, then to the nearest free spot around it (in 1 ft steps); only then made smaller (6 in steps).
 * Null when even the smallest size fits nowhere. The checks are the placement rules of planInlays. */
export function fitInlay(inlay:DeckInlay,others:DeckInlay[],ctx:InlayContext):DeckInlay|null{
  const [lo]=inlay.kind==='rug'?INLAY_LIMITS.rugFt:INLAY_LIMITS.diamondFt,snap=(v:number)=>Math.round(v*2)/2,pitch=ctx.boardWidth+ctx.gap;
  const allowed=offsetPolygons(ctx.fieldPolygons,pitch),taken=planInlays(others,ctx).filter(p=>p.status==='ok').map(p=>p.outline);
  const pts=allowed.flat(),bx0=Math.min(...pts.map(p=>p.x)),bx1=Math.max(...pts.map(p=>p.x)),by0=Math.min(...pts.map(p=>p.y)),by1=Math.max(...pts.map(p=>p.y));
  const fits=(c:DeckInlay)=>{
    const outline=inlayOutline(c,ctx.centre);
    // Quick reject: an outline outside the field's bounding box cannot fit.
    if(outline.some(p=>p.x<bx0-.01||p.x>bx1+.01||p.y<by0-.01||p.y>by1+.01))return false;
    const inner=offsetPolygons([outline],(c.frameRows??1)*pitch)[0];
    if(!inner||!offsetPolygons([inner],pitch*.99).length||area(polygonCut([outline],allowed,true))>1)return false;
    return !taken.some(o=>area(polygonCut([outline],[o]))>1);
  };
  const x0=inlay.dxFt??0,y0=inlay.dyFt??0,[olo,ohi]=INLAY_LIMITS.offsetFt,steps=Array.from({length:21},(_,i)=>i-10);
  const around=steps.flatMap(x=>steps.map(y=>({x:x0+x,y:y0+y}))).filter(p=>p.x>=olo&&p.x<=ohi&&p.y>=olo&&p.y<=ohi).sort((a,b)=>Math.hypot(a.x-x0,a.y-y0)-Math.hypot(b.x-x0,b.y-y0));
  for(let s=0;;s+=.5){
    const width=Math.max(lo,inlay.widthFt-s),depth=Math.max(lo,inlay.depthFt-s),sized={...inlay,widthFt:width,depthFt:inlay.kind==='diamond'?width:depth};
    const spots=[...[1,.5,0].map(t=>({x:snap(x0*t),y:snap(y0*t)})),...around];
    for(const p of spots){const c={...sized,dxFt:snap(p.x),dyFt:snap(p.y)};if(fits(c))return {...c,...(c.dxFt?{}:{dxFt:undefined}),...(c.dyFt?{}:{dyFt:undefined})};}
    if(width===lo&&depth===lo)return null;
  }
}

/** Inlay labour, reusing existing rates only: each frame's fitted edge at the breaker-board rate (1.5 crew-hours
 * per 10 ft; a frame is fitted on both sides, as a breaker is), plus the inside's share of the decking labour at
 * its pattern's factor over the deck's (never less than the deck's own). Crew-days, before the deck's multipliers. */
export const PATTERN_LABOUR:Record<BoardPattern,number>={Straight:1,Diagonal:1.20,'Picture Frame':1.25,Herringbone:1.30};
export function inlayCrewDays(plans:InlayPlan[],deckPattern:BoardPattern,deckingRateSqftPerDay:number){
  const built=plans.filter(p=>p.status==='ok');
  const edge=built.reduce((n,p)=>n+p.edgeFt/10*1.5,0)/8;
  const inside=built.reduce((n,p)=>n+Math.max(0,PATTERN_LABOUR[p.pattern]/PATTERN_LABOUR[deckPattern]-1)*p.fillSqft/deckingRateSqftPerDay,0);
  return {edge,inside,total:edge+inside};
}

/** Plain words for the built inlays, e.g. "Inlays: a 6 × 4 ft framed rectangle with a herringbone inside". */
export function inlayWords(plans:InlayPlan[],inlays:DeckInlay[]):string|undefined{
  const built=plans.filter(p=>p.status==='ok');if(!built.length)return undefined;
  const inside:Record<InlayFill,string>={Straight:'boards running front to back',Diagonal:'boards at 45°',Herringbone:'a herringbone'};
  return `Inlays: ${built.map(p=>{const i=inlays.find(x=>x.id===p.id)!;return `${i.kind==='diamond'?`a ${i.widthFt} ft diamond`:`a ${i.widthFt} × ${i.depthFt} ft framed rectangle`} with ${inside[p.pattern]} inside`;}).join('; ')}`;
}
