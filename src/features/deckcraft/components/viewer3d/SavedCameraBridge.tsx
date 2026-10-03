import {useEffect} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {DeckData} from '../../types';
import type {Update} from '../../designer/fields';
export default function SavedCameraBridge({data,update}:{data:DeckData;update?:Update}){
 const camera=useThree(s=>s.camera),controls=useThree(s=>s.controls);
 useEffect(()=>{if(!update)return;const save=(event:Event)=>{
  const {id,name}=(event as CustomEvent<{id:string;name:string}>).detail??{};
  if(!id||!name||!(camera instanceof THREE.PerspectiveCamera)||!controls||!('target'in controls)||(data.scenePresentation?.cameras?.length??0)>=12)return;
  const target=(controls as unknown as {target:THREE.Vector3}).target;
  update({scenePresentation:{...data.scenePresentation,activeCameraId:id,cameraPreset:undefined,cameras:[...(data.scenePresentation?.cameras??[]),{id,name,positionIn:camera.position.toArray().map(n=>n*12) as [number,number,number],targetIn:target.toArray().map(n=>n*12) as [number,number,number],fov:camera.fov}]}});
 };window.addEventListener('deckcraft:save-camera',save);return()=>window.removeEventListener('deckcraft:save-camera',save);},[camera,controls,data.scenePresentation,update]);
 return null;
}
