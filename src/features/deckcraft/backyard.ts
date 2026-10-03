import {ALLOWANCE_FINISHES,PATIO_PRODUCTS,WALL_PRODUCTS,WATER_PRODUCTS,allowanceItems} from './yardSettings';
import type {YardModel} from './yardModel';
import type {DeckData,YardAllowances} from './types';

/**
 * The backyard around the deck: patios, retaining walls and water features (YardEditor), plus a fire pit,
 * outdoor kitchen, turf and landscape lighting at the cost estimator's allowances, priced by the site's
 * estimator engine through yardTakeoff.ts and shown as their own "Yard ·" sections and subtotal.
 * A design with none of these and no terrain settings is exactly the deck-only design it always was.
 */
export const hasYardAllowances=(a?:YardAllowances)=>allowanceItems(a).length>0;
/** Patios, walls, water or terrain settings: the backyard the 3D view draws (allowances are not drawn). */
export const hasBackyardLayout=(data:Pick<DeckData,'yardFeatures'|'terrainConfig'|'siteModel'|'landscapeObjects'>)=>!!(data.yardFeatures?.length||data.terrainConfig||data.siteModel||data.landscapeObjects?.some(o=>o.enabled));
export const hasBackyard=(data:Pick<DeckData,'yardFeatures'|'terrainConfig'|'siteModel'|'landscapeObjects'|'yardAllowances'>)=>hasBackyardLayout(data)||hasYardAllowances(data.yardAllowances);

/** Estimate sections from the backyard takeoff start with this. */
export const BACKYARD_SECTION_PREFIX='Yard ·';

/** Deck and backyard parts of an estimate's pre-tax subtotal (the backyard part is 0 without one). */
export function splitSubtotal(estimate:{sections:{title:string;total:number}[];subtotal:number}){
  const backyard=estimate.sections.filter(s=>s.title.startsWith(BACKYARD_SECTION_PREFIX)).reduce((n,s)=>n+s.total,0);
  return {deck:estimate.subtotal-backyard,backyard};
}

const productName=(kind:string,id:string)=>kind==='patio'?(()=>{const p=PATIO_PRODUCTS.find(p=>p.id===id);return p?`${p.brand} ${p.product}`:'paving';})()
  :(kind==='retaining-wall'?WALL_PRODUCTS:WATER_PRODUCTS).find(p=>p.id===id)?.name??'system';

const list=(words:string[])=>words.length>1?`${words.slice(0,-1).join(', ')} and ${words.at(-1)}`:words[0];
/**
 * "Backyard: a 192 sq ft patio (Permacon Melville), a 16 ft retaining wall (24 in exposed), a pond (supplier quote);
 * allowances for a wood-burning fire pit and landscape lighting (Elevated finish)", or null.
 */
export function describeBackyard(yard:YardModel,allowances?:YardAllowances):string|null{
  const parts=yard.features.filter(f=>f.config.enabled).map(f=>{
    const c=f.config,name=productName(c.kind,c.productId);
    if(f.excluded)return `${c.name} (excluded: its layout needs revising)`;
    if(c.kind==='patio')return `a ${Math.round(f.quantities.paverAreaSqft??f.quantities.areaSqft??0)} sq ft patio (${name})`;
    if(c.kind==='retaining-wall')return `a ${c.widthFt} ft retaining wall (${name}, ${c.heightIn} in exposed)`;
    return `a ${name.toLowerCase()} (supplier quote)`;
  });
  const items=allowanceItems(allowances),finish=items.some(i=>i.usesFinish)?` (${ALLOWANCE_FINISHES.find(f=>f.id===allowances!.finish)!.label} finish)`:'';
  const allowed=items.length?`allowances for ${list(items.map(i=>i.words))}${finish}`:'';
  return parts.length||allowed?`Backyard: ${[parts.join(', '),allowed].filter(Boolean).join('; ')}`:null;
}

const ALLOWANCE_WORDS={firepit:'fire pit',kitchen:'outdoor kitchen',turf:'artificial turf',lighting:'landscape lighting'} as const;
/** The backyard's kinds in the words the site's lead scoring reads (a patio or wall is hardscape scope). */
export const backyardElements=(data:Pick<DeckData,'yardFeatures'|'yardAllowances'>)=>[...new Set([...(data.yardFeatures??[]).filter(f=>f.enabled).map(f=>f.kind==='retaining-wall'?'retaining wall':f.kind==='water-feature'?'water feature':'patio'),...allowanceItems(data.yardAllowances).map(i=>ALLOWANCE_WORDS[i.id])])];
