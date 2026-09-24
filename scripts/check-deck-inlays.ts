import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {buildDeckTakeoff,type DeckLevel,type Member} from '../src/features/deckcraft/deckTakeoff';
import {serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {describeDesign} from '../src/features/deckcraft/designFacts';
import {designFeatures} from '../src/features/deckcraft/deckAnalytics';
import {boardFinishPlan} from '../src/features/deckcraft/boardFinishes';
import {inSolidInlay} from '../src/features/deckcraft/inlayFraming';
import {deckBoardStock} from '../src/features/deckcraft/stockPlan';
import {unconfirmedRates} from '../src/features/deckcraft/rateConfidence';
import {boardOutline,polygonCut,signedArea} from '../src/features/deckcraft/lib/polygonCuts';
import {bandBuildUps,fieldAngles,fillAngles,fitInlay,inlayCrewDays,INLAY_LIMITS,levelInlayContext,planInlays,stripeToBand,type InlayPlan} from '../src/features/deckcraft/lib/inlayGeometry';
import type {PlanPoint} from '../src/features/deckcraft/lib/deckGeometry';
import {WASTE_FACTORS,type DeckData,type DeckInlay} from '../src/features/deckcraft/types';
import {designerSource} from './deck-designer-source';

/**
 * Decorative inlays: framed rectangles and diamonds (F2), bands and medallions (F3). The boards are cut around each
 * inlay (or, for a band across a straight deck, its rows recoloured) with no overlap and nothing longer than stock;
 * every joint where boards end at an inlay, every frame board that runs with the joists and every inside that needs
 * it has framing under it; a band running front to back sits on a breaker's build-up joists and takes a breaker's
 * place; a medallion sits on solid blocking; the placement rules hold; labour is the breaker rate on fitted edges plus
 * the inside's pattern factor, exactly, and a medallion's is a builder quote; the inlay boards are their own stock;
 * the legacy centre stripe becomes a band only when asked; and a design without inlays is unchanged.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const base=(patch:Partial<DeckData>={}):DeckData=>deckReleaseData({...structuredClone(DEFAULT_DECK),width:20,length:14,...patch});
const price=(d:DeckData)=>calculateDeckReleaseEstimate(d,DECK_SETTINGS);
type Framed=Extract<DeckInlay,{kind:'rug'|'diamond'}>;type Band=Extract<DeckInlay,{kind:'band'}>;type Medallion=Extract<DeckInlay,{kind:'medallion'}>;
const rug=(patch:Partial<Framed>={}):Framed=>({id:'a',kind:'rug',widthFt:6,depthFt:4,...patch});
const diamond=(patch:Partial<Framed>={}):Framed=>({id:'d',kind:'diamond',widthFt:4,depthFt:4,...patch});
const band=(patch:Partial<Band>={}):Band=>({id:'b',kind:'band',direction:'along',boards:1,...patch});
const medallion=(patch:Partial<Medallion>={}):Medallion=>({id:'m',kind:'medallion',diameterFt:5,style:'compass',...patch});
const polyArea=(ps:PlanPoint[][])=>ps.reduce((n,p)=>n+Math.abs(signedArea(p)),0);
const box=(p:PlanPoint[])=>({x0:Math.min(...p.map(v=>v.x)),x1:Math.max(...p.map(v=>v.x)),y0:Math.min(...p.map(v=>v.y)),y1:Math.max(...p.map(v=>v.y))});
const segDist=(x:number,z:number,m:Member)=>{const dx=m.b.x-m.a.x,dz=m.b.z-m.a.z,l2=dx*dx+dz*dz;const t=l2?Math.max(0,Math.min(1,((x-m.a.x)*dx+(z-m.a.z)*dz)/l2)):0;return Math.hypot(x-(m.a.x+dx*t),z-(m.a.z+dz*t));};
// A point within a quarter inch of a joist's face (1.5 in wide) rests on it; this also covers the narrow crack between
// a breaker's doubled build-up joists, which no blocking fits.
const onJoist=(x:number,z:number,level:DeckLevel)=>level.joists.some(j=>Math.abs(j.a.x-x)<1&&z>=Math.min(j.a.z,j.b.z)-.5&&z<=Math.max(j.a.z,j.b.z)+.5);
const parallel=(deg:number,angles:number[])=>angles.some(a=>Math.abs(Math.sin((deg-a)*Math.PI/180))<.05);
const edgesOf=(poly:PlanPoint[])=>poly.map((a,i)=>{const b=poly[(i+1)%poly.length],len=Math.hypot(b.x-a.x,b.y-a.y);return {a,b,len,deg:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI,n:{x:-(b.y-a.y)/len,y:(b.x-a.x)/len}};}).filter(e=>e.len>1);

/** Board ends at an inlay that rest on nothing: behind each end face (square or mitred), a band 1½ in deep measured
 * square to the face must overlap a joist, block, rim or beam. Counted for every inlay board end and every other end
 * within 3 in of the inlay; `supported` accepts an end outright (a medallion's solid blocking). */
function looseEnds(level:DeckLevel,pieces:PlanPoint[][],bw:number,supported?:(p:PlanPoint)=>boolean){
  const members=[...level.joists,...level.blocking,...(level.rim??[]),...level.beams].map(m=>{const dx=m.b.x-m.a.x,dz=m.b.z-m.a.z,len=Math.hypot(dx,dz)||1,nx=-dz/len*m.width/2,nz=dx/len*m.width/2;
    const rect=[{x:m.a.x+nx,y:m.a.z+nz},{x:m.b.x+nx,y:m.b.z+nz},{x:m.b.x-nx,y:m.b.z-nz},{x:m.a.x-nx,y:m.a.z-nz}];return {rect,bb:box(rect)};});
  const ob=box(pieces.flat());let loose=0;
  for(const b of level.boards){
    const poly=boardOutline(b,bw).map(p=>({x:p.x+level.offset.x,y:p.y+level.offset.z}));if(polyArea([poly])<1)continue;
    const a=b.angleDeg*Math.PI/180,u={x:Math.cos(a),y:Math.sin(a)},us=poly.map(p=>p.x*u.x+p.y*u.y),lo=Math.min(...us),hi=Math.max(...us);
    for(const end of [-1,1]){
      // The end's faces: edges across the board, nearer this end.
      const faces=poly.map((p,i)=>[p,poly[(i+1)%poly.length]]).filter(([p,q])=>{const len=Math.hypot(q.x-p.x,q.y-p.y);if(len<.3)return false;const sin=Math.abs(((q.x-p.x)*u.y-(q.y-p.y)*u.x)/len);const mid=((p.x+q.x)*u.x+(p.y+q.y)*u.y)/2;return sin>.2&&(end<0?mid-lo<hi-mid:hi-mid<=mid-lo);});
      if(!faces.length)continue;
      const bands=faces.map(([p,q])=>{const len=Math.hypot(q.x-p.x,q.y-p.y),sin=Math.abs(((q.x-p.x)*u.y-(q.y-p.y)*u.x)/len),L=1.5/sin,d={x:-end*u.x*L,y:-end*u.y*L};return [p,q,{x:q.x+d.x,y:q.y+d.y},{x:p.x+d.x,y:p.y+d.y}];});
      const zone=polygonCut([poly],bands);if(!zone.length)continue;
      const sb=box(zone.flat()),c={x:(sb.x0+sb.x1)/2-level.offset.x,y:(sb.y0+sb.y1)/2-level.offset.z};
      const touches=b.inlay||(c.x>ob.x0-3&&c.x<ob.x1+3&&c.y>ob.y0-3&&c.y<ob.y1+3&&polyArea(polygonCut(pieces,[[{x:c.x-3,y:c.y-3},{x:c.x+3,y:c.y-3},{x:c.x+3,y:c.y+3},{x:c.x-3,y:c.y+3}]]))>0);
      if(!touches||supported?.(c))continue;
      const need=Math.min(.5,polyArea(zone)*.25);
      // The house rule too (constructionDetails blockBoardEnd): an end face whose middle is within 0.76 in of a
      // joist's centre is on that joist.
      const face=faces.reduce((best,f)=>Math.hypot(f[1].x-f[0].x,f[1].y-f[0].y)>Math.hypot(best[1].x-best[0].x,best[1].y-best[0].y)?f:best),fm={x:(face[0].x+face[1].x)/2,y:(face[0].y+face[1].y)/2};
      const onJoistRule=level.joists.some(j=>Math.abs(j.a.x-fm.x)<.76&&fm.y>=Math.min(j.a.z,j.b.z)-.1&&fm.y<=Math.max(j.a.z,j.b.z)+.1);
      if(!onJoistRule&&!members.some(m=>m.bb.x0<sb.x1&&m.bb.x1>sb.x0&&m.bb.y0<sb.y1&&m.bb.y1>sb.y0&&polyArea(polygonCut(zone,[m.rect]))>=need))loose++;
    }
  }
  return loose;
}
function overlapping(level:DeckLevel,bw:number){
  const polys=level.boards.map(b=>boardOutline(b,bw)),boxes=polys.map(box);let n=0;
  for(let i=0;i<polys.length;i++)for(let j=i+1;j<polys.length;j++){const a=boxes[i],b=boxes[j];if(a.x0>=b.x1||b.x0>=a.x1||a.y0>=b.y1||b.y0>=a.y1)continue;if(polyArea(polygonCut([polys[i]],[polys[j]]))>.5)n++;}
  return n;
}

// 1. No inlays: nothing changes.
{
  const d=base(),empty={...d,inlays:[]};
  ok(JSON.stringify({...price(d),model:undefined,yardModel:undefined})===JSON.stringify({...price(empty),model:undefined,yardModel:undefined}),'An empty inlay list prices exactly like none');
  ok(validateDesign(empty).inlays===undefined&&serializeDesign(d)===serializeDesign(empty),'An empty inlay list is not saved');
  ok(buildDeckTakeoff(d).levels.every(l=>l.inlays===undefined&&l.blocking.every(b=>!b.role?.startsWith('inlay-'))&&l.boards.every(b=>!b.inlay)),'A deck without inlays has no inlay boards, plans or framing');
}

// 2. Framed inlays: geometry and framing over inlay kinds × main patterns × deck shapes.
const kinds:[string,Framed][]=[['rug, straight inside',rug()],['rug, herringbone inside, 2 frame rows',rug({pattern:'Herringbone',frameRows:2,widthFt:6,depthFt:5,dxFt:-1})],['rug, diagonal inside',rug({pattern:'Diagonal'})],['diamond, straight inside',diamond()],['diamond, herringbone inside',diamond({pattern:'Herringbone',widthFt:5,depthFt:5})]];
const patterns:Partial<DeckData>[]=[{pattern:'Straight'},{pattern:'Diagonal'},{pattern:'Herringbone'},{pattern:'Picture Frame'}];
const shapes:[string,Partial<DeckData>][]=[['rectangle',{}],['L-shape',{shape:'L-Shape',width:24,length:16,cutoutWidth:8,cutoutLength:6}],['angled corner',{cornerChamfers:{frontLeftFt:4}}],['custom T',{shape:'Custom',customFront:[{x:20,y:8},{x:15,y:8},{x:15,y:14},{x:5,y:14},{x:5,y:8},{x:0,y:8}]}]];
let designs=0;
for(const [kindName,inlay] of kinds)for(const pattern of patterns)for(const [shapeName,shape] of shapes){
  const d=base({...shape,...pattern,inlays:[inlay]}),model=buildDeckTakeoff(d),level=model.levels[0],label=`${kindName} on a ${d.pattern} ${shapeName}`;designs++;
  const plan=level.inlays?.[0] as InlayPlan;
  ok(plan?.status==='ok',`${label}: built (${plan?.message??'no plan'})`);
  const gap=model.gap,bw=d.boardWidth,spacing=d.pattern==='Diagonal'||d.pattern==='Herringbone'?12:d.joistSpacing;
  // Boards: no overlap, nothing past stock, inlay boards inside the outline and nothing else inside it.
  const overlaps=overlapping(level,bw);
  ok(overlaps===0,`${label}: no two boards overlap (${overlaps})`);
  ok(level.boards.every(b=>b.length<=model.stockLength+.01),`${label}: no piece is longer than stock`);
  const inlayBoards=level.boards.filter(b=>b.inlay),others=level.boards.filter(b=>!b.inlay);
  ok(inlayBoards.length>0&&inlayBoards.some(b=>b.role==='inlay-frame')&&inlayBoards.some(b=>b.role==='inlay-fill'),`${label}: frame and inside boards are built`);
  ok(inlayBoards.every(b=>polyArea(polygonCut([boardOutline(b,bw)],[plan.outline],true))<1),`${label}: inlay boards stay inside the inlay`);
  ok(others.every(b=>polyArea(polygonCut([boardOutline(b,bw)],[plan.outline]))<1),`${label}: field, border and breaker boards stop at the inlay`);
  const inlaySupport=level.blocking.filter(m=>m.role?.startsWith('inlay-'));
  const at=(p:PlanPoint)=>({x:p.x+level.offset.x,z:p.y+level.offset.z});
  const supported=(p:PlanPoint,roles:string[])=>{const w=at(p);return onJoist(w.x,w.z,level)||inlaySupport.some(m=>roles.includes(m.role!)&&segDist(w.x,w.z,m)<1.0);};
  const sampleLine=(a:PlanPoint,b:PlanPoint,roles:string[],what:string)=>{
    const len=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(2,Math.floor(len/3));let missed=0;
    for(let i=1;i<n;i++){const t=i/n;if(t*len<2||(1-t)*len<2)continue;if(!supported({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},roles))missed++;}
    ok(missed===0,`${label}: ${what} has framing under it all along (${missed} gaps)`);
  };
  // Joints where boards end at the inlay: field boards at the outer edge, fill boards at the inner edge.
  for(const e of edgesOf(plan.outline))if(!parallel(e.deg,fieldAngles(d.pattern)))sampleLine({x:e.a.x-e.n.x*gap/2,y:e.a.y-e.n.y*gap/2},{x:e.b.x-e.n.x*gap/2,y:e.b.y-e.n.y*gap/2},['inlay-edge'],'the outer joint');
  for(const e of edgesOf(plan.inner))if(!parallel(e.deg,fillAngles(plan.pattern)))sampleLine({x:e.a.x-e.n.x*gap/2,y:e.a.y-e.n.y*gap/2},{x:e.b.x-e.n.x*gap/2,y:e.b.y-e.n.y*gap/2},['inlay-edge'],'the inner joint');
  // Frame boards running with the joists (or at 45° over 16 in joists) rest on nailers.
  for(const e of edgesOf(plan.outline)){
    const along=Math.abs(Math.cos(e.deg*Math.PI/180))<.05,angled=Math.abs(Math.abs(Math.sin(e.deg*Math.PI/180))-Math.SQRT1_2)<.05&&spacing>12;
    if(along||angled)for(let k=0;k<plan.frameRows;k++){const d0=k*(bw+gap)+bw/2;sampleLine({x:e.a.x+e.n.x*d0,y:e.a.y+e.n.y*d0},{x:e.b.x+e.n.x*d0,y:e.b.y+e.n.y*d0},['inlay-nailer','inlay-edge'],`frame row ${k+1} along a ${Math.round(e.deg)}° edge`);}
  }
  // An inside the joists alone do not carry has rungs at 12 in centres or closer.
  const rungs=inlaySupport.filter(m=>m.role==='inlay-ladder').map(m=>m.a.z);
  const needs=fillAngles(plan.pattern).some(a=>Math.abs(Math.cos(a*Math.PI/180))<.05||(Math.abs(Math.abs(Math.sin(a*Math.PI/180))-Math.SQRT1_2)<.05&&spacing>12))||plan.pattern==='Herringbone';
  if(needs){const zs=[...new Set(rungs.map(z=>Math.round(z*10)/10))].sort((a,b)=>a-b);ok(zs.length>0&&zs.every((z,i)=>i===0||z-zs[i-1]<=12.01),`${label}: rungs under the inside at 12 in centres or closer`);}
  else ok(rungs.length===0,`${label}: no rungs where the joists carry the inside`);
  const loose=looseEnds(level,[plan.outline],bw);
  ok(loose===0,`${label}: every board end at the inlay rests on framing (${loose} loose)`);
}
{
  const plain=price(base()),inl=price(base({inlays:[rug({pattern:'Herringbone'})]}));
  const conn=(e:typeof plain)=>e.connectorSchedule.find(r=>r.name==='Blocking connections')?.qty??0;
  ok(inl.model.quantities.blocking>plain.model.quantities.blocking&&conn(inl)>conn(plain),'Inlay framing adds blocking and blocking connections');
  const frame=(e:typeof plain)=>e.sections.find(s=>s.title.startsWith('Structural'))!.total;
  ok(frame(inl)>frame(plain),'Inlay framing is priced in the framing lumber');
}

// 3. Bands and medallions (F3) over main patterns × deck shapes, each placed as the editor places a new one.
const f3:[string,DeckInlay][]=[['band across, two boards',band({direction:'across',boards:2})],['band front to back, one board off the middle',band({atFt:-3})],['band front to back, three boards',band({boards:3,atFt:2.5})],['round medallion',medallion({style:'round'})],['compass medallion',medallion({diameterFt:6,dxFt:-1})]];
let f3Designs=0;
for(const [kindName,wanted] of f3)for(const pattern of patterns)for(const [shapeName,shape] of shapes){
  const d0=base({...shape,...pattern}),m0=buildDeckTakeoff(d0),label=`${kindName} on a ${d0.pattern} ${shapeName}`;f3Designs++;
  const inlay=fitInlay(wanted,[],levelInlayContext(d0,m0.levels[0]));
  ok(inlay,`${label}: the editor finds a place for it`);if(!inlay)continue;
  const d={...d0,inlays:[inlay]},model=buildDeckTakeoff(d),level=model.levels[0],plan=level.inlays?.[0] as InlayPlan,bw=d.boardWidth,gap=model.gap;
  ok(plan?.status==='ok',`${label}: built (${plan?.message??'no plan'})`);if(plan?.status!=='ok')continue;
  const overlaps=overlapping(level,bw);
  ok(overlaps===0,`${label}: no two boards overlap (${overlaps})`);
  ok(level.boards.every(b=>b.length<=model.stockLength+.01),`${label}: no piece is longer than stock`);
  const mine=level.boards.filter(b=>b.inlay===plan.id);
  ok(mine.length>0&&mine.every(b=>polyArea(polygonCut([boardOutline(b,bw)],plan.pieces,true))<1),`${label}: its boards are built, inside it`);
  const straight=d.pattern==='Straight'||d.pattern==='Picture Frame',area=(l:DeckLevel)=>l.boards.reduce((n,b)=>n+polyArea([boardOutline(b,bw)]),0)/144;
  if(plan.band){
    const {direction,rows}=plan.band;
    ok(rows===(direction==='across'&&straight),`${label}: ${rows?'whole rows of the straight field are recoloured':'the band is cut in'}`);
    if(rows){
      // Colour only: the same boards, framing and area, the band's rows retagged, and no fitted edge.
      ok(level.boards.length===m0.levels[0].boards.length&&Math.abs(area(level)-area(m0.levels[0]))<.01&&level.joists.length===m0.levels[0].joists.length&&level.blocking.length===m0.levels[0].blocking.length,`${label}: colour only, with no cutting or framing`);
      ok(mine.every(b=>b.role==='inlay-fill'&&b.cy>plan.band!.from&&b.cy<plan.band!.to)&&!level.boards.some(b=>!b.inlay&&b.role==='field'&&b.cy>plan.band!.from&&b.cy<plan.band!.to),`${label}: every field board in its rows, and only those, is the band`);
      ok(new Set(mine.map(b=>Math.round(b.cy*100))).size===plan.band.boards&&plan.edgeFt===0,`${label}: exactly ${plan.band.boards} rows, and no fitted edge`);
    }else{
      ok(level.boards.filter(b=>!b.inlay).every(b=>polyArea(polygonCut([boardOutline(b,bw)],plan.pieces))<1),`${label}: field, border and breaker boards stop at the band`);
      ok(Math.abs(area(level)-area(m0.levels[0]))<area(m0.levels[0])*.03,`${label}: the decked area is unchanged but for the joints`);
      ok(plan.edgeFt>0,`${label}: its length is a fitted edge`);
    }
    if(direction==='along'){
      // A breaker's build-up joists under it: two under each band board and one under each outer joint.
      const xs=bandBuildUps([plan],bw,gap).map(x=>x+level.offset.x);
      ok(xs.length===2*plan.band.boards+2&&xs.every(x=>level.joists.some(j=>Math.abs(j.a.x-x)<.01)),`${label}: sits on its build-up joists`);
      ok(level.breakers.every(x=>x+bw/2<=plan.band!.from-(bw+gap)+.01||x-bw/2>=plan.band!.to+(bw+gap)-.01),`${label}: no breaker within a board of it`);
    }
    if(direction==='across'&&!rows)for(const piece of plan.pieces)for(const e of edgesOf(piece))if(Math.abs(Math.sin(e.deg*Math.PI/180))<.05&&(Math.abs(e.a.y-plan.band.from)<.5||Math.abs(e.a.y-plan.band.to)<.5)){
      let missed=0;const len=e.len,n=Math.max(2,Math.floor(len/3));
      for(let i=1;i<n;i++){const t=i/n;if(t*len<2||(1-t)*len<2)continue;const x=e.a.x+(e.b.x-e.a.x)*t-e.n.x*gap/2+level.offset.x,z=e.a.y+(e.b.y-e.a.y)*t-e.n.y*gap/2+level.offset.z;if(!onJoist(x,z,level)&&!level.blocking.some(m=>m.role==='inlay-edge'&&segDist(x,z,m)<1))missed++;}
      ok(missed===0,`${label}: the joint along the band has framing under it all along (${missed} gaps)`);
    }
    const loose=looseEnds(level,plan.pieces,bw);
    ok(loose===0,`${label}: every board end at the band rests on framing (${loose} loose)`);
  }else{
    // A medallion: 16 sides, a one-row frame, and solid blocking at 6 in centres over it and a board around it.
    ok(plan.outline.length===16&&plan.quote&&plan.solid,`${label}: a 16-sided medallion with solid blocking and a quoted labour line`);
    ok(level.boards.filter(b=>!b.inlay).every(b=>polyArea(polygonCut([boardOutline(b,bw)],[plan.outline]))<1),`${label}: field, border and breaker boards stop at the medallion`);
    const compass=inlay.kind==='medallion'&&inlay.style==='compass';
    // Inside the frame: a compass's wedge boards run eight ways, alternate wedges in the frame colour.
    const inside=mine.filter(b=>polyArea(polygonCut([boardOutline(b,bw)],[plan.inner],true))<1);
    ok(compass?new Set(inside.map(b=>Math.round(b.angleDeg))).size===8&&inside.some(b=>b.role==='inlay-frame')&&inside.some(b=>b.role==='inlay-fill'):inside.length>0&&inside.every(b=>b.role==='inlay-fill'&&Math.abs(Math.cos(b.angleDeg*Math.PI/180))<1e-6),`${label}: ${compass?'eight wedges, alternate ones in the frame colour':'the inside runs front to back'}`);
    const rungs=level.blocking.filter(m=>m.role==='inlay-solid'),zs=[...new Set(rungs.map(m=>Math.round(m.a.z*10)/10))].sort((a,b)=>a-b),sb=box(plan.solid!);
    ok(zs.length>1&&zs.every((z,i)=>i===0||z-zs[i-1]<=6.01)&&zs[0]-level.offset.z-sb.y0<=3.01&&sb.y1-(zs.at(-1)!-level.offset.z)<=6.01,`${label}: rungs at 6 in centres from edge to edge of the solid blocking`);
    // Along each rung, blocking (or a joist) under the whole width of the solid area.
    let gaps=0;
    for(const z of zs){const y=z-level.offset.z,xs:number[]=[];plan.solid!.forEach((a,i)=>{const b=plan.solid![(i+1)%plan.solid!.length];if((a.y<=y&&b.y>y)||(b.y<=y&&a.y>y))xs.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));});xs.sort((p,q)=>p-q);
      for(let x=(xs[0]??0)+1;x<(xs[1]??0)-1;x+=3){const wx=x+level.offset.x;if(!level.joists.some(j=>Math.abs(j.a.x-wx)<1)&&!rungs.some(m=>Math.abs(m.a.z-z)<.1&&wx>=Math.min(m.a.x,m.b.x)-.01&&wx<=Math.max(m.a.x,m.b.x)+.01))gaps++;}}
    ok(gaps===0,`${label}: each rung runs the full width of the solid blocking (${gaps} gaps)`);
    const loose=looseEnds(level,[plan.outline],bw,p=>inSolidInlay(level,p.x,p.y));
    ok(loose===0,`${label}: every board end at the medallion rests on framing or its solid blocking (${loose} loose)`);
    ok(!level.blocking.some(m=>m.role==='board-end'&&inSolidInlay(level,m.a.x-level.offset.x,m.a.z-level.offset.z)&&inSolidInlay(level,m.b.x-level.offset.x,m.b.z-level.offset.z)),`${label}: no extra board-end blocks inside the solid blocking`);
  }
}
{
  // A one-board band running front to back gets exactly a breaker's four build-up joists; one on a breaker takes its place.
  const d=base({inlays:[band({atFt:-4})]}),m=buildDeckTakeoff(d),p=m.levels[0].inlays![0],mid=p.band!.to-d.boardWidth/2+m.levels[0].offset.x;
  ok([-2.8125,-.9375,.9375,2.8125].every(k=>m.levels[0].joists.some(j=>Math.abs(j.a.x-(mid+k))<.001)),'A one-board band sits on a breaker\'s four build-up joists (±0.94 and ±2.81 in)');
  const plain=buildDeckTakeoff(base()),centred=buildDeckTakeoff(base({inlays:[band()]}));
  ok(plain.levels[0].breakers.length===1&&centred.levels[0].breakers.length===0&&m.levels[0].breakers.length===1,'A band on the breaker takes its place; one clear of it leaves it');
  const fieldPieces=(t:typeof m)=>t.levels[0].boards.filter(b=>b.role==='field').length;
  ok(fieldPieces(centred)===fieldPieces(plain)&&centred.levels[0].boards.filter(b=>b.role==='field').every(b=>b.length<=m.stockLength+.01),'With the band in the breaker’s place, the field boards run to it as they ran to the breaker: no extra joints');
}
{
  // Wherever a band is asked to go, a built band has a full board of field beside it (a full row, across a straight deck).
  for(const [label,patch] of [['a straight deck',{}],['a diagonal deck',{pattern:'Diagonal'}],['a picture-frame deck',{pattern:'Picture Frame',pictureFrameRows:1}]] as [string,Partial<DeckData>][]){
    const d=base(patch),m=buildDeckTakeoff(d),ctx=levelInlayContext(d,m.levels[0]),pitch=d.boardWidth+m.gap,fb=box(ctx.fieldPolygons.flat());
    for(const direction of ['across','along'] as const)for(const boards of [1,3] as const){
      let built=0,tight=0;
      for(let at=-12;at<=12;at+=.25){const p=planInlays([band({direction,boards,atFt:at})],ctx)[0];if(p.status!=='ok')continue;built++;
        const lo=direction==='across'?fb.y0:fb.x0,hi=direction==='across'?fb.y1:fb.x1;if(p.band!.from-lo<pitch-.01||hi-p.band!.to<pitch-.01)tight++;}
      ok(built>0&&tight===0,`On ${label}, a ${boards}-board band ${direction} is built only with a full board beside it (${built} places built, ${tight} too close)`);
    }
  }
}

