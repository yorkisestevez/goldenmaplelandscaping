import type {LightingZone} from '../types';

/**
 * The old numbered wizard's steps. The page has sections now (sections.ts); this list stays only for analytics: each
 * section's `legacyStep` indexes it, so the GA4 step labels (stepLabel) keep their meaning across the change.
 */
export const STEPS=['Dimensions','Materials','Stairs & railings','Site & extras','Backyard','Your estimate'];
export const LIGHTING_ZONES:readonly [LightingZone,string][]=[['deck','Deck / recessed'],['posts','Railing posts'],['stairs','Stairs'],['privacy','Privacy screens'],['landscape','Landscape'],['house','House']];
export const allowedLightingZones=(geometry:string):LightingZone[]=>geometry==='recessed'?['deck','stairs','posts','landscape']:geometry==='wall'?['deck','stairs','posts','privacy','house']:geometry==='undercap'?['deck','stairs','posts','privacy']:geometry==='bollard'||geometry==='spot'?['landscape']:['house'];
/**
 * What the drawing shows. The Plan sheet is 'plan' (the site plan). The 3D sheet is a camera: '3d' (the corner view),
 * 'overview', 'front' or 'top'. The Framing sheet is 'drawing' (the 2D framing plan) or a 3D contractor view:
 * 'structure', 'hardware' or 'foundation'.
 */
export type PreviewMode='3d'|'overview'|'plan'|'drawing'|'structure'|'foundation'|'hardware'|'front'|'top';
export const CAMERA_MODES:readonly PreviewMode[]=['3d','overview','front','top'];
export const FRAMING_MODES:readonly PreviewMode[]=['drawing','structure','hardware','foundation'];
export type AutoCounts={posts:number;stairs:number;privacy:number};
/**
 * The site plan's tools (R5), one at a time: size and place the deck (its handles, figures and shape shortcuts), draw a
 * custom outline, place the stairs, and size the house. Page state only; never saved.
 */
export type PlanTool='size'|'outline'|'stairs'|'house';
export const PLAN_TOOLS:readonly (readonly [PlanTool,string])[]=[['size','Size & place'],['outline','Draw outline'],['stairs','Stairs'],['house','House']];
