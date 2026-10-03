import type {DeckData,LightingZone} from './types';
import type {DeckTakeoff,V3} from './deckTakeoff';
import type {LightingCatalogueProduct,LightingGeometry} from './lightingCatalogue';
import type {FixturePlacement} from './extrasLayout';
import {finishedFasciaOffset} from './lib/finishedFootprint';

export interface LightingPlacementOverride {
  productId:string; index:number; targetId:string; positionPct:number; face:'inside'|'outside';
}
export interface LightingTarget {id:string;label:string;zone:LightingZone;a:V3;b:V3;angle:number;length:number}
export const LIGHTING_MOUNT_ZONES:readonly [LightingZone,string][]=[['deck','Deck surface / fascia'],['posts','Railing posts'],['rails','Under level railings'],['stairs','Stair treads / risers'],['landscape','Landscape'],['house','House']];
export const allowedLightingMounts=(g:LightingGeometry):LightingZone[]=>g==='recessed'?['deck','posts','stairs','landscape']:g==='wall'?['deck','posts','stairs','house']:g==='undercap'?['deck','rails','stairs']:g==='bollard'||g==='spot'?['landscape']:['house'];
const pointKey=(p:V3)=>[p.x,p.y,p.z].map(n=>Number(n.toFixed(4))).join(':');
const key=(kind:string,a:V3,b=a)=>`${kind}_${pointKey(a)}|${pointKey(b)}`;
const interpolate=(a:V3,b:V3,t:number):V3=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
/** Catalogue wall width is across its face; length is its projection from the wall. */
export function lightingEnvelope(p:LightingCatalogueProduct){const d=p.dimensionsIn;return p.geometry==='wall'?{length:d.diameter??d.width??2,depth:d.diameter?(d.height??d.length??1):d.length??1}:{length:d.length??d.diameter??d.width??2,depth:d.diameter??d.width??1};}

/** Coordinate-bound targets never silently transfer to another post after a geometry edit. */
export function lightingTargets(data:DeckData,model:DeckTakeoff,zone:LightingZone):LightingTarget[]{
  if(model.railing.frameless&&(zone==='posts'||zone==='rails'))return [];
  if(zone==='posts')return model.railing.posts.map((p,i)=>{
    const level=[...model.levels].sort((a,b)=>Math.abs(a.top-p.y)-Math.abs(b.top-p.y))[0];
    const dx=level.offset.x+level.footprint.bounds.w/2-p.x,dz=level.offset.z+level.footprint.bounds.h/2-p.z;
    const angle=Math.abs(dx)>Math.abs(dz)?(dx>0?Math.PI/2:-Math.PI/2):(dz>0?0:Math.PI);
    const a={...p,y:p.y+model.railing.height};return {id:key('post',p),label:`Post ${i+1}`,zone,a,b:a,angle,length:3.5};
  });
  if(zone==='rails')return model.railing.sections.filter(s=>s.enabled&&Math.abs(s.a.y-s.b.y)<.01).map((r,i)=>{
    const a={...r.a,y:r.a.y+model.railing.height-3},b={...r.b,y:r.b.y+model.railing.height-3};
    return {id:key('rail',r.a,r.b),label:`Level rail ${i+1}`,zone,a,b,angle:-Math.atan2(b.z-a.z,b.x-a.x),length:Math.hypot(b.x-a.x,b.z-a.z)};
  });
  if(zone==='stairs')return model.treads.filter(t=>t.kind!=='winder').map((t,i)=>{
    const angle=t.angle??0,dx=Math.cos(angle),dz=-Math.sin(angle);
    const a={x:t.x-dx*t.w/2,y:t.y+t.h/2,z:t.z-dz*t.w/2},b={x:t.x+dx*t.w/2,y:a.y,z:t.z+dz*t.w/2};
    return {id:key('tread',{x:t.x,y:t.y,z:t.z}),label:`Tread ${i+1}`,zone,a,b,angle,length:t.w};
  });
  if(zone==='deck')return model.levels.flatMap((l,li)=>l.footprint.outline.flatMap((p,i)=>{
    const q=l.footprint.outline[(i+1)%l.footprint.outline.length];
    if(li===0&&(data.deckType==='Attached'||data.deckType==='Add-on')&&Math.abs(p.y)<.01&&Math.abs(q.y)<.01)return [];
    const a={x:p.x+l.offset.x,y:l.top,z:p.y+l.offset.z},b={x:q.x+l.offset.x,y:l.top,z:q.y+l.offset.z},length=Math.hypot(b.x-a.x,b.z-a.z);
    if(length<12)return [];
    // Conservative: do not offer an edge if any portion touches another same-height
    // platform. A partial exposed run needs a separately segmented mounting detail.
    const ux=(b.x-a.x)/length,uz=(b.z-a.z)/length;
    if(model.levels.some((other,oi)=>oi!==li&&Math.abs(other.top-l.top)<.1&&other.footprint.outline.some((v,vi)=>{
      const w=other.footprint.outline[(vi+1)%other.footprint.outline.length],x=v.x+other.offset.x,z=v.y+other.offset.z,xx=w.x+other.offset.x,zz=w.y+other.offset.z;
      if(Math.abs((x-a.x)*uz-(z-a.z)*ux)>.1||Math.abs((xx-a.x)*uz-(zz-a.z)*ux)>.1)return false;
      const t=(x-a.x)*ux+(z-a.z)*uz,s=(xx-a.x)*ux+(zz-a.z)*uz;return Math.min(length,Math.max(t,s))-Math.max(0,Math.min(t,s))>.1;
    })))return [];
    return [{id:key('edge',a,b),label:`${l.kind==='landing'?'Landing':`Deck ${li+1}`} edge ${i+1}`,zone,a,b,length,angle:-Math.atan2(b.z-a.z,b.x-a.x)}];
  }));
  return [];
}

