import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {DESIGN_STORAGE_KEY,serializeDesign} from '../src/features/deckcraft/designPersistence';
import {DECK_RELEASE_STORAGE_KEY,deckReleaseData,parseDeckReleaseDesign,serializeDeckReleaseDesign,calculateDeckReleaseEstimate,exportDeckReleaseDXF,exportDeckReleaseOBJ} from '../src/features/deckcraft/deckRelease';
import type {DeckData} from '../src/features/deckcraft/types';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
const combined:DeckData={...structuredClone(DEFAULT_DECK),terrainConfig:{widthFt:80,depthFt:80,elevationIn:10,slopePct:5},yardFeatures:[{id:'old-patio',kind:'patio',name:'Deferred patio',enabled:true,xFt:10,zFt:30,widthFt:20,depthFt:20,heightIn:0,rotationDeg:0,productId:'permacon-melville',color:'#aaaaaa'}]};
const snapshot=structuredClone(combined),clean=deckReleaseData(combined),base=calculateDeckReleaseEstimate(DEFAULT_DECK),released=calculateDeckReleaseEstimate(combined);
assert.deepEqual(combined,snapshot,'Source combined design is preserved without mutation');
assert(!('yardFeatures' in clean)&&!('terrainConfig' in clean));
assert.notEqual(DECK_RELEASE_STORAGE_KEY,DESIGN_STORAGE_KEY,'New autosave cannot overwrite preserved combined autosave');
assert.equal(released.total,base.total,'Deferred hardscape and terrain never affect release pricing');
assert.equal(released.yardModel.features.length,0);
assert(!released.sections.some(s=>s.title.startsWith('Yard')));
assert.deepEqual(parseDeckReleaseDesign(serializeDesign(combined)),clean,'Older combined files import deck-only');
assert.equal(deckReleaseData({...combined,projectKind:'hardscape',hsProduct:'old-paver'}).projectKind,'deck');
assert(!('hsProduct' in deckReleaseData({...combined,hsProduct:'old-paver'})));
assert(!serializeDeckReleaseDesign(combined).includes('yardFeatures'));
for(const text of [exportDeckReleaseOBJ(combined,released.model),exportDeckReleaseDXF(combined,released.model)])assert(!text.includes('yard_'),'Released exports exclude deferred yard meshes');
// Older single-area privacy designs become editable screens at exactly the same price.
for(const privacySqft of [24,25,137,500]){
  const legacy:DeckData={...structuredClone(DEFAULT_DECK),privacySqft};
  const migrated=deckReleaseData(legacy);
  assert(migrated.privacyScreens&&migrated.privacyScreens.length>0,'Legacy privacy area becomes screens');
  assert.equal(migrated.privacySqft,privacySqft,'Migration preserves the priced area');
  assert.equal(calculateDeckReleaseEstimate(legacy).total,calculateEstimate(legacy).total,'Same total as the original single-area pricing');
  assert.equal(parseDeckReleaseDesign(serializeDeckReleaseDesign(legacy)).privacySqft,privacySqft,'Migrated screens survive save/load');
  assert(!('privacyScreens' in legacy),'Migration never mutates the source design');
}
// A slatted screen switched off keeps its settings but leaves the estimate entirely.
{
  const screen={id:'s1',side:'Left' as const,lengthFt:8,heightFt:6 as const,offsetPct:50,lights:false};
  const on=deckReleaseData({...structuredClone(DEFAULT_DECK),privacyScreens:[screen]}),off=deckReleaseData({...structuredClone(DEFAULT_DECK),privacyScreens:[{...screen,enabled:false}]});
  assert.equal(on.privacySqft,48);assert.equal(off.privacySqft,0);
  assert.equal(calculateDeckReleaseEstimate(off).total,base.total,'An off screen adds nothing');
  assert(calculateDeckReleaseEstimate(on).total>base.total,'The same screen switched on is priced');
  assert.equal(off.privacyScreens?.[0].lengthFt,8,'Switching off keeps the screen settings');
}
const page=readFileSync(new URL('../src/pages/DeckDesigner.tsx',import.meta.url),'utf8');
assert(page.includes('deckRelease'),'Public page uses the release boundary');
assert(!page.includes('<YardEditor'),'Deferred authoring is absent from the public workflow');
console.log('Deck-only release: preserved legacy designs, isolated pricing/terrain, clean import/save/exports and public workflow checks passed.');
