import type {DeckData} from './types';

/** Drawing datums are required whenever geometry no longer uses the legacy
 * zero-grade assumption. A flat zero plane alone preserves legacy drawings. */
export function usesPhysicalElevations(data:DeckData):boolean{
 return !!data.siteModel||!!data.stairTargets?.length
  ||Math.abs(data.terrainConfig?.elevationIn??0)>1e-8||Math.abs(data.terrainConfig?.slopePct??0)>1e-8
  ||!!data.yardFeatures?.some(f=>f.finishedElevationIn!==undefined||f.patioSlope!==undefined||f.wallTopSteps!==undefined);
}

/** Project coordinates retain the original DeckCraft zero; survey import
 * performs explicit unit/datum conversion before storing world inches. */
export const ELEVATION_DATUM='Project datum 0.00 in (deck back-left reference; vertical benchmark must be confirmed)';
export const elevationLabel=(value:number|null|undefined)=>value==null||!Number.isFinite(value)?'pending':`${value>=0?'+':''}${value.toFixed(2)} in`;
