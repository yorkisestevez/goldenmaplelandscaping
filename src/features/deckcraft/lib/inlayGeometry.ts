import {contrastColour,parseColourRef} from '../boardFinishes';
import {DECKING_CATALOGUE} from '../manufacturerRuntimeCatalogue';
import type {BoardPattern,DeckData,DeckInlay,InlayFill,OutlinePoint} from '../types';
import {getBoardRows,getHerringboneRows,getPictureFrameRuns,type BoardRun,type FootprintPlan,type PlanPoint} from './deckGeometry';
import {boardOutline,offsetPolygons,polygonBoard,polygonCut,signedArea} from './polygonCuts';

/**
 * Decorative inlays (DeckInlay) set into the field of a deck level. Plan inches, level-local; pure data, no three.js.
 * - A framed rectangle ('rug') or a framed square turned 45° ('diamond'): picture-frame boards around the outline and,
 *   inside, a fill across (front to back), at 45° or in a herringbone.
 * - A band: 1 to 4 boards the length of the field. Across a straight field it is whole rows recoloured, with no
 *   cutting; running front to back, or across a 45° or herringbone field, it is cut in like a breaker.
 * - A medallion: a 16-sided outline with a one-row frame; inside, boards front to back ('round') or eight wedges
 *   whose boards follow each wedge's outer edge, in alternating colours ('compass').
 * Field, border and breaker boards are cut around what is cut in, with the board gap. Placement rules: an inlay sits
 * inside the field with at least one full board of field around it (beside a band), does not overlap another inlay,
 * and leaves room for two boards inside a frame; one that breaks a rule is kept but not built, and says why.
 * Framing: inlayFraming.ts, plus build-up joists under bands running front to back (bandBuildUps, in deckTakeoff.ts).
 */
export const INLAY_LIMITS={max:8,rugFt:[2,20] as const,diamondFt:[2,14] as const,medallionFt:[3,10] as const,bandBoards:[1,4] as const,offsetFt:[-30,30] as const,rotationDeg:[-360,360] as const,customPoints:64,customCoordinateIn:240,customSpanIn:240};
export type InlayStatus='ok'|'outside'|'overlap'|'small'|'blocked';
type Band=Extract<DeckInlay,{kind:'band'}>;
type Shaped=Exclude<DeckInlay,{kind:'band'}>;
export interface InlayPlan{
  id:string;kind:DeckInlay['kind'];status:InlayStatus;message?:string;
  /** Outer edge of the inlay (a band's largest piece), and the edge of the fill inside its frame (positive shoelace
   * area; empty for a band, which has no frame). */
  outline:PlanPoint[];inner:PlanPoint[];
  /** Custom concave frames can leave more than one separate interior. */
  inners?:PlanPoint[][];
  /** Every area the inlay covers: its outline, or each piece of a band where the field's outline splits it. */
  pieces:PlanPoint[][];
  frameRows:1|2;pattern:InlayFill;
  /** Frame ('inlay-frame') and fill ('inlay-fill') pieces, before splitting to stock (empty unless ok, and for a band
   * of recoloured rows, whose boards are the field's own). */
  boards:BoardRun[];
  /** The fitted edge in feet (a frame's outer outline, or a cut-in band's length), and the fill's area in square feet. */
  edgeFt:number;fillSqft:number;
  /** A band: which way it runs, its span across that (plan y for 'across', x for 'along'), and whether it is whole
   * rows of a straight field (recoloured, not cut in). */
  band?:{direction:'across'|'along';from:number;to:number;boards:number;rows:boolean};
  /** A medallion: the area its solid blocking covers, the outline grown by a board width. */
  solid?:PlanPoint[];
  /** Labour listed for a builder quote instead of crew-days (medallions). */
  quote?:boolean;
}
export interface InlayContext{
  /** The level's field: the decking footprint inside its border rows. */
  fieldPolygons:PlanPoint[][];
  boardWidth:number;gap:number;stockLength:number;
  /** The level's middle, where dxFt/dyFt and a band's atFt are measured from. */
  centre:PlanPoint;
  /** The field's boards run across the deck (a straight or picture-frame deck), so a band across it is whole rows. */
  straight?:boolean;
  /** A reason no inlay can be built on this level (a wrap-around deck, or the legacy centre stripe). */
  blocked?:string;
}

