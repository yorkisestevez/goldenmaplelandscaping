import type {DeckData} from './types';
import type {LandscapePoint} from './landscapeTypes';
import {getTerrainConfig} from './yardSettings';
import {createSiteSurface,siteClip,siteSolidCells,sitePlaneHeight} from './siteSurfaceEngine';
import type {SitePlane} from './siteSurfaceEngine';
/** The same terrain-split cells supply the viewer and model exports. */
export function landscapeSurfaceCells(data:DeckData,polys:LandscapePoint[][]){
 const terrain=getTerrainConfig(data),surface=data.siteModel?createSiteSurface(data.siteModel,terrain):undefined,input=polys.map(p=>p.map(v=>({x:v.x,y:v.z}))),out:{polygon:{x:number;y:number}[];plane:SitePlane}[]=[];
 if(!input.length)return out;
 const add=(paths:typeof input,plane:SitePlane)=>{for(const polygon of siteSolidCells(paths))out.push({polygon,plane});};
 const fallback={x:0,z:terrain.slopePct/100,constant:terrain.elevationIn};
 if(data.siteModel){const xs=input.flat().map(p=>p.x),zs=input.flat().map(p=>p.y),bounds={x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs)};for(const t of surface!.proposedTriangles){const plan=t.vertices.map(v=>({x:v.xIn,y:v.zIn}));if(plan.every(v=>v.x<bounds.x0)||plan.every(v=>v.x>bounds.x1)||plan.every(v=>v.y<bounds.z0)||plan.every(v=>v.y>bounds.z1))continue;add(siteClip(input,[plan],'intersection'),t.plane);}add(siteClip(input,surface!.coverage,'difference'),fallback);}else add(input,fallback);
 return out;
}
export function landscapeCellTriangles(cells:ReturnType<typeof landscapeSurfaceCells>,depthIn:number){const positions:number[]=[],uv:number[]=[],span=2.1/.0254;for(const {polygon:cell,plane} of cells)for(let i=1;i+1<cell.length;i++){const a=cell[0],b=cell[i+1],c=cell[i];if(Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))<.000001)continue;for(const v of [a,b,c]){positions.push(v.x/12,(sitePlaneHeight(plane,v.x,v.y)+depthIn+.05)/12,v.y/12);uv.push(v.x/span,v.y/span);}}return {positions,uv};}
