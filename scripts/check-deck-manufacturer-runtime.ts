import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as full from '../src/features/deckcraft/manufacturerCatalog';
import * as runtime from '../src/features/deckcraft/manufacturerRuntimeCatalogue';
import {PRICE_BOOK} from '../src/features/deckcraft/priceBook';

/** Captured before this metadata split: includes every original product field and its original order. */
const original=JSON.parse(readFileSync(new URL('./manufacturer-catalogue-baseline.json',import.meta.url),'utf8')) as typeof full;
const json=(v:unknown)=>JSON.parse(JSON.stringify(v));
assert.deepEqual(json(full),original,'The full public catalogue remains exactly the original value, including unsupported products and links');
const withoutSource=<T extends {sourceUrl:string}>(items:T[])=>items.map(({sourceUrl:_,...p})=>p);
assert.deepEqual(json(runtime.DECKING_CATALOGUE),withoutSource(original.DECKING_CATALOGUE),'Every colour/swatch, rate, product flag and estimate note remains exact');
assert.deepEqual(json(runtime.RAILING_CATALOGUE),withoutSource(original.RAILING_CATALOGUE),'Every railing name, family and estimate note remains exact');
assert.deepEqual(json(runtime.MANUFACTURER_ACCESSORIES),withoutSource(original.MANUFACTURER_ACCESSORIES.filter(p=>p.previewSupported)),'Every supported installed accessory retains its exact name, kind and installation note');
assert.equal(runtime.MANUFACTURER_ACCESSORIES.length,9);
assert.equal(full.MANUFACTURER_ACCESSORIES.length,14);
assert.equal(PRICE_BOOK.fingerprint,'23d6112e');
// Display objects do not share mutable colour or product records with the engine.
for(let i=0;i<full.DECKING_CATALOGUE.length;i++){assert.notEqual(full.DECKING_CATALOGUE[i],runtime.DECKING_CATALOGUE[i]);assert.notEqual(full.DECKING_CATALOGUE[i].colors,runtime.DECKING_CATALOGUE[i].colors);}
console.log('MANUFACTURER RUNTIME OK: exact original full catalogue; all rates, colours, flags and installed accessory fields retained; presentation provenance remains available.');
