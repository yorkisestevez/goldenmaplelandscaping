import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {getStairSupport,getStringerOffsets} from '../src/features/deckcraft/stairConstruction';
import {getStairBoards} from '../src/features/deckcraft/stairBoards';

assert.deepEqual(getStringerOffsets(48,12),[-23,-11,1,13,23]);
let layouts=0;
for(const spacing of [8,9,10,12])for(let width=24;width<=240;width+=.5){
 const x=getStringerOffsets(width,spacing);
 assert.equal(x[0],-width/2+1);assert.equal(x.at(-1),width/2-1);
 for(let i=1;i<x.length;i++){assert(x[i]-x[i-1]<=spacing+1e-7,'No bay exceeds selected maximum');assert(x[i]-x[i-1]>=1.5-1e-7,'Stringer bodies do not overlap');}
 layouts++;
}
let scenarios=0;
for(const material of ['pressure_treated','tt_vintage','tt_legacy','tt_premier','deck_voyage','deck_vista','tt_terrain'])
for(const stairType of ['Straight','Landing','Winder'] as const)
for(const stairTurn of ['Left','Right'] as const){
 const d={...structuredClone(DEFAULT_DECK),deckingMaterial:material,width:12,length:12,height:72,height2:36,levels:2,stairFlights:2,stairWidth:48,stairType,stairTurn};
 const m=buildDeckTakeoff(d),support=getStairSupport(d,m.gap);
 const straightOnly={...m,treads:m.treads.filter(t=>t.kind==='tread')};
 const treadBoards=getStairBoards(d,straightOnly);
 assert.equal(treadBoards.length,straightOnly.treads.length*2,'Every ordinary tread uses two full planks, no accidental narrow third sliver');
 assert(treadBoards.every(b=>Math.abs(b.d-d.boardWidth)<1e-6));
 assert.equal(m.quantities.riserBoardPieces,m.riserBoards.length);
 assert.equal(m.riserBoards.length,m.quantities.totalRisers,'Every actual rise is closed, including winder and level connection');
 assert(Math.abs(m.quantities.riserBoardLf-m.riserBoards.reduce((n,b)=>n+b.w/12,0))<1e-7);
 assert.equal(m.stringers.length,m.flights.reduce((n,f)=>n+f.stringerOffsets.length,0));
 let from=0;
 for(const f of m.flights){
  const panels=m.riserBoards.filter(b=>b.flightId===f.id);assert.equal(panels.length,f.risers);
  for(const [index,b]of panels.entries()){
   assert.equal(b.riserIndex,index);assert.equal(b.kind,'riser');assert(b.w<=b.stockLength);assert(b.h<=b.stockWidth);
   assert(Math.abs(b.h-(f.rise-1))<1e-7,'Riser fills the opening beneath upper tread');
   assert(Math.abs(b.y-b.h/2-(f.start.y-(index+1)*f.rise))<1e-7,'Riser bottom meets lower walking surface');
  }
  if(f.type==='Winder')continue;
  assert.deepEqual(f.stringerOffsets,getStringerOffsets(f.width,support.spacingIn,support.minimumStringers));
  const strings=m.stringers.slice(from,from+f.stringerOffsets.length);from+=strings.length;
  assert.equal(strings.length,f.stringerOffsets.length);
  for(let j=1;j<strings.length;j++)assert(Math.abs(Math.hypot(strings[j].a.x-strings[j-1].a.x,strings[j].a.z-strings[j-1].a.z)-(f.stringerOffsets[j]-f.stringerOffsets[j-1]))<1e-7,'Actual world geometry matches scheduled center stations');
 }
 assert.equal(m.stairSupport.spacingIn,({pressure_treated:12,tt_vintage:10,tt_legacy:10,tt_premier:9,deck_voyage:9,deck_vista:8,tt_terrain:12} as Record<string,number>)[material]);
 if(material==='tt_terrain'){assert.equal(support.status,'assembly-review');assert(m.issues.some(s=>s.includes('veneer')));}
 scenarios++;
}
console.log(`Stair construction passed: ${layouts} fixed-pitch layouts and ${scenarios} closed-riser / flight / manufacturer cases.`);
