/**
 * Builds the premium outdoor-room furniture GLBs (src/features/deckcraft/premiumFurniture.ts) from original geometry:
 * no third-party mesh or texture. Three LODs each, written to public/deckcraft/landscape and listed in
 * original-furniture-manifest.json. Inches while building, metres in the file; each mesh is built at its exact envelope.
 *   npx tsx scripts/build-premium-furniture.ts
 */
import * as THREE from 'three';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {PREMIUM_FURNITURE,CURVED_SECTIONAL} from '../src/features/deckcraft/premiumFurniture';

type Mat={name:string;color:string;rough:number;metal?:number;emissive?:string;emissiveStrength?:number;alpha?:number;double?:boolean};
const M={
 fabric:{name:'Oatmeal performance fabric',color:'#d8cfbf',rough:.97},
 fabricBase:{name:'Oatmeal upholstered base',color:'#c9bfad',rough:.97},
 accentClay:{name:'Terracotta accent pillow',color:'#a77a5e',rough:.96},
 accentOlive:{name:'Olive accent pillow',color:'#7f8166',rough:.96},
 rope:{name:'Woven taupe rope',color:'#9d8d77',rough:.93},
 teak:{name:'Oiled teak',color:'#a77b52',rough:.6},
 teakDark:{name:'Teak end grain',color:'#946a45',rough:.66},
 frame:{name:'Powder-coated bronze aluminium',color:'#2f2c29',rough:.62,metal:.18},
 plinth:{name:'Shadow plinth',color:'#1d1c1b',rough:.8},
 concrete:{name:'Warm cast concrete',color:'#a79d90',rough:.88},
 stone:{name:'Greyed nickel stone veneer',color:'#b7b3ad',rough:.86},
 mortar:{name:'Recessed joint',color:'#6d6a66',rough:.95},
 granite:{name:'Leathered black granite',color:'#2a2a2b',rough:.48},
 steel:{name:'Brushed stainless steel',color:'#c9cbcc',rough:.32,metal:.92},
 steelDark:{name:'Grill grate and burner',color:'#232323',rough:.55,metal:.6},
 knob:{name:'Black control knob',color:'#151515',rough:.4},
 canopy:{name:'Natural canvas canopy',color:'#e4ddd0',rough:.95,double:true},
 rug:{name:'Flat-weave rug field',color:'#cbc1b0',rough:.98},
 rugBorder:{name:'Flat-weave rug border',color:'#7d6f5f',rough:.98},
 glass:{name:'Lantern glass',color:'#e9eef0',rough:.05,alpha:.22},
 candle:{name:'Warm LED candle',color:'#f3e6cf',rough:.6,emissive:'#ffb35c',emissiveStrength:1.6},
 heaterFace:{name:'Infrared element grille',color:'#1b1b1b',rough:.5,metal:.4},
} satisfies Record<string,Mat>;

