import type {CameraKeyframe,Vec3} from './cameraPath';
import type {FlythroughFormat,FlythroughFps} from './flythroughBudget';
export interface FlythroughFileSink{createWritable():Promise<{write(data:Uint8Array):Promise<void>;close():Promise<void>}>}
export interface FlythroughJob{
 keyframes:CameraKeyframe[];
 fps:FlythroughFps;
 width:1920|3840;
 height:1080|2160;
 format:FlythroughFormat;
 timeOfDay:boolean;
 startSec?:number;
 endSec?:number;
 file?:FlythroughFileSink;
}
export interface FlythroughStatus{
 phase:'preparing'|'rendering'|'muxing'|'done'|'cancelled'|'error';
 frame:number;frames:number;message:string;filename?:string;bytes?:number;
}
export interface CameraPose{positionIn:Vec3;targetIn:Vec3;fov:number}
export const FLYTHROUGH_EXPORT='deckcraft:export-flythrough';
export const FLYTHROUGH_STATUS='deckcraft:flythrough-status';
export const FLYTHROUGH_READ_POSE='deckcraft:read-camera';
export const FLYTHROUGH_POSE='deckcraft:camera-pose';
