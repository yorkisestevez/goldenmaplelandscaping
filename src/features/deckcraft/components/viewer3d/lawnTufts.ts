import type {YardModel} from '../../yardModel';
import {snapshotHeight} from './siteRendering';
import type {PlanPoint} from '../../lib/deckGeometry';
import {lawnHeight} from './lawnSurface';

export interface LawnTuft {x:number;y:number;z:number;height:number;width:number;yaw:number;tone:number}
/** Render-only lawn detail, spread around the actual designed yard with one bounded instance budget. */
export function lawnTufts(yard:YardModel,width:number,depth:number,masks:PlanPoint[][],budget=28000):LawnTuft[]{
 const points=yard.features.filter(f=>!f.excluded).flatMap(f=>f.footprints).flat();
 const minX=Math.min(-width*.5,...points.map(p=>p.x-72)),maxX=Math.max(width*1.5,...points.map(p=>p.x+72));
 const minZ=Math.min(-48,...points.map(p=>p.y-72)),maxZ=Math.max(depth+width*.6,...points.map(p=>p.y+72));
 const w=maxX-minX,d=maxZ-minZ,capacity=Math.min(28000,Math.max(0,Math.floor(budget)));
 if(!capacity||![w,d].every(n=>Number.isFinite(n)&&n>0))return [];
 const columns=Math.max(1,Math.ceil(Math.sqrt(capacity*w/d))),rows=Math.floor(capacity/columns);
 if(!rows)return [];
 const regions=masks.map(polygon=>({polygon,minX:Math.min(...polygon.map(p=>p.x)),maxX:Math.max(...polygon.map(p=>p.x)),minZ:Math.min(...polygon.map(p=>p.y)),maxZ:Math.max(...polygon.map(p=>p.y))}));
 let seed=317;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const out:LawnTuft[]=[];
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
  const x=minX+(col+random())*w/columns,z=minZ+(row+random())*d/rows;let blocked=false;
  for(const region of regions){
   if(x<region.minX||x>region.maxX||z<region.minZ||z>region.maxZ)continue;
   let inside=false;const p=region.polygon;
   for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i].y>z)!==(p[j].y>z)&&x<(p[j].x-p[i].x)*(z-p[i].y)/(p[j].y-p[i].y)+p[i].x)inside=!inside;
   if(inside)blocked=!blocked;
  }
  const height=.7+random()*.9,bladeWidth=.75+random()*.6,yaw=random()*Math.PI*2,tone=1.35+random()*.35;
  if(!blocked)out.push({x,y:(snapshotHeight(yard.siteSurface,x,z)??(lawnHeight(yard.terrain,z)+.7))-.74,z,height,width:bladeWidth,yaw,tone});
 }
 return out;
}