let Q=1; // LOD factor
const seg=(n:number)=>Math.max(3,Math.round(n*Q));
class Builder{parts=new Map<Mat,THREE.BufferGeometry[]>();
 firstMaterial(){return this.parts.keys().next().value as Mat;}
 add(mat:Mat,g:THREE.BufferGeometry){g=g.index?g.toNonIndexed():g;for(const k of Object.keys(g.attributes))if(k!=='position'&&k!=='normal')g.deleteAttribute(k);if(!g.getAttribute('normal'))g.computeVertexNormals();(this.parts.get(mat)??this.parts.set(mat,[]).get(mat)!).push(g);return g;}
}
/** Smooth-shaded copy: welded by position, normals recomputed (upholstery, rope, cast forms). */
function smooth(g:THREE.BufferGeometry){g=g.index?g.toNonIndexed():g.clone();for(const k of Object.keys(g.attributes))if(k!=='position')g.deleteAttribute(k);const w=mergeVertices(g,1e-4);w.computeVertexNormals();return w;}
const box=(w:number,h:number,d:number,x:number,y:number,z:number,r=0)=>{const g=r>0?new RoundedBoxGeometry(w,h,d,Q<.6?1:2,Math.min(r,w/2-.01,h/2-.01,d/2-.01)):new THREE.BoxGeometry(w,h,d);g.translate(x,y+h/2,z);return g;};
const cyl=(r0:number,r1:number,h:number,x:number,y:number,z:number,n=24)=>{const g=new THREE.CylinderGeometry(r1,r0,h,seg(n));g.translate(x,y+h/2,z);return g;};
/** Tube from a to b. */
function rod(a:THREE.Vector3,b:THREE.Vector3,r:number,n=10){const d=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,d.length(),seg(n),1);g.translate(0,d.length()/2,0);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()));g.translate(a.x,a.y,a.z);return g;}
const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
/** Plan shapes are written in world (x, z); the extrusion stands them up along +Y from y0 with rounded top and bottom edges. */
function plan(points:(s:THREE.Shape)=>void){const s=new THREE.Shape();points(s);return s;}
function soft(shape:THREE.Shape,y0:number,h:number,bevel:number,curve=12){
 const b=Math.min(bevel,h/2-.01),g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.01,h-2*b),bevelEnabled:b>0,bevelThickness:b,bevelSize:b,bevelOffset:-b,bevelSegments:seg(4),curveSegments:seg(curve)});
 g.rotateX(-Math.PI/2);g.translate(0,y0+b,0);return smooth(g);
}
/** Rounded rectangle in world plan coordinates (shape y is world −z). */
function rrect(x0:number,z0:number,x1:number,z1:number,r:number){r=Math.min(r,(x1-x0)/2-.01,(z1-z0)/2-.01);return plan(s=>{const a=x0,b=x1,c=-z1,d=-z0;s.moveTo(a+r,c);s.lineTo(b-r,c);s.quadraticCurveTo(b,c,b,c+r);s.lineTo(b,d-r);s.quadraticCurveTo(b,d,b-r,d);s.lineTo(a+r,d);s.quadraticCurveTo(a,d,a,d-r);s.lineTo(a,c+r);s.quadraticCurveTo(a,c,a+r,c);});}
const disc=(r:number,cx=0,cz=0)=>plan(s=>{const n=seg(48);s.moveTo(cx+r,-cz);for(let i=1;i<n;i++){const t=2*Math.PI*i/n;s.lineTo(cx+r*Math.cos(t),-cz+r*Math.sin(t));}});
/** Plan point at radius r and bearing phi from the arc centre; phi 0 is straight behind (−Z), positive toward +X. */
const P=(r:number,phi:number)=>({x:r*Math.sin(phi),z:-r*Math.cos(phi)});
/** Annular sector r0..r1 over phi0..phi1, its four corners filleted by f. */
function sector(r0:number,r1:number,phi0:number,phi1:number,f:number){
 return plan(s=>{const at=(r:number,phi:number)=>{const p=P(r,phi);return [p.x,-p.z] as const;};
  const n=seg(Math.max(4,Math.ceil((phi1-phi0)/(Math.PI/36)))),arc=(r:number,a:number,b:number)=>{for(let i=1;i<=n;i++){const t=a+(b-a)*i/n;s.lineTo(...at(r,t));}};
  f=Math.min(f,(phi1-phi0)*r0/2.6,(r1-r0)/2.6);const d1=f/r1,d0=f/r0;
  s.moveTo(...at(r1,phi0+d1));arc(r1,phi0+d1,phi1-d1);s.quadraticCurveTo(...at(r1,phi1),...at(r1-f,phi1));s.lineTo(...at(r0+f,phi1));s.quadraticCurveTo(...at(r0,phi1),...at(r0,phi1-d0));
  arc(r0,phi1-d0,phi0+d0);s.quadraticCurveTo(...at(r0,phi0),...at(r0+f,phi0));s.lineTo(...at(r1-f,phi0));s.quadraticCurveTo(...at(r1,phi0),...at(r1,phi0+d1));});
}
/** Lean a cushion back: points move away from the arc centre (or toward −Z) in proportion to height over y0. */
function leanRadial(g:THREE.BufferGeometry,y0:number,k:number){const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=p.getY(i),r=Math.hypot(x,z)||1,t=Math.max(0,y-y0)*k;p.setXYZ(i,x+x/r*t,y,z+z/r*t);}g.computeVertexNormals();return g;}
function leanBack(g:THREE.BufferGeometry,y0:number,k:number){const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const y=p.getY(i);p.setZ(i,p.getZ(i)-Math.max(0,y-y0)*k);}g.computeVertexNormals();return g;}
/** A loose throw pillow, tipped back against the back cushion. */
function pillow(b:Builder,mat:Mat,w:number,h:number,x:number,y:number,z:number,yaw:number,tilt=.32){const g=soft(rrect(-w/2,-2.5,w/2,2.5,2.2),-h/2,h,2.2,8);g.rotateX(-tilt);g.rotateY(yaw);g.translate(x,y+h/2,z);b.add(mat,g);}

