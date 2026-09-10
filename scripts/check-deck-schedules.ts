import assert from 'node:assert/strict';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {getHardwareLayout} from '../src/features/deckcraft/hardwareLayout';
import {getStairBoards} from '../src/features/deckcraft/stairBoards';
import {LIGHTING_COSTS,MATERIAL_TIERS,CREW_DAY_RATES,RAILING_COSTS,STAIR_TREAD_COSTS,WASTE_FACTORS} from '../src/features/deckcraft/types';
import {createHash} from 'node:crypto';
// SHA-256 of JSON.stringify(original exported constant), read from the untouched
// C:/Business/projects/deckcraft-pro/src/types.ts on 2026-09-07. No machine path dependency.
const original={LIGHTING_COSTS:'20c5e22050818def66ae8eb4491877649c293212bbd18efb856bcaaf3f3e2289',MATERIAL_TIERS:'0a958a5855f52d5e20b57c0c1f32bfde15efa2da6abe6f08df981258efca007d',CREW_DAY_RATES:'e0d370541608575252914f41a83f2d9b68df78436b3abbad3537700fdad8c832',RAILING_COSTS:'7b73b487cf1d1f2f92165e68ed40a09792c8a29520a6ea91437c5952c8cb7ae1',STAIR_TREAD_COSTS:'adac3f188ff5b56bdacdea1a958b82e8b8850072b35a6856d0a5821db5e3b44d',WASTE_FACTORS:'84247fc9dbcbbfb435cee1b7e137125a839e9315e5234a8a150f1bf9191ffdb1'};
for(const key of ['LIGHTING_COSTS','MATERIAL_TIERS','CREW_DAY_RATES','RAILING_COSTS','STAIR_TREAD_COSTS','WASTE_FACTORS'] as const){const current={LIGHTING_COSTS,MATERIAL_TIERS,CREW_DAY_RATES,RAILING_COSTS,STAIR_TREAD_COSTS,WASTE_FACTORS}[key];assert.equal(createHash('sha256').update(JSON.stringify(current)).digest('hex'),original[key],`${key}: original commercial source preserved`);}
let count=0;
for(const width of [8,24,40])for(const length of [8,24])for(const pattern of ['Straight','Diagonal','Herringbone'] as const){
 const d={...structuredClone(DEFAULT_DECK),width,length,pattern};const e=calculateEstimate(d),h=getHardwareLayout(d,e.model);
 assert(Number.isFinite(e.total)&&e.total>0);
 for(const s of e.sections)assert(Math.abs(s.total-s.items.reduce((n,i)=>n+i.cost,0))<.01,`${s.title} item sum`);
 assert(e.connectorSchedule.some(r=>r.name==='Joist-to-beam ties'&&r.rate===null));
 assert(e.flags.some(f=>f.includes('unpriced connection')));
 const hanger=e.connectorSchedule.find(r=>r.name==='Joist hangers');assert.equal(hanger?.qty,h.hangers.length);
 assert(e.stockSchedule.every(s=>!s.unresolvedIn.length),'All framing cuts fit stock');
 for(const s of e.stockSchedule){assert(s.orderedLf>=s.installedLf);for(const bin of s.cutsIn)assert(bin.reduce((a,b)=>a+b,0)+Math.max(0,bin.length-1)*.125<=s.stockLengthIn+.001);}
 count++;
}
const light=(wireDistance:number)=>calculateEstimate({...structuredClone(DEFAULT_DECK),lightingSystem:{selectedItems:[{productId:'puck',qty:4}],wireDistance}},DECK_SETTINGS);
assert(Math.abs(light(50).subtotal-light(20).subtotal-30*LIGHTING_COSTS.wirePerFt*1.35)<.001,'Wire quantity uses original per-foot rate');
const deck=calculateEstimate({...structuredClone(DEFAULT_DECK),deckingMaterial:'deck_vista',fasteningSystem:'Face'},DECK_SETTINGS);
const clips=deck.sections.find(s=>s.title==='Hardware & Fasteners')!.items.find(i=>i.name==='Hidden Clips')!;
assert.equal(clips.unit,'sqft');assert(Math.abs(clips.cost-deck.area*.85*1.35)<.001,'Hidden clips retain area allowance');
for(const stairType of ['Straight','Landing','Winder'] as const)for(const stairWidth of [36,72,120]){
 const d={...structuredClone(DEFAULT_DECK),height:108,stairType,stairWidth};const e=calculateEstimate(d),boards=getStairBoards(d,e.model);
 assert(boards.length>e.model.treads.length,'Tread assembly consists of individual planks');
 assert(boards.every(b=>b.w<=e.model.stockLength+.001&&b.d<=d.boardWidth+.001&&b.polygon!.length>=3),'Every tread plank fits stock');
 const row=e.stockSchedule.find(s=>s.name.startsWith('Stair tread'));assert(row&&!row.unresolvedIn.length);
 assert.equal(row.cutsIn.flat().length,boards.length,'Tread stock order includes every drawn cut');
}
console.log(`DECK SCHEDULES OK — ${count} stock/hardware scenarios, original commercial constants unchanged, wire and hidden clip rate bases preserved.`);
