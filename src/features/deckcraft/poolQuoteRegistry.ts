import type {DeckData} from './types';
import type {YardModel} from './yardModel';
import type {EstimateResult} from './calculations';
type Runtime=Pick<typeof import('./poolQuoteRuntime'),'buildPoolQuote'|'poolPricedEarthwork'>;
let runtime:Runtime|undefined;
export function registerPoolQuoteRuntime(v:Runtime){runtime=v;}
export const poolQuoteReady=()=>!!runtime;
function ready(){if(!runtime)throw Error('Prepare pool costs before calculating.');return runtime;}
export function poolPricedEarthwork(data:DeckData,model:YardModel){return data.pools?.some(p=>p.enabled)?ready().poolPricedEarthwork(data,model):undefined;}
export function buildPoolQuote(data:DeckData,model:YardModel,markup:number):{sections:EstimateResult['sections'];pending:string[];flags:string[];review:import('./poolQuoteRuntime').PoolQuoteReview}|undefined{return data.pools?.some(p=>p.enabled)?ready().buildPoolQuote(data,model,markup):undefined;}
