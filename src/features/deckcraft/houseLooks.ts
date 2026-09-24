import type {DeckData,HouseConfig,HouseFinish} from './types';
import {HOUSE_COLOUR_FIELDS} from './houseFinishes';
import {paletteName} from './housePalette';
import {ROOF_FINISH_LABELS} from './houseSettings';
import {normalizeHouseBlocks,wallLabel} from './houseFootprint';
import {hasWallFinishes,wholeHouseFinish} from './houseWallFinishes';

/**
 * Exterior looks: whole-house starting points in the exterior studio, and the proposal's exterior line. Appearance
 * only, never priced. Loaded with the lazy studio and the proposal, never with the page.
 *
 * A look sets the whole house's finish, roof and colours, nothing else: never a size, shape, roof pitch, opening or
 * anything on the deck. Walls, blocks, doors and windows with their own finish keep it (the studio offers to reset
 * them). Colours are the palette's illustrative screen colours with generic names, not a manufacturer's.
 */

/** Every field a look sets. A field a look leaves out is cleared, so the house follows its default for it. */
export const LOOK_FIELDS=['cladding','claddingColor','wainscot','gableAccent','roofFinish','roofColor','trimColor',...HOUSE_COLOUR_FIELDS] as const;
export type LookField=typeof LOOK_FIELDS[number];
export interface ExteriorLook {id:string;name:string;description:string;set:Pick<HouseConfig,'cladding'|'claddingColor'|'roofFinish'|'roofColor'|'trimColor'>&Partial<Pick<HouseConfig,LookField>>}

export const EXTERIOR_LOOKS:ExteriorLook[]=[
  {id:'modern-farmhouse',name:'Modern farmhouse',description:'White board and batten, a black metal roof and black windows',
    set:{cladding:'Board & batten',claddingColor:'#f1ede3',roofFinish:'Metal',roofColor:'#2a2c2e',trimColor:'#f7f6f1',fasciaColor:'#1f2021',gutterColor:'#1f2021',doorColor:'#9b7147',windowColor:'#1f2021',garageDoorColor:'#9b7147'}},
  {id:'muskoka-cottage',name:'Muskoka cottage',description:'Dark board and batten over a fieldstone base, shakes in the gables, a green metal roof',
    set:{cladding:'Board & batten',claddingColor:'#6a5344',wainscot:{cladding:'Fieldstone',color:'#8e8b84',heightIn:36},gableAccent:{cladding:'Cedar shakes',color:'#b59b78'},roofFinish:'Metal',roofColor:'#3c4e3f',trimColor:'#3f5443',doorColor:'#9b7147',windowColor:'#4b3b2e',garageDoorColor:'#5a3f2b'}},
  {id:'contemporary',name:'Contemporary',description:'Charcoal horizontal metal over a light ledgestone base, black roof and windows',
    set:{cladding:'Horizontal metal',claddingColor:'#3d4043',wainscot:{cladding:'Ledgestone',color:'#cdb38a',heightIn:30},roofFinish:'Metal',roofColor:'#2a2c2e',trimColor:'#3b3d3e',fasciaColor:'#1f2021',gutterColor:'#1f2021',doorColor:'#9b7147',windowColor:'#1f2021',garageDoorColor:'#3b3d3e'}},
  {id:'classic-ontario-brick',name:'Classic Ontario brick',description:'Red clay brick, siding in the gables, white trim and a black shingle roof',
    set:{cladding:'Brick',claddingColor:'#9a4b3a',gableAccent:{cladding:'Siding',color:'#e8e1d2'},roofFinish:'Architectural shingles',roofColor:'#2a2c2e',trimColor:'#f7f6f1',doorColor:'#25334a',windowColor:'#f7f6f1',garageDoorColor:'#f2f0ea'}},
  {id:'coastal',name:'Coastal',description:'Weathered grey shakes, crisp white trim, a slate-grey roof and a teal door',
    set:{cladding:'Cedar shakes',claddingColor:'#9a9d98',roofFinish:'Architectural shingles',roofColor:'#5b6166',trimColor:'#f7f6f1',doorColor:'#2f6a6a',windowColor:'#f7f6f1',garageDoorColor:'#f2f0ea'}},
];

