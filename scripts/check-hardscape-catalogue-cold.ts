import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {designExtensionsReady,ensureDesignExtensions,ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {DesignExtensionLoadError} from '../src/features/deckcraft/designExtensionState';
import {hardscapeCatalogueReady,hardscapeName,hardscapeSelection} from '../src/features/deckcraft/hardscapeLookup';
import {parseDeckReleaseDesign,serializeDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import {createQuoteAwarePricingReceiver} from '../src/features/deckcraft/designer/quoteAwarePricingReceiver';
import {priceOption} from '../src/features/deckcraft/designer/optionPricing';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';

/**
 * The supplier hardscape catalogue (hardscapeCatalogue.ts, with its engineering index) loads with a design's yard
 * features, never with a plain deck: the designer's first paint (DEFAULT_DECK) does not fetch it, and
 * check-deck-bundle.ts keeps it out of the route's first load. A saved supplier patio still validates, prices and
 * names its product once its extensions are prepared, and is never validated or priced without them.
 * Cold process: nothing here imports hardscapeCatalogue.ts until the design extensions load it.
 */
let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};
const notReady=(run:()=>unknown,m:string)=>{assert.throws(run,(e:unknown)=>e instanceof DesignExtensionLoadError&&/Supplier hardscape catalogue is not ready/.test(e.message),m);checks++;};
// A supplier patio from a real saved design (e2e/fixtures/craighurst-extended.json).
const landing:YardFeature={id:'landing',kind:'patio',name:'Stone landing',enabled:true,xFt:4,zFt:9.32,widthFt:5.5,depthFt:3.2,heightIn:0,rotationDeg:0,productId:'techo-para-slab',color:'#2b2b2b',finishedElevationIn:5,hardscape:{finishId:'hd',colorId:'onyx-black',unitId:'500-500-60-mm-500-500-60',patternId:'stack-bond',angleDeg:0,jointMm:3}};
const plain:DeckData=structuredClone(DEFAULT_DECK),design:DeckData={...structuredClone(DEFAULT_DECK),yardFeatures:[landing]};
const saved=JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration:design});

ok(!hardscapeCatalogueReady(),'A cold process has no hardscape catalogue');
ok(designExtensionsReady(plain)&&Number.isFinite(calculateEstimate(plain).total),'The first paint (a plain deck) is estimated synchronously without the catalogue');
await ensureLiveDesignExtensions(plain);ok(!hardscapeCatalogueReady(),'Preparing a plain deck never fetches the catalogue');
ok(!designExtensionsReady(design),'A design with yard features waits for the catalogue');
notReady(()=>hardscapeSelection(landing),'A supplier selection is never resolved without the catalogue');
// The yard's takeoff runtime is lazy too, so its guard may answer first: either way the patio is never priced unprepared.
assert.throws(()=>calculateEstimate(design),'A supplier patio is never priced before its extensions are ready');checks++;
notReady(()=>parseDeckReleaseDesign(saved),'A saved supplier patio is never validated without the catalogue');
let reads=0;const guarded={};Object.defineProperty(guarded,'yardFeatures',{enumerable:true,get(){reads++;return [landing];}});
await ensureDesignExtensions(guarded);ok(!reads&&!hardscapeCatalogueReady(),'Presence detection never invokes an accessor');

// The option deltas' worker prepares the design's extensions before it prices (optionDeltas.worker.ts).
let delivered=0,loads=0;
const receiver=createQuoteAwarePricingReceiver(()=>{delivered++;},async data=>{loads++;await ensureLiveDesignExtensions(data);},()=>assert.fail('Catalogue preparation unexpectedly failed'));
receiver({job:1,data:plain,items:[{key:'base',patch:{}}]});ok(delivered===1&&loads===0,'The worker prices a plain deck without loading the catalogue');
receiver({job:2,data:design,items:[{key:'patio',patch:{}}]});ok(delivered===1&&loads===1,'The worker holds a supplier patio until the catalogue is ready');
await new Promise(r=>setTimeout(r,0));await ensureDesignExtensions(JSON.parse(saved));await new Promise(r=>setTimeout(r,0));
ok(delivered===2,'The worker prices the patio once the catalogue has loaded');

ok(hardscapeCatalogueReady()&&designExtensionsReady(design),'Preparing a saved design with yard features loads the catalogue');
const restored=parseDeckReleaseDesign(saved),patio=restored.yardFeatures?.[0];
assert.deepEqual(patio?.hardscape,landing.hardscape);checks++;
const selected=hardscapeSelection(patio!);
ok(selected?.product.id==='techo-para-slab'&&selected.finish.id==='hd'&&selected.color.id==='onyx-black'&&selected.unit.heightMm===60,'The restored selection resolves against the catalogue');
ok(hardscapeName(patio!)==='Techo-Bloc Para · onyx black',`The product is named from the catalogue: ${hardscapeName(patio!)}`);
const estimate=calculateEstimate(restored),plainEstimate=calculateEstimate(plain);
ok(estimate.subtotal>plainEstimate.subtotal,'The supplier patio adds its priced scope to the estimate');
ok(Math.abs(priceOption(restored,{}).total-estimate.total)<.01,'Prepared worker pricing agrees with the page estimate');
ok(serializeDeckReleaseDesign(restored)===serializeDeckReleaseDesign(parseDeckReleaseDesign(serializeDeckReleaseDesign(restored))),'The prepared design saves and restores unchanged');
console.log(`${checks} cold hardscape catalogue checks passed.`);
