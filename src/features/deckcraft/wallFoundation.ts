import type {PlanPoint} from './lib/deckGeometry';
import {wallConstructionPlan} from './wallConstruction';
import type {YardFeature} from './types';
import {yardPathEnvelope} from './yardPathGeometry';
import type {SiteSurface} from './siteSurface';
export type WallPlan=ReturnType<typeof wallConstructionPlan>;
export interface WallFoundationSection {segment:number;startIn:number;endIn:number;bottomIn:number;topIn?:number}
type Steps=Pick<typeof import('./wallFoundationStepsRuntime'),'steppedWallPlan'|'measuredWallFaceCuts'>;
let steps:Steps|undefined;
export function registerWallStepsRuntime(value:Steps){steps=value;}
/** Shift a directed path toward its retained side, with bounded corner mitres.
 * Stock depth stays fixed; only the course position changes. */
export function wallCoursePath(points:PlanPoint[],offsetIn:number):PlanPoint[]{
 if(!offsetIn)return points;
 return points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],before=i?Math.hypot(p.x-a.x,p.y-a.y):Math.hypot(b.x-p.x,b.y-p.y),after=i<points.length-1?Math.hypot(b.x-p.x,b.y-p.y):before;
 const n0=i?{x:-(p.y-a.y)/before,y:(p.x-a.x)/before}:{x:-(b.y-p.y)/after,y:(b.x-p.x)/after},n1=i<points.length-1?{x:-(b.y-p.y)/after,y:(b.x-p.x)/after}:n0,scale=Math.min(4,1/Math.max(1e-8,1+n0.x*n1.x+n0.y*n1.y));
 return {x:p.x+(n0.x+n1.x)*offsetIn*scale,y:p.y+(n0.y+n1.y)*offsetIn*scale};});
}
/** Include the complete batter envelope in the front-grade burial check.
 * Iterate because lower terrain may add a course, which adds setback. */
export function wallConstructionForPath(f:YardFeature,grade:number,points:PlanPoint[],gradeAt:(z:number,x?:number)=>number,surface?:SiteSurface,paved=false){
 const plan=(grades:number[])=>{if(!f.wallTopSteps?.length)return wallConstructionPlan(f,grade,grades,paved);if(!steps)throw Error('Stepped wall geometry is loading. Prepare the design before calculating or exporting.');return steps.steppedWallPlan(f,grade,grades);};
 const depth=f.depthFt*12,extrema=(paths:PlanPoint[][])=>{if(surface){const range=surface.extrema(paths);return Number.isFinite(range.min+range.max)?[range.min,range.max]:[grade];}return paths.flat().map(v=>gradeAt(v.y,v.x));},grades=extrema(yardPathEnvelope(points,depth));let p=plan(grades);
 for(let i=0;i<8;i++){const next=plan([...grades,...extrema(yardPathEnvelope(wallCoursePath(points,p.maxSetbackIn),depth))]);if(next.count===p.count)return next;p=next;}
 return p;
}
/** Level benches on whole-course datums, starting from the lowest base.
 * The cuts are planning bench limits, not a manufacturer's block-cut schedule. */
export function wallFoundationSections(points:PlanPoint[],p:WallPlan,depthIn:number,gradeAt:(z:number,x?:number)=>number,datumShiftIn=0,surface?:SiteSurface):WallFoundationSection[]{
 const out:WallFoundationSection[]=[];
 for(let seg=0;seg+1<points.length;seg++){
  const a=points[seg],b=points[seg+1],run=Math.hypot(b.x-a.x,b.y-a.y),ux=(b.x-a.x)/run;
  const uy=(b.y-a.y)/run,frontA={x:a.x+uy*depthIn/2,y:a.y-ux*depthIn/2},frontB={x:b.x+uy*depthIn/2,y:b.y-ux*depthIn/2},cuts=[0,run];
  let faceCuts=[0,1];if(surface){if(!steps)throw Error('Measured wall geometry is loading. Prepare the design before calculating or exporting.');faceCuts=steps.measuredWallFaceCuts(surface,a,b,frontA,frontB,run,ux,uy,depthIn,p.maxSetbackIn);}
  // Preserve every measured face crossing before locating full-course grade
  // thresholds. A ridge and valley can occur within one drawn wall segment.
  for(let face=0;face+1<faceCuts.length;face++){
   const left=faceCuts[face],right=faceCuts[face+1],inset=(right-left)*1e-7,sample=(t:number)=>gradeAt(frontA.y+(frontB.y-frontA.y)*t,frontA.x+(frontB.x-frontA.x)*t)+datumShiftIn,h0=sample(left+inset),h1=sample(right-inset),g0=h0-(h1-h0)*inset/(right-left-2*inset),g1=h1+(h1-h0)*inset/(right-left-2*inset);
   if(!Number.isFinite(g0+g1))continue;cuts.push(run*left,run*right);
   if(p.foundationMode==='stepped'&&Math.abs(g1-g0)>1e-9)for(let row=1;row<p.count;row++){const ground=p.bottom+row*p.course+p.minimumBurialIn,t=(ground-g0)/(g1-g0);if(t>1e-8&&t<1-1e-8)cuts.push(run*(left+(right-left)*t));}
  }
  const unique=[...new Set(cuts.map(v=>Number(v.toFixed(7))))].sort((a,b)=>a-b);
  for(let i=0;i+1<unique.length;i++){
   const mid=(unique[i]+unique[i+1])/2,g=gradeAt(frontA.y+uy*mid,frontA.x+ux*mid)+datumShiftIn,raise=p.foundationMode==='stepped'?Math.max(0,Math.min(p.count-1,Math.floor((g-p.minimumBurialIn-p.bottom)/p.course+1e-8))):0;
   out.push({segment:seg,startIn:i?unique[i]:-1e6,endIn:i+2<unique.length?unique[i+1]:1e6,bottomIn:p.bottom+raise*p.course});
  }
 }
 return out;
}
/** A wide slice perpendicular to the original segment. It partitions benches
 * without creating gaps in the bounded corner zones. */
export function wallSectionMask(points:PlanPoint[],section:WallFoundationSection):PlanPoint[]{
 const a=points[section.segment],b=points[section.segment+1],run=Math.hypot(b.x-a.x,b.y-a.y),ux=(b.x-a.x)/run,uy=(b.y-a.y)/run,nx=-uy,ny=ux,reach=1e5;
 return [[section.startIn,-reach],[section.endIn,-reach],[section.endIn,reach],[section.startIn,reach]].map(([u,v])=>({x:a.x+ux*u+nx*v,y:a.y+uy*u+ny*v}));
}
