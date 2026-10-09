import * as THREE from 'three';
import {DenoiseMaterial,PhysicalCamera,WebGLPathTracer} from 'three-gpu-pathtracer';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';
import {registerPhotoTracer,type PhotoTraceFrame,type PhotoTraceRequest} from '../../photoTraceApi';
import {SCENE_LOOK} from './sceneLook';
import {SKY_DATA,skyStrength,skyYaw,visibleSkyHorizon,visibleSkyStrength,type Lighting} from './skyModel';
import {applyPhotoScene,buildPhotoBackground} from './photoMaterials';
import {PHOTO_FALLBACK,PHOTO_GRADE,SUN_ANGULAR_RADIUS_DEG,photoStillSize,photoSunColor,photoSunElevationDeg,photoSunIrradiance,sunDisc,type PhotoLook} from './photoGrade';
import {getPhotoSettings,setPhotoProgress,type PhotoPhase} from './photoMode';

/** Progressive stills on the live WebGL renderer.
 * three-gpu-pathtracer's WebGL path matches three 0.185 and this canvas. The WebGPU tracer and oidn-web
 * both need a WebGPU device this software GPU does not offer, so denoising is the tracer's own edge-aware pass.
 * The editor's Khronos Neutral grade is left on the renderer; AgX runs only in the photo blit. */

type Tracer=WebGLPathTracer&{isCompiling:boolean;stableNoise:boolean};
export interface PhotoBridge{getControls():{target?:THREE.Vector3}|null;invalidate():void}
export interface PhotoEngine{step():void;exportStill(longEdge:number):Promise<void>;dispose():void}

const GRADE_FRAGMENT=/* glsl */`
uniform sampler2D tMap;uniform float exposure;uniform vec3 balance;uniform float saturation;varying vec2 vUv;
void main(){
  vec3 color=texture2D(tMap,vUv).rgb*exposure*balance;
  float luma=dot(color,vec3(0.2126,0.7152,0.0722));
  color=mix(vec3(luma),color,saturation);
  // AgXToneMapping is defined by three's tone-mapping chunk while the renderer stays on Neutral.
  color=AgXToneMapping(color);
  gl_FragColor=vec4(color,1.0);
  #include <colorspace_fragment>
}`;

function canPathTrace(gl:THREE.WebGLRenderer){
 return gl.capabilities.isWebGL2&&(gl.extensions.has('EXT_color_buffer_float')||gl.extensions.has('EXT_color_buffer_half_float'));
}
function sunFor(look:PhotoLook){
 const irradiance=photoSunIrradiance(look,skyStrength('day').sun);
 if(irradiance<=0)return null;
 const elevation=photoSunElevationDeg(look,SKY_DATA.day.sunElevationDeg),el=elevation*Math.PI/180,az=SCENE_LOOK.sky.sunAzimuthDeg*Math.PI/180;
 const disc=sunDisc(irradiance,SUN_ANGULAR_RADIUS_DEG[look]);
 return {color:photoSunColor(look,SKY_DATA.day.sunColor as [number,number,number]),direction:[Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az)] as [number,number,number],diameterFt:disc.diameterFt,radiance:disc.radiance,distanceFt:disc.distanceFt};
}
function tintSky(texture:THREE.DataTexture,look:PhotoLook){
 if(look==='day')return;
 const image=texture.image as {width:number;height:number;data:Float32Array},w=image.width,h=image.height,data=image.data;
 for(let y=0;y<h;y++){
  const el=((y+.5)/h-.5)*Math.PI,up=Math.max(0,Math.sin(Math.max(el,0)));
  for(let x=0;x<w;x++){
   const i=(y*w+x)*4;
   if(look==='golden'){
    const warm=.15+.85*(1-up),dim=.55+.35*up;
    data[i]*=(1.05*(1-warm)+1.55*warm)*dim;data[i+1]*=(.98*(1-warm)+.72*warm)*dim;data[i+2]*=(.92*(1-warm)+.32*warm)*dim;
   }else{data[i]*=.72;data[i+1]*=.8;data[i+2]*=1.05;}
  }
 }
 texture.needsUpdate=true;
}
function focusDistance(camera:THREE.Camera,controls:{target?:THREE.Vector3}|null){
 const target=controls?.target;
 return Math.max(.5,target?camera.position.distanceTo(target):24);
}

