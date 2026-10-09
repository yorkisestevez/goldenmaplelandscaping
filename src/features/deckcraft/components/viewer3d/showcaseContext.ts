import type {DeckData} from '../../types';
import {cameraSetback} from './cameraFraming';

/** Neighbourhood dressing around a designed yard. Authored in feet.
 * The viewer draws the yard in inches inside a group scaled 1/12, so the
 * context group is scaled by 12 and these numbers land in world feet.
 * Nothing here is saved, priced or counted. */
export interface LotBounds {x0:number;x1:number;z0:number;z1:number}
export interface CameraClearance {x:number;y:number;z:number;tx:number;ty:number;tz:number;fov:number}
export interface ContextTree {x:number;z:number;heightFt:number;rot:number;conifer:boolean}
export interface NeighbourHome {x:number;z:number;w:number;d:number;h:number;yaw:number;siding:string;roof:string;trim:string;chimney:boolean;garage:boolean;floors:1|2}
export interface GroundVertex {x:number;y:number;z:number;drive:number;fade:number;shade:number}
export interface GroundGrid {name:string;nx:number;nz:number;vertices:GroundVertex[]}
export interface ShowcaseContextModel {bounds:LotBounds;baseY:number;slopePct:number;runs:[number,number,number,number][];trees:ContextTree[];homes:NeighbourHome[];ground:GroundGrid[]}

const SIDING=['#e7e2d8','#d8c4a6','#cbbba6','#c5cdd1','#f3eee6','#c9a27a'];
const ROOFS=['#3c4146','#4a433c','#5c4636','#2e3338'];
const TRIM=['#f4f1ea','#efe6d6','#d9d3c8','#e4e8ea','#f7f4ef','#e6d3bc'];

export function showcaseRandom(seed:number){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}

/** Bounding lot of the deck, beds and yard features, in feet, padded so a fence can sit on the line.
 * The house side (negative Z) stays open: a privacy fence wraps the yard, not the street facade. */
export function showcaseLotBounds(data:DeckData):LotBounds {
 const xs:number[]=[],zs:number[]=[];
 for(const o of data.landscapeObjects??[]){
  if(o.enabled===false)continue;
  if(o.polygon)for(const p of o.polygon){xs.push(p.x/12);zs.push(p.z/12);}
  else{xs.push((o.xIn-o.widthIn/2)/12,(o.xIn+o.widthIn/2)/12);zs.push((o.zIn-o.depthIn/2)/12,(o.zIn+o.depthIn/2)/12);}
 }
 for(const f of data.yardFeatures??[]){
  if(f.enabled===false)continue;
  const a=(f.rotationDeg??0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),corners=f.outline?.length?f.outline.map(p=>[p.x/12,p.y/12] as [number,number]):[[-f.widthFt/2,-f.depthFt/2],[f.widthFt/2,-f.depthFt/2],[f.widthFt/2,f.depthFt/2],[-f.widthFt/2,f.depthFt/2]] as [number,number][];
  for(const [lx,lz] of corners){xs.push(f.xFt+c*lx-s*lz);zs.push(f.zFt+s*lx+c*lz);}
 }
 xs.push(0,data.width??16);zs.push(0,data.length??12);
 const pad=2;
 return {x0:Math.min(...xs)-pad,x1:Math.max(...xs)+pad,z0:Math.min(0,...zs),z1:Math.max(...zs)+pad};
}

/** West, back and east lot lines. The min-Z side is the house and stays open. */
export function fenceRuns(bounds:LotBounds):[number,number,number,number][] {
 const runs:[number,number,number,number][]=[[bounds.x0,bounds.z0,bounds.x0,bounds.z1],[bounds.x0,bounds.z1,bounds.x1,bounds.z1],[bounds.x1,bounds.z1,bounds.x1,bounds.z0]];
 return runs.filter(([ax,az,bx,bz])=>Math.hypot(bx-ax,bz-az)>=2);
}

/** The 3D view's starting camera, in feet. `setback` matches cameraSetback: 1 on a wide
 * desktop, larger as the frame gets narrower. Saved cameras use project inches. */
export function defaultHeroClearance(bounds:LotBounds,setback=1):CameraClearance {
 const cx=(bounds.x0+bounds.x1)/2,cz=(bounds.z0+bounds.z1)/2,r=Math.max(bounds.x1-bounds.x0,bounds.z1-bounds.z0,12),height=4;
 const tx=cx,ty=height*.5,tz=cz,px=cx+r*.9,py=height*.65+r*.4,pz=cz+r*1.3;
 return {x:tx+(px-tx)*setback,y:ty+(py-ty)*setback,z:tz+(pz-tz)*setback,tx,ty,tz,fov:38};
}
export function heroClearances(data:DeckData,bounds:LotBounds):CameraClearance[] {
 const saved=(data.scenePresentation?.cameras??[]).map(c=>({x:c.positionIn[0]/12,y:c.positionIn[1]/12,z:c.positionIn[2]/12,tx:c.targetIn[0]/12,ty:c.targetIn[1]/12,tz:c.targetIn[2]/12,fov:c.fov}));
 // Wide desktop and the narrowest phone layout. A tree that clears both stays out of either lens.
 return [defaultHeroClearance(bounds,1),defaultHeroClearance(bounds,cameraSetback(.5)),...saved];
}

