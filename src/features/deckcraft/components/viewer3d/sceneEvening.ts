import {useSyncExternalStore} from 'react';
import {getForcedEvening,isFlythroughRendering,resolveSceneEvening,subscribeFlythrough} from './flythroughState';
/** The design's day/night control, unless a fly-through is forcing a frame's lighting. */
export function useSceneEvening(lighting?:string){
 const forced=useSyncExternalStore(subscribeFlythrough,getForcedEvening,()=>null);
 return resolveSceneEvening(lighting,forced);
}
export function useFlythroughRendering(){
 return useSyncExternalStore(subscribeFlythrough,isFlythroughRendering,()=>false);
}
