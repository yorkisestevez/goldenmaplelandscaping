import {useEffect,useRef,useState} from 'react';
import {prepareDesignUpdate} from './designUpdate';
import {deckReleaseData,DECK_RELEASE_STORAGE_KEY,parseDeckReleaseDesign as parseDesign,serializeDeckReleaseDesign as serializeDesign} from '../deckRelease';
import {DEFAULT_DECK} from '../defaults';
import {DESIGN_STORAGE_KEY} from '../designPersistence';
import {DESIGN_LINK_BACKUP_KEY,DesignLinkError,decodeDesignLinkFile,designLinkFromHash,designToKeep} from '../designLink';
import {PRICE_BOOK,priceBookLabel} from '../priceBook';
import {trackDeck} from '../deckAnalytics';
import {editKey,emptyHistory,recordChange,redoChange,undoChange,type DesignHistory} from './designHistory';
import type {DeckData,TerrainConfig,YardFeature} from '../types';
import {deckSizeForArea,readDeckArea} from '../estimatorHandoff';
import {siteEngineReady} from '../siteSurface';
import {ensureDesignExtensions,ensureLiveDesignExtensions,designExtensionsReady} from '../designExtensions';
const RECOVERY_STORAGE_KEY='golden-maple.deck-studio.unrestored.v1';
const storage=()=>import('../projectStorage');
async function privateText(data:DeckData){return (await import('./jobRevisionLibrary')).serializePrivateProject(data);}
async function parseRestoreText(text:string):Promise<DeckData>{const raw=JSON.parse(text);await ensureDesignExtensions(raw);return raw?.format==='deckcraft-private-project'?(await import('./jobRevisionLibrary')).parsePrivateProject(text):parseDesign(text);}
async function restoreText(text:string):Promise<DeckData>{const restored=await parseRestoreText(text);await ensureLiveDesignExtensions(restored);return restored;}

/**
 * The working design and everything that keeps it: autosave and restore on this device, shared design
 * links (#d=…) and the visitor's own design kept while they look at one, plus the first-mount checks
 * (3D support), and undo/redo. Its effects are the page's first effects, in the order the page always ran them.
 * `onReplaced` runs when a shared link or the visitor's own design replaces the working design (the page closes its
 * sections, so the new design is seen from the top).
 */
