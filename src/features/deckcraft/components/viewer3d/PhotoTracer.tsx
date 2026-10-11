import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {useProgress} from '@react-three/drei';
import * as THREE from 'three';
import type {DeckData} from '../../types';
import {PHOTO_FALLBACK} from './photoGrade';
import {getPhotoServerSettings,getPhotoSettings,photoSampleHold,setPhotoProgress,subscribePhoto} from './photoMode';
import {getShowcaseFlags} from './showcaseMode';
import type {PhotoBridge,PhotoEngine} from './photoEngine';

/** Mounted inside the canvas. The path tracer is loaded only after photo mode is turned on. */
export default function PhotoTracer({evening,revision}:{evening:boolean;revision:DeckData}){
 const gl=useThree(s=>s.gl),scene=useThree(s=>s.scene),camera=useThree(s=>s.camera),controls=useThree(s=>s.controls),invalidate=useThree(s=>s.invalidate);
 const loading=useProgress(s=>s.active),settings=useSyncExternalStore(subscribePhoto,getPhotoSettings,getPhotoServerSettings),engine=useRef<PhotoEngine|null>(null);
 const bridge=useRef<PhotoBridge>({getControls:()=>null,invalidate:()=>{}});
 bridge.current.getControls=()=>controls as {target?:THREE.Vector3}|null;bridge.current.invalidate=invalidate;
 const env=useRef(''),[envId,setEnvId]=useState('');
 useFrame(()=>{const id=scene.environment?.uuid??'';if(id!==env.current){env.current=id;setEnvId(id);}});
 const hold=photoSampleHold(revision.scenePresentation?.activeCameraId);
 useEffect(()=>{
  if(!settings.enabled||loading||hold||!envId)return;
  let dead=false,eng:PhotoEngine|null=null;
  setPhotoProgress({phase:'checking',samples:0,message:'Checking whether this device can path trace…'});
  void (async()=>{
   // Showcase stills use the near meshes. A software GPU otherwise keeps the far cards, and the tracer would bake those.
   const deadline=performance.now()+45000;
   while(!dead&&getShowcaseFlags().quality&&performance.now()<deadline){
    let far=0,near=0;
    scene.traverse(object=>{if(object.name.endsWith('-lod2'))far++;else if(object.name.endsWith('-lod0'))near++;});
    if(near>0&&far===0)break;
    invalidate();
    await new Promise(resolve=>requestAnimationFrame(()=>resolve(undefined)));
   }
   if(dead)return;
   const {startPhotoEngine}=await import('./photoEngine');
   if(dead)return;
   eng=await startPhotoEngine({gl,scene,camera,bridge:bridge.current,evening});
   if(dead){eng.dispose();return;}
   engine.current=eng;invalidate();
  })().catch(error=>{console.warn('DeckCraft photo: the path tracer could not be loaded.',error);if(!dead)setPhotoProgress({phase:'fallback',samples:0,message:PHOTO_FALLBACK});});
  return ()=>{dead=true;eng?.dispose();if(engine.current===eng)engine.current=null;setPhotoProgress({phase:'off',samples:0,message:''});};
 },[settings.enabled,settings.look,loading,hold,evening,revision,envId,gl,scene,camera,invalidate]);
 useEffect(()=>{
  const onExport=(event:Event)=>{const width=(event as CustomEvent<{width?:number}>).detail?.width??0;void engine.current?.exportStill(width);};
  window.addEventListener('deckcraft:export-photo',onExport);return ()=>window.removeEventListener('deckcraft:export-photo',onExport);
 },[]);
 useFrame(()=>{engine.current?.step();},2);
 return null;
}
