import type {PatioInlay,YardFeature} from './types';
import type {PlanPoint} from './lib/deckGeometry';
import {polygonCut,signedArea} from './lib/polygonCuts';
import {validateCustomInlayPoints} from './lib/inlayGeometry';
import {yardFeatureOutline,yardToWorld} from './yardPathGeometry';
import {hardscapeProblem,hardscapeSelection} from './hardscapeCatalogue';
import {PAVER_BRANDS} from '../../data/carrPrices';

export const PATIO_INLAY_LIMITS={count:12,spanIn:240,coordinateIn:1200} as const;
export const normalizePavingAngle=(v:number)=>((v%360)+360)%360;
export function patioInlayOutline(i:PatioInlay):PlanPoint[]{
 const w=i.widthIn/2,h=i.depthIn/2;
 const points=i.shape==='custom'?(i.points??[]):i.shape==='circle'?Array.from({length:48},(_,k)=>({x:w*Math.cos(k*Math.PI/24),y:h*Math.sin(k*Math.PI/24)})):i.shape==='compass'?Array.from({length:16},(_,k)=>{const a=-Math.PI/2+k*Math.PI/8,r=k%2?.3:1;return {x:w*r*Math.cos(a),y:h*r*Math.sin(a)};}):i.shape==='diamond'?[{x:0,y:-h},{x:w,y:0},{x:0,y:h},{x:-w,y:0}]:[{x:-w,y:-h},{x:w,y:-h},{x:w,y:h},{x:-w,y:h}];
 const a=i.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 return points.map(p=>({x:i.xIn+c*p.x-s*p.y,y:i.yIn+s*p.x+c*p.y}));
}
export function patioInlayFeature(f:YardFeature,i:PatioInlay):YardFeature{
 const p=yardToWorld(f,{x:i.xIn,y:i.yIn}),points=patioInlayOutline({...i,xIn:0,yIn:0,rotationDeg:0});
 return {id:`${f.id}-inlay-${i.id}`,kind:'patio',name:i.name,enabled:true,xFt:p.x/12,zFt:p.y/12,widthFt:i.widthIn/12,depthFt:i.depthIn/12,heightIn:f.heightIn,rotationDeg:normalizePavingAngle(f.rotationDeg+i.rotationDeg),productId:i.productId,color:i.color,...(i.hardscape?{hardscape:{...i.hardscape}}:{}),outline:points};
}
/** Validate data before reading it. Outside/overlapping valid selections remain editable. */
export function patioInlayProblem(value:unknown):string|null{
 if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return 'Invalid patio inlay.';
 const d=Object.getOwnPropertyDescriptors(value),allowed=['id','name','shape','xIn','yIn','widthIn','depthIn','rotationDeg','points','productId','color','hardscape'];
 if(Reflect.ownKeys(value).some(k=>typeof k!=='string'||!allowed.includes(k))||Object.values(d).some(v=>!v.enumerable||!('value'in v)))return 'Inlays need plain supported values.';
 const i=value as PatioInlay;
 if(typeof i.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(i.id)||typeof i.name!=='string'||i.name.length>80||!['rectangle','diamond','circle','compass','band','custom'].includes(i.shape)||typeof i.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(i.color))return 'Invalid patio inlay identity, shape or colour.';
 if(![i.xIn,i.yIn,i.widthIn,i.depthIn,i.rotationDeg].every(v=>typeof v==='number'&&Number.isFinite(v))||Math.abs(i.xIn)>1200||Math.abs(i.yIn)>1200||i.widthIn<1||i.depthIn<1||i.widthIn>240||i.depthIn>240||i.rotationDeg<0||i.rotationDeg>=360)return 'Keep inlays within 20 ft across/out, with a finite position and rotation from 0 to 360 degrees.';
 if(i.shape==='custom'){try{const ps=validateCustomInlayPoints(i.points),xs=ps.map(p=>p.x),ys=ps.map(p=>p.y);if(Math.abs(Math.max(...xs)-Math.min(...xs)-i.widthIn)>1e-6||Math.abs(Math.max(...ys)-Math.min(...ys)-i.depthIn)>1e-6)return 'Custom inlay dimensions must match its sketch.';}catch(e){return (e as Error).message;}}
 else if(i.points!==undefined)return 'Only custom inlays use sketch points.';
 const v=i.hardscape;if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).some(k=>typeof k!=='string'||!['finishId','colorId','unitId','patternId','angleDeg','jointMm'].includes(k))||Object.values(Object.getOwnPropertyDescriptors(v)).some(d=>!d.enumerable||!('value'in d)))return 'Choose a documented paving material for this inlay.';
 const proxy=patioInlayFeature({id:'check',kind:'patio',name:'check',enabled:true,xFt:0,zFt:0,widthFt:20,depthFt:20,heightIn:0,rotationDeg:0,productId:i.productId,color:i.color},i),problem=hardscapeProblem(proxy);
 if(problem)return problem;return hardscapeSelection(proxy)?null:'Choose a documented paving product for this inlay.';
}
export interface PatioInlayPlan {inlay:PatioInlay;outline:PlanPoint[];status:'ok'|'outside'|'overlap'|'invalid';message:string}
export function patioInlayPlans(f:YardFeature,footprints=yardFeatureOutline(f)):PatioInlayPlan[]{
 const accepted:PlanPoint[][]=[],ids=new Set<string>();
 return (f.inlays??[]).map(i=>{const problem=patioInlayProblem(i);if(problem||ids.has(i.id))return {inlay:i,outline:[],status:'invalid',message:problem??'Duplicate inlay id.'};ids.add(i.id);
  const outline=patioInlayOutline(i).map(p=>yardToWorld(f,p)),outside=polygonCut([outline],footprints,true).reduce((n,p)=>n+signedArea(p),0);
  const thick=hardscapeSelection(f)?.unit.heightMm??PAVER_BRANDS.find(p=>p.id===f.productId)?.thicknessMm??60,inlayThick=hardscapeSelection(patioInlayFeature(f,i))!.unit.heightMm;
  if(Math.abs(thick-inlayThick)>.01)return {inlay:i,outline,status:'invalid',message:`Choose ${thick} mm stock to match the patio. This ${inlayThick} mm inlay needs a separately designed bedding transition and is excluded until revised.`};
  if(outside>.01)return {inlay:i,outline,status:'outside',message:'Move or resize this inlay inside the available patio; it is retained for editing and excluded from construction.'};
  if(polygonCut([outline],accepted).some(p=>Math.abs(signedArea(p))>.01))return {inlay:i,outline,status:'overlap',message:'Move this inlay clear of the earlier inlay; it is retained for editing and excluded from construction.'};
  accepted.push(outline);return {inlay:i,outline,status:'ok',message:''};
 });
}
