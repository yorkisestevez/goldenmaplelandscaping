import type {YardFlagstone} from './types';

/** The save validator's part of natural flagstone, kept apart so the page's first load carries only this (flagstone.ts
 * holds the rest and loads with the yard runtime). */
export const FLAGSTONE_PRODUCT_ID='natural-flagstone';

/** A strict copy of a saved flagstone spec (joints 1–3 in), or undefined when it is not one. includes(), not a regex: a
 * regex test would coerce an array or object to text and let it through. An array fails the key or stone test. */
export function flagstoneSpec(v:unknown):YardFlagstone|undefined{
 const o=v as Record<string,unknown>;
 return o&&typeof o==='object'&&Object.keys(o).every(k=>/^(stone|jointIn|jointColour)$/.test(k))&&['granite','limestone','sandstone'].includes(o.stone as string)&&['black','tan','grey'].includes(o.jointColour as string)&&typeof o.jointIn==='number'&&o.jointIn>=1&&o.jointIn<=3?{stone:o.stone,jointIn:o.jointIn,jointColour:o.jointColour} as YardFlagstone:undefined;
}
