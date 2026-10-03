import type {DeckData} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import type {SelectionState} from './selectionState';
import {landscapeOutlinePaths} from '../landscapeOutline';
import {yardFeatureOutline} from '../yardPathGeometry';
import {poolControlWorld} from '../poolEdits';
type Point={x:number;z:number};
export function sceneSnapGeometry(data:DeckData,model:DeckTakeoff,selection:SelectionState):Point[][] {
 const excluded=new Set(selection.objectIds??(selection.hardscape?[selection.hardscape.id]:[]));
 return [...(data.siteModel?.boundary?[data.siteModel.boundary.map(p=>({x:p.x,z:p.y}))]:[]),
  ...model.levels.filter(l=>!selection.partIds.includes(`deck:${(l.index??0)+1}`)).map(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,z:p.y+l.offset.z}))),
  ...(data.landscapeObjects??[]).filter(o=>o.enabled&&!excluded.has(o.id)).flatMap(landscapeOutlinePaths),
  ...(data.yardFeatures??[]).filter(o=>o.enabled&&!excluded.has(o.id)).flatMap(o=>yardFeatureOutline(o).map(r=>r.map(p=>({x:p.x,z:p.y})))),
  ...(data.pools??[]).filter(o=>!excluded.has(o.id)).map(o=>poolControlWorld(o).map(p=>({x:p.x,z:p.y})))];
}
/** Snap to physical boundary points/edges first, then nearby coordinate alignment. */
export function snapScenePoint(point:Point,rings:Point[][],tolerance:number):Point {
 let closest=tolerance,result=point;const points=rings.flat();
 for(const p of points){const d=Math.hypot(p.x-point.x,p.z-point.z);if(d<closest){closest=d;result=p;}}
 if(result!==point)return {...result};
 for(const r of rings)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz;if(!len)continue;const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/len)),q={x:a.x+t*dx,z:a.z+t*dz},d=Math.hypot(q.x-point.x,q.z-point.z);if(d<closest){closest=d;result=q;}}
 if(result!==point)return result;
 const x=points.filter(p=>Math.abs(p.x-point.x)<tolerance).sort((a,b)=>Math.abs(a.x-point.x)-Math.abs(b.x-point.x))[0]?.x,
 z=points.filter(p=>Math.abs(p.z-point.z)<tolerance).sort((a,b)=>Math.abs(a.z-point.z)-Math.abs(b.z-point.z))[0]?.z;
 return {x:x??point.x,z:z??point.z};
}
