import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {getBoardRows,type FootprintPlan} from '../src/features/deckcraft/lib/deckGeometry';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
assert.equal(DEFAULT_DECK.pictureFrameRows,1);
let checks=1;
for(const width of [80,150,192,250,390])for(const angleDeg of [0,45]){
 const fp:FootprintPlan={outline:[{x:0,y:0},{x:width,y:0},{x:width,y:60},{x:0,y:60}],bounds:{w:width,h:60},isCurved:false};
 const full=getBoardRows(fp,{boardWidth:5.5,gap:.1875,angleDeg,inset:0,maxBoardLen:10000});
 const cuts=getBoardRows(fp,{boardWidth:5.5,gap:.1875,angleDeg,inset:0,maxBoardLen:192});
 assert.equal(cuts.length,full.reduce((n,b)=>n+Math.ceil(b.length/192),0),'Each clipped course uses the minimum number of stock boards');
 assert(cuts.every(b=>b.length<=192+.001),'No board exceeds stock');checks+=2;
}
const m=buildDeckTakeoff(structuredClone(DEFAULT_DECK));assert(m.levels[0].boards.some(b=>b.role==='border'));assert.equal(m.levels[0].breakers.length,0);checks+=2;
const plain=buildDeckTakeoff({...structuredClone(DEFAULT_DECK),pictureFrameRows:0});assert(!plain.levels[0].boards.some(b=>b.role==='border'),'Explicit saved no-frame choices remain supported');checks++;
console.log('Picture-frame default and minimum seams: '+checks+' checks passed');
