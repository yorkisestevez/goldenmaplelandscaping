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
import {activeWrap,distanceToSegment,normalizeWrap,wrapBlockers,wrapLabourFactor,wrapZones} from '../src/features/deckcraft/lib/wrapGeometry';
import {boardOutline} from '../src/features/deckcraft/lib/polygonCuts';
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
for(const [corner,wings] of Object.entries(sides))for(const boards of boardsets)for(const stairType of ['Straight','Landing','Winder'] as const)for(const height of [12,36,72])for(const even of [true,false]){
  const L=12,wing=even?L:8;
  const d=design({width:22,length:L,height,stairType,...boards,houseConfig:house(26,22),wrap:(sides as Record<string,(w:number,r:number)=>DeckData['wrap']>)[corner](wing,10),stairPosition:'Front'});
  const tag=`${corner} ${boards.pattern}/${boards.pictureFrameRows} ${stairType} ${height}in ${even?'45°':'uneven'}`;
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
    for(const h of hips){const s=(p:PlanPoint)=>(h.b.x-h.a.x)*(p.y-h.a.y)-(h.b.y-h.a.y)*(p.x-h.a.x),poly=boardOutline(b,d.boardWidth),signs=poly.map(s).filter(v=>Math.abs(v)>1e-3*Math.hypot(h.b.x-h.a.x,h.b.y-h.a.y));assert(signs.every(v=>v>0)||signs.every(v=>v<0),`${tag}: no board crosses the ${h.side} hip`);}
  }
  checks++;
  const finished=l.deckingFootprint!.outline,polys=l.boards.map(b=>boardOutline(b,d.boardWidth)),xs=finished.map(p=>p.x),ys=finished.map(p=>p.y);
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
console.log(`DECK WRAP OK — ${cases} wrap designs, ${checks} outline, ledger, hip, joist-bearing, board, stair, price and persistence checks.`);
