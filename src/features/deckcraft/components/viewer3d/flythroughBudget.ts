/** What a fly-through is allowed to allocate. Long 4K renders stay inside a frame
 * count and an encoded-byte cap so a tab cannot hold every raw frame. */
import {pathDuration,validateKeyframes,type CameraKeyframe} from './cameraPath';

export const FLYTHROUGH_LIMITS={
 maxKeyframes:24,minFrames:2,maxFrames:3600,maxDurationSec:90,
 showcaseMinSec:30,showcaseMaxSec:60,
 maxEncodedBytes:320*1024*1024,maxZipBytes:256*1024*1024,
} as const;
export type FlythroughFps=24|30|60;
export type FlythroughFormat='mp4'|'png-zip';
export interface FlythroughDevice{maxTextureSize:number;maxRenderbufferSize:number;memoryGb?:number}
export interface FlythroughRequest{
 keyframes:readonly CameraKeyframe[];
 fps:FlythroughFps;
 width:1920|3840;
 height:1080|2160;
 format:FlythroughFormat;
 timeOfDay:boolean;
 startSec?:number;
 endSec?:number;
}
export interface FlythroughPlan{
 fps:FlythroughFps;width:1920|3840;height:1080|2160;format:FlythroughFormat;timeOfDay:boolean;
 duration:number;start:number;end:number;frames:number;times:number[];
 /** 4K is already past the live view; extra multisampling is the usual out-of-memory cause. */
 msaa:boolean;bitrate:number;encodedBytes:number;zipBytes:number;
}
const clamp=(n:number,a:number,b:number)=>Math.min(b,Math.max(a,n));
export function flythroughBitrate(width:number,fps:FlythroughFps){
 const rates:Record<FlythroughFps,[number,number]>={24:[8_000_000,20_000_000],30:[10_000_000,28_000_000],60:[14_000_000,40_000_000]};
 return rates[fps][width>=3840?1:0];
}
export function flythroughFilename(plan:Pick<FlythroughPlan,'width'|'fps'|'format'>){
 return `deckcraft-flythrough-${plan.width>=3840?'4k':'1080p'}-${plan.fps}fps.${plan.format==='mp4'?'mp4':'zip'}`;
}
export function planFlythrough(request:FlythroughRequest):FlythroughPlan{
 validateKeyframes(request.keyframes);
 if(request.fps!==24&&request.fps!==30&&request.fps!==60)throw Error('Choose 24, 30 or 60 frames per second.');
 if(!((request.width===1920&&request.height===1080)||(request.width===3840&&request.height===2160)))throw Error('Choose 1080p or 4K (3840×2160).');
 if(request.format!=='mp4'&&request.format!=='png-zip')throw Error('Choose an MP4 or a PNG frame sequence.');
 const duration=pathDuration(request.keyframes);
 if(duration>FLYTHROUGH_LIMITS.maxDurationSec)throw Error('A fly-through can be at most 90 seconds. Shorten the moves or holds.');
 if(request.startSec!==undefined&&(!Number.isFinite(request.startSec)||request.startSec<0))throw Error('The export range needs a real start time.');
 if(request.endSec!==undefined&&(!Number.isFinite(request.endSec)||request.endSec<0))throw Error('The export range needs a real end time.');
 const start=clamp(request.startSec??0,0,duration),end=clamp(request.endSec??duration,0,duration);
 if(!(end>start))throw Error('The export range ends before it starts.');
 const span=end-start,frames=Math.round(span*request.fps);
 if(frames<FLYTHROUGH_LIMITS.minFrames)throw Error('The fly-through needs at least two frames. Lengthen the path or the export range.');
 if(frames>FLYTHROUGH_LIMITS.maxFrames)throw Error('That export is longer than 3,600 frames. Shorten the path, lower the frame rate, or export a range.');
 const bitrate=flythroughBitrate(request.width,request.fps);
 const encodedBytes=Math.ceil(bitrate/8*span*1.08);
 if(request.format==='mp4'&&encodedBytes>FLYTHROUGH_LIMITS.maxEncodedBytes)throw Error('That MP4 would be too large to encode in the browser. Shorten the path, or choose 24 or 30 fps.');
 const zipBytes=Math.ceil(request.width*request.height*.45)*frames;
 return {
  fps:request.fps,width:request.width,height:request.height,format:request.format,timeOfDay:request.timeOfDay,
  duration,start,end,frames,times:Array.from({length:frames},(_,i)=>Math.min(end,start+i/request.fps)),
  msaa:request.width<3840,bitrate,encodedBytes,zipBytes,
 };
}
export function assertDeviceCanRender(plan:FlythroughPlan,device:FlythroughDevice){
 if(!(device.maxTextureSize>=plan.width&&device.maxTextureSize>=plan.height&&device.maxRenderbufferSize>=plan.width&&device.maxRenderbufferSize>=plan.height)){
  throw Error(plan.width>=3840?'This computer cannot allocate a 4K frame. Export 1080p instead.':'This computer cannot allocate a 1080p frame.');
 }
 if(plan.width>=3840&&device.memoryGb!==undefined&&device.memoryGb<=4)throw Error('4K fly-throughs need more than 4 GB of memory. Export 1080p on this computer.');
 if(plan.width>=3840&&plan.fps===60&&device.memoryGb!==undefined&&device.memoryGb<8)throw Error('4K at 60 fps needs at least 8 GB of memory. Choose 24 or 30 fps, or export 1080p.');
}
export function assertZipMemory(plan:FlythroughPlan,streamingToDisk:boolean){
 if(plan.format!=='png-zip'||streamingToDisk)return;
 if(plan.zipBytes>FLYTHROUGH_LIMITS.maxZipBytes)throw Error('This PNG sequence is too large to keep in memory. Export an MP4, shorten the range, or save the ZIP straight to a file.');
}
