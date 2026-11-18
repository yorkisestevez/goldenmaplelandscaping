import * as THREE from 'three';
import type {HydrangeaCultivar} from '../../../hydrangeaCultivars';
import {HYDRANGEA_SPECS,type HydrangeaSpec} from './hydrangeaSpecs';

/**
 * A hydrangea built from its botany, in plant inches: y up, the crown's centre at the origin. Canes rise from the crown
 * and carry opposite leaves at their nodes and one head at their tip; leafy shoots fill the lower crown. Each head is a
 * shell of sterile florets, every one a real-photo floret card at its real size. The same plant id always builds the
 * same shrub.
 */
export type Vec3=[number,number,number];
export type Quat=[number,number,number,number];
export interface HydrangeaCane {points:Vec3[];radii:number[];tipLeanDeg:number}
/** p: where the petiole leaves the cane. The card's +y runs petiole to tip and +z is its face. out: the crown's outward
 * direction at the leaf, in the leaf's own frame (the leaf lighting bends normals toward it). shade: 1 at the crown's
 * edge, darker inside. */
export interface HydrangeaLeaf {node:string;p:Vec3;q:Quat;bladeIn:number;widthIn:number;petioleIn:number;out:Vec3;shade:number}
/** p: the cane tip the head sits on; axis: the head's direction; lengthIn along the axis, widthIn across it. */
export interface HydrangeaHead {shape:'panicle'|'dome';p:Vec3;axis:Vec3;lengthIn:number;widthIn:number}
/** A floret card facing +z, sizeIn across. color: sRGB 0–1. */
export interface HydrangeaFloret {p:Vec3;q:Quat;sizeIn:number;color:Vec3}
export interface HydrangeaPlant {cultivar:HydrangeaCultivar;canes:HydrangeaCane[];leaves:HydrangeaLeaf[];heads:HydrangeaHead[];florets:HydrangeaFloret[];
 /** The farthest point from the stem axis and the highest point, inches. */
 bounds:[Vec3,Vec3]}
export interface HydrangeaLod {leaves:HydrangeaLeaf[];florets:HydrangeaFloret[]}

const UP=new THREE.Vector3(0,1,0),GOLDEN=Math.PI*(3-Math.sqrt(5));
/** Leaves start this far along a cane (so the crown is leafy to the ground); spec.leaf.leafTo is where they stop. */
const LEAF_FROM=.06;
/** Leaves reach out and up from the cane, then droop toward the tip. */
const LEAF_RISE=.55,LEAF_DROOP=.3,LEAF_TWIST=.45;
/** Florets tilt this far (radians) about the head's surface normal, and sink up to this share of their size into it. */
const FLORET_TILT=.28,FLORET_SINK=.3;
/** Dome heads are covered down to this angle from the top; below it the leaves and the stem hide the head. */
const DOME_REACH=Math.PI*.64;
/** Distant cards: one in this many florets or leaves, enlarged to cover the same area. */
const CLUSTER_STRIDE=[1,6,16] as const,LEAF_STRIDE=[1,2,4] as const;
/** Triangles per leaf card (a folded 3 × 3 grid close up, both faces in one draw), floret card, head core, cane (6
 * segments, 5, 4 or 3 sides) and petiole (drawn close up only). */
const TRIS={leaf:[8,2,2],floret:2,core:[150,50,50],cane:[60,48,36],petiole:[6,0,0]} as const;

function random(seed:string){
 let h=2166136261;for(let i=0;i<seed.length;i++)h=Math.imul(h^seed.charCodeAt(i),16777619);
 let a=h>>>0;
 return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
}
const range=(r:()=>number,[lo,hi]:[number,number])=>lo+(hi-lo)*r();
const v3=(v:THREE.Vector3):Vec3=>[v.x,v.y,v.z];
const q4=(q:THREE.Quaternion):Quat=>[q.x,q.y,q.z,q.w];
/** sRGB 0–1 components of a hex colour (THREE.Color holds linear values). */
const srgb=(hex:string):Vec3=>{const c=new THREE.Color(hex).getRGB({r:0,g:0,b:0},THREE.SRGBColorSpace);return [c.r,c.g,c.b];};
/** A frame whose +y is `along` and +z leans toward `face`. */
function frame(along:THREE.Vector3,face:THREE.Vector3){
 const y=along.clone().normalize(),z=face.clone().addScaledVector(y,-face.dot(y));
 if(z.lengthSq()<1e-8)z.set(1,0,0).addScaledVector(y,-y.x);
 z.normalize();const x=new THREE.Vector3().crossVectors(y,z);
 return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
}
function bezier(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,t:number){const u=1-t;return a.clone().multiplyScalar(u*u).addScaledVector(b,2*u*t).addScaledVector(c,t*t);}
function bezierTangent(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,t:number){return b.clone().sub(a).multiplyScalar(2*(1-t)).addScaledVector(c.clone().sub(b),2*t).normalize();}

