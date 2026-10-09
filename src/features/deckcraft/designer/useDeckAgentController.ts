import {useEffect,useRef} from 'react';
import {createDeckAgentController,type DeckAgentApi,type DeckAgentController,type DeckAgentHost,type DeckAgentHostState} from './deckAgentController';
import {internalModeOn,setInternalMode} from '../internalMode';

export type DeckAgentAdapter=DeckAgentHostState&Omit<DeckAgentHost,'getState'|'waitForRender'>;
declare global {interface Window {deckcraft?:DeckAgentApi}}

/** Render state and callbacks stay in one ref. A queued command never captures yesterday's design or ledger. */
export function useDeckAgentController(adapter:DeckAgentAdapter):DeckAgentController {
  const current=useRef(adapter);current.current=adapter;
  const connected=useRef(true);
  const waiters=useRef(new Set<{test:(s:DeckAgentHostState)=>boolean;resolve:()=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>());
  const controller=useRef<DeckAgentController|null>(null);
  if(!controller.current)controller.current=createDeckAgentController({
    getState:()=>({...current.current,ready:connected.current&&current.current.ready}),
    commitDesign:next=>current.current.commitDesign(next),undo:()=>current.current.undo(),redo:()=>current.current.redo(),
    setView:view=>current.current.setView(view),openSection:section=>current.current.openSection(section),
    actions:Object.fromEntries(['save.json','export.obj','export.dxf','export.dxf2d','permit.pdf','proposal.open','proposal.pdf','review.open'].map(name=>[name,async()=>{const fn=current.current.actions?.[name as keyof NonNullable<DeckAgentHost['actions']>];if(!fn)throw new Error('This host action is unavailable.');await fn();}])) as DeckAgentHost['actions'],
    shareOrigin:adapter.shareOrigin,
    waitForRender:test=>{
      if(test(current.current))return Promise.resolve();
      return new Promise<void>((resolve,reject)=>{
        const item={test,resolve,reject,timer:setTimeout(()=>{waiters.current.delete(item);reject(new Error('Host render acknowledgement timed out; read the current design before retrying with a new id.'));},15000)};
        waiters.current.add(item);
      });
    },
  });
  const api=controller.current;
  useEffect(()=>{
    api.notify();
    for(const w of waiters.current)if(w.test(current.current)){clearTimeout(w.timer);waiters.current.delete(w);w.resolve();}
  });
  useEffect(()=>{
    connected.current=true;
    const previous=window.deckcraft,exposed=Object.freeze({describe:api.describe,read:api.read,preview:api.preview,execute:api.execute,internalMode:internalModeOn,setInternalMode});window.deckcraft=exposed;
    return ()=>{
      if(window.deckcraft===exposed){if(previous)window.deckcraft=previous;else delete window.deckcraft;}
      connected.current=false;
      for(const w of waiters.current){clearTimeout(w.timer);w.reject(new Error('DeckCraft page disconnected.'));}waiters.current.clear();
      // React StrictMode mounts effects twice; retain the controller until the actual hook instance is discarded.
    };
  },[api]);
  return api;
}
