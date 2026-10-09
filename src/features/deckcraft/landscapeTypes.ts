/** Landscape coordinates and dimensions are world inches, from the deck's
 * back-left framing corner. A mesh never defines a botanical supplier SKU. */
export type LandscapeKind='plant'|'boulder'|'furniture'|'bed';
export type LandscapeAssetId='deciduous-tree'|'conifer-tree'|'rounded-shrub'|'hedge-shrub'|'grass-clump'|'evergreen-shrub'|'pine-tree'|'hosta-clump'|'reed-grass'|'fern-clump'|'perennial-bloom'|'perennial-gold'|'natural-boulder'|'outdoor-table'|'outdoor-chair'|'lounge-chair'|'outdoor-sofa'|'outdoor-coffee-table'|'mulch-bed'|'black-mulch-bed'|'cedar-mulch-bed'|'river-rock-bed'|'mexican-beach-pebbles-bed'|'white-stone-bed'|'crushed-granite-bed'|'pea-gravel-bed'|'clear-limestone-bed'|'limestone-screenings-bed'|'granular-base-bed'|'artificial-grass'|'putting-green';
export interface LandscapePoint {x:number;z:number}
export type {LandscapeOutline,LandscapeRing,LandscapeSegment} from './landscapeOutline';
export interface LandscapeSpeciesRecord {
 id:string;commonName:string;botanicalName:string;
 matureHeightIn:[number,number];matureSpreadIn:[number,number];
 /** Spacing is included only when the cited source states a planting spacing. */
 spacingIn?:number;sourceURL:string;spacingSourceURL?:string;sourceNote?:string;
}
export interface LandscapeObject {
 id:string;name:string;enabled:boolean;kind:LandscapeKind;assetId:LandscapeAssetId;
 xIn:number;zIn:number;rotationDeg:number;heightIn:number;widthIn:number;depthIn:number;
 /** Optional bed outline is absolute world inches, not a local rotated shape. */
 polygon?:LandscapePoint[];mulchDepthIn?:number;edging?:boolean;
 /** Authoritative local curved boundaries. Never saved alongside polygon. */
 outline?:import('./landscapeOutline').LandscapeOutline;fillSeed?:LandscapePoint;groundCoverOnly?:boolean;holeEdging?:boolean;
 /** Vertical finish/base depths. Missing base depth is unresolved, never inferred. */
 surfaceDepthIn?:number;baseDepthIn?:number;
 /** Cup positions in local inches about the area centre; rotate with the area. */
 puttingCups?:LandscapePoint[];
 speciesRecord?:LandscapeSpeciesRecord;
 /** Explicit furniture support; missing/disabled support is pending. */
 supportFeatureId?:string;
 /** Raised bed (beds only, 0–36 in): a level soil top at the lowest ground along the outline + raisedIn, never below
  * the highest ground inside − 2 in (raisedBeds.ts). Absent keeps the bed a finish layer draped on the ground. */
 raisedIn?:number;
 /** What holds a raised bed's soil (requires raisedIn). A wall is a retaining-wall yard feature, linked by id. */
 edge?:LandscapeBedEdge;
}
export interface LandscapeBedEdge {kind:'wall'|'timber'|'steel';wallFeatureId?:string}
export const LANDSCAPE_LIMITS={objects:300,polygonPoints:64,coordinateIn:120000,dimensionIn:2400} as const;
import {DesignExtensionLoadError} from './designExtensionState';
type Runtime=Pick<typeof import('./landscapeTypesRuntime'),'validateLandscapeSpecies'|'validLandscapePolygon'|'validateLandscapeObjects'>;
let runtime:Runtime|undefined,loading:Promise<void>|undefined;
export function registerLandscapeTypesRuntime(value:Runtime){runtime=value;}
export const landscapeTypesReady=()=>!!runtime;
export async function loadLandscapeTypesRuntime(){if(runtime)return;loading??=import('./landscapeTypesRuntime').then(value=>{runtime=value;},error=>{loading=undefined;throw new DesignExtensionLoadError('landscapeTypes',error);});await loading;}
function get():Runtime{if(!runtime)throw new DesignExtensionLoadError('landscapeTypes');return runtime;}
export const validateLandscapeSpecies:Runtime['validateLandscapeSpecies']=value=>get().validateLandscapeSpecies(value);
export const validLandscapePolygon:Runtime['validLandscapePolygon']=value=>get().validLandscapePolygon(value);
export const validateLandscapeObjects:Runtime['validateLandscapeObjects']=value=>get().validateLandscapeObjects(value);
