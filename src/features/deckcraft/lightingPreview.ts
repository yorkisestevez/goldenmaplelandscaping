import type {FixturePlacement} from './extrasLayout';
import {fixtureNight} from './fixtureLight';
import {getLightingProduct} from './lightingCatalogue';

/**
 * Real three lights are costly: at most this many long-throw fixtures (house wall, bollard, spot, pendant, deck
 * uplight) get one in the 3D preview. Near-field fixtures (under-step, post and screen-post lights) don't count: they
 * all light their surroundings through the fixture light patch (fixtureLighting.ts), and a post-cap PUCK only glows.
 */
export const MAX_PREVIEW_LIGHTS=16;
/**
 * Each shadow-casting light takes a texture unit in every lit material, and WebGL allows 16 per shader; the
 * materials' own maps, the sun's shadow, the environment map and the fixture light texture already use several. So only
 * the first few preview lights cast shadows and the rest light the scene without them. With all 16 casting, a well-lit
 * design failed to compile its textured materials at night and the boards, grass and glass vanished.
 */
export const MAX_SHADOW_LIGHTS=4;

/** A fixture that gives off light at all (as opposed to transformers, cable and accessories). */
export const isIlluminatingFixture=(id:string)=>{const p=getLightingProduct(id);return !!p?.supported&&['recessed','wall','undercap','bollard','spot','pendant','ceiling'].includes(p.geometry);};
/** A fixture drawn with a real three light in the night preview (the rest light through the patch, or only glow). */
export const castsPreviewLight=(productId:string,zone?:string)=>fixtureNight(productId,zone).route==='real';

/**
 * Which fixtures get a real preview light, and which of those cast shadows: fixture index to "casts a shadow".
 * Lights are shared across zones round-robin instead of spent on the first zone. Shadows go to the fixtures whose
 * shadows read furthest (spots and bollards, then house and overhead lights, then deck uplights), zones taking turns
 * within each rank; a step or post light never casts one.
 */
export function previewLightPlan(items:FixturePlacement[]):Map<number,boolean>{
  const zones=new Map<string,number[]>();
  items.forEach((p,i)=>{if(castsPreviewLight(p.productId,p.zone))zones.set(p.zone??'',[...(zones.get(p.zone??'')??[]),i]);});
  const queues=[...zones.values()],picked:number[]=[];
  for(let round=0;picked.length<MAX_PREVIEW_LIGHTS&&queues.some(q=>round<q.length);round++)for(const q of queues)if(round<q.length&&picked.length<MAX_PREVIEW_LIGHTS)picked.push(q[round]);
  const priority=(i:number)=>fixtureNight(items[i].productId,items[i].zone).shadowPriority;
  const shadows=new Set(picked.filter(i=>priority(i)>0).sort((a,b)=>priority(b)-priority(a)).slice(0,MAX_SHADOW_LIGHTS));
  return new Map(picked.map(index=>[index,shadows.has(index)]));
}