// ---------- seating ----------
function curvedSectional(b:Builder){
 const {frontRadiusIn:R0,depthIn:D,spanDeg,seatHeightIn:SH,backHeightIn:BH}=CURVED_SECTIONAL,R1=R0+D,half=spanDeg/2*Math.PI/180,mods=5,step=2*half/mods,arm=6.5/R0;
 for(let m=0;m<mods;m++){
  const a=-half+m*step,c=a+step,gap=.25/R1;
  // Upholstered base on a recessed shadow plinth, so the piece reads low and floating.
  b.add(M.plinth,soft(sector(R0+3,R1-3,a+gap*4,c-gap*4,1.5),0,3.2,.4,8));
  b.add(M.fabricBase,soft(sector(R0,R1,a+gap,c-gap,2.4),3,SH-3-5.5,2.2));
  const s0=a+(m===0?arm:0)+gap,s1=c-(m===mods-1?arm:0)-gap;
  b.add(M.fabric,soft(sector(R0+.5,R1-7.5,s0,s1,2.6),SH-5.6,5.6,2.6));
  b.add(M.fabricBase,soft(sector(R1-6.5,R1,a+gap,c-gap,2.2),SH-5.5,BH-SH-2+5.5,2.4));
  b.add(M.fabric,leanRadial(soft(sector(R1-13.5,R1-6.2,s0+gap*3,s1-gap*3,2.8),SH,BH-SH-1.5,3),SH,.16));
 }
 for(const side of [-1,1]){const p0=side<0?-half:half-arm,p1=side<0?-half+arm:half;b.add(M.fabricBase,soft(sector(R0,R1-6,p0,p1,2.4),3,BH-3-6,2.6));}
 // Three accent pillows spaced along the back.
 for(const [phi,mat] of [[-half*.62,M.accentClay],[0,M.accentOlive],[half*.62,M.accentClay]] as const){const p=P(R1-15.5,phi);pillow(b,mat,18,16,p.x,SH+.4,p.z,-phi);}
 // Zero-area anchors on the exact plan envelope, so the fillets cannot shift the arc centre when the viewer fits it.
 const anchor=new THREE.BufferGeometry(),ex=R1*Math.sin(half);anchor.setAttribute('position',new THREE.Float32BufferAttribute([-ex,0,-R1,-ex+.001,0,-R1,-ex,0,-R1+.001,ex,0,-R0*Math.cos(half),ex-.001,0,-R0*Math.cos(half),ex,0,-R0*Math.cos(half)-.001],3));b.add(M.plinth,anchor);
}
function modularSofa(b:Builder){
 const W=120,D=40,SH=16,BH=27,arm=7,x0=-W/2,z0=-D/2,mods=3,inner=(W-2*arm)/mods;
 b.add(M.plinth,soft(rrect(x0+3,z0+3,-x0-3,-z0-3,1.5),0,3,.4));
 b.add(M.fabricBase,soft(rrect(x0+arm-.5,z0,-x0-arm+.5,-z0,2.4),3,SH-3-5.5,2.2));
 for(let i=0;i<mods;i++){const a=x0+arm+i*inner+.15,c=a+inner-.3;b.add(M.fabric,soft(rrect(a,z0+7.5,c,-z0-.3,2.6),SH-5.6,5.6,2.6));b.add(M.fabric,leanBack(soft(rrect(a+.4,z0+6.2,c-.4,z0+13.4,2.8),SH,BH-SH-1.5,3),SH,.16));}
 b.add(M.fabricBase,soft(rrect(x0+arm,z0,-x0-arm,z0+6.6,2.2),SH-5.5,BH-SH-2+5.5,2.4));
 for(const side of [-1,1])b.add(M.fabricBase,soft(rrect(side<0?x0:-x0-arm,z0,side<0?x0+arm:-x0,-z0,2.4),3,BH-3-6,2.6));
 pillow(b,M.accentClay,18,16,x0+arm+12,SH+.4,z0+15.5,.18);pillow(b,M.accentOlive,18,16,-x0-arm-12,SH+.4,z0+15.5,-.18);
}
function swivelChair(b:Builder){
 const R=17,shell=3.4,open=60*Math.PI/180;
 b.add(M.frame,soft(disc(11),0,1,.35,24));b.add(M.frame,cyl(2.6,2.6,5.5,0,.9,0,16));
 b.add(M.rope,soft(disc(15.2),6,5.2,1.8,32));
 // Barrel shell: 300° of woven rope wrapped round the seat, open at the front, rolled top edge.
 b.add(M.rope,soft(sector(R-shell,R,-Math.PI+open,Math.PI-open,1.6),6.2,22.8,1.6,40));
 if(Q>.6){const rings=Math.round(13*Q);for(let i=0;i<rings;i++){const y=7.8+i*(20/rings),t=new THREE.TorusGeometry(R+.05,.42,6,seg(56),2*(Math.PI-open));t.rotateX(Math.PI/2);t.rotateY(Math.PI-open+Math.PI/2);t.translate(0,y,0);b.add(M.rope,smooth(t));}}
 b.add(M.fabric,soft(disc(13.6,0,1.2),11,5.2,2.4,32));
 b.add(M.fabric,leanRadial(soft(sector(R-shell-6.4,R-shell+.2,-Math.PI+open+.32,Math.PI-open-.32,2.6),16,11.5,2.8,32),16,.12));
 pillow(b,M.accentOlive,16,14,0,16.3,-6.8,0,.28);
}
function diningChair(b:Builder){
 const W=24,D=24,leg=1.15,y=17.5,x0=-W/2+1,z0=-D/2+1,x1=W/2-1,z1=D/2-1;
 for(const [x,z] of [[x0,z0],[x1,z0],[x0,z1],[x1,z1]])b.add(M.frame,box(leg,y-.5,leg,x+(x<0?leg/2:-leg/2),0,z+(z<0?leg/2:-leg/2),.35));
 b.add(M.frame,box(W-2,1.2,D-2,0,y-1.7,0,.4));
 // Woven rope back: vertical strands round a curved top rail.
 const backZ=z0+.6,top=33-1.2;
 for(const x of [x0+.55,x1-.55]){b.add(M.frame,rod(V(x,y-1,backZ),V(x,top,backZ-1.6),.6,10));b.add(M.frame,rod(V(x,y-1,z1-.6),V(x,25.6,z1-1.2),.55,10));}
 const curveTop=(x:number)=>top-Math.pow(Math.abs(x)/(W/2),2)*1.2;
 const rail=new THREE.CatmullRomCurve3(Array.from({length:7},(_,i)=>{const x=x0+.55+(x1-x0-1.1)*i/6;return V(x,curveTop(x),backZ-1.6-Math.cos((i/6-.5)*Math.PI)*1.2);}));b.add(M.frame,new THREE.TubeGeometry(rail,seg(24),.6,seg(10),false));
 const strands=Math.round(16*Math.max(.5,Q));for(let i=0;i<strands;i++){const x=x0+1.6+(x1-x0-3.2)*i/(strands-1),bend=Math.cos((x/(W/2))*Math.PI/2)*1.2;b.add(M.rope,rod(V(x,y,backZ),V(x,curveTop(x)-.4,backZ-1.6-bend),.36,6));}
 b.add(M.rope,rod(V(x0+.6,y+5,backZ-.4),V(x1-.6,y+5,backZ-.4),.42,6));
 // Teak arm caps on aluminium uprights.
 for(const x of [x0+.55,x1-.55])b.add(M.teak,box(2.6,1.2,D-3,x,25.6,.4,.45));
 b.add(M.fabric,soft(rrect(x0+1,z0+2.2,x1-1,z1-.4,2.4),y-.5,3.6,1.6));
}
function barStool(b:Builder){
 const W=19,D=20,SH=30;
 const feet=[[-8,-8],[8,-8],[-8.6,8.8],[8.6,8.8]] as const;
 for(const [x,z] of feet)b.add(M.frame,rod(V(x,0,z),V(x*.72,SH-1.6,z*.72),.6,10));
 const ring=new THREE.TorusGeometry(7.6,.45,8,seg(40));ring.rotateX(Math.PI/2);ring.translate(0,10.5,.3);b.add(M.frame,ring);
 b.add(M.teak,soft(rrect(-8.2,-7.8,8.2,8.6,3),SH-1.6,1.6,.5,12));
 b.add(M.fabric,soft(rrect(-7.6,-7,7.6,8,2.6),SH,2.4,1));
 // Low woven back.
 const bz=-7.4;for(const x of [-7.4,7.4])b.add(M.frame,rod(V(x,SH-1,bz),V(x*1.04,39.4,bz-1.8),.5,8));
 b.add(M.frame,rod(V(-7.6,39.3,bz-1.8),V(7.6,39.3,bz-1.8),.55,8));
 const n=Math.round(10*Math.max(.5,Q));for(let i=0;i<n;i++){const x=-6.4+12.8*i/(n-1);b.add(M.rope,rod(V(x,SH+1.6,bz),V(x,39,bz-1.8),.32,6));}
}
// ---------- tables, rug, shade ----------
function sideTable(b:Builder){
 const prof=[[0,0],[7.2,0],[7.6,.6],[8.4,6],[9.2,17.6],[9.2,18.6],[0,18.6]].map(([x,y])=>new THREE.Vector2(x,y));
 b.add(M.concrete,smooth(new THREE.LatheGeometry(prof,seg(40))));
 b.add(M.teak,soft(disc(10),18.4,1.6,.5,40));
}
function teakTable(b:Builder){
 const L=96,W=42,H=30,top=1.5,boards=6,gap=.25,bw=(W-2-(boards-1)*gap)/boards;
 for(let i=0;i<boards;i++){const z=-W/2+1+bw/2+i*(bw+gap);b.add(M.teak,box(L-2,top,bw,0,H-top,z,.3));}
 b.add(M.teakDark,box(L,top,1.2,0,H-top,-W/2+.6,.35));b.add(M.teakDark,box(L,top,1.2,0,H-top,W/2-.6,.35));
 b.add(M.teakDark,box(1.2,top,W-2.4,-L/2+.6,H-top,0,.35));b.add(M.teakDark,box(1.2,top,W-2.4,L/2-.6,H-top,0,.35));
 for(const z of [-W/2+3.5,W/2-3.5])b.add(M.teak,box(L-14,3.2,1.4,0,H-top-3.2,z,.3));
 for(const x of [-L/2+7,L/2-7])b.add(M.teak,box(1.4,3.2,W-8,x,H-top-3.2,0,.3));
 for(const x of [-L/2+5.5,L/2-5.5])for(const z of [-W/2+2.5,W/2-2.5])b.add(M.teak,box(3.4,H-top,3.4,x,0,z,.4));
}
function rug(b:Builder){
 const L=144,W=108,h=.5,band=6;
 b.add(M.rugBorder,soft(rrect(-L/2,-W/2,L/2,W/2,1.2),0,h-.02,.16,6));
 b.add(M.rug,soft(rrect(-L/2+band,-W/2+band,L/2-band,W/2-band,.6),.02,h-.02,.18,6));
 // A narrow inner pinstripe of the border colour, set a hair proud.
 const s=band+5,t=.9;for(const [x0,z0,x1,z1] of [[-L/2+s,-W/2+s,L/2-s,-W/2+s+t],[-L/2+s,W/2-s-t,L/2-s,W/2-s],[-L/2+s,-W/2+s+t,-L/2+s+t,W/2-s-t],[L/2-s-t,-W/2+s+t,L/2-s,W/2-s-t]])b.add(M.rugBorder,box(x1-x0,.04,z1-z0,(x0+x1)/2,h-.01,(z0+z1)/2));
}
function umbrella(b:Builder){
 const R=66,hub=V(0,100.5,0),edgeY=93,mastX=-60,top=104;
 b.add(M.frame,soft(rrect(mastX-14,-14,mastX+14,14,2),0,3.2,.6));
 b.add(M.frame,box(4,top-3.2,4,mastX,3.2,0,.6));
 b.add(M.frame,box(-mastX+2,3,3,mastX/2,top-1.5,0,.5));
 b.add(M.frame,cyl(2.6,2.6,6,0,hub.y-2,0,16));
 b.add(M.frame,rod(V(0,hub.y-2,0),V(0,top-1,0),.9,8));
 // Octagonal canopy: eight panels sagging slightly between ribs, a short valance, ribs underneath.
 const corners=Array.from({length:8},(_,k)=>k*Math.PI/4),panelsU=seg(10),panelsV=seg(8),pos:number[]=[],idx:number[]=[];
 for(let k=0;k<8;k++){const a0=corners[k],a1=corners[(k+1)%8]+(k===7?2*Math.PI:0),base=pos.length/3;
  for(let i=0;i<=panelsU;i++)for(let j=0;j<=panelsV;j++){const t=i/panelsU,u=j/panelsV,a=a0+(a1-a0)*u,edgeR=R*Math.cos(Math.PI/8)/Math.cos(a-(a0+a1)/2),r=t*edgeR,sag=Math.sin(u*Math.PI)*t*2.4;pos.push(r*Math.cos(a),hub.y+3-(hub.y+3-edgeY)*Math.pow(t,1.15)-sag,r*Math.sin(a));}
  for(let i=0;i<panelsU;i++)for(let j=0;j<panelsV;j++){const q=base+i*(panelsV+1)+j;idx.push(q,q+1,q+panelsV+1,q+1,q+panelsV+2,q+panelsV+1);}}
 const canopy=new THREE.BufferGeometry();canopy.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));canopy.setIndex(idx);canopy.computeVertexNormals();b.add(M.canopy,canopy);
 for(let k=0;k<8;k++){const a0=corners[k],a1=corners[(k+1)%8],p0=V(R*Math.cos(a0),edgeY,R*Math.sin(a0)),p1=V(R*Math.cos(a1),edgeY,R*Math.sin(a1)),d=p1.clone().sub(p0);const val=new THREE.PlaneGeometry(d.length(),3.4);val.rotateY(-Math.atan2(d.z,d.x));val.translate((p0.x+p1.x)/2,edgeY-1.7,(p0.z+p1.z)/2);b.add(M.canopy,val);
  b.add(M.frame,rod(V(0,hub.y-1.5,0),V(R*.985*Math.cos(a0),edgeY-.6,R*.985*Math.sin(a0)),.42,6));b.add(M.frame,rod(V(0,hub.y-14,0),V(R*.45*Math.cos(a0),hub.y-3.2-(hub.y+3-edgeY)*.42,R*.45*Math.sin(a0)),.32,6));}
 b.add(M.frame,rod(V(0,hub.y-2,0),V(0,hub.y-16,0),.9,8));
}
// ---------- outdoor kitchen ----------
function kitchenIsland(b:Builder){
 // x along the island, cook face +Z. Body z −9..19.5 (bar wall at the back), counter z −5..21 at 36 in, bar ledge z −21..−4 at 42 in.
 const X=66,ctr=36,ct=1.5,bar=42,j=.3,course=5.9,face=.9;
 b.add(M.mortar,box(2*X-2,ctr-ct,24.5,0,0,7.25));b.add(M.mortar,box(2*X-2,bar-ct,4,0,0,-7));
 const units=[15.6,11.8,19.7];
 /** Coursed Greyed Nickel units over the joint colour along [a0,a1], skipping the `skip` ranges. */
 const lay=(a0:number,a1:number,y0:number,y1:number,skip:[number,number][],put:(a:number,c:number,y:number,h:number)=>void)=>{let row=0;for(let y=y0;y<y1-.4;y+=course,row++){const h=Math.min(course,y1-y)-j;let a=a0-(row%2?7.4:0),k=row;while(a<a1){const c=Math.min(a1,a+units[k++%3]);let s0=Math.max(a0,a);const pieces:[number,number][]=[[s0,c]];
   for(const [k0,k1] of skip)for(let i=pieces.length-1;i>=0;i--){const [p0,p1]=pieces[i];if(k1<=p0||k0>=p1)continue;pieces.splice(i,1,...([[p0,Math.min(p1,k0)],[Math.max(p0,k1),p1]] as [number,number][]).filter(([u,v])=>v-u>.6));}
   for(const [u,v] of pieces)if(v-u>j+.2)put(u,v-j,y,h);a=c;s0=c;}}};
 const gx=-14,gw=36,appliances:[number,number][]=[[gx-gw/2-1,gx+gw/2+1],[23,49],[-63,-39]];
 lay(-X+1,X-1,0,ctr-ct,appliances,(a,c,y,h)=>b.add(M.stone,box(c-a,h,face,(a+c)/2,y,19.5+face/2,.1)));
 lay(-X+1,X-1,0,bar-ct,[],(a,c,y,h)=>b.add(M.stone,box(c-a,h,face,(a+c)/2,y,-9-face/2,.1)));
 for(const side of [-1,1]){lay(-9-face,19.5+face,0,ctr-ct,[],(a,c,y,h)=>b.add(M.stone,box(face,h,c-a,side*(X-1+face/2),y,(a+c)/2,.1)));lay(-9-face,-5,ctr-ct,bar-ct,[],(a,c,y,h)=>b.add(M.stone,box(face,h,c-a,side*(X-1+face/2),y,(a+c)/2,.1)));}
 // Leathered black granite, eased edges.
 b.add(M.granite,box(2*X,ct,26,0,ctr-ct,8,.35));b.add(M.granite,box(2*X,ct,17,0,bar-ct,-12.5,.35));
 // Built-in 36 in grill: access doors, a control panel with four knobs, a firebox and a rounded hood with a front handle.
 b.add(M.steel,box(gw+2,22,.8,gx,3,19.5+face+.4,.2));
 for(const x of [gx-gw/4-.3,gx+gw/4+.3]){b.add(M.steel,box(gw/2-1.4,20.4,.5,x,3.8,20.9,.15));const hx=x+(x<gx?gw/4-3:-gw/4+3);b.add(M.steel,rod(V(hx,9,21.2),V(hx,21,21.2),.36,10));}
 b.add(M.steel,box(gw,8.6,2.6,gx,ctr-ct-8.4,19.9,.5));
 for(let k=0;k<4;k++){const g=cyl(1,1,1.2,0,0,0,18);g.rotateX(Math.PI/2);g.translate(gx-12+k*8,ctr-ct-4.6,21.4);b.add(M.knob,g);}
 b.add(M.steelDark,box(gw-2,.4,21,gx,ctr-.1,8.5));
 const prof=new THREE.Shape(),n=seg(20),zc=8.5,a=10.8,bh=8.4;prof.moveTo(zc-a,0);for(let i=1;i<=n;i++){const t=Math.PI*i/n;prof.lineTo(zc-a*Math.cos(t),bh*Math.sin(t));}prof.lineTo(zc-a,0);
 const hood=new THREE.ExtrudeGeometry(prof,{depth:gw-.6,bevelEnabled:false,curveSegments:n});hood.rotateY(-Math.PI/2);hood.translate(gx+(gw-.6)/2,ctr+.3,0);b.add(M.steel,smooth(hood));
 b.add(M.steel,rod(V(gx-gw/2+4,ctr+3.2,zc+a+1.6),V(gx+gw/2-4,ctr+3.2,zc+a+1.6),.5,10));
 for(const x of [gx-gw/2+4,gx+gw/2-4])b.add(M.steel,rod(V(x,ctr+3.2,zc+a-.6),V(x,ctr+3.2,zc+a+1.6),.4,8));
 const gauge=cyl(1.2,1.2,.4,0,0,0,18);gauge.rotateX(Math.PI/2);gauge.rotateX(-.55);gauge.translate(gx,ctr+6.6,zc+a-2.6);b.add(M.knob,gauge);
 // Side burner lid, under-counter fridge and a drawer stack.
 b.add(M.steel,box(14,1,19,gx+gw/2+12,ctr,8,.3));
 b.add(M.steel,box(26,30,.8,36,2.6,19.5+face+.4,.25));b.add(M.steel,box(24.6,28.6,.4,36,3.3,21.1,.15));b.add(M.steel,rod(V(25.2,9,21.6),V(25.2,27,21.6),.38,10));
 b.add(M.steel,box(24,30,.8,-51,2.6,19.5+face+.4,.25));for(const y of [4,14.4,24.6]){b.add(M.steel,box(22.6,9.2,.4,-51,y,21.1,.15));b.add(M.steel,rod(V(-57,y+6.6,21.6),V(-45,y+6.6,21.6),.34,8));}
}
// ---------- lantern, heater ----------
function lantern(b:Builder){
 const W=12,H=24,p=1.1;
 b.add(M.teak,box(W,1.6,W,0,0,0,.35));b.add(M.teak,box(W,1.2,W,0,H-4.4,0,.35));
 for(const x of [-W/2+p/2,W/2-p/2])for(const z of [-W/2+p/2,W/2-p/2])b.add(M.teak,box(p,H-5.6,p,x,1.6,z,.2));
 b.add(M.teak,soft(rrect(-W/2+1.5,-W/2+1.5,W/2-1.5,W/2-1.5,1.2),H-3.2,1,.3));
 const handle=new THREE.TorusGeometry(3.4,.35,8,seg(28),Math.PI);handle.translate(0,H-3.4,0);b.add(M.frame,handle);
 for(const [w,d,x,z] of [[W-2*p,.15,0,-W/2+p/2],[W-2*p,.15,0,W/2-p/2],[.15,W-2*p,-W/2+p/2,0],[.15,W-2*p,W/2-p/2,0]])b.add(M.glass,box(w,H-5.6,d,x,1.6,z));
 b.add(M.candle,cyl(2.2,2.2,7.5,0,1.6,0,24));b.add(M.candle,cyl(.35,.1,1.4,0,9.1,0,8));
}
function heater(b:Builder){
 const W=40,H=PREMIUM_FURNITURE.find(a=>a.id==='infrared-heater')!.heightIn,body=4.6,depth=7;
 // A zero-area anchor at the deck sets the envelope's floor, so the heater hangs at the beam, not on the boards.
 const anchor=new THREE.BufferGeometry();anchor.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.001,0,0,0,0,.001],3));b.add(M.frame,anchor);
 b.add(M.frame,box(4,2,6,0,H-2,0,.3));b.add(M.frame,box(1.6,13,1.6,0,H-15,0,.3));
 const g=box(W,body,depth,0,H-15-body,0,.6);g.rotateX(0);b.add(M.frame,g);
 b.add(M.heaterFace,box(W-3,.3,depth-1.6,0,H-15-body-.25,0,.1));
 for(let k=0;k<7;k++)b.add(M.frame,box(W-3.4,.25,.25,0,H-15-body-.45,-depth/2+1.1+k*(depth-2.2)/6));
}
const BUILD:Record<string,(b:Builder)=>void>={'curved-sectional':curvedSectional,'swivel-lounge-chair':swivelChair,'modular-sofa':modularSofa,'side-table':sideTable,'cantilever-umbrella':umbrella,'outdoor-rug':rug,'teak-dining-table':teakTable,'woven-dining-chair':diningChair,'kitchen-island':kitchenIsland,'bar-stool':barStool,'outdoor-lantern':lantern,'infrared-heater':heater};

