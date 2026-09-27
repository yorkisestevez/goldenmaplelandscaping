import type {DeckTakeoff,Member} from '../../deckTakeoff';
import type {SkirtingSlab} from '../../skirting';
import {mitredRunCaps} from '../../lib/mitredSlabs';

/** The existing rim/fascia envelope, closed by actual mitres instead of proud square corner plugs.
 * Framing sizes and estimates stay in the takeoff; this resolves its installed finish surfaces. */
export function fasciaSlabs(model:DeckTakeoff):SkirtingSlab[]{
  return model.levels.flatMap((level,group)=>{
    const runs=(level.rim??[]).map(m=>{
      const dx=m.b.x-m.a.x,dz=m.b.z-m.a.z,L=Math.hypot(dx,dz)||1;
      return {a:{x:m.a.x,y:m.a.z},b:{x:m.b.x,y:m.b.z},out:{x:dz/L,y:-dx/L},inner:-m.width/2,outer:m.width/2,group,member:m};
    });
    const caps=mitredRunCaps(runs);
    return runs.map((r,i)=>({a:r.a,b:r.b,out:r.out,thick:r.member.width,bottomA:r.member.a.y-r.member.depth/2,bottomB:r.member.b.y-r.member.depth/2,topA:r.member.a.y+r.member.depth/2,topB:r.member.b.y+r.member.depth/2,capA:caps[i].a,capB:caps[i].b}));
  });
}

/** Supplier fascia is offset 1.15 in from the rim centre line; resolve its joins on that
 * original outline before offsetting the two cut faces, preserving its selected extents. */
export function accessoryFasciaSlabs(members:Member[]):SkirtingSlab[]{
  const heights=new Map<string,number>();
  const runs=members.map(m=>{
    const dx=m.b.x-m.a.x,dz=m.b.z-m.a.z,L=Math.hypot(dx,dz)||1,out={x:dz/L,y:-dx/L};
    const key=`${m.a.y.toFixed(4)}:${m.depth.toFixed(4)}`;if(!heights.has(key))heights.set(key,heights.size);
    return {a:{x:m.a.x-out.x*1.15,y:m.a.z-out.y*1.15},b:{x:m.b.x-out.x*1.15,y:m.b.z-out.y*1.15},out,inner:1.15-m.width/2,outer:1.15+m.width/2,group:heights.get(key)!,member:m};
  });
  const caps=mitredRunCaps(runs);
  return runs.map((r,i)=>({a:{x:r.member.a.x,y:r.member.a.z},b:{x:r.member.b.x,y:r.member.b.z},out:r.out,thick:r.member.width,bottomA:r.member.a.y-r.member.depth/2,bottomB:r.member.b.y-r.member.depth/2,topA:r.member.a.y+r.member.depth/2,topB:r.member.b.y+r.member.depth/2,capA:caps[i].a,capB:caps[i].b}));
}
