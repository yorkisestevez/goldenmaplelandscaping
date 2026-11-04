import {DesignExtensionLoadError} from './designExtensionState';

/** Fences and gates (S9): an open run of plan points in world inches from the deck's back-left framing corner (x across
 * the house, z out into the yard), as the site model and landscape objects use. Checks, prices and geometry live in
 * fenceRuntime.ts, loaded only for designs with fences. */
export type FenceStyle='wood-privacy'|'horizontal-cedar'|'vinyl-privacy'|'aluminum-picket'|'chain-link';
/** Wood privacy only: absent is pressure-treated. */
export type FenceWood='pressure-treated'|'cedar';
export type FenceHeightFt=4|5|6;
export interface FencePoint {xIn:number;zIn:number}
/** A gate centred `atIn` along the run: single 4 ft, double 10 ft. */
export interface FenceGate {id:string;kind:'single'|'double';atIn:number}
export interface Fence {id:string;name:string;style:FenceStyle;wood?:FenceWood;heightFt:FenceHeightFt;points:FencePoint[];gates:FenceGate[]}

/** The per-user fence rates (dollars) a job or the owner's defaults may set; the defaults are in fenceRuntime.ts. */
export const FENCE_RATE_IDS=['pressureTreated','cedar','horizontalCedar','vinyl','aluminum','chainLink','singleGate','doubleGate'] as const;
export type FenceRateId=typeof FENCE_RATE_IDS[number];

type Runtime=Pick<typeof import('./fenceRuntime'),'validateFences'|'fenceTakeoff'>;
let runtime:Runtime|undefined,loading:Promise<void>|undefined;
export function registerFenceRuntime(value:Runtime){runtime=value;}
export const fenceRuntimeReady=()=>!!runtime;
export async function loadFenceRuntime(){if(runtime)return;loading??=import('./fenceRuntime').then(value=>{runtime=value;},error=>{loading=undefined;throw new DesignExtensionLoadError('fences',error);});await loading;}
function get():Runtime{if(!runtime)throw new DesignExtensionLoadError('fences');return runtime;}
export const validateFences:Runtime['validateFences']=value=>get().validateFences(value);
export const fenceTakeoff:Runtime['fenceTakeoff']=data=>get().fenceTakeoff(data);
