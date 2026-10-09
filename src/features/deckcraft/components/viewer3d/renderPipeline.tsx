import {useEffect,useLayoutEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {GTAOPass} from 'three/examples/jsm/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';
import {SCENE_LOOK,sceneQuality} from './sceneLook';
import {useRenderQuality} from './SceneRenderQuality';
import type {RenderQuality} from './renderQuality';
import {fitSun,shadowKey} from './shadowCache';
import {renderWindowReflections} from './windowReflections';
import {SHOWCASE_STILL_SAMPLES,bloomFor} from './showcaseGrade';
import {syncShowcaseShadows} from './pcssShadows';
import {activeGradeHour,bindDof,bindGrade,blit,createBlendMaterial,createDofMaterial,createGradeMaterial,ensureShowcaseSmaa,focusDistance,jitterCamera,onShowcasePostReady,showcasePostActive,showcaseSmaa} from './showcasePost';

/**
 * The live 3D view's renderer. The scene goes into a multisampled half-float image, ambient occlusion is worked out
 * from that image's own depth (the scene is drawn once), the evening adds bloom, then tone mapping and sRGB go onto
 * the canvas. Shadow maps are drawn only when something that casts, or a light, has changed, so orbiting never
 * redraws them, and the sun's shadow is fitted to what casts. Any failure falls back to a plain gl.render for good.
 */
const {ao:AO,bloom:BLOOM}=SCENE_LOOK;

/** One set of targets and passes at one size: the live view keeps one; a large proposal capture builds its own. */
export class Chain{
  readonly beauty:THREE.WebGLRenderTarget;readonly post:THREE.WebGLRenderTarget;readonly gtao:GTAOPass;readonly output=new OutputPass();
  private bloom:UnrealBloomPass|null=null;private w=0;private h=0;private budget:ReturnType<typeof sceneQuality>;
  private hold:THREE.WebGLRenderTarget|null=null;private accum:THREE.WebGLRenderTarget|null=null;private ping:THREE.WebGLRenderTarget|null=null;
  private dof=null as ReturnType<typeof createDofMaterial>|null;private grade=null as ReturnType<typeof createGradeMaterial>|null;private blend=null as ReturnType<typeof createBlendMaterial>|null;private quad:FullScreenQuad|null=null;
  constructor(gl:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,samples:number,quality:RenderQuality){
    this.budget=sceneQuality(quality,gl.capabilities);
    const ext=gl.extensions,type=ext.has('EXT_color_buffer_float')||ext.has('EXT_color_buffer_half_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
    this.beauty=new THREE.WebGLRenderTarget(1,1,{type,samples:Math.max(0,Math.min(samples,this.budget.msaaSamples)),depthTexture:new THREE.DepthTexture(1,1)});
    this.post=new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:false});
    this.gtao=new GTAOPass(scene,camera,1,1);
    // Normals are rebuilt from the scene's resolved depth, so glass, water and outlines (no depth write) add no shade.
    this.gtao.setGBuffer(this.beauty.depthTexture!);
    this.gtao.updateGtaoMaterial({...AO,samples:this.budget.aoSamples});this.gtao.updatePdMaterial({...AO.denoise,samples:this.budget.denoiseSamples,radius:this.budget.denoiseRadius});
    this.output.renderToScreen=true;
    // For tuning: ?deck-look=ao shows the ambient occlusion alone.
    if(typeof location!=='undefined'&&new URLSearchParams(location.search).get('deck-look')==='ao')this.gtao.output=GTAOPass.OUTPUT.Denoise;
  }
  setSize(w:number,h:number,scale:number){
    if(w===this.w&&h===this.h)return;
    this.w=w;this.h=h;this.beauty.setSize(w,h);this.post.setSize(w,h);this.hold?.setSize(w,h);this.accum?.setSize(w,h);this.ping?.setSize(w,h);
    this.bloom?.setSize(Math.ceil(w*this.budget.bloomResolution),Math.ceil(h*this.budget.bloomResolution));
    this.gtao.setSize(Math.max(1,Math.ceil(w*this.budget.aoResolution)),Math.max(1,Math.ceil(h*this.budget.aoResolution)));
    // The denoise radius is in shade pixels: a capture drawn larger blurs the same share of the picture.
    this.gtao.updatePdMaterial({radius:this.budget.denoiseRadius*scale});
  }
  /** Allocates the showcase passes. Call before a still so SMAA's lookups can finish decoding. */
  prepareShowcase(){if(!showcasePostActive())return Promise.resolve();this.ensureShowcase();return ensureShowcaseSmaa(Math.max(1,this.w),Math.max(1,this.h));}
  private buffer(){return new THREE.WebGLRenderTarget(Math.max(1,this.w),Math.max(1,this.h),{type:this.post.texture.type,depthBuffer:false});}
  private ensureShowcase(){if(this.hold)return;this.hold=this.buffer();this.dof=createDofMaterial();this.grade=createGradeMaterial();this.blend=createBlendMaterial();this.quad=new FullScreenQuad(this.dof);}
  private ensureAccum(){this.accum??=this.buffer();this.ping??=this.buffer();}
  private beautyPass(gl:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,evening:boolean){
    gl.setRenderTarget(this.beauty);gl.render(scene,camera);
    this.gtao.render(gl,this.post,this.beauty,0,false);
    if(evening){
      if(!this.bloom)this.bloom=new UnrealBloomPass(new THREE.Vector2(Math.ceil(this.w*this.budget.bloomResolution),Math.ceil(this.h*this.budget.bloomResolution)),BLOOM.strength,BLOOM.radius,BLOOM.threshold);
      const look=bloomFor(showcasePostActive());this.bloom.strength=look.strength;this.bloom.radius=look.radius;this.bloom.threshold=look.threshold;
      this.bloom.render(gl,this.post,this.post,0,false);
    }
  }
  render(gl:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,evening:boolean,samples=1,focus=0){
    this.gtao.scene=scene;this.gtao.camera=camera;this.gtao.blendIntensity=evening?AO.intensity.evening:AO.intensity.day;
    renderWindowReflections(gl,scene,camera);
    const post=showcasePostActive(),perspective=camera as THREE.PerspectiveCamera;
    const count=post&&samples>1&&perspective.isPerspectiveCamera?Math.min(4,samples):1;
    const distance=focus>0?focus:camera.position.length();
    if(post){this.ensureShowcase();void ensureShowcaseSmaa(Math.max(1,this.w),Math.max(1,this.h));}
    try{
      if(count===1)this.beautyPass(gl,scene,camera,evening);
      else{
        this.ensureAccum();
        for(let i=0;i<count;i++){
          jitterCamera(perspective,this.w,this.h,i);this.beautyPass(gl,scene,camera,evening);
          const write=i%2===0?this.accum!:this.ping!,previous=i===0?null:i%2===0?this.ping!:this.accum!;
          this.blend!.uniforms.tColor.value=this.post.texture;this.blend!.uniforms.tAcc.value=previous?.texture??null;this.blend!.uniforms.weight.value=1/count;this.blend!.uniforms.accumulate.value=previous?1:0;
          blit(gl,this.quad!,this.blend!,write);
        }
        perspective.clearViewOffset();gl.setRenderTarget(this.beauty);gl.render(scene,camera);
      }
    }finally{if(count>1)perspective.clearViewOffset();}
    if(post&&this.hold&&this.dof&&this.grade&&this.quad){
      const color=count===1?this.post:count%2===1?this.accum!:this.ping!;
      bindDof(this.dof,color.texture,this.beauty.depthTexture!,camera,distance,this.w,this.h);blit(gl,this.quad,this.dof,this.hold);
      const smaa=showcaseSmaa();let graded:THREE.WebGLRenderTarget;
      if(smaa){smaa.setSize(this.w,this.h);smaa.render(gl,this.post,this.hold,0,false);graded=this.post;}
      else graded=this.hold;
      bindGrade(this.grade,graded.texture,activeGradeHour(evening));blit(gl,this.quad,this.grade,graded===this.post?this.hold:this.post);
      this.output.render(gl,graded===this.post?this.hold:this.post,this.post,0,false);
    }else this.output.render(gl,this.post,this.post,0,false);
    gl.setRenderTarget(null);
  }
  dispose(){this.beauty.depthTexture?.dispose();this.beauty.dispose();this.post.dispose();this.hold?.dispose();this.accum?.dispose();this.ping?.dispose();this.dof?.dispose();this.grade?.dispose();this.blend?.dispose();this.gtao.dispose();this.bloom?.dispose();this.output.dispose();}
}

