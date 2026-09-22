import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff,type Member} from '../src/features/deckcraft/deckTakeoff';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {getHardwareLayout} from '../src/features/deckcraft/hardwareLayout';
import {getHouseContact} from '../src/features/deckcraft/houseContact';
import {getHousePlacement} from '../src/features/deckcraft/housePlacement';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {unsupportedJoistEnds} from '../src/features/deckcraft/constructionDetails';
import {doubledMemberSpanIn} from '../src/features/deckcraft/zoneFraming';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {activeWrap,describeWrap,distanceToSegment,normalizeWrap,porchStairForDoor,wrapBlockers,wrapLabourFactor,wrapZones,WRAP_PORCH_GAP_IN} from '../src/features/deckcraft/lib/wrapGeometry';
import {boardOutline,polygonCut} from '../src/features/deckcraft/lib/polygonCuts';
import {getHouseBlocks,rectPolygon} from '../src/features/deckcraft/houseFootprint';
import {catalogueAccessoryLayout} from '../src/features/deckcraft/catalogueAccessories';
import {deckExportMeshes,exportDeckDXF,exportDeckOBJ} from '../src/features/deckcraft/designExports';
import type {PlanPoint} from '../src/features/deckcraft/lib/deckGeometry';
import type {DeckData} from '../src/features/deckcraft/types';

let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const base=():DeckData=>structuredClone(DEFAULT_DECK);
const house=(widthFt:number,depthFt:number)=>({...getHouseConfig({...base(),width:20}),widthFt,depthFt});
const design=(patch:Partial<DeckData>):DeckData=>deckReleaseData({...base(),...patch});
const area=(p:PlanPoint[])=>p.reduce((n,v,i)=>{const q=p[(i+1)%p.length];return n+v.x*q.y-q.x*v.y;},0)/2;
const len=(m:Member)=>Math.hypot(m.b.x-m.a.x,m.b.y-m.a.y,m.b.z-m.a.z);
const plan=(v:{x:number;z:number})=>({x:v.x,y:v.z});
function crosses(p:PlanPoint,q:PlanPoint,a:PlanPoint,b:PlanPoint){const d=(u:PlanPoint,v:PlanPoint,w:PlanPoint)=>(v.x-u.x)*(w.y-u.y)-(v.y-u.y)*(w.x-u.x);return d(p,q,a)*d(p,q,b)<-1e-9&&d(a,b,p)*d(a,b,q)<-1e-9;}
function inside(p:PlanPoint,poly:PlanPoint[]){let odd=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)odd=!odd;}return odd;}
const nearPoly=(p:PlanPoint,poly:PlanPoint[],tol:number)=>inside(p,poly)||poly.some((a,i)=>distanceToSegment(p,a,poly[(i+1)%poly.length])<=tol);

