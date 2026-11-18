import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {getHousePlacement} from '../src/features/deckcraft/housePlacement';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {houseRailingConflicts,houseRailingReviewFlags} from '../src/features/deckcraft/houseRailingClearance';
import {serializeDesign,parseDesign} from '../src/features/deckcraft/designPersistence';
let count=0;
for(const height of [18,36,60,96])for(const width of [8,16,30])for(const houseDoorOffset of [10,50,90]){
  const data={...structuredClone(DEFAULT_DECK),height,width,houseDoorOffset},house=getHouseConfig(data),model=buildDeckTakeoff(data);
  assert.equal(houseRailingConflicts(data,model).filter(c=>c.openingId.startsWith('front-window-')).length,0,JSON.stringify({height,width,houseDoorOffset}));
  for(const w of house.openings.filter(o=>o.type==='Window'))assert(w.bottomIn>=height+60&&w.heightIn>=24&&w.bottomIn+w.heightIn<=house.storeyHeightIn-6);
  count++;
}
const base=structuredClone(DEFAULT_DECK),house=getHouseConfig(base),place=getHousePlacement(base);
for(const anchor of ['left','center','right'] as const)for(const offsetIn of [-48,24])for(const shape of ['Rectangle','L-Shape','Multi-corner','Curved'] as const){
  const data={...structuredClone(DEFAULT_DECK),shape,housePlacement:{anchor,offsetIn}},model=buildDeckTakeoff(data);
  assert.equal(houseRailingConflicts(data,model).filter(c=>c.openingId.startsWith('front-window-')).length,0,JSON.stringify({anchor,offsetIn,shape}));count++;
}
const measured={...base,houseConfig:{...house,openings:[{id:'measured-window',type:'Window' as const,facade:'Front' as const,offsetPct:(0-place.x0)/place.widthIn*100,bottomIn:48,widthIn:48,heightIn:54}]}};
assert.equal(getHouseConfig(measured),measured.houseConfig,'Never silently move a measured opening');
assert(houseRailingConflicts(measured,buildDeckTakeoff(measured)).some(c=>c.openingId==='measured-window'));
assert(calculateEstimate(measured).flags.some(f=>f.includes('railing crosses window')));
assert.equal(calculateEstimate(measured).total,calculateEstimate(base).total,'Opening placement never changes prices');
const cached=calculateEstimate(base),editedFlags=houseRailingReviewFlags(measured,cached.model,cached.flags);
assert(editedFlags.some(f=>f.includes('measured-window')),'A moved opening adds a live clash warning without rebuilding the priced takeoff');
assert(!houseRailingReviewFlags(base,cached.model,editedFlags).some(f=>f.startsWith('The railing crosses ')),'Moving the opening clear removes the cached warning');
assert.deepEqual(parseDesign(serializeDesign(measured)).houseConfig!.openings,measured.houseConfig.openings);
assert.equal(houseRailingConflicts({...measured,railingType:'None'},buildDeckTakeoff({...measured,railingType:'None'})).length,0);
console.log(`HOUSE RAILING CLEARANCE OK: ${count} generated house layouts; measured-opening conflict, unchanged pricing and persistence.`);
