/** Explicit saved stair termination; ground edits never change these settings. */
export interface StairTarget {flightId:string;elevationIn:number;riserCount:number;treadDepthIn:number;surface:'terrain'|'patio';patioId?:string}
export const STAIR_TARGET_LIMITS={count:32,elevationIn:120000,minRisers:1,maxRisers:28,minTreadIn:10,maxTreadIn:24,minRiseIn:4.875,maxRiseIn:7.75,landingVariationIn:.25} as const;
export const stairTargetId=(flightId:string)=>flightId.startsWith('grade-path-')?'grade-path':flightId.replace(/-(upper|lower|winders)$/,'');
type Runtime=Pick<typeof import('./stairTargetsRuntime'),'validateStairTargets'>;
let runtime:Runtime|undefined,loading:Promise<void>|undefined;
export const stairTargetsReady=()=>!!runtime;
export function registerStairTargetsRuntime(value:Runtime){runtime=value;}
export async function loadStairTargetsRuntime(){if(runtime)return;loading??=import('./stairTargetsRuntime').then(value=>{runtime=value;},error=>{loading=undefined;throw error;});await loading;}
export function validateStairTargets(value:unknown):StairTarget[]{if(Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype&&value.length===0&&Reflect.ownKeys(value).length===1)return [];if(!runtime)throw Error('Explicit stair targets are loading. Prepare design extensions before importing, estimating or exporting.');return runtime.validateStairTargets(value);}
