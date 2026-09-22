import type {DeckData,HouseBlock,HouseConfig,HouseOpening} from './types';
import {getHouseConfig} from './houseSettings';
import {getHousePlacement} from './housePlacement';
import {polygonCut,polygonUnion,signedArea} from './lib/polygonCuts';
import {unnotchedMainOutline,type PlanPoint} from './lib/deckGeometry';

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
/** Deck always left in front of a block that reaches into it. */
export const MIN_DECK_IN_FRONT_IN=36;
export const deckLengthIn=(data:DeckData)=>Math.max(12,(Number(data.length)||0)*12);
/** Every block keeps at least this much of its main-block wall, so it is always attached. */
export const MIN_BLOCK_SHARE_IN=24;
export const HOUSE_BLOCK_WIDTH_FT=[2,100] as const;
export const HOUSE_BLOCK_DEPTH_FT=[1,60] as const;
export const HOUSE_BLOCK_OFFSET_FT=[-100,100] as const;
export const HOUSE_BLOCK_ID=/^[a-z][a-zA-Z0-9]{0,15}$/;

const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const FACADE_SIDE:Record<HouseOpening['facade'],HouseWallSide>={Front:'front',Back:'back',Left:'left',Right:'right'};
export const SIDE_FACADE:Record<HouseWallSide,HouseOpening['facade']>={front:'Front',back:'Back',left:'Left',right:'Right'};

/** Keeps every block attached: at least MIN_BLOCK_SHARE_IN of its wall, at most MAX_HOUSE_BLOCKS blocks.
 * Given the deck length, a block reaching toward the deck also stops MIN_DECK_IN_FRONT_IN short of
 * the deck's front, so the deck around it never splits in two. */
export function normalizeHouseBlocks(house:HouseConfig,deckLengthIn?:number):HouseBlock[]{
  const HW=house.widthFt*12,HD=house.depthFt*12,reach=deckLengthIn===undefined?Infinity:Math.max(HOUSE_BLOCK_DEPTH_FT[0]*12,deckLengthIn-MIN_DECK_IN_FRONT_IN);
  return (house.footprint?.rects??[]).slice(0,MAX_HOUSE_BLOCKS).map(b=>{
    const wallLen=b.wall==='Front'||b.wall==='Back'?HW:HD,w=clamp(b.widthFt,HOUSE_BLOCK_WIDTH_FT[0],HOUSE_BLOCK_WIDTH_FT[1])*12,share=Math.min(MIN_BLOCK_SHARE_IN,w,wallLen);
    // A side block can run past the deck-facing corner (offset < 0) toward the deck, up to the same reach.
    const side=b.wall==='Left'||b.wall==='Right',offsetIn=clamp(b.offsetFt*12,Math.max(share-w,side?-reach:-Infinity),wallLen-share);
    const depthIn=Math.min(clamp(b.depthFt,HOUSE_BLOCK_DEPTH_FT[0],HOUSE_BLOCK_DEPTH_FT[1])*12,b.wall==='Front'?reach:Infinity);
    return {...b,widthFt:w/12,depthFt:depthIn/12,offsetFt:offsetIn/12};
  });
}

export function getHouseBlocks(data:DeckData):HouseBlockPlan[]{
  const house=getHouseConfig(data),{x0,x1,depthIn:D}=getHousePlacement(data),storey=house.storeyHeightIn;
  let raw:PlanPoint[]|undefined;const outline=()=>raw??=unnotchedMainOutline(data);
  const main:HouseBlockPlan={id:'main',kind:'house',rect:{x0,x1,y0:-D,y1:0},storeys:house.storeys,wallHeightIn:house.storeys*storey,floorHeightIn:house.floorHeightIn,roofShape:house.roofShape,attachedTo:null,ridge:house.ridge==='x'?'x':'z'};
  return [main,...normalizeHouseBlocks(house,deckLengthIn(data)).map((b):HouseBlockPlan=>{
    const o=b.offsetFt*12,w=b.widthFt*12,d=b.depthFt*12;
    const rect:HouseRect=b.wall==='Front'?{x0:x0+o,x1:x0+o+w,y0:0,y1:d}
      :b.wall==='Back'?{x0:x0+o,x1:x0+o+w,y0:-D-d,y1:-D}
      :b.wall==='Left'?{x0:x0-d,x1:x0,y0:-o-w,y1:-o}
      :{x0:x1,x1:x1+d,y0:-o-w,y1:-o};
    // A block reaching into the deck stops MIN_DECK_IN_FRONT_IN short of the deck's front across its
    // whole width (an L-shape or multi-corner front notch is shallower than the deck length).
    if(rect.y1>0){const front=deckFrontOver(outline(),rect.x0,rect.x1);if(front!==null&&rect.y1>front-MIN_DECK_IN_FRONT_IN){const shift=rect.y1-Math.max(HOUSE_BLOCK_DEPTH_FT[0]*12,front-MIN_DECK_IN_FRONT_IN);if(b.wall==='Front')rect.y1-=shift;else{rect.y0-=shift;rect.y1-=shift;}}}
    const storeys=b.storeys??1;
    return {id:b.id,kind:b.kind,rect,storeys,wallHeightIn:storeys*storey,floorHeightIn:b.floorHeightIn??(b.kind==='house'?house.floorHeightIn:undefined),roofShape:b.roofShape??(b.kind==='garage'?'Gable':house.roofShape),attachedTo:b.wall,ridge:b.wall==='Front'||b.wall==='Back'?'z':'x'};
  })];
}

