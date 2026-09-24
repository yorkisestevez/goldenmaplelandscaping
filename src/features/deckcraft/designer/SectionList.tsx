import {Suspense,useEffect,useRef,type MouseEvent,type ReactNode} from 'react';
import type {DeckEstimate} from '../designFacts';
import type {DeckData} from '../types';
import {SECTIONS,SECTION_BY_ID,sectionChanged,type SectionId} from './sections';
import {sectionPriceEffect,sectionSummary} from './sectionSummaries';

/** Calls `onLoaded` once mounted. It sits in a body's Suspense boundary, so it runs when the lazy body has loaded. */
function Loaded({onLoaded}:{onLoaded:()=>void}){
  useEffect(()=>{onLoaded();},[]);
  return null;
}
const FOCUSABLE='input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),a[href],summary';
const ids=(id:SectionId)=>({row:`dd-section-${id}`,body:`dd-section-${id}-body`,name:`dd-section-${id}-name`,choice:`dd-section-${id}-choice`,price:`dd-section-${id}-price`,mark:`dd-section-${id}-mark`});

/**
 * The design as sections a visitor opens in any order. Each row is a heading with one button, named by the section
 * alone and described by its current choice, its price effect and whether it differs from the default design. A
 * closed section's body is unmounted; the page keeps the state that must outlive it. A section opened from the
 * keyboard moves focus to its first field once its body has loaded. Each body ends with a link to one related section.
 */
export default function SectionList({data,estimate,open,onToggle,onOpen,renderBody}:{
  data:DeckData;estimate:DeckEstimate;open:ReadonlySet<SectionId>;
  /** A row's button: opens a closed section, closes an open one. */
  onToggle:(id:SectionId)=>void;
  /** The related-section link: opens that section (if it is closed) and brings it into view. */
  onOpen:(id:SectionId)=>void;
  renderBody:(id:SectionId)=>ReactNode;
}){
  const focusOn=useRef<SectionId|null>(null);
  const focusFirst=(id:SectionId)=>{
    if(focusOn.current!==id)return;
    focusOn.current=null;
    const body=document.getElementById(ids(id).body);
    const first=[...(body?.querySelectorAll<HTMLElement>(FOCUSABLE)??[])].find(el=>el.getClientRects().length>0);
    (first??body)?.focus();
  };
  // Enter or Space on a button fires a click with no pointer (detail 0).
  const byKeyboard=(e:MouseEvent)=>e.detail===0;
  return <div className="dd-sections">
    {SECTIONS.map(section=>{
      const {id}=section,n=ids(id),isOpen=open.has(id),changed=sectionChanged(section,data),price=sectionPriceEffect(section,estimate);
      const related=SECTION_BY_ID[section.related.id];
      return <div key={id} id={n.row} className="dd-section" data-open={isOpen||undefined}>
        <h2 className="dd-section-head">
          <button type="button" aria-expanded={isOpen} aria-controls={n.body} aria-labelledby={n.name} aria-describedby={[n.choice,price&&n.price,changed&&n.mark].filter(Boolean).join(' ')}
            onClick={e=>{if(!isOpen&&byKeyboard(e))focusOn.current=id;onToggle(id);}}>
            <span className="dd-section-mark" data-changed={changed||undefined} aria-hidden="true"/>
            <span id={n.name} className="dd-section-name">{section.name}</span>
            {price&&<span id={n.price} className="dd-section-price" data-kind={price.kind}>{price.text}</span>}
            <span id={n.choice} className="dd-section-choice">{sectionSummary(section,data)}</span>
            {changed&&<span id={n.mark} className="dd-sr">Changed from the default design</span>}
          </button>
        </h2>
        <div id={n.body} role="region" aria-labelledby={n.name} className="dd-panel dd-section-body" hidden={!isOpen} tabIndex={-1}>
          {isOpen&&<Suspense fallback={<p className="dd-note" role="status">Loading {section.name}…</p>}>
            {renderBody(id)}
            <p className="dd-section-next"><button type="button" className="dd-linklike" aria-label={`${section.related.text}: open ${related.name}`}
              onClick={e=>{if(byKeyboard(e)){focusOn.current=related.id;if(open.has(related.id))requestAnimationFrame(()=>focusFirst(related.id));}onOpen(related.id);}}>
              {section.related.text} <span aria-hidden="true">→</span> {related.name}</button></p>
            <Loaded onLoaded={()=>focusFirst(id)}/>
          </Suspense>}
        </div>
      </div>;
    })}
  </div>;
}
