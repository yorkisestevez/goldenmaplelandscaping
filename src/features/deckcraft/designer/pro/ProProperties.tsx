import './proWorkspace.css';
import {Suspense,useEffect,useRef,useState} from 'react';
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
}

/**
 * The Pro workspace's docked properties panel: the selected object's design areas beside the drawing, never over it.
 * One area is open at a time (the designer's own section state); choosing a deck part, the house, the stairs or a patio
 * on the plan opens its area. Each area's settings are the same controls the public designer shows.
 */
export default function ProProperties({page,data,model,selectedPartId,hardscapeSelected}:ProPropertiesProps){
  const active=[...page.open][0]??'deck',subject=subjectOf(active);
  const [collapsed,setCollapsed]=useState(false);
  useEffect(()=>setCollapsed(false),[active]);
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
  return <section id="dd-pro-properties" className="dd-pro-properties" aria-labelledby="dd-pro-properties-title">
    <header className="dd-pro-properties-head">
      <WorkspaceIcon id={subject.icon}/>
      <h2 id="dd-pro-properties-title">{subject.title}</h2>
      <button type="button" aria-label="Keyboard shortcuts and help" aria-haspopup="dialog" title="Keyboard shortcuts (F1)" onClick={()=>document.querySelector<HTMLDialogElement>('#dd-shortcuts')?.showModal()}><CircleHelp size={18}/></button>
    </header>
    <div className="dd-pro-properties-groups">
      {subject.sections.map(id=>{
        const section=SECTION_BY_ID[id],open=id===active&&!collapsed;
        return <div key={id} className="dd-pro-properties-group">
          <h3><button type="button" id={`dd-pro-group-${id}`} aria-expanded={open} aria-controls={`dd-section-${id}-body`} onClick={()=>id===active?setCollapsed(c=>!c):page.openSection(id)}>
            <WorkspaceIcon id={id}/><span>{section.name}</span><small>{sectionSummary(section,data)}</small>
          </button></h3>
          {open&&<div id={`dd-section-${id}-body`} className="dd-pro-properties-body dd-section-body" role="region" aria-labelledby={`dd-pro-group-${id}`}>
            <Suspense fallback={<p className="dd-note" role="status">Loading {section.name}…</p>}>{page.renderSection(id)}</Suspense>
          </div>}
        </div>;
      })}
      {subject.id==='deck'&&<div className="dd-pro-properties-group">
        <h3 className="dd-pro-properties-static">Information</h3>
        <dl className="dd-pro-properties-info" aria-label="Deck information">
          <div><dt>Size</dt><dd>{feet(data.width)} × {feet(data.length)}</dd></div>
          <div><dt>Height</dt><dd>{data.height} in</dd></div>
          <div><dt>Area</dt><dd>{Math.round(q.area)} sq ft</dd></div>
          <div><dt>Railing</dt><dd>{Math.round(q.railingLf)} ft</dd></div>
          <div><dt>Footings</dt><dd>{q.footings}</dd></div>
          <div><dt>Stair flights</dt><dd>{q.stairFlights}</dd></div>
        </dl>
      </div>}
    </div>
  </section>;
}