export function useDeckDesign({onReplaced}:{onReplaced:()=>void}){
  const [data,setData]=useState<DeckData>(()=>deckReleaseData(structuredClone(DEFAULT_DECK)));
  const [mounted,setMounted]=useState(false);
  const [designReady,setDesignReady]=useState(false);
  const [hasWebGL,setHasWebGL]=useState(true);
  const [saved,setSaved]=useState(false);
  const [storageReady,setStorageReady]=useState(false);
  const [autosavePaused,setAutosavePaused]=useState(false);
  const [unrestoredDesign,setUnrestoredDesign]=useState<string|null>(null);
  const [autosaveState,setAutosaveState]=useState<'loading'|'saving'|'saved'|'error'>('loading');
  const [lastAutosaveAt,setLastAutosaveAt]=useState('');
  const [designStatus,setDesignStatus]=useState('');
  const [designError,setDesignError]=useState('');
  const [linkBackup,setLinkBackup]=useState(false);
  // Backyard features from the older, pre-release autosave: offered in the Backyard section, not restored silently.
  const [earlierYard,setEarlierYard]=useState<{yardFeatures:YardFeature[];terrainConfig?:TerrainConfig}|null>(null);
  const dataRef=useRef(data);dataRef.current=data;
  // Undo/redo: an edit or a whole-design replacement names itself in `source` before it sets the design;
  // the effect below then records the design it replaced. Restoring on load, undo/redo themselves and the
  // automatic lighting sync set no source, so they never become a step.
  const history=useRef<DesignHistory<DeckData>>(emptyHistory()),lastData=useRef(data),source=useRef<string|null>(null),replaced=useRef(0),editIntent=useRef(0);
  const [historySize,setHistorySize]=useState({past:0,future:0});
  const syncHistorySize=()=>setHistorySize({past:history.current.past.length,future:history.current.future.length});
  const applyReplacement=(next:DeckData)=>{source.current=`replace:${++replaced.current}`;dataRef.current=next;setData(next);return true;};
  // A loading survey never becomes visible to the synchronous estimate path.
  // Any newer edit invalidates a pending replacement, even another site load.
  const replace=(next:DeckData):boolean|Promise<boolean>=>{
    const baseline=dataRef.current,intent=++editIntent.current;
    if(!designExtensionsReady(next)||next.siteModel&&!siteEngineReady()){const snapshot=structuredClone(next);return ensureLiveDesignExtensions(snapshot).then(()=>intent===editIntent.current&&baseline===dataRef.current&&alive.current?applyReplacement(snapshot):false).catch(error=>{if(intent===editIntent.current)setDesignError(`The design extension could not load. ${error instanceof Error?error.message:''}`);return false;});}
    return applyReplacement(next);
  };
  // Only an explicit import or new design may resume after a failed restore.
  // Keep the exact original bytes first; ordinary edits and shared links cannot discard them.
  const revision=useRef<number|undefined>(0),saveQueue=useRef(Promise.resolve()),saveGeneration=useRef(0),linkGeneration=useRef(0),alive=useRef(true);
  const unsaved=useRef(false),pausedRef=useRef(autosavePaused);pausedRef.current=autosavePaused;
  const resumeAutosave=async()=>{
    if(autosavePaused&&unrestoredDesign){
      try{localStorage.setItem(RECOVERY_STORAGE_KEY,unrestoredDesign);await (await storage()).preserveRecoveryText('current',unrestoredDesign,'Project explicitly replaced after failed restore.');revision.current=undefined;}
      catch{setDesignError('Your previous file is preserved. Auto-save remains paused; use Save JSON to keep this design.');return;}
    }
    pausedRef.current=false;setAutosavePaused(false);
  };
  // A shared design link (#d=…) opens in place of the working design. The visitor's own design is kept
  // (never overwritten by a second link) so they can go back to it.
  async function openSharedLink(value:string,own:string|null,request=++linkGeneration.current){
    const baseline=dataRef.current,intent=++editIntent.current;
    try{
      const {design:shared,priceBook}=await decodeDesignLinkFile(value);
      await ensureLiveDesignExtensions(shared);
      if(request!==linkGeneration.current||intent!==editIntent.current||baseline!==dataRef.current||!alive.current)return;
      let kept=false;
      try{const device=await storage(),existing=await device.readProjectValue<string>('recovery','own-design')??localStorage.getItem(DESIGN_LINK_BACKUP_KEY),keep=designToKeep(existing,own,serializeDesign(shared));if(keep)await device.writeProjectValues([{store:'recovery',key:'own-design',value:keep}]);kept=!!(existing||keep);}catch{/* The shared design can open when device storage is unavailable. */}
      if(request!==linkGeneration.current||intent!==editIntent.current||baseline!==dataRef.current||!alive.current)return;
      applyReplacement(shared);setSaved(false);onReplaced();setDesignError('');setLinkBackup(kept);
      // A link made before the last price change says so: the estimate shown is today's, not the one that was sent.
      const priced=priceBook&&priceBook!==PRICE_BOOK.version?`This design was first priced with the ${priceBookLabel(priceBook)}; prices have changed since, and the estimate now uses the ${priceBookLabel()}.`:`You’re looking at a design shared with you, priced with today’s Golden Maple price book.`;
      setDesignStatus(`${priced}${kept?' Your own design is kept: use “Go back to my own design” to return to it.':''}`);
      trackDeck('deckcraft_link','deck_link_opened');
    }catch(error){if(request===linkGeneration.current){setDesignError(error instanceof DesignLinkError?error.message:'This design link could not be opened.');trackDeck('deckcraft_link','deck_link_failed');}}
    finally{if(request===linkGeneration.current)try{window.history.replaceState(null,'',window.location.pathname+window.location.search);}catch{/* The hash stays; nothing else depends on it. */}}
  }
  async function restoreOwnDesign(){
    const baseline=dataRef.current,intent=++editIntent.current;
    try{const device=await storage(),own=await device.readProjectValue<string>('recovery','own-design')??localStorage.getItem(DESIGN_LINK_BACKUP_KEY),restored=own?await restoreText(own):undefined;if(intent!==editIntent.current||baseline!==dataRef.current||!alive.current)return;if(restored)applyReplacement(restored);await device.removeProjectValue('recovery','own-design');localStorage.removeItem(DESIGN_LINK_BACKUP_KEY);setLinkBackup(false);setSaved(false);onReplaced();setDesignError('');setDesignStatus(own?'Your own design is back.':'');trackDeck('deckcraft_link','deck_link_went_back');}
    catch{setDesignError('Your own design could not be restored. You can import a saved JSON file.');}
  }
  useEffect(()=>{
    alive.current=true;let active=true;setMounted(true);
    try {const c=document.createElement('canvas');setHasWebGL(!!(c.getContext('webgl2')||c.getContext('webgl')));}catch{setHasWebGL(false);}
    async function load(){
      let stored:string|null=null;const baseline=dataRef.current,intent=editIntent.current;
      try{
        const device=await storage(),hydrated=await device.hydrateStoredProject('current',[DECK_RELEASE_STORAGE_KEY,DESIGN_STORAGE_KEY],parseRestoreText);if(!active)return;
        revision.current=hydrated.record?.revision??0;stored=hydrated.record?.json??hydrated.unrestoredText??null;
        if(hydrated.unrestoredText!==undefined){setUnrestoredDesign(hydrated.unrestoredText);pausedRef.current=true;setAutosavePaused(true);setDesignError('Your previous file is preserved. Auto-save is paused. Open Files to download it, import another design, or start a new design.');}
        else if(hydrated.record){
          const restored=await restoreText(hydrated.record.json);if(!active)return;
          if(intent!==editIntent.current||baseline!==dataRef.current){setDesignStatus('Your newer edits are kept. The previous saved project remains preserved on this device.');}
          else if(hydrated.legacyKey===DESIGN_STORAGE_KEY&&restored.yardFeatures?.length){const {yardFeatures,terrainConfig,...deck}=restored;setData(deck);dataRef.current=deck;setEarlierYard({yardFeatures,...(terrainConfig?{terrainConfig}:{})});setDesignStatus('Your deck and house have been restored. Add your earlier backyard features in the Backyard section.');}
          else{setData(restored);dataRef.current=restored;setLastAutosaveAt(hydrated.record.savedAt);setDesignStatus('Your complete project has been restored from this device.');}
        }
        try{const recovery=localStorage.getItem(RECOVERY_STORAGE_KEY);if(recovery&&!hydrated.unrestoredText)setUnrestoredDesign(recovery);}catch{}
        try{setLinkBackup(!!(await device.readProjectValue('recovery','own-design')??localStorage.getItem(DESIGN_LINK_BACKUP_KEY)));}catch{}
      }catch(error){
        if(!active)return;const recovery=stored??(error as {recoveryText?:string})?.recoveryText;if(recovery)setUnrestoredDesign(recovery);pausedRef.current=true;setAutosavePaused(true);setDesignError(`Automatic saving is unavailable on this device. ${error instanceof Error?error.message:''} Use Save JSON to keep your design.`);
      }
      if(!active)return;
      const area=readDeckArea(window.location.search),link=designLinkFromHash(window.location.hash);
      if(area){const size=deckSizeForArea(area),words=`about ${area} sq ft (${size.width} × ${size.length} ft)`;
        if(!link&&!stored){update(size);setDesignStatus(`Started from your cost estimate: a deck of ${words}. Adjust the size to fit your space.`);}
        else if(!link)setDesignStatus(status=>`${status?`${status} `:''}Your cost estimate had a deck of ${words}; change the size under Deck shape & size to start from it.`);
        try{const query=new URLSearchParams(window.location.search);query.delete('sqft');const rest=query.toString();window.history.replaceState(null,'',window.location.pathname+(rest?`?${rest}`:'')+window.location.hash);}catch{}
      }
      if(link)await openSharedLink(link,stored);
      if(!link&&!stored&&new URLSearchParams(window.location.search).get('deck-sample')==='ontario'){
        try{
          const {ontarioShowcaseDesign}=await import('../showcaseSample');
          const sample=ontarioShowcaseDesign(),lighting=new URLSearchParams(window.location.search).get('deck-lighting');
          if(lighting==='evening')sample.sceneLighting='Evening';else if(lighting==='daylight')sample.sceneLighting='Daylight';
          if(active&&intent===editIntent.current&&baseline===dataRef.current){applyReplacement(sample);setDesignStatus('Showing the Ontario backyard sample for this view. It is not saved over a project on this device.');}
        }catch(error){if(active)setDesignStatus(error instanceof Error?error.message:'The Ontario sample could not be opened.');}
      }
      if(active){setStorageReady(true);setDesignReady(true);}
    }
    void load();
    const onHash=()=>{const next=designLinkFromHash(window.location.hash);if(!next)return;const request=++linkGeneration.current;setDesignReady(false);void privateText(dataRef.current).catch(()=>null).then(own=>openSharedLink(next,own,request)).finally(()=>{if(active&&request===linkGeneration.current)setDesignReady(true);});};
    window.addEventListener('hashchange',onHash);
    return ()=>{active=false;alive.current=false;window.removeEventListener('hashchange',onHash);};
  },[]);
  // Each save is queued, committed transactionally, and acknowledged only if
  // it is still the newest edit. Failed or competing-tab saves retain the prior
  // durable project and never receive a Saved label.
  function queueSave(snapshot:DeckData,generation:number){
    const task=saveQueue.current.catch(()=>{}).then(async()=>{
      if(pausedRef.current)return;
      const json=await privateText(snapshot),device=await storage(),record=await device.saveStoredProject('current',json,{expectedRevision:revision.current});revision.current=record.revision;
      if(alive.current&&generation===saveGeneration.current){unsaved.current=false;setLastAutosaveAt(record.savedAt);setAutosaveState('saved');setDesignError(previous=>previous.startsWith('Automatic saving is unavailable')?'':previous);}
    });
    saveQueue.current=task.catch(error=>{if(alive.current&&generation===saveGeneration.current){setAutosaveState('error');setDesignError(`Automatic saving is unavailable on this device. ${error instanceof Error?error.message:''} Use Save JSON to keep your design.`);}});
  }
  useEffect(()=>{const flush=()=>{if(unsaved.current&&!pausedRef.current)queueSave(dataRef.current,saveGeneration.current);};window.addEventListener('pagehide',flush);return ()=>{window.removeEventListener('pagehide',flush);flush();};},[]);
  useEffect(()=>{
    if(!storageReady||!designReady)return;
    if(autosavePaused){setAutosaveState('error');return;}
    const generation=++saveGeneration.current;setAutosaveState('saving');unsaved.current=true;
    const timer=setTimeout(()=>queueSave(data,generation),450);return ()=>clearTimeout(timer);
  },[data,storageReady,designReady,autosavePaused]);
  const retryWebGL=()=>{try{const c=document.createElement('canvas');setHasWebGL(!!(c.getContext('webgl2')||c.getContext('webgl')));}catch{setHasWebGL(false);}};
  // An edit can make a named stair or level edge unusable (a wrap removed, a corner cut back, a wider or
  // turned stair); it is dropped at once so no hidden choice stays in force.
  const update=(patch:Partial<DeckData>):boolean|Promise<boolean>=>{
    const baseline=dataRef.current,intent=++editIntent.current;
    const commit=(change:Partial<DeckData>)=>{try{const next=prepareDesignUpdate(baseline,change);setDesignError('');setSaved(false);source.current??=editKey(change);dataRef.current=next;setData(next);return true;}catch(error){setDesignError(`${error instanceof Error?error.message:'The edit could not be applied.'} Unlock the measured edge before changing its length or direction.`);return false;}};
    const candidate={...baseline,...patch};if(!designExtensionsReady(candidate)||candidate.siteModel&&!siteEngineReady()){const snapshot=structuredClone(patch);return ensureLiveDesignExtensions({...baseline,...snapshot}).then(()=>intent===editIntent.current&&baseline===dataRef.current&&alive.current?commit(snapshot):false).catch(error=>{if(intent===editIntent.current)setDesignError(`The design extension could not load. ${error instanceof Error?error.message:''}`);return false;});}
    return commit(patch);
  };
  useEffect(()=>{
    const kind=source.current;source.current=null;
    // A change that leaves the design as it was (a number box re-committing its value) is not a step.
    if(kind&&lastData.current!==data&&JSON.stringify(lastData.current)!==JSON.stringify(data)){history.current=recordChange(history.current,lastData.current,kind,Date.now());syncHistorySize();}
    lastData.current=data;
  },[data]);
  const step=(move:typeof undoChange)=>{
    const result=move(history.current,dataRef.current);if(!result)return;
    ++editIntent.current;history.current=result.history;source.current=null;dataRef.current=result.design;setData(result.design);setSaved(false);syncHistorySize();
  };
  const undo=()=>step(undoChange),redo=()=>step(redoChange);
  const restoreEarlierYard=()=>{if(!earlierYard)return;update({yardFeatures:earlierYard.yardFeatures,...(earlierYard.terrainConfig?{terrainConfig:earlierYard.terrainConfig}:{})});setEarlierYard(null);};
  const dismissEarlierYard=()=>setEarlierYard(null);
  return {data,setData,update,replace,undo,redo,canUndo:historySize.past>0,canRedo:historySize.future>0,earlierYard,restoreEarlierYard,dismissEarlierYard,mounted,designReady,hasWebGL,setHasWebGL,retryWebGL,saved,setSaved,autosaveState,lastAutosaveAt,autosavePaused,unrestoredDesign,resumeAutosave,designStatus,setDesignStatus,designError,setDesignError,linkBackup,restoreOwnDesign};
}