/** A canopy at (x, z) blocks a hero view when it fills the lens or stands in the approach.
 * Backdrop past the subject, and anything behind the camera, is kept. */
export function blocksHeroView(x:number,z:number,radiusFt:number,cameras:CameraClearance[]){
 for(const cam of cameras){
  const dx=cam.tx-cam.x,dz=cam.tz-cam.z,len=Math.hypot(dx,dz);
  if(len<1)continue;
  const dist=Math.hypot(x-cam.x,z-cam.z);
  if(dist<radiusFt+18)return true;
  const along=((x-cam.x)*dx+(z-cam.z)*dz)/len;
  if(along<2||along>len*.92)continue;
  const px=cam.x+dx/len*along,pz=cam.z+dz/len*along,lateral=Math.hypot(x-px,z-pz);
  const corridor=radiusFt+6+along*Math.tan(cam.fov*Math.PI/360)*.72;
  if(lateral<corridor)return true;
 }
 return false;
}

function missesLot(bounds:LotBounds,x:number,z:number,hx:number,hz:number){return x+hx<=bounds.x0||x-hx>=bounds.x1||z+hz<=bounds.z0||z-hz>=bounds.z1;}

/** Slide a blocker sideways out of the hero cone. Walking it away from the lot centre
 * parked the back row in front of the lens; the corner camera sits outside that edge. */
function pushClear(bounds:LotBounds,x:number,z:number,radius:number,cameras:CameraClearance[],hx:number,hz:number){
 const cx=(bounds.x0+bounds.x1)/2,cz=(bounds.z0+bounds.z1)/2;
 let px=x,pz=z;
 for(let n=0;n<12;n++){
  if(missesLot(bounds,px,pz,hx,hz)&&!blocksHeroView(px,pz,radius,cameras))return {x:px,z:pz};
  const blocker=cameras.find(cam=>blocksHeroView(px,pz,radius,[cam]));
  if(!blocker){const ox=px-cx,oz=pz-cz,olen=Math.hypot(ox,oz)||1;px+=ox/olen*8;pz+=oz/olen*8;continue;}
  const dx=blocker.tx-blocker.x,dz=blocker.tz-blocker.z,len=Math.hypot(dx,dz)||1;
  const along=((px-blocker.x)*dx+(pz-blocker.z)*dz)/len,ax=blocker.x+dx/len*along,az=blocker.z+dz/len*along;
  let lx=px-ax,lz=pz-az,llen=Math.hypot(lx,lz);
  if(llen<.5){lx=-dz/len;lz=dx/len;llen=1;}
  px+=lx/llen*14;pz+=lz/llen*14;
 }
 return null;
}

/** Sugar-maple-style broadleaf and white-pine-style evergreen, from the shipped CC0 tree proxies.
 * Heights are mature suburban canopy, not nursery caliper. Placement is seeded and camera-aware. */
export function showcaseTrees(bounds:LotBounds,cameras:CameraClearance[]):ContextTree[] {
 const r=showcaseRandom(42),out:ContextTree[]=[];
 const put=(x:number,z:number)=>{
  if(out.length>=28)return;
  const conifer=r()<.42,heightFt=conifer?32+r()*16:26+r()*14,rot=r()*Math.PI*2,radius=heightFt*(conifer?.32:.5);
  const spot=pushClear(bounds,x,z,radius,cameras,.4,.4);
  if(!spot||out.some(t=>Math.hypot(t.x-spot.x,t.z-spot.z)<16))return;
  out.push({x:spot.x,z:spot.z,heightFt,rot,conifer});
 };
 // Sides frame the yard. The street row is the backdrop beyond the house. Corner
 // trees sit wide of the back fence, never as a wall in front of the corner camera.
 for(let z=bounds.z0-2;z<=bounds.z1+6;z+=16+r()*4){put(bounds.x0-18-r()*4,z);put(bounds.x1+18+r()*4,z+4);}
 for(let x=bounds.x0-10;x<=bounds.x1+10;x+=18+r()*4){put(x,bounds.z0-32-r()*6);if(r()<.55)put(x+7,bounds.z0-48);}
 put(bounds.x0-24,bounds.z1+18);put(bounds.x1+24,bounds.z1+18);
 return out;
}

