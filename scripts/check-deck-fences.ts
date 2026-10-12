import assert from 'node:assert/strict';
import {splitSubtotal} from '../src/features/deckcraft/backyard';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import {fenceQuoteSections} from '../src/features/deckcraft/fenceTakeoff';
import {FENCE_STYLE_IDS,FROST_FOOTING_NOTE,POOL_ENCLOSURE_NOTE,addFenceGate,fencePosts,fenceQuantities,fenceSolids,horizontalSlatCount,newFenceRun,validateFences,type FenceRun} from '../src/features/deckcraft/fenceTypes';
import {PRICE_BOOK} from '../src/features/deckcraft/priceBook';
import {buildYardTakeoff} from '../src/features/deckcraft/yardTakeoff';

const line=(x0:number,x1:number):FenceRun['points']=>[{x:x0,y:0},{x:x1,y:0}];
const straight=()=>newFenceRun('cedar-horizontal',line(0,192),'privacy','Privacy fence');
const throws=(fn:()=>unknown,label:string)=>{assert.throws(fn,Error,label);};

assert.deepEqual(FENCE_STYLE_IDS,['cedar-horizontal','composite-horizontal','board-on-board','aluminum-picket','glass']);
assert.equal(PRICE_BOOK.version,'2026-10-08');
assert.equal(PRICE_BOOK.fingerprint,'0a7fa014');
assert.equal(validateDesign(DEFAULT_DECK).fences,undefined);
assert.equal(serializeDesign(DEFAULT_DECK).includes('"fences"'),false);
assert.equal(fenceQuoteSections(DEFAULT_DECK).length,0);
assert.equal(buildYardTakeoff(DEFAULT_DECK).sections.some(s=>/fence|concrete post footing/i.test(s.label)),false);

const run=straight();
assert.equal(horizontalSlatCount(6,.5),11);
assert.equal(fenceQuantities([run]).linearFt,16);
assert.equal(fenceQuantities([run]).posts,3);
assert.equal(fenceQuantities([run]).footings,3);
const solids=fenceSolids([run],()=>0);
const posts=solids.filter(s=>s.role==='post'),slats=solids.filter(s=>s.role==='slat');
assert.equal(posts.length,3);
assert.ok(posts.every(p=>p.h===74&&p.y===35&&p.color==='#1a1a1a'&&p.surface==='metal'));
assert.equal(posts[0].y+posts[0].h/2,72);
assert.equal(posts[0].y-posts[0].h/2,-2);
assert.equal(slats.length,22);
assert.ok(slats.every(s=>s.w===92&&s.h===5.5&&s.color==='#a8754c'&&s.surface==='cedar'));

const gated=addFenceGate(run,'single','gate-1');
assert.equal(gated.gates.length,1);
assert.equal(gated.gates[0].kind,'single');
assert.equal(gated.gates[0].widthIn,42);
assert.equal(gated.gates[0].selfClosing,false);
assert.deepEqual(fencePosts(gated).map(p=>p.station),[0,73,119,192]);
assert.equal(fenceQuantities([gated]).posts,4);

const cornerA=newFenceRun('cedar-horizontal',[{x:0,y:0},{x:96,y:0}],'corner-a','West');
const cornerB=newFenceRun('cedar-horizontal',[{x:96,y:0},{x:96,y:96}],'corner-b','Rear');
assert.equal(fenceQuantities([cornerA,cornerB]).posts,3);
assert.equal(fenceSolids([cornerA,cornerB],()=>0).filter(s=>s.role==='post').length,3);
assert.equal(fenceSolids([cornerA,cornerB],()=>0).filter(s=>s.role==='collar').length,3);

const pool=addFenceGate(validateFences([{...newFenceRun('aluminum-picket',line(0,240),'pool','Pool fence'),poolEnclosure:true,slatGapIn:4}])[0],'single','pool-gate');
assert.equal(pool.gates[0].selfClosing,true);
assert.equal(pool.gates[0].latching,true);
const quotes=fenceQuoteSections({fences:[pool]});
assert.ok(quotes.every(q=>q.amountCents===null&&q.quantity>0));
assert.ok(quotes.some(q=>q.label.endsWith('concrete post footings')&&q.note.includes(FROST_FOOTING_NOTE)));
assert.ok(quotes.some(q=>q.label.endsWith('pool enclosure review')&&q.note===POOL_ENCLOSURE_NOTE));
assert.ok(quotes.some(q=>q.note.includes('100 mm')));
assert.equal(JSON.stringify(quotes).includes('$'),false);
assert.equal(fenceQuoteSections({fences:[{...pool,enabled:false}]}).length,0);

throws(()=>validateFences([{...run,heightFt:3}]),'height');
throws(()=>validateFences([{...run,id:'bad id'}]),'id');
throws(()=>validateFences([{...run,style:'picket'}]),'style');
throws(()=>validateFences([{...run,infillColor:'cedar'}]),'colour');
throws(()=>validateFences([{...run,finish:'Cherry'}]),'finish');
throws(()=>validateFences([{...run,gates:[{id:'g',kind:'triple',stationIn:96,widthIn:42,selfClosing:false,latching:false}]}]),'gate kind');

const saved=parseDesign(serializeDesign(validateDesign({...DEFAULT_DECK,fences:[run,pool]})));
assert.equal(saved.fences?.length,2);
assert.equal(saved.fences?.[0].style,'cedar-horizontal');
assert.equal(saved.fences?.[1].poolEnclosure,true);

const base=calculateEstimate(DEFAULT_DECK);
const fenced=calculateEstimate({...DEFAULT_DECK,fences:[run]});
const off=calculateEstimate({...DEFAULT_DECK,fences:[{...run,enabled:false}]});
assert.equal(fenced.subtotal,base.subtotal);
assert.equal(off.subtotal,base.subtotal);
assert.equal(splitSubtotal(fenced).deck,splitSubtotal(base).deck);
const fenceLines=fenced.sections.filter(s=>s.title.startsWith('Yard · Privacy fence'));
assert.ok(fenceLines.length>=3);
assert.ok(fenceLines.every(s=>s.quoteRequired&&s.total===0&&s.items.every(i=>i.cost===null)));
assert.ok(fenced.quoteRequired.some(q=>q.includes('Privacy fence — Modern horizontal slat cedar')));
assert.equal(base.quoteRequired.some(q=>q.includes('Privacy fence')),false);
assert.equal(off.sections.some(s=>s.title.includes('Privacy fence')),false);
assert.equal(deckExportMeshes(DEFAULT_DECK,base.model).some(m=>m.name.startsWith('fence_')),false);
assert.ok(deckExportMeshes({...DEFAULT_DECK,fences:[run]},fenced.model).some(m=>m.name.startsWith('fence_post_')));
assert.ok(deckExportMeshes({...DEFAULT_DECK,fences:[run]},fenced.model).some(m=>m.name.startsWith('fence_footing_')));

console.log('Deck fences: 5 styles, default-off, 16 ft / 3 posts / 22 slats, gate jambs, shared corner, quote-required.');
