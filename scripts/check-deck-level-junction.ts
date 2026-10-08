import assert from 'node:assert/strict';
// Decorative inlay geometry is lazy (lib/inlayGeometryRuntime.ts); the showcase designs with inlays need it loaded.
import '../src/features/deckcraft/lib/inlayGeometryRuntime';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {calculateEstimate,DECKING_DELIVERY_QUOTE} from '../src/features/deckcraft/calculations';
import {hasPictureFrame} from '../src/features/deckcraft/borderLighting';
import {guardRuns} from '../src/features/deckcraft/deckTakeoff';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import {claddingPlan,drawnRiserBoards} from '../src/features/deckcraft/stairCladding';
import {levelJunctions,onJunction,worldOutline} from '../src/features/deckcraft/lib/levelJunctions';
import {finishedFasciaOffset} from '../src/features/deckcraft/lib/finishedFootprint';
import {exposedRim} from '../src/features/deckcraft/houseContact';
import {skirtingPlan,newSkirting} from '../src/features/deckcraft/skirting';
import {polygonCut,signedArea} from '../src/features/deckcraft/lib/polygonCuts';
import type {DeckData} from '../src/features/deckcraft/types';
import {junctionCases,junctionPrice,newDefaultJunctionCases} from './deck-level-junction-cases';

