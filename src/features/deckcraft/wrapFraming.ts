import {addBearings,blockBoardEnd,splitOnBearingsAlong,type FramedSet} from './constructionDetails';
import {cleanPolygon,outlineSpans,zoneReference,frameZoneBearings,frameZoneJoists,frameHouseSideBeams,doubledMemberSpanIn,type DeckZone,type ZoneFramingConfig,type ZoneReference} from './zoneFraming';
import {getBoardRows,type BoardRun,type PlanPoint} from './lib/deckGeometry';
import {offsetPolygons,polygonBoard,polygonCut,signedArea} from './lib/polygonCuts';
import {distanceToSegment,halfPlane,toLocal,toPlan,wrapHips,wrapZones,type ActiveWrap,type WrapFrame,type WrapHip,type WrapZoneGeometry} from './lib/wrapGeometry';
import type {DeckLevel,Member,V3} from './deckTakeoff';

/**
 * Framing and decking of a wrap-around main deck. Each zone (main deck, left wing, right wing) is
 * framed in its own frame exactly like a plain attached deck (joists away from its ledger, beams
 * parallel to it, the reference engine's beam rows and posts), then turned into plan. Zones meet on
 * a doubled hip that runs from the house corner to the outside corner:
 * - jack joists from both zones hang off the hip on skewed hangers;
 * - each zone beam ends on a junction post under the hip;
 * - extra posts keep every hip span within the two-ply span of the beam table, and the hip never
 *   cantilevers past its last post by more than the joist cantilever allowance × √2.
 * Field boards run parallel to each zone's house wall and stop half a board gap short of the hip,
 * so the mitred ends of both zones bear on the doubled hip.
 */
export interface WrapZoneFraming{geom:WrapZoneGeometry;reference:ZoneReference;
  /** This zone's joists in its own frame (after bearing splits), for board-end blocking. */
  joists:Member[];keys:Set<string>}
export interface WrapFramingResult{supports:V3[];beams:Member[];joists:Member[];blocking:Member[];fieldBoards:BoardRun[];breakers:number[];zones:WrapZoneFraming[];hips:WrapHip[];reference:ZoneReference}

const HIP_TOLERANCE_IN=1.5;
const point3=(f:WrapFrame,v:V3):V3=>{const p=toPlan(f,{x:v.x,y:v.z});return {x:p.x,y:v.y,z:p.y};};
const member=(f:WrapFrame,m:Member):Member=>({...m,a:point3(f,m.a),b:point3(f,m.b)});
function board(f:WrapFrame,b:BoardRun):BoardRun{
  const c=toPlan(f,{x:b.cx,y:b.cy}),a=b.angleDeg*Math.PI/180,d={x:Math.cos(a)*f.ux.x+Math.sin(a)*f.uz.x,y:Math.cos(a)*f.ux.y+Math.sin(a)*f.uz.y};
  let angle=Math.round(Math.atan2(d.y,d.x)*180/Math.PI*1e6)/1e6;if(angle>90)angle-=180;if(angle<=-90)angle+=180;
  return {...b,cx:c.x,cy:c.y,angleDeg:angle,...(b.polygon?{polygon:b.polygon.map(p=>toPlan(f,p))}:{})};
}
const centroid=(p:PlanPoint[])=>({x:p.reduce((n,v)=>n+v.x,0)/p.length,y:p.reduce((n,v)=>n+v.y,0)/p.length});

/**
 * The main zone of a wrap notched around house bump-outs, split into strips at the bump-out side
 * walls: each strip is framed from its own back edge (the deck-facing wall, or a bump-out's face).
 * Without bump-outs the main zone stays one piece, exactly as before.
 */