/** Simple neighbour houses: massing, a gable roof, a door and windows. Not the editable house, and not priced. */
export function showcaseHomes(bounds:LotBounds,cameras:CameraClearance[]):NeighbourHome[] {
 const r=showcaseRandom(3),homes:NeighbourHome[]=[];
 const add=(x:number,z:number,yaw:number)=>{
  const w=28+r()*14,d=22+r()*10,floors:1|2=r()<.72?2:1,h=(floors===2?16:9)+r()*2;
  const spot=pushClear(bounds,x,z,Math.max(w,d)*.5,cameras,w/2+8,d/2+4);
  if(!spot)return;
  const i=homes.length;
  homes.push({x:spot.x,z:spot.z,w,d,h,yaw,siding:SIDING[i%SIDING.length],roof:ROOFS[i%ROOFS.length],trim:TRIM[i%TRIM.length],chimney:r()>.4,garage:r()>.5,floors});
 };
 // Fronts face the lot: street houses look back toward the yard, side houses look inward.
 add(bounds.x0-56,bounds.z0-36,Math.PI);
 add(bounds.x1+56,bounds.z0-34,Math.PI);
 add(bounds.x0-72,(bounds.z0+bounds.z1)/2,-Math.PI/2);
 add(bounds.x1+72,(bounds.z0+bounds.z1)/2+6,Math.PI/2);
 return homes;
}

function yardHeight(baseY:number,slopePct:number,z:number){return baseY+z*slopePct/100;}
function roll(x:number,z:number){return (Math.sin(x*.11)+Math.sin(z*.07+1.7))*.11;}

function grid(name:string,x0:number,z0:number,x1:number,z1:number,nx:number,nz:number,baseY:number,slopePct:number,bounds:LotBounds,driveAt:(x:number,z:number)=>number):GroundGrid {
 const vertices:GroundVertex[]=[];
 const fadeOf=(x:number,z:number)=>{const dx=x<bounds.x0?bounds.x0-x:x>bounds.x1?x-bounds.x1:0,dz=z<bounds.z0?bounds.z0-z:z>bounds.z1?z-bounds.z1:0,out=Math.hypot(dx,dz);return Math.min(1,Math.max(0,(out-16)/42));};
 for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++){
  const x=x0+(x1-x0)*ix/nx,z=z0+(z1-z0)*iz/nz,drive=driveAt(x,z);
  vertices.push({x,y:yardHeight(baseY,slopePct,z)+.06+roll(x,z)*(1-drive),z,drive,fade:drive?Math.min(.35,fadeOf(x,z)):fadeOf(x,z),shade:showcaseRandom((Math.round(x*10)+Math.round(z*17)+nx*nz)>>>0)()});
 }
 return {name,nx,nz,vertices};
}

/** Neighbouring yards and driveways outside the fence. The existing far lawn continues past these
 * grids and, with the horizon band, fades into the photographed sky. */
export function showcaseGround(bounds:LotBounds,elevationIn:number,slopePct:number):GroundGrid[] {
 const baseY=(elevationIn-.7)/12;
 const none=()=>0;
 const drives=(x:number,z:number)=>[bounds.x0-44,bounds.x1+44].some(cx=>Math.abs(x-cx)<5.2&&z<bounds.z0-2&&z>bounds.z0-40)?1:0;
 return [
  grid('west-yard',bounds.x0-56,bounds.z0,bounds.x0-.15,bounds.z1+34,8,10,baseY,slopePct,bounds,none),
  grid('east-yard',bounds.x1+.15,bounds.z0,bounds.x1+56,bounds.z1+34,8,10,baseY,slopePct,bounds,none),
  grid('back-yard',bounds.x0,bounds.z1+.15,bounds.x1,bounds.z1+52,10,8,baseY,slopePct,bounds,none),
  grid('street-yard',bounds.x0-62,bounds.z0-44,bounds.x1+62,bounds.z0-.2,14,6,baseY,slopePct,bounds,drives),
 ];
}

export function buildShowcaseContext(data:DeckData):ShowcaseContextModel {
 const bounds=showcaseLotBounds(data),terrain=data.terrainConfig??{elevationIn:0,slopePct:0},cameras=heroClearances(data,bounds);
 return {bounds,baseY:(terrain.elevationIn-.7)/12,slopePct:terrain.slopePct,runs:fenceRuns(bounds),trees:showcaseTrees(bounds,cameras),homes:showcaseHomes(bounds,cameras),ground:showcaseGround(bounds,terrain.elevationIn,terrain.slopePct)};
}

/** Local GLBs already shipped with the designer. Lod 0 is the still-export model; lod 1 is the lighter context model. */
export const SHOWCASE_TREES={
 deciduous:['/deckcraft/landscape/deciduous-tree-lod0.glb','/deckcraft/landscape/deciduous-tree-lod1.glb'],
 conifer:['/deckcraft/landscape/conifer-tree-lod0.glb','/deckcraft/landscape/conifer-tree-lod1.glb'],
} as const;
