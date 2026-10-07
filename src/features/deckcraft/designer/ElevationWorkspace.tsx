import {lazy,Suspense,useEffect,useState} from 'react';
import type {DeckData} from '../types';
import type {DeckEstimate} from '../designFacts';
import {ELEVATION_DATUM,elevationLabel} from '../elevationDatum';
import {yardSurfaceIn} from '../yardElevations';
import {assertUnlockedChanges,isObjectLocked} from '../editorOrganization';
import {validateYardFinishedSettings} from '../yardFinishedSettings';
import type {Update} from './fields';
import DeckElevationEditor from './DeckElevationEditor';
import PlanEditingWorkspace from './PlanEditingWorkspace';
import './elevationWorkspace.css';

const SiteEditor=lazy(()=>import('../SiteEditor'));
const SiteReadingImport=lazy(()=>import('../SiteReadingImport'));
const YardElevationEditor=lazy(()=>import('./YardElevationEditor'));
const StepAssemblyEditor=lazy(()=>import('../StepAssemblyEditor'));
const HardscapeAssemblyEditor=lazy(()=>import('../HardscapeAssemblyEditor'));
const StairRefitEditor=lazy(()=>import('./StairRefitEditor'));
const GroundFitPanel=lazy(()=>import('./GroundFitPanel'));
const SiteDesignerPanel=lazy(()=>import('./SiteDesignerPanel'));
const ElevationProfilePanel=lazy(()=>import('../ElevationProfilePanel'));
const YardEarthworkEditor=lazy(()=>import('../YardEarthworkEditor'));
const AREAS=[['site','Ground & grading'],['deck','Deck levels & stairs'],['surfaces','Patios, walls & steps'],['build','Sections & earthworks']] as const;
export type ElevationArea=typeof AREAS[number][0];
type Area=ElevationArea;

