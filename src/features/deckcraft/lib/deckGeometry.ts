import {offsetPolygons,polygonCut,polygonBoard} from './polygonCuts';
// Shared deck-plan geometry — the single source of truth for the deck's
// footprint polygon, stair placement, railing runs, and board layout.
// Consumed by DeckDiagram (2D SVG) and viewer3d/ (three.js).
//
// Conventions (match DeckDiagram's SVG space exactly):
//   units    = inches
//   origin   = back-left corner of the bounding box
//   +x       = along the deck width  (Left edge -> Right edge)
//   +y       = toward the Front edge (the SVG's downward axis)
// The 3D viewer maps plan (x, y) -> world (x, z) and scales 1/12 to feet.
//
// Pure data + math only — NO three.js imports here (this file is shared with
// the 2D diagram and must never drag the 3D chunk into the main bundle).

import { DeckData } from '../types';

export interface PlanPoint { x: number; y: number }
export type EdgeName = 'Front' | 'Back' | 'Left' | 'Right';

export interface FootprintPlan {
  /** Simple polygon, positive shoelace area (interior to the LEFT of edges). */
  outline: PlanPoint[];
  bounds: { w: number; h: number };
  isCurved: boolean;
}

const n = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/**
 * The deck's footprint polygon.
 * Rectangle: 4 pts. L-Shape: 6 pts (cutoutWidth x cutoutLength notch at the
 * Front-Right corner). Multi-corner: 8 pts (second notch, cutout*2 fields, at
 * the Front-Left corner). Curved: the Front edge is replaced by an outward
 * bulge sampled at 16 segments — sagitta min(15% of length, 20% of width),
 * a stated visual approximation, matching the "curved front" sales sketch.
 * level 2 uses width2/length2 (an independent slab, like calculations.ts).
 */
export function getFootprint(data: DeckData, level: 1 | 2 = 1): FootprintPlan {
  const W = Math.max(12, n(level === 1 ? data.width : data.width2) * 12);
  const L = Math.max(12, n(level === 1 ? data.length : data.length2) * 12);
  const bounds = { w: W, h: L };

  if (level === 1 && data.shape === 'Curved') {
    const s = Math.min(L * 0.15, W * 0.2);
    const outline: PlanPoint[] = [{ x: 0, y: 0 }, { x: W, y: 0 }];
    // Front edge as an outward arc from right to left (keeps positive area)
    const SEGS = 16;
    const opening=data.stairFlights>0&&data.stairPosition==='Front';
    const stairWidth=Math.min(W,Math.max(36,n(data.stairWidth,48))),start=(W-stairWidth)*Math.min(1,Math.max(0,n(data.stairOffset,50)/100)),end=start+stairWidth;
    const samples=Array.from({length:SEGS+1},(_,i)=>W*(1-i/SEGS));
    if(opening)samples.push(start,end);
    for(const x of [...new Set(samples)].sort((a,b)=>b-a)){
      if(opening&&x>start+.001&&x<end-.001)continue;
      const arcY=L+s*Math.sin(Math.PI*x/W),chordY=Math.min(L+s*Math.sin(Math.PI*start/W),L+s*Math.sin(Math.PI*end/W));
      if(opening&&Math.abs(x-end)<.001){outline.push({x,y:arcY});if(arcY-chordY>.001)outline.push({x,y:chordY});}
      else if(opening&&Math.abs(x-start)<.001){outline.push({x,y:chordY});if(arcY-chordY>.001)outline.push({x,y:arcY});}
      else outline.push({x,y:arcY});
    }
    return { outline, bounds: { w: W, h: L + s }, isCurved: true };
  }

  if (level === 1 && (data.shape === 'L-Shape' || data.shape === 'Multi-corner')) {
    // Notch 1 at the Front-Right corner
    const cw = Math.min(n(data.cutoutWidth) * 12, W * 0.8);
    const cl = Math.min(n(data.cutoutLength) * 12, L * 0.8);
    if (data.shape === 'L-Shape' || !n(data.cutoutWidth2) || !n(data.cutoutLength2)) {
      if (cw > 0 && cl > 0) {
        return {
          outline: [
            { x: 0, y: 0 }, { x: W, y: 0 },
            { x: W, y: L - cl }, { x: W - cw, y: L - cl },
            { x: W - cw, y: L }, { x: 0, y: L },
          ],
          bounds, isCurved: false,
        };
      }
      return rectangle(W, L);
    }
    // Multi-corner: notch 2 at the Front-Left corner
    const cw2 = Math.min(n(data.cutoutWidth2) * 12, Math.max(0, W - cw) * 0.8);
    const cl2 = Math.min(n(data.cutoutLength2) * 12, L * 0.8);
    return {
      outline: [
        { x: 0, y: 0 }, { x: W, y: 0 },
        { x: W, y: L - cl }, { x: W - cw, y: L - cl },
        { x: W - cw, y: L }, { x: cw2, y: L },
        { x: cw2, y: L - cl2 }, { x: 0, y: L - cl2 },
      ],
      bounds, isCurved: false,
    };
  }

  return rectangle(W, L);
}

