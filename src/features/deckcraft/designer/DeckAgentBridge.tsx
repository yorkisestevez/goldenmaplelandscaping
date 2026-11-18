import {useDeckAgentController,type DeckAgentAdapter} from './useDeckAgentController';
import AgentControlPanel from './AgentControlPanel';
import {lazy,Suspense,useEffect,useRef} from 'react';
import type {SelectionState} from './selectionState';
import type {AgentSnapshot} from './deckAgentController';
import {resolveWorkspaceSelection,workspaceObjects} from './workspaceVoiceCommands';
import {createPortal} from 'react-dom';
import type {AgentRequest} from './deckAgentController';
import type {AssistedSelection} from './naturalLanguageCommands';
import type {ExpertId} from './expertAgents';
import './assistantWorkspace.css';
const NaturalLanguagePanel=lazy(()=>import('./NaturalLanguagePanel'));

/** Loaded after hydration so the editor's first route does not include its automation console. */
export default function DeckAgentBridge({adapter,open,onClose,plainLanguageOpen=false,onClosePlainLanguage,selection={partIds:[],boards:[]},dockTargetId,onTargetsChange,onSelect,onPreviewDesign,initialExpert='general'}:{adapter:DeckAgentAdapter;open:boolean;onClose:()=>void;plainLanguageOpen?:boolean;onClosePlainLanguage?:()=>void;selection?:AssistedSelection;dockTargetId?:string;onTargetsChange?:(request:AgentRequest|null)=>void;onSelect?:(selection:SelectionState)=>void;onPreviewDesign?:(design:AgentSnapshot['design']|null)=>void;initialExpert?:ExpertId}){
  const controller=useDeckAgentController(adapter);
  const current=useRef({selection,onSelect});current.current={selection,onSelect};
  useEffect(()=>{
    const host=window as Window&{deckcraftWorkspace?:unknown},previous=host.deckcraftWorkspace;
    const api=Object.freeze({read:()=>({selection:structuredClone(current.current.selection),objects:workspaceObjects(controller.read())}),select:(name:string)=>{if(typeof name!=='string'||name.length>200)throw Error('Use an object name or ID of up to 200 characters.');if(!current.current.onSelect)throw Error('Selection is unavailable.');const result=resolveWorkspaceSelection(name,controller.read());if(result.ok)current.current.onSelect(result.selection);return result;}});
    host.deckcraftWorkspace=api;return()=>{if(host.deckcraftWorkspace===api)host.deckcraftWorkspace=previous;};
  },[controller]);
  const target=dockTargetId&&typeof document!=='undefined'?document.getElementById(dockTargetId):null;
  const panel=plainLanguageOpen&&<Suspense fallback={<p role="status">Opening edit assistant…</p>}><NaturalLanguagePanel presentation={dockTargetId?'dock':'dialog'} controller={controller} onSelect={onSelect} onPreviewDesign={onPreviewDesign} selection={selection} onTargetsChange={onTargetsChange} initialExpert={initialExpert} onClose={()=>onClosePlainLanguage?.()}/></Suspense>;
  return <><AgentControlPanel controller={controller} open={open} onClose={onClose}/>{target?createPortal(panel,target):panel}</>;
}
