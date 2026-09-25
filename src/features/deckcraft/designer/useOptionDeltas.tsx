import {useEffect,useMemo,useRef,useState,useSyncExternalStore,type ReactElement} from 'react';
import type {DeckData} from '../types';
import type {SelectEffect} from './fields';
import {optionGroups,type OptionGroup,type OptionGroupId} from './optionGroups';
import type {DeltaBase,DeltaView} from './optionDeltas';
import type {SectionId} from './sections';

/**
 * The option deltas in a section body (R6). The section bodies load this with themselves; the engine side
 * (optionDeltas.ts) loads only once deltas are wanted. A desktop (a wide screen with a mouse, without Save-Data) shows
 * them as soon as a section opens. On a phone one engine run can pass 50 ms at 4x CPU slowdown (the R6 timing spike), and
 * Save-Data asks for no extra downloads, so there the visitor taps "Show price effect" first; the choice holds for the
 * visit (page state). Only the open section's groups are priced, one option at a time off the main thread (optionDeltas.ts);
 * a result is shown only for the design it was priced for, and each result re-renders only the text beside its option.
 */

/** The page's side: the live estimate (subtotal, quotes, schedule lines, estimate key) and the visitor's "Show price effect" choice. */
export interface DeltaProps extends DeltaBase{shown:boolean;setShown:(shown:boolean)=>void}

const loadOptionDeltas=()=>import('./optionDeltas');
type Engine=Awaited<ReturnType<typeof loadOptionDeltas>>;
let engine:Engine|null=null;

