import type {HydrangeaCultivar} from '../../../hydrangeaCultivars';

/** Atlas column of each cultivar, in both atlases. */
export const HYDRANGEA_CULTIVARS:readonly HydrangeaCultivar[]=['limelight','annabelle','endless-summer'];
const BASE='/deckcraft/landscape/hydrangea/';
/** Built by scripts/build-hydrangea-textures.mts from the CC0 photos listed in SOURCES.json beside them. */
export const HYDRANGEA_TEXTURES={florets:BASE+'florets.webp',leaves:BASE+'leaves.webp'} as const;
/** Florets: one floret per cell on the top row, a cluster of florets (for distant heads) on the bottom row. Grey: the
 * instance colour gives the floret its colour. */
export const FLORET_ATLAS={width:768,height:512,cell:256} as const;
/** Leaves: the upper side on the top row and the underside below it, petiole at the bottom and tip at the top of each cell. */
export const LEAF_ATLAS={width:768,height:1024,cellW:256,cellH:512} as const;
/** Width and height of each cut-out as a share of its cell (SOURCES.json "fill"; check-hydrangeas keeps them equal), so
 * a card sized from them shows the floret or leaf at its real size. */
export const HYDRANGEA_FILL:{florets:Record<HydrangeaCultivar,[number,number]>;leaves:Record<HydrangeaCultivar,[number,number]>}={
 florets:{limelight:[.9609,.8281],annabelle:[.9609,.8711],'endless-summer':[.9609,.9414]},
 leaves:{limelight:[.8125,.9805],annabelle:[.9805,.6387],'endless-summer':[.9805,.7617]},
};
/** [offsetU, offsetV, repeatU, repeatV] of a cell in either atlas (both are three columns by two rows), for a texture
 * loaded with flipY (v runs bottom to top). */
export function atlasCell(cultivar:HydrangeaCultivar,row:0|1):[number,number,number,number]{
 const column=HYDRANGEA_CULTIVARS.indexOf(cultivar);
 return [column/3,row===0?.5:0,1/3,.5];
}
