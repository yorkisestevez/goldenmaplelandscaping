import {Suspense,lazy,useEffect,useMemo,useRef,useState} from 'react';
import {useArchitectKeys,revealControl} from './architectKeys';
import {hasBackyardLayout} from '../backyard';
import {yardShapeFrame} from '../yardShapeGeometry';
const CanvasContextMenu=lazy(()=>import('./CanvasContextMenu'));
const ArchitectShortcuts=lazy(()=>import('./ArchitectShortcuts'));
const documentDrawing=()=>typeof document!=='undefined'&&!!document.querySelector('.dd-shape-draw-surface,.dd-yard-shape-editor[data-drawing],.dd-landscape-plan[data-drawing]');


import type {SelectionState} from './selectionState';

import {colourName,type BoardPaintChoice} from '../boardFinishes';

import ConstructionPlan,{planFrame} from '../ConstructionPlan';

const HouseOpeningsBar=lazy(()=>import('../HouseOpeningsBar'));

import {trackDeck} from '../deckAnalytics';

import type {DeckEstimate} from '../designFacts';

import type {DeckData,DeckInlay,HouseOpening,PrivacyScreen} from '../types';

import {FRAMING_MODES,PLAN_TOOLS,type AutoCounts,type PlanTool,type PreviewMode} from './constants';
import {proCommands,type ProPage} from './pro/proTypes';
import type {ElevationArea} from './ElevationWorkspace';

import {PlanEditorBoundary,ViewerBoundary,type Update} from './fields';

import type {PlanShortcutId} from './planEditMath';

import type {StairEdge} from './steps/DimensionsStep';

import TitleBlock from './TitleBlock';

import PlanViewport from './PlanViewport';
import type {AgentRequest} from './deckAgentController';
const AssistantTargets=lazy(()=>import('./AssistantTargets'));



/**

 * The 3D viewer (three.js, about 300 KB compressed). It loads when a 3D view is shown; a desktop also fetches it once the

 * page has settled (DeckDesigner's prefetch), a phone never before its 3D sheet is chosen.

 */

import {loadViewer,loadExteriorStudio,loadPlanBoundaryEditor} from './previewLoaders';
export {loadViewer,loadExteriorStudio,loadPlanBoundaryEditor} from './previewLoaders';

const Viewer=lazy(loadViewer);

/** The exterior studio (claddings, roofs, colours): appearance only, loaded when first opened. */



const ExteriorStudio=lazy(loadExteriorStudio);

/** The site plan's handles, typed figures and shape shortcuts: loaded once the page is running. */

export const loadPlanEditor=()=>import('./PlanEditor');

const PlanEditor=lazy(loadPlanEditor);

const PlanBoundaryEditor=lazy(loadPlanBoundaryEditor);

const BoardLayoutEditor=lazy(()=>import('./BoardLayoutEditor'));

const PlanComponentEditor=lazy(()=>import('./PlanComponentEditor'));
const EdgeSectionEditor=lazy(()=>import('./EdgeSectionEditor'));
const StepShapeHandles=lazy(()=>import('./StepShapeHandles'));
const PlanToolPicker=lazy(()=>import('./PlanToolPicker'));
const HardscapeInspector=lazy(()=>import('./HardscapeInspector'));
const HardscapePlanSelection=lazy(()=>import('./HardscapePlanSelection'));
const LandscapePlanEditor=lazy(()=>import('./LandscapePlanEditor'));
const PreviewedObjectInspector=lazy(()=>import('./PreviewedObjectInspector'));
const PlanEditingWorkspace=lazy(()=>import('./PlanEditingWorkspace'));
const SceneEditingWorkspace=lazy(()=>import('./SceneEditingWorkspace'));
const YardShapeEditor=lazy(()=>import('./YardShapeEditor'));
const InlayPlanEditor=lazy(()=>import('./InlayPlanEditor'));
const ElevationWorkspace=lazy(()=>import('./ElevationWorkspace'));
const ProRibbon=lazy(()=>import('./pro/ProRibbon'));
const ProToolStrip=lazy(()=>import('./pro/ProToolStrip'));
const ProStatusBar=lazy(()=>import('./pro/ProStatusBar'));
const ProProperties=lazy(()=>import('./pro/ProProperties'));
const ProLayers=lazy(()=>import('./pro/ProLayers'));



// The drawing's sheets, in order: the site plan, the 3D view and the framing (the 2D framing plan and the 3D contractor views).

type Sheet='plan'|'3d'|'framing';

const SHEETS:readonly (readonly [string,string,Sheet])[]=[['A1','Plan','plan'],['A2','3D','3d'],['S1','Framing','framing']];

const sheetOf=(mode:PreviewMode):Sheet=>mode==='plan'?'plan':FRAMING_MODES.includes(mode)?'framing':'3d';

/** The shape shortcuts on the plan; their actions (the Deck section's, from deckShapeActions.ts) load with the editor. */

