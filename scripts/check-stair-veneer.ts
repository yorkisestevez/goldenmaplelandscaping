import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData} from '../src/features/deckcraft/types';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {getStairBoards} from '../src/features/deckcraft/stairBoards';
import {stairVeneerLayout} from '../src/features/deckcraft/stairVeneerLayout';
let checks=0;
for(const material of ['tt_terrain','tt_terrain_plus'])for(const stairPosition of ['Front','Back','Left','Right'] as const)for(const stairType of ['Straight','Landing','Winder'] as const){
  const data:DeckData={...structuredClone(DEFAULT_DECK),deckType:'Freestanding',deckingMaterial:material,stairPosition,stairType,height:48,stairWidth:48};
  const model=buildDeckTakeoff(data),before=JSON.stringify(model.stringers),layout=stairVeneerLayout(data,model),boards=getStairBoards(data,model);
  assert.equal(JSON.stringify(model.stringers),before,'veneer never lowers or edits stringer notches');assert(layout.woodBoxes.length>0);
  assert.equal(layout.bracketBoxes.length,layout.woodBoxes.length*4);assert.equal(layout.rows.find(r=>r.id==='terrain-veneer-angles')?.qty,layout.woodBoxes.length*2);assert(layout.rows.every(r=>r.rate===null));
  if(stairType!=='Straight')assert.equal(layout.status,'partial');else assert.equal(layout.status,'modeled-straight');
  const expected=model.flights.filter(f=>f.type==='Straight').reduce((sum,f)=>sum+Math.max(0,f.risers-1)*Math.max(0,f.stringerOffsets.length-1)*2,0);assert.equal(layout.woodBoxes.length,expected);
  for(const wood of layout.woodBoxes){
    assert.equal(wood.h,1.5);assert.equal(wood.d,5.5);assert(wood.w>0&&wood.w<=14.5);
    const a=wood.angle??0,c=Math.cos(a),s=Math.sin(a),corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:wood.x+c*u*wood.w/2+s*v*wood.d/2,y:wood.z-s*u*wood.w/2+c*v*wood.d/2}));
    assert(boards.some(board=>{if(Math.abs(board.y-board.h/2-wood.y-wood.h/2)>.0001||!board.polygon)return false;return corners.every(p=>{const turns=board.polygon!.map((q,i)=>{const r=board.polygon![(i+1)%board.polygon!.length];return (r.x-q.x)*(p.y-q.y)-(r.y-q.y)*(p.x-q.x);});return turns.every(t=>t>=-.0001)||turns.every(t=>t<=.0001);});}),'each support fits directly beneath one actual tread board');
  }
  checks++;
}
for(const material of ['cedar','tt_vintage','tt_prime']){const data={...DEFAULT_DECK,deckingMaterial:material};assert.equal(stairVeneerLayout(data,buildDeckTakeoff(data)).woodBoxes.length,0);checks++;}
const narrow={...DEFAULT_DECK,deckingMaterial:'tt_terrain',boardWidth:3.5 as const};assert.equal(stairVeneerLayout(narrow,buildDeckTakeoff(narrow)).status,'unsupported');checks++;
console.log(`Stair veneer: ${checks} geometry, support-containment, connector-count and no-notch-change scenarios passed.`);
