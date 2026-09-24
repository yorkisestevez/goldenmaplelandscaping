import {allowanceItems} from '../yardSettings';
import {dollars,shapeWords,type DeckEstimate} from '../designFacts';
import {getHouseConfig} from '../houseSettings';
import {LIGHTING_CATALOGUE} from '../lightingCatalogue';
import {isSystemProduct} from '../lightingSystem';
import {activeWrap} from '../lib/wrapGeometry';
import {DECKING_CATALOGUE,RAILING_CATALOGUE} from '../manufacturerCatalog';
import {screenOn} from '../privacyScreens';
import type {DeckData} from '../types';
import {ownsTitle,type DesignSection,type SectionId} from './sections';

/**
 * What each section row says about the design: the current choice ("TimberTech EDGE Prime+ · Coconut Husk ·
 * Straight") and the price effect, which is the total of the estimate sections the row owns. Pure: the design and
 * the estimate in, words out. An unpriced part never reads "$0": it is "+ quote" or a quote tag.
 */
const plural=(n:number,one:string,many=`${one}s`)=>`${n} ${n===1?one:many}`;
const ft=(n:number)=>String(Math.round(n*10)/10);
const words=(parts:(string|false|undefined|null|0)[],none='None yet')=>{const text=parts.filter(Boolean).join(' · ');return text?text[0].toUpperCase()+text.slice(1):none;};
const dashes=(value:string)=>value.replace(/-/g,' / ');

const SUMMARIES:Record<SectionId,(data:DeckData)=>string>={
  house:data=>{
    if(data.houseVisible===false)return 'House hidden';
    const house=getHouseConfig(data),blocks=house.footprint?.rects??[],wings=blocks.filter(b=>b.kind==='house').length;
    return words([`${ft(house.widthFt)} × ${ft(house.depthFt)} ft house`,plural(house.storeys,'storey'),wings&&plural(wings,'bump-out or wing','bump-outs or wings'),blocks.some(b=>b.kind==='garage')&&'garage',plural(house.openings.length,'door or window','doors & windows')]);
  },
  deck:data=>words([`${ft(data.width)} × ${ft(data.length)} ft`,`${data.height} in high`,shapeWords(data,!!activeWrap(data)),data.levels>1&&`${data.levels} levels`,data.deckType!=='Attached'&&data.deckType.toLowerCase()]),
  boards:data=>{
    const material=DECKING_CATALOGUE.find(m=>m.id===data.deckingMaterial);
    return words([material?.name,data.deckingColor,data.pattern,data.pictureFrameRows>0&&plural(data.pictureFrameRows,'border row'),!!data.boardColours?.length&&'accent boards',!!data.inlays?.length&&plural(data.inlays.length,'inlay')]);
  },
  stairs:data=>{
    const rail=RAILING_CATALOGUE.find(r=>r.id===data.catalogueRailingId);
    return words([data.stairFlights>0?`${plural(data.stairFlights,'flight')}, ${data.stairWidth} in, ${data.stairType.toLowerCase()}`:'no stairs',rail?rail.name:data.railingType==='None'?'no railing':`${data.railingType} railing`]);
  },
  lighting:data=>{
    const lights=data.lightingSystem.selectedItems.reduce((n,i)=>{const p=LIGHTING_CATALOGUE.find(x=>x.id===i.productId);return n+(p&&!isSystemProduct(p)?i.qty:0);},0);
    return lights?words([plural(lights,'light'),data.autoLighting?.posts&&'post caps',data.autoLighting?.stairs&&'step lights']):'None yet';
  },
  extras:data=>{
    const screens=(data.privacyScreens??[]).filter(screenOn).length,accessories=data.catalogueAccessories?.length??0;
    return words([screens&&plural(screens,'privacy screen'),!!data.skirting&&'skirting',data.benchLf>0&&`${ft(data.benchLf)} ft bench`,data.pergolaSqft>0&&`${data.pergolaSqft} sq ft pergola`,data.hasDemo&&'old deck removed',data.hasDrainage&&'drainage',accessories&&plural(accessories,'accessory','accessories')]);
  },
  site:data=>words([dashes(data.municipality),`${dashes(data.siteType).toLowerCase()} site`,data.foundation.toLowerCase()]),
  backyard:data=>{
    const yard=(data.yardFeatures??[]).filter(f=>f.enabled),count=(kind:string)=>yard.filter(f=>f.kind===kind).length;
    return words([count('patio')&&plural(count('patio'),'patio'),count('retaining-wall')&&plural(count('retaining-wall'),'retaining wall'),count('water-feature')&&plural(count('water-feature'),'water feature'),...allowanceItems(data.yardAllowances).map(i=>i.id==='firepit'?'fire pit':i.id==='kitchen'?'outdoor kitchen':i.id==='turf'?'turf':'landscape lighting')]);
  },
  proposal:()=>'Summary, proposal, PDF, share link and CAD files',
};
/** The section's current choice, in a few words. */
export const sectionSummary=(section:DesignSection,data:DeckData)=>SUMMARIES[section.id](data);

type EstimateItem=DeckEstimate['sections'][number]['items'][number];
/** A builder quote says so in its name or spec (as the engine words them); every other unpriced line is a supplier quote. */
export const isBuilderQuote=(item:EstimateItem)=>/\(builder quote\)/i.test(item.name)||/^Builder quote required/.test(item.spec);

export interface PriceEffect{kind:'amount'|'quote'|'none'|'note';text:string}
/**
 * The row's price effect: the whole-dollar total of the estimate sections it owns, "+ quote" when part of them is
 * unpriced, or a supplier or builder quote tag when none of it is priced. House looks are never priced; the
 * proposal owns no price of its own (null).
 */
export function sectionPriceEffect(section:DesignSection,estimate:DeckEstimate):PriceEffect|null{
  if(section.id==='house')return {kind:'note',text:'Looks never priced; size can move the ledger'};
  if(!section.ledger.length)return null;
  const owned=estimate.sections.filter(s=>ownsTitle(section,s.title));
  const total=owned.reduce((n,s)=>n+s.total,0),priced=total>=0.5;
  const unpriced=owned.flatMap(s=>s.items.filter(i=>i.cost===null&&Number(i.qty)>0));
  if(!unpriced.length&&!owned.some(s=>s.quoteRequired))return priced?{kind:'amount',text:dollars(total)}:{kind:'none',text:'Adds nothing yet'};
  if(priced)return {kind:'amount',text:`${dollars(total)} + quote`};
  const builder=unpriced.filter(isBuilderQuote).length;
  return {kind:'quote',text:builder===0?'Supplier quote':builder===unpriced.length?'Builder quote':'Supplier & builder quotes'};
}
