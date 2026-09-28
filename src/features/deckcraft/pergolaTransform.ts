import type {PergolaSelection} from './pergolaCatalog';
export const pergolaAngle=(degrees:number)=>{const n=((degrees+180)%360+360)%360-180;return Math.round(n*100)/100;};
export function movedPergola(s:PergolaSelection,dx:number,dz:number){
 const bound=(n:number)=>Math.max(-200,Math.min(200,Math.round(n*4)/4));
 return {xFt:bound(s.xFt+dx),zFt:bound(s.zFt+dz)};
}
export function rotatedPergola(s:PergolaSelection,degrees:number){return {rotationDeg:pergolaAngle(s.rotationDeg+degrees)};}
export function draggedPergola(s:PergolaSelection,start:{x:number;z:number},now:{x:number;z:number},mode:'move'|'rotate'){
 if(mode==='move')return movedPergola(s,now.x-start.x,now.z-start.z);
 if(Math.hypot(start.x-s.xFt,start.z-s.zFt)<.25||Math.hypot(now.x-s.xFt,now.z-s.zFt)<.25)return {rotationDeg:s.rotationDeg};
 const delta=(Math.atan2(now.z-s.zFt,now.x-s.xFt)-Math.atan2(start.z-s.zFt,start.x-s.xFt))*180/Math.PI;
 return rotatedPergola(s,Math.round(delta/5)*5);
}
