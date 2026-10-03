import {useEffect,useSyncExternalStore} from 'react';
import type {DeckData} from '../types';
import {cleanPergolaQuote,pergolaQuoteKey,type PergolaQuote} from '../pergolaPricing';
const PREFIX='deckcraft.private-pergola-quote.v1.';
const listeners=new Set<()=>void>();let revision=0;const cache=new Map<string,PergolaQuote>();
const subscribe=(f:()=>void)=>{listeners.add(f);return()=>{listeners.delete(f);};};
const snapshot=()=>revision;
/** Deliberately outside DeckData: never serialized, sent, or put in a share link. */
export function usePergolaQuote(data:DeckData){
 useSyncExternalStore(subscribe,snapshot,()=>0);const key=pergolaQuoteKey(data);
 useEffect(()=>{if(cache.has(key))return;let loaded:PergolaQuote={};try{loaded=cleanPergolaQuote(JSON.parse(window.localStorage.getItem(PREFIX+key)??'{}'));}catch{/* No saved costs. */}cache.set(key,loaded);revision++;listeners.forEach(f=>f());},[key]);
 let quote=cache.get(key);
 if(!quote)quote={};
 return {quote,revision,updateQuote:(patch:Partial<PergolaQuote>)=>{const next=cleanPergolaQuote({...cache.get(key),...patch});cache.set(key,next);try{window.localStorage.setItem(PREFIX+key,JSON.stringify(next));}catch{/* Local storage may be disabled; costs still work for this session. */}revision++;listeners.forEach(f=>f());}};
}
