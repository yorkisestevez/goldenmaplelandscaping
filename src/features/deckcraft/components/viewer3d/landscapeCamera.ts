import type {YardModel} from '../../yardModel';
import type {PoolFeatureModel} from '../../poolModel';
import {overviewCamera} from './cameraFraming';
import {snapshotHeight} from './siteRendering';
/** Fit the actual installed stock envelopes, in feet; no terrain or model mutation. */
export function landscapeCamera(preset:'terrace'|'pool'|'wall',yard:YardModel,pools:PoolFeatureModel[],aspect:number,fov=38){
 let direction:[number,number,number]=[.7,.65,1.3];const points:{x:number;y:number;z:number}[]=[];
 const add=(x:number,y:number,z:number)=>points.push({x:x/12,y:y/12,z:z/12});
 const features=yard.features.filter(f=>!f.excluded&&f.config.enabled&&(preset==='wall'?f.config.kind==='retaining-wall':true));
 const boxes=(preset==='wall'?features.slice(0,1):features).flatMap(f=>f.boxes).filter(b=>['paver','wall-block','wall-cap'].includes(b.role)&&!b.renderDuplicate);
 if(preset!=='pool')for(const b of boxes){const c=Math.cos(b.angle??0),s=Math.sin(b.angle??0),ring=b.renderContours?.flat()??b.polygon??[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:b.x+c*u*b.w/2-s*v*b.d/2,y:b.z+s*u*b.w/2+c*v*b.d/2}));for(const p of ring){const top=b.y+b.h/2,ground=snapshotHeight(yard.siteSurface,p.x,p.y)??yard.terrain.elevationIn+p.y*yard.terrain.slopePct/100;if(top<ground&&b.role!=='paver')continue;add(p.x,b.role==='paver'?b.y-b.h/2:Math.min(top,Math.max(b.y-b.h/2,ground)),p.y);add(p.x,top,p.y);}}
 if(preset!=='wall')for(const pool of pools){for(const p of pool.permanentExclusionFootprints.flat())add(p.x,pool.copingTopElevationIn,p.y);if(preset==='pool')for(const floor of pool.floorRegions)for(const p of floor.polygon)add(p.x,floor.plane.x*p.x+floor.plane.z*p.y+floor.plane.constant,p.y);}
 if(preset==='wall'){
  const caps=boxes.filter(b=>b.role==='wall-cap'),b=caps[Math.floor(caps.length/2)]??boxes.find(b=>b.role==='wall-block');if(b){const theta=b.angle??0,nx=-Math.sin(theta),nz=Math.cos(theta),offset=b.d/2+6,ground=(side:number)=>snapshotHeight(yard.siteSurface,b.x+side*nx*offset,b.z+side*nz*offset)??yard.terrain.elevationIn+(b.z+side*nz*offset)*yard.terrain.slopePct/100,side=ground(1)<ground(-1)?1:-1;direction=[side*nx,.32,side*nz];}
 }
 if(!points.length)return undefined;
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),zs=points.map(p=>p.z),w=Math.max(...xs)-Math.min(...xs),d=Math.max(...zs)-Math.min(...zs),cx=(Math.max(...xs)+Math.min(...xs))/2,cz=(Math.max(...zs)+Math.min(...zs))/2,height=Math.max(...ys);
 return overviewCamera({w:Math.max(1,w),d:Math.max(1,d),cx,cz,height,aspect,points,direction},fov);
}