const MESSAGES:Record<Exclude<InlayStatus,'ok'|'blocked'>,string>={
  outside:'It reaches past the deck’s field. Keep one full board between it and the deck’s edge or border: make it smaller or move it.',
  overlap:'It overlaps another inlay. Move it or make it smaller.',
  small:'It is too small for its frame: the inside needs room for at least two boards.',
};
const BAND_OUTSIDE='It runs alongside the deck’s edge, border or a corner of the deck. Keep one full board beside it: move it.';
export const INLAY_KIND_NAMES:Record<DeckInlay['kind'],string>={rug:'framed rectangle',diamond:'diamond',band:'band',medallion:'medallion',custom:'custom polygon'};
const area=(polys:PlanPoint[][])=>polys.reduce((n,p)=>n+Math.abs(signedArea(p)),0);
const perimeter=(p:PlanPoint[])=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+Math.hypot(b.x-a.x,b.y-a.y);},0);
const bounds=(polys:PlanPoint[][])=>{const v=polys.flat();return {x0:Math.min(...v.map(p=>p.x)),x1:Math.max(...v.map(p=>p.x)),y0:Math.min(...v.map(p=>p.y)),y1:Math.max(...v.map(p=>p.y))};};
const rect=(x0:number,y0:number,x1:number,y1:number):PlanPoint[]=>[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
/** A medallion's 16 sides: vertices every 22.5°, the first on the +x axis (so a compass's wedges point along the axes). */
const MEDALLION_SIDES=16;
const polygonAround=(c:PlanPoint,r:number)=>Array.from({length:MEDALLION_SIDES},(_,j)=>{const a=j*2*Math.PI/MEDALLION_SIDES;return {x:c.x+r*Math.cos(a),y:c.y+r*Math.sin(a)};});
/** A band's width across its boards, in plan inches. */
export const bandWidthIn=(boards:number,boardWidth:number,gap:number)=>boards*boardWidth+(boards-1)*gap;

/** Strict point descriptors: importing a polygon must never execute a getter. */
export function validateCustomInlayPoints(input:unknown):OutlinePoint[]{
  if(!Array.isArray(input)||Object.getPrototypeOf(input)!==Array.prototype||input.length<3||input.length>INLAY_LIMITS.customPoints)throw new Error('A custom inlay needs 3 to 64 points.');
  const arrayKeys=Reflect.ownKeys(input);
  if(arrayKeys.length!==input.length+1||arrayKeys.some(k=>k!=='length'&&(typeof k!=='string'||!/^\d+$/.test(k))))throw new Error('Invalid custom inlay point list.');
  const points:OutlinePoint[]=[];
  for(let i=0;i<input.length;i++){
    const entry=Object.getOwnPropertyDescriptor(input,String(i));
    if(!entry||!entry.enumerable||!('value'in entry))throw new Error('Invalid custom inlay point list.');
    const raw=entry.value;
    if(!raw||typeof raw!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(raw)))throw new Error('Invalid custom inlay point.');
    if(Reflect.ownKeys(raw).length!==2)throw new Error('A custom point has only x and y.');
    const x=Object.getOwnPropertyDescriptor(raw,'x'),y=Object.getOwnPropertyDescriptor(raw,'y');
    if(!x?.enumerable||!y?.enumerable||!('value'in x)||!('value'in y)||typeof x.value!=='number'||typeof y.value!=='number'||!Number.isFinite(x.value)||!Number.isFinite(y.value)||Math.abs(x.value)>INLAY_LIMITS.customCoordinateIn||Math.abs(y.value)>INLAY_LIMITS.customCoordinateIn)throw new Error('Custom inlay points must be finite inches within ±240.');
    points.push({x:x.value,y:y.value});
  }
  const b=bounds([points]);
  if(b.x1-b.x0>INLAY_LIMITS.customSpanIn||b.y1-b.y0>INLAY_LIMITS.customSpanIn)throw new Error('Keep a custom inlay within 20 ft across and out.');
  const cross=(a:PlanPoint,b:PlanPoint,c:PlanPoint)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const on=(a:PlanPoint,b:PlanPoint,p:PlanPoint)=>Math.abs(cross(a,b,p))<1e-8&&p.x>=Math.min(a.x,b.x)-1e-8&&p.x<=Math.max(a.x,b.x)+1e-8&&p.y>=Math.min(a.y,b.y)-1e-8&&p.y<=Math.max(a.y,b.y)+1e-8;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],prior=points[(i+points.length-1)%points.length];
    if(Math.hypot(b.x-a.x,b.y-a.y)<.001||Math.abs(cross(prior,a,b))<1e-8&&(a.x-prior.x)*(b.x-a.x)+(a.y-prior.y)*(b.y-a.y)<0)throw new Error('Custom inlay edges must not repeat or double back.');
    for(let j=i+1;j<points.length;j++){
      if(j===i+1||i===0&&j===points.length-1)continue;
      const c=points[j],e=points[(j+1)%points.length];
      if(cross(a,b,c)*cross(a,b,e)<0&&cross(c,e,a)*cross(c,e,b)<0||on(a,b,c)||on(a,b,e)||on(c,e,a)||on(c,e,b))throw new Error('Custom inlay edges cross or touch themselves.');
    }
  }
  const signed=signedArea(points);if(Math.abs(signed)<.000001)throw new Error('A custom inlay needs a nonzero area.');
  return signed<0?points.reverse():points;
}
/** Canonical public inlay validation shared by import, direct placement and agent edits. */
export function validateDeckInlay(input:unknown):DeckInlay{
  if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))throw new Error('Invalid inlay.');
  for(const key of Reflect.ownKeys(input)){
    const descriptor=Object.getOwnPropertyDescriptor(input,key);
    if(typeof key!=='string'||!descriptor?.enumerable||!('value'in descriptor))throw new Error('Invalid inlay record.');
  }
  const raw=input as Record<string,unknown>,number=(v:unknown,lo:number,hi:number,label:string)=>{
    if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw new Error(`${label} must be between ${lo} and ${hi}.`);return v;
  };
  if(typeof raw.id!=='string'||!/^[a-z0-9-]{1,24}$/.test(raw.id)||!['rug','diamond','band','medallion','custom'].includes(raw.kind as string))throw new Error('Invalid inlay id or kind.');
  const common=['id','kind','level','fill'],shaped=['dxFt','dyFt','rotationDeg','frame'];
  const allowed=new Set([...common,...(raw.kind==='band'?['direction','atFt','boards']:raw.kind==='medallion'?[...shaped,'diameterFt','style']:raw.kind==='custom'?[...shaped,'points','name','frameRows','pattern']:[...shaped,'widthFt','depthFt','frameRows','pattern'])]);
  if(Object.keys(raw).some(k=>!allowed.has(k)))throw new Error('Unknown or irrelevant inlay field.');
  if(raw.level!==undefined&&![1,2,3].includes(raw.level as number))throw new Error('Invalid inlay level.');
  for(const key of ['frame','fill'])if(raw[key]!==undefined&&!parseColourRef(raw[key]))throw new Error('Unknown inlay colour.');
  const level=raw.level!==undefined&&raw.level!==1?{level:raw.level as 2|3}:{},fill=raw.fill!==undefined?{fill:raw.fill as string}:{},frame=raw.frame!==undefined?{frame:raw.frame as string}:{};
  const offset=(v:unknown)=>v===undefined||v===0?undefined:number(v,...INLAY_LIMITS.offsetFt,'Inlay position');
  if(raw.kind==='band'){
    if(raw.rotationDeg!==undefined)throw new Error('A full-field band has no separate rotation.');
    if(raw.direction!=='across'&&raw.direction!=='along'||!Number.isInteger(raw.boards)||(raw.boards as number)<1||(raw.boards as number)>4)throw new Error('Invalid band direction or board count.');
    const atFt=offset(raw.atFt);return {id:raw.id,kind:'band',...level,direction:raw.direction,...(atFt!==undefined?{atFt}:{}),boards:raw.boards as 1|2|3|4,...fill};
  }
  const dxFt=offset(raw.dxFt),dyFt=offset(raw.dyFt),rotationDeg=raw.rotationDeg===undefined?undefined:number(raw.rotationDeg,...INLAY_LIMITS.rotationDeg,'Inlay rotation');
  const placement={...(dxFt!==undefined?{dxFt}:{}),...(dyFt!==undefined?{dyFt}:{}),...(rotationDeg?{rotationDeg}:{})};
  if(raw.kind==='medallion'){
    if(!['round','compass','compass-rose','sunburst'].includes(raw.style as string))throw new Error('Invalid medallion style.');
    return {id:raw.id,kind:'medallion',...level,...placement,diameterFt:number(raw.diameterFt,...INLAY_LIMITS.medallionFt,'Medallion size'),style:raw.style as 'round'|'compass'|'compass-rose'|'sunburst',...frame,...fill};
  }
  if(raw.frameRows!==undefined&&raw.frameRows!==1&&raw.frameRows!==2)throw new Error('Invalid inlay frame rows.');
  if(raw.pattern!==undefined&&!['Straight','Diagonal','Herringbone'].includes(raw.pattern as string))throw new Error('Invalid inlay pattern.');
  const finish={...(raw.frameRows===2?{frameRows:2 as const}:{}),...(raw.pattern!==undefined&&raw.pattern!=='Straight'?{pattern:raw.pattern as 'Diagonal'|'Herringbone'}:{}),...frame,...fill};
  if(raw.kind==='custom'){
    if(raw.name!==undefined&&(typeof raw.name!=='string'||raw.name.length>40))throw new Error('A custom inlay name is at most 40 characters.');
    const name=typeof raw.name==='string'?raw.name.trim():'';
    return {id:raw.id,kind:'custom',...level,...placement,points:validateCustomInlayPoints(raw.points),...(name?{name}:{}),...finish};
  }
  const limits=raw.kind==='rug'?INLAY_LIMITS.rugFt:INLAY_LIMITS.diamondFt,widthFt=number(raw.widthFt,limits[0],limits[1],'Inlay width'),depthFt=raw.kind==='diamond'?widthFt:number(raw.depthFt,limits[0],limits[1],'Inlay depth');
  return {id:raw.id,kind:raw.kind as 'rug'|'diamond',...level,...placement,widthFt,depthFt,...finish};
}
const rotatePoints=(points:PlanPoint[],c:PlanPoint,angle:number)=>{
  if(!angle)return points;
  const a=angle*Math.PI/180,co=Math.cos(a),si=Math.sin(a);
  return points.map(p=>({x:c.x+(p.x-c.x)*co-(p.y-c.y)*si,y:c.y+(p.x-c.x)*si+(p.y-c.y)*co}));
};