// 4. Placement rules: an inlay that breaks one is not built, is kept, and the design says why.
for(const [label,patch,status] of [
  ['one past the field',{inlays:[rug({widthFt:20})]},'outside'],
  ['one over another',{inlays:[rug(),rug({id:'b',dxFt:2})]},'overlap'],
  ['one too small for its frame',{inlays:[rug({widthFt:2,depthFt:2,frameRows:2})]},'small'],
  ['one with the centre stripe on',{hasInlay:true,inlayLf:8,inlays:[rug()]},'blocked'],
  ['a band against the deck\'s edge',{inlays:[band({atFt:9.5})]},'outside'],
  ['a band across a rug',{inlays:[rug(),band({id:'c',direction:'across',boards:2})]},'overlap'],
  ['a band beside an inside corner',{shape:'L-Shape',width:24,length:16,cutoutWidth:8,cutoutLength:6,inlays:[band({atFt:3.6})]},'outside'],
  ['a medallion past the field',{inlays:[medallion({diameterFt:10,dyFt:4})]},'outside'],
  ['a medallion over a band',{inlays:[band({boards:2}),medallion({id:'n'})]},'overlap'],
] as [string,Partial<DeckData>,string][]){
  const d=base(patch),m=buildDeckTakeoff(d),plans=m.levels[0].inlays!,last=plans.at(-1)!;
  ok(last.status===status&&m.levels[0].boards.filter(b=>b.inlay===last.id).length===0,`${label}: not built (${status}; got ${last.status})`);
  ok(m.issues.some(s=>s.includes('is not built:')),`${label}: the design says why`);
  ok(validateDesign(d).inlays?.length===d.inlays!.length,`${label}: kept in the design`);
}
{
  const d=base({wrap:{left:{widthFt:8,runFt:12}},inlays:[rug()]}),m=buildDeckTakeoff(d);
  ok(!m.levels[0].inlays&&m.levels[0].boards.every(b=>!b.inlay)&&m.issues.some(s=>s.includes('not built on a wrap-around deck')),'Inlays are not built on a wrap-around deck, and it says so');
}

