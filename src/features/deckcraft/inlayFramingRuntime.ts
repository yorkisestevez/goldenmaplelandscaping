import type {DeckLevel,Member} from './deckTakeoff';
import type {BoardPattern} from './types';
import {fieldAngles,fillAngles,type InlayPlan} from './lib/inlayGeometry';
import type {PlanPoint} from './lib/deckGeometry';

/** Framing under decorative inlays (see inlayFraming.ts), loaded with the inlay runtime (lib/inlayGeometryRuntime.ts). */
const RUNG_CENTRES=12,SOLID_CENTRES=6;
const parallel=(dirDeg:number,angles:number[])=>angles.some(a=>Math.abs(Math.sin((dirDeg-a)*Math.PI/180))<.05);
/** A board direction that needs more than the joists: along them, or at 45° over joists wider than 12 in. */
const needsSupport=(dirDeg:number,spacing:number)=>Math.abs(Math.cos(dirDeg*Math.PI/180))<.05||(Math.abs(Math.abs(Math.sin(dirDeg*Math.PI/180))-Math.SQRT1_2)<.05&&spacing>12);

export function frameInlays(level:DeckLevel,plans:InlayPlan[],opts:{boardWidth:number;gap:number;spacing:number;pattern:BoardPattern}){
  const built=plans.filter(p=>p.status==='ok');if(!built.length)return;
  const {boardWidth,gap,spacing,pattern}=opts,pitch=boardWidth+gap,depth=level.joists[0]?.depth||9.25,framingY=level.top-1-depth/2,{offset}=level;
  const add=(p:PlanPoint,q:PlanPoint,role:'inlay-edge'|'inlay-nailer'|'inlay-ladder'|'inlay-solid')=>supportLine(level,{x:p.x+offset.x,y:p.y+offset.z},{x:q.x+offset.x,y:q.y+offset.z},role,framingY,depth);
  const edges=(poly:PlanPoint[])=>poly.map((a,i)=>{const b=poly[(i+1)%poly.length],len=Math.hypot(b.x-a.x,b.y-a.y);return {a,b,len,dir:{x:(b.x-a.x)/len,y:(b.y-a.y)/len},deg:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};}).filter(e=>e.len>1);
  // The inward normal of an outline edge (positive shoelace area: the inside is on the left).
  const inward=(e:{dir:PlanPoint})=>({x:-e.dir.y,y:e.dir.x});
  const shift=(e:{a:PlanPoint;b:PlanPoint;dir:PlanPoint},d:number):[PlanPoint,PlanPoint]=>{const n=inward(e);return [{x:e.a.x+n.x*d,y:e.a.y+n.y*d},{x:e.b.x+n.x*d,y:e.b.y+n.y*d}];};
  // Rungs across the joists at `centres` over a polygon: blocking wherever each line crosses it.
  const rungs=(poly:PlanPoint[],centres:number,role:'inlay-ladder'|'inlay-solid')=>{
    const ys=poly.map(p=>p.y),y0=Math.min(...ys),y1=Math.max(...ys);
    for(let y=y0+centres/2;y<y1-(role==='inlay-ladder'?3:0);y+=centres){
      const xs:number[]=[];
      poly.forEach((a,i)=>{const b=poly[(i+1)%poly.length];if((a.y<=y&&b.y>y)||(b.y<=y&&a.y>y))xs.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));});
      xs.sort((p,q)=>p-q);
      for(let i=0;i+1<xs.length;i+=2)if(xs[i+1]-xs[i]>3)add({x:xs[i],y},{x:xs[i+1],y},role);
    }
  };
  for(const plan of built){
    if(plan.band){
      // Across a 45° or herringbone field, the field boards end along both long sides of the band.
      if(plan.band.direction==='across'&&!plan.band.rows)for(const piece of plan.pieces)for(const e of edges(piece))
        if(Math.abs(Math.sin(e.deg*Math.PI/180))<.05&&(Math.abs(e.a.y-plan.band.from)<.5||Math.abs(e.a.y-plan.band.to)<.5))for(const side of [-1,1])add(...shift(e,-gap/2+side*.9375),'inlay-edge');
      continue;
    }
    if(plan.solid){rungs(plan.solid,SOLID_CENTRES,'inlay-solid');continue;}
    const field=fieldAngles(pattern),fill=fillAngles(plan.pattern);
    for(const e of edges(plan.outline)){
      // Field boards ending at the outer edge: the joint is a board gap wide, just outside the outline.
      if(!parallel(e.deg,field))for(const side of [-1,1])add(...shift(e,-gap/2+side*.9375),'inlay-edge');
      // Frame boards run along their edge: support each frame row where the joists alone are not enough.
      if(needsSupport(e.deg,spacing))for(let k=0;k<plan.frameRows;k++)add(...shift(e,k*pitch+boardWidth/2),'inlay-nailer');
    }
    // Fill boards ending at the frame's inner edge: the joint is the gap just outside the fill.
    for(const e of edges(plan.inner))if(!parallel(e.deg,fill))for(const side of [-1,1])add(...shift(e,-gap/2+side*.9375),'inlay-edge');
    // Ladder rungs across the joists under a fill the joists alone do not carry.
    if(fill.some(a=>needsSupport(a,spacing))||plan.pattern==='Herringbone')rungs(plan.inner,RUNG_CENTRES,'inlay-ladder');
  }
}

