import type {DeckData,OutlinePoint} from '../types';
import type {FootprintPlan,PlanPoint} from './deckGeometry';

export type BoundaryLevel=1|2|3;
export const boundaryKey=(level:BoundaryLevel)=>level===1?'main':level===2?'second':'third';
const cross=(a:PlanPoint,b:PlanPoint,c:PlanPoint)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const between=(a:PlanPoint,b:PlanPoint,p:PlanPoint)=>Math.abs(cross(a,b,p))<1e-7&&p.x>=Math.min(a.x,b.x)-1e-7&&p.x<=Math.max(a.x,b.x)+1e-7&&p.y>=Math.min(a.y,b.y)-1e-7&&p.y<=Math.max(a.y,b.y)+1e-7;
const intersects=(a:PlanPoint,b:PlanPoint,c:PlanPoint,d:PlanPoint)=>{
  const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
  return abC*abD<0&&cdA*cdB<0||between(a,b,c)||between(a,b,d)||between(c,d,a)||between(c,d,b);
};
export const boundaryBounds=(points:PlanPoint[])=>{
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);
  return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};
};
/** Editable polygons use inches here, saved feet at the persistence boundary. No angle or monotonic-x restriction. */
export function boundaryProblem(points:unknown):string{
  if(!Array.isArray(points)||points.length<3||points.length>64)return 'Keep between 3 and 64 points on a deck area.';
  if(!points.every(p=>p&&typeof p==='object'&&Number.isFinite(p.x)&&Number.isFinite(p.y)))return 'Each point needs an across and out measurement.';
  const o=points as PlanPoint[],b=boundaryBounds(o);
  if(o.some(p=>Math.abs(p.x)>2400||Math.abs(p.y)>2400)||b.w>1440||b.h>1440)return 'Keep the deck area within 120 ft across and out.';
  if(b.w<48||b.h<48)return 'Keep the deck area at least 4 ft across and out.';
  for(let i=0;i<o.length;i++)if(Math.hypot(o[i].x-o[(i+1)%o.length].x,o[i].y-o[(i+1)%o.length].y)<1)return 'Leave at least 1 inch between neighbouring points.';
  for(let i=0;i<o.length;i++){const a=o[(i+o.length-1)%o.length],p=o[i],b=o[(i+1)%o.length];if(Math.abs(cross(a,p,b))<1e-7&&(p.x-a.x)*(b.x-p.x)+(p.y-a.y)*(b.y-p.y)<0)return 'Those edges double back over each other. Move the point to leave a clear outline.';}
  for(let i=0;i<o.length;i++)for(let j=i+1;j<o.length;j++){
    if(j===i+1||i===0&&j===o.length-1)continue;
    if(intersects(o[i],o[(i+1)%o.length],o[j],o[(j+1)%o.length]))return 'Those edges cross. Move the point back inside a clear outline.';
  }
  // Reversed winding would flip every outward normal, so it is refused rather than silently reordering handles.
  const area=o.reduce((sum,p,i)=>{const q=o[(i+1)%o.length];return sum+p.x*q.y-q.x*p.y;},0)/2;
  if(area<144)return 'Keep a clear outline with at least 1 sq ft of deck area.';
  return '';
}
export function freeFootprint(data:Pick<DeckData,'deckOutlines'>,level:BoundaryLevel):FootprintPlan|null{
  const saved=data.deckOutlines?.[boundaryKey(level)];if(!saved)return null;
  let outline=saved.map(p=>({x:p.x*12,y:p.y*12}));if(boundaryProblem(outline))return null;
  // Keep added collinear points editable in storage, but don't invent rim joints, boards or framing seams for them.
  for(let changed=true;changed&&outline.length>3;){changed=false;for(let i=0;i<outline.length;i++){
    if(Math.abs(cross(outline[(i+outline.length-1)%outline.length],outline[i],outline[(i+1)%outline.length]))<1e-7){outline=outline.filter((_,j)=>j!==i);changed=true;break;}
  }}
  const {x,y,w,h}=boundaryBounds(outline);
  return {outline,bounds:{w,h},origin:{x,y},isCurved:false};
}
export const savedBoundary=(points:PlanPoint[]):OutlinePoint[]=>points.map(p=>({x:p.x/12,y:p.y/12}));
/** Dimension fields still scale the same outline; they never silently replace it with a rectangle. */
export function resizeBoundaryPatch(data:DeckData,patch:Partial<DeckData>):Partial<DeckData>{
  if(Object.hasOwn(patch,'deckOutlines'))return patch;
  let deckOutlines=data.deckOutlines;
  for(const [key,width,depth] of [['main',patch.width,patch.length],['second',patch.width2,patch.length2],['third',patch.level3?.widthFt,patch.level3?.lengthFt]] as const){
    const points=data.deckOutlines?.[key];if(!points||width===undefined&&depth===undefined)continue;
    const b=boundaryBounds(points),sx=width===undefined?1:width/b.w,sy=depth===undefined?1:depth/b.h;
    const next=points.map(p=>({x:b.x+(p.x-b.x)*sx,y:b.y+(p.y-b.y)*sy}));
    if(!boundaryProblem(next.map(p=>({x:p.x*12,y:p.y*12}))))deckOutlines={...deckOutlines,[key]:next};
  }
  return deckOutlines!==data.deckOutlines?{...patch,deckOutlines}:patch;
}
/** Existing labour factors are allowances; bespoke support/connection work remains a visible builder quote. */
export function freeOutlineLabourFactor(data:DeckData):number{
  return Math.max(1,...[1,2,3].map(n=>{
    if(n>data.levels)return 1;const fp=freeFootprint(data,n as BoundaryLevel);if(!fp)return 1;
    const o=fp.outline,angles=o.filter((p,i)=>{const q=o[(i+1)%o.length];return Math.abs(p.x-q.x)>.01&&Math.abs(p.y-q.y)>.01;}).length;
    return angles||o.length>6?1.5:o.length>4?1.25:1;
  }));
}
