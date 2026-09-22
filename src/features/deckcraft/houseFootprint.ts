import type {DeckData,HouseBlock,HouseConfig,HouseOpening} from './types';
import {getHouseConfig} from './houseSettings';
import {getHousePlacement} from './housePlacement';
import {polygonUnion} from './lib/polygonCuts';
import type {PlanPoint} from './lib/deckGeometry';

/**
 * The house as rectangular blocks: the main block (placed by `getHousePlacement`) plus bump-outs,
 * L-wings and an attached garage, each attached to one wall of the main block.
 *
 * Plan space as everywhere else: inches, +x along the deck width, +y toward the yard, the main
 * block's deck-facing wall on y = 0 and the main block at y < 0. A block attached to the 'Front'
 * wall is a bump-out toward the deck (y > 0).
 *
 * Every rect side is a wall with an id '<block id>-<side>' ('main-front' is the deck-facing wall).
 * A wall runs from `a` to `b` in the direction its openings' `offsetPct` runs, which is how the 3D
 * facades have always drawn them: front walls left to right (+x), back walls right to left, left
 * walls from the street end toward the deck, right walls from the deck end toward the street.
 * Stretches of a wall covered by another block are interior and are not drawn.
 */
export type HouseWallSide='front'|'back'|'left'|'right';
export interface HouseRect{x0:number;x1:number;y0:number;y1:number}
export interface HouseBlockPlan{id:string;kind:'house'|'garage';rect:HouseRect;storeys:1|2|3;wallHeightIn:number;floorHeightIn?:number;roofShape:HouseConfig['roofShape'];
  /** Main-block wall this block is attached to; null for the main block. */
  attachedTo:HouseBlock['wall']|null;
  /** Direction the gable ridge runs: along plan y ('z' in 3D) or along plan x. */
  ridge:'x'|'z'}
export interface HouseWallPlan{id:string;blockId:string;side:HouseWallSide;a:PlanPoint;b:PlanPoint;outward:PlanPoint;lengthIn:number;
  /** Stretches (inches from `a`) not covered by another block. */
  exposed:[number,number][];
  /** Stretches (inches from `a`) inside another block. */
  covered:[number,number][]}

export const MAX_HOUSE_BLOCKS=6;
/** Every block keeps at least this much of its main-block wall, so it is always attached. */
export const MIN_BLOCK_SHARE_IN=24;
export const HOUSE_BLOCK_WIDTH_FT=[2,100] as const;
export const HOUSE_BLOCK_DEPTH_FT=[1,60] as const;
export const HOUSE_BLOCK_OFFSET_FT=[-100,100] as const;
export const HOUSE_BLOCK_ID=/^[a-z][a-zA-Z0-9]{0,15}$/;

const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const FACADE_SIDE:Record<HouseOpening['facade'],HouseWallSide>={Front:'front',Back:'back',Left:'left',Right:'right'};
export const SIDE_FACADE:Record<HouseWallSide,HouseOpening['facade']>={front:'Front',back:'Back',left:'Left',right:'Right'};

/** Keeps every block attached: at least MIN_BLOCK_SHARE_IN of its wall, at most MAX_HOUSE_BLOCKS blocks. */
export function normalizeHouseBlocks(house:HouseConfig):HouseBlock[]{
  const HW=house.widthFt*12,HD=house.depthFt*12;
  return (house.footprint?.rects??[]).slice(0,MAX_HOUSE_BLOCKS).map(b=>{
    const wallLen=b.wall==='Front'||b.wall==='Back'?HW:HD,w=clamp(b.widthFt,HOUSE_BLOCK_WIDTH_FT[0],HOUSE_BLOCK_WIDTH_FT[1])*12,share=Math.min(MIN_BLOCK_SHARE_IN,w,wallLen);
    const offsetIn=clamp(b.offsetFt*12,share-w,wallLen-share);
    return {...b,widthFt:w/12,depthFt:clamp(b.depthFt,HOUSE_BLOCK_DEPTH_FT[0],HOUSE_BLOCK_DEPTH_FT[1]),offsetFt:offsetIn/12};
  });
}

export function getHouseBlocks(data:DeckData):HouseBlockPlan[]{
  const house=getHouseConfig(data),{x0,x1,depthIn:D}=getHousePlacement(data),storey=house.storeyHeightIn;
  const main:HouseBlockPlan={id:'main',kind:'house',rect:{x0,x1,y0:-D,y1:0},storeys:house.storeys,wallHeightIn:house.storeys*storey,floorHeightIn:house.floorHeightIn,roofShape:house.roofShape,attachedTo:null,ridge:'z'};
  return [main,...normalizeHouseBlocks(house).map((b):HouseBlockPlan=>{
    const o=b.offsetFt*12,w=b.widthFt*12,d=b.depthFt*12;
    const rect:HouseRect=b.wall==='Front'?{x0:x0+o,x1:x0+o+w,y0:0,y1:d}
      :b.wall==='Back'?{x0:x0+o,x1:x0+o+w,y0:-D-d,y1:-D}
      :b.wall==='Left'?{x0:x0-d,x1:x0,y0:-o-w,y1:-o}
      :{x0:x1,x1:x1+d,y0:-o-w,y1:-o};
    const storeys=b.storeys??1;
    return {id:b.id,kind:b.kind,rect,storeys,wallHeightIn:storeys*storey,floorHeightIn:b.floorHeightIn??(b.kind==='house'?house.floorHeightIn:undefined),roofShape:b.roofShape??(b.kind==='garage'?'Gable':house.roofShape),attachedTo:b.wall,ridge:b.wall==='Front'||b.wall==='Back'?'z':'x'};
  })];
}

