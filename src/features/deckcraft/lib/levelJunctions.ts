import type {DeckLevel} from '../deckTakeoff';
import type {PlanPoint} from './deckGeometry';
import {insidePolygon as inside} from './polygonCuts';

/**
 * Where two deck levels meet: an edge of the higher level lying on an edge of the lower one (within half an inch), in
 * world plan inches (y is the 3D z). Levels built to meet (deckTakeoff.ts attachLevel) share such a stretch; the
 * higher level's rim stands over it and the lower level's rim is hidden under it.
 */
export interface LevelJunction{
  /** Indices into model.levels. */
  upper:number;lower:number;
  /** The shared stretch, a→b along the higher level's edge. */
  a:PlanPoint;b:PlanPoint;u:PlanPoint;length:number;
  /** Plan unit vector from the higher level toward the lower one. */
  out:PlanPoint;
}

const TOL=.5,MIN=1;
export const worldOutline=(l:DeckLevel)=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}));

export function levelJunctions(levels:DeckLevel[]):LevelJunction[]{
  const out:LevelJunction[]=[];
  const decks=levels.map((l,i)=>({l,i,poly:l.kind==='deck'?worldOutline(l):null})).filter(d=>d.poly);
  for(const up of decks)for(const low of decks){
    if(up.l.top<=low.l.top+.01)continue;
    const P=up.poly!,Q=low.poly!;
    P.forEach((p,i)=>{
      const q=P[(i+1)%P.length],len=Math.hypot(q.x-p.x,q.y-p.y);if(len<MIN)return;
      const u={x:(q.x-p.x)/len,y:(q.y-p.y)/len},across=(r:PlanPoint)=>(r.x-p.x)*u.y-(r.y-p.y)*u.x,along=(r:PlanPoint)=>(r.x-p.x)*u.x+(r.y-p.y)*u.y;
      Q.forEach((r,j)=>{
        const s=Q[(j+1)%Q.length];if(Math.abs(across(r))>TOL||Math.abs(across(s))>TOL)return;
        const lo=Math.max(0,Math.min(along(r),along(s))),hi=Math.min(len,Math.max(along(r),along(s)));if(hi-lo<MIN)return;
        const a={x:p.x+u.x*lo,y:p.y+u.y*lo},b={x:p.x+u.x*hi,y:p.y+u.y*hi},m={x:(a.x+b.x)/2,y:(a.y+b.y)/2},n={x:u.y,y:-u.x};
        // The side the lower level lies on (a probe 3 in off the middle of the stretch).
        const toward=inside({x:m.x+n.x*3,y:m.y+n.y*3},Q)?n:{x:-n.x,y:-n.y};
        out.push({upper:up.i,lower:low.i,a,b,u,length:hi-lo,out:toward});
      });
    });
  }
  return out;
}

/** Whether a plan segment (world inches) lies along a junction's stretch, for at least `min` inches. */
export function onJunction(j:LevelJunction,a:PlanPoint,b:PlanPoint,min=MIN){
  const across=(r:PlanPoint)=>(r.x-j.a.x)*j.u.y-(r.y-j.a.y)*j.u.x,along=(r:PlanPoint)=>(r.x-j.a.x)*j.u.x+(r.y-j.a.y)*j.u.y;
  if(Math.abs(across(a))>TOL||Math.abs(across(b))>TOL)return false;
  const lo=Math.max(0,Math.min(along(a),along(b))),hi=Math.min(j.length,Math.max(along(a),along(b)));
  return hi-lo>=min;
}
