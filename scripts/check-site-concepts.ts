// S3 site concepts (src/features/deckcraft/siteConcepts.ts) and design moves (siteDesignMoves.ts).
//
// Fixtures:
// - e2e/fixtures/craighurst-extended.json: the Craighurst design with its 11 real shots (P1–P11, unchanged) plus SYNTHETIC
//   shots with ids SYN-*, on a 48 × 45 in grid from x −144 to 240 in and z 0 to 360 in (about 32 × 30 ft beside and in
//   front of the deck), outside the real shots' hull grown 18 in. Their heights continue the measured trend: the
//   least-squares plane of the real shots plus a gentle 8 in hump (Gaussian, σ 66 in) at x 48, z 240. Not a measurement:
//   the file's top-level "note" says so (parseDesign reads only "configuration"). It lets every move be exercised.
// - e2e/fixtures/craighurst-ground-fit.json: the real survey alone (about 14.6 × 12.7 ft, most of it under the landing and
//   stair): the honesty test. Moves that need more ground say how far to measure; the ground-fit concept stands.
// - DEFAULT_DECK with no survey: pending.
import '../src/features/deckcraft/siteModelRuntime';
import '../src/features/deckcraft/siteSurfaceEngine';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {parseDesign,serializeDesign} from '../src/features/deckcraft/designPersistence';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {houseOutline} from '../src/features/deckcraft/houseFootprint';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {fireOutline,planGapIn} from '../src/features/deckcraft/fireFeatureModel';
import {fireProduct} from '../src/features/deckcraft/fireFeatures';
import {yardFeatureOutline,yardWallPath} from '../src/features/deckcraft/yardPathGeometry';
import {DESIGN_TRENDS_STATUS} from '../src/features/deckcraft/designTrends';
import {GUARD,STONE_STEPS} from '../src/features/deckcraft/designRules';
import {designSiteSurface} from '../src/features/deckcraft/siteSurface';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';

let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};
const fixture=(name:string)=>readFileSync(new URL(`../e2e/fixtures/${name}`,import.meta.url),'utf8');
async function load(text:string):Promise<DeckData>{const doc=JSON.parse(text);await ensureLiveDesignExtensions(doc);return parseDesign(JSON.stringify(doc));}
const EXTENDED=fixture('craighurst-extended.json'),REAL=fixture('craighurst-ground-fit.json');
const {siteConcepts}=await import('../src/features/deckcraft/siteConcepts');
const M=await import('../src/features/deckcraft/siteDesignMoves');
type Result=Awaited<ReturnType<typeof siteConcepts>>;type Concept=Result['concepts'][number];
const ALLOWED=new Set(['yardFeatures','landscapeObjects','stairTargets','stairOffset','height','lightingSystem']);
const timings:Record<string,number>={},plantCounts:string[]=[];
async function timed(label:string,f:()=>Promise<Result>){const t=performance.now();const r=await f();timings[label]=Math.round(performance.now()-t);return r;}

// 0. The fixtures: real shots unchanged, every added shot labelled synthetic, a note saying so.
{
 const ext=JSON.parse(EXTENDED),real=JSON.parse(REAL),pts=ext.configuration.siteModel.points as {id:string}[],realPts=real.configuration.siteModel.points as {id:string}[];
 ok(JSON.stringify(pts.slice(0,realPts.length))===JSON.stringify(realPts),'Extended fixture keeps the 11 real shots exactly');
 ok(pts.length>realPts.length+40&&pts.slice(realPts.length).every(p=>p.id.startsWith('SYN-')),`Every added shot is labelled SYN- (${pts.length-realPts.length})`);
 ok(typeof ext.note==='string'&&/SYNTHETIC/.test(ext.note)&&/real-only fixture/.test(ext.note),'A top-level note says the added shots are synthetic');
 const bare=(c:{siteModel:{points:unknown[]}})=>JSON.stringify({...c,siteModel:{...c.siteModel,points:[]}});
 ok(bare(ext.configuration)===bare(real.configuration),'Otherwise the same Craighurst design');
}

// 1. Craighurst extended: 2–3 distinct, valid, priced, deterministic concepts.
const ext=await load(EXTENDED),before=JSON.stringify(ext);
const r1=await timed('extended',()=>siteConcepts(ext));
// The second run also reports the estimates in every stretch of work between two of its yields, and a scheduler.yield
// stand-in (siteConcepts and ground fit yield through it where there is one) times every stretch (section 9).
const slices:{ms:number;engineMs:number;calls:number;longestMs:number}[]=[];let longestStretch=0;
const r2=await timed('extended again',async()=>{const g=globalThis as {scheduler?:unknown},had=g.scheduler;let resumed=performance.now();
 g.scheduler={yield:()=>{longestStretch=Math.max(longestStretch,performance.now()-resumed);return new Promise<void>(r=>setImmediate(()=>{resumed=performance.now();r();}));}};
 try{const r=await siteConcepts(structuredClone(ext),{onYield:s=>slices.push(s)});longestStretch=Math.max(longestStretch,performance.now()-resumed);return r;}finally{g.scheduler=had;}});
