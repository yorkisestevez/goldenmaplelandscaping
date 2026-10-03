import {useEffect,useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import {rendererQuality} from './renderQuality';

export function useRenderQuality(){
 const gl=useThree(s=>s.gl),narrow=useThree(s=>s.size.width<600);
 return useMemo(()=>rendererQuality(gl,narrow),[gl,narrow]);
}
/** Nonvisual diagnostics stay on the canvas for local device QA. */
export default function RenderQuality(){
 const q=useRenderQuality(),gl=useThree(s=>s.gl),setDpr=useThree(s=>s.setDpr);
 useEffect(()=>{
  setDpr(Math.min(typeof window==='undefined'?1:window.devicePixelRatio||1,q.dpr));
  Object.assign(gl.domElement.dataset,{renderQuality:q.tier,grassBudget:String(q.grassBudget),maxDpr:String(q.dpr),aoSamples:String(q.aoSamples),aoResolution:String(q.aoResolution),shadowSize:String(q.shadowSize)});
 },[q,gl,setDpr]);
 return null;
}
