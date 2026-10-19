import assert from 'node:assert/strict';
import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
await loadAdvancedYardRuntime();
const {ontarioShowcaseDesign,showcaseSampleIssues}=await import('../src/features/deckcraft/showcaseSample');
const {outdoorRoomIssues}=await import('../src/features/deckcraft/outdoorRoomRules');
const {buildDeckTakeoff}=await import('../src/features/deckcraft/deckTakeoff');
type Design=ReturnType<typeof ontarioShowcaseDesign>;
const run=(d:Design)=>outdoorRoomIssues(d,buildDeckTakeoff(d));
const base=ontarioShowcaseDesign();
// The showcase passes every room rule; the pool reminder is the only line.
assert.deepEqual(run(base).filter(m=>!m.startsWith('A pool needs a by-law enclosure')),[]);
assert.deepEqual(showcaseSampleIssues(base),[]);
assert.deepEqual(showcaseSampleIssues(ontarioShowcaseDesign({palette:'classic'})),[],'the classic Onyx palette also builds');
const edit=(fn:(d:Design)=>void)=>{const d=structuredClone(base);fn(d);return run(d);};
const move=(id:string,dx:number,dz:number)=>(d:Design)=>{const o=d.landscapeObjects!.find(o=>o.id===id)!;o.xIn+=dx;o.zIn+=dz;};
const has=(msgs:string[],text:string)=>assert.ok(msgs.some(m=>m.includes(text)),`expected "${text}" in ${JSON.stringify(msgs)}`);
// R-POOL-FENCE: one reminder per design with a pool in use, at Barrie's 1.2 m; none when the pool is switched off.
const fence=(msgs:string[])=>msgs.filter(m=>m.startsWith('A pool needs a by-law enclosure'));
assert.equal(fence(run(base)).length,1,'R-POOL-FENCE reminder');
assert.ok(fence(run(base))[0].includes('at least 1.2 m high'),`R-POOL-FENCE gives Barrie's 1.2 m: ${fence(run(base))[0]}`);
assert.deepEqual(fence(edit(d=>{for(const p of d.pools!)p.enabled=false;})),[],'No fence reminder for a pool that is switched off');
assert.deepEqual(fence(edit(d=>{d.pools=[];})),[],'No fence reminder without a pool');
// F-CHAISE-COPING: a chaise pushed 12 in toward the water.
has(edit(move('pool-chaise-1',0,12)),'from the pool coping');
// F-COFFEE-GAP: the coffee table 6 in toward the sofa.
has(edit(move('terrace-coffee',0,-6)),'keep a coffee table 14–18 in');
// F-DINING-BEHIND: the dining set slid to the house side of the deck.
has(edit(d=>{for(const o of d.landscapeObjects!)if(o.id.startsWith('dining-'))o.zIn-=40;}),'under 36 in of deck or paving behind it');
// F-FIRE-GAS: a swivel chair pulled 12 in toward the burner.
has(edit(d=>{const f=d.yardFeatures!.find(f=>f.id==='fire-bowl')!,o=d.landscapeObjects!.find(o=>o.id==='lounge-chair-1')!;const dx=f.xFt*12-o.xIn,dz=f.zFt*12-o.zIn,l=Math.hypot(dx,dz);o.xIn+=dx/l*12;o.zIn+=dz/l*12;}),'from the burner');
// F-FIRE-NO-COFFEE: a coffee table set between a chair and the fire.
has(edit(d=>{const f=d.yardFeatures!.find(f=>f.id==='fire-bowl')!,c=d.landscapeObjects!.find(o=>o.id==='lounge-chair-1')!,t=d.landscapeObjects!.find(o=>o.id==='terrace-coffee')!;t.xIn=(f.xFt*12+c.xIn)/2;t.zIn=(f.zFt*12+c.zIn)/2;t.widthIn=24;t.depthIn=16;t.supportFeatureId='lounge';}),'between');
// R-GRILL: a side table left in the grill aisle.
has(edit(d=>{const k=d.landscapeObjects!.find(o=>o.id==='kitchen-island')!,t=d.landscapeObjects!.find(o=>o.id==='pool-side-1')!;t.xIn=k.xIn;t.zIn=k.zIn+k.depthIn/2+12;}),'work aisle');
// B-ONE-WIDTH: one court band widened to 16 in.
has(edit(d=>{const c=d.yardFeatures!.find(f=>f.id==='pool-court')!;const i=c.inlays![0];if(i.widthIn<i.depthIn)i.widthIn=16;else i.depthIn=16;}),'keep one band width');
// M-PAVE-COUNT: the fire lounge field in a third material (the walks already use Borealis).
has(edit(d=>{const l=d.yardFeatures!.find(f=>f.id==='lounge')!;l.hardscape={...l.hardscape!,colorId:'onyx-black'};}),'colour and finish combinations');
console.log('OUTDOOR ROOM RULES OK — showcase clean; chaise-coping, coffee gap, dining behind, fire distance, coffee-by-fire, grill aisle, band width and paving count each flag.');
