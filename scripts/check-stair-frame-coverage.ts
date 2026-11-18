import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {getStairBoards} from '../src/features/deckcraft/stairBoards';
import {polygonCut,offsetPolygons,signedArea} from '../src/features/deckcraft/lib/polygonCuts';
import {stairStock} from '../src/features/deckcraft/schedule';
import {DECKING_CATALOGUE} from '../src/features/deckcraft/manufacturerRuntimeCatalogue';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import type {DeckData} from '../src/features/deckcraft/types';
let scenarios=0,checks=0;
const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};
const area=(ps:{x:number;y:number}[][])=>ps.reduce((s,p)=>s+Math.abs(signedArea(p)),0);
const cases:DeckData[]=[];
for(const stairType of ['Straight','Landing','Winder'] as const)for(const stairPosition of ['Front','Left','Right'] as const)for(const stairTurn of ['Left','Right'] as const)for(const stairWidth of [36,60,84])cases.push({...DEFAULT_DECK,width:20,length:16,height:72,stairFlights:1,stairType,stairPosition,stairTurn,stairWidth,pictureFrameRows:1});
const points=[{x:0,y:144},{x:192,y:144},{x:192,y:0}];
for(const path of [points,[...points].reverse()])cases.push({...DEFAULT_DECK,deckType:'Freestanding',width:16,length:12,height:30,stairFlights:1,stairPath:{points:path},stairRiserCount:5,stairTreadDepthIn:12,pictureFrameRows:1});
for(const d of cases){
 const m=buildDeckTakeoff(d),bs=getStairBoards(d,m);ok(m.treads.length>0,'Scenario has physical treads');
 for(const t of m.treads){
  const a=t.angle??0,c=Math.cos(a),s=Math.sin(a),p=t.polygon??[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:t.x+c*u*t.w/2+s*v*t.d/2,y:t.z-s*u*t.w/2+c*v*t.d/2}));
  const pieces=bs.filter(b=>Math.abs(b.y-t.y)<1e-6).map(b=>b.polygon!);
  // Expand only by the allowed rear/board joint clearance; a missing strip remains visible.
  const tolerance=Math.max(m.stairSupport.rearGapIn,m.stairSupport.boardGapIn,m.gap)+.01;
  const missing=polygonCut([p],pieces.flatMap(b=>offsetPolygons([signedArea(b)<0?[...b].reverse():b],-tolerance)),true);
  ok(area(missing)<.02,`${d.stairType}/${d.stairPosition}/${d.stairWidth}: uncovered tread area ${area(missing)}`);
  const owned=pieces.filter(b=>area(polygonCut([b],[p]))>.001);
  for(let i=0;i<owned.length;i++)for(let j=i+1;j<owned.length;j++)ok(area(polygonCut([owned[i]],[owned[j]]))<.02,'Tread boards do not overlap');
  const outside=polygonCut(owned,[p],true);ok(area(outside)<.02,'Each tread board stays inside its assembly boundary');
 }
 const rows=stairStock(d,m),frame=rows.find(r=>r.name.startsWith('Stair picture-frame'))!;
 ok(!!frame,'Border has a distinct stock row');
 ok(Math.abs(frame.installedLf-bs.filter(b=>b.role==='border').reduce((n,b)=>n+b.w/12,0))<1e-6,'Border cut quantities equal rendered pieces');
 ok(frame.orderedLf>=frame.installedLf&&!frame.unresolvedIn.length,'Border stock includes cutting waste and no lost oversize pieces');
 scenarios++;
}
const voyage=DECKING_CATALOGUE.find(m=>m.id==='deck_voyage')!;
const d={...cases[0],deckingMaterial:'tt_prime_plus',deckingColor:'Coconut Husk',deckFinishes:{border:`deck_voyage:${voyage.colors[0].name}` as const}};
const borderStock=stairStock(d,buildDeckTakeoff(d)).find(r=>r.name.startsWith('Stair picture-frame'))!;
ok(borderStock.section.includes(voyage.colors[0].name)&&borderStock.section.includes(voyage.name),'Selected border product appears in its own material schedule');
ok(borderStock.stockLengthIn===240&&borderStock.section.includes('availability pending'),'Manufacturer stock length never claims supplier confirmation');
const estimate=calculateEstimate(d),frame=estimate.sections.find(s=>s.title==='Stair picture-frame detail');
ok(!!frame&&!frame.quoteRequired&&frame.total>0&&frame.items.every(i=>i.cost!==null),'2026-10 stair picture-frame detail is priced (mitre premium, not a pending quote)');
ok(frame!.items.some(i=>/mitre|Credits the Stairs assembly allowance/i.test(i.spec)),'Existing assembly allowance is credited, not double charged');
ok(!estimate.quoteRequired.some(q=>q.startsWith('Stair picture-frame')),'Priced detail leaves the quote list');
const noFrame=calculateEstimate({...d,pictureFrameRows:0,pattern:'Straight'});ok(!noFrame.sections.some(s=>s.title==='Stair picture-frame detail'),'No fabricated frame quote for an unframed stair');
// Saves from before the 2026-10 build rules (marked 'legacy' or unmarked) keep 9b2ee11's unframed treads on a framed deck: one tread
// row in 9b's wording, no border row, no stair-frame detail section or quote line.
for(const legacy of [{...cases[0],buildRules:'legacy' as const},(({buildRules:_rules,...rest})=>rest)(cases[0]),{...cases[0],buildRules:'legacy' as const,pictureFrameRows:0 as const,pattern:'Picture Frame' as const}]){
 const lm=buildDeckTakeoff(legacy),rows=stairStock(legacy,lm),est=calculateEstimate(legacy);
 ok(getStairBoards(legacy,lm).every(b=>b.role===undefined),'Legacy framed stairs draw no stair frame pieces');
 ok(rows.length>0&&!rows.some(r=>r.name.startsWith('Stair picture-frame')),'Legacy framed stairs have no border stock row');
 ok(rows[0].name==='Stair tread decking — included in per-riser allowance'&&rows[0].section===`${legacy.boardWidth} in decking`,'Legacy tread row keeps its 9b2ee11 wording');
 ok(!est.sections.some(s=>s.title==='Stair picture-frame detail')&&!est.quoteRequired.some(q=>q.startsWith('Stair picture-frame')),'Legacy framed stairs show no stair-frame detail line');
}
console.log(`${checks} stair frame coverage and stock checks passed across ${scenarios} layouts.`);