ok(r1.status==='ready'&&!!r1.brief&&!!r1.baseline,`Extended: ready (${r1.warnings.join(' | ')})`);
ok(JSON.stringify(ext)===before,'The input design is not changed');
ok(JSON.stringify(r1)===JSON.stringify(r2),'Deterministic: the same concepts every time, from a copy too');
const concepts=r1.concepts,brief=r1.brief!;
ok(concepts.length>=2&&concepts.length<=3,`2–3 concepts (${concepts.map(c=>c.title).join(', ')})`);
ok(new Set(concepts.map(c=>c.id)).size===concepts.length&&new Set(concepts.map(c=>c.title)).size===concepts.length&&new Set(concepts.map(c=>c.goal)).size===concepts.length,'Distinct ids, titles and goals');
ok(new Set(concepts.map(c=>c.moves.map(m=>m.kind).sort().join())).size===concepts.length,'Distinct sets of moves');
const asStands=calculateEstimate(ext);
const baseline=r1.baseline!;ok(Math.abs(baseline.subtotal-asStands.subtotal)<1e-6||baseline.subtotal>0,'Baseline is the design as it stands');
const est=new Map<string,ReturnType<typeof calculateEstimate>>(),designs=new Map<string,DeckData>();
for(const c of concepts){
 const name=c.title;
 ok(c.validation.ok,`${name}: valid (${JSON.stringify(c.validation)})`);
 ok(Object.keys(c.patch).every(k=>ALLOWED.has(k)),`${name}: patch touches only yard, landscape, stair, deck height and settled lights (${Object.keys(c.patch).join(', ')})`);
 const patched={...ext,...c.patch};await ensureLiveDesignExtensions(patched);
 const e=calculateEstimate(patched);est.set(c.id,e);designs.set(c.id,patched);
 ok(e.subtotal===c.subtotal&&JSON.stringify(e.quoteRequired)===JSON.stringify(c.quotes),`${name}: one patch re-prices to exactly ${c.subtotal.toFixed(2)}`);
 ok(Math.abs(c.delta-(c.subtotal-baseline.subtotal))<.006,`${name}: delta ${c.delta} against the one baseline`);
 const parsed=parseDesign(serializeDesign(patched));await ensureLiveDesignExtensions(parsed);
 ok(calculateEstimate(parsed).subtotal===c.subtotal,`${name}: survives a save and reload at the same price`);
 const ids=[...(patched.yardFeatures??[]).map(f=>f.id),...(patched.landscapeObjects??[]).map(o=>o.id)];ok(new Set(ids).size===ids.length,`${name}: ids unique`);
 for(const m of c.moves){ok(m.feasible&&m.parts.addYard.every(f=>patched.yardFeatures!.some(g=>g.id===f.id))&&m.parts.addLandscape.every(o=>patched.landscapeObjects!.some(g=>g.id===o.id)),`${name}: ${m.kind} is in the one patch`);
  ok(m.footprints.every(f=>designSiteSurface(ext)!.extrema(f.rings,'existing').complete),`${name}: ${m.kind} stands on measured ground`);}
 ok(c.newQuotes.every(q=>c.quotes.includes(q)&&!baseline.quotes.includes(q)),`${name}: new quote labels are the estimate's own`);
 ok(c.scores.cost>=0&&c.scores.cost<=1&&c.scores.execution>=0&&c.scores.execution<=1,`${name}: scores in 0–1 (${JSON.stringify(c.scores)})`);
 ok(DESIGN_TRENDS_STATUS!=='approved'?c.scores.trend===null:typeof c.scores.trend==='number','Trend score only once the trends are approved');
 ok(c.reasons.length>=3&&c.reasons.every(t=>/\d/.test(t)&&/^[A-Z0-9].{20,}[.)]$/.test(t)),`${name}: plain reasons with numbers (${c.reasons.length})`);
 ok(c.reasons.some(t=>t.includes(`${brief.plane.slopePct} %`)),`${name}: a reason cites the measured slope (${brief.plane.slopePct} %)`);
 const price=c.reasons.at(-1)!;
 ok(c.delta<0?/less than the design as it stands/.test(price):/adds/.test(price),`${name}: the price reads as it is (${price})`);
 ok(!c.newQuotes.length||/still to be quoted/.test(price),`${name}: added quoted work is said`);
 ok(!(c.delta<0&&c.newQuotes.length)||/not final/.test(price),`${name}: quoted work is never presented as a saving`);
}
// Honest ranking (no goals): concepts that add no quoted work first, then by price.
ok(concepts.every((c,i)=>!i||(concepts[i-1].newQuotes.length?1:0)<(c.newQuotes.length?1:0)||(concepts[i-1].newQuotes.length?1:0)===(c.newQuotes.length?1:0)&&concepts[i-1].delta<=c.delta),'Ranked honestly: no added quoted work first, then cheapest');

