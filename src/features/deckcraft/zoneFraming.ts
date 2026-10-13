import {frameRectangle,type RectFraming,type RectFramingInput} from './structure/framing';
import type {FramingSpecies,JoistSize} from './structure/spanTables';
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
export interface ZoneFramingConfig{top:number;spacing:number;framingSize:string;joistDepth:number;pictureFrame:boolean;beamPick?:'joist-depth'|'independent';species?:FramingSpecies;codeSized?:false}
export type ZoneReference=RectFraming;
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

function framingInput(cfg:ZoneFramingConfig,size:{w:number;h:number},ledger:boolean,extra:Partial<RectFramingInput>={}):RectFramingInput{
  return {widthIn:size.w,depthIn:size.h,topIn:cfg.top,ledger,joistSpacingIn:cfg.spacing as 12|16,joistSize:cfg.framingSize as JoistSize,...(cfg.beamPick?{beamPick:cfg.beamPick}:{}),...(cfg.species?{species:cfg.species}:{}),...(cfg.codeSized===false?{codeSized:false as const}:{}),...extra};
}

export function zoneReference(zone:DeckZone,cfg:ZoneFramingConfig,houseCantileverIn?:number):ZoneReference{
  return frameRectangle(framingInput(cfg,zone.size,zone.attached,{houseCantileverIn}));
}

/** Freestanding zones that start on the house edge share one straight house-side beam: each is reframed with the
 * smallest house-side cantilever among them (the engine trims it further where a zone's own span needs). */
export function shareHouseSideBeam(zones:FramedZone[],cfg:ZoneFramingConfig):FramedZone[]{
  // The house edge is the level's own back line (a free outline may sit anywhere in plan), not y = 0.
  const free=zones.filter(z=>!z.zone.attached&&z.reference.beamRows[0]?.kind==='house'&&!z.reference.edgeBeams);
  const back=Math.min(...free.map(z=>z.zone.origin.y)),onEdge=free.filter(z=>Math.abs(z.zone.origin.y-back)<.01);
  if(onEdge.length<2)return zones;
  const shared=Math.min(...onEdge.map(z=>z.reference.beamRows[0].z));
  return zones.map(z=>onEdge.includes(z)?{zone:z.zone,reference:zoneReference(z.zone,cfg,shared)}:z);
}

/** A landing carries stair stringers at its edges, so its beams sit on both edges (outer face on the edge) instead of
 * behind a deck's joist cantilever, which on a 4-ft landing put the two post rows 1.8 ft apart, on overlapping footings. */
export function landingReference(zone:DeckZone,cfg:ZoneFramingConfig):ZoneReference{
  return frameRectangle(framingInput(cfg,zone.size,zone.attached,{edgeBeams:true}));
}

/** Posts and beams of one zone, clipped to its outline, or to `bearingOutline` (the part of the zone behind
 * any angled bearing lines, see angledFraming.ts). */
export function frameZoneBearings({zone,reference:ref}:FramedZone,offset:V3,out:{supports:V3[];beams:Member[]},bearingOutline:PlanPoint[]=zone.outline){
  const o=zone.origin;
  for(const p of ref.posts){const x=p.x+o.x,z=p.z+o.y;if(outlineSpans(bearingOutline,x,'x').some(([a,b])=>z>=a&&z<=b))out.supports.push({x:x+offset.x,y:Math.max(0,ref.beamBottomIn),z:z+offset.z});}
  // Any clipped row can touch a polygon vertex without crossing its interior.
  // That point has no physical length and must not become lumber or a stock cut.
  for(const row of ref.beamRows)for(const [a,b]of outlineSpans(bearingOutline,row.z+o.y,'z'))if(b-a>1e-6&&(bearingOutline===zone.outline||b-a>=1))for(let ply=0;ply<ref.beam.plies;ply++){
    const y=ref.beamBottomIn+ref.beamDepthIn/2,z=row.z+o.y+offset.z+(ply-(ref.beam.plies-1)/2)*1.5;
    out.beams.push({a:{x:a+offset.x,y,z},b:{x:b+offset.x,y,z},width:1.5,depth:ref.beamDepthIn});
  }
}

/** Joists (the engine's layout plus build-ups inside this zone) and the blocking rows of one zone. */
export function frameZoneJoists({zone,reference:ref}:FramedZone,offset:V3,cfg:ZoneFramingConfig,buildUps:number[],out:{joists:Member[];blocking:Member[]}){
  const o=zone.origin,w=zone.size.w,y=cfg.top-1-cfg.joistDepth/2;
  const ups=buildUps.filter(x=>x>=o.x&&x<=o.x+w);
  const regular=ref.joistXsIn.map(x=>Math.max(.75,Math.min(w-.75,x))+o.x).filter(x=>!ups.some(u=>Math.abs(u-x)<1.5));
  const joists:Member[]=[];
  for(const x of [...regular,...ups].sort((a,b)=>a-b))for(const [a,b]of outlineSpans(zone.outline,x,'x'))if(b-a>1e-6)joists.push({a:{x:x+offset.x,y,z:a+offset.z},b:{x:x+offset.x,y,z:b+offset.z},width:1.5,depth:cfg.joistDepth});
  // Blocking rows from the framing engine: no gap between rows or bearings over the code's 2100 mm.
  for(const z of ref.blockingZsIn.map(b=>b+o.y))for(let i=0;i<joists.length-1;i++){const a=joists[i],b=joists[i+1];if(z+offset.z<=Math.min(a.a.z,a.b.z)||z+offset.z>=Math.max(a.a.z,a.b.z)||z+offset.z<=Math.min(b.a.z,b.b.z)||z+offset.z>=Math.max(b.a.z,b.b.z)||b.a.x-a.a.x<2)continue;out.blocking.push({a:{x:a.a.x+.75,y:a.a.y,z:z+offset.z},b:{x:b.a.x-.75,y:b.a.y,z:z+offset.z},width:1.5,depth:cfg.joistDepth});}
  out.joists.push(...joists);
}

/** Back-line stretches beyond the house have no ledger: frame them like a freestanding deck's
 * house side, using the framing engine's own house-side beam and posts sized to that stretch. */
export function frameHouseSideBeams(stretches:[number,number][],depthIn:number,cfg:ZoneFramingConfig,offset:V3,out:{supports:V3[];beams:Member[]}){
  for(const [x0,x1] of stretches){
    const side=frameRectangle(framingInput(cfg,{w:x1-x0,h:depthIn},false));
    const row=side.beamRows.find(r=>r.kind==='house');if(!row)continue;
    for(const p of side.posts)if(p.row==='house')out.supports.push({x:x0+p.x+offset.x,y:Math.max(0,side.beamBottomIn),z:p.z+offset.z});
    for(let ply=0;ply<side.beam.plies;ply++){const y=side.beamBottomIn+side.beamDepthIn/2,z=row.z+offset.z+(ply-(side.beam.plies-1)/2)*1.5;out.beams.push({a:{x:x0+offset.x,y,z},b:{x:x1+offset.x,y,z},width:1.5,depth:side.beamDepthIn,role:'house-side-beam'});}
  }
}

/** Longest span of a doubled (two-ply) member of joist size, from the beam span table, carrying the joists of a
 * 10 × 10 ft attached deck. */
export function doubledMemberSpanIn(cfg:ZoneFramingConfig){
  const joistSize=cfg.framingSize as JoistSize;
  return frameRectangle(framingInput(cfg,{w:120,h:120},true,{beam:{size:joistSize,plies:2}})).beamSpanLimitIn;
}
