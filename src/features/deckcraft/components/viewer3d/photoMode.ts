/** Opt-in path-traced stills. Not design data: colours, quantities and prices stay on the project.
 * URL, read once: ?deck-photo=1, ?deck-photo-look=day|golden|night, ?deck-photo-samples=N. */
import {photoSamplesPerFrame} from '../../photoTraceApi';
import {PHOTO_GRADE,PHOTO_LOOKS,type PhotoLook} from './photoGrade';

export interface PhotoSettings{
 enabled:boolean;
 look:PhotoLook;
 /** Stop the progressive render at this many samples. */
 target:number;
 denoise:boolean;
 /** Photographic aperture. Higher is deeper focus. */
 fStop:number;
}

const DEFAULTS:PhotoSettings={enabled:false,look:'day',target:384,denoise:true,fStop:22};
let settings:PhotoSettings={...DEFAULTS};
const listeners=new Set<()=>void>();
let urlApplied=false;

export function getPhotoSettings(){return settings;}
export function getPhotoServerSettings():PhotoSettings{return {...DEFAULTS,enabled:false};}
export function subscribePhoto(listener:()=>void){listeners.add(listener);return ()=>listeners.delete(listener);}

export function setPhotoSettings(next:Partial<PhotoSettings>){
 const look=next.look??settings.look;
 const target=clampTarget(next.target??settings.target);
 const enabled=next.enabled??settings.enabled;
 const denoise=next.denoise??settings.denoise;
 const fStop=clampStop(next.fStop??settings.fStop);
 if(enabled===settings.enabled&&look===settings.look&&target===settings.target&&denoise===settings.denoise&&fStop===settings.fStop)return;
 settings={enabled,look,target,denoise,fStop};
 for(const listener of listeners)listener();
}

export function clampTarget(n:number){return Number.isFinite(n)?Math.max(1,Math.min(4096,Math.round(n))):settings.target;}
export function clampStop(n:number){return Number.isFinite(n)?Math.max(1.4,Math.min(22,n)):settings.fStop;}
export function photoLookGrade(look:PhotoLook=settings.look){return PHOTO_GRADE[look];}

export type PhotoPhase='off'|'checking'|'building'|'sampling'|'ready'|'fallback';
export interface PhotoProgress{phase:PhotoPhase;samples:number;message:string}
const OFF_PROGRESS:PhotoProgress={phase:'off',samples:0,message:''};
let progress:PhotoProgress=OFF_PROGRESS;
const progressListeners=new Set<()=>void>();
export function getPhotoProgress(){return progress;}
export function getPhotoServerProgress():PhotoProgress{return OFF_PROGRESS;}
export function subscribePhotoProgress(listener:()=>void){progressListeners.add(listener);return ()=>progressListeners.delete(listener);}
export function setPhotoProgress(next:PhotoProgress){
 if(next.phase===progress.phase&&next.samples===progress.samples&&next.message===progress.message)return;
 progress=next;
 for(const listener of progressListeners)listener();
}

/** The Ontario sample URL is loaded after the empty-project check. Hold the tracer until that camera exists. */
export function photoSampleHold(activeCameraId?:string){
 if(typeof location==='undefined')return false;
 return new URLSearchParams(location.search).get('deck-sample')==='ontario'&&activeCameraId!=='hero';
}

export function applyPhotoSearch(){
 if(urlApplied||typeof location==='undefined')return;
 urlApplied=true;
 const params=new URLSearchParams(location.search);
 const enabled=params.get('deck-photo')==='1';
 const lookRaw=params.get('deck-photo-look');
 const look=PHOTO_LOOKS.find(item=>item===lookRaw);
 const samples=photoSamplesPerFrame();
 if(enabled||look||samples)setPhotoSettings({enabled:enabled||samples>0,...(look?{look}:{}),...(samples?{target:samples}:{})});
}
