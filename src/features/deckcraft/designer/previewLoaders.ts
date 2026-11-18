/** Lightweight loader references shared by the page and its drawing workspace. */
export const loadViewer=()=>import('../components/viewer3d/Deck3DViewer');
export const loadExteriorStudio=()=>import('./ExteriorStudio');
/** Free-form outline editor (Draw my own): prefetched so a deploy does not 404 a stale chunk mid-edit. */
export const loadPlanBoundaryEditor=()=>import('./PlanBoundaryEditor');
/** The drawing's prerendered pieces (the Project controls, the tools ribbon, the plan): the page starts them with the
 * drawing itself, not after it, because it holds hydration until they are in (DeckDesigner.tsx, piecesReady). */
export const loadArchitectShortcuts=()=>import('./ArchitectShortcuts');
export const loadPlanToolPicker=()=>import('./PlanToolPicker');
export const loadPlanEditingWorkspace=()=>import('./PlanEditingWorkspace');

/** A desktop (wide screen, mouse) that is not saving data: it fetches the 3D viewer while the plan is on screen, and the
 * homeowner page opens on it (DeckDesigner). Evaluating the viewer starts the day-sky download, so a phone waits until its
 * 3D sheet is chosen to spend that data and keep the plan's first paint quick. Opening the 3D sheet loads it either way. */
export const desktopViewer=()=>typeof window!=='undefined'&&!(navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData&&!!window.matchMedia?.('(min-width: 761px) and (pointer: fine)').matches;
export function prefetchViewer(){
  // The import is asynchronous, so it does not block the plan.
  if(desktopViewer())void loadViewer().catch(()=>{/* The 3D sheet loads it again. */});
}
