import type {DeckData} from '../types';
import type {EdgeContact,FootprintPlan,PlanPoint} from './deckGeometry';
import {MANUFACTURER_ACCESSORIES} from '../manufacturerRuntimeCatalogue';

export const PICTURE_FRAME_OVERHANG_IN=1.5;
/** Mounting space for under-edge / under-step EVO HYDE fixtures (in-lite 5–6 cm). Shared by the
 * picture-frame border option and lit stair nosings so the step-up matches the deck edge. */
export const LIGHTING_MOUNTING_SPACE_IN=2.5;
/** The lighting option is an explicit custom supported/recessed edge concept. The
 * ordinary saved overhang remains unchanged, and returns when the option is off. */
export const pictureFrameOverhang=(data:DeckData)=>data.autoLighting?.border&&(data.pictureFrameRows||data.pattern==='Picture Frame')?LIGHTING_MOUNTING_SPACE_IN:Math.max(0,Math.min(1.5,data.pictureFrameOverhangIn??PICTURE_FRAME_OVERHANG_IN));
/** Tread nose depth: ordinary ½ in, or the lighting mounting space when under-step or border lights are on. */
export const lightingTreadNosing=(data:DeckData)=>data.autoLighting?.stairs||data.autoLighting?.border?LIGHTING_MOUNTING_SPACE_IN:.5;
/** Structural outline follows rim centre lines in the existing construction model. */
export function finishedFasciaOffset(data:DeckData){
  return MANUFACTURER_ACCESSORIES.some(p=>p.kind==='fascia'&&data.catalogueAccessories?.includes(p.id))?1.525:.75;
}
/** Offset each exposed perimeter line, then intersect neighbouring lines for true mitres.
 * Width/depth inputs remain the structural footprint. Ledger (house contact) lines stay put.
 */
export function getFinishedFootprint(data:DeckData,fp:FootprintPlan,contact?:EdgeContact):FootprintPlan{
  if(!(data.pictureFrameRows||data.pattern==='Picture Frame'))return fp;
  const projection=finishedFasciaOffset(data)+pictureFrameOverhang(data),p=fp.outline;
  const lines=p.map((a,i)=>{const b=p[(i+1)%p.length],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),offset=contact?.isContactEdge(i)||contact?.isFlushEdge?.(i)?0:projection;return {a:{x:a.x+dy/len*offset,y:a.y-dx/len*offset},v:{x:dx/len,y:dy/len}};});
  const outline:PlanPoint[]=lines.map((line,i)=>{const prev=lines[(i+lines.length-1)%lines.length],cross=prev.v.x*line.v.y-prev.v.y*line.v.x;
    if(Math.abs(cross)<1e-8)return line.a;
    const dx=line.a.x-prev.a.x,dy=line.a.y-prev.a.y,t=(dx*line.v.y-dy*line.v.x)/cross;
    return {x:prev.a.x+prev.v.x*t,y:prev.a.y+prev.v.y*t};
  });
  // Bounds intentionally keep the structural origin/size: consumers position breakers
  // and centrelines in the same coordinate system; the actual outline carries extents.
  return {...fp,outline};
}
export function pictureFrameCompatibility(data:DeckData):string[]{
  if(!(data.pictureFrameRows||data.pattern==='Picture Frame'))return [];
  const overhang=pictureFrameOverhang(data),notes=[`Deck width/depth refer to the structural rim centre-line footprint. Exposed outer picture-frame edges project ${overhang} in beyond the finished rim/fascia; the house edge terminates at the ledger.`];
  if(data.autoLighting?.border)notes.push('The 2.5 in lighting border is a custom supported/recessed edge concept. Extra support is not shown as verified framing; obtain the manufacturer-compatible builder detail and quote before construction. EVO HYDE 550 needs 5–6 cm mounting space under an overhang.');
  if(['tt_vintage','tt_landmark','tt_harvest','tt_harvest_plus'].includes(data.deckingMaterial)){if(overhang>.5)notes.push(`Requested ${overhang} in picture-frame overhang exceeds TimberTech Advanced PVC’s 0.5 in installation limit. Reduce the overhang control to 0.5 in or obtain an approved alternative edge assembly. Source: TimberTech Advanced PVC Decking Installation Guide.`);}
  else if(data.deckingMaterial.startsWith('tt_')){if(overhang>1)notes.push(`Requested ${overhang} in picture-frame overhang exceeds TimberTech Composite’s 1 in limit. Reduce the overhang or confirm an alternative edge assembly. Source: TimberTech Composite Installation Guide, page 2.`);if(['tt_terrain','tt_terrain_plus','tt_prime','tt_prime_plus'].includes(data.deckingMaterial))notes.push('Scalloped Terrain / Prime boards permit end overhang only. The outer side of picture-frame boards requires supported, supplier-approved edge detailing even when the overall projection is reduced.');}
  if(['deck_voyage','deck_summit'].includes(data.deckingMaterial)&&overhang>1)notes.push(`Requested ${overhang} in picture-frame overhang exceeds Deckorators Surestone’s 1 in cantilever limit. Reduce the overhang control or obtain an approved alternative edge assembly. Source: Deckorators Surestone Technology installation instructions.`);
  return notes;
}
