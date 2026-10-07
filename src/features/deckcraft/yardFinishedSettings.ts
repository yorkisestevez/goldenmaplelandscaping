import {validateStepAssembly} from './stepAssemblyRegistry';
import {GROUND_FIT_LIMITS,type YardFeature} from './types';
import {arcGeometry} from './circularArcs';
export const FINISHED_LEVEL_LIMIT=120000;
export function plainElevationFields(value:unknown,keys:string[]){if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('Elevation settings must use plain values.');const ds=Object.getOwnPropertyDescriptors(value);if(Reflect.ownKeys(value).length!==keys.length||keys.some(k=>!ds[k]||!ds[k].enumerable||!('value'in ds[k])))throw Error('Invalid elevation setting fields.');return Object.fromEntries(keys.map(k=>[k,ds[k].value])) as Record<string,number>;}
export const validateFinishedLevel=(v:unknown)=>{if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>FINISHED_LEVEL_LIMIT)throw Error('Finished elevation must be finite and within ±120,000 in.');return v;};
export function exactWallRunIn(f:YardFeature){const p=f.wallPath??[{x:-f.widthFt*6,y:0},{x:f.widthFt*6,y:0}];return p.slice(1).reduce((n,b,i)=>{const a=p[i],c=f.curves?.find(c=>c.edge===i);return n+(c?arcGeometry(a,b,c.bulgeIn).lengthIn:Math.hypot(b.x-a.x,b.y-a.y));},0);}
/** Descriptor checks run before reading imported settings. Also used by every live shape edit. */
export function validateYardFinishedSettings(f:YardFeature):YardFeature{
 for(const key of ['finishedElevationIn','patioSlope','groundFit','wallTopSteps','stoneSteps','stepAssembly','pavingInterface']){const d=Object.getOwnPropertyDescriptor(f,key);if(d&&(!d.enumerable||!('value'in d)))throw Error('Elevation settings must use plain values.');}
 if(f.kind==='fire-feature'){if(!fireCheck)throw Error('Geometry is loading. Retry shortly.');const problem=fireCheck(f);if(problem)throw Error(problem);}
 const result={...f};
 for(const key of ['finishedElevationIn','patioSlope','groundFit','wallTopSteps'] as const){const d=Object.getOwnPropertyDescriptor(f,key);if(!d)continue;if(d.value===undefined){delete result[key];continue;}if(f.kind==='water-feature')throw Error('Water features do not support finished-level settings.');
  if(key==='finishedElevationIn')result.finishedElevationIn=validateFinishedLevel(d.value);
  else if(key==='patioSlope'){if(f.kind!=='patio')throw Error('Only patios support surface slopes.');const s=plainElevationFields(d.value,['xPct','zPct']);if(![s.xPct,s.zPct].every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=30))throw Error('Patio slopes must be between −30 and 30 percent.');result.patioSlope={xPct:s.xPct,zPct:s.zPct};}
  else if(key==='groundFit'){
   // lowEdge is optional: read it only when it is an own field, so an absent one stays absent.
   const g=f.kind==='patio'?plainElevationFields(d.value,d.value&&typeof d.value==='object'&&Object.getOwnPropertyDescriptor(d.value,'lowEdge')?['slopeRatio','lowEdge']:['slopeRatio']):undefined,r=g?g.slopeRatio:NaN,low=g?.lowEdge as unknown;
   if(typeof r!=='number'||!(r>=GROUND_FIT_LIMITS.minRatio&&r<=GROUND_FIT_LIMITS.maxRatio))throw Error('Grade the ground round patios only, at 1.5:1 to 10:1.');
   if(low!==undefined&&low!=='stone')throw Error("Ground fit lowEdge must be 'stone'.");
   result.groundFit=low==='stone'?{slopeRatio:r,lowEdge:'stone'}:{slopeRatio:r};}
  else {if(!wallRuntime)throw Error('Hardscape geometry is loading.');result.wallTopSteps=wallRuntime.validateWallTopSteps(f,d.value);}
 }
 if(result.patioSlope&&result.finishedElevationIn===undefined)throw Error('Fix the patio elevation before setting its slope.');
 if(result.groundFit&&result.finishedElevationIn===undefined)throw Error('Fix the patio elevation before grading the ground round it.');
 for(const key of ['stoneSteps','stepAssembly','pavingInterface'] as const){const descriptor=Object.getOwnPropertyDescriptor(f,key);if(!descriptor)continue;if(descriptor.value===undefined){delete result[key];continue;}
  if(!wallRuntime)throw Error('Hardscape geometry is loading.');
  if(key==='stepAssembly')result.stepAssembly=validateStepAssembly(result,descriptor.value);
  else if(key==='stoneSteps')result.stoneSteps=wallRuntime.validateStoneSteps(result,descriptor.value);
  else result.pavingInterface=wallRuntime.validatePavingInterface(result,descriptor.value);
 }
 return result;
}

/** The fire feature check (fireFeatures.ts fireFeatureProblem) loads with the advanced yard runtime, which every design
 * with a fire feature loads before it is validated or modelled. */
let fireCheck:((f:YardFeature)=>string)|undefined;
export function registerFireFeatureCheck(value:(f:YardFeature)=>string){fireCheck=value;}

type WallRuntime=Pick<typeof import('./wallTopStepsRuntime'),'validateWallTopSteps'|'validateStoneSteps'|'validatePavingInterface'>;
let wallRuntime:WallRuntime|undefined,wallLoading:Promise<void>|undefined;
export const wallTopStepsReady=()=>!!wallRuntime;
export function registerWallTopStepsRuntime(value:WallRuntime){wallRuntime=value;}
export async function loadWallTopStepsRuntime(){if(wallRuntime)return;wallLoading??=import('./wallTopStepsRuntime').then(value=>{wallRuntime=value;},error=>{wallLoading=undefined;throw error;});await wallLoading;}

export const yardAssembliesReady=wallTopStepsReady;
export const loadYardAssembliesRuntime=loadWallTopStepsRuntime;
