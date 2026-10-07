import {useEffect,useRef} from 'react';
import {useThree} from '@react-three/fiber';
import {useProgress} from '@react-three/drei';
import * as THREE from 'three';
import {pipelineFor} from './renderPipeline';
export type SceneStillWidth=2048|4096;
export function stillSize(longEdge:SceneStillWidth,size:{x:number;y:number},maximum:number){
 if(longEdge!==2048&&longEdge!==4096||!Number.isFinite(size.x)||!Number.isFinite(size.y)||size.x<=0||size.y<=0)throw Error('Choose a 2048 or 4096 pixel long-edge scene export.');
 const width=size.x>=size.y?longEdge:Math.max(1,Math.round(longEdge*size.x/size.y)),height=size.x>=size.y?Math.max(1,Math.round(longEdge*size.y/size.x)):longEdge;
 if(width>maximum||height>maximum||width*height>16777216)throw Error('This scene export exceeds the renderer’s supported image size.');return {width,height};
}
/** A still uses the live scene and post pipeline. Every renderer/camera change
 * is temporary, including when readback or PNG encoding fails. */
export async function captureSceneStill(gl:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,width:SceneStillWidth):Promise<Blob>{
 const logical=gl.getSize(new THREE.Vector2()),drawing=gl.getDrawingBufferSize(new THREE.Vector2()),ratio=gl.getPixelRatio(),viewport=gl.getViewport(new THREE.Vector4()),scissor=gl.getScissor(new THREE.Vector4()),scissorTest=gl.getScissorTest(),target=gl.getRenderTarget(),clear=gl.getClearColor(new THREE.Color()).clone(),alpha=gl.getClearAlpha(),auto=gl.autoClear,tone=gl.toneMapping,exposure=gl.toneMappingExposure,shadowAuto=gl.shadowMap.autoUpdate;
 const dimensions=stillSize(width,drawing,Math.min(gl.capabilities.maxTextureSize,gl.getContext().getParameter(gl.getContext().MAX_RENDERBUFFER_SIZE))),hidden:THREE.Object3D[]=[];
 const perspective=camera as THREE.PerspectiveCamera,aspect=perspective.isPerspectiveCamera?perspective.aspect:null,scale=dimensions.width/drawing.x;
 scene.traverse(o=>{if(o.visible&&['picked-wall-outline','selection-outline','picked-pergola-outline','landscape-mature-overlay'].includes(o.name)){hidden.push(o);o.visible=false;}});
 try{
  gl.setPixelRatio(1);gl.setSize(dimensions.width,dimensions.height,false);gl.setScissorTest(false);gl.setRenderTarget(null);
  if(aspect!==null){perspective.aspect=dimensions.width/dimensions.height;perspective.updateProjectionMatrix();}
  const pipeline=pipelineFor(gl);if(pipeline)pipeline.capture(Math.max(1,scale));else gl.render(scene,camera);
  const blob=await new Promise<Blob>((resolve,reject)=>gl.domElement.toBlob(value=>value?resolve(value):reject(Error('The browser could not encode the scene PNG.')),'image/png'));
  return blob;
 }finally{
  for(const o of hidden)o.visible=true;if(aspect!==null){perspective.aspect=aspect;perspective.updateProjectionMatrix();}
  gl.setPixelRatio(ratio);gl.setSize(logical.x,logical.y,false);gl.setClearColor(clear,alpha);gl.autoClear=auto;gl.toneMapping=tone;gl.toneMappingExposure=exposure;gl.shadowMap.autoUpdate=shadowAuto;
  try{const pipeline=pipelineFor(gl);if(pipeline)pipeline.capture(1);else gl.render(scene,camera);}finally{gl.setRenderTarget(target);gl.setViewport(viewport);gl.setScissor(scissor);gl.setScissorTest(scissorTest);}
 }
}
/** Mount once inside the R3F Canvas. UI dispatches deckcraft:export-still with
 * {width:2048|4096}; width is the requested LONG EDGE for portrait and landscape
 * views. Status is returned through deckcraft:export-still-status. */
export default function SceneStillExport({revision}:{revision?:unknown}){
 const currentRevision=useRef(revision);currentRevision.current=revision;
 const gl=useThree(s=>s.gl),scene=useThree(s=>s.scene),camera=useThree(s=>s.camera),invalidate=useThree(s=>s.invalidate),loading=useProgress(s=>s.active),busy=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  const status=(detail:Record<string,unknown>)=>window.dispatchEvent(new CustomEvent('deckcraft:export-still-status',{detail}));
  const exportStill=async(event:Event)=>{
   const width=(event as CustomEvent<{width?:SceneStillWidth}>).detail?.width;
   if(busy.current){status({busy:true,error:'A scene image is already being exported.'});return;}
   if(loading){status({busy:false,error:'The scene assets are still loading. Try the export once they are ready.'});return;}
   if(width!==2048&&width!==4096){status({busy:false,error:'Choose a 2048 or 4096 pixel long-edge scene export.'});return;}
   const requestedRevision=currentRevision.current;busy.current=true;status({busy:true,width});
   try{const drawing=gl.getDrawingBufferSize(new THREE.Vector2()),dimensions=stillSize(width,drawing,gl.capabilities.maxTextureSize),blob=await captureSceneStill(gl,scene,camera,width);if(!mounted.current)return;if(currentRevision.current!==requestedRevision)throw Error('The design changed during image capture. Export the current revision again.');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`deckcraft-scene-${width}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status({busy:false,width,longEdge:width,pixelWidth:dimensions.width,pixelHeight:dimensions.height,bytes:blob.size,filename:link.download});}
   catch(error){if(mounted.current)status({busy:false,error:error instanceof Error?error.message:'The scene image could not be exported.'});}
   finally{busy.current=false;invalidate();}
  };
  window.addEventListener('deckcraft:export-still',exportStill);return()=>window.removeEventListener('deckcraft:export-still',exportStill);
 },[gl,scene,camera,invalidate,loading]);
 return null;
}