interface Pipeline{capture:(scale:number)=>void|Promise<void>}
const pipelines=new WeakMap<THREE.WebGLRenderer,Pipeline>(),renderers=new WeakMap<THREE.WebGLRenderer,()=>void>();
/** The pipeline drawing this renderer's view, for the proposal snapshot (SnapshotBridge). */
export function pipelineFor(gl:THREE.WebGLRenderer){return pipelines.get(gl);}
const shadowListeners=new WeakMap<THREE.WebGLRenderer,Set<()=>void>>();
/** Runs listen() whenever what casts shadows changes (groundOcclusion.ts redraws then), before the frame is drawn.
 * Returns the unsubscribe. */
export function onShadowChange(gl:THREE.WebGLRenderer,listen:()=>void){
  const set=shadowListeners.get(gl)??new Set();shadowListeners.set(gl,set);set.add(listen);
  return ()=>{set.delete(listen);};
}

/** three.js keeps one texture for the life of the page (the DFG lookup table its physically based materials share) and
 * DeckCraft reuses loaded models, materials and textures from one 3D view to the next. A renderer that has drawn any of
 * them stays reachable through its 'dispose' listener, so every closed 3D view kept its renderer, canvas and WebGL
 * context in memory. Disposing what this renderer drew as it goes lets it be collected; the next view uploads those
 * resources again from the data they keep. Render targets belong to their owners. Returns the release. */
