import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {getBoardRows,type FootprintPlan} from '../src/features/deckcraft/lib/deckGeometry';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import '../src/features/deckcraft/lib/inlayGeometryRuntime';
import {planInlays} from '../src/features/deckcraft/lib/inlayGeometry';
assert.equal(DEFAULT_DECK.pictureFrameRows,1);
let checks=1;
for(const width of [80,150,192,250,390])for(const angleDeg of [0,45]){
 const fp:FootprintPlan={outline:[{x:0,y:0},{x:width,y:0},{x:width,y:60},{x:0,y:60}],bounds:{w:width,h:60},isCurved:false};
 // New designs (the 2026-10 build rules) split a clipped course only where it is longer than the stock board.
 const full=getBoardRows(fp,{boardWidth:5.5,gap:.1875,angleDeg,inset:0,maxBoardLen:10000,buildRules:'2026-10'});
 const cuts=getBoardRows(fp,{boardWidth:5.5,gap:.1875,angleDeg,inset:0,maxBoardLen:192,buildRules:'2026-10'});
 assert.equal(cuts.length,full.reduce((n,b)=>n+Math.ceil(b.length/192),0),'Each clipped course uses the minimum number of stock boards');
 assert(cuts.every(b=>b.length<=192+.001),'No board exceeds stock');checks+=2;
 // Designs saved before them keep the staggered courses they were quoted with: even rows lay whole boards from the
 // near end, odd rows start with a half board, every piece a gap apart, the last one cut to the far end.
 if(angleDeg===0){
  const legacy=getBoardRows(fp,{boardWidth:5.5,gap:.1875,angleDeg,inset:0,maxBoardLen:192}),rows=[...new Set(legacy.map(b=>b.cy))].sort((p,q)=>p-q),expected:number[]=[];
  for(const [row] of rows.entries()){let x=0,first=true;while(x<width-.001){const length=Math.min(first&&row%2?96:192,width-x);expected.push(length);x+=length+.1875;first=false;}}
  assert.deepEqual(rows.flatMap(cy=>legacy.filter(b=>b.cy===cy).sort((p,q)=>p.cx-q.cx).map(b=>Math.round(b.length*1e6)/1e6)),expected.map(n=>Math.round(n*1e6)/1e6),'Legacy rows keep the half-board stagger');
  assert(width>96&&width<=192?legacy.length>cuts.length:legacy.length>=cuts.length,'A course one stock board covers is split on the legacy rows only');
  assert.deepEqual(getBoardRows(fp,{boardWidth:5.5,gap:.1875,angleDeg,inset:0,maxBoardLen:192,buildRules:'legacy'}),legacy,"An explicit 'legacy' marker lays the same rows as an unmarked design");checks+=3;
 }
}
// A cut-in inlay lays its boards by the design's rules too: a 15 ft band course is one board on a new design, and the
// legacy stagger (a half board, then the rest) on a saved one.
for(const buildRules of [undefined,'legacy','2026-10'] as const){
 const ctx={fieldPolygons:[[{x:0,y:0},{x:180,y:0},{x:180,y:120},{x:0,y:120}]],boardWidth:5.5,gap:.1875,stockLength:192,centre:{x:90,y:60},straight:false,...(buildRules?{buildRules}:{})};
 const band=planInlays([{id:'b',kind:'band',direction:'across',boards:2}],ctx)[0];
 assert.deepEqual(band.status==='ok'&&band.boards.map(b=>Math.round(b.length*1000)/1000),buildRules==='2026-10'?[180,180]:[180,96,83.813],`A cut-in band follows the ${buildRules??'unmarked'} rows`);checks++;
}
const m=buildDeckTakeoff(structuredClone(DEFAULT_DECK));assert(m.levels[0].boards.some(b=>b.role==='border'));assert.equal(m.levels[0].breakers.length,0);checks+=2;
const plain=buildDeckTakeoff({...structuredClone(DEFAULT_DECK),pictureFrameRows:0});assert(!plain.levels[0].boards.some(b=>b.role==='border'),'Explicit saved no-frame choices remain supported');checks++;
console.log('Picture-frame default and minimum seams: '+checks+' checks passed');
