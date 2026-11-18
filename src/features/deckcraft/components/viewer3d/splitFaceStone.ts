import * as THREE from 'three';
import {yardSignedArea,type YardBox,type YardModel} from '../../yardModel';
import {GUILLOTINED_WALL} from '../../wallStones';
import type {PlanPoint} from '../../lib/deckGeometry';
import {addMaterialPatch} from './materialPatches';

/**
 * Guillotined armour stone as it comes off the splitter (Simcoe County supplier photos, 2026-10-20): a flat top and bed
 * that meet the face at a crisp edge broken by the odd chip, a face split into broad planes with level bedding steps
 * between them, each stone set a little back or leaning its own way, ends that open into dark V-joints, and each stone
 * its own shade of the limestone. Render only, and the model's quantities stay exact: a stone is carved inward from its
 * laid footprint and course, never more than part way across, except that behind the face its ends reach the middle of
 * the laid joint to meet the next stone's, as real stones touch, so no joint shows daylight through the wall. The look is
 * seeded by the stone (its unitId) and measured from its own corner, so the same stone always looks the same and moving
 * the wall changes nothing. A stone laid in pieces (an arc's facets) breaks as one: the noise is continuous across them,
 * and the faces where its pieces meet stay where they are.
 */
const SPACING_IN=2.6,COARSE_SPACING_IN=4.5,JOINT_SPACING_IN=2,SEAM_IN=.05,SEAM_TAPER_IN=3,END_FULL_IN=.5,END_CLOSED_IN=1.5,CREASE=.8;
/** How far out from a split stone's surface its shadows are looked up, in scene units (feet): about an inch. */
const SHADOW_LIFT_FT=.1;
/** Half the laid joint between stones (wallStoneCourses STONE_JOINT_IN, 3/8 in; the check holds the two together). */
const ENDS_MEET_IN=3/16;
/** A neighbouring stone this close counts as across a joint (a little more than the laid 3/8 in, for the wedges on an arc). */
const JOINT_REACH_IN=.6;
/** Heights above the bed and below the top that carry a ring of points, so a chip's break shows (inches). */
const EDGE_LEVELS_IN=[0,.3,.9,1.8],COARSE_EDGE_LEVELS_IN=[0,.9,1.8];
/** A split plane is about this long along the stone and this tall; bedding keeps the steps between them mostly level. */
const PLANE_LENGTH_IN=14,PLANE_HEIGHT_IN=4.5,PLANE_DEPTH_IN=1.5;

/** The guillotined walls in a model, whose stones Yard3D draws split. */
export const splitFaceFeatures=(model:Pick<YardModel,'features'>)=>new Set(model.features.filter(f=>f.config.productId===GUILLOTINED_WALL).map(f=>f.config.id));
/** The split stones' material: the scanned rock detail at a quarter of its contrast, so the relief comes from the stone's
 * shape and the light, not dark grime. Shadows are cast from the stones' back faces (they are closed solids) and looked up
 * a little way out from the surface, so the broken face's own small self-shadows don't fall half in and half out of the
 * soft-shadow samples, which shows as a screen-door pattern. Shadows from the deck, the house and the courses above still
 * fall on the wall. */
export function splitStoneMaterial(material:THREE.MeshStandardMaterial){
 material.shadowSide=THREE.BackSide;
 addMaterialPatch(material,{key:'split-stone-shadow-v1',apply:shader=>{
  const chunk=THREE.ShaderChunk.shadowmap_vertex,lifts=['directionalLightShadows[ i ].shadowNormalBias','pointLightShadows[ i ].shadowNormalBias','spotLightShadows[ i ].shadowNormalBias'];
  if(!lifts.every(bias=>chunk.includes(bias)))throw Error('Split stone: Three shadow vertex shader changed.');
  shader.vertexShader=shader.vertexShader.replace('#include <shadowmap_vertex>',lifts.reduce((code,bias)=>code.split(bias).join(`( ${bias} + ${SHADOW_LIFT_FT} )`),chunk));
 }});
 addMaterialPatch(material,{key:'split-stone-detail-v1',apply:shader=>{
  if(!THREE.ShaderChunk.map_fragment.includes('vec4 sampledDiffuseColor'))throw Error('Split stone: Three map shader changed.');
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n#ifdef USE_MAP\n diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.5 ) / max( sampledDiffuseColor.rgb, vec3( 0.02 ) ), 0.75 );\n#endif');
 }});
 return material;
}