const notchedOutline=(outline:PlanPoint[],houseCut:PlanPoint[][])=>cleanPolygon(polygonCut([outline],houseCut,true).sort((p,q)=>Math.abs(signedArea(q))-Math.abs(signedArea(p)))[0]??outline);
function mainStrips(outline:PlanPoint[],size:{w:number;h:number},houseCut:PlanPoint[][],cutXs:number[]):{outline:PlanPoint[];origin:PlanPoint;size:{w:number;h:number}}[]{
  if(!houseCut.length)return [{outline,origin:{x:0,y:0},size}];
  const notched=notchedOutline(outline,houseCut);
  const xs=[...new Set([0,...cutXs.filter(x=>x>.5&&x<size.w-.5),size.w])].sort((a,b)=>a-b),out=[];
  for(let i=0;i+1<xs.length;i++){
    for(const part of polygonCut([notched],[[{x:xs[i],y:-1e5},{x:xs[i+1],y:-1e5},{x:xs[i+1],y:1e5},{x:xs[i],y:1e5}]])){
      const clean=cleanPolygon(part),low=Math.min(...clean.map(p=>p.y)),y0=low>1e-6?low:0;
      out.push({outline:clean,origin:{x:xs[i],y:y0},size:{w:xs[i+1]-xs[i],h:Math.max(...clean.map(p=>p.y))-y0}});
    }
  }
  return out;
}

