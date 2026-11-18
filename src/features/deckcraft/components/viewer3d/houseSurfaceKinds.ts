import type {HouseCladding} from '../../types';

/**
 * Which surface detail each cladding gets up close (Real Life G4), apart from the textures so the check scripts can
 * read it. Detail only changes appearance: the colour is the customer's, never priced.
 * - masonry: brick faces and mortar, from a concrete scan (concrete_floor_01), 10 in per repeat.
 * - rock: natural and ledge stone, from a rock-face scan (rock_face_03), 24 in per repeat.
 * - stucco: stucco walls, and the mortar behind brick and stone, the concrete scan at 20 in and softer.
 * - woodgrain: painted boards, lap siding and shakes, a fine grain made in code, along each piece.
 * Horizontal metal stays smooth.
 */
export type HouseSurface='masonry'|'rock'|'stucco'|'woodgrain';
export const HOUSE_SURFACES:Record<HouseSurface,{set:'masonry'|'rock'|'grain';repeatIn:number;normalScale:number}>={
  masonry:{set:'masonry',repeatIn:10,normalScale:.8},
  rock:{set:'rock',repeatIn:24,normalScale:1},
  stucco:{set:'masonry',repeatIn:20,normalScale:.45},
  woodgrain:{set:'grain',repeatIn:48,normalScale:.045},
};
export function claddingSurface(cladding:HouseCladding):HouseSurface|undefined{
  switch(cladding){
    case 'Brick':case 'Norman brick':case 'Roman brick':return 'masonry';
    case 'Stone':case 'Fieldstone':case 'Ledgestone':return 'rock';
    case 'Stucco':return 'stucco';
    case 'Siding':case 'Fibre-cement lap':case 'Board & batten':case 'Vertical siding':case 'Cedar shakes':return 'woodgrain';
    case 'Horizontal metal':return undefined;
  }
}
/** The wall behind the pieces: the mortar behind brick and stone takes the stucco detail. */
export function backingSurface(cladding:HouseCladding):HouseSurface|undefined{
  const surface=claddingSurface(cladding);
  return surface==='masonry'||surface==='rock'?'stucco':undefined;
}
/** The chunks and lookups the house patch rewrites (check-deck-realism checks they exist). */
export const HOUSE_CHUNKS:[string,string][]=[['map_fragment','texture2D( map, vMapUv )'],['normal_fragment_maps','texture2D( normalMap, vNormalMapUv )'],['normal_fragment_begin','vNormalMapUv']];
