import {foundationDatums} from './foundationDatums';
import {stairTargetId,validateStairTargets} from './stairTargets';
import {addConstructionDetails,addRim,finishBoards,memberLength,unsupportedJoistEnds} from './constructionDetails';
import {boundaryBounds,freeFootprint} from './lib/freeOutline';
import {resolveStairPath,stairPathOffset} from './lib/stairPath';
import {applyRailSections} from './lib/edgeSections';
import {applyBoardLayout,physicalBoardPieceCount,type PlacedLayoutBreaker} from './boardLayout';
import {frameWrap,wrapBoardEndBlocking,planZones} from './wrapFraming';
import {activeWrap,type ActiveWrap,type WrapHip} from './lib/wrapGeometry';
import {polygonCut,polygonBoard,splitBoard,offsetPolygons,signedArea} from './lib/polygonCuts';
import {getFinishedFootprint} from './lib/finishedFootprint';
import {applyInlays,bandBuildUps,keepBreakers,planInlays,INLAY_KIND_NAMES,type InlayPlan} from './lib/inlayGeometry';
import {frameInlays} from './inlayFraming';
import {type DeckData, RAILING_COSTS} from './types';
import {DECKING_CATALOGUE} from './manufacturerRuntimeCatalogue';
import {finishedFasciaOffset} from './lib/finishedFootprint';
import {getStairSupport,getStringerOffsets,makeRiserBoards,type RiserBoard} from './stairConstruction';
import {framelessGlassLayout,glassPanelMembers,type FramelessGlassLayout} from './framelessGlass';
import {getHouseContact,exposedSides,deckAttachesToHouse,exposedHouseLine} from './houseContact';
import {getHouseConfig} from './houseSettings';
import {getHousePlacement} from './housePlacement';
import {blocksTowardDeck,getHouseBlocks,rectPolygon} from './houseFootprint';
import {angledBearing,angledCornerEdges,bearingOutline,frameAngledBearing} from './angledFraming';
import {angledStairAllowed,angledStairFits,isChamferEdgeId} from './lib/cornerChamfers';
import {outlineSpans,cleanPolygon,zoneReference,landingReference,shareHouseSideBeam,frameZoneBearings,frameZoneJoists,frameHouseSideBeams,type DeckZone,type FramedZone,type ZoneFramingConfig,type ZoneReference} from './zoneFraming';
import {edgeFacing,getFootprint,getBoardRows,getPictureFrameRuns,getStairPlacement,getRailingSegments,getHerringboneRows,clipToConvex,type StairPlacement,type PlanPoint,type FootprintPlan,type BoardRun} from './lib/deckGeometry';
export type V3={x:number;y:number;z:number};
export type Member={a:V3;b:V3;width:number;depth:number;role?:string;spliceStart?:boolean;spliceEnd?:boolean;stair?:{risers:number;rise:number;run:number;top:number;bottom:number}};
export type Box={x:number;y:number;z:number;w:number;h:number;d:number;angle?:number;polygon?:PlanPoint[];kind?:'tread'|'winder'|'riser';flightId?:string};
export type RailRun={a:V3;b:V3};
/** The guard: posts, rails, balusters and glass members. `frameless` is set only for a frameless glass railing. */
export type TakeoffRailing={posts:V3[];rails:Member[];balusters:Member[];glass:Member[];height:number;frameless?:FramelessGlassLayout};
export type DeckLevel={kind?:'deck'|'landing'|'winder';index?:number;rim?:Member[];
  /** Actual placed manual breaker spans. Absent on existing designs; numeric breakers remain the automatic ones. */
  layoutBreakers?:PlacedLayoutBreaker[];
  layoutIssues?:string[];
  /** Main deck with angled corners only: the angled front edges (their board ends sit on angled nailers). */
  angledEdges?:{a:PlanPoint;b:PlanPoint}[];footprint:FootprintPlan;deckingFootprint?:FootprintPlan;top:number;offset:V3;boards:BoardRun[];supports:V3[];joists:Member[];beams:Member[];blocking:Member[];breakers:number[];reference:ZoneReference;zones?:FramedZone[];
  /** Wrap-around main deck only: hip centre lines and the framing zones with their joist direction. */
  hips?:WrapHip[];wrapZones?:{id:string;label:string;outline:PlanPoint[];joistDir:PlanPoint}[];
  /** Decorative inlays planned on this level (lib/inlayGeometry.ts), built or not; absent when it has none. */
  inlays?:InlayPlan[]};
const distance=(a:V3,b:V3)=>Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
const mix=(a:V3,b:V3,t:number):V3=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
export function polygonArea(fp:FootprintPlan){return Math.abs(fp.outline.reduce((a,p,i)=>{const q=fp.outline[(i+1)%fp.outline.length];return a+p.x*q.y-q.x*p.y;},0))/288;}
const spans=(fp:FootprintPlan,x:number,axis:'x'|'z')=>outlineSpans(fp.outline,x,axis);
/**
 * How a level is split into framing zones, so every joist bears on a beam in its own zone:
 * - notched (L-shape / Multi-corner) decks split wherever the front depth changes, giving each
 *   wing its own beam row and posts (a doubled joist sits at each seam);
 * - a curved front on a drop-beam deck splits into strips whose front rises no more than the
 *   joist cantilever allowance, so each strip's beam follows the curve. Flush-beam decks allow
 *   almost no cantilever; their curve needs a curved beam and stays flagged by the bearing check.
 * Plain rectangles, second levels and landings stay a single zone (unchanged framing).
 */
