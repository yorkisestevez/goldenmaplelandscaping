import type {OutlinePoint} from '../types';
import {constrainSketchCorner,closeSketchLines} from './sketchLineDrawing';
import {sketchArea,sketchBounds,sketchOutlineProblem} from './sketchGeometry';

export const INLAY_SKETCH_LIMITS={points:64,coordinateIn:240,spanIn:240} as const;
export function inlaySketchCorner(points:OutlinePoint[],target:OutlinePoint,square:boolean,tolerance=2):OutlinePoint{
 return points.length?constrainSketchCorner(points.at(-1)!,target,square,points,tolerance):{...target};
}
export function finishInlaySketch(points:OutlinePoint[],square:boolean){return closeSketchLines(points,square);}
export function inlaySketchProblem(points:OutlinePoint[]):string{
 if(points.length>INLAY_SKETCH_LIMITS.points)return 'Use at most 64 corners.';
 if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return 'Every corner needs finite coordinates.';
 const problem=sketchOutlineProblem(points);if(problem)return problem;
 const b=sketchBounds(points);
 if(b.w>INLAY_SKETCH_LIMITS.spanIn||b.h>INLAY_SKETCH_LIMITS.spanIn)return 'Keep the inlay within 20 feet wide and deep.';
 const cx=b.x+b.w/2,cy=b.y+b.h/2;
 if(points.some(p=>Math.abs(p.x-cx)>INLAY_SKETCH_LIMITS.coordinateIn||Math.abs(p.y-cy)>INLAY_SKETCH_LIMITS.coordinateIn))return 'Keep every corner within the inlay drawing limits.';
 return '';
}
/** Returns local INCH offsets, with the bounding-box centre at the placement origin. */
export function centerInlaySketch(points:OutlinePoint[]):OutlinePoint[]{
 const problem=inlaySketchProblem(points);if(problem)throw Error(problem);
 const b=sketchBounds(points),cx=b.x+b.w/2,cy=b.y+b.h/2;
 const result=points.map(p=>({x:p.x-cx,y:p.y-cy}));return sketchArea(result)<0?result.reverse():result;
}
/** Calibrate the entire draft from entered feet/inches; no pixel scale reaches the deck. */
export function resizeInlaySketch(points:OutlinePoint[],widthIn:number,depthIn:number):OutlinePoint[]{
 if(!Number.isFinite(widthIn)||!Number.isFinite(depthIn)||widthIn<=0||depthIn<=0||widthIn>240||depthIn>240)throw Error('Enter positive width and depth measurements up to 20 feet.');
 const b=sketchBounds(points);if(!b.w||!b.h)throw Error('Draw an area before setting measurements.');
 const cx=b.x+b.w/2,cy=b.y+b.h/2;return points.map(p=>({x:cx+(p.x-cx)*widthIn/b.w,y:cy+(p.y-cy)*depthIn/b.h}));
}
export function moveInlaySketchPoint(points:OutlinePoint[],index:number,dx:number,dy:number):OutlinePoint[]{
 return points.map((p,i)=>i===index?{x:p.x+dx,y:p.y+dy}:{...p});
}
export {sketchArea as inlaySketchArea,sketchBounds as inlaySketchBounds};
