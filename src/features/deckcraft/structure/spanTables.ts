import {SOURCES,type SourceId} from './sources';
import {BEAM_CANTILEVER,BEAM_TABLE_2PLY,BEAM_TABLE_3PLY,BLOCKING,JOIST_CANTILEVER,JOIST_TABLE} from './tableData';

/**
 * Span lookups for the deck framing engine. The numbers live in tableData.ts, transcribed from the public references
 * in sources.ts. Lookups are conservative:
 * - metric values convert to whole inches rounded down;
 * - a supported length between two tabulated rows reads the longer row (the shorter beam span), where the code would
 *   allow straight interpolation;
 * - anything past a table's last row has no span.
 *
 * These are planning assumptions for a design tool, never an engineering certification or a permit approval.
 */
export type JoistSize='2x8'|'2x10'|'2x12';
export interface BeamChoice{size:JoistSize;plies:2|3}

const MM_PER_IN=25.4;
const metresToIn=(m:number)=>Math.floor(m*1000/MM_PER_IN+1e-9);

/** Dressed depth of dimension lumber, inches. */
export const ACTUAL_DEPTH_IN:Record<'2x6'|JoistSize,number>={'2x6':5.5,'2x8':7.25,'2x10':9.25,'2x12':11.25};

/**
 * Engine design defaults: Golden Maple's own layout choices, not code values. Each sits inside the cited limits,
 * and check-deck-structure.ts holds it there.
 */
export const DESIGN={
  /** Decking thickness assumed above the joists (5/4 or 1 in boards), matching the takeoff's joist elevation. */
  deckingThicknessIn:1,
  /** A 2-ply beam is used only when its posts can stand at least this far apart; otherwise 3-ply. */
  targetPostSpacingIn:96,
  /** How far a beam runs past its end posts (never more than the beam cantilever limit). */
  beamEndOverhangIn:Math.min(12,BEAM_CANTILEVER.maxIn),
  /** Posts under one beam stand at least this far apart, so two pier footings never overlap: the rule
   * yorkisestevez/goldenmaplelandscaping#102 set for belled piers. */
  minPostSpacingIn:24,
  /** No regular joist closer than this to the rim joist (centre to centre, less the rim's half-width). */
  minJoistGapIn:3,
  /** A drop beam needs its underside at least this far above grade: Barrie's 6 in of pier above grade, with the
   * beam in a saddle on the pier at the lowest. Lower decks set the beam flush with the joists. */
  minDropBeamUndersideIn:6,
} as const;

export function joistSpanLimitIn(size:JoistSize,spacingIn:12|16):number{
  const m=JOIST_TABLE.metres[size]?.[spacingIn];
  if(!m)throw new Error(`No joist span for ${size} at ${spacingIn} in`);
  return metresToIn(m);
}

/** The joist cantilever rule for a size: a fixed maximum, and a fraction of the joist span behind the beam. */
export function joistCantileverRule(size:JoistSize){
  return {maxIn:JOIST_CANTILEVER.maxIn[size],fractionOfSpan:JOIST_CANTILEVER.maxFractionOfSpan};
}

/** The joist cantilever allowed past a beam, given the joist span behind that beam. */
export function joistCantileverLimitIn(size:JoistSize,backspanIn:number):number{
  const rule=joistCantileverRule(size);
  return Math.min(rule.maxIn,rule.fractionOfSpan*backspanIn);
}

/** The largest gap between blocking rows, or between a row and a bearing. */
export const maxBlockingGapIn=Math.floor(BLOCKING.maxGapMm/MM_PER_IN);

/** Longest clear span between posts for a built-up beam of the given supported length, or 0 when the tables have none. */
export function beamSpanLimitIn(beam:BeamChoice,supportedLengthIn:number):number{
  const supportedM=supportedLengthIn*MM_PER_IN/1000;
  if(beam.plies===2){
    if(supportedM>BEAM_TABLE_2PLY.maxSupportedLengthM+1e-9)return 0;
    const [ft,inch]=BEAM_TABLE_2PLY.feetInches[beam.size];
    return ft*12+inch;
  }
  const i=BEAM_TABLE_3PLY.supportedLengthM.findIndex(r=>r>=supportedM-1e-9);
  return i<0?0:metresToIn(BEAM_TABLE_3PLY.metres[beam.size][i]);
}

/** The beam for a zone: joist-size lumber (Barrie's "same depth as joists"), 2-ply when its posts can stand
 * DESIGN.targetPostSpacingIn apart, otherwise 3-ply. */
export function pickBeam(joistSize:JoistSize,supportedLengthIn:number):BeamChoice{
  const two:BeamChoice={size:joistSize,plies:2};
  if(beamSpanLimitIn(two,supportedLengthIn)>=DESIGN.targetPostSpacingIn)return two;
  const three:BeamChoice={size:joistSize,plies:3};
  if(!beamSpanLimitIn(three,supportedLengthIn))throw new Error(`Supported length ${supportedLengthIn} in is past the beam table`);
  return three;
}

/** The references every framing result rests on, for proposals and drawings to cite. */
export function framingSources():{id:SourceId;label:string}[]{
  const ids=new Set<SourceId>([JOIST_TABLE.source,BLOCKING.source,BEAM_TABLE_3PLY.source,BEAM_TABLE_2PLY.source,JOIST_CANTILEVER.source,JOIST_CANTILEVER.ratioSource,BEAM_CANTILEVER.source]);
  return [...ids].map(id=>({id,label:`${SOURCES[id].publisher}, ${SOURCES[id].title}, ${SOURCES[id].edition}`}));
}
