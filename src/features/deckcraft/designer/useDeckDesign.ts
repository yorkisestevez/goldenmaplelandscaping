import {useEffect,useRef,useState} from 'react';
import {deckReleaseData,DECK_RELEASE_STORAGE_KEY,parseDeckReleaseDesign as parseDesign,serializeDeckReleaseDesign as serializeDesign} from '../deckRelease';
import {DEFAULT_DECK} from '../defaults';
import {DESIGN_STORAGE_KEY,pruneEdgeNames} from '../designPersistence';
import {DESIGN_LINK_BACKUP_KEY,DesignLinkError,decodeDesignLink,designLinkFromHash,designToKeep} from '../designLink';
import {trackDeck} from '../deckAnalytics';
import {editKey,emptyHistory,recordChange,redoChange,undoChange,type DesignHistory} from './designHistory';
import type {DeckData} from '../types';

/**
 * The working design and everything that keeps it: autosave and restore on this device, shared design
 * links (#d=…) and the visitor's own design kept while they look at one, plus the first-mount checks
 * (3D support), and undo/redo. Its effects are the page's first effects, in the order the page always ran them.
 */
export function useDeckDesign({setStep}:{setStep:(step:number)=>void}){
  const [data,setData]=useState<DeckData>(()=>deckReleaseData(structuredClone(DEFAULT_DECK)));
  const [mounted,setMounted]=useState(false);
  const [hasWebGL,setHasWebGL]=useState(true);
  const [saved,setSaved]=useState(false);
  const [storageReady,setStorageReady]=useState(false);
  const [designStatus,setDesignStatus]=useState('');
  const [designError,setDesignError]=useState('');
  const [linkBackup,setLinkBackup]=useState(false);
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
      const shared=await decodeDesignLink(value);
      let kept=false;
      try{const existing=localStorage.getItem(DESIGN_LINK_BACKUP_KEY),keep=designToKeep(existing,own,serializeDesign(shared));if(keep)localStorage.setItem(DESIGN_LINK_BACKUP_KEY,keep);kept=!!(existing||keep);}catch{/* Storage unavailable: the shared design still opens. */}
      replace(shared);setSaved(false);setStep(0);setDesignError('');setLinkBackup(kept);
      setDesignStatus(`You’re looking at a design shared with you, priced with today’s Golden Maple price book.${kept?' Your own design is kept: use “Go back to my own design” to return to it.':''}`);
      trackDeck('deckcraft_link','deck_link_opened');
    }catch(error){setDesignError(error instanceof DesignLinkError?error.message:'This design link could not be opened.');trackDeck('deckcraft_link','deck_link_failed');}
    finally{try{window.history.replaceState(null,'',window.location.pathname+window.location.search);}catch{/* The hash stays; nothing else depends on it. */}}
  }
  function restoreOwnDesign(){
    try{const own=localStorage.getItem(DESIGN_LINK_BACKUP_KEY);if(own)replace(parseDesign(own));localStorage.removeItem(DESIGN_LINK_BACKUP_KEY);setLinkBackup(false);setSaved(false);setStep(0);setDesignError('');setDesignStatus(own?'Your own design is back.':'');trackDeck('deckcraft_link','deck_link_went_back');}
    catch{setDesignError('Your own design could not be restored. You can import a saved JSON file.');}
  }
  useEffect(()=>{
    setMounted(true);
    try {const c=document.createElement('canvas');setHasWebGL(!!(c.getContext('webgl2')||c.getContext('webgl')));}catch{setHasWebGL(false);}
    let stored:string|null=null;
    try{stored=localStorage.getItem(DECK_RELEASE_STORAGE_KEY)??localStorage.getItem(DESIGN_STORAGE_KEY);if(stored){setData(parseDesign(stored));setDesignStatus('Your deck and house have been restored. Any deferred yard features remain in the older saved design.');}}catch{setDesignError('Your previous design could not be restored. You can import a saved JSON file.');}
    try{setLinkBackup(!!localStorage.getItem(DESIGN_LINK_BACKUP_KEY));}catch{/* No storage, no backup. */}
    setStorageReady(true);
    const link=designLinkFromHash(window.location.hash);if(link)void openSharedLink(link,stored);
    // A link pasted into this open tab only changes the hash.
    const onHash=()=>{const next=designLinkFromHash(window.location.hash);if(!next)return;let own:string|null=null;try{own=serializeDesign(dataRef.current);}catch{/* Nothing to keep. */}void openSharedLink(next,own);};
    window.addEventListener('hashchange',onHash);
    return ()=>window.removeEventListener('hashchange',onHash);
  },[]);
  useEffect(()=>{if(!storageReady)return;const timer=setTimeout(()=>{try{localStorage.setItem(DECK_RELEASE_STORAGE_KEY,serializeDesign(data));}catch{setDesignError('Automatic saving is unavailable on this device. Use Save JSON to keep your design.');}},450);return ()=>clearTimeout(timer);},[data,storageReady]);
  const retryWebGL=()=>{try{const c=document.createElement('canvas');setHasWebGL(!!(c.getContext('webgl2')||c.getContext('webgl')));}catch{setHasWebGL(false);}};
  // An edit can make a named stair or level edge unusable (a wrap removed, a corner cut back, a wider or
  // turned stair); it is dropped at once so no hidden choice stays in force.
  const update=(patch:Partial<DeckData>)=>{setSaved(false);source.current??=editKey(patch);setData(prev=>pruneEdgeNames(deckReleaseData({...prev,...patch})));};
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
  return {data,setData,update,replace,undo,redo,canUndo:historySize.past>0,canRedo:historySize.future>0,mounted,hasWebGL,setHasWebGL,retryWebGL,saved,setSaved,designStatus,setDesignStatus,designError,setDesignError,linkBackup,restoreOwnDesign};
}
