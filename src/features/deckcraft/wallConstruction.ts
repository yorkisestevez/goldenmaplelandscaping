import type {YardFeature} from './types';
import {hardscapeSelection} from './hardscapeCatalogue';
import {yardWallCourses} from './yardElevations';
/** Planning quantities, not a reinforcement design. Every wall includes grid. */
export interface WallConstruction {
 geogridLengthIn?:number;geogridEveryCourses?:number;
 foundationMode?:'level'|'stepped';setbackPerCourseIn?:number;
 drainOutletCount?:number;drainOutletLengthFt?:number;
 /** Surveyed discharge invert on the deck datum, and entered required fall.
  * Neither input approves the route, discharge location or collection grade. */
 drainOutletElevationIn?:number;drainOutletFallPct?:number;
}
export const RAFFINATO_SETBACK_SOURCE='https://www.techo-bloc.com/assets/3b/4b/3b4b1d1f-8814-4b18-b193-386b582fdbd7/Raffinato_Wall_Specs_EN.pdf';
export const WALL_FOUNDATION_SOURCE='https://www.techo-bloc.com/assets/1f/a6/1fa6d9e2-1be1-4550-8d88-46bfdeceb120/WALLS_Installation-guide-EN.pdf';
/** Raffinato's published setback position is 4.4 degrees: an optional system
 * position, not a universal default. The vertical position remains unchanged. */
export function manufacturerWallSetback(f:YardFeature){
 const s=hardscapeSelection(f);
 return s?.product.id==='techo-raffinato-wall'?{angleDeg:4.4,perCourseIn:Math.tan(4.4*Math.PI/180)*(s.unit.heightMm/25.4),sourceUrl:RAFFINATO_SETBACK_SOURCE}:undefined;
}
export function wallConstructionProblem(f:YardFeature){
 const v=f.wallConstruction;if(v===undefined)return '';
 if(f.kind!=='retaining-wall'||!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Object.getOwnPropertySymbols(v).length)return 'Only walls support plain construction inputs.';
 const ds=Object.getOwnPropertyDescriptors(v),allowed=['geogridLengthIn','geogridEveryCourses','foundationMode','setbackPerCourseIn','drainOutletCount','drainOutletLengthFt','drainOutletElevationIn','drainOutletFallPct'];
 if(Object.keys(ds).some(k=>!allowed.includes(k)||!ds[k].enumerable||!('value'in ds[k])))return 'Invalid wall construction inputs.';
 if(v.geogridLengthIn!==undefined&&(!Number.isFinite(v.geogridLengthIn)||v.geogridLengthIn<48||v.geogridLengthIn>240))return 'Grid planning length must be 48 to 240 inches.';
 if(v.geogridEveryCourses!==undefined&&(!Number.isInteger(v.geogridEveryCourses)||v.geogridEveryCourses<1||v.geogridEveryCourses>6))return 'Grid course interval must be a whole number from 1 to 6.';
 if(v.foundationMode!==undefined&&!['level','stepped'].includes(v.foundationMode))return 'Choose a level or stepped wall foundation.';
 if(v.setbackPerCourseIn!==undefined&&(!Number.isFinite(v.setbackPerCourseIn)||v.setbackPerCourseIn<0||v.setbackPerCourseIn>2))return 'Course setback must be 0 to 2 inches.';
 if(v.drainOutletCount!==undefined&&(!Number.isInteger(v.drainOutletCount)||v.drainOutletCount<1||v.drainOutletCount>20))return 'Drain outlet count must be a whole number from 1 to 20.';
 if(v.drainOutletLengthFt!==undefined&&(!Number.isFinite(v.drainOutletLengthFt)||v.drainOutletLengthFt<0||v.drainOutletLengthFt>200))return 'Total solid outlet pipe must be 0 to 200 feet.';
 if(v.drainOutletElevationIn!==undefined&&(!Number.isFinite(v.drainOutletElevationIn)||Math.abs(v.drainOutletElevationIn)>120000))return 'Surveyed outlet invert must be within ±120,000 world inches.';
 if(v.drainOutletFallPct!==undefined&&(!Number.isFinite(v.drainOutletFallPct)||v.drainOutletFallPct<.01||v.drainOutletFallPct>100))return 'Entered required outlet fall must be 0.01 to 100 percent.';
 return '';
}
export function wallConstructionPlan(f:YardFeature,grade:number,frontGrades:number[]=[grade]){
 const supplier=hardscapeSelection(f),initial=yardWallCourses(f,grade),depth=f.depthFt*12;
 const low=Math.min(...frontGrades)+(f.baseElevationIn??0),high=Math.max(...frontGrades)+(f.baseElevationIn??0);
 const minBurial=supplier?.product.brand==='Techo-Bloc'?Math.max(initial.course,6,(initial.top-low)*.1):Math.max(initial.course,6);
 const count=Math.max(initial.count,Math.ceil((initial.top-initial.cap-low+minBurial)/initial.course-1e-9));
 const bottom=initial.top-initial.cap-count*initial.course,totalBodyHeightIn=initial.top-initial.cap-bottom;
 const defaultLength=Math.max(48,totalBodyHeightIn*.6),lengthIn=Math.max(defaultLength,f.wallConstruction?.geogridLengthIn??0);
 const maxInterval=Math.max(1,Math.floor(Math.min(18,depth*2)/initial.course));
 const everyCourses=Math.min(maxInterval,f.wallConstruction?.geogridEveryCourses??maxInterval),layers:number[]=[];
 for(let row=1;row<count;row+=everyCourses)layers.push(bottom+row*initial.course);
 if(!layers.length)layers.push(initial.top-initial.cap);
 const drainageDepthIn=supplier?.product.brand==='Techo-Bloc'?Math.max(12,24-depth):12,baseDepthIn=f.productId==='permacon-urbano-wall'?12:6;
 const setbackPerCourseIn=f.wallConstruction?.setbackPerCourseIn??0,maxSetbackIn=Math.max(0,count-1)*setbackPerCourseIn;
 return {...initial,count,bottom,burialIn:initial.base-bottom,minBurialIn:low-bottom,maxBurialIn:high-bottom,minExposedHeightIn:initial.top-high,maxExposedHeightIn:initial.top-low,totalBodyHeightIn,minimumBurialIn:minBurial,baseDepthIn,drainageDepthIn,lengthIn,everyCourses,maxEveryCourses:maxInterval,layers,setbackPerCourseIn,maxSetbackIn,batterAngleDeg:Math.atan(setbackPerCourseIn/initial.course)*180/Math.PI,foundationMode:f.wallConstruction?.foundationMode??'stepped',drainOutletCount:f.wallConstruction?.drainOutletCount??1,drainOutletLengthFt:f.wallConstruction?.drainOutletLengthFt??0,planning:true as const};
}
