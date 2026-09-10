import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {LIGHTING_CATALOGUE} from '../src/features/deckcraft/lightingCatalogue';
import {activeLightingItems,lightingSystemCheck} from '../src/features/deckcraft/lightingSystem';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {extrasLayout} from '../src/features/deckcraft/extrasLayout';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import type {DeckData} from '../src/features/deckcraft/types';
const data:DeckData={...structuredClone(DEFAULT_DECK),lightingSystem:{selectedItems:[{productId:'wedge',qty:4,zone:'stairs'},{productId:'hyve',qty:4,zone:'deck'},{productId:'hub100',qty:1}],wireDistance:80}};
const on=calculateEstimate(data),off=calculateEstimate({...data,lightingPreviewOn:false,sceneLighting:'Evening'});
const landscape={...data,terrainConfig:{widthFt:80,depthFt:80,elevationIn:6,slopePct:2},lightingSystem:{selectedItems:[{productId:'ace',qty:2,zone:'landscape' as const}],wireDistance:0}};
const groundFixtures=extrasLayout(landscape,on.model).fixtures;
assert(groundFixtures.length>0);
for(const fixture of groundFixtures)assert(Math.abs(fixture.y-(6+fixture.z*.02))<1e-8,'Landscape fixtures follow the shared terrain grade');
assert.equal(on.total,off.total,'Preview lights and time never alter the purchase');
assert.deepEqual(extrasLayout(data,on.model).fixtures,extrasLayout({...data,lightingPreviewOn:false},off.model).fixtures);
const removed={...data,lightingZoneEnabled:{stairs:false}},reduced=calculateEstimate(removed);
assert.equal(activeLightingItems(removed).reduce((n,p)=>n+p.qty,0),5);
assert(!extrasLayout(removed,reduced.model).fixtures.some(p=>p.productId==='wedge'),'Removed zones have no ghost fixtures');
assert(!deckExportMeshes(removed,reduced.model).some(p=>p.name.includes('light_wedge')),'Removed zones excluded from geometry export');
assert(on.total>reduced.total,'Removing priced installation reduces estimate');
for(const product of LIGHTING_CATALOGUE.filter(p=>p.supported)){
 const d={...structuredClone(DEFAULT_DECK),lightingSystem:{selectedItems:[{productId:product.id,qty:1}],wireDistance:0}},e=calculateEstimate(d),layout=extrasLayout(d,e.model);
 assert.equal(activeLightingItems(d)[0].id,product.id);
 assert(layout.fixtures.some(p=>p.productId===product.id)||layout.warnings.length,'Every selected product is placed or explicitly reports the missing support/fit');
 if(product.cost===null||product.laborCost===null){assert(e.quoteRequired.some(s=>s.includes(product.name)));assert.equal(e.sections.find(s=>s.title==='in-lite® Lighting System')?.items[0].cost,null);}
}
const bad={...data,lightingSystem:{selectedItems:[{productId:'smart_hub300',qty:1},{productId:'hyve',qty:1}],wireDistance:150}};
assert(lightingSystemCheck(bad).warnings.some(w=>w.includes('incompatible')));
const withCable=calculateEstimate({...data,lightingSystem:{...data.lightingSystem,selectedItems:[...data.lightingSystem.selectedItems,{productId:'cable_12_2',qty:1}]}});
assert(!withCable.sections.find(s=>s.title==='in-lite® Lighting System')!.items.some(i=>i.name==='Low-voltage cable'),'Purchased reels do not double charge a generic cable allowance');
console.log(`DECK LIGHTING OK — ${LIGHTING_CATALOGUE.filter(p=>p.supported).length} supported products, zone/preview/export/quote and circuit checks.`);
