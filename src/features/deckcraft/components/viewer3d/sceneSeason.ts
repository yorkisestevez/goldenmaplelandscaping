import {useSyncExternalStore} from 'react';
import {DEFAULT_SEASON,parseSeason,type Season} from './plantSeasons';

/** The season the 3D view shows. Presentation only, like the hour: never saved with the design. ?deck-season= sets the
 * first one; a later choice is not overwritten by the query string. Kept out of showcaseMode.ts, which the designer
 * route loads, so the route carries none of it. */
let season:Season=DEFAULT_SEASON,urlApplied=false;
const listeners=new Set<()=>void>();

export const getSeason=()=>season;
export function setSeason(next:Season){if(next===season)return;season=next;for(const listener of listeners)listener();}
export function subscribeSeason(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};}
export function applySeasonSearch(search=typeof location==='undefined'?'':location.search){
 if(urlApplied)return;urlApplied=true;
 const named=parseSeason(new URLSearchParams(search).get('deck-season'));
 if(named)setSeason(named);
}
/** The view's season. The first reader also takes ?deck-season=, so a link opens in its season even with no season bar
 * (a still, a reel, a read-only view) and the first frame is already that season. Nobody is listening yet, so no one is told. */
export function useSeason(){
 if(!urlApplied&&typeof location!=='undefined'){urlApplied=true;season=parseSeason(new URLSearchParams(location.search).get('deck-season'))??season;}
 return useSyncExternalStore(subscribeSeason,getSeason,()=>DEFAULT_SEASON);
}