// 5. Fit to deck: moved toward the middle, then made smaller, until it fits; never moved onto another inlay.
{
  const d=base(),m=buildDeckTakeoff(d),ctx=levelInlayContext(d,m.levels[0]);
  const big=fitInlay(rug({widthFt:20,depthFt:13}),[],ctx) as Framed;ok(big&&big.widthFt<20&&planInlays([big],ctx)[0].status==='ok','A too-big inlay is made smaller until it fits');
  const off=fitInlay(rug({dxFt:9}),[],ctx) as Framed;ok(off&&Math.abs(off.dxFt??0)<9&&off.widthFt===6&&planInlays([off],ctx)[0].status==='ok','An inlay past the edge is moved toward the middle before it is made smaller');
  const other=rug(),second=fitInlay(rug({id:'b',dxFt:2}),[other],ctx) as Framed;ok(second&&second.widthFt===6&&planInlays([other,second],ctx)[1].status==='ok','A second inlay goes to the nearest free spot beside the first, at its own size');
  const full=fitInlay(rug({id:'c',widthFt:18,depthFt:11}),[rug({widthFt:18,depthFt:11})],ctx);ok(full===null,'An inlay with no room anywhere is not placed');
  const edge=fitInlay(band({atFt:9.5}),[],ctx) as Band;ok(edge&&edge.boards===1&&Math.abs(edge.atFt??0)<9.5&&planInlays([edge],ctx)[0].status==='ok','A band against the edge is moved in, at its width');
  const bigM=fitInlay(medallion({diameterFt:10,dyFt:4}),[],ctx) as Medallion;ok(bigM&&planInlays([bigM],ctx)[0].status==='ok','A medallion past the field is moved in, then made smaller, until it fits');
  const crossed=fitInlay(band({id:'c',direction:'across',boards:2}),[rug()],ctx) as Band;ok(crossed&&planInlays([rug(),crossed],ctx)[1].status==='ok','A band is moved clear of the inlays already there');
}