/** One support line p → q (world plan inches: x, and y for the 3D z) at framing height. */
function supportLine(level:DeckLevel,p:PlanPoint,q:PlanPoint,role:string,framingY:number,depth:number){
  const len=Math.hypot(q.x-p.x,q.y-p.y);if(len<1)return;
  const dir={x:(q.x-p.x)/len,y:(q.y-p.y)/len};
  if(Math.abs(dir.x)<.05){
    // Along the joists: one member, unless a joist already runs under the line.
    const x=(p.x+q.x)/2,z0=Math.min(p.y,q.y),z1=Math.max(p.y,q.y);
    if(level.joists.some(j=>Math.abs(j.a.x-x)<.76&&Math.min(j.a.z,j.b.z)<=z0+.5&&Math.max(j.a.z,j.b.z)>=z1-.5))return;
    const pieces=Math.ceil((z1-z0)/192);
    for(let k=0;k<pieces;k++)level.blocking.push({a:{x,y:framingY,z:z0+(z1-z0)*k/pieces},b:{x,y:framingY,z:z0+(z1-z0)*(k+1)/pieces},width:1.5,depth,role});
    return;
  }
  // Across the joists: blocking from joist to joist along the line, extended to the joists on either side so the
  // bays at its ends are filled completely.
  const zAt=(x:number)=>p.y+(x-p.x)*dir.y/dir.x,lo=Math.min(p.x,q.x),hi=Math.max(p.x,q.x);
  const onLine=(j:Member)=>{const z=zAt(j.a.x);return z>=Math.min(j.a.z,j.b.z)-.1&&z<=Math.max(j.a.z,j.b.z)+.1;};
  const xs=[...new Set(level.joists.filter(onLine).map(j=>Math.round(j.a.x*1000)/1000))].sort((a,b)=>a-b);
  const start=xs.filter(x=>x<=lo).at(-1)??lo,end=xs.find(x=>x>=hi)??hi;
  const stops=[start,...xs.filter(x=>x>start&&x<end),end];
  for(let i=0;i+1<stops.length;i++){
    const a=stops[i],b=stops[i+1],x0=a+(xs.includes(a)?.75:0),x1=b-(xs.includes(b)?.75:0);
    if(x1-x0<.5)continue;
    const m:Member={a:{x:x0,y:framingY,z:zAt(x0)},b:{x:x1,y:framingY,z:zAt(x1)},width:1.5,depth,role};
    if(!level.blocking.some(o=>o.role===role&&Math.hypot(o.a.x-m.a.x,o.a.z-m.a.z)<.3&&Math.hypot(o.b.x-m.b.x,o.b.z-m.b.z)<.3))level.blocking.push(m);
  }
}