const hash=(text:string)=>{let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const lattice=(seed:number,i:number,j:number,k:number)=>{let h=Math.imul(seed^Math.imul(i,374761393)^Math.imul(j,668265263)^Math.imul(k,2147483647),1274126177);h^=h>>>15;h=Math.imul(h,2246822519);h^=h>>>13;return (h>>>0)/4294967296;};
/** Value noise in [0,1) with straight blends. */
const blend=(seed:number,x:number,y:number,z:number)=>{const i=Math.floor(x),j=Math.floor(y),k=Math.floor(z),fx=x-i,fy=y-j,fz=z-k;let n=0;for(let c=0;c<8;c++){const dx=c&1,dy=c>>1&1,dz=c>>2;n+=lattice(seed,i+dx,j+dy,k+dz)*(dx?fx:1-fx)*(dy?fy:1-fy)*(dz?fz:1-fz);}return n;};
/** The split plane a point on the face falls in (Voronoi cells in inches along the stone and up it): how far that plane sits
 * back (mostly flush), tilted its own way, and its own slight shade. Near a cell's edge it ramps into the next plane over
 * an inch or two, a step a sun shadow can sit in without jagged black edges. */
function plane(seed:number,along:number,up:number){
 const u=along/PLANE_LENGTH_IN,v=up/PLANE_HEIGHT_IN,i0=Math.floor(u),j0=Math.floor(v),cells:{d:number;depth:number;tone:number}[]=[];
 for(let i=i0-1;i<=i0+1;i++)for(let j=j0-1;j<=j0+1;j++){const fu=i+lattice(seed,i,j,1),fv=j+lattice(seed,i,j,2);
  cells.push({d:Math.hypot(u-fu,v-fv),depth:Math.min(PLANE_DEPTH_IN,Math.max(0,PLANE_DEPTH_IN*lattice(seed,i,j,3)**2+.2*(lattice(seed,i,j,4)-.5)*(u-fu)*PLANE_LENGTH_IN+.2*(lattice(seed,i,j,5)-.5)*(v-fv)*PLANE_HEIGHT_IN)),tone:1+.12*(lattice(seed,i,j,6)-.5)});}
 cells.sort((p,q)=>p.d-q.d);const [a,b]=cells,t=Math.min(1,(b.d-a.d)/.25),w=.5+.5*t*t*(3-2*t);
 return {depth:a.depth*w+b.depth*(1-w),tone:a.tone*w+b.tone*(1-w)};
}
/** An outline without repeated points or zero-width slits (a polygon union can leave both), from a fixed corner. */
function clean(ring:PlanPoint[]){
 const r=ring.slice();
 // Removing one point can make a new slit where it was, so sweep until nothing changes.
 for(let changed=true;changed&&r.length>=3;){changed=false;for(let i=0;r.length>=3&&i<r.length;){const a=r[(i+r.length-1)%r.length],p=r[i],c=r[(i+1)%r.length],ux=p.x-a.x,uy=p.y-a.y,vx=c.x-p.x,vy=c.y-p.y,lu=Math.hypot(ux,uy),lv=Math.hypot(vx,vy);
  if(lu<1e-4||lv<1e-4||(Math.abs(ux*vy-uy*vx)<.03*lu*lv&&ux*vx+uy*vy<0)){r.splice(i,1);changed=true;}else i++;}}
 // Start from the lowest-x (then lowest-y) corner, which moving the wall doesn't change.
 const first=r.reduce((best,p,i)=>p.x<r[best].x-1e-3||(Math.abs(p.x-r[best].x)<=1e-3&&p.y<r[best].y)?i:best,0);
 return [...r.slice(first),...r.slice(0,first)];
}
const segmentDistance=(a:PlanPoint,c:PlanPoint,x:number,y:number)=>{const dx=c.x-a.x,dy=c.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(a.x+t*dx-x,a.y+t*dy-y);};
const distanceToRing=(ring:PlanPoint[],x:number,y:number)=>Math.min(...ring.map((a,i)=>segmentDistance(a,ring[(i+1)%ring.length],x,y)));
const contains=(ring:PlanPoint[],x:number,y:number)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],c=ring[j];if((a.y>y)!==(c.y>y)&&x<(c.x-a.x)*(y-a.y)/(c.y-a.y)+a.x)hit=!hit;}return hit;};
/** How far a point on the outline can travel along a direction (a unit vector) before it meets the outline again: none
 * if the first step already leaves the stone. The edges the point lies on don't stop it. */