/** Shallowest front of the deck outline between x0 and x1 (plan y), or null where there is no deck. */
function deckFrontOver(outline:PlanPoint[],x0:number,x1:number):number|null{
  const xs=[x0+.01,x1-.01,...outline.map(p=>p.x).filter(x=>x>x0&&x<x1)].flatMap(x=>[x-.01,x+.01]).filter(x=>x>x0&&x<x1);
  let front:number|null=null;
  for(const x of xs){
    const cross:number[]=[];
    outline.forEach((a,i)=>{const b=outline[(i+1)%outline.length];if((a.x<=x&&b.x>x)||(b.x<=x&&a.x>x))cross.push(a.y+(x-a.x)*(b.y-a.y)/(b.x-a.x));});
    if(cross.length)front=Math.min(front??Infinity,Math.max(...cross));
  }
  return front;
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

/** Blocks that reach into the deck's side of the deck-facing wall line (y > 0). */
export const blocksTowardDeck=(blocks:HouseBlockPlan[])=>blocks.slice(1).filter(b=>b.rect.y1>.5);

const snap=(v:number)=>Math.round(v*1e6)/1e6;
/**
 * The main deck outline notched around every house block that reaches into it, for a deck fastened
 * to the house (a freestanding deck is not cut; an overlap is reported instead). Edges are split at
 * every block corner lying on them, so each outline edge is wholly against one wall or wholly clear.
 * Wrap edge ids carry over; the new edges are '<block id>-front|left|right'. A house without
 * blocks, or whose blocks stay clear of the deck side, returns the outline untouched.
 */
export function notchDeckAroundHouse<T extends {outline:PlanPoint[];edgeIds?:string[]}>(data:DeckData,fp:T):T{
  if(data.deckType!=='Attached'&&data.deckType!=='Add-on'||!hasHouseBlocks(data))return fp;
  const blocks=getHouseBlocks(data),toward=blocksTowardDeck(blocks);
  const corners=blocks.slice(1).filter(b=>b.rect.y1>-.5).flatMap(b=>rectPolygon(b.rect));
  let outline=fp.outline;
  if(toward.length){
    const cut=polygonCut([outline],toward.map(b=>rectPolygon(b.rect)),true).sort((p,q)=>signedArea(q)-signedArea(p))[0];
    if(!cut)return fp;
    outline=cleanOutline(cut.map(p=>({x:snap(p.x),y:snap(p.y)})));
  }
  // Split edges at block corners lying on them (e.g. a garage face flush with the deck-facing wall).
  const split:PlanPoint[]=[];
  outline.forEach((a,i)=>{
    const b=outline[(i+1)%outline.length],len=Math.hypot(b.x-a.x,b.y-a.y);split.push(a);
    const along=corners.filter(p=>Math.abs((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x))/len<.01).map(p=>({p,t:((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/len})).filter(({t})=>t>.5&&t<len-.5).sort((p,q)=>p.t-q.t);
    for(const {p} of along)if(!split.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<.01))split.push(p);
  });
  outline=split;
  if(outline.length===fp.outline.length&&outline.every((p,i)=>Math.hypot(p.x-fp.outline[i].x,p.y-fp.outline[i].y)<1e-9))return fp;
  // Start where the original outline started when that corner survives, else at the lowest-left corner.
  const start=fp.outline[0],keep=outline.findIndex(p=>Math.hypot(p.x-start.x,p.y-start.y)<1e-6);
  const first=keep>=0?keep:outline.reduce((best,p,i)=>p.y<outline[best].y-1e-6||(Math.abs(p.y-outline[best].y)<1e-6&&p.x<outline[best].x)?i:best,0);
  outline=[...outline.slice(first),...outline.slice(0,first)];
  if(!fp.edgeIds)return {...fp,outline};
  const src=fp.outline,ids=fp.edgeIds;
  const edgeIds=outline.map((a,i)=>{
    const b=outline[(i+1)%outline.length],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    const j=src.findIndex((p,k)=>{const q=src[(k+1)%src.length],len=Math.hypot(q.x-p.x,q.y-p.y);return [a,b,mid].every(v=>Math.abs((v.x-p.x)*(q.y-p.y)-(v.y-p.y)*(q.x-p.x))/len<.01&&((v.x-p.x)*(q.x-p.x)+(v.y-p.y)*(q.y-p.y))/len>-.01&&((v.x-p.x)*(q.x-p.x)+(v.y-p.y)*(q.y-p.y))/len<len+.01);});
    if(j>=0)return ids[j];
    const block=toward.find(k=>mid.x>=k.rect.x0-.01&&mid.x<=k.rect.x1+.01&&mid.y>=k.rect.y0-.01&&mid.y<=k.rect.y1+.01);
    if(!block)return 'main-front';
    return Math.abs(mid.y-block.rect.y1)<.01?`${block.id}-front`:Math.abs(mid.x-block.rect.x0)<.01?`${block.id}-left`:`${block.id}-right`;
  });
  return {...fp,outline,edgeIds};
}
/** Drops repeated and collinear vertices a polygon cut can leave. */
function cleanOutline(points:PlanPoint[]):PlanPoint[]{
  let out=points.filter((p,i)=>{const q=points[(i+1)%points.length];return Math.hypot(q.x-p.x,q.y-p.y)>1e-6;});
  for(let changed=true;changed&&out.length>3;){changed=false;
    for(let i=0;i<out.length;i++){const a=out[(i+out.length-1)%out.length],p=out[i],b=out[(i+1)%out.length];if(Math.abs((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x))<1e-6){out=out.filter((_,j)=>j!==i);changed=true;break;}}}
  return out;
}
