import type {StairPad} from './stairPads';

/** A paver as drawn: centre (plan x/y, top-of-pad y), size along the stair foot (w) and out from it (d), plan yaw. */
export interface PadPaver{x:number;y:number;z:number;w:number;h:number;d:number;yaw:number;id:string}
/** 12 × 6 in pavers, 60 mm thick, ¼ in joints, in running bond with the long side along the stair foot. */
const PAVER={w:12,d:6,h:60/25.4,joint:.25};

/** The pavers of one stair pad (stairPads.ts). The band's first edge runs along the stair foot; a drawn path's mitred
 * band is laid square. */
export function padPavers(pad:StairPad):PadPaver[]{
  const [a,b,,d]=pad.outline,width=Math.hypot(b.x-a.x,b.y-a.y),depth=Math.hypot(d.x-a.x,d.y-a.y);
  if(width<1||depth<1)return [];
  const u={x:(b.x-a.x)/width,y:(b.y-a.y)/width},v={x:(d.x-a.x)/depth,y:(d.y-a.y)/depth},yaw=Math.atan2(-u.y,u.x),out:PadPaver[]=[];
  for(let row=0,v0=0;v0<depth-.5;row++,v0+=PAVER.d+PAVER.joint){
    const v1=Math.min(depth,v0+PAVER.d);
    for(let u0=-(row%2)*(PAVER.w+PAVER.joint)/2;u0<width-.5;u0+=PAVER.w+PAVER.joint){
      const lo=Math.max(0,u0),hi=Math.min(width,u0+PAVER.w),su=(lo+hi)/2,sv=(v0+v1)/2;
      if(hi-lo<1)continue;
      out.push({x:a.x+u.x*su+v.x*sv,y:pad.topIn-PAVER.h/2,z:a.y+u.y*su+v.y*sv,w:hi-lo,h:PAVER.h,d:v1-v0,yaw,id:`${pad.id}:${row}:${Math.round(u0)}`});
    }
  }
  return out;
}