function inside(ring:PlanPoint[],x:number,y:number,dx:number,dy:number){
 if(!contains(ring,x+dx*.01,y+dy*.01))return 0;
 let best=Infinity;
 for(let i=0;i<ring.length;i++){const a=ring[i],c=ring[(i+1)%ring.length],ex=c.x-a.x,ey=c.y-a.y,den=dx*ey-dy*ex;if(Math.abs(den)<1e-12||segmentDistance(a,c,x,y)<1e-7)continue;const t=((a.x-x)*ey-(a.y-y)*ex)/den,u=((a.x-x)*dy-(a.y-y)*dx)/den;if(t>0&&u>=-1e-9&&u<=1+1e-9)best=Math.min(best,t);}
 return best;
}
/** A stone laid on an arc is still a straight stone, in one piece. The hull of its laid pieces gets one straight face per long
 * side: the chord where the stone bows out, and where it bows in a line moved in to the deepest point of the bow, so it
 * stays inside the stone laid and a curved wall facets like a real one. A stone that isn't four-sided that way (a corner
 * wedge) keeps its laid pieces. */
export function straightStone(pieces:PlanPoint[][]):PlanPoint[][]{
 // (A hair-thin offcut a clip left beside the stone doesn't widen its hull.)
 const offcut=(r:PlanPoint[])=>{const area=yardSignedArea(r);return area<3&&area<.15*r.reduce((n,p,i)=>n+Math.hypot(r[(i+1)%r.length].x-p.x,r[(i+1)%r.length].y-p.y),0);},body=pieces.filter(r=>!offcut(r)),pts=(body.length?body:pieces).flat();if(pts.length<4)return pieces;
 const cross=(o:PlanPoint,a:PlanPoint,b:PlanPoint)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x),sorted=[...pts].sort((a,b)=>a.x-b.x||a.y-b.y);
 const chain=(list:PlanPoint[])=>{const h:PlanPoint[]=[];for(const p of list){while(h.length>=2&&cross(h[h.length-2],h[h.length-1],p)<=1e-9)h.pop();h.push(p);}return h.slice(0,-1);};
 const hull=[...chain(sorted),...chain([...sorted].reverse())],n=hull.length;if(n<4)return pieces;
 // The run: the long axis of the hull, weighting each edge by its length. Its long sides are the faces; the rest, the ends.
 const mids=hull.map((p,i)=>{const q=hull[(i+1)%n];return {x:(p.x+q.x)/2,y:(p.y+q.y)/2,w:Math.hypot(q.x-p.x,q.y-p.y)};}),total=mids.reduce((s,m)=>s+m.w,0),cx=mids.reduce((s,m)=>s+m.x*m.w,0)/total,cy=mids.reduce((s,m)=>s+m.y*m.w,0)/total;
 const run=.5*Math.atan2(2*mids.reduce((s,m)=>s+m.w*(m.x-cx)*(m.y-cy),0),mids.reduce((s,m)=>s+m.w*((m.x-cx)**2-(m.y-cy)**2),0)),ax=Math.cos(run),ay=Math.sin(run);
 const face=hull.map((p,i)=>{const q=hull[(i+1)%n];return Math.abs((p.y-q.y)*ax+(q.x-p.x)*ay)<.7*Math.hypot(q.x-p.x,q.y-p.y);}),first=face.findIndex((f,i)=>f&&!face[(i+n-1)%n]);
 if(first<0)return pieces;
 const sides:PlanPoint[][]=[];for(let k=0;k<n;){const e=(first+k)%n,kind=face[e];let count=0;while(count<n-k&&face[(e+count)%n]===kind)count++;sides.push([hull[e],hull[(e+count)%n]]);k+=count;}
 if(sides.length!==4)return pieces;
 const inStone=(x:number,y:number)=>pieces.some(r=>contains(r,x,y)||distanceToRing(r,x,y)<1e-4);
 // How far in from a point outside the stone the stone begins, along a direction (a unit vector).
 const entry=(x:number,y:number,dx:number,dy:number)=>{if(inStone(x,y))return 0;let best=Infinity;for(const r of pieces)for(let i=0;i<r.length;i++){const a=r[i],c=r[(i+1)%r.length],ex=c.x-a.x,ey=c.y-a.y,den=dx*ey-dy*ex;if(Math.abs(den)<1e-12)continue;const t=((a.x-x)*ey-(a.y-y)*ex)/den,u=((a.x-x)*dy-(a.y-y)*dx)/den;if(t>0&&u>=-1e-9&&u<=1+1e-9)best=Math.min(best,t);}return best;};
 // Each face's line: its chord, moved in (to the left of the counter-clockwise hull) past the deepest point it bows in.
 const lines=sides.map(([p,q],i)=>{const dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;if(i%2)return {x:p.x,y:p.y,dx,dy};const bow=Math.max(...Array.from({length:15},(_,j)=>entry(p.x+dx*(j+1)/16,p.y+dy*(j+1)/16,nx,ny)));return {x:p.x+nx*(bow&&bow+.01),y:p.y+ny*(bow&&bow+.01),dx,dy};});
 const meet=(a:typeof lines[number],b:typeof lines[number])=>{const den=a.dx*b.dy-a.dy*b.dx;if(Math.abs(den)<1e-12)return null;const s=((b.x-a.x)*b.dy-(b.y-a.y)*b.dx)/den;return {x:a.x+a.dx*s,y:a.y+a.dy*s};};
 const quad=[meet(lines[0],lines[3]),meet(lines[0],lines[1]),meet(lines[2],lines[1]),meet(lines[2],lines[3])];
 if(quad.some(p=>!p||!Number.isFinite(p.x+p.y)))return pieces;
 const straight=quad as PlanPoint[],area=yardSignedArea(straight),laid=pieces.reduce((s,r)=>s+yardSignedArea(r),0);
 // It must sit inside the stone laid (corners, and points along each side) and keep most of it.
 const inside=straight.every((p,i)=>{const q=straight[(i+1)%4];return [0,.25,.5,.75].every(t=>inStone(p.x+(q.x-p.x)*t,p.y+(q.y-p.y)*t));});
 return inside&&area>=.8*laid&&area<=laid+1e-6?[clean(straight)]:pieces;
}

