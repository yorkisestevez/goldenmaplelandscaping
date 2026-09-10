import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {deckBoardStock} from '../src/features/deckcraft/stockPlan';
import {boardOutline,signedArea} from '../src/features/deckcraft/lib/polygonCuts';
import type {PlanPoint} from '../src/features/deckcraft/lib/deckGeometry';

const inside=(p:PlanPoint,poly:PlanPoint[])=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i].y>p.y)!==(poly[j].y>p.y)&&p.x<(poly[j].x-poly[i].x)*(p.y-poly[i].y)/(poly[j].y-poly[i].y)+poly[i].x)hit=!hit;return hit;};
const distance=(p:PlanPoint,poly:PlanPoint[])=>{if(inside(p,poly))return 0;return Math.min(...poly.map((a,i)=>{const b=poly[(i+1)%poly.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}));};
let scenarios=0,samples=0;
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
  scenarios++;
}
console.log(`DECK BORDER COVERAGE OK — ${scenarios} single/double/zero-border and shape/layout combinations; ${samples} spatial coverage/overlap probes.`);