function rectangle(W: number, L: number): FootprintPlan {
  return {
    outline: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: L }, { x: 0, y: L }],
    bounds: { w: W, h: L },
    isCurved: false,
  };
}

export interface StairPlacement {
  edgeIndex?: number;
  edge: EdgeName;
  /** The stair-opening corner ON the deck edge. */
  origin: PlanPoint;
  /** Unit vector along the edge (direction of the opening's width). */
  along: PlanPoint;
  /** Unit vector pointing away from the deck. */
  outward: PlanPoint;
  /** Opening width, inches. */
  width: number;
}

/**
 * Where the stair opening sits — a direct generalization of the math
 * DeckDiagram used inline: offset% positions the opening along the bounding
 * edge. Notched shapes place against the bounding box edge (same behavior the
 * 2D diagram has always had).
 */
export function getStairPlacement(data: DeckData, target: { w:number;h:number } | FootprintPlan): StairPlacement | null {
  if (!(n(data.stairFlights)>0)) return null;
  const fp='outline' in target?target:getFootprint(data);
  const edge=data.stairPosition||'Front';
  const desired=edge==='Front'?{x:0,y:1}:edge==='Back'?{x:0,y:-1}:edge==='Left'?{x:-1,y:0}:{x:1,y:0};
  const candidates=fp.outline.map((a,i)=>{const b=fp.outline[(i+1)%fp.outline.length],length=Math.hypot(b.x-a.x,b.y-a.y),along={x:(b.x-a.x)/length,y:(b.y-a.y)/length},outward={x:along.y,y:-along.x};return {a,b,length,along,outward,index:i};}).filter(s=>s.outward.x*desired.x+s.outward.y*desired.y>.7);
  if(!candidates.length)return null;
  const requested=Math.max(24,n(data.stairWidth,48)),eligible=candidates.filter(s=>s.length>=requested);
  const chosen=(eligible.length?eligible:candidates).sort((a,b)=>b.length-a.length)[0];
  const width=Math.min(requested,chosen.length),offset=Math.min(1,Math.max(0,n(data.stairOffset,50)/100));
  // Preserve intuitive left-to-right / back-to-front offsets regardless of winding.
  const reverse=chosen.along.x<-.5||chosen.along.y<-.5;
  const along=reverse?{x:-chosen.along.x,y:-chosen.along.y}:chosen.along;
  const base=reverse?chosen.b:chosen.a,start=(chosen.length-width)*offset;
  return {edge,origin:{x:base.x+along.x*start,y:base.y+along.y*start},along,outward:chosen.outward,width,edgeIndex:chosen.index};
}

/** Axis-aligned rect covering the stair opening + flight, for 2D drawing. */
export function getStairRect(p: StairPlacement, flightDepth: number) {
  const xs = [p.origin.x, p.origin.x + p.along.x * p.width, p.origin.x + p.outward.x * flightDepth];
  const ys = [p.origin.y, p.origin.y + p.along.y * p.width, p.origin.y + p.outward.y * flightDepth];
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x, y,
    w: Math.abs(p.along.x) * p.width + Math.abs(p.outward.x) * flightDepth,
    h: Math.abs(p.along.y) * p.width + Math.abs(p.outward.y) * flightDepth,
  };
}

export interface RailSegment { a: PlanPoint; b: PlanPoint; edge: EdgeName | 'Notch' | 'Curve' }

/**
 * Railing runs around the outline: classifies each polygon edge, drops the
 * house side for Attached/Add-on decks, and splits the stair edge around the
 * opening (the skip logic DeckDiagram implements per-edge inline).
 */
