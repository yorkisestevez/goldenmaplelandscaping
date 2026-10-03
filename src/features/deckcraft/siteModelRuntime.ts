import {validateGradingTransitions} from './gradingTransitionValidation';
import type {SiteGradingTransition} from './siteModel';
/** Survey coordinates and all model elevations use world inches on the deck's
 * existing zero datum. Importers must apply an explicit datum conversion. */
export interface SitePoint {id:string;xIn:number;zIn:number;elevationIn:number}
export interface SiteBoundaryPoint {x:number;y:number}
export interface SiteGradingRegion {id:string;name:string;boundary:SiteBoundaryPoint[];originXIn:number;originZIn:number;elevationIn:number;slopeXPct:number;slopeZPct:number}
export interface SiteOverlay {attachmentId:string;name:string;widthPx:number;heightPx:number;scaleInPerPx:number;rotationDeg:number;originXIn:number;originZIn:number}
export interface SiteModel {version:1;points:SitePoint[];boundary?:SiteBoundaryPoint[];grading:SiteGradingRegion[];transitions?:SiteGradingTransition[];overlay?:SiteOverlay}
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
function polygon(value:unknown,label:string):SiteBoundaryPoint[]{
 const out=list(value,3,SITE_LIMITS.boundaryPoints,label).map((v,i)=>{const r=plain(v,['x','y'],['x','y'],`${label} point ${i+1}`);return {x:numeric(r.x,SITE_LIMITS.coordinateIn,'Boundary X'),y:numeric(r.y,SITE_LIMITS.coordinateIn,'Boundary Z')};});
 const keys=new Set<string>();let area=0;
 for(let i=0;i<out.length;i++){const a=out[i],b=out[(i+1)%out.length],key=`${Math.round(a.x*1e5)}:${Math.round(a.y*1e5)}`;if(keys.has(key))fail(`${label} repeats a vertex.`);keys.add(key);area+=a.x*b.y-b.x*a.y;
  for(let j=i+1;j<out.length;j++){if(j===i+1||i===0&&j===out.length-1)continue;if(intersects(a,b,out[j],out[(j+1)%out.length]))fail(`${label} crosses or touches itself.`);}}
 if(Math.abs(area)<.0002)fail(`${label} has no usable area.`);
 return area>0?out:out.reverse();
}
/** Reject getters/unknown keys before reading nested values. Return a clean
 * clone so downstream triangulation never relies on caller prototypes. */
export function validateSiteModel(value:unknown):SiteModel{
 const r=plain(value,['version','points','boundary','grading','transitions','overlay'],['version','points','grading'],'Site model');if(r.version!==1)fail('Unsupported site model version.');
 const ids=new Set<string>(),xy=new Set<string>(),points=list(r.points,3,SITE_LIMITS.points,'Survey points').map((v,i)=>{const p=plain(v,['id','xIn','zIn','elevationIn'],['id','xIn','zIn','elevationIn'],`Survey point ${i+1}`),id=text(p.id,100,'Point ID'),xIn=numeric(p.xIn,SITE_LIMITS.coordinateIn,'Point X'),zIn=numeric(p.zIn,SITE_LIMITS.coordinateIn,'Point Z'),elevationIn=numeric(p.elevationIn,SITE_LIMITS.elevationIn,'Point elevation'),key=`${Math.round(xIn*1e5)}:${Math.round(zIn*1e5)}`;
 if(ids.has(id))fail(`Duplicate survey point ID: ${id}.`);if(xy.has(key))fail(`Duplicate or conflicting survey XY at point ${id}.`);ids.add(id);xy.add(key);return {id,xIn,zIn,elevationIn};});
 const a={x:points[0].xIn,y:points[0].zIn},b={x:points[1].xIn,y:points[1].zIn};if(!points.some(p=>Math.abs(cross(a,b,{x:p.xIn,y:p.zIn}))>.0001))fail('Survey points are collinear.');
 const gradeIds=new Set<string>(),grading=list(r.grading,0,SITE_LIMITS.gradingRegions,'Grading regions').map((v,i)=>{const g=plain(v,['id','name','boundary','originXIn','originZIn','elevationIn','slopeXPct','slopeZPct'],['id','name','boundary','originXIn','originZIn','elevationIn','slopeXPct','slopeZPct'],`Grading region ${i+1}`),id=text(g.id,100,'Grading ID');if(gradeIds.has(id))fail('Duplicate grading region ID.');gradeIds.add(id);return {id,name:text(g.name,120,'Grading name'),boundary:polygon(g.boundary,'Grading boundary'),originXIn:numeric(g.originXIn,SITE_LIMITS.coordinateIn,'Grading origin X'),originZIn:numeric(g.originZIn,SITE_LIMITS.coordinateIn,'Grading origin Z'),elevationIn:numeric(g.elevationIn,SITE_LIMITS.elevationIn,'Grading elevation'),slopeXPct:numeric(g.slopeXPct,100,'Grading X slope'),slopeZPct:numeric(g.slopeZPct,100,'Grading Z slope')};});
 for(const g of grading)for(const v of g.boundary)numeric(g.elevationIn+(v.x-g.originXIn)*g.slopeXPct/100+(v.y-g.originZIn)*g.slopeZPct/100,SITE_LIMITS.elevationIn,'Grading corner elevation');
 const out:SiteModel={version:1,points,grading};if(r.transitions!==undefined)out.transitions=validateGradingTransitions(r.transitions);if(r.boundary!==undefined)out.boundary=polygon(r.boundary,'Site boundary');
 if(r.overlay!==undefined){const o=plain(r.overlay,['attachmentId','name','widthPx','heightPx','scaleInPerPx','rotationDeg','originXIn','originZIn'],['attachmentId','name','widthPx','heightPx','scaleInPerPx','rotationDeg','originXIn','originZIn'],'Site overlay');const widthPx=numeric(o.widthPx,65535,'Overlay width',1),heightPx=numeric(o.heightPx,65535,'Overlay height',1);if(!Number.isInteger(widthPx)||!Number.isInteger(heightPx))fail('Overlay dimensions must be whole pixels.');out.overlay={attachmentId:text(o.attachmentId,200,'Attachment ID'),name:text(o.name,120,'Overlay name'),widthPx,heightPx,scaleInPerPx:numeric(o.scaleInPerPx,12000,'Overlay scale',.000001),rotationDeg:numeric(o.rotationDeg,360,'Overlay rotation'),originXIn:numeric(o.originXIn,SITE_LIMITS.coordinateIn,'Overlay origin X'),originZIn:numeric(o.originZIn,SITE_LIMITS.coordinateIn,'Overlay origin Z')};}
 return out;
}
export function siteModelProblem(value:unknown){try{validateSiteModel(value);return '';}catch(error){return error instanceof Error?error.message:'Invalid site model.';}}

import {registerSiteModelRuntime} from './siteModel';
registerSiteModelRuntime({validateSiteModel,siteModelProblem});
