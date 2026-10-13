/** Lightweight loader references shared by the page and its drawing workspace. */
export const loadViewer=()=>import('../components/viewer3d/Deck3DViewer');
export const loadExteriorStudio=()=>import('./ExteriorStudio');
/** Free-form outline editor (Draw my own): prefetched so a deploy does not 404 a stale chunk mid-edit. */
export const loadPlanBoundaryEditor=()=>import('./PlanBoundaryEditor');

/** Fetch the 3D viewer while the plan is on screen, including phones, unless the browser is saving data.
 * Evaluating the viewer starts the day-sky download. Opening the 3D sheet still loads it if this was skipped. */
export function prefetchViewer(){
  if(typeof window==='undefined')return;
  if((navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData)return;
  // The import is asynchronous, so it does not block the plan. Save-Data waits until the 3D sheet is opened.
  void loadViewer().catch(()=>{/* The 3D sheet loads it again. */});
}