// 1. Matrix: corners × board layouts × stairs × heights × equal/uneven wings.
const sides={left:(w:number,r:number)=>({left:{widthFt:w,runFt:r}}),right:(w:number,r:number)=>({right:{widthFt:w,runFt:r}}),both:(w:number,r:number)=>({left:{widthFt:w,runFt:r},right:{widthFt:w+4,runFt:r+2}})};
const boardsets=[{pattern:'Straight' as const,pictureFrameRows:0 as const},{pattern:'Straight' as const,pictureFrameRows:1 as const},{pattern:'Straight' as const,pictureFrameRows:2 as const},{pattern:'Picture Frame' as const,pictureFrameRows:0 as const}];
let cases=0;
/** Every structural, board, ledger and house-clearance check for one wrap design. */
function checkWrap(d:DeckData,tag:string){
  const height=d.height;
  const wrap=activeWrap(d)!;assert(wrap,`${tag}: wrap is active`);
  const m=buildDeckTakeoff(d),l=m.levels[0],fp=l.footprint,contact=getHouseContact(d,fp),hips=l.hips!;
  // Outline and zones.
  const o=fp.outline;
  ok(area(o)>0&&!o.some((a,i)=>o.some((c,j)=>j>i+1&&!(i===0&&j===o.length-1)&&crosses(a,o[(i+1)%o.length],c,o[(j+1)%o.length]))),`${tag}: the outline is a simple polygon`);
  ok(Math.abs(wrapZones(wrap).reduce((n,z)=>n+area(z.outline),0)-area(o))<1e-6,`${tag}: the zones add up to the outline`);
  // Ledgers and bolts.
  const walls=new Set(contact.contacts.map(c=>c.wall));
  ok(walls.has('front')&&(!wrap.left||walls.has('left'))&&(!wrap.right||walls.has('right')),`${tag}: a ledger on the deck-facing wall and each wrapped side wall`);
  ok(Math.abs(contact.ledgerLf*12-contact.contacts.reduce((n,c)=>n+c.lengthIn,0))<1e-4,`${tag}: ledger length is the sum of the contacts`);
  ok(getHardwareLayout(d,m).ledgerBolts.length===contact.contacts.reduce((n,c)=>n+Math.ceil(c.lengthIn/12-1e-9),0),`${tag}: one ledger bolt per foot of each ledger`);
  // Framing: every joist end bears, every span fits the joist table.
  ok(unsupportedJoistEnds(l,contact).length===0,`${tag}: every joist end bears on a ledger, hip or beam`);
  const jSpan=l.reference.jSpan*12+1,beams=l.beams.filter(b=>b.role!=='hip');
  for(const j of l.joists){
    const k=Math.abs(j.b.z-j.a.z)<1e-6?'x':'z',c=k==='z'?'x':'z',lo=Math.min(j.a[k],j.b[k]),hi=Math.max(j.a[k],j.b[k]);
    const stops=[...beams.filter(b=>Math.abs(b.a[k]-b.b[k])<1e-6&&j.a[c]>=Math.min(b.a[c],b.b[c])-.1&&j.a[c]<=Math.max(b.a[c],b.b[c])+.1&&b.a[k]>lo-1&&b.a[k]<hi+1).map(b=>b.a[k]),...[j.a,j.b].filter(p=>contact.onContact(plan(p),plan(p))||hips.some(h=>distanceToSegment(plan(p),h.a,h.b)<2)).map(p=>p[k])].sort((a,b)=>a-b);
    for(let i=0;i+1<stops.length;i++)assert(stops[i+1]-stops[i]<=jSpan,`${tag}: joist span ${(stops[i+1]-stops[i]).toFixed(1)} in exceeds the table`);
  }
  checks++;
  // Hips: two plies from the house corner to the outside corner, spliced only on posts, spans within the table.
  const hipMax=doubledMemberSpanIn({top:height,spacing:d.joistSpacing,framingSize:d.framingSize,joistDepth:9.25,pictureFrame:false})+1;
  for(const h of hips){
    const total=Math.hypot(h.b.x-h.a.x,h.b.y-h.a.y),pieces=l.beams.filter(b=>b.role==='hip'&&distanceToSegment(plan(b.a),h.a,h.b)<1&&distanceToSegment(plan(b.b),h.a,h.b)<1);
    ok(Math.abs(pieces.reduce((n,b)=>n+len(b),0)-2*total)<.01,`${tag}: the ${h.side} hip is two full-length plies`);
    ok(pieces.every(b=>(!b.spliceEnd||l.supports.some(p=>Math.hypot(p.x-b.b.x,p.z-b.b.z)<2))),`${tag}: hip splices sit on posts`);
    const along=(p:{x:number;z:number})=>((p.x-h.a.x)*(h.b.x-h.a.x)+(p.z-h.a.y)*(h.b.y-h.a.y))/total;
    const bearings=[0,...l.supports.filter(p=>distanceToSegment(plan(p),h.a,h.b)<1.5).map(along)].sort((a,b)=>a-b);
    ok(bearings.every((t,i)=>i===0||t-bearings[i-1]<=hipMax),`${tag}: every ${h.side} hip span is within the two-ply span table`);
    ok(total-bearings.at(-1)!<=l.reference.cant*12*Math.SQRT2+1,`${tag}: the ${h.side} hip overhangs its last post by no more than the cantilever allowance`);
    const junctions=beams.flatMap(b=>[b.a,b.b]).filter(p=>distanceToSegment(plan(p),h.a,h.b)<2);
    ok(junctions.every(p=>l.supports.some(s=>Math.hypot(s.x-p.x,s.z-p.z)<3)),`${tag}: a post under every beam that meets the ${h.side} hip`);
  }
  ok([...l.joists,...l.beams,...l.blocking,...(l.rim??[])].every(mm=>len(mm)<=192.001),`${tag}: no member is longer than 16 ft stock`);
  // Boards: parallel to their zone's house wall, never across a hip, and the deck is covered.
  const zones=l.wrapZones!,field=l.boards.filter(b=>b.role==='field');
  for(const b of field){
    const c={x:b.cx,y:b.cy},zone=zones.find(z=>inside(c,z.outline))??zones.find(z=>nearPoly(c,z.outline,3));
    assert(zone,`${tag}: field board at ${c.x.toFixed(1)},${c.y.toFixed(1)} sits in a zone`);
    const wantAlongX=Math.abs(zone.joistDir.y)>.5;
    assert(wantAlongX?Math.abs(b.angleDeg)<1e-6:Math.abs(Math.abs(b.angleDeg)-90)<1e-6,`${tag}: ${zone.label} boards run parallel to its house wall`);
    for(const h of hips){const s=(p:PlanPoint)=>(h.b.x-h.a.x)*(p.y-h.a.y)-(h.b.y-h.a.y)*(p.x-h.a.x),poly=boardOutline(b,d.boardWidth);if(!poly.some(v=>distanceToSegment(v,h.a,h.b)<12))continue;const signs=poly.map(s).filter(v=>Math.abs(v)>1e-3*Math.hypot(h.b.x-h.a.x,h.b.y-h.a.y));assert(signs.every(v=>v>0)||signs.every(v=>v<0),`${tag}: no board crosses the ${h.side} ${h.corner} hip`);}
  }
  checks++;
  const finished=l.deckingFootprint!.outline,polys=l.boards.map(b=>boardOutline(b,d.boardWidth)),xs=finished.map(p=>p.x),ys=finished.map(p=>p.y);
  ok(polys.reduce((n,p)=>n+Math.abs(area(p)),0)<=Math.abs(area(finished))+1,`${tag}: no two boards overlap (board area within the deck area)`);
  let probes=0,missed=0;
  for(let x=Math.min(...xs)+3;x<Math.max(...xs);x+=7)for(let y=Math.min(...ys)+3;y<Math.max(...ys);y+=7){
    const p={x,y};if(!inside(p,finished)||finished.some((a,i)=>distanceToSegment(p,a,finished[(i+1)%finished.length])<1))continue;
    probes++;if(!polys.some(poly=>nearPoly(p,poly,m.gap+.02)))missed++;
  }
  ok(probes>50&&missed===0,`${tag}: decking covers the deck (${missed} of ${probes} probes uncovered)`);
  // Railing, stairs and border stay off the house.
  ok(!m.railing.rails.some(r=>contact.onContact(plan(r.a),plan(r.b))),`${tag}: no railing along a ledger`);
  const {x0,x1,depthIn}=getHousePlacement(d),inHouse=(p:PlanPoint)=>p.x>x0+.5&&p.x<x1-.5&&p.y<-.5&&p.y>-depthIn+.5;
  ok(!finished.some(inHouse)&&!polys.flat().some(inHouse)&&!m.treads.some(t=>inHouse({x:t.x,y:t.z})),`${tag}: no deck, border or stair inside the house`);
  cases++;
}
for(const [corner,wings] of Object.entries(sides))for(const boards of boardsets)for(const stairType of ['Straight','Landing','Winder'] as const)for(const height of [12,36,72])for(const even of [true,false]){
  const L=12,wing=even?L:8;
  const d=design({width:22,length:L,height,stairType,...boards,houseConfig:house(26,22),wrap:(sides as Record<string,(w:number,r:number)=>DeckData['wrap']>)[corner](wing,10),stairPosition:'Front'});
  const tag=`${corner} ${boards.pattern}/${boards.pictureFrameRows} ${stairType} ${height}in ${even?'45°':'uneven'}`;
  checkWrap(d,tag);
}
// 1b. Porch wraps: each porch continues its wing round a far corner along the street-side wall.
const porchSides:Record<string,(w:number)=>DeckData['wrap']>={
  'left porch':w=>({left:{widthFt:w,runFt:10},porchLeft:{depthFt:w,runFt:10}}),
  'right porch':w=>({right:{widthFt:w,runFt:10},porchRight:{depthFt:w+2,runFt:12}}),
  'both porches':w=>({left:{widthFt:w,runFt:10},right:{widthFt:w,runFt:10},porchLeft:{depthFt:w,runFt:11},porchRight:{depthFt:6,runFt:11}}),
  'wing + porch':w=>({left:{widthFt:w,runFt:8},right:{widthFt:w,runFt:10},porchRight:{depthFt:w,runFt:10}}),
};
for(const [corner,make] of Object.entries(porchSides))for(const boards of boardsets)for(const height of [12,36,72])for(const even of [true,false]){
  const d=design({width:22,length:12,height,...boards,houseConfig:house(26,22),wrap:make(even?8:6),stairPosition:'Front'});
  const tag=`${corner} ${boards.pattern}/${boards.pictureFrameRows} ${height}in ${even?'even':'uneven'}`;
  checkWrap(d,tag);
  const wrap=activeWrap(d)!,contact=getHouseContact(d,buildDeckTakeoff(d).levels[0].footprint),porches=[wrap.porchLeft,wrap.porchRight].filter(Boolean).length;
  ok(contact.contacts.filter(c=>c.wall==='far').length===porches,`${tag}: one street-side ledger per porch`);
  ok((!wrap.porchLeft||wrap.left!.runIn===wrap.houseDepthIn)&&(!wrap.porchRight||wrap.right!.runIn===wrap.houseDepthIn),`${tag}: a wing with a porch runs the full house depth`);
}
// A narrow house with wide wings that run far back: each wing's boards stay in its own wing.
checkWrap(design({length:12,height:36,houseConfig:house(12,30),wrap:{left:{widthFt:24,runFt:30},right:{widthFt:24,runFt:30}},stairPosition:'Front'}),'narrow house, wide long wings');
checkWrap(design({length:12,height:36,houseConfig:house(12,30),wrap:{left:{widthFt:24,runFt:8},right:{widthFt:24,runFt:8},porchLeft:{depthFt:10,runFt:4},porchRight:{depthFt:10,runFt:4}},stairPosition:'Front'}),'narrow house, wide wings, both porches');
{
  // Two porches never close into a ring: they stop at least 3 ft apart along the street side.
  const ring=design({width:22,length:12,houseConfig:house(26,22),wrap:{left:{widthFt:8,runFt:8},right:{widthFt:8,runFt:8},porchLeft:{depthFt:8,runFt:20},porchRight:{depthFt:8,runFt:20}}}),w=activeWrap(ring)!;
  ok((w.x1-w.porchRight!.runIn)-(w.x0+w.porchLeft!.runIn)>=WRAP_PORCH_GAP_IN-.001,'Two porches stop at least 3 ft apart (no ring round the house)');
  checkWrap(ring,'porches trimmed to stay apart');
  assert.throws(()=>validateDesign({...base(),deckType:'Attached',wrap:{porchLeft:{depthFt:8,runFt:8}}}),/add that wing first/);checks++;
  const e=calculateEstimate(ring),labour=e.sections.find(s=>s.title.startsWith('Labour'))!;
  ok(e.quoteRequired.includes('Porch-wrap labour premium (builder quote)')&&labour.quoteRequired&&labour.items.some(i=>i.cost===null&&/Porch-wrap/.test(i.name)),'Porch-wrap labour premium is a builder-quote line, never priced at zero');
  ok(wrapLabourFactor(w)===1.5,'Porch wraps price labour at the two-corner factor');
  ok(/round to the street side/.test(describeWrap(w)),'The summary says the deck wraps round to the street side');
  // Front entry: a street-side door facing a porch takes the stair straight off the porch, centred on it.
  const cfg=house(26,22),withDoor=design({width:22,length:12,height:36,houseConfig:{...cfg,openings:[...cfg.openings,{id:'street-door',type:'Door',facade:'Back',offsetPct:80,bottomIn:36,widthIn:36,heightIn:80}]},wrap:{left:{widthFt:8,runFt:8},porchLeft:{depthFt:8,runFt:14}}});
  const fit=porchStairForDoor(withDoor);
  ok(fit?.edgeId==='porchL-street','The street door faces the left porch');
  const doorX=activeWrap(withDoor)!.x1-26*12*.8,m=buildDeckTakeoff({...withDoor,stairEdgeId:fit!.edgeId,stairOffset:fit!.offsetPct});
  ok(m.flights.length>0&&Math.abs(m.flights[0].start.x-doorX)<1,'The porch stair lines up with the street door');
}

