import type {DeckData} from '../../types';
import type {FixturePlacement} from '../../extrasLayout';
import {patioTopPlane,planeAt} from '../../patioPlane';
import {yardFeatureOutline} from '../../yardPathGeometry';
import {insidePolygon} from '../../lib/polygonCuts';
import {getTerrainConfig} from '../../yardSettings';

/** The finished top of the patio under a point, in model inches. Undefined when the point is not on a patio. */
function pavingSurfaceIn(data:DeckData,x:number,z:number){
 const terrain=getTerrainConfig(data);
 for(const f of data.yardFeatures??[]){
  if(!f.enabled||f.kind!=='patio')continue;
  let rings:{x:number;y:number}[][];
  try{rings=yardFeatureOutline(f);}catch{continue;}
  if(!rings.some(ring=>insidePolygon({x,y:z},ring)))continue;
  return planeAt(patioTopPlane(f,terrain.elevationIn+f.zFt*12*terrain.slopePct/100),x,z);
 }
 return undefined;
}

/** Sets each flagged recessed light (FixturePlacement.paving) on the paver it lands on, for the 3D view only. */
export function seatOnPaving<T extends {fixtures:FixturePlacement[]}>(data:DeckData,extras:T):T{
 if(!extras.fixtures.some(f=>f.paving))return extras;
 return {...extras,fixtures:extras.fixtures.map(f=>{if(!f.paving)return f;const y=pavingSurfaceIn(data,f.x,f.z);return y===undefined?f:{...f,y};})};
}
