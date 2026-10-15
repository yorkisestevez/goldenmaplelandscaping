import {useEffect,useState,useSyncExternalStore} from 'react';
import {applyPhotoSearch,getPhotoProgress,getPhotoServerProgress,getPhotoServerSettings,getPhotoSettings,setPhotoSettings,subscribePhoto,subscribePhotoProgress,clampStop,clampTarget} from './photoMode';
import {PHOTO_FALLBACK,PHOTO_LOOKS,type PhotoLook} from './photoGrade';

const LOOK_LABEL:Record<PhotoLook,string>={day:'Day',golden:'Golden hour',night:'Night'};

/** Opt-in controls for path-traced stills. Off leaves the real-time view, colours and prices alone. */
export default function PhotoModePanel({lighting,onLighting}:{lighting:'Daylight'|'Evening';onLighting?:(next:'Daylight'|'Evening')=>void}){
 const settings=useSyncExternalStore(subscribePhoto,getPhotoSettings,getPhotoServerSettings);
 const progress=useSyncExternalStore(subscribePhotoProgress,getPhotoProgress,getPhotoServerProgress);
 const [status,setStatus]=useState('');
 useEffect(()=>{applyPhotoSearch();},[]);
 useEffect(()=>{
  if(!settings.enabled)return;
  if(lighting==='Evening'&&settings.look!=='night')setPhotoSettings({look:'night'});
  else if(lighting==='Daylight'&&settings.look==='night')setPhotoSettings({look:'day'});
 },[lighting,settings.enabled]);
 useEffect(()=>{
  const onStatus=(event:Event)=>{const detail=(event as CustomEvent<{busy?:boolean;error?:string;filename?:string}>).detail;setStatus(detail?.error??(detail?.busy?'Rendering the photo export…':detail?.filename?`Exported ${detail.filename}.`:''));};
  window.addEventListener('deckcraft:export-photo-status',onStatus);return ()=>window.removeEventListener('deckcraft:export-photo-status',onStatus);
 },[]);
 const choose=(look:PhotoLook)=>{
  setPhotoSettings({look});
  const next=look==='night'?'Evening':'Daylight';
  if(look!=='golden'&&lighting!==next)onLighting?.(next);
  if(look==='golden'&&lighting==='Evening')onLighting?.('Daylight');
 };
 const busy=progress.phase==='checking'||progress.phase==='building';
 return <div className="absolute top-3 left-3 z-20 max-w-xs rounded-md bg-white/95 p-3 text-xs text-[#38413b] shadow-sm pointer-events-auto">
  <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={settings.enabled} onChange={e=>setPhotoSettings({enabled:e.target.checked})}/>Photo mode</label>
  {settings.enabled&&<div className="mt-2 grid gap-2">
   <p role="status">{progress.phase==='fallback'?PHOTO_FALLBACK:progress.message||'Waiting for the scene to finish loading.'}</p>
   <label className="flex items-center justify-between gap-2">Render until<input className="w-20 rounded border border-[#c5cdc6] px-2 py-1" type="number" min={1} max={4096} value={settings.target} onChange={e=>setPhotoSettings({target:clampTarget(Number(e.target.value))})} aria-label="Render until this many samples"/></label>
   <label className="flex items-center gap-2"><input type="checkbox" checked={settings.denoise} onChange={e=>setPhotoSettings({denoise:e.target.checked})}/>Denoise the finished still</label>
   <div className="flex flex-wrap gap-1" role="group" aria-label="Photo time of day">{PHOTO_LOOKS.map(look=><button type="button" key={look} className={`rounded px-2 py-1 ${settings.look===look?'bg-[#38413b] text-white':'bg-[#e7eee8]'}`} aria-pressed={settings.look===look} onClick={()=>choose(look)}>{LOOK_LABEL[look]}</button>)}</div>
   <label className="flex items-center justify-between gap-2">Aperture f/<input className="w-20 rounded border border-[#c5cdc6] px-2 py-1" type="number" min={1.4} max={22} step={0.1} value={settings.fStop} onChange={e=>setPhotoSettings({fStop:clampStop(Number(e.target.value))})} aria-label="Aperture f-stop"/></label>
   <div className="flex gap-1">{[2048,4096].map(width=><button type="button" key={width} className="rounded bg-[#e7eee8] px-2 py-1 disabled:opacity-50" disabled={busy||progress.phase==='fallback'||progress.phase==='off'} onClick={()=>window.dispatchEvent(new CustomEvent('deckcraft:export-photo',{detail:{width}}))}>Export {width===2048?'2K':'4K'}</button>)}</div>
   {status&&<p role="status">{status}</p>}
  </div>}
 </div>;
}
