import assert from 'node:assert/strict';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {FRAMELESS_SYSTEMS,getFramelessSystem} from '../src/features/deckcraft/framelessSystems';
import {lightingTargets} from '../src/features/deckcraft/lightingPlacement';
import {connectorSchedule} from '../src/features/deckcraft/schedule';
import {parseDesign,serializeDesign} from '../src/features/deckcraft/designPersistence';
import {railingDesignKey,railingReviewStatus} from '../src/features/deckcraft/railingJobPack';
import type {DeckData} from '../src/features/deckcraft/types';

let checks=0;const test=(name:string,fn:()=>void)=>{fn();checks++;console.log(`PASS ${name}`);};
const base:DeckData={...structuredClone(DEFAULT_DECK),width:24,length:12,height:36,shape:'Rectangle',levels:1,railingType:'Glass Panels',catalogueRailingId:'nv_spigot',stairFlights:1,stairPosition:'Front',stairType:'Straight',stairOffset:50,lightingSystem:{selectedItems:[],wireDistance:0},privacySqft:0};
for(const system of FRAMELESS_SYSTEMS){
 const data={...base,catalogueRailingId:system.id},model=buildDeckTakeoff(data);
 test(`${system.id}: no imaginary post or rail lighting hosts`,()=>{assert.equal(lightingTargets(data,model,'posts').length,0);assert.equal(lightingTargets(data,model,'rails').length,0);});
 test(`${system.id}: no conventional brackets in connector schedule`,()=>{assert.ok(!connectorSchedule(data,model).some(r=>/Railing bracket|Railing cap|Railing post/.test(r.name)));});
 test(`${system.id}: quote-required exact modeled scope and unresolved work`,()=>{const e=calculateEstimate(data,DECK_SETTINGS),s=e.sections.find(s=>s.title==='Railing System')!;assert.equal(s.total,0);assert.ok(s.items.every(i=>i.cost===null));assert.equal(Number(s.items[0].qty),model.railing.glass.length);assert.equal(Number(s.items[1].qty),system.mount==='spigot'?model.railing.spigotCount:Math.round(model.railing.shoeLengthIn/12*10)/10);assert.equal(s.items.find(i=>i.name==='Unresolved guards and handrails')?.qty,model.railing.unmodeledSectionIds.length);assert.equal(e.sections.find(s=>s.title==='Labour (Construction & Build)')?.total,0);});
}
test('finish, source system and evidence survive save/import',()=>{const d:DeckData={...base,railingHardwareFinish:'Satin'};d.railingReview={records:[{id:'site',reference:'Local test reference R1',reviewer:'Test reviewer',date:'2026-09-21',designKey:railingDesignKey(d)}]};const restored=parseDesign(serializeDesign(d));assert.equal(restored.catalogueRailingId,d.catalogueRailingId);assert.equal(restored.railingHardwareFinish,'Satin');assert.equal(railingReviewStatus(restored).recorded,1);});
test('generic style ignores stale manufacturer id',()=>{assert.equal(getFramelessSystem({...base,railingType:'None'}),undefined);});
console.log(`RAILING INTEGRATION OK — ${checks} checks.`);
