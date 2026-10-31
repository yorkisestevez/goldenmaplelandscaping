import type {DeckTakeoff,Member} from '../../deckTakeoff';
import type {SkirtingSlab} from '../../skirting';
import {mitredRunCaps} from '../../lib/mitredSlabs';

/** Composite fascia comes in 12 ft boards (every rate in FASCIA_RETAIL_RATES), butted with an expansion gap. */
export const FASCIA_STOCK_IN=144,FASCIA_JOINT_IN=.125;

/** One run of fascia as the boards it is made of: as many 12 ft boards as fasciaSupply prices, split evenly (so no
 * sliver lands at a corner) and butted with the joint gap. Only the run's own ends keep their mitres. */
function boards(run:SkirtingSlab):SkirtingSlab[]{
  const L=Math.hypot(run.b.x-run.a.x,run.b.y-run.a.y),n=Math.ceil(L/FASCIA_STOCK_IN-1e-9);
  if(n<=1)return [run];
  const at=(d:number)=>({x:run.a.x+(run.b.x-run.a.x)*d/L,y:run.a.y+(run.b.y-run.a.y)*d/L}),lerp=(p:number,q:number,d:number)=>p+(q-p)*d/L;
  const piece=(L-(n-1)*FASCIA_JOINT_IN)/n;
  return Array.from({length:n},(_,k)=>{
    const start=k*(piece+FASCIA_JOINT_IN),end=k===n-1?L:start+piece;
    return {...run,a:at(start),b:at(end),bottomA:lerp(run.bottomA,run.bottomB,start),bottomB:lerp(run.bottomA,run.bottomB,end),topA:lerp(run.topA,run.topB,start),topB:lerp(run.topA,run.topB,end),
      capA:k===0?run.capA:undefined,capB:k===n-1?run.capB:undefined,grainAnchor:at((start+end)/2)};
  });
}

/** The existing rim/fascia envelope, closed by actual mitres instead of proud square corner plugs, in its stock boards.
 * Framing sizes and estimates stay in the takeoff; this resolves its installed finish surfaces. */
export function fasciaSlabs(model:DeckTakeoff):SkirtingSlab[]{
  return model.levels.flatMap((level,group)=>{
    const runs=(level.rim??[]).map(m=>{
      const dx=m.b.x-m.a.x,dz=m.b.z-m.a.z,L=Math.hypot(dx,dz)||1;
      return {a:{x:m.a.x,y:m.a.z},b:{x:m.b.x,y:m.b.z},out:{x:dz/L,y:-dx/L},inner:-m.width/2,outer:m.width/2,group,member:m};
    });
    const caps=mitredRunCaps(runs);
    return runs.flatMap((r,i)=>boards({a:r.a,b:r.b,out:r.out,thick:r.member.width,bottomA:r.member.a.y-r.member.depth/2,bottomB:r.member.b.y-r.member.depth/2,topA:r.member.a.y+r.member.depth/2,topB:r.member.b.y+r.member.depth/2,capA:caps[i].a,capB:caps[i].b}));
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
  return runs.flatMap((r,i)=>boards({a:{x:r.member.a.x,y:r.member.a.z},b:{x:r.member.b.x,y:r.member.b.z},out:r.out,thick:r.member.width,bottomA:r.member.a.y-r.member.depth/2,bottomB:r.member.b.y-r.member.depth/2,topA:r.member.a.y+r.member.depth/2,topB:r.member.b.y+r.member.depth/2,capA:caps[i].a,capB:caps[i].b}));
}
