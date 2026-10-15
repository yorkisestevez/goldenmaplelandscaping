/** Session-only. Null evening means the design's own day/night control.
 * A fly-through sets these while it renders and clears them before it returns. */
export interface FlythroughFlags{rendering:boolean;evening:boolean|null}
const listeners=new Set<()=>void>();
let flags:FlythroughFlags={rendering:false,evening:null};
function emit(){for(const listener of listeners)listener();}
export function subscribeFlythrough(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener);}
export function getFlythroughFlags(){return flags;}
export function isFlythroughRendering(){return flags.rendering;}
export function getForcedEvening(){return flags.evening;}
export function resolveSceneEvening(lighting:string|undefined,forced:boolean|null){return forced??lighting==='Evening';}
export function patchFlythrough(next:Partial<FlythroughFlags>){
 const rendering=next.rendering??flags.rendering,evening=next.evening===undefined?flags.evening:next.evening;
 if(rendering===flags.rendering&&evening===flags.evening)return;
 flags={rendering,evening};emit();
}
export function resetFlythrough(){patchFlythrough({rendering:false,evening:null});}
let armed=false;
const armListeners=new Set<()=>void>();
/** True once the Fly-through panel has been opened: the recorder and its encoders load from then on. */
export function isFlythroughArmed(){return armed;}
export function armFlythrough(){if(armed)return;armed=true;for(const listener of armListeners)listener();}
export function subscribeFlythroughArm(listener:()=>void){armListeners.add(listener);return()=>armListeners.delete(listener);}