export function getRailingSegments(
  data: DeckData,
  fp: FootprintPlan,
  stair: StairPlacement | null
): RailSegment[] {
  if (data.railingType === 'None') return [];
  const attached = data.deckType === 'Attached' || data.deckType === 'Add-on';
  const out: RailSegment[] = [];
  const EPS = 0.5;

  for (let i = 0; i < fp.outline.length; i++) {
    const a = fp.outline[i];
    const b = fp.outline[(i + 1) % fp.outline.length];
    const horizontal = Math.abs(a.y - b.y) < EPS;
    const vertical = Math.abs(a.x - b.x) < EPS;

    let edge: RailSegment['edge'];
    if (horizontal && a.y < EPS) edge = 'Back';
    else if (horizontal && Math.abs(a.y - fp.bounds.h) < EPS && !fp.isCurved) edge = 'Front';
    else if (vertical && a.x < EPS) edge = 'Left';
    else if (vertical && Math.abs(a.x - fp.bounds.w) < EPS) edge = 'Right';
    else edge = fp.isCurved && a.y > fp.bounds.h - EPS ? 'Curve' : 'Notch';

    if (edge === 'Back' && attached) continue; // house side — ledger, no rail

    // Cut only the physical polygon edge carrying the opening, including notch/arc segments.
    if(stair && (stair.edgeIndex===i || (stair.edgeIndex===undefined && edge===stair.edge))){
      const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
      const t0=(stair.origin.x-a.x)*ux+(stair.origin.y-a.y)*uy;
      const t1=t0+stair.width*(stair.along.x*ux+stair.along.y*uy);
      const lo=Math.max(0,Math.min(t0,t1)),hi=Math.min(len,Math.max(t0,t1));
      if(hi>lo){if(lo>.01)out.push({a,b:{x:a.x+ux*lo,y:a.y+uy*lo},edge});if(hi<len-.01)out.push({a:{x:a.x+ux*hi,y:a.y+uy*hi},b,edge});continue;}
    }
    out.push({ a, b, edge });
  }
  return out;
}

export interface BoardRun {
  width?:number;
  polygon?:PlanPoint[];
  role?:'field'|'border'|'breaker'|'inlay';
  /** Center of the board, plan inches. */
  cx: number; cy: number;
  /** Board length along its own axis, inches. */
  length: number;
  /** 0 = boards run along +x; 45 = diagonal. Degrees. */
  angleDeg: number;
}

/**
 * Field decking as scanline strips clipped to the outline. Diagonal rotates
 * the polygon -45deg, scans, and rotates run centers back. Long runs split at
 * maxBoardLen (20 ft stock) with alternating half-length stagger so butt
 * joints don't line up — same "breaker" intent as the 2D diagram.
 */
export function getBoardRows(fp: FootprintPlan, opts: {
  boardWidth: number; gap: number; angleDeg: 0 | 45; inset: number; maxBoardLen?: number;
}): BoardRun[] {
  const {boardWidth,gap,angleDeg,inset}=opts,stock=opts.maxBoardLen??240;
  const field=offsetPolygons([fp.outline],inset);if(!field.length)return [];
  const a=angleDeg*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),world=(x:number,y:number)=>({x:x*c-y*sn,y:x*sn+y*c});
  const vertices=field.flat(),us=vertices.map(p=>p.x*c+p.y*sn),vs=vertices.map(p=>-p.x*sn+p.y*c);
  const left=Math.min(...us),right=Math.max(...us),bottom=Math.min(...vs),top=Math.max(...vs),runs:BoardRun[]=[];
  // Scan the full board strip, including the final ripped row and diagonal tips.
  for(let row=0,y=bottom;y<top-.001;y+=boardWidth+gap,row++){
    let x=left,first=true;
    while(x<right-.001){
      const length=Math.min(first&&row%2?stock/2:stock,right-x),tile=[world(x,y),world(x+length,y),world(x+length,y+boardWidth),world(x,y+boardWidth)];
      for(const poly of polygonCut(field,[tile]))runs.push(polygonBoard(poly,angleDeg));
      x+=length+gap;first=false;
    }
  }
  return runs;
}

/** Mitred perimeter pieces follow every edge, including concave corners and arc facets. */
export function getPictureFrameRuns(fp:FootprintPlan,rows:1|2,boardWidth:number,gap:number):BoardRun[]{
  const p=fp.outline,n=p.length,runs:BoardRun[]=[],pitch=boardWidth+gap;
  const vertex=(i:number,d:number)=>{
    const a=p[(i+n-1)%n],b=p[i%n],c=p[(i+1)%n],l1=Math.hypot(b.x-a.x,b.y-a.y),l2=Math.hypot(c.x-b.x,c.y-b.y);
    const u={x:(b.x-a.x)/l1,y:(b.y-a.y)/l1},v={x:(c.x-b.x)/l2,y:(c.y-b.y)/l2},cross=u.x*v.y-u.y*v.x;
    const q={x:b.x-u.y*d,y:b.y+u.x*d};if(Math.abs(cross)<1e-8)return q;
    const r={x:b.x-v.y*d,y:b.y+v.x*d},t=((r.x-q.x)*v.y-(r.y-q.y)*v.x)/cross;
    return {x:q.x+u.x*t,y:q.y+u.y*t};
  };
  for(let row=0;row<rows;row++){
    const outer=offsetPolygons([p],row*pitch),inner=offsetPolygons([p],row*pitch+boardWidth),claimed:PlanPoint[][]=[];
    for(let i=0;i<n;i++){
      const a=p[i],b=p[(i+1)%n],length=Math.hypot(b.x-a.x,b.y-a.y);if(length<.0001)continue;
      const ux=(b.x-a.x)/length,uy=(b.y-a.y)/length,lo=vertex(i,row*pitch),hi=vertex(i+1,row*pitch),il=vertex(i,row*pitch+boardWidth),ih=vertex(i+1,row*pitch+boardWidth);
      const raw=[lo,hi,ih,il];
      // Cut a narrow real joint at both mitres; don't shorten both edges by a board width.
      const shifted=raw.map((v,k)=>({x:v.x+ux*(k===0||k===3?gap/2:-gap/2),y:v.y+uy*(k===0||k===3?gap/2:-gap/2)}));
      let polys=polygonCut(outer,[shifted]);polys=polygonCut(polys,inner,true);polys=polygonCut(polys,claimed,true);
      for(const poly of polys){runs.push(polygonBoard(poly,Math.atan2(uy,ux)*180/Math.PI,'border'));claimed.push(poly);}
    }
  }
  return runs;
}