/** The outline of a rug, diamond or medallion in level-local plan inches (a band's comes from the field). */
export function inlayOutline(inlay:Shaped,centre:PlanPoint):PlanPoint[]{
  const cx=centre.x+(inlay.dxFt??0)*12,cy=centre.y+(inlay.dyFt??0)*12;
  const c={x:cx,y:cy},rotate=(p:PlanPoint[])=>rotatePoints(p,c,inlay.rotationDeg??0);
  if(inlay.kind==='custom')return rotate(inlay.points.map(p=>({x:cx+p.x,y:cy+p.y})));
  if(inlay.kind==='medallion')return rotate(polygonAround(c,inlay.diameterFt*6));
  if(inlay.kind==='diamond'){const h=inlay.widthFt*12/Math.SQRT2;return rotate([{x:cx,y:cy-h},{x:cx+h,y:cy},{x:cx,y:cy+h},{x:cx-h,y:cy}]);}
  const w=inlay.widthFt*6,d=inlay.depthFt*6;
  return rotate([{x:cx-w,y:cy-d},{x:cx+w,y:cy-d},{x:cx+w,y:cy+d},{x:cx-w,y:cy+d}]);
}
/** The fill's boards run across (front to back, 90°), at 45°, or in a herringbone (45° and 135°). */
export const fillAngles=(pattern:InlayFill)=>pattern==='Straight'?[90]:pattern==='Diagonal'?[45]:[45,135];
/** The main field's board directions for a deck pattern. */
export const fieldAngles=(pattern:BoardPattern)=>pattern==='Diagonal'?[45]:pattern==='Herringbone'?[45,135]:[0];

