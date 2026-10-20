import * as THREE from 'three';
import ClipperLib from 'clipper-lib';
import type {DeckData} from '../../types';
import type {LandscapeObject,LandscapePoint} from '../../landscapeTypes';
import {landscapeSurface} from '../../landscapeSurfaces';
import {landscapeStructureExclusions} from '../../landscapeFill';
import {getTerrainConfig} from '../../yardSettings';
import {createSiteSurface,designSiteModel,sitePlaneHeight,type SitePlane} from '../../siteSurfaceEngine';
import {occlusionUv,type GroundBounds} from './groundOcclusion';

/**
 * How a plain mulch or stone bed is drawn (render only: the priced depth, takeoff, exports and saved data never see it).
 * Ontario practice: the finished mulch sits about level with the lawn, below the grass tips, and ends at a spade-cut
 * edge. So the drawn top is grade + topIn, and along an edge that meets lawn a taperIn-wide cut runs from grade + edgeIn
 * up to it, its lower third the soil of the cut. Where the bed meets another bed, or comes within clearIn of the house,
 * deck, patio, wall or pool, there is no cut, so no bare strip shows there. Raised, turf and putting-green beds keep
 * their own geometry.
 */
export const BED_RELIEF={topIn:1,edgeIn:.4,taperIn:4,soilShare:1/3,clearIn:3,sampleIn:2,minRunIn:4,soil:'#3b2f25'} as const;

/** A finish bed drawn as a relief: plain mulch or stone, not raised. */
export const drapedBed=(o:LandscapeObject)=>o.kind==='bed'&&o.raisedIn===undefined&&['mulch','aggregate'].includes(landscapeSurface(o.assetId)?.type??'');

type Plan={x:number;y:number};
export interface Seg{ax:number;az:number;bx:number;bz:number}
const SCALE=1000;
const signedArea=(p:Plan[])=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.y-b.x*a.y;},0)/2;
const toPath=(p:Plan[])=>p.map(v=>({X:Math.round(v.x*SCALE),Y:Math.round(v.y*SCALE)}));
const fromPath=(p:{X:number;Y:number}[])=>p.map(v=>({x:v.X/SCALE,y:v.Y/SCALE}));
function clip(subject:Plan[][],cut:Plan[][],type:'difference'|'intersection'){
 if(!subject.length)return [];
 const c=new ClipperLib.Clipper(),out:{X:number;Y:number}[][]=[];
 c.AddPaths(subject.map(toPath),ClipperLib.PolyType.ptSubject,true);if(cut.length)c.AddPaths(cut.map(toPath),ClipperLib.PolyType.ptClip,true);
 c.Execute(type==='difference'?ClipperLib.ClipType.ctDifference:ClipperLib.ClipType.ctIntersection,out,ClipperLib.PolyFillType.pftEvenOdd,ClipperLib.PolyFillType.pftNonZero);
 return out.map(fromPath).filter(p=>Math.abs(signedArea(p))>1e-4);
}
function inset(polys:Plan[][],by:number){
 const o=new ClipperLib.ClipperOffset(2,.05*SCALE),out:{X:number;Y:number}[][]=[];
 o.AddPaths(ClipperLib.Clipper.SimplifyPolygons(polys.map(toPath),ClipperLib.PolyFillType.pftEvenOdd),ClipperLib.JoinType.jtMiter,ClipperLib.EndType.etClosedPolygon);
 o.Execute(out,-by*SCALE);return out.map(fromPath).filter(p=>Math.abs(signedArea(p))>1e-4);
}
const bounds=(rings:LandscapePoint[][])=>{let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(const p of rings)for(const v of p){x0=Math.min(x0,v.x);x1=Math.max(x1,v.x);z0=Math.min(z0,v.z);z1=Math.max(z1,v.z);}return {x0,x1,z0,z1};};
const inRing=(x:number,z:number,ring:{x:number;z:number}[])=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)yes=!yes;}return yes;};
/** Even-odd over a bed's rings (outline and holes). */
export const inRings=(x:number,z:number,rings:LandscapePoint[][])=>rings.reduce((n,r)=>n!==inRing(x,z,r),false);
const segDistance2=(x:number,z:number,s:Seg)=>{const dx=s.bx-s.ax,dz=s.bz-s.az,t=Math.max(0,Math.min(1,((x-s.ax)*dx+(z-s.az)*dz)/(dx*dx+dz*dz||1))),ex=x-s.ax-t*dx,ez=z-s.az-t*dz;return ex*ex+ez*ez;};
const segDistance=(x:number,z:number,s:Seg)=>Math.sqrt(segDistance2(x,z,s));

