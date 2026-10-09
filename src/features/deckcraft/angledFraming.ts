import {clipToConvex,type FootprintPlan,type PlanPoint} from './lib/deckGeometry';
import {distanceToSegment,halfPlane} from './lib/wrapGeometry';
import {isChamferEdgeId} from './lib/cornerChamfers';
import type {Member,V3} from './deckTakeoff';
import type {FramedZone} from './zoneFraming';

/**
 * Framing under a 45° angled front edge (an angled corner). Joists keep running square to the house and
 * end on the angled rim; the zone's own reference structure (beam rows, posts, spans) is kept, and an
 * angled beam is added under the joist ends, moved back from the edge by the same front overhang the
 * zone's front beam row gives every other joist. The front beam row then stops where it meets the angled
 * beam. Keyed on named angled-corner edges only, never on edge angle (the winder and curved decks have
 * angled facets that must not change).
 */
export interface AngledEdge{a:PlanPoint;b:PlanPoint}
export interface AngledBearing{a:PlanPoint;b:PlanPoint}

/** The angled-corner edges of a main-deck footprint (none for every other outline). */
export function angledCornerEdges(fp:FootprintPlan):AngledEdge[]{
  return (fp.edgeIds??[]).flatMap((id,i)=>isChamferEdgeId(id)?[{a:fp.outline[i],b:fp.outline[(i+1)%fp.outline.length]}]:[]);
}

const rowZsIn=({zone,reference:ref}:FramedZone)=>ref.beamRows.map(r=>r.z+zone.origin.y);

/** The bearing line an angled edge needs inside one zone, or null when the zone's front beam row already
 * carries those joist ends (the corner is cut back no further than the front overhang). */
export function angledBearing(edge:AngledEdge,framed:FramedZone):AngledBearing|null{
  const {zone}=framed,x0=Math.max(zone.origin.x,Math.min(edge.a.x,edge.b.x)),x1=Math.min(zone.origin.x+zone.size.w,Math.max(edge.a.x,edge.b.x));
  if(x1-x0<1||Math.abs(edge.b.x-edge.a.x)<1e-6)return null;
  const yAt=(x:number)=>edge.a.y+(x-edge.a.x)*(edge.b.y-edge.a.y)/(edge.b.x-edge.a.x);
  const rows=rowZsIn(framed);if(!rows.length)return null;
  const front=Math.max(...rows),overhang=zone.origin.y+zone.size.h-front;
  if(Math.min(yAt(x0),yAt(x1))>=front-.5)return null;
  return {a:{x:x0,y:yAt(x0)-overhang},b:{x:x1,y:yAt(x1)-overhang}};
}

/** The part of a zone that posts and beam rows may occupy: behind every angled bearing line in it. */
export function bearingOutline(framed:FramedZone,bearings:AngledBearing[]):PlanPoint[]{
  let outline=framed.zone.outline;
  for(const b of bearings){const inside={x:(b.a.x+b.b.x)/2,y:Math.min(b.a.y,b.b.y)-1000};outline=clipToConvex(outline,halfPlane(b.a,b.b,inside));}
  return outline;
}

/** The angled beam (as many plies as the zone's beams, side by side along its normal) and its posts:
 * where it meets each beam row, near each end, and close enough that no gap exceeds the beam span. */
export function frameAngledBearing(framed:FramedZone,bearing:AngledBearing,offset:V3,out:{supports:V3[];beams:Member[]}){
  const {reference:ref}=framed,{a,b}=bearing,len=Math.hypot(b.x-a.x,b.y-a.y);if(len<1)return;
  const u={x:(b.x-a.x)/len,y:(b.y-a.y)/len},n={x:-u.y,y:u.x},y=ref.beamBottomIn+ref.beamDepthIn/2;
  for(let ply=0;ply<ref.beam.plies;ply++){
    const s=(ply-(ref.beam.plies-1)/2)*1.5;
    out.beams.push({a:{x:a.x+n.x*s+offset.x,y,z:a.y+n.y*s+offset.z},b:{x:b.x+n.x*s+offset.x,y,z:b.y+n.y*s+offset.z},width:1.5,depth:ref.beamDepthIn,role:'angled-beam'});
  }
  // A post already standing within a foot of a station and of the beam (a beam row's own post near the
  // crossing, including one just past the beam end) carries that station: the station moves onto it and
  // no second footing goes in. A 2-ply end can sit just over 6 in from the segment end.
  const at=(t:number)=>({x:a.x+u.x*t+offset.x,z:a.y+u.y*t+offset.z}),beam={a:{x:a.x+offset.x,y:a.y+offset.z},b:{x:b.x+offset.x,y:b.y+offset.z}};
  const carrier=(t:number)=>{const s=at(t);return out.supports.find(p=>Math.hypot(p.x-s.x,p.z-s.z)<12&&distanceToSegment({x:p.x,y:p.z},beam.a,beam.b)<12);};
  const onBeam=(p:V3)=>Math.min(len,Math.max(0,(p.x-offset.x-a.x)*u.x+(p.z-offset.z-a.y)*u.y));
  const stations:number[]=[];
  for(const z of rowZsIn(framed))if(Math.abs(b.y-a.y)>1e-6&&(z-a.y)*(z-b.y)<=1e-6){const t=(z-a.y)/(b.y-a.y)*len;if(t>=-.5&&t<=len+.5)stations.push(Math.min(len,Math.max(0,t)));}
  for(const end of [0,len])if(!stations.some(t=>Math.abs(t-end)<24))stations.push(end===0?Math.min(12,len/4):len-Math.min(12,len/4));
  const placed=stations.map(t=>{const p=carrier(t);return p?onBeam(p):t;}).sort((p,q)=>p-q);
  const maxGap=ref.beamSpanLimitIn,filled:number[]=[];
  for(let i=0;i<placed.length;i++){
    if(i>0){const gap=placed[i]-placed[i-1],extra=Math.ceil(gap/maxGap)-1;for(let k=1;k<=extra;k++)filled.push(placed[i-1]+gap*k/(extra+1));}
    filled.push(placed[i]);
  }
  const postY=Math.max(0,ref.beamBottomIn);
  for(const t of filled.filter((t,i,all)=>i===0||t-all[i-1]>=1)){
    const s=at(t);
    if(!carrier(t)&&!out.supports.some(p=>Math.hypot(p.x-s.x,p.z-s.z)<1))out.supports.push({x:s.x,y:postY,z:s.z});
  }
}

/** Where an angled beam's centre line crosses the line x (plan inches, level offset applied), or null. */
export function angledBeamZAt(beam:Member,x:number):number|null{
  const lo=Math.min(beam.a.x,beam.b.x),hi=Math.max(beam.a.x,beam.b.x);
  if(x<lo-.1||x>hi+.1||Math.abs(beam.b.x-beam.a.x)<1e-6)return null;
  return beam.a.z+(x-beam.a.x)*(beam.b.z-beam.a.z)/(beam.b.x-beam.a.x);
}