/**
 * Fallback board color while the swatch texture loads — ported verbatim from
 * DeckDiagram.getMaterialColor so the 2D diagram is pixel-identical.
 */
export function getMaterialFallbackColor(deckingMaterial: string): string {
  if (deckingMaterial.includes('Cedar')) return '#C17745';
  if (deckingMaterial.includes('Composite') || deckingMaterial.includes('tt_')) return '#8c8273';
  if (deckingMaterial.includes('PVC')) return '#9e9280';
  return '#b59a72'; // PT Pine
}

/** Clip a polygon to a convex board rectangle; retains real perimeter cut vertices. */
export function clipToConvex(subject:PlanPoint[],clip:PlanPoint[]):PlanPoint[]{
  let out=subject;
  for(let i=0;i<clip.length&&out.length;i++){
    const a=clip[i],b=clip[(i+1)%clip.length],side=(p:PlanPoint)=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x),input=out;out=[];
    for(let j=0;j<input.length;j++){const p=input[j],q=input[(j+1)%input.length],sp=side(p),sq=side(q);if(sp>=-1e-7)out.push(p);if((sp<0)!==(sq<0)){const t=sp/(sp-sq);out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}}
  }
  return out;
}
/** Classic interlocking parquet: perpendicular rectangular boards on a 2m-cell lattice. */
export function getHerringboneRows(fp:FootprintPlan,boardWidth:number,gap:number,inset:number):BoardRun[]{
  const pitch=boardWidth+gap,m=6,root=Math.SQRT1_2,cx=fp.bounds.w/2,cy=fp.bounds.h/2;
  const world=(x:number,y:number)=>({x:cx+(x-y)*root,y:cy+(x+y)*root});
  const inverse=(p:PlanPoint)=>({x:((p.x-cx)+(p.y-cy))*root/pitch,y:((p.y-cy)-(p.x-cx))*root/pitch});
  const local=fp.outline.map(inverse),ks=local.map(p=>(p.x+p.y)/(2*m)),js=local.map(p=>(p.x-p.y)/2),runs:BoardRun[]=[];
  const outlines=offsetPolygons([fp.outline],inset);
  for(let k=Math.floor(Math.min(...ks))-2;k<=Math.ceil(Math.max(...ks))+2;k++)for(let j=Math.floor(Math.min(...js))-m;j<=Math.ceil(Math.max(...js))+m;j++){
    const x=(k*m+j)*pitch,y=(k*m-j)*pitch;
    for(const [tx,ty,w,h,angle]of [[x,y,m*pitch-gap,boardWidth,45],[x+m*pitch,y,boardWidth,m*pitch-gap,135]]){
      const tile=[world(tx,ty),world(tx+w,ty),world(tx+w,ty+h),world(tx,ty+h)];
      for(const poly of polygonCut(outlines,[tile])){
      if(poly.length<3)continue;
      const area=Math.abs(poly.reduce((n,p,i)=>{const q=poly[(i+1)%poly.length];return n+p.x*q.y-q.x*p.y},0))/2;if(area<.1)continue;
      const a=angle*Math.PI/180,ax=Math.cos(a),ay=Math.sin(a),u=poly.map(p=>p.x*ax+p.y*ay),v=poly.map(p=>-p.x*ay+p.y*ax),u0=Math.min(...u),u1=Math.max(...u),v0=Math.min(...v),v1=Math.max(...v),uc=(u0+u1)/2,vc=(v0+v1)/2;
      runs.push({cx:uc*ax-vc*ay,cy:uc*ay+vc*ax,length:u1-u0,width:v1-v0,angleDeg:angle,polygon:poly,role:'field'});
      }
    }
  }
  return runs;
}
