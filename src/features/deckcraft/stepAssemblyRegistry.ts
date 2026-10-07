import type {YardFeature} from './types';
type Runtime=Pick<typeof import('./stepAssemblyRuntime'),'validateStepAssembly'|'buildStepAssemblyModel'|'stepAssemblyFootprints'|'convertStoneSteps'|'stepPresets'|'stepAssemblyPatch'>;
let runtime:Runtime|undefined,loading:Promise<void>|undefined;
export function registerStepAssemblyRuntime(value:Runtime){runtime=value;}
export function loadStepAssemblyRuntime(){loading??=import('./stepAssemblyRuntime').then(v=>{runtime=v;},e=>{loading=undefined;throw e;});return loading;}
export const stepAssemblyReady=()=>!!runtime;
function ready(){if(!runtime)throw Error('Geometry is loading. Retry shortly.');return runtime;}
export const validateStepAssembly=(f:YardFeature,v:unknown)=>ready().validateStepAssembly(f,v);
export const buildStepAssemblyModel=(...args:Parameters<Runtime['buildStepAssemblyModel']>)=>ready().buildStepAssemblyModel(...args);
export const stepAssemblyFootprints=(f:YardFeature)=>ready().stepAssemblyFootprints(f);
export const convertStoneSteps=(f:YardFeature)=>ready().convertStoneSteps(f);
export const stepPresets=()=>ready().stepPresets();
export const stepAssemblyPatch=(...args:Parameters<Runtime['stepAssemblyPatch']>)=>ready().stepAssemblyPatch(...args);