// ---------- GLB ----------
const lin=(c:number)=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);
function glb(b:Builder){
 const meshes:{mat:Mat;g:THREE.BufferGeometry}[]=[];
 for(const [mat,list] of b.parts){const merged=mergeGeometries(list);if(!merged)throw Error('merge failed '+mat.name);const w=mergeVertices(merged,1e-4);meshes.push({mat,g:w});}
 const bins:Buffer[]=[],views:object[]=[],accessors:object[]=[],materials:object[]=[],gltfMeshes:object[]=[],nodes:object[]=[];let off=0,tris=0;
 const push=(data:Buffer,target:number)=>{const pad=(4-data.length%4)%4,buf=Buffer.concat([data,Buffer.alloc(pad)]);views.push({buffer:0,byteOffset:off,byteLength:data.length,target});bins.push(buf);off+=buf.length;return views.length-1;};
 const box3=new THREE.Box3();
 for(const {mat,g} of meshes){
  const p=g.getAttribute('position') as THREE.BufferAttribute,n=g.getAttribute('normal') as THREE.BufferAttribute,idx=g.index!;
  const pos=new Float32Array(p.count*3),nor=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){pos[i*3]=p.getX(i)*.0254;pos[i*3+1]=p.getY(i)*.0254;pos[i*3+2]=p.getZ(i)*.0254;const v=V(n.getX(i),n.getY(i),n.getZ(i));if(!(v.lengthSq()>1e-12))v.set(0,1,0);v.normalize();nor[i*3]=v.x;nor[i*3+1]=v.y;nor[i*3+2]=v.z;}
  g.computeBoundingBox();box3.union(g.boundingBox!);
  const mn=[0,1,2].map(k=>Math.min(...Array.from({length:p.count},(_,i)=>pos[i*3+k]))),mx=[0,1,2].map(k=>Math.max(...Array.from({length:p.count},(_,i)=>pos[i*3+k])));
  const big=p.count>65535,ind=big?new Uint32Array(idx.array):new Uint16Array(idx.array);tris+=idx.count/3;
  const pv=push(Buffer.from(pos.buffer),34962),nv=push(Buffer.from(nor.buffer),34962),iv=push(Buffer.from(ind.buffer,ind.byteOffset,ind.byteLength),34963);
  accessors.push({bufferView:pv,componentType:5126,count:p.count,type:'VEC3',min:mn,max:mx},{bufferView:nv,componentType:5126,count:p.count,type:'VEC3'},{bufferView:iv,componentType:big?5125:5123,count:idx.count,type:'SCALAR'});
  const c=new THREE.Color(mat.color),e=mat.emissive?new THREE.Color(mat.emissive):undefined;
  materials.push({name:mat.name,pbrMetallicRoughness:{baseColorFactor:[lin(c.r),lin(c.g),lin(c.b),mat.alpha??1],roughnessFactor:mat.rough,metallicFactor:mat.metal??0},...(e?{emissiveFactor:[lin(e.r),lin(e.g),lin(e.b)],...(mat.emissiveStrength?{extensions:{KHR_materials_emissive_strength:{emissiveStrength:mat.emissiveStrength}}}:{})}:{}),...(mat.alpha!==undefined?{alphaMode:'BLEND'}:{}),...(mat.double?{doubleSided:true}:{})});
  const a=accessors.length-3;gltfMeshes.push({name:mat.name,primitives:[{attributes:{POSITION:a,NORMAL:a+1},indices:a+2,material:materials.length-1}]});nodes.push({mesh:gltfMeshes.length-1,name:mat.name});
 }
 const json={asset:{version:'2.0',generator:'DeckCraft build-premium-furniture'},scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes:gltfMeshes,materials,accessors,bufferViews:views,buffers:[{byteLength:off}],...(materials.some((m:any)=>m.extensions)?{extensionsUsed:['KHR_materials_emissive_strength']}:{})};
 let js=Buffer.from(JSON.stringify(json));js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);const bin=Buffer.concat(bins);
 const head=Buffer.alloc(12);head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(12+8+js.length+8+bin.length,8);
 const c1=Buffer.alloc(8);c1.writeUInt32LE(js.length,0);c1.writeUInt32LE(0x4e4f534a,4);const c2=Buffer.alloc(8);c2.writeUInt32LE(bin.length,0);c2.writeUInt32LE(0x004e4942,4);
 return {file:Buffer.concat([head,c1,js,c2,bin]),tris,bounds:box3};
}

