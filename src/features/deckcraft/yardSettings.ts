import {PAVER_BRANDS} from '../../data/carrPrices';
import type {DeckData,TerrainConfig,YardFeature,YardFeatureKind} from './types';
export const WALL_PRODUCTS=[{id:'segmental-concrete',name:'Segmental concrete wall'},{id:'armour-stone',name:'Armour stone wall'}];
export const WATER_PRODUCTS=[{id:'pond',name:'Pond'},{id:'pondless-waterfall',name:'Pondless waterfall'},{id:'fountain',name:'Fountain'}];
export const PATIO_PRODUCTS=PAVER_BRANDS.filter(p=>p.useCase!=='driveway');
export function getTerrainConfig(data:DeckData):TerrainConfig{return data.terrainConfig??{widthFt:Math.max(80,data.width+40),depthFt:Math.max(80,data.length+40),elevationIn:0,slopePct:0};}
export function newYardFeature(kind:YardFeatureKind,data:DeckData):YardFeature{
  return {id:`${kind}-${crypto.randomUUID()}`,kind,name:kind==='patio'?'Patio':kind==='retaining-wall'?'Retaining wall':'Water feature',enabled:true,xFt:data.width/2,zFt:data.length+10,widthFt:kind==='patio'?16:kind==='retaining-wall'?16:6,depthFt:kind==='patio'?12:kind==='retaining-wall'?1:6,heightIn:kind==='patio'?0:kind==='retaining-wall'?24:24,rotationDeg:0,productId:kind==='patio'?PATIO_PRODUCTS[0].id:kind==='retaining-wall'?WALL_PRODUCTS[0].id:WATER_PRODUCTS[0].id,color:kind==='water-feature'?'#657478':'#aaa69b'};
}
