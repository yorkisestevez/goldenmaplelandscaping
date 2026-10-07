/**
 * The bounded vocabulary of the AI Site Designer, dependency-free so the server (Netlify functions) and the AI client
 * can validate a model's choice without loading the geometry engine. siteDesignMoves.ts re-exports these; the moves
 * clamp their params to MOVE_PARAMS, and the AI's choice is validated against the same bounds before it is built.
 */
export type SiteMoveKind='ground-fit'|'raised-patio'|'fire-room'|'seat-wall'|'terraced-beds'|'raised-beds'|'planting'|'stone-steps';
export type MoveValue=number|string|boolean|null;
export const SITE_MOVE_KINDS:readonly SiteMoveKind[]=['ground-fit','fire-room','seat-wall','raised-patio','stone-steps','terraced-beds','raised-beds','planting'];
/** The bounds every move clamps its params to: [min, max, default] (numbers) or the allowed values (first = default). */
export const MOVE_PARAMS:Record<SiteMoveKind,Record<string,readonly [number,number,number]|readonly string[]>>={
 'ground-fit':{optionId:['best']},
 'fire-room':{product:['fire-gas-bowl','fire-gas-linear','fire-wood-ring'],patioFt:[12,16,14],minDoorFt:[6,20,10],maxDoorFt:[12,40,25],productId:['permacon-melville']},
 'seat-wall':{heightIn:[16,24,18],radiusIn:[60,108,78],sweepDeg:[60,160,120]},
 'raised-patio':{widthFt:[8,16,12],depthFt:[8,16,12],wallAboveIn:[12,24,16],productId:['permacon-melville']},
 'stone-steps':{widthIn:[36,72,48],treadRunIn:[11,14,14]},
 // tiers: 2 or 3; when absent, 3 on a fall of 36 in or more, else 2 (the other is tried next).
 'terraced-beds':{tiers:[2,3,3],lengthIn:[72,192,144],widthIn:[48,144,96],minWallIn:[8,18,12],maxWallIn:[18,30,24]},
 'raised-beds':{count:[1,3,2],lengthIn:[48,120,96],widthIn:[24,48,48],raisedIn:[18,24,18],pathIn:[18,36,24],edge:['timber','steel']},
 'planting':{lengthIn:[72,288,192],depthIn:[36,72,48],plants:[2,8,4]},
};
/** Moves that only stand beside another move of the same concept. */
export const MOVE_NEEDS:Partial<Record<SiteMoveKind,SiteMoveKind>>={'seat-wall':'fire-room','stone-steps':'raised-patio'};
/** Plain names and what each move builds, for the AI's catalogue and for findings. */
export const MOVE_INFO:Record<SiteMoveKind,{title:string;builds:string}>={
 'ground-fit':{title:'Fit the landing to the ground',builds:'re-fits the stair landing patio (or the flat patio nearest the door) to the measured ground: the best priced ground-fit option whose graded bank stays on measured ground (equal risers, patio level, stone edge course or a graded bank).'},
 'fire-room':{title:'Fire room',builds:'a level square patio with a fire feature in the flattest open ground between minDoorFt and maxDoorFt from the door, clear of the house and deck (gas first; a wood ring needs a yearly City of Barrie permit and 4 m clearance).'},
 'seat-wall':{title:'Seat wall',builds:'a curved freestanding seat wall round the uphill side of the fire, on the fire-room patio (needs fire-room).'},
 'raised-patio':{title:'Raised patio',builds:'a patio level with the stair landing (or the stair foot, or a step below the door) where the ground drops away, held by a retaining wall where it stands more than wallAboveIn above the ground and a stone edge course on lower sides (a guard is required past 23.6 in).'},
 'stone-steps':{title:'Stone steps',builds:'stone steps from the raised patio down to the lawn (needs raised-patio).'},
 'terraced-beds':{title:'Garden terraces',builds:'2 or 3 level planting beds stepping down the steepest open slope, each held by a short wall between minWallIn and maxWallIn.'},
 'raised-beds':{title:'Raised garden beds',builds:'1–3 raised vegetable or flower beds on gentle ground near the house, with paths between them.'},
 'planting':{title:'Planting along the slope',builds:'a planting bed along the high side of the yard following a contour, with shrubs and ornamental grasses.'},
};
/** The concept templates siteConcepts.ts composes, by id (one per goal). */
export const SITE_CONCEPT_IDS=['slope','room','garden'] as const;
export type SiteConceptId=typeof SITE_CONCEPT_IDS[number];
export const SITE_GOALS=['value','entertaining','garden'] as const;

/** True when `value` is an allowed value for `kind`'s `key` (inside the numeric range, or one of the listed values). */
export function moveParamAllowed(kind:SiteMoveKind,key:string,value:unknown):boolean{
 const bound=Object.hasOwn(MOVE_PARAMS,kind)&&Object.hasOwn(MOVE_PARAMS[kind],key)?MOVE_PARAMS[kind][key]:undefined;
 if(!bound)return false;
 if(typeof bound[0]==='number'){const [lo,hi]=bound as readonly [number,number,number];return typeof value==='number'&&Number.isFinite(value)&&value>=lo&&value<=hi;}
 return typeof value==='string'&&(bound as readonly string[]).includes(value);
}
