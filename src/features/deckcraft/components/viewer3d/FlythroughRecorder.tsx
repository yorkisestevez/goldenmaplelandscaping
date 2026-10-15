import {useEffect,useLayoutEffect,useRef,useSyncExternalStore} from 'react';
import {useThree} from '@react-three/fiber';
import {useProgress} from '@react-three/drei';
import * as THREE from 'three';
import {samplePath,type CameraSample} from './cameraPath';
import {assertDeviceCanRender,assertZipMemory,flythroughFilename,planFlythrough,FLYTHROUGH_LIMITS,type FlythroughPlan} from './flythroughBudget';
import {FLYTHROUGH_EXPORT,FLYTHROUGH_POSE,FLYTHROUGH_READ_POSE,FLYTHROUGH_STATUS,type CameraPose,type FlythroughJob,type FlythroughStatus} from './flythroughJob';
import {getFlythroughFlags,getForcedEvening,patchFlythrough,resetFlythrough,subscribeFlythrough} from './flythroughState';
import {useFlythroughRendering} from './sceneEvening';
import {getShowcaseFlags,setShowcaseFlags} from '../../showcaseMode';
import {muxAvcMp4,type Mp4Sample} from './mp4Mux';
import {pipelineFor} from './renderPipeline';
import {rendererFacts} from './renderQuality';
import {SCENE_LOOK} from './sceneLook';
import {skyStrength} from './skyModel';
import {StoredZip} from './storedZip';
import {sunDirectionAt,timeOfDayAt,type DayLook} from './timeOfDay';

const HIDDEN=new Set(['picked-wall-outline','selection-outline','picked-pergola-outline','landscape-mature-overlay']);
class FlythroughCancelled extends Error{constructor(){super('Fly-through cancelled.');this.name='FlythroughCancelled';}}
type Orbit={enabled:boolean;target:THREE.Vector3;update:()=>void};
interface SavedPose{position:THREE.Vector3;quaternion:THREE.Quaternion;fov:number;aspect:number;enabled:boolean;target:THREE.Vector3}
function orbitOf(controls:unknown):Orbit|null{
 if(!controls||typeof controls!=='object'||!('target' in controls)||!('update' in controls))return null;
 const orbit=controls as Orbit;
 return orbit.target?.isVector3&&typeof orbit.update==='function'?orbit:null;
}
function publish(detail:FlythroughStatus){window.dispatchEvent(new CustomEvent(FLYTHROUGH_STATUS,{detail}));}
function nextFrame(){return new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}
async function waitFor(ready:()=>boolean,signal:AbortSignal,message:string){
 const started=performance.now();
 while(!ready()){
  if(signal.aborted)throw new FlythroughCancelled();
  if(performance.now()-started>20000)throw Error(message);
  await nextFrame();
 }
}
function download(blob:Blob,filename:string){
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function applyLook(scene:THREE.Scene,gl:THREE.WebGLRenderer,look:DayLook|null,exposure:number){
 const dome=scene.getObjectByName('sky-dome') as THREE.Mesh|undefined,material=dome?.material as THREE.ShaderMaterial|undefined;
 if(material?.uniforms?.warmth)material.uniforms.warmth.value=look?.warmth??0;
 gl.toneMappingExposure=exposure*(look?.exposure??1);
 if(!look)return;
 const sun=scene.getObjectByName('sun') as THREE.DirectionalLight|undefined;
 if(!sun?.isDirectionalLight)return;
 const radius=typeof sun.userData.flyRadius==='number'?sun.userData.flyRadius:sun.position.length()||1;
 sun.userData.flyRadius=radius;
 const dir=sunDirectionAt(look.sunElevationDeg,SCENE_LOOK.sky.sunAzimuthDeg);
 sun.position.set(dir[0]*radius,dir[1]*radius,dir[2]*radius);
 sun.color.setRGB(look.sunColor[0],look.sunColor[1],look.sunColor[2]);
 sun.intensity=skyStrength('day').sun*look.sunGain;
 sun.castShadow=look.sunGain>.02;
 sun.updateMatrixWorld();
}
function placeCamera(camera:THREE.PerspectiveCamera,controls:Orbit|null,sample:CameraSample,aspect:number){
 const target=new THREE.Vector3(sample.target[0],sample.target[1],sample.target[2]);
 camera.fov=sample.fov;camera.aspect=aspect;camera.updateProjectionMatrix();
 camera.position.set(sample.position[0],sample.position[1],sample.position[2]);
 if(controls){controls.target.copy(target);controls.update();}
 // OrbitControls clamps the polar angle. Put the sampled pose back afterwards so frame i
 // is the path sample, not the live orbit limit.
 camera.position.set(sample.position[0],sample.position[1],sample.position[2]);
 camera.lookAt(target);camera.updateMatrixWorld();
}
function flipFrame(raw:Uint8Array,flipped:Uint8ClampedArray,width:number,height:number){
 const row=width*4;
 for(let y=0;y<height;y++)flipped.set(raw.subarray((height-1-y)*row,(height-y)*row),y*row);
}
async function chooseAvc(plan:FlythroughPlan){
 if(typeof VideoEncoder==='undefined')return null;
 const codecs=plan.width>=3840?(plan.fps>30?['avc1.640034','avc1.640033','avc1.640028']:['avc1.640033','avc1.640028','avc1.4D4028']):(plan.fps>30?['avc1.64002A','avc1.640028','avc1.4D401F','avc1.42E01F']:['avc1.640028','avc1.4D401F','avc1.42E01F']);
 for(const codec of codecs){
  const config={codec,width:plan.width,height:plan.height,bitrate:plan.bitrate,framerate:plan.fps,latencyMode:'quality' as const,hardwareAcceleration:'no-preference' as const,bitrateMode:'variable' as const,avc:{format:'avc' as const}};
  try{const supported=await VideoEncoder.isConfigSupported(config);if(supported.supported)return (supported.config??config) as VideoEncoderConfig;}catch{/* Try the next profile. */}
 }
 return null;
}
async function pngBytes(canvas:HTMLCanvasElement,context:CanvasRenderingContext2D,image:ImageData){
 context.putImageData(image,0,0);
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('The browser could not encode a PNG frame.')),'image/png'));
 return new Uint8Array(await blob.arrayBuffer());
}