/** A shared entry point to the existing elevation engines; no second copy of saved geometry. */
export default function ElevationWorkspace({data,estimate,onApply,onGeometry,selectedFeatureId,onSelectFeature,onOpenSection,onClose,initialArea}:{data:DeckData;estimate:DeckEstimate;onApply:Update;onGeometry:(data:DeckData|null)=>void;selectedFeatureId?:string;onSelectFeature?:(id:string)=>void;onOpenSection:(id:'deck'|'stairs'|'backyard')=>void;onClose:()=>void;
 /** The area to show (the Pro ribbon's Terrain buttons choose one); the visitor can still switch areas. */
 initialArea?:Area}){
 const [area,setArea]=useState<Area>(initialArea??'site'),[localId,setLocalId]=useState(''),[siteDesigner,setSiteDesigner]=useState(false);
 useEffect(()=>{if(initialArea)setArea(initialArea);},[initialArea]);
 const features=(data.yardFeatures??[]).filter(f=>f.kind!=='water-feature'&&f.kind!=='fire-feature');
 const feature=features.find(f=>f.id===(selectedFeatureId??localId))??features[0];
 const applyFinished=(next:NonNullable<DeckData['yardFeatures']>[number])=>{
  const patch={yardFeatures:data.yardFeatures!.map(f=>f.id===next.id?validateYardFinishedSettings(next):f)};
  assertUnlockedChanges(data,{...data,...patch});
  // FinishedLevelEditor already reviewed geometry and quantities; commit that reviewed edit once.
  window.dispatchEvent(new CustomEvent('deckcraft-edit-preview',{detail:Symbol('finished-level')}));
  onApply(patch);
 };
 const openSettings=(id:'deck'|'stairs'|'backyard')=>{onClose();onOpenSection(id);};
 return <section className="dd-elevation-workspace" aria-label="Elevations and build workspace">
  <h3>Design at different elevations</h3>
  <p>Set the ground, coordinate finished levels, connect them with stairs, then review sections and excavation.</p>
  <p className="dd-note">{ELEVATION_DATUM}. Finished heights below use this common datum; ground-relative controls are labelled separately.</p>
  <div className="dd-summary-actions" role="group" aria-label="Elevation tasks">{AREAS.map(([id,label])=><button key={id} type="button" className="dd-secondary" aria-pressed={area===id} onClick={()=>setArea(id)}>{label}</button>)}</div>
  <Suspense fallback={<p role="status">Loading elevation tools…</p>}>
   {area==='site'&&<><SiteReadingImport data={data} footprint={estimate.model.levels[0].footprint.outline}/>
    {!!data.siteModel&&<div className="dd-summary-actions"><button type="button" className="dd-secondary" aria-expanded={siteDesigner} onClick={()=>setSiteDesigner(!siteDesigner)}>Design from my ground</button></div>}
    {siteDesigner&&!!data.siteModel&&<SiteDesignerPanel data={data} update={onApply} onGeometry={onGeometry}/>}
    <SiteEditor data={data} onChange={onApply}/></>}
   {area==='deck'&&<>
    <h4>Deck finished levels</h4><p>Changing a deck level moves its framing and connections. Preview the change, then refit the bottom stairs to their landing.</p>
    <DeckElevationEditor data={data} onApply={onApply} onGeometry={onGeometry}/>
    <div className="dd-summary-actions"><button type="button" className="dd-secondary" onClick={()=>openSettings('deck')}>Level sizes & connections</button><button type="button" className="dd-secondary" onClick={()=>openSettings('stairs')}>Stair layout & construction</button></div>
    <StairRefitEditor data={data} update={onApply}/>
    <GroundFitPanel data={data} update={onApply} onGeometry={onGeometry} warnings={estimate.yardModel.warnings}/>
   </>}
   {area==='surfaces'&&<>
    <h4>Finished surfaces and retaining walls</h4>
    <button type="button" className="dd-secondary" onClick={()=>openSettings('backyard')}>Add a patio, retaining wall or stone stairs</button>
    {feature?<><label className="dd-field">Elevation feature<select aria-label="Elevation feature" value={feature.id} onChange={e=>{setLocalId(e.target.value);onSelectFeature?.(e.target.value);}}>{features.map(f=><option key={f.id} value={f.id}>{f.name}{!f.enabled?' · excluded':''}{isObjectLocked(data.editorOrganization,f.id)?' · locked':''}</option>)}</select></label>
     <p>Current finished reference: {elevationLabel(yardSurfaceIn(data,feature))}.{!feature.enabled&&' This feature is excluded from the design and estimate.'}</p>
     {feature.stepAssembly||feature.stoneSteps?<StepAssemblyEditor key={feature.id} data={data} feature={feature} onApply={onApply} onGeometry={onGeometry}/>:<PlanEditingWorkspace key={feature.id} data={data} onApply={onApply} onGeometry={onGeometry}>{stage=>{const change=(next:typeof feature)=>stage({yardFeatures:data.yardFeatures!.map(f=>f.id===next.id?next:f)});return <>
      <YardElevationEditor data={data} feature={feature} disabled={isObjectLocked(data.editorOrganization,feature.id)} onChange={change} onApply={applyFinished}/>
      <HardscapeAssemblyEditor data={data} feature={feature} disabled={isObjectLocked(data.editorOrganization,feature.id)} onPreview={change}/>
     </>;}}</PlanEditingWorkspace>}
     {feature.kind==='patio'&&feature.enabled&&!feature.stoneSteps&&!feature.stepAssembly&&!!data.siteModel&&<GroundFitPanel key={feature.id} data={data} update={onApply} onGeometry={onGeometry} featureId={feature.id}/>}
    </>:<p>Add a surface to set a finished height, drainage slope, wall course or stepped cap.</p>}
   </>}
   {area==='build'&&<>
    <ElevationProfilePanel data={data} deckModel={estimate.model} yardModel={estimate.yardModel}/>
    <YardEarthworkEditor data={data} onChange={onApply}/>
    <p className="dd-note">Keep missing survey, soil, drainage, foundation and supplier inputs pending until confirmed. The section model supports planning; construction details still need project review.</p>
   </>}
  </Suspense>
 </section>;
}
