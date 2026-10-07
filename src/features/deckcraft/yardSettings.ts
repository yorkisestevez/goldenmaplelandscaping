import {sampleSiteHeight} from './siteSurface';
import {PAVER_BRANDS} from '../../data/carrPrices';
import {GROUND_FIT_LIMITS,type DeckData,type TerrainConfig,type YardAllowances,type YardFeature,type YardFeatureKind} from './types';
export const WALL_PRODUCTS=[{id:'segmental-concrete',name:'Segmental concrete wall'},{id:'armour-stone',name:'Armour stone wall'}];
export const WATER_PRODUCTS=[{id:'pond',name:'Pond'},{id:'pondless-waterfall',name:'Pondless waterfall'},{id:'fountain',name:'Fountain'}];
export const PATIO_PRODUCTS=PAVER_BRANDS.filter(p=>p.useCase!=='driveway');
/**
 * Fire features (yard kind 'fire-feature'): the products, priced at the cost estimator's fire pit allowance. Sizes are
 * inches: `min`/`max` bound the width (a round product's diameter, a linear table's length); a round product is as deep
 * as it is wide. Only the products and a new feature ship with the first estimate and the pricing worker; their
 * validation (fireFeatures.ts) and model (fireFeatureModel.ts) load with the advanced yard runtime.
 */
export const FIRE_PRODUCTS=[
 {id:'fire-wood-ring',name:'Wood-burning fire ring',fuel:'wood',round:true,min:36,max:48},
 {id:'fire-gas-bowl',name:'Gas fire bowl',fuel:'gas',round:true,min:30,max:48},
 {id:'fire-gas-linear',name:'Linear gas fire table',fuel:'gas',round:false,min:48,max:84},
] as const;
export const fireProduct=(f:{productId:string})=>FIRE_PRODUCTS.find(p=>p.id===f.productId);
/** A new 42 in gas fire bowl on its own gravel pad, centred on the deck 10 ft out from its front edge, or at `near`.
 * Gas by default: Barrie needs no burn permit for it, while an open wood fire needs a daily permit and 15 m. */
export function newFireFeature(data:DeckData,near?:{xFt:number;zFt:number}):YardFeature{
 return {id:`fire-feature-${crypto.randomUUID()}`,kind:'fire-feature',name:'Fire bowl',enabled:true,xFt:near?.xFt??data.width/2,zFt:near?.zFt??data.length+10,widthFt:3.5,depthFt:3.5,heightIn:16,rotationDeg:0,productId:'fire-gas-bowl',color:'#aaa69b'};
}
export function getTerrainConfig(data:DeckData):TerrainConfig{return data.terrainConfig??{widthFt:Math.max(80,data.width+40),depthFt:Math.max(80,data.length+40),elevationIn:0,slopePct:0};}
export function newYardFeature(kind:YardFeatureKind,data:DeckData,at?:{xFt:number;zFt:number}):YardFeature{
  if(kind==='fire-feature')return newFireFeature(data,at);
  const xFt=at?.xFt??data.width/2,zFt=at?.zFt??data.length+10,heightIn=kind==='patio'?0:24,ground=sampleSiteHeight(data,xFt*12,zFt*12);
  if(kind!=='water-feature'&&!Number.isFinite(ground))throw Error('Survey the default feature centre before placing a fixed finished surface.');
  return fitNewPatio(data,{...(kind!=='water-feature'?{finishedElevationIn:ground!+heightIn}:{}),...(kind==='patio'?{patioSlope:{xPct:0,zPct:0}}:{}),id:`${kind}-${crypto.randomUUID()}`,kind,name:kind==='patio'?'Patio':kind==='retaining-wall'?'Retaining wall':'Water feature',enabled:true,xFt,zFt,widthFt:kind==='patio'?16:kind==='retaining-wall'?16:6,depthFt:kind==='patio'?12:kind==='retaining-wall'?1:6,heightIn:kind==='patio'?0:kind==='retaining-wall'?24:24,rotationDeg:0,productId:kind==='patio'?PATIO_PRODUCTS[0].id:kind==='retaining-wall'?WALL_PRODUCTS[0].id:WATER_PRODUCTS[0].id,color:kind==='water-feature'?'#657478':'#aaa69b'});
}
/** The one place a new patio gets its ground fit, however it is added (Backyard, plan drawing, starters, wizard, sketch):
 * on measured ground it sits level with the ground at its centre, to the nearest 1/4 in, and the ground round it is graded
 * at the default 3:1. Legacy yards, walls and steps come back unchanged; saved designs never pass through here. */
