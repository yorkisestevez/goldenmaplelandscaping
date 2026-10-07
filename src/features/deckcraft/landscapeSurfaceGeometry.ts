import type {DeckData} from './types';
import type {LandscapeObject,LandscapePoint} from './landscapeTypes';
import {bedLevel,planeGround,ringGround,type BedGround} from './raisedBeds';
import {landscapeOutlinePaths} from './landscapeOutline';
import {landscapeSurfaceDepth} from './landscapeSurfaces';
import {getTerrainConfig} from './yardSettings';
import {createSiteSurface,designSiteModel,siteClip,siteSolidCells,sitePlaneHeight} from './siteSurfaceEngine';
import type {SitePlane} from './siteSurfaceEngine';
function bedGround(data:DeckData){const terrain=getTerrainConfig(data),fallback={x:0,z:terrain.slopePct/100,constant:terrain.elevationIn};return {fallback,ground:(data.siteModel?createSiteSurface(designSiteModel(data),terrain):planeGround(fallback)) as BedGround};}
/** A raised bed's level soil top (raisedBeds.ts) on the same ground as its cells; undefined unless raised and measured. */
export function raisedBedTop(data:DeckData,o?:LandscapeObject){return o?.kind==='bed'&&o.raisedIn!==undefined?bedLevel(bedGround(data).ground,landscapeOutlinePaths(o)[0],o.raisedIn)?.topIn:undefined;}
/** The same terrain-split cells supply the viewer and model exports. A raised bed (pass its object) lies on one
 * level plane at its soil top instead of following the ground. */
export function landscapeSurfaceCells(data:DeckData,polys:LandscapePoint[][],object?:LandscapeObject){
 const terrain=getTerrainConfig(data),surface=data.siteModel?createSiteSurface(designSiteModel(data),terrain):undefined,input=polys.map(p=>p.map(v=>({x:v.x,y:v.z}))),out:{polygon:{x:number;y:number}[];plane:SitePlane}[]=[];
 if(!input.length)return out;
 const top=raisedBedTop(data,object);if(top!==undefined){for(const polygon of siteSolidCells(input))out.push({polygon,plane:{x:0,z:0,constant:top}});return out;}
 const add=(paths:typeof input,plane:SitePlane)=>{for(const polygon of siteSolidCells(paths))out.push({polygon,plane});};
 const fallback={x:0,z:terrain.slopePct/100,constant:terrain.elevationIn};
 if(data.siteModel){const xs=input.flat().map(p=>p.x),zs=input.flat().map(p=>p.y),bounds={x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs)};for(const t of surface!.proposedTriangles){const plan=t.vertices.map(v=>({x:v.xIn,y:v.zIn}));if(plan.every(v=>v.x<bounds.x0)||plan.every(v=>v.x>bounds.x1)||plan.every(v=>v.y<bounds.z0)||plan.every(v=>v.y>bounds.z1))continue;add(siteClip(input,[plan],'intersection'),t.plane);}add(siteClip(input,surface!.coverage,'difference'),fallback);}else add(input,fallback);
 return out;
}
export function landscapeCellTriangles(cells:ReturnType<typeof landscapeSurfaceCells>,depthIn:number){const positions:number[]=[],uv:number[]=[],span=2.1/.0254;for(const {polygon:cell,plane} of cells)for(let i=1;i+1<cell.length;i++){const a=cell[0],b=cell[i+1],c=cell[i];if(Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))<.000001)continue;for(const v of [a,b,c]){positions.push(v.x/12,(sitePlaneHeight(plane,v.x,v.y)+depthIn+.05)/12,v.y/12);uv.push(v.x/span,v.y/span);}}return {positions,uv};}
/** A raised bed's vertical faces (world feet, triangle list): from the ground up to its finish top wherever it stands
 * over the ground, skipping stretches `covered` says a linked wall holds. Timber and steel edging stand 1 in proud. */
export function raisedBedFaces(data:DeckData,o:LandscapeObject,polys:LandscapePoint[][],covered?:(xIn:number,zIn:number)=>boolean){
 const positions:number[]=[],top=raisedBedTop(data,o);if(top===undefined)return positions;
 const {ground,fallback}=bedGround(data),y=top+landscapeSurfaceDepth(o)+(o.edge&&o.edge.kind!=='wall'?1:0),h=(p:{x:number;z:number;h:number|undefined})=>p.h??sitePlaneHeight(fallback,p.x,p.z);
 for(const ring of polys)for(const edge of ringGround(ground,ring))for(let i=0;i+1<edge.length;i++){
  let a={...edge[i],h:h(edge[i])},b={...edge[i+1],h:h(edge[i+1])};if(a.h>=y&&b.h>=y||covered?.((a.x+b.x)/2,(a.z+b.z)/2))continue;
  if(a.h>=y||b.h>=y){const t=(y-a.h)/(b.h-a.h),m={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,h:y};if(a.h>=y)a=m;else b=m;}
  for(const [p,v] of [[a,a.h],[b,b.h],[b,y],[a,a.h],[b,y],[a,y]] as const)positions.push(p.x/12,v/12,p.z/12);
 }
 return positions;
}
