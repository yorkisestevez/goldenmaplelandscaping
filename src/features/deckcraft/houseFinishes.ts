import type {HouseCladding,HouseConfig,HouseOpening} from './types';
import {HEX_COLOUR} from './houseSettings';
// The colour fields and their format are validated with every design load, so they live in houseSettings.ts; the looks
// below load with the 3D view and the exterior studio.
export {HEX_COLOUR,HOUSE_COLOUR_FIELDS,type HouseColourField} from './houseSettings';

/**
 * House exterior colours and wall looks (appearance only, never priced). Every value comes from the design's own
 * choices, else the studio's original colours: a house with none of the exterior-finish fields draws exactly as it
 * always has (scripts/check-deck-house-finishes.ts holds it to a golden taken before these fields existed).
 */

/** The studio's original fixed colours, moved here from houseGeometry.ts and HouseFacade.tsx. */
export const GARAGE_DOOR_COLOR='#e4e2da';
export const DOOR_SLAB_COLOR='#4a5452';
export const WINDOW_FRAME_COLOR='#e9e6dc';
export const ORIGINAL_OPENING_COLORS={
  doorPanels:'#56615f',frenchFrames:'#f0eee6',slidingFrames:'#3c4442',handle:'#8e958f',hardware:'#68716d',mullions:'#38413f',
  garagePanels:'#d6d3ca',carriagePanels:'#cfccc2',glassGarage:'#50585a',garageGlass:'#9fb2b5',
} as const;
const MORTAR='#b8b2a7',STONE_MORTAR='#8f8a80',FIELDSTONE_MORTAR='#aaa497';

/** Mixes a hex colour toward white (amount > 0) or black (amount < 0), 0 to 1. */
export function shade(hex:string,amount:number){
  const n=parseInt(hex.slice(1),16),target=amount>0?255:0,t=Math.min(1,Math.abs(amount));
  return '#'+[16,8,0].map(s=>Math.round(((n>>s)&255)+(target-((n>>s)&255))*t).toString(16).padStart(2,'0')).join('');
}
const luminance=(hex:string)=>{const n=parseInt(hex.slice(1),16);return (.2126*((n>>16)&255)+.7152*((n>>8)&255)+.0722*(n&255))/255;};
/** A raised panel or moulding on a painted face: a little lighter on a dark colour, a little darker on a light one. */
const relief=(hex:string,amount=.1)=>shade(hex,luminance(hex)>.6?-amount*.7:amount);


export interface HouseTrimColors {trim:string;
  /** Rake boards along the gables. */
  fascia:string;soffit:string;
  /** Gutters and downspouts. */
  gutter:string}
/** Trim colours: fascia, soffit and gutters follow the trim colour unless set. */
export function houseTrimColors(config:HouseConfig):HouseTrimColors{
  return {trim:config.trimColor,fascia:config.fasciaColor??config.trimColor,soffit:config.soffitColor??config.trimColor,gutter:config.gutterColor??config.trimColor};
}

export interface OpeningColors {
  /** Door slab (single door), and the stiles of glazed doors as exported. */
  slab:string;doorPanels:string;frenchFrames:string;slidingFrames:string;
  windowFrame:string;mullions:string;
  garage:string;garagePanels:string;carriagePanels:string;glassGarage:string;garageGlass:string;
  handle:string;hardware:string}
/** The colour of an opening: its own, else the house's door, window or garage-door colour, else undefined. */
export function openingColour(config:OpeningColourSource,o:Pick<HouseOpening,'type'|'color'>){
  return o.color??(o.type==='Door'?config.doorColor:o.type==='Window'?config.windowColor:config.garageDoorColor);
}
export type OpeningColourSource=Pick<HouseConfig,'doorColor'|'windowColor'|'garageDoorColor'>;
/** Every colour an opening is drawn in. With no colour chosen these are the studio's original colours. */
export function openingColors(config:OpeningColourSource,o:Pick<HouseOpening,'type'|'color'>):OpeningColors{
  const O=ORIGINAL_OPENING_COLORS,c=openingColour(config,o),door=o.type==='Door'?c:undefined,window=o.type==='Window'?c:undefined,garage=o.type==='Garage'?c:undefined;
  return {
    slab:door??DOOR_SLAB_COLOR,doorPanels:door?relief(door):O.doorPanels,frenchFrames:door??O.frenchFrames,slidingFrames:door??O.slidingFrames,
    // The centre bars of the original (unstyled) glass doors and windows.
    windowFrame:window??WINDOW_FRAME_COLOR,mullions:door??window??O.mullions,
    garage:garage??GARAGE_DOOR_COLOR,garagePanels:garage?relief(garage,.07):O.garagePanels,carriagePanels:garage?relief(garage,.1):O.carriagePanels,glassGarage:garage??O.glassGarage,garageGlass:O.garageGlass,
    handle:O.handle,hardware:O.hardware,
  };
}

export interface WallFinish {cladding:HouseCladding;
  /** The cladding pieces' colour. */
  color:string;
  /** The wall behind them: mortar for brick and stone, a shadow tone behind boards, shakes and panels. */
  backing:string;
  /** Name of the cladding pieces in the 3D scene (the original names for the original claddings). */
  partName:string;
  /** Piece-to-piece shading, as brick and stone have always had. */
  variation:boolean;roughness:number;metalness:number}
/**
 * How a cladding in a colour is drawn: the whole house's (pass the house config), or a wall's, block's or wainscot's
 * own (pass its cladding and colour; houseWallFinishes.ts resolves which applies). The original claddings keep their
 * original backing colours and part names.
 */
export function resolveWallFinish({cladding,claddingColor:color}:Pick<HouseConfig,'cladding'|'claddingColor'>):WallFinish{
  const look=(backing:string,variation:boolean,roughness=.82,metalness=0,partName=`${cladding.toLowerCase().replace(/[^a-z]+/g,'-')}-cladding`):WallFinish=>({cladding,color,backing,partName,variation,roughness,metalness});
  switch(cladding){
    case 'Brick':return look(MORTAR,true,.82,0,'individual-brick-courses');
    case 'Siding':return look(color,false,.82,0,'siding-courses');
    case 'Stone':return look(STONE_MORTAR,true);
    case 'Stucco':case 'Board & batten':case 'Vertical siding':return look(color,false);
    case 'Norman brick':case 'Roman brick':return look(MORTAR,true);
    case 'Fieldstone':return look(FIELDSTONE_MORTAR,true,.95);
    case 'Ledgestone':return look(shade(color,-.5),true,.95);
    case 'Cedar shakes':return look(shade(color,-.45),true,.95);
    case 'Fibre-cement lap':return look(shade(color,-.25),false,.75);
    case 'Horizontal metal':return look(shade(color,-.35),false,.42,.5);
  }
}
