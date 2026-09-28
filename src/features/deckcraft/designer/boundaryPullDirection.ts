import type {PlanPoint} from '../lib/deckGeometry';
export type PullDirection='any'|'x'|'y'|'custom';
export function pullDirectionVector(direction:PullDirection,angleDeg:number):PlanPoint|null {
  if(direction==='any')return null;if(direction==='x')return {x:1,y:0};if(direction==='y')return {x:0,y:1};
  if(direction!=='custom'||!Number.isFinite(angleDeg)||Math.abs(angleDeg)>360)throw Error('Enter a pull angle from −360° to 360°.');
  const angle=angleDeg*Math.PI/180,x=Math.cos(angle),y=Math.sin(angle);return {x:Math.abs(x)<1e-14?0:x,y:Math.abs(y)<1e-14?0:y};
}
export function projectBoundaryPull(dx:number,dy:number,direction:PullDirection,angleDeg:number):PlanPoint {
  if(!Number.isFinite(dx)||!Number.isFinite(dy))throw Error('Pull movement must be finite.');const vector=pullDirectionVector(direction,angleDeg);if(!vector)return {x:dx,y:dy};const distance=dx*vector.x+dy*vector.y;return {x:distance*vector.x,y:distance*vector.y};
}
/** Arrow sign follows its screen direction; a permitted arrow moves one full increment along the chosen axis. */
export function keyboardBoundaryPull(key:string,step:number,direction:PullDirection,angleDeg:number):PlanPoint|null {
  const arrows:Record<string,PlanPoint>={ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1}},arrow=arrows[key];if(!arrow)return null;if(!Number.isFinite(step)||step<=0)throw Error('Use a positive keyboard increment.');
  const vector=pullDirectionVector(direction,angleDeg);if(!vector)return {x:arrow.x*step,y:arrow.y*step};const dot=arrow.x*vector.x+arrow.y*vector.y,sign=Math.abs(dot)<1e-14?0:Math.sign(dot);return {x:vector.x*step*sign,y:vector.y*step*sign};
}