// 6. Saving: validated and bounded.
{
  const good=base({inlays:[rug({dxFt:1.5,dyFt:-1,frameRows:2,pattern:'Diagonal',frame:'tt_prime_plus:Dark Cocoa'}),diamond({level:1}),band({id:'e',direction:'across',boards:3,atFt:-2,fill:'tt_prime_plus:Dark Cocoa'}),medallion({id:'f',style:'round',diameterFt:4.5,dxFt:3,frame:'tt_prime_plus:Dark Cocoa'})]});
  const back=validateDesign(JSON.parse(serializeDesign(good)).configuration);
  assert.deepStrictEqual(back.inlays,[rug({dxFt:1.5,dyFt:-1,frameRows:2,pattern:'Diagonal',frame:'tt_prime_plus:Dark Cocoa'}),diamond(),band({id:'e',direction:'across',boards:3,atFt:-2,fill:'tt_prime_plus:Dark Cocoa'}),medallion({id:'f',style:'round',diameterFt:4.5,dxFt:3,frame:'tt_prime_plus:Dark Cocoa'})],'Inlays of every kind survive a round trip, with defaults left out');checks++;
  for(const [label,bad] of [['an unknown kind',{...rug(),kind:'star'}],['a bad id',{...rug(),id:'Bad Id'}],['a rug past 20 ft',rug({widthFt:21})],['a diamond past 14 ft',diamond({widthFt:15,depthFt:15})],['a far position',rug({dxFt:31})],['three frame rows',{...rug(),frameRows:3}],['an unknown colour',rug({fill:'nope:Red'})],['an unknown pattern',{...rug(),pattern:'Chevron'}],
    ['a five-board band',{...band(),boards:5}],['a half-board band',{...band(),boards:1.5}],['a band with no direction',{...band(),direction:'up'}],['a far band',band({atFt:31})],['a medallion past 10 ft',medallion({diameterFt:11})],['a medallion under 3 ft',medallion({diameterFt:2.5})],['an unknown medallion style',{...medallion(),style:'star'}]] as [string,unknown][])
    assert.throws(()=>validateDesign({...base(),inlays:[bad]}),undefined,`Rejects ${label}`),checks++;
  assert.throws(()=>validateDesign({...base(),inlays:[rug(),rug()]}),undefined,'Rejects a repeated id');checks++;
  assert.throws(()=>validateDesign({...base(),inlays:Array.from({length:INLAY_LIMITS.max+1},(_,i)=>rug({id:`i${i}`}))}),undefined,'Rejects too many inlays');checks++;
}