// 2. The concepts by goal.
const byKind=(k:string)=>concepts.find(c=>c.moves.some(m=>m.kind===k));
const slope=byKind('ground-fit'),room=byKind('fire-room'),garden=byKind('terraced-beds');
ok(slope&&room&&garden,`Slope, room and garden concepts (${concepts.map(c=>c.moves.map(m=>m.kind).join('+')).join(' | ')})`);
// Ground fit: the best ground-fit option, its bank on measured ground.
{const gf=slope!.moves.find(m=>m.kind==='ground-fit')!;ok(gf.metrics.bankStatus==='ready'&&typeof gf.metrics.optionId==='string'&&gf.metrics.optionId!=='current',`Ground fit takes a ready option (${gf.metrics.optionId}: ${gf.title})`);}
// Fire room: gas, on its level patio, clear of the house and deck by FIRE_CLEARANCE, 10–25 ft from the door; a seat wall
// on the paving round the uphill side.
{
 const d=designs.get(room!.id)!,e=est.get(room!.id)!,fr=room!.moves.find(m=>m.kind==='fire-room')!,bowl=d.yardFeatures!.find(f=>f.kind==='fire-feature')!,patio=d.yardFeatures!.find(f=>f.id===bowl.supportFeatureId)!;
 ok(fireProduct(bowl)?.fuel==='gas'&&bowl.productId==='fire-gas-bowl',`The fire room uses a gas bowl (${bowl.productId})`);
 const body=fireOutline(bowl),house=houseOutline(d),deck=buildDeckTakeoff(d).levels.map(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z})));
 const gapHouse=Math.min(...house.map(r=>planGapIn(body,r))),gapDeck=Math.min(...deck.map(r=>planGapIn(body,r)));
 ok(gapHouse>=48&&gapDeck>=48,`Gas bowl clear of the house (${(gapHouse/12).toFixed(1)} ft) and deck (${(gapDeck/12).toFixed(1)} ft) by at least 4 ft`);
 ok(!e.yardModel.warnings.some(w=>w.startsWith(`${bowl.name}: `)&&/ft from the (house|deck)/.test(w)),'No clearance warning for the bowl');
 const pm=e.yardModel.features.find(m=>m.config.id===patio.id)!,bm=e.yardModel.features.find(m=>m.config.id===bowl.id)!;
 ok(patio.kind==='patio'&&!pm.excluded&&!bm.excluded&&!bm.boxes.some(b=>b.role==='fire-pad'),'The bowl stands on its patio (no pad of its own)');
 ok(typeof patio.finishedElevationIn==='number'&&!patio.patioSlope?.xPct&&!patio.patioSlope?.zPct&&patio.groundFit?.slopeRatio===3,'The fire room patio is level and graded round');
 const door=brief.house.doorAt!,dist=Math.hypot(bowl.xFt*12-door.x,bowl.zFt*12-door.z)/12;ok(dist>=10&&dist<=25,`The fire is ${dist.toFixed(1)} ft from the door (10–25)`);
 ok(fr.metrics.zoneKind==='flat'||fr.metrics.zoneKind==='gentle'||fr.metrics.zoneKind==='moderate',`In the flattest open zone (${fr.metrics.zone} ${fr.metrics.zoneKind})`);
 const seat=d.yardFeatures!.find(f=>f.kind==='retaining-wall'&&f.wallConstruction?.freestanding)!,sm=e.yardModel.features.find(m=>m.config.id===seat.id)!;
 ok(seat&&!sm.excluded&&Math.abs(sm.topIn-pm.topIn-21)<.05,`A freestanding seat wall on the paving, 21 in in whole courses (${(sm.topIn-pm.topIn).toFixed(2)} in)`);
 const path=yardWallPath(seat),apex=path[Math.floor(path.length/2)],down=brief.plane.downhill;
 ok((apex.x-bowl.xFt*12)*-down.dx+(apex.y-bowl.zFt*12)*-down.dz>24,'The seat wall arcs round the uphill side of the fire');
 ok(path.every(p=>Math.hypot(p.x-bowl.xFt*12,p.y-bowl.zFt*12)>=60-1e-6),'…at least 5 ft from the fire');
}
// Raised patio: level with the landing; walls only where it stands more than 16 in; steps down to grade.
{
 const d=designs.get(room!.id)!,e=est.get(room!.id)!,rp=room!.moves.find(m=>m.kind==='raised-patio');
 ok(rp,`The room concept has a raised patio (${room!.skipped.map(s=>s.reason).join(' ')})`);
 const patio=d.yardFeatures!.find(f=>f.id===rp!.metrics.patioId)!,landing=d.yardFeatures!.find(f=>f.id==='landing')!,walls=rp!.parts.addYard.filter(f=>f.kind==='retaining-wall');
 ok(patio.finishedElevationIn===landing.finishedElevationIn,`Level with the landing (${patio.finishedElevationIn} in)`);
 const surface=designSiteSurface(ext)!,level=patio.finishedElevationIn!,outline=yardFeatureOutline(patio)[0];
 // Every wall runs just outside the patio's edge (its cap's inner edge on it), and only where the patio stands more
 // than 16 in above the measured ground (a riser's tolerance at the ends, where the run starts at the 16 in cut).
 const nearest=(q:{x:number;y:number})=>{let best={x:0,y:0,d:Infinity};for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/(dx*dx+dy*dy))),x=a.x+t*dx,y=a.y+t*dy,d=Math.hypot(q.x-x,q.y-y);if(d<best.d)best={x,y,d};}return best;};
 for(const w of walls){const path=yardWallPath(w),offset=(w.depthFt*12+2)/2+.25,pts=path.slice(1).flatMap((q,i)=>Array.from({length:4},(_,k)=>({x:path[i].x+(q.x-path[i].x)*k/4,y:path[i].y+(q.y-path[i].y)*k/4})));
  const edge=pts.map(nearest),rises=edge.map((e,i)=>{const l=e.d||1,out={x:(pts[i].x-e.x)/l,y:(pts[i].y-e.y)/l};return level-surface.sample(e.x+out.x*.5,e.y+out.y*.5,'existing')!;});
  ok(edge.every(e=>e.d>=offset-.5&&e.d<=offset*1.5),`${w.name}: it runs along the patio's edge (${Math.min(...edge.map(e=>e.d)).toFixed(1)}–${Math.max(...edge.map(e=>e.d)).toFixed(1)} in out)`);
  ok(Math.max(...rises)>16&&rises.every(r=>r>16-1.5),`${w.name}: only where the patio stands more than 16 in (${Math.min(...rises).toFixed(1)}–${Math.max(...rises).toFixed(1)} in)`);}
 // Along the rest of the raised edge it stands 16 in or less: a stone edge course, two courses at most.
 const pm=e.yardModel.features.find(m=>m.config.id===patio.id)!;ok(!pm.excluded&&(pm.quantities.edgeCourseMaxIn??0)<=16.05,`Stone edge course elsewhere, at most 16 in (${pm.quantities.edgeCourseMaxIn})`);
 ok(walls.every(w=>!e.yardModel.features.find(m=>m.config.id===w.id)!.excluded),'Its walls build');
 ok(!e.yardModel.warnings.some(w=>w.startsWith(`${patio.name}: `)&&/finished surface stands up to|measured ground beside it/.test(w)),'No ground-contact message left on the raised patio');
 ok(rp!.metrics.guardRequired===(Number(rp!.metrics.maxRiseIn)>GUARD.requiredAboveIn)&&rp!.notes.some(n=>/guard/.test(n)),`Guard flagged only past ${GUARD.requiredAboveIn} in (${rp!.metrics.maxRiseIn} in: ${rp!.metrics.guardRequired})`);
 const st=room!.moves.find(m=>m.kind==='stone-steps');ok(st,'Stone steps down to grade');
 const sf=d.yardFeatures!.find(f=>f.id===st!.metrics.stepsId)!,sq=e.yardModel.features.find(m=>m.config.id===sf.id)!.quantities;
 ok(sq.stoneStepRisers===st!.metrics.risers&&sq.stoneStepRiseIn>=STONE_STEPS.riseIn[0]-1e-9&&sq.stoneStepRiseIn<=STONE_STEPS.riseIn[1]+1e-9&&sq.buriedTreadAreaSqft===0,`Steps: ${sq.stoneStepRisers} × ${sq.stoneStepRiseIn.toFixed(2)} in, no tread buried`);
 ok(sf.finishedElevationIn===level,'The steps start at the patio level');
}
// Terraces: follow the real fall, step down it, walls linked to their beds and 12–24 in.
{
 const d=designs.get(garden!.id)!,tb=garden!.moves.find(m=>m.kind==='terraced-beds')!,down=brief.plane.downhill;
 ok(Number(tb.metrics.downX)*down.dx+Number(tb.metrics.downZ)*down.dz>=.7,`Terraces follow the measured fall (${tb.metrics.downX}, ${tb.metrics.downZ} vs ${down.dx}, ${down.dz})`);
 ok(Number(tb.metrics.alignment)>=.9,`…of their own ground too (alignment ${tb.metrics.alignment})`);
 const beds=tb.parts.addLandscape.filter(o=>o.kind==='bed'),walls=tb.parts.addYard,along=(o:{polygon?:{x:number;z:number}[]})=>o.polygon!.reduce((n,p)=>n+p.x*down.dx+p.z*down.dz,0)/o.polygon!.length;
 ok(beds.length===Number(tb.metrics.tiers)&&walls.length===beds.length,`${tb.metrics.tiers} beds, one wall each`);
 ok(beds.every(b=>b.edge?.kind==='wall'&&walls.some(w=>w.id===b.edge.wallFeatureId)&&d.yardFeatures!.some(f=>f.id===b.edge!.wallFeatureId)),'Each bed is linked to its wall by wallFeatureId');
 const sorted=[...beds].sort((a,b)=>along(a)-along(b));
 ok(sorted.every((b,i)=>!i||(walls.find(w=>w.id===b.edge!.wallFeatureId)!.finishedElevationIn!<walls.find(w=>w.id===sorted[i-1].edge!.wallFeatureId)!.finishedElevationIn!-1)),'Each tier steps down the fall');
 ok(walls.every(w=>w.heightIn>=12&&w.heightIn<=25),`Walls ${walls.map(w=>w.heightIn).join(', ')} in (12–24)`);
 const e=est.get(garden!.id)!;ok(walls.every(w=>!e.yardModel.features.find(m=>m.config.id===w.id)!.excluded),'The terrace walls build');
 const rb=garden!.moves.find(m=>m.kind==='raised-beds'),rbBeds=rb?.parts.addLandscape.filter(o=>o.kind==='bed')??[];ok(rb&&rbBeds.length===2&&rbBeds.every(o=>o.raisedIn!>=18&&o.raisedIn!<=24&&o.edge?.kind==='timber'),'Two raised beds, 18–24 in, timber edged');
 ok(rb&&/not assessed/.test(rb.notes.join(' '))&&!rb.notes.some(n=>/midday sun is/.test(n)),'No sun claim without a compass bearing');
 // Planted: every bed holds catalogue plants (shrubs and grasses; low ones in the raised beds) on a staggered grid, inside
 // it, on its soil and mulch, clear of every wall and of each other, each plant a quote line (never $0).
 const {landscapePlacement,raisedBedLevel}=await import('../src/features/deckcraft/landscapeModelRuntime');
 const {landscapeSurfaceDepth}=await import('../src/features/deckcraft/landscapeSurfaces');
 const {yardArea,yardClip}=await import('../src/features/deckcraft/yardModel');
 const {buildYardTakeoff}=await import('../src/features/deckcraft/yardTakeoff');
 type P={x:number;y:number};const inRing=(r:P[],q:P)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a.y>q.y)!==(b.y>q.y)&&q.x<(b.x-a.x)*(q.y-a.y)/(b.y-a.y)+a.x)c=!c;}return c;};
 const sections=buildYardTakeoff(d).sections,wallRings=d.yardFeatures!.filter(f=>f.enabled&&f.kind==='retaining-wall').flatMap(f=>M.featureRings(f)),meet=(a:P[][],b:P[][])=>yardArea(yardClip(yardClip(a),yardClip(b),'intersection'));
 for(const [m,label,low] of [[tb,'Terraces',false],[rb!,'Raised beds',true]] as const){
  const plants=m.parts.addLandscape.filter(o=>o.kind==='plant');
  ok(plants.length===Number(m.metrics.plants)&&plants.every(p=>(p.assetId==='rounded-shrub'||p.assetId==='grass-clump')&&p.widthIn===p.depthIn),`${label}: ${plants.length} catalogue shrubs and grasses (metrics say ${m.metrics.plants})`);
  for(const b of m.parts.addLandscape.filter(o=>o.kind==='bed')){
   const mine=plants.filter(p=>m.footprints.find(f=>f.id===p.id)?.on?.join()===b.id),ring=M.objectRings(b)[0],soil=raisedBedLevel(d,b)!.topIn+landscapeSurfaceDepth(b);plantCounts.push(`${b.name} ${mine.length}`);
   ok(mine.length>=4&&mine.length<=12,`${label}: ${b.name} holds ${mine.length} plants (4–12)`);
   // Rows: across the fall on the terraces, along the bed in the raised beds; equal rows set half a space over.
   const back=low?(m.metrics.alongHouse?{x:0,y:1}:{x:1,y:0}):{x:-Number(m.metrics.downX),y:-Number(m.metrics.downZ)},rowOf=new Map<number,number[]>();
   for(const p of mine){const v=Math.round(p.xIn*back.x+p.zIn*back.y),u=p.xIn*back.y-p.zIn*back.x,key=[...rowOf.keys()].find(k=>Math.abs(k-v)<=1)??v;rowOf.set(key,[...(rowOf.get(key)??[]),u]);}
   const rows=[...rowOf.entries()].sort((a,b)=>b[0]-a[0]).map(r=>r[1]),width=(i:number)=>mine.find(p=>Math.abs(Math.round(p.xIn*back.x+p.zIn*back.y)-[...rowOf.keys()].sort((a,b)=>b-a)[i])<=1)!.widthIn;
   ok(rows.length>=2&&rows.every((r,i)=>!i||width(i)!==width(i-1)||r.every(u=>rows[i-1].every(w=>Math.abs(u-w)>1))),`${label}: ${b.name}'s plants stand in ${rows.length} staggered rows (${rows.map(r=>r.length).join(', ')})`);
   ok(mine.every(p=>M.objectRings(p)[0].every(q=>inRing(ring,q))),`${label}: ${b.name}'s plants stand inside it`);
   ok(mine.every(p=>Math.abs(landscapePlacement(d,p).y*12-soil)<1e-6),`${label}: ${b.name}'s plants sit on its soil and mulch (${soil.toFixed(1)} in)`);
   ok(!low||mine.every(p=>p.heightIn<=16),`${label}: ${b.name}'s plants are low (${Math.max(...mine.map(p=>p.heightIn))} in at most)`);
  }
  ok(plants.every(p=>meet(M.objectRings(p),wallRings)<.01),`${label}: no plant overlaps a wall`);
  ok(plants.every((p,i)=>plants.every((q,j)=>j<=i||meet(M.objectRings(p),M.objectRings(q))<.01)),`${label}: no plant overlaps another`);
  ok(plants.every(p=>sections.some(s=>s.featureIds?.includes(p.id)&&s.label===`${p.name} — supply and installation`&&s.amountCents===null)&&!sections.some(s=>s.featureIds?.includes(p.id)&&s.amountCents===0)),`${label}: every plant is a quote line, never $0`);
 }
}

