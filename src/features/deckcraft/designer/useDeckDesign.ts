import {useEffect,useRef,useState} from 'react';
import {prepareDesignUpdate} from './designUpdate';
import {deckReleaseData,DECK_RELEASE_STORAGE_KEY,parseDeckReleaseDesign as parseDesign,serializeDeckReleaseDesign as serializeDesign} from '../deckRelease';
import {DEFAULT_DECK} from '../defaults';
import {DESIGN_STORAGE_KEY,pruneEdgeNames} from '../designPersistence';
import {DESIGN_LINK_BACKUP_KEY,DesignLinkError,decodeDesignLinkFile,designLinkFromHash,designToKeep} from '../designLink';
import {PRICE_BOOK,priceBookLabel} from '../priceBook';
import {trackDeck} from '../deckAnalytics';
import {editKey,emptyHistory,recordChange,redoChange,undoChange,type DesignHistory} from './designHistory';
import type {DeckData,TerrainConfig,YardFeature} from '../types';
import {deckSizeForArea,readDeckArea} from '../estimatorHandoff';

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
  const history=useRef<DesignHistory<DeckData>>(emptyHistory()),lastData=useRef(data),source=useRef<string|null>(null),replaced=useRef(0);
  const [historySize,setHistorySize]=useState({past:0,future:0});
  const syncHistorySize=()=>setHistorySize({past:history.current.past.length,future:history.current.future.length});
  const replace=(next:DeckData)=>{source.current=`replace:${++replaced.current}`;setData(next);};
  // A shared design link (#d=…) opens in place of the working design. The visitor's own design is kept
  // (never overwritten by a second link) so they can go back to it.
  async function openSharedLink(value:string,own:string|null){
    try{
      const {design:shared,priceBook}=await decodeDesignLinkFile(value);
      let kept=false;
      try{const existing=localStorage.getItem(DESIGN_LINK_BACKUP_KEY),keep=designToKeep(existing,own,serializeDesign(shared));if(keep)localStorage.setItem(DESIGN_LINK_BACKUP_KEY,keep);kept=!!(existing||keep);}catch{/* Storage unavailable: the shared design still opens. */}
      replace(shared);setSaved(false);onReplaced();setDesignError('');setLinkBackup(kept);
      // A link made before the last price change says so: the estimate shown is today's, not the one that was sent.
      const priced=priceBook&&priceBook!==PRICE_BOOK.version?`This design was first priced with the ${priceBookLabel(priceBook)}; prices have changed since, and the estimate now uses the ${priceBookLabel()}.`:`You’re looking at a design shared with you, priced with today’s Golden Maple price book.`;
      setDesignStatus(`${priced}${kept?' Your own design is kept: use “Go back to my own design” to return to it.':''}`);
      trackDeck('deckcraft_link','deck_link_opened');
    }catch(error){setDesignError(error instanceof DesignLinkError?error.message:'This design link could not be opened.');trackDeck('deckcraft_link','deck_link_failed');}
    finally{try{window.history.replaceState(null,'',window.location.pathname+window.location.search);}catch{/* The hash stays; nothing else depends on it. */}}
  }
  function restoreOwnDesign(){
    try{const own=localStorage.getItem(DESIGN_LINK_BACKUP_KEY);if(own)replace(parseDesign(own));localStorage.removeItem(DESIGN_LINK_BACKUP_KEY);setLinkBackup(false);setSaved(false);onReplaced();setDesignError('');setDesignStatus(own?'Your own design is back.':'');trackDeck('deckcraft_link','deck_link_went_back');}
    catch{setDesignError('Your own design could not be restored. You can import a saved JSON file.');}
  }
  useEffect(()=>{
    setMounted(true);
    try {const c=document.createElement('canvas');setHasWebGL(!!(c.getContext('webgl2')||c.getContext('webgl')));}catch{setHasWebGL(false);}
    let stored:string|null=null;
    try{
      const current=localStorage.getItem(DECK_RELEASE_STORAGE_KEY);stored=current??localStorage.getItem(DESIGN_STORAGE_KEY);
      if(stored){
        const restored=parseDesign(stored);
        if(!current&&restored.yardFeatures?.length){
          const {yardFeatures,terrainConfig,...deck}=restored;setData(deck);setEarlierYard({yardFeatures,...(terrainConfig?{terrainConfig}:{})});
          setDesignStatus('Your deck and house have been restored. Your earlier design also had backyard features; you can add them back in the Backyard section.');
        }else{setData(restored);setDesignStatus(restored.yardFeatures?.length?'Your deck, house and backyard have been restored.':'Your deck and house have been restored.');}
      }
    }catch{setDesignError('Your previous design could not be restored. You can import a saved JSON file.');}
    try{setLinkBackup(!!localStorage.getItem(DESIGN_LINK_BACKUP_KEY));}catch{/* No storage, no backup. */}
    setStorageReady(true);
    // A deck handed over by the cost estimator (?sqft=300) starts at about that size, unless a shared design
    // link opens instead; a saved design is never replaced, only told the size.
    const area=readDeckArea(window.location.search),link=designLinkFromHash(window.location.hash);
    if(area){
      const size=deckSizeForArea(area),words=`about ${area} sq ft (${size.width} × ${size.length} ft)`;
      if(!link&&!stored){update(size);setDesignStatus(`Started from your cost estimate: a deck of ${words}. Adjust the size to fit your space.`);}
      else if(!link)setDesignStatus(status=>`${status?`${status} `:''}Your cost estimate had a deck of ${words}; change the size under Deck shape & size to start from it.`);
      try{const query=new URLSearchParams(window.location.search);query.delete('sqft');const rest=query.toString();window.history.replaceState(null,'',window.location.pathname+(rest?`?${rest}`:'')+window.location.hash);}catch{/* The size stays in the address; reopening starts from it again. */}
    }
    if(link)void openSharedLink(link,stored).finally(()=>setDesignReady(true));else setDesignReady(true);
    // A link pasted into this open tab only changes the hash.
    const onHash=()=>{const next=designLinkFromHash(window.location.hash);if(!next)return;setDesignReady(false);let own:string|null=null;try{own=serializeDesign(dataRef.current);}catch{/* Nothing to keep. */}void openSharedLink(next,own).finally(()=>setDesignReady(true));};
    window.addEventListener('hashchange',onHash);
    return ()=>window.removeEventListener('hashchange',onHash);
  },[]);
  useEffect(()=>{
    if(!storageReady)return;
    setAutosaveState('saving');
    const timer=setTimeout(()=>{
      try{
        localStorage.setItem(DECK_RELEASE_STORAGE_KEY,serializeDesign(data));
        setLastAutosaveAt(new Date().toISOString());setAutosaveState('saved');
        setDesignError(previous=>previous.startsWith('Automatic saving is unavailable')?'':previous);
      }catch{setAutosaveState('error');setDesignError('Automatic saving is unavailable on this device. Use Save JSON to keep your design.');}
    },450);
    return ()=>clearTimeout(timer);
  },[data,storageReady]);
  const retryWebGL=()=>{try{const c=document.createElement('canvas');setHasWebGL(!!(c.getContext('webgl2')||c.getContext('webgl')));}catch{setHasWebGL(false);}};
  // An edit can make a named stair or level edge unusable (a wrap removed, a corner cut back, a wider or
  // turned stair); it is dropped at once so no hidden choice stays in force.
  const update=(patch:Partial<DeckData>)=>{
    try{const next=prepareDesignUpdate(dataRef.current,patch);setDesignError('');setSaved(false);source.current??=editKey(patch);dataRef.current=next;setData(next);}
    catch(error){setDesignError(`${error instanceof Error?error.message:'The edit could not be applied.'} Unlock the measured edge before changing its length or direction.`);}
  };
  useEffect(()=>{
    const kind=source.current;source.current=null;
    // A change that leaves the design as it was (a number box re-committing its value) is not a step.
    if(kind&&lastData.current!==data&&JSON.stringify(lastData.current)!==JSON.stringify(data)){history.current=recordChange(history.current,lastData.current,kind,Date.now());syncHistorySize();}
    lastData.current=data;
  },[data]);
  const step=(move:typeof undoChange)=>{
    const result=move(history.current,dataRef.current);if(!result)return;
    history.current=result.history;source.current=null;setData(result.design);setSaved(false);syncHistorySize();
  };
  const undo=()=>step(undoChange),redo=()=>step(redoChange);
  const restoreEarlierYard=()=>{if(!earlierYard)return;update({yardFeatures:earlierYard.yardFeatures,...(earlierYard.terrainConfig?{terrainConfig:earlierYard.terrainConfig}:{})});setEarlierYard(null);};
  const dismissEarlierYard=()=>setEarlierYard(null);
  return {data,setData,update,replace,undo,redo,canUndo:historySize.past>0,canRedo:historySize.future>0,earlierYard,restoreEarlierYard,dismissEarlierYard,mounted,designReady,hasWebGL,setHasWebGL,retryWebGL,saved,setSaved,autosaveState,lastAutosaveAt,designStatus,setDesignStatus,designError,setDesignError,linkBackup,restoreOwnDesign};
}
