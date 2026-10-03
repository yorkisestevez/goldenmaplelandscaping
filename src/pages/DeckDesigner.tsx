import {Suspense,lazy,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import SEO from '../components/SEO';
import {faqPage,graph} from '../utils/schema';
import {DESIGNER_FAQ} from '../features/deckcraft/designerFaq';
import {deckReleaseData,parseDeckReleaseDesign as parseDesign,serializeDeckReleaseDesign as serializeDesign} from '../features/deckcraft/deckRelease';
import {DEFAULT_DECK} from '../features/deckcraft/defaults';
import type {DeckData,DeckInlay,HouseOpening,PrivacyScreen} from '../features/deckcraft/types';
import {MAX_PRIVACY_SCREENS,MAX_PRIVACY_SQFT,pricedPrivacyArea,privacySides,screenOn,screenProduct} from '../features/deckcraft/privacyScreens';
import {MAX_DESIGN_BYTES} from '../features/deckcraft/designPersistence';
import {designFeatures,setDeckAnalyticsSink,stepLabel,trackDeck} from '../features/deckcraft/deckAnalytics';
import {ATTACH_PROPOSAL_PDF,DECK_DESIGN_FORM,PROPOSAL_PDF_NAME} from '../features/deckcraft/sendDesignConstants';
import type {ProposalShot} from '../features/deckcraft/proposalModel';
import {getHouseConfig,clampHouseOpening} from '../features/deckcraft/houseSettings';
import {getHouseContact} from '../features/deckcraft/houseContact';
import {dollars} from '../features/deckcraft/designFacts';
import {activeWrap,edgeNameOf} from '../features/deckcraft/lib/wrapGeometry';
import {angledStairAllowed,angledStairFits,isChamferEdgeId} from '../features/deckcraft/lib/cornerChamfers';
import {CAMERA_MODES,type PlanTool,type PreviewMode} from '../features/deckcraft/designer/constants';
import ChangeAnnouncer from '../features/deckcraft/designer/ChangeAnnouncer';
import {priceLedger} from '../features/deckcraft/designer/priceLedgerModel';
import {priceState,useChangeLedger} from '../features/deckcraft/designer/useChangeLedger';
import {downloadFile} from '../features/deckcraft/designer/fields';
import {useDeckDesign} from '../features/deckcraft/designer/useDeckDesign';
import {prepareDesignUpdate} from '../features/deckcraft/designer/designUpdate';
import {useDeckEstimate} from '../features/deckcraft/designer/useDeckEstimate';
import type {DeltaProps} from '../features/deckcraft/designer/useOptionDeltas';
import WorkspaceTools from '../features/deckcraft/designer/WorkspaceTools';
import WorkspacePrice from '../features/deckcraft/designer/WorkspacePrice';
import PreviewPanel,{loadExteriorStudio,loadViewer} from '../features/deckcraft/designer/PreviewPanel';
import SectionList from '../features/deckcraft/designer/SectionList';
import {SECTIONS,SECTION_BY_ID,loadBackyardStep,loadBoardColourPanel,loadDeckFinishesPanel,loadDimensionsStep,loadEstimateStep,loadHouseSection,loadInlayEditor,loadMaterialsStep,loadSiteExtrasStep,loadSkirtingEditor,loadStairsStep,sectionsOfPatch,type SectionId} from '../features/deckcraft/designer/sections';
import type {AgentRequest} from '../features/deckcraft/designer/deckAgentController';
import type {BoardPaintChoice} from '../features/deckcraft/boardFinishes';
import type {paintBoard as PaintBoard} from '../features/deckcraft/boardPaint';
import {trackEngagement,trackLead} from '../utils/analytics';
import {getAttributionFields} from '../utils/utmCapture';
import {getBehaviorFields} from '../utils/behavior';
import {genEventId} from '../utils/eventId';
import './DeckDesigner.css';
import '../features/deckcraft/designer/workspace.css';

/**
 * The drawing-set type, on this page only: Archivo (headings, section names, the title block) and IBM Plex Mono
 * (figures), from Google Fonts with display=swap, so text shows at once in the fallback faces DeckDesigner.css
 * sizes to match. Body text stays in the site's Inter; Cormorant stays in the wordmark.
 */
const DECK_FONTS='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
export const links=()=>[
  {rel:'preconnect',href:'https://fonts.googleapis.com'},
  {rel:'preconnect',href:'https://fonts.gstatic.com',crossOrigin:'anonymous' as const},
  {rel:'stylesheet',href:DECK_FONTS},
];

// Loaded on demand (and fetched once the page settles), so they are not part of the page's first load: every
// section's body (through the registry in sections.ts) and the send and proposal dialogs.
const QuoteReviewPanel=lazy(()=>import('../features/deckcraft/designer/QuoteReviewPanel'));
const DeckAgentBridge=lazy(()=>import('../features/deckcraft/designer/DeckAgentBridge'));
const SketchDesigner=lazy(()=>import('../features/deckcraft/sketch/SketchDesigner'));
const ContractorPresets=lazy(()=>import('../features/deckcraft/designer/ContractorPresetDialog'));
const EasyEditTools=lazy(()=>import('../features/deckcraft/designer/EasyEditTools'));
const IssueReviewDialog=lazy(()=>import('../features/deckcraft/designer/IssueReviewDialog'));
const PermitSetDialog=lazy(()=>import('../features/deckcraft/drawings/PermitSetDialog'));
const JobRevisionDialog=lazy(()=>import('../features/deckcraft/designer/JobRevisionDialog'));
const loadSendDialog=()=>import('../features/deckcraft/SendDesignDialog');
const loadProposalDialog=()=>import('../features/deckcraft/ProposalDialog');
const HouseSection=lazy(loadHouseSection),DimensionsStep=lazy(loadDimensionsStep),MaterialsStep=lazy(loadMaterialsStep),StairsStep=lazy(loadStairsStep),SiteExtrasStep=lazy(loadSiteExtrasStep),EstimateStep=lazy(loadEstimateStep);
const BackyardStep=lazy(loadBackyardStep),SendDesignDialog=lazy(loadSendDialog),ProposalDialog=lazy(loadProposalDialog);
// Phones (the layout's single column) show one section at a time; wider screens keep several open.
const reducedMotion=()=>typeof window!=='undefined'&&!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// DeckCraft's funnel events go through the site's analytics (GA4, Meta and the behaviour trail sent with leads).
setDeckAnalyticsSink((event,label)=>trackEngagement(event,label));

// FAQPage from the same array the page renders below the workspace.
const DESIGNER_SCHEMA=graph(faqPage('/deck-designer',DESIGNER_FAQ));

/**
 * The public deck designer: wires the working design (useDeckDesign), the live estimate (useDeckEstimate),
 * the preview and the sections (sections.ts, opened in any order) together, and owns the outputs (proposal,
 * PDF, summary, exports) and sending the design. The section bodies and preview are presentational; every
 * effect lives here, in the order the page has always run them.
 */
export default function DeckDesigner(){
  // The open sections. Every section starts closed, in the prerendered page and on the client alike; none is saved.
  const [open,setOpen]=useState<ReadonlySet<SectionId>>(()=>new Set(['deck']));
  const [workspaceView,setWorkspaceView]=useState<'canvas'|'inspector'>('canvas');
  const [sketchOpen,setSketchOpen]=useState(false);
  const [pendingInlay,setPendingInlay]=useState<DeckInlay|null>(null);
  const [presetsOpen,setPresetsOpen]=useState(false);
  const [jobsOpen,setJobsOpen]=useState(false),[askOpen,setAskOpen]=useState(false),[issuesOpen,setIssuesOpen]=useState(false),[permitOpen,setPermitOpen]=useState(false);
  const [quoteReviewOpen,setQuoteReviewOpen]=useState(false),[assistantTargets,setAssistantTargets]=useState<AgentRequest|null>(null);
  const [jobLabel,setJobLabel]=useState('');
  const [selection,setSelection]=useState<{partIds:string[];boards:{level:number;index:number}[]}>({partIds:[],boards:[]});
  const clearJobContext=()=>{setJobLabel('');void import('../features/deckcraft/designer/jobRevisionLibrary').then(m=>m.clearActiveJobLabel()).catch(()=>{});};
  const closeSections=useCallback(()=>{setOpen(new Set(['deck']));setWorkspaceView('canvas');},[]);
  // Your changes (the price schedule): every edit, undo, redo and whole new design is noted as it happens.
  const changes=useChangeLedger();
  const {data,setData,update:applyUpdate,replace:replaceDesign,undo:undoDesign,redo:redoDesign,canUndo,canRedo,earlierYard,restoreEarlierYard:restoreYard,dismissEarlierYard,mounted,designReady,hasWebGL,setHasWebGL,retryWebGL,saved,setSaved,autosaveState,lastAutosaveAt,autosavePaused,unrestoredDesign,resumeAutosave,designStatus,setDesignStatus,designError,setDesignError,linkBackup,restoreOwnDesign}=useDeckDesign({onReplaced:()=>{closeSections();changes.loaded();clearJobContext();}});
  useEffect(()=>{if(mounted)void import('../features/deckcraft/designer/jobRevisionLibrary').then(m=>{const active=m.readActiveJobLabel();if(active)setJobLabel(`${active.job} · ${active.revision}`);}).catch(()=>{});},[mounted]);
  const replace=(next:DeckData)=>{changes.loaded();replaceDesign(next);};
  const undo=()=>{if(canUndo)changes.undo();undoDesign();},redo=()=>{if(canRedo)changes.redo();redoDesign();};
  const restoreEarlierYard=()=>{if(earlierYard)changes.edit(earlierYard,data);restoreYard();};
  // Section reach: the first edit in each section counts once per visit, attributed through the fields it owns.
  const changedSections=useRef(new Set<SectionId>());
  const update=(patch:Partial<DeckData>)=>{
    try{prepareDesignUpdate(data,patch);}catch(error){setDesignError(`${error instanceof Error?error.message:'This edit cannot be applied.'} Unlock the measured edge before changing its length or direction.`);return;}
    for(const id of sectionsOfPatch(patch,data))if(!changedSections.current.has(id)){changedSections.current.add(id);trackDeck('deckcraft_section',`deck_changed_${id}`);}
    changes.edit(patch,data);
    applyUpdate(patch);
  };
  // One confirmed component or preset application is one history entry, even when two happen quickly.
  const atomicUpdate=(patch:Partial<DeckData>)=>{
    try{
      const next=prepareDesignUpdate(data,patch);
      const diff=Object.fromEntries(Object.keys({...data,...next}).filter(k=>JSON.stringify(data[k as keyof DeckData])!==JSON.stringify(next[k as keyof DeckData])).map(k=>[k,next[k as keyof DeckData]]));
      if(!Object.keys(diff).length)return;
      changes.edit(diff,data,true);setSaved(false);setDesignError('');replaceDesign(next);
    }catch(error){setDesignError(error instanceof Error?error.message:'The edit could not be applied.');throw error;}
  };
  // Ctrl/Cmd+Z undoes a design change and Ctrl/Cmd+Shift+Z (or Ctrl+Y) redoes it, except while typing in a
  // field, where the browser's own undo applies to the text.
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(sketchOpen||presetsOpen||jobsOpen||quoteReviewOpen||issuesOpen||permitOpen)return;
      if(!(e.ctrlKey||e.metaKey)||e.altKey)return;
      const t=e.target as HTMLElement|null;if(t&&(t.isContentEditable||/^(input|textarea|select)$/i.test(t.tagName)))return;
      const key=e.key.toLowerCase();
      if(key==='z'&&!e.shiftKey){e.preventDefault();undo();}
      else if((key==='z'&&e.shiftKey)||(key==='y'&&!e.metaKey)){e.preventDefault();redo();}
    };
    window.addEventListener('keydown',onKey);return ()=>window.removeEventListener('keydown',onKey);
  });
  const [lightingSearch,setLightingSearch]=useState('');
  const [selectedHouseOpeningId,setSelectedHouseOpeningId]=useState('');
  const [exteriorOpen,setExteriorOpen]=useState(false);
  // The drawing opens on the site plan: the customer sizes the deck against the house first. 3D is a sheet of its own.
  const [mode,setMode]=useState<PreviewMode>('plan');
  // Opening the exterior studio shows the 3D view (looks never show on the plan).
  // The site plan's tool (R5). A deck that becomes a custom outline is drawn with the Draw outline tool.
  const [planTool,setPlanTool]=useState<PlanTool>('outline');
  useEffect(()=>{if(planTool!=='inlays')setPendingInlay(null);},[planTool]);
  useEffect(()=>{setPendingInlay(null);},[data]);
  useEffect(()=>{if(data.shape==='Custom')setPlanTool(t=>t==='size'?'outline':t);},[data.shape]);
  const openExterior=useCallback((open:boolean)=>{setExteriorOpen(open);if(open)setMode(m=>CAMERA_MODES.includes(m)?m:'3d');},[]);
  const [wrapStatus,setWrapStatus]=useState('');
  const [proposal,setProposal]=useState<{shots:ProposalShot[];date:string}|null>(null);
  // The proposal's pictures ask the 3D view for day or night while they are taken (never a change to the design).
  const [snapshotLighting,setSnapshotLighting]=useState<'Daylight'|'Evening'|null>(null);
  const [preparing,setPreparing]=useState(false);
  const [sendOpen,setSendOpen]=useState(false);
  const [agentOpen,setAgentOpen]=useState(false);
  const [pdfBusy,setPdfBusy]=useState(false);
  // Whether a 3D view has been shown yet: the 3D viewer loads only when one is (or for a snapshot), so a snapshot waits
  // longer for a viewer that has never loaded.
  const shown3d=useRef(false);
  useEffect(()=>{if(mode!=='plan'&&mode!=='drawing')shown3d.current=true;},[mode]);
  // Phones: pinning the drawing while editing is the visitor's choice. It pins the sheet on screen (the plan, unless the
  // 3D sheet is showing), so it never loads the 3D view on its own.
  const docked=false;
  type SnapshotCapture=((longEdgePx?:number)=>string|null)&{ready?:()=>Promise<boolean>};
  const snapshot=useRef<SnapshotCapture|null>(null);
  const onSnapshotReady=useCallback((capture:SnapshotCapture|null)=>{snapshot.current=capture;},[]);
  const closeProposal=useCallback(()=>setProposal(null),[]);
  const closeSend=useCallback(()=>setSendOpen(false),[]);
  // Funnel: the page load counts the first step, as the wizard did; each preview mode and design feature is counted
  // once per visit (fixed labels only). Opening a section counts its old step and the section (openSection).
  useEffect(()=>{trackDeck('deckcraft_step',stepLabel(0));},[]);
  useEffect(()=>{trackDeck('deckcraft_view',`deck_view_${mode}`);},[mode]);
  // Fetch the section bodies and the on-demand panels once the page has settled, so opening one is instant; not when
  // the visitor has asked the browser to save data. A desktop also fetches the 3D viewer then (without drawing it); a
  // phone never downloads three.js until a 3D view is chosen.
  useEffect(()=>{
    if((navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData)return;
    const desktopOnly=window.matchMedia?.('(min-width: 761px) and (pointer: fine)').matches?[loadViewer]:[];
    const timer=setTimeout(()=>{for(const load of [...new Set(SECTIONS.map(s=>s.load)),loadSendDialog,loadProposalDialog,loadBoardColourPanel,loadInlayEditor,loadExteriorStudio,loadSkirtingEditor,loadDeckFinishesPanel,...desktopOnly])load().catch(()=>{/* Loaded again when opened. */});},4000);
    return()=>clearTimeout(timer);
  },[]);
  /** Opens a section (analytics: its old wizard step, and the section, once per visit). On a phone it closes the others. */
  function openSection(id:SectionId,bringIntoView=false){
    const section=SECTION_BY_ID[id];
    trackDeck('deckcraft_step',stepLabel(section.legacyStep));
    trackDeck('deckcraft_section',`deck_section_${section.id}`);
    setOpen(new Set([id]));setWorkspaceView('inspector');
    // A section closing above this one moves it up, off the screen; one opened from elsewhere is brought into view.
    if(bringIntoView)requestAnimationFrame(()=>{
      const row=document.getElementById(`dd-section-${id}`),top=row?.getBoundingClientRect().top??0;
      if(row&&(bringIntoView||top<0||top>window.innerHeight))row.scrollIntoView({block:'start',behavior:bringIntoView&&!reducedMotion()?'smooth':'auto'});
    });
  }
  const toggleSection=(id:SectionId)=>openSection(id);
  const featureKey=designFeatures(data).join(' ');
  useEffect(()=>{for(const label of featureKey.split(' '))if(label)trackDeck('deckcraft_feature',label);},[featureKey]);
  const {estimate,estimateKey,lightingCheck,autoCounts,hasFixtures,reviewFlags,described}=useDeckEstimate(data,setData);
  // Where options are not priced without asking (phones, Save-Data), "Show price effect" holds for the visit; never saved.
  const [deltasShown,setDeltasShown]=useState(false);
  const {material,railingName}=described;
  // The price schedule, from the estimate alone; the change list follows its priced subtotal and quotes.
  const schedule=useMemo(()=>priceLedger(estimate),[estimate]);
  const notePrice=changes.price;
  // The price effect beside each option (R6) is measured from this estimate and its schedule.
  const deltas:DeltaProps={key:estimateKey,subtotal:estimate.subtotal,quotes:estimate.quoteRequired,lines:schedule.lines,shown:deltasShown,setShown:setDeltasShown};
  useEffect(()=>{notePrice(priceState(schedule));},[schedule,notePrice]);
  const showFullList=()=>openSection('proposal',true);
  // Accent boards: the tool's colour and scope are page state (never saved). Picking a colour shows the 3D deck;
  // closing Boards & finish puts the tool down.
  const [boardPaint,setBoardPaintState]=useState<BoardPaintChoice|null>(null),[paintMessage,setPaintMessage]=useState('');
  const setBoardPaint=useCallback((next:BoardPaintChoice|null)=>{setBoardPaintState(next);setPaintMessage('');if(next)setMode(m=>CAMERA_MODES.includes(m)?m:'3d');},[]);
  useEffect(()=>{if(!open.has('boards'))setBoardPaintState(null);},[open]);
  // The painting action comes with the accent-board panel (loaded with Boards & finish), so it is not in the page's first load.
  const painter=useRef<typeof PaintBoard|null>(null);
  const boardsOpen=open.has('boards');
  useEffect(()=>{if(boardsOpen)loadBoardColourPanel().then(m=>{painter.current=m.paintBoard;}).catch(()=>{/* Loaded again with the panel. */});},[boardsOpen]);
  const onPaintBoard=useCallback((target:{level:number;index:number})=>{
    if(!boardPaint||!painter.current)return;
    const result=painter.current(data,estimate.model,target,boardPaint.colour,boardPaint.scope);
    if('error' in result){setPaintMessage(result.error);return;}
    setPaintMessage('');update({boardColours:result.boardColours});
  },[boardPaint,data,estimate.model,update]);
  const houseConfig=getHouseConfig(data);
  const effectiveHouseOpeningId=houseConfig.openings.find(o=>o.id===selectedHouseOpeningId)?.id??houseConfig.openings[0]?.id??'';
  // Picking a door or window (in 3D or the doors & windows bar) works whatever is open; "Size & position" in the bar
  // opens the House section and brings it into view.
  const pickedHouseOpeningId=houseConfig.openings.some(o=>o.id===selectedHouseOpeningId)?selectedHouseOpeningId:'';
  const selectHouseOpening=(id:string)=>setSelectedHouseOpeningId(id);
  const editHouseOpening=()=>openSection('house',true);
  const moveHouseOpening=(id:string,patch:Partial<HouseOpening>)=>{setSelectedHouseOpeningId(id);update({houseConfig:{...houseConfig,openings:houseConfig.openings.map(o=>o.id===id?clampHouseOpening({...o,...patch},houseConfig):o)}});};
  const screens=data.privacyScreens??[];
  const screenArea=pricedPrivacyArea(screens);
  const sides=privacySides(data);
  const writeScreen=(id:string,make:(s:PrivacyScreen)=>PrivacyScreen)=>update({privacyScreens:screens.map(s=>{
    if(s.id!==id)return s;const next=make(s);
    if(!screenOn(next)||!screenProduct(next).pricedBySqft)return next;
    // Keep the priced slatted area inside the 500 sq ft the studio validates and prices.
    const room=Math.max(0,(MAX_PRIVACY_SQFT-pricedPrivacyArea(screens.filter(o=>o.id!==id)))/next.heightFt);
    return {...next,lengthFt:Math.min(next.lengthFt,Math.floor(room*2)/2)};
  })});
  const setScreen=(id:string,patch:Partial<PrivacyScreen>)=>writeScreen(id,s=>({...s,...patch}));
  const canAddScreen=screens.length<MAX_PRIVACY_SCREENS&&screenArea+12<=MAX_PRIVACY_SQFT;
  const wrap=activeWrap(data);
  // Exposed main-deck edges (wing ends and sides) that stairs and extra levels can join.
  const mainFootprint=estimate.model.levels[0].footprint,ledger=getHouseContact(data,mainFootprint);
  const namedEdges=mainFootprint.edgeIds?mainFootprint.outline.flatMap((a,i)=>{const b=mainFootprint.outline[(i+1)%mainFootprint.outline.length],id=mainFootprint.edgeIds![i],len=Math.hypot(b.x-a.x,b.y-a.y);return ledger.isContactEdge(i)||len<36?[]:[{id,name:edgeNameOf(id),ft:(len/12).toFixed(1),lenIn:len}];}):[];
  // Wrap and custom-outline decks offer every exposed edge. An angled face (an angled corner, or a custom
  // outline's 45° edge) takes a stair only as a single straight flight wide enough for it; levels never join one.
  const stairEdges=namedEdges.filter(e=>wrap||(data.shape==='Custom'&&!isChamferEdgeId(e.id))||(isChamferEdgeId(e.id)&&angledStairAllowed(data)&&angledStairFits(e.lenIn,data.stairWidth))).map(({lenIn:_len,...e})=>e);
  const levelEdges=namedEdges.filter(e=>wrap&&!isChamferEdgeId(e.id)).map(({lenIn:_len,...e})=>e);
  const {facts:designFacts,summary,proposalFacts}=described;
  function download(){
    try{
      const body=`GOLDEN MAPLE — YOUR DECK DESIGN\n\n${summary}\n\n${estimate.sections.map(s=>`${s.title}: ${s.quoteRequired&&s.total===0?'Supplier quote required':dollars(s.total)}${s.quoteRequired&&s.total>0?' (priced portion; supplier quote required)':''}`).join('\n')}\n\nPlanning estimate only. Final measurements, engineering, product availability and written scope must be confirmed.\n\nConfiguration:\n${serializeDesign(data)}`;
      downloadFile(body,'text/plain','golden-maple-deck-summary.txt');setSaved(true);setDesignError('');trackDeck('deckcraft_output','deck_summary');
    }catch{setDesignError('The summary could not be generated on this device. Please try again, or use “Send my design”.');}
  }
  // The 3D pictures for the proposal and the PDF (R8): the cover and two or three more views, each from a camera preset
  // (Corner, Front, Overview), in daylight; the cover is the night view when the design has lights to show. The plans
  // and the contractor views switch to 3D for the pictures; afterwards the drawing goes back to the sheet, camera and
  // light the visitor had (a camera preset starts from its own position, so a visitor's orbit is not kept). Pictures
  // already being taken are shared, never taken twice at once.
  const capturing=useRef<Promise<ProposalShot[]>|null>(null);
  function captureViews():Promise<ProposalShot[]>{
    capturing.current??=takeViews().finally(()=>{capturing.current=null;});
    return capturing.current;
  }
  async function takeViews():Promise<ProposalShot[]>{
    if(!hasWebGL)return [];
    const previousWorkspace=workspaceView;
    // A mobile inspector hides the drawing. Render the real canvas while capturing proposal views.
    setWorkspaceView('canvas');
    const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
    // A frame of the 3D view (requestAnimationFrame), or half a second if the tab is hidden and frames have stopped.
    const frame=()=>new Promise<void>(r=>{let done=false;const go=()=>{if(!done){done=true;r();}};requestAnimationFrame(()=>go());setTimeout(go,500);});
    const settle=async(ms:number)=>{await wait(ms);for(let i=0;i<3;i++)await frame();};
    // The pictures show the house without a selection outline.
    if(pickedHouseOpeningId){setSelectedHouseOpeningId('');await wait(250);}
    const night=hasFixtures&&data.lightingPreviewOn!==false,previous=mode,loading=!shown3d.current;
    const views:{mode:PreviewMode;light:'Daylight'|'Evening';label:string}[]=[
      {mode:'3d',light:night?'Evening':'Daylight',label:night?'Corner view at night':'Corner view'},
      {mode:'front',light:'Daylight',label:'Front view'},
      {mode:'overview',light:'Daylight',label:'Overview'},
      ...(night?[{mode:'3d' as const,light:'Daylight' as const,label:'Corner view by day'}]:[]),
    ];
    // The camera the visitor is on is taken last, so every picture starts from its preset rather than their orbit.
    const order=[...views.filter(v=>v.mode!==previous),...views.filter(v=>v.mode===previous)];
    const shots=new Map<string,string>();
    try{
      for(const [i,view] of order.entries()){
        setMode(view.mode);setSnapshotLighting(view.light);
        if(i===0){
          // A viewer that has not loaded yet (no 3D view shown so far) gets longer to arrive and load its textures.
          for(let t=0;t<(loading?100:50)&&!snapshot.current;t++)await wait(100);
          await settle(loading?1500:700);
        }else await settle(450);
        // Wait for this renderer's actual board maps, including atlas generation and application.
        // A fixed camera delay alone can capture the generic fallback before the selected finish arrives.
        const capture=snapshot.current;
        if(!capture||(capture.ready&&!(await capture.ready())))throw new Error('The selected board finish is not ready for proposal images. Let the 3D view finish loading and try again.');
        await settle(0);
        // Print resolution: the cover full-bleed on Letter, the other views at up to the sheet's width.
        const src=capture(view===views[0]?2400:1800);if(src)shots.set(view.label,src);
      }
    }finally{
      setMode(previous);setSnapshotLighting(null);
      setWorkspaceView(previousWorkspace);
    }
    return views.flatMap(v=>{const src=shots.get(v.label);return src?[{label:v.label,src}]:[];});
  }
  const proposalDate=()=>new Date().toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'});
  async function openProposal(throwOnError=false){
    setPreparing(true);
    let shots:ProposalShot[]=[];
    try{shots=await captureViews();}
    catch(error){setDesignError(error instanceof Error?error.message:'Proposal images could not be prepared. Please try again.');if(throwOnError)throw error;return;}
    finally{setPreparing(false);}
    setDesignError('');
    setProposal({shots,date:proposalDate()});
    trackDeck('deckcraft_output','deck_proposal');
  }
  // The PDF engine and its builder load only when a PDF is asked for. The proposal dialog hands over the pictures it
  // already has, so they are not taken again.
  async function makeProposalPdf(ready?:ProposalShot[]):Promise<ArrayBuffer>{
    const [{jsPDF},{buildProposalPdf},assets,{exteriorSummary},shots]=await Promise.all([import('jspdf'),import('../features/deckcraft/proposalPdf'),import('../features/deckcraft/pdfAssets'),import('../features/deckcraft/houseLooks'),ready??captureViews()]);
    const [sitePlan,plan,logo,swatches]=await Promise.all([assets.planImage(estimate.model,data,2000,'site'),assets.planImage(estimate.model,data),assets.logoImage(),assets.swatchImages(data,estimate.model)]);
    // The house exterior line (appearance only, not priced) loads with the PDF engine, never with the page.
    const exterior=exteriorSummary(data);
    return buildProposalPdf(jsPDF,{data,estimate,facts:exterior?[...proposalFacts,exterior]:proposalFacts,reviewItems:reviewFlags,date:proposalDate(),shots,sitePlan,plan,logo,swatches});
  }
  async function downloadPdf(ready?:ProposalShot[],throwOnError=false){
    setPdfBusy(true);setDesignError('');
    try{downloadFile(await makeProposalPdf(ready),'application/pdf',PROPOSAL_PDF_NAME);trackDeck('deckcraft_output','deck_pdf');}
    catch(error){setDesignError('The PDF could not be made on this device. Use “Print proposal” and choose “Save as PDF” instead.');if(throwOnError)throw error;}
    finally{setPdfBusy(false);}
  }
  // The export geometry loads only when a file is asked for.
  async function exportModel(kind:'dxf'|'obj',throwOnError=false){
    try{
      const {exportDeckReleaseDXF,exportDeckReleaseOBJ}=await import('../features/deckcraft/deckReleaseExports');
      const body=kind==='dxf'?exportDeckReleaseDXF(data,estimate.model):exportDeckReleaseOBJ(data,estimate.model);
      downloadFile(body,kind==='dxf'?'application/dxf':'text/plain',`golden-maple-deck.${kind}`);setDesignError('');trackDeck('deckcraft_output',`deck_${kind}`);
    }catch(error){setDesignError(`The ${kind.toUpperCase()} export could not be generated for this design. Adjust a dimension or contact us and we’ll prepare it.`);if(throwOnError)throw error;}
  }
  // The design tools clear the file picker once this settles.
  async function importFile(file?:File){
    if(!file)return;setDesignError('');
    try{if(file.size>MAX_DESIGN_BYTES)throw new Error('Choose a design file smaller than 100 KB.');const restored=parseDesign(await file.text());replace(restored);clearJobContext();setSaved(false);resumeAutosave();setDesignStatus(`Design imported${restored.yardFeatures?.length?', with its backyard':''}. Your estimate uses the current Golden Maple price book.`);trackDeck('deckcraft_output','deck_json_import');}
    catch(error){setDesignError(error instanceof Error?error.message:'The design could not be imported.');}
  }
  // A sent design posts to the deck-design Netlify form (relayed to the CRM) with the site's attribution,
  // then counts as a lead conversion worth the priced subtotal, as the cost estimator does.
  async function postDesign(fields:Record<string,string>){
    const eventId=genEventId(),payload={...getAttributionFields(),...getBehaviorFields(),...fields,event_id:eventId};
    if(import.meta.env.DEV){
      // eslint-disable-next-line no-console
      console.log('[dev] deck-design payload (would POST to Netlify):',payload);
    }else{
      // With the PDF attachment switched on, try a multipart post first; any failure sends without the file.
      // The attached copy never re-renders the proposal's 3D views behind the send dialog (slow on a phone, and it
      // would move the customer's view): it takes the 3D view already on screen, if any. The lead's reopen link
      // rebuilds the full proposal with every view.
      let sent=false;
      if(ATTACH_PROPOSAL_PDF)try{
        const form=new FormData();for(const [key,value] of Object.entries(payload))form.append(key,value);
        const onScreen=snapshot.current?.(1800),shots:ProposalShot[]=onScreen?[{label:'3D view',src:onScreen}]:[];
        form.append('proposal_pdf',new Blob([await makeProposalPdf(shots)],{type:'application/pdf'}),PROPOSAL_PDF_NAME);
        sent=(await fetch('/',{method:'POST',body:form})).ok;
      }catch{/* Fall through to the plain submission. */}
      if(!sent){
        const res=await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(payload).toString()});
        if(!res.ok)throw new Error(`The form service answered ${res.status}.`);
      }
    }
    trackLead(DECK_DESIGN_FORM,'high-intent',Number(fields.value)||undefined,eventId,{email:fields.email,phone:fields.phone},{payload});
  }
  function saveJSON(throwOnError=false){try{downloadFile(serializeDesign(data),'application/json','golden-maple-deck-design.json');trackDeck('deckcraft_output','deck_json_save');setDesignStatus('Design JSON saved. Import this file to continue on another device.');setDesignError('');}catch(error){setDesignError('Saving the design file failed on this device. Use “Download summary” for a plain-text copy instead.');if(throwOnError)throw error;}}
  // Each open section's body, with the page state it needs (the list wraps it in Suspense while its chunk loads).
  const renderSection=(id:SectionId)=>{switch(id){
    case 'house':return <HouseSection data={data} update={update} selectedOpeningId={effectiveHouseOpeningId} onSelectOpening={setSelectedHouseOpeningId} openExterior={()=>openExterior(true)}/>;
    case 'deck':return <DimensionsStep data={data} update={update} houseConfig={houseConfig} wrap={wrap} wrapStatus={wrapStatus} setWrapStatus={setWrapStatus} stairEdges={levelEdges} onDrawOnPlan={drawOnPlan}/>;
    case 'boards':return <MaterialsStep data={data} update={update} material={material} reviewFlags={reviewFlags} model={estimate.model} paint={boardPaint} setPaint={setBoardPaint} paintMessage={paintMessage} deltas={deltas} onEditBoardLayout={()=>{setPlanTool('boards');setMode('plan');showCanvas();}} onPlaceInlay={inlay=>{setPendingInlay(inlay);setPlanTool('inlays');setMode('plan');showCanvas();}}/>;
    case 'stairs':return <StairsStep data={data} update={update} stairEdges={stairEdges} deltas={deltas} onEditEdges={()=>{setPlanTool('edges');setMode('plan');showCanvas();}}/>;
    case 'lighting':case 'extras':case 'site':return <SiteExtrasStep part={id} onEditEdges={()=>{setPlanTool('edges');setMode('plan');showCanvas();}} data={data} update={update} estimate={estimate} autoCounts={autoCounts} lightingCheck={lightingCheck} screens={screens} screenArea={screenArea} sides={sides} canAddScreen={canAddScreen} setScreen={setScreen} writeScreen={writeScreen} lightingSearch={lightingSearch} setLightingSearch={setLightingSearch} deltas={deltas}/>;
    case 'backyard':return <BackyardStep data={data} update={update} estimate={estimate} earlierYard={earlierYard?.yardFeatures.length??0} onRestoreEarlierYard={restoreEarlierYard} onDismissEarlierYard={dismissEarlierYard}/>;
    case 'proposal':return <EstimateStep data={data} update={update} estimate={estimate} material={material} railingName={railingName} ledger={schedule} designFacts={designFacts} wrapped={!!wrap} reviewFlags={reviewFlags} saved={saved} preparing={preparing} pdfBusy={pdfBusy} onSend={()=>setSendOpen(true)} onOpenProposal={()=>void openProposal()} onDownloadPdf={()=>void downloadPdf()} onSaveJSON={()=>saveJSON()} onDownloadSummary={download} onExport={kind=>void exportModel(kind)} onOpenPermit={()=>setPermitOpen(true)}/>;
  }};
  // "Draw it on the plan" (the Deck section's outline editor): the Draw outline tool, with the plan brought into view.
  const showCanvas=()=>{setWorkspaceView('canvas');requestAnimationFrame(()=>document.getElementById('deck-live-preview')?.scrollIntoView({block:'start',behavior:reducedMotion()?'auto':'smooth'}));};
  const drawOnPlan=()=>{setPlanTool('outline');setMode('plan');showCanvas();};
  const startOver=()=>{replace(deckReleaseData(structuredClone(DEFAULT_DECK)));clearJobContext();closeSections();setSaved(false);setDesignStatus('A new default design is ready.');setDesignError('');resumeAutosave();};
  const restoreRevision=(candidate:DeckData)=>{
    const next=parseDesign(serializeDesign(candidate));
    // JobRevisionDialog supplies a validated local snapshot. Public serialization intentionally
    // omits contractor prices; retain the exact reviewed local rates, including absent values.
    for(const key of ['materialMarkup','customLaborCost','customOverrides','addOnTransitionLabor','addOnHardwareCost','addOnFlashingLf','quoteResolutions','pergolaQuoteCosts'] as const){
      delete next[key];
      if(Object.hasOwn(candidate,key))(next as unknown as Record<string,unknown>)[key]=structuredClone(candidate[key]);
    }
    const diff=Object.fromEntries(Object.keys({...data,...next}).filter(k=>JSON.stringify(data[k as keyof DeckData])!==JSON.stringify(next[k as keyof DeckData])).map(k=>[k,next[k as keyof DeckData]]));
    if(Object.keys(diff).length){changes.edit(diff,data,true);replaceDesign(next);setSaved(false);}
    setSelection({partIds:[],boards:[]});setDesignError('');setJobsOpen(false);setMode('plan');setPlanTool('outline');showCanvas();
    setDesignStatus('Saved job version restored as one undoable change. Pricing uses the current price book.');
    resumeAutosave();
  };
  const locateIssue=(action:{section:SectionId;partIds?:string[];guidance:string})=>{
    setIssuesOpen(false);setDesignStatus(action.guidance);
    if(action.partIds?.length){setSelection({partIds:action.partIds,boards:[]});setPlanTool('components');setMode('plan');if(action.section==='house')showCanvas();else openSection(action.section,true);}
    else openSection(action.section,true);
  };
  const currentIssues=[...new Set([...reviewFlags,...lightingCheck.warnings])];
  return <div className="deck-designer" data-workspace-view={workspaceView} data-assistant-open={askOpen||undefined}>
    <SEO title="Design Your Deck in 3D | Golden Maple" description="Explore deck dimensions, materials, stairs and railings with a live 3D model and detailed planning estimate." canonical="https://goldenmaplelandscaping.ca/deck-designer" schema={DESIGNER_SCHEMA}/>
    <header className="dd-header"><Link to="/" className="dd-workspace-brand" aria-label="Golden Maple home"><span className="dd-brand-symbol" aria-hidden="true">↗</span><span>DeckCraft<small>Golden Maple</small></span></Link><div className="dd-workspace-project"><h1>Draw your deck on your house.</h1><span className="dd-save-state"><i aria-hidden="true"/>{autosavePaused?'Auto-save paused':mounted?'Auto-save on this device':'Loading your design'}</span></div><WorkspaceTools data={data} linkBackup={linkBackup} designStatus={designStatus} designError={designError} onSave={()=>saveJSON()} onImport={importFile} onRestoreOwn={restoreOwnDesign} onStartOver={startOver} onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} autosavePaused={autosavePaused} onDownloadPrevious={unrestoredDesign?()=>downloadFile(unrestoredDesign,'application/json','golden-maple-previous-design.json'):undefined}/><div id="dd-workspace-agent-slot"><button type="button" className="dd-agent-open" disabled={!mounted||!designReady} aria-haspopup="dialog" onClick={()=>setPresetsOpen(true)}>Presets</button><button type="button" className="dd-agent-open" aria-haspopup="dialog" onClick={()=>setAgentOpen(true)}>Agents</button></div><button type="button" className="dd-send-top" onClick={()=>setSendOpen(true)}>Send my design</button></header>
    {mounted&&<Suspense fallback={null}><EasyEditTools onAsk={()=>{showCanvas();setAskOpen(true);requestAnimationFrame(()=>{if(window.matchMedia('(max-width:800px)').matches)document.getElementById('dd-assistant-dock')?.scrollIntoView({block:'start',behavior:'smooth'});});}} onJobs={()=>setJobsOpen(true)} onIssues={()=>setIssuesOpen(true)} issues={currentIssues.length} ready={designReady} autosaveState={autosaveState} savedAt={lastAutosaveAt} jobLabel={jobLabel}/></Suspense>}
    <main className="dd-workspace">
      <PreviewPanel assistantTargets={assistantTargets} data={data} update={update} applyComponent={atomicUpdate} estimate={estimate} mode={mode} setMode={setMode} mounted={mounted} hasWebGL={hasWebGL} setHasWebGL={setHasWebGL} retryWebGL={retryWebGL} hasFixtures={hasFixtures} autoCounts={autoCounts} houseOpen={open.has('house')} pickedHouseOpeningId={pickedHouseOpeningId} effectiveHouseOpeningId={effectiveHouseOpeningId} selectHouseOpening={selectHouseOpening} moveHouseOpening={moveHouseOpening} editHouseOpening={editHouseOpening} setScreen={setScreen} onSnapshotReady={onSnapshotReady} snapshotLighting={snapshotLighting} tool={planTool} setTool={setPlanTool} pendingInlay={pendingInlay} onPendingInlay={setPendingInlay} externalSelection={selection} onSelectionChange={setSelection} stairEdges={stairEdges} onOpenSection={id=>openSection(id,true)} docked={docked} boardPaint={boardPaint} setBoardPaint={setBoardPaint} onPaintBoard={onPaintBoard} exteriorOpen={exteriorOpen} setExteriorOpen={openExterior} onSketch={()=>setSketchOpen(true)} sketchReady={mounted&&designReady}/>
      <section className="dd-controls" aria-label="Deck configuration">
        <SectionList data={data} ledger={schedule} open={open} onToggle={toggleSection} onOpen={id=>openSection(id,true)} renderBody={renderSection} onAssistant={askOpen?showCanvas:undefined} onCanvas={showCanvas} inspectorVisible={workspaceView==='inspector'}/>
      </section>
      <aside id="dd-assistant-dock" className="dd-assistant-slot" hidden={!askOpen}><button type="button" className="dd-assistant-back" onClick={showCanvas}>↑ Back to drawing</button></aside>
      <WorkspacePrice onQuoteReview={()=>setQuoteReviewOpen(true)} ledger={schedule} changes={changes.records} onFullList={showFullList}/>
    </main>
    <section className="dd-faq" aria-labelledby="dd-faq-title"><h2 id="dd-faq-title">Deck designer questions</h2>{DESIGNER_FAQ.map(f=><details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</section>
    {mounted&&<Suspense fallback={null}><DeckAgentBridge open={agentOpen} onClose={()=>setAgentOpen(false)} plainLanguageOpen={askOpen} dockTargetId="dd-assistant-dock" onTargetsChange={setAssistantTargets} onClosePlainLanguage={()=>{setAskOpen(false);setAssistantTargets(null);}} selection={selection} adapter={{data,estimate,reviewFlags,view:mode,openSections:[...open],canUndo,canRedo,ready:mounted&&designReady,commitDesign:next=>{const diff=Object.fromEntries(Object.keys({...data,...next}).filter(k=>JSON.stringify(data[k as keyof DeckData])!==JSON.stringify(next[k as keyof DeckData])).map(k=>[k,next[k as keyof DeckData]]));changes.edit(diff,data,true);replaceDesign(next);},undo,redo,setView:setMode,openSection:id=>openSection(id,true),actions:{'save.json':()=>saveJSON(true),'export.obj':()=>exportModel('obj',true),'export.dxf':()=>exportModel('dxf',true),'proposal.open':()=>openProposal(true),'proposal.pdf':()=>downloadPdf(undefined,true),'review.open':()=>setSendOpen(true)}}}/></Suspense>}
    {quoteReviewOpen&&<Suspense fallback={<p role="status">Opening quote-cost review…</p>}><QuoteReviewPanel data={data} estimate={estimate} onUpdate={atomicUpdate} onClose={()=>setQuoteReviewOpen(false)}/></Suspense>}
    <ChangeAnnouncer record={changes.records.at(-1)}/>
    {jobsOpen&&<Suspense fallback={<p role="status">Opening saved jobs…</p>}><JobRevisionDialog data={data} onRestore={restoreRevision} onClose={()=>setJobsOpen(false)} onSaved={status=>setJobLabel(`${status.job} · ${status.revision}`)}/></Suspense>}
    {permitOpen&&<Suspense fallback={<p role="status">Drawing the permit sheets…</p>}><PermitSetDialog data={data} model={estimate.model} reviewItems={reviewFlags} materialName={material.name} railingName={railingName} date={proposalDate()} onClose={()=>setPermitOpen(false)} onOutput={kind=>trackDeck('deckcraft_output',`deck_${kind}`)} onSiteChange={site=>update({permitSite:site})}/></Suspense>}
    {issuesOpen&&<Suspense fallback={<p role="status">Opening design review…</p>}><IssueReviewDialog data={data} model={estimate.model} messages={currentIssues} onLocate={locateIssue} onClose={()=>setIssuesOpen(false)}/></Suspense>}
    {sketchOpen&&<Suspense fallback={<p role="status">Opening your sketch canvas…</p>}><SketchDesigner data={data} onClose={()=>setSketchOpen(false)} onApply={patch=>{atomicUpdate(patch);setSketchOpen(false);setMode('plan');setPlanTool('outline');setBoardPaint(null);setExteriorOpen(false);setSelectedHouseOpeningId('');setDesignStatus('The same design is ready on the plan. Pull any point or edge, or tap an edge dimension.');showCanvas();}}/></Suspense>}
    {presetsOpen&&<Suspense fallback={<p role="status">Opening contractor presets…</p>}><ContractorPresets data={data} onApply={patch=>{atomicUpdate(patch);setPresetsOpen(false);}} onClose={()=>setPresetsOpen(false)}/></Suspense>}
    {sendOpen&&<Suspense fallback={null}><SendDesignDialog data={data} estimate={estimate} summary={summary} reviewItems={reviewFlags} send={postDesign} onPrint={()=>{setSendOpen(false);void openProposal();}} onDownloadPdf={downloadPdf} onClose={closeSend}/></Suspense>}
    {proposal&&<Suspense fallback={null}><ProposalDialog data={data} estimate={estimate} facts={proposalFacts} reviewItems={reviewFlags} image={proposal.shots[0]?.src??null} shots={proposal.shots} date={proposal.date} onClose={closeProposal} onDownloadPdf={()=>void downloadPdf(proposal.shots)} pdfBusy={pdfBusy}/></Suspense>}
  </div>;
}

