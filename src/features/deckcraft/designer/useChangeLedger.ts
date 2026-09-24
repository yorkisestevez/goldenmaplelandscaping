import {useMemo,useReducer} from 'react';
import {dollars} from '../designFacts';
import {DECKING_CATALOGUE,RAILING_CATALOGUE} from '../manufacturerCatalog';
import {GROUP_MS} from './designHistory';
import type {Ledger,LedgerQuote,QuoteKind} from './priceLedgerModel';
import {FIELD_NAMES,fieldName} from './sections';

/**
 * "Your changes": what each change did to the price. An edit records the priced subtotal and the quotes as they stood
 * at that moment; every estimate after it updates that edit's record, so the automatic lighting sync counts toward the
 * edit that caused it. Edits to the same fields within GROUP_MS join one record (one gesture: a drag, a number box
 * being typed in). Undo and redo are records of their own; a whole new design (an import, a link, starting over, going
 * back to your own design) clears the list. The reducer is pure (the time comes with each action) for the checks.
 */
export interface PriceState{subtotal:number;quotes:readonly LedgerQuote[]}
export interface ChangeRecord{id:number;kind:'edit'|'undo'|'redo'|'loaded';key:string;label:string;value?:string;before:PriceState;after:PriceState;at:number}
export interface ChangeLedgerState{current:PriceState|null;records:ChangeRecord[];nextId:number}
export type ChangeAction=
  |{type:'price';price:PriceState}
  |{type:'edit';key:string;label:string;value?:string;now:number}
  |{type:'undo'|'redo'|'loaded';now:number};

/** The most recent changes kept on the list. */
export const MAX_CHANGES=12;
export const EMPTY_CHANGES:ChangeLedgerState={current:null,records:[],nextId:1};
const NONE:PriceState={subtotal:0,quotes:[]};

export function changeLedger(state:ChangeLedgerState,action:ChangeAction):ChangeLedgerState{
  if(action.type==='price'){
    const last=state.records.at(-1);
    return {...state,current:action.price,records:last?[...state.records.slice(0,-1),{...last,after:action.price}]:state.records};
  }
  const now=action.now,base=state.current??NONE,last=state.records.at(-1);
  if(action.type==='edit'&&last?.kind==='edit'&&last.key===action.key&&now-last.at<GROUP_MS)
    return {...state,records:[...state.records.slice(0,-1),{...last,value:action.value,at:now}]};
  const record:ChangeRecord=action.type==='edit'
    ?{id:state.nextId,kind:'edit',key:action.key,label:action.label,value:action.value,before:base,after:base,at:now}
    :{id:state.nextId,kind:action.type,key:action.type,label:action.type==='undo'?'Undo':action.type==='redo'?'Redo':'New design loaded',before:base,after:base,at:now};
  return {...state,nextId:state.nextId+1,records:action.type==='loaded'?[record]:[...state.records,record].slice(-MAX_CHANGES)};
}

/** The price state the change list follows: the priced subtotal and the quotes. */
export const priceState=(ledger:Ledger):PriceState=>({subtotal:ledger.subtotal,quotes:ledger.quotes});

/** "+$1,240" or "−$380" (a true minus sign). */
export const signedDollars=(n:number)=>`${n>0?'+':'−'}${dollars(Math.abs(n))}`;
const kindsWord=(kinds:QuoteKind[])=>kinds.includes('supplier')&&kinds.includes('builder')?'supplier and builder quotes':`a ${kinds[0]} quote`;

/**
 * A record in words: its effect ("+$1,240", "−$380", "No price change", "Now a supplier quote"), what changed
 * ("Railing style → Glass Panels"), and a note: what the priced total did when the effect is a quote, or how many
 * fewer selections are left to quote.
 */
