import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {stairShapeContext,resizeStairPoint,extendStairPoints} from '../src/features/deckcraft/designer/stairShapeEdits';
import {parseDesign,serializeDesign} from '../src/features/deckcraft/designPersistence';
const data={...DEFAULT_DECK,width:20,length:12,height:36,levels:1,stairFlights:1,stairWidth:48,stairOffset:50},c=stairShapeContext(data,buildDeckTakeoff(data));
const patch=resizeStairPoint(data,c,1,{x:c.points[1].x+24,y:c.points[1].y});assert.equal(patch.stairWidth,72);
const next={...data,...patch},resized=stairShapeContext(next,buildDeckTakeoff(next));assert.deepEqual(resized.points[0],c.points[0]);
for(const start of [true,false]){const p=extendStairPoints(c,start),d={...data,...p},ctx=stairShapeContext(d,buildDeckTakeoff(d));assert.equal(ctx.points.length,3);assert.deepEqual(ctx.resolve(ctx.points).issues,[]);assert(buildDeckTakeoff(d).flights.some(f=>f.id.includes('path')));assert.deepEqual(parseDesign(serializeDesign(d)).stairPath,d.stairPath);}
const wide=resizeStairPoint(data,c,1,{x:9000,y:144});assert.equal(wide.stairWidth,120);
console.log('Stair width anchoring, bounds, both corner extensions, model flights and save/load passed.');
