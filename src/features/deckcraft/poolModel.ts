import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import type {PlanPoint} from './lib/deckGeometry';
import type {SitePlane} from './siteSurface';
import type {PoolFeature} from './poolTypes';
import type {YardFeatureModel,YardBox} from './yardModel';
export type PoolSolidRole='floor'|'wall'|'water'|'base'|'backfill'|'collar'|'coping'|'setting-bed';
export interface PoolSolid {id:string;role:PoolSolidRole;polygon:PlanPoint[];topPlane:SitePlane;bottomPlane:SitePlane;color:string;stockId?:string;planning:boolean}
export interface PoolFormation {featureId:string;polygon:PlanPoint[];bottomIn:number;formationPlane:SitePlane}
export interface PoolCopingStock {id:string;pieces:number;lengthIn:number;widthIn:number;thicknessIn:number;cut:boolean;unsupported:boolean;polygons:PlanPoint[][]}
export interface PoolFeatureModel {config:PoolFeature;openingFootprints:PlanPoint[][];structureFootprints:PlanPoint[][];copingFootprints:PlanPoint[][];permanentExclusionFootprints:PlanPoint[][];excavationFootprints:PlanPoint[][];formationRegions:PoolFormation[];solids:PoolSolid[];copingStock:PoolCopingStock[];quantities:Record<string,number>;warnings:string[];pending:string[];status:'planning'|'ready'|'pending';coverageComplete:boolean;floorRegions:{polygon:PlanPoint[];plane:SitePlane}[];waterElevationIn:number;copingTopElevationIn:number}
type Runtime=Pick<typeof import('./poolModelRuntime'),'getPoolModels'|'reconcilePoolMaterials'>;
let runtime:Runtime|undefined,loading:Promise<void>|undefined;
export const poolModelReady=()=>!!runtime;
export function registerPoolModelRuntime(v:Runtime){runtime=v;}
export async function loadPoolModelRuntime(){if(runtime)return;loading??=import('./poolModelRuntime').then(v=>{runtime=v;},e=>{loading=undefined;throw e;});await loading;}
export function getPoolModels(data:DeckData,deck?:DeckTakeoff):PoolFeatureModel[]{if(!data.pools?.some(p=>p.enabled))return [];if(!runtime)throw Error('Pool geometry is still loading. Prepare the design before calculating, rendering or exporting.');return runtime.getPoolModels(data,deck);}
export function reconcilePoolMaterials(pools:PoolFeatureModel[],features:YardFeatureModel[],boxes:YardBox[],formations:{featureId:string;polys:PlanPoint[][];bottom:number;formationPlane?:SitePlane}[]){if(!pools.length)return;if(!runtime)throw Error('Pool geometry is not ready.');runtime.reconcilePoolMaterials(pools,features,boxes,formations);}