/** How far a stone's top or bed edge breaks back, in inches on a full-size stone, from two noise values in [0,1): a small
 * straight break of 0.2-0.45 in, and where the chip noise runs high a chip up to 1.6 in deeper, broken out at an angle. */
export const edgeBreak=(chip:number,base:number)=>.2+.25*base+(chip>.72?(chip-.72)/.28*1.6:0);
/** The outlines a stone is drawn from: its laid pieces, cleaned, and drawn straight in one piece where it was laid on an arc. */
export function stoneOutlines(b:YardBox){
 return straightStone((b.renderContours??(b.polygon?[b.polygon]:[])).map(clean).filter(r=>r.length>=3&&yardSignedArea(r)>1e-6));
}
/** A stone the model laid as several pieces (one per path segment, where a wall top step or an added point splits a run in
 * line) as one stone: the first piece, carrying every piece's outline. */
export function mergeStonePieces(stones:YardBox[]){
 const pieces=new Map<string,YardBox[]>();for(const b of stones)if(b.unitId&&!b.renderDuplicate)pieces.set(b.unitId,[...pieces.get(b.unitId)??[],b]);
 return stones.flatMap(b=>{const group=b.unitId&&!b.renderDuplicate?pieces.get(b.unitId)!:[b];if(group.length<2)return [b];return group[0]===b?[{...b,renderContours:group.flatMap(p=>p.renderContours??(p.polygon?[p.polygon]:[]))}]:[];});
}
/** Whether the 3D view draws a laid piece as split stone: a body stone of a guillotined wall. */
export const drawnSplit=(b:YardBox,walls:ReadonlySet<string>)=>b.role==='wall-block'&&walls.has(b.featureId);
/** For each stone, the laid outlines of the stones beside it (of its own wall or another that meets it, overlapping it in
 * height, across a joint), whose ends its own ends meet. A stone with none on a side ends there in open air. */
