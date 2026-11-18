import {DesignExtensionLoadError} from './designExtensionState';
import type {PoolScopeId,PoolType} from './poolTypes';
import type {SupplierUnit} from './supplierRateBook';
/** Private CAD inputs. Amounts exclude HST; supply receives the project's material markup. */
export interface PoolCostAmounts {supply:number;labour:number;equipment:number}
export interface PoolScopePrice extends PoolCostAmounts {poolId:string;scope:PoolScopeId;basis:'allowance'|'quote'|'unit-rate';unit:SupplierUnit|'assembly';quantityKey:string;effectiveDate:string;source:string;packQuantity?:number;deliveryKey?:string}
export interface PoolPackagePrice extends PoolCostAmounts {id:string;poolId:string;name:string;includedScopes:PoolScopeId[];quantityKey:string;effectiveDate:string;source:string;deliveryKey?:string}
export interface PoolQuoteInputs {version:1;scopes:PoolScopePrice[];packages:PoolPackagePrice[]}
export interface PoolBudgetPreset {id:string;name:string;type:PoolType;scopes:Omit<PoolScopePrice,'poolId'|'quantityKey'>[]}
export interface PoolBudgetBook {version:1;revision:number;updatedAt:string;presets:PoolBudgetPreset[]}
type Runtime=Pick<typeof import('./poolQuoteTypesRuntime'),'validatePoolQuoteInputs'>;
let runtime:Runtime|undefined,loading:Promise<void>|undefined;
export const poolQuoteTypesReady=()=>!!runtime;
export function registerPoolQuoteTypesRuntime(v:Runtime){runtime=v;}
export async function loadPoolQuoteTypesRuntime(){if(runtime)return;loading??=import('./poolQuoteTypesRuntime').then(v=>{runtime=v;},e=>{loading=undefined;throw new DesignExtensionLoadError('Private pool prices',e);});await loading;}
export const validatePoolQuoteInputs:Runtime['validatePoolQuoteInputs']=(v:unknown):v is PoolQuoteInputs=>{if(v===undefined)return true;if(!runtime)throw new DesignExtensionLoadError('Private pool prices');return runtime.validatePoolQuoteInputs(v);};
