import type {DeckTakeoff} from './deckTakeoff';
import type {DeckData} from './types';
import type {PlanPoint} from './lib/deckGeometry';
import {signedArea} from './lib/polygonCuts';
import {stairLandingPolygons} from './stairLandingGeometry';
import {stairTargetId} from './stairTargets';

/**
 * A paver pad at the foot of each flight to the ground (DeckData.stairPad, owner 2026-11-02): pavers on a compacted base,
 * 36 in out from the last riser and 3 in wider than the stair on each side, its top at the foot of the stair. A flight
 * that lands on a patio needs none, and a drawn stair path's mitred band keeps the path's own width. Priced at the
 * paver's installed rate (calculations.ts) and laid in stairPadPavers.ts, so neither the price list nor the laying sits
 * in the 3D viewer's first chunk. Pure data, worked out from the takeoff, never stored in it.
 */
export const STAIR_PAD={depthIn:36,marginIn:3,productId:'permacon-melville'} as const;
export interface StairPad{id:string;outline:PlanPoint[];topIn:number;areaSqft:number}

/** Pushes the two short sides of a landing band (first edge along the stair foot) out by `margin`. */
function widen(band:PlanPoint[],margin:number):PlanPoint[]{
  const [a,b,c,d]=band,length=Math.hypot(b.x-a.x,b.y-a.y),u={x:(b.x-a.x)/length*margin,y:(b.y-a.y)/length*margin};
  return [{x:a.x-u.x,y:a.y-u.y},{x:b.x+u.x,y:b.y+u.y},{x:c.x+u.x,y:c.y+u.y},{x:d.x-u.x,y:d.y-u.y}];
}

export function stairPads(data:DeckData,model:DeckTakeoff):StairPad[]{
  if(!data.stairPad)return [];
  const onPatio=new Set((data.stairTargets??[]).filter(t=>t.surface==='patio').map(t=>stairTargetId(t.flightId)));
  const ids=[...new Set(model.flights.filter(f=>f.kind==='grade').map(f=>stairTargetId(f.id)))].filter(id=>!onPatio.has(id));
  return ids.flatMap(id=>{
    const flights=model.flights.filter(f=>f.kind==='grade'&&stairTargetId(f.id)===id),topIn=Math.min(...flights.map(f=>f.end.y));
    return stairLandingPolygons(model,id,STAIR_PAD.depthIn).map((band,i)=>{
      const outline=id==='grade-path'||band.length!==4?band:widen(band,STAIR_PAD.marginIn);
      return {id:`${id}-${i}`,outline,topIn,areaSqft:Math.abs(signedArea(outline))/144};
    });
  });
}
