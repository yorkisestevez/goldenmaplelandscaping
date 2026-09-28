import type {DeckData,OutlinePoint} from '../types';
export type {OutlinePoint};

/**
 * Custom deck outlines (shape 'Custom'). The back is one straight edge along the house (y = 0, from x = 0 to
 * the deck width), so every part of the deck frames off the house the way an L-shaped deck does. The rest
 * is the FRONT: points in feet from the right side (x = width) to the left side (x = 0), each at or to the
 * left of the one before, joined by edges that run across, step in or out, or run at 45°. Every vertical
 * line through the deck then meets it once, which is what joists running out from the house need.
 * Plan feet here; the footprint (deckGeometry.ts) turns this into inches. Pure data, no three.js.
 */
export type OutlineEdgeKind='across'|'step'|'angled';
export const OUTLINE_LIMITS={maxPoints:24,widthFt:[4,60],depthFt:[3,40],minEdgeFt:2,minStepFt:1,gridFt:.5} as const;

const onGrid=(v:number)=>Math.abs(v/OUTLINE_LIMITS.gridFt-Math.round(v/OUTLINE_LIMITS.gridFt))<1e-9;
const same=(a:OutlinePoint,b:OutlinePoint)=>Math.abs(a.x-b.x)<1e-9&&Math.abs(a.y-b.y)<1e-9;
const cross=(a:OutlinePoint,p:OutlinePoint,b:OutlinePoint)=>(p.x-a.x)*(b.y-p.y)-(p.y-a.y)*(b.x-p.x);

/** The kind of the front edge a → b, or null when it is neither square nor 45°. */
export function edgeKind(a:OutlinePoint,b:OutlinePoint):OutlineEdgeKind|null{
  const dx=b.x-a.x,dy=b.y-a.y;
  if(Math.abs(dx)<1e-9)return Math.abs(dy)<1e-9?null:'step';
  if(Math.abs(dy)<1e-9)return 'across';
  return Math.abs(Math.abs(dx)-Math.abs(dy))<1e-9?'angled':null;
}

/** Drops repeated points and points in a straight line with their neighbours (the sides count: a point
 * straight above or below the side it starts or ends on is part of that side). Never adds anything. */
export function normalizeFront(front:OutlinePoint[]):OutlinePoint[]{
  let out=front.filter((p,i)=>i===0||!same(p,front[i-1]));
  for(let changed=true;changed&&out.length>2;){
    changed=false;
    for(let i=0;i<out.length;i++){
      // The right side rises from (width, 0) to the first point; the left side drops from the last point to (0, 0).
      const p=out[i],prev=i===0?{x:p.x,y:0}:out[i-1],next=i===out.length-1?{x:0,y:0}:out[i+1];
      if(i===out.length-1&&p.x!==0)continue;
      if(Math.abs(cross(prev,p,next))<1e-9){out=out.filter((_,j)=>j!==i);changed=true;break;}
    }
  }
  return out;
}

/** What is wrong with a front, in plain words (empty when it can be built). Checked on the normalized front. */
export function outlineProblems(input:unknown):string[]{
  if(!Array.isArray(input)||input.length<2)return ['An outline needs a front edge: at least two points, from the right side to the left side.'];
  if(input.length>OUTLINE_LIMITS.maxPoints*2)return [`An outline can have up to ${OUTLINE_LIMITS.maxPoints} front points.`];
  if(!input.every(p=>p&&typeof p==='object'&&Number.isFinite((p as OutlinePoint).x)&&Number.isFinite((p as OutlinePoint).y)))return ['Every outline point needs a number for across and out.'];
  const raw=(input as OutlinePoint[]).map(p=>({x:p.x,y:p.y}));
  if(raw.some((p,i)=>i>0&&p.x>raw[i-1].x+1e-9))return ['The front turns back toward the right: each point is at or left of the one before.'];
  const front=normalizeFront(raw),problems:string[]=[];
  if(front.length<2)return ['An outline needs a front edge: at least two points, from the right side to the left side.'];
  if(front.length>OUTLINE_LIMITS.maxPoints)problems.push(`An outline can have up to ${OUTLINE_LIMITS.maxPoints} front points.`);
  if(!front.every(p=>onGrid(p.x)&&onGrid(p.y)))problems.push('Points sit on a 6 in grid (whole or half feet).');
  const [w0,w1]=OUTLINE_LIMITS.widthFt,[d0,d1]=OUTLINE_LIMITS.depthFt,W=front[0].x;
  if(W<w0||W>w1)problems.push(`The deck is ${w0} to ${w1} ft wide.`);
  if(front[front.length-1].x!==0)problems.push('The front ends on the left side (0 ft across).');
  if(front.some(p=>p.y<d0||p.y>d1))problems.push(`Every part of the deck reaches ${d0} to ${d1} ft out from the house.`);
  if(Math.max(...front.map(p=>p.y))<4)problems.push('The deck reaches at least 4 ft out from the house somewhere.');
  front.forEach((a,i)=>{
    if(i===front.length-1)return;
    const b=front[i+1],kind=edgeKind(a,b),n=i+1;
    if(b.x>a.x+1e-9){problems.push(`Front edge ${n} turns back toward the right: each point is at or left of the one before.`);return;}
    if(!kind){problems.push(`Front edge ${n} is neither square nor at 45°.`);return;}
    if(kind==='step'&&Math.abs(b.y-a.y)<OUTLINE_LIMITS.minStepFt-1e-9)problems.push(`Step ${n} is shorter than ${OUTLINE_LIMITS.minStepFt} ft.`);
    if(kind!=='step'&&a.x-b.x<OUTLINE_LIMITS.minEdgeFt-1e-9)problems.push(`Front edge ${n} is shorter than ${OUTLINE_LIMITS.minEdgeFt} ft across.`);
  });
  return [...new Set(problems)];
}