/** Where a band lies across its direction, in plan inches: whole rows of a straight field when it runs across one
 * (snapped to the nearest rows, with a full row either side), otherwise exactly where it is asked to be. `fits` is
 * false when that leaves less than a full board between it and the field's edge. */
function bandSpan(band:Band,ctx:InlayContext){
  const {fieldPolygons,boardWidth:bw,gap}=ctx,pitch=bw+gap,w=bandWidthIn(band.boards,bw,gap),b=bounds(fieldPolygons);
  const across=band.direction==='across',target=(across?ctx.centre.y:ctx.centre.x)+(band.atFt??0)*12-w/2,lo=across?b.y0:b.x0,hi=across?b.y1:b.x1;
  if(across&&ctx.straight){
    // A straight field's rows start at its near side, a pitch apart (getBoardRows); count its full-width rows.
    let full=0;while(lo+full*pitch+bw<=hi+.001)full++;
    const k=Math.round((target-lo)/pitch);
    return {from:lo+k*pitch,to:lo+k*pitch+w,rows:true,fits:k>=1&&k+band.boards<=full-1};
  }
  return {from:target,to:target+w,rows:false,fits:target-pitch>=lo-.001&&target+w+pitch<=hi+.001};
}

/** Plan every inlay on a level, in order: later inlays that overlap an earlier one are not built. `boards:false` plans
 * placement only; `taken` are areas already occupied (by inlays planned elsewhere). */
