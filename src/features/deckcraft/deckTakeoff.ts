import {addConstructionDetails,finishBoards,unsupportedJoistEnds} from './constructionDetails';
import {polygonCut,polygonBoard,splitBoard,offsetPolygons} from './lib/polygonCuts';
import {getFinishedFootprint} from './lib/finishedFootprint';
import {computeStruct,computeStairs} from './referenceConstruction';
import {type DeckData, RAILING_COSTS} from './types';
import {DECKING_CATALOGUE} from './manufacturerCatalog';
import {finishedFasciaOffset} from './lib/finishedFootprint';
import {getStairSupport,getStringerOffsets,makeRiserBoards,type RiserBoard} from './stairConstruction';
import {getHouseContact,exposedSides,deckAttachesToHouse,exposedHouseLine} from './houseContact';
import {getHouseConfig} from './houseSettings';
import {outlineSpans,cleanPolygon,zoneReference,frameZoneBearings,frameZoneJoists,type DeckZone,type FramedZone,type ZoneFramingConfig} from './zoneFraming';
import {getFootprint,getBoardRows,getPictureFrameRuns,getStairPlacement,getRailingSegments,getHerringboneRows,clipToConvex,type StairPlacement,type PlanPoint,type FootprintPlan,type BoardRun} from './lib/deckGeometry';
export type V3={x:number;y:number;z:number};
export type Member={a:V3;b:V3;width:number;depth:number;role?:string;spliceStart?:boolean;spliceEnd?:boolean;stair?:{risers:number;rise:number;run:number;top:number;bottom:number}};
export type Box={x:number;y:number;z:number;w:number;h:number;d:number;angle?:number;polygon?:PlanPoint[];kind?:'tread'|'winder'|'riser'};
export type RailRun={a:V3;b:V3};
export type DeckLevel={kind?:'deck'|'landing'|'winder';index?:number;rim?:Member[];footprint:FootprintPlan;deckingFootprint?:FootprintPlan;top:number;offset:V3;boards:BoardRun[];supports:V3[];joists:Member[];beams:Member[];blocking:Member[];breakers:number[];reference:any;zones?:FramedZone[]};
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
function levelZones(footprint:FootprintPlan,attached:boolean,cfg:ZoneFramingConfig,isMain:boolean):DeckZone[]{
  const single:DeckZone[]=[{id:'main',outline:footprint.outline,origin:{x:0,y:0},size:footprint.bounds,attached}];
  if(!isMain)return single;
  const W=footprint.bounds.w,outline=footprint.outline;
  let cuts:number[]=[];
  if(footprint.isCurved){
    const allow=zoneReference(single[0],cfg).cant*12-2;
    if(allow<10)return single;
    const front=(x:number)=>Math.max(...outlineSpans(outline,Math.min(W-1e-6,Math.max(1e-6,x)),'x').map(([,b])=>b));
    let start=0,lo=Infinity,hi=-Infinity;
    for(let x=0;x<=W;x++){const y=front(x);lo=Math.min(lo,y);hi=Math.max(hi,y);if(hi-lo>allow&&x-start>=24&&W-x>=24){cuts.push(x);start=x;lo=hi=y;}}
  }else cuts=[...new Set(outline.filter(p=>p.y>1e-6&&p.x>.5&&p.x<W-.5).map(p=>p.x))].sort((a,b)=>a-b);
  const xs=[0,...cuts,W],zones:DeckZone[]=[];
  for(let i=0;i+1<xs.length;i++){
    const x0=xs[i],x1=xs[i+1];if(x1-x0<1)continue;
    const part=cleanPolygon(clipToConvex(outline,[{x:x0,y:-1e5},{x:x1,y:-1e5},{x:x1,y:1e5},{x:x0,y:1e5}]));
    zones.push({id:`zone-${i+1}`,outline:part,origin:{x:x0,y:0},size:{w:x1-x0,h:Math.max(...part.map(p=>p.y))},attached});
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
  function makeLevel(footprint:FootprintPlan,top:number,offset:V3,attached:boolean,kind:DeckLevel['kind']='deck',index=0){
    const cfg={top,spacing,framingSize:data.framingSize,joistDepth,pictureFrame:!!data.pictureFrameRows||data.pattern==='Picture Frame'};
    const zones=levelZones(footprint,attached,cfg,kind==='deck'&&index===0).map(zone=>({zone,reference:zoneReference(zone,cfg)})),reference=zones[0].reference;
    const supports:V3[]=[],joists:Member[]=[],beams:Member[]=[],blocking:Member[]=[];
    for(const zone of zones)frameZoneBearings(zone,offset,{supports,beams});
    // Back-line stretches beyond the house have no ledger: frame them like a freestanding deck's
    // house side, using the reference engine's own house beam and posts sized to that stretch.
    if(attached&&index===0)for(const [x0,x1] of exposedHouseLine(data,footprint,mainContact)){
      const side=computeStruct({width:(x1-x0)/12,depth:footprint.bounds.h/12,heightIn:top,house:'brick',ft:'PT',joistSp:String(spacing),joistSz:data.framingSize,beamMount:top<18?'flush':'drop',bSzSel:'auto',bPlySel:'auto',pf:!!data.pictureFrameRows||data.pattern==='Picture Frame'});
      const row=side.beamRows.find((r:{type:string})=>r.type==='house_beam');if(!row)continue;
      for(const p of side.posts)if(p.type==='mammoth')supports.push({x:x0+p.x*12+offset.x,y:Math.max(0,side.bBotY*12),z:p.z*12+offset.z});
      for(let ply=0;ply<side.bPly;ply++){const y=(side.bBotY+side.bh/2)*12,z=row.z*12+offset.z+(ply-(side.bPly-1)/2)*1.5;beams.push({a:{x:x0+offset.x,y,z},b:{x:x1+offset.x,y,z},width:1.5,depth:side.bh*12,role:'house-side-beam'});}
    }
    const borders=data.pictureFrameRows||(data.pattern==='Picture Frame'?1:0),inset=borders*(data.boardWidth+gap);
    const deckingFootprint=getFinishedFootprint(data,footprint,attached?mainContact:undefined),fieldPolygons=offsetPolygons([deckingFootprint.outline],inset),fieldXs=fieldPolygons.flat().map(p=>p.x),fieldLeft=fieldXs.length?Math.min(...fieldXs):inset;
    const fieldWidth=fieldXs.length?Math.max(...fieldXs)-fieldLeft:0,breakerZone=data.boardWidth+2*gap;
    let breakerCount=0;while((fieldWidth-breakerCount*breakerZone)/(breakerCount+1)>stockLength+1e-6)breakerCount++;
    const segment=(fieldWidth-breakerCount*breakerZone)/(breakerCount+1);
    const breakers=data.pattern==='Straight'||data.pattern==='Picture Frame'?Array.from({length:breakerCount},(_,i)=>fieldLeft+(i+1)*segment+i*breakerZone+gap+data.boardWidth/2):[];

    const buildUps=[...breakers.flatMap(x=>[-1.5,-.5,.5,1.5].map(k=>x+k*(1.5+.375))),...(borders?[1.5+2.375,1.5+2*2.375,footprint.bounds.w-1.5-2.375,footprint.bounds.w-1.5-2*2.375]:[])];
    for(const zone of zones)frameZoneJoists(zone,offset,cfg,buildUps,{joists,blocking});
    const field=data.pattern==='Herringbone'?getHerringboneRows(deckingFootprint,data.boardWidth,gap,inset):getBoardRows(deckingFootprint,{boardWidth:data.boardWidth,gap,angleDeg:data.pattern==='Diagonal'?45:0,inset,maxBoardLen:breakers.length?100000:stockLength});
    const boards:BoardRun[]=[...(borders?getPictureFrameRuns(deckingFootprint,borders as 1|2,data.boardWidth,gap):[])];
    for(const b of field){let intervals:[number,number][]=[[b.cx-b.length/2,b.cx+b.length/2]];if(!b.angleDeg)for(const x of breakers){const lo=x-data.boardWidth/2-gap,hi=x+data.boardWidth/2+gap;intervals=intervals.flatMap(([a,z])=>z<=lo||a>=hi?[[a,z]]:[...(a<lo?[[a,lo]]:[]),...(z>hi?[[hi,z]]:[])] as [number,number][]);}if(b.angleDeg)boards.push(b);else for(const [a,z]of intervals)if(z-a>.001){if(b.polygon)for(const p of polygonCut([b.polygon],[[{x:a,y:-10000},{x:z,y:-10000},{x:z,y:10000},{x:a,y:10000}]]))boards.push(polygonBoard(p,0,b.role));else boards.push({...b,cx:(a+z)/2,length:z-a});}}
    for(const x of breakers)for(const [a,b]of spans(deckingFootprint,x,'x')){const from=a+inset,to=b-inset;for(let z=from;z<to;z+=stockLength+gap){const len=Math.min(stockLength,to-z);boards.push({cx:x,cy:z+len/2,length:len,angleDeg:90,role:'breaker'});}}
    const installed=boards.flatMap(b=>splitBoard(b,data.boardWidth,stockLength,gap));
    const result:DeckLevel={kind,index,footprint,deckingFootprint,top,offset,supports,joists,beams,blocking,boards:finishBoards(installed,deckingFootprint,data.boardWidth,gap,kind==='deck'&&index===0&&data.hasInlay?data.inlayLf*12:0,stockLength,inset),breakers,reference,...(zones.length>1?{zones}:{})};addConstructionDetails(result,data.boardWidth);return result;
  }
  levels.push(makeLevel(mainFp,data.height,{x:0,y:0,z:0},deckAttachesToHouse(data),'deck',0));
  type Flight={id:string;kind:'grade'|'connection';risers:number;rise:number;run:number;width:number;start:V3;end:V3;type:string;stringerOffsets:number[]};
  const stairSupport=getStairSupport(data,gap);
  const issues:string[]=[],flights:Flight[]=[],connections:{from:number;to:number;opening:StairPlacement;run:number}[]=[];
  const openings=new Map<number,StairPlacement[]>();
  const addOpening=(index:number,p:StairPlacement)=>openings.set(index,[...(openings.get(index)||[]),p]);
  const run=stairSupport.runIn;
  function addStraight(origin:V3,outward:PlanPoint,along:PlanPoint,width:number,n:number,rise:number,kind:Flight['kind'],id:string,startOffset=(data.pictureFrameRows||data.pattern==='Picture Frame')?finishedFasciaOffset(data):0){
    const start={x:origin.x+outward.x*startOffset,y:origin.y,z:origin.z+outward.y*startOffset};
    const end={x:start.x+outward.x*run*Math.max(0,n-1),y:start.y-n*rise,z:start.z+outward.y*run*Math.max(0,n-1)};
    const yaw=Math.atan2(outward.x,outward.y),stringerOffsets=getStringerOffsets(width,stairSupport.spacingIn,stairSupport.minimumStringers);
    for(let i=0;i<n;i++)riserBoards.push(...makeRiserBoards({x:start.x+outward.x*i*run,y:start.y-i*rise,z:start.z+outward.y*i*run},along,outward,width,rise,stairSupport,data.deckingMaterial,id,i));
    if(rise<=1)issues.push('A stair rise is no greater than the modeled tread thickness; this transition needs a reviewed threshold detail.');
    for(let i=1;i<n;i++){const d=(i-.5)*run+stairSupport.treadNosingIn/2;treads.push({x:start.x+outward.x*d,y:start.y-i*rise-.5,z:start.z+outward.y*d,w:width,h:1,d:run+stairSupport.treadNosingIn,angle:yaw,kind:'tread'});}
    for(const shift of stringerOffsets){stringers.push({a:{x:start.x+along.x*shift,y:start.y-9,z:start.z+along.y*shift},b:{x:end.x+along.x*shift,y:end.y-4,z:end.z+along.y*shift},width:1.5,depth:9.25,role:'stringer',stair:{risers:n,rise,run,top:start.y,bottom:end.y}});}
    if(data.railingType!=='None')for(const side of [-1,1]){const shift=side*width/2;railRuns.push({a:{x:start.x+along.x*shift,y:start.y,z:start.z+along.y*shift},b:{x:end.x+along.x*shift,y:end.y,z:end.z+along.y*shift}});}
    flights.push({id,kind,risers:n,rise,run,width,start,end,type:'Straight',stringerOffsets});return end;
  }
  function addInlineLanding(start:V3,outward:PlanPoint,along:PlanPoint,width:number,n:number,rise:number,kind:Flight['kind'],id:string){
    const upper=Math.ceil(n/2),lower=n-upper,end=addStraight(start,outward,along,width,upper,rise,kind,`${id}-upper`),depth=Math.max(width,data.landingDepthIn||48);
    const cx=end.x+outward.x*depth/2,cz=end.z+outward.y*depth/2,w=Math.abs(along.x)*width+Math.abs(outward.x)*depth,h=Math.abs(along.y)*width+Math.abs(outward.y)*depth;
    const fp:FootprintPlan={bounds:{w,h},isCurved:false,outline:[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}]};
    levels.push(makeLevel(fp,end.y,{x:cx-w/2,y:0,z:cz-h/2},false,'landing',levels.length));
    if(data.railingType!=='None')for(const side of [-1,1])railRuns.push({a:{x:end.x+along.x*width/2*side,y:end.y,z:end.z+along.y*width/2*side},b:{x:end.x+outward.x*depth+along.x*width/2*side,y:end.y,z:end.z+outward.y*depth+along.y*width/2*side}});
    return addStraight({x:end.x+outward.x*depth,y:end.y,z:end.z+outward.y*depth},outward,along,width,lower,rise,kind,`${id}-lower`);
  }
  // The second section is physically adjacent to a stair run, rather than floating
  // twelve inches away. Its attachment edge is cut out of both guard runs.
  if(data.levels>1){
    const fp=getFootprint(data,2),side=data.level2Position||'Front';
    const opening=getStairPlacement({...data,stairFlights:1,stairPosition:side,stairOffset:data.level2Offset??50,stairWidth:Math.abs(data.height-data.height2)<.01?(side==='Front'?fp.bounds.w:fp.bounds.h):Math.min(data.stairWidth,side==='Front'?fp.bounds.w:fp.bounds.h)},mainFp,mainContact)!;
    const delta=Math.abs(data.height-data.height2),n=delta>.01?Math.ceil(delta/7.75):0,rise=n?delta/n:0,distance=n>14?Math.max(0,n-2)*run+Math.max(opening.width,data.landingDepthIn||48):Math.max(0,n-1)*run;
    const center={x:opening.origin.x+opening.along.x*opening.width/2,z:opening.origin.y+opening.along.y*opening.width/2};
    const offset=side==='Front'?{x:center.x-fp.bounds.w/2,y:0,z:center.z+distance}:side==='Left'?{x:center.x-distance-fp.bounds.w,y:0,z:center.z-fp.bounds.h/2}:{x:center.x+distance,y:0,z:center.z-fp.bounds.h/2};
    levels.push(makeLevel(fp,data.height2,offset,false,'deck',1));
    const opposite=side==='Front'?'Back':side==='Left'?'Right':'Left';
    const other=getStairPlacement({...data,stairFlights:1,stairPosition:opposite,stairOffset:50,stairWidth:opening.width},fp)!;
    addOpening(0,opening);addOpening(1,other);connections.push({from:0,to:1,opening,run:distance});
    if(n){const mainHigher=data.height>=data.height2;const start=mainHigher?{x:center.x,y:data.height,z:center.z}:{x:center.x+opening.outward.x*distance,y:data.height2,z:center.z+opening.outward.y*distance};(n>14?addInlineLanding:addStraight)(start,mainHigher?opening.outward:{x:-opening.outward.x,y:-opening.outward.y},opening.along,opening.width,n,rise,'connection','level-connection');}
  }
  // Flights go only on sides with an exposed edge; a primary side against the house is never used.
  const sides=exposedSides(mainFp,mainContact),primary=data.stairPosition,edges=[...(sides.includes(primary)?[primary]:[]),...sides.filter(e=>e!==primary)];
  const exitLevel=data.levels>1?(data.height2<=data.height?1:0):0;
  const deck=levels[exitLevel],exitData=exitLevel?{...data,deckType:'Freestanding' as const}:data;
  if(data.stairFlights>edges.length)issues.push('The requested stair exit count exceeds available exposed deck edges.');
  let risers=0;
  for(let flight=0;flight<Math.min(data.stairFlights,edges.length);flight++){
    let edge=edges[flight];
    const occupied=openings.get(exitLevel)||[];
    if(occupied.some(o=>o.edge===edge))edge=edges.find(e=>!occupied.some(o=>o.edge===e))||edge;
    const stair=getStairPlacement({...exitData,stairPosition:edge,stairOffset:flight===0?data.stairOffset:50},deck.footprint,exitLevel===0?mainContact:undefined);if(!stair)continue;
    if(stair.width<36)issues.push(`Stair opening is only ${stair.width.toFixed(1)} inches wide; enlarge this polygon edge before construction.`);
    stairOpenings.push(stair);addOpening(exitLevel,stair);
    const start={x:stair.origin.x+stair.along.x*stair.width/2+deck.offset.x,y:deck.top,z:stair.origin.y+stair.along.y*stair.width/2+deck.offset.z};
    const n=Math.max(1,Math.ceil(deck.top/7.75)),rise=deck.top/n;risers=n;
    const turn=data.stairTurn==='Left'?-1:1,nextOut={x:stair.along.x*turn,y:stair.along.y*turn},nextAlong={x:-stair.outward.x*turn,y:-stair.outward.y*turn};
    if(data.stairType==='Straight'||n<4){(n>14?addInlineLanding:addStraight)(start,stair.outward,stair.along,stair.width,n,rise,'grade',`grade-${flight}`);continue;}
    if(data.stairType==='Landing'){
      const upper=Math.ceil(n/2),lower=n-upper,end=addStraight(start,stair.outward,stair.along,stair.width,upper,rise,'grade',`grade-${flight}-upper`);
      const depth=Math.max(stair.width,data.landingDepthIn||48),cx=end.x+stair.outward.x*depth/2,cz=end.z+stair.outward.y*depth/2;
      const w=Math.abs(stair.along.x)*stair.width+Math.abs(stair.outward.x)*depth,h=Math.abs(stair.along.y)*stair.width+Math.abs(stair.outward.y)*depth;
      const fp:FootprintPlan={bounds:{w,h},isCurved:false,outline:[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}]};
      const landing=makeLevel(fp,end.y,{x:cx-w/2,y:0,z:cz-h/2},false,'landing',levels.length);levels.push(landing);
      const lowerStart={x:cx+nextOut.x*stair.width/2,y:end.y,z:cz+nextOut.y*stair.width/2};addStraight(lowerStart,nextOut,nextAlong,stair.width,lower,rise,'grade',`grade-${flight}-lower`);
      if(data.railingType!=='None'){
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
        const xs=polygon.map(p=>p.x),zs=polygon.map(p=>p.y);treads.push({x:(Math.min(...xs)+Math.max(...xs))/2,y:y-.5,z:(Math.min(...zs)+Math.max(...zs))/2,w:Math.max(...xs)-Math.min(...xs),h:1,d:Math.max(...zs)-Math.min(...zs),polygon,kind:'winder'});
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
        const pa=point(outer,a),pb=point(outer,b);if(data.railingType!=='None'){railRuns.push({a:{x:pa.x,y,z:pa.y},b:{x:pb.x,y:end.y-Math.min(i+1,2)*rise,z:pb.y}});const ia=point(inner,a),ib=point(inner,b);railRuns.push({a:{x:ia.x,y,z:ia.y},b:{x:ib.x,y:end.y-Math.min(i+1,2)*rise,z:ib.y}});}
      }
      for(let i=0;i<=3;i++)for(const radius of [inner,outer]){const p=point(radius,i*Math.PI/6);support.push({x:p.x,y:Math.max(0,end.y-Math.max(0,i-1)*rise-joistDepth-1),z:p.y});}
      const outline=[point(inner,0),point(outer,0),point(outer,Math.PI/2),point(inner,Math.PI/2)],xs=outline.map(p=>p.x),zs=outline.map(p=>p.y),minX=Math.min(...xs),minZ=Math.min(...zs);
      levels.push({kind:'winder',index:levels.length,footprint:{outline:outline.map(p=>({x:p.x-minX,y:p.y-minZ})),bounds:{w:Math.max(...xs)-minX,h:Math.max(...zs)-minZ},isCurved:false},top:end.y,offset:{x:minX,y:0,z:minZ},boards:[],supports:support,joists:framing,beams:winderBeams,blocking:[],breakers:[],reference:deck.reference,rim:[]});
      const p=point(inner+stair.width/2,Math.PI/2),lowerStart={x:p.x,y:end.y-2*rise,z:p.y};
      flights.push({id:`grade-${flight}-winders`,kind:'grade',risers:2,rise,run:12*Math.PI/3,width:stair.width,start:end,end:lowerStart,type:'Winder',stringerOffsets:[]});
      if(lower)addStraight(lowerStart,nextOut,nextAlong,stair.width,lower,rise,'grade',`grade-${flight}-lower`,0);
    }
  }
  for(const [index,level]of levels.entries()){
    if(level.kind!=='deck')continue;
    let segments=getRailingSegments(data,level.footprint,null,index===0?mainContact:undefined);
    for(const opening of openings.get(index)||[]){
      const ox=opening.origin.x,oz=opening.origin.y,ux=opening.along.x,uz=opening.along.y;
      segments=segments.flatMap(s=>{const cross=(s.a.x-ox)*uz-(s.a.y-oz)*ux,crossB=(s.b.x-ox)*uz-(s.b.y-oz)*ux;if(Math.abs(cross)>.01||Math.abs(crossB)>.01)return[s];const a=(s.a.x-ox)*ux+(s.a.y-oz)*uz,b=(s.b.x-ox)*ux+(s.b.y-oz)*uz,lo=Math.min(a,b),hi=Math.max(a,b);if(hi<=0||lo>=opening.width)return[s];const result=[];if(lo<0)result.push({...s,a:{x:ox+ux*lo,y:oz+uz*lo},b:{x:ox,y:oz}});if(hi>opening.width)result.push({...s,a:{x:ox+ux*opening.width,y:oz+uz*opening.width},b:{x:ox+ux*hi,y:oz+uz*hi}});return result;});
    }
    for(const s of segments)railRuns.push({a:{x:s.a.x+level.offset.x,y:level.top,z:s.a.y+level.offset.z},b:{x:s.b.x+level.offset.x,y:level.top,z:s.b.y+level.offset.z}});
  }
  const posts:V3[]=[],rails:Member[]=[],balusters:Member[]=[],glass:Member[]=[];
  const railHeight=data.height>71?42:36,maxSpan=((RAILING_COSTS as any)[data.railingType]?.spacing||6)*12;
  const postKeys=new Set<string>();let railSections=0;
  for(const r of railRuns){
    const length=distance(r.a,r.b);if(length<1)continue;const bays=Math.ceil(length/maxSpan);railSections+=bays;
    for(let b=0;b<=bays;b++){const p=mix(r.a,r.b,b/bays),key=[p.x,p.y,p.z].map(n=>n.toFixed(1)).join(':');if(!postKeys.has(key)){posts.push(p);postKeys.add(key);}}
    for(const h of [3,railHeight-1.25])rails.push({a:{...r.a,y:r.a.y+h},b:{...r.b,y:r.b.y+h},width:2,depth:h===3?1.5:2.5});
    if(data.railingType==='Glass Panels')for(let b=0;b<bays;b++){const a=mix(r.a,r.b,b/bays),end=mix(r.a,r.b,(b+1)/bays);glass.push({a:{...a,y:a.y+railHeight/2},b:{...end,y:end.y+railHeight/2},width:0.5,depth:railHeight-8});}
    else if(data.railingType==='Cable')for(let i=1;i<=9;i++){const h=3+(railHeight-6)*i/10;balusters.push({a:{...r.a,y:r.a.y+h},b:{...r.b,y:r.b.y+h},width:0.125,depth:0.125});}
    else {const count=Math.ceil(length/4.5);for(let i=1;i<count;i++){const p=mix(r.a,r.b,i/count);balusters.push({a:{...p,y:p.y+4},b:{...p,y:p.y+railHeight-3},width:0.75,depth:0.75});}}
  }
  if(flights.length)issues.push(...stairSupport.issues,'Closed-riser thickness is allowed for in the illustrated stringer notch faces. Confirm the resulting stringer throat, bearing and manufacturer attachment detail before cutting.');
  // Door-sill step-down, checked only once the house floor height has been set. 7.75 in is the
  // studio's existing maximum riser, so no new rule is introduced.
  const sill=getHouseConfig(data).floorHeightIn;
  if(sill!==undefined&&deckAttachesToHouse(data)){
    if(data.height>sill+.01)issues.push(`The deck surface (${data.height} in above grade) is above the house floor / door sill (${sill} in). Water can run toward the door: lower the deck or confirm a sill detail before construction.`);
    else if(sill-data.height>7.75)issues.push(`The door sill is ${(sill-data.height).toFixed(1)} in above the deck surface, more than one 7.75 in step. Add a step or landing at the door, or raise the deck.`);
  }
  for(const level of levels){
    if(level.kind!=='deck')continue;
    const loose=unsupportedJoistEnds(level,level.index===0?mainContact:undefined);
    if(loose.length)issues.push(`${loose.length} joist end${loose.length===1?'':'s'} on the ${level.index===0?'main deck':'second level'} do not bear on a ledger or beam (for example a shallow notch wing). Add a beam and posts under that edge before construction.`);
  }
  const foundationSaddle=data.foundation==='Deck Blocks'?6.5:4.5;
  if(levels.some(l=>l.supports.some(p=>p.y>0&&p.y<=foundationSaddle)||l.top<joistDepth+1+foundationSaddle))issues.push('Selected deck elevation leaves insufficient clearance for framing and the foundation saddle; review low-profile framing or excavation before construction.');
  const quantities={riserBoardPieces:riserBoards.length,riserBoardLf:riserBoards.reduce((n,b)=>n+b.w/12,0),riserBoardArea:riserBoards.reduce((n,b)=>n+b.w*b.h/144,0),inlayLf:levels.reduce((n,l)=>n+l.boards.filter(b=>b.role==='inlay').reduce((n,b)=>n+b.length/12,0),0),totalRisers:flights.reduce((n,f)=>n+f.risers,0),landingArea:levels.filter(l=>l.kind==='landing').reduce((n,l)=>n+polygonArea(l.footprint),0),breakerBoards:levels.reduce((n,l)=>n+l.breakers.length,0),blocking:levels.reduce((n,l)=>n+l.blocking.length,0),stairRailingLf:railRuns.filter(r=>r.a.y!==r.b.y).reduce((n,r)=>n+distance(r.a,r.b)/12,0),footings:levels.reduce((sum,l)=>sum+l.supports.length,0),supportPosts:levels.reduce((sum,l)=>sum+l.supports.filter(p=>p.y>foundationSaddle).length,0),joists:levels.reduce((sum,l)=>sum+l.joists.length,0),railingPosts:posts.length,railingSections:railSections,railingLf:railRuns.reduce((sum,r)=>sum+distance(r.a,r.b)/12,0),risersPerFlight:risers,stairFlights:stairOpenings.length,stairTreads:treads.length,stringers:stringers.length,installedBoardPieces:levels.reduce((sum,l)=>sum+l.boards.length,0),area:levels.reduce((sum,l)=>sum+(l.kind==='winder'?0:polygonArea(l.footprint)),0),framingLf:levels.reduce((sum,l)=>sum+[...l.joists,...l.beams,...l.blocking,...(l.rim||[])].reduce((n,m)=>n+distance(m.a,m.b)/12,0),0)};
  return {levels,treads,riserBoards,stairSupport,stringers,flights,connections,issues,railing:{posts,rails,balusters,glass,height:railHeight},quantities,gap,stockLength};
}
export type DeckTakeoff=ReturnType<typeof buildDeckTakeoff>;