// 2. Stairs on a wing end, pricing, labour and review items.
{
  const d=design({width:22,length:12,houseConfig:house(26,22),wrap:{right:{widthFt:12,runFt:10}},stairEdgeId:'wingR-end'});
  const m=buildDeckTakeoff(d),fp=m.levels[0].footprint,i=fp.edgeIds!.indexOf('wingR-end'),a=fp.outline[i],b=fp.outline[(i+1)%fp.outline.length];
  ok(m.flights.length>0&&distanceToSegment({x:m.flights[0].start.x,y:m.flights[0].start.z},a,b)<4,'Stairs open on the chosen wing end');
  const e=calculateEstimate(d);
  ok(e.connectorSchedule.some(r=>r.name==='Skewed joist and hip hangers'&&r.rate===null&&r.qty>0)&&e.quoteRequired.includes('Skewed joist and hip hangers'),'Skewed hangers are listed for a supplier quote, never priced at zero');
  ok(e.flags.some(f=>/engineer/i.test(f)&&/hip/i.test(f)),'Wrap corners always carry an engineering-review item');
  ok(wrapLabourFactor(activeWrap(d))===1.25&&wrapLabourFactor(activeWrap(design({width:22,length:12,houseConfig:house(26,22),wrap:{left:{widthFt:8,runFt:8},right:{widthFt:8,runFt:8}}})))===1.5&&wrapLabourFactor(null)===1,'Labour reuses the Multi-corner (one corner) and Curved (two corners) factors');
  const meshes=deckExportMeshes(d,m),hipPieces=m.levels[0].beams.filter(b=>b.role==='hip').length;
  ok(hipPieces>0&&meshes.filter(x=>x.name.includes('_beam')).length>=hipPieces&&exportDeckDXF(d,m).includes('SECTION')&&/^v /m.test(exportDeckOBJ(d,m)),'DXF and OBJ exports include the wrap framing, hips included');
  const plain=design({width:22,length:12,houseConfig:house(26,22)});
  ok(e.total>calculateEstimate(plain).total&&e.area>calculateEstimate(plain).area,'A wing adds area, framing and price');
}