/** A panicle's radius along its length: full a quarter of the way up, tapering to a point. */
export const panicleRadius=(t:number)=>t<.25?.72+.28*(t/.25):1-(t-.25)/.75*.9;
function panicleSamples(count:number){
 // Inverse of the panicle's surface area along its length, so florets cover it evenly.
 const steps=64,cdf=[0];for(let i=1;i<=steps;i++)cdf.push(cdf[i-1]+panicleRadius((i-.5)/steps));
 const total=cdf[steps];
 return Array.from({length:count},(_,i)=>{const target=(i+.5)/count*total;let k=1;while(k<steps&&cdf[k]<target)k++;return (k-1+(target-cdf[k-1])/(cdf[k]-cdf[k-1]))/steps;});
}

function buildHead(spec:HydrangeaSpec,head:HydrangeaHead,rand:()=>number,out:HydrangeaFloret[]){
 const h=spec.head,axis=new THREE.Vector3(...head.axis),base=new THREE.Vector3(...head.p),toHead=frame(axis,new THREE.Vector3(1,0,0));
 const floretArea=Math.PI*(h.floretIn/2)**2,color=srgb(h.color),young=srgb(h.young),lift=(rand()-.5)*.06;
 const place=(local:THREE.Vector3,normal:THREE.Vector3,youth:number)=>{
  const n=normal.clone().applyQuaternion(toHead).normalize(),size=h.floretIn*(.82+rand()*.36);
  const p=local.clone().applyQuaternion(toHead).add(base).addScaledVector(n,-size*FLORET_SINK*rand());
  const tilt=new THREE.Vector3(rand()-.5,rand()-.5,rand()-.5).multiplyScalar(2*FLORET_TILT);
  // The card's +z turns to face out of the head, then spins about it.
  const facing=n.clone().add(tilt).normalize();
  const card=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),facing).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),rand()*Math.PI*2));
  const jitter=(rand()-.5)*.05+lift,c=color.map((v,i)=>Math.min(1,Math.max(0,v+(young[i]-v)*youth+jitter))) as Vec3;
  out.push({p:v3(p),q:q4(card),sizeIn:size,color:c});
 };
 if(head.shape==='dome'){
  const a=head.widthIn/2,c=head.lengthIn/2,mean=(2*a+c)/3,cosEnd=Math.cos(DOME_REACH);
  const count=Math.round(h.coverage*2*Math.PI*mean*mean*(1-cosEnd)/floretArea),centre=new THREE.Vector3(0,c*.7,0);
  for(let i=0;i<count;i++){
   const y=1-(i+.5)/count*(1-cosEnd),r=Math.sqrt(Math.max(0,1-y*y)),phi=i*GOLDEN;
   const s=new THREE.Vector3(Math.cos(phi)*r,y,Math.sin(phi)*r);
   place(new THREE.Vector3(s.x*a,s.y*c,s.z*a).add(centre),new THREE.Vector3(s.x/a,s.y/c,s.z/a),Math.max(0,y)**3*.65);
  }
  return;
 }
 const length=head.lengthIn,radius=head.widthIn/2,steps=24;
 let area=0;for(let i=0;i<steps;i++)area+=2*Math.PI*radius*panicleRadius((i+.5)/steps)*length/steps;
 const count=Math.round(h.coverage*area/floretArea),ts=panicleSamples(count);
 ts.forEach((t,i)=>{
  const phi=i*GOLDEN,r=radius*panicleRadius(t),slope=radius*(panicleRadius(Math.min(1,t+.02))-panicleRadius(Math.max(0,t-.02)))/(.04*length);
  const radial=new THREE.Vector3(Math.cos(phi),0,Math.sin(phi));
  place(radial.clone().multiplyScalar(r).setY(t*length-.08*length),radial.clone().addScaledVector(UP,-slope),t**2*.8);
 });
}

