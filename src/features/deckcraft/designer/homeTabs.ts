import type {PlanTool} from './constants';
import type {SectionId} from './sections';

/**
 * The homeowner's four tabs (simplify plan Option B, PR 2): Draw · Materials · Extras · Price & send. Any tab opens at any
 * time; there is no counter and no Next or Back. A tab names the plan tools shown above the drawing, the sections in its
 * panel and the view it opens (null keeps the current one). Designer Mode keeps its ribbon and properties instead.
 */
export type HomeTabId='draw'|'materials'|'extras'|'send'|'shape'|'boards'|'stairs'|'yard';
export interface HomeTab{id:HomeTabId;name:string;tools:readonly PlanTool[];sections:readonly SectionId[];view:'plan'|'3d'|null}

export const HOME_TABS:readonly HomeTab[]=[
  {id:'draw',name:'Draw',tools:['size','outline','stairs','house','edges'],sections:['deck','stairs','house'],view:'plan'},
  {id:'materials',name:'Materials',tools:['boards','inlays'],sections:['boards'],view:'3d'},
  {id:'extras',name:'Extras',tools:['landscape','yard'],sections:['lighting','extras','backyard'],view:'3d'},
  {id:'send',name:'Price & send',tools:[],sections:['site','proposal'],view:null},
];
/**
 * The cost estimator's studio has its own price and hand-off ("Use this deck"), so it leaves out Price & send; its Extras
 * panel keeps Site & foundation and Proposal & files, which every section's "next" link can still reach.
 */
export const ESTIMATOR_TABS:readonly HomeTab[]=HOME_TABS.filter(t=>t.id!=='send').map(t=>t.id==='extras'?{...t,sections:[...t.sections,'site','proposal']}:t);
/**
 * The new look's five rail groups (next/NextShell.tsx) and the quote the price pill opens. A group names the plan tools it hands
 * the plan, its sections and the view it opens; Boards shows the deck in 3D so a colour change is seen at once.
 */
export const NEXT_TABS:readonly HomeTab[]=[
  {id:'shape',name:'Shape',tools:['size','outline','house'],sections:['deck','house'],view:null},
  {id:'boards',name:'Boards',tools:['boards','inlays'],sections:['boards'],view:'3d'},
  {id:'stairs',name:'Stairs',tools:['stairs','edges'],sections:['stairs'],view:null},
  {id:'yard',name:'Yard',tools:['yard','landscape'],sections:['backyard'],view:null},
  {id:'extras',name:'Extras',tools:[],sections:['lighting','extras','site'],view:null},
  {id:'send',name:'Your quote',tools:[],sections:['proposal'],view:null},
];

/** The layout's single-column width (workspace.css): the panel is a drawer over the foot of the screen there. */
export const PHONE_LAYOUT='(max-width: 800px)';
export const phoneLayout=()=>typeof window!=='undefined'&&!!window.matchMedia?.(PHONE_LAYOUT).matches;

export const tabOfSection=(id:SectionId,tabs:readonly HomeTab[]=HOME_TABS):HomeTab=>tabs.find(t=>t.sections.includes(id))??tabs[0];
export const tabOfTool=(tool:PlanTool,tabs:readonly HomeTab[]=HOME_TABS):HomeTab|null=>tabs.find(t=>t.tools.includes(tool))??null;
/** Showing a tab counts once per visit (deckAnalytics.ts), beside the sections it opens. */
export const homeTabLabel=(id:HomeTabId)=>`deck_home_tab_${id}`;
