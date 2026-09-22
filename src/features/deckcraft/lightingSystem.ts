import type {DeckData,LightingZone} from './types';
import {getLightingProduct,type LightingCatalogueProduct} from './lightingCatalogue';

export function defaultLightingZone(product:LightingCatalogueProduct):LightingZone{
  if(product.geometry==='recessed')return 'deck';
  if(product.geometry==='wall'||product.geometry==='undercap')return 'stairs';
  if(product.geometry==='bollard'||product.geometry==='spot')return 'landscape';
  return 'house';
}
export const isSystemProduct=(p:LightingCatalogueProduct)=>['transformer','cable','accessory'].includes(p.geometry);

type SelectedLight=DeckData['lightingSystem']['selectedItems'][number];
export const MAX_FIXTURE_QTY=30;
/** Simple options use existing price-book allowances only; no new rates. */
/** Under-step styles: both mount under the tread nose (undercap). EVO FLEX has no price-book rate yet. */
export const STAIR_LIGHT_STYLES={
  evo_hyde:{productId:'evo_hyde',label:'EVO HYDE under-step light',note:'Existing price-book allowance'},
  evo_flex:{productId:'evo_flex_1_kit',label:'EVO FLEX 1 m LED strip',note:'Supplier / installation quote required · needs stairs about 44 in wide'},
} as const;
export const stairLightProductId=(data:DeckData)=>STAIR_LIGHT_STYLES[data.autoLighting?.stairStyle??'evo_hyde'].productId;
export const AUTO_LIGHTING={
  posts:{productId:'puck',zone:'posts'},
  stairs:{productId:STAIR_LIGHT_STYLES.evo_hyde.productId,zone:'stairs'},
  privacy:{productId:'blink',zone:'privacy'},
  transformer:{productId:'hub100'},
} as const satisfies Record<string,{productId:string;zone?:LightingZone}>;
/** Keeps simple-option fixtures equal to the modeled mounts (posts, treads, lit screen posts).
 * Manual selections are untouched unless they reuse a product the simple option now manages. */
export function syncAutoLighting(data:DeckData,counts:{posts:number;stairs:number;privacy:number}):SelectedLight[]{
  const items=data.lightingSystem?.selectedItems??[];
  const wanted:SelectedLight[]=[];
  const add=(spec:{productId:string;zone:LightingZone},count:number)=>{if(count>0)wanted.push({productId:spec.productId,qty:Math.min(MAX_FIXTURE_QTY,count),zone:spec.zone,auto:true});};
  if(data.autoLighting?.posts)add(AUTO_LIGHTING.posts,counts.posts);
  if(data.autoLighting?.stairs)add({productId:stairLightProductId(data),zone:'stairs'},counts.stairs);
  add(AUTO_LIGHTING.privacy,counts.privacy);
  const managed=new Set(wanted.map(w=>w.productId));
  const manual=items.filter(i=>!i.auto&&!managed.has(i.productId));
  const hasTransformer=manual.some(i=>getLightingProduct(i.productId)?.geometry==='transformer');
  if(wanted.length&&!hasTransformer)wanted.push({productId:AUTO_LIGHTING.transformer.productId,qty:1,auto:true});
  return [...manual,...wanted];
}
/** Installation selection alone determines quantities; preview switches never change a purchase. */
export function activeLightingItems(data:DeckData){
  return (data.lightingSystem?.selectedItems??[]).flatMap(item=>{
    const product=getLightingProduct(item.productId);if(!product||!product.supported||item.qty<=0)return [];
    const zone=item.zone??defaultLightingZone(product);
    if(!isSystemProduct(product)&&data.lightingZoneEnabled?.[zone]===false)return [];
    return [{...product,qty:item.qty,zone,productId:product.id}];
  });
}
export function lightingSystemCheck(data:DeckData){
  const items=activeLightingItems(data),warnings:string[]=[],fixtures=items.filter(p=>!isSystemProduct(p)),hubs=items.filter(p=>p.transformer),cables=items.filter(p=>p.cable);
  const unknownLoad=fixtures.filter(p=>p.va===undefined),knownLoadVa=fixtures.reduce((n,p)=>n+(p.va??0)*p.qty,0),capacityVa=hubs.reduce((n,p)=>n+p.transformer!.capacityVa*p.qty,0);
  if(fixtures.length&&!hubs.length)warnings.push('Lighting requires a compatible transformer; none is included.');
  if(unknownLoad.length)warnings.push(`Transformer sizing remains unresolved: VA load needs confirmation for ${unknownLoad.map(p=>p.name).join(', ')}.`);
  if(knownLoadVa>capacityVa&&hubs.length)warnings.push(`Known fixture load ${knownLoadVa.toFixed(1)} VA exceeds included transformer capacity ${capacityVa} VA.`);
  if(hubs.length&&fixtures.length)warnings.push('Allocate fixtures to individual transformer cable lines and confirm voltage drop before installation; total capacity alone does not verify each circuit.');
  const distance=Math.max(0,data.lightingSystem?.wireDistance??0);
  for(const item of items){
    if(item.configurationRequired)warnings.push(`${item.name}: choose the exact installation configuration with the supplier.`);
    for(const warning of item.specWarnings)warnings.push(`${item.name}: ${warning}`);
    for(const id of item.requiredAccessoryIds??[])if(!items.some(p=>p.id===id))warnings.push(`${item.name} requires ${getLightingProduct(id)?.name??id}; it is not included.`);
    if(item.requiresSmartHub&&!hubs.some(h=>h.transformer!.smart))warnings.push(`${item.name} requires a compatible Smart HUB.`);
    if(item.compatibleTransformerIds?.length&&hubs.length&&!hubs.some(h=>item.compatibleTransformerIds!.includes(h.id)))warnings.push(`${item.name} requires ${item.compatibleTransformerIds.map(id=>getLightingProduct(id)?.name??id).join(' or ')}.`);
    for(const hub of hubs)if(item.incompatibleTransformerIds?.includes(hub.id)||hub.incompatibleProductIds?.includes(item.id))warnings.push(`${item.name} is incompatible with ${hub.name}; use a separate compatible circuit.`);
    if(item.requiredCableGauge&&!cables.some(c=>c.cable!.gauge===item.requiredCableGauge))warnings.push(`${item.name} requires ${item.requiredCableGauge} cable; include the specified cable rather than relying on the generic wire allowance.`);
    if(item.maxCableRunFt&&distance>item.maxCableRunFt)warnings.push(`${item.name}: requested ${distance} ft cable run exceeds its ${item.maxCableRunFt.toFixed(0)} ft limit.`);
    if(item.transformer)for(const cable of cables){const max=item.transformer.maxCableLengthFt[cable.cable!.gauge];if(max!==undefined&&distance>max)warnings.push(`${item.name} with ${cable.cable!.gauge}: requested run exceeds ${max.toFixed(0)} ft.`);}
  }
  if(cables.length&&cables.reduce((n,c)=>n+c.cable!.lengthFt*c.qty,0)<distance)warnings.push('Selected cable reels do not cover the requested installed cable length.');
  return {items,warnings:[...new Set(warnings)],knownLoadVa,capacityVa,unknownLoad:unknownLoad.map(p=>p.id)};
}
