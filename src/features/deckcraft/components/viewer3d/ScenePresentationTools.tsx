import {useState} from 'react';
import type {DeckData} from '../../types';
import type {Update} from '../../designer/fields';
export default function ScenePresentationTools({data,update}:{data:DeckData;update:Update}){
 const p=data.scenePresentation??{},[message,setMessage]=useState('');
 const change=(patch:Partial<NonNullable<DeckData['scenePresentation']>>)=>update({scenePresentation:{...p,...patch}});
 return <div className="flex flex-wrap gap-2 items-center py-2 text-xs" aria-label="Landscape presentation controls">
  <label>Surfaces <select aria-label="Surface presentation" value={p.viewMode??'finished'} onChange={e=>change({viewMode:e.target.value as 'finished'|'inspection'})}><option value="finished">Finished</option><option value="inspection">Construction inspection</option></select></label>
  <label>Landscape camera <select aria-label="Landscape camera" value={p.activeCameraId??p.cameraPreset??''} onChange={e=>{const v=e.target.value;change(p.cameras?.some(c=>c.id===v)?{activeCameraId:v,cameraPreset:undefined}:{activeCameraId:undefined,cameraPreset:v?v as 'terrace'|'pool'|'wall':undefined});}}><option value="">Current camera</option><option value="terrace">Whole terrace</option><option value="pool">Pool &amp; coping</option><option value="wall">Retaining-wall face</option>{p.cameras?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
  <button type="button" onClick={()=>{const id=`camera-${Date.now()}`;window.dispatchEvent(new CustomEvent('deckcraft:save-camera',{detail:{id,name:`View ${(p.cameras?.length??0)+1}`}}));setMessage('Current camera saved with the project.');}} disabled={(p.cameras?.length??0)>=12}>Save current camera</button>
  {p.activeCameraId&&<button type="button" onClick={()=>change({activeCameraId:undefined,cameras:p.cameras?.filter(c=>c.id!==p.activeCameraId)})}>Remove saved camera</button>}
  {message&&<span role="status">{message}</span>}
 </div>;
}