/** True when the house has blocks beyond the main rectangle. */
export const hasHouseBlocks=(data:DeckData)=>!!getHouseConfig(data).footprint?.rects.length;

export const rectPolygon=(r:HouseRect):PlanPoint[]=>[{x:r.x0,y:r.y0},{x:r.x1,y:r.y0},{x:r.x1,y:r.y1},{x:r.x0,y:r.y1}];

function sideGeometry(r:HouseRect,side:HouseWallSide){
  return side==='front'?{a:{x:r.x0,y:r.y1},b:{x:r.x1,y:r.y1},outward:{x:0,y:1}}
    :side==='back'?{a:{x:r.x1,y:r.y0},b:{x:r.x0,y:r.y0},outward:{x:0,y:-1}}
    :side==='left'?{a:{x:r.x0,y:r.y0},b:{x:r.x0,y:r.y1},outward:{x:-1,y:0}}
    :{a:{x:r.x1,y:r.y1},b:{x:r.x1,y:r.y0},outward:{x:1,y:0}};
}

/** Merges overlapping [from,to] stretches. */
function merge(spans:[number,number][]){
  const out:[number,number][]=[];
  for(const [s,e] of [...spans].sort((p,q)=>p[0]-q[0]))if(out.length&&s<=out[out.length-1][1]+1e-6)out[out.length-1][1]=Math.max(out[out.length-1][1],e);else out.push([s,e]);
  return out;
}

export function getHouseWalls(data:DeckData,blocks:HouseBlockPlan[]=getHouseBlocks(data)):HouseWallPlan[]{
  const walls:HouseWallPlan[]=[];
  for(const block of blocks)for(const side of ['front','back','left','right'] as const){
    const {a,b,outward}=sideGeometry(block.rect,side),len=Math.hypot(b.x-a.x,b.y-a.y),u={x:(b.x-a.x)/len,y:(b.y-a.y)/len};
    // A stretch is covered when the point just outside the wall lies inside another block.
    const covered:[number,number][]=[];
    for(const other of blocks){if(other===block)continue;const r=other.rect,px=a.x+outward.x*.5,py=a.y+outward.y*.5;
      if(u.y===0){if(py<=r.y0||py>=r.y1)continue;const s=((u.x>0?r.x0:r.x1)-a.x)*u.x,e=((u.x>0?r.x1:r.x0)-a.x)*u.x;if(e>0&&s<len)covered.push([Math.max(0,s),Math.min(len,e)]);}
      else{if(px<=r.x0||px>=r.x1)continue;const s=((u.y>0?r.y0:r.y1)-a.y)*u.y,e=((u.y>0?r.y1:r.y0)-a.y)*u.y;if(e>0&&s<len)covered.push([Math.max(0,s),Math.min(len,e)]);}
    }
    const hidden=merge(covered).filter(([s,e])=>e-s>.01),exposed:[number,number][]=[];let at=0;
    for(const [s,e] of hidden){if(s-at>.01)exposed.push([at,s]);at=Math.max(at,e);}
    if(len-at>.01)exposed.push([at,len]);
    walls.push({id:`${block.id}-${side}`,blockId:block.id,side,a,b,outward,lengthIn:len,exposed,covered:hidden});
  }
  return walls;
}

/** Outline of the whole house (union of its blocks), counter-clockwise. */
export function houseOutline(data:DeckData,blocks:HouseBlockPlan[]=getHouseBlocks(data)):PlanPoint[][]{
  return blocks.length===1?[rectPolygon(blocks[0].rect)]:polygonUnion(blocks.map(b=>rectPolygon(b.rect)));
}

/** The wall an opening sits on: its `wallId` when that wall exists, otherwise the main block's `facade` wall. */
export function openingWallId(opening:HouseOpening,house?:HouseConfig):string{
  const main=`main-${FACADE_SIDE[opening.facade]}`;
  if(!opening.wallId)return main;
  if(!house)return opening.wallId;
  const [id]=opening.wallId.split('-');
  return id==='main'||normalizeHouseBlocks(house).some(b=>b.id===id)?opening.wallId:main;
}

/** True when an opening's centre sits on a stretch of wall that another block covers. */
export function openingHidden(opening:HouseOpening,walls:HouseWallPlan[],house:HouseConfig){
  const wall=walls.find(w=>w.id===openingWallId(opening,house));if(!wall)return true;
  const at=wall.lengthIn*opening.offsetPct/100;
  return wall.covered.some(([s,e])=>at>s+.01&&at<e-.01);
}

/** Plain name of a wall for pickers and notes, e.g. "Garage, street side". */
export function wallLabel(wallId:string,house:HouseConfig):string{
  const [id,side]=wallId.split('-') as [string,HouseWallSide];
  const sideName={front:'deck-facing wall',back:'street-side wall',left:'left side',right:'right side'}[side]??side;
  if(id==='main')return `House, ${sideName}`;
  const blocks=normalizeHouseBlocks(house),block=blocks.find(b=>b.id===id);if(!block)return wallId;
  const same=blocks.filter(b=>blockKindLabel(b)===blockKindLabel(block)),n=same.length>1?` ${same.indexOf(block)+1}`:'';
  return `${blockKindLabel(block)}${n}, ${sideName}`;
}
export const blockKindLabel=(b:HouseBlock)=>b.kind==='garage'?'Garage':b.wall==='Front'?'Bump-out':'Wing';

/** A block attached to the deck-facing wall reaches toward the deck. */
export const deckSideBlocks=(blocks:HouseBlockPlan[])=>blocks.filter(b=>b.attachedTo==='Front');
