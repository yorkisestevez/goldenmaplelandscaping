import {allowanceItems} from '../yardSettings';
import {shapeWords} from '../designFacts';
import {getHouseConfig} from '../houseSettings';
import {LIGHTING_RUNTIME_CATALOGUE} from '../lightingRuntimeCatalogue';
import {isSystemProduct} from '../lightingSystem';
import {activeWrap} from '../lib/wrapGeometry';
import {DECKING_CATALOGUE,RAILING_CATALOGUE} from '../manufacturerRuntimeCatalogue';
import {screenOn} from '../privacyScreens';
import {glassRailingName} from '../framelessGlass';
import type {DeckData} from '../types';
import type {DesignSection,SectionId} from './sections';
import {hasEffectiveDrainage} from '../underDeckOptions';

/**
 * What each section row says about the design's current choice ("TimberTech EDGE Prime+ · Coconut Husk · Straight").
 * Pure: the design in, words out. The row's price effect comes from the price schedule (priceLedger.ts).
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
    const path=data.stairPath?.points;
    const stairs=data.stairFlights>0?path?`${path.length>2?'Wrapped':'Edge'} stairs · ${path.slice(1).map((p,i)=>`${ft(Math.hypot(p.x-path[i].x,p.y-path[i].y)/12)} ft`).join(' + ')}${data.stairRiserCount?` · ${data.stairRiserCount} risers`:''}`:`${plural(data.stairFlights,'flight')}, ${data.stairWidth} in, ${data.stairType.toLowerCase()}`:'no stairs';
    return words([stairs,rail?rail.name:data.railingType==='None'?'no railing':data.railingType==='Frameless Glass'?glassRailingName(data):`${data.railingType} railing`]);
  },
  lighting:data=>{
    const lights=data.lightingSystem.selectedItems.reduce((n,i)=>{const p=LIGHTING_RUNTIME_CATALOGUE.find(x=>x.id===i.productId);return n+(p&&!isSystemProduct(p)?i.qty:0);},0);
    return lights||data.autoLighting?.border?words([lights&&plural(lights,'selected light'),data.autoLighting?.posts&&'post caps',data.autoLighting?.stairs&&'step lights',data.autoLighting?.border&&'picture-frame edge lights']):'None yet';
  },
  extras:data=>{
    const screens=(data.privacyScreens??[]).filter(screenOn).length,accessories=data.catalogueAccessories?.length??0;
    return words([screens&&plural(screens,'privacy screen'),!!data.skirting&&'skirting',data.benchLf>0&&`${ft(data.benchLf)} ft bench`,data.pergolaSqft>0&&`${data.pergolaSqft} sq ft pergola`,data.hasDemo&&'old deck removed',hasEffectiveDrainage(data)&&'drainage',data.underDeck?.ceiling!=='none'&&!!data.underDeck?.ceiling&&'ceiling',data.underDeck?.gravel&&'gravel & fabric',data.underDeck?.floorMesh&&'floor insect mesh',accessories&&plural(accessories,'accessory','accessories')]);
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