export function frameWrap(input:{wrap:ActiveWrap;cfg:ZoneFramingConfig;deckingOutline:PlanPoint[];inset:number;borders:number;boardWidth:number;gap:number;stockLength:number;houseSide:[number,number][];
  /** House blocks reaching into the main deck (plan polygons) and the x of their side walls. */
  houseCut?:PlanPoint[][];houseCutXs?:number[]}):WrapFramingResult{
  const {wrap,cfg,inset,borders,boardWidth,gap,stockLength}=input,zero:V3={x:0,y:0,z:0};
  const hips=wrapHips(wrap),field=offsetPolygons([input.deckingOutline],inset);
  const out:WrapFramingResult={supports:[],beams:[],joists:[],blocking:[],fieldBoards:[],breakers:[],zones:[],hips,reference:undefined as unknown as ZoneReference};
  for(const geom of wrapZones(wrap)){
    const f=geom.frame,mine=hips.filter(h=>h.zones.includes(geom.id)),localHips=mine.map(h=>({a:toLocal(f,h.a),b:toLocal(f,h.b)}));
    const onHip=(p:PlanPoint,tol=1)=>localHips.some(h=>distanceToSegment(p,h.a,h.b)<tol);
    const local:FramedSet&{blocking:Member[]}={offset:zero,supports:[],beams:[],joists:[],blocking:[]};
    // The main zone frames each strip between bump-outs off its own ledger; other zones are one piece.
    const parts=(geom.id==='main'?mainStrips(geom.local,geom.size,input.houseCut??[],input.houseCutXs??[]):[{outline:geom.local,origin:{x:0,y:0},size:geom.size}])
      .map(part=>{const zone:DeckZone={id:geom.id,...part,attached:true};return {zone,reference:zoneReference(zone,cfg)};});
    // The widest piece stands for the zone (the whole zone without bump-outs).
    const reference=parts.reduce((best,p)=>p.zone.size.w>best.zone.size.w?p:best).reference;
    if(geom.id==='main')out.reference=reference;
    const rowZs:number[]=[];
    for(const part of parts){
      frameZoneBearings(part,zero,local);
      const o=part.zone.origin;
      // Junction posts: every beam row that runs into the hip ends on a post under it.
      for(const row of part.reference.beamRows as {z:number}[]){const z=row.z*12+o.y;rowZs.push(z);for(const span of outlineSpans(part.zone.outline,z,'z'))for(const x of span){
        const p={x,y:z};if(!onHip(p)||local.supports.some(s=>Math.hypot(s.x-p.x,s.z-p.y)<1))continue;
        local.supports.push({x,y:Math.max(0,part.reference.bBotY*12),z});
      }}
    }
    if(geom.id==='main')frameHouseSideBeams(input.houseSide,geom.size.h,cfg,zero,local);
    // This zone's field: the finished field within this zone (widened 6 in on its outer edges to take
    // in the border overhang), stopping half a board gap short of each of its hips. Clipping to the
    // zone first keeps a hip line extended far past its corner from reaching another wing.
    let zoneField=polygonCut(field,offsetPolygons([geom.outline],-6));
    for(const h of mine)zoneField=polygonCut(zoneField,[halfPlane(h.a,h.b,centroid(geom.outline),gap/2)]);
    const localField=zoneField.map(poly=>poly.map(p=>toLocal(f,p)));
    const xs=localField.flat().map(p=>p.x),fieldLeft=xs.length?Math.min(...xs):0,fieldWidth=xs.length?Math.max(...xs)-fieldLeft:0,breakerZone=boardWidth+2*gap;
    let breakerCount=0;while((fieldWidth-breakerCount*breakerZone)/(breakerCount+1)>stockLength+1e-6)breakerCount++;
    const segment=(fieldWidth-breakerCount*breakerZone)/(breakerCount+1);
    const breakers=Array.from({length:breakerCount},(_,i)=>fieldLeft+(i+1)*segment+i*breakerZone+gap+boardWidth/2);
    // Border boards along a side that runs with the joists sit on doubled joists, as on a plain deck.
    const side=(x:number)=>geom.local.some((a,i)=>{const b=geom.local[(i+1)%geom.local.length];return Math.abs(a.x-x)<.5&&Math.abs(b.x-x)<.5&&Math.abs(b.y-a.y)>=12;});
    const buildUps=[...breakers.flatMap(x=>[-1.5,-.5,.5,1.5].map(k=>x+k*(1.5+.375))),...(borders&&side(0)?[1.5+2.375,1.5+2*2.375]:[]),...(borders&&side(geom.size.w)?[geom.size.w-1.5-2.375,geom.size.w-1.5-2*2.375]:[])];
    for(const part of parts)frameZoneJoists(part,zero,cfg,buildUps,local);
    // Jacks shorter than 3 in at the outside corner are only the hip meeting the rim.
    local.joists=local.joists.filter(j=>Math.hypot(j.b.x-j.a.x,j.b.z-j.a.z)>=3);
    addBearings(local,rowZs);
    // Field boards parallel to this zone's house wall, split at breakers, plus the breaker boards.
    const boards:BoardRun[]=[];
    for(const poly of localField){
      for(const b of getBoardRows({outline:poly,bounds:geom.size,isCurved:false},{boardWidth,gap,angleDeg:0,inset:0,maxBoardLen:breakers.length?100000:stockLength})){
        let intervals:[number,number][]=[[b.cx-b.length/2,b.cx+b.length/2]];
        for(const x of breakers){const lo=x-boardWidth/2-gap,hi=x+boardWidth/2+gap;intervals=intervals.flatMap(([a,z])=>z<=lo||a>=hi?[[a,z]]:[...(a<lo?[[a,lo]]:[]),...(z>hi?[[hi,z]]:[])] as [number,number][]);}
        for(const [a,z] of intervals)if(z-a>.001)for(const p of polygonCut([b.polygon!],[[{x:a,y:-1e4},{x:z,y:-1e4},{x:z,y:1e4},{x:a,y:1e4}]]))boards.push(polygonBoard(p,0,b.role));
      }
      for(const x of breakers)for(const [a,b] of outlineSpans(poly,x,'x'))for(let z=a;z<b;z+=stockLength+gap){
        const run=Math.min(stockLength,b-z);
        for(const p of polygonCut([poly],[[{x:x-boardWidth/2,y:z},{x:x+boardWidth/2,y:z},{x:x+boardWidth/2,y:z+run},{x:x-boardWidth/2,y:z+run}]]))boards.push(polygonBoard(p,90,'breaker'));
      }
    }
    out.supports.push(...local.supports.map(p=>point3(f,p)));
    out.beams.push(...local.beams.map(m=>member(f,m)));
    out.joists.push(...local.joists.map(m=>member(f,m)));
    out.blocking.push(...local.blocking.map(m=>member(f,m)));
    out.fieldBoards.push(...boards.map(b=>board(f,b)));
    out.breakers.push(...breakers);
    // Board-end blocking and the plan use the zone as built: the main zone notched around bump-outs.
    const built=geom.id==='main'&&input.houseCut?.length?notchedOutline(geom.local,input.houseCut):null;
    out.zones.push({geom:built?{...geom,outline:built,local:built}:geom,reference,joists:local.joists,keys:new Set()});
  }
  // One post where the main-deck and wing beams meet the same point on a hip.
  out.supports=out.supports.filter((p,i)=>!out.supports.some((q,j)=>j<i&&Math.hypot(p.x-q.x,p.z-q.z)<1));
  const hipMax=doubledMemberSpanIn(cfg),endAllowance=out.reference.cant*12*Math.SQRT2,y=cfg.top-1-cfg.joistDepth/2;
  for(const hip of hips){
    const total=Math.hypot(hip.b.x-hip.a.x,hip.b.y-hip.a.y),u={x:(hip.b.x-hip.a.x)/total,y:(hip.b.y-hip.a.y)/total},n={x:-u.y,y:u.x};
    const at=(t:number)=>({x:hip.a.x+u.x*t,y:hip.a.y+u.y*t});
    // The house-corner end hangs on a skewed hip hanger at the ledgers (t = 0).
    let ts=[0,...out.supports.filter(p=>distanceToSegment({x:p.x,y:p.z},hip.a,hip.b)<HIP_TOLERANCE_IN).map(p=>(p.x-hip.a.x)*u.x+(p.z-hip.a.y)*u.y)].sort((a,b)=>a-b).filter((t,i,all)=>i===0||t-all[i-1]>1);
    const added:number[]=[];
    if(total-ts.at(-1)!>endAllowance+.5){added.push(total-endAllowance);ts=[...ts,total-endAllowance];}
    for(let i=0;i+1<ts.length;i++){const gapIn=ts[i+1]-ts[i],k=Math.ceil(gapIn/hipMax-1e-9)-1;for(let j=1;j<=k;j++)added.push(ts[i]+gapIn*j/(k+1));}
    for(const t of added){const p=at(t);out.supports.push({x:p.x,y:Math.max(0,cfg.top-1-cfg.joistDepth),z:p.y});}
    const bearings=[...ts,...added].sort((a,b)=>a-b);
    for(const shift of [-.75,.75]){
      const a={x:hip.a.x+n.x*shift,y,z:hip.a.y+n.y*shift},b={x:hip.b.x+n.x*shift,y,z:hip.b.y+n.y*shift};
      out.beams.push(...splitOnBearingsAlong({a,b,width:1.5,depth:cfg.joistDepth,role:'hip'},bearings));
    }
  }
  return out;
}