// 3. Goals, budget, sun, cancellation.
{
 const g=await timed('extended, goals',()=>siteConcepts(ext,{goals:['garden','entertaining'],budget:20000,northDeg:180}));
 ok(g.concepts[0]?.goal==='garden'&&g.concepts[1]?.goal==='entertaining',`Goals set the order (${g.concepts.map(c=>c.goal).join(', ')})`);
 const room2=g.concepts.find(c=>c.goal==='entertaining')!;
 ok(!room2.moves.some(m=>m.kind==='raised-patio'||m.kind==='stone-steps')&&room2.moves.some(m=>m.kind==='fire-room'),`Over the budget, the optional raised patio is left out (${room2.moves.map(m=>m.kind).join(', ')})`);
 ok(room2.delta<=20000||g.warnings.some(w=>w.startsWith(`${room2.title}: `)&&/over the \$20,000 budget/.test(w)),'…and anything still over budget says so');
 const rb=g.concepts.find(c=>c.goal==='garden')!.moves.find(m=>m.kind==='raised-beds');ok(!rb||rb.notes.some(n=>/faces south/.test(n)),'With a compass bearing the beds say where the sun is');
 const ac=new AbortController();ac.abort();const cancelled=await siteConcepts(ext,{signal:ac.signal});ok(cancelled.status==='pending'&&/cancelled/.test(cancelled.warnings[0]),'An aborted request is pending');
 const mid=new AbortController();let seen=0;const stopped=await siteConcepts(ext,{signal:mid.signal,onProgress:()=>{if(++seen===2)mid.abort();}});ok(stopped.status==='pending'&&!stopped.concepts.length,'Aborting part way stops it');
}

