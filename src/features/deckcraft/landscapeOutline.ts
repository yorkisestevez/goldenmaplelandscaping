import type {LandscapeObject,LandscapePoint} from './landscapeTypes';
import {arcGeometry,bulgeForRadius,sampleArc} from './circularArcs';

export type LandscapeSegment={kind:'line'}|{kind:'arc';bulgeIn:number}|{kind:'cubic';c1:LandscapePoint;c2:LandscapePoint};
export interface LandscapeRing {points:LandscapePoint[];segments:LandscapeSegment[]}
export interface LandscapeOutline {outer:LandscapeRing;holes:LandscapeRing[]}
export type LandscapePreset='rectangle'|'circle'|'oval'|'rounded'|'kidney';
const MAX_SAMPLES=4096,TOLERANCE=.01;
const midpoint=(a:LandscapePoint,b:LandscapePoint)=>({x:(a.x+b.x)/2,z:(a.z+b.z)/2});
const distance=(a:LandscapePoint,b:LandscapePoint)=>Math.hypot(a.x-b.x,a.z-b.z);
export const landscapeSignedArea=(p:LandscapePoint[])=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.z-b.x*a.z;},0)/2;
export function landscapeLocal(o:LandscapeObject,p:LandscapePoint){const a=o.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=p.x-o.xIn,z=p.z-o.zIn;return {x:c*x+s*z,z:-s*x+c*z};}
export function landscapeWorld(o:LandscapeObject,p:LandscapePoint){const a=o.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return {x:o.xIn+c*p.x-s*p.z,z:o.zIn+s*p.x+c*p.z};}
export function sampleLandscapeRing(r:LandscapeRing):LandscapePoint[]{
 const out:LandscapePoint[]=[];
 const add=(p:LandscapePoint)=>{if(out.length>=MAX_SAMPLES)throw Error('This outline exceeds the curve detail budget. Simplify it before applying.');out.push(p);};
 const cubic=(a:LandscapePoint,b:LandscapePoint,c:LandscapePoint,d:LandscapePoint,level=0)=>{const chord=distance(a,d),cross=(p:LandscapePoint)=>chord?Math.abs((d.x-a.x)*(a.z-p.z)-(a.x-p.x)*(d.z-a.z))/chord:distance(a,p);if(Math.max(cross(b),cross(c))<=TOLERANCE&&distance(a,b)+distance(b,c)+distance(c,d)-chord<=TOLERANCE){add(a);return;}if(level>=18)throw Error('The smooth curve needs more detail than supported.');const ab=midpoint(a,b),bc=midpoint(b,c),cd=midpoint(c,d),abc=midpoint(ab,bc),bcd=midpoint(bc,cd),m=midpoint(abc,bcd);cubic(a,ab,abc,m,level+1);cubic(m,bcd,cd,d,level+1);};
 r.points.forEach((a,i)=>{const b=r.points[(i+1)%r.points.length],s=r.segments[i];if(s.kind==='arc'){const g=arcGeometry({x:a.x,y:a.z},{x:b.x,y:b.z},s.bulgeIn),steps=Math.max(2,Math.ceil(g.sweep/Math.min(Math.PI/180,2*Math.acos(Math.max(-1,1-TOLERANCE/g.radius)))));if(steps>MAX_SAMPLES)throw Error('Arc exceeds the curve detail budget.');const alpha=2*Math.atan2(2*s.bulgeIn,distance(a,b)),ux=(b.x-a.x)/distance(a,b),uz=(b.z-a.z)/distance(a,b),sr=Math.sign(s.bulgeIn)*g.radius;for(let j=0;j<steps;j++){const v=alpha*(2*j/steps-1),along=distance(a,b)/2+sr*Math.sin(v),across=s.bulgeIn-2*sr*Math.sin(v/2)**2;add(j?{x:a.x+ux*along-uz*across,z:a.z+uz*along+ux*across}:a);}}else if(s.kind==='cubic')cubic(a,s.c1,s.c2,b);else add(a);});return out;
}
export function landscapeOutlinePaths(o:LandscapeObject):LandscapePoint[][]{
 if(o.outline){return [o.outline.outer,...o.outline.holes].map((r,i)=>{const p=sampleLandscapeRing(r).map(v=>landscapeWorld(o,v));if((landscapeSignedArea(p)>0)!==(i===0))p.reverse();return p;});}
 if(o.polygon)return [o.polygon.map(p=>({...p}))];
 return [[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>landscapeWorld(o,{x:x*o.widthIn/2,z:z*o.depthIn/2}))];
}
export function convertLandscapeOutline(o:LandscapeObject):LandscapeObject{
 if(o.outline)return o;
 const points=landscapeOutlinePaths(o)[0].map(p=>landscapeLocal(o,p)),{polygon:_,...next}=o;
 return {...next,outline:{outer:{points,segments:points.map(()=>({kind:'line' as const}))},holes:[]}};
}
export function presetLandscapeOutline(preset:LandscapePreset,width:number,depth:number):LandscapeOutline{
 const x=width/2,z=depth/2,k=.5522847498307936;
 if(preset==='circle'||preset==='oval'){const points=[{x:x,z:0},{x:0,z:z},{x:-x,z:0},{x:0,z:-z}];return {outer:{points,segments:preset==='circle'&&Math.abs(width-depth)<1e-7?points.map(()=>({kind:'arc',bulgeIn:-x*(1-Math.SQRT1_2)})): [{kind:'cubic',c1:{x,z:k*z},c2:{x:k*x,z}},{kind:'cubic',c1:{x:-k*x,z},c2:{x:-x,z:k*z}},{kind:'cubic',c1:{x:-x,z:-k*z},c2:{x:-k*x,z:-z}},{kind:'cubic',c1:{x:k*x,z:-z},c2:{x,z:-k*z}}]},holes:[]};}
 if(preset==='kidney'){const points=[{x:-x,z:0},{x:-x*.25,z:-z},{x:x,z:0},{x:x*.2,z:z},{x:-x*.25,z:z*.25}],segments:LandscapeSegment[]=points.map((p,i)=>{const before=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length],after=points[(i+2)%points.length];return {kind:'cubic',c1:{x:p.x+(b.x-before.x)/6,z:p.z+(b.z-before.z)/6},c2:{x:b.x-(after.x-p.x)/6,z:b.z-(after.z-p.z)/6}};});return {outer:{points,segments},holes:[]};}
 if(preset==='rounded'){const r=Math.min(width,depth)/5,points=[{x:-x+r,z:-z},{x:x-r,z:-z},{x,z:-z+r},{x,z:z-r},{x:x-r,z},{x:-x+r,z},{x:-x,z:z-r},{x:-x,z:-z+r}];return {outer:{points,segments:points.map((_,i)=>i%2?{kind:'arc',bulgeIn:-r*(1-Math.SQRT1_2)}:{kind:'line'})},holes:[]};}
 const points=[{x:-x,z:-z},{x,z:-z},{x,z},{x:-x,z}];return {outer:{points,segments:points.map(()=>({kind:'line'}))},holes:[]};
}
export function insideLandscapeRing(p:LandscapePoint,ring:LandscapePoint[]){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)yes=!yes;}return yes;}
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&!Object.getOwnPropertySymbols(v).length&&Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>d.enumerable&&'value'in d);
const array=(v:unknown,min:number,max:number):v is unknown[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&v.length>=min&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>d&&d.enumerable&&'value'in d);
const point=(v:unknown):v is LandscapePoint=>plain(v)&&Object.keys(v).length===2&&['x','z'].every(k=>typeof v[k]==='number'&&Number.isFinite(v[k])&&Math.abs(v[k] as number)<=2400);
const cross=(a:LandscapePoint,b:LandscapePoint,c:LandscapePoint)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
function contacts(a:LandscapePoint,b:LandscapePoint,c:LandscapePoint,d:LandscapePoint){if(Math.max(a.x,b.x)<Math.min(c.x,d.x)-1e-7||Math.max(c.x,d.x)<Math.min(a.x,b.x)-1e-7||Math.max(a.z,b.z)<Math.min(c.z,d.z)-1e-7||Math.max(c.z,d.z)<Math.min(a.z,b.z)-1e-7)return false;return cross(a,b,c)*cross(a,b,d)<=1e-12&&cross(c,d,a)*cross(c,d,b)<=1e-12;}
export function validateLandscapeOutline(value:unknown):value is LandscapeOutline{
 try{
  if(!plain(value)||Object.keys(value).some(k=>!['outer','holes'].includes(k))||!array(value.holes,0,16))return false;
  const rings=[value.outer,...value.holes],paths:LandscapePoint[][]=[];
  for(const r of rings){if(!plain(r)||Object.keys(r).length!==2||!array(r.points,3,64)||!r.points.every(point)||!array(r.segments,r.points.length,r.points.length))return false;
   if(!r.segments.every(s=>plain(s)&&(s.kind==='line'?Object.keys(s).length===1:s.kind==='arc'?Object.keys(s).length===2&&typeof s.bulgeIn==='number'&&Number.isFinite(s.bulgeIn)&&Math.abs(s.bulgeIn)>1e-6&&Math.abs(s.bulgeIn)<=2400:s.kind==='cubic'?Object.keys(s).length===3&&point(s.c1)&&point(s.c2):false)))return false;
   const p=sampleLandscapeRing(r as unknown as LandscapeRing);if(Math.abs(landscapeSignedArea(p))<1||p.some((v,i)=>distance(v,p[(i+1)%p.length])<.00001))return false;
   for(let i=0;i<p.length;i++)for(let j=i+2;j<p.length;j++){if(i===0&&j===p.length-1)continue;if(contacts(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length]))return false;}paths.push(p);
  }
  if(paths.reduce((n,p)=>n+p.length,0)>MAX_SAMPLES)return false;
  for(let i=1;i<paths.length;i++){if(!insideLandscapeRing(paths[i][0],paths[0]))return false;for(let j=0;j<i;j++){if(j>0&&(insideLandscapeRing(paths[i][0],paths[j])||insideLandscapeRing(paths[j][0],paths[i])))return false;for(let a=0;a<paths[i].length;a++)for(let b=0;b<paths[j].length;b++)if(contacts(paths[i][a],paths[i][(a+1)%paths[i].length],paths[j][b],paths[j][(b+1)%paths[j].length]))return false;}}
  const p=paths.flat();return Math.max(...p.map(v=>v.x))-Math.min(...p.map(v=>v.x))<=2400.001&&Math.max(...p.map(v=>v.z))-Math.min(...p.map(v=>v.z))<=2400.001;
 }catch{return false;}
}
export type LandscapeHandle={ring:number;index:number;part:'point'|'c1'|'c2'|'bend'|'cup'};
export function editLandscapeHandle(o:LandscapeObject,h:LandscapeHandle,world:LandscapePoint):LandscapeObject{
 const p=landscapeLocal(o,world);
 if(h.part==='cup')return {...o,puttingCups:o.puttingCups?.map((v,i)=>i===h.index?p:v)};
 const next=structuredClone(convertLandscapeOutline(o)),r=h.ring===0?next.outline!.outer:next.outline!.holes[h.ring-1];if(!r?.points[h.index])throw Error('Choose a current outline handle.');
 if(h.part==='point'){const old=r.points[h.index];r.points[h.index]=p;r.segments=r.segments.map((s,i)=>{const end=(i+1)%r.points.length;if(s.kind==='arc'&&(i===h.index||end===h.index)){const a=i===h.index?old:r.points[i],b=end===h.index?old:r.points[end],g=arcGeometry({x:a.x,y:a.z},{x:b.x,y:b.z},s.bulgeIn),half=distance(r.points[i],r.points[end])/2;if(half>g.radius)throw Error('This edit cannot retain the arc radius. Increase the radius first.');const major=Math.abs(s.bulgeIn)>distance(a,b)/2;return {kind:'arc',bulgeIn:Math.sign(s.bulgeIn)*(g.radius+(major?1:-1)*Math.sqrt(g.radius*g.radius-half*half))};}if(s.kind==='cubic')return {...s,...(i===h.index?{c1:{x:s.c1.x+p.x-old.x,z:s.c1.z+p.z-old.z}}:{}),...(end===h.index?{c2:{x:s.c2.x+p.x-old.x,z:s.c2.z+p.z-old.z}}:{})};return s;});}
 else{const s=r.segments[h.index];if(h.part==='c1'||h.part==='c2'){if(s.kind!=='cubic')throw Error('Choose a smooth curve handle.');s[h.part]=p;}else{const a=r.points[h.index],b=r.points[(h.index+1)%r.points.length],len=distance(a,b),bulgeIn=((p.x-(a.x+b.x)/2)*-(b.z-a.z)+(p.z-(a.z+b.z)/2)*(b.x-a.x))/len;r.segments[h.index]=Math.abs(bulgeIn)<.01?{kind:'line'}:{kind:'arc',bulgeIn};}}
 return next;
}
export function splitLandscapeSegment(r:LandscapeRing,index:number):LandscapeRing{
 if(r.points.length>=64)throw Error('Remove a point before adding another.');const points=r.points.map(p=>({...p})),segments=structuredClone(r.segments),a=points[index],b=points[(index+1)%points.length],s=segments[index];let p=midpoint(a,b),left:LandscapeSegment={kind:'line'},right:LandscapeSegment=left;
 if(s.kind==='arc'){const g=arcGeometry({x:a.x,y:a.z},{x:b.x,y:b.z},s.bulgeIn);const len=distance(a,b),nx=-(b.z-a.z)/len,nz=(b.x-a.x)/len;p={x:(a.x+b.x)/2+nx*s.bulgeIn,z:(a.z+b.z)/2+nz*s.bulgeIn};left=right={kind:'arc',bulgeIn:Math.sign(s.bulgeIn)*g.radius*(1-Math.cos(g.sweep/4))};}
 if(s.kind==='cubic'){const ab=midpoint(a,s.c1),bc=midpoint(s.c1,s.c2),cd=midpoint(s.c2,b),abc=midpoint(ab,bc),bcd=midpoint(bc,cd);p=midpoint(abc,bcd);left={kind:'cubic',c1:ab,c2:abc};right={kind:'cubic',c1:bcd,c2:cd};}points.splice(index+1,0,p);segments.splice(index,1,left,right);return {points,segments};
}
export function landscapeSegmentKind(r:LandscapeRing,index:number,kind:LandscapeSegment['kind']):LandscapeRing{const next=structuredClone(r),a=r.points[index],b=r.points[(index+1)%r.points.length];next.segments[index]=kind==='line'?{kind}:kind==='arc'?{kind,bulgeIn:-distance(a,b)/6}:{kind,c1:{x:a.x+(b.x-a.x)/3,z:a.z+(b.z-a.z)/3},c2:{x:a.x+(b.x-a.x)*2/3,z:a.z+(b.z-a.z)*2/3}};return next;}
export function resizeLandscape(o:LandscapeObject,width:number,depth:number,convertArcs=false):LandscapeObject{
 const next=structuredClone(convertLandscapeOutline(o)),sx=width/o.widthIn,sz=depth/o.depthIn;
 for(const r of [next.outline!.outer,...next.outline!.holes]){if(Math.abs(sx-sz)>1e-8&&r.segments.some(s=>s.kind==='arc')){if(!convertArcs)throw Error('Circular arcs require uniform scaling. Explicitly convert them to smooth curves first.');r.segments=r.segments.map((s,i)=>{if(s.kind!=='arc')return s;const a=r.points[i],b=r.points[(i+1)%r.points.length],g=arcGeometry({x:a.x,y:a.z},{x:b.x,y:b.z},s.bulgeIn);if(g.sweep>Math.PI/2+.001)throw Error('Split large arcs before converting to smooth curves.');const cx=g.center.x,cz=g.center.y,k=4/3*Math.tan(g.sweep/4)*-Math.sign(s.bulgeIn);return {kind:'cubic',c1:{x:a.x-k*(a.z-cz),z:a.z+k*(a.x-cx)},c2:{x:b.x+k*(b.z-cz),z:b.z-k*(b.x-cx)}};});}r.points=r.points.map(p=>({x:p.x*sx,z:p.z*sz}));r.segments=r.segments.map(s=>s.kind==='arc'?{...s,bulgeIn:s.bulgeIn*sx}:s.kind==='cubic'?{...s,c1:{x:s.c1.x*sx,z:s.c1.z*sz},c2:{x:s.c2.x*sx,z:s.c2.z*sz}}:s);}
 return {...next,widthIn:width,depthIn:depth,puttingCups:next.puttingCups};
}
export function simplifyLandscapeStroke(points:LandscapePoint[],tolerance:number):LandscapeRing{
 if(points.length<3)throw Error('Draw a closed area with at least three points.');
 const simplify=(p:LandscapePoint[]):LandscapePoint[]=>{if(p.length<3)return p;const a=p[0],b=p.at(-1)!,dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;let index=0,best=tolerance;for(let i=1;i<p.length-1;i++){const t=den?Math.max(0,Math.min(1,((p[i].x-a.x)*dx+(p[i].z-a.z)*dz)/den)):0,d=distance(p[i],{x:a.x+t*dx,z:a.z+t*dz});if(d>best){best=d;index=i;}}return index?[...simplify(p.slice(0,index+1)).slice(0,-1),...simplify(p.slice(index))]:[a,b];};
 const far=points.reduce((best,p,i)=>distance(p,points[0])>distance(points[best],points[0])?i:best,1),p=[...simplify(points.slice(0,far+1)).slice(0,-1),...simplify([...points.slice(far),points[0]]).slice(0,-1)];if(p.length>64)throw Error('Increase smoothing to keep the outline within 64 control points.');return {points:p,segments:p.map(()=>({kind:'line'}))};
}

export function reframeLandscape(o:LandscapeObject):LandscapeObject {
 if(!o.outline)return o;const points=sampleLandscapeRing(o.outline.outer),loX=Math.min(...points.map(p=>p.x)),hiX=Math.max(...points.map(p=>p.x)),loZ=Math.min(...points.map(p=>p.z)),hiZ=Math.max(...points.map(p=>p.z)),cx=(loX+hiX)/2,cz=(loZ+hiZ)/2,origin=landscapeWorld(o,{x:cx,z:cz}),shift=(p:LandscapePoint)=>({x:p.x-cx,z:p.z-cz}),ring=(r:LandscapeRing)=>({points:r.points.map(shift),segments:r.segments.map(s=>s.kind==='cubic'?{...s,c1:shift(s.c1),c2:shift(s.c2)}:s)});
 return {...o,xIn:origin.x,zIn:origin.z,widthIn:hiX-loX,depthIn:hiZ-loZ,outline:{outer:ring(o.outline.outer),holes:o.outline.holes.map(ring)},puttingCups:o.puttingCups?.map(shift),...(o.fillSeed?{fillSeed:shift(o.fillSeed)}:{})};
}
