import {hasBackyardLayout} from '../backyard';
import {Suspense,lazy,useEffect,useMemo,useRef,useState} from 'react';
import {colourName,type BoardPaintChoice} from '../boardFinishes';
import ConstructionPlan from '../ConstructionPlan';
import HouseOpeningsBar from '../HouseOpeningsBar';
import {dollars,type DeckEstimate,type DeckMaterial} from '../designFacts';
import type {DeckData,HouseOpening,PrivacyScreen} from '../types';
import type {AutoCounts,PreviewMode} from './constants';
import {MaterialSwatch,ViewerBoundary,type Update} from './fields';

const Viewer=lazy(()=>import('../components/viewer3d/Deck3DViewer'));
/** The exterior studio (claddings, roofs, colours): appearance only, loaded when first opened. */
export const loadExteriorStudio=()=>import('./ExteriorStudio');
const ExteriorStudio=lazy(loadExteriorStudio);

/**
 * Calls `onReady` once the element is within reach of the screen and the browser is idle. The 3D viewer
 * (three.js, about 300 KB compressed) waits for both, so it never competes with the page becoming usable,
 * and a phone that has not scrolled to the preview does not download it at all.
 */
function useWhenNearAndIdle(ref:React.RefObject<HTMLElement|null>,active:boolean,onReady:()=>void){
  useEffect(()=>{
    if(!active)return;
    const el=ref.current;let near=false,idle=false,done=false;
    const check=()=>{if(near&&idle&&!done){done=true;onReady();}};
    const w=window as Window&{requestIdleCallback?:(cb:()=>void,opts?:{timeout:number})=>number;cancelIdleCallback?:(id:number)=>void};
    const idleId=w.requestIdleCallback?w.requestIdleCallback(()=>{idle=true;check();},{timeout:2000}):window.setTimeout(()=>{idle=true;check();},300);
    const observer=el&&typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){near=true;check();}},{rootMargin:'300px 0px'}):null;
    if(observer&&el)observer.observe(el);else{near=true;check();}
    return ()=>{observer?.disconnect();if(w.requestIdleCallback)w.cancelIdleCallback?.(idleId);else clearTimeout(idleId);};
  },[ref,active,onReady]);
}

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
  /** True once the 3D viewer may load (near the screen and idle, or a snapshot needs it). */
  want3d:boolean;onWant3d:()=>void;
  /** Phones: the visitor pinned a compact preview to the top of the screen while editing (PhoneDeckBar). */
  docked?:boolean;
  material:DeckMaterial;
  priceLabel:string;quoteRequired:string[];
  /** Accent boards: the tool's current choice (null when it is put down) and what a click on a board does. */
  boardPaint?:BoardPaintChoice|null;setBoardPaint?:(paint:BoardPaintChoice|null)=>void;onPaintBoard?:(target:{level:number;index:number})=>void;
  /** The exterior studio, open under the doors and windows bar. */
  exteriorOpen:boolean;setExteriorOpen:(open:boolean)=>void;
}

