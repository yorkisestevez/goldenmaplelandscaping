import {useRef} from 'react';
import ShareDesignLink from '../ShareDesignLink';
import type {DeckData} from '../types';

/** Undo and redo, save, import, share, go back to your own design, start over, and the status or error line. */
export default function DesignTools({data,linkBackup,designStatus,designError,onSave,onImport,onRestoreOwn,onStartOver,onUndo,onRedo,canUndo,canRedo}:{data:DeckData;linkBackup:boolean;designStatus:string;designError:string;onSave:()=>void;onImport:(file?:File)=>Promise<void>;onRestoreOwn:()=>void;onStartOver:()=>void;onUndo:()=>void;onRedo:()=>void;canUndo:boolean;canRedo:boolean}){
  const fileInput=useRef<HTMLInputElement>(null);
  return <section className="dd-design-tools" aria-label="Save and restore design">
    <div><strong>Your working design</strong><small>Automatically saved on this device</small></div>
    <button className="dd-secondary" onClick={onUndo} disabled={!canUndo} aria-keyshortcuts="Control+Z Meta+Z">Undo</button>
    <button className="dd-secondary" onClick={onRedo} disabled={!canRedo} aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y">Redo</button>
    <button className="dd-secondary" onClick={onSave}>Save JSON</button>
    <button className="dd-secondary" onClick={()=>fileInput.current?.click()}>Import design</button>
    <input ref={fileInput} type="file" accept=".json,application/json" hidden aria-label="Import Golden Maple design JSON" onChange={e=>void onImport(e.target.files?.[0]).finally(()=>{if(fileInput.current)fileInput.current.value='';})}/>
    <ShareDesignLink data={data}/>
    {linkBackup&&<button className="dd-secondary" onClick={onRestoreOwn}>Go back to my own design</button>}
    <details className="dd-reset"><summary>Start over</summary><p>Replace this device’s current design with the default deck.</p><button className="dd-secondary" onClick={onStartOver}>Start a new design</button></details>
    {designStatus&&<p role="status">{designStatus}</p>}{designError&&<p role="alert" className="dd-error">{designError}</p>}
  </section>;
}