// 3. Two corners: the width is left wing + house + right wing; save/load keeps the wrap.
{
  const d=design({width:16,houseConfig:house(30,24),wrap:{left:{widthFt:8,runFt:12},right:{widthFt:10,runFt:6}},stairEdgeId:'wingL-end'});
  ok(d.width===48,'Deck width = 8 ft + 30 ft house + 10 ft');
  const back=parseDesign(serializeDesign(d));
  assert.deepEqual(back.wrap,d.wrap);assert.equal(back.width,48);assert.equal(back.stairEdgeId,'wingL-end');checks++;
  const wide=design({houseConfig:house(60,24),wrap:{left:{widthFt:12,runFt:8},right:{widthFt:12,runFt:8}}});
  ok(wide.width===84&&validateDesign(JSON.parse(serializeDesign(wide)).configuration).width===84,'A two-corner width beyond the 60 ft input range is derived, not rejected');
  assert.throws(()=>validateDesign({...d,wrap:{left:{widthFt:2,runFt:8}}}));assert.throws(()=>validateDesign({...d,wrap:'around'}));assert.throws(()=>validateDesign({...d,stairEdgeId:'<script>'}));checks+=3;
  ok(validateDesign({...d,stairEdgeId:'wingR-ledger'}).stairEdgeId===undefined,'A stair edge against the house is dropped');
}

