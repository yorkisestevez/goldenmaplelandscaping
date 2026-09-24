import type {LightingZone} from '../types';

/**
 * The old numbered wizard's steps. The page has sections now (sections.ts); this list stays only for analytics: each
 * section's `legacyStep` indexes it, so the GA4 step labels (stepLabel) keep their meaning across the change.
 */
export const STEPS=['Dimensions','Materials','Stairs & railings','Site & extras','Backyard','Your estimate'];
export const LIGHTING_ZONES:readonly [LightingZone,string][]=[['deck','Deck / recessed'],['posts','Railing posts'],['stairs','Stairs'],['privacy','Privacy screens'],['landscape','Landscape'],['house','House']];
export const allowedLightingZones=(geometry:string):LightingZone[]=>geometry==='recessed'?['deck','stairs','posts','landscape']:geometry==='wall'?['deck','stairs','posts','privacy','house']:geometry==='undercap'?['deck','stairs','posts','privacy']:geometry==='bollard'||geometry==='spot'?['landscape']:['house'];
export type PreviewMode='3d'|'overview'|'plan'|'structure'|'foundation'|'hardware'|'front'|'top';
export type AutoCounts={posts:number;stairs:number;privacy:number};
