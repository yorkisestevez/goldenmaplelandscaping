import type {Member} from './deckTakeoff';
import type {InlayPlan} from './lib/inlayGeometry';

/**
 * Framing under decorative inlays (lib/inlayGeometry.ts), added to the level's blocking so it flows into the
 * framing stock, screws, blocking connections, the 3D framing view and the plan like any other blocking:
 * - 'inlay-edge': doubled, one either side of the joint where boards end at the inlay (as board-end blocks are),
 *   so each side has its own bearing: field boards ending at its outer edge, and fill boards ending at the frame's
 *   inner edge (wherever those boards are not parallel to the edge).
 * - 'inlay-nailer': under each frame board that runs with the joists (or at 45° over joists wider than 12 in).
 * - 'inlay-ladder': rungs at 12 in centres under a fill that runs with the joists, at 45° over joists wider than
 *   12 in, or in a herringbone.
 * - A band across a 45° or herringbone field: 'inlay-edge' blocking under both long joints, where the field boards
 *   end. (A band of recoloured rows needs nothing; one running front to back sits on build-up joists, like a breaker.)
 * - 'inlay-solid': a medallion's rungs at 6 in centres over its outline grown by a board width, which count as solid
 *   blocking: every board end over them is supported (inSolidInlay).
 * A line along the joists is one member (left out where a joist already sits under it); a line across them is
 * blocking from joist to joist, each bay filled completely. Joists run along the plan's y axis (z in 3D).
 * frameInlays itself is in inlayFramingRuntime.ts, part of the lazy inlay runtime: only a level with inlays needs it.
 */
/** True when a level-local plan point sits over a medallion's solid blocking (its outline grown by a board width). */
export function inSolidInlay(level:{inlays?:InlayPlan[]},x:number,y:number){
  return !!level.inlays?.some(p=>{
    if(p.status!=='ok'||!p.solid)return false;
    let odd=false;
    for(let i=0,j=p.solid.length-1;i<p.solid.length;j=i++){const a=p.solid[i],b=p.solid[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)odd=!odd;}
    return odd;
  });
}

/** True when a plan point (world x, z) sits within `tol` inches of an inlay support member. */
export function onInlaySupport(x:number,z:number,members:Member[],tol=1){
  return members.some(m=>{
    const dx=m.b.x-m.a.x,dz=m.b.z-m.a.z,l2=dx*dx+dz*dz;if(!l2)return false;
    const t=Math.max(0,Math.min(1,((x-m.a.x)*dx+(z-m.a.z)*dz)/l2));
    return Math.hypot(x-(m.a.x+dx*t),z-(m.a.z+dz*t))<tol;
  });
}
