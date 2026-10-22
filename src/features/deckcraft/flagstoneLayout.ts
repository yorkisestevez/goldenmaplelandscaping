import Delaunator from 'delaunator';
import {offsetPolygons,polygonCut,polygonUnion} from './lib/polygonCuts';
import {tessellateArcs} from './circularArcs';
import type {PlanPoint} from './lib/deckGeometry';
import type {YardFeature} from './types';

/** One laid stone in patio-local inches (before the patio's rotation), already one joint clear of its neighbours. */
export interface FlagstonePiece {id:string;polygon:PlanPoint[]}
/**
 * Stone sizes. Sites are spaced by the mean of their radii, so stones run about 2–5 sq ft (large slabs, Dan Preston's
 * method); a cut piece that would leave less than MIN_STONE_IN2 of stone is joined to its neighbour instead of laid as
 * a sliver. A slab only takes in a neighbour it shares at least SLAB_EDGE_IN of edge with, so it never pinches at a neck.
 */
const RADIUS={min:15,max:30},MIN_STONE_IN2=80,ATTEMPTS_PER_SITE=40,SLAB_SHARE=.3,SLAB_IN2=1400,SLAB_EDGE_IN=10;

/** The patio outline in its own inches, curves included, before rotation (yardFeatureOutline without yardToWorld). */
export function flagstoneLocalOutline(f:YardFeature):PlanPoint[][]{
 const points=f.outline??[{x:-f.widthFt*6,y:-f.depthFt*6},{x:f.widthFt*6,y:-f.depthFt*6},{x:f.widthFt*6,y:f.depthFt*6},{x:-f.widthFt*6,y:f.depthFt*6}];
 return [tessellateArcs(points,f.curves,true)];
}
function seededRandom(seed:string){let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);return ()=>{h=h+0x6D2B79F5|0;let t=Math.imul(h^h>>>15,1|h);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const polysArea=(polys:PlanPoint[][])=>polys.reduce((n,p)=>n+Math.abs(p.reduce((s,v,i)=>{const q=p[(i+1)%p.length];return s+v.x*q.y-q.x*v.y;},0)/2),0);

/**
 * Irregular cut-to-fit flagstone. Variable-radius sites (dart throwing, seeded by the patio so it never reshuffles) give
 * Voronoi cells: convex, mostly 4–7 sided, meeting three at a time, so no joint runs on across several stones. Cells
 * are cut to the outline grown by one joint and shrunk by half a joint, then cut back to the outline, so neighbours sit
 * exactly one joint apart while edge stones are cut straight and flush with the patio edge.
 */
export function flagstoneLayout(outline:PlanPoint[][],seed:string,jointIn:number):FlagstonePiece[]{
 const random=seededRandom(seed),all=outline.flat(),margin=RADIUS.max;
 const x0=Math.min(...all.map(p=>p.x))-margin,x1=Math.max(...all.map(p=>p.x))+margin,y0=Math.min(...all.map(p=>p.y))-margin,y1=Math.max(...all.map(p=>p.y))+margin;
 const sites:{x:number;y:number;r:number}[]=[],grid=new Map<string,number[]>(),cell=RADIUS.max,key=(gx:number,gy:number)=>gx+','+gy;
 const expected=Math.ceil((x1-x0)*(y1-y0)/(RADIUS.min*RADIUS.min));
 for(let attempt=0;attempt<expected*ATTEMPTS_PER_SITE;attempt++){
  const x=x0+(x1-x0)*random(),y=y0+(y1-y0)*random(),r=RADIUS.min+(RADIUS.max-RADIUS.min)*Math.sqrt(random()),gx=Math.floor(x/cell),gy=Math.floor(y/cell);
  let clear=true;for(let i=-1;i<=1&&clear;i++)for(let j=-1;j<=1&&clear;j++)for(const k of grid.get(key(gx+i,gy+j))??[]){const s=sites[k];if(Math.hypot(s.x-x,s.y-y)<(s.r+r)/2){clear=false;break;}}
  if(!clear)continue;sites.push({x,y,r});const at=key(gx,gy);grid.set(at,[...grid.get(at)??[],sites.length-1]);
 }
 // A ring of far sites closes every real cell.
 const ghosts:{x:number;y:number}[]=[],g=2*RADIUS.max,gx0=x0-g,gx1=x1+g,gy0=y0-g,gy1=y1+g;
 for(let x=gx0;x<=gx1;x+=RADIUS.max)ghosts.push({x,y:gy0},{x,y:gy1});for(let y=gy0+RADIUS.max;y<gy1;y+=RADIUS.max)ghosts.push({x:gx0,y},{x:gx1,y});
 const points=[...sites,...ghosts],d=Delaunator.from(points,p=>p.x,p=>p.y),next=(e:number)=>e%3===2?e-2:e+1;
 const centre=(t:number)=>{const [a,b,c]=[d.triangles[3*t],d.triangles[3*t+1],d.triangles[3*t+2]].map(i=>points[i]),dx=b.x-a.x,dy=b.y-a.y,ex=c.x-a.x,ey=c.y-a.y,bl=dx*dx+dy*dy,cl=ex*ex+ey*ey,k=.5/(dx*ey-dy*ex);return {x:a.x+(ey*bl-dy*cl)*k,y:a.y+(dx*cl-ex*bl)*k};};
 const incoming=new Map<number,number>(),neighbours=sites.map(()=>new Set<number>());
 for(let e=0;e<d.triangles.length;e++){const end=d.triangles[next(e)],start=d.triangles[e];if(!incoming.has(end)||d.halfedges[e]===-1)incoming.set(end,e);if(start<sites.length&&end<sites.length){neighbours[start].add(end);neighbours[end].add(start);}}
 const grown=offsetPolygons(outline,-jointIn);
 let pieces:{sites:number[];polys:PlanPoint[][]}[]=[];
 sites.forEach((_,i)=>{const ring:PlanPoint[]=[];let e=incoming.get(i)!;const start=e;do{ring.push(centre(Math.floor(e/3)));e=d.halfedges[next(e)];}while(e!==-1&&e!==start);for(const p of polygonCut([ring],grown))pieces.push({sites:[i],polys:[p]});});
 const stoneOf=(p:{polys:PlanPoint[][]})=>polygonCut(offsetPolygons(p.polys,jointIn/2),outline);
 // Slivers join the neighbour they share the most edge with; pieces without one are left out (they are joint).
 // Stone areas are kept per piece and recomputed only for a merged piece, so large patios stay fast.
 let areas=pieces.map(p=>polysArea(stoneOf(p)));
 for(;;){
  const small=areas.map((a,i)=>[a,i]).filter(([a])=>a<MIN_STONE_IN2).sort((a,b)=>a[0]-b[0])[0];
  if(!small)break;const piece=pieces[small[1]],near=new Set(piece.sites.flatMap(s=>[...neighbours[s]]));
  let best=-1,shared=0;pieces.forEach((q,i)=>{if(i===small[1]||!q.sites.some(s=>near.has(s)||piece.sites.includes(s)))return;const a=polysArea(polygonCut(offsetPolygons(piece.polys,-1),q.polys));if(a>shared){shared=a;best=i;}});
  if(best<0){pieces=pieces.filter((_,i)=>i!==small[1]);areas=areas.filter((_,i)=>i!==small[1]);continue;}
  const merged={sites:[...pieces[best].sites,...piece.sites].sort((a,b)=>a-b),polys:polygonUnion([...pieces[best].polys,...piece.polys])},keep=(_:unknown,i:number)=>i!==small[1]&&i!==best;
  pieces=pieces.filter(keep);areas=areas.filter(keep);pieces.push(merged);areas.push(polysArea(stoneOf(merged)));
 }
 // Large slabs among the rest: about a quarter of the stones take in a neighbour (up to SLAB_IN2), so sizes mix the
 // way a real pallet lays out instead of reading as an even honeycomb.
 const taken=new Set<number>();
 for(let i=0;i<pieces.length;i++){
  if(taken.has(i)||random()>SLAB_SHARE)continue;const piece=pieces[i],near=new Set(piece.sites.flatMap(s=>[...neighbours[s]])),size=polysArea(piece.polys);
  const options=pieces.map((q,j)=>({j,area:polysArea(q.polys)})).filter(({j,area})=>j!==i&&!taken.has(j)&&pieces[j].sites.some(s=>near.has(s))&&size+area<=SLAB_IN2&&polysArea(polygonCut(offsetPolygons(piece.polys,-1),pieces[j].polys))>=SLAB_EDGE_IN);
  if(!options.length)continue;const pick=options[Math.floor(random()*options.length)].j,merged={sites:[...piece.sites,...pieces[pick].sites].sort((a,b)=>a-b),polys:polygonUnion([...piece.polys,...pieces[pick].polys])};
  if(merged.polys.length!==1||offsetPolygons(merged.polys,jointIn/2).length!==1)continue;pieces[i]=merged;pieces[pick]={sites:[],polys:[]};taken.add(i).add(pick);
 }
 pieces=pieces.filter(p=>p.sites.length);
 const out:FlagstonePiece[]=[];
 // A piece pinched at a neck (concave outlines) shrinks into several parts: keep the largest, then each further part
 // only where it stays a full joint from those kept and is still a stone, never a sliver.
 for(const p of pieces){
  const id=p.sites.join('-'),parts=stoneOf(p).sort((a,b)=>polysArea([b])-polysArea([a])),kept:PlanPoint[][]=[];
  for(const part of parts){const clear=kept.length?polygonCut([part],offsetPolygons(kept,-jointIn),true):[part];for(const q of clear)if(polysArea([q])>=MIN_STONE_IN2)kept.push(q);}
  kept.forEach((polygon,k)=>out.push({id:kept.length>1?`${id}.${k}`:id,polygon}));
 }
 return out.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
}
