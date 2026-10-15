import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {useProgress} from '@react-three/drei';
import * as THREE from 'three';
import type {DeckData} from '../../types';
import {PHOTO_FALLBACK} from '../../photoGrade';
import {rasterPhotoTriangles} from './photoMaterials';
import {getPhotoServerSettings,getPhotoSettings,photoSampleHold,setPhotoProgress,subscribePhoto} from '../../photoMode';
import {getShowcaseFlags,subscribeShowcase} from '../../showcaseMode';
import type {PhotoBridge,PhotoEngine} from './photoEngine';

/** Mounted inside the canvas. The path tracer is loaded only after photo mode is turned on. */
export default function PhotoTracer({evening,revision}:{evening:boolean;revision:DeckData}){
 const gl=useThree(s=>s.gl),scene=useThree(s=>s.scene),camera=useThree(s=>s.camera),controls=useThree(s=>s.controls),invalidate=useThree(s=>s.invalidate);
 const loading=useProgress(s=>s.active),settings=useSyncExternalStore(subscribePhoto,getPhotoSettings,getPhotoServerSettings),engine=useRef<PhotoEngine|null>(null);
 const bridge=useRef<PhotoBridge>({getControls:()=>null,invalidate:()=>{}});
 bridge.current.getControls=()=>controls as {target?:THREE.Vector3}|null;bridge.current.invalidate=invalidate;
 const env=useRef(''),[envId,setEnvId]=useState('');
 const showcase=useSyncExternalStore(subscribeShowcase,()=>getShowcaseFlags().quality,()=>false);
 useFrame(()=>{const id=scene.environment?.uuid??'';if(id!==env.current){env.current=id;setEnvId(id);}});
 const hold=photoSampleHold(revision.scenePresentation?.activeCameraId);
 useEffect(()=>{
  if(!settings.enabled||loading||hold||!envId)return;
  let dead=false,eng:PhotoEngine|null=null;
  setPhotoProgress({phase:'checking',samples:0,message:'Checking whether this device can path trace…'});
  void (async()=>{
   // A showcase still has to bake the near meshes. Starting while quality is still off, or while a far card is mounted, freezes that smaller scene into the tracer.
   const wantsNear=showcase||new URLSearchParams(location.search).get('deck-quality')==='showcase';
   if(wantsNear){
    gl.domElement.dataset.photoPhase='checking';
    const deadline=performance.now()+180000;
    let mark='',since=0;
    const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    while(!dead&&performance.now()<deadline){
     if(!getShowcaseFlags().quality){invalidate();await frame();continue;}
     let far=0,near=0;
     scene.traverse(object=>{if(object.name.endsWith('-lod2'))far++;else if(object.name.endsWith('-lod0'))near++;});
     const count=rasterPhotoTriangles(scene);
     const key=near>0&&far===0?`${count.objects}:${count.triangles}`:'';
     if(key&&key===mark&&performance.now()-since>=2000)break;
     if(key!==mark){mark=key;since=key?performance.now():0;}
     invalidate();
     await frame();
    }
    if(dead)return;
    let far=0,near=0;
    scene.traverse(object=>{if(object.name.endsWith('-lod2'))far++;else if(object.name.endsWith('-lod0'))near++;});
    if(!getShowcaseFlags().quality||near===0||far>0){
     gl.domElement.dataset.photoPhase='fallback';
     setPhotoProgress({phase:'fallback',samples:0,message:'The near plant meshes were not ready for this still.'});
     return;
    }
   }
   if(dead)return;
   const {startPhotoEngine}=await import('./photoEngine');
   if(dead)return;
   eng=await startPhotoEngine({gl,scene,camera,bridge:bridge.current,evening});
   if(dead){eng.dispose();return;}
   engine.current=eng;invalidate();
  })().catch(error=>{console.warn('DeckCraft photo: the path tracer could not be loaded.',error);if(!dead)setPhotoProgress({phase:'fallback',samples:0,message:PHOTO_FALLBACK});});
  return ()=>{dead=true;eng?.dispose();if(engine.current===eng)engine.current=null;setPhotoProgress({phase:'off',samples:0,message:''});};
 },[settings.enabled,settings.look,loading,hold,evening,revision,envId,showcase,gl,scene,camera,invalidate]);
 useEffect(()=>{
  const onExport=(event:Event)=>{const width=(event as CustomEvent<{width?:number}>).detail?.width??0;void engine.current?.exportStill(width);};
  window.addEventListener('deckcraft:export-photo',onExport);return ()=>window.removeEventListener('deckcraft:export-photo',onExport);
 },[]);
 useFrame(()=>{engine.current?.step();},2);
 return null;
}
