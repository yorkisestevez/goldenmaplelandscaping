import type {HouseOpening} from '../../types';
import type {Box} from '../../deckTakeoff';

/**
 * A wainscot on a house wall, in the facade frame (local x along the wall, y up from grade, +z out from the face):
 * the wall is split at the band's top, the band is clad in its own cladding, and a trim cap covers the joint.
 * Pure, with no three.js: the export (houseGeometry.ts, loaded with the page) and the 3D facade share it.
 */

/** The cap's height and how far it stands off the wall face. */
export const WAINSCOT_CAP={h:2.5,z:1.5,d:2.2};
/** The band's top on a wall of this height: as chosen, but always at least a foot below the top of the wall. */
export const wainscotBand=(heightIn:number,wallHeight:number)=>Math.max(0,Math.min(heightIn,wallHeight-12));

/** Wall pieces split at the band: those below it and those above it (a piece crossing it is cut in two). */
export function splitAtBand(boxes:Box[],band:number):{lower:Box[];upper:Box[]}{
  const lower:Box[]=[],upper:Box[]=[];
  for(const b of boxes){
    const y0=b.y-b.h/2,y1=b.y+b.h/2;
    if(y1<=band)lower.push(b);
    else if(y0>=band)upper.push(b);
    else{lower.push({...b,y:(y0+band)/2,h:band-y0});upper.push({...b,y:(band+y1)/2,h:y1-band});}
  }
  return {lower,upper};
}

/**
 * The cap along the band's top: it stops at stretches inside another house block and at the casing round any
 * door or window it meets (the casing is 3 in wide, so the cap stops 3 in out from the opening).
 */
export function wainscotCap(span:number,band:number,openings:Pick<HouseOpening,'offsetPct'|'widthIn'|'bottomIn'|'heightIn'>[],hidden:[number,number][]):Box[]{
  const lo=band-WAINSCOT_CAP.h/2,hi=band+WAINSCOT_CAP.h/2;
  let runs:[number,number][]=[[-span/2,span/2]];
  const cut=(l:number,r:number)=>{runs=runs.flatMap(([a,b])=>(r<=a||l>=b?[[a,b]]:[...(l>a?[[a,l]]:[]),...(r<b?[[r,b]]:[])]) as [number,number][]);};
  for(const [l,r] of hidden)cut(l,r);
  for(const o of openings)if(o.bottomIn-3<hi&&o.bottomIn+o.heightIn+3>lo){const x=-span/2+span*o.offsetPct/100;cut(x-o.widthIn/2-3,x+o.widthIn/2+3);}
  return runs.filter(([a,b])=>b-a>=.25).map(([a,b])=>({x:(a+b)/2,y:band,z:WAINSCOT_CAP.z,w:b-a,h:WAINSCOT_CAP.h,d:WAINSCOT_CAP.d}));
}
