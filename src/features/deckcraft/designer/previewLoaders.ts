/** Lightweight loader references shared by the page and its drawing workspace. */
export const loadViewer=()=>import('../components/viewer3d/Deck3DViewer');
export const loadExteriorStudio=()=>import('./ExteriorStudio');
/** Free-form outline editor (Draw my own): prefetched so a deploy does not 404 a stale chunk mid-edit. */
export const loadPlanBoundaryEditor=()=>import('./PlanBoundaryEditor');
