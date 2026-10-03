import {validateStepAssembly} from './stepAssemblyRegistry';
import type {YardFeature} from './types';
import {arcGeometry} from './circularArcs';
export const FINISHED_LEVEL_LIMIT=120000;
export function plainElevationFields(value:unknown,keys:string[]){if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('Elevation settings must use plain values.');const ds=Object.getOwnPropertyDescriptors(value);if(Reflect.ownKeys(value).length!==keys.length||keys.some(k=>!ds[k]||!ds[k].enumerable||!('value'in ds[k])))throw Error('Invalid elevation setting fields.');return Object.fromEntries(keys.map(k=>[k,ds[k].value])) as Record<string,number>;}
export const validateFinishedLevel=(v:unknown)=>{if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>FINISHED_LEVEL_LIMIT)throw Error('Finished elevation must be finite and within ±120,000 in.');return v;};
export function exactWallRunIn(f:YardFeature){const p=f.wallPath??[{x:-f.widthFt*6,y:0},{x:f.widthFt*6,y:0}];return p.slice(1).reduce((n,b,i)=>{const a=p[i],c=f.curves?.find(c=>c.edge===i);return n+(c?arcGeometry(a,b,c.bulgeIn).lengthIn:Math.hypot(b.x-a.x,b.y-a.y));},0);}
/** Descriptor checks run before reading imported settings. Also used by every live shape edit. */
export function validateYardFinishedSettings(f:YardFeature):YardFeature{
 for(const key of ['finishedElevationIn','patioSlope','wallTopSteps','stoneSteps','stepAssembly','pavingInterface']){const d=Object.getOwnPropertyDescriptor(f,key);if(d&&(!d.enumerable||!('value'in d)))throw Error('Elevation settings must use plain values.');}
 const result={...f};
 for(const key of ['finishedElevationIn','patioSlope','wallTopSteps'] as const){const d=Object.getOwnPropertyDescriptor(f,key);if(!d)continue;if(d.value===undefined){delete result[key];continue;}if(f.kind==='water-feature')throw Error('Water features do not support finished-level settings.');
  if(key==='finishedElevationIn')result.finishedElevationIn=validateFinishedLevel(d.value);
  else if(key==='patioSlope'){if(f.kind!=='patio')throw Error('Only patios support surface slopes.');const s=plainElevationFields(d.value,['xPct','zPct']);if(![s.xPct,s.zPct].every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=30))throw Error('Patio slopes must be between −30 and 30 percent.');result.patioSlope={xPct:s.xPct,zPct:s.zPct};}
  else {if(!wallRuntime)throw Error('Hardscape geometry is loading.');result.wallTopSteps=wallRuntime.validateWallTopSteps(f,d.value);}
 }
 if(result.patioSlope&&result.finishedElevationIn===undefined)throw Error('Fix the patio elevation before setting its slope.');
 for(const key of ['stoneSteps','stepAssembly','pavingInterface'] as const){const descriptor=Object.getOwnPropertyDescriptor(f,key);if(!descriptor)continue;if(descriptor.value===undefined){delete result[key];continue;}
  if(!wallRuntime)throw Error('Hardscape geometry is loading.');
  if(key==='stepAssembly')result.stepAssembly=validateStepAssembly(result,descriptor.value);
  else if(key==='stoneSteps')result.stoneSteps=wallRuntime.validateStoneSteps(result,descriptor.value);
  else result.pavingInterface=wallRuntime.validatePavingInterface(result,descriptor.value);
 }
 return result;
}

type WallRuntime=Pick<typeof import('./wallTopStepsRuntime'),'validateWallTopSteps'|'validateStoneSteps'|'validatePavingInterface'>;
let wallRuntime:WallRuntime|undefined,wallLoading:Promise<void>|undefined;
export const wallTopStepsReady=()=>!!wallRuntime;
export function registerWallTopStepsRuntime(value:WallRuntime){wallRuntime=value;}
export async function loadWallTopStepsRuntime(){if(wallRuntime)return;wallLoading??=import('./wallTopStepsRuntime').then(value=>{wallRuntime=value;},error=>{wallLoading=undefined;throw error;});await wallLoading;}

export const yardAssembliesReady=wallTopStepsReady;
export const loadYardAssembliesRuntime=loadWallTopStepsRuntime;
