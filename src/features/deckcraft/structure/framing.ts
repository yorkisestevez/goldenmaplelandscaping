import {ACTUAL_DEPTH_IN,DESIGN,beamSpanLimitIn,joistCantileverRule,joistSpanLimitIn,maxBlockingGapIn,pickBeam,type BeamChoice,type JoistSize} from './spanTables';

/**
 * Framing of one rectangular deck zone, from the span tables in spanTables.ts.
 *
 * Plan coordinates are in inches: x runs along the house (0 → widthIn) and z runs away from it (0 → depthIn).
 * Joists run along z and beams along x. An attached zone hangs its joists on a ledger at z = 0. A freestanding
 * zone gets a house-side beam instead, set in by the same cantilever as the front. A flush beam (a low deck) carries
 * joists on hangers, so they stop at it: flush-beam zones have no cantilever and their beams sit on the edges, as
 * do landings (edgeBeams), whose stringers bear at the edges.
 *
 * Rows are placed so that:
 * - every joist span is within the joist table;
 * - each end cantilever is within the cantilever rule;
 * - the fewest beam rows are used.
 *
 * One beam serves every row of the zone. Its posts are spaced evenly within its span, never closer than
 * DESIGN.minPostSpacingIn (so footings never overlap), and it runs past its end posts by at most the beam overhang.
 */
export type BeamRowKind='house'|'intermediate'|'front';
export interface BeamRow{
  /** Centre line of the beam, inches from the zone's back edge. */
  z:number;kind:BeamRowKind;
  /** The joist length this beam carries: half of each joist span beside it, plus any cantilever in full. */
  supportedLengthIn:number;
}
export interface FramingPost{x:number;z:number;row:BeamRowKind}
export interface RectFramingInput{
  widthIn:number;depthIn:number;
  /** Deck surface above grade, inches. */
  topIn:number;
  /** True when the zone hangs off a ledger; false frames a house-side beam. */
  ledger:boolean;
  joistSpacingIn:12|16;joistSize:JoistSize;
  /** A fixed beam, e.g. a doubled joist-size member; omitted picks one with pickBeam. */
  beam?:BeamChoice;
  /** Beams on the free edges and no joist cantilever, whatever the mount (a landing). */
  edgeBeams?:boolean;
}
export interface RectFraming{
  beamRows:BeamRow[];posts:FramingPost[];beam:BeamChoice;
  /** 'flush' sets the beam's top level with the joists' (low decks); 'drop' sets the joists on top of it. */
  beamMount:'flush'|'drop';
  /** True when the free-edge beams sit on the edges (a flush beam or a landing), so no joist cantilevers. */
  edgeBeams:boolean;
  /** Beam depth, and the elevation of its underside above grade. */
  beamDepthIn:number;beamBottomIn:number;
  /** Joist centre lines, rims included. */
  joistXsIn:number[];
  /** Blocking rows, inches from the zone's back edge, so no gap between rows or bearings exceeds the code's. */
  blockingZsIn:number[];
  /** The joist table's limit for this size and spacing, and the beam table's limit for the governing row. */
  joistSpanLimitIn:number;beamSpanLimitIn:number;
  /** The front (and freestanding house-side) joist cantilever past the outermost beam. */
  cantileverIn:number;
  /** How far a free edge lies past the centre line of its beam: the cantilever for a drop beam, or half the beam's
   * width for a flush edge beam, whose outer face is the edge. */
  edgeReachIn:number;
  /** Clear joist span between bearings (the ledger or beam rows). */
  joistSpanIn:number;
}

const RIM_CENTRE_IN=.75;

/** Evenly spaced joist spans and the cantilever that suits them, for n spans. */
function spansFor(depthIn:number,ledger:boolean,n:number,size:JoistSize,cantilever:boolean){
  // Each free end cantilevers c, capped at a fixed maximum and at a fraction f of its span s.
  // With k free ends, depth = k·c + n·s, so c ≤ f·s is c ≤ f·depth / (n + k·f).
  const k=ledger?1:2,{maxIn,fractionOfSpan:f}=joistCantileverRule(size);
  const c=cantilever?Math.max(0,Math.floor(Math.min(maxIn,f*depthIn/(n+k*f)))):0;
  return {cantileverIn:c,spanIn:(depthIn-k*c)/n};
}