/** Whether this device prices options on its own: a wide screen with a mouse, without Save-Data. */
export function deltasByDefault(){
  if(typeof window==='undefined')return false;
  if((navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData)return false;
  return !!window.matchMedia?.('(min-width: 761px) and (pointer: fine)').matches;
}

export interface OptionDeltas{
  /** Priced without being asked (a desktop). */
  auto:boolean;
  /** Shown now. */
  on:boolean;
  toggle:()=>void;
  /** An option's delta, once priced for this design; never for the current choice. */
  view:(group:OptionGroupId,value:string)=>DeltaView|undefined;
  /** The price effect line under a select, and its id for the select's description; undefined while deltas are off. */
  effect:(group:OptionGroupId)=>SelectEffect|undefined;
  /** An option button's price effect: its text (aria-hidden) and the description id; null while off or for the current choice. */
  forOption:(group:OptionGroupId,value:string)=>{id:string;text:ReactElement}|null;
}

export function useOptionDeltas(section:SectionId,data:DeckData,props:DeltaProps):OptionDeltas{
  const [auto]=useState(deltasByDefault);
  const on=auto||props.shown;
  const groups=optionGroups(section,data);
  const base:DeltaBase={key:props.key,subtotal:props.subtotal,quotes:props.quotes,lines:props.lines};
  // Each priced option re-renders the texts beside the options (they subscribe), not the section body.
  const store=useMemo(()=>{let version=0;const subscribers=new Set<()=>void>();return {get:()=>version,subscribe:(fn:()=>void)=>{subscribers.add(fn);return ()=>{subscribers.delete(fn);};},bump:()=>{version++;for(const fn of subscribers)fn();}};},[]);
  const latest=useRef({base,data,groups});latest.current={base,data,groups};
  const priced=on&&groups.length>0;
  useEffect(()=>{
    if(!priced)return;
    let stop:(()=>void)|undefined,cancelled=false;
    const start=(loaded:Engine)=>{
      engine=loaded;if(cancelled)return;
      const {base,data,groups}=latest.current;
      store.bump();// the ones already priced for this design show at once
      stop=loaded.runOptionDeltas({base,data,groups,onPriced:store.bump});
    };
    if(engine)start(engine);else loadOptionDeltas().then(start).catch(()=>{/* Tried again on the next change. */});
    return ()=>{cancelled=true;stop?.();};
  },[priced,props.key,section,store]);
  const group=(id:OptionGroupId)=>groups.find(g=>g.id===id);
  const view=(id:OptionGroupId,value:string)=>{
    const g=group(id),choice=g&&value!==g.current?g.choices.find(c=>c.value===value):undefined;
    return on&&engine&&choice?engine.cachedDelta(base,choice.patch):undefined;
  };
  const ids=(id:OptionGroupId,value='')=>`dd-delta-${section}-${id}${value&&`-${value.replace(/[^\w-]/g,'_')}`}`;
  return {
    auto,on,toggle:()=>props.setShown(!props.shown),view,
    effect:id=>{const g=group(id);return on&&g?{id:ids(id),line:<DeltaLine id={ids(id)} group={g} view={view} store={store}/>}:undefined;},
    forOption:(id,value)=>{const g=group(id);return on&&g&&value!==g.current?{id:ids(id,value),text:<OptionDelta id={ids(id,value)} group={id} value={value} view={view} store={store}/>}:null;},
  };
}

type Store={get:()=>number;subscribe:(fn:()=>void)=>()=>void};
/** A delta's figure (mono), and its note ("· 1 fewer to quote") in body type; the text reads the same. */
function DeltaText({d}:{d:DeltaView}){
  const [figure,...note]=d.text.split(' · ');
  return <><b data-kind={d.kind}>{figure}</b>{note.length>0&&<span className="dd-delta-note"> · {note.join(' · ')}</span>}</>;
}
const useVersion=(store:Store)=>useSyncExternalStore(store.subscribe,store.get,store.get);

/** The text inside an option button ("+$1,240"): hidden from its name, and its accessible description instead. */
function OptionDelta({id,group,value,view,store}:{id:string;group:OptionGroupId;value:string;view:OptionDeltas['view'];store:Store}){
  useVersion(store);
  const d=view(group,value);
  return <small id={id} className="dd-delta" data-kind={d?.kind??'pending'} aria-hidden="true">{d?<DeltaText d={d}/>:'…'}</small>;
}

/**
 * The line under a select: each other choice and its price effect, in the select's order ("Price effect: None −$2,100 ·
 * Glass Panels +$1,240"). Three or more choices that would each be a supplier quote read as one ("18 others: supplier
 * quote"). The select is described by it.
 */
function DeltaLine({id,group,view,store}:{id:string;group:OptionGroup;view:OptionDeltas['view'];store:Store}){
  useVersion(store);
  const others=group.choices.filter(c=>c.value!==group.current).map(choice=>({choice,d:view(group.id,choice.value)}));
  const priced=others.filter(o=>o.d),quoted=priced.filter(o=>o.d!.text==='supplier quote'),fold=quoted.length>=3;
  const listed=fold?priced.filter(o=>!quoted.includes(o)):priced,pending=priced.length<others.length;
  // One row per choice (its name, then its effect), so a wrapped line never sets an amount against the next choice.
  // The " · " separators stay in the text for screen readers, so the select's description reads as before.
  return <small id={id} className="dd-deltas"><span className="dd-deltas-head">Price effect:</span> {listed.map(({choice,d},i)=><span key={choice.value} className="dd-delta-row">{i?<span className="dd-sep"> · </span>:''}<span>{choice.label}</span> <span className="dd-delta-fig"><DeltaText d={d!}/></span></span>)}
    {fold&&<span className="dd-delta-row">{listed.length?<span className="dd-sep"> · </span>:''}<span>{quoted.length} {listed.length?'others':'choices'}:</span> <b data-kind="quote">supplier quote</b></span>}
    {pending&&<span className="dd-delta-row" aria-hidden="true">{priced.length?<span className="dd-sep"> · </span>:''}…</span>}</small>;
}

/** "Show price effect", where options are not priced without asking (a phone, or Save-Data). */
export function DeltaToggle({deltas}:{deltas:OptionDeltas}){
  if(deltas.auto)return null;
  return <p className="dd-delta-toggle"><button type="button" className="dd-secondary" aria-pressed={deltas.on} onClick={deltas.toggle}>Show price effect</button>
    <span className="dd-note">{deltas.on?'Each choice shows what it does to the priced subtotal.':'See what each choice would do to the price.'}</span></p>;
}