export function describeChange(record:ChangeRecord):{effect:string;label:string;note:string;kind:'up'|'down'|'same'|'quote'|'loaded'}{
  const label=record.value?`${record.label} → ${record.value}`:record.label;
  if(record.kind==='loaded')return {effect:'',label,note:'',kind:'loaded'};
  const delta=record.after.subtotal-record.before.subtotal,moved=Math.abs(delta)>=.5;
  const had=new Set(record.before.quotes.map(q=>q.label)),has=new Set(record.after.quotes.map(q=>q.label));
  const added=record.after.quotes.filter(q=>!had.has(q.label)),dropped=record.before.quotes.filter(q=>!has.has(q.label)).length;
  if(added.length){
    const kinds=[...new Set(added.map(q=>q.kind))];
    return {effect:`Now ${kindsWord(kinds)}`,label,note:moved?`priced total ${signedDollars(delta)}`:'',kind:'quote'};
  }
  return {effect:moved?signedDollars(delta):'No price change',label,note:dropped?`${dropped} fewer to quote`:'',kind:moved?delta>0?'up':'down':'same'};
}
/** One sentence for the live announcement. */
export function announceChange(record:ChangeRecord):string{
  const {effect,label,note}=describeChange(record);
  return `${label.replace(' → ',': ')}. ${effect}${note?`, ${note}`:''}. Priced subtotal ${dollars(record.after.subtotal)}.`;
}

// A change's new value, in words, when it is one plain value.
const UNITS:Partial<Record<string,string>>={width:'ft',length:'ft',width2:'ft',length2:'ft',benchLf:'ft',railingLf:'ft',inlayLf:'ft',height:'in',height2:'in',stairWidth:'in',landingDepthIn:'in',foundationDepthIn:'in',pictureFrameOverhangIn:'in',houseWallHeightIn:'in',privacySqft:'sq ft',pergolaSqft:'sq ft'};
export function changeValue(field:string,value:unknown):string|undefined{
  if(field==='deckingMaterial')return DECKING_CATALOGUE.find(m=>m.id===value)?.name;
  if(field==='catalogueRailingId')return RAILING_CATALOGUE.find(r=>r.id===value)?.name??'None';
  if(typeof value==='boolean')return value?'Yes':'No';
  if(typeof value==='number')return UNITS[field]?`${value} ${UNITS[field]}`:String(value);
  return typeof value==='string'&&value&&value.length<=40?value:undefined;
}

/** Fields that are the visitor's own details, never a design choice: not listed. */
const PERSONAL=new Set(['customerName','projectAddress','scopeOfWork']);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
/**
 * An edit as the change list names it: the fields it really changes (a part of a field, like the railing colour,
 * by itself), the first one's plain name and its new value. Null for an edit that changes nothing listed.
 */
export function describeEdit(patch:Record<string,unknown>,data:Record<string,unknown>):{key:string;label:string;value?:string}|null{
  const fields=Object.keys(patch).filter(k=>!PERSONAL.has(k)&&!same(patch[k],data[k])).flatMap(k=>{
    const parts=Object.keys(FIELD_NAMES).filter(f=>f.startsWith(`${k}.`)),next=patch[k] as Record<string,unknown>|undefined,prev=data[k] as Record<string,unknown>|undefined;
    if(!parts.length)return [k];
    const changed=[...new Set([...Object.keys(next??{}),...Object.keys(prev??{})])].filter(p=>!same(next?.[p],prev?.[p]));
    return changed.length&&changed.every(p=>parts.includes(`${k}.${p}`))?changed.map(p=>`${k}.${p}`):[k];
  });
  if(!fields.length)return null;
  const first=fields.find(f=>f in FIELD_NAMES)??fields[0],[key,part]=first.split('.');
  const value=part?(patch[key] as Record<string,unknown>|undefined)?.[part]:patch[key];
  return {key:[...fields].sort().join(','),label:fieldName(first),value:changeValue(first,value)};
}

/** The change list for the page: the records, and what the page tells it (edits, undo, redo, a new design, prices). */
export function useChangeLedger(){
  const [state,dispatch]=useReducer(changeLedger,EMPTY_CHANGES);
  const api=useMemo(()=>({
    edit:(patch:object,data:object)=>{const edit=describeEdit(patch as Record<string,unknown>,data as Record<string,unknown>);if(edit)dispatch({type:'edit',...edit,now:Date.now()});},
    undo:()=>dispatch({type:'undo',now:Date.now()}),
    redo:()=>dispatch({type:'redo',now:Date.now()}),
    loaded:()=>dispatch({type:'loaded',now:Date.now()}),
    price:(price:PriceState)=>dispatch({type:'price',price}),
  }),[]);
  return {records:state.records,...api};
}
