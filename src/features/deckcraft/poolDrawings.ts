import type {DeckData} from './types';
import type {DeckTakeoff} from './deckTakeoff';
import type {DrawItem,Pt} from './drawings/drawingTypes';
type Runtime=Pick<typeof import('./poolDrawingsRuntime'),'poolPlanDrawingItems'|'poolSectionDrawingItems'>;
let runtime:Runtime|undefined,loading:Promise<void>|undefined;
export const poolDrawingsReady=()=>!!runtime;
export function registerPoolDrawingsRuntime(value:Runtime){runtime=value;}
export async function loadPoolDrawingsRuntime(){if(runtime)return;loading??=import('./poolDrawingsRuntime').then(v=>{runtime=v;},e=>{loading=undefined;throw e;});await loading;}
const ready=()=>{if(!runtime)throw Error('Pool drawings are loading. Prepare the design before drawing.');return runtime;};
export const poolPlanDrawingItems=(data:DeckData,deck:DeckTakeoff):DrawItem[]=>data.pools?.some(p=>p.enabled)?ready().poolPlanDrawingItems(data,deck):[];
export const poolSectionDrawingItems=(data:DeckData,deck:DeckTakeoff,origin:Pt):DrawItem[]=>data.pools?.some(p=>p.enabled)?ready().poolSectionDrawingItems(data,deck,origin):[];
