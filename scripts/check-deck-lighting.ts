import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {LIGHTING_CATALOGUE} from '../src/features/deckcraft/lightingCatalogue';
import {activeLightingItems,lightingSystemCheck,syncAutoLighting,AUTO_LIGHTING,MAX_FIXTURE_QTY} from '../src/features/deckcraft/lightingSystem';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {extrasLayout,screenOffsetFromPoint} from '../src/features/deckcraft/extrasLayout';
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
// Simple post/stair lighting follows the modeled mounts and uses existing price-book fixtures only.
{
  const base:DeckData={...structuredClone(DEFAULT_DECK),autoLighting:{posts:true,stairs:true}};
  const model=calculateEstimate(base).model,counts={posts:model.railing.posts.length,stairs:model.treads.length,privacy:0};
  assert(counts.posts>0&&counts.stairs>0,'The default deck has posts and treads to light');
  const lit:DeckData={...base,lightingSystem:{...base.lightingSystem,selectedItems:syncAutoLighting(base,counts)}};
  const qty=(d:DeckData,id:string)=>d.lightingSystem.selectedItems.find(i=>i.productId===id)?.qty??0;
  assert.equal(qty(lit,AUTO_LIGHTING.posts.productId),Math.min(MAX_FIXTURE_QTY,counts.posts));
  assert.equal(qty(lit,AUTO_LIGHTING.stairs.productId),Math.min(MAX_FIXTURE_QTY,counts.stairs));
  assert.equal(qty(lit,AUTO_LIGHTING.transformer.productId),1,'One transformer comes with the simple lights');
  const litEstimate=calculateEstimate(lit),litLayout=extrasLayout(lit,litEstimate.model);
  assert.equal(litLayout.fixtures.filter(f=>f.zone==='posts').length,qty(lit,'puck'),'A cap light on every railing post');
  assert.equal(AUTO_LIGHTING.stairs.productId,'evo_hyde','Default under-step light is EVO HYDE');
  assert.equal(litLayout.fixtures.filter(f=>f.zone==='stairs').length,qty(lit,'evo_hyde'),'An EVO HYDE under every step');
  for(const f of litLayout.fixtures.filter(f=>f.zone==='stairs')){const t=litEstimate.model.treads.find(tr=>Math.hypot(tr.x-f.x,tr.z-f.z)<tr.d);assert(t&&f.y<t.y-t.h/2,'Under-step light sits below the tread, not on the riser face');}
  assert(litEstimate.total>calculateEstimate(DEFAULT_DECK).total,'Simple lights are priced');
  assert(!litEstimate.quoteRequired.some(s=>/PUCK|EVO HYDE|HUB-100/.test(s)),'Simple lights use existing price-book allowances');
  // EVO FLEX strip style: placed under each 48 in step, listed for a supplier quote; too long for 36 in steps.
  const flex:DeckData={...base,autoLighting:{...base.autoLighting,stairStyle:'evo_flex'}};
  const flexLit:DeckData={...flex,lightingSystem:{...flex.lightingSystem,selectedItems:syncAutoLighting(flex,counts)}};
  assert.equal(qty(flexLit,'evo_flex_1_kit'),Math.min(MAX_FIXTURE_QTY,counts.stairs));
  assert.equal(qty(flexLit,'evo_hyde'),0,'Switching style replaces the under-step product');
  const flexEstimate=calculateEstimate(flexLit);
  assert.equal(extrasLayout(flexLit,flexEstimate.model).fixtures.filter(f=>f.zone==='stairs').length,counts.stairs,'An EVO FLEX strip under every 48 in step');
  assert(flexEstimate.quoteRequired.some(s=>s.includes('EVO FLEX')),'EVO FLEX strips are a supplier quote');
  const narrow:DeckData={...flexLit,stairWidth:36},narrowLayout=extrasLayout(narrow,calculateEstimate(narrow).model);
  assert(!narrowLayout.fixtures.some(f=>f.zone==='stairs')&&narrowLayout.warnings.some(w=>w.includes('too long')),'A 1 m strip is not forced onto 36 in steps');
  // Round-1 designs with an auto WEDGE riser light migrate to the under-step light.
  const roundOne:DeckData={...base,lightingSystem:{wireDistance:20,selectedItems:[{productId:'wedge',qty:4,zone:'stairs',auto:true}]}};
  assert(!syncAutoLighting(roundOne,counts).some(i=>i.productId==='wedge'),'Stale auto WEDGE is replaced');
  assert.equal(calculateEstimate({...lit,sceneLighting:'Evening',lightingPreviewOn:false}).total,litEstimate.total,'Night and preview switches never change the price');
  assert.deepEqual(syncAutoLighting({...lit,autoLighting:{}},counts),[],'Turning the options off removes their fixtures and transformer');
  const manual:DeckData={...base,lightingSystem:{wireDistance:20,selectedItems:[{productId:'hub50',qty:1},{productId:'puck',qty:2,zone:'deck'}]}};
  const synced=syncAutoLighting(manual,counts);
  assert(!synced.some(i=>i.productId==='hub100'),'A chosen transformer is respected, not doubled');
  assert.equal(synced.filter(i=>i.productId==='puck').length,1,'A managed product is never listed twice');
}
// Lit privacy screens get one BLINK on each screen post; unlit screens get none.
{
  const screens:NonNullable<DeckData['privacyScreens']>=[{id:'screen-1',side:'Left',lengthFt:8,heightFt:6,offsetPct:50,lights:true},{id:'screen-2',side:'Right',lengthFt:6,heightFt:5,offsetPct:0,lights:false}];
  const d:DeckData={...structuredClone(DEFAULT_DECK),privacyScreens:screens,privacySqft:78};
  const mounts=extrasLayout(d,calculateEstimate(d).model).privacyMounts.length;
  assert(mounts>0,'A lit screen exposes its post mounts');
  const lit:DeckData={...d,lightingSystem:{...d.lightingSystem,selectedItems:syncAutoLighting(d,{posts:0,stairs:0,privacy:mounts})}};
  const litEstimate=calculateEstimate(lit);
  assert.equal(extrasLayout(lit,litEstimate.model).fixtures.filter(f=>f.zone==='privacy').length,mounts,'One light on each lit screen post');
  const dark:DeckData={...d,privacyScreens:screens.map(s=>({...s,lights:false}))};
  assert.equal(extrasLayout(dark,calculateEstimate(dark).model).privacyMounts.length,0);
  assert(litEstimate.total>calculateEstimate(dark).total,'Turning screen lights off lowers the estimate');
  const off:DeckData={...d,privacyScreens:screens.map(s=>({...s,enabled:false}))};
  assert.equal(extrasLayout(off,calculateEstimate(off).model).privacyMounts.length,0,'A screen that is off carries no lights');
}
// Manufacturer screens: drawn to stock panel sizes, listed for a supplier quote, never priced.
{
  const hideaway:NonNullable<DeckData['privacyScreens']>[number]={id:'h1',side:'Left',lengthFt:8,heightFt:6,offsetPct:50,lights:true,product:'hideaway',design:'Hexx',finish:'Black',panels:3};
  const withScreen:DeckData={...structuredClone(DEFAULT_DECK),privacyScreens:[hideaway],privacySqft:0};
  const e=calculateEstimate(withScreen),layout=extrasLayout(withScreen,e.model);
  assert.equal(layout.panels.length,3,'Three stock panels drawn');
  assert(layout.panels.every(p=>p.w===36&&p.h===68&&p.finish==='Black'&&p.design==='Hexx'));
  assert.equal(layout.metal.filter(b=>b.w===3&&b.h===73).length,4,'Four 3 × 3 × 73 in posts');
  assert.equal(layout.privacyMounts.length,4,'A light mount on each HIDEAWAY post');
  assert(e.quoteRequired.some(s=>s.includes('HIDEAWAY')&&s.includes('Hexx')&&s.includes('3 panels')),'Listed for a supplier quote');
  assert.equal(e.total,calculateEstimate(DEFAULT_DECK).total,'A manufacturer screen never changes the priced total');
  assert(deckExportMeshes(withScreen,e.model).some(m=>m.name.startsWith('privacy_panel')),'Panels are exported');
  const tooMany:DeckData={...withScreen,privacyScreens:[{...hideaway,panels:12}]};
  const trimmed=extrasLayout(tooMany,calculateEstimate(tooMany).model);
  assert(trimmed.panels.length<12&&trimmed.warnings.some(w=>w.includes('panels on that edge')),'Only whole panels that fit are drawn');
  // Dragging maps back to the same position the layout drew, on every side; a full-length screen cannot slide.
  assert.equal(screenOffsetFromPoint(layout.screenHandles[0],layout.screenHandles[0].x,layout.screenHandles[0].z),null,'A screen filling its edge has no room to slide');
  const front:DeckData={...withScreen,privacyScreens:[{...hideaway,side:'Front',panels:2}]},frontLayout=extrasLayout(front,calculateEstimate(front).model);
  assert(!frontLayout.screenHandles.length&&frontLayout.warnings.some(w=>w.includes('overlaps the stair opening')),'A screen is never drawn across the stairs');
  for(const side of ['Left','Right'] as const)for(const offsetPct of [0,35,100]){
    const d:DeckData={...withScreen,privacyScreens:[{...hideaway,side,panels:2,offsetPct}]};
    const h=extrasLayout(d,calculateEstimate(d).model).screenHandles[0];
    assert.equal(screenOffsetFromPoint(h,h.x,h.z),offsetPct,`Drag frame round-trips ${offsetPct}% on the ${side} edge`);
  }
}
console.log(`DECK LIGHTING OK — ${LIGHTING_CATALOGUE.filter(p=>p.supported).length} supported products, zone/preview/export/quote, circuit, under-step, privacy-screen and manufacturer-screen checks.`);