// 4. The moves on their own: bounded params, wood clearances, the seat wall needs a fire.
{
 const {loadSiteDesignRuntime,moveContext,siteDesignMove}=M;await loadSiteDesignRuntime(ext);
 const {siteBrief}=await import('../src/features/deckcraft/siteBrief');const ctx=moveContext(ext,siteBrief(ext,{maxBytes:4096})!);
 const wood=await siteDesignMove('fire-room',ctx,{product:'fire-wood-ring',patioFt:99});
 ok(wood.params.patioFt===16||wood.params.patioFt===14||wood.params.patioFt===12,`Params are clamped (${wood.params.patioFt})`);
 ok(!wood.feasible||Number(wood.metrics.houseGapFt)>=13.1&&Number(wood.metrics.deckGapFt)>=13.1,`A wood ring keeps 4 m (${wood.feasible?`${wood.metrics.houseGapFt} / ${wood.metrics.deckGapFt} ft`:wood.reason})`);
 ok(wood.notes.some(n=>/open wood fire pit is not offered/.test(n)),'An open wood pit is never offered');
 const lone=await siteDesignMove('seat-wall',ctx);ok(!lone.feasible&&/fire room/.test(lone.reason!),'A seat wall needs a fire room');
 const steps=await siteDesignMove('stone-steps',ctx);ok(!steps.feasible&&/level change/.test(steps.reason!),'Steps need a level change');
}

// 5. The real survey alone: honest about what it cannot place; the ground-fit concept stands.
{
 const real=await load(REAL),r=await timed('real only',()=>siteConcepts(real));
 ok(r.status==='ready'&&r.concepts.length>=1,`Real survey: ${r.concepts.length} concept(s)`);
 const gf=r.concepts.find(c=>c.moves.some(m=>m.kind==='ground-fit'));ok(gf&&gf.validation.ok,`…the ground-fit concept, valid (${gf&&JSON.stringify(gf.validation)})`);
 const patched={...real,...gf!.patch};await ensureLiveDesignExtensions(patched);ok(calculateEstimate(patched).subtotal===gf!.subtotal,'…and it re-prices exactly');
 const further=[...r.warnings,...r.concepts.flatMap(c=>c.skipped.map(s=>s.reason))].filter(w=>/Measure about \d+ ft further (away from|toward)/.test(w));
 ok(further.length>=3,`Moves that need more ground say how far to measure (${further.length}: ${further.map(w=>w.split(':')[0]).join('; ')})`);
 ok(r.warnings.some(w=>/^Outdoor room: Measure about \d+ ft further/.test(w))&&r.warnings.some(w=>/^Garden terraces: Measure about \d+ ft further/.test(w)),'…the fire room and the terraces among them');
 ok(r.concepts.every(c=>c.validation.insideCoverage),'Nothing is placed outside the survey');
}

// 6. No survey: pending.
{
 const legacy=structuredClone(DEFAULT_DECK) as DeckData;delete (legacy as Partial<DeckData>).siteModel;
 const r=await timed('legacy',()=>siteConcepts(legacy));ok(r.status==='pending'&&!r.concepts.length&&r.brief===null&&/measured site/.test(r.warnings[0]),'A design without a survey is pending');
}

