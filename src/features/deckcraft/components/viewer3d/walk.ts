/** Walk mode (S7): the rules a walker follows and the touch pad's held buttons, shared by the 3D controller and the pad. */

/** Eye height above whatever the walker stands on, in feet. */
export const WALK_EYE_FT=5.5;
/** The highest step the walker climbs (a stair riser is at most 7¾ in) and the deepest drop they step down. */
export const WALK_STEP_UP_FT=.75,WALK_STEP_DOWN_FT=2;
/** The walker keeps this far from walls, railings and the house. */
export const WALK_RADIUS_FT=1;
export const WALK_FT_S=4,RUN_FT_S=8,TURN_RAD_S=Math.PI/2,WALK_FOV=60;

/** The floor after a step: the next floor, or null when the step is blocked (a wall, a climb, a drop, or no ground).
 * `steps` is how many stair risers the step may climb: a look one radius ahead on a stair can be two treads up. */
export function stepFloor(current:number,next:number|null,wall:boolean,steps=1):number|null{
  if(wall||next===null)return null;
  if(next-current>WALK_STEP_UP_FT*steps||current-next>WALK_STEP_DOWN_FT)return null;
  return next;
}

export type WalkKey='forward'|'back'|'turnLeft'|'turnRight';
/** What the pad holds down; the controller reads it every frame and is woken when it changes. */
export const walkPad:Record<WalkKey,boolean>={forward:false,back:false,turnLeft:false,turnRight:false};
let wake=()=>{};
export function onWalkPad(listener:()=>void){wake=listener;return ()=>{wake=()=>{};for(const key of Object.keys(walkPad) as WalkKey[])walkPad[key]=false;};}
export function pressWalkPad(key:WalkKey,down:boolean){walkPad[key]=down;wake();}
