import type {DeckData} from './types';
import type {LandscapeAssetId,LandscapeObject} from './landscapeTypes';
import {poolOutline} from './poolGeometry';

/**
 * Yaw applied in model space, before the design rotation, so the seat front
 * (or the chaise's foot end) lies on local +Z. Measured from the GLBs:
 * the folding chair's backrest is on +Z, so its front is −Z; the sofa and
 * chaise already keep the backrest on −Z. A design rotation of 0 then faces
 * every seat toward +Z, in the sample and in a user's own layout.
 */
export const FURNITURE_MESH_YAW_DEG:Partial<Record<LandscapeAssetId,number>>={
 'outdoor-chair':180,
};
export const meshYawRad=(id:LandscapeAssetId)=>(FURNITURE_MESH_YAW_DEG[id]??0)*Math.PI/180;

const SEATING=new Set<LandscapeAssetId>(['outdoor-chair','outdoor-sofa','lounge-chair']);

/** World-plan unit vector of the seat front after the mesh yaw. rotationDeg 0 points at +Z. */
export function seatFront(rotationDeg:number){
 const yaw=-rotationDeg*Math.PI/180;
 return {x:Math.sin(yaw),z:Math.cos(yaw)};
}

/** Design rotation whose seat front points along (dx, dz). */
export function rotationDegFacing(dx:number,dz:number){
 const deg=-Math.atan2(dx,dz)*180/Math.PI;
 return ((deg+180)%360+360)%360-180;
}

export function nearestSeatPoint(p:{x:number;y:number},ring:{x:number;y:number}[]){
 let best=ring[0],bestD=Infinity;
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],abx=b.x-a.x,aby=b.y-a.y,ab2=abx*abx+aby*aby||1;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*abx+(p.y-a.y)*aby)/ab2));
  const q={x:a.x+abx*t,y:a.y+aby*t},d=(q.x-p.x)**2+(q.y-p.y)**2;
  if(d<bestD){bestD=d;best=q;}
 }
 return best;
}

export type SeatTarget={x:number;z:number;label:string};

/** Where a seat should look: the burner, the table centre, the near pool edge, or the facing chair. */
export function seatTarget(data:DeckData,seat:LandscapeObject):SeatTarget|null{
 const seats=(data.landscapeObjects??[]).filter(o=>o.enabled&&SEATING.has(o.assetId)&&o.id!==seat.id);
 const tables=(data.landscapeObjects??[]).filter(o=>o.enabled&&(o.assetId==='outdoor-table'||o.assetId==='outdoor-coffee-table'));
 const fires=(data.yardFeatures??[]).filter(f=>f.enabled&&f.kind==='fire-feature');
 const near=(items:{x:number;z:number;label:string}[],maxIn:number)=>items.filter(i=>Math.hypot(i.x-seat.xIn,i.z-seat.zIn)<=maxIn).sort((a,b)=>Math.hypot(a.x-seat.xIn,a.z-seat.zIn)-Math.hypot(b.x-seat.xIn,b.z-seat.zIn))[0]??null;
 if(seat.assetId==='lounge-chair'){
  let best:SeatTarget|null=null,bestD=Infinity;
  for(const pool of data.pools??[]){
   if(pool.enabled===false)continue;
   let ring:{x:number;y:number}[];
   try{ring=poolOutline(pool);}catch{continue;}
   if(ring.length<3)continue;
   const q=nearestSeatPoint({x:seat.xIn,y:seat.zIn},ring),d=Math.hypot(q.x-seat.xIn,q.y-seat.zIn);
   if(d<bestD){bestD=d;best={x:q.x,z:q.y,label:'the pool'};}
  }
  return best;
 }
 const fire=near(fires.map(f=>({x:f.xFt*12,z:f.zFt*12,label:'the burner'})),12*12);
 if(fire&&(seat.assetId==='outdoor-sofa'||seat.assetId==='outdoor-chair'))return fire;
 const dining=near(tables.filter(t=>t.assetId==='outdoor-table').map(t=>({x:t.xIn,z:t.zIn,label:'the table centre'})),10*12);
 if(dining)return dining;
 const coffee=near(tables.filter(t=>t.assetId==='outdoor-coffee-table').map(t=>({x:t.xIn,z:t.zIn,label:'the coffee table'})),8*12);
 if(coffee)return coffee;
 const peer=near(seats.filter(s=>s.assetId!=='lounge-chair').map(s=>({x:s.xIn,z:s.zIn,label:'the facing seat'})),8*12);
 return peer;
}

export function seatFacingErrorDeg(seat:LandscapeObject,target:SeatTarget){
 const front=seatFront(seat.rotationDeg),dx=target.x-seat.xIn,dz=target.z-seat.zIn,len=Math.hypot(dx,dz)||1;
 return Math.acos(Math.min(1,Math.max(-1,front.x*dx/len+front.z*dz/len)))*180/Math.PI;
}

/** Every seating piece in a design, within 30° of its focal target. */
export function furnitureFacingIssues(data:DeckData){
 const issues:string[]=[];
 for(const seat of data.landscapeObjects??[]){
  if(!seat.enabled||!SEATING.has(seat.assetId))continue;
  const target=seatTarget(data,seat);
  if(!target){issues.push(`${seat.name} has no focal seat target.`);continue;}
  const deg=seatFacingErrorDeg(seat,target);
  if(deg>30)issues.push(`${seat.name} faces ${deg.toFixed(0)}° off ${target.label}.`);
 }
 return issues;
}
