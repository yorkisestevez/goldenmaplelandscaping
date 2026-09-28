import type {GableAccent,HouseConfig,HouseFinish} from './types';
import {houseTrimColors,resolveWallFinish,type OpeningColourSource,type WallFinish} from './houseFinishes';

/**
 * Per-wall and per-block house finishes (appearance only, never priced). Loaded with the 3D view and the exterior
 * studio, never with the page: the page only validates and keeps these fields (designPersistence.ts).
 *
 * A wall ('garage1-back'; 'main-front' faces the deck) takes its own finish, else its block's, else the whole
 * house's. A finish is taken whole, so a wall with its own finish has its own wainscot and gable accent, or none.
 * A house with none of these fields resolves every wall to the whole-house cladding and colour, exactly as before.
 */
export const WALL_SIDES=['front','back','left','right'] as const;

/** The whole house's finish: its cladding and colour, and its wainscot and gable accent when it has them. */
export const wholeHouseFinish=(config:HouseConfig):HouseFinish=>({cladding:config.cladding,color:config.claddingColor,...(config.wainscot&&{wainscot:config.wainscot}),...(config.gableAccent&&{gable:config.gableAccent})});
/** A block's finish: its own, else the whole house's. */
export const blockFinishFor=(config:HouseConfig,blockId:string):HouseFinish=>config.footprint?.rects.find(b=>b.id===blockId)?.finish??wholeHouseFinish(config);
/** A wall's finish: its own, else its block's, else the whole house's. */
export const houseFinishFor=(config:HouseConfig,wallId:string):HouseFinish=>config.wallFinishes?.[wallId]??blockFinishFor(config,wallId.split('-')[0]);
/** Where a wall's finish comes from. */
export const finishSource=(config:HouseConfig,wallId:string):'wall'|'block'|'house'=>config.wallFinishes?.[wallId]?'wall':config.footprint?.rects.some(b=>b.id===wallId.split('-')[0]&&b.finish)?'block':'house';
/** The gable triangle above a wall: its finish's accent, else the wall's own cladding carrying on up. */
export const gableLook=(config:HouseConfig,wallId:string):GableAccent=>{const f=houseFinishFor(config,wallId);return f.gable??{cladding:f.cladding,color:f.color};};
/** True when any wall or block has its own finish, or the whole house a wainscot or gable accent. */
export const hasWallFinishes=(config:HouseConfig)=>!!(config.wallFinishes||config.wainscot||config.gableAccent||config.footprint?.rects.some(b=>b.finish));
/** Every wall a finish can be kept for: four per block, the main house first. */
export const houseWallIds=(config:HouseConfig)=>['main',...(config.footprint?.rects??[]).map(b=>b.id)].flatMap(id=>WALL_SIDES.map(side=>`${id}-${side}`));

/** True for a wall with a gable triangle above it: an end wall of a gable roof (across its ridge). */
export const isGableEnd=({block,wall}:{block:{roofShape:HouseConfig['roofShape'];ridge:'x'|'z'};wall:{side:string}})=>block.roofShape==='Gable'&&(block.ridge==='x')===(wall.side==='left'||wall.side==='right');

/** A wall's finish as the 3D facade draws it. */
export interface FacadeFinish {
  /** The wall's cladding. */
  wall:WallFinish;
  /** A wainscot band along the bottom: its cladding and its top above grade. */
  wainscot?:WallFinish&{heightIn:number};
  /** Casings, corner boards and the wainscot cap. */
  trim:string;
  /** Where the doors, windows and garage doors take their colours. */
  openings:OpeningColourSource;
}
export function facadeFinish(config:HouseConfig,wallId:string):FacadeFinish{
  const f=houseFinishFor(config,wallId),w=f.wainscot;
  return {wall:resolveWallFinish({cladding:f.cladding,claddingColor:f.color}),...(w&&{wainscot:{...resolveWallFinish({cladding:w.cladding,claddingColor:w.color}),heightIn:w.heightIn}}),trim:houseTrimColors(config).trim,openings:config};
}