/** A coarse grid of items padded by their reach, so a lookup reads one cell: the cut's segments and the plant collars.
 * Items are collected, then laid into a dense array over their bounds on the first lookup (no hashing per lookup). */
export class ReachGrid<T>{
 private items:{item:T;i0:number;j0:number;i1:number;j1:number}[]=[];
 private cells?:(T[]|undefined)[];private i0=0;private j0=0;private w=0;private h=0;
 constructor(private cell:number){}
 add(item:T,minX:number,minZ:number,maxX:number,maxZ:number){this.cells=undefined;this.items.push({item,i0:Math.floor(minX/this.cell),j0:Math.floor(minZ/this.cell),i1:Math.floor(maxX/this.cell),j1:Math.floor(maxZ/this.cell)});}
 at(x:number,z:number):readonly T[]{
  if(!this.cells){
   const all=this.items;this.i0=Math.min(...all.map(a=>a.i0));this.j0=Math.min(...all.map(a=>a.j0));this.w=all.length?Math.max(...all.map(a=>a.i1))-this.i0+1:0;this.h=all.length?Math.max(...all.map(a=>a.j1))-this.j0+1:0;
   this.cells=new Array(this.w*this.h);
   for(const a of all)for(let i=a.i0;i<=a.i1;i++)for(let j=a.j0;j<=a.j1;j++){const k=(i-this.i0)*this.h+(j-this.j0);(this.cells[k]??=[]).push(a.item);}
  }
  const i=Math.floor(x/this.cell)-this.i0,j=Math.floor(z/this.cell)-this.j0;
  return i<0||j<0||i>=this.w||j>=this.h?NONE as readonly T[]:this.cells[i*this.h+j]??NONE as readonly T[];
 }
}
const NONE:readonly unknown[]=[];

/** The ground the bed sheets drape over: the design's proposed surface, or the terrain plane off it (as landscapeSurfaceCells). */
interface ReliefGround{fallback:SitePlane;triangles:{plan:Plan[];plane:SitePlane;minX:number;maxX:number;minZ:number;maxZ:number}[];coverage:Plan[][];height:(x:number,z:number)=>number}
const grounds=new WeakMap<DeckData,ReliefGround>();
export function reliefGround(data:DeckData):ReliefGround{
 const cached=grounds.get(data);if(cached)return cached;
 const terrain=getTerrainConfig(data),fallback={x:0,z:terrain.slopePct/100,constant:terrain.elevationIn};
 let ground:ReliefGround;
 if(data.siteModel){
  const surface=createSiteSurface(designSiteModel(data),terrain),triangles=surface.proposedTriangles.map(t=>{const plan=t.vertices.map(v=>({x:v.xIn,y:v.zIn}));return {plan,plane:t.plane,minX:Math.min(...plan.map(v=>v.x)),maxX:Math.max(...plan.map(v=>v.x)),minZ:Math.min(...plan.map(v=>v.y)),maxZ:Math.max(...plan.map(v=>v.y))};});
  ground={fallback,triangles,coverage:surface.coverage,height:(x,z)=>surface.sample(x,z)??sitePlaneHeight(fallback,x,z)};
 }else ground={fallback,triangles:[],coverage:[],height:(x,z)=>sitePlaneHeight(fallback,x,z)};
 grounds.set(data,ground);return ground;
}
/** Region pieces split on the ground's faces, so every drawn vertex lies on its own face's plane. */
function groundPieces(ground:ReliefGround,region:Plan[][]){
 if(!region.length)return [];
 if(!ground.triangles.length)return [{polys:region,plane:ground.fallback}];
 const xs=region.flat().map(v=>v.x),zs=region.flat().map(v=>v.y),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs),out:{polys:Plan[][];plane:SitePlane}[]=[];
 for(const t of ground.triangles){if(t.maxX<x0||t.minX>x1||t.maxZ<z0||t.minZ>z1)continue;const polys=clip(region,[t.plan],'intersection');if(polys.length)out.push({polys,plane:t.plane});}
 const off=clip(region,ground.coverage,'difference');if(off.length)out.push({polys:off,plane:ground.fallback});
 return out;
}
/** Outlines with their holes (by nesting), triangulated; triangles in plan inches. */
function triangulate(polys:Plan[][]){
 const sorted=[...polys].sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a))),shapes:{outer:Plan[];holes:Plan[][]}[]=[];
 for(const p of sorted){const owner=[...shapes].reverse().find(s=>inRing(p[0].x,p[0].y,s.outer.map(v=>({x:v.x,z:v.y}))));if(owner&&!owner.holes.some(h=>inRing(p[0].x,p[0].y,h.map(v=>({x:v.x,z:v.y})))))owner.holes.push(p);else shapes.push({outer:p,holes:[]});}
 const out:[Plan,Plan,Plan][]=[];
 for(const s of shapes){
  const contour=s.outer.map(v=>new THREE.Vector2(v.x,v.y)),holes=s.holes.map(h=>h.map(v=>new THREE.Vector2(v.x,v.y))),points=[...contour,...holes.flat()];
  for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(contour,holes))out.push([points[a],points[b],points[c]].map(v=>({x:v.x,y:v.y})) as [Plan,Plan,Plan]);
 }
 return out;
}

