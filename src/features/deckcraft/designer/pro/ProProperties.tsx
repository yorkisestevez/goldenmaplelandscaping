import './proWorkspace.css';
import './proCad.css';
import {Suspense,useEffect,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';
import {CircleHelp} from 'lucide-react';
import type {DeckData} from '../../types';
import type {DeckTakeoff} from '../../deckTakeoff';
import {SECTION_BY_ID,type SectionId} from '../sections';
import {sectionSummary} from '../sectionSummaries';
import {WorkspaceIcon} from '../WorkspaceNavigation';
import {listPlanComponents} from '../componentEditActions';
import type {ProPage} from './proTypes';

/** What the panel edits, and the design areas (sections) that belong to it, in the order they are listed. */
const SUBJECTS:{id:string;title:string;icon:SectionId;sections:SectionId[]}[]=[
  {id:'deck',title:'Edit Deck',icon:'deck',sections:['deck','boards','extras','site']},
  {id:'stairs',title:'Edit Stairs & Railings',icon:'stairs',sections:['stairs','lighting']},
  {id:'house',title:'Edit House',icon:'house',sections:['house']},
  {id:'yard',title:'Edit Backyard',icon:'backyard',sections:['backyard']},
  {id:'project',title:'Proposal & Files',icon:'proposal',sections:['proposal']},
];
const subjectOf=(id:SectionId)=>SUBJECTS.find(s=>s.sections.includes(id))??SUBJECTS[0];
const feet=(n:number)=>`${Math.round(n*10)/10} ft`;

export interface ProPropertiesProps{
  page:ProPage;data:DeckData;model:DeckTakeoff;
  /** The plan's current selection: a part id, or a patio, wall or garden (hardscape). */
  selectedPartId?:string;hardscapeSelected:boolean;
  /** The CAD workspace: the drawing's notes, listed after the open area. */
  notes?:ReactNode;
}

/**
 * The Pro workspace's docked properties panel: the selected object's design areas beside the drawing, never over it.
 * One area is open at a time (the designer's own section state); choosing a deck part, the house, the stairs or a patio
 * on the plan opens its area. Each area's settings are the same controls the public designer shows.
 */
export default function ProProperties({page,data,model,selectedPartId,hardscapeSelected,notes}:ProPropertiesProps){
  const active=[...page.open][0]??'deck',subject=subjectOf(active);
  // collapsed: the accordion's open area folded away; in the CAD workspace, the Information tab showing instead.
  const [collapsed,setCollapsed]=useState(false);
  // A new area (or, in the CAD workspace, any request for one, even the one showing behind Information) shows it.
  useEffect(()=>setCollapsed(false),[page.cad?page.open:active]);
  // Picking an object on the plan brings up its own area (unless one of its areas is already open).
  const followed=useRef<string|undefined>(undefined);
  useEffect(()=>{
    const key=hardscapeSelected?'hardscape':selectedPartId;
    if(!key||key===followed.current)return;followed.current=key;
    let target:SectionId|undefined;
    if(hardscapeSelected)target='backyard';
    else{const kind=listPlanComponents(data,model).find(p=>p.id===selectedPartId)?.kind;target=kind==='deck'?'deck':kind==='house'||kind==='wall'?'house':kind==='stairs'?'stairs':undefined;}
    if(target&&subjectOf(target)!==subject)page.openSection(target);
  },[selectedPartId,hardscapeSelected]);
  const q=model.quantities;
  const info=<dl className="dd-pro-properties-info" aria-label="Deck information">
    <div><dt>Size</dt><dd>{feet(data.width)} × {feet(data.length)}</dd></div>
    <div><dt>Height</dt><dd>{data.height} in</dd></div>
    <div><dt>Area</dt><dd>{Math.round(q.area)} sq ft</dd></div>
    <div><dt>Railing</dt><dd>{Math.round(q.railingLf)} ft</dd></div>
    <div><dt>Footings</dt><dd>{q.footings}</dd></div>
    <div><dt>Stair flights</dt><dd>{q.stairFlights}</dd></div>
  </dl>;
  const head=<header className="dd-pro-properties-head">
    <WorkspaceIcon id={subject.icon}/>
    <h2 id="dd-pro-properties-title">{subject.title}</h2>
    <button type="button" aria-label="Keyboard shortcuts and help" aria-haspopup="dialog" title="Keyboard shortcuts (F1)" onClick={()=>document.querySelector<HTMLDialogElement>('#dd-shortcuts')?.showModal()}><CircleHelp size={18}/></button>
  </header>;
  if(page.cad){
    // The CAD workspace's inspector: the subject's areas as tabs over one editor and the drawing's notes. PreviewPanel
    // puts the drawing tool's options and the live price under it.
    const tabs:(SectionId|'info')[]=[...subject.sections,...(subject.id==='deck'?['info' as const]:[])];
    const shown=collapsed&&subject.id==='deck'?'info':active,label=(id:SectionId|'info')=>id==='info'?'Information':SECTION_BY_ID[id].name;
    const pick=(id:SectionId|'info')=>{if(id==='info')setCollapsed(true);else if(id===active)setCollapsed(false);else page.openSection(id);};
    const keys=(e:KeyboardEvent)=>{const i=tabs.indexOf(shown),n=tabs.length,to=({ArrowRight:(i+1)%n,ArrowLeft:(i+n-1)%n,Home:0,End:n-1} as Record<string,number>)[e.key];if(to===undefined)return;e.preventDefault();pick(tabs[to]);requestAnimationFrame(()=>document.getElementById(`dd-cad-area-tab-${tabs[to]}`)?.focus());};
    return <section id="dd-pro-properties" className="dd-pro-properties dd-cad-inspector" aria-labelledby="dd-pro-properties-title">
      {head}
      <div className="dd-cad-tabs" role="tablist" aria-label={subject.title} onKeyDown={keys}>
        {tabs.map(id=><button key={id} id={`dd-cad-area-tab-${id}`} type="button" role="tab" aria-selected={id===shown} aria-controls="dd-cad-area" tabIndex={id===shown?0:-1} onClick={()=>pick(id)}>{label(id)}</button>)}
      </div>
      <div className="dd-cad-scroll">
        <div id="dd-cad-area" className="dd-pro-properties-body dd-section-body" role="tabpanel" tabIndex={0} aria-labelledby={`dd-cad-area-tab-${shown}`}>
          {shown==='info'?info:<Suspense fallback={<p className="dd-note" role="status">Loading {label(shown)}…</p>}>{page.renderSection(shown)}</Suspense>}
        </div>
        {notes}
      </div>
    </section>;
  }
  return <section id="dd-pro-properties" className="dd-pro-properties" aria-labelledby="dd-pro-properties-title">
    {head}
    <div className="dd-pro-properties-groups">
      {subject.sections.map(id=>{
        const section=SECTION_BY_ID[id],open=id===active&&!collapsed;
        return <div key={id} className="dd-pro-properties-group">
          <h3><button type="button" id={`dd-pro-group-${id}`} aria-expanded={open} aria-controls={`dd-section-${id}-body`} onClick={()=>id===active?setCollapsed(c=>!c):page.openSection(id)}>
            <span>{section.name}</span><small>{sectionSummary(section,data)}</small>
          </button></h3>
          {open&&<div id={`dd-section-${id}-body`} className="dd-pro-properties-body dd-section-body" role="region" aria-labelledby={`dd-pro-group-${id}`}>
            <Suspense fallback={<p className="dd-note" role="status">Loading {section.name}…</p>}>{page.renderSection(id)}</Suspense>
          </div>}
        </div>;
      })}
      {subject.id==='deck'&&<div className="dd-pro-properties-group">
        <h3 className="dd-pro-properties-static">Information</h3>
        {info}
      </div>}
    </div>
  </section>;
}