type InlayRuntime=Pick<typeof import('./inlayGeometryRuntime'),'planInlays'>;
let runtime:InlayRuntime|undefined,loading:Promise<void>|undefined;
export function registerInlayGeometry(value:InlayRuntime){runtime=value;}
export const inlayGeometryReady=()=>!!runtime;
export function loadInlayGeometry(){return loading??=import('./inlayGeometryRuntime').then(m=>{runtime=m;}).catch(error=>{loading=undefined;throw error;});}
/** Empty designs need no decorative engine. Never silently omit an unprepared inlay. */
export function planInlays(...args:Parameters<InlayRuntime['planInlays']>):InlayPlan[]{
 if(!args[0].length)return [];
 if(!runtime)throw new Error('Decorative inlay geometry is not loaded. Prepare design extensions before calculating.');
 return runtime.planInlays(...args);
}

/** Cut the level's field, border and breaker boards around the built inlays (with the board gap), recolour the rows
 * of a band across a straight field, and add the inlay boards. A board the inlays do not touch is kept exactly. */
export function applyInlays(boards:BoardRun[],plans:InlayPlan[],boardWidth:number,gap:number):BoardRun[]{
  const built=plans.filter(p=>p.status==='ok');if(!built.length)return boards;
  const rows=built.filter(p=>p.band?.rows),holes=built.filter(p=>!p.band?.rows).flatMap(p=>p.pieces.map(q=>offsetPolygons([q],-gap)[0]).filter(Boolean));
  const box=(poly:PlanPoint[])=>({x0:Math.min(...poly.map(p=>p.x)),x1:Math.max(...poly.map(p=>p.x)),y0:Math.min(...poly.map(p=>p.y)),y1:Math.max(...poly.map(p=>p.y))});
  const holeBoxes=holes.map(box),out:BoardRun[]=[];
  for(const b of boards){
    // A band across a straight field is its rows: the field boards along them take the band's colour, uncut.
    const band=b.role==='field'&&Math.abs(Math.sin(b.angleDeg*Math.PI/180))<1e-6?rows.find(p=>b.cy>p.band!.from&&b.cy<p.band!.to):undefined;
    if(band){out.push({...b,role:'inlay-fill',inlay:band.id});continue;}
    const poly=boardOutline(b,boardWidth),bb=box(poly);
    if(!holeBoxes.some(h=>h.x0<bb.x1&&h.x1>bb.x0&&h.y0<bb.y1&&h.y1>bb.y0)){out.push(b);continue;}
    const pieces=polygonCut([poly],holes,true);
    if(pieces.length===1&&Math.abs(Math.abs(signedArea(pieces[0]))-Math.abs(signedArea(poly)))<.01){out.push(b);continue;}
    for(const piece of pieces)if(Math.abs(signedArea(piece))>.5)out.push(polygonBoard(piece,b.angleDeg,b.role));
  }
  return [...out,...built.flatMap(p=>p.boards)];
}