export interface BedRelief{
 object:LandscapeObject;polys:LandscapePoint[][];
 /** The bed's rings with a vertex at every change between cut and uncut edge, and 4 in into each uncut run. */
 rings:LandscapePoint[][];
 /** Edge runs that meet lawn and so take the spade cut. */
 tapered:Seg[];
 /** Drawn top above the ground (inches): topIn, or the cut's height within taperIn of a cut edge. */
 rise:(x:number,z:number)=>number;
 /** Distance to the nearest cut edge, capped at taperIn. */
 cutDistance:(x:number,z:number)=>number;
}
/** Which edges of each draped bed take the cut, and its drawn height anywhere inside. areas: landscapeBedAreas;
 * structures: landscapeStructureExclusions, when the caller already has them (the 3D view does, for its own design). */
export function bedReliefs(data:DeckData,objects:LandscapeObject[],areas:Map<string,LandscapePoint[][]>,known?:LandscapePoint[][]){
 // Structures come from the deck and yard models; before those can be built, every edge meeting no other bed is cut.
 const out=new Map<string,BedRelief>();let structures:LandscapePoint[][]=[];try{structures=known??landscapeStructureExclusions(data);}catch{/* the design's geometry is still loading */}
 const structureSegs:Seg[]=structures.flatMap(p=>p.map((a,i)=>{const b=p[(i+1)%p.length];return {ax:a.x,az:a.z,bx:b.x,bz:b.z};}));
 const structureGrid=new ReachGrid<Seg>(24);for(const s of structureSegs)structureGrid.add(s,Math.min(s.ax,s.bx)-BED_RELIEF.clearIn,Math.min(s.az,s.bz)-BED_RELIEF.clearIn,Math.max(s.ax,s.bx)+BED_RELIEF.clearIn,Math.max(s.az,s.bz)+BED_RELIEF.clearIn);
 for(const o of objects.filter(o=>o.enabled&&drapedBed(o))){
  const polys=areas.get(o.id)??[];if(!polys.length)continue;
  // Only beds and structures whose bounds come within reach of this bed can share or block one of its edges.
  const box=bounds(polys),reach=BED_RELIEF.clearIn+2,near=(p:LandscapePoint[])=>{const b=bounds([p]);return b.x1>=box.x0-reach&&b.x0<=box.x1+reach&&b.z1>=box.z0-reach&&b.z0<=box.z1+reach;};
  const others=[...areas].filter(([id])=>id!==o.id).flatMap(([,p])=>p).filter(near),nearStructures=structures.filter(near);
  // Lawn on the far side of the edge (1.5 in out) and no structure within clearIn: the edge is cut.
  const cut=(x:number,z:number,nx:number,nz:number)=>{
   if(!inRings(x+nx*.5,z+nz*.5,polys)){nx=-nx;nz=-nz;}
   const ox=x-nx*1.5,oz=z-nz*1.5;
   if(inRings(ox,oz,others))return false;
   if(nearStructures.some(p=>inRing(ox,oz,p)))return false;
   return !structureGrid.at(x,z).some(s=>segDistance(x,z,s)<=BED_RELIEF.clearIn);
  };
  const tapered:Seg[]=[],rings:LandscapePoint[][]=[];
  for(const ring of polys){
   const next:LandscapePoint[]=[];
   for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],len=Math.hypot(b.x-a.x,b.z-a.z);next.push(a);if(len<1e-6)continue;
    const dx=(b.x-a.x)/len,dz=(b.z-a.z)/len,n=Math.max(1,Math.round(len/BED_RELIEF.sampleIn)),step=len/n,flags:boolean[]=[];
    for(let k=0;k<n;k++){const u=(k+.5)*step;flags.push(cut(a.x+dx*u,a.z+dz*u,-dz,dx));}
    // Runs shorter than minRunIn follow their neighbours, so the cut never flickers along an edge.
    const runs:{start:number;end:number;cut:boolean}[]=[];for(let k=0;k<n;k++){const last=runs.at(-1);if(last&&last.cut===flags[k])last.end=(k+1)*step;else runs.push({start:k*step,end:(k+1)*step,cut:flags[k]});}
    for(let k=0;k<runs.length;k++)if(runs.length>1&&runs[k].end-runs[k].start<BED_RELIEF.minRunIn)runs[k].cut=!runs[k].cut;
    const merged:typeof runs=[];for(const r of runs){const last=merged.at(-1);if(last&&last.cut===r.cut)last.end=r.end;else merged.push({...r});}
    const at=(u:number)=>({x:a.x+dx*u,z:a.z+dz*u}),stops=new Set<number>();
    for(const r of merged){
     if(r.start>0)stops.add(r.start);
     if(r.cut){tapered.push({ax:a.x+dx*r.start,az:a.z+dz*r.start,bx:a.x+dx*r.end,bz:a.z+dz*r.end});continue;}
     const span=r.end-r.start;if(span>2*BED_RELIEF.taperIn){stops.add(r.start+BED_RELIEF.taperIn);stops.add(r.end-BED_RELIEF.taperIn);}else if(span>1)stops.add((r.start+r.end)/2);
    }
    for(const u of [...stops].sort((p,q)=>p-q))if(u>.01&&u<len-.01)next.push(at(u));
   }
   rings.push(next);
  }
  const grid=new ReachGrid<Seg>(24);for(const s of tapered)grid.add(s,Math.min(s.ax,s.bx)-BED_RELIEF.taperIn,Math.min(s.az,s.bz)-BED_RELIEF.taperIn,Math.max(s.ax,s.bx)+BED_RELIEF.taperIn,Math.max(s.az,s.bz)+BED_RELIEF.taperIn);
  const cutDistance=(x:number,z:number)=>{const near=grid.at(x,z);if(!near.length)return BED_RELIEF.taperIn;let d2=BED_RELIEF.taperIn*BED_RELIEF.taperIn;for(const s of near)d2=Math.min(d2,segDistance2(x,z,s));return Math.sqrt(d2);};
  const rise=(x:number,z:number)=>BED_RELIEF.edgeIn+(BED_RELIEF.topIn-BED_RELIEF.edgeIn)*cutDistance(x,z)/BED_RELIEF.taperIn;
  out.set(o.id,{object:o,polys,rings,tapered,rise,cutDistance});
 }
 return out;
}