/** Build the hydrangea placed as `object` (its id seeds the shrub; its envelope sets the height and spread). */
export function buildHydrangea(cultivar:HydrangeaCultivar,object:{id:string;widthIn:number;heightIn:number;depthIn:number}):HydrangeaPlant{
 const spec=HYDRANGEA_SPECS[cultivar],rand=random(object.id+'|'+cultivar);
 const height=object.heightIn,halfW=object.widthIn/2,halfD=object.depthIn/2,growth=Math.min(1.15,Math.max(.7,Math.sqrt(height/spec.refHeightIn)));
 const headLength=spec.head.lengthIn*growth,headWidth=spec.head.widthIn*growth,crownCentre=new THREE.Vector3(0,height*.42,0);
 const canes:HydrangeaCane[]=[],leaves:HydrangeaLeaf[]=[],heads:HydrangeaHead[]=[],florets:HydrangeaFloret[]=[];
 const flowering=Math.round(range(rand,spec.canes)),fill=Math.round(range(rand,spec.fill));
 const addCane=(index:number,count:number,heads0:boolean)=>{
  const az=index*GOLDEN+rand()*.4+(heads0?0:1.3),out=new THREE.Vector3(Math.cos(az),0,Math.sin(az));
  const base=out.clone().multiplyScalar(spec.crownIn*Math.sqrt(rand()));
  const reach=(.3+.7*Math.sqrt((index+rand())/count)),edge=Math.min(halfW,halfD)*1.0-headWidth*.45;
  let tip:THREE.Vector3,axis:THREE.Vector3;
  if(heads0){
   axis=UP.clone().lerp(out,range(rand,spec.lean)*(.55+.45*reach)).normalize();
   const extent=spec.head.shape==='dome'?headLength*1.2:headLength*.92;
   const top=height*(1-.16*reach*reach)-rand()*height*.05;
   tip=out.clone().multiplyScalar(Math.max(spec.crownIn,edge*reach)).setY(Math.max(height*.3,top-extent*axis.y));
  }else{
   axis=UP.clone().lerp(out,.5+rand()*.3).normalize();
   tip=out.clone().multiplyScalar(Math.max(spec.crownIn,(Math.min(halfW,halfD)-2)*(.6+.4*rand()))).setY(height*(.22+.33*rand()));
  }
  // The control point lifts the cane's middle: upright canes run nearly straight; arching ones rise and then fall to the head.
  const mid=base.clone().lerp(tip,.35).setY(Math.max(tip.y*(.62+spec.arch*1.6),base.y));
  const points:Vec3[]=[],radii:number[]=[],segments=6;
  for(let s=0;s<=segments;s++){const t=s/segments;points.push(v3(bezier(base,mid,tip,t)));radii.push(spec.caneBaseIn+(spec.caneTipIn-spec.caneBaseIn)*t);}
  const tipTangent=bezierTangent(base,mid,tip,1);
  canes.push({points,radii,tipLeanDeg:Math.acos(Math.min(1,tipTangent.dot(UP)))*180/Math.PI});
  if(heads0)heads.push({shape:spec.head.shape,p:v3(tip),axis:v3(axis.clone().lerp(tipTangent,.35).normalize()),lengthIn:headLength,widthIn:headWidth});
  // Opposite leaves (whorls of 3 on some Limelight nodes), turned a quarter at each node, from low on the cane to below the head.
  const caneIndex=canes.length-1,arc=base.distanceTo(mid)+mid.distanceTo(tip),nodes=Math.max(2,Math.round(arc/spec.leaf.nodeIn));
  let phase=rand()*Math.PI;
  for(let n=0;n<nodes;n++){
   const t=LEAF_FROM+((heads0?spec.leaf.leafTo:1)-LEAF_FROM)*(n+.5)/nodes,at=bezier(base,mid,tip,t),tangent=bezierTangent(base,mid,tip,t);
   const side=new THREE.Vector3().crossVectors(tangent,Math.abs(tangent.y)>.95?new THREE.Vector3(1,0,0):UP).normalize(),side2=new THREE.Vector3().crossVectors(tangent,side);
   const whorl=rand()<spec.leaf.whorl3?3:2,size=1.08-.3*t;
   for(let j=0;j<whorl;j++){
    const theta=phase+j*Math.PI*2/whorl,perp=side.clone().multiplyScalar(Math.cos(theta)).addScaledVector(side2,Math.sin(theta));
    const along=perp.clone().addScaledVector(tangent,LEAF_RISE).addScaledVector(UP,-LEAF_DROOP*rand()).normalize();
    const twist=(rand()-.5)*2*LEAF_TWIST,face=UP.clone().addScaledVector(perp,twist).addScaledVector(new THREE.Vector3().crossVectors(along,UP),twist);
    const q=frame(along,face),blade=spec.leaf.bladeIn*size*(.88+.24*rand()),width=spec.leaf.widthIn*size*(.88+.24*rand());
    const p=at.clone().addScaledVector(perp,spec.caneBaseIn),middle=p.clone().addScaledVector(along,spec.leaf.petioleIn+blade/2);
    const outward=middle.clone().sub(crownCentre),reachOut=Math.min(1,Math.hypot(outward.x,outward.z)/Math.max(1,Math.min(halfW,halfD)));
    const local=outward.lengthSq()>1e-6?outward.normalize().applyQuaternion(q.clone().invert()):new THREE.Vector3(0,0,1);
    leaves.push({node:caneIndex+':'+n,p:v3(p),q:q4(q),bladeIn:blade,widthIn:width,petioleIn:spec.leaf.petioleIn,out:v3(local),shade:.7+.3*reachOut});
   }
   phase+=Math.PI/2;
  }
 };
 for(let i=0;i<flowering;i++)addCane(i,flowering,true);
 for(let i=0;i<fill;i++)addCane(i,fill,false);
 for(const h of heads)buildHead(spec,h,rand,florets);
 // Fit: positions only (sizes stay real), so a plant never pokes far out of its drawn envelope. Every level of detail
 // shares this skeleton, so the fit cannot pop between levels.
 const extent=(p:Vec3)=>Math.hypot(p[0]/halfW,p[2]/halfD);
 const tipOf=(l:HydrangeaLeaf)=>v3(new THREE.Vector3(0,l.petioleIn+l.bladeIn,0).applyQuaternion(new THREE.Quaternion(...l.q)).add(new THREE.Vector3(...l.p)));
 const extremes=[...leaves.map(tipOf),...florets.map(f=>f.p),...canes.flatMap(c=>c.points)];
 const radial=Math.max(...extremes.map(extent)),top=Math.max(...extremes.map(p=>p[1]));
 const sx=radial>1.04?1.04/radial:1,sy=top>height*1.03?height*1.03/top:1;
 const fit=(p:Vec3):Vec3=>[p[0]*sx,p[1]*sy,p[2]*sx];
 for(const c of canes)c.points=c.points.map(fit);
 for(const l of leaves)l.p=fit(l.p);
 for(const h of heads)h.p=fit(h.p);
 for(const f of florets)f.p=fit(f.p);
 const fitted=[...leaves.map(tipOf),...florets.map(f=>f.p),...canes.flatMap(c=>c.points)];
 const far=fitted.reduce((a,p)=>Math.hypot(p[0],p[2])>Math.hypot(a[0],a[2])?p:a,fitted[0]),high=fitted.reduce((a,p)=>p[1]>a[1]?p:a,fitted[0]);
 return {cultivar,canes,leaves,heads,florets,bounds:[far,high]};
}

/** The plant at a level of detail: 0 every floret and leaf; 1 and 2 fewer, larger cards over the same area. */
export function hydrangeaLod(plant:HydrangeaPlant,lod:0|1|2):HydrangeaLod{
 if(lod===0)return {leaves:plant.leaves,florets:plant.florets};
 const k=CLUSTER_STRIDE[lod],grow=Math.sqrt(k),leafK=LEAF_STRIDE[lod],leafGrow=Math.sqrt(leafK);
 return {
  leaves:plant.leaves.filter((_,i)=>i%leafK===0).map(l=>({...l,bladeIn:l.bladeIn*leafGrow,widthIn:l.widthIn*leafGrow})),
  florets:plant.florets.filter((_,i)=>i%k===0).map(f=>({...f,sizeIn:f.sizeIn*grow})),
 };
}
export function hydrangeaTriangles(plant:HydrangeaPlant,lod:0|1|2){
 const view=hydrangeaLod(plant,lod);
 return view.leaves.length*TRIS.leaf[lod]+view.florets.length*TRIS.floret+plant.heads.length*TRIS.core[lod]+plant.canes.length*TRIS.cane[lod]+plant.leaves.length*TRIS.petiole[lod];
}