/** The live deck: view modes, day and night, the contractor views, the 3D model or plan, doors and windows, finish and price. */
export default function PreviewPanel({data,update,estimate,mode,setMode,mounted,hasWebGL,setHasWebGL,retryWebGL,hasFixtures,autoCounts,houseOpen,pickedHouseOpeningId,effectiveHouseOpeningId,selectHouseOpening,moveHouseOpening,editHouseOpening,setScreen,onSnapshotReady,material,priceLabel,quoteRequired,want3d,onWant3d,docked=false,boardPaint,setBoardPaint,onPaintBoard,exteriorOpen,setExteriorOpen}:PreviewPanelProps){
  const canvasRef=useRef<HTMLDivElement>(null);
  // The exterior studio's walls to finish ('' = the whole house): picked in the studio or, while it is open, in 3D.
  const [houseWall,setHouseWall]=useState('');
  const viewerPaint=useMemo(()=>boardPaint&&onPaintBoard?{scope:boardPaint.scope,onPaint:onPaintBoard}:undefined,[boardPaint,onPaintBoard]);
  useWhenNearAndIdle(canvasRef,mounted&&!want3d,onWant3d);
  return <aside id="deck-live-preview" className={`dd-preview${docked?' dd-preview-docked':''}`}>
    <div className="dd-preview-head"><div><span className="dd-eyebrow">YOUR DECK, LIVE</span><h2>{data.width} × {data.length} ft <small>· {data.height} in high</small></h2></div><div className="dd-view-toggle"><button aria-pressed={mode==='3d'} onClick={()=>setMode('3d')}>3D</button><button aria-pressed={mode==='overview'} onClick={()=>setMode('overview')}>Overview</button><button aria-pressed={mode==='front'} onClick={()=>setMode('front')}>Front</button><button aria-pressed={mode==='top'} onClick={()=>setMode('top')}>Above</button><button aria-pressed={mode==='plan'} onClick={()=>setMode('plan')}>Plan</button></div></div>
    <div className="dd-scene-tools"><span>See your deck in</span><div className="dd-day-night" role="group" aria-label="Day or night preview"><button type="button" aria-pressed={data.sceneLighting!=='Evening'} onClick={()=>{update({sceneLighting:'Daylight'});if(mode==='plan')setMode('3d');}}><span aria-hidden="true">☀</span> Day</button><button type="button" aria-pressed={data.sceneLighting==='Evening'} onClick={()=>{update({sceneLighting:'Evening'});if(mode==='plan')setMode('3d');}}><span aria-hidden="true">☾</span> Night</button></div><label className="dd-check dd-preview-light-switch"><input type="checkbox" role="switch" checked={data.lightingPreviewOn!==false} onChange={e=>update({lightingPreviewOn:e.target.checked})}/><span>Preview lights {data.lightingPreviewOn===false?'off':'on'}</span></label></div>
    {data.sceneLighting==='Evening'&&!hasFixtures&&<div className="dd-night-hint" role="status"><p><strong>No lights on this design yet.</strong> Light every railing post and stair riser in one step.</p><button type="button" className="dd-primary" disabled={!autoCounts.posts&&!autoCounts.stairs} onClick={()=>update({autoLighting:{...data.autoLighting,posts:autoCounts.posts>0,stairs:autoCounts.stairs>0},lightingPreviewOn:true})}>Add post &amp; step lights</button><small>Adds the fixtures and a transformer to your estimate.</small></div>}
    <details className="dd-contractor-view" onToggle={e=>{if(!e.currentTarget.open&&(mode==="structure"||mode==="hardware"||mode==="foundation"))setMode("3d");}}><summary>Advanced contractor view</summary><p className="dd-note">Inspect framing, connections and below-ground components.</p><div className="dd-view-toggle" role="group" aria-label="Contractor preview modes"><button aria-pressed={mode==='structure'} onClick={()=>setMode('structure')}>Framing</button><button aria-pressed={mode==='hardware'} onClick={()=>setMode('hardware')}>Hardware</button><button aria-pressed={mode==='foundation'} onClick={()=>setMode('foundation')}>Below ground</button></div><dl className="dd-quantities" aria-label="Modeled quantities">{[['Support posts',estimate.model.quantities.supportPosts],['Footings',estimate.model.quantities.footings],['Joists',estimate.model.quantities.joists],['Railing posts',estimate.model.quantities.railingPosts],['Stair treads',estimate.model.quantities.stairTreads],['Stringers',estimate.model.quantities.stringers],['Breaker boards',estimate.model.quantities.breakerBoards],['Blocking pieces',estimate.model.quantities.blocking]].map(([label,n])=><div key={label}><dt>{label}</dt><dd>{n}</dd></div>)}</dl></details>
    {/* Until the 3D view is ready the plan (already in the prerendered page) stays on screen. */}
    {boardPaint&&setBoardPaint&&<div className="dd-paint-chip" role="status"><span>Painting: <strong>{colourName(boardPaint.colour)}</strong>{mode==='plan'||mode==='structure'||mode==='hardware'||mode==='foundation'?' · switch to the 3D view to paint':' · click a board'}</span>{data.pattern!=='Herringbone'&&<div className="dd-view-toggle" role="group" aria-label="What a click paints"><button type="button" aria-pressed={boardPaint.scope==='piece'} onClick={()=>setBoardPaint({...boardPaint,scope:'piece'})}>One board</button><button type="button" aria-pressed={boardPaint.scope==='course'} onClick={()=>setBoardPaint({...boardPaint,scope:'course'})}>Whole row</button></div>}<button type="button" className="dd-secondary" onClick={()=>setBoardPaint(null)}>Done</button></div>}
    <div className="dd-canvas" ref={canvasRef}>{mounted && want3d && mode!=='plan' && hasWebGL ? <ViewerBoundary fallback={<ConstructionPlan model={estimate.model} data={data}/>}><Suspense fallback={<ConstructionPlan model={estimate.model} data={data}/>}><Viewer deckOnly={!hasBackyardLayout(data)} yardModel={estimate.yardModel} data={data} model={estimate.model} view={mode} structure={mode==='structure'||mode==='hardware'} cutaway={mode==='foundation'} selectedHouseOpeningId={pickedHouseOpeningId||(houseOpen?effectiveHouseOpeningId:undefined)} onSelectHouseOpening={selectHouseOpening} onMoveHouseOpening={moveHouseOpening} onContextLost={()=>setHasWebGL(false)} onMovePrivacyScreen={(id,offsetPct)=>setScreen(id,{offsetPct})} onSnapshotReady={onSnapshotReady} boardPaint={viewerPaint} selectedHouseWallId={exteriorOpen?houseWall:undefined} onSelectHouseWall={exteriorOpen?setHouseWall:undefined}/></Suspense></ViewerBoundary> : <ConstructionPlan model={estimate.model} data={data}/>}</div>
    {mounted && !hasWebGL && <p className="dd-note">Showing the plan view because 3D graphics are unavailable on this device. <button type="button" className="dd-linklike" onClick={retryWebGL}>Try the 3D view again</button></p>}
    <HouseOpeningsBar data={data} selectedId={pickedHouseOpeningId} onSelect={selectHouseOpening} onChange={update} onEditDetails={editHouseOpening} exteriorOpen={exteriorOpen} onOpenExterior={()=>setExteriorOpen(!exteriorOpen)}/>
    {exteriorOpen&&data.houseVisible!==false&&<Suspense fallback={<p className="dd-note" role="status">Loading the exterior finishes…</p>}><ExteriorStudio data={data} update={update} onClose={()=>setExteriorOpen(false)} selectedOpeningId={pickedHouseOpeningId||effectiveHouseOpeningId} onSelectOpening={selectHouseOpening} target={houseWall} onTarget={setHouseWall}/></Suspense>}
    <div className="dd-finish"><MaterialSwatch file={material.colors.find(c=>c.name===data.deckingColor)?.swatch} alt={data.deckingColor}/><div><strong>{data.deckingColor}</strong><span>{material.name}</span></div><span className="dd-finish-pattern">{data.pattern}</span></div>
    <div className="dd-live-price"><span>{priceLabel} <small>CAD · before HST</small></span><strong>{dollars(estimate.subtotal)}</strong></div>
    {quoteRequired.length>0&&<div className="dd-quote-notice" role="status"><strong>Supplier quotes needed</strong><p>The amount above excludes unpriced selections and is not a complete project estimate.</p><ul>{quoteRequired.map(name=><li key={name}>{name}</li>)}</ul></div>}

    <p className="dd-note">The model is a design illustration. Colours vary by screen; confirm with samples. The shared model includes cut boards, framing, connected levels and stair components. Site measurements, connections and engineering need confirmation before construction.</p>
  </aside>;
}