/** The breakers left once bands running front to back are in: a band takes the place of any breaker it covers or
 * comes within a board of (the field boards end at the band instead, as they did at the breaker). */
export function keepBreakers(breakers:number[],plans:InlayPlan[],boardWidth:number,gap:number):number[]{
  const along=plans.filter(p=>p.status==='ok'&&p.band?.direction==='along'),pitch=boardWidth+gap;
  return along.length?breakers.filter(x=>!along.some(p=>x+boardWidth/2>p.band!.from-pitch&&x-boardWidth/2<p.band!.to+pitch)):breakers;
}
/** Build-up joists under bands running front to back, as under a breaker: two under each band board (0.94 in either
 * side of its middle) and one under each outer joint (2.81 in beyond the outer boards' middles). A one-board band
 * gets exactly a breaker's four. Plan x, level-local. */
export function bandBuildUps(plans:InlayPlan[],boardWidth:number,gap:number):number[]{
  const out:number[]=[];
  for(const p of plans)if(p.status==='ok'&&p.band?.direction==='along'){
    const mids=Array.from({length:p.band.boards},(_,k)=>p.band!.to-k*(boardWidth+gap)-boardWidth/2);
    out.push(Math.min(...mids)-2.8125,...mids.flatMap(m=>[m-.9375,m+.9375]),Math.max(...mids)+2.8125);
  }
  return out;
}

/** The next free inlay id, `inlay-N`. */
export function nextInlayId(inlays:DeckInlay[]){let n=inlays.length+1;while(inlays.some(i=>i.id===`inlay-${n}`))n++;return `inlay-${n}`;}
/** Replacing the legacy centre stripe (hasInlay) with a band in its place: one board wide, running front to back down
 * the middle, in a colour that sets it off. The stripe had no framing or labour of its own and the band does, so this
 * re-prices the deck; it happens only when the customer chooses it. */
export function stripeToBand(data:Pick<DeckData,'inlays'|'deckingMaterial'|'deckingColor'>):Partial<DeckData>{
  const inlays=data.inlays??[],fill=contrastColour(data);
  return {hasInlay:false,inlayLf:0,inlays:[...inlays,{id:nextInlayId(inlays),kind:'band',direction:'along',boards:1,...(fill?{fill}:{})}]};
}

