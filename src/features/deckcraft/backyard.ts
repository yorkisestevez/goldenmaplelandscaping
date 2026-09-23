import {PATIO_PRODUCTS,WALL_PRODUCTS,WATER_PRODUCTS} from './yardSettings';
import type {YardModel} from './yardModel';
import type {DeckData} from './types';

/**
 * The backyard around the deck: patios, retaining walls and water features (YardEditor), priced by the
 * site's estimator engine through yardTakeoff.ts and shown as their own "Yard ·" sections and subtotal.
 * A design with no yard features and no terrain settings is exactly the deck-only design it always was.
 */
export const hasBackyard=(data:Pick<DeckData,'yardFeatures'|'terrainConfig'>)=>!!(data.yardFeatures?.length||data.terrainConfig);

/** Estimate sections from the backyard takeoff start with this. */
export const BACKYARD_SECTION_PREFIX='Yard ·';

/** Deck and backyard parts of an estimate's pre-tax subtotal (the backyard part is 0 without one). */
export function splitSubtotal(estimate:{sections:{title:string;total:number}[];subtotal:number}){
  const backyard=estimate.sections.filter(s=>s.title.startsWith(BACKYARD_SECTION_PREFIX)).reduce((n,s)=>n+s.total,0);
  return {deck:estimate.subtotal-backyard,backyard};
}

const productName=(kind:string,id:string)=>kind==='patio'?(()=>{const p=PATIO_PRODUCTS.find(p=>p.id===id);return p?`${p.brand} ${p.product}`:'paving';})()
  :(kind==='retaining-wall'?WALL_PRODUCTS:WATER_PRODUCTS).find(p=>p.id===id)?.name??'system';

/** "Backyard: a 192 sq ft patio (Permacon Melville), a 16 ft retaining wall (24 in exposed), a pond (supplier quote)", or null. */
export function describeBackyard(yard:YardModel):string|null{
  const parts=yard.features.filter(f=>f.config.enabled).map(f=>{
    const c=f.config,name=productName(c.kind,c.productId);
    if(f.excluded)return `${c.name} (excluded: its layout needs revising)`;
    if(c.kind==='patio')return `a ${Math.round(f.quantities.paverAreaSqft??f.quantities.areaSqft??0)} sq ft patio (${name})`;
    if(c.kind==='retaining-wall')return `a ${c.widthFt} ft retaining wall (${name}, ${c.heightIn} in exposed)`;
    return `a ${name.toLowerCase()} (supplier quote)`;
  });
  return parts.length?`Backyard: ${parts.join(', ')}`:null;
}

/** The backyard's kinds in the words the site's lead scoring reads (a patio or wall is hardscape scope). */
export const backyardElements=(data:Pick<DeckData,'yardFeatures'>)=>[...new Set((data.yardFeatures??[]).filter(f=>f.enabled).map(f=>f.kind==='retaining-wall'?'retaining wall':f.kind==='water-feature'?'water feature':'patio'))];
