import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {landscapeAsset,landscapeLibraryPoint,newLandscapeObject} from '../src/features/deckcraft/landscapeCatalogue';
import {landscapeQuoteSections,landscapeTakeoff} from '../src/features/deckcraft/landscapeModelRuntime';

/**
 * Library placement and pricing. Adds from the Plants, beds and outdoor objects list commit straight
 * onto the design; this checks they do not share one point and that the quote lines stay unpriced.
 */
const deck=DEFAULT_DECK,tree=landscapeAsset('deciduous-tree'),shrub=landscapeAsset('hedge-shrub'),bed=landscapeAsset('mulch-bed');
const anchor={xIn:deck.width*6,zIn:(deck.length+8)*12};
assert.deepEqual(landscapeLibraryPoint(deck,tree,[]),anchor,'The first library object keeps the yard anchor just past the deck');
const placed: {xIn:number;zIn:number;widthIn:number}[]=[];
for(const asset of [tree,shrub,bed,tree,shrub,bed,tree,shrub]){
 const point=landscapeLibraryPoint(deck,asset,placed);
 assert.ok(!placed.some(o=>o.xIn===point.xIn&&o.zIn===point.zIn),`${asset.id} does not stack on an existing centre`);
 placed.push({...point,widthIn:asset.widthIn});
}
assert.ok(placed.length===8&&new Set(placed.map(p=>`${p.xIn}:${p.zIn}`)).size===8,'Eight library adds land on eight points');
const moved={xIn:anchor.xIn+tree.widthIn+12,zIn:anchor.zIn,widthIn:tree.widthIn};
const beside=landscapeLibraryPoint(deck,tree,[moved]);
assert.deepEqual(beside,anchor,'A free anchor is reused when a later grid point is already taken');

const objects=placed.map((p,i)=>newLandscapeObject(i%3===2?'mulch-bed':i%3===1?'hedge-shrub':'deciduous-tree','object-'+i,p.xIn,p.zIn));
const takeoff=landscapeTakeoff(objects,deck);
assert.equal(takeoff.plantCount,6,'Enabled plants count in the landscape takeoff');
assert.ok(takeoff.bedAreaSqft>0,'The planting bed contributes bed area');
const quotes=landscapeQuoteSections(objects,takeoff);
assert.ok(quotes.length>0&&quotes.every(s=>s.amountCents===null),'Library objects add quote lines and no assumed price');
assert.ok(quotes.some(s=>s.label.includes('Deciduous tree')&&s.unit==='ea'),'A tree is counted as one supply item');
console.log(JSON.stringify({objects:placed.length,plants:takeoff.plantCount,bedAreaSqft:takeoff.bedAreaSqft,unpricedLines:quotes.length}));
