import assert from 'node:assert/strict';
import {LIGHTING_CATALOGUE} from '../src/features/deckcraft/lightingCatalogue';
import {LIGHTING_RUNTIME_CATALOGUE,getLightingRuntimeProduct} from '../src/features/deckcraft/lightingRuntimeCatalogue';

// A runtime split must retain every physical, cost and circuit fact. Display/3D
// metadata remains available through the full catalogue and never supplies a rate.
const display=new Set(['description','sourceUrl','sourceVerified','specificationStatus','articleNumber','finish','voltage','watts','colorTemperatureK','compatibilityNotes']);
assert.equal(LIGHTING_RUNTIME_CATALOGUE.length,LIGHTING_CATALOGUE.length);
for(const product of LIGHTING_CATALOGUE){
  const expected=Object.fromEntries(Object.entries(product).filter(([key])=>!display.has(key)));
  assert.deepEqual(getLightingRuntimeProduct(product.id),expected,`${product.id}: all price, placement and electrical facts retained`);
  assert(product.sourceUrl&&Array.isArray(product.compatibilityNotes),'Full manufacturer details stay available');
}
assert.equal(getLightingRuntimeProduct('missing'),undefined);
console.log(`LIGHTING RUNTIME OK — ${LIGHTING_CATALOGUE.length} full/runtime records agree on every cost, dimension, VA, support, accessory and circuit fact; display details remain available.`);
