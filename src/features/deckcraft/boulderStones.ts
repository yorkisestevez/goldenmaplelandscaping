import type {BoulderStone,LandscapeAssetId,LandscapeObject} from './landscapeTypes';

/**
 * Natural stone for the boulder-* scan shapes. Colours are the average stone colour the grey scan is tinted to.
 * Densities are typical in-place values (AusIMM bulk density table) used only to estimate a weight for the supplier
 * conversation; they never set a price.
 */
export const BOULDER_STONES:readonly {id:BoulderStone;name:string;colour:string;densityTm3:number}[]=[
 {id:'granite',name:'Granite',colour:'#8e8782',densityTm3:2.72},
 {id:'limestone',name:'Limestone',colour:'#968f82',densityTm3:2.69},
 {id:'sandstone',name:'Sandstone',colour:'#a38b6e',densityTm3:2.42},
];
export const BOULDER_DENSITY_SOURCE='https://www.ausimm.com/globalassets/insights-and-resources/minerals-processing-toolbox/bulkdensit.pdf';
/** CC0 scan shapes, in library order (public/deckcraft/landscape/boulder-library-manifest.json). */
export const BOULDER_SHAPE_IDS:readonly LandscapeAssetId[]=['boulder-fieldstone-round','boulder-fieldstone-dome','boulder-quarried-block','boulder-quarried-fractured','boulder-bench'];
/** "Set into the ground" choices, as a share of the whole stone's height. */
export const BURIAL_SHARES=[0,1/4,1/3,1/2] as const;
export const DEFAULT_BURIAL_SHARE=1/4;
/** A buried depth in whole inches for a share of the stone, never more than half of it. */
export const burialFor=(heightIn:number,share:number)=>Math.min(Math.round(heightIn*share),heightIn/2);

export const isBoulderShape=(assetId:string)=>(BOULDER_SHAPE_IDS as readonly string[]).includes(assetId);
/** The stone of a scan-shape boulder (granite when unset); undefined for natural-boulder and everything else. */
export function boulderStone(o:Pick<LandscapeObject,'kind'|'assetId'|'stoneType'>){
 if(o.kind!=='boulder'||!isBoulderShape(o.assetId))return undefined;
 return BOULDER_STONES.find(s=>s.id===(o.stoneType??'granite'))!;
}