export function releaseDrawnResources(gl:THREE.WebGLRenderer){
  const seen=new WeakSet<object>(),drawn:WeakRef<{dispose():void}>[]=[];
  const note=(resource:{dispose():void}|null|undefined)=>{if(resource&&!seen.has(resource)){seen.add(resource);drawn.push(new WeakRef(resource));}};
  const noteTexture=(texture:unknown)=>{if(texture instanceof THREE.Texture&&!texture.isRenderTargetTexture)note(texture);};
  const properties=gl.properties,get=properties.get,render=gl.render,draw=gl.renderBufferDirect;
  // Textures pass through properties.get when bound; geometry and material through each draw; the environment map
  // through three's prefiltering, so it is read off the scene.
  properties.get=(object:object)=>{noteTexture(object);return get.call(properties,object);};
  gl.render=function(this:THREE.WebGLRenderer,scene,camera){const s=scene as THREE.Scene;noteTexture(s.environment);noteTexture(s.background);return render.call(this,scene,camera);};
  gl.renderBufferDirect=function(this:THREE.WebGLRenderer,...args:Parameters<typeof draw>){note(args[2]);note(args[3]);return draw.apply(this,args);};
  return ()=>{properties.get=get;gl.render=render;gl.renderBufferDirect=draw;for(const ref of drawn)ref.deref()?.dispose();};
}