/** Mount once inside the canvas. The panel dispatches deckcraft:export-flythrough.
 * Frames are stepped by index, not by how long the GPU took. */
export default function FlythroughRecorder({revision,designEvening}:{revision?:unknown;designEvening:boolean}){
 const currentRevision=useRef(revision);currentRevision.current=revision;
 const gl=useThree(s=>s.gl),scene=useThree(s=>s.scene),camera=useThree(s=>s.camera),controls=useThree(s=>s.controls),invalidate=useThree(s=>s.invalidate);
 const loading=useProgress(s=>s.active),busy=useRef(false),mounted=useRef(true),savedPose=useRef<SavedPose|null>(null);
 const flying=useFlythroughRendering(),forcedEvening=useSyncExternalStore(subscribeFlythrough,getForcedEvening,()=>null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useLayoutEffect(()=>{
  if(forcedEvening===null)delete gl.domElement.dataset.sceneEvening;
  else gl.domElement.dataset.sceneEvening=forcedEvening?'1':'0';
 },[forcedEvening,gl]);
 useLayoutEffect(()=>{
  if(flying||!savedPose.current)return;
  const pose=savedPose.current,perspective=camera as THREE.PerspectiveCamera,orbit=orbitOf(controls);
  savedPose.current=null;
  if(perspective.isPerspectiveCamera){perspective.position.copy(pose.position);perspective.quaternion.copy(pose.quaternion);perspective.fov=pose.fov;perspective.aspect=pose.aspect;perspective.updateProjectionMatrix();}
  if(orbit){orbit.target.copy(pose.target);orbit.enabled=pose.enabled;orbit.update();}
  invalidate();
 },[flying,camera,controls,invalidate]);
 useEffect(()=>{
  const read=()=>{
   const perspective=camera as THREE.PerspectiveCamera,orbit=orbitOf(controls);
   if(!perspective.isPerspectiveCamera||!orbit)return;
   const detail:CameraPose={positionIn:perspective.position.toArray().map(n=>n*12) as CameraPose['positionIn'],targetIn:orbit.target.toArray().map(n=>n*12) as CameraPose['targetIn'],fov:perspective.fov};
   window.dispatchEvent(new CustomEvent(FLYTHROUGH_POSE,{detail}));
  };
  window.addEventListener(FLYTHROUGH_READ_POSE,read);
  return()=>window.removeEventListener(FLYTHROUGH_READ_POSE,read);
 },[camera,controls]);
 useEffect(()=>{
  const run=async(event:Event)=>{
   const detail=(event as CustomEvent<{job?:FlythroughJob;signal?:AbortSignal}>).detail,job=detail?.job,signal=detail?.signal;
   if(!job||!signal)return;
   if(busy.current){publish({phase:'error',frame:0,frames:0,message:'A fly-through is already being exported.'});return;}
   if(loading){publish({phase:'error',frame:0,frames:0,message:'The scene assets are still loading. Try the export once they are ready.'});return;}
   const perspective=camera as THREE.PerspectiveCamera,orbit=orbitOf(controls);
   if(!perspective.isPerspectiveCamera||!orbit){publish({phase:'error',frame:0,frames:0,message:'Fly-through uses a perspective camera. Choose Corner, Overview or Front, then export.'});return;}
   let plan:FlythroughPlan;
   try{plan=planFlythrough(job);}catch(error){publish({phase:'error',frame:0,frames:0,message:error instanceof Error?error.message:'The fly-through could not be planned.'});return;}
   const requestedRevision=currentRevision.current,previousFlags={...getShowcaseFlags()},exposure=gl.toneMappingExposure;
   const logical=gl.getSize(new THREE.Vector2()),ratio=gl.getPixelRatio(),viewport=gl.getViewport(new THREE.Vector4()),scissor=gl.getScissor(new THREE.Vector4()),scissorTest=gl.getScissorTest(),target=gl.getRenderTarget();
   const hidden:THREE.Object3D[]=[];let sequence:ReturnType<NonNullable<ReturnType<typeof pipelineFor>>['openSequence']>|null=null,encoder:VideoEncoder|null=null,writable:{write(data:Uint8Array):Promise<void>;close():Promise<void>}|null=null,lost=false;
   const onLost=()=>{lost=true;};
   busy.current=true;savedPose.current={position:perspective.position.clone(),quaternion:perspective.quaternion.clone(),fov:perspective.fov,aspect:perspective.aspect,enabled:orbit.enabled,target:orbit.target.clone()};
   const filename=flythroughFilename(plan);
   try{
    gl.domElement.addEventListener('webglcontextlost',onLost);
    const generation=gl.domElement.dataset.pipelineGeneration??'0';
    patchFlythrough({rendering:true});setShowcaseFlags({quality:true});orbit.enabled=false;
    publish({phase:'preparing',frame:0,frames:plan.frames,message:'Preparing showcase quality…'});
    await waitFor(()=>gl.domElement.dataset.flythroughHold==='1'&&gl.domElement.dataset.showcaseQuality==='1'&&(previousFlags.quality||gl.domElement.dataset.pipelineGeneration!==generation),signal,'Showcase quality did not start. Open the 3D view and try again.');
    await nextFrame();
    const facts=rendererFacts(gl),renderbuffer=gl.getContext().getParameter(gl.getContext().MAX_RENDERBUFFER_SIZE) as number;
    assertDeviceCanRender(plan,{maxTextureSize:facts.maxTextureSize,maxRenderbufferSize:renderbuffer,memoryGb:facts.memoryGb});
    let format=plan.format,encoderConfig:VideoEncoderConfig|null=null;
    if(format==='mp4'){encoderConfig=await chooseAvc(plan);if(!encoderConfig){format='png-zip';plan={...plan,format};publish({phase:'preparing',frame:0,frames:plan.frames,message:'This browser cannot encode MP4. A PNG frame sequence will be saved instead.'});}}
    assertZipMemory(plan,format==='png-zip'&&!!job.file);
    if(job.timeOfDay){
     patchFlythrough({evening:true});
     await waitFor(()=>gl.domElement.dataset.sky==='evening'&&gl.domElement.dataset.sceneEvening==='1',signal,'The evening sky did not finish loading. Open Night once, then export again.');
     patchFlythrough({evening:false});
     await waitFor(()=>gl.domElement.dataset.sky==='day'&&gl.domElement.dataset.sceneEvening==='0',signal,'The day sky did not return. Try the export again.');
    }
    scene.traverse(object=>{if(object.visible&&HIDDEN.has(object.name)){hidden.push(object);object.visible=false;}});
    gl.setPixelRatio(1);gl.setSize(plan.width,plan.height,false);gl.setScissorTest(false);
    const drawn=gl.getDrawingBufferSize(new THREE.Vector2());
    if(drawn.x<plan.width||drawn.y<plan.height)throw Error(plan.width>=3840?'The browser could not allocate a 4K frame. Export 1080p, or close other tabs and try again.':'The browser could not allocate a 1080p frame.');
    const pipeline=pipelineFor(gl);if(!pipeline?.openSequence)throw Error('The photographic renderer is not ready. Try the export again.');
    sequence=pipeline.openSequence(plan.msaa);
    gl.domElement.dataset.flythrough='1';
    const raw=new Uint8Array(plan.width*plan.height*4),flipped=new Uint8ClampedArray(plan.width*plan.height*4);
    const pngCanvas=format==='png-zip'?document.createElement('canvas'):null,pngContext=pngCanvas?.getContext('2d',{willReadFrequently:true})??null;
    if(pngCanvas){pngCanvas.width=plan.width;pngCanvas.height=plan.height;}
    if(format==='png-zip'&&!pngContext)throw Error('The browser could not open a canvas for the PNG sequence.');
    const samples:Mp4Sample[]=[];let avcC:Uint8Array|null=null,encodedBytes=0,failed:unknown=null;
    if(format==='mp4'&&encoderConfig){
     encoder=new VideoEncoder({output(chunk,meta){if(meta.decoderConfig?.description)avcC=new Uint8Array(meta.decoderConfig.description as ArrayBuffer);const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);samples.push({data,key:chunk.type==='key'});encodedBytes+=data.byteLength;},error(error){failed=error;}});
     encoder.configure(encoderConfig);
    }
    writable=format==='png-zip'&&job.file?await job.file.createWritable():null;
    const zipParts:Uint8Array[]=[];
    const zip=format==='png-zip'?new StoredZip(chunk=>{zipParts.push(chunk);},writable?Number.POSITIVE_INFINITY:FLYTHROUGH_LIMITS.maxZipBytes):null;
    let eveningNow=getFlythroughFlags().evening;
    for(let index=0;index<plan.frames;index++){
     if(signal.aborted)throw new FlythroughCancelled();
     if(lost)throw Error('The graphics context was lost during the fly-through. Export a shorter range, or use 1080p.');
     if(currentRevision.current!==requestedRevision)throw Error('The design changed during the fly-through. Export the current revision again.');
     const time=plan.times[index],look=job.timeOfDay?timeOfDayAt(plan.duration?time/plan.duration:0):null;
     if(look&&look.evening!==(eveningNow??false)){
      eveningNow=look.evening;patchFlythrough({evening:look.evening});
      await waitFor(()=>gl.domElement.dataset.sceneEvening===(look.evening?'1':'0')&&gl.domElement.dataset.sky===(look.evening?'evening':'day'),signal,'The sky did not follow the time of day. Try the export again.');
     }
     gl.setPixelRatio(1);gl.setSize(plan.width,plan.height,false);
     applyLook(scene,gl,look,exposure);
     placeCamera(perspective,orbit,samplePath(job.keyframes,time),plan.width/plan.height);
     sequence.draw(look?look.evening:designEvening);
     const context=gl.getContext();context.bindFramebuffer(context.FRAMEBUFFER,null);
     context.readPixels(0,0,plan.width,plan.height,context.RGBA,context.UNSIGNED_BYTE,raw);
     flipFrame(raw,flipped,plan.width,plan.height);
     if(encoder){
      const timestamp=Math.round(index*1_000_000/plan.fps),next=Math.round((index+1)*1_000_000/plan.fps);
      const frame=new VideoFrame(flipped.slice(),{format:'RGBA',codedWidth:plan.width,codedHeight:plan.height,timestamp,duration:next-timestamp});
      encoder.encode(frame,{keyFrame:index%(plan.fps*2)===0});frame.close();
      if(failed)throw failed instanceof Error?failed:Error('The video encoder failed. Export a PNG sequence instead.');
      if(encodedBytes>FLYTHROUGH_LIMITS.maxEncodedBytes)throw Error('The MP4 outgrew the memory budget and was stopped. Shorten the path or lower the frame rate.');
      while(encoder.encodeQueueSize>4){if(signal.aborted)throw new FlythroughCancelled();await new Promise<void>(resolve=>{const done=()=>{if(encoder!.encodeQueueSize<=4){encoder!.ondequeue=null;resolve();}};encoder!.ondequeue=done;setTimeout(done,30);});}
     }else if(zip&&pngCanvas&&pngContext){
      const bytes=await pngBytes(pngCanvas,pngContext,new ImageData(flipped,plan.width,plan.height));
      zip.add(`frame-${String(index+1).padStart(5,'0')}.png`,bytes);
      if(writable){for(const part of zipParts)await writable.write(part);zipParts.length=0;}
     }
     publish({phase:'rendering',frame:index+1,frames:plan.frames,message:`Rendering frame ${index+1} of ${plan.frames}`});
     await nextFrame();
    }
    publish({phase:'muxing',frame:plan.frames,frames:plan.frames,message:format==='mp4'?'Encoding the MP4…':'Packing the PNG sequence…'});
    if(encoder){
     await encoder.flush();encoder.close();encoder=null;
     if(failed)throw failed instanceof Error?failed:Error('The video encoder failed. Export a PNG sequence instead.');
     if(!avcC)throw Error('The encoder did not describe the H.264 stream. Export a PNG sequence instead.');
     const file=muxAvcMp4(samples,{width:plan.width,height:plan.height,fps:plan.fps,avcC});
     samples.length=0;
     if(!mounted.current||signal.aborted)throw new FlythroughCancelled();
     download(new Blob([file],{type:'video/mp4'}),filename);
     publish({phase:'done',frame:plan.frames,frames:plan.frames,message:`Exported ${filename}.`,filename,bytes:file.byteLength});
    }else if(zip){
     zip.finish();
     if(writable){for(const part of zipParts)await writable.write(part);await writable.close();writable=null;publish({phase:'done',frame:plan.frames,frames:plan.frames,message:`Saved ${filename}.`,filename});}
     else{const blob=new Blob(zipParts,{type:'application/zip'});download(blob,filename);publish({phase:'done',frame:plan.frames,frames:plan.frames,message:`Exported ${filename}.`,filename,bytes:blob.size});}
    }
   }catch(error){
    const cancelled=error instanceof FlythroughCancelled||signal.aborted;
    if(mounted.current)publish({phase:cancelled?'cancelled':'error',frame:0,frames:plan.frames,message:cancelled?'Fly-through cancelled.':error instanceof Error?error.message:'The fly-through could not be exported.'});
   }finally{
    try{encoder?.close();}catch{/* The encoder may already be closed or still configuring. */}
    try{await writable?.close();}catch{/* A cancelled save can already be closed. */}
    sequence?.close();
    for(const object of hidden)object.visible=true;
    const sun=scene.getObjectByName('sun');if(sun)delete sun.userData.flyRadius;
    applyLook(scene,gl,null,exposure);
    gl.setPixelRatio(ratio);gl.setSize(logical.x,logical.y,false);gl.setViewport(viewport);gl.setScissor(scissor);gl.setScissorTest(scissorTest);gl.setRenderTarget(target);
    delete gl.domElement.dataset.flythrough;
    gl.domElement.removeEventListener('webglcontextlost',onLost);
    setShowcaseFlags(previousFlags);resetFlythrough();
    busy.current=false;invalidate();
   }
  };
  window.addEventListener(FLYTHROUGH_EXPORT,run);
  return()=>window.removeEventListener(FLYTHROUGH_EXPORT,run);
 },[camera,controls,designEvening,gl,invalidate,loading,scene]);
 return null;
}
