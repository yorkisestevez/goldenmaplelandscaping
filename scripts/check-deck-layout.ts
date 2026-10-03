import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff,polygonArea} from '../src/features/deckcraft/deckTakeoff';
import {getFootprint} from '../src/features/deckcraft/lib/deckGeometry';
import {landingSplit,layoutEdges,layoutExitDeck,layoutOpening,stairOffsetAtPoint,stairTurnForDirection,shapePatch} from '../src/features/deckcraft/layoutControls';
import {serializeDesign,parseDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {exportDeckDXF} from '../src/features/deckcraft/designExports';
import type {DeckData} from '../src/features/deckcraft/types';
import {mergeDesignPatch} from '../src/features/deckcraft/designPatch';
let checks=0;function check(name:string,fn:()=>void){try{fn();checks++;}catch(e){throw new Error(name,{cause:e});}}
const base:DeckData={...structuredClone(DEFAULT_DECK),height:72,stairType:'Landing',deckType:'Freestanding'};
check('L cut-out mirrors without changing polygon area or winding',()=>{
  const right=getFootprint({...base,shape:'L-Shape'}),left=getFootprint({...base,shape:'L-Shape',cutoutCorner:'Left'});
  assert.deepEqual(left.outline,[...right.outline].reverse().map(p=>({x:right.bounds.w-p.x,y:p.y})));
  assert.equal(polygonArea(left),polygonArea(right));assert(left.outline.reduce((n,p,i)=>{const q=left.outline[(i+1)%left.outline.length];return n+p.x*q.y-q.x*p.y;},0)>0);
});
for(const shape of ['Rectangle','L-Shape','Multi-corner','Curved'] as const)for(const corner of ['Left','Right'] as const)check(`shape ${shape}/${corner} generates shared geometry`,()=>{
  const d={...base,...shapePatch(base,shape,corner)},m=buildDeckTakeoff(d);assert(m.quantities.area>0);assert(m.quantities.installedBoardPieces>0);const finite=(v:unknown):void=>{if(typeof v==='number')assert(Number.isFinite(v));else if(v&&typeof v==='object')Object.values(v).forEach(finite);};finite(m);assert(exportDeckDXF(d,m).includes('EOF'));
});
for(const edge of ['Front','Left','Right','Back'] as const)for(const dir of ['Left','Right'] as const)check(`walking-down turn ${edge}/${dir}`,()=>{
  const d={...base,stairPosition:edge},m=buildDeckTakeoff(d),opening=layoutOpening(d,m,edge),turn=stairTurnForDirection(opening,dir);
  const result=buildDeckTakeoff({...d,stairTurn:turn}),lower=result.flights.find(f=>f.id==='grade-0-lower')!;
  const dx=lower.end.x-lower.start.x,dz=lower.end.z-lower.start.z,sign=dir==='Left'?1:-1;
  assert(dx*opening.outward.y*sign+dz*(-opening.outward.x)*sign>0);
});
for(const after of [1,2,5,8,9])for(const straight of [false,true])check(`landing at ${after} risers / inline ${straight}`,()=>{
  const d={...base,landingAfterRisers:after,landingStraight:straight},m=buildDeckTakeoff(d),upper=m.flights.find(f=>f.id==='grade-0-upper')!,lower=m.flights.find(f=>f.id==='grade-0-lower')!,landing=m.levels.find(l=>l.kind==='landing')!;
  assert.equal(upper.risers,after);assert.equal(upper.risers+lower.risers,10);assert(Math.abs(landing.top-(72-after*7.2))<1e-8);assert(Math.abs(lower.end.y)<1e-8);assert(m.quantities.landingArea>0);
  if(straight){assert.equal(lower.start.x,upper.start.x);assert(lower.start.z>upper.end.z);}
});
check('landing position stays valid after height changes',()=>{for(let n=4;n<=19;n++)for(const request of [undefined,1,5,18,99]){const s=landingSplit(n,request);assert(s.upper>=1&&s.upper<=14);assert(s.lower>=1&&s.lower<=14);assert.equal(s.upper+s.lower,n);}});
check('legacy omitted controls retain geometry',()=>{const legacy=buildDeckTakeoff(base),explicit=buildDeckTakeoff({...base,cutoutCorner:'Right',landingStraight:false,landingAfterRisers:5});assert.deepEqual(legacy,explicit);});
check('undo clears optional layout fields and preserves an exactly saveable legacy design',()=>{const changed={...base,landingStraight:true,landingAfterRisers:1,cutoutCorner:'Left' as const};const restored=mergeDesignPatch(changed,{landingStraight:undefined,landingAfterRisers:undefined,cutoutCorner:undefined});assert.equal(serializeDesign(restored),serializeDesign(base));assert.deepEqual(buildDeckTakeoff(restored),buildDeckTakeoff(base));});
check('layout fields round trip and invalid values fail closed',()=>{
  const d={...base,landingStraight:true,landingAfterRisers:3,cutoutCorner:'Left' as const},parsed=parseDesign(serializeDesign(d));assert.equal(parsed.landingStraight,true);assert.equal(parsed.landingAfterRisers,3);assert.equal(parsed.cutoutCorner,'Left');assert.deepEqual(buildDeckTakeoff(parsed).quantities,buildDeckTakeoff(d).quantities);
  for(const invalid of [{landingAfterRisers:0},{landingAfterRisers:19},{landingAfterRisers:2.5},{landingAfterRisers:NaN},{landingStraight:'yes'},{cutoutCorner:'Back'}])assert.throws(()=>validateDesign({...base,...invalid}));
});
for(const side of ['Front','Left','Right'] as const)check(`second section side ${side} exposes correct stair edges`,()=>{
  const d={...base,levels:2,height2:24,level2Position:side},m=buildDeckTakeoff(d),deck=layoutExitDeck(d,m);assert.equal(deck.top,24);assert(!layoutEdges(d,m).includes(side==='Front'?'Back':side==='Left'?'Right':'Left'));
});
for(const edge of ['Front','Left','Right','Back'] as const)check(`map offset ${edge} uses shared edge coordinates`,()=>{
  const m=buildDeckTakeoff(base),deck=layoutExitDeck(base,m),o=layoutOpening(base,m,edge,25),point={x:o.origin.x+o.along.x*o.width/2+deck.offset.x,y:o.origin.y+o.along.y*o.width/2+deck.offset.z};assert.equal(stairOffsetAtPoint(base,m,edge,point),25);
});
check('attached decks cannot select the house-side edge',()=>assert(!layoutEdges({...base,deckType:'Attached'},buildDeckTakeoff({...base,deckType:'Attached'})).includes('Back')));
console.log(`DECK LAYOUT OK — ${checks} shape, route, landing position, map placement and persistence checks.`);