function topPoint(b:Builder){let best:THREE.Vector3|undefined;for(const gs of b.parts.values())for(const g of gs){const p=g.getAttribute('position');for(let i=0;i<p.count;i++)if(!best||p.getY(i)>best.y)best=new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i));}return best!;}
const dir='public/deckcraft/landscape/',manifestPath=dir+'original-furniture-manifest.json',manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
const only=process.argv[2]?.split(',');
for(const spec of PREMIUM_FURNITURE){
 if(only&&!only.includes(spec.id))continue;
 const lods=[];
 let lod0:THREE.Box3|undefined,top:THREE.Vector3|undefined;
 for(const [i,q] of [[0,1],[1,.55],[2,.3]] as const){Q=q;const b=new Builder();BUILD[spec.id](b);
  // Lower LODs carry zero-area anchors at the LOD 0 corners, so every LOD fits the envelope at the same scale.
  // The plan corners go on the floor and the height on LOD 0's own top point, so the anchors do not move a seat's back.
  if(lod0&&top){const a=lod0.min,c=lod0.max,g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([a.x,a.y,a.z,a.x+.001,a.y,a.z,a.x,a.y,a.z+.001,c.x,a.y,c.z,c.x-.001,a.y,c.z,c.x,a.y,c.z-.001,top.x,top.y,top.z,top.x+.001,top.y,top.z,top.x,top.y,top.z+.001],3));b.add(b.firstMaterial(),g);}
  const out=glb(b);if(i===0){lod0=out.bounds.clone();top=topPoint(b);}const s=out.bounds.getSize(new THREE.Vector3());
  const err=[s.x-spec.widthIn,s.y-spec.heightIn,s.z-spec.depthIn];if(err.some(e=>Math.abs(e)>.6))console.warn(`${spec.id} lod${i} envelope ${s.x.toFixed(2)}×${s.z.toFixed(2)}×${s.y.toFixed(2)} vs ${spec.widthIn}×${spec.depthIn}×${spec.heightIn}`);
  const uri=`${spec.id}-lod${i}.glb`;writeFileSync(dir+uri,out.file);lods.push({uri,bytes:out.file.length,triangles:out.tris,sha256:createHash('sha256').update(out.file).digest('hex')});
  if(i===0)console.log(spec.id,'tris',out.tris,'bytes',out.file.length,'bounds',s.x.toFixed(2),s.z.toFixed(2),s.y.toFixed(2),'min',out.bounds.min.toArray().map(v=>v.toFixed(2)).join(','));}
 manifest.assets=manifest.assets.filter((a:{id:string})=>a.id!==spec.id);manifest.assets.push({id:spec.id,lods});
}
writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const premium=new Set(PREMIUM_FURNITURE.map(a=>a.id)),counts=manifest.assets.filter((a:{id:string})=>premium.has(a.id as never)).map((a:{id:string;lods:{triangles:number}[]})=>`'${a.id}':[${a.lods.map(l=>l.triangles).join(',')}]`);
writeFileSync('src/features/deckcraft/premiumFurnitureTriangles.ts',`import type {LandscapeAssetId} from './landscapeTypes';\n/** Triangle counts of the premium furniture LODs. Written by scripts/build-premium-furniture.ts; do not edit. */\nexport const PREMIUM_FURNITURE_TRIANGLES:Partial<Record<LandscapeAssetId,[number,number,number]>>={${counts.join(',')}};\n`);
console.log(JSON.stringify(Object.fromEntries(manifest.assets.map((a:{id:string;lods:{triangles:number}[]})=>[a.id,a.lods.map(l=>l.triangles)]))));
