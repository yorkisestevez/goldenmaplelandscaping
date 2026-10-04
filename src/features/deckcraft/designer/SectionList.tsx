import {Suspense,useEffect,useRef,type ReactNode} from 'react';
import type {DeckData} from '../types';
import {SECTION_BY_ID,type SectionId} from './sections';
import {sectionPriceEffect,type Ledger} from './priceLedgerModel';
import {sectionSummary} from './sectionSummaries';
import WorkspaceNavigation from './WorkspaceNavigation';
function Loaded({onLoaded}:{onLoaded:()=>void}){useEffect(()=>{onLoaded();},[]);return null;}
/** A task rail and one focused inspector. Design state outlives each lazily loaded body. */
export default function SectionList({data,ledger,open,onToggle,onOpen,renderBody,onCanvas,onAssistant,inspectorVisible}:{data:DeckData;ledger:Ledger;open:ReadonlySet<SectionId>;onToggle:(id:SectionId)=>void;onOpen:(id:SectionId)=>void;renderBody:(id:SectionId)=>ReactNode;onCanvas?:()=>void;onAssistant?:()=>void;inspectorVisible?:boolean}){
  const active=[...open][0]??'deck',section=SECTION_BY_ID[active],related=SECTION_BY_ID[section.related.id],price=sectionPriceEffect(section,ledger),focus=useRef(false);
  const sheet=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=sheet.current;if(!el)return;if(inspectorVisible&&!el.open)el.showModal();else if(!inspectorVisible&&el.open)el.close();},[inspectorVisible]);
  return <><WorkspaceNavigation active={active} inspectorVisible={inspectorVisible} onCanvas={onCanvas} onSelect={id=>{focus.current=typeof document!=='undefined'&&document.activeElement?.matches(':focus-visible')===true;onToggle(id);}}/><dialog ref={sheet} className="dd-workspace-inspector dd-properties-sheet" aria-label="Design inspector" onCancel={e=>{e.preventDefault();onCanvas?.();}} id={`dd-section-${active}`}><div className="dd-inspector-top"><button type="button" className="dd-inspector-back" onClick={onCanvas}>Done · back to drawing</button>{onAssistant&&<button type="button" className="dd-assistant-return" onClick={onAssistant}>← Back to assistant</button>}<span>Design details</span><h2 id={`dd-section-${active}-name`}>{section.name}</h2><p className="dd-inspector-summary">{sectionSummary(section,data)}</p>{price&&<p className="dd-inspector-price" data-kind={price.kind}>{price.text}<small>Section price effect</small></p>}</div><div id={`dd-section-${active}-body`} className="dd-panel dd-section-body" role="region" aria-labelledby={`dd-section-${active}-name`} tabIndex={-1}><Suspense key={active} fallback={<p className="dd-note" role="status">Loading {section.name}…</p>}>{renderBody(active)}<p className="dd-section-next"><button type="button" className="dd-linklike" aria-label={`${section.related.text}: open ${related.name}`} onClick={()=>onOpen(related.id)}>{section.related.text} <span aria-hidden="true">→</span> {related.name}</button></p><Loaded onLoaded={()=>{if(focus.current){focus.current=false;document.getElementById(`dd-section-${active}-body`)?.focus();}}}/></Suspense></div></dialog></>;
}