/** The inlay context of a built deck level (for the editor's fit and status checks). */
export function levelInlayContext(data:Pick<DeckData,'deckingMaterial'|'boardWidth'|'pictureFrameRows'|'pattern'>,level:{footprint:FootprintPlan;deckingFootprint?:FootprintPlan}):InlayContext{
  const material=DECKING_CATALOGUE.find(m=>m.id===data.deckingMaterial)||DECKING_CATALOGUE[0];
  const gap=material.isComposite?.1875:.25,borders=data.pictureFrameRows||(data.pattern==='Picture Frame'?1:0);
  return {fieldPolygons:offsetPolygons([(level.deckingFootprint??level.footprint).outline],borders*(data.boardWidth+gap)),boardWidth:data.boardWidth,gap,stockLength:material.id==='cedar'?144:192,centre:{x:(level.footprint.origin?.x??0)+level.footprint.bounds.w/2,y:(level.footprint.origin?.y??0)+level.footprint.bounds.h/2},straight:data.pattern==='Straight'||data.pattern==='Picture Frame'};
}

/** The nearest version of an inlay that fits, clear of the other inlays on its level: at its size, first moved toward
 * the middle, then to the nearest free spot around it (in 1 ft steps, a band in 6 in steps along its one axis); only
 * then made smaller (6 in steps; a band loses boards). Null when even the smallest fits nowhere. The checks are the
 * placement rules of planInlays. */
export function fitInlay(inlay:DeckInlay,others:DeckInlay[],ctx:InlayContext):DeckInlay|null{
  const snap=(v:number)=>Math.round(v*2)/2,[olo,ohi]=INLAY_LIMITS.offsetFt;
  const allowed=offsetPolygons(ctx.fieldPolygons,ctx.boardWidth+ctx.gap),taken=planInlays(others,ctx,{boards:false,allowed}).filter(p=>p.status==='ok').flatMap(p=>p.pieces);
  const fits=(c:DeckInlay)=>planInlays([c],ctx,{boards:false,taken,allowed})[0].status==='ok';
  if(inlay.kind==='band'){
    const a0=inlay.atFt??0,spots=[...new Set([a0,snap(a0/2),0,...Array.from({length:121},(_,i)=>snap(a0+(i-60)/2)).sort((a,b)=>Math.abs(a-a0)-Math.abs(b-a0))])].filter(a=>a>=olo&&a<=ohi);
    for(let boards=inlay.boards;boards>=1;boards--)for(const a of spots){const c:Band={...inlay,boards:boards as Band['boards'],atFt:a};if(!a)delete c.atFt;if(fits(c))return c;}
    return null;
  }
  const lo=inlay.kind==='rug'||inlay.kind==='custom'?INLAY_LIMITS.rugFt[0]:inlay.kind==='diamond'?INLAY_LIMITS.diamondFt[0]:INLAY_LIMITS.medallionFt[0];
  const b=bounds(allowed);
  // Quick reject: an outline outside the field's bounding box cannot fit.
  const inBox=(c:Shaped)=>inlayOutline(c,ctx.centre).every(p=>p.x>=b.x0-.01&&p.x<=b.x1+.01&&p.y>=b.y0-.01&&p.y<=b.y1+.01);
  const x0=inlay.dxFt??0,y0=inlay.dyFt??0,steps=Array.from({length:21},(_,i)=>i-10);
  const around=steps.flatMap(x=>steps.map(y=>({x:x0+x,y:y0+y}))).filter(p=>p.x>=olo&&p.x<=ohi&&p.y>=olo&&p.y<=ohi).sort((a,b)=>Math.hypot(a.x-x0,a.y-y0)-Math.hypot(b.x-x0,b.y-y0));
  for(let s=0;;s+=.5){
    const customExtent=inlay.kind==='custom'?Math.max(bounds([inlay.points]).x1-bounds([inlay.points]).x0,bounds([inlay.points]).y1-bounds([inlay.points]).y0)/12:0;
    const scale=customExtent?Math.min(1,Math.max(lo,customExtent-s)/customExtent):1;
    const sized:Shaped=inlay.kind==='custom'?{...inlay,points:inlay.points.map(p=>({x:p.x*scale,y:p.y*scale}))}:inlay.kind==='medallion'?{...inlay,diameterFt:Math.max(lo,inlay.diameterFt-s)}:{...inlay,widthFt:Math.max(lo,inlay.widthFt-s),depthFt:inlay.kind==='diamond'?Math.max(lo,inlay.widthFt-s):Math.max(lo,inlay.depthFt-s)};
    const spots=[...[1,.5,0].map(t=>({x:snap(x0*t),y:snap(y0*t)})),...around];
    for(const p of spots){const c:Shaped={...sized,dxFt:snap(p.x),dyFt:snap(p.y)};if(inBox(c)&&fits(c))return {...c,...(c.dxFt?{}:{dxFt:undefined}),...(c.dyFt?{}:{dyFt:undefined})};}
    if(sized.kind==='custom'?customExtent-s<=lo:sized.kind==='medallion'?sized.diameterFt===lo:sized.widthFt===lo&&sized.depthFt===lo)return null;
  }
}