/** Posts under a beam of the full zone width: end posts set in by the beam overhang, the rest evenly spaced. A beam
 * too short for two posts DESIGN.minPostSpacingIn apart stands on one post at its middle; one a little longer sets its
 * two posts exactly that far apart, which keeps each overhang within the limit. */
function postXs(widthIn:number,spanLimitIn:number){
  if(widthIn<DESIGN.minPostSpacingIn)return [widthIn/2];
  const inset=Math.min(DESIGN.beamEndOverhangIn,(widthIn-DESIGN.minPostSpacingIn)/2),run=widthIn-2*inset;
  const bays=Math.max(1,Math.ceil(run/spanLimitIn-1e-9));
  return Array.from({length:bays+1},(_,i)=>inset+run*i/bays);
}

/** Blocking rows inside each bay between bearings, evenly spaced so no gap exceeds the code's. */
function blockingRows(bearings:number[]){
  const rows:number[]=[];
  for(let i=0;i+1<bearings.length;i++){
    const a=bearings[i],b=bearings[i+1],count=Math.ceil((b-a)/maxBlockingGapIn-1e-9)-1;
    for(let k=1;k<=count;k++)rows.push(a+(b-a)*k/(count+1));
  }
  return rows;
}

export function frameRectangle(input:RectFramingInput):RectFraming{
  const {widthIn:w,depthIn:d,ledger,joistSpacingIn,joistSize}=input;
  const joistLimit=joistSpanLimitIn(joistSize,joistSpacingIn);
  // The mount comes first: joists hung between flush beams on hangers stop at the beam, so only a drop beam lets
  // them cantilever. The beam is joist-size lumber unless one is given, so its depth is known before the layout.
  const joistDepth=ACTUAL_DEPTH_IN[joistSize],beamDepth=ACTUAL_DEPTH_IN[input.beam?.size??joistSize];
  const joistTop=input.topIn-DESIGN.deckingThicknessIn,dropBottom=joistTop-joistDepth-beamDepth;
  const beamMount=dropBottom>=DESIGN.minDropBeamUndersideIn?'drop':'flush',edgeBeams=beamMount==='flush'||!!input.edgeBeams,cantilever=!edgeBeams;
  let n=1,layout=spansFor(d,ledger,1,joistSize,cantilever);
  while(layout.spanIn>joistLimit+1e-9&&n<20)layout=spansFor(d,ledger,++n,joistSize,cantilever);
  const {cantileverIn:c,spanIn:s}=layout,start=ledger?0:c;
  const rows:BeamRow[]=[];
  if(!ledger)rows.push({z:start,kind:'house',supportedLengthIn:s/2+c});
  for(let i=1;i<=n;i++)rows.push({z:start+s*i,kind:i===n?'front':'intermediate',supportedLengthIn:i===n?s/2+c:s});
  const governing=Math.max(...rows.map(r=>r.supportedLengthIn));
  const beam=input.beam??pickBeam(joistSize,governing),beamSpan=beamSpanLimitIn(beam,governing);
  if(!beamSpan)throw new Error(`${beam.plies}-ply ${beam.size} has no span for a supported length of ${governing} in`);
  // A beam on a free edge is that edge's rim: its outer face lines up with the deck edge, so its centre line sits half
  // the beam's width inside. The edge bay gets that much shorter, never longer.
  if(edgeBeams)for(const r of rows){const half=beam.plies*1.5/2;if(r.kind==='front')r.z=d-half;else if(r.kind==='house')r.z=half;}
  const xs=postXs(w,beamSpan);
  const joistXsIn=[RIM_CENTRE_IN];
  for(let x=joistSpacingIn;x<w-RIM_CENTRE_IN-DESIGN.minJoistGapIn;x+=joistSpacingIn)joistXsIn.push(x);
  if(w>2*RIM_CENTRE_IN)joistXsIn.push(w-RIM_CENTRE_IN);
  return {
    beamRows:rows,posts:rows.flatMap(r=>xs.map(x=>({x,z:r.z,row:r.kind}))),beam,beamMount,edgeBeams,
    beamDepthIn:beamDepth,beamBottomIn:beamMount==='drop'?dropBottom:joistTop-beamDepth,
    joistXsIn,blockingZsIn:blockingRows([ledger?0:rows[0].z,...rows.filter(r=>r.kind!=='house').map(r=>r.z)]),
    joistSpanLimitIn:joistLimit,beamSpanLimitIn:beamSpan,cantileverIn:c,joistSpanIn:s,edgeReachIn:d-rows.at(-1)!.z,
  };
}
