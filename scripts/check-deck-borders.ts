import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {deckBoardStock} from '../src/features/deckcraft/stockPlan';
import {boardOutline,signedArea} from '../src/features/deckcraft/lib/polygonCuts';
import type {PlanPoint} from '../src/features/deckcraft/lib/deckGeometry';

const inside=(p:PlanPoint,poly:PlanPoint[])=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i].y>p.y)!==(poly[j].y>p.y)&&p.x<(poly[j].x-poly[i].x)*(p.y-poly[i].y)/(poly[j].y-poly[i].y)+poly[i].x)hit=!hit;return hit;};
const distance=(p:PlanPoint,poly:PlanPoint[])=>{if(inside(p,poly))return 0;return Math.min(...poly.map((a,i)=>{const b=poly[(i+1)%poly.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}));};
const toSegment=(p:PlanPoint,a:PlanPoint,b:PlanPoint)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
/** The longest end face of a board at one end (sign ±1 along it): an outline edge within a board width of that end that is not a long side. */
function endFace(poly:PlanPoint[],angleDeg:number,sign:number,width:number){
  const a=angleDeg*Math.PI/180,u={x:Math.cos(a),y:Math.sin(a)},us=poly.map(p=>(p.x*u.x+p.y*u.y)*sign),end=Math.max(...us);
  let face:{p:PlanPoint;q:PlanPoint;len:number}|undefined;
  poly.forEach((p,i)=>{const j=(i+1)%poly.length,q=poly[j],len=Math.hypot(q.x-p.x,q.y-p.y);if(len<.5||us[i]<end-width-.01||us[j]<end-width-.01||Math.abs(((q.x-p.x)*u.x+(q.y-p.y)*u.y)/len)>.99)return;if(!face||len>face.len)face={p,q,len};});
  return face;
}
let scenarios=0,samples=0,boardEnds=0;
for(const shape of ['Rectangle','L-Shape','Multi-corner','Curved'] as const)
for(const pattern of ['Straight','Picture Frame','Diagonal','Herringbone'] as const)
for(const pictureFrameRows of [0,1,2] as const){
  const d={...structuredClone(DEFAULT_DECK),width:18,length:12,shape,pattern,pictureFrameRows,cutoutWidth:5,cutoutLength:4,cutoutWidth2:3,cutoutLength2:2};
  const m=buildDeckTakeoff(d),level=m.levels[0],polys=level.boards.map(b=>boardOutline(b,d.boardWidth)),fp=(level.deckingFootprint??level.footprint).outline;
  assert.equal(deckBoardStock(m,1.1).unresolved.length,0,'Every polygon piece fits priced stock');
  assert(level.boards.every(b=>b.length<=m.stockLength+1e-6));
  const rows=pictureFrameRows||(pattern==='Picture Frame'?1:0);
  if(rows)assert(level.boards.some(b=>b.role==='border'),'Border pieces must be explicitly counted');
  for(let y=Math.min(...fp.map(p=>p.y))+.37;y<Math.max(...fp.map(p=>p.y));y+=3.17)for(let x=Math.min(...fp.map(p=>p.x))+.29;x<Math.max(...fp.map(p=>p.x));x+=3.11){
    const p={x,y};if(!inside(p,fp))continue;samples++;
    const near=Math.min(...polys.map(poly=>distance(p,poly)));
    assert(near<.38,`${shape}/${pattern}/${rows}: missing board at ${x.toFixed(2)},${y.toFixed(2)}; distance ${near.toFixed(2)}in`);
    const covers=polys.filter(poly=>inside(p,poly));assert(covers.length<=1,`${shape}/${pattern}/${rows}: overlapping boards at ${x},${y}`);
  }
  assert(polys.every(p=>Math.abs(signedArea(p))>.001),'No degenerate last piece');
  // Every board end has framing under its actual end face: a joist, block or rim centreline within 0.85 in (half a
  // member plus 0.1 in) of a point 0.4 in inside the face. A 45° cut against a border row ends its centreline past
  // the face, so backing placed where the centreline ends can land in the next joist bay.
  for(const l of m.levels){
    const members=[...l.joists,...l.blocking,...(l.rim??[])].map(f=>[{x:f.a.x-l.offset.x,y:f.a.z-l.offset.z},{x:f.b.x-l.offset.x,y:f.b.z-l.offset.z}] as const);
    for(const b of l.boards)for(const sign of [-1,1]){
      const poly=boardOutline(b,d.boardWidth),face=endFace(poly,b.angleDeg,sign,b.width??d.boardWidth);if(!face)continue;boardEnds++;
      const c={x:poly.reduce((s,p)=>s+p.x,0)/poly.length,y:poly.reduce((s,p)=>s+p.y,0)/poly.length},mid={x:(face.p.x+face.q.x)/2,y:(face.p.y+face.q.y)/2};
      const f={x:(face.q.x-face.p.x)/face.len,y:(face.q.y-face.p.y)/face.len},n=(c.x-mid.x)*-f.y+(c.y-mid.y)*f.x>=0?{x:-f.y,y:f.x}:{x:f.y,y:-f.x};
      const under=Array.from({length:9},(_,k)=>.05+.1125*k).some(t=>{const p={x:face.p.x+(face.q.x-face.p.x)*t+n.x*.4,y:face.p.y+(face.q.y-face.p.y)*t+n.y*.4};return members.some(([a,e])=>toSegment(p,a,e)<.85);});
      assert(under,`${shape}/${pattern}/${rows}: ${l.kind} board end at ${mid.x.toFixed(2)},${mid.y.toFixed(2)} has no joist, block or rim under its end face`);
    }
  }
  scenarios++;
}
console.log(`DECK BORDER COVERAGE OK — ${scenarios} single/double/zero-border and shape/layout combinations; ${samples} spatial coverage/overlap probes; ${boardEnds} board ends backed under their end faces.`);
