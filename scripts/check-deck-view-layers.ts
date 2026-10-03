import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ALL_VIEW_LAYERS,FINISHED_VIEW,VIEW_PRESETS,allViewLayers,resolveViewLayers,matchingViewPreset} from '../src/features/deckcraft/viewLayers';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {serializeDesign,parseDesign} from '../src/features/deckcraft/designPersistence';
import {exportDeckDXF} from '../src/features/deckcraft/designExports';
let checks=0;function check(name:string,fn:()=>void){try{fn();checks++;}catch(e){throw new Error(name,{cause:e});}}
check('all preset layers are explicit booleans',()=>{for(const preset of Object.values(VIEW_PRESETS)){assert.deepEqual(Object.keys(preset).sort(),[...ALL_VIEW_LAYERS].sort());assert(Object.values(preset).every(v=>typeof v==='boolean'));}});
check('framing truly isolates structural members',()=>{assert.deepEqual(ALL_VIEW_LAYERS.filter(k=>VIEW_PRESETS.framing[k]),['skirtingFraming','joists','blocking','beams','rim','supportPosts','stringers']);});
check('foundations show footings without the ground masking them',()=>{assert.deepEqual(ALL_VIEW_LAYERS.filter(k=>VIEW_PRESETS.foundations[k]),['supportPosts','footings']);});
check('show/hide all are complete independent copies',()=>{const all=allViewLayers(true),none=allViewLayers(false);assert(Object.values(all).every(Boolean));assert(Object.values(none).every(v=>!v));all.house=false;assert.equal(FINISHED_VIEW.house,true);});
for(const key of ALL_VIEW_LAYERS)check(`independent ${key} switch survives every legacy camera/mode flag`,()=>{const edited={...FINISHED_VIEW,[key]:!FINISHED_VIEW[key]};for(const structure of [false,true])for(const cutaway of [false,true])for(const hardware of [false,true])assert.deepEqual(resolveViewLayers(edited,structure,cutaway,hardware),edited);});
check('preset identification and custom state',()=>{assert.equal(matchingViewPreset({...VIEW_PRESETS.framing}),'framing');assert.equal(matchingViewPreset({...VIEW_PRESETS.framing,deckBoards:true}),undefined);});
check('visibility cannot alter saved design, quantities, estimate or CAD',()=>{
  const d=structuredClone(DEFAULT_DECK),before=calculateEstimate(d,DECK_SETTINGS),saved=serializeDesign(d),cad=exportDeckDXF(d,before.model);
  for(const layers of [allViewLayers(false),...Object.values(VIEW_PRESETS)]){
    const ignored={...d,viewLayers:layers};assert.equal(serializeDesign(ignored),saved);
    const after=calculateEstimate(parseDesign(serializeDesign(ignored)),DECK_SETTINGS);assert.deepEqual(after.model.quantities,before.model.quantities);assert.equal(after.total,before.total);assert.equal(exportDeckDXF(d,after.model),cad);
  }
});
check('render boundaries cover each selectable layer',()=>{
  const src=readFileSync('src/features/deckcraft/components/viewer3d/Deck3DViewer.tsx','utf8');
  for(const key of ALL_VIEW_LAYERS.filter(k=>!['house','ground'].includes(k)))assert(src.includes(`layers.${key}&&`),key);
  assert(src.includes('showHouse={layers.house}'));assert(src.includes('showGround={layers.ground}'));
  const env=readFileSync('src/features/deckcraft/components/viewer3d/Environment3D.tsx','utf8');assert(env.includes('{showGround&&<Turf'));assert(env.includes('{showHouse&&<House3D'));
  assert(src.includes('referencePlane={false}'),'hiding ground cannot leave an opaque cutaway floor');
});
console.log(`DECK VIEW LAYERS OK — ${checks} preset, independence, render-boundary and design-isolation checks.`);
