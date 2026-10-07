import {validateGradingTransitions} from './gradingTransitionValidation';
import type {SiteGradingTransition,SiteFeaturePad} from './siteModel';
import {GROUND_FIT_LIMITS} from './types';
/** Survey coordinates and all model elevations use world inches on the deck's
 * existing zero datum. Importers must apply an explicit datum conversion. */
export interface SitePoint {id:string;xIn:number;zIn:number;elevationIn:number}
export interface SiteBoundaryPoint {x:number;y:number}
export interface SiteGradingRegion {id:string;name:string;boundary:SiteBoundaryPoint[];originXIn:number;originZIn:number;elevationIn:number;slopeXPct:number;slopeZPct:number}
export interface SiteOverlay {attachmentId:string;name:string;widthPx:number;heightPx:number;scaleInPerPx:number;rotationDeg:number;originXIn:number;originZIn:number}
export interface SiteModel {version:1;points:SitePoint[];boundary?:SiteBoundaryPoint[];grading:SiteGradingRegion[];transitions?:SiteGradingTransition[];overlay?:SiteOverlay;featurePads?:SiteFeaturePad[];featurePadOccupied?:SiteBoundaryPoint[][]}
export const SITE_LIMITS={points:2000,boundaryPoints:256,gradingRegions:64,coordinateIn:1_200_000,elevationIn:120_000};
function fail(message:string):never{throw Error(message);}
function plain(value:unknown,allowed:string[],required:string[],label:string):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Object.getOwnPropertySymbols(value).length)fail(`${label} must use plain data.`);
 const ds=Object.getOwnPropertyDescriptors(value);
 if(Object.keys(ds).some(k=>!allowed.includes(k)||!ds[k].enumerable||!('value'in ds[k]))||required.some(k=>!Object.hasOwn(ds,k)))fail(`${label} has invalid or missing fields.`);
 return value as Record<string,unknown>;
}
function list(value:unknown,min:number,max:number,label:string):unknown[]{
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||Object.getOwnPropertySymbols(value).length||value.length<min||value.length>max)fail(`${label} requires ${min}–${max} plain entries.`);
 const ds=Object.getOwnPropertyDescriptors(value);
 if(Object.keys(ds).some(k=>k!=='length'&&((!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=value.length)||!ds[k].enumerable||!('value'in ds[k])))||Array.from({length:value.length},(_,i)=>i).some(i=>!Object.hasOwn(ds,String(i))))fail(`${label} must be a dense plain array.`);
 return value;
}
function numeric(value:unknown,limit:number,label:string,min=-limit):number{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>limit)fail(`${label} is out of range.`);return value;}
function text(value:unknown,max:number,label:string):string{if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f]/.test(value))fail(`${label} is invalid.`);return value;}
const cross=(a:SiteBoundaryPoint,b:SiteBoundaryPoint,c:SiteBoundaryPoint)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const on=(a:SiteBoundaryPoint,b:SiteBoundaryPoint,p:SiteBoundaryPoint)=>Math.abs(cross(a,b,p))<1e-7&&p.x>=Math.min(a.x,b.x)-1e-7&&p.x<=Math.max(a.x,b.x)+1e-7&&p.y>=Math.min(a.y,b.y)-1e-7&&p.y<=Math.max(a.y,b.y)+1e-7;
function intersects(a:SiteBoundaryPoint,b:SiteBoundaryPoint,c:SiteBoundaryPoint,d:SiteBoundaryPoint){const ab0=cross(a,b,c),ab1=cross(a,b,d),cd0=cross(c,d,a),cd1=cross(c,d,b);return ab0*ab1<0&&cd0*cd1<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);}
function polygon(value:unknown,label:string,maxPoints:number=SITE_LIMITS.boundaryPoints):SiteBoundaryPoint[]{
 const out=list(value,3,maxPoints,label).map((v,i)=>{const r=plain(v,['x','y'],['x','y'],`${label} point ${i+1}`);return {x:numeric(r.x,SITE_LIMITS.coordinateIn,'Boundary X'),y:numeric(r.y,SITE_LIMITS.coordinateIn,'Boundary Z')};});
 const keys=new Set<string>();let area=0;
 for(let i=0;i<out.length;i++){const a=out[i],b=out[(i+1)%out.length],key=`${Math.round(a.x*1e5)}:${Math.round(a.y*1e5)}`;if(keys.has(key))fail(`${label} repeats a vertex.`);keys.add(key);area+=a.x*b.y-b.x*a.y;
  if(out.length<=SITE_LIMITS.boundaryPoints)for(let j=i+1;j<out.length;j++){if(j===i+1||i===0&&j===out.length-1)continue;if(intersects(a,b,out[j],out[(j+1)%out.length]))fail(`${label} crosses or touches itself.`);}}
 // Finely tessellated curved outlines: the same test, swept over edges whose x ranges overlap.
 if(out.length>SITE_LIMITS.boundaryPoints){const n=out.length,order=Array.from({length:n},(_,i)=>i).sort((i,j)=>Math.min(out[i].x,out[(i+1)%n].x)-Math.min(out[j].x,out[(j+1)%n].x)),active:number[]=[];
  for(const i of order){const a=out[i],b=out[(i+1)%n],lo=Math.min(a.x,b.x);for(let k=active.length-1;k>=0;k--){const j=active[k];if(Math.max(out[j].x,out[(j+1)%n].x)<lo-1e-7){active.splice(k,1);continue;}if(Math.abs(i-j)===1||Math.abs(i-j)===n-1)continue;if(intersects(a,b,out[j],out[(j+1)%n]))fail(`${label} crosses or touches itself.`);}active.push(i);}}
 if(Math.abs(area)<.0002)fail(`${label} has no usable area.`);
 return area>0?out:out.reverse();
}
/** Derived ground-fit pads (siteModel.ts SiteFeaturePad): never saved, but checked as strictly as the survey because
 * they shape the measured ground. Curved patio outlines are finely tessellated, hence the larger ring budget. */