export async function startPhotoEngine(input:{gl:THREE.WebGLRenderer;scene:THREE.Scene;camera:THREE.Camera;bridge:PhotoBridge;evening:boolean}):Promise<PhotoEngine>{
 const {gl,scene,camera,bridge}=input;
 const publish=(phase:PhotoPhase,samples:number,message:string)=>{
  gl.domElement.dataset.photoPhase=phase;gl.domElement.dataset.photoSamples=String(Math.floor(samples));gl.domElement.dataset.photoTarget=String(getPhotoSettings().target);
  setPhotoProgress({phase,samples:Math.floor(samples),message});
 };
 const fail=(message=PHOTO_FALLBACK):PhotoEngine=>{
  delete gl.domElement.dataset.photoTrace;publish('fallback',0,message);
  return {step(){},async exportStill(){window.dispatchEvent(new CustomEvent('deckcraft:export-photo-status',{detail:{busy:false,error:message}}));},dispose(){delete gl.domElement.dataset.photoPhase;}};
 };
 if(!canPathTrace(gl))return fail();
 publish('checking',0,'Checking whether this device can path trace…');
 const pixelRatio=gl.getPixelRatio();
 gl.setPixelRatio(1);
 gl.domElement.dataset.photoTrace='1';
 let disposed=false,busy=false,restoreScene:(()=>void)|null=null,background:THREE.DataTexture|null=null,tracer:Tracer|null=null;
 const saved={background:scene.background,backgroundIntensity:scene.backgroundIntensity,backgroundBlurriness:scene.backgroundBlurriness,backgroundRotation:scene.backgroundRotation.clone(),environmentIntensity:scene.environmentIntensity??1};
 const grade=new THREE.ShaderMaterial({uniforms:{tMap:{value:null},exposure:{value:1},balance:{value:new THREE.Vector3(1,1,1)},saturation:{value:1}},depthTest:false,depthWrite:false,toneMapped:true,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:GRADE_FRAGMENT});
 const denoise=new DenoiseMaterial({sigma:3,threshold:.08,kSigma:1});denoise.toneMapped=false;
 const denoised=new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,depthBuffer:false,colorSpace:THREE.LinearSRGBColorSpace});
 const quad=new FullScreenQuad(grade);
 const photo=new PhysicalCamera(35,.1,1,1000);photo.apertureBlades=0;
 let pose='',finished=false,shownDenoise=false,stall=0;
 function skyLighting():Lighting{return input.evening?'evening':'day';}
 function apply(look:PhotoLook){
  restoreScene?.();restoreScene=null;
  let dome:THREE.Mesh|undefined;scene.traverse(object=>{if(object.name==='sky-dome')dome=object as THREE.Mesh;});
  const material=dome?.material as THREE.ShaderMaterial|undefined,lighting=material?.uniforms?.lighting?.value as THREE.Texture|undefined,horizonBand=Number(material?.uniforms?.uHorizonBand?.value??0);
  const key=skyLighting(),horizon=(lighting?visibleSkyHorizon(lighting,0):null)??SKY_DATA[key].horizonColor as [number,number,number];
  background?.dispose();
  background=buildPhotoBackground(lighting??null,visibleSkyStrength(key),horizonBand,skyYaw(key),horizon);
  tintSky(background,look);
  scene.background=background;scene.backgroundIntensity=1;scene.backgroundBlurriness=0;scene.backgroundRotation.set(0,0,0);
  const scale=look==='golden'?.72:look==='night'?1.15:1;
  scene.environmentIntensity=saved.environmentIntensity*scale;
  restoreScene=applyPhotoScene(scene,look,sunFor(look));
 }
 function restoreAll(){
  restoreScene?.();restoreScene=null;background?.dispose();background=null;
  scene.background=saved.background;scene.backgroundIntensity=saved.backgroundIntensity;scene.backgroundBlurriness=saved.backgroundBlurriness;scene.backgroundRotation.copy(saved.backgroundRotation);scene.environmentIntensity=saved.environmentIntensity;
 }
 function syncCamera(force=false){
  const persp=camera as THREE.PerspectiveCamera,controls=bridge.getControls(),settings=getPhotoSettings();
  const next=[camera.position.x,camera.position.y,camera.position.z,camera.quaternion.x,camera.quaternion.y,camera.quaternion.z,camera.quaternion.w,persp.fov,persp.aspect,settings.fStop,controls?.target?.x,controls?.target?.y,controls?.target?.z].join('|');
  if(!force&&next===pose)return false;
  pose=next;finished=false;stall=0;
  photo.position.copy(camera.position);photo.quaternion.copy(camera.quaternion);photo.up.copy(camera.up);
  photo.fov=persp.isPerspectiveCamera?persp.fov:35;photo.aspect=persp.isPerspectiveCamera?persp.aspect:1;photo.near=persp.near||.25;photo.far=persp.far||2400;
  photo.fStop=settings.fStop;photo.focusDistance=focusDistance(camera,controls);photo.updateProjectionMatrix();photo.updateMatrixWorld();
  tracer?.setCamera(photo);return true;
 }
 function present(finalPass:boolean){
  if(!tracer)return;
  const size=gl.getDrawingBufferSize(new THREE.Vector2());
  let map:THREE.Texture=tracer.target.texture;
  if(finalPass&&getPhotoSettings().denoise){
   try{
    if(denoised.width!==size.x||denoised.height!==size.y)denoised.setSize(size.x,size.y);
    denoise.map=tracer.target.texture;denoise.sigma=Math.max(1.2,Math.min(7,16/Math.sqrt(Math.max(1,tracer.samples))));denoise.threshold=.08;denoise.kSigma=1;
    gl.setRenderTarget(denoised);gl.setScissorTest(false);gl.setViewport(0,0,size.x,size.y);quad.material=denoise;quad.render(gl);map=denoised.texture;
   }catch(error){console.warn('DeckCraft photo: denoising was skipped.',error);}
  }
  const g=PHOTO_GRADE[getPhotoSettings().look];
  grade.uniforms.tMap.value=map;grade.uniforms.exposure.value=g.exposure;(grade.uniforms.balance.value as THREE.Vector3).set(g.balance[0],g.balance[1],g.balance[2]);grade.uniforms.saturation.value=g.saturation;
  gl.setRenderTarget(null);gl.setScissorTest(false);gl.setViewport(0,0,size.x,size.y);quad.material=grade;quad.render(gl);
 }
 function readFrame():{width:number;height:number;rgba:Uint8Array}{
  const size=gl.getDrawingBufferSize(new THREE.Vector2()),raw=new Uint8Array(size.x*size.y*4),ctx=gl.getContext();
  ctx.readPixels(0,0,size.x,size.y,ctx.RGBA,ctx.UNSIGNED_BYTE,raw);
  const rgba=new Uint8Array(raw.length),row=size.x*4;
  for(let y=0;y<size.y;y++)rgba.set(raw.subarray((size.y-1-y)*row,(size.y-y)*row),y*row);
  return {width:size.x,height:size.y,rgba};
 }
 async function encode(frame:{width:number;height:number;rgba:Uint8Array}){
  const canvas=document.createElement('canvas');canvas.width=frame.width;canvas.height=frame.height;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('The photo could not be encoded.');
  const image=ctx.createImageData(frame.width,frame.height);image.data.set(frame.rgba);ctx.putImageData(image,0,0);
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('The photo could not be encoded.')),'image/png'));
 }
 async function pump(goal:number,signal?:AbortSignal){
  if(!tracer)return;
  let shown=-1;
  while(tracer.samples<goal){
   if(signal?.aborted)throw new DOMException('The photo frame was aborted.','AbortError');
   if(disposed)return;
   const started=performance.now();
   do{tracer.renderSample();}while(!tracer.isCompiling&&tracer.samples<goal&&performance.now()-started<12);
   const count=Math.floor(tracer.samples);
   if(count!==shown&&count>0){shown=count;present(false);}
   const compiling=tracer.isCompiling;
   publish(compiling?'building':'sampling',tracer.samples,compiling?'Compiling the path tracer…':`Path tracing · ${count} / ${goal} samples`);
   await new Promise(resolve=>requestAnimationFrame(()=>resolve(undefined)));
  }
 }
 function note(samples:number,done:boolean){
  const settings=getPhotoSettings(),count=Math.floor(samples);
  publish(done?'ready':'sampling',samples,done?`Path traced · ${count} sample${count===1?'':'s'}${settings.denoise?', denoised':''}`:`Path tracing · ${count} / ${settings.target} samples`);
 }
 try{
  publish('building',0,'Building the scene for path tracing…');
  await new Promise(resolve=>setTimeout(resolve,0));
  if(disposed)return {step(){},async exportStill(){},dispose(){gl.setPixelRatio(pixelRatio);delete gl.domElement.dataset.photoTrace;}};
  apply(getPhotoSettings().look);
  tracer=new WebGLPathTracer(gl) as Tracer;
  tracer.renderToCanvas=false;tracer.renderDelay=0;tracer.fadeDuration=0;tracer.minSamples=1;tracer.rasterizeScene=false;tracer.multipleImportanceSampling=true;
  tracer.bounces=5;tracer.transmissiveBounces=6;tracer.filterGlossyFactor=.4;tracer.tiles.set(2,2);tracer.renderScale=1;tracer.stableNoise=true;
  syncCamera(true);tracer.setScene(scene,photo);
 }catch(error){
  console.warn('DeckCraft photo: path tracing is unavailable.',error);tracer?.dispose();denoise.dispose();denoised.dispose();grade.dispose();restoreAll();gl.setPixelRatio(pixelRatio);delete gl.domElement.dataset.photoTrace;return fail();
 }
 const engine:PhotoEngine={
  step(){
   if(busy||disposed||!tracer)return;
   const settings=getPhotoSettings();
   try{
    const moved=syncCamera();
    if(!moved&&tracer.samples>=settings.target){if(!finished||shownDenoise!==settings.denoise){finished=true;shownDenoise=settings.denoise;present(true);note(tracer.samples,true);}return;}
    const started=performance.now();
    do{tracer.renderSample();}while(!tracer.isCompiling&&tracer.samples<settings.target&&performance.now()-started<12);
    if(tracer.isCompiling){publish('building',tracer.samples,'Compiling the path tracer…');stall=0;bridge.invalidate();return;}
    if(tracer.samples===0){if(++stall>90){engine.dispose();publish('fallback',0,PHOTO_FALLBACK);return;}bridge.invalidate();return;}
    stall=0;
    if(Number.isInteger(tracer.samples))present(tracer.samples>=settings.target);
    if(tracer.samples>=settings.target){finished=true;present(true);note(tracer.samples,true);return;}
    finished=false;note(tracer.samples,false);bridge.invalidate();
   }catch(error){console.warn('DeckCraft photo: path tracing stopped.',error);engine.dispose();publish('fallback',0,PHOTO_FALLBACK);}
  },
  async exportStill(longEdge:number){
   const status=(detail:Record<string,unknown>)=>window.dispatchEvent(new CustomEvent('deckcraft:export-photo-status',{detail}));
   if(longEdge!==2048&&longEdge!==4096){status({busy:false,error:'Choose a 2048 or 4096 pixel long-edge photo export.'});return;}
   if(!tracer||disposed){status({busy:false,error:PHOTO_FALLBACK});return;}
   busy=true;status({busy:true,width:longEdge});
   const logical=gl.getSize(new THREE.Vector2()),ratio=gl.getPixelRatio(),persp=camera as THREE.PerspectiveCamera,aspect=persp.isPerspectiveCamera?persp.aspect:null;
   try{
    const drawing=gl.getDrawingBufferSize(new THREE.Vector2()),dimensions=photoStillSize(longEdge,drawing,Math.min(gl.capabilities.maxTextureSize,gl.getContext().getParameter(gl.getContext().MAX_RENDERBUFFER_SIZE)));
    gl.setPixelRatio(1);gl.setSize(dimensions.width,dimensions.height,false);
    if(persp.isPerspectiveCamera){persp.aspect=dimensions.width/dimensions.height;persp.updateProjectionMatrix();}
    syncCamera(true);tracer.reset();
    const goal=getPhotoSettings().target;
    await pump(goal);if(disposed)return;
    present(true);const frame=readFrame(),blob=await encode(frame);
    const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`deckcraft-photo-${longEdge}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    status({busy:false,filename:link.download,width:dimensions.width,height:dimensions.height,bytes:blob.size});
   }catch(error){if(!disposed)status({busy:false,error:error instanceof Error?error.message:'The photo could not be exported.'});}
   finally{
    if(aspect!==null&&persp.isPerspectiveCamera){persp.aspect=aspect;persp.updateProjectionMatrix();}
    gl.setPixelRatio(ratio);gl.setSize(logical.x,logical.y,false);busy=false;finished=false;tracer?.reset();bridge.invalidate();
   }
  },
  dispose(){
   if(disposed)return;disposed=true;registerPhotoTracer(null);delete gl.domElement.dataset.photoTrace;delete gl.domElement.dataset.photoPhase;delete gl.domElement.dataset.photoSamples;delete gl.domElement.dataset.photoTarget;
   restoreAll();gl.setPixelRatio(pixelRatio);gl.setRenderTarget(null);tracer?.dispose();denoise.dispose();denoised.dispose();grade.dispose();bridge.invalidate();
  },
 };
 registerPhotoTracer(async(request:PhotoTraceRequest):Promise<PhotoTraceFrame>=>{
  if(!tracer||disposed)return Promise.reject(Error(PHOTO_FALLBACK));
  if(request.signal?.aborted)throw new DOMException('The photo frame was aborted.','AbortError');
  busy=true;
  try{
   syncCamera(true);tracer.reset();await pump(request.samples,request.signal);if(disposed)throw Error(PHOTO_FALLBACK);
   present(true);const frame=readFrame();return {...frame,samples:request.samples,blob:await encode(frame)};
  }finally{busy=false;finished=false;bridge.invalidate();}
 });
 publish('sampling',0,`Path tracing · 0 / ${getPhotoSettings().target} samples`);
 return engine;
}