// 7. Labour: the breaker rate on each frame's fitted edge (and each cut-in band) plus the inside's pattern factor,
// exactly; a band of recoloured rows adds none; a medallion's is a builder quote.
{
  // The default deck has no labour multipliers (rectangle, straight, low, standard site, spring, aluminum).
  const plain=price(base()),labourItem=(e:typeof plain)=>e.sections.find(s=>s.title.startsWith('Labour'))!,labour=(e:typeof plain)=>labourItem(e).items[0].cost as number;
  const d=base({inlays:[rug({pattern:'Herringbone'})]}),e=price(d),plans=e.model.levels.flatMap(l=>l.inlays??[]),days=inlayCrewDays(plans,'Straight',320);
  ok(Math.abs(days.edge-plans[0].edgeFt/10*1.5/8)<1e-9,'Fitted edge: 1.5 crew-hours per 10 ft of the frame\'s outline');
  ok(Math.abs(days.inside-(1.3-1)*plans[0].fillSqft/320)<1e-9,'Herringbone inside: its ×1.30 factor on the inside\'s share of the decking labour');
  ok(Math.abs(labour(e)-labour(plain)-days.total*3700)<.01,'The inlay adds exactly its crew-days at $3,700 a day');
  const diag=base({pattern:'Diagonal'}),dd=base({pattern:'Diagonal',inlays:[rug({pattern:'Herringbone'})]}),ed=price(dd),dayd=inlayCrewDays(ed.model.levels.flatMap(l=>l.inlays??[]),'Diagonal',320);
  ok(Math.abs(labour(ed)-labour(price(diag))-dayd.total*1.2*3700)<.01&&Math.abs(dayd.inside-(1.3/1.2-1)*ed.model.levels[0].inlays![0].fillSqft/320)<1e-9,'On a diagonal deck the inside pays only the difference, under the deck\'s own multipliers');
  const straightIn=price(base({pattern:'Herringbone',inlays:[rug()]})),daysS=inlayCrewDays(straightIn.model.levels.flatMap(l=>l.inlays??[]),'Herringbone',320);
  ok(daysS.inside===0,'A plainer inside never lowers the labour');
  ok(e.sections.find(s=>s.title.startsWith('Labour'))!.items[0].spec.includes('crew-days for inlays'),'The labour line says how much is for inlays');
  // A band cut in off the breaker: its length at the breaker rate. One on the breaker: the breaker's labour goes.
  const off=price(base({inlays:[band({atFt:-4})]})),offPlan=off.model.levels[0].inlays![0];
  ok(Math.abs(labour(off)-labour(plain)-offPlan.edgeFt/10*1.5/8*3700)<.01&&Math.abs(offPlan.edgeFt-(box(offPlan.pieces[0]).y1-box(offPlan.pieces[0]).y0)/12)<1e-9,'A band running front to back: its length at the breaker rate, 1.5 crew-hours per 10 ft');
  const on=price(base({inlays:[band()]})),onPlan=on.model.levels[0].inlays![0],breakerDays=plain.model.levels[0].footprint.bounds.h/120*1.5/8;
  ok(Math.abs(labour(on)-labour(plain)-(onPlan.edgeFt/10*1.5/8-breakerDays)*3700)<.01,'A band in a breaker\'s place is charged instead of that breaker');
  const rows=price(base({inlays:[band({direction:'across',boards:2})]}));
  ok(labour(rows)===labour(plain)&&!labourItem(rows).items[0].spec.includes('for inlays'),'A band of recoloured rows adds no labour');
  const across=price(base({pattern:'Diagonal',inlays:[band({direction:'across',boards:2})]})),acrossPlan=across.model.levels[0].inlays![0];
  ok(Math.abs(labour(across)-labour(price(diag))-acrossPlan.edgeFt/10*1.5/8*1.2*3700)<.01&&acrossPlan.edgeFt>0,'A band cut in across a diagonal deck: its length at the breaker rate, under the deck\'s multipliers');
  const med=price(base({inlays:[medallion()]})),row=labourItem(med).items.find(i=>i.name==='Medallion inlay labour');
  ok(labour(med)===labour(plain)&&row&&row.cost===null&&row.qty===1&&labourItem(med).quoteRequired&&med.quoteRequired.includes('Medallion inlay labour (builder quote)'),'A medallion adds a builder-quote labour line, never $0, and no crew-days');
  ok(unconfirmedRates().some(r=>r.id==='medallion-labour'&&r.status==='owner-decision')&&unconfirmedRates().some(r=>r.id==='inlay-labour'&&r.value.includes('band')),'The rate register lists the medallion labour decision, and bands under the reused rate');
}

