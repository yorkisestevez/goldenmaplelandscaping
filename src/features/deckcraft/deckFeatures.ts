import {getHouseConfig,ORIGINAL_HOUSE_CLADDINGS} from './houseSettings';
import {HOUSE_COLOUR_FIELDS} from './houseSettings';
import {DEFAULT_DECK} from './defaults';
import {usesCurrentBuildRules} from './buildRules';
import {isSystemProduct} from './lightingSystem';
import {LIGHTING_RUNTIME_CATALOGUE} from './lightingRuntimeCatalogue';
import {screenOn} from './privacyScreens';
import {activeCornerChamfers} from './lib/cornerChamfers';
import {allowanceItems} from './yardSettings';
import {DECK_PARTS} from './deckPartFinishes';
import type {DeckData} from './types';
import {DECK_LABEL} from './deckAnalytics';

/** The design features a visitor uses, as fixed funnel labels (deckAnalytics.ts). Kept apart from the analytics core
 * so the designer page loads it after the first paint. */
const slug=(text:string)=>text.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
// Doors and windows count as edited when one is added, removed, restyled or moved to another wall;
// positions and sizes are left out because resizing the house re-fits them on its own.
const openingSignature=(data:DeckData)=>JSON.stringify(getHouseConfig(data).openings.map(o=>[o.id,o.type,o.style??'',o.facade,o.wallId??'']));
const DEFAULT_OPENINGS=openingSignature(DEFAULT_DECK);

/** The design features in use, as fixed labels. The default design uses none. */
export function designFeatures(data:DeckData):string[]{
  const house=getHouseConfig(data),features:string[]=[];
  const add=(on:unknown,label:string)=>{if(on)features.push(label);};
  if(data.shape!=='Rectangle')add(true,`deck_shape_${slug(data.shape)}`);
  if(data.pattern!=='Straight')add(true,`deck_pattern_${slug(data.pattern)}`);
  add(data.deckType!=='Attached',`deck_type_${slug(data.deckType)}`);
  add(data.wrap?.left||data.wrap?.right,'deck_wrap');
  add(data.wrap?.porchLeft||data.wrap?.porchRight,'deck_porch');
  add(activeCornerChamfers(data),'deck_corner_chamfer');
  add(data.levels>=2,'deck_level_2');
  add(data.levels>=3,'deck_level_3');
  add(data.levels>=2&&data.level2FullStep,'deck_split_level');
  add(data.stairType!=='Straight',`deck_stairs_${slug(data.stairType)}`);
  add(data.stairFlights>1,'deck_stairs_extra_flights');
  add(house.footprint?.rects.some(b=>b.kind==='garage'),'deck_house_garage');
  add(house.footprint?.rects.some(b=>b.kind==='house'),'deck_house_block');
  add(openingSignature(data)!==DEFAULT_OPENINGS,'deck_doors_windows');
  // Exterior finishes (appearance only): a newer cladding or roof, any exterior colour, or a wall, block or wainscot finish.
  add(!ORIGINAL_HOUSE_CLADDINGS.includes(house.cladding)||!['Shingles','Metal'].includes(house.roofFinish)||HOUSE_COLOUR_FIELDS.some(k=>house[k])||house.openings.some(o=>o.color)||house.wallFinishes||house.wainscot||house.gableAccent||house.footprint?.rects.some(b=>b.finish),'deck_house_exterior');
  add(data.catalogueRailingId,'deck_catalogue_railing');
  add(data.railingType==='Frameless Glass','deck_frameless_glass');
  add(data.railingType==='Frameless Glass'&&data.glassMount&&data.glassMount!=='Top-mount base shoe',data.glassMount==='Spigots'?'deck_glass_spigots':'deck_glass_fascia_mount');
  add(data.catalogueAccessories?.length,'deck_accessory');
  // New designs start with a one-row border (owner 2026-10-04), so only a departure from it is a choice. `deck_border_rows`
  // (one or more rows) is retired so its GA4 history keeps that meaning; a save made before the default (legacy rules,
  // rows 0) reopens as it was drawn, so it is not counted as having removed the border. The Picture Frame layout draws a
  // one-row border even at rows 0 (deckTakeoff's `rows||(pattern==='Picture Frame'?1:0)`), so that is not a removal either.
  add(data.pictureFrameRows>DEFAULT_DECK.pictureFrameRows,'deck_border_extra_row');
  add(data.pictureFrameRows<DEFAULT_DECK.pictureFrameRows&&data.pattern!=='Picture Frame'&&usesCurrentBuildRules(data),'deck_border_none');
  add(data.hasInlay,'deck_inlay');
  add(data.boardColours?.length,'deck_board_colours');
  add(data.inlays?.some(i=>i.kind==='rug'),'deck_inlay_rug');
  add(data.inlays?.some(i=>i.kind==='diamond'),'deck_inlay_diamond');
  add(data.inlays?.some(i=>i.kind==='band'),'deck_inlay_band');
  add(data.inlays?.some(i=>i.kind==='medallion'),'deck_inlay_medallion');
  add(data.skirting,'deck_skirting');
  add(DECK_PARTS.some(p=>data.deckFinishes?.[p]),'deck_part_finishes');
  add(data.deckFinishes?.railingColor,'deck_railing_colour');
  add(data.privacyScreens?.some(screenOn),'deck_privacy_screen');
  add(data.lightingSystem.selectedItems.some(i=>{const p=LIGHTING_RUNTIME_CATALOGUE.find(x=>x.id===i.productId);return i.qty>0&&!!p&&!isSystemProduct(p);}),'deck_lighting');
  add(data.benchLf>0,'deck_bench');
  add(data.pergolaSqft>0,'deck_pergola');
  add(data.hasDemo,'deck_demolition');
  add(data.hasDrainage,'deck_drainage');
  add(data.sceneLighting==='Evening','deck_night_preview');
  const yard=(data.yardFeatures??[]).filter(f=>f.enabled);
  const allowances=new Set(allowanceItems(data.yardAllowances).map(i=>i.id));
  add(yard.length||allowances.size,'deck_backyard');
  add(yard.some(f=>f.kind==='patio'),'deck_patio');
  add(yard.some(f=>f.kind==='retaining-wall'),'deck_retaining_wall');
  add(yard.some(f=>f.kind==='water-feature'),'deck_water_feature');
  add(allowances.has('firepit'),'deck_fire_pit');
  add(allowances.has('kitchen'),'deck_outdoor_kitchen');
  add(allowances.has('turf'),'deck_turf');
  add(allowances.has('lighting'),'deck_landscape_lighting');
  return features.filter(label=>DECK_LABEL.test(label));
}