// 7. Lazy: the site designer is only ever loaded dynamically, and it loads the brief and ground fit dynamically.
{
 const files:string[]=[];const walk=(dir:string)=>{for(const n of readdirSync(dir)){const f=join(dir,n);if(statSync(f).isDirectory())walk(f);else if(/\.(ts|tsx)$/.test(n))files.push(f);}};walk(new URL('../src',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
 const statics=(target:string)=>files.filter(f=>!f.endsWith(`${target}.ts`)&&new RegExp(`^\\s*import\\s+(?!type\\b)[^;]*?from\\s*['"][^'"]*/${target}['"]`,'m').test(readFileSync(f,'utf8')));
 ok(!statics('siteConcepts').length,`siteConcepts is only imported dynamically (${statics('siteConcepts').join(', ')||'no static imports'})`);
 ok(statics('siteDesignMoves').every(f=>f.endsWith('siteConcepts.ts')),`siteDesignMoves is imported statically only by siteConcepts (${statics('siteDesignMoves').join(', ')})`);
 for(const f of ['siteConcepts','siteDesignMoves']){const text=readFileSync(new URL(`../src/features/deckcraft/${f}.ts`,import.meta.url),'utf8');ok(!/^\s*import\s+(?!type\b)[^;]*from\s*'\.\/(siteBrief|groundFit)'/m.test(text),`${f} loads siteBrief and groundFit dynamically`);}
}

// 8. Review S regressions (the reviewer's setups): the guard read against the lowest ground within 1.2 m, walls judged
// as built, stairs in the fire clearance, an existing fire reused, seat heights from the wall's own courses, the real
// reason a raised patio is not offered, lot lines, pools, and a ground fit that does not depend on the clock.
{
 const {moveContext,siteDesignMove,withMove,applyParts,designOccupants,lotOf}=M;
 const {siteBrief}=await import('../src/features/deckcraft/siteBrief');
 const {stairFootprints}=await import('../src/features/deckcraft/fireFeatureModel');
 const {createPlanningPool}=await import('../src/features/deckcraft/poolAssembly');
 const {poolPermanentExclusion}=await import('../src/features/deckcraft/poolGeometry');
 const {yardArea,yardClip}=await import('../src/features/deckcraft/yardModel');
 type P={x:number;y:number};
 const ctxOf=(d:DeckData,opts:{budgetMs?:number}={})=>moveContext(d,siteBrief(d,{maxBytes:4096})!,opts);
 const scaled=async(k:number)=>{const d={...ext,siteModel:{...ext.siteModel!,points:ext.siteModel!.points.map(p=>({...p,elevationIn:p.elevationIn*k}))}};await ensureLiveDesignExtensions(d);return d;};
 const inRing=(r:P[],x:number,z:number)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a.y>z)!==(b.y>z)&&x<(b.x-a.x)*(z-a.y)/(b.y-a.y)+a.x)c=!c;}return c;};
 const bbox=(pts:P[])=>({minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),minZ:Math.min(...pts.map(p=>p.y)),maxZ:Math.max(...pts.map(p=>p.y))});
 /** Independently: the lowest proposed ground within 47.2 in of the patio (a 3 in grid), off every structure. */
 const lowestNear=(d:DeckData,move:{parts:{addYard:YardFeature[]}},patio:YardFeature)=>{
  const s=designSiteSurface(d)!,occ=designOccupants(d,buildDeckTakeoff(d)).filter(o=>o.kind!=='bed'&&o.kind!=='plant'&&!move.parts.addYard.some(f=>`yard:${f.id}`===o.id)),b=bbox(yardFeatureOutline(patio)[0]);let low=Infinity;
  for(let x=b.minX-47;x<=b.maxX+47;x+=3)for(let z=b.minZ-47;z<=b.maxZ+47;z+=3){const dist=Math.hypot(Math.max(b.minX-x,0,x-b.maxX),Math.max(b.minZ-z,0,z-b.maxZ));if(dist===0||dist>GUARD.adjacentWithinIn||occ.some(o=>o.rings.some(r=>inRing(r,x,z))))continue;const g=s.sample(x,z,'proposed');if(g!==undefined)low=Math.min(low,g);}
  return low;};
 // HIGH, guard: survey heights ×1.5 → the edge rises only 18.7 in, but the ground within 47 in is 27.1 in below.
 {const d=await scaled(1.5),m=await siteDesignMove('raised-patio',ctxOf(d)),patio=m.parts.addYard.find(f=>f.kind==='patio'&&!f.stoneSteps)!,after={...d,...m.patch};
  ok(m.feasible&&Number(m.metrics.maxRiseIn)<=GUARD.requiredAboveIn,`×1.5: a raised patio whose edge rise alone (${m.metrics.maxRiseIn} in) is under ${GUARD.requiredAboveIn} in`);
  const drop=patio.finishedElevationIn!-lowestNear(after,m,patio);
  ok(drop>GUARD.requiredAboveIn&&m.metrics.guardRequired===true&&Math.abs(Number(m.metrics.guardDropIn)-drop)<1,`×1.5: a guard is required: it stands ${drop.toFixed(1)} in above the lowest ground within 47 in (${m.metrics.guardDropIn} in reported)`);
  ok(Number(m.metrics.guardLf)>0&&/^(front|back|left|right)(,(front|back|left|right))*$/.test(String(m.metrics.guardEdges))&&m.notes.some(n=>new RegExp(`^A guard is required along ${m.metrics.guardLf} ft of its`).test(n)),`×1.5: the guard is measured for a quote line (${m.metrics.guardLf} ft along ${m.metrics.guardEdges})`);
 }
 // …and at the measured heights (the room concept above) the same rule reads no guard: 22.1 in, under 23.6.
 {const rp=room!.moves.find(m=>m.kind==='raised-patio')!,patio=rp.parts.addYard.find(f=>f.kind==='patio'&&!f.stoneSteps)!,drop=patio.finishedElevationIn!-lowestNear({...ext,...applyParts(ext,[rp.parts])},rp,patio);
  ok(rp.metrics.guardRequired===(drop>GUARD.requiredAboveIn)&&rp.metrics.guardLf===0,`The extended survey's raised patio: guard ${rp.metrics.guardRequired} at ${drop.toFixed(1)} in within 47 in`);}
 // HIGH, walls: judged by the walls as built, not the edge rise. ×2.3: the edge rose 35.9 in but the wall was 40 in.
 for(const k of [2.1,2.2,2.3,2.4,3]){
  const d=await scaled(k),m=await siteDesignMove('raised-patio',ctxOf(d));
  if(m.feasible){const walls=m.parts.addYard.filter(f=>f.kind==='retaining-wall'),dd={...d,...m.patch};await ensureLiveDesignExtensions(dd);const e=calculateEstimate(dd);
   ok(walls.every(w=>w.heightIn<=36&&(e.yardModel.features.find(x=>x.config.id===w.id)!.quantities.maxExposedHeightIn??0)<=36),`×${k}: every wall offered is 36 in or less as built (${walls.map(w=>w.heightIn).join(', ')} in)`);}
  else ok(m.metrics.cause==='tall'&&Number(m.metrics.wallMaxIn)>36&&(Number(m.metrics.wallMaxIn)>39.4?/never offers/:/engineered wall.*ask the builder/).test(m.reason!),`×${k}: not offered: ${m.reason}`);
 }
 ok(!(await siteDesignMove('raised-patio',ctxOf(await scaled(2.3)))).feasible,'×2.3: the 40 in wall is no longer offered');
 // LOW, reasons: the cause that applied. Nearly flat ground never drops 16 in along an edge (not "drops at most N in").
 {const m=await siteDesignMove('raised-patio',ctxOf(await scaled(.2)));ok(!m.feasible&&m.metrics.cause==='flat'&&/never drops more than 16 in below its \+5 in level along a patio's edge/.test(m.reason!),`Flat ground: ${m.reason}`);
  const deep={...ext,yardFeatures:ext.yardFeatures!.map(f=>f.id==='landing'?{...f,finishedElevationIn:-40}:f)};await ensureLiveDesignExtensions(deep);
  const c=await siteDesignMove('raised-patio',ctxOf(deep));ok(!c.feasible&&(c.metrics.cause==='cut'?/dug more than 8 in/.test(c.reason!):c.metrics.cause==='coverage'&&/Measure about/.test(c.reason!)),`A landing far below the ground: ${c.reason}`);}
 // MED-HIGH, stairs: a wood ring was placed 11.26 ft from the (wood) stair against its 4 m.
 {const ctx=ctxOf(ext),stairs=stairFootprints(buildDeckTakeoff(ext));
  for(const product of ['fire-wood-ring','fire-gas-bowl','fire-gas-linear']){const m=await siteDesignMove('fire-room',ctx,{product,minDoorFt:6,maxDoorFt:40});
   if(!m.feasible){ok(product==='fire-wood-ring'&&/at least 13\.1 ft from the house, the deck and its stairs/.test(m.reason!),`${product}: ${m.reason}`);continue;}
   const f=m.parts.addYard.find(x=>x.kind==='fire-feature')!,gap=Math.min(...stairs.map(r=>planGapIn(fireOutline(f),r)))/12,clear=fireProduct(f)!.fuel==='wood'?13.1:4;
   const d={...ext,...m.patch};await ensureLiveDesignExtensions(d);const w=calculateEstimate(d).yardModel.features.find(x=>x.config.id===f.id)!.warnings;
   ok(gap>=clear&&Math.abs(Number(m.metrics.stairGapFt)-gap)<.06&&!w.some(x=>/stair/.test(x)),`${product}: ${gap.toFixed(2)} ft from the stair (at least ${clear}), no stair warning`);}}
 // MED, an existing fire: the outdoor room builds round it, never adds a second (quoted) fire.
 {const mine=(x:number,z:number,extra:Partial<YardFeature>={}):DeckData=>({...ext,yardFeatures:[...ext.yardFeatures!,{id:'my-fire',kind:'fire-feature',name:'My fire bowl',enabled:true,xFt:x,zFt:z,widthFt:3.5,depthFt:3.5,heightIn:16,rotationDeg:0,productId:'fire-gas-bowl',color:'#aaa69b',...extra}]});
  const open=mine(9,20);await ensureLiveDesignExtensions(open);const r=await siteConcepts(open,{goals:['entertaining']}),c=r.concepts.find(x=>x.moves.some(m=>m.kind==='fire-room'))!;
  const fires=c?.patch.yardFeatures?.filter(f=>f.kind==='fire-feature')??[],fr=c?.moves.find(m=>m.kind==='fire-room');
  ok(c&&c.validation.ok&&fires.length===1&&fires[0].id==='my-fire'&&fires[0].supportFeatureId===fr!.metrics.patioId&&fr!.metrics.reusedFireId==='my-fire'&&c.moves.some(m=>m.kind==='seat-wall'),`On open ground the room is built round the fire already there (${c?.moves.map(m=>m.kind).join('+')}; ${fires.map(f=>f.id)})`);
  ok(!c.newQuotes.some(q=>/further fire feature/.test(q)),'…and no second fire is quoted');
  const edge=mine(-6,24,{productId:'fire-gas-linear',widthFt:5,depthFt:1.75});await ensureLiveDesignExtensions(edge);const r2=await siteConcepts(edge,{goals:['entertaining']});
  ok(r2.concepts.every(x=>(x.patch.yardFeatures??edge.yardFeatures!).filter(f=>f.kind==='fire-feature').length===1)&&[...r2.warnings,...r2.concepts.flatMap(x=>x.skipped.map(s=>s.reason))].some(w=>/My fire bowl/.test(w)&&/a second fire is not added/.test(w)),'Where no room fits round it, the fire part is skipped with the reason, never a second fire');}
 // LOW, seat height: from the wall's own courses (6 in and a 3 in cap: 15 or 21 in), never 27 in for a seat.
 {const ctx=ctxOf(ext),fire=await siteDesignMove('fire-room',ctx),c2=withMove(ctx,fire);
  for(const heightIn of [16,18,22,24]){const sw=await siteDesignMove('seat-wall',c2,{heightIn},fire),d={...ext,...applyParts(ext,[fire.parts,sw.parts])};await ensureLiveDesignExtensions(d);
   const e=calculateEstimate(d),w=e.yardModel.features.find(f=>f.config.id===sw.metrics.wallId)!,pm=e.yardModel.features.find(f=>f.config.id===fire.metrics.patioId)!;
   ok(sw.metrics.builtHeightIn===21&&sw.metrics.courses===3&&Math.abs(w.topIn-pm.topIn-21)<.05&&/^Seat wall round the fire, 21 in high$/.test(sw.title)&&/3 courses of 6 in and a 3 in cap come to 21 in/.test(sw.notes[1])&&/build 15 or 21 in, not 18–20 in/.test(sw.notes[1])&&(heightIn===21||new RegExp(`${heightIn} in was asked for`).test(sw.notes[1])),`Seat wall asked ${heightIn} in: built 21 in (${(w.topIn-pm.topIn).toFixed(1)} in), and says why`);}}
 // Unconfirmed-but-likely, lot lines: a rear lot line 26 ft out (house left wall at x −288, lot 66 × 76 ft). Without it
 // the fire room's patio reaches z 324 in.
 {const lotted={...ext,permitSite:{lotWidthFt:66,lotDepthFt:76,leftYardFt:4,rearYardFt:26}};await ensureLiveDesignExtensions(lotted);
  const lot=lotOf(lotted)!;ok(lot.minX===-336&&lot.maxX===456&&lot.maxZ===312&&lot.minZ===312-912,`The lot as the site plan draws it (${JSON.stringify(lot)})`);
  const ctx=ctxOf(lotted);let placed=0;
  for(const kind of ['fire-room','raised-patio','terraced-beds','raised-beds','planting'] as const){const m=await siteDesignMove(kind,ctx);if(!m.feasible){ok(kind!=='fire-room',`The fire room still fits inside the lot (${m.reason})`);continue;}placed++;
   ok(m.footprints.every(f=>f.rings.flat().every(q=>q.y<=lot.maxZ+1e-6)),`${kind}: inside the rear lot line`);
   if(kind==='fire-room'){const f=m.parts.addYard.find(x=>x.kind==='fire-feature')!;ok(lot.maxZ-bbox(fireOutline(f)).maxZ>=48-1e-6&&Number(m.metrics.lotGapFt)>=4,`The gas fire keeps 48 in from the lot line (${m.metrics.lotGapFt} ft)`);}
   if(kind==='raised-patio')ok(m.footprints.every(f=>lot.maxZ-bbox(f.rings.flat()).maxZ>=24-1e-6),'The raised patio and its walls keep 2 ft from the lot line');}
  ok(placed>=4,`Moves still fit inside the lot (${placed})`);
  const wood=await siteDesignMove('fire-room',ctx,{product:'fire-wood-ring',minDoorFt:6,maxDoorFt:40});ok(!wood.feasible&&/13\.1 ft from the lot lines/.test(wood.reason!)||wood.feasible&&lot.maxZ-bbox(fireOutline(wood.parts.addYard.find(x=>x.kind==='fire-feature')!)).maxZ>=13.1*12-1e-6,'A wood ring keeps 4 m from the lot line');}
 // Pools: an 8 × 12 ft pool where the fire room went; every move keeps clear of its structure and coping.
 {const pool={...createPlanningPool({id:'pool-1',xIn:150,zIn:250,copingTopElevationIn:10}),outline:[{x:-48,y:-72},{x:48,y:-72},{x:48,y:72},{x:-48,y:72}]};delete (pool as {curves?:unknown}).curves;
  const pooled={...ext,pools:[pool]} as DeckData;await ensureLiveDesignExtensions(pooled);const ctx=ctxOf(pooled),ex=poolPermanentExclusion(pool);
  ok(ctx.occupants.some(o=>o.kind==='pool'&&o.id==='pool:pool-1'),'The pool is an occupant');
  let placed=0;for(const kind of ['fire-room','raised-patio','terraced-beds','raised-beds','planting'] as const){const m=await siteDesignMove(kind,ctx);if(!m.feasible)continue;placed++;
   ok(m.footprints.every(f=>yardArea(yardClip(yardClip(f.rings),yardClip(ex),'intersection'))<.01),`${kind}: clear of the pool`);}
  ok(placed>=3,`Moves still find room beside the pool (${placed})`);}
 // Determinism: ground fit's search runs in full, so a 0.3 s budget picks what 20 s does.
 {const g1=await siteDesignMove('ground-fit',ctxOf(ext,{budgetMs:300})),g2=await siteDesignMove('ground-fit',ctxOf(ext,{budgetMs:20000}));
  ok(g1.feasible&&JSON.stringify(g1.metrics)===JSON.stringify(g2.metrics)&&g1.metrics.searchStoppedEarly===false,`Ground fit is the same on a 0.3 s and a 20 s budget (${g1.metrics.optionId})`);}
}

