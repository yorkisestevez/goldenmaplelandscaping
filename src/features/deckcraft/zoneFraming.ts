import {computeStruct} from './referenceConstruction';
import type {PlanPoint} from './lib/deckGeometry';
import type {Member,V3} from './deckTakeoff';

/**
 * Framing by zone. A zone is one rectangular-framed region of a deck level with its own
 * reference structure (beam rows, posts, joist layout). A plain deck is one zone; notched and
 * curved decks, and later wrap-arounds, split into several so every wing gets its own beam.
 *
 * Zones here are axis-aligned: joists run along +z (plan y) from the zone's back edge, beams run
 * along x. `origin` + `size` define the zone's framing rectangle in level plan coordinates;
 * `outline` clips members to the zone's actual area.
 */
export interface DeckZone{id:string;outline:PlanPoint[];origin:PlanPoint;size:{w:number;h:number};attached:boolean}
export interface ZoneFramingConfig{top:number;spacing:number;framingSize:string;joistDepth:number;pictureFrame:boolean}
export type ZoneReference=ReturnType<typeof computeStruct>;
export interface FramedZone{zone:DeckZone;reference:ZoneReference}

/** Where a polygon crosses a line: axis 'x' → the line x = c, returning z ranges; axis 'z' → the line z = c, returning x ranges. */
export function outlineSpans(outline:PlanPoint[],c:number,axis:'x'|'z'):[number,number][]{
  const cross:number[]=[];
  for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];const aa=axis==='x'?a.x:a.y,bb=axis==='x'?b.x:b.y,av=axis==='x'?a.y:a.x,bv=axis==='x'?b.y:b.x;if((aa<=c&&bb>c)||(bb<=c&&aa>c))cross.push(av+(c-aa)*(bv-av)/(bb-aa));}
  cross.sort((a,b)=>a-b);const pairs:[number,number][]=[];for(let i=0;i+1<cross.length;i+=2)pairs.push([cross[i],cross[i+1]]);return pairs;
}

/** Removes duplicate and collinear vertices, including the zero-width spikes a polygon clip
 * leaves when an outline edge lies exactly on the clip line. */
export function cleanPolygon(points:PlanPoint[]):PlanPoint[]{
  let out=points.filter((p,i)=>{const q=points[(i+1)%points.length];return Math.hypot(q.x-p.x,q.y-p.y)>1e-6;});
  for(let changed=true;changed&&out.length>3;){
    changed=false;
    for(let i=0;i<out.length;i++){
      const a=out[(i+out.length-1)%out.length],p=out[i],b=out[(i+1)%out.length];
      if(Math.abs((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x))<1e-6){out=out.filter((_,j)=>j!==i);changed=true;break;}
    }
  }
  return out;
}

export function zoneReference(zone:DeckZone,cfg:ZoneFramingConfig):ZoneReference{
  return computeStruct({width:zone.size.w/12,depth:zone.size.h/12,heightIn:cfg.top,house:zone.attached?'wood':'brick',ft:'PT',joistSp:String(cfg.spacing),joistSz:cfg.framingSize,beamMount:cfg.top<18?'flush':'drop',bSzSel:'auto',bPlySel:'auto',pf:cfg.pictureFrame});
}

/** Posts and beams of one zone, clipped to its outline. */
export function frameZoneBearings({zone,reference:ref}:FramedZone,offset:V3,out:{supports:V3[];beams:Member[]}){
  const o=zone.origin;
  for(const p of ref.posts){const x=p.x*12+o.x,z=p.z*12+o.y;if(outlineSpans(zone.outline,x,'x').some(([a,b])=>z>=a&&z<=b))out.supports.push({x:x+offset.x,y:Math.max(0,ref.bBotY*12),z:z+offset.z});}
  for(const row of ref.beamRows)for(const [a,b]of outlineSpans(zone.outline,row.z*12+o.y,'z'))for(let ply=0;ply<ref.bPly;ply++){
    const y=(ref.bBotY+ref.bh/2)*12,z=row.z*12+o.y+offset.z+(ply-(ref.bPly-1)/2)*1.5;
    out.beams.push({a:{x:a+offset.x,y,z},b:{x:b+offset.x,y,z},width:1.5,depth:ref.bh*12});
  }
}

/** Joists (reference layout plus build-ups inside this zone) and mid-span blocking of one zone. */
export function frameZoneJoists({zone,reference:ref}:FramedZone,offset:V3,cfg:ZoneFramingConfig,buildUps:number[],out:{joists:Member[];blocking:Member[]}){
  const o=zone.origin,w=zone.size.w,y=cfg.top-1-cfg.joistDepth/2;
  const ups=buildUps.filter(x=>x>=o.x&&x<=o.x+w);
  const regular=ref.jXs.map((x:number)=>Math.max(.75,Math.min(w-.75,x*12))+o.x).filter((x:number)=>!ups.some(u=>Math.abs(u-x)<1.5));
  const joists:Member[]=[];
  for(const x of [...regular,...ups].sort((a,b)=>a-b))for(const [a,b]of outlineSpans(zone.outline,x,'x'))joists.push({a:{x:x+offset.x,y,z:a+offset.z},b:{x:x+offset.x,y,z:b+offset.z},width:1.5,depth:cfg.joistDepth});
  for(let z=o.y+96;z<o.y+zone.size.h-3;z+=96)for(let i=0;i<joists.length-1;i++){const a=joists[i],b=joists[i+1];if(z+offset.z<=Math.min(a.a.z,a.b.z)||z+offset.z>=Math.max(a.a.z,a.b.z)||z+offset.z<=Math.min(b.a.z,b.b.z)||z+offset.z>=Math.max(b.a.z,b.b.z)||b.a.x-a.a.x<2)continue;out.blocking.push({a:{x:a.a.x+.75,y:a.a.y,z:z+offset.z},b:{x:b.a.x-.75,y:b.a.y,z:z+offset.z},width:1.5,depth:cfg.joistDepth});}
  out.joists.push(...joists);
}
