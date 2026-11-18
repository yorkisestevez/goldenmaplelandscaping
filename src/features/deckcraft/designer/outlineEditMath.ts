import {activeCustomFront,customEdgeName,customOutline,OUTLINE_LIMITS,type OutlinePoint} from '../lib/customOutline';
import {frontEdges,moveEdge,outlinePreset,type OutlinePresetId} from '../lib/outlineEdits';
import type {DeckData} from '../types';

/**
 * Editing a custom outline, the same way wherever it is done (useOutlineEdit.ts: the Deck section's outline editor and the
 * Draw outline tool on the plan). Every change is one of lib/outlineEdits.ts's own edits; one that breaks the outline
 * rules is refused with REFUSED and the outline stays as it was. Pure, so the checks can run it.
 * Edges are numbered as frontEdges() numbers them: 0 is the right side, then the front edges, and the last is the left
 * side, which stays on the house corner.
 */
export const REFUSED='That change does not fit the outline rules: edges at least 2 ft across (steps 1 ft), every part of the deck 3 to 40 ft out from the house, and square or 45° corners.';

export type OutlineEdge=ReturnType<typeof frontEdges>[number];
/** An edit's outcome: the new front, a refusal, or nothing to do. */
export type OutlineEdit={front:OutlinePoint[]}|{refused:true}|null;

/** The designer's names for the edges ("Right side", "Front edge 1", "Step 1", "45° edge 1", "Left side"). */
export function edgeName(front:OutlinePoint[],i:number):string{
  const ids=customOutline(front).edgeIds;
  return customEdgeName(ids[i+1])??`Edge ${i}`;
}
/** "Front edge 1, 16 ft" (and "at 45°"): an edge as the outline editor has always named it. */
export function describeEdge(front:OutlinePoint[],i:number):string{
  const e=frontEdges(front)[i];
  return `${edgeName(front,i)}, ${e.lengthFt} ft${e.kind==='angled'?' at 45°':''}`;
}
/** An edge that moves toward the house and the yard (an across or 45° edge); the rest move left and right. */
export const movesOut=(e:Pick<OutlineEdge,'kind'>)=>e.kind==='across'||e.kind==='angled';
/** The left side is fixed on the house corner; every other edge moves. */
export const movable=(front:OutlinePoint[],i:number)=>i>=0&&i<front.length;

/**
 * Moves an edge `deltaFt` along its normal (positive: an across or 45° edge toward the yard, a step or the right side to
 * the right). A 45° edge that cannot move half a foot on the grid moves a whole foot, as the outline editor always has.
 */
export function edgeMove(front:OutlinePoint[],i:number,deltaFt:number):OutlinePoint[]|null{
  if(!movable(front,i)||!deltaFt)return null;
  return moveEdge(front,i,deltaFt)??(frontEdges(front)[i].kind==='angled'?moveEdge(front,i,deltaFt*2):null);
}
const asEdit=(next:OutlinePoint[]|null):OutlineEdit=>next?{front:next}:{refused:true};

/** The Deck section's edge buttons: up and down move an across or 45° edge (down is toward the yard), left and right the
 * others, 0.5 ft (Shift 1 ft). Null for any other key. */
export function listKeyDelta(e:Pick<OutlineEdge,'kind'>,key:string,shift:boolean):number|null{
  const step=shift?1:.5,keys:Record<string,number>=movesOut(e)?{ArrowUp:-step,ArrowDown:step}:{ArrowLeft:-step,ArrowRight:step};
  return key in keys?keys[key]:null;
}

/** How far an edge can go, one grid step at a time, before the rules refuse it: the last front that still fits. */
export function edgeLimit(front:OutlinePoint[],i:number,dir:1|-1):OutlinePoint[]|null{
  if(!movable(front,i))return null;
  const step=frontEdges(front)[i].kind==='angled'?1:OUTLINE_LIMITS.gridFt;
  let best:OutlinePoint[]|null=null;
  for(let k=1;k<=200;k++){const next=moveEdge(front,i,dir*step*k);if(!next)break;best=next;}
  return best;
}

/**
 * An edge as a slider on the plan: its value (feet out from the house for an across or 45° edge, feet across from the
 * left side for a step or the right side), the rule limits, its words and how it lies.
 */
export interface EdgeSlider{index:number;label:string;value:number;min:number;max:number;text:string;orientation:'horizontal'|'vertical';a:OutlinePoint;b:OutlinePoint;kind:OutlineEdge['kind']}
const r2=(n:number)=>Math.round(n*100)/100;
export function edgeSliders(front:OutlinePoint[]):EdgeSlider[]{
  const [d0,d1]=OUTLINE_LIMITS.depthFt,[w0,w1]=OUTLINE_LIMITS.widthFt,W=front[0].x;
  return frontEdges(front).filter(e=>movable(front,e.index)).map(e=>{
    const label=edgeName(front,e.index),out=movesOut(e),midY=r2((e.a.y+e.b.y)/2);
    const [value,min,max,text]=e.kind==='side'?[W,w0,w1,`Deck ${W} ft wide`]
      :e.kind==='step'?[e.a.x,0,W,`${e.a.x} ft from the left side, ${e.lengthFt} ft long`]
      :e.kind==='angled'?[midY,d0,d1,`At 45°, ${e.lengthFt} ft long, ${midY} ft out from the house`]
      :[e.a.y,d0,d1,`${e.a.y} ft out from the house, ${e.lengthFt} ft long`];
    return {index:e.index,label,value,min,max,text,orientation:out?'vertical' as const:'horizontal' as const,a:e.a,b:e.b,kind:e.kind};
  });
}