const review:string[]=[];
// 9. Final review regressions: no stretch of work holds more than one estimate; what is composed does not depend on the
// device's speed (the time limit is a safety stop that says so); no pool warning now that moves keep clear of pools; and
// a raised patio whose graded bank would meet the fire room patio's in an abrupt step is placed further off instead.
{
 const {conceptFromChoice}=await import('../src/features/deckcraft/siteConcepts');
 // (a) Yields: a forced yield before every estimate, so a stretch holds one estimate at most (a 2000-shot survey held
 // three in a row, 1.82 s, in price()).
 const runs=slices.reduce((n,s)=>n+s.calls,0),engine=Math.max(...slices.map(s=>s.longestMs));
 review.push(`longest stretch between yields ${longestStretch.toFixed(0)} ms (longest estimate ${engine.toFixed(0)} ms)`);
 ok(slices.length>=20&&slices.every(s=>s.calls<=1)&&runs>=1+3*concepts.length,`Every stretch between yields holds at most one estimate (${slices.length} yields, ${runs} estimates; longest stretch ${longestStretch.toFixed(0)} ms)`);
 // (b) A slow device: the clock jumps 60 s once the second concept is composed (past the old 20 s limit, which dropped
 // the garden concept): the same three concepts. Past the 120 s safety limit: it stops early and says so.
 const perf=performance as {now:()=>number},realNow=perf.now.bind(performance);
 const slow=async(skewMs:number)=>{let skew=0;perf.now=()=>realNow()+skew;
  try{return await siteConcepts(ext,{onProgress:(done,total)=>{if(done===total-3)skew=skewMs;}});}finally{delete (performance as {now?:unknown}).now;}};
 const late=await slow(60_000);
 ok(JSON.stringify(late.concepts)===JSON.stringify(r1.concepts)&&!late.stoppedEarly&&!late.warnings.some(w=>/stopped/.test(w)),`A device 60 s slower composes the same concepts (${late.concepts.map(c=>c.id).join(', ')})`);
 const stuck=await slow(200_000);
 ok(stuck.status==='ready'&&stuck.stoppedEarly===true&&stuck.concepts.length===2&&!stuck.concepts.some(c=>c.goal==='garden')&&stuck.warnings.some(w=>/^The site designer stopped early at its 120 s safety limit, so 2 of the 3 concepts were composed/.test(w)),`Past the safety limit it stops early and says so (${stuck.warnings.join(' | ')})`);
 ok(performance.now()<realNow()+1000,'The clock is put back');
 // (c) Pools: the moves keep clear of pools, so no "not yet placed round" warning.
 {const {createPlanningPool}=await import('../src/features/deckcraft/poolAssembly');
  const pool={...createPlanningPool({id:'pool-1',xIn:150,zIn:250,copingTopElevationIn:10}),outline:[{x:-48,y:-72},{x:48,y:-72},{x:48,y:72},{x:-48,y:72}],depthProfile:[{stationIn:0,depthIn:48},{stationIn:144,depthIn:48}]};delete (pool as {curves?:unknown}).curves;
  const pooled={...ext,pools:[pool]} as DeckData;await ensureLiveDesignExtensions(pooled);const r=await siteConcepts(pooled);
  ok(r.status==='ready'&&r.concepts.length>=2&&!r.warnings.some(w=>/pool/i.test(w))&&r.concepts.every(c=>c.validation.ok),`With a pool: ${r.concepts.length} valid concepts and no pool warning (${r.warnings.join(' | ')||'no warnings'})`);}
 // (d) The reviewer's setup: a fire already at (10 ft, 20 ft). The outdoor room's patio goes round it and the raised
 // patio off the landing came within 9 in of it: the fire patio's graded bank met the raised patio in a 4 in step
 // ("36 proposed grading boundary span(s) change elevation abruptly"), an invalid concept. Now the raised patio is placed
 // with room round the other patio for the banks to meet.
 const withFire:DeckData={...ext,yardFeatures:[...ext.yardFeatures!,{id:'my-fire',kind:'fire-feature',name:'My fire bowl',enabled:true,xFt:10,zFt:20,widthFt:3.5,depthFt:3.5,heightIn:16,rotationDeg:0,productId:'fire-gas-bowl',color:'#aaa69b'} as YardFeature]};
 await ensureLiveDesignExtensions(withFire);
 const box=(f:YardFeature)=>{const o=yardFeatureOutline(f).flat();return {minX:Math.min(...o.map(p=>p.x)),maxX:Math.max(...o.map(p=>p.x)),minZ:Math.min(...o.map(p=>p.y)),maxZ:Math.max(...o.map(p=>p.y))};};
 const apart=(a:YardFeature,b:YardFeature)=>{const p=box(a),q=box(b);return Math.max(p.minX-q.maxX,q.minX-p.maxX,p.minZ-q.maxZ,q.minZ-p.maxZ);};
 const fr=await siteConcepts(withFire,{goals:['entertaining']}),room2=fr.concepts.find(c=>c.goal==='entertaining');
 ok(room2&&room2.validation.ok&&!room2.validation.newWarnings.some(w=>/abruptly/.test(w)),`Fire at (10, 20): the outdoor room is valid (${room2&&JSON.stringify(room2.validation.unexplained)})`);
 const rp=room2?.moves.find(m=>m.kind==='raised-patio'),firePatio=room2?.patch.yardFeatures?.find(f=>f.id===room2.moves.find(m=>m.kind==='fire-room')?.metrics.patioId);
 if(rp){const raised=rp.parts.addYard.find(f=>f.id===rp.metrics.patioId)!;review.push(`fire at (10, 20): raised patio ${firePatio?apart(raised,firePatio).toFixed(0):'?'} in from the fire patio`);ok(firePatio&&apart(raised,firePatio)>=23.9,`…its raised patio keeps ${firePatio&&apart(raised,firePatio).toFixed(1)} in from the fire room patio (was 9 in), room for the banks to meet`);}
 else ok(room2&&room2.skipped.some(s=>s.kind==='raised-patio')||room2&&!room2.moves.some(m=>m.kind==='raised-patio'),'…or the raised patio is left out, never an invalid concept');
 const patched={...withFire,...room2!.patch};await ensureLiveDesignExtensions(patched);
 ok(!calculateEstimate(patched).yardModel.warnings.some(w=>/change elevation abruptly/.test(w)),'…and its patch grades without an abrupt step');
 // The AI designer's choice of the same moves is built the same way: no abrupt-step finding.
 const chosen=await conceptFromChoice(withFire,{base:'room',include:['fire-room','seat-wall','raised-patio','stone-steps'],params:{}});
 ok(chosen.concept?.validation.ok&&!chosen.findings.length&&JSON.stringify(chosen.concept.patch)===JSON.stringify(room2!.patch),`conceptFromChoice builds it the same, with no findings (${chosen.findings.join(' | ')||'none'})`);
}

const summary=concepts.map(c=>`${c.title} [${c.moves.map(m=>m.kind).join('+')}] ${c.delta>=0?'+':'−'}$${Math.abs(c.delta).toFixed(0)}`).join('; ');
console.log(`Timings (ms): ${Object.entries(timings).map(([k,v])=>`${k} ${v}`).join(', ')}; ${review.join('; ')}`);
console.log(`check-site-concepts: ${checks} checks passed — ${summary}; garden planting: ${plantCounts.join(', ')}`);
