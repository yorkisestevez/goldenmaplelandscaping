import type {Season} from './plantSeasons';

/**
 * The sun and lawn per season, for Barrie (44.4° N). Summer is today's look: the sky's own sun at 64° and the lawn as
 * scanned. The noon sun stands about 46° at the equinoxes and 22° at midwinter; spring is shown in late May and fall in
 * mid-October, so they sit between. A lower sun is a little weaker and, in fall, warmer.
 */
export interface SeasonSun {elevationDeg:number|null;gain:number;tint:[number,number,number]}
export const SEASON_SUN:Record<Season,SeasonSun>={
 spring:{elevationDeg:58,gain:1,tint:[1,1,1]},
 summer:{elevationDeg:null,gain:1,tint:[1,1,1]},
 fall:{elevationDeg:34,gain:.92,tint:[1,.93,.84]},
 winter:{elevationDeg:22,gain:.84,tint:[.96,.98,1]},
};
/** Lawn colour multiplier: spring's fresh flush, fall's tired yellowing. Winter's lawn is under snow. */
export const SEASON_LAWN:Record<Season,[number,number,number]>={
 spring:[.96,1.07,.88],summer:[1,1,1],fall:[1.08,.98,.78],winter:[1,1,1],
};
