import type {SketchPoint} from './sketchTypes';

/** Keep a segment square, and align nearby coordinates with existing corners. */
export function constrainSketchCorner(anchor:SketchPoint,target:SketchPoint,square:boolean,previous:SketchPoint[],tolerance:number):SketchPoint{
  if(!square)return {...target};
  const horizontal=Math.abs(target.x-anchor.x)>=Math.abs(target.y-anchor.y),axis=horizontal?'x':'y';
  const candidates=previous.map(p=>p[axis]).filter(n=>Math.abs(n-target[axis])<=tolerance);
  const aligned=candidates.sort((a,b)=>Math.abs(a-target[axis])-Math.abs(b-target[axis]))[0]??target[axis];
  return horizontal?{x:aligned,y:anchor.y}:{x:anchor.x,y:aligned};
}

/** Close a square outline with one final square corner when needed. */
export function closeSketchLines(points:SketchPoint[],square:boolean):SketchPoint[]{
  const result=points.map(p=>({...p}));
  if(!square||result.length<3)return result;
  const first=result[0],last=result.at(-1)!,before=result.at(-2)!;
  if(first.x===last.x||first.y===last.y)return result;
  result.push(last.y===before.y?{x:last.x,y:first.y}:{x:first.x,y:last.y});
  return result;
}
