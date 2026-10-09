import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {useThree} from '@react-three/fiber';
import {chooseRenderQuality,rendererFacts} from './renderQuality';
import {applyShowcaseSearch,getShowcaseFlags,getShowcaseServerFlags,subscribeShowcase} from './showcaseMode';

export function useRenderQuality(){
 const gl=useThree(s=>s.gl),narrow=useThree(s=>s.size.width<600);
 const showcase=useSyncExternalStore(subscribeShowcase,()=>getShowcaseFlags().quality,()=>false);
 return useMemo(()=>chooseRenderQuality(rendererFacts(gl),narrow,showcase),[gl,narrow,showcase]);
}
/** Nonvisual diagnostics stay on the canvas for local device QA. */
export default function RenderQuality(){
 const q=useRenderQuality(),gl=useThree(s=>s.gl),setDpr=useThree(s=>s.setDpr);
 const showcase=useSyncExternalStore(subscribeShowcase,()=>getShowcaseFlags().quality,()=>false);
 useEffect(()=>{
  const screen=typeof window==='undefined'?1:window.devicePixelRatio||1;
  setDpr(showcase?q.dpr:Math.min(screen,q.dpr));
  Object.assign(gl.domElement.dataset,{renderQuality:q.tier,grassBudget:String(q.grassBudget),maxDpr:String(q.dpr),aoSamples:String(q.aoSamples),aoResolution:String(q.aoResolution),shadowSize:String(q.shadowSize),showcaseQuality:showcase?'1':'0'});
 },[q,gl,setDpr,showcase]);
 return null;
}
/** Applies the URL flags once the canvas exists and redraws when the still-export toggles change. */
export function ShowcaseModeSync(){
 const invalidate=useThree(s=>s.invalidate),gl=useThree(s=>s.gl);
 const flags=useSyncExternalStore(subscribeShowcase,getShowcaseFlags,getShowcaseServerFlags);
 useEffect(()=>{applyShowcaseSearch();},[]);
 useEffect(()=>{Object.assign(gl.domElement.dataset,{showcaseContext:flags.context?'1':'0',showcaseHour:flags.hour,showcasePost:flags.post?'1':'0'});invalidate();},[flags,gl,invalidate]);
 return null;
}
