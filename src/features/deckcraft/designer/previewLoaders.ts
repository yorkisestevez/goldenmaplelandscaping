/** Lightweight loader references shared by the page and its drawing workspace. */
export const loadViewer=()=>import('../components/viewer3d/Deck3DViewer');
export const loadExteriorStudio=()=>import('./ExteriorStudio');
/** Free-form outline editor (Draw my own): prefetched so a deploy does not 404 a stale chunk mid-edit. */
export const loadPlanBoundaryEditor=()=>import('./PlanBoundaryEditor');

/** Fetch the 3D viewer while the plan is on screen: a desktop (wide screen, mouse) only, and not when the browser is
 * saving data. Evaluating the viewer starts the day-sky download, so a phone waits until its 3D sheet is chosen to
 * spend that data and keep the plan's first paint quick. Opening the 3D sheet loads it either way. */
export function prefetchViewer(){
  if(typeof window==='undefined')return;
  if((navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData)return;
  if(!window.matchMedia?.('(min-width: 761px) and (pointer: fine)').matches)return;
  // The import is asynchronous, so it does not block the plan.
  void loadViewer().catch(()=>{/* The 3D sheet loads it again. */});
}