// 8. Stock: inlay boards are their own order, at the allowance of what they are.
{
  const d=base({inlays:[rug({pattern:'Herringbone',frame:'tt_prime_plus:Dark Cocoa'})]}),e=price(d),s=e.sections.find(x=>x.title==='Accent colours & inlays')!;
  ok(s&&s.items.some(i=>i.name==='Inlay frame · TimberTech EDGE Prime+ · Dark Cocoa')&&s.items.some(i=>i.name==='Inlay inside, herringbone · TimberTech EDGE Prime+ · Coconut Husk'),'The frame and the inside are ordered as their own boards, in their colours');
  const frameRow=e.stockSchedule.find(r=>r.name.startsWith('Inlay frame'))!,cuts=frameRow.cutsIn.flat().reduce((n,c)=>n+c,0)/12;
  ok(frameRow.orderedPieces>=Math.ceil(cuts*1.22/16),'The frame carries the picture-frame waste allowance (×1.22)');
  const inlayPieces=e.model.levels[0].boards.filter(b=>b.inlay).length,main=e.stockSchedule[0].cutsIn.flat().length;
  ok(main+e.stockSchedule.filter(r=>r.name.startsWith('Inlay')).reduce((n,r)=>n+r.cutsIn.flat().length,0)===e.model.levels[0].boards.length&&inlayPieces>0,'Every deck board is ordered once: the main order or an inlay order');
  ok(s.items.every(i=>i.cost!==0),'No inlay line is priced at $0');
  const fd=base({inlays:[band({atFt:-4,fill:'tt_prime_plus:Dark Cocoa'}),medallion({dxFt:4,fill:'tt_prime_plus:Dark Cocoa'})]}),f=price(fd),fs=f.sections.find(x=>x.title==='Accent colours & inlays')!;
  ok(fs.items.some(i=>i.name==='Inlay band · TimberTech EDGE Prime+ · Dark Cocoa')&&fs.items.some(i=>i.name==='Medallion inlay · TimberTech EDGE Prime+ · Dark Cocoa')&&fs.items.some(i=>i.name==='Medallion inlay · TimberTech EDGE Prime+ · Coconut Husk'),'A band and a medallion are ordered as their own boards, the medallion in both its colours');
  const allowance=(name:string,factor:number)=>{const r=f.stockSchedule.find(x=>x.name.startsWith(name))!,lf=r.cutsIn.flat().reduce((n,c)=>n+c,0)/12;return r.orderedPieces>=Math.ceil(lf*factor/16);};
  ok(allowance('Inlay band',WASTE_FACTORS.Straight)&&allowance('Medallion inlay · TimberTech EDGE Prime+ · Dark Cocoa',WASTE_FACTORS.Herringbone),'A band carries the straight allowance and a medallion the herringbone allowance');
  ok(f.stockSchedule[0].cutsIn.flat().length+f.stockSchedule.filter(r=>/^(Inlay|Medallion)/.test(r.name)).reduce((n,r)=>n+r.cutsIn.flat().length,0)===f.model.levels[0].boards.length,'Every deck board is ordered once, with bands and medallions');
  const plan=boardFinishPlan(fd,f.model);
  ok(plan.stock.filter(g=>g.part==='medallion').every(g=>g.wasteKey==='Herringbone')&&plan.stock.filter(g=>g.part==='band').every(g=>g.wasteKey==='Straight')&&plan.stock.some(g=>g.part==='medallion')&&plan.stock.some(g=>g.part==='band'),'Medallion boards are bought at the herringbone allowance and band boards at the straight allowance');
  for(const g of plan.stock.filter(x=>x.part==='medallion'||x.part==='band')){
    const keys=new Set(g.boards.map(b=>`${b.level}:${b.index}`)),want=deckBoardStock({...f.model,levels:f.model.levels.map((l,li)=>({...l,boards:l.boards.filter((_,bi)=>keys.has(`${li}:${bi}`))}))},WASTE_FACTORS[g.wasteKey!]);
    ok(f.stockSchedule.some(r=>r.name.startsWith(`${g.part==='band'?'Inlay band':'Medallion inlay'} · ${g.material.name} · ${g.color.name}`)&&r.orderedPieces===want.orderedBoards),`The ${g.part} order in ${g.color.name} is its boards at its allowance, exactly`);
  }
  ok(fs.description.includes('Bands carry the straight-board allowance.')&&fs.description.includes('Medallions carry the herringbone allowance'),'The section says which allowance each kind carries');
}

