import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {primaryStair,stairTargets} from '../src/features/deckcraft/designer/planEditMath';
import {stairDragPlacement} from '../src/features/deckcraft/designer/stairDragPlacement';
import {parseDesign,serializeDesign} from '../src/features/deckcraft/designPersistence';
const data={...DEFAULT_DECK,width:20,length:12,height:36,levels:1,stairFlights:1,stairOffset:50},model=buildDeckTakeoff(data),targets=stairTargets(data,model,[]);
assert(targets.length>=3);assert(!targets.some(t=>t.patch.stairPosition==='Back'));
let checks=0;
for(const cursor of [{x:240,y:72},{x:0,y:40},{x:100,y:144},{x:240,y:10000}]){
 const result=stairDragPlacement(data,model,targets,cursor,60)!;assert(result);assert(Number(result.patch.stairOffset)>=0&&Number(result.patch.stairOffset)<=100);
 const next={...data,...result.patch},actual=primaryStair(next,buildDeckTakeoff(next))!;assert(actual);
 assert(Math.abs(actual.centre.x-result.centre.x)<.001);assert(Math.abs(actual.centre.y-result.centre.y)<.001);
 const restored=parseDesign(serializeDesign(next));assert.equal(restored.stairPosition,next.stairPosition);assert.equal(restored.stairOffset,next.stairOffset);checks++;
}
assert.equal(stairDragPlacement(data,model,[],{x:0,y:0},60),null);
console.log('Passed '+checks+' stair placement/model/save-load checks plus unavailable-edge checks.');
