import type {YardFeature} from './types';

/**
 * Guillotined armour stone: limestone split flat top and bottom, so it stacks in even courses with broken faces.
 * Stones and trade prices are Carr Landscape Depot's 2025 price book ("Armour Stone Guillotined Wallstone", per lb);
 * the course heights are what Barrie yards list (Ferndale 10/14/16 in, Mar-co to 20 in). Carr's book lists no
 * sizes, so every size is "confirm with Carr". The bed is as deep as the course (cubical stone).
 */
export const GUILLOTINED_WALL='guillotined-armour-stone';
export const WALL_STONES=[
 {id:'carr-orillia-grey',name:'Orillia Grey',tradePerLb:.125,hex:'#a7a399'},
 {id:'carr-dark-grey',name:'Dark Grey',tradePerLb:.153,hex:'#6e6c68'},
] as const;
export const WALL_STONE_COURSES_IN=[10,14,16,20] as const;
/** Limestone, as Ontario suppliers list it (Select Stone: 165 lb per cubic ft). */
export const LIMESTONE_LB_PER_FT3=165;

/** The wall's stone and course; absent means Orillia Grey in 14 in courses. */
export function wallStoneOf(f:Pick<YardFeature,'wallStone'>){
 const stone=WALL_STONES.find(s=>s.id===f.wallStone?.stoneId)??WALL_STONES[0];
 return {stone,courseIn:f.wallStone?.courseIn??14};
}
export const WALL_STONE_PROBLEM='Only a guillotined armour stone wall takes a wall stone, from the listed stones and courses.';
/** A stone choice belongs to a guillotined wall and names a listed stone and course. */
export function wallStoneProblem(f:Pick<YardFeature,'productId'|'wallStone'>){
 const v=f.wallStone;
 return v===undefined||f.productId===GUILLOTINED_WALL&&v&&typeof v==='object'&&Object.keys(v).every(k=>k==='stoneId'||k==='courseIn')&&WALL_STONES.some(s=>s.id===v.stoneId)&&(WALL_STONE_COURSES_IN as readonly number[]).includes(v.courseIn)?'':WALL_STONE_PROBLEM;
}