/**
 * A key on an edge's slider on the plan: Up and Right move it out or to the right (larger, as sliders do), Down and Left
 * back, 0.5 ft (Shift 1 ft); Home and End take it as far as the rules allow. A move the rules refuse is a refusal.
 */
export function sliderKey(front:OutlinePoint[],i:number,key:string,shift:boolean):OutlineEdit{
  if(!movable(front,i))return null;
  const step=shift?1:.5;
  if(key==='ArrowUp'||key==='ArrowRight')return asEdit(edgeMove(front,i,step));
  if(key==='ArrowDown'||key==='ArrowLeft')return asEdit(edgeMove(front,i,-step));
  if(key==='Home'||key==='End'){const next=edgeLimit(front,i,key==='End'?1:-1);return next?{front:next}:null;}
  return null;
}

/**
 * A drag of one edge on the plan. The outline is untouched while it lasts: `ghost` is the last front that fits under the
 * pointer (null while it is back where it began), `refused` says the pointer is somewhere the rules refuse. It changes the
 * design once, when it ends (endEdgeDrag).
 */
export interface EdgeDrag{edge:number;pointerId:number;x:number;y:number;base:OutlinePoint[];applied:number;ghost:OutlinePoint[]|null;refused:boolean}
export const beginEdgeDrag=(front:OutlinePoint[],edge:number,pointerId:number,x:number,y:number):EdgeDrag=>({edge,pointerId,x,y,base:front,applied:0,ghost:null,refused:false});
/** The pointer has moved `dxFt`, `dyFt` (plan feet) from where the drag began: the edge follows it on the 6 in grid,
 * along its own normal, as the outline editor's drag always did. */
export function moveEdgeDrag(g:EdgeDrag,dxFt:number,dyFt:number):EdgeDrag{
  const e=frontEdges(g.base)[g.edge];if(!e||!movable(g.base,g.edge))return g;
  const raw=e.kind==='across'?dyFt:e.kind==='angled'?((e.b.x-e.a.x)*(e.b.y-e.a.y)<0?dxFt+dyFt:dyFt-dxFt):dxFt;
  const snapped=Math.round(raw*2)/2;
  if(snapped===g.applied&&!g.refused)return g;
  if(snapped===0)return {...g,applied:0,ghost:null,refused:false};
  const next=moveEdge(g.base,g.edge,snapped);
  return next?{...g,applied:snapped,ghost:next,refused:false}:g.refused?g:{...g,refused:true};
}
/** The one front a finished drag commits, or null when it ends where it began. */
export const endEdgeDrag=(g:EdgeDrag):OutlinePoint[]|null=>g.applied!==0?g.ghost:null;
/** Which way a 45° edge runs: 'd1' down to the left (x + y constant), 'd2' down to the right (y − x constant). */
export const diagonal=(a:OutlinePoint,b:OutlinePoint)=>(b.x-a.x)*(b.y-a.y)<0?'d1' as const:'d2' as const;
/** How far (plan feet) an edge's middle moves when it is moved `deltaFt` along its normal, for its handle during a drag. */
export function edgeShift(e:Pick<OutlineEdge,'kind'|'a'|'b'>,deltaFt:number):{x:number;y:number}{
  if(e.kind==='across')return {x:0,y:deltaFt};
  if(e.kind==='angled')return diagonal(e.a,e.b)==='d1'?{x:deltaFt/2,y:deltaFt/2}:{x:-deltaFt/2,y:deltaFt/2};
  return {x:deltaFt,y:0};
}

/**
 * A starting shape, sized to the deck as it is drawn (the outline's own size, or the deck's width and depth before it is
 * an outline). Null when the deck is too small for it.
 */
export function presetFront(data:DeckData,id:OutlinePresetId):OutlinePoint[]|null{
  const front=activeCustomFront(data);
  return front?outlinePreset(id,front[0].x,Math.max(...front.map(p=>p.y))):outlinePreset(id,Number(data.width),Number(data.length));
}
/** The patch a starting shape makes: the outline, and on a deck that is not an outline yet, the outline shape too
 * (chooseShape, as the Deck section's shape menu makes it). Null when the shape does not fit. Legacy constrained
 * fronts clear any free outline so `customFront` stays authoritative. */
export function presetPatch(data:DeckData,id:OutlinePresetId):Partial<DeckData>|null{
  const next=presetFront(data,id);if(!next)return null;
  if(data.shape==='Custom'&&!data.deckOutlines?.main)return {customFront:next};
  const deckOutlines=data.deckOutlines?{...data.deckOutlines,main:undefined}:undefined;
  return {shape:'Custom',levels:1,customFront:next,...(data.deckOutlines?{deckOutlines}:{})};
}
