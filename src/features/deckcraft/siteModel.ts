/** Survey coordinates and all model elevations use world inches on the deck's
 * existing zero datum. Importers must apply an explicit datum conversion. */
export interface SitePoint {id:string;xIn:number;zIn:number;elevationIn:number}
export interface SiteBoundaryPoint {x:number;y:number}
export interface SiteGradingRegion {id:string;name:string;boundary:SiteBoundaryPoint[];originXIn:number;originZIn:number;elevationIn:number;slopeXPct:number;slopeZPct:number}
export interface TransitionBoundary {points:SiteBoundaryPoint[];curves?:import('./circularArcs').CircularArc[];elevationSource:'existing'|'proposed'|'specified';levels?:{stationIn:number;elevationIn:number}[]}
export interface SiteGradingTransition {id:string;name:string;enabled:boolean;a:TransitionBoundary;b:TransitionBoundary}
export interface SiteOverlay {attachmentId:string;name:string;widthPx:number;heightPx:number;scaleInPerPx:number;rotationDeg:number;originXIn:number;originZIn:number}
/** Derived, never saved: one ground-fit patio (types.ts PatioGroundFit). The ground outside `rings` is graded to the
 * patio's top `plane` and daylights into the surface beneath at `slopeRatio` run per rise; inside, the ground stays
 * as it is (the patio's own excavation owns it). Built by designSiteModel (siteFeatureGrading.ts). */
export interface SiteFeaturePad {featureId:string;name:string;rings:SiteBoundaryPoint[][];plane:{x:number;z:number;constant:number};slopeRatio:number;
 /** 'stone' (PatioGroundFit.lowEdge): no fill bank; where the patio stands above the ground a stone edge holds it. */
 lowEdge?:'stone'}
export interface SiteModel {version:1;points:SitePoint[];boundary?:SiteBoundaryPoint[];grading:SiteGradingRegion[];transitions?:SiteGradingTransition[];overlay?:SiteOverlay;featurePads?:SiteFeaturePad[];
 /** Derived, never saved: other paving's outlines near the pads (the bank under them needs no restoring). */
 featurePadOccupied?:SiteBoundaryPoint[][]}
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
