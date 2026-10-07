import {loadPoolTypesRuntime,poolTypesReady} from './poolTypes';
import {loadPoolModelRuntime,poolModelReady} from './poolModel';
import {loadPoolDrawingsRuntime,poolDrawingsReady} from './poolDrawings';
import {loadPoolQuoteTypesRuntime,poolQuoteTypesReady} from './poolQuoteTypes';
import {poolQuoteReady} from './poolQuoteRegistry';
const loadPoolQuoteRuntime=()=>import('./poolQuoteRuntime');
export const poolDesignReady=(geometry:boolean,privateQuotes:boolean)=>(!geometry||poolTypesReady()&&poolModelReady()&&poolDrawingsReady()&&poolQuoteReady())&&(!privateQuotes||poolQuoteTypesReady()&&poolQuoteReady());
export async function loadPoolDesignExtensions(geometry:boolean,privateQuotes:boolean){await Promise.all([...(geometry?[loadPoolTypesRuntime(),loadPoolModelRuntime(),loadPoolDrawingsRuntime(),loadPoolQuoteRuntime()]:[]),...(privateQuotes?[loadPoolQuoteTypesRuntime(),loadPoolQuoteRuntime()]:[])]);}
