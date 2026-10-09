import {useEffect,useRef,useState} from 'react';
import type {DeckData} from '../../types';
import {pathFromCameras,showcaseTour,type CameraKeyframe,type PathStyle} from './cameraPath';
import {planFlythrough,flythroughFilename,type FlythroughFps,type FlythroughFormat} from './flythroughBudget';
import {FLYTHROUGH_EXPORT,FLYTHROUGH_POSE,FLYTHROUGH_READ_POSE,FLYTHROUGH_STATUS,type CameraPose,type FlythroughFileSink,type FlythroughJob,type FlythroughStatus} from './flythroughJob';

const STYLES:PathStyle[]=['orbit','dolly','crane','fly'];
const STYLE_LABEL:Record<PathStyle,string>={orbit:'Orbit',dolly:'Dolly',crane:'Crane',fly:'Fly-through'};
let keyCount=0;
function keyframeFromPose(pose:CameraPose,index:number):CameraKeyframe{
 keyCount+=1;
 return {id:`key-${keyCount}`,name:`Keyframe ${index+1}`,positionIn:pose.positionIn,targetIn:pose.targetIn,fov:Math.min(80,Math.max(15,pose.fov)),style:'fly',moveSec:index===0?0:4,holdSec:1};
}
export default function FlythroughTools({data}:{data:DeckData}){
 const cameras=data.scenePresentation?.cameras??[];
 const [keyframes,setKeyframes]=useState<CameraKeyframe[]>([]);
 const [fps,setFps]=useState<FlythroughFps>(30);
 const [resolution,setResolution]=useState<'1080p'|'4k'>('1080p');
 const [format,setFormat]=useState<FlythroughFormat>('mp4');
 const [timeOfDay,setTimeOfDay]=useState(false);
 const [startSec,setStartSec]=useState('');
 const [endSec,setEndSec]=useState('');
 const [status,setStatus]=useState<FlythroughStatus|null>(null),cancelRef=useRef<AbortController|null>(null);
 const busy=status?.phase==='preparing'||status?.phase==='rendering'||status?.phase==='muxing';
 useEffect(()=>{
  const onStatus=(event:Event)=>{const detail=(event as CustomEvent<FlythroughStatus>).detail;if(detail)setStatus(detail);};
  window.addEventListener(FLYTHROUGH_STATUS,onStatus);
  return()=>window.removeEventListener(FLYTHROUGH_STATUS,onStatus);
 },[]);
 const update=(index:number,patch:Partial<CameraKeyframe>)=>setKeyframes(frames=>frames.map((frame,i)=>i===index?{...frame,...patch,moveSec:i===0?0:patch.moveSec??frame.moveSec}:frame));
 const add=()=>{
  const timer=window.setTimeout(()=>{window.removeEventListener(FLYTHROUGH_POSE,onPose);setStatus({phase:'error',frame:0,frames:0,message:'Open the 3D view, then add a keyframe from its camera.'});},1000);
  const onPose=(event:Event)=>{window.clearTimeout(timer);const pose=(event as CustomEvent<CameraPose>).detail;if(!pose)return;setKeyframes(frames=>frames.length>=24?frames:[...frames,keyframeFromPose(pose,frames.length)]);setStatus({phase:'done',frame:0,frames:0,message:'Keyframe added from the current camera.'});};
  window.addEventListener(FLYTHROUGH_POSE,onPose,{once:true});
  window.dispatchEvent(new Event(FLYTHROUGH_READ_POSE));
 };
 const exportTour=async()=>{
  const width=resolution==='4k'?3840:1920,height=resolution==='4k'?2160:1080;
  const start=startSec.trim()?Number(startSec):undefined,end=endSec.trim()?Number(endSec):undefined;
  let job:FlythroughJob;
  try{job={keyframes,fps,width,height,format,timeOfDay,startSec:start,endSec:end};planFlythrough(job);}catch(error){setStatus({phase:'error',frame:0,frames:0,message:error instanceof Error?error.message:'The fly-through could not be planned.'});return;}
  if(format==='png-zip'){
   const picker=(window as unknown as {showSaveFilePicker?:(options:unknown)=>Promise<FlythroughFileSink>}).showSaveFilePicker;
   if(picker){try{job.file=await picker({suggestedName:flythroughFilename({width,fps,format}),types:[{description:'PNG sequence',accept:{'application/zip':['.zip']}}]});}catch(error){if((error as {name?:string}).name==='AbortError')return;}}
  }
  const controller=new AbortController();
  cancelRef.current=controller;
  setStatus({phase:'preparing',frame:0,frames:0,message:'Starting the fly-through…'});
  window.dispatchEvent(new CustomEvent(FLYTHROUGH_EXPORT,{detail:{job,signal:controller.signal}}));
 };
 return <details className="py-2 text-xs">
  <summary>Fly-through</summary>
  <div className="flex flex-wrap gap-2 items-center py-2" aria-label="Fly-through recorder">
   <button type="button" onClick={add} disabled={busy||keyframes.length>=24}>Add keyframe</button>
   <button type="button" onClick={()=>{try{setKeyframes(pathFromCameras(cameras));setStatus({phase:'done',frame:0,frames:0,message:'Path built from the saved cameras. Adjust a move, or export.'});}catch(error){setStatus({phase:'error',frame:0,frames:0,message:error instanceof Error?error.message:'Save more cameras first.'});}}} disabled={busy}>Use saved cameras</button>
   <button type="button" onClick={()=>{try{const tour=showcaseTour(cameras);setKeyframes(tour);setStartSec('');setEndSec('');setStatus({phase:'done',frame:0,frames:0,message:'Showcase tour ready. It runs about half a minute to a minute.'});}catch(error){setStatus({phase:'error',frame:0,frames:0,message:error instanceof Error?error.message:'Save a camera first.'});}}} disabled={busy||!cameras.length}>Showcase tour</button>
   <label>Resolution <select aria-label="Fly-through resolution" value={resolution} disabled={busy} onChange={event=>setResolution(event.target.value as '1080p'|'4k')}><option value="1080p">1080p</option><option value="4k">4K</option></select></label>
   <label>Frame rate <select aria-label="Fly-through frame rate" value={fps} disabled={busy} onChange={event=>setFps(Number(event.target.value) as FlythroughFps)}><option value={24}>24 fps</option><option value={30}>30 fps</option><option value={60}>60 fps</option></select></label>
   <label>File <select aria-label="Fly-through file" value={format} disabled={busy} onChange={event=>setFormat(event.target.value as FlythroughFormat)}><option value="mp4">MP4</option><option value="png-zip">PNG sequence</option></select></label>
   <label className="inline-flex gap-1 items-center"><input type="checkbox" checked={timeOfDay} disabled={busy} onChange={event=>setTimeOfDay(event.target.checked)}/>Day through golden hour to night</label>
   <label>From <input aria-label="Export start seconds" className="w-16" inputMode="decimal" value={startSec} disabled={busy} placeholder="start" onChange={event=>setStartSec(event.target.value)}/></label>
   <label>To <input aria-label="Export end seconds" className="w-16" inputMode="decimal" value={endSec} disabled={busy} placeholder="end" onChange={event=>setEndSec(event.target.value)}/></label>
   <button type="button" onClick={()=>void exportTour()} disabled={busy||keyframes.length<2}>Export fly-through</button>
   {busy&&<button type="button" onClick={()=>cancelRef.current?.abort()}>Cancel</button>}
  </div>
  {!!keyframes.length&&<ol className="flex flex-col gap-1 pb-2" aria-label="Fly-through keyframes">
   {keyframes.map((frame,index)=><li key={frame.id} className="flex flex-wrap gap-2 items-center">
    <span>{index+1}. {frame.name}</span>
    {index>0&&<label>Move <select aria-label={`Move into ${frame.name}`} value={frame.style} disabled={busy} onChange={event=>update(index,{style:event.target.value as PathStyle})}>{STYLES.map(style=><option key={style} value={style}>{STYLE_LABEL[style]}</option>)}</select></label>}
    {index>0&&<label>Seconds <input aria-label={`Seconds to reach ${frame.name}`} className="w-16" type="number" min={0.2} max={40} step={0.1} disabled={busy} value={frame.moveSec} onChange={event=>update(index,{moveSec:Number(event.target.value)})}/></label>}
    <label>Hold <input aria-label={`Hold on ${frame.name}`} className="w-16" type="number" min={0} max={20} step={0.1} disabled={busy} value={frame.holdSec} onChange={event=>update(index,{holdSec:Number(event.target.value)})}/></label>
    <button type="button" disabled={busy||index===0} onClick={()=>setKeyframes(frames=>{const next=frames.slice();const [moved]=next.splice(index,1);next.splice(index-1,0,moved);return next.map((item,i)=>({...item,moveSec:i===0?0:item.moveSec||4}));})}>Earlier</button>
    <button type="button" disabled={busy||index===keyframes.length-1} onClick={()=>setKeyframes(frames=>{const next=frames.slice();const [moved]=next.splice(index,1);next.splice(index+1,0,moved);return next.map((item,i)=>({...item,moveSec:i===0?0:item.moveSec||4}));})}>Later</button>
    <button type="button" disabled={busy} onClick={()=>setKeyframes(frames=>frames.filter(item=>item.id!==frame.id).map((item,i)=>({...item,moveSec:i===0?0:item.moveSec||4})))}>Remove</button>
   </li>)}
  </ol>}
  <p>Exports render at a fixed frame rate in showcase quality, then the view returns to its previous quality. Saved cameras and keyframes are presentation only: colours, quantities and prices stay as they are.{status&&<> <span role="status">{status.message}</span></>}{busy&&status.frames>0&&<progress className="ml-2 align-middle" value={status.frame} max={status.frames}/>}</p>
 </details>;
}
