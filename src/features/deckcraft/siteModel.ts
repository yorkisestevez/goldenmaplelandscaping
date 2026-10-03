/** Survey coordinates and all model elevations use world inches on the deck's
 * existing zero datum. Importers must apply an explicit datum conversion. */
export interface SitePoint {id:string;xIn:number;zIn:number;elevationIn:number}
export interface SiteBoundaryPoint {x:number;y:number}
export interface SiteGradingRegion {id:string;name:string;boundary:SiteBoundaryPoint[];originXIn:number;originZIn:number;elevationIn:number;slopeXPct:number;slopeZPct:number}
export interface TransitionBoundary {points:SiteBoundaryPoint[];curves?:import('./circularArcs').CircularArc[];elevationSource:'existing'|'proposed'|'specified';levels?:{stationIn:number;elevationIn:number}[]}
export interface SiteGradingTransition {id:string;name:string;enabled:boolean;a:TransitionBoundary;b:TransitionBoundary}
export interface SiteOverlay {attachmentId:string;name:string;widthPx:number;heightPx:number;scaleInPerPx:number;rotationDeg:number;originXIn:number;originZIn:number}
export interface SiteModel {version:1;points:SitePoint[];boundary?:SiteBoundaryPoint[];grading:SiteGradingRegion[];transitions?:SiteGradingTransition[];overlay?:SiteOverlay}
export const SITE_LIMITS={points:2000,boundaryPoints:256,gradingRegions:64,coordinateIn:1_200_000,elevationIn:120_000};
import {DesignExtensionLoadError} from './designExtensionState';
type Runtime=Pick<typeof import('./siteModelRuntime'),'validateSiteModel'|'siteModelProblem'>;
let runtime:Runtime|undefined,loading:Promise<void>|undefined;
export function registerSiteModelRuntime(value:Runtime){runtime=value;}
export const siteModelReady=()=>!!runtime;
export async function loadSiteModelRuntime(){if(runtime)return;loading??=import('./siteModelRuntime').then(value=>{runtime=value;},error=>{loading=undefined;throw new DesignExtensionLoadError('siteModel',error);});await loading;}
function get():Runtime{if(!runtime)throw new DesignExtensionLoadError('siteModel');return runtime;}
export const validateSiteModel:Runtime['validateSiteModel']=value=>get().validateSiteModel(value);
export const siteModelProblem:Runtime['siteModelProblem']=value=>get().siteModelProblem(value);
