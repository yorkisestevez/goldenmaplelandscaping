import {hasBackyardLayout} from '../backyard';
import {Suspense,lazy,useMemo,useState} from 'react';
import {colourName,type BoardPaintChoice} from '../boardFinishes';
import ConstructionPlan from '../ConstructionPlan';
import HouseOpeningsBar from '../HouseOpeningsBar';
import {trackDeck} from '../deckAnalytics';
import type {DeckEstimate} from '../designFacts';
import type {DeckData,HouseOpening,PrivacyScreen} from '../types';
import {FRAMING_MODES,type AutoCounts,type PreviewMode} from './constants';
import {ViewerBoundary,type Update} from './fields';
import type {PlanShortcutId} from './planEditMath';
import TitleBlock from './TitleBlock';

/**
 * The 3D viewer (three.js, about 300 KB compressed). It loads when a 3D view is shown; a desktop also fetches it once the
 * page has settled (DeckDesigner's prefetch), a phone never before its 3D sheet is chosen.
 */
export const loadViewer=()=>import('../components/viewer3d/Deck3DViewer');
const Viewer=lazy(loadViewer);
/** The exterior studio (claddings, roofs, colours): appearance only, loaded when first opened. */
export const loadExteriorStudio=()=>import('./ExteriorStudio');
const ExteriorStudio=lazy(loadExteriorStudio);
/** The site plan's handles, typed figures and shape shortcuts: loaded once the page is running. */
export const loadPlanEditor=()=>import('./PlanEditor');
const PlanEditor=lazy(loadPlanEditor);

// The drawing's sheets, in order: the site plan, the 3D view and the framing (the 2D framing plan and the 3D contractor views).
type Sheet='plan'|'3d'|'framing';
const SHEETS:readonly (readonly [string,string,Sheet])[]=[['A1','Plan','plan'],['A2','3D','3d'],['S1','Framing','framing']];
const sheetOf=(mode:PreviewMode):Sheet=>mode==='plan'?'plan':FRAMING_MODES.includes(mode)?'framing':'3d';
/** The shape shortcuts on the plan; their actions (the Deck section's, from deckShapeActions.ts) load with the editor. */
const SHORTCUTS:readonly (readonly [PlanShortcutId,string])[]=[['Rectangle','Rectangle'],['L-Shape','L-shape'],['Multi-corner','Multi-corner'],['Curved','Curved'],['wrap-left','Wrap left'],['wrap-right','Wrap right'],['wrap-both','Wrap both'],['split','Split level'],['Custom','Draw my own']];
const shortcutOn=(data:DeckData,id:PlanShortcutId)=>id==='split'?data.levels>=2:id==='wrap-left'?!!data.wrap?.left&&!data.wrap.right:id==='wrap-right'?!!data.wrap?.right&&!data.wrap.left:id==='wrap-both'?!!(data.wrap?.left&&data.wrap.right):data.shape===id;

