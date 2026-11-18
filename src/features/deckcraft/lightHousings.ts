import {WEDGE_HEIGHT_IN} from './wedgeHeight';

/** Fixture housing sizes, in inches. Kept apart from fixtureLight so the eager layout can place them. */
/** A catalogue recessed housing sits in the paving. The trim's top is this far above the paver (about 0.8 mm) and the
 * lens this much again (about 1 mm), so the fixture reads as set into the stone rather than as a puck on it. */
export const FLUSH_TRIM_IN=0.03,FLUSH_LENS_PROUD_IN=0.04;
/** The legacy WEDGE: a shallow plate in the riser. The face is local z = 0; the body is behind it. */
export const WEDGE_HOUSING={width:2.5,height:WEDGE_HEIGHT_IN,depth:0.84,lensWidth:1.7,lensHeight:0.28,lensY:-0.22,lensProud:0.04};