/** The front as built for a design, or null when the deck is not a custom outline. A custom deck with no
 * usable front (none stored, or one that fails the rules) is its width × depth rectangle. */
export function activeCustomFront(data:Pick<DeckData,'shape'|'customFront'|'width'|'length'>):OutlinePoint[]|null{
  if(data.shape!=='Custom')return null;
  if(data.customFront&&!outlineProblems(data.customFront).length)return normalizeFront(data.customFront);
  return rectangleFront(Number(data.width)||16,Number(data.length)||12);
}
export const rectangleFront=(W:number,L:number):OutlinePoint[]=>[{x:W,y:L},{x:0,y:L}];
/** Overall width and depth of a front, in feet. */
export const frontBounds=(front:OutlinePoint[])=>({width:front[0].x,length:Math.max(...front.map(p=>p.y))});

/** The whole outline (back, right side, front, left side) and its edge ids, in the units given. Edge i runs
 * from point i to i + 1. 45° edges are 'custom-angled-N' so the angled-corner framing applies to them. */
export function customOutline(front:OutlinePoint[],scale=12){
  const W=front[0].x,points=[{x:0,y:0},{x:W,y:0},...front].map(p=>({x:p.x*scale,y:p.y*scale}));
  const counts={across:0,step:0,angled:0},ids=['custom-back','custom-right'];
  for(let i=0;i+1<front.length;i++){const kind=edgeKind(front[i],front[i+1])??'across';counts[kind]++;ids.push(kind==='angled'?`custom-angled-${counts.angled}`:kind==='step'?`custom-step-${counts.step}`:`custom-front-${counts.across}`);}
  ids.push('custom-left');
  return {outline:points,edgeIds:ids};
}
export const isCustomEdgeId=(id?:string)=>!!id&&/^custom-(back|right|left|front-\d+|step-\d+|angled-\d+)$/.test(id);
export const isCustomAngledEdgeId=(id?:string)=>!!id&&/^custom-angled-\d+$/.test(id);

/** Plain names for a custom outline's edges (stair picker, the plan). */
export function customEdgeName(id:string):string|undefined{
  const m=/^custom-(front|step|angled)-(\d+)$/.exec(id);
  if(m)return m[1]==='front'?`Front edge ${m[2]}`:m[1]==='step'?`Step ${m[2]}`:`45° edge ${m[2]}`;
  return ({'custom-back':'Back edge, along the house','custom-right':'Right side','custom-left':'Left side'} as Record<string,string>)[id];
}

/** Corners that turn into the deck (inside corners) plus 45° edges: how much fitting the outline takes. */
export function outlineFeatures(front:OutlinePoint[]):number{
  const pts=customOutline(front,1).outline;
  const inside=pts.filter((p,i)=>cross(pts[(i+pts.length-1)%pts.length],p,pts[(i+1)%pts.length])<-1e-9).length;
  return inside+front.slice(1).filter((p,i)=>edgeKind(front[i],p)==='angled').length;
}
/** Labour reuses the existing shape factors, no new rate: an outline with one feature fits like an L-shape
 * (×1.10), two or three like a multi-corner deck (×1.25), four or more like a curved deck (×1.50). */
export const customLabourFactor=(front:OutlinePoint[]|null)=>{if(!front)return 1;const f=outlineFeatures(front);return f===0?1:f===1?1.10:f<4?1.25:1.50;};

/** "Custom outline: 8 corners, 22 × 16 ft overall" */
export function customShapeWords(front:OutlinePoint[]):string{
  const {width,length}=frontBounds(front),angled=front.slice(1).filter((p,i)=>edgeKind(front[i],p)==='angled').length;
  return `Custom outline: ${front.length+2} corners${angled?`, ${angled} at 45°`:''}, ${width} × ${length} ft overall`;
}

/** Rounds feet to the outline's 6 in grid. */
export const snapFt=(v:number)=>Math.round(v/OUTLINE_LIMITS.gridFt)*OUTLINE_LIMITS.gridFt;
const snap=snapFt;
/** A front traced from an existing outline in inches (one that starts at the back-left and back-right
 * corners), snapped to the grid; null when the outline has no straight back or does not follow the rules. */
export function frontFromOutline(outline:{x:number;y:number}[]):OutlinePoint[]|null{
  if(outline.length<4||Math.abs(outline[0].x)>.5||Math.abs(outline[0].y)>.5||Math.abs(outline[1].y)>.5)return null;
  const front=normalizeFront(outline.slice(2).map(p=>({x:snap(p.x/12),y:snap(p.y/12)})));
  return front.length>=2&&Math.abs(front[0].x-snap(outline[1].x/12))<1e-9&&!outlineProblems(front).length?front:null;
}
