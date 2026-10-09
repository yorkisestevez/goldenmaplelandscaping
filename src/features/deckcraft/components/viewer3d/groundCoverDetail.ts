import {landscapeSurface} from '../../landscapeSurfaces';
import type {LandscapeAssetId,LandscapePoint} from '../../landscapeTypes';
import type {landscapeSurfaceCells} from '../../landscapeSurfaceGeometry';

export type DetailKind='blade'|'chip'|'round'|'angular';
export interface CoverInstance {x:number;y:number;z:number;width:number;height:number;depth:number;yaw:number;tone:number;warm:number;nx:number;nz:number}
export const detailHash=(x:number,z:number,s=0)=>{let n=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul(s+1,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
export function detailProfile(id:LandscapeAssetId){const s=landscapeSurface(id)!;return {kind:(s.type==='turf'?'blade':s.type==='mulch'?'chip':['river-rock-bed','mexican-beach-pebbles-bed','pea-gravel-bed'].includes(id)?'round':'angular') as DetailKind,grain:s.grainIn,height:id==='putting-green'?.18:id==='artificial-grass'?1.05:s.type==='mulch'?1.05:s.grainIn*.6,color:s.color};}
export function pointInCover(x:number,z:number,rings:LandscapePoint[][]){let inside=false;for(const p of rings)for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;}return inside;}
export function clearCoverEdge(x:number,z:number,rings:LandscapePoint[][],radius:number){for(const p of rings)for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(x-a.x-t*dx,z-a.z-t*dz)<radius)return false;}return true;}
/** Stable world-space samples: moving the camera never randomises already visible particles. All units are inches. */
export function coverInstances(id:LandscapeAssetId,rings:LandscapePoint[][],cells:ReturnType<typeof landscapeSurfaceCells>,depthIn:number,focus:{x:number;z:number},radius:number,budget:number,cups:LandscapePoint[]=[]):CoverInstance[]{
 if(!rings.length||budget<1)return [];const p=detailProfile(id),tile=36,xs=rings.flat().map(v=>v.x),zs=rings.flat().map(v=>v.z),x0=Math.max(Math.min(...xs),focus.x-radius),x1=Math.min(Math.max(...xs),focus.x+radius),z0=Math.max(Math.min(...zs),focus.z-radius),z1=Math.min(Math.max(...zs),focus.z+radius),out:CoverInstance[]=[];
 const perTile=Math.min(p.kind==='blade'?2400:1200,Math.ceil(tile*tile/(Math.max(.4,p.grain)**2)*(p.kind==='blade'?1:p.kind==='chip'?1.5:2.3)));
 const tiles:{x:number;z:number;d:number}[]=[];for(let z=Math.floor(z0/tile);z<=Math.floor(z1/tile);z++)for(let x=Math.floor(x0/tile);x<=Math.floor(x1/tile);x++)tiles.push({x,z,d:Math.hypot((x+.5)*tile-focus.x,(z+.5)*tile-focus.z)});tiles.sort((a,b)=>a.d-b.d);
 const prepared=cells.map(c=>({...c,minX:Math.min(...c.polygon.map(v=>v.x)),maxX:Math.max(...c.polygon.map(v=>v.x)),minZ:Math.min(...c.polygon.map(v=>v.y)),maxZ:Math.max(...c.polygon.map(v=>v.y)),ring:c.polygon.map(v=>({x:v.x,z:v.y}))}));
 // Interleave tiles so budget exhaustion thins coverage instead of creating a hard patch edge.
 for(let i=0;i<perTile;i++)for(const t of tiles){
  const x=(t.x+detailHash(t.x,t.z,i*7))*tile,z=(t.z+detailHash(t.x,t.z,i*7+1))*tile;if(Math.hypot(x-focus.x,z-focus.z)>radius||!pointInCover(x,z,rings))continue;
  const r=detailHash(t.x,t.z,i*7+2),mixed=id==='granular-base-bed'?(r<.7?.35:1.6):1,width=p.kind==='blade'?1:p.kind==='chip'?p.grain*(3.4+r*5.2):p.grain*(.6+r*.85)*mixed,depth=p.kind==='chip'?p.grain*(.22+detailHash(t.x,t.z,i*7+3)*.18):width*(.65+detailHash(t.x,t.z,i*7+3)*.5),height=p.kind==='chip'?.08+r*.05:p.height*(.6+r*.7)*mixed;
  if(!clearCoverEdge(x,z,rings,Math.hypot(width,depth)*.6)||cups.some(c=>Math.hypot(x-c.x,z-c.z)<2.125+width*.6))continue;
  const c=prepared.find(c=>x>=c.minX&&x<=c.maxX&&z>=c.minZ&&z<=c.maxZ&&pointInCover(x,z,[c.ring]));if(!c)continue;
  out.push({x,z,y:c.plane.x*x+c.plane.z*z+c.plane.constant+depthIn+.05+(p.kind==='blade'?0:height*.38),width,height,depth,yaw:p.kind==='blade'?.3+detailHash(t.x,t.z,i*7+4)*.6:detailHash(t.x,t.z,i*7+4)*Math.PI*2,tone:.67+detailHash(t.x,t.z,i*7+5)*.65,warm:detailHash(t.x,t.z,i*7+6)-.5,nx:-c.plane.x,nz:-c.plane.z});if(out.length>=budget)return out;
 }
 return out;
}