/** Board-end blocking for a wrap level: each board end is blocked in the zone that holds it, between
 * that zone's joists. Ends on a hip bear on the doubled hip itself. */
export function wrapBoardEndBlocking(level:DeckLevel,zones:WrapZoneFraming[],hips:WrapHip[]){
  const depth=level.joists[0]?.depth||9.25,framingY=level.top-1-depth/2;
  for(const b of level.boards){
    const angle=b.angleDeg*Math.PI/180,ux=Math.cos(angle),uz=Math.sin(angle);
    for(const sign of [-1,1]){
      const p={x:b.cx+ux*b.length/2*sign,y:b.cy+uz*b.length/2*sign};
      if(hips.some(h=>distanceToSegment(p,h.a,h.b)<3))continue;
      const zone=zones.find(z=>{const q=toLocal(z.geom.frame,p);return outlineSpans(z.geom.local,q.y,'z').some(([lo,hi])=>q.x>=lo-.01&&q.x<=hi+.01);});
      if(!zone)continue;
      const q=toLocal(zone.geom.frame,p),blocks:Member[]=[];
      blockBoardEnd(q.x,q.y,zone.joists,z=>outlineSpans(zone.geom.local,z,'z'),zone.keys,framingY,depth,blocks);
      level.blocking.push(...blocks.map(m=>member(zone.geom.frame,m)));
    }
  }
}

/** Zone outlines and joist directions for the plan drawing. */
export const planZones=(zones:WrapZoneFraming[])=>zones.map(z=>({id:z.geom.id,label:z.geom.label,outline:z.geom.outline,joistDir:z.geom.frame.uz}));