function levelZones(footprint:FootprintPlan,attached:boolean,cfg:ZoneFramingConfig,isMain:boolean,houseCuts:number[]=[],angledXs:number[]=[],free=false):DeckZone[]{
  if(free){
    const {x,y,w,h}=boundaryBounds(footprint.outline),xs=[...new Set(footprint.outline.map(p=>p.x))].sort((a,b)=>a-b),zones:DeckZone[]=[];
    // Arbitrary concave polygons can make disconnected strips; keep each clipped region separate.
    for(let i=0;i+1<xs.length;i++)for(const outline of polygonCut([footprint.outline],[[{x:xs[i],y:y-1},{x:xs[i+1],y:y-1},{x:xs[i+1],y:y+h+1},{x:xs[i],y:y+h+1}]])){
      if(Math.abs(signedArea(outline))<1)continue;const b=boundaryBounds(outline);
      zones.push({id:`area-${zones.length+1}`,outline,origin:{x:b.x,y:b.y},size:{w:b.w,h:b.h},attached:attached&&Math.abs(b.y)<.01});
    }
    return zones.length?zones:[{id:'area',outline:footprint.outline,origin:{x,y},size:{w,h},attached}];
  }
  // A deck notched across its whole width by a bump-out starts at the bump-out's face, not at y = 0.
  const back=Math.min(...footprint.outline.map(p=>p.y)),backY=back>1e-6?back:0;
  const single:DeckZone[]=[{id:'main',outline:footprint.outline,origin:{x:0,y:backY},size:backY?{w:footprint.bounds.w,h:footprint.bounds.h-backY}:footprint.bounds,attached}];
  if(!isMain)return single;
  const W=footprint.bounds.w,outline=footprint.outline;
  let cuts:number[]=[];
  if(footprint.isCurved){
    const allow=zoneReference(single[0],cfg).cantileverIn-2;
    if(allow<10)return single;
    const front=(x:number)=>Math.max(...outlineSpans(outline,Math.min(W-1e-6,Math.max(1e-6,x)),'x').map(([,b])=>b));
    let start=0,lo=Infinity,hi=-Infinity;
    for(let x=0;x<=W;x++){const y=front(x);lo=Math.min(lo,y);hi=Math.max(hi,y);if(hi-lo>allow&&x-start>=24&&W-x>=24){cuts.push(x);start=x;lo=hi=y;}}
  // An angled corner's vertices are not a change of front depth: its joists bear on an angled beam instead.
  }else cuts=[...new Set(outline.filter(p=>p.y>1e-6&&p.x>.5&&p.x<W-.5&&!angledXs.some(x=>Math.abs(x-p.x)<.5)).map(p=>p.x))].sort((a,b)=>a-b);
  // Bump-out side walls split the deck too: the strip in front of a bump-out is framed off its own ledger.
  for(const x of houseCuts)if(x>.5&&x<W-.5&&!cuts.some(c=>Math.abs(c-x)<.5))cuts.push(x);
  cuts.sort((a,b)=>a-b);
  const xs=[0,...cuts,W],zones:DeckZone[]=[];
  for(let i=0;i+1<xs.length;i++){
    const x0=xs[i],x1=xs[i+1];if(x1-x0<1)continue;
    const part=cleanPolygon(clipToConvex(outline,[{x:x0,y:-1e5},{x:x1,y:-1e5},{x:x1,y:1e5},{x:x0,y:1e5}]));
    // Each strip is framed from its own back edge: y = 0 against the deck-facing wall, or a bump-out's face.
    const low=Math.min(...part.map(p=>p.y)),y0=low>1e-6?low:0;
    zones.push({id:`zone-${i+1}`,outline:part,origin:{x:x0,y:y0},size:{w:x1-x0,h:Math.max(...part.map(p=>p.y))-y0},attached});
  }
  return zones.length>1?zones:single;
}
export function buildDeckTakeoff(data:DeckData){
  const material=DECKING_CATALOGUE.find(m=>m.id===data.deckingMaterial)||DECKING_CATALOGUE[0];
  const gap=material.isComposite?0.1875:0.25;
  const stockLength=material.id==='cedar'?144:192;
  const spacing=data.pattern==='Diagonal'||data.pattern==='Herringbone'?12:data.joistSpacing;
  const joistDepth=data.framingSize==='2x8'?7.25:data.framingSize==='2x12'?11.25:9.25;
  const levels:DeckLevel[]=[];const railRuns:RailRun[]=[];const treads:Box[]=[];const riserBoards:RiserBoard[]=[];const stringers:Member[]=[];const stairOpenings:StairPlacement[]=[];
  const mainFp=getFootprint(data,1),mainContact=getHouseContact(data,mainFp);
  const wrap=activeWrap(data);
  function layoutLevel(level:DeckLevel,inset:number){
    if(!data.boardLayout||level.kind!=='deck'||level.index===undefined)return;
    const previousBoards=level.boards,result=applyBoardLayout(data,(level.index+1) as 1|2|3,level.deckingFootprint??level.footprint,previousBoards,{boardWidth:data.boardWidth,gap,stockLength,inset});
    level.boards=result.boards;
    if(result.breakers.length)level.layoutBreakers=result.breakers;
    if(result.issues.length)level.layoutIssues=result.issues;
    // An overwritten automatic breaker is no longer an installed breaker. Keep surviving numeric centres only.
    if(level.boards!==previousBoards)level.breakers=level.breakers.filter(x=>{
      const matches=(b:BoardRun)=>b.role==='breaker'&&!b.layoutKind&&Math.abs(b.angleDeg-90)<.01&&Math.abs(b.cx-x)<data.boardWidth/2+.01;
      return !previousBoards.some(matches)||level.boards.some(matches);
    });
  }
  /** A wrap-around main deck: zones framed off each house wall and joined on hips (see wrapFraming). */
  function makeWrapLevel(footprint:FootprintPlan,top:number,offset:V3,cfg:ZoneFramingConfig,wrap:ActiveWrap):DeckLevel{
    const borders=data.pictureFrameRows||(data.pattern==='Picture Frame'?1:0),inset=borders*(data.boardWidth+gap);
    const deckingFootprint=getFinishedFootprint(data,footprint,mainContact);
    const framed=frameWrap({wrap,cfg,deckingOutline:deckingFootprint.outline,inset,borders,boardWidth:data.boardWidth,gap,stockLength,houseSide:exposedHouseLine(data,footprint,mainContact),houseCut:blocksTowardDeck(getHouseBlocks(data)).map(b=>rectPolygon(b.rect)),houseCutXs:mainContact.contacts.filter(c=>c.kind==='flush').map(c=>c.a.x)});
    const boards:BoardRun[]=[...(borders?getPictureFrameRuns(deckingFootprint,borders as 1|2,data.boardWidth,gap):[]),...framed.fieldBoards];
    const installed=boards.flatMap(b=>splitBoard(b,data.boardWidth,stockLength,gap));
    const level:DeckLevel={kind:'deck',index:0,footprint,deckingFootprint,top,offset,supports:framed.supports,joists:framed.joists,beams:framed.beams,blocking:framed.blocking,boards:finishBoards(installed,deckingFootprint,data.boardWidth,gap,0,stockLength,inset),breakers:framed.breakers,reference:framed.reference,hips:framed.hips,wrapZones:planZones(framed.zones)};
    layoutLevel(level,inset);
    addRim(level);wrapBoardEndBlocking(level,framed.zones,framed.hips);
    return level;
  }
  function makeLevel(footprint:FootprintPlan,top:number,offset:V3,attached:boolean,kind:DeckLevel['kind']='deck',index=0){
    const cfg={top,spacing,framingSize:data.framingSize,joistDepth,pictureFrame:!!data.pictureFrameRows||data.pattern==='Picture Frame'};
    if(wrap&&kind==='deck'&&index===0)return makeWrapLevel(footprint,top,offset,cfg,wrap);
    const angled=kind==='deck'&&index===0?angledCornerEdges(footprint):[];
    // A 45° edge that cuts a corner off the deck (every other point on its house side) is framed within its strip
    // on an angled beam, as angled corners are. One inside a custom outline (a bay, a V) splits the deck at its
    // ends instead, so each strip has a single front edge.
    const cornerCut=(e:{a:PlanPoint;b:PlanPoint})=>{const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y,len=Math.hypot(dx,dy)||1;return footprint.outline.every(p=>((p.x-e.a.x)*dy-(p.y-e.a.y)*dx)/len<=.5);};
    // On a custom outline a step at the same point as a 45° edge still splits the deck there.
    const customDeck=kind==='deck'&&index===0&&data.shape==='Custom',o=footprint.outline;
    const stepXs=customDeck?o.flatMap((p,i)=>{const q=o[(i+1)%o.length];return Math.abs(p.x-q.x)<.5&&Math.abs(p.y-q.y)>.5&&p.x>.5&&p.x<footprint.bounds.w-.5?[p.x]:[];}):[];
    const free=kind==='deck'&&!!freeFootprint(data,(index+1) as 1|2|3);
    const framedZones=levelZones(footprint,attached,cfg,kind==='deck'&&index===0,attached&&index===0?mainContact.contacts.filter(c=>c.kind==='flush').map(c=>c.a.x):[],angled.filter(cornerCut).flatMap(e=>[e.a.x,e.b.x]).filter(x=>!stepXs.some(s=>Math.abs(s-x)<.5)),free).map(zone=>({zone,reference:kind==='landing'?landingReference(zone,cfg):zoneReference(zone,cfg)}));
    const zones=shareHouseSideBeam(framedZones,cfg),reference=zones[0].reference;
    const supports:V3[]=[],joists:Member[]=[],beams:Member[]=[],blocking:Member[]=[];
    for(const zone of zones){
      // Angled corners: the zone's rows and posts stay behind each angled beam, which carries the joist ends there.
      const bearings=angled.flatMap(e=>{const b=angledBearing(e,zone);return b?[b]:[];});
      frameZoneBearings(zone,offset,{supports,beams},bearings.length?bearingOutline(zone,bearings):undefined);
      for(const b of bearings)frameAngledBearing(zone,b,offset,{supports,beams});
    }
    if(attached&&index===0)frameHouseSideBeams(exposedHouseLine(data,footprint,mainContact),footprint.bounds.h,cfg,offset,{supports,beams});
    const borders=data.pictureFrameRows||(data.pattern==='Picture Frame'?1:0),inset=borders*(data.boardWidth+gap);
    const deckingFootprint=getFinishedFootprint(data,footprint,attached?mainContact:undefined),fieldPolygons=offsetPolygons([deckingFootprint.outline],inset),fieldXs=fieldPolygons.flat().map(p=>p.x),fieldLeft=fieldXs.length?Math.min(...fieldXs):inset;
    const fieldWidth=fieldXs.length?Math.max(...fieldXs)-fieldLeft:0,breakerZone=data.boardWidth+2*gap;
    let breakerCount=0;while((fieldWidth-breakerCount*breakerZone)/(breakerCount+1)>stockLength+1e-6)breakerCount++;
    const segment=(fieldWidth-breakerCount*breakerZone)/(breakerCount+1);
    const allBreakers=data.pattern==='Straight'||data.pattern==='Picture Frame'?Array.from({length:breakerCount},(_,i)=>fieldLeft+(i+1)*segment+i*breakerZone+gap+data.boardWidth/2):[];
    // Decorative inlays on this deck level (lib/inlayGeometry.ts), planned on its field before it is framed: a band
    // running front to back sits on build-up joists, as a breaker does, and takes the place of a breaker it meets.
    const levelInlays=kind==='deck'?(data.inlays??[]).filter(i=>(i.level??1)===index+1):[];
    const inlayPlans=levelInlays.length?planInlays(levelInlays,{fieldPolygons,boardWidth:data.boardWidth,gap,stockLength,centre:{x:(footprint.origin?.x??0)+footprint.bounds.w/2,y:(footprint.origin?.y??0)+footprint.bounds.h/2},straight:data.pattern==='Straight'||data.pattern==='Picture Frame',...(index===0&&data.hasInlay?{blocked:'Replace the centre inlay stripe with a band (on the finish step) to build decorative inlays on the main deck.'}:{})}):[];
    const breakers=inlayPlans.length?keepBreakers(allBreakers,inlayPlans,data.boardWidth,gap):allBreakers;

    const buildUps=[...breakers.flatMap(x=>[-1.5,-.5,.5,1.5].map(k=>x+k*(1.5+.375))),...(borders?[1.5+2.375,1.5+2*2.375,footprint.bounds.w-1.5-2.375,footprint.bounds.w-1.5-2*2.375]:[]),...bandBuildUps(inlayPlans,data.boardWidth,gap)];
    for(const zone of zones)frameZoneJoists(zone,offset,cfg,buildUps,{joists,blocking});
    // Corner-cutting 45° edges line the 45° layouts up with themselves, one per direction (see getBoardRows /
    // getHerringboneRows): running left toward the house ('left', like the front-left corner) or away from it.
    const cutting=angled.filter(cornerCut),leftAngled=cutting.some(e=>e.b.y<e.a.y),rightAngled=cutting.some(e=>e.b.y>e.a.y),anyAngled=angled.length>0;
    const fieldPts=leftAngled||rightAngled?fieldPolygons.flat():[];
    // A custom outline lines herringbone up with its longest 45° edge of each direction, wherever it is.
    const familyLine=(value:(p:PlanPoint)=>number)=>fieldPolygons.flatMap(poly=>poly.map((p,i)=>{const q=poly[(i+1)%poly.length];return {p,q,len:Math.hypot(q.x-p.x,q.y-p.y)};}))
      .filter(e=>e.len>1&&Math.abs(e.q.x-e.p.x)>.01&&Math.abs(value(e.q)-value(e.p))<.01).sort((e,f)=>f.len-e.len).map(e=>value(e.p))[0];
    const customLeft=customDeck&&anyAngled?familyLine(p=>p.y-p.x):undefined,customRight=customDeck&&anyAngled?familyLine(p=>p.x+p.y):undefined;
    const align=customDeck&&anyAngled?(customLeft===undefined&&customRight===undefined?undefined:{...(customLeft!==undefined?{leftLine:customLeft}:{}),...(customRight!==undefined?{rightLine:customRight}:{})}):leftAngled||rightAngled?{...(leftAngled?{leftLine:Math.max(...fieldPts.map(p=>p.y-p.x))}:{}),...(rightAngled?{rightLine:Math.max(...fieldPts.map(p=>p.x+p.y))}:{})}:undefined;
    const field=data.pattern==='Herringbone'?getHerringboneRows(deckingFootprint,data.boardWidth,gap,inset,align):getBoardRows(deckingFootprint,{boardWidth:data.boardWidth,gap,angleDeg:data.pattern==='Diagonal'?45:0,inset,maxBoardLen:breakers.length||breakers.length<allBreakers.length?100000:stockLength,...(data.pattern==='Diagonal'&&leftAngled?{anchor:'top' as const}:{}),...(data.pattern==='Diagonal'&&anyAngled&&customDeck?{alignToEdges:true}:{})});
    const boards:BoardRun[]=[...(borders?getPictureFrameRuns(deckingFootprint,borders as 1|2,data.boardWidth,gap):[])];
    for(const b of field){let intervals:[number,number][]=[[b.cx-b.length/2,b.cx+b.length/2]];if(!b.angleDeg)for(const x of breakers){const lo=x-data.boardWidth/2-gap,hi=x+data.boardWidth/2+gap;intervals=intervals.flatMap(([a,z])=>z<=lo||a>=hi?[[a,z]]:[...(a<lo?[[a,lo]]:[]),...(z>hi?[[hi,z]]:[])] as [number,number][]);}if(b.angleDeg)boards.push(b);else for(const [a,z]of intervals)if(z-a>.001){if(b.polygon)for(const p of polygonCut([b.polygon],[[{x:a,y:-10000},{x:z,y:-10000},{x:z,y:10000},{x:a,y:10000}]]))boards.push(polygonBoard(p,0,b.role));else boards.push({...b,cx:(a+z)/2,length:z-a});}}
    // 45° edges: a breaker is cut from the field outline, so one reaching an angled edge ends on its 45° line.
    const breakerStrip=(x:number,y0:number,y1:number)=>[{x:x-data.boardWidth/2,y:y0},{x:x+data.boardWidth/2,y:y0},{x:x+data.boardWidth/2,y:y1},{x:x-data.boardWidth/2,y:y1}];
    if(anyAngled||free)for(const x of breakers)for(const region of polygonCut(fieldPolygons,[breakerStrip(x,-10000,10000)])){
      const ys=region.map(p=>p.y),end=Math.max(...ys);
      for(let z=Math.min(...ys);z<end-.001;z+=stockLength+gap)for(const p of polygonCut([region],[breakerStrip(x,z,Math.min(end,z+stockLength))]))boards.push(polygonBoard(p,90,'breaker'));
    }
    else for(const x of breakers)for(const [a,b]of spans(deckingFootprint,x,'x')){const from=a+inset,to=b-inset;for(let z=from;z<to;z+=stockLength+gap){const len=Math.min(stockLength,to-z);boards.push({cx:x,cy:z+len/2,length:len,angleDeg:90,role:'breaker'});}}
    // The boards cut around the inlays planned above, and the inlays' own boards.
    const installed=(inlayPlans.length?applyInlays(boards,inlayPlans,data.boardWidth,gap):boards).flatMap(b=>splitBoard(b,data.boardWidth,stockLength,gap));
    const result:DeckLevel={kind,index,footprint,deckingFootprint,top,offset,supports,joists,beams,blocking,boards:finishBoards(installed,deckingFootprint,data.boardWidth,gap,kind==='deck'&&index===0&&data.hasInlay?data.inlayLf*12:0,stockLength,inset,anyAngled||free?fieldPolygons:undefined),breakers,reference,...(zones.length>1?{zones}:{}),...(angled.length?{angledEdges:angled}:{})};
    layoutLevel(result,inset);
    if(inlayPlans.length){result.inlays=inlayPlans;frameInlays(result,inlayPlans,{boardWidth:data.boardWidth,gap,spacing,pattern:data.pattern});}
    addConstructionDetails(result,data.boardWidth,borders);
    // Custom outlines only (existing designs keep their blocks): a board-end block with no length, between members
    // that touch (a V-shaped 45° front can put two there), is no block.
    if(customDeck)result.blocking=result.blocking.filter(b=>b.role!=='board-end'||memberLength(b)>=.05);
    return result;
  }
  levels.push(makeLevel(mainFp,data.height,{x:0,y:0,z:0},deckAttachesToHouse(data)&&(!data.deckOutlines?.main||mainContact.contacts.length>0),'deck',0));
  /** A stair flight. A straight one carries its plan directions (outward = downhill) and how far its treads and risers
   * run past `width` at each end (a full-width step reaching its level's finished edge). */
  type Flight={id:string;kind:'grade'|'connection';risers:number;rise:number;run:number;width:number;start:V3;end:V3;type:string;stringerOffsets:number[];along?:PlanPoint;outward?:PlanPoint;endExtend?:number;endWidth?:number;terminationEdge?:{a:PlanPoint;b:PlanPoint};winderCenter?:PlanPoint;winderRadiusIn?:number};
  const stairSupport=getStairSupport(data,gap);
  const issues:string[]=[],flights:Flight[]=[],connections:{from:number;to:number;opening:StairPlacement;run:number}[]=[];
  const openings=new Map<number,StairPlacement[]>();
  const addOpening=(index:number,p:StairPlacement)=>openings.set(index,[...(openings.get(index)||[]),p]);
  // A railed step that stands on a lower level: its side lines (in world plan inches), where its own rails replace that level's guard.
  const stepSides:{level:number;origin:PlanPoint;dir:PlanPoint;length:number}[]=[];
  const run=stairSupport.runIn;
  const targets=validateStairTargets(data.stairTargets??[]);
  let gradeRun=data.stairTreadDepthIn??run;
  const gradeSettings=(id:string,top:number)=>{const target=targets.find(t=>t.flightId===id),bottom=target?.elevationIn??0,n=target?.riserCount??data.stairRiserCount??Math.max(1,Math.ceil((top-bottom)/7.75));gradeRun=target?.treadDepthIn??data.stairTreadDepthIn??run;return {target,bottom,n,rise:(top-bottom)/n};};
  function addStraight(origin:V3,outward:PlanPoint,along:PlanPoint,width:number,n:number,rise:number,kind:Flight['kind'],id:string,startOffset=(data.pictureFrameRows||data.pattern==='Picture Frame')?finishedFasciaOffset(data):0,opts:{rails?:boolean;stringers?:boolean;endExtend?:number}={}){
    const run=kind==='grade'?gradeRun:stairSupport.runIn;
    const e=opts.endExtend??0;
    const start={x:origin.x+outward.x*startOffset,y:origin.y,z:origin.z+outward.y*startOffset};
    const end={x:start.x+outward.x*run*Math.max(0,n-1),y:start.y-n*rise,z:start.z+outward.y*run*Math.max(0,n-1)};
    const yaw=Math.atan2(outward.x,outward.y),stringerOffsets=getStringerOffsets(width,stairSupport.spacingIn,stairSupport.minimumStringers);
    for(let i=0;i<n;i++)riserBoards.push(...makeRiserBoards({x:start.x+outward.x*i*run,y:start.y-i*rise,z:start.z+outward.y*i*run},along,outward,width+2*e,rise,stairSupport,data.deckingMaterial,id,i));
    if(rise<=1)issues.push('A stair rise is no greater than the modeled tread thickness; this transition needs a reviewed threshold detail.');
    for(let i=1;i<n;i++){const d=(i-.5)*run+stairSupport.treadNosingIn/2;treads.push({x:start.x+outward.x*d,y:start.y-i*rise-.5,z:start.z+outward.y*d,w:width+2*e,h:1,d:run+stairSupport.treadNosingIn,angle:yaw,kind:'tread',...(kind==='grade'?{flightId:stairTargetId(id)}:{})});}
    if(opts.stringers!==false)for(const shift of stringerOffsets){stringers.push({a:{x:start.x+along.x*shift,y:start.y-9,z:start.z+along.y*shift},b:{x:end.x+along.x*shift,y:end.y-4,z:end.z+along.y*shift},width:1.5,depth:9.25,role:'stringer',stair:{risers:n,rise,run,top:start.y,bottom:end.y}});}
    if(data.railingType!=='None'&&data.railDefault!==false&&opts.rails!==false)for(const side of [-1,1]){const shift=side*width/2;railRuns.push({a:{x:start.x+along.x*shift,y:start.y,z:start.z+along.y*shift},b:{x:end.x+along.x*shift,y:end.y,z:end.z+along.y*shift}});}
    flights.push({id,kind,risers:n,rise,run,width,start,end,type:'Straight',stringerOffsets,along,outward,...(e?{endExtend:e}:{})});return end;
  }
  function addInlineLanding(start:V3,outward:PlanPoint,along:PlanPoint,width:number,n:number,rise:number,kind:Flight['kind'],id:string){
    const upper=Math.ceil(n/2),lower=n-upper,end=addStraight(start,outward,along,width,upper,rise,kind,`${id}-upper`),depth=Math.max(width,data.landingDepthIn||48);
    const cx=end.x+outward.x*depth/2,cz=end.z+outward.y*depth/2,w=Math.abs(along.x)*width+Math.abs(outward.x)*depth,h=Math.abs(along.y)*width+Math.abs(outward.y)*depth;
    const fp:FootprintPlan={bounds:{w,h},isCurved:false,outline:[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}]};
    levels.push(makeLevel(fp,end.y,{x:cx-w/2,y:0,z:cz-h/2},false,'landing',levels.length));
    if(data.railingType!=='None'&&data.railDefault!==false)for(const side of [-1,1])railRuns.push({a:{x:end.x+along.x*width/2*side,y:end.y,z:end.z+along.y*width/2*side},b:{x:end.x+outward.x*depth+along.x*width/2*side,y:end.y,z:end.z+outward.y*depth+along.y*width/2*side}});
    return addStraight({x:end.x+outward.x*depth,y:end.y,z:end.z+outward.y*depth},outward,along,width,lower,rise,kind,`${id}-lower`);
  }
  // Further sections sit physically adjacent to a stair run from their parent deck, rather than
  // floating twelve inches away. The attachment edge is cut out of both guard runs. A section never
  // runs into the house: it slides along its parent's edge until clear (its back then lines up with
  // the house wall), keeping the opening on its edge; if it cannot, the design is flagged.
  const house=getHousePlacement(data),deckIndex:number[]=[0];
  const worldOutline=(l:DeckLevel)=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}));
  function attachLevel(parentIndex:number,fp:FootprintPlan,top:number,place:{side:'Front'|'Left'|'Right'|'Back';edgeId?:string;offsetPct:number;fullStep?:boolean},index:number,label:string,id:string){
    const manual=data.deckOutlineOffsets?.[index===1?'second':'third'];
    const manualOffset=manual?{x:manual.x*12,y:0,z:manual.y*12}:undefined;
    const parent=levels[parentIndex],pfp=parent.footprint,contact=parentIndex===0?mainContact:undefined;
    let side:'Front'|'Left'|'Right'|'Back'=place.side;
    if(place.edgeId&&pfp.edgeIds){const i=pfp.edgeIds.indexOf(place.edgeId);if(i>=0&&!contact?.isContactEdge(i)){const a=pfp.outline[i],b=pfp.outline[(i+1)%pfp.outline.length],len=Math.hypot(b.x-a.x,b.y-a.y);side=edgeFacing({x:(b.y-a.y)/len,y:-(b.x-a.x)/len});}}
    const edgeLen=side==='Front'||side==='Back'?fp.bounds.w:fp.bounds.h;
    const opening=getStairPlacement({...data,stairFlights:1,stairPosition:side,stairOffset:place.offsetPct,stairWidth:Math.abs(parent.top-top)<.01||place.fullStep?edgeLen:Math.min(data.stairWidth,edgeLen),stairEdgeId:place.edgeId},pfp,contact);
    if(!opening){issues.push(`The ${label} has no open ${side.toLowerCase()} edge to join; choose another side.`);if(manualOffset){deckIndex.push(levels.length);levels.push(makeLevel(fp,top,manualOffset,false,'deck',index));}return;}
    const delta=Math.abs(parent.top-top),n=delta>.01?Math.ceil(delta/7.75):0,rise=n?delta/n:0,spaced=n>14?Math.max(0,n-2)*run+Math.max(opening.width,data.landingDepthIn||48):Math.max(0,n-1)*run;
    const center={x:parent.offset.x+opening.origin.x+opening.along.x*opening.width/2,z:parent.offset.z+opening.origin.y+opening.along.y*opening.width/2};
    const o=opening.outward,k=Math.abs(o.y)>.5?'x':'z',size=k==='x'?fp.bounds.w:fp.bounds.h;
    const hits=(v:V3)=>v.x+fp.bounds.w>house.x0+.5&&v.x<house.x1-.5&&v.z+fp.bounds.h>-house.depthIn+.5&&v.z<-.5;
    // Where the level goes `distance` out from its parent's edge, slid along that edge (x for front/back, z for sides)
    // to keep clear of the house; its own opening is centred unless it had to slide.
    const placeAt=(distance:number)=>{
      if(manualOffset){const outline=fp.outline.map(p=>({x:p.x+manualOffset.x,y:p.y+manualOffset.z}));return {distance,offset:{...manualOffset},childOffsetPct:50,intoHouse:polygonCut([outline],[rectPolygon({x0:house.x0,x1:house.x1,y0:-house.depthIn,y1:0})]).some(p=>Math.abs(signedArea(p))>1),outline,overlaps:deckIndex.filter(i=>polygonCut([outline],[worldOutline(levels[i])]).some(p=>Math.abs(signedArea(p))>1))};}
      const offset:V3=o.y>.5?{x:center.x-fp.bounds.w/2,y:0,z:center.z+distance}:o.x<-.5?{x:center.x-distance-fp.bounds.w,y:0,z:center.z-fp.bounds.h/2}:o.x>.5?{x:center.x+distance,y:0,z:center.z-fp.bounds.h/2}:{x:center.x-fp.bounds.w/2,y:0,z:center.z-distance-fp.bounds.h};
      let childOffsetPct=50,intoHouse=false;
      if(hits(offset)){
        const lo=k==='x'?house.x0:-house.depthIn,hi=k==='x'?house.x1:0,a0=center[k]-opening.width/2,a1=center[k]+opening.width/2;
        const shift=[hi-offset[k],lo-size-offset[k]].filter(s=>offset[k]+s<=a0+.01&&offset[k]+s+size>=a1-.01).sort((p,q)=>Math.abs(p)-Math.abs(q))[0];
        if(shift!==undefined){offset[k]+=shift;childOffsetPct=size-opening.width>1e-9?Math.min(100,Math.max(0,(a0-offset[k])/(size-opening.width)*100)):50;}
        else intoHouse=true;
      }
      const outline=fp.outline.map(p=>({x:p.x+offset.x,y:p.y+offset.z}));
      const overlaps=deckIndex.filter(i=>polygonCut([outline],[worldOutline(levels[i])]).some(p=>Math.abs(signedArea(p))>1));
      return {distance,offset,childOffsetPct,intoHouse,outline,overlaps};
    };
    // Levels meet as they are built (owner decision 2026-09-25): the step between them stands on the lower level, off
    // the higher level's edge, so there is no trench beside it and no slot at its ends. The step and 36 in in front of
    // it must fit on the lower level, and the join must not run into the house or another level the old spacing
    // cleared; otherwise the levels keep the old spacing (a stair-run apart, or a landing apart past 14 risers).
    let placed=placeAt(spaced);
    if(n>0&&n<=14&&spaced>0){
      const touching=placeAt(0),parentHigher=parent.top>=top,dir=parentHigher?o:{x:-o.x,y:-o.y};
      const lower=parentHigher?touching.outline:worldOutline(parent),edge={x:parent.offset.x+opening.origin.x,y:parent.offset.z+opening.origin.y},u=opening.along;
      const reach=((data.pictureFrameRows||data.pattern==='Picture Frame')?finishedFasciaOffset(data):0)+(n-1)*run+stairSupport.treadNosingIn+36;
      const at=(t:number,d:number)=>({x:edge.x+u.x*t+dir.x*d,y:edge.y+u.y*t+dir.y*d});
      const room=[at(.5,.01),at(opening.width-.5,.01),at(opening.width-.5,reach),at(.5,reach)];
      const outside=polygonCut([room],[lower],true).reduce((n,p)=>n+Math.abs(signedArea(p)),0);
      const fits=outside<=1&&!(touching.intoHouse&&!placed.intoHouse)&&touching.overlaps.every(i=>placed.overlaps.includes(i));
      if(fits)placed=touching;
      else issues.push(`The step between the ${parentIndex===0?'main deck':'second level'} and the ${label} does not fit on the lower level (${Math.round(reach)} in needed in front of the higher edge), so the levels are kept a stair-run apart. Make the lower level deeper to join them.`);
    }
    const distance=placed.distance,offset=placed.offset,childOffsetPct=placed.childOffsetPct;
    if(placed.intoHouse)issues.push(`The ${label} runs into the house. Make it smaller or join it on another side before construction.`);
    const levelIndex=levels.length;
    levels.push(makeLevel(fp,top,offset,false,'deck',index));deckIndex.push(levelIndex);
    // Real outlines, not bounding boxes: a wrap-around's box covers the house between its wings.
    for(const i of deckIndex.slice(0,-1))if(polygonCut([worldOutline(levels[levelIndex])],[worldOutline(levels[i])]).some(p=>Math.abs(signedArea(p))>1))issues.push(`The ${label} overlaps ${i===0?'the main deck':'another deck level'}. Join it on another side or change its size before construction.`);
    const opposite=side==='Front'?'Back':side==='Left'?'Right':side==='Right'?'Left':'Front';
    const other=getStairPlacement({...data,stairFlights:1,stairPosition:opposite,stairOffset:childOffsetPct,stairWidth:opening.width,stairEdgeId:undefined},fp);
    if(manualOffset){
      const world={x:opening.origin.x+parent.offset.x+o.x*distance,y:opening.origin.y+parent.offset.z+o.y*distance},onChild=(p:PlanPoint)=>fp.outline.some((a,i)=>{const b=fp.outline[(i+1)%fp.outline.length],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),q={x:p.x-manualOffset.x,y:p.y-manualOffset.z};return len>0&&Math.abs((q.x-a.x)*dy-(q.y-a.y)*dx)/len<.5&&((q.x-a.x)*dx+(q.y-a.y)*dy)/len>=-.5&&((q.x-a.x)*dx+(q.y-a.y)*dy)/len<=len+.5;});
      if(!other||!onChild(world)||!onChild({x:world.x+opening.along.x*opening.width,y:world.y+opening.along.y*opening.width})){issues.push(`The edited ${label} no longer meets its connecting edge. Its position is preserved; reconnect it before construction.`);return;}
    }
    if(!other){issues.push(`The ${label} needs an exposed edge for its connection.`);return;}
    addOpening(parentIndex,opening);addOpening(levelIndex,other);connections.push({from:parentIndex,to:levelIndex,opening,run:distance});
    // A full-width split-level step of up to three risers needs no stair guards; a single riser sits on the lower rim.
    // A step as wide as the level's edge runs its treads and risers out to the rim face at each end, so its ends line up
    // with the finished edge below (no notch). Stringers and rails keep the framing width.
    const flush=distance===0&&n>1&&Math.abs(opening.width-edgeLen)<.5?finishedFasciaOffset(data):0;
    const stepOpts=place.fullStep?{rails:n>3,stringers:n>1,endExtend:flush}:{endExtend:flush};
    if(n){const parentHigher=parent.top>=top;const start=parentHigher?{x:center.x,y:parent.top,z:center.z}:{x:center.x+o.x*distance,y:top,z:center.z+o.y*distance};(n>14?addInlineLanding:(a:V3,b:PlanPoint,c:PlanPoint,d:number,e:number,f:number,g:Flight['kind'],h:string)=>addStraight(a,b,c,d,e,f,g,h,undefined,stepOpts))(start,parentHigher?o:{x:-o.x,y:-o.y},opening.along,opening.width,n,rise,'connection',id);}
    // Standing on the lower level, a railed step's own rails guard its sides there.
    if(n&&n<=14&&distance===0&&data.railingType!=='None'&&stepOpts.rails!==false){
      const dir=parent.top>=top?o:{x:-o.x,y:-o.y},length=((data.pictureFrameRows||data.pattern==='Picture Frame')?finishedFasciaOffset(data):0)+(n-1)*run;
      for(const side of [-1,1])stepSides.push({level:parent.top>=top?levelIndex:parentIndex,origin:{x:center.x+opening.along.x*side*opening.width/2,y:center.z+opening.along.y*side*opening.width/2},dir,length});
    }
  }
  if(data.levels>1)attachLevel(0,getFootprint(data,2),data.height2,{side:data.level2Position||'Front',edgeId:data.level2EdgeId,offsetPct:data.level2Offset??50,fullStep:data.level2FullStep},1,'second level','level-connection');
  if(data.levels>2&&data.level3&&deckIndex.length===2){
    const l3=data.level3,w=Math.max(12,l3.widthFt*12),h=Math.max(12,l3.lengthFt*12);
    attachLevel(l3.parent===2?deckIndex[1]:0,freeFootprint(data,3)??{outline:[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}],bounds:{w,h},isCurved:false},l3.heightIn,{side:l3.position,edgeId:l3.parent===1?l3.edgeId:undefined,offsetPct:l3.offsetPct,fullStep:l3.fullStep},2,'third level','level3-connection');
  }
  // Flights go only on sides with an exposed edge; a primary side against the house is never used.
  // A named wrap edge (e.g. a wing end) sets the primary flight's side; other flights use other sides.
  // Grade stairs leave from the lowest deck level (the later one on a tie).
  const exitLevel=deckIndex.reduce((best,i)=>levels[i].top<=levels[best].top?i:best,0);
  // A stair opens on an angled corner only as one straight flight of up to 14 risers from the main deck, on a
  // face at least as wide as the stair; otherwise it keeps to the chosen side. Loading and editing already
  // drop such a choice (pruneEdgeNames); this covers a design that skipped them.
  const angledIndex=isChamferEdgeId(data.stairEdgeId)?mainFp.edgeIds?.indexOf(data.stairEdgeId!)??-1:-1;
  const angledFace=angledIndex<0?0:Math.hypot(mainFp.outline[(angledIndex+1)%mainFp.outline.length].x-mainFp.outline[angledIndex].x,mainFp.outline[(angledIndex+1)%mainFp.outline.length].y-mainFp.outline[angledIndex].y);
  const angledTarget=targets.find(t=>t.flightId==='grade-0');
  const angledOk=angledIndex>=0&&exitLevel===0&&angledStairAllowed(angledTarget?{...data,height:data.height-angledTarget.elevationIn,stairRiserCount:angledTarget.riserCount}:data)&&angledStairFits(angledFace,data.stairWidth);
  const stairName=isChamferEdgeId(data.stairEdgeId)&&!angledOk?undefined:data.stairEdgeId;
  if(angledIndex>=0&&!angledOk&&data.stairFlights>0)issues.push('A stair on an angled corner must be one straight flight of up to 14 risers from the main deck, on a face at least as wide as the stair, so it uses the chosen stair side instead.');
  const named=stairName&&mainFp.edgeIds&&data.stairFlights>0?getStairPlacement({...data,stairEdgeId:stairName},mainFp,mainContact):null;
  const namedAngled=!!named&&isChamferEdgeId(stairName);
  // A stair on an angled corner leaves every side free for further flights (the real front included).
  const sides=exposedSides(mainFp,mainContact),primary=named&&mainFp.edgeIds?.[named.edgeIndex!]===stairName?named.edge:data.stairPosition,edges=namedAngled?[primary,...sides]:[...(sides.includes(primary)?[primary]:[]),...sides.filter(e=>e!==primary)];
  const deck=levels[exitLevel],exitData=exitLevel?{...data,deckType:'Freestanding' as const}:data;
  if(!data.stairPath&&data.stairFlights>edges.length)issues.push('The requested stair exit count exceeds available exposed deck edges.');
  let risers=0;
  if(data.stairPath&&data.stairFlights>0){
    const path=resolveStairPath(data,deck.footprint,exitLevel===0?mainContact:undefined,openings.get(exitLevel)),{n,rise,bottom}=gradeSettings('grade-path',deck.top),going=gradeRun;
    issues.push(...path.issues);risers=n;
    const segments=path.segments,startOffset=(data.pictureFrameRows||data.pattern==='Picture Frame')?finishedFasciaOffset(data):0,reach=startOffset+(n-1)*going+stairSupport.treadNosingIn;
    const offset=(d:number)=>stairPathOffset(segments,d).map(p=>({x:p.x+deck.offset.x,y:p.y+deck.offset.z})),near=offset(startOffset),endLine=offset(startOffset+(n-1)*going),far=offset(reach);
    const footprints=segments.map((_,i)=>[near[i],near[i+1],far[i+1],far[i]]);
    const overlap=footprints.some((p,i)=>footprints.slice(i+1).some(q=>polygonCut([p],[q]).some(v=>Math.abs(signedArea(v))>1)));
    const blocked=overlap||footprints.some(p=>getHouseBlocks(data).some(b=>polygonCut([p],[rectPolygon(b.rect)]).some(q=>Math.abs(signedArea(q))>1))||deckIndex.filter(i=>i!==exitLevel).some(i=>polygonCut([p],[worldOutline(levels[i])]).some(q=>Math.abs(signedArea(q))>1)));
    if(n>14||rise<=1)issues.push('This stair path needs a reviewed landing or rise detail before its stairs can be built. Use no more than 14 continuous risers above the modeled tread thickness.');
    else if(blocked)issues.push('The stair wrap runs into the house or another deck level. Shorten or relocate the path before construction.');
    else if(segments.length){
      if(rise>7.75||rise<4.875)issues.push(`Edited stair count gives ${rise.toFixed(2)}-inch rises; review the rise limits before construction.`);
      if(segments.length>1)issues.push('Wrapped stairs use shared mitred treads and a corner stringer. Corner connections and foundation support require builder review.');
      const box=(polygon:PlanPoint[],y:number,h:number,kind:Box['kind'])=>{const b=boundaryBounds(polygon);return {x:b.x+b.w/2,y,z:b.y+b.h/2,w:b.w,h,d:b.h,polygon,kind};};
      for(let i=0;i<segments.length;i++){
        const s=segments[i],id=`grade-path-${i}`,a=near[i],b=near[i+1],endA=endLine[i],endB=endLine[i+1],start={x:(a.x+b.x)/2,y:deck.top,z:(a.y+b.y)/2},end={x:(endA.x+endB.x)/2,y:bottom,z:(endA.y+endB.y)/2};
        stairOpenings.push(s);addOpening(exitLevel,s);
        const ri=riserBoards.length,ti=treads.length,si=stringers.length;
        addStraight({x:s.origin.x+s.along.x*s.width/2+deck.offset.x,y:deck.top,z:s.origin.y+s.along.y*s.width/2+deck.offset.z},s.outward,s.along,s.width,n,rise,'grade',id,startOffset,{rails:false});
        riserBoards.length=ri;treads.length=ti;
        const built=flights[flights.length-1],keep=(_:unknown,j:number)=>!(i>0&&j===0||i+1<segments.length&&j===built.stringerOffsets.length-1),actual=built.stringerOffsets.filter(keep);
        stringers.splice(si,stringers.length-si,...stringers.slice(si).filter(keep));
        // Each course has a common corner vertex; both segments stop on the same mitre plane.
        let allowanceWidth=0;
        for(let r=0;r<n;r++){
          const d=startOffset+r*going,p=offset(d),q=offset(d-stairSupport.riserThicknessIn),p0=p[i],p1=p[i+1],q0=q[i],q1=q[i+1],width=Math.hypot(p1.x-p0.x,p1.y-p0.y);
          allowanceWidth+=width;
          const u={x:(p1.x-p0.x)/width,y:(p1.y-p0.y)/width},center={x:(p0.x+p1.x)/2,y:deck.top-r*rise,z:(p0.y+p1.y)/2};
          const pieces=makeRiserBoards(center,u,s.outward,width,rise,stairSupport,data.deckingMaterial,id,r);
          // End pieces cut at the shared mitre; stock splices stay supported by the stringer schedule.
          let from=0;for(const piece of pieces){const to=from+piece.w,t0=from/width,t1=to/width,at=(a:PlanPoint,b:PlanPoint,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});piece.polygon=[at(p0,p1,t0),at(p0,p1,t1),at(q0,q1,t1),at(q0,q1,t0)];riserBoards.push(piece);from=to;}
          if(r<n-1){const outer=offset(d+going+stairSupport.treadNosingIn);treads.push({...box([p0,p1,outer[i+1],outer[i]],deck.top-(r+1)*rise-.5,1,'tread'),angle:Math.atan2(s.outward.x,s.outward.y),flightId:'grade-path'});}
        }
        Object.assign(built,{width:allowanceWidth/n,start,end,stringerOffsets:actual,endWidth:Math.hypot(endB.x-endA.x,endB.y-endA.y),terminationEdge:{a:{...endA},b:{...endB}}});
      }
      for(let i=1;i<segments.length;i++){const a=near[i],b=endLine[i];stringers.push({a:{x:a.x,y:deck.top-9,z:a.y},b:{x:b.x,y:bottom-4,z:b.y},width:3,depth:9.25,role:'stringer',stair:{risers:n,rise,run:going,top:deck.top,bottom}});}
      if(data.railingType!=='None'&&data.railDefault!==false)for(const i of [0,segments.length]){const a=near[i],b=endLine[i];railRuns.push({a:{x:a.x,y:deck.top,z:a.y},b:{x:b.x,y:bottom,z:b.y}});}
    }
  }
  else
  for(let flight=0;flight<Math.min(data.stairFlights,edges.length);flight++){
    let edge=edges[flight];
    const occupied=openings.get(exitLevel)||[];
    // An opening on an angled corner does not use up the side its edge is nominally facing.
    const onAngled=(o:StairPlacement)=>exitLevel===0&&o.edgeIndex!==undefined&&isChamferEdgeId(mainFp.edgeIds?.[o.edgeIndex]);
    if(occupied.some(o=>o.edge===edge&&!onAngled(o)))edge=edges.find(e=>!occupied.some(o=>o.edge===e&&!onAngled(o)))||edge;
    const stair=getStairPlacement({...exitData,stairPosition:edge,stairOffset:flight===0?data.stairOffset:50,stairEdgeId:flight===0?stairName:undefined},deck.footprint,exitLevel===0?mainContact:undefined);if(!stair)continue;
    if(stair.width<36)issues.push(`Stair opening is only ${stair.width.toFixed(1)} inches wide; enlarge this polygon edge before construction.`);
    stairOpenings.push(stair);addOpening(exitLevel,stair);
    const start={x:stair.origin.x+stair.along.x*stair.width/2+deck.offset.x,y:deck.top,z:stair.origin.y+stair.along.y*stair.width/2+deck.offset.z};
    const {n,rise,target}=gradeSettings(`grade-${flight}`,deck.top);risers=n;
    if((target||data.stairRiserCount)&&(rise>7.75||rise<4.875))issues.push(`Edited stair count gives ${rise.toFixed(2)}-inch rises; review the rise limits before construction.`);
    const turn=data.stairTurn==='Left'?-1:1,nextOut={x:stair.along.x*turn,y:stair.along.y*turn},nextAlong={x:-stair.outward.x*turn,y:-stair.outward.y*turn};
    if(data.stairType==='Straight'||n<4){(n>14?addInlineLanding:addStraight)(start,stair.outward,stair.along,stair.width,n,rise,'grade',`grade-${flight}`);continue;}
    if(data.stairType==='Landing'){
      const upper=Math.ceil(n/2),lower=n-upper,end=addStraight(start,stair.outward,stair.along,stair.width,upper,rise,'grade',`grade-${flight}-upper`);
      const depth=Math.max(stair.width,data.landingDepthIn||48),cx=end.x+stair.outward.x*depth/2,cz=end.z+stair.outward.y*depth/2;
      const w=Math.abs(stair.along.x)*stair.width+Math.abs(stair.outward.x)*depth,h=Math.abs(stair.along.y)*stair.width+Math.abs(stair.outward.y)*depth;
      const fp:FootprintPlan={bounds:{w,h},isCurved:false,outline:[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}]};
      const landing=makeLevel(fp,end.y,{x:cx-w/2,y:0,z:cz-h/2},false,'landing',levels.length);levels.push(landing);
      const lowerStart={x:cx+nextOut.x*stair.width/2,y:end.y,z:cz+nextOut.y*stair.width/2};addStraight(lowerStart,nextOut,nextAlong,stair.width,lower,rise,'grade',`grade-${flight}-lower`);
      if(data.railingType!=='None'&&data.railDefault!==false){
        // Full rear outer edge; access faces remain clear.
        const a={x:cx-stair.along.x*turn*stair.width/2-stair.outward.x*depth/2,y:end.y,z:cz-stair.along.y*turn*stair.width/2-stair.outward.y*depth/2};
        const b={x:a.x+stair.outward.x*depth,y:end.y,z:a.z+stair.outward.y*depth};const c={x:b.x+stair.along.x*turn*stair.width,y:end.y,z:b.z+stair.along.y*turn*stair.width};railRuns.push({a,b},{a:b,b:c});
      }
    }else{
      issues.push('Winder tread supports and side-mounted framing connections require a reviewed connection detail before construction.');
      // Three equal 30-degree annular treads: 12-in inner radius gives 6.21-in
      // narrow ends and 12.42-in going on the 12-in walk line.
      const upper=Math.max(1,Math.ceil((n-2)/2)),lower=Math.max(0,n-upper-2),end=addStraight(start,stair.outward,stair.along,stair.width,upper,rise,'grade',`grade-${flight}-upper`);
      const inner=12,outer=inner+stair.width,center={x:end.x+nextOut.x*(inner+stair.width/2),z:end.z+nextOut.y*(inner+stair.width/2)};
      const point=(r:number,a:number)=>({x:center.x-nextOut.x*r*Math.cos(a)+stair.outward.x*r*Math.sin(a),y:center.z-nextOut.y*r*Math.cos(a)+stair.outward.y*r*Math.sin(a)});
      const framing:Member[]=[],winderBeams:Member[]=[],support:V3[]=[];
      for(let i=0;i<3;i++){
        const a=i*Math.PI/6,b=(i+1)*Math.PI/6,polygon=[point(inner,a),point(outer,a),point(outer,b),point(inner,b)],y=end.y-i*rise;
        if(i>0){const p=point(inner,a),q=point(outer,a);riserBoards.push(...makeRiserBoards({x:(p.x+q.x)/2,y:y+rise,z:(p.y+q.y)/2},{x:(q.x-p.x)/stair.width,y:(q.y-p.y)/stair.width},{x:nextOut.x*Math.sin(a)+stair.outward.x*Math.cos(a),y:nextOut.y*Math.sin(a)+stair.outward.y*Math.cos(a)},stair.width,rise,stairSupport,data.deckingMaterial,`grade-${flight}-winders`,i-1));}
        const xs=polygon.map(p=>p.x),zs=polygon.map(p=>p.y);treads.push({x:(Math.min(...xs)+Math.max(...xs))/2,y:y-.5,z:(Math.min(...zs)+Math.max(...zs))/2,w:Math.max(...xs)-Math.min(...xs),h:1,d:Math.max(...zs)-Math.min(...zs),polygon,kind:'winder',flightId:`grade-${flight}`});
        for(const angle of [a,b]){const p=point(inner,angle),q=point(outer,angle);framing.push({a:{x:p.x,y:y-1-joistDepth/2,z:p.y},b:{x:q.x,y:y-1-joistDepth/2,z:q.y},width:1.5,depth:joistDepth,role:'winder-frame'});}
        // Individual winder planks run in world Z; transverse framing is
        // spaced at no more than seven inches and bears on the perimeter frame.
        const framingY=y-1-joistDepth/2;
        for(const radius of [inner,outer]){const p=point(radius,a),q=point(radius,b);winderBeams.push({a:{x:p.x,y:framingY,z:p.y},b:{x:q.x,y:framingY,z:q.y},width:1.5,depth:joistDepth,role:'winder-edge'});}
        const minZ=Math.min(...zs),maxZ=Math.max(...zs),bays=Math.ceil((maxZ-minZ)/7);
        for(let row=1;row<bays;row++){
          const z=minZ+(maxZ-minZ)*row/bays,cross:number[]=[];
          for(let e=0;e<polygon.length;e++){const p=polygon[e],q=polygon[(e+1)%polygon.length];if((p.y<=z&&q.y>z)||(q.y<=z&&p.y>z))cross.push(p.x+(z-p.y)*(q.x-p.x)/(q.y-p.y));}
          cross.sort((a,b)=>a-b);
          for(let k=0;k+1<cross.length;k+=2)if(cross[k+1]-cross[k]>1.5)framing.push({a:{x:cross[k]+.75,y:framingY,z},b:{x:cross[k+1]-.75,y:framingY,z},width:1.5,depth:joistDepth,role:'winder-infill'});
        }
        const pa=point(outer,a),pb=point(outer,b);if(data.railingType!=='None'&&data.railDefault!==false){railRuns.push({a:{x:pa.x,y,z:pa.y},b:{x:pb.x,y:end.y-Math.min(i+1,2)*rise,z:pb.y}});const ia=point(inner,a),ib=point(inner,b);railRuns.push({a:{x:ia.x,y,z:ia.y},b:{x:ib.x,y:end.y-Math.min(i+1,2)*rise,z:ib.y}});}
      }
      // A post under the outer end of each radial frame. The inner ends all lie on the 12-in radius, 6 to 17 in apart,
      // where separate footings would overlap: one post at the middle tread's inner edge carries them.
      for(let i=0;i<=3;i++){const p=point(outer,i*Math.PI/6);support.push({x:p.x,y:Math.max(0,end.y-Math.max(0,i-1)*rise-joistDepth-1),z:p.y});}
      const pivot=point(inner,Math.PI/4);support.push({x:pivot.x,y:Math.max(0,end.y-rise-joistDepth-1),z:pivot.y});
      const outline=[point(inner,0),point(outer,0),point(outer,Math.PI/2),point(inner,Math.PI/2)],xs=outline.map(p=>p.x),zs=outline.map(p=>p.y),minX=Math.min(...xs),minZ=Math.min(...zs);
      levels.push({kind:'winder',index:levels.length,footprint:{outline:outline.map(p=>({x:p.x-minX,y:p.y-minZ})),bounds:{w:Math.max(...xs)-minX,h:Math.max(...zs)-minZ},isCurved:false},top:end.y,offset:{x:minX,y:0,z:minZ},boards:[],supports:support,joists:framing,beams:winderBeams,blocking:[],breakers:[],reference:deck.reference,rim:[]});
      const p=point(inner+stair.width/2,Math.PI/2),lowerStart={x:p.x,y:end.y-2*rise,z:p.y};
      flights.push({id:`grade-${flight}-winders`,kind:'grade',risers:2,rise,run:12*Math.PI/3,width:stair.width,start:end,end:lowerStart,type:'Winder',stringerOffsets:[],winderCenter:{x:center.x,y:center.z},winderRadiusIn:inner+stair.width/2});
      if(lower)addStraight(lowerStart,nextOut,nextAlong,stair.width,lower,rise,'grade',`grade-${flight}-lower`,0);
    }
  }
  for(const [index,level]of levels.entries()){
    if(level.kind!=='deck')continue;
    let segments=getRailingSegments(data,level.footprint,null,index===0?mainContact:undefined);
    // Cuts the stretch lo…hi (along u from origin, level plan inches) out of every guard segment lying on that line.
    const cutAlong=(origin:PlanPoint,u:PlanPoint,lo:number,hi:number,tol=.01)=>{
      const ox=origin.x,oz=origin.y,ux=u.x,uz=u.y;
      segments=segments.flatMap(s=>{const cross=(s.a.x-ox)*uz-(s.a.y-oz)*ux,crossB=(s.b.x-ox)*uz-(s.b.y-oz)*ux;if(Math.abs(cross)>tol||Math.abs(crossB)>tol)return[s];const a=(s.a.x-ox)*ux+(s.a.y-oz)*uz,b=(s.b.x-ox)*ux+(s.b.y-oz)*uz,l=Math.min(a,b),h=Math.max(a,b);if(h<=lo||l>=hi)return[s];const result=[],at=(t:number)=>({x:ox+ux*t,y:oz+uz*t});
        // The pieces run along u, as the stair-opening cut always made them.
        if(l<lo)result.push({...s,a:at(l),b:at(lo)});if(h>hi)result.push({...s,a:at(hi),b:at(h)});return result;});
    };
    for(const opening of openings.get(index)||[])cutAlong(opening.origin,opening.along,0,opening.width);
    // Where a higher level meets this one, its edge stands over this edge: that level's own guard (or the step) is
    // the guard, so this level has none along the shared stretch (owner decision 2026-09-25).
    for(const other of levels){
      if(other===level||other.kind!=='deck'||other.top<=level.top+.01)continue;
      const poly=other.footprint.outline.map(p=>({x:p.x+other.offset.x-level.offset.x,y:p.y+other.offset.z-level.offset.z}));
      poly.forEach((p,i)=>{const q=poly[(i+1)%poly.length],len=Math.hypot(q.x-p.x,q.y-p.y);if(len>.5)cutAlong(p,{x:(q.x-p.x)/len,y:(q.y-p.y)/len},0,len,.5);});
    }
    for(const side of stepSides)if(side.level===index)cutAlong({x:side.origin.x-level.offset.x,y:side.origin.y-level.offset.z},side.dir,0,side.length,.5);
    segments=applyRailSections(data,level.footprint,(level.index+1) as 1|2|3,segments);
    for(const s of segments)railRuns.push({a:{x:s.a.x+level.offset.x,y:level.top,z:s.a.y+level.offset.z},b:{x:s.b.x+level.offset.x,y:level.top,z:s.b.y+level.offset.z}});
  }
  const posts:V3[]=[],rails:Member[]=[],balusters:Member[]=[],glass:Member[]=[];
  const railHeight=data.height>71?42:36,maxSpan=((RAILING_COSTS as any)[data.railingType]?.spacing||6)*12;
  const postKeys=new Set<string>();let railSections=0;
  // A frameless glass railing has no posts, rails or balusters: its panels, shoe or spigots come from framelessGlass.ts.
  const frameless=data.railingType==='Frameless Glass'?framelessGlassLayout(data,railRuns,{levels,treads,railHeight}):null;
  if(frameless){glass.push(...glassPanelMembers(frameless));issues.push(...frameless.issues);}
  for(const r of frameless?[]:railRuns){
    const length=distance(r.a,r.b);if(length<1)continue;const bays=Math.ceil(length/maxSpan);railSections+=bays;
    for(let b=0;b<=bays;b++){const p=mix(r.a,r.b,b/bays),key=[p.x,p.y,p.z].map(n=>n.toFixed(1)).join(':');if(!postKeys.has(key)){posts.push(p);postKeys.add(key);}}
    for(const h of [3,railHeight-1.25])rails.push({a:{...r.a,y:r.a.y+h},b:{...r.b,y:r.b.y+h},width:2,depth:h===3?1.5:2.5});
    if(data.railingType==='Glass Panels')for(let b=0;b<bays;b++){const a=mix(r.a,r.b,b/bays),end=mix(r.a,r.b,(b+1)/bays);glass.push({a:{...a,y:a.y+railHeight/2},b:{...end,y:end.y+railHeight/2},width:0.5,depth:railHeight-8});}
    else if(data.railingType==='Cable')for(let i=1;i<=9;i++){const h=3+(railHeight-6)*i/10;balusters.push({a:{...r.a,y:r.a.y+h},b:{...r.b,y:r.b.y+h},width:0.125,depth:0.125});}
    else {const count=Math.ceil(length/4.5);for(let i=1;i<count;i++){const p=mix(r.a,r.b,i/count);balusters.push({a:{...p,y:p.y+4},b:{...p,y:p.y+railHeight-3},width:0.75,depth:0.75});}}
  }
  // A custom outline's stair must not run over the deck itself (a flight off a step inside a U, into the other arm).
  if(data.shape==='Custom'){
    const deckOutline=levels[0].footprint.outline,plan=(t:Box)=>t.polygon??(()=>{const o={x:Math.sin(t.angle??0),y:Math.cos(t.angle??0)},u={x:o.y,y:-o.x};return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,r])=>({x:t.x+u.x*s*t.w/2+o.x*r*t.d/2,y:t.z+u.y*s*t.w/2+o.y*r*t.d/2}));})();
    if(treads.some(t=>polygonCut([deckOutline],[plan(t)]).some(p=>Math.abs(signedArea(p))>16)))issues.push('A stair runs over the deck: its treads cross another part of the custom outline. Put the stair on another edge before construction.');
  }
  if(flights.length)issues.push(...stairSupport.issues,'Closed-riser thickness is allowed for in the illustrated stringer notch faces. Confirm the resulting stringer throat, bearing and manufacturer attachment detail before cutting.');
  issues.push(...levels.flatMap(l=>l.layoutIssues??[]));
  // Door-sill step-down, checked only once the house floor height has been set. 7.75 in is the
  // studio's existing maximum riser, so no new rule is introduced.
  // Each house block the deck meets is checked against its own floor; a garage slab is not a door sill.
  const houseBlocks=getHouseBlocks(data),blockName=(b:typeof houseBlocks[number])=>b.kind==='garage'?'garage':b.attachedTo==='Front'?'bump-out':'wing';
  if(data.deckOutlines?.main){
    const overlap=polygonCut([mainFp.outline],[rectPolygon(houseBlocks[0].rect)]).reduce((n,p)=>n+Math.abs(signedArea(p)),0);
    if(overlap>1)issues.push(`The edited deck reaches ${(overlap/144).toFixed(1)} sq ft into the house. Move those points clear of the wall before construction.`);
    if(deckAttachesToHouse(data)&&!mainContact.contacts.length)issues.push('The edited deck no longer meets the house wall. Its position is preserved; reconnect it or choose a freestanding deck.');
  }
  if([1,2,3].some(n=>n<=data.levels&&!!freeFootprint(data,n as 1|2|3)))issues.push('Edited outline: the board layout, area and perimeter follow the actual points. Framing is an illustrative layout clipped to the outline; bespoke angled supports and changed level connections require a builder detail and quote.');
  const sills=deckAttachesToHouse(data)?[...new Set(['main',...mainContact.contacts.map(c=>c.blockId)])].map(id=>houseBlocks.find(b=>b.id===id)).filter(b=>b&&b.kind==='house'&&(b.id==='main'||mainContact.contacts.some(c=>c.blockId===b.id))):[];
  for(const block of sills){
    const sill=block!.floorHeightIn;if(sill===undefined)continue;
    const whose=block!.id==='main'?'house':`house ${blockName(block!)}`;
    if(data.height>sill+.01)issues.push(`The deck surface (${data.height} in above grade) is above the ${whose} floor / door sill (${sill} in). Water can run toward the door: lower the deck or confirm a sill detail before construction.`);
    else if(sill-data.height>7.75)issues.push(`The ${block!.id==='main'?'door':`${blockName(block!)} door`} sill is ${(sill-data.height).toFixed(1)} in above the deck surface, more than one 7.75 in step. Add a step or landing at the door, or raise the deck.`);
  }
  if(mainContact.contacts.some(c=>houseBlocks.find(b=>b.id===c.blockId)?.kind==='garage'))issues.push('Deck ledger on the attached garage wall: confirm the garage wall framing and rim can carry a ledger (slab-on-grade garage walls often cannot) before construction.');
  if(mainContact.flushLf>0)issues.push(`Bump-out side walls: the outside joist is bolted flat to each side wall (${mainContact.flushLf.toFixed(1)} ft, bolts at the ledger spacing, flashed). Confirm the wall framing behind each side wall before construction.`);
  // An attached deck is notched around house blocks; a freestanding one is not, so an overlap is reported.
  for(const block of houseBlocks.slice(1)){
    const overlap=polygonCut([mainFp.outline],[rectPolygon(block.rect)]).reduce((n,p)=>n+signedArea(p),0);
    if(overlap>1)issues.push(`The house ${blockName(block)} reaches ${(overlap/144).toFixed(1)} sq ft into this freestanding deck. Only a deck attached to the house is notched around it: attach the deck, or move or shorten the deck or the ${blockName(block)}.`);
  }
  // Custom outlines: every change in front depth is its own framing strip; 45° edges there are named as such.
  const custom=data.shape==='Custom',angledWord=custom?'45° edges':'Angled corner';
  if(custom&&levels[0].zones&&levels[0].zones.length>1)issues.push(`Custom outline: the deck is framed in ${levels[0].zones.length} strips, one for each front depth, each with its own beam and posts laid out from the existing beam span table. Have the framing reviewed before construction.`);
  if(levels[0].angledEdges?.length)issues.push(levels[0].beams.some(b=>b.role==='angled-beam')?`${angledWord}: ${custom?'each':'the'} angled beam and its posts are laid out from the existing beam span table, and joists meet the angled rim on skewed hangers. Have the ${custom?'angled':'corner'} framing reviewed before construction.`:`${angledWord}: joists meet the angled rim on skewed hangers over the front beam. Have the ${custom?'angled':'corner'} framing reviewed before construction.`);
  // Defensive: the 45° layouts are aligned to angled edges, so a long thin rip there means that alignment failed.
  const thinStrips=levels[0].angledEdges?.length?levels[0].boards.filter(b=>b.angleDeg%90!==0&&(b.width??data.boardWidth)<1.5&&b.length>6).length:0;
  if(thinStrips)issues.push(`${angledWord}: ${thinStrips} decking piece${thinStrips===1?' is':'s are'} ripped narrower than 1.5 in along a run. The installer will need to adjust the board layout ${custom?'along the 45° edges':'at the corner'}.`);
  // Decorative inlays: the ones not built say why; built ones get a framing review note.
  if(wrap&&(data.inlays??[]).some(i=>(i.level??1)===1))issues.push('Decorative inlays are not built on a wrap-around deck: the zones meet on hips. Remove the wrap-around or the inlays on the main deck.');
  // Where a fill meets a slanted frame edge, some pieces are ripped thin: say so, as angled corners do.
  for(const level of levels)for(const [n,p] of (level.inlays??[]).entries()){const thin=level.boards.filter(b=>b.inlay===p.id&&(b.role==='inlay-fill'||p.kind==='medallion')&&(b.width??data.boardWidth)<1.5&&b.length>6).length;if(thin)issues.push(p.kind==='band'?`${level.index?`Level ${level.index+1} `:''}inlay ${n+1} (band): ${thin} piece${thin===1?' is':'s are'} ripped narrower than 1.5 in where it meets the deck's edge. The installer will adjust the band's ends.`:`${level.index?`Level ${level.index+1} `:''}inlay ${n+1}: ${thin} piece${thin===1?' is':'s are'} ripped narrower than 1.5 in along the frame. The installer will adjust the layout inside the frame.`);}
  for(const level of levels)for(const [n,p] of (level.inlays??[]).entries())if(p.status!=='ok')issues.push(`${level.index?`Level ${level.index+1} `:''}inlay ${n+1} (${INLAY_KIND_NAMES[p.kind]}) is not built: ${p.message}`);
  const builtInlays=levels.flatMap(l=>(l.inlays??[]).filter(p=>p.status==='ok'));
  if(builtInlays.some(p=>!p.band&&!p.solid||(p.band?.direction==='across'&&!p.band.rows)))issues.push('Decorative inlays: blocking is laid out under every joint where boards end at an inlay, with nailers under frame boards that run with the joists and ladder blocking under the inside where the joists alone do not carry it. Confirm fastening with the decking manufacturer before construction.');
  if(builtInlays.some(p=>p.band?.direction==='along'))issues.push('Bands running front to back sit on doubled build-up joists, as breaker boards do; a band that meets a breaker takes its place. Confirm fastening with the decking manufacturer before construction.');
  if(builtInlays.some(p=>p.solid))issues.push('Medallions sit on solid blocking: rungs at 6 in centres under each medallion and one board around it. Their labour is a builder quote. Confirm fastening with the decking manufacturer before construction.');
  if(wrap)issues.push('Wrap-around corner: the doubled hip, the skewed jack-joist and hip hangers, and the posts under the hip are laid out from the existing beam span table. Have the corner framing reviewed by an engineer before construction.');
  for(const level of levels){
    if(level.kind!=='deck')continue;
    const loose=unsupportedJoistEnds(level,level.index===0?mainContact:undefined);
    if(loose.length)issues.push(`${loose.length} joist end${loose.length===1?'':'s'} on the ${['main deck','second level','third level'][level.index??0]} do not bear on a ledger or beam (for example a shallow notch wing). Add a beam and posts under that edge before construction.`);
  }
  const foundationSaddle=data.foundation==='Deck Blocks'?6.5:4.5,foundationSupports=foundationDatums(data,levels);
  const missingTargets=targets.filter(t=>!flights.some(f=>f.kind==='grade'&&stairTargetId(f.id)===t.flightId));
  if(missingTargets.length)issues.push('A saved stair target no longer has a matching grade flight. Refit or remove the target before construction.');
  if(targets.some(t=>t.surface==='patio'&&!data.yardFeatures?.some(f=>f.enabled&&f.kind==='patio'&&f.id===t.patioId)))issues.push('A stair landing patio target is absent or disabled; confirm the landing surface before construction.');
  if(foundationSupports.some(f=>f.status==='coverage-pending'))issues.push('Deck foundation footprint survey coverage is incomplete; affected ground, footing and post quantities remain pending.');
  if(foundationSupports.some(f=>f.status==='clearance-pending')&&(data.siteModel||data.terrainConfig))issues.push('Local proposed ground leaves insufficient foundation saddle or post clearance; review excavation or framing before construction.');
  if(data.soilCondition==='Unknown'&&(data.siteModel||data.terrainConfig))issues.push('Local foundation datums are modeled; soil bearing, footing diameter and installed pile/embedment depth still require confirmation.');
  if(levels.some(l=>l.supports.some(p=>p.y>0&&p.y<=foundationSaddle)||l.top<joistDepth+1+foundationSaddle))issues.push('Selected deck elevation leaves insufficient clearance for framing and the foundation saddle; review low-profile framing or excavation before construction.');
  const quantities={riserBoardPieces:riserBoards.length,riserBoardLf:riserBoards.reduce((n,b)=>n+b.w/12,0),riserBoardArea:riserBoards.reduce((n,b)=>n+b.w*b.h/144,0),inlayLf:levels.reduce((n,l)=>n+l.boards.filter(b=>b.role==='inlay').reduce((n,b)=>n+b.length/12,0),0),totalRisers:flights.reduce((n,f)=>n+f.risers,0),landingArea:levels.filter(l=>l.kind==='landing').reduce((n,l)=>n+polygonArea(l.footprint),0),breakerBoards:levels.reduce((n,l)=>n+l.breakers.length+(l.layoutBreakers?.length??0),0),blocking:levels.reduce((n,l)=>n+l.blocking.length,0),stairRailingLf:railRuns.filter(r=>r.a.y!==r.b.y).reduce((n,r)=>n+distance(r.a,r.b)/12,0),footings:foundationSupports.filter(f=>f.status!=='coverage-pending').length,supportPosts:foundationSupports.filter(f=>f.postHeightIn!==null&&f.postHeightIn>0).length,joists:levels.reduce((sum,l)=>sum+l.joists.length,0),railingPosts:posts.length,railingSections:railSections,railingLf:railRuns.reduce((sum,r)=>sum+distance(r.a,r.b)/12,0),risersPerFlight:risers,stairFlights:stairOpenings.length,stairTreads:treads.length,stringers:stringers.length,installedBoardPieces:levels.reduce((sum,l)=>sum+(data.boardLayout?physicalBoardPieceCount(l.boards,data.boardWidth):l.boards.length),0),area:levels.reduce((sum,l)=>sum+(l.kind==='winder'?0:polygonArea(l.footprint)),0),framingLf:levels.reduce((sum,l)=>sum+[...l.joists,...l.beams,...l.blocking,...(l.rim||[])].reduce((n,m)=>n+distance(m.a,m.b)/12,0),0)};
  const resolvedFoundations=foundationSupports.filter(f=>f.bottomElevationIn!==null&&f.headTopElevationIn!==null);
  const foundationQuantities={supportPostLf:foundationSupports.reduce((n,f)=>n+(f.postHeightIn??0)/12,0),concretePierYd3:resolvedFoundations.filter(f=>f.foundation!=='Helical Piles'&&f.foundation!=='Deck Blocks').reduce((n,f)=>n+Math.PI*36*(f.headTopElevationIn!-f.bottomElevationIn!)/46656,0),pileShaftLf:resolvedFoundations.filter(f=>f.foundation==='Helical Piles').reduce((n,f)=>n+(f.headTopElevationIn!-f.bottomElevationIn!)/12,0),foundationCoveragePending:foundationSupports.filter(f=>f.status==='coverage-pending').length,foundationClearancePending:foundationSupports.filter(f=>f.status==='clearance-pending').length,foundationSoilPending:data.soilCondition==='Unknown'?1:0};
  return {foundationSupports,foundationQuantities,levels,treads,riserBoards,stairSupport,stringers,flights,connections,issues,railing:{posts,rails,balusters,glass,height:railHeight,...(frameless?{frameless}:{})} as TakeoffRailing,quantities,gap,stockLength};
}
export type DeckTakeoff=ReturnType<typeof buildDeckTakeoff>;
/** The guard runs at walking-surface height, whatever the railing: a frameless railing's runs, or each framed run
 * (its bottom rail, which sits 3 in up). Checks use it so a railing with no rails is still checked. */
export function guardRuns(model:DeckTakeoff):RailRun[]{
  if(model.railing.frameless)return model.railing.frameless.runs.map(r=>({a:r.a,b:r.b}));
  return model.railing.rails.filter((_,i)=>i%2===0).map(r=>({a:{...r.a,y:r.a.y-3},b:{...r.b,y:r.b.y-3}}));
}
