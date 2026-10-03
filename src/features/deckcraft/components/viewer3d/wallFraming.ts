import type {YardBox} from '../../yardModel';
import {lawnHeight} from './lawnSurface';

/** Visible stock envelopes include each course's actual setback and cap
 * overhang. Buried bases, excavation and reinforcement do not widen the view. */
export function exposedWallEnvelope(boxes:YardBox[],terrain:{elevationIn:number;slopePct:number}){
 const points:{x:number;y:number;z:number}[]=[];
 for(const b of boxes){
  if(b.renderDuplicate||b.role!=='wall-block'&&b.role!=='wall-cap')continue;
  const top=b.y+b.h/2,co=Math.cos(b.angle??0),si=Math.sin(b.angle??0);
  const ring=b.renderContours?.flat()??b.polygon??[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:b.x+co*u*b.w/2-si*v*b.d/2,y:b.z+si*u*b.w/2+co*v*b.d/2}));
  if(ring.every(p=>top<lawnHeight(terrain,p.y)))continue;
  for(const p of ring){const bottom=Math.min(top,Math.max(b.y-b.h/2,lawnHeight(terrain,p.y)));for(const y of [bottom,top])points.push({x:p.x/12,y:y/12,z:p.y/12});}
 }
 return points;
}