export interface PreviewPanelProps{
  data:DeckData;update:Update;estimate:DeckEstimate;
  mode:PreviewMode;setMode:(mode:PreviewMode)=>void;
  mounted:boolean;hasWebGL:boolean;setHasWebGL:(on:boolean)=>void;retryWebGL:()=>void;
  hasFixtures:boolean;autoCounts:AutoCounts;
  /** The House section is open: its selected door or window is outlined in 3D even before one is picked there. */
  houseOpen:boolean;pickedHouseOpeningId:string;effectiveHouseOpeningId:string;
  selectHouseOpening:(id:string)=>void;moveHouseOpening:(id:string,patch:Partial<HouseOpening>)=>void;editHouseOpening:()=>void;
  setScreen:(id:string,patch:Partial<PrivacyScreen>)=>void;
  onSnapshotReady:(capture:(()=>string|null)|null)=>void;
  /** Opens the Deck shape & size section ("Draw my own" shapes the outline there). */
  onOpenDeck:()=>void;
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
export default function PreviewPanel({data,update,estimate,mode,setMode,mounted,hasWebGL,setHasWebGL,retryWebGL,hasFixtures,autoCounts,houseOpen,pickedHouseOpeningId,effectiveHouseOpeningId,selectHouseOpening,moveHouseOpening,editHouseOpening,setScreen,onSnapshotReady,onOpenDeck,docked=false,boardPaint,setBoardPaint,onPaintBoard,exteriorOpen,setExteriorOpen}:PreviewPanelProps){
  // The exterior studio's walls to finish ('' = the whole house): picked in the studio or, while it is open, in 3D.
  const [houseWall,setHouseWall]=useState('');
  // The plan's status line: what a shape shortcut did (and any fix it made), until the next change on the plan.
  const [planStatus,setPlanStatus]=useState('');
  const viewerPaint=useMemo(()=>boardPaint&&onPaintBoard?{scope:boardPaint.scope,onPaint:onPaintBoard}:undefined,[boardPaint,onPaintBoard]);
  const sheet=sheetOf(mode),onPlan=sheet==='plan',framing=sheet==='framing',current=SHEETS.findIndex(s=>s[2]===sheet);
  const drawing=onPlan?'Site plan':framing?'Framing':'3D view';
  const pick=(to:Sheet)=>{if(to!==sheet)setMode(to==='plan'?'plan':to==='3d'?'3d':'drawing');};
  const pickTab=(i:number)=>{pick(SHEETS[i][2]);document.getElementById(`dd-tab-${i}`)?.focus();};
  const camera=(view:PreviewMode,name:string)=><button type="button" aria-pressed={mode===view} onClick={()=>setMode(view)}>{name}</button>;
  const shortcut=(id:PlanShortcutId)=>{void loadPlanEditor().then(m=>{
    const r=m.planShortcut(data,id);setPlanStatus(r.status);if(r.patch)update(r.patch);if(r.openDeck)onOpenDeck();
    trackDeck('deckcraft_plan','deck_plan_shortcut');
  }).catch(()=>setPlanStatus('The shortcut could not load. Check your connection and try again.'));};
  // A 3D view (a camera, or a 3D contractor view) needs WebGL; the plans are drawn as SVG.
  const show3d=mounted&&hasWebGL&&mode!=='plan'&&mode!=='drawing';
  const sitePlan=<ConstructionPlan model={estimate.model} data={data} variant="site"/>,framingPlan=<ConstructionPlan model={estimate.model} data={data}/>,flat=framing?framingPlan:sitePlan;
  const loading=<>{flat}<p className="dd-canvas-loading" role="status">Loading the 3D view…</p></>;
  return <aside id="deck-live-preview" className={`dd-preview${docked?' dd-preview-docked':''}`}>
    <div className="dd-preview-head">
      <div className="dd-sheet-tabs" role="tablist" aria-label="Drawing sheets" onKeyDown={e=>{const i=({ArrowLeft:(current+2)%3,ArrowRight:(current+1)%3,Home:0,End:2} as Record<string,number>)[e.key];if(i!==undefined){e.preventDefault();pickTab(i);}}}>
        {SHEETS.map(([code,name,to],i)=><button key={name} id={`dd-tab-${i}`} type="button" role="tab" aria-selected={i===current} aria-controls="dd-sheet" tabIndex={i===current?0:-1} onClick={()=>pick(to)}><span aria-hidden="true">{code}</span> {name}</button>)}
      </div>
      <h2>{drawing} · {data.width} × {data.length} ft deck <small>· {data.height} in high</small></h2>
    </div>
    <div id="dd-sheet" className="dd-sheet-panel" role="tabpanel" aria-labelledby={`dd-tab-${current}`}>
      {onPlan&&<p className="dd-plan-coach">Drag the gold handles to size your deck against your house, or tap a dimension to type it.</p>}
      {sheet==='3d'&&<div className="dd-scene-tools"><div className="dd-view-toggle" role="group" aria-label="Camera">{camera('3d','Corner')}{camera('overview','Overview')}{camera('front','Front')}{camera('top','Above')}</div><div className="dd-day-night" role="group" aria-label="Day or night preview"><button type="button" aria-pressed={data.sceneLighting!=='Evening'} onClick={()=>update({sceneLighting:'Daylight'})}><span aria-hidden="true">☀</span> Day</button><button type="button" aria-pressed={data.sceneLighting==='Evening'} onClick={()=>update({sceneLighting:'Evening'})}><span aria-hidden="true">☾</span> Night</button></div><label className="dd-check dd-preview-light-switch"><input type="checkbox" role="switch" checked={data.lightingPreviewOn!==false} onChange={e=>update({lightingPreviewOn:e.target.checked})}/><span>Preview lights {data.lightingPreviewOn===false?'off':'on'}</span></label></div>}
      {sheet==='3d'&&data.sceneLighting==='Evening'&&!hasFixtures&&<div className="dd-night-hint" role="status"><p><strong>No lights on this design yet.</strong> Light every railing post and stair riser in one step.</p><button type="button" className="dd-primary" disabled={!autoCounts.posts&&!autoCounts.stairs} onClick={()=>update({autoLighting:{...data.autoLighting,posts:autoCounts.posts>0,stairs:autoCounts.stairs>0},lightingPreviewOn:true})}>Add post &amp; step lights</button><small>Adds the fixtures and a transformer to your estimate.</small></div>}
      {framing&&<div className="dd-view-toggle dd-framing-modes" role="group" aria-label="Contractor preview modes">{camera('drawing','Plan')}{camera('structure','Framing')}{camera('hardware','Hardware')}{camera('foundation','Below ground')}</div>}
      {boardPaint&&setBoardPaint&&<div className="dd-paint-chip" role="status"><span>Painting: <strong>{colourName(boardPaint.colour)}</strong>{onPlan||framing?' · switch to the 3D view to paint':' · click a board'}</span>{data.pattern!=='Herringbone'&&<div className="dd-view-toggle" role="group" aria-label="What a click paints"><button type="button" aria-pressed={boardPaint.scope==='piece'} onClick={()=>setBoardPaint({...boardPaint,scope:'piece'})}>One board</button><button type="button" aria-pressed={boardPaint.scope==='course'} onClick={()=>setBoardPaint({...boardPaint,scope:'course'})}>Whole row</button></div>}<button type="button" className="dd-secondary" onClick={()=>setBoardPaint(null)}>Done</button></div>}
      {/* The site plan (in the prerendered page) shows at once; its handles arrive once the page runs. A 3D view shows
          the plan until three.js has loaded. */}
      <div className="dd-canvas">{show3d?<ViewerBoundary fallback={flat}><Suspense fallback={loading}><Viewer deckOnly={!hasBackyardLayout(data)} yardModel={estimate.yardModel} data={data} model={estimate.model} view={mode} structure={mode==='structure'||mode==='hardware'} cutaway={mode==='foundation'} selectedHouseOpeningId={pickedHouseOpeningId||(houseOpen?effectiveHouseOpeningId:undefined)} onSelectHouseOpening={selectHouseOpening} onMoveHouseOpening={moveHouseOpening} onContextLost={()=>setHasWebGL(false)} onMovePrivacyScreen={(id,offsetPct)=>setScreen(id,{offsetPct})} onSnapshotReady={onSnapshotReady} boardPaint={viewerPaint} selectedHouseWallId={exteriorOpen?houseWall:undefined} onSelectHouseWall={exteriorOpen?setHouseWall:undefined}/></Suspense></ViewerBoundary>
        :onPlan?<>{sitePlan}{mounted&&<Suspense fallback={null}><PlanEditor data={data} model={estimate.model} update={update} onEdited={()=>setPlanStatus('')}/></Suspense>}</>:flat}</div>
      {onPlan&&<><div className="dd-plan-shortcuts" role="group" aria-label="Shape shortcuts">{SHORTCUTS.map(([id,label])=><button key={id} type="button" className="dd-secondary" aria-pressed={shortcutOn(data,id)} onClick={()=>shortcut(id)}>{label}</button>)}</div>
        <p className="dd-plan-status" role="status">{planStatus}</p></>}
      {framing&&<><p className="dd-note">Inspect framing, connections and below-ground components.</p><dl className="dd-quantities" aria-label="Modeled quantities">{[['Support posts',estimate.model.quantities.supportPosts],['Footings',estimate.model.quantities.footings],['Joists',estimate.model.quantities.joists],['Railing posts',estimate.model.quantities.railingPosts],['Stair treads',estimate.model.quantities.stairTreads],['Stringers',estimate.model.quantities.stringers],['Breaker boards',estimate.model.quantities.breakerBoards],['Blocking pieces',estimate.model.quantities.blocking]].map(([label,n])=><div key={label}><dt>{label}</dt><dd>{n}</dd></div>)}</dl></>}
    </div>
    {mounted && !hasWebGL && mode!=='plan' && mode!=='drawing' && <p className="dd-note">Showing the plan view because 3D graphics are unavailable on this device. <button type="button" className="dd-linklike" onClick={retryWebGL}>Try the 3D view again</button></p>}
    <TitleBlock data={data} area={estimate.model.quantities.area} drawing={drawing} grid={onPlan||mode==='drawing'} sheet={current+1} today={mounted?new Date().toLocaleDateString('en-CA'):''}/>
    <HouseOpeningsBar data={data} selectedId={pickedHouseOpeningId} onSelect={selectHouseOpening} onChange={update} onEditDetails={editHouseOpening} exteriorOpen={exteriorOpen} onOpenExterior={()=>setExteriorOpen(!exteriorOpen)}/>
    {exteriorOpen&&data.houseVisible!==false&&<Suspense fallback={<p className="dd-note" role="status">Loading the exterior finishes…</p>}><ExteriorStudio data={data} update={update} onClose={()=>setExteriorOpen(false)} selectedOpeningId={pickedHouseOpeningId||effectiveHouseOpeningId} onSelectOpening={selectHouseOpening} target={houseWall} onTarget={setHouseWall}/></Suspense>}
    <p className="dd-note">The model is a design illustration. Colours vary by screen; confirm with samples. The shared model includes cut boards, framing, connected levels and stair components. Site measurements, connections and engineering need confirmation before construction.</p>
  </aside>;
}
