import {useEffect,useSyncExternalStore} from 'react';
import type {DeckData} from '../types';
import {cleanPergolaQuote,pergolaQuoteKey,type PergolaQuote,type PergolaQuoteContext} from '../pergolaPricing';
import {PERGOLA_QUOTE_PREFIX as PREFIX} from '../pergolaQuoteStorage';
const listeners=new Set<()=>void>();let revision=0;const cache=new Map<string,PergolaQuote>();
const subscribe=(f:()=>void)=>{listeners.add(f);return()=>{listeners.delete(f);};};
const snapshot=()=>revision;
/** Worksheet storage and private revision snapshots never enter public serialization or links. */
export function usePergolaQuote(data:DeckData,onUpdate?:(patch:Partial<DeckData>)=>void,onHydrate?:(context:PergolaQuoteContext)=>void){
 useSyncExternalStore(subscribe,snapshot,()=>0);const key=pergolaQuoteKey(data);
 const restored=data.pergolaQuoteCosts?.key===key?data.pergolaQuoteCosts:undefined;
 const restoration=JSON.stringify(restored);
 useEffect(()=>{if(cache.has(key)&&!restored){if(data.pergola)onHydrate?.({key,quote:cache.get(key)!});return;}let loaded:PergolaQuote={};try{loaded=cleanPergolaQuote(JSON.parse(window.localStorage.getItem(PREFIX+key)??'{}'));}catch{/* No saved costs. */}if(restored){loaded=cleanPergolaQuote(restored.quote);try{window.localStorage.setItem(PREFIX+key,JSON.stringify(loaded));}catch{}}cache.set(key,loaded);if(data.pergola&&JSON.stringify(restored?.quote)!==JSON.stringify(loaded))onHydrate?.({key,quote:loaded});revision++;listeners.forEach(f=>f());},[key,restoration]);
 let quote=restored?.quote??cache.get(key);
 if(!quote)quote={};
 return {quote,revision,updateQuote:(patch:Partial<PergolaQuote>)=>{const next=cleanPergolaQuote({...cache.get(key),...patch});cache.set(key,next);try{window.localStorage.setItem(PREFIX+key,JSON.stringify(next));}catch{/* Local storage may be disabled; costs still work for this session. */}onUpdate?.({pergolaQuoteCosts:{key,quote:next}});revision++;listeners.forEach(f=>f());}};
}