/**
 * Multi-level decks look built (owner decision 2026-09-25): levels meet, the step between them stands on the lower
 * level, and every face between them, every stair side and every outside corner is closed.
 * - The 41d3eba baseline still guards against adding redundant railing. The authorized September 26 pricing review
 *   changes sourced supply and width-adjusted stair allowances; independent pricing checks verify those amounts.
 *   Existing pending quote scopes remain, with explicit cladding installation and paver order adjustments. Two quote
 *   lines are new since (pricing honesty, 2026-10-04): decking delivery on every design, and the stair picture-frame
 *   detail on a framed one. Both must stay unpriced quotes, never a price. Owner 2026-10-08: skirting and matched
 *   fascia boards are priced (fascia fasteners/delivery stay a quote); accent/medallion/custom-inlay labour defaults
 *   to man-hours so those builder-quote lines may drop; porch-wrap premium folds into wrapLabourFactor.
 *   The owner-approved September 28 footing correction removes crowded footings (a winder's inner posts, posts under one
 *   short beam), so footings and their post anchors may only go down from the baseline, never up.
 * - Geometry: levels touch (or keep the old spacing with a note), the step and 36 in fit on the lower level, the faces
 *   between levels are boarded outside the openings, every straight stair has stepped side panels down to the ground or
 *   the deck it stands on, the top riser sits on the rim's face, and skirting and rim corners are closed.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const near=(a:number,b:number,eps=.01)=>Math.abs(a-b)<=eps;
const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const baseline=JSON.parse(read('scripts/deck-level-junction-baseline.json')).cases as Record<string,ReturnType<typeof junctionPrice>>;
const NEW_QUOTE='Stair and level cladding (builder quote)',STAIR_FRAME_QUOTE='Stair picture-frame detail (builder / supplier quote)',REVIEW_PRICE_SECTIONS=new Set(['Railing System','Stairs','Stair and level cladding','Labour (Construction & Build)','HST (13%)','Decking','Accent-colour boards','Accent colours & inlays','Deck-part finishes','Deck skirting','in-lite® Lighting System','Yard · Paving materials, wall allowances and shared delivery']),FEWER_FOOTINGS=new Set(['Foundation & Footings','Hardware & Fasteners']),
  // Owner-approved 2026-09-28: the clean-room framing engine (structure/) sizes beams, posts and footings from public
  // Ontario sources, so its sections move either way against the 41d3eba baseline. The legacy golden pins every price.
  ENGINE_SECTIONS=(title:string)=>/^Structural Framing \(/.test(title)||FEWER_FOOTINGS.has(title),
  // Framing connectors the engine's beam layout calls for (a splice where two beam lines meet) stay builder quotes.
  ENGINE_QUOTES=new Set(['Splice fasteners']),
  // Owner 2026-10-08 priced scopes that used to be builder/supplier quotes (independent pricing checks cover the amounts).
  ALLOWED_NEW_QUOTES=new Set([NEW_QUOTE,DECKING_DELIVERY_QUOTE,'Paver packaging, colour and freight adjustments (supplier quote)','Fascia fasteners and delivery (supplier quote)',...ENGINE_QUOTES]),
  // Owner 2026-10-08: Home Depot Canada retail prices the former connector quote lines (ties, caps, angles, stringers, skewed hangers, railing post anchors, fastener sets).
  ALLOWED_DROPPED_QUOTES=new Set(['Deck skirting (builder quote)','Fascia boards (supplier quote)','Medallion inlay labour (builder quote)','Accent-colour board labour (builder quote)','Custom inlay fabrication labour (builder quote)','Porch-wrap labour premium (builder quote)','Joist-to-beam ties','Post-to-beam caps','Blocking connections','Stringer connectors','Skewed joist and hip hangers','Railing post anchors/bolts','Connector fastener sets']);
const quoteScope=(label:string)=>label.replace(/: engineering and selected system confirmation$/,': selected wall system and site design confirmation').replace(/ (?:supply and installation|installation \(builder quote\)|supply \(supplier quote\))$/,'');
const WALL_SCOPE_LABELS=['selected wall system and site design confirmation','manufacturer backing and top-course assembly confirmation','Preliminary manufacturer assembly survey and quote','Wall body stock supply','Selected cap stock supply','Wall body and cap installation','retained ground and reinforcement placement confirmation','drain outlet elevation and fall confirmation','Geogrid stock supply','Geogrid installation','Compacted leveling aggregate and placement','Drainage stone and placement','Reinforced backfill and compaction','Wall separator fabric and installation','Main perforated drain and installation','Drain outlet extension and installation','Drain outlet fittings and termination','Cap adhesive and installation','Core-fill stone, connectors and special stock','Wall packaging, freight and order adjustments','Wall survey/design services','drain outlet route and length confirmation'];
function addedYardScope(design:DeckData,label:string){return ['Soil reuse, loose spoil and hauling confirmation','Hauling and disposal price adjustments'].includes(label)||(design.yardFeatures??[]).some(f=>f.enabled&&f.kind==='retaining-wall'&&WALL_SCOPE_LABELS.some(scope=>label===`${f.name}: ${scope}`));}
const cases=junctionCases();

// 1. Prices against the baseline.
let same=0,guard=0,fallbacks=0;
for(const [name,c] of Object.entries(cases)){
  const was=baseline[name],now=junctionPrice(c.design);ok(was,`${name}: in the baseline`);
  const moved=Object.keys({...was.sections,...now.sections}).filter(t=>!near(was.sections[t]??0,now.sections[t]??0));
  const keptNew=now.quoteRequired.every(q=>was.quoteRequired.some(old=>quoteScope(old)===quoteScope(q))||ALLOWED_NEW_QUOTES.has(q)||(q===STAIR_FRAME_QUOTE&&hasPictureFrame(c.design))||addedYardScope(c.design,q));
  const keptOld=was.quoteRequired.every(q=>now.quoteRequired.some(next=>quoteScope(next)===quoteScope(q))||ALLOWED_DROPPED_QUOTES.has(q));
  ok(keptNew&&keptOld,`${name}: existing quote scope is preserved, with explicit cladding, wall execution, hauling and paver order confirmation`);
  const detailed=calculateEstimate(c.design,DECK_SETTINGS);
  for(const label of [DECKING_DELIVERY_QUOTE,STAIR_FRAME_QUOTE])if(now.quoteRequired.includes(label))ok(detailed.sections.some(s=>s.items.some(i=>i.name===label&&i.cost===null))&&!detailed.sections.some(s=>s.items.some(i=>i.name===label&&i.cost!==null)),`${name}: ${label} is a quote, never priced`);
  for(const row of detailed.yardTakeoff.sections.filter(row=>addedYardScope(c.design,row.label)))ok(row.amountCents===null&&detailed.sections.some(section=>section.quoteRequired&&section.total===0&&section.items.some(item=>item.name===row.label&&item.cost===null)),`${name}: added wall/hauling scope stays unpriced and separately identified`);
  const cladding=detailed.sections.find(s=>s.title==='Stair and level cladding');
  if(cladding)ok(cladding.items.some(i=>i.cost===null),`${name}: cladding installation is still a quote even when exact supply is known`);
  ok(moved.every(t=>REVIEW_PRICE_SECTIONS.has(t)||ENGINE_SECTIONS(t)||FEWER_FOOTINGS.has(t)&&(now.sections[t]??0)<(was.sections[t]??0)),`${name}: only the documented railing, stair-width and cladding sections and the framing engine's sections can change`);
  if(c.expect==='same'){ok(near(now.railingLf,was.railingLf),`${name}: pricing review preserves guard quantities`);same++;}
  else{
    ok(now.railingLf<=was.railingLf+1e-6,`${name}: redundant guards remain removed; current stair/cladding prices are independently checked`);
    guard++;
  }
}

// 2. Geometry of every case, and of multi-level designs on the live default (one-row flush frame, 2026-10 rules).
const fresh=newDefaultJunctionCases();
ok(Object.keys(fresh).length>=2&&Object.values(fresh).every(c=>hasPictureFrame(c.design)&&c.design.buildRules==='2026-10'),'The geometry also covers the new default: framed, under the 2026-10 rules');
for(const [name,c] of Object.entries({...cases,...fresh})){
  const d=c.design,e=calculateEstimate(d,DECK_SETTINGS),m=e.model,fell=m.issues.some(i=>i.includes('does not fit on the lower level'));
  if(fell)fallbacks++;
  const plan=claddingPlan(d,m),junctions=levelJunctions(m.levels),fo=finishedFasciaOffset(d);
  for(const conn of m.connections){
    const from=m.levels[conn.from],to=m.levels[conn.to],n=Math.ceil(Math.abs(from.top-to.top)/7.75-1e-9);
    if(n>14||fell)continue;
    ok(conn.run===0,`${name}: the levels meet (gap ${conn.run} in)`);
    if(!n)continue;
    const upper=from.top>=to.top?conn.from:conn.to,lower=upper===conn.from?conn.to:conn.from;
    ok(junctions.some(j=>j.upper===upper&&j.lower===lower),`${name}: the higher level's edge lies on the lower level's`);
    // No trench: nothing between the two levels' outlines along the join.
    const gap=polygonCut([worldOutline(m.levels[upper]).map(p=>({x:p.x,y:p.y}))],[worldOutline(m.levels[lower])]).reduce((s,p)=>s+Math.abs(signedArea(p)),0);
    ok(gap<=1,`${name}: the levels touch without overlapping (${gap.toFixed(1)} sq in shared)`);
  }
  for(const j of junctions){
    const upper=m.levels[j.upper],lower=m.levels[j.lower],rim=upper.rim?.[0],top=rim?rim.a.y-rim.depth/2:upper.top,drops=plan.slabs.filter(s=>s.part==='level-drop');
    // The lower level has no guard along the stretch it shares with the higher one.
    ok(!guardRuns(m).some(r=>Math.abs(r.a.y-lower.top)<.01&&Math.abs(r.b.y-lower.top)<.01&&onJunction(j,{x:r.a.x,y:r.a.z},{x:r.b.x,y:r.b.z},2)),`${name}: no lower guard where the levels meet`);
    // Its rim there is hidden, so the fascia quantities leave it out.
    ok(!exposedRim(d,m).some(r=>Math.abs(r.a.y-(lower.top-1-r.depth/2))<.6&&onJunction(j,{x:r.a.x,y:r.a.z},{x:r.b.x,y:r.b.z},2)),`${name}: the lower rim under the join is not counted as exposed fascia`);
    if(top-lower.top<.25)continue;
    // Every inch of the stretch outside a step opening has a drop face from the lower deck up to the rim's underside.
    const openings=m.flights.filter(f=>f.kind==='connection'&&Math.abs(f.start.y-upper.top)<.6);
    const along=(p:{x:number;y:number})=>(p.x-j.a.x)*j.u.x+(p.y-j.a.y)*j.u.y;
    for(let t=.5;t<j.length;t+=1){
      if(openings.some(f=>Math.abs(along({x:f.start.x,y:f.start.z})-t)<f.width/2+(f.endExtend??0)+.01))continue;
      ok(drops.some(s=>{const a=along(s.a),b=along(s.b);return t>=Math.min(a,b)-.01&&t<=Math.max(a,b)+.01&&near(s.bottomA,lower.top)&&near(s.topA,top);}),`${name}: the face between levels is boarded at ${t.toFixed(1)} in`);
    }
    const mine=drops.filter(s=>{const cross=(p:{x:number;y:number})=>(p.x-j.a.x)*j.u.y-(p.y-j.a.y)*j.u.x;return Math.abs(cross(s.a))<3&&Math.abs(cross(s.b))<3&&near(s.bottomA,lower.top)&&[s.a,s.b].every(p=>along(p)>-fo-1&&along(p)<j.length+fo+1);});
    ok(mine.length>0||openings.length>0,`${name}: the join has its drop faces`);
    for(const s of mine){const off=(s.a.x-j.a.x)*j.out.x+(s.a.y-j.a.y)*j.out.y;ok(near(off,fo-s.thick/2),`${name}: the drop face sits flush under the fascia (${off.toFixed(3)})`);}
  }
  // Stair sides: two stepped panels per going on every straight flight, down to the ground or the deck under the step.
  for(const f of m.flights){
    if(!f.outward||f.risers<2)continue;
    const mine=plan.slabs.filter(s=>(s.part==='stair-side')===(f.kind==='grade')&&Math.abs(s.topA-(f.start.y-f.rise-1))<f.rise*(f.risers-1)+.01);
    const goings=[...Array(f.risers-1).keys()].map(i=>f.start.y-(i+1)*f.rise-1);
    for(const top of goings)ok(plan.slabs.filter(s=>near(s.topA,top)&&Math.hypot(s.a.x-f.start.x,s.a.y-f.start.z)<(f.risers)*f.run+f.width).length>=2,`${name}: flight ${f.id} has a side panel on both sides under the tread at ${top.toFixed(1)} in`);
    ok(mine.every(s=>s.topA>Math.max(s.bottomA,s.bottomB)),`${name}: side panels stand the right way up`);
  }
  // The top riser stands on the rim's face: never inside the rim or in its plane.
  const start=(d.pictureFrameRows||d.pattern==='Picture Frame')?fo:0;
  for(const b of drawnRiserBoards(d,m)){
    const f=m.flights.find(x=>x.id===b.flightId);if(b.riserIndex!==0||!f?.outward||f.id.endsWith('-lower')&&m.flights.some(x=>x.id===f.id.replace(/-lower$/,'-winders')))continue;
    const back=(b.x-f.start.x)*f.outward.x+(b.z-f.start.z)*f.outward.y-b.d/2+start;
    ok(back>=.75-1e-6,`${name}: the top riser of ${f.id} stands on the rim's face (${back.toFixed(3)} in out)`);
  }
  // Rim corners: one filler at every outside corner of every level.
  for(const l of m.levels.filter(l=>l.kind!=='winder'&&l.rim?.length)){
    const P=worldOutline(l);let convex=0;
    P.forEach((v,i)=>{const p=P[(i+P.length-1)%P.length],q=P[(i+1)%P.length],d1={x:v.x-p.x,y:v.y-p.y},d2={x:q.x-v.x,y:q.y-v.y},n1={x:d1.y,y:-d1.x};if(d2.x*n1.x+d2.y*n1.y<-1e-6&&Math.hypot(d1.x,d1.y)>=1&&Math.hypot(d2.x,d2.y)>=1)convex++;});
    ok(plan.fillers.filter(s=>P.some(v=>Math.hypot(s.a.x-v.x,s.a.y-v.y)<1)).length>=convex,`${name}: every outside rim corner of level ${l.index??0} is filled`);
  }
  ok(deckExportMeshes(d,m).filter(x=>x.name.startsWith('cladding_')).length===plan.slabs.length,`${name}: the export carries the cladding`);
}

// 3. Full-width steps reach the finished edge (no notch), and a step that cannot fit keeps the old spacing with a note.
{
  const d:DeckData={...structuredClone(DEFAULT_DECK),levels:2,level2Position:'Front',height2:DEFAULT_DECK.height-12,width2:DEFAULT_DECK.width,level2FullStep:true},m=calculateEstimate(d,DECK_SETTINGS).model;
  const f=m.flights.find(x=>x.kind==='connection')!,e=finishedFasciaOffset(d);
  ok(f.endExtend===e&&m.treads.filter(t=>Math.abs(t.y-(f.start.y-f.rise-.5))<.01).every(t=>near(t.w,f.width+2*e)),'A full-width step runs its treads out to the rim face at each end');
  ok(m.stringers.every(s=>Math.abs(s.a.x)<1e6)&&f.width===DEFAULT_DECK.width*12,'Its stringers and width keep the framing size');
  const shallow:DeckData={...structuredClone(DEFAULT_DECK),levels:2,level2Position:'Front',height:60,height2:12,length2:4},sm=calculateEstimate(shallow,DECK_SETTINGS).model;
  ok(sm.issues.some(i=>i.includes('does not fit on the lower level'))&&sm.connections[0].run>0,'A lower level too shallow for the step keeps the old spacing, with a note');
}

// 4. Skirting board courses meet in real mitres, without a vertical cover block.
{
  const d:DeckData={...structuredClone(DEFAULT_DECK),deckType:'Freestanding',skirting:newSkirting()},m=calculateEstimate(d,DECK_SETTINGS).model,s=skirtingPlan(d,m)!;
  const joins=(p:typeof s)=>new Set(p.faces.flatMap(f=>[f.capA,f.capB].filter(Boolean).map(c=>`${c!.outer.x.toFixed(5)}:${c!.outer.y.toFixed(5)}`))).size;
  ok(s.corners.length===0&&joins(s)===4,`A freestanding rectangle's four board corners meet in mitres (${joins(s)})`);
  const lshape=skirtingPlan({...d,shape:'L-Shape',cutoutWidth:6,cutoutLength:4},calculateEstimate({...d,shape:'L-Shape',cutoutWidth:6,cutoutLength:4},DECK_SETTINGS).model)!;
  ok(lshape.corners.length===0&&joins(lshape)===6,`An L-shape's five outside corners and inside corner have bounded mitred board joins (${joins(lshape)})`);
}

// 5. Wiring.
{
  const viewer=read('src/features/deckcraft/components/viewer3d/Deck3DViewer.tsx');
  ok(/<Cladding3D data=\{data\} model=\{model\} material=\{fasciaMat\}/.test(viewer)&&/FinishedBoards items=\{drawnRisers\}/.test(viewer),'The 3D view draws the cladding in the fascia finish and the moved top riser');
  ok(/"check:deck":[^\n]*check-deck-level-junction\.ts/.test(read('package.json')),'This check runs in check:deck');
}

console.log(`DECK LEVEL JUNCTION OK — ${Object.keys(cases).length} designs against the 41d3eba guard baseline (${same} preserve guard quantities, ${guard} preserve guard removal, ${fallbacks} keep the old spacing) and ${Object.keys(fresh).length} on the new default, faces, stair sides, top risers, corners — ${checks} checks`);