// 4. A paused wrap changes nothing; incompatible settings pause it with a reason.
{
  const lShape=base();lShape.shape='L-Shape';
  const paused={...lShape,wrap:{right:{widthFt:8,runFt:8}}};
  ok(wrapBlockers(paused).length===1&&!activeWrap(paused),'An L-shape pauses the wrap');
  assert.deepEqual(buildDeckTakeoff(normalizeWrap(paused)).quantities,buildDeckTakeoff(lShape).quantities);checks++;
  ok(calculateEstimate(normalizeWrap(paused)).total===calculateEstimate(lShape).total,'A paused wrap prices exactly like the deck without it');
  for(const patch of [{deckType:'Freestanding'},{pattern:'Diagonal'},{pattern:'Herringbone'},{hasInlay:true}] as Partial<DeckData>[])ok(wrapBlockers({...base(),...patch,wrap:{left:{widthFt:8,runFt:8}}}).length===1,`Wrap paused by ${JSON.stringify(patch)}`);
  ok(wrapBlockers({...base(),levels:3,wrap:{left:{widthFt:8,runFt:8}}}).length===0,'A wrap-around can have lower levels joined to it');
}
// 5. Bump-outs on the deck-facing wall: the attached deck is notched around them, on plain, notched
// and wrap-around decks. The bump-out face is a ledger (joists hang off it); its side walls run with the
// joists and are flush walls (the outside joist is bolted to them, no hangers); the strip in front of
// the bump-out has its own beam and posts; nothing of the deck lands inside any part of the house.
let bumpCases=0;
function checkBump(d:DeckData,tag:string,bumpId='bump1'){
  const m=buildDeckTakeoff(d),l=m.levels[0],fp=l.footprint,contact=getHouseContact(d,fp),o=fp.outline,hw=getHardwareLayout(d,m);
  const blocks=getHouseBlocks(d),bump=blocks.find(b=>b.id===bumpId)!;
  ok(area(o)>0&&!o.some((a,i)=>o.some((c,j)=>j>i+1&&!(i===0&&j===o.length-1)&&crosses(a,o[(i+1)%o.length],c,o[(j+1)%o.length]))),`${tag}: the notched outline is a simple polygon`);
  if(l.zones)ok(Math.abs(l.zones.reduce((n,z)=>n+area(z.zone.outline),0)-area(o))<1e-4,`${tag}: the framing strips add up to the outline`);
  // A strip whose back edge is a bump-out face is framed (and its structure sized) from that face.
  for(const z of l.zones??[]){const ys=z.zone.outline.map(p=>p.y),back=Math.min(...ys);if(back>.5)ok(Math.abs(z.zone.origin.y-back)<1e-6&&Math.abs(z.zone.size.h-(Math.max(...ys)-back))<1e-6,`${tag}: the strip in front of the bump-out is framed from its face`);}
  // The depth cap: at least 3 ft of deck in front of the bump-out across its width.
  const fronts=o.filter(p=>p.x>bump.rect.x0-.01&&p.x<bump.rect.x1+.01&&p.y>bump.rect.y1+.01).map(p=>p.y);
  ok(!fronts.length||Math.min(...fronts)-bump.rect.y1>=36-.01,`${tag}: at least 3 ft of deck stays in front of the bump-out`);
  // Contacts: a ledger on the face, flush side walls, lengths and bolts follow them.
  const face=contact.contacts.filter(c=>c.wall===`${bumpId}-front`),flush=contact.contacts.filter(c=>c.kind==='flush');
  ok(face.length>0&&face.every(c=>c.kind==='ledger'&&c.blockId===bumpId&&Math.abs(c.a.y-bump.rect.y1)<.01),`${tag}: the bump-out face is a ledger`);
  ok(flush.length>0&&flush.every(c=>c.blockId===bumpId&&Math.abs(c.a.x-c.b.x)<.01&&(Math.abs(c.a.x-bump.rect.x0)<.01||Math.abs(c.a.x-bump.rect.x1)<.01)),`${tag}: the bump-out side walls are flush contacts`);
  const sum=(kind:string)=>contact.contacts.filter(c=>c.kind===kind).reduce((n,c)=>n+c.lengthIn,0);
  ok(Math.abs(contact.ledgerLf*12-sum('ledger'))<1e-4&&Math.abs(contact.flushLf*12-sum('flush'))<1e-4&&Math.abs(contact.flashingLf-contact.ledgerLf-contact.flushLf)<1e-6,`${tag}: ledger, flush-wall and flashing lengths follow the contacts`);
  ok(hw.ledgerBolts.length===contact.contacts.reduce((n,c)=>n+Math.ceil(c.lengthIn/12-1e-9),0),`${tag}: one bolt per foot of every ledger and flush wall`);
  for(const c of flush){const along=hw.ledgerBolts.filter(b=>Math.abs(b.x-(c.a.x+c.inward.x*.75))<.01&&b.z>=Math.min(c.a.y,c.b.y)&&b.z<=Math.max(c.a.y,c.b.y));ok(along.length===Math.ceil(c.lengthIn/12-1e-9),`${tag}: flush-wall bolts go through the outside joist`);}
  const flashRow=catalogueAccessoryLayout({...d,catalogueAccessories:['tt_protac_flashing']},m).rows.find(r=>r.id==='tt_protac_flashing')!;
  ok(Math.abs(flashRow.qty-Math.ceil(contact.flashingLf*10)/10)<1e-9,`${tag}: flashing runs along the ledgers and the flush walls`);
  // Joists: every end bears; ends on the face get hangers; no joist ends on a flush wall.
  ok(unsupportedJoistEnds(l,contact).length===0,`${tag}: every joist end bears on a ledger, hip or beam`);
  const ends=l.joists.flatMap(j=>[j.a,j.b]).map(plan);
  const onFace=ends.filter(p=>face.some(c=>Math.abs(p.y-c.a.y)<.5&&p.x>Math.min(c.a.x,c.b.x)-.5&&p.x<Math.max(c.a.x,c.b.x)+.5));
  ok(onFace.length>0&&onFace.every(p=>hw.hangers.some(h=>Math.hypot(h.x-p.x,h.z-p.y)<.1)),`${tag}: joists hang off the bump-out face on hangers`);
  ok(!ends.some(p=>flush.some(c=>{const t=p.y-Math.min(c.a.y,c.b.y);return Math.abs(p.x-c.a.x)<1&&t>1&&t<c.lengthIn-1;})),`${tag}: no joist ends on a flush wall`);
  const jSpan=l.reference.jSpan*12+1,beams=l.beams.filter(b=>b.role!=='hip'),hips=l.hips??[];
  for(const j of l.joists){
    const k=Math.abs(j.b.z-j.a.z)<1e-6?'x':'z',c=k==='z'?'x':'z',lo=Math.min(j.a[k],j.b[k]),hi=Math.max(j.a[k],j.b[k]);
    const stops=[...beams.filter(b=>Math.abs(b.a[k]-b.b[k])<1e-6&&j.a[c]>=Math.min(b.a[c],b.b[c])-.1&&j.a[c]<=Math.max(b.a[c],b.b[c])+.1&&b.a[k]>lo-1&&b.a[k]<hi+1).map(b=>b.a[k]),...[j.a,j.b].filter(p=>contact.onContact(plan(p),plan(p))||hips.some(h=>distanceToSegment(plan(p),h.a,h.b)<2)).map(p=>p[k])].sort((a,b)=>a-b);
    for(let i=0;i+1<stops.length;i++)assert(stops[i+1]-stops[i]<=jSpan,`${tag}: joist span ${(stops[i+1]-stops[i]).toFixed(1)} in exceeds the table`);
  }
  checks++;
  // Beams: every beam end that does not continue into another piece sits over a post (end-post rule).
  for(const b of beams)for(const e of [b.a,b.b]){
    if(beams.some(q=>q!==b&&[q.a,q.b].some(v=>Math.hypot(v.x-e.x,v.z-e.z)<1)))continue;
    const L=len(b)||1,u={x:(b.b.x-b.a.x)/L,z:(b.b.z-b.a.z)/L};
    assert(l.supports.some(p=>Math.abs((p.x-e.x)*u.z-(p.z-e.z)*u.x)<6&&Math.abs((p.x-e.x)*u.x+(p.z-e.z)*u.z)<=24+1e-6)||hips.some(h=>distanceToSegment(plan(e),h.a,h.b)<2),`${tag}: beam end at ${e.x.toFixed(1)},${e.z.toFixed(1)} has a post`);
  }
  checks++;
  // The strip in front of the bump-out is framed from its face: a beam row inside that strip.
  const lo=Math.max(bump.rect.x0,Math.min(...o.map(p=>p.x))),hi=Math.min(bump.rect.x1,Math.max(...o.map(p=>p.x)));
  ok(beams.some(b=>b.a.z>bump.rect.y1+.5&&Math.min(b.a.x,b.b.x)<hi-1&&Math.max(b.a.x,b.b.x)>lo+1),`${tag}: the deck in front of the bump-out has its own beam`);
  for(const z of (l.zones??[]).filter(z=>z.zone.origin.y>.5))ok(beams.some(b=>b.a.z>z.zone.origin.y+.5&&Math.min(b.a.x,b.b.x)<z.zone.origin.x+z.zone.size.w-1&&Math.max(b.a.x,b.b.x)>z.zone.origin.x+1),`${tag}: every strip framed off the bump-out face has its own beam`);
  ok([...l.joists,...l.beams,...l.blocking,...(l.rim??[])].every(mm=>len(mm)<=192.001),`${tag}: no member is longer than 16 ft stock`);
  ok(!m.railing.rails.some(r=>contact.onContact(plan(r.a),plan(r.b))),`${tag}: no railing along a ledger or flush wall`);
  // Decking covers the notched deck, and nothing of the deck lands inside any part of the house.
  const finished=l.deckingFootprint!.outline,polys=l.boards.map(b=>boardOutline(b,d.boardWidth)),xs=finished.map(p=>p.x),ys=finished.map(p=>p.y);
  ok(polys.reduce((n,p)=>n+Math.abs(area(p)),0)<=Math.abs(area(finished))+1,`${tag}: no two boards overlap`);
  let probes=0,missed=0;
  for(let x=Math.min(...xs)+3;x<Math.max(...xs);x+=7)for(let y=Math.min(...ys)+3;y<Math.max(...ys);y+=7){
    const p={x,y};if(!inside(p,finished)||finished.some((a,i)=>distanceToSegment(p,a,finished[(i+1)%finished.length])<1))continue;
    probes++;if(!polys.some(poly=>nearPoly(p,poly,m.gap+.02)))missed++;
  }
  ok(probes>50&&missed===0,`${tag}: decking covers the notched deck (${missed} of ${probes} probes uncovered)`);
  const square=(p:{x:number;z:number},h:number)=>[{x:p.x-h,y:p.z-h},{x:p.x+h,y:p.z-h},{x:p.x+h,y:p.z+h},{x:p.x-h,y:p.z+h}];
  const strip=(mm:Member)=>{const L=Math.hypot(mm.b.x-mm.a.x,mm.b.z-mm.a.z)||1,nx=-(mm.b.z-mm.a.z)/L*mm.width/2,nz=(mm.b.x-mm.a.x)/L*mm.width/2;return [{x:mm.a.x-nx,y:mm.a.z-nz},{x:mm.b.x-nx,y:mm.b.z-nz},{x:mm.b.x+nx,y:mm.b.z+nz},{x:mm.a.x+nx,y:mm.a.z+nz}];};
  const deckParts=[finished,...polys,...l.supports.map(p=>square(p,1.75)),...[...l.joists,...l.beams,...l.blocking].map(strip),...m.treads.map(t=>square({x:t.x,z:t.z},Math.min(t.w,t.d)/2-.1))].map(p=>area(p)<0?[...p].reverse():p);
  const intrusion=blocks.reduce((n,b)=>n+deckParts.reduce((k,part)=>k+polygonCut([part],[rectPolygon(b.rect)]).reduce((q,p)=>q+Math.abs(area(p)),0),0),0);
  ok(intrusion<.5,`${tag}: no deck, board, framing, post or stair inside any house block (${intrusion.toFixed(2)} sq in)`);
  bumpCases++;
}
{
  const bumps=[
    {tag:'centred',w:8,d:3,off:(hw:number)=>(hw-8)/2,plainOnly:false},
    {tag:'off-centre',w:6,d:4,off:(hw:number)=>hw/2+1,plainOnly:false},
    {tag:'shallow',w:10,d:1.5,off:(hw:number)=>(hw-10)/2,plainOnly:false},
    {tag:'capped',w:8,d:40,off:(hw:number)=>(hw-8)/2-3,plainOnly:false},
    {tag:'past-end',w:10,d:3,off:()=>3,plainOnly:true},
  ];
  const decks:[string,Partial<DeckData>][]=[
    ['rectangle',{width:16,length:12,shape:'Rectangle'}],['L-shape',{width:16,length:12,shape:'L-Shape'}],['multi-corner',{width:16,length:12,shape:'Multi-corner'}],
    ['wrap left',{width:34,length:12,wrap:{left:{widthFt:8,runFt:10}}}],['wrap right',{width:34,length:12,wrap:{right:{widthFt:8,runFt:10}}}],
    ['wrap both',{width:22,length:12,wrap:{left:{widthFt:8,runFt:10},right:{widthFt:10,runFt:12}}}],['porch',{width:34,length:12,wrap:{right:{widthFt:8,runFt:10},porchRight:{depthFt:6,runFt:10}}}],
  ];
  for(const [shape,deck] of decks)for(const bump of bumps)for(const height of [12,36,72])for(const boards of [boardsets[0],boardsets[3]]){
    if(bump.plainOnly&&deck.wrap)continue;
    const d=design({...deck,height,...boards,stairPosition:'Front',houseConfig:{...house(26,deck.wrap?22:16),footprint:{rects:[{id:'bump1',kind:'house',wall:'Front',offsetFt:bump.off(26),widthFt:bump.w,depthFt:bump.d}]}}});
    if(deck.wrap)assert(activeWrap(d),`${shape}: the wrap stays active around a bump-out clear of its corners`);
    checkBump(d,`${shape} ${bump.tag} ${boards.pattern} ${height}in`);
  }
  // A garage flush with the deck-facing wall: the deck running past the house onto it gets a ledger on
  // the garage (no house-side beam there) and the garage-ledger review item.
  const garage=design({width:30,length:12,housePlacement:{anchor:'left',offsetIn:0},houseConfig:{...house(20,16),footprint:{rects:[{id:'garage1',kind:'garage',wall:'Right',offsetFt:0,widthFt:20,depthFt:22}]}}});
  const gm=buildDeckTakeoff(garage),gc=getHouseContact(garage,gm.levels[0].footprint);
  ok(gc.contacts.some(c=>c.blockId==='garage1'&&c.kind==='ledger'&&Math.abs(c.lengthIn-120)<.01)&&Math.abs(gc.ledgerLf-30)<1e-6,'A deck running past the house onto a flush garage face is ledgered to the garage');
  ok(gm.levels[0].beams.every(b=>b.role!=='house-side-beam')&&gm.issues.some(i=>i.includes('attached garage wall')),'No house-side beam in front of the garage; the garage ledger is flagged for review');
  // Each block the deck meets is checked against its own floor.
  const sunk=design({width:16,length:12,height:36,houseConfig:{...house(26,16),floorHeightIn:37,footprint:{rects:[{id:'bump1',kind:'house',wall:'Front',offsetFt:9,widthFt:8,depthFt:3,floorHeightIn:30}]}}});
  const si=buildDeckTakeoff(sunk).issues;
  ok(si.some(i=>i.includes('above the house bump-out floor / door sill (30 in)'))&&!si.some(i=>i.includes('above the house floor / door sill')),'The door-sill check uses each contacted block\'s own floor');
  // A block away from the deck leaves it exactly as it was; a bump-out removes its area from the deck.
  const plainD=design({width:16,length:12,houseConfig:house(26,16)}),awayD=design({width:16,length:12,houseConfig:{...house(26,16),footprint:{rects:[{id:'wing1',kind:'house',wall:'Back',offsetFt:0,widthFt:10,depthFt:10}]}}});
  assert.deepEqual(buildDeckTakeoff(awayD).quantities,buildDeckTakeoff(plainD).quantities);checks++;
  const bumped=design({width:16,length:12,houseConfig:{...house(26,16),footprint:{rects:[{id:'bump1',kind:'house',wall:'Front',offsetFt:9,widthFt:8,depthFt:3}]}}});
  ok(area(buildDeckTakeoff(bumped).levels[0].footprint.outline)===area(buildDeckTakeoff(plainD).levels[0].footprint.outline)-96*36,'The notch removes exactly the bump-out area from the deck');
}

console.log(`DECK WRAP OK — ${cases} wrap designs (porch wraps included), ${bumpCases} bump-out designs, ${checks} outline, ledger, hip, joist-bearing, board, stair, price and persistence checks.`);