export const FEATURE_PAD_LIMITS={pads:64,rings:16,ringPoints:20000,occupiedRings:256};
export function validateFeaturePads(value:unknown):SiteFeaturePad[]{
 const ids=new Set<string>();
 return list(value,0,FEATURE_PAD_LIMITS.pads,'Ground-fit pads').map((v,i)=>{const r=plain(v,['featureId','name','rings','plane','slopeRatio','lowEdge'],['featureId','name','rings','plane','slopeRatio'],`Ground-fit pad ${i+1}`),featureId=text(r.featureId,200,'Pad feature ID');if(ids.has(featureId))fail(`Duplicate ground-fit pad: ${featureId}.`);ids.add(featureId);
  const p=plain(r.plane,['x','z','constant'],['x','z','constant'],'Pad plane'),plane={x:numeric(p.x,1,'Pad plane X slope'),z:numeric(p.z,1,'Pad plane Z slope'),constant:numeric(p.constant,SITE_LIMITS.elevationIn+2*SITE_LIMITS.coordinateIn,'Pad plane level')},rings=list(r.rings,1,FEATURE_PAD_LIMITS.rings,'Pad rings').map(ring=>polygon(ring,'Pad ring',FEATURE_PAD_LIMITS.ringPoints));
  for(const ring of rings)for(const q of ring)numeric(plane.x*q.x+plane.z*q.y+plane.constant,SITE_LIMITS.elevationIn,'Pad edge elevation');
  if(r.lowEdge!==undefined&&r.lowEdge!=='stone')fail('Pad low edge is invalid.');
  return {featureId,name:text(r.name,120,'Pad name'),rings,plane,slopeRatio:numeric(r.slopeRatio,GROUND_FIT_LIMITS.maxRatio,'Pad slope ratio',GROUND_FIT_LIMITS.minRatio),...(r.lowEdge==='stone'?{lowEdge:'stone' as const}:{})};});
}
/** Derived outlines of other paving near the pads (their bank needs no restoring); never saved. */
export function validateFeaturePadOccupied(value:unknown):SiteBoundaryPoint[][]{return list(value,0,FEATURE_PAD_LIMITS.occupiedRings,'Paving beside ground-fit pads').map(ring=>polygon(ring,'Paving outline',FEATURE_PAD_LIMITS.ringPoints));}
function checkedSiteModel(value:unknown,derived:boolean):SiteModel{
 const r=plain(value,['version','points','boundary','grading','transitions','overlay','featurePads','featurePadOccupied'],['version','points','grading'],'Site model');if(r.version!==1)fail('Unsupported site model version.');
 const ids=new Set<string>(),xy=new Set<string>(),points=list(r.points,3,SITE_LIMITS.points,'Survey points').map((v,i)=>{const p=plain(v,['id','xIn','zIn','elevationIn'],['id','xIn','zIn','elevationIn'],`Survey point ${i+1}`),id=text(p.id,100,'Point ID'),xIn=numeric(p.xIn,SITE_LIMITS.coordinateIn,'Point X'),zIn=numeric(p.zIn,SITE_LIMITS.coordinateIn,'Point Z'),elevationIn=numeric(p.elevationIn,SITE_LIMITS.elevationIn,'Point elevation'),key=`${Math.round(xIn*1e5)}:${Math.round(zIn*1e5)}`;
 if(ids.has(id))fail(`Duplicate survey point ID: ${id}.`);if(xy.has(key))fail(`Duplicate or conflicting survey XY at point ${id}.`);ids.add(id);xy.add(key);return {id,xIn,zIn,elevationIn};});
 const a={x:points[0].xIn,y:points[0].zIn},b={x:points[1].xIn,y:points[1].zIn};if(!points.some(p=>Math.abs(cross(a,b,{x:p.xIn,y:p.zIn}))>.0001))fail('Survey points are collinear.');
 const gradeIds=new Set<string>(),grading=list(r.grading,0,SITE_LIMITS.gradingRegions,'Grading regions').map((v,i)=>{const g=plain(v,['id','name','boundary','originXIn','originZIn','elevationIn','slopeXPct','slopeZPct'],['id','name','boundary','originXIn','originZIn','elevationIn','slopeXPct','slopeZPct'],`Grading region ${i+1}`),id=text(g.id,100,'Grading ID');if(gradeIds.has(id))fail('Duplicate grading region ID.');gradeIds.add(id);return {id,name:text(g.name,120,'Grading name'),boundary:polygon(g.boundary,'Grading boundary'),originXIn:numeric(g.originXIn,SITE_LIMITS.coordinateIn,'Grading origin X'),originZIn:numeric(g.originZIn,SITE_LIMITS.coordinateIn,'Grading origin Z'),elevationIn:numeric(g.elevationIn,SITE_LIMITS.elevationIn,'Grading elevation'),slopeXPct:numeric(g.slopeXPct,100,'Grading X slope'),slopeZPct:numeric(g.slopeZPct,100,'Grading Z slope')};});
 for(const g of grading)for(const v of g.boundary)numeric(g.elevationIn+(v.x-g.originXIn)*g.slopeXPct/100+(v.y-g.originZIn)*g.slopeZPct/100,SITE_LIMITS.elevationIn,'Grading corner elevation');
 const out:SiteModel={version:1,points,grading};if(r.transitions!==undefined)out.transitions=validateGradingTransitions(r.transitions);if(r.boundary!==undefined)out.boundary=polygon(r.boundary,'Site boundary');if(derived&&r.featurePads!==undefined)out.featurePads=validateFeaturePads(r.featurePads);if(derived&&r.featurePadOccupied!==undefined)out.featurePadOccupied=validateFeaturePadOccupied(r.featurePadOccupied);
 if(r.overlay!==undefined){const o=plain(r.overlay,['attachmentId','name','widthPx','heightPx','scaleInPerPx','rotationDeg','originXIn','originZIn'],['attachmentId','name','widthPx','heightPx','scaleInPerPx','rotationDeg','originXIn','originZIn'],'Site overlay');const widthPx=numeric(o.widthPx,65535,'Overlay width',1),heightPx=numeric(o.heightPx,65535,'Overlay height',1);if(!Number.isInteger(widthPx)||!Number.isInteger(heightPx))fail('Overlay dimensions must be whole pixels.');out.overlay={attachmentId:text(o.attachmentId,200,'Attachment ID'),name:text(o.name,120,'Overlay name'),widthPx,heightPx,scaleInPerPx:numeric(o.scaleInPerPx,12000,'Overlay scale',.000001),rotationDeg:numeric(o.rotationDeg,360,'Overlay rotation'),originXIn:numeric(o.originXIn,SITE_LIMITS.coordinateIn,'Overlay origin X'),originZIn:numeric(o.originZIn,SITE_LIMITS.coordinateIn,'Overlay origin Z')};}
 return out;
}
/** Reject getters/unknown keys before reading nested values. Return a clean clone so downstream triangulation never
 * relies on caller prototypes. Ground-fit pads are derived from the patios (designSiteModel) and never loaded or saved:
 * an old file that carries them loads without them. */
export function validateSiteModel(value:unknown):SiteModel{return checkedSiteModel(value,false);}
/** The surface engine's own check of a design's derived model (designSiteModel), whose ground-fit pads it accepts. */
export function validateDerivedSiteModel(value:unknown):SiteModel{return checkedSiteModel(value,true);}
export function siteModelProblem(value:unknown){try{validateSiteModel(value);return '';}catch(error){return error instanceof Error?error.message:'Invalid site model.';}}

import {registerSiteModelRuntime} from './siteModel';
registerSiteModelRuntime({validateSiteModel,siteModelProblem});
