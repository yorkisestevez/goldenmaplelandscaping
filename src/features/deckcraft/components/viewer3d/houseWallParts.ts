import type {HouseOpening} from '../../types';
import type {Box} from '../../deckTakeoff';

/** Partition wall solids at every opening edge; no overlapping holes or door threshold caps. */
/** `hidden`: local x stretches of the wall inside another house block; nothing is built there. */
export function houseWallParts(span:number,height:number,openings:HouseOpening[],hidden:[number,number][]=[]):Box[]{
 const rects=openings.map(o=>({left:-span/2+span*o.offsetPct/100-o.widthIn/2,right:-span/2+span*o.offsetPct/100+o.widthIn/2,bottom:o.bottomIn,top:o.bottomIn+o.heightIn}));
 const xs=[...new Set([-span/2,span/2,...[...rects.flatMap(r=>[r.left,r.right]),...hidden.flat()].filter(x=>x>-span/2&&x<span/2)])].sort((a,b)=>a-b);
 const ys=[...new Set([0,height,...rects.flatMap(r=>[r.bottom,r.top]).filter(y=>y>0&&y<height)])].sort((a,b)=>a-b),result:Box[]=[];
 for(let yi=0;yi<ys.length-1;yi++)for(let xi=0;xi<xs.length-1;xi++){
  const x=(xs[xi]+xs[xi+1])/2,y=(ys[yi]+ys[yi+1])/2;
  if(rects.some(r=>x>r.left&&x<r.right&&y>r.bottom&&y<r.top)||hidden.some(([l,r])=>x>l&&x<r))continue;
  result.push({x,y,z:-4,w:xs[xi+1]-xs[xi],h:ys[yi+1]-ys[yi],d:8});
 }
 return result;
}