const SHORTCUTS:readonly (readonly [PlanShortcutId,string])[]=[['Rectangle','Rectangle'],['L-Shape','L-shape'],['Multi-corner','Multi-corner'],['Curved','Curved'],['wrap-left','Wrap left'],['wrap-right','Wrap right'],['wrap-both','Wrap both'],['split','Split level'],['Custom','Draw my own']];

/** The coach line over the plan, for each tool (and whether the deck is a custom outline). */

const COACH:Record<PlanTool,(custom:boolean)=>string>={

  inlays:()=>'Choose a preset or draw your own. Tap the deck to place it, then drag, resize or rotate it.',
  landscape:()=> 'Draw and reshape gardens, decorative stone and putting greens with points, curves or freehand.',
  yard:()=>'Draw a patio or wall path. Pull every corner, edge or turn freely, then choose products and finishes.',
  edges:()=>'Tap an edge or drag along it. Add or remove railings and privacy screens for just that section.',
  components:()=>'Tap a house opening, deck, stair or screen to edit it. Inspect beams, posts and footings in the same plan.',

  size:()=>'Drag the gold handles to size your deck against your house, or tap a dimension to type it.',

  outline:()=>'Pull any corner or edge in any direction. Add a point wherever you need a bend. Undo is always available.',

  boards:()=>'Select a board, draw an area or add a breaker. Set any direction or colour, then apply the layout.',

  stairs:()=>'Drag the stairs to a highlighted deck edge and release to place them. You can also tap an edge. Undo restores the previous position.',

  house:()=>'Drag the gold handles on the house’s wall ends to set its width.',

};

const shortcutOn=(data:DeckData,id:PlanShortcutId)=>id==='split'?data.levels>=2:id==='wrap-left'?!!data.wrap?.left&&!data.wrap.right:id==='wrap-right'?!!data.wrap?.right&&!data.wrap.left:id==='wrap-both'?!!(data.wrap?.left&&data.wrap.right):id==='Custom'?!!data.deckOutlines?.main:!data.deckOutlines?.main&&data.shape===id;



export interface PreviewPanelProps{
  /** Present in the Pro workspace (Designer Mode): the ribbon, tool strip and status bar replace the simple tool picker. */
  pro?:ProPage;
  previewData?:DeckData|null;onPreviewData?:(data:DeckData|null)=>void;
  /** Transient landscape feature selection, shared with the Backyard section. */
  selectedFeatureId?:string;onSelectFeature?:(id:string)=>void;onSelectYardTarget?:(target:{id:string;target:'area'|'edge'|'point';index:number})=>void;
  pendingInlay?:DeckInlay|null;onPendingInlay?:(inlay:DeckInlay|null)=>void;
  assistantTargets?:AgentRequest|null;

  onSelectionChange?:(selection:SelectionState)=>void;

  externalSelection?:SelectionState;

  onSketch?:()=>void;

  sketchReady?:boolean;

  data:DeckData;update:Update;applyComponent?:Update;estimate:DeckEstimate;

  mode:PreviewMode;setMode:(mode:PreviewMode)=>void;

  mounted:boolean;hasWebGL:boolean;setHasWebGL:(on:boolean)=>void;retryWebGL:()=>void;

  hasFixtures:boolean;autoCounts:AutoCounts;

  /** The House section is open: its selected door or window is outlined in 3D even before one is picked there. */

  houseOpen:boolean;pickedHouseOpeningId:string;effectiveHouseOpeningId:string;

  selectHouseOpening:(id:string)=>void;moveHouseOpening:(id:string,patch:Partial<HouseOpening>)=>void;editHouseOpening:()=>void;

  setScreen:(id:string,patch:Partial<PrivacyScreen>)=>void;

  onSnapshotReady:(capture:((longEdgePx?:number)=>string|null)|null)=>void;

  /**

   * The proposal's pictures (R8): day or night for the 3D view while they are taken, without changing the design (so

   * nothing is saved, undone or repriced). Null shows the design's own choice.

   */

  snapshotLighting?:'Daylight'|'Evening'|null;

  /** The site plan's tool (R5), and a way to pick another ("Draw my own" takes the Draw outline tool). */

  tool:PlanTool;setTool:(tool:PlanTool)=>void;

  /** The edges the page offers stairs on (the Stairs section's edge menu), for the Stairs tool. */

  stairEdges:StairEdge[];

  /** Opens a section and brings it into view (the plan tools' links to the rest of their settings). */

  onOpenSection:(id:'boards'|'deck'|'stairs'|'house'|'lighting'|'extras'|'site'|'backyard')=>void;

  /** Phones: the visitor pinned a compact drawing to the top of the screen while editing (PhoneDeckBar). */

  docked?:boolean;

  /** Accent boards: the tool's current choice (null when it is put down) and what a click on a board does. */

  boardPaint?:BoardPaintChoice|null;setBoardPaint?:(paint:BoardPaintChoice|null)=>void;onPaintBoard?:(target:{level:number;index:number})=>void;

  /** The exterior studio, open under the doors and windows bar (opening it shows the 3D view). */

  exteriorOpen:boolean;setExteriorOpen:(open:boolean)=>void;

}