/** Inlay labour, reusing existing rates only: each frame's fitted edge, and each cut-in band's length, at the
 * breaker-board rate (1.5 crew-hours per 10 ft; both are fitted on both sides, as a breaker is), plus the inside's share
 * of the decking labour at its pattern's factor over the deck's (never less than the deck's own). Crew-days, before the
 * deck's multipliers. A medallion's labour is a builder quote (calculations.ts), so it adds none here. */
export const PATTERN_LABOUR:Record<BoardPattern,number>={Straight:1,Diagonal:1.20,'Picture Frame':1.25,Herringbone:1.30};
export function inlayCrewDays(plans:InlayPlan[],deckPattern:BoardPattern,deckingRateSqftPerDay:number){
  const built=plans.filter(p=>p.status==='ok'&&!p.quote);
  const edge=built.reduce((n,p)=>n+p.edgeFt/10*1.5,0)/8;
  const inside=built.reduce((n,p)=>n+Math.max(0,PATTERN_LABOUR[p.pattern]/PATTERN_LABOUR[deckPattern]-1)*p.fillSqft/deckingRateSqftPerDay,0);
  return {edge,inside,total:edge+inside};
}

/** Plain words for the built inlays, e.g. "Inlays: a 6 × 4 ft framed rectangle with a herringbone inside". */
export function inlayWords(plans:InlayPlan[],inlays:DeckInlay[]):string|undefined{
  const built=plans.filter(p=>p.status==='ok');if(!built.length)return undefined;
  const inside:Record<InlayFill,string>={Straight:'boards running front to back',Diagonal:'boards at 45°',Herringbone:'a herringbone'},count=['one','two','three','four'];
  return `Inlays: ${built.map(p=>{const i=inlays.find(x=>x.id===p.id)!;
    if(i.kind==='band')return `a band ${count[i.boards-1]} board${i.boards===1?'':'s'} wide ${i.direction==='across'?'across the deck':'running front to back'}`;
    if(i.kind==='medallion')return `a ${i.diameterFt} ft ${i.style==='compass'?'compass medallion in eight wedges':i.style==='compass-rose'?'compass rose with eight split pointed rays':i.style==='sunburst'?'sunburst with sixteen radial rays':'round medallion with boards running front to back inside'}`;
    if(i.kind==='custom')return `a framed ${i.name||'custom polygon'} with ${inside[p.pattern]} inside`;
    return `${i.kind==='diamond'?`a ${i.widthFt} ft diamond`:`a ${i.widthFt} × ${i.depthFt} ft framed rectangle`} with ${inside[p.pattern]} inside`;}).join('; ')}`;
}
