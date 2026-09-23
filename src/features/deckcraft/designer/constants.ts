import type {LightingZone} from '../types';

export const STEPS=['Dimensions','Materials','Stairs & railings','Site & extras','Backyard','Your estimate'];
export const LIGHTING_ZONES:readonly [LightingZone,string][]=[['deck','Deck / recessed'],['posts','Railing posts'],['stairs','Stairs'],['privacy','Privacy screens'],['landscape','Landscape'],['house','House']];
export const allowedLightingZones=(geometry:string):LightingZone[]=>geometry==='recessed'?['deck','stairs','posts','landscape']:geometry==='wall'?['deck','stairs','posts','privacy','house']:geometry==='undercap'?['deck','stairs','posts','privacy']:geometry==='bollard'||geometry==='spot'?['landscape']:['house'];
export type PreviewMode='3d'|'overview'|'plan'|'structure'|'foundation'|'hardware'|'front'|'top';
export type AutoCounts={posts:number;stairs:number;privacy:number};