/**

 * The drawing: its sheets (the site plan to draw on, the 3D view to walk around it, the framing), the title block, and

 * doors and windows (the price is in the schedule). The page opens on the site plan; the 3D view loads only when asked for.

 */

export default function PreviewPanel({pro,previewData,onPreviewData,data,update,applyComponent=update,estimate,mode,setMode,mounted,hasWebGL,setHasWebGL,retryWebGL,hasFixtures,autoCounts,houseOpen,pickedHouseOpeningId,effectiveHouseOpeningId,selectHouseOpening,moveHouseOpening,editHouseOpening,setScreen,onSnapshotReady,snapshotLighting=null,tool,setTool,stairEdges,onOpenSection,docked=false,boardPaint,setBoardPaint,onPaintBoard,exteriorOpen,setExteriorOpen,onSketch,sketchReady=true,onSelectionChange,externalSelection,assistantTargets,pendingInlay,onPendingInlay,selectedFeatureId,onSelectFeature,onSelectYardTarget}:PreviewPanelProps){

  const [selection,setSelection]=useState<SelectionState>({partIds:[],boards:[]}),[picking,setPicking]=useState(false),[addSelection,setAddSelection]=useState(false);
  /** The Pro tool strip's slot for the plan's pan and zoom controls. */
  const [navigationSlot,setNavigationSlot]=useState<HTMLDivElement|null>(null);

  const previousDesign=useRef(data);
  const previousModel=useRef(estimate.model);
  const selectObjects=(next:SelectionState)=>{setSelection(next);onSelectionChange?.(next);};

  useEffect(()=>{if(externalSelection&&JSON.stringify(externalSelection)!==JSON.stringify(selection)){setSelection(externalSelection);if(externalSelection.partIds.length||externalSelection.boards.length)setPicking(true);}},[externalSelection]);

  useEffect(()=>{if(previousDesign.current===data&&previousModel.current===estimate.model)return;previousDesign.current=data;previousModel.current=estimate.model;if(selection.boards.length)selectObjects({...selection,boards:[]});},[data,estimate.model]);
  const pickHardscape=(hardscape:NonNullable<SelectionState['hardscape']>,toggle=false)=>{const add=toggle||addSelection,ids=selection.objectIds??(selection.hardscape?[selection.hardscape.id]:[]),objectIds=add?(ids.includes(hardscape.id)?ids.filter(id=>id!==hardscape.id):[...ids,hardscape.id]):[hardscape.id];const id=objectIds.at(-1),primary=id===hardscape.id?hardscape:id?{kind:data.landscapeObjects?.some(o=>o.id===id)?"landscape" as const:data.pools?.some(o=>o.id===id)?"pool" as const:"yard" as const,id}:undefined;selectObjects({partIds:[],boards:[],hardscape:primary,...(objectIds.length>1?{objectIds}:{})});onSelectFeature?.(primary?.id??"");};
  const objectPick=(target:{partId?:string;board?:{level:number;index:number};hardscape?:SelectionState['hardscape']},toggle:boolean)=>{if(target.hardscape){pickHardscape(target.hardscape,toggle);return;}const add=toggle||addSelection;if(target.partId){const id=target.partId;selectObjects({partIds:add?(selection.partIds.includes(id)?selection.partIds.filter(p=>p!==id):[...selection.partIds,id]):[id],boards:add?selection.boards:[]});}else if(target.board){const b=target.board;selectObjects({partIds:add?selection.partIds:[],boards:add?(selection.boards.some(t=>t.level===b.level&&t.index===b.index)?selection.boards.filter(t=>t.level!==b.level||t.index!==b.index):[...selection.boards,b]):[b]});}};

  // The exterior studio's walls to finish ('' = the whole house): picked in the studio or, while it is open, in 3D.

  const [houseWall,setHouseWall]=useState(''),[houseBarRequested,setHouseBarRequested]=useState(false);

  // The plan's status line: what a shape shortcut did (and any fix it made), until the next change on the plan.

  const [planStatus,setPlanStatus]=useState('');
  const propertiesDock=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{if(propertiesDock.current)propertiesDock.current.open=tool!=='size'||!!selection.hardscape||!!selection.partIds.length||!!selection.boards.length;},[tool,selection.hardscape?.id,selection.partIds.length,selection.boards.length,!!pro]);
  const [elevationsOpen,setElevationsOpen]=useState(false),[elevationArea,setElevationArea]=useState<ElevationArea>();
  /** Opens the Elevations & build workspace at one of its areas (the Pro Terrain tab), or closes it when that area shows. */
  const toggleElevations=(area:ElevationArea)=>{if(elevationsOpen&&elevationArea===area)setElevationsOpen(false);else{setElevationArea(area);setElevationsOpen(true);requestAnimationFrame(()=>document.getElementById('dd-elevation-tools')?.scrollIntoView({block:'nearest'}));}};
  // The Pro Tools menu asks for an area through a page event (the menu bar is outside this panel).
  useEffect(()=>{if(!pro)return;const open=(e:Event)=>{const area=(e as CustomEvent<ElevationArea>).detail;setElevationArea(area);setElevationsOpen(true);requestAnimationFrame(()=>document.getElementById('dd-elevation-tools')?.scrollIntoView({block:'nearest'}));};window.addEventListener('deckcraft-pro-elevations',open);return ()=>window.removeEventListener('deckcraft-pro-elevations',open);},[!!pro]);

  const [boundaryLevel,setBoundaryLevel]=useState<1|2|3>(1);

  // Where the plan tool's own buttons go (the editor puts them there once it has loaded). A ref, not state, so the

  // drawing is not drawn a second time when the page starts.

  const toolbar=useRef<HTMLDivElement>(null);
  const mixed=selection.partIds.length>0&&selection.boards.length>0;
  const mixedControls=<div className="dd-3d-selection-card" role="alert"><strong>Mixed part and board selection</strong><p>Select one editing group before Apply. No selected object will be silently left out.</p><button type="button" className="dd-secondary" onClick={()=>selectObjects({partIds:selection.partIds,boards:[]})}>Edit selected parts only</button><button type="button" className="dd-secondary" onClick={()=>selectObjects({partIds:[],boards:selection.boards})}>Edit selected boards only</button><button type="button" className="dd-secondary" onClick={()=>selectObjects({partIds:[],boards:[]})}>Clear all selected objects</button></div>;
  const [outlineFit,setOutlineFit]=useState(0);
  const pickTool=(next:PlanTool,focus=false)=>{if(selection.hardscape&&!['yard','landscape'].includes(next))selectObjects({partIds:[],boards:[]});if(next==='stairs'){selectObjects({partIds:estimate.model.flights.some(f=>f.kind==='grade')?['stairs:primary']:[],boards:[]});}if(next==='outline')void loadPlanBoundaryEditor().catch(()=>{});if(next!==tool){if(next==='outline')setOutlineFit(n=>n+1);setTool(next);setPlanStatus('');}if(focus)document.getElementById(`dd-tool-${next}`)?.focus();};


  const viewerPaint=useMemo(()=>boardPaint&&onPaintBoard?{scope:boardPaint.scope,onPaint:onPaintBoard}:undefined,[boardPaint,onPaintBoard]);

  // The design as the 3D view draws it: the proposal's pictures may ask for day or night (appearance only).

  const viewData=useMemo(()=>snapshotLighting&&snapshotLighting!==data.sceneLighting?{...data,sceneLighting:snapshotLighting}:data,[data,snapshotLighting]);

  useArchitectKeys({n:()=>{selectObjects({partIds:[],boards:[]});onSelectFeature?.('');},e:()=>{if(sheetOf(mode)!=='plan'||tool==='yard'||tool==='landscape')return false;pickTool(tool==='outline'?'size':'outline');},j:()=>revealControl(propertiesDock.current?.querySelector('summary')??null)},!snapshotLighting&&!documentDrawing());
  const sheet=sheetOf(mode),onPlan=sheet==='plan',framing=sheet==='framing',current=SHEETS.findIndex(s=>s[2]===sheet);

  const drawing=onPlan?'Site plan':framing?'Framing':'3D view';

  const pick=(to:Sheet)=>{if(to!==sheet)setMode(to==='plan'?'plan':to==='3d'?'3d':'drawing');};

  const pickTab=(i:number)=>{pick(SHEETS[i][2]);document.getElementById(`dd-tab-${i}`)?.focus();};

  const camera=(view:PreviewMode,name:string)=><button type="button" aria-pressed={mode===view} onClick={()=>setMode(view)}>{name}</button>;

  const shortcut=(id:PlanShortcutId)=>{if(id==='Custom')void loadPlanBoundaryEditor().catch(()=>{});void loadPlanEditor().then(m=>{

    const r=m.planShortcut(data,id);setPlanStatus(r.status);if(r.patch)update(r.patch);if(r.tool){if(r.tool==='outline')setOutlineFit(n=>n+1);setTool(r.tool);}

    trackDeck('deckcraft_plan','deck_plan_shortcut');

  }).catch(()=>setPlanStatus('The shortcut could not load. Check your connection and try again.'));};

  // A 3D view (a camera, or a 3D contractor view) needs WebGL; the plans are drawn as SVG.

  const show3d=mounted&&hasWebGL&&mode!=='plan'&&mode!=='drawing';

  const [candidateEstimate,setCandidateEstimate]=useState<{data:DeckData;estimate:DeckEstimate}|null>(null);
  useEffect(()=>{let alive=true;setCandidateEstimate(null);if(previewData)import('../deckRelease').then(({calculateDeckReleaseEstimate})=>{const estimate=calculateDeckReleaseEstimate(previewData);if(alive)setCandidateEstimate({data:previewData,estimate});});return ()=>{alive=false;};},[previewData]);
  // Direct pulls already validate their geometry and commit once at pointer release.
  // Claim preview ownership so an older assistant proposal cannot cover the new outline.
  const applyPlanEdit:Update=patch=>{window.dispatchEvent(new CustomEvent('deckcraft-edit-preview',{detail:Symbol('plan-edit')}));applyComponent(patch);};
  const shown=candidateEstimate?.data===previewData?candidateEstimate:null,displayData=shown?.data??data,displayEstimate=shown?.estimate??estimate;
  const sitePlan=<ConstructionPlan model={displayEstimate.model} data={displayData} yard={displayEstimate.yardModel} variant="site" wholeHouse={tool==='house'}/>,framingPlan=<ConstructionPlan model={estimate.model} data={data}/>,flat=framing?framingPlan:sitePlan;

  const loading=<>{flat}<p className="dd-canvas-loading" role="status">Loading the 3D view…</p></>;

  // The selected object's dimensions and materials, and the current tool's own options (tools portal them in).
  const toolOptions=<details ref={propertiesDock} className="dd-selection-inspector" aria-label="Selected object settings"><summary>{selection.hardscape?'Selected shape · dimensions & materials':'Drawing controls · dimensions & materials'}</summary>{mounted&&!snapshotLighting&&<Suspense fallback={null}><HardscapeInspector data={data} selection={selection.hardscape} onSelect={pickHardscape} onApply={applyComponent} onGeometry={onPreviewData??(()=>{})} onClose={()=>{selectObjects({partIds:[],boards:[]});onPreviewData?.(null);}}/></Suspense>}{previewData&&<p role="status">Showing proposed geometry · apply the preview to save one undoable edit.</p>}{mixed&&!snapshotLighting&&mixedControls}{show3d&&!selection.hardscape&&!mixed&&!snapshotLighting&&<Suspense fallback={<p role="status">Loading selected object…</p>}><PreviewedObjectInspector data={data} model={estimate.model} selection={selection} onSelection={selectObjects} onApply={applyComponent} onGeometry={onPreviewData??(()=>{})} onOpenSection={id=>onOpenSection(id.toLowerCase() as 'deck'|'stairs'|'house'|'lighting'|'extras'|'site')} onEditBoundary={level=>{setBoundaryLevel(level??1);}} onEditBoards={level=>{setBoundaryLevel(level??1);}}/></Suspense>}

      <div className="dd-plan-tool-extras" ref={toolbar}/></details>;

  const head=<div className="dd-preview-head">

      <div className="dd-sheet-tabs" role="tablist" aria-label="Drawing sheets" onKeyDown={e=>{const i=({ArrowLeft:(current+2)%3,ArrowRight:(current+1)%3,Home:0,End:2} as Record<string,number>)[e.key];if(i!==undefined){e.preventDefault();pickTab(i);}}}>

        {SHEETS.map(([code,name,to],i)=><button key={name} id={`dd-tab-${i}`} type="button" role="tab" aria-selected={i===current} aria-controls="dd-sheet" tabIndex={i===current?0:-1} onClick={()=>pick(to)}><span aria-hidden="true">{code}</span> {name}</button>)}

      </div>

      <h2>{drawing} · {Math.round(data.width*1000)/1000} × {Math.round(data.length*1000)/1000} ft deck <small>· {data.height} in high</small></h2>

      {pro&&<Suspense fallback={null}><ProLayers page={pro}/></Suspense>}

    </div>;

  // The Pro workspace reads top to bottom like a CAD window: ribbon, drawing, sheet tabs, status bar.
  return <aside id="deck-live-preview" className={`dd-preview${docked?' dd-preview-docked':''}`}>

    {pro?<Suspense fallback={null}><ProRibbon tool={tool} sheet={sheet} onTool={next=>{pickTool(next);if(!onPlan)setMode('plan');}} onSheet={setMode} commands={proCommands(pro)} elevation={elevationsOpen?elevationArea??'site':undefined} onElevations={toggleElevations} onSketch={onSketch} sketchReady={sketchReady}/></Suspense>:head}

    <div id="dd-sheet" className="dd-sheet-panel" role="tabpanel" aria-labelledby={`dd-tab-${current}`}>

      {!snapshotLighting&&<div className="dd-summary-actions"><button type="button" className="dd-secondary" aria-expanded={elevationsOpen} aria-controls="dd-elevation-tools" onClick={()=>setElevationsOpen(!elevationsOpen)}>{elevationsOpen?'Close elevations & build':'Elevations & build'}</button></div>}
      {elevationsOpen&&!snapshotLighting&&<div id="dd-elevation-tools"><Suspense fallback={<p role="status">Loading elevations &amp; build…</p>}><ElevationWorkspace initialArea={elevationArea} data={data} estimate={estimate} onApply={applyComponent} onGeometry={onPreviewData??(()=>{})} selectedFeatureId={selectedFeatureId} onSelectFeature={onSelectFeature} onOpenSection={onOpenSection} onClose={()=>setElevationsOpen(false)}/></Suspense></div>}
      <Suspense fallback={null}><ArchitectShortcuts pro={!!pro}/></Suspense><Suspense fallback={null}>{!snapshotLighting&&<CanvasContextMenu data={data} model={estimate.model} selection={selection} onSelect={selectObjects} onTool={setTool} onSection={onOpenSection} onBoundary={setBoundaryLevel} onApply={applyComponent}/>}</Suspense>
      {!pro&&onPlan&&<Suspense fallback={null}><PlanToolPicker tool={tool} onPick={pickTool} hint={COACH[tool](data.shape==='Custom')} onSketch={onSketch} sketchReady={sketchReady}/></Suspense>}

      {sheet==='3d'&&<div className="dd-scene-tools"><div className="dd-view-toggle" role="group" aria-label="Camera">{camera('3d','Corner')}{camera('overview','Overview')}{camera('front','Front')}{camera('top','Above')}</div><div className="dd-day-night" role="group" aria-label="Day or night preview"><button type="button" aria-pressed={data.sceneLighting!=='Evening'} onClick={()=>update({sceneLighting:'Daylight'})}><span aria-hidden="true">☀</span> Day</button><button type="button" aria-pressed={data.sceneLighting==='Evening'} onClick={()=>update({sceneLighting:'Evening'})}><span aria-hidden="true">☾</span> Night</button></div><label className="dd-check dd-preview-light-switch"><input type="checkbox" role="switch" checked={data.lightingPreviewOn!==false} onChange={e=>update({lightingPreviewOn:e.target.checked})}/><span>Preview lights {data.lightingPreviewOn===false?'off':'on'}</span></label></div>}

      {sheet==='3d'&&<div className="dd-view-toggle" role="group" aria-label="3D selection tools"><button type="button" aria-pressed={picking} onClick={()=>setPicking(!picking)}>Select objects in 3D</button>{picking&&<><button type="button" aria-pressed={addSelection} onClick={()=>setAddSelection(!addSelection)}>Add to selection</button><button type="button" onClick={()=>{setMode('plan');pickTool(selection.boards.length?'boards':'components');}}>Show selection on plan</button></>}</div>}

      {sheet==='3d'&&data.sceneLighting==='Evening'&&!hasFixtures&&!data.pergola?.lighting&&!data.pergola?.accessories.includes('led')&&<div className="dd-night-hint" role="status"><p><strong>No lights on this design yet.</strong> Light every railing post and stair riser in one step.</p><button type="button" className="dd-primary" disabled={!autoCounts.posts&&!autoCounts.stairs} onClick={()=>update({autoLighting:{...data.autoLighting,posts:autoCounts.posts>0,stairs:autoCounts.stairs>0},lightingPreviewOn:true})}>Add post &amp; step lights</button><small>Adds the fixtures and a transformer to your estimate.</small></div>}

      {framing&&<div className="dd-view-toggle dd-framing-modes" role="group" aria-label="Contractor preview modes">{camera('drawing','Plan')}{camera('structure','Framing')}{camera('hardware','Hardware')}{camera('foundation','Below ground')}</div>}

      {boardPaint&&setBoardPaint&&<div className="dd-paint-chip" role="status"><span>Painting: <strong>{colourName(boardPaint.colour)}</strong>{onPlan||framing?' · switch to the 3D view to paint':' · click a board'}</span>{data.pattern!=='Herringbone'&&<div className="dd-view-toggle" role="group" aria-label="What a click paints"><button type="button" aria-pressed={boardPaint.scope==='piece'} onClick={()=>setBoardPaint({...boardPaint,scope:'piece'})}>One board</button><button type="button" aria-pressed={boardPaint.scope==='course'} onClick={()=>setBoardPaint({...boardPaint,scope:'course'})}>Whole row</button></div>}<button type="button" className="dd-secondary" onClick={()=>setBoardPaint(null)}>Done</button></div>}

      {/* The site plan (in the prerendered page) shows at once; its handles arrive once the page runs. A 3D view shows

          the plan until three.js has loaded. */}

      <div className="dd-selection-workspace">{pro&&<Suspense fallback={null}><ProToolStrip tool={tool} onPlan={onPlan} onTool={next=>{pickTool(next);if(!onPlan)setMode('plan');}} onSlot={setNavigationSlot}/></Suspense>}<div className="dd-canvas">{show3d?<ViewerBoundary fallback={flat}><Suspense fallback={loading}><SceneEditingWorkspace data={data} model={estimate.model} selection={selection} onSelection={selectObjects} onApply={applyComponent} onGeometry={onPreviewData??(()=>{})}>{interaction=><Viewer editInteraction={snapshotLighting||!(selection.hardscape||selection.partIds.length||selection.objectIds?.length)?undefined:interaction} onUpdate={update} deckOnly={!hasBackyardLayout(data)} yardModel={displayEstimate.yardModel} data={shown?{...displayData,sceneLighting:viewData.sceneLighting}:viewData} model={displayEstimate.model} view={mode} structure={mode==='structure'||mode==='hardware'} cutaway={mode==='foundation'} selectedHouseOpeningId={pickedHouseOpeningId||(houseOpen?effectiveHouseOpeningId:undefined)} onSelectHouseOpening={undefined} onMoveHouseOpening={undefined} onContextLost={()=>setHasWebGL(false)} onMovePrivacyScreen={undefined} onSnapshotReady={previewData?undefined:onSnapshotReady} boardPaint={picking?undefined:viewerPaint} selection={selection} selectionEnabled={!snapshotLighting} onObjectPick={objectPick} selectedHouseWallId={exteriorOpen?houseWall:undefined} onSelectHouseWall={!picking&&exteriorOpen?setHouseWall:undefined}/>}</SceneEditingWorkspace></Suspense></ViewerBoundary>

        :onPlan?<Suspense fallback={flat}><PlanEditingWorkspace data={data} onApply={applyComponent} onGeometry={onPreviewData??(()=>{})}>{()=>((tool==='outline'||tool==='boards'||tool==='components'||tool==='edges'||tool==='yard'||tool==='landscape'||tool==='inlays')?<PlanViewport key={tool==='yard'||tool==='landscape'?'yard':'deck'} navigationTarget={pro?navigationSlot:undefined} fitToken={tool==='outline'?outlineFit:undefined} frame={yardShapeFrame(planFrame(estimate.model,{data,yard:estimate.yardModel,variant:'site'}),tool==='yard'||tool==='landscape'?data.yardFeatures??[]:[])}>{(zoom,frame)=><><ConstructionPlan onSelectStairs={()=>pickTool('stairs')} model={displayEstimate.model} data={displayData} yard={displayEstimate.yardModel} variant="site" viewportFrame={frame}/>{mounted&&!mixed&&(!selection.hardscape||tool==='landscape'&&selection.hardscape.kind==='landscape'||tool==='yard'&&selection.hardscape.kind==='yard'&&!data.yardFeatures?.some(f=>f.id===selection.hardscape?.id&&(f.stepAssembly||f.stoneSteps)))&&<Suspense fallback={null}>{tool==='landscape'?<LandscapePlanEditor data={data} frame={frame} zoom={zoom} selection={selection.hardscape} onSelect={pickHardscape} onApply={applyComponent} onGeometry={onPreviewData??(()=>{})} toolbar={toolbar}/>:tool==='inlays'?<InlayPlanEditor data={data} model={estimate.model} update={applyPlanEdit} toolbar={toolbar} viewportFrame={frame} viewZoom={zoom} pendingInlay={pendingInlay} onPendingInlay={onPendingInlay} onStatus={setPlanStatus}/>:tool==='yard'?<YardShapeEditor deckModel={estimate.model} selectedFeatureId={selectedFeatureId} onSelectFeature={onSelectFeature} onSelectTarget={onSelectYardTarget} data={data} update={applyPlanEdit} toolbar={toolbar} viewportFrame={frame} viewZoom={zoom} onStatus={setPlanStatus} onOpenSettings={()=>onOpenSection('backyard')}/>:tool==='edges'?<EdgeSectionEditor data={data} model={estimate.model} update={applyPlanEdit} toolbar={toolbar} viewportFrame={frame} viewZoom={zoom} onOpenSettings={()=>onOpenSection('extras')}/>:tool==='components'?<PlanComponentEditor selection={selection.partIds} onSelectionChange={ids=>selectObjects({partIds:ids,boards:[]})} data={data} model={estimate.model} update={applyPlanEdit} toolbar={toolbar} viewportFrame={frame} viewZoom={zoom} onOpenSection={id=>onOpenSection(id.toLowerCase() as 'deck'|'stairs'|'house'|'lighting'|'extras'|'site')} onEditBoundary={level=>{setBoundaryLevel(level??1);pickTool('outline');}} onEditBoards={level=>{setBoundaryLevel(level??1);pickTool('boards');}}/>:tool==='boards'?<BoardLayoutEditor selection={selection.boards} onSelectionChange={boards=>selectObjects({partIds:[],boards})} requestedLevel={boundaryLevel} data={data} model={estimate.model} update={applyPlanEdit} toolbar={toolbar} viewportFrame={frame}/>:<PlanEditorBoundary onRetry={()=>{void loadPlanBoundaryEditor();}}><PlanBoundaryEditor requestedLevel={boundaryLevel} data={data} model={estimate.model} update={applyPlanEdit} onEdited={()=>setPlanStatus('')} toolbar={toolbar} viewZoom={zoom} viewportFrame={frame}/></PlanEditorBoundary>}</Suspense>}{mounted&&!['boards','inlays','landscape'].includes(tool)&&<Suspense fallback={null}><HardscapePlanSelection organization={data.editorOrganization} model={displayEstimate.yardModel} frame={frame} selection={selection.hardscape} inspection={data.scenePresentation?.viewMode==='inspection'} onSelect={pickHardscape}/><StepShapeHandles data={data} model={estimate.model} frame={frame} selection={selection.hardscape} onApply={applyComponent}/></Suspense>}{assistantTargets&&<Suspense fallback={null}><AssistantTargets request={assistantTargets} data={data} model={estimate.model} frame={frame}/></Suspense>}</>}</PlanViewport>:<PlanViewport navigationTarget={pro?navigationSlot:undefined} frame={planFrame(displayEstimate.model,{data:displayData,yard:displayEstimate.yardModel,variant:'site',wholeHouse:tool==='house'})}>{(_,frame)=><><ConstructionPlan onSelectStairs={()=>pickTool('stairs')} model={displayEstimate.model} data={displayData} yard={displayEstimate.yardModel} variant="site" viewportFrame={frame} wholeHouse={tool==='house'}/>{mounted&&<Suspense fallback={null}>{!selection.hardscape&&<PlanEditor viewportFrame={frame} data={data} model={estimate.model} yard={estimate.yardModel} update={applyPlanEdit} onEdited={()=>setPlanStatus('')} tool={tool} stairEdges={stairEdges} onStatus={setPlanStatus} toolbar={toolbar} onOpenSection={onOpenSection}/>}<HardscapePlanSelection organization={data.editorOrganization} model={displayEstimate.yardModel} frame={frame} selection={selection.hardscape} inspection={data.scenePresentation?.viewMode==='inspection'} onSelect={pickHardscape}/><StepShapeHandles data={data} model={estimate.model} frame={frame} selection={selection.hardscape} onApply={applyComponent}/></Suspense>}</>}</PlanViewport>)}</PlanEditingWorkspace></Suspense>:flat}{assistantTargets&&onPlan&&!['outline','boards','components','edges','yard','landscape','inlays'].includes(tool)&&<Suspense fallback={null}><AssistantTargets request={assistantTargets} data={data} model={estimate.model} frame={planFrame(estimate.model,{data,yard:estimate.yardModel,variant:'site',wholeHouse:tool==='house'})}/></Suspense>}</div>

      {pro?<div className="dd-pro-side"><Suspense fallback={null}><ProProperties page={pro} data={data} model={estimate.model} selectedPartId={selection.partIds[0]} hardscapeSelected={!!selection.hardscape}/></Suspense>{toolOptions}</div>:toolOptions}</div>

      {onPlan&&<>{(tool==='size'||tool==='outline')&&<details className="dd-boundary-presets"><summary>Start with a shape</summary><div className="dd-plan-shortcuts" role="group" aria-label="Shape shortcuts">{SHORTCUTS.map(([id,label])=><button key={id} type="button" className="dd-secondary" aria-pressed={shortcutOn(data,id)} onClick={()=>shortcut(id)}>{label}</button>)}</div></details>}



        <p className="dd-plan-status" role="status">{planStatus}</p></>}

      {framing&&<><p className="dd-note">Inspect framing, connections and below-ground components.</p><dl className="dd-quantities" aria-label="Modeled quantities">{[['Support posts',estimate.model.quantities.supportPosts],['Footings',estimate.model.quantities.footings],['Joists',estimate.model.quantities.joists],['Railing posts',estimate.model.quantities.railingPosts],['Stair treads',estimate.model.quantities.stairTreads],['Stringers',estimate.model.quantities.stringers],['Breaker boards',estimate.model.quantities.breakerBoards],['Blocking pieces',estimate.model.quantities.blocking]].map(([label,n])=><div key={label}><dt>{label}</dt><dd>{n}</dd></div>)}</dl></>}

    </div>

    {pro&&<>{head}<Suspense fallback={null}><ProStatusBar sheet={sheet} tool={tool} toolLabel={PLAN_TOOLS.find(([id])=>id===tool)?.[1]??''} hint={COACH[tool](data.shape==='Custom')}/></Suspense></>}

    {mounted && !hasWebGL && mode!=='plan' && mode!=='drawing' && <p className="dd-note">Showing the plan view because 3D graphics are unavailable on this device. <button type="button" className="dd-linklike" onClick={retryWebGL}>Try the 3D view again</button></p>}

    <details className="dd-preview-details dd-preview-house" onToggle={event=>{if(event.currentTarget.open)setHouseBarRequested(true);}} open={tool==='house'||exteriorOpen||undefined}><summary>Doors &amp; windows</summary>{(houseBarRequested||tool==='house'||exteriorOpen)&&<Suspense fallback={<p role="status">Loading opening controls…</p>}><HouseOpeningsBar data={data} selectedId={pickedHouseOpeningId} onSelect={selectHouseOpening} onChange={update} onEditDetails={editHouseOpening} exteriorOpen={exteriorOpen} onOpenExterior={()=>setExteriorOpen(!exteriorOpen)}/></Suspense>}</details>

    {exteriorOpen&&data.houseVisible!==false&&<Suspense fallback={<p className="dd-note" role="status">Loading the exterior finishes…</p>}><ExteriorStudio data={data} update={update} onClose={()=>setExteriorOpen(false)} selectedOpeningId={pickedHouseOpeningId||effectiveHouseOpeningId} onSelectOpening={selectHouseOpening} target={houseWall} onTarget={setHouseWall}/></Suspense>}

    <details className="dd-preview-details"><summary>Drawing details &amp; construction notes</summary><TitleBlock data={data} area={estimate.model.quantities.area} drawing={drawing} grid={onPlan||mode==='drawing'} sheet={current+1} today={mounted?new Date().toLocaleDateString('en-CA'):''}/><p className="dd-note">The model is a design illustration. Colours vary by screen; confirm with samples. The shared model includes cut boards, framing, connected levels and stair components. Site measurements, connections and engineering need confirmation before construction.</p></details>

  </aside>;

}

