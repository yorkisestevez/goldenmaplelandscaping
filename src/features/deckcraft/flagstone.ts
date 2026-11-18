import type {YardFlagstone} from './types';
export {FLAGSTONE_PRODUCT_ID,flagstoneSpec} from './flagstoneSpec';

/** Natural flagstone, cut to fit with one even joint (owner rulings 2026-10-20: 1.5 in joints, black permeable chips). */
export const FLAGSTONE_THICKNESS_IN=2;
/** Joint chips stop this far below the stone top. */
export const FLAGSTONE_JOINT_DROP_IN=1/8;
export const FLAGSTONE_CHIPS={black:'#33312e',tan:'#9a8466',grey:'#6e6d69'} as const;
export const DEFAULT_FLAGSTONE:YardFlagstone={stone:'granite',jointIn:1.5,jointColour:'black'};
