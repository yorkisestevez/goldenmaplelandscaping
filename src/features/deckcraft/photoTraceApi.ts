/** Hook for a fly-through recorder (PR #151) to path-trace hero frames.
 * Full recorder integration can land later. This module imports no three.js.
 *
 * 1. Turn photo mode on (`?deck-photo=1`, or the presentation checkbox).
 * 2. For each posed frame, `await tracePhotoFrame({samples: photoSamplesPerFrame(), signal})`.
 * 3. A null result means the tracer is not mounted. Keep that frame on the raster path.
 *
 * `?deck-photo-samples=N` is the per-frame count the recorder should request.
 * The design, its colours, quantities and prices are not touched. */

export interface PhotoTraceRequest{samples:number;signal?:AbortSignal}
export interface PhotoTraceFrame{width:number;height:number;samples:number;rgba:Uint8Array;blob:Blob}
export type PhotoTraceHandler=(request:PhotoTraceRequest)=>Promise<PhotoTraceFrame>;

let handler:PhotoTraceHandler|null=null;
let urlSamples:number|null=null;
let urlRead=false;

export function registerPhotoTracer(next:PhotoTraceHandler|null){handler=next;}
export function photoTracerReady(){return handler!==null;}

/** Samples the recorder should spend on each frame. 0 stays on the raster path. */
export function photoSamplesPerFrame(){
 if(!urlRead&&typeof location!=='undefined'){
  urlRead=true;
  const raw=new URLSearchParams(location.search).get('deck-photo-samples');
  const n=raw===null?NaN:Number(raw);
  if(Number.isInteger(n)&&n>=1&&n<=4096)urlSamples=n;
 }
 return urlSamples??0;
}

/** Path-trace the current camera, or null when photo mode is off. */
export function tracePhotoFrame(request:PhotoTraceRequest):Promise<PhotoTraceFrame|null>{
 if(!handler||!Number.isInteger(request.samples)||request.samples<1)return Promise.resolve(null);
 return handler(request);
}
