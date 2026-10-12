import type {DeckTakeoff} from '../deckTakeoff';
import {houseOutline} from '../houseFootprint';
import type {PlanPoint} from '../lib/deckGeometry';
import {landscapeOutlinePaths} from '../landscapeOutline';
import {lotOf} from '../siteDesignMoves';
import type {DeckData} from '../types';
import {yardShapeWorldPoints} from '../yardShapeGeometry';
import {siteSnapPoints} from './drawingSnap';

const STEP=6,CAP=5000;
function addEdge(a:PlanPoint,b:PlanPoint,out:PlanPoint[]){
  const len=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(len/STEP));
  for(let i=0;i<=n&&out.length<CAP;i++)out.push({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n});
}
/** Points a fence can snap to: lot lines, deck and house edges, patios, walls, beds and fence corners. */
export function fenceSnapTargets(data:DeckData,model:DeckTakeoff):PlanPoint[]{
  const out:PlanPoint[]=[];
  const lot=lotOf(data);
  if(lot){const c=[{x:lot.minX,y:lot.minZ},{x:lot.maxX,y:lot.minZ},{x:lot.maxX,y:lot.maxZ},{x:lot.minX,y:lot.maxZ}];for(let i=0;i<4;i++)addEdge(c[i],c[(i+1)%4],out);}
  let house:PlanPoint[][]=[];
  try{house=houseOutline(data);}catch{/* a design without a drawable house still snaps to the deck */}
  for(const ring of house)for(let i=0;i<ring.length;i++)addEdge(ring[i],ring[(i+1)%ring.length],out);
  for(const level of model.levels){const o=level.footprint.outline;for(let i=0;i<o.length;i++){const a=o[i],b=o[(i+1)%o.length];addEdge({x:a.x+level.offset.x,y:a.y+level.offset.z},{x:b.x+level.offset.x,y:b.y+level.offset.z},out);}}
  for(const f of data.yardFeatures??[])if(f.enabled&&(f.kind==='patio'||f.kind==='retaining-wall')){const pts=yardShapeWorldPoints(f),closed=f.kind==='patio';for(let i=0;i<(closed?pts.length:Math.max(0,pts.length-1));i++)addEdge(pts[i],pts[(i+1)%pts.length],out);}
  for(const o of data.landscapeObjects??[])if(o.enabled&&o.kind==='bed'){try{for(const ring of landscapeOutlinePaths(o))for(let i=0;i<ring.length;i++)addEdge({x:ring[i].x,y:ring[i].z},{x:ring[(i+1)%ring.length].x,y:ring[(i+1)%ring.length].z},out);}catch{/* a bed that cannot be sampled is skipped */}}
  for(const run of data.fences??[])for(const p of run.points)if(out.length<CAP)out.push({x:p.x,y:p.y});
  for(const p of siteSnapPoints(model.levels,house))if(out.length<CAP)out.push(p);
  return out.slice(0,CAP);
}
