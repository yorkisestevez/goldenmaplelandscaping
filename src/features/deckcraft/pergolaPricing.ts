import type {DeckData} from './types';
import {pergolaProduct,pergolaVariant,PERGOLA_CATALOG_VERSION} from './pergolaCostCatalog';
import {pergolaSize} from './pergolaValidation';
export interface PergolaQuoteContext{key:string;quote:PergolaQuote}
export interface PergolaQuote{ supply?:number|null;accessories?:Record<string,number|null>;labour?:number|null;delivery?:number|null;anchoring?:number|null;structural?:number|null;electrical?:number|null;supplyConfirmed?:boolean;availabilityConfirmed?:boolean }
export const PERGOLA_SITE_COSTS=[['labour','Installation labour'],['delivery','Delivery'],['anchoring','Anchoring'],['structural','Structural preparation'],['electrical','Electrical']] as const;
const validCost=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1000000;
export function cleanPergolaQuote(value:unknown):PergolaQuote{
 if(!value||typeof value!=='object')return {};const v=value as PergolaQuote,q:PergolaQuote={};
 for(const key of ['supply',...PERGOLA_SITE_COSTS.map(([k])=>k)] as const)if(validCost(v[key]))q[key]=v[key];
 q.accessories=Object.fromEntries(Object.entries(v.accessories??{}).filter(([id,cost])=>id.length<100&&validCost(cost)));
 q.supplyConfirmed=v.supplyConfirmed===true;q.availabilityConfirmed=v.availabilityConfirmed===true;return q;
}
/** Changes to the site or supply scope must not reuse confirmations for a different installation. */
export const pergolaQuoteKey=(d:DeckData)=>JSON.stringify([PERGOLA_CATALOG_VERSION,d.pergola&&{...d.pergola,louverDeg:0},d.width,d.length,d.height,d.shape,d.cutoutWidth,d.cutoutLength,d.cutoutWidth2,d.cutoutLength2,d.cornerChamfers,d.customFront,d.wrap,d.levels,d.width2,d.length2,d.height2,d.level2Position,d.level2Offset,d.level3,d.yardFeatures?.map(({color:_color,...feature})=>feature),d.terrainConfig,d.foundation,d.foundationDepthIn,d.soilCondition,d.framingSize,d.joistSpacing,d.stairFlights,d.stairType,d.stairWidth,d.stairPosition,d.stairOffset,d.privacyScreens,d.benchLf,d.housePlacement,d.houseConfig&&[d.houseConfig.widthFt,d.houseConfig.depthFt,d.houseConfig.storeys,d.houseConfig.storeyHeightIn,d.houseConfig.floorHeightIn,d.houseConfig.roofShape,d.houseConfig.roofPitch,d.houseConfig.ridge,d.houseConfig.footprint]])+(d.deckOutlines||d.deckOutlineOffsets||d.boardLayout||d.railSections||d.railDefault||d.underDeck?JSON.stringify([d.deckOutlines,d.deckOutlineOffsets,d.boardLayout,d.railSections,d.railDefault,d.underDeck]):'')+JSON.stringify([d.customerName,d.projectAddress,d.municipality,d.siteType]);
export function pergolaPricing(data:DeckData,markup=35,raw?:PergolaQuote){
 const s=data.pergola,p=s&&pergolaProduct(s),v=s&&pergolaVariant(s);if(!s||!p||!v)return null;
 const q=cleanPergolaQuote(raw),mult=1+markup/100,outstanding:string[]=[],items:{name:string;spec:string;qty:number;unit:string;cost:number|null}[]=[];
 const supplied=s.supplyMode==='supply-install',supply=supplied?(q.supply??v.priceCad):0;
 const row=(name:string,cost:number|null,spec:string,marked=false)=>{items.push({name,spec,qty:1,unit:'ls',cost:cost===null?null:cost*(marked&&q.supplyConfirmed?mult:1)});if(cost===null)outstanding.push(`${name}${name.startsWith('Pergola ')?' (builder quote)':''}`);};
 row('Aluminum pergola supply',supply,`${p.name} · ${v.label} · ${supplied?'Contractor supplied':'Customer-owned kit; supply excluded'} · CAD source ${v.source.checkedAt}`,supplied);
 for(const id of s.accessories){const a=p.accessories.find(a=>a.id===id)!;row(`Pergola accessory: ${a.name}`,q.accessories?.[id]??a.priceCad,`Contractor supplied accessory · source ${a.source.checkedAt}`,true);}
 if(s.lighting)row('Pergola perimeter LED lighting',q.accessories?.['perimeter-led']??null,'Planned contractor-supplied lighting; manufacturer compatibility and electrical design require confirmation',true);
 for(const [key,name] of PERGOLA_SITE_COSTS)row(`Pergola ${name.toLowerCase()}`,q[key]??null,'Builder quote required until contractor-entered site cost; enter 0 when not applicable');
 if((supplied||s.accessories.length>0||s.lighting)&&!q.supplyConfirmed)outstanding.push('Pergola supply/accessory costs require contractor confirmation; public listing prices are provisional.');
 if(!q.availabilityConfirmed)outstanding.push(`Pergola availability and kit completeness require confirmation (catalog: ${v.availability}).`);
 const dim=pergolaSize(s),range=p.installedBudget;
 const budget=range?`Separate manufacturer-installed budget: CAD $${Math.round(dim.widthIn*dim.depthIn/144*range.lowPerSqft).toLocaleString()}–$${Math.round(dim.widthIn*dim.depthIn/144*range.highPerSqft).toLocaleString()}${range.openEnded?'+':''}; excluded from totals. Source ${range.source.checkedAt}.`:'';
 return {section:{title:'Aluminum pergola',icon:'▤',description:`${p.name} · ${v.label}. ${budget} ${outstanding.length?'Provisional; outstanding items listed in review notes.':'Entered costs and availability confirmed; site/engineering review still required.'}`,quoteRequired:outstanding.length>0,total:items.reduce((n,i)=>n+(i.cost??0),0),items},outstanding,budget};
}
