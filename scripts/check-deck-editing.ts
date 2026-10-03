import assert from 'node:assert/strict';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {editableRailingLayout,railSectionId} from '../src/features/deckcraft/railingLayout';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {getHouseConfig,clampHouseOpening} from '../src/features/deckcraft/houseSettings';
import {buildHouseGeometry} from '../src/features/deckcraft/components/viewer3d/houseGeometry';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import type {DeckData} from '../src/features/deckcraft/types';
let checks=0;
function check(name:string,fn:()=>void){try{fn();checks++;}catch(e){throw new Error(name,{cause:e});}}
const fixture=(patch:Partial<DeckData>={}):DeckData=>({...structuredClone(DEFAULT_DECK),catalogueRailingId:undefined,...patch});
check('individual bays remove, merge and restore without widening remaining bays',()=>{
  const r={a:{x:0,y:36,z:0},b:{x:288,y:36,z:0}},initial=editableRailingLayout([r],72);
  assert.equal(initial.sections.length,4);assert.equal(initial.runs.length,1);
  const id=initial.sections[1].id,changed=editableRailingLayout([r],72,[id]);
  assert.deepEqual(changed.runs.map(x=>x.bayCount),[1,2]);assert.equal(changed.sections.filter(s=>!s.enabled).length,1);
  assert.deepEqual(editableRailingLayout([r],72,[]).runs,initial.runs);
  assert.equal(railSectionId({a:r.b,b:r.a}),railSectionId(r));
});
for(const railingType of ['Wood Picket','Aluminum','Cable','Glass Panels'] as const)for(const stairType of ['Straight','Landing','Winder'] as const)check(`${railingType} / ${stairType}: remove actual geometry, takeoff and price`,()=>{
  const d=fixture({railingType,stairType,height:80}),base=buildDeckTakeoff(d),id=base.railing.sections[0].id;
  const edited={...d,removedRailingSections:[id]},m=buildDeckTakeoff(edited),removed=base.railing.sections[0];
  assert.equal(m.quantities.railingSections,base.quantities.railingSections-1);
  assert(Math.abs(m.quantities.railingLf-(base.quantities.railingLf-removed.lengthIn/12))<1e-6);
  assert.equal(m.railing.sections.filter(s=>!s.enabled).length,1);
  assert(m.railing.rails.length>0);assert(m.issues.some(s=>s.includes('Unprotected edges')));
  assert(calculateEstimate(edited,DECK_SETTINGS).subtotal<calculateEstimate(d,DECK_SETTINGS).subtotal);
  const restored=parseDesign(serializeDesign(edited));assert.deepEqual(restored.removedRailingSections,[id]);
  assert.equal(buildDeckTakeoff(restored).quantities.railingSections,m.quantities.railingSections);
  assert.notDeepEqual(deckExportMeshes(edited,m).filter(p=>p.name.startsWith('rail_')),deckExportMeshes(d,base).filter(p=>p.name.startsWith('rail_')));
});
check('shared posts retained only for remaining adjacent sections',()=>{
  const d=fixture({stairFlights:0,deckType:'Freestanding',railingType:'Aluminum'}),base=buildDeckTakeoff(d),removed=base.railing.sections[0];
  const m=buildDeckTakeoff({...d,removedRailingSections:[removed.id]});
  const ends=m.railing.sections.filter(s=>s.enabled).flatMap(s=>[s.a,s.b]);
  for(const p of m.railing.posts)assert(ends.some(e=>Math.hypot(e.x-p.x,e.y-p.y,e.z-p.z)<.01));
  const all=buildDeckTakeoff({...d,removedRailingSections:base.railing.sections.map(s=>s.id)});
  assert.equal(all.quantities.railingPosts,0);assert.equal(all.quantities.railingLf,0);assert.equal(all.railing.rails.length,0);assert.equal(all.railing.balusters.length,0);
});
check('geometry changes never transfer removal by list index',()=>{
  const d=fixture({stairFlights:0}),m=buildDeckTakeoff(d),id=m.railing.sections[0].id;
  const resized=buildDeckTakeoff({...d,height:d.height+1,removedRailingSections:[id]});
  assert.equal(resized.railing.sections.filter(s=>!s.enabled).length,0);assert.deepEqual(resized.railing.staleRemovalIds,[id]);
});
check('hostile and duplicate removal values rejected',()=>{
  const id=buildDeckTakeoff(fixture()).railing.sections[0].id;
  for(const removedRailingSections of [[id,id],['<script>'],Array(513).fill(id),[9],{},null])assert.throws(()=>validateDesign({...fixture(),removedRailingSections}));
});
check('legacy design has no removals; None has no residual rails',()=>{
  assert.equal(parseDesign(serializeDesign(fixture())).removedRailingSections,undefined);
  assert.equal(buildDeckTakeoff(fixture({railingType:'None'})).railing.sections.length,0);
});
for(const facade of ['Front','Back','Left','Right'] as const)check(`opening placement and geometry ${facade}`,()=>{
  const d=fixture(),h=getHouseConfig(d),o={...h.openings[0],facade,offsetPct:75,bottomIn:12};
  const houseConfig={...h,openings:[clampHouseOpening(o,h)]},edited={...d,houseConfig};
  assert.deepEqual(parseDesign(serializeDesign(edited)).houseConfig,houseConfig);
  assert.equal(calculateEstimate(edited,DECK_SETTINGS).total,calculateEstimate(d,DECK_SETTINGS).total);
  assert(buildHouseGeometry(edited,d.width*12).parts.some(p=>p.name.includes(`${facade}_Door_${o.id}`)));
  for(const offsetPct of [-100,200]){const bounded=clampHouseOpening({...o,offsetPct,bottomIn:9999},h);const span=(facade==='Front'||facade==='Back'?h.widthFt:h.depthFt)*12;assert(bounded.offsetPct*span/100-bounded.widthIn/2>=6-.001);assert(bounded.offsetPct*span/100+bounded.widthIn/2<=span-6+.001);assert(bounded.bottomIn+bounded.heightIn<=h.storeys*h.storeyHeightIn-6+.001);}
});
check('removing every opening stays empty after save',()=>{const d=fixture();const restored=parseDesign(serializeDesign({...d,houseConfig:{...getHouseConfig(d),openings:[]}}));assert.equal(getHouseConfig(restored).openings.length,0);});
console.log(`DECK EDITING OK — ${checks} railing removal, geometry, pricing, persistence and house placement checks.`);