export function stoneNeighbours(stones:YardBox[]){
 const laid=stones.filter(b=>!b.renderDuplicate).map(b=>{const rings=b.renderContours??(b.polygon?[b.polygon]:[]),xs=rings.flat().map(p=>p.x),zs=rings.flat().map(p=>p.y);return {b,rings,x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs)};});
 return new Map(laid.map(a=>[a.b,laid.filter(o=>o!==a&&(!a.b.unitId||o.b.unitId!==a.b.unitId)&&Math.min(a.b.y+a.b.h/2,o.b.y+o.b.h/2)-Math.max(a.b.y-a.b.h/2,o.b.y-o.b.h/2)>1&&o.x0<=a.x1+JOINT_REACH_IN&&o.x1>=a.x0-JOINT_REACH_IN&&o.z0<=a.z1+JOINT_REACH_IN&&o.z1>=a.z0-JOINT_REACH_IN).flatMap(o=>o.rings)]));
}
/** One guillotined stone, indexed, with its own vertex colours (multipliers of the swatch). `coarse` below the high render
 * tier: a 240 ft wall 6 ft tall is about 450k triangles in full and 190k coarse. `neighbours`: the laid outlines of the
 * stones beside it in its course (stoneNeighbours). */
export function splitFaceStoneGeometry(b:YardBox,coarse=false,neighbours:PlanPoint[][]=[]){
 const seed=hash(b.unitId??b.id),lo=b.y-b.h/2,h=b.h,top=lo+h,position:number[]=[],color:number[]=[],wrap:number[]=[],index:number[]=[],tones:number[]=[];
 const outlines=stoneOutlines(b);
 const corner={x:Math.min(...outlines.flat().map(p=>p.x)),y:Math.min(...outlines.flat().map(p=>p.y))};
 const noise=(salt:number,x:number,y:number,z:number,size:number,height=size)=>blend(seed^salt,(x-corner.x)/size,(y-lo)/height,(z-corner.y)/size);
 // The stone's own shade: lighter or darker, warmer (buff) or cooler (blue-grey), about one in six bleached pale and
 // bluer; on the whole cooler than the swatch, as fresh-split limestone is in daylight, with the odd buff stone.
 const outlier=lattice(seed,3,0,0)<1/6,shade=.9+.2*lattice(seed,1,0,0)+(outlier?.06:0),warmth=(lattice(seed,2,0,0)-.5)*.16-(outlier?.09:.05);
 const push=(x:number,y:number,z:number,tone:number,joint:number,around:[number,number])=>{position.push(x,y,z);wrap.push(...around);tones.push(tone);color.push(shade*tone*joint*(1+warmth),shade*tone*joint,shade*tone*joint*(1-warmth));return position.length/3-1;};
 // A small cut piece gets a gentler version of the same break (its size: area over outside edge, not the seams between its pieces).
 const area=outlines.reduce((n,r)=>n+yardSignedArea(r),0),perimeter=outlines.reduce((n,r)=>n+r.reduce((m,p,i)=>{const q=r[(i+1)%r.length];return outlines.some(o=>o!==r&&distanceToRing(o,(p.x+q.x)/2,(p.y+q.y)/2)<SEAM_IN)?m:m+Math.hypot(q.x-p.x,q.y-p.y);},0),0);
 const scale=Math.min(1,Math.max(.25,area/perimeter/4)),band=Math.min(.3*h,(coarse?COARSE_EDGE_LEVELS_IN:EDGE_LEVELS_IN).at(-1)!);
 // The edge: a crisp arris with a small straight break, and along the top now and then a chip broken out of it at an angle
 // (the bed's edge, mostly hidden in the joint, only the straight break).
 const arris=(x:number,z:number,top:boolean)=>Math.min(band/1.25,scale*edgeBreak(top?noise(0x9e26,x,0,z,9):0,noise(top?0x11:0x22,x,0,z,4)));
 // Each stone set a little back and leaning in or out its own way (inward only, so it stays on its laid stone).
 const setback=1.4*lattice(seed,4,0,0)**2*scale,lean=(lattice(seed,5,0,0)-.5)*.08;
 // Rings of points: close together near the top and bed, where the edge breaks, and every few inches between.
 const near=(coarse?COARSE_EDGE_LEVELS_IN:EDGE_LEVELS_IN).filter(e=>e<band+1e-9),rims=[...near.map(e=>lo+e),...near.map(e=>top-e).reverse()],levels:number[]=[];
 rims.forEach((y,i)=>{const next=rims[i+1];levels.push(y);if(next===undefined)return;const extra=Math.ceil((next-y)/(coarse?6:3.6))-1;for(let k=1;k<=extra;k++)levels.push(y+(next-y)*k/(extra+1));});
 // Points every few inches round each outline (closer along a joint, where the ends close up), each with the way it moves
 // in: the inward normal (left of a counter-clockwise outline), or at a corner its bisector, far enough to keep the same
 // inset from both faces. An edge is a joint where a neighbouring stone's end lies across it; a corner is on a joint only
 // between two joint edges, so where an end meets the face it breaks like the face; and a point only where a neighbour
 // lies across it.
 const loops=outlines.map(ring=>{
  const n=ring.length,others=outlines.filter(r=>r!==ring),edges=ring.map((p,i)=>{const q=ring[(i+1)%n],len=Math.hypot(q.x-p.x,q.y-p.y),cx=(p.x+q.x)/2,cy=(p.y+q.y)/2;return {len,nx:-(q.y-p.y)/len,ny:(q.x-p.x)/len,tx:(q.x-p.x)/len,ty:(q.y-p.y)/len,joint:neighbours.some(o=>distanceToRing(o,cx,cy)<JOINT_REACH_IN)};});
  // Near a convex corner a point may go in no further than keeps it on its own side of the corner's bisector (its distance
  // from the corner along the outline times the tangent of half the corner), so the faces either side never cross. Points
  // in line with an edge (a facet split) don't hide the corner beyond them.
  const corners:{s:number;safe:number}[]=[];edges.reduce((at,e,i)=>{const u=edges[(i+n-1)%n],turn=Math.atan2(u.tx*e.ty-u.ty*e.tx,u.tx*e.tx+u.ty*e.ty);if(turn>.15)corners.push({s:at,safe:.9/Math.tan(turn/2)});return at+e.len;},0);
  const pts:{x:number;y:number;s:number;mx:number;my:number;tx:number;ty:number;joint:boolean;seam:boolean;room:number;ease:number;meet:number}[]=[];let s=0;
  const beside=(x:number,y:number)=>neighbours.some(o=>distanceToRing(o,x,y)<JOINT_REACH_IN);
  for(let i=0;i<n;i++){
   const p=ring[i],q=ring[(i+1)%n],{len,nx,ny,tx,ty,joint}=edges[i],prev=edges[(i+n-1)%n],bx=prev.nx+nx,by=prev.ny+ny,bl=Math.hypot(bx,by)||1,cos=Math.max(.4,(bx*nx+by*ny)/bl),steps=Math.max(1,Math.ceil(len/(joint?JOINT_SPACING_IN:coarse?COARSE_SPACING_IN:SPACING_IN)));
   for(let k=0;k<steps;k++){const x=p.x+(q.x-p.x)*k/steps,y=p.y+(q.y-p.y)*k/steps,[mx,my]=k?[nx,ny]:[bx/bl/cos,by/bl/cos],reach=Math.hypot(mx,my);
    // A point where another piece of the stone continues stays put; elsewhere it may go less than half way across.
    pts.push({x,y,s:s+len*k/steps,mx,my,tx,ty,joint:joint&&(k>0||prev.joint)&&beside(x,y),seam:others.some(r=>distanceToRing(r,x,y)<SEAM_IN),room:.45*inside(ring,x,y,mx/reach,my/reach)/reach,ease:1,meet:0});}
   s+=len;
  }
  pts.forEach(p=>{for(const c of corners){const d=Math.abs(p.s-c.s),along=Math.min(d,s-d);if(along>1e-6)p.room=Math.min(p.room,along*c.safe);}});
  // A corner moves along its bisector, which at a sharp corner is a long way: never past its neighbours on the ring.
  pts.forEach((p,i)=>{const a=pts[(i+pts.length-1)%pts.length],c=pts[(i+1)%pts.length],reach=Math.hypot(p.mx,p.my);if(reach>1.0001)p.room=Math.min(p.room,.8*Math.min(Math.hypot(a.x-p.x,a.y-p.y),Math.hypot(c.x-p.x,c.y-p.y))/reach);});
  return {pts,length:s};
 });
 // Along a joint the break eases off behind the face, so the joint opens into a V at the face and closes up behind it,
 // where the ends reach the middle of the joint and meet. Toward a seam between its pieces the break eases off the same
 // way on both, so the face runs on unbroken.
 const smooth=(t:number)=>t<=0?0:t>=1?1:t*t*(3-2*t),gap=(at:number,stations:number[],length:number)=>Math.min(...stations.map(t=>{const d=Math.abs(at-t);return Math.min(d,length-d);}));
 for(const {pts,length} of loops){
  const faces=pts.filter(p=>!p.joint).map(p=>p.s),seams=pts.filter(p=>p.seam).map(p=>p.s);
  // A short joint (a wedge's) closes over its own length rather than the usual few inches.
  pts.forEach(p=>{const seam=seams.length?smooth(gap(p.s,seams,length)/SEAM_TAPER_IN):1,ahead=Math.min(...faces.map(t=>((t-p.s)%length+length)%length)),behind=Math.min(...faces.map(t=>((p.s-t)%length+length)%length)),run=ahead+behind,full=Math.min(END_FULL_IN,.15*run),closed=Math.min(END_CLOSED_IN,.45*run),deep=p.joint&&faces.length?smooth((Math.min(ahead,behind)-full)/(closed-full)):0;p.ease=seam*(1-deep);p.meet=seam*deep*ENDS_MEET_IN;});
  const rows=levels.map(y=>pts.map(p=>{
   const e=Math.min(y-lo,top-y),r=arris(p.x,p.y,y-lo>=top-y),split=plane(seed,(p.x-corner.x)*p.tx+(p.y-corner.y)*p.ty,y-lo);
   const f=scale*(split.depth+.2*noise(0xb2,p.x,y,p.y,2.7,2.3))*(.4+.6*smooth((y-lo)/1.5))+setback+(lean>0?lean*(y-lo):-lean*(top-y)),d=Math.min(p.room,p.ease*(f+(e<1.25*r?r-.8*e:0))),out=1/Math.hypot(p.mx,p.my);
   // (The split face settles toward the bed, so a stone's underside, where it oversails the one below, runs straight.)
   // Each split plane its own slight shade, recesses a little darker, the limestone mottled, darker toward its bed, and
   // shaded where it sits on or under the next course.
   return push(p.x+p.mx*d-p.mx*out*p.meet,y,p.y+p.my*d-p.my*out*p.meet,split.tone*(1+.07*(.5-split.depth/PLANE_DEPTH_IN))*(1+.08*(noise(0xd4,p.x,y,p.y,9)-.5))*(.9+.16*(y-lo)/h),1-.14*Math.max(0,1-e),[p.s,length]);}));
  for(let j=0;j+1<rows.length;j++)for(let i=0;i<pts.length;i++){const k=(i+1)%pts.length,a=rows[j][i],c=rows[j][k],d=rows[j+1][k],e=rows[j+1][i];index.push(a,d,c,a,e,d);}
  // The top and bed, flat as split, inside the broken edge; the top weathered lighter. Counter-clockwise in plan faces down
  // (plan y is world z), so the top's triangles are turned over.
  for(const [row,up,tone] of [[rows.at(-1)!,true,1.06],[rows[0],false,.85]] as const){
   const ids=row.map(i=>push(position[i*3],position[i*3+1],position[i*3+2],tones[i]*tone,1,[0,0]));
   for(const [a,c,d] of THREE.ShapeUtils.triangulateShape(ids.map(i=>new THREE.Vector2(position[i*3],position[i*3+2])),[])){const [p,q,r]=[ids[a],ids[c],ids[d]],cross=(position[q*3]-position[p*3])*(position[r*3+2]-position[p*3+2])-(position[q*3+2]-position[p*3+2])*(position[r*3]-position[p*3]);index.push(...((cross>0)===up?[p,r,q]:[p,q,r]));}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(position,3));g.setAttribute('color',new THREE.Float32BufferAttribute(color,3));g.setAttribute('wrap',new THREE.Float32BufferAttribute(wrap,2));g.setIndex(index);g.computeVertexNormals();
 return g;
}
/** Normals smoothed only between faces within CREASE of each other, so arrises, corners and steps break hard while a split
 * plane shades smooth. The stone comes back unindexed. */
function creased(g:THREE.BufferGeometry){
 const flat=g.toNonIndexed(),p=flat.getAttribute('position'),n=p.count,area=new Float64Array(n),unit=new Float64Array(n),groups=new Map<string,number[]>(),normals=new Float32Array(n*3),limit=Math.cos(CREASE);
 for(let t=0;t<n;t+=3){const ux=p.getX(t+1)-p.getX(t),uy=p.getY(t+1)-p.getY(t),uz=p.getZ(t+1)-p.getZ(t),vx=p.getX(t+2)-p.getX(t),vy=p.getY(t+2)-p.getY(t),vz=p.getZ(t+2)-p.getZ(t),cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx,l=Math.hypot(cx,cy,cz)||1;area.set([cx,cy,cz],t);unit.set([cx/l,cy/l,cz/l],t);}
 for(let v=0;v<n;v++){const key=`${Math.round(p.getX(v)*100)},${Math.round(p.getY(v)*100)},${Math.round(p.getZ(v)*100)}`,list=groups.get(key);if(list)list.push(v);else groups.set(key,[v]);}
 for(const list of groups.values())for(const v of list){const f=v-v%3;let sx=0,sy=0,sz=0;for(const w of list){const o=w-w%3;if(unit[f]*unit[o]+unit[f+1]*unit[o+1]+unit[f+2]*unit[o+2]>=limit){sx+=area[o];sy+=area[o+1];sz+=area[o+2];}}const l=Math.hypot(sx,sy,sz)||1;normals.set([sx/l,sy/l,sz/l],v*3);}
 flat.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.dispose();
 return flat;
}
/** The stones a batch drew in its last two builds, by what each is (seed, outline, course, neighbours, tier): a re-render,
 * or a re-priced design that lays the same stones, reuses them, and the batch's own cache goes with it. */
export type StoneCache={now:Map<string,THREE.BufferGeometry>;before:Map<string,THREE.BufferGeometry>};
export const stoneCache=():StoneCache=>({now:new Map(),before:new Map()});
/** Starts a batch's next build: what the last one drew stays to hand, anything older goes. */
export function nextStoneCacheRound(cache:StoneCache){cache.before=cache.now;cache.now=new Map();}
const outlineKey=(rings:PlanPoint[][])=>rings.map(r=>r.map(p=>`${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ')).join('/');
/** A stone as the 3D view draws it (unindexed, creased), from the batch's cache when it drew the same stone last time,
 * handed out as a fresh geometry over the same data, so the caller may add or drop attributes. */
export function splitFaceStoneMesh(b:YardBox,coarse:boolean,neighbours:PlanPoint[][],cache:StoneCache){
 const key=[coarse?1:0,b.unitId??b.id,b.y.toFixed(3),b.h.toFixed(3),outlineKey(b.renderContours??(b.polygon?[b.polygon]:[])),outlineKey(neighbours)].join('|');
 const g=cache.now.get(key)??cache.before.get(key)??creased(splitFaceStoneGeometry(b,coarse,neighbours));cache.now.set(key,g);
 const view=new THREE.BufferGeometry();for(const [name,attribute] of Object.entries(g.attributes))view.setAttribute(name,attribute);
 return view;
}
/** Texture coordinates for a split stone (non-indexed), in repeats of `repeatIn` from the stone's own corner, shifted and
 * perhaps mirrored per stone. The sides wrap round the stone by station along its outline, so the steps between split
 * planes don't smear the texture and it doesn't tear at an arris (it meets itself once, at the outline's first corner);
 * the scan is turned a quarter, so its cracks run level, along the bedding. The top and bed take it in plan. The wrap is
 * then dropped. */
export function splitFaceUvs(g:THREE.BufferGeometry,repeatIn:number,{shiftU,shiftV,mirror}:{shiftU:number;shiftV:number;mirror:boolean}){
 const p=g.getAttribute('position'),around=g.getAttribute('wrap'),uv=new Float32Array(p.count*2);let ox=Infinity,oy=Infinity,oz=Infinity;
 for(let v=0;v<p.count;v++){ox=Math.min(ox,p.getX(v));oy=Math.min(oy,p.getY(v));oz=Math.min(oz,p.getZ(v));}
 for(let t=0;t<p.count;t+=3){
  const length=around.getY(t),stations=[0,1,2].map(k=>around.getX(t+k)),high=Math.max(...stations);
  // The one triangle that closes the outline runs from its end back to its start: count its start from the end.
  for(let k=0;k<3;k++){const x=p.getX(t+k)-ox,y=p.getY(t+k)-oy,z=p.getZ(t+k)-oz,station=stations[k]<high-length/2?stations[k]+length:stations[k],u=length?y:x,v=length?station:z;uv[(t+k)*2]=(mirror?-u:u)/repeatIn+shiftU;uv[(t+k)*2+1]=v/repeatIn+shiftV;}
 }
 g.deleteAttribute('wrap');
 return new THREE.Float32BufferAttribute(uv,2);
}
