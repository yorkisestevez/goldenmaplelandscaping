export interface LabelRect {left:number;top:number;right:number;bottom:number}
/** Screen-space placement. Labels remain tied to their edges while avoiding clipped controls. */
export function placeBoundaryLabel(preferred:{x:number;y:number},width:number,height:number,clip:LabelRect,obstacles:LabelRect[]){
  const inset=6,gap=6,minX=clip.left+inset+width/2,maxX=clip.right-inset-width/2,minY=clip.top+inset+height/2,maxY=clip.bottom-inset-height/2;
  const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(Math.max(a,b),n));
  const initial={x:clamp(preferred.x,minX,maxX),y:clamp(preferred.y,minY,maxY)};
  const candidates=[initial,...obstacles.flatMap(r=>{const l=r.left-gap-width/2,rr=r.right+gap+width/2,t=r.top-gap-height/2,b=r.bottom+gap+height/2;return [{x:l,y:initial.y},{x:rr,y:initial.y},{x:initial.x,y:t},{x:initial.x,y:b},{x:l,y:t},{x:l,y:b},{x:rr,y:t},{x:rr,y:b}];})];
  const overlap=(x:number,y:number,r:LabelRect)=>Math.max(0,Math.min(x+width/2,r.right+gap)-Math.max(x-width/2,r.left-gap))*Math.max(0,Math.min(y+height/2,r.bottom+gap)-Math.max(y-height/2,r.top-gap));
  let best=initial,score=Infinity;
  for(const candidate of candidates){const x=clamp(candidate.x,minX,maxX),y=clamp(candidate.y,minY,maxY),area=obstacles.reduce((sum,r)=>sum+overlap(x,y,r),0),cost=area*1e8+(x-preferred.x)**2+(y-preferred.y)**2;if(cost<score){score=cost;best={x,y};}}
  return best;
}