/** Soil of the cut and the collars as a vertex colour over this bed's own finish colour (Photo mode traces it too). */
export function soilTint(o:LandscapeObject){
 const soil=new THREE.Color(BED_RELIEF.soil),finish=new THREE.Color(landscapeSurface(o.assetId)?.color??'#ffffff');
 return new THREE.Color(soil.r/Math.max(.004,finish.r),soil.g/Math.max(.004,finish.g),soil.b/Math.max(.004,finish.b));
}
function pushTriangle(positions:number[],a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3){
 // Face up: counter-clockwise seen from above (+y).
 if((b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z)<0)[b,c]=[c,b];
 positions.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
}
/** World-foot geometry of a draped bed's top: the plateau and the cut, split on the ground's faces, with uv (the finish's
 * world tiling), uv1 (the shared ground occlusion map, when drawn) and colour (soil in the cut's lower third). */
export function bedReliefGeometry(data:DeckData,relief:BedRelief,bounds?:GroundBounds){
 const ground=reliefGround(data),rings=relief.rings.map(r=>r.map(v=>({x:v.x,y:v.z}))),{taperIn,soilShare}=BED_RELIEF;
 const mid=inset(rings,taperIn*soilShare),inner=inset(rings,taperIn);
 const regions:{polys:Plan[][];soil:boolean}[]=[{polys:clip(rings,mid,'difference'),soil:true},{polys:clip(mid,inner,'difference'),soil:false},{polys:inner,soil:false}];
 const positions:number[]=[],soilFlags:boolean[]=[];
 for(const region of regions)for(const piece of groundPieces(ground,region.polys))for(const tri of triangulate(piece.polys)){
  const v=tri.map(p=>new THREE.Vector3(p.x/12,(sitePlaneHeight(piece.plane,p.x,p.y)+relief.rise(p.x,p.y))/12,p.y/12));
  const start=positions.length/3;pushTriangle(positions,v[0],v[1],v[2]);
  for(let k=0;k<3;k++){const x=positions[(start+k)*3]*12,z=positions[(start+k)*3+2]*12;soilFlags.push(region.soil&&relief.cutDistance(x,z)<=taperIn*soilShare+.05);}
 }
 return finishGeometry(positions,soilFlags,soilTint(relief.object),bounds);
}
/** uv, uv1 and colour for a world-foot triangle list. */
export function finishGeometry(positions:number[],soilFlags:boolean[],soil:THREE.Color,bounds?:GroundBounds){
 const count=positions.length/3,span=2.1/.0254,uv=new Float32Array(count*2),uv1=new Float32Array(count*2),color=new Float32Array(count*3);
 for(let i=0;i<count;i++){
  const x=positions[i*3]*12,z=positions[i*3+2]*12;uv[i*2]=x/span;uv[i*2+1]=z/span;
  if(bounds){const [u,w]=occlusionUv(bounds,x,z);uv1[i*2]=u;uv1[i*2+1]=w;}
  const c=soilFlags[i]?soil:WHITE;color[i*3]=c.r;color[i*3+1]=c.g;color[i*3+2]=c.b;
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setAttribute('uv1',new THREE.BufferAttribute(uv1,2));geometry.setAttribute('color',new THREE.BufferAttribute(color,3));
 geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
const WHITE=new THREE.Color(1,1,1);
/** uv1 and a white colour for a bed sheet drawn the old way (raised and turf beds), so it can share the AO map and a
 * vertex-coloured material. */
export function addSheetAttributes(geometry:THREE.BufferGeometry,bounds?:GroundBounds){
 const p=geometry.getAttribute('position'),uv1=new Float32Array(p.count*2),color=new Float32Array(p.count*3).fill(1);
 if(bounds)for(let i=0;i<p.count;i++){const [u,w]=occlusionUv(bounds,p.getX(i)*12,p.getZ(i)*12);uv1[i*2]=u;uv1[i*2+1]=w;}
 geometry.setAttribute('uv1',new THREE.BufferAttribute(uv1,2));geometry.setAttribute('color',new THREE.BufferAttribute(color,3));return geometry;
}

/** Flush steel edging: the ribbon's base 3.5 in into the ground, so its top stands ½ in above grade, split at each of the
 * ground's face edges so it follows a sloped surface exactly. Points: world feet along one ring (closed), or along an
 * open run (edgingRuns) when `closed` is false. */
export const FLUSH_EDGING={buryIn:3.5,proudIn:.5};
export function flushEdgingPoints(data:DeckData,ring:LandscapePoint[],closed=true){
 const ground=reliefGround(data),pts:THREE.Vector3[]=[],last=ring.at(-1);
 const breaks=(a:Plan,b:Plan)=>{const ts=[0];for(const t of ground.triangles){if(Math.max(a.x,b.x)<t.minX||Math.min(a.x,b.x)>t.maxX||Math.max(a.y,b.y)<t.minZ||Math.min(a.y,b.y)>t.maxZ)continue;for(let i=0;i<3;i++){const p=t.plan[i],q=t.plan[(i+1)%3],d=(b.x-a.x)*(q.y-p.y)-(b.y-a.y)*(q.x-p.x);if(Math.abs(d)<1e-9)continue;const s=((p.x-a.x)*(q.y-p.y)-(p.y-a.y)*(q.x-p.x))/d,u=((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x))/d;if(s>1e-6&&s<1-1e-6&&u>=-1e-6&&u<=1+1e-6)ts.push(s);}}return [...new Set(ts.map(t=>Math.round(t*1e6)/1e6))].sort((p,q)=>p-q);};
 const y=(x:number,z:number)=>(ground.height(x,z)-FLUSH_EDGING.buryIn)/12;
 for(let i=0;i<(closed?ring.length:ring.length-1);i++){const a={x:ring[i].x,y:ring[i].z},b={x:ring[(i+1)%ring.length].x,y:ring[(i+1)%ring.length].z};for(const t of breaks(a,b)){const x=a.x+(b.x-a.x)*t,z=a.y+(b.y-a.y)*t;pts.push(new THREE.Vector3(x/12,y(x,z),z/12));}}
 if(pts.length)pts.push(closed?pts[0].clone():new THREE.Vector3(last!.x/12,y(last!.x,last!.z),last!.z/12));
 return pts;
}