// 9. The legacy centre stripe: unchanged until the customer replaces it with a band.
{
  const legacy=base({hasInlay:true,inlayLf:14}),m=buildDeckTakeoff(legacy);
  ok(m.levels[0].boards.some(b=>b.role==='inlay')&&!m.levels[0].inlays,'A design with the centre stripe still builds it, unchanged');
  const replaced={...legacy,...stripeToBand(legacy)},r=buildDeckTakeoff(replaced),p=r.levels[0].inlays?.[0];
  ok(!replaced.hasInlay&&replaced.inlayLf===0&&replaced.inlays?.length===1&&p?.status==='ok'&&p.band?.direction==='along'&&p.band.boards===1,'Replace with a band: one board wide, running front to back, built');
  ok(Math.abs((p!.band!.from+p!.band!.to)/2-r.levels[0].footprint.bounds.w/2)<.01&&r.levels[0].boards.every(b=>b.role!==('inlay' as string)),'The band is down the middle, where the stripe was, and the stripe is gone');
  ok(price(replaced).total!==price(legacy).total,'Replacing it re-prices the deck');
  const step=read('src/features/deckcraft/designer/steps/MaterialsStep.tsx');
  ok(/\{data\.hasInlay&&<div className="dd-legacy-stripe">/.test(step)&&step.includes('onClick={()=>update(stripeToBand(data))}>Replace with a band</button>')&&!step.includes("toggle('hasInlay','Add a decorative inlay')"),'The stripe control shows only on a design that has it, beside "Replace with a band"');
}

// 10. Words and wiring.
{
  const d=base({inlays:[rug({pattern:'Herringbone'}),diamond({dxFt:6,widthFt:3,depthFt:3})]}),e=price(d);
  ok(describeDesign(d,e).facts.includes('Inlays: a 6 × 4 ft framed rectangle with a herringbone inside; a 3 ft diamond with boards running front to back inside'),'The design facts name each built inlay');
  ok(designFeatures(d).includes('deck_inlay_rug')&&designFeatures(d).includes('deck_inlay_diamond'),'The funnel counts each inlay kind');
  const d3=base({inlays:[band({atFt:-4,boards:2}),medallion({dxFt:4.5,diameterFt:4})]}),across=base({inlays:[band({direction:'across',atFt:4}),medallion({style:'round',diameterFt:4})]});
  ok(describeDesign(d3,price(d3)).facts.includes('Inlays: a band two boards wide running front to back; a 4 ft compass medallion in eight wedges')&&describeDesign(across,price(across)).facts.includes('Inlays: a band one board wide across the deck; a 4 ft round medallion with boards running front to back inside'),'The design facts name bands and medallions');
  ok(designFeatures(d3).includes('deck_inlay_band')&&designFeatures(d3).includes('deck_inlay_medallion'),'The funnel counts bands and medallions');
  const notes=buildDeckTakeoff(d3).issues;
  ok(notes.some(s=>s.startsWith('Bands running front to back sit on doubled build-up joists'))&&notes.some(s=>s.startsWith('Medallions sit on solid blocking')),'The design notes how bands and medallions are framed');
  for(const f of ['src/features/deckcraft/lib/inlayGeometry.ts','src/features/deckcraft/inlayFraming.ts'])ok(!/from ['"]three|@react-three/.test(read(f)),`${f} does not import three.js`);
  const viewer=read('src/features/deckcraft/components/viewer3d/Deck3DViewer.tsx'),plan=read('src/features/deckcraft/ConstructionPlan.tsx'),designer=designerSource(),editor=read('src/features/deckcraft/designer/InlayEditor.tsx');
  ok(viewer.includes('name="inlay-blocking"'),'The 3D framing view draws inlay framing in its own colour');
  ok(plan.includes('Amber: inlay blocking')&&plan.includes('`Inlay ${k+1}`')&&plan.includes('p.pieces.map('),'The plan draws and names each inlay, every piece of a band, and the framing');
  ok(/lazy\(loadInlayEditor\)/.test(designer)&&read('scripts/check-deck-bundle.ts').includes('/^InlayEditor-/'),'The inlay editor loads on demand, off the page\'s first load');
  ok(['Add a framed rectangle','Add a diamond','Add a band','Add a medallion'].every(t=>editor.includes(`>${t}</button>`)),'The editor adds each kind of inlay');
  ok(read('src/features/deckcraft/constructionDetails.ts').includes('if(onInlaySupport((face?')&&read('src/features/deckcraft/constructionDetails.ts').includes('||inSolidInlay(level,fx,fz))continue;'),'Board ends on inlay framing or a medallion\'s solid blocking get no second block');
}

console.log(`DECK INLAYS OK — ${designs} framed inlay designs (${kinds.length} kinds × ${patterns.length} patterns × ${shapes.length} shapes) and ${f3Designs} band and medallion designs, placement, fit, saving, labour, stock, the legacy stripe, words and wiring; ${checks} checks.`);
