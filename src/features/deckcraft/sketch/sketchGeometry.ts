import type {SketchPoint} from './sketchTypes';

export const sketchBounds=(p:SketchPoint[])=>{const x=Math.min(...p.map(p=>p.x)),y=Math.min(...p.map(p=>p.y));return {x,y,w:Math.max(...p.map(p=>p.x))-x,h:Math.max(...p.map(p=>p.y))-y};};
export const sketchArea=(p:SketchPoint[])=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.y-b.x*a.y;},0)/2;
const distance=(a:SketchPoint,b:SketchPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const cross=(a:SketchPoint,b:SketchPoint,c:SketchPoint)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const on=(a:SketchPoint,b:SketchPoint,p:SketchPoint)=>Math.abs(cross(a,b,p))<1e-7&&p.x>=Math.min(a.x,b.x)-1e-7&&p.x<=Math.max(a.x,b.x)+1e-7&&p.y>=Math.min(a.y,b.y)-1e-7&&p.y<=Math.max(a.y,b.y)+1e-7;
function segmentDistance(p:SketchPoint,a:SketchPoint,b:SketchPoint){const d=(b.x-a.x)**2+(b.y-a.y)**2;if(!d)return distance(p,a);const t=Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/d));return distance(p,{x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});}
function simplify(points:SketchPoint[],tolerance:number):SketchPoint[]{let index=0,max=tolerance;for(let i=1;i<points.length-1;i++){const d=segmentDistance(points[i],points[0],points[points.length-1]);if(d>max){max=d;index=i;}}return index?[...simplify(points.slice(0,index+1),tolerance).slice(0,-1),...simplify(points.slice(index),tolerance)]:[points[0],points[points.length-1]];}
/** Remove duplicate closure/samples, normalize winding and simplify small hand jitter without mutating input. */
export function cleanSketchOutline(points:SketchPoint[],simplification=true):SketchPoint[]{
  let p:SketchPoint[]=[];for(const v of points)if(!p.length||distance(v,p[p.length-1])>.5)p.push({...v});
  if(p.length>2){const b=sketchBounds(p),closeTolerance=Math.min(4,Math.max(.5,Math.hypot(b.w,b.h)*.006));if(distance(p[0],p[p.length-1])<=closeTolerance)p.pop();}
  if(p.length<3)return p;
  if(simplification&&p.length>4){const b=sketchBounds(p),tolerance=Math.min(5,Math.hypot(b.w,b.h)*.0075),first=p[0];let far=1;for(let i=2;i<p.length;i++)if(distance(first,p[i])>distance(first,p[far]))far=i;
    p=[...simplify(p.slice(0,far+1),tolerance).slice(0,-1),...simplify([...p.slice(far),first],tolerance).slice(0,-1)];}
  if(sketchArea(p)<0)p.reverse();return p;
}
export function sketchOutlineProblem(p:SketchPoint[]):string {
  if(p.length<3)return 'Draw a closed area with at least three distinct points.';
  if(p.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)))return 'Every point must have finite coordinates.';
  for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length],prev=p[(i+p.length-1)%p.length];
    if(distance(a,b)<1e-6)return 'Remove repeated corners.';
    if(Math.abs(cross(prev,a,b))<1e-7&&(a.x-prev.x)*(b.x-a.x)+(a.y-prev.y)*(b.y-a.y)<0)return 'An edge doubles back. Redraw a clear outline.';
    for(let j=i+1;j<p.length;j++)if(j!==i+1&&!(i===0&&j===p.length-1)){const c=p[j],d=p[(j+1)%p.length];if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))return 'The outline crosses itself. Redraw without crossing lines.';}
  }
  if(Math.abs(sketchArea(p))<1e-5)return 'Draw an area with positive width and depth.';return '';
}
export const sketchRectangle=(x:number,y:number,w:number,h:number):SketchPoint[]=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
/** Only accepts a recognizably axis-aligned rectangle; L-shapes/diagonal houses are not substituted by a box. */
export function rectangularSketch(points:SketchPoint[],tolerance=.05):{points:SketchPoint[];deviation:number}|null{
  const b=sketchBounds(points);if(b.w<=0||b.h<=0)return null;
  const corners=sketchRectangle(b.x,b.y,b.w,b.h),deviation=Math.max(...points.map(p=>Math.min(...corners.map(c=>distance(p,c)))));
  const edgeError=Math.max(...points.map(p=>Math.min(Math.abs(p.x-b.x),Math.abs(p.x-b.x-b.w),Math.abs(p.y-b.y),Math.abs(p.y-b.y-b.h))));
  if(edgeError>Math.min(b.w,b.h)*tolerance||Math.abs(sketchArea(points))<b.w*b.h*(1-tolerance*2)||!corners.every(c=>points.some(p=>distance(p,c)<=Math.max(b.w,b.h)*tolerance*2)))return null;
  return {points:corners,deviation:points.length===4?deviation:edgeError};
}
