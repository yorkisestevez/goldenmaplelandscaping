import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {GTAOPass} from 'three/examples/jsm/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {SCENE_LOOK} from './sceneLook';
import {fitSun,shadowKey} from './shadowCache';

/**
 * The live 3D view's renderer. The scene goes into a multisampled half-float image, ambient occlusion is worked out
 * from that image's own depth (the scene is drawn once), the evening adds bloom, then tone mapping and sRGB go onto
 * the canvas. Shadow maps are drawn only when something that casts, or a light, has changed, so orbiting never
 * redraws them, and the sun's shadow is fitted to what casts. Any failure falls back to a plain gl.render for good.
 */
const {ao:AO,bloom:BLOOM,msaaSamples}=SCENE_LOOK;

/** One set of targets and passes at one size: the live view keeps one; a large proposal capture builds its own. */
class Chain{
  readonly beauty:THREE.WebGLRenderTarget;readonly post:THREE.WebGLRenderTarget;readonly gtao:GTAOPass;readonly output=new OutputPass();
  private bloom:UnrealBloomPass|null=null;private w=0;private h=0;
  constructor(gl:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,samples:number){
    const ext=gl.extensions,type=ext.has('EXT_color_buffer_float')||ext.has('EXT_color_buffer_half_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
    this.beauty=new THREE.WebGLRenderTarget(1,1,{type,samples:Math.min(samples,gl.capabilities.maxSamples),depthTexture:new THREE.DepthTexture(1,1)});
    this.post=new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:false});
    this.gtao=new GTAOPass(scene,camera,1,1);
    // Normals are rebuilt from the scene's resolved depth, so glass, water and outlines (no depth write) add no shade.
    this.gtao.setGBuffer(this.beauty.depthTexture!);
    this.gtao.updateGtaoMaterial(AO);this.gtao.updatePdMaterial(AO.denoise);
    this.output.renderToScreen=true;
    // For tuning: ?deck-look=ao shows the ambient occlusion alone.
    if(typeof location!=='undefined'&&new URLSearchParams(location.search).get('deck-look')==='ao')this.gtao.output=GTAOPass.OUTPUT.Denoise;
  }
  setSize(w:number,h:number,scale:number){
    if(w===this.w&&h===this.h)return;
    this.w=w;this.h=h;this.beauty.setSize(w,h);this.post.setSize(w,h);this.bloom?.setSize(w,h);
    this.gtao.setSize(Math.max(1,Math.ceil(w*AO.resolution)),Math.max(1,Math.ceil(h*AO.resolution)));
    // The denoise radius is in shade pixels: a capture drawn larger blurs the same share of the picture.
    this.gtao.updatePdMaterial({radius:AO.denoise.radius*scale});
  }
  render(gl:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,evening:boolean){
    this.gtao.scene=scene;this.gtao.camera=camera;this.gtao.blendIntensity=evening?AO.intensity.evening:AO.intensity.day;
    gl.setRenderTarget(this.beauty);gl.render(scene,camera);
    this.gtao.render(gl,this.post,this.beauty,0,false);
    if(evening){
      if(!this.bloom)this.bloom=new UnrealBloomPass(new THREE.Vector2(this.w,this.h),BLOOM.strength,BLOOM.radius,BLOOM.threshold);
      this.bloom.render(gl,this.post,this.post,0,false);
    }
    this.output.render(gl,this.post,this.post,0,false);
    gl.setRenderTarget(null);
  }
  dispose(){this.beauty.depthTexture?.dispose();this.beauty.dispose();this.post.dispose();this.gtao.dispose();this.bloom?.dispose();this.output.dispose();}
}

interface Pipeline{capture:(scale:number)=>void}
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

export default function RenderPipeline({evening}:{evening:boolean}){
  const gl=useThree(s=>s.gl),scene=useThree(s=>s.scene),camera=useThree(s=>s.camera),invalidate=useThree(s=>s.invalidate);
  const ref=useRef({chain:null as Chain|null,broken:false,evening,key:NaN});
  ref.current.evening=evening;
  useEffect(()=>{
    const state=ref.current,size=new THREE.Vector2();
    const fail=(error:unknown)=>{
      console.warn('DeckCraft 3D: the photographic renderer failed, so the plain one takes over.',error);
      state.broken=true;state.chain?.dispose();state.chain=null;gl.setRenderTarget(null);gl.shadowMap.autoUpdate=true;
    };
    const draw=(chain:Chain,scale:number)=>{
      scene.updateMatrixWorld();const key=shadowKey(scene);
      // Listeners draw with the shadow maps still frozen (needsUpdate is set after them), so they never redraw those.
      if(key!==state.key){state.key=key;fitSun(scene);for(const listen of shadowListeners.get(gl)??[])listen();gl.shadowMap.needsUpdate=true;}
      gl.getDrawingBufferSize(size);chain.setSize(size.x,size.y,scale);chain.render(gl,scene,camera,state.evening);
    };
    const frame=()=>{
      if(!state.broken)try{state.chain??=new Chain(gl,scene,camera,msaaSamples);draw(state.chain,1);return;}catch(error){fail(error);}
      gl.render(scene,camera);
    };
    gl.shadowMap.autoUpdate=false;state.key=NaN;
    pipelines.set(gl,{capture:scale=>{
      if(state.broken||scale<=1){frame();return;}
      // A print-size picture: its own targets, without multisampling from twice the size up (it is supersampled).
      let chain:Chain|null=null;
      try{chain=new Chain(gl,scene,camera,scale>=2?0:msaaSamples);draw(chain,scale);}
      catch(error){gl.setRenderTarget(null);gl.render(scene,camera);console.warn('DeckCraft 3D: capture drew without effects.',error);}
      finally{chain?.dispose();}
    }});
    renderers.set(gl,frame);invalidate();
    return ()=>{pipelines.delete(gl);renderers.delete(gl);state.chain?.dispose();state.chain=null;gl.shadowMap.autoUpdate=true;};
  },[gl,scene,camera,invalidate]);
  useEffect(()=>{invalidate();},[evening,invalidate]);
  // Priority 1 takes over drawing from R3F; with frameloop="demand" it still runs only when something invalidates.
  useFrame(()=>{(renderers.get(gl)??(()=>gl.render(scene,camera)))();},1);
  return null;
}
