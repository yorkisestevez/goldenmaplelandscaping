import type {SketchPoint} from './sketchTypes';

/** Simplify an open pen stroke without ever adding a closing edge. */
export function cleanStairPath(points:SketchPoint[],tolerance=2):SketchPoint[]{
  const input=points.filter((p,i)=>!i||Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y)>.001);
  if(input.length<3)return input.map(p=>({...p}));
  const keep=new Set([0,input.length-1]),stack=[[0,input.length-1]];
  while(stack.length){const [a,b]=stack.pop()!,p=input[a],q=input[b],dx=q.x-p.x,dy=q.y-p.y,length=dx*dx+dy*dy;let far=tolerance,index=-1;
    for(let i=a+1;i<b;i++){const r=input[i],t=length?Math.max(0,Math.min(1,((r.x-p.x)*dx+(r.y-p.y)*dy)/length)):0,d=Math.hypot(r.x-p.x-t*dx,r.y-p.y-t*dy);if(d>far){far=d;index=i;}}
    if(index>=0){keep.add(index);stack.push([a,index],[index,b]);}
  }
  return [...keep].sort((a,b)=>a-b).map(i=>({...input[i]}));
}

/** Match drawn segments to the perimeter. Interior corners must be real shared vertices. */
export function snapStairPath(points:SketchPoint[],outline:SketchPoint[],tolerance=6):SketchPoint[]{
  const segments=points.slice(1).map((b,i)=>{
    const a=points[i],matches=outline.flatMap((p,j)=>{const q=outline[(j+1)%outline.length],dx=q.x-p.x,dy=q.y-p.y,l=Math.hypot(dx,dy);if(!l)return [];const t=(r:SketchPoint)=>((r.x-p.x)*dx+(r.y-p.y)*dy)/l,off=(r:SketchPoint)=>Math.abs((r.x-p.x)*dy-(r.y-p.y)*dx)/l,lo=Math.min(t(a),t(b)),hi=Math.max(t(a),t(b));return off(a)<=tolerance&&off(b)<=tolerance&&lo>=-tolerance&&hi<=l+tolerance&&hi-lo>=36?[{index:j,p,q,l,dx:dx/l,dy:dy/l,score:off(a)+off(b)}]:[];}).sort((a,b)=>a.score-b.score);
    if(!matches.length)throw Error('Draw stairs along an exposed deck edge, with at least 3 feet on each side.');
    if(matches[1]&&Math.abs(matches[1].score-matches[0].score)<.01)throw Error('The stair edge is ambiguous. Draw closer to the intended perimeter.');return matches[0];
  });
  const project=(point:SketchPoint,s:typeof segments[number])=>{const t=Math.max(0,Math.min(s.l,(point.x-s.p.x)*s.dx+(point.y-s.p.y)*s.dy));return {x:s.p.x+t*s.dx,y:s.p.y+t*s.dy};};
  const result=[project(points[0],segments[0])];
  for(let i=1;i<segments.length;i++){const a=segments[i-1],b=segments[i];if(a.index===b.index)throw Error('Keep one straight segment per stair edge.');const common=[a.p,a.q].find(p=>[b.p,b.q].some(q=>Math.hypot(p.x-q.x,p.y-q.y)<.01));if(!common||Math.hypot(points[i].x-common.x,points[i].y-common.y)>tolerance)throw Error('A stair turn must follow the deck corner.');result.push({...common});}
  result.push(project(points.at(-1)!,segments.at(-1)!));return result;
}
