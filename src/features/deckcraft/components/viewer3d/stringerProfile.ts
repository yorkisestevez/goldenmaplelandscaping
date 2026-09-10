import type {DeckTakeoff,Member} from '../../deckTakeoff';
import type {PlanPoint} from '../../lib/deckGeometry';

/** Shared planning silhouette for rendering and CAD. The finished riser face
 * remains at each run station; the timber cut bears against its rear face.
 * A finished riser must not occupy the same face plane as the timber stringer.
 */
export function stringerCutProfile(member:Member,model:DeckTakeoff):PlanPoint[]{
 const top=model.levels[0].top,risers=model.quantities.risersPerFlight;
 const s=member.stair??{risers,rise:top/risers,run:10.5,top,bottom:0};
 const setback=model.riserBoards.length?model.stairSupport.riserThicknessIn:0;
 const points:PlanPoint[]=[{x:0,y:s.top-s.rise-1}];
 for(let i=1;i<s.risers;i++){
  const x=i*s.run-setback;
  points.push({x,y:s.top-i*s.rise-1});
  if(i<s.risers-1)points.push({x,y:s.top-(i+1)*s.rise-1});
 }
 points.push({x:Math.max(0,(s.risers-1)*s.run-setback),y:s.bottom},{x:0,y:Math.max(s.bottom,s.top-s.rise-member.depth)});
 return points;
}
