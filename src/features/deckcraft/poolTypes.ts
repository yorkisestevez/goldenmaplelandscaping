import type {PlanPoint} from './lib/deckGeometry';
import type {CircularArc} from './circularArcs';
import {DesignExtensionLoadError} from './designExtensionState';
export type PoolType='fiberglass'|'vinyl-liner'|'concrete';
export type PoolScopeId='structure'|'excavation'|'disposal'|'aggregate'|'backfill'|'coping'|'plumbing'|'equipment'|'installation'|'delivery'|'electrical'|'drainage'|'site-requirements';
export type PoolScopeOwner='golden-maple'|'pool-contractor';
export interface PoolAssembly {status:'planning'|'recorded';wallThicknessIn?:number;floorThicknessIn?:number;baseDepthIn?:number;workingClearanceIn?:number;backfillMaterial?:'aggregate'|'engineered-fill'|'concrete'|'supplier-specified';collarWidthIn?:number;collarDepthIn?:number;sourceUrl?:string;sourceNote?:string}
export interface PoolCoping {status?:'planning'|'recorded';widthIn:number;thicknessIn:number;overhangIn:number;jointIn:number;transitionJointIn:number;stockLengthIn?:number;settingBedThicknessIn?:number;settingBedMaterial?:'mortar'|'adhesive'|'supplier-specified';supportSourceUrl?:string;supportNote?:string;manufacturer?:string;productId?:string;sourceUrl?:string;verifiedForPool:boolean;color?:string}
export interface PoolProduct {manufacturer:string;model:string;sourceUrl:string;shapeSignature:string;sourceNote?:string}
export interface PoolServiceTrench {id:string;service:'plumbing'|'electrical'|'drainage';points:PlanPoint[];widthIn:number;depthIn:number}
export interface PoolFeature {id:string;name:string;enabled:boolean;type:PoolType;xIn:number;zIn:number;rotationDeg:number;outline:PlanPoint[];curves?:CircularArc[];copingTopElevationIn:number;waterOffsetIn:number;depthProfile:{stationIn:number;depthIn:number}[];assembly?:PoolAssembly;coping?:PoolCoping;product?:PoolProduct;scopeMode:'complete'|'supplied-by-others';scopeOwners?:Partial<Record<PoolScopeId,PoolScopeOwner>>;serviceTrenches?:PoolServiceTrench[]}
export const POOL_SCOPES:readonly PoolScopeId[]=['structure','excavation','disposal','aggregate','backfill','coping','plumbing','equipment','installation','delivery','electrical','drainage','site-requirements'];
export const poolScopeOwner=(p:PoolFeature,scope:PoolScopeId):PoolScopeOwner=>p.scopeOwners?.[scope]??(p.scopeMode==='complete'||scope==='coping'?'golden-maple':'pool-contractor');
type Runtime=Pick<typeof import('./poolTypesRuntime'),'validatePools'|'validatePoolFeature'|'poolValidationProblem'>;
let runtime:Runtime|undefined,loading:Promise<void>|undefined;
export const poolTypesReady=()=>!!runtime;
export function registerPoolTypesRuntime(value:Runtime){runtime=value;}
export async function loadPoolTypesRuntime(){if(runtime)return;loading??=import('./poolTypesRuntime').then(v=>{runtime=v;},e=>{loading=undefined;throw new DesignExtensionLoadError('poolTypes',e);});await loading;}
function ready(){if(!runtime)throw new DesignExtensionLoadError('poolTypes');return runtime;}
export const validatePools:Runtime['validatePools']=(v):v is PoolFeature[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&v.length===0&&Reflect.ownKeys(v).length===1?true:ready().validatePools(v);
export const validatePoolFeatures=validatePools;
export const validatePoolFeature:Runtime['validatePoolFeature']=v=>ready().validatePoolFeature(v);
export const poolValidationProblem:Runtime['poolValidationProblem']=v=>ready().poolValidationProblem(v);