export function placeLightingOnTarget(data:DeckData,model:DeckTakeoff,product:LightingCatalogueProduct,target:LightingTarget,positionPct=50,face:'inside'|'outside'='inside'):{fixture?:FixturePlacement;warning?:string}{
  if(!allowedLightingMounts(product.geometry).includes(target.zone))return {warning:`${product.name} does not support this preview mounting type.`};
  const dim=product.dimensionsIn,g=product.geometry,{length,depth}=lightingEnvelope(product);
  if(length+(target.zone==='posts'?0:4)>target.length)return {warning:`${product.name} does not fit ${target.label} at its catalogue size.`};
  const margin=target.zone==='posts'?0:(length/2+2)/target.length;
  const t=margin+(1-2*margin)*Math.max(0,Math.min(100,positionPct))/100;
  const p=interpolate(target.a,target.b,t);let angle=target.angle;
  if(target.zone==='posts'){
    if(g==='recessed')p.y+=.18;
    else {p.y-=7;if(face==='outside')angle+=Math.PI;const offset=1.75+depth/2;p.x+=Math.sin(angle)*offset;p.z+=Math.cos(angle)*offset;}
  }else if(target.zone==='rails'){
    p.y-=.6;if(face==='outside')angle+=Math.PI;
  }else if(target.zone==='stairs'){
    const tread=model.treads.find(t=>key('tread',{x:t.x,y:t.y,z:t.z})===target.id)!;
    if(g==='recessed')p.y+=.15;
    else {const forward=tread.d/2-(g==='undercap'?.1:model.stairSupport.treadNosingIn-depth/2);p.x+=Math.sin(angle)*forward;p.z+=Math.cos(angle)*forward;p.y-=tread.h+(g==='undercap'?.55:2.7);}
  }else if(target.zone==='deck'){
    const inset=g==='recessed'?4:-(finishedFasciaOffset(data)+(g==='wall'?depth/2:.2));p.x+=Math.sin(angle)*inset;p.z+=Math.cos(angle)*inset;p.y+=g==='recessed'?.15:g==='undercap'?-1.7:-4.5;
    if(g!=='recessed')angle+=Math.PI;
    if(model.treads.some(t=>Math.abs(t.y-target.a.y)<10&&Math.hypot(t.x-p.x,t.z-p.z)<t.w/2+6))return {warning:`${product.name} at ${target.label} is too close to a stair opening; move the fixture.`};
  }
  return {fixture:{productId:product.id,...p,angle,zone:target.zone}};
}

export function lightingMountNotes(product:LightingCatalogueProduct,zone:LightingZone):string[]{
  const notes=['Preview placement is not a drilling or wiring detail. Confirm the fixture, substrate, cable route and mounting accessories.'];
  if(zone==='posts'||zone==='rails')notes.push('Do not drill or modify a proprietary guard/post without its manufacturer-approved detail; fittings may need a separate mounting plate.');
  if(product.geometry==='undercap')notes.push('Verify the required cap/overhang and full-length support. An undercap fixture shown in 3D does not create a suitable mounting recess.');
  if(zone==='rails')notes.push('This placement tool supports level deck/landing rail runs. Sloping stair rail lighting requires a separate reviewed mounting detail.');
  if(product.geometry==='recessed')notes.push('Check recess depth, joist conflicts, cable access and permitted hole location before drilling decking or a post cap.');
  return notes;
}
