import type {PlanPoint} from './lib/deckGeometry';
import type {SiteSurface} from './siteSurface';
import type {YardFeature} from './types';
import {wallConstructionPlan} from './wallConstruction';
import {registerWallStepsRuntime} from './wallFoundation';
export function steppedWallPlan(f:YardFeature,grade:number,grades:number[]){
 const minimumTop=f.wallTopSteps?.length?Math.min(f.finishedElevationIn??grade+(f.baseElevationIn??0)+f.heightIn,...f.wallTopSteps.map(step=>step.elevationIn)):undefined;
 if(f.wallTopSteps?.length){const highest=Math.max(f.finishedElevationIn??grade+(f.baseElevationIn??0)+f.heightIn,...f.wallTopSteps.map(step=>step.elevationIn));f={...f,finishedElevationIn:highest};}
const p=wallConstructionPlan(f,grade,grades);if(minimumTop!==undefined&&p.bottom>minimumTop-p.cap-p.course+1e-7){const count=Math.ceil((p.top-minimumTop+p.course)/p.course-1e-8),bottom=p.top-p.cap-count*p.course,totalBodyHeightIn=p.top-p.cap-bottom,layers:number[]=[];for(let row=1;row<count;row+=p.everyCourses)layers.push(bottom+row*p.course);if(!layers.length)layers.push(p.top-p.cap);return {...p,count,bottom,totalBodyHeightIn,layers,burialIn:p.base-bottom,minBurialIn:Math.min(...grades)+(f.baseElevationIn??0)-bottom,maxBurialIn:Math.max(...grades)+(f.baseElevationIn??0)-bottom,lengthIn:Math.max(p.lengthIn,totalBodyHeightIn*.6),maxSetbackIn:Math.max(0,count-1)*p.setbackPerCourseIn};}return p;
}
export function measuredWallFaceCuts(surface:SiteSurface,a:PlanPoint,b:PlanPoint,frontA:PlanPoint,frontB:PlanPoint,run:number,ux:number,uy:number,depthIn:number,maxSetbackIn:number){
 const back=depthIn/2+maxSetbackIn,backA={x:a.x-uy*back,y:a.y+ux*back},backB={x:b.x-uy*back,y:b.y+ux*back},vertices=surface.proposedTriangles.flatMap(t=>t.vertices).flatMap(v=>{const x=v.xIn-a.x,z=v.zIn-a.y,along=x*ux+z*uy,across=-x*uy+z*ux;return along>0&&along<run&&across>=-depthIn/2-1e-7&&across<=back+1e-7?[along/run]:[];});
 return [...new Set([...surface.lineBreaks(frontA,frontB),...surface.lineBreaks(backA,backB),...vertices].map(t=>Number(t.toFixed(10))))].sort((a,b)=>a-b);
}
registerWallStepsRuntime({steppedWallPlan,measuredWallFaceCuts});
