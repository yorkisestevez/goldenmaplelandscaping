import type {FixturePlacement} from './extrasLayout';
import {getLightingProduct} from './lightingCatalogue';

/** Real preview lights are costly: at most this many fixtures cast light in the 3D preview (the rest glow). */
export const MAX_PREVIEW_LIGHTS=16;
/**
 * Each shadow-casting light takes a texture unit in every lit material, and WebGL allows 16 per shader; the
 * materials' own maps, the sun's shadow and the environment map already use several. So only the first few
 * preview lights cast shadows and the rest light the scene without them. With all 16 casting, a well-lit design
 * failed to compile its textured materials at night and the boards, grass and glass vanished.
 */
export const MAX_SHADOW_LIGHTS=4;

export const isIlluminatingFixture=(id:string)=>{const p=getLightingProduct(id);return !!p?.supported&&['recessed','wall','undercap','bollard','spot','pendant','ceiling'].includes(p.geometry);};

/**
 * Which fixtures get a real preview light, and which of those cast shadows: fixture index to "casts a shadow".
 * Lights are shared across zones round-robin instead of spent on the first zone, and so are the shadows.
 */
export function previewLightPlan(items:FixturePlacement[]):Map<number,boolean>{
  const zones=new Map<string,number[]>();
  items.forEach((p,i)=>{if(isIlluminatingFixture(p.productId))zones.set(p.zone??'',[...(zones.get(p.zone??'')??[]),i]);});
  const queues=[...zones.values()],picked:number[]=[];
  for(let round=0;picked.length<MAX_PREVIEW_LIGHTS&&queues.some(q=>round<q.length);round++)for(const q of queues)if(round<q.length&&picked.length<MAX_PREVIEW_LIGHTS)picked.push(q[round]);
  return new Map(picked.map((index,order)=>[index,order<MAX_SHADOW_LIGHTS]));
}
