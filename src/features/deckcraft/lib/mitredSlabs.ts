import type {PlanPoint} from './deckGeometry';
import type {SkirtingSlab} from '../skirting';

/** The two real edge points of a mitred end, rather than a square end plus a corner filler. */
export interface SlabCap {inner:PlanPoint;outer:PlanPoint}
export interface FinishRun {a:PlanPoint;b:PlanPoint;out:PlanPoint;inner:number;outer:number;group:number}
const distance=(a:PlanPoint,b:PlanPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const cross=(a:PlanPoint,b:PlanPoint)=>a.x*b.y-a.y*b.x;

/** Intersect offset face lines at a shared outline corner. Concave turns use the same construction;
 * nearly parallel edges and very acute, unbuildable spikes retain their square ends. Open ends never join. */
export function mitredRunCaps(runs:FinishRun[]):{a?:SlabCap;b?:SlabCap}[]{
  const caps=runs.map(()=>({} as {a?:SlabCap;b?:SlabCap}));
  runs.forEach((r,i)=>runs.slice(i+1).forEach((s,k)=>{
    const j=i+k+1;if(r.group!==s.group)return;
    const lr=distance(r.a,r.b),ls=distance(s.a,s.b);if(lr<.01||ls<.01)return;
    const u={x:(r.b.x-r.a.x)/lr,y:(r.b.y-r.a.y)/lr},v={x:(s.b.x-s.a.x)/ls,y:(s.b.y-s.a.y)/ls},den=cross(u,v);
    if(Math.abs(den)<1e-6)return;
    for(const e of ['a','b'] as const)for(const f of ['a','b'] as const){
      if(distance(r[e],s[f])>1e-5||caps[i][e]||caps[j][f])continue;
      const intersect=(dr:number,ds:number)=>{
        const p={x:r[e].x+r.out.x*dr,y:r[e].y+r.out.y*dr},q={x:s[f].x+s.out.x*ds,y:s[f].y+s.out.y*ds};
        const t=cross({x:q.x-p.x,y:q.y-p.y},v)/den;return {x:p.x+u.x*t,y:p.y+u.y*t};
      };
      const inner=intersect(r.inner,s.inner),outer=intersect(r.outer,s.outer);
      const limit=Math.min(lr,ls)/2;
      if([inner,outer].some(p=>distance(p,r[e])>limit))continue;
      caps[i][e]=caps[j][f]={inner,outer};
    }
  }));
  return caps;
}

/** One source of vertices for both the Three.js preview and the exported closed solid. */
export function slabPlanPoint(s:SkirtingSlab,end:0|1,side:-1|1):PlanPoint{
  const cap=end?s.capB:s.capA;if(cap)return side>0?cap.outer:cap.inner;
  const p=end?s.b:s.a,k=side*s.thick/2;return {x:p.x+s.out.x*k,y:p.y+s.out.y*k};
}
