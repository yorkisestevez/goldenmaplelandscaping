import {useDeckAgentController,type DeckAgentAdapter} from './useDeckAgentController';
import AgentControlPanel from './AgentControlPanel';
import {lazy,Suspense} from 'react';
import {createPortal} from 'react-dom';
import type {AgentRequest} from './deckAgentController';
import './assistantWorkspace.css';
const NaturalLanguagePanel=lazy(()=>import('./NaturalLanguagePanel'));

/** Loaded after hydration so the editor's first route does not include its automation console. */
export default function DeckAgentBridge({adapter,open,onClose,plainLanguageOpen=false,onClosePlainLanguage,selection={partIds:[],boards:[]},dockTargetId,onTargetsChange}:{adapter:DeckAgentAdapter;open:boolean;onClose:()=>void;plainLanguageOpen?:boolean;onClosePlainLanguage?:()=>void;selection?:{partIds:string[];boards:{level:number;index:number}[]};dockTargetId?:string;onTargetsChange?:(request:AgentRequest|null)=>void}){
  const controller=useDeckAgentController(adapter);
  const target=dockTargetId&&typeof document!=='undefined'?document.getElementById(dockTargetId):null;
  const panel=plainLanguageOpen&&<Suspense fallback={<p role="status">Opening edit assistant…</p>}><NaturalLanguagePanel presentation={dockTargetId?'dock':'dialog'} controller={controller} selection={selection} onTargetsChange={onTargetsChange} onClose={()=>onClosePlainLanguage?.()}/></Suspense>;
  return <><AgentControlPanel controller={controller} open={open} onClose={onClose}/>{target?createPortal(panel,target):panel}</>;
}
