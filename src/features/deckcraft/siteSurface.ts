export type {GradingTransitionModel,GradingTransitionFace} from './gradingTransitionGeometry';
import type {DeckData} from './types';
import {getTerrainConfig} from './yardSettings';
export type {SiteVertex,SitePlane,SiteSurfaceTriangle,SiteCutFill,SiteSurface,SiteFormation,SiteExcavationRegion,SiteSurfaceSnapshot} from './siteSurfaceEngine';
type Engine=typeof import('./siteSurfaceEngine');
let engine:Engine|undefined,loading:Promise<void>|undefined;
export function registerSiteEngine(value:Engine){engine=value;}
export const siteEngineReady=()=>!!engine;
/** Legacy projects never fetch triangulation. A measured project must finish
 * this load before it can be rendered, priced, restored or exported. */
export async function loadSiteEngine(){if(engine)return;loading??=import('./siteSurfaceEngine').then(value=>{engine=value;},error=>{loading=undefined;throw error;});await loading;}
function forward<K extends keyof Engine>(key:K):Engine[K]{return ((...args:unknown[])=>{if(!engine)throw Error('Measured terrain is still loading. Retry the operation once the site is ready.');return (engine[key] as unknown as (...args:unknown[])=>unknown)(...args);}) as Engine[K];}
export const createSiteSurface=forward('createSiteSurface');
export const siteSurfaceSnapshot=forward('siteSurfaceSnapshot');
export const integrateSiteExcavation=forward('integrateSiteExcavation');
export const integrateSiteFeatureFill=forward('integrateSiteFeatureFill');
export const siteMaterialBand=forward('siteMaterialBand');
export const sitePolygonsBelowGround=forward('sitePolygonsBelowGround');
export const siteRetainedSideArea=forward('siteRetainedSideArea');
export const siteDeckClearances=forward('siteDeckClearances');
export const siteGroundProfile=forward('siteGroundProfile');
/** The design's site model: the survey plus derived ground-fit pads (siteFeatureGrading.ts). Use this, not
 * data.siteModel, whenever the design's ground is wanted. */
export const designSiteModel=forward('designSiteModel');
/** The design's measured ground (survey + grading + transitions + ground-fit banks); undefined on a legacy yard. */
export function designSiteSurface(data:Pick<DeckData,'siteModel'|'terrainConfig'|'yardFeatures'>){return data.siteModel?createSiteSurface(designSiteModel(data),getTerrainConfig(data as DeckData)):undefined;}
export const siteElevationWarnings=forward('siteElevationWarnings');
export const siteClip=forward('siteClip');
export const siteSolidCells=forward('siteSolidCells');
export const siteArea=forward('siteArea');
export const siteSignedArea=forward('siteSignedArea');
export const siteAffineIntegral=forward('siteAffineIntegral');
export const sitePlaneHeight:Engine['sitePlaneHeight']=(p,x,z)=>p.x*x+p.z*z+p.constant;
export function sampleSiteHeight(data:Pick<DeckData,'siteModel'|'terrainConfig'>&Partial<Pick<DeckData,'yardFeatures'>>,xIn:number,zIn:number,kind:'existing'|'proposed'='proposed'){const t=getTerrainConfig(data as DeckData);return data.siteModel?createSiteSurface(designSiteModel(data),t).sample(xIn,zIn,kind):t.elevationIn+zIn*t.slopePct/100;}