/** The house with a look: its look fields replaced (cleared where the look has none), everything else as it was. */
export function applyLook(house:HouseConfig,look:ExteriorLook):HouseConfig{
  const next:Record<string,unknown>={...house};
  for(const key of LOOK_FIELDS){const value=look.set[key];if(value===undefined)delete next[key];else next[key]=structuredClone(value);}
  return next as unknown as HouseConfig;
}
/** True when the whole house wears this look. */
export const wearsLook=(house:HouseConfig,look:ExteriorLook)=>LOOK_FIELDS.every(k=>JSON.stringify(house[k])===JSON.stringify(look.set[k]));
/** Walls, blocks and doors or windows that keep a finish of their own whatever the look. */
export const ownFinishes=(house:HouseConfig)=>Object.keys(house.wallFinishes??{}).length+(house.footprint?.rects.filter(b=>b.finish).length??0)+house.openings.filter(o=>o.color).length;
/** The house without any wall, block, door or window finish of its own: everything follows the whole house. */
export function withoutOwnFinishes(house:HouseConfig):HouseConfig{
  const {wallFinishes:_walls,...next}=house;
  return {...next,openings:house.openings.map(({color:_color,...o})=>o),...(house.footprint&&{footprint:{rects:house.footprint.rects.map(({finish:_finish,...b})=>b)}})};
}

/** The studio's own starting look, as getHouseConfig gives it. */
const STUDIO:Partial<HouseConfig>={cladding:'Siding',claddingColor:'#c5c7be',roofFinish:'Shingles',roofColor:'#424748',trimColor:'#f0eee6'};
const named=(hex:string)=>paletteName(hex)??hex.toUpperCase();
const describe=(f:HouseFinish)=>`${f.cladding} in ${named(f.color)}${f.wainscot?` over a ${f.wainscot.heightIn} in ${f.wainscot.cladding} wainscot in ${named(f.wainscot.color)}`:''}${f.gable?`, ${f.gable.cladding} gables in ${named(f.gable.color)}`:''}`;

/**
 * The proposal's line about the house exterior, or null when the house is hidden or still in the studio's own
 * look: "Exterior (appearance only, not priced): walls …; garage …; roof …; trim …; doors …".
 */
export function exteriorSummary(data:DeckData):string|null{
  const h=data.houseConfig;
  if(!h||data.houseVisible===false)return null;
  if(!hasWallFinishes(h)&&!HOUSE_COLOUR_FIELDS.some(k=>h[k])&&!h.openings.some(o=>o.color)&&Object.entries(STUDIO).every(([k,v])=>h[k as keyof HouseConfig]===v))return null;
  const parts=[`Walls: ${describe(wholeHouseFinish(h))}`];
  for(const b of normalizeHouseBlocks(h))if(b.finish)parts.push(`${wallLabel(`${b.id}-front`,h).split(',')[0]}: ${describe(b.finish)}`);
  const walls=Object.entries(h.wallFinishes??{});
  if(walls.length>3)parts.push(`${walls.length} walls in finishes of their own`);
  else for(const [id,f] of walls)parts.push(`${wallLabel(id,h)}: ${describe(f)}`);
  parts.push(`Roof: ${ROOF_FINISH_LABELS[h.roofFinish]} in ${named(h.roofColor)}`,`Trim: ${named(h.trimColor)}`);
  for(const [key,label] of [['fasciaColor','Fascia'],['soffitColor','Soffit'],['gutterColor','Gutters'],['doorColor','Doors'],['windowColor','Window frames'],['garageDoorColor','Garage doors']] as const)if(h[key])parts.push(`${label}: ${named(h[key]!)}`);
  const own=h.openings.filter(o=>o.color).length;
  if(own)parts.push(`${own} door${own===1?' or window':'s or windows'} in ${own===1?'its':'their'} own colour`);
  return `Exterior (appearance only, not priced): ${parts.join('; ')}`;
}
