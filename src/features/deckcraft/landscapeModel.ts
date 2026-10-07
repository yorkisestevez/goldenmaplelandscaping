import type {DeckData} from './types';
import type {LandscapeObject,LandscapePoint} from './landscapeTypes';
export interface LandscapeItemTakeoff {objectId:string;name:string;kind:LandscapeObject['kind'];count:number;areaSqft:number;mulchYd3:number;edgingLf:number;aggregateYd3?:number;turfAreaSqft?:number;baseYd3?:number;cupCount?:number;quoteRequired:true;
 /** Raised beds only (raisedBeds.ts): level soil top (project datum), planting soil, highest soil over the outline's ground, timber/steel edging and holding wall run. */
 soilTopIn?:number;soilYd3?:number;raisedMaxIn?:number;raisedEdgeLf?:number;wallLf?:number;wallLinked?:boolean;unheld?:boolean}
export interface LandscapeTakeoff {plantCount:number;boulderCount:number;furnitureCount:number;bedAreaSqft:number;mulchYd3:number;edgingLf:number;aggregateYd3?:number;turfAreaSqft?:number;baseYd3?:number;cupCount?:number;soilYd3?:number;raisedEdgeLf?:number;items:LandscapeItemTakeoff[];warnings:string[]}
import {DesignExtensionLoadError} from './designExtensionState';
type Runtime=Pick<typeof import('./landscapeModelRuntime'),'landscapeFootprint'|'landscapeBedAreas'|'landscapeTakeoff'|'landscapePlacement'|'matureSpreadConflicts'|'landscapeRenderLods'|'landscapeQuoteSections'>;
let runtime:Runtime|undefined,loading:Promise<void>|undefined;
export function registerLandscapeModelRuntime(value:Runtime){runtime=value;}
export const landscapeModelReady=()=>!!runtime;
export async function loadLandscapeModelRuntime(){if(runtime)return;loading??=import('./landscapeModelRuntime').then(value=>{runtime=value;},error=>{loading=undefined;throw new DesignExtensionLoadError('landscapeModel',error);});await loading;}
function get():Runtime{if(!runtime)throw new DesignExtensionLoadError('landscapeModel');return runtime;}
export const landscapeFootprint:Runtime['landscapeFootprint']=object=>get().landscapeFootprint(object);
export const landscapePlacement:Runtime['landscapePlacement']=(data,object)=>get().landscapePlacement(data,object);
export const landscapeBedAreas:Runtime['landscapeBedAreas']=(objects,data)=>objects.length?get().landscapeBedAreas(objects,data):new Map();
export const matureSpreadConflicts:Runtime['matureSpreadConflicts']=objects=>objects.length?get().matureSpreadConflicts(objects):[];
export const landscapeRenderLods:Runtime['landscapeRenderLods']=(objects,camera,height,tier)=>objects.length?get().landscapeRenderLods(objects,camera,height,tier):new Map();
export const landscapeTakeoff:Runtime['landscapeTakeoff']=(objects=[],data)=>objects.length?get().landscapeTakeoff(objects,data):{plantCount:0,boulderCount:0,furnitureCount:0,bedAreaSqft:0,mulchYd3:0,edgingLf:0,items:[],warnings:[]};

export const landscapeQuoteSections:Runtime['landscapeQuoteSections']=(objects,takeoff)=>objects.length?get().landscapeQuoteSections(objects,takeoff):[];
