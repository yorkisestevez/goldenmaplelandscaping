import type {YardModel} from '../../yardModel';
import type {PlanPoint} from '../../lib/deckGeometry';
import {lawnGround} from './lawnGround';

export interface LawnTuft {x:number;y:number;z:number;height:number;width:number;yaw:number;tone:number}
/** Fixed world-grid samples concentrate detail around a close camera without changing the saved yard. */
export function lawnTufts(yard:YardModel,width:number,depth:number,masks:PlanPoint[][],budget=28000,focus?:{x:number;z:number}):LawnTuft[]{
 const points=yard.features.filter(f=>!f.excluded).flatMap(f=>f.footprints).flat(),capacity=Math.min(28000,Math.max(0,Math.floor(budget)));
 const minX=Math.min(-width*.5,...points.map(p=>p.x-72)),maxX=Math.max(width*1.5,...points.map(p=>p.x+72)),minZ=Math.min(-48,...points.map(p=>p.y-72)),maxZ=Math.max(depth+width*.6,...points.map(p=>p.y+72));
 if(!capacity||![maxX-minX,maxZ-minZ].every(n=>Number.isFinite(n)&&n>0))return [];
 const regions=masks.map(polygon=>({polygon,minX:Math.min(...polygon.map(p=>p.x)),maxX:Math.max(...polygon.map(p=>p.x)),minZ:Math.min(...polygon.map(p=>p.y)),maxZ:Math.max(...polygon.map(p=>p.y))}));
 const hash=(x:number,z:number,s:number)=>{let n=Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(s+1,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
 const out:LawnTuft[]=[],ground=lawnGround(yard);
 const populate=(x0:number,z0:number,x1:number,z1:number,count:number,near:boolean)=>{
  if(count<1)return;const step=Math.sqrt((x1-x0)*(z1-z0)/count);
  for(let gz=Math.floor(z0/step);gz<Math.ceil(z1/step);gz++)for(let gx=Math.floor(x0/step);gx<Math.ceil(x1/step);gx++){
   if(out.length>=capacity)return;const x=(gx+hash(gx,gz,0))*step,z=(gz+hash(gx,gz,1))*step;if(x<x0||x>x1||z<z0||z>z1||focus&&(near?Math.hypot(x-focus.x,z-focus.z)>120:Math.hypot(x-focus.x,z-focus.z)<120))continue;let blocked=false;
   for(const region of regions){if(x<region.minX||x>region.maxX||z<region.minZ||z>region.maxZ)continue;let inside=false;const p=region.polygon;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i].y>z)!==(p[j].y>z)&&x<(p[j].x-p[i].x)*(z-p[i].y)/(p[j].y-p[i].y)+p[i].x)inside=!inside;if(inside)blocked=!blocked;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],dx=b.x-a.x,dz=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.y)*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(x-a.x-t*dx,z-a.y-t*dz)<1.5){blocked=true;break;}}}
   if(!blocked)out.push({x,y:ground.height(x,z)-.04,z,height:(1.3+hash(gx,gz,2)*1.1)*(near&&focus?Math.min(1,Math.max(.03,(120-Math.hypot(x-focus.x,z-focus.z))/36)):1),width:.8+hash(gx,gz,3)*.6,yaw:hash(gx,gz,4)*Math.PI*2,tone:1.05+hash(gx,gz,5)*.42});
  }
 };
 if(focus)populate(focus.x-120,focus.z-120,focus.x+120,focus.z+120,Math.floor(capacity*.8),true);
 populate(minX,minZ,maxX,maxZ,focus?Math.floor(capacity*.2):capacity,false);
 return out;
}