export default function RenderPipeline({evening}:{evening:boolean}){
  const gl=useThree(s=>s.gl),scene=useThree(s=>s.scene),camera=useThree(s=>s.camera),invalidate=useThree(s=>s.invalidate),quality=useRenderQuality(),controls=useThree(s=>s.controls);
  const ref=useRef({chain:null as Chain|null,broken:false,evening,key:NaN}),controlsRef=useRef(controls);controlsRef.current=controls;
  ref.current.evening=evening;
  useEffect(()=>{
    const state=ref.current,size=new THREE.Vector2(),budget=sceneQuality(quality,gl.capabilities),controls=()=>controlsRef.current;
    state.broken=false;
    const fail=(error:unknown)=>{
      console.warn('DeckCraft 3D: the photographic renderer failed, so the plain one takes over.',error);
      gl.domElement.dataset.photographicPipeline='fallback';state.broken=true;state.chain?.dispose();state.chain=null;gl.setRenderTarget(null);gl.shadowMap.autoUpdate=true;
    };
    const draw=(chain:Chain,scale:number)=>{
      scene.updateMatrixWorld();syncShowcaseShadows(gl,scene);const key=shadowKey(scene);
      // Listeners draw with the shadow maps still frozen (needsUpdate is set after them), so they never redraw those.
      if(key!==state.key){state.key=key;const sun=scene.getObjectByName('sun') as THREE.DirectionalLight|undefined;if(sun?.isDirectionalLight&&sun.shadow.mapSize.x!==budget.shadowSize){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(budget.shadowSize,budget.shadowSize);}fitSun(scene);for(const listen of shadowListeners.get(gl)??[])listen();gl.shadowMap.needsUpdate=true;}
      gl.getDrawingBufferSize(size);chain.setSize(size.x,size.y,scale);chain.render(gl,scene,camera,state.evening,scale>1&&showcasePostActive()?SHOWCASE_STILL_SAMPLES:1,focusDistance(camera,controls()));
    };
    const frame=()=>{
      if(!state.broken)try{state.chain??=new Chain(gl,scene,camera,quality.msaaSamples,quality);draw(state.chain,1);gl.domElement.dataset.photographicPipeline='active';return;}catch(error){fail(error);}
      gl.render(scene,camera);
    };
    gl.shadowMap.autoUpdate=false;state.key=NaN;
    pipelines.set(gl,{capture:scale=>{
      if(state.broken||scale<=1){frame();return;}
      // A print-size picture: its own targets, without multisampling from twice the size up (it is supersampled).
      let chain:Chain|null=null;
      try{chain=new Chain(gl,scene,camera,scale>=2?0:quality.msaaSamples,quality);draw(chain,scale);}
      catch(error){gl.setRenderTarget(null);gl.render(scene,camera);console.warn('DeckCraft 3D: capture drew without effects.',error);}
      finally{chain?.dispose();}
    }});
    const restored=()=>{state.chain?.dispose();state.chain=null;state.broken=false;state.key=NaN;gl.shadowMap.autoUpdate=false;invalidate();};
    gl.domElement.addEventListener('webglcontextrestored',restored);
    renderers.set(gl,frame);invalidate();
    return ()=>{gl.domElement.removeEventListener('webglcontextrestored',restored);delete gl.domElement.dataset.photographicPipeline;pipelines.delete(gl);renderers.delete(gl);state.chain?.dispose();state.chain=null;gl.shadowMap.autoUpdate=true;};
  },[gl,scene,camera,invalidate,quality]);
  // A layout effect starts watching before the first frame: stand-ins drawn only then (a board's flat normal map before
  // its swatch arrives) would otherwise be missed and keep this renderer alive.
  useLayoutEffect(()=>releaseDrawnResources(gl),[gl]);
  useEffect(()=>{invalidate();},[evening,invalidate]);
  useEffect(()=>onShowcasePostReady(()=>invalidate()),[invalidate]);
  // Priority 1 takes over drawing from R3F; with frameloop="demand" it still runs only when something invalidates.
  useFrame(()=>{(renderers.get(gl)??(()=>gl.render(scene,camera)))();},1);
  return null;
}