export function fitNewPatio(data:DeckData,f:YardFeature):YardFeature{const g=f.kind==='patio'&&data.siteModel&&!f.stoneSteps&&!f.stepAssembly?sampleSiteHeight(data,f.xFt*12,f.zFt*12):undefined;return typeof g==='number'&&Number.isFinite(g)?{...f,finishedElevationIn:Math.round((g+f.heightIn)*4)/4,patioSlope:f.patioSlope??{xPct:0,zPct:0},groundFit:f.groundFit??{slopeRatio:GROUND_FIT_LIMITS.defaultRatio}}:f;}

/** The cost estimator's finish tiers, in its words; they set the fire pit, kitchen and lighting allowances. */
export const ALLOWANCE_FINISHES=[{id:'budget',label:'Standard'},{id:'mid',label:'Elevated'},{id:'premium',label:'Premium'}] as const;
/** Artificial turf area, as the cost estimator offers it. */
export const TURF_SQFT={min:100,max:2000,default:500} as const;
export const NO_ALLOWANCES:YardAllowances={finish:'mid',firePit:'none',kitchen:'none',turfSqft:0,lighting:false};
export interface AllowanceItem {id:'firepit'|'kitchen'|'turf'|'lighting';label:string;words:string;sizes:Record<string,number|string>;details:Record<string,string>;usesFinish:boolean;quantity?:number;unit?:string;
  /** A placed fire feature priced as the fire pit. */
  featureId?:string}
/** The chosen allowances as cost-estimator elements, in a fixed order (fire pit, kitchen, turf, lighting). A placed
 * `fire` feature is the fire pit, at its own fuel (yardTakeoff then passes the allowances with no fire pit of their own). */
export function allowanceItems(given?:YardAllowances,fire?:YardFeature):AllowanceItem[]{
  if(!given&&!fire)return [];
  const a=given??NO_ALLOWANCES,p=fire&&fireProduct(fire),fuel=p?p.fuel:a.firePit,items:AllowanceItem[]=[];
  if(fuel!=='none')items.push({id:'firepit',label:p?`${fire!.name}: ${p.name.toLowerCase()}${fuel==='gas'?' with its gas line':''}`:fuel==='gas'?'Fire pit, natural gas or propane, with its gas line':'Fire pit, wood-burning',words:fuel==='gas'?'a gas fire pit':'a wood-burning fire pit',sizes:{firepit:'Medium'},details:{'firepit.fuel':fuel},usesFinish:true,...(p&&{featureId:fire!.id})});
  if(a.kitchen!=='none')items.push({id:'kitchen',label:a.kitchen==='full'?'Outdoor kitchen, full build: services, appliances and finishes':'Outdoor kitchen, basic: counter, cabinet and a built-in grill',words:a.kitchen==='full'?'a full-build outdoor kitchen':'a basic outdoor kitchen',sizes:{kitchen:a.kitchen==='full'?'Full Build':'Basic'},details:{},usesFinish:true});
  if(a.turfSqft>0)items.push({id:'turf',label:`Artificial turf, ${a.turfSqft} sq ft`,words:`${a.turfSqft} sq ft of artificial turf`,sizes:{turf:a.turfSqft},details:{'turf.surface':'grass'},usesFinish:false,quantity:a.turfSqft,unit:'sq ft'});
  if(a.lighting)items.push({id:'lighting',label:'Landscape lighting for the yard',words:'landscape lighting',sizes:{lighting:'Medium'},details:{},usesFinish:true});
  return items;
}
