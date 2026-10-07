import type * as THREE from 'three';

export interface RendererFacts {renderer?:string;memoryGb?:number;cores?:number;maxTextureSize:number;maxSamples:number}
export interface RenderQuality {tier:'constrained'|'balanced'|'high';dpr:number;grassBudget:number;aoSamples:number;aoResolution:number;msaaSamples:number;shadowSize:number;anisotropy:number}
/** Capability budgets are selected once per renderer and viewport class. Memory/CPU
 * hints are optional; missing hints never count as a low capability. Software GPUs
 * are constrained even in a large window. Saved geometry and quantities are untouched. */
export function chooseRenderQuality(f:RendererFacts,narrow:boolean):RenderQuality {
 const software=/swiftshader|llvmpipe|softpipe|software|basic render/i.test(f.renderer??'');
 const low=software||f.maxTextureSize<4096||(f.memoryGb!==undefined&&f.memoryGb<=2)||(f.cores!==undefined&&f.cores<=2);
 const medium=narrow||f.maxTextureSize<8192||(f.memoryGb!==undefined&&f.memoryGb<=4)||(f.cores!==undefined&&f.cores<=4);
 const tier=low?'constrained':medium?'balanced':'high';
 return {tier,dpr:low?1:medium?1.25:1.5,grassBudget:low?(narrow?5000:8000):medium?16000:28000,
  aoSamples:low?8:medium?12:16,aoResolution:low?.35:medium?.45:.5,
  msaaSamples:Math.max(0,Math.min(low?0:medium?2:4,f.maxSamples)),shadowSize:Math.min(low?1024:medium?2048:4096,f.maxTextureSize),anisotropy:low?4:medium?8:16};
}
const facts=new WeakMap<THREE.WebGLRenderer,RendererFacts>();
export function rendererFacts(gl:THREE.WebGLRenderer):RendererFacts {
 const cached=facts.get(gl);if(cached)return cached;
 let renderer:string|undefined;
 try{const ctx=gl.getContext(),ext=ctx.getExtension('WEBGL_debug_renderer_info');renderer=String(ctx.getParameter(ext?.UNMASKED_RENDERER_WEBGL??ctx.RENDERER));}catch{/* Browser privacy settings can hide the renderer. */}
 const hints=typeof navigator==='undefined'?undefined:navigator as Navigator&{deviceMemory?:number};
 const value={renderer,memoryGb:hints?.deviceMemory,cores:hints?.hardwareConcurrency,maxTextureSize:gl.capabilities.maxTextureSize,maxSamples:gl.capabilities.maxSamples};facts.set(gl,value);return value;
}
export const rendererQuality=(gl:THREE.WebGLRenderer,narrow=false)=>chooseRenderQuality(rendererFacts(gl),narrow);
