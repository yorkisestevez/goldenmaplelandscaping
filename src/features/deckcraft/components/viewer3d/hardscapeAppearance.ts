import type {YardBox} from '../../yardModel';

/** Manufacturer sample photos include white presentation margins. Sample only the interior,
 * with a small stock-piece offset. Directional wood faces retain their full grain orientation. */
export function sampleInteriorUv(value:number,shift:number,directional=false){
 const crop=directional?.94:.84,range=Math.max(0,1-crop-.06);
 return .03+shift*range+Math.min(1,Math.max(0,value))*crop;
}

/** Colour and sample offsets belong to a stock piece, not its array order or position.
 * Clipped fragments retain one appearance and moving a feature does not make its finish flicker. */
export function hardscapeAppearance(piece:Pick<YardBox,'id'|'unitId'|'role'>){
 let seed=2166136261;
 for(const c of piece.unitId??piece.id)seed=Math.imul(seed^c.charCodeAt(0),16777619);
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const variation=random(),tone=piece.role==='paver'?.92+.12*variation:piece.role==='wall-block'?.93+.10*variation:piece.role==='wall-cap'?.96+.06*variation:.95+.05*variation;
 const warmth=(random()-.5)*.018;
 return {r:tone*(1+warmth),g:tone,b:tone*(1-warmth),shiftU:random(),shiftV:random(),quarterTurn:Math.floor(random()*4)};
}
