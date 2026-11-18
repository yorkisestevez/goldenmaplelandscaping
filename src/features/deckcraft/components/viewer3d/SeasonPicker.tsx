import {useEffect} from 'react';
import {SEASONS,SEASON_LABELS} from './plantSeasons';
import {applySeasonSearch,setSeason,useSeason} from './sceneSeason';

/** Spring · Summer · Fall · Winter on the 3D bar. It changes the view only: the design, its price and its link stay put. */
export default function SeasonPicker(){
 const season=useSeason();
 useEffect(()=>{applySeasonSearch();},[]);
 return <div className="dd-day-night dd-season" role="group" aria-label="Season" title="See the yard in each season: every plant at its peak for that time of year. The design and price do not change.">
  {SEASONS.map(s=><button key={s} type="button" aria-pressed={season===s} onClick={()=>setSeason(s)}>{SEASON_LABELS[s]}</button>)}
 </div>;
}
