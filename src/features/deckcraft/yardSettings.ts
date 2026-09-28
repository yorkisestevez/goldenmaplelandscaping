import {PAVER_BRANDS} from '../../data/carrPrices';
import type {DeckData,TerrainConfig,YardAllowances,YardFeature,YardFeatureKind} from './types';
export const WALL_PRODUCTS=[{id:'segmental-concrete',name:'Segmental concrete wall'},{id:'armour-stone',name:'Armour stone wall'}];
export const WATER_PRODUCTS=[{id:'pond',name:'Pond'},{id:'pondless-waterfall',name:'Pondless waterfall'},{id:'fountain',name:'Fountain'}];
export const PATIO_PRODUCTS=PAVER_BRANDS.filter(p=>p.useCase!=='driveway');
export function getTerrainConfig(data:DeckData):TerrainConfig{return data.terrainConfig??{widthFt:Math.max(80,data.width+40),depthFt:Math.max(80,data.length+40),elevationIn:0,slopePct:0};}
export function newYardFeature(kind:YardFeatureKind,data:DeckData):YardFeature{
  return {id:`${kind}-${crypto.randomUUID()}`,kind,name:kind==='patio'?'Patio':kind==='retaining-wall'?'Retaining wall':'Water feature',enabled:true,xFt:data.width/2,zFt:data.length+10,widthFt:kind==='patio'?16:kind==='retaining-wall'?16:6,depthFt:kind==='patio'?12:kind==='retaining-wall'?1:6,heightIn:kind==='patio'?0:kind==='retaining-wall'?24:24,rotationDeg:0,productId:kind==='patio'?PATIO_PRODUCTS[0].id:kind==='retaining-wall'?WALL_PRODUCTS[0].id:WATER_PRODUCTS[0].id,color:kind==='water-feature'?'#657478':'#aaa69b'};
}

/** The cost estimator's finish tiers, in its words; they set the fire pit, kitchen and lighting allowances. */
export const ALLOWANCE_FINISHES=[{id:'budget',label:'Standard'},{id:'mid',label:'Elevated'},{id:'premium',label:'Premium'}] as const;
/** Artificial turf area, as the cost estimator offers it. */
export const TURF_SQFT={min:100,max:2000,default:500} as const;
export const NO_ALLOWANCES:YardAllowances={finish:'mid',firePit:'none',kitchen:'none',turfSqft:0,lighting:false};
export interface AllowanceItem {id:'firepit'|'kitchen'|'turf'|'lighting';label:string;words:string;sizes:Record<string,number|string>;details:Record<string,string>;usesFinish:boolean;quantity?:number;unit?:string}
/** The chosen allowances as cost-estimator elements, in a fixed order (fire pit, kitchen, turf, lighting). */
export function allowanceItems(a?:YardAllowances):AllowanceItem[]{
  if(!a)return [];
  const items:AllowanceItem[]=[];
  if(a.firePit!=='none')items.push({id:'firepit',label:a.firePit==='gas'?'Fire pit, natural gas or propane, with its gas line':'Fire pit, wood-burning',words:a.firePit==='gas'?'a gas fire pit':'a wood-burning fire pit',sizes:{firepit:'Medium'},details:{'firepit.fuel':a.firePit},usesFinish:true});
  if(a.kitchen!=='none')items.push({id:'kitchen',label:a.kitchen==='full'?'Outdoor kitchen, full build: services, appliances and finishes':'Outdoor kitchen, basic: counter, cabinet and a built-in grill',words:a.kitchen==='full'?'a full-build outdoor kitchen':'a basic outdoor kitchen',sizes:{kitchen:a.kitchen==='full'?'Full Build':'Basic'},details:{},usesFinish:true});
  if(a.turfSqft>0)items.push({id:'turf',label:`Artificial turf, ${a.turfSqft} sq ft`,words:`${a.turfSqft} sq ft of artificial turf`,sizes:{turf:a.turfSqft},details:{'turf.surface':'grass'},usesFinish:false,quantity:a.turfSqft,unit:'sq ft'});
  if(a.lighting)items.push({id:'lighting',label:'Landscape lighting for the yard',words:'landscape lighting',sizes:{lighting:'Medium'},details:{},usesFinish:true});
  return items;
}
