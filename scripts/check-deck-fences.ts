// Fences and gates (S9, owner 2026-11-03): drawn runs priced at standard installed rates (the midpoints of HomeStars'
// 2026 Canadian ranges), unconfirmed and editable per user; 4, 5 or 6 ft, about 11.5% less per foot under 6 ft; gate
// openings are not counted as fence. Designs without fences load no fence code and price exactly as before.
import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData} from '../src/features/deckcraft/types';
import {fenceRuntimeReady,loadFenceRuntime,type Fence} from '../src/features/deckcraft/fences';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {ensureDesignExtensions,designExtensionsReady} from '../src/features/deckcraft/designExtensions';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {buildYardTakeoff} from '../src/features/deckcraft/yardTakeoff';
import {splitSubtotal} from '../src/features/deckcraft/backyard';
import {mergeHardscapeLabour,validateHardscapeLabour} from '../src/features/deckcraft/hardscapeLabour';
import {assertUniqueObjectIds} from '../src/features/deckcraft/editorOrganization';
import {hasBackyardLayout} from '../src/features/deckcraft/backyard';
import {decodeDesignLink,encodeDesignLink} from '../src/features/deckcraft/designLink';
import {parsePrivateProject,serializePrivateProject} from '../src/features/deckcraft/designer/jobRevisionLibrary';

let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;},eq=(a:unknown,b:unknown,m:string)=>{assert.deepEqual(a,b,m);checks++;},bad=(f:()=>unknown,pattern:RegExp,m:string)=>{assert.throws(f,pattern,m);checks++;};

const plain=structuredClone(DEFAULT_DECK);
const before=calculateEstimate(plain);
ok(!fenceRuntimeReady(),'a design without fences loads no fence code');
await ensureDesignExtensions(JSON.parse(serializeDesign(plain)));
ok(!fenceRuntimeReady(),'preparing a design without fences still loads no fence code');

const fence=(over:Partial<Fence>={}):Fence=>({id:'fence-1',name:'Back fence',style:'wood-privacy',heightFt:6,points:[{xIn:0,zIn:360},{xIn:480,zIn:360}],gates:[],...over});
const withFences=(fences:Fence[],extra:Partial<DeckData>={}):DeckData=>({...structuredClone(DEFAULT_DECK),fences,...extra});

// The runtime arrives with any design that has fences (saved, shared, imported or in the price worker).
await ensureDesignExtensions({configuration:{fences:[fence()]}});
ok(fenceRuntimeReady(),'preparing a design with fences loads the fence runtime');
ok(designExtensionsReady({configuration:{fences:[fence()]}}),'its extensions then report ready');
await loadFenceRuntime();
const {FENCE_RATES,fenceQuantities,fenceTakeoff,validateFences}=await import('../src/features/deckcraft/fenceRuntime');

// Standard rates: the cited midpoints.
eq(FENCE_RATES,{pressureTreated:36,cedar:65,horizontalCedar:65,vinyl:50,aluminum:67.5,chainLink:20,singleGate:950,doubleGate:2150},'standard rates are the HomeStars 2026 midpoints');

// Prices: a 40 ft pressure-treated 6 ft run is 40 × $36.
const priced=(f:Fence,extra:Partial<DeckData>={})=>fenceTakeoff(withFences([f],extra));
eq(priced(fence()).map(r=>r.amountCents),[144000],'40 ft of 6 ft pressure-treated privacy is $1,440');
// A single gate takes 4 ft out of the run and adds $950.
const gated=priced(fence({gates:[{id:'gate-1',kind:'single',atIn:240}]}));
eq(gated.map(r=>r.amountCents),[129600,95000],'a single gate: 36 ft of fence and $950');
ok(/1 single gate/.test(gated[1].label),'the gate row names its gates');
// A double gate takes 10 ft and adds $2,150.
eq(priced(fence({gates:[{id:'gate-1',kind:'double',atIn:240}]})).map(r=>r.amountCents),[108000,215000],'a double gate: 30 ft of fence and $2,150');
// Heights step 11.5% per foot under 6 ft.
eq(priced(fence({style:'vinyl-privacy',heightFt:5})).map(r=>r.amountCents),[Math.round(40*50*.885*100)],'5 ft vinyl is 11.5% under 6 ft');
eq(priced(fence({style:'chain-link',heightFt:4})).map(r=>r.amountCents),[Math.round(40*20*.77*100)],'4 ft chain link is 23% under 6 ft');
for(const [style,wood,rate] of [['wood-privacy','cedar',65],['horizontal-cedar',undefined,65],['aluminum-picket',undefined,67.5]] as const)
 eq(priced(fence({style,...(wood?{wood}:{})})).map(r=>r.amountCents),[Math.round(40*rate*100)],`${style}${wood?` (${wood})`:''} at $${rate}/lf`);
// A run with a corner prices its whole length.
eq(fenceQuantities(fence({points:[{xIn:0,zIn:0},{xIn:240,zIn:0},{xIn:240,zIn:120}]}),FENCE_RATES).lengthLf,30,'a corner run measures both parts');
// Per-user rates replace the standard ones; absent ones stay standard.
eq(priced(fence({gates:[{id:'gate-1',kind:'single',atIn:240}]}),{hardscapeLabour:mergeHardscapeLabour(undefined,{fenceRates:{pressureTreated:40,singleGate:1000}})}).map(r=>r.amountCents),[36*40*100,100000],'the user\'s own rates price the run and gate');
eq(priced(fence({style:'vinyl-privacy'}),{hardscapeLabour:mergeHardscapeLabour(undefined,{fenceRates:{pressureTreated:40}})}).map(r=>r.amountCents),[200000],'a rate the user did not set stays standard');

// Per-user rate settings: known rates only, amounts in cents.
eq(validateHardscapeLabour({...validateHardscapeLabour(undefined),fenceRates:{cedar:70.25}}).fenceRates,{cedar:70.25},'a saved cedar rate is kept');
bad(()=>validateHardscapeLabour({...validateHardscapeLabour(undefined),fenceRates:{iron:100}}),/Unsupported fence rates/,'an unknown fence rate is refused');
bad(()=>validateHardscapeLabour({...validateHardscapeLabour(undefined),fenceRates:{cedar:-1}}),/Fence rate \(cedar\)/,'a negative rate is refused');
bad(()=>validateHardscapeLabour({...validateHardscapeLabour(undefined),fenceRates:{cedar:1.005}}),/Fence rate \(cedar\)/,'a rate finer than a cent is refused');
ok(validateHardscapeLabour(undefined).fenceRates===undefined,'the default rate settings carry no fence rates');

// Checks on saved fences.
eq(validateFences([fence()]),[fence()],'a plain fence passes');
bad(()=>validateFences([fence({style:'iron' as Fence['style']})]),/choose a fence style/,'an unknown style is refused');
bad(()=>validateFences([fence({heightFt:7 as Fence['heightFt']})]),/4, 5 or 6 ft/,'a 7 ft fence is refused');
bad(()=>validateFences([fence({style:'vinyl-privacy',wood:'cedar'})]),/only a wood privacy fence/,'cedar on a vinyl fence is refused');
bad(()=>validateFences([fence({points:[{xIn:0,zIn:0}]})]),/2 to 64 points/,'a single point is refused');
bad(()=>validateFences([fence({points:[{xIn:0,zIn:0},{xIn:6,zIn:0}]})]),/at least 1 ft/,'a 6 in part is refused');
bad(()=>validateFences([fence({gates:[{id:'gate-1',kind:'single',atIn:470}]})]),/fit inside one straight part/,'a gate past the end is refused');
bad(()=>validateFences([fence({points:[{xIn:0,zIn:0},{xIn:240,zIn:0},{xIn:240,zIn:240}],gates:[{id:'gate-1',kind:'single',atIn:240}]})]),/fit inside one straight part/,'a gate across a corner is refused');
bad(()=>validateFences([fence({gates:[{id:'gate-1',kind:'single',atIn:200},{id:'gate-2',kind:'single',atIn:230}]})]),/cannot overlap/,'overlapping gates are refused');
bad(()=>validateFences([fence(),fence()]),/its own identifier/,'two fences with one id are refused');
bad(()=>validateFences([{...fence(),colour:'red'}]),/plain saved values/,'an unknown field is refused');
bad(()=>validateFences(Array.from({length:21},(_,i)=>fence({id:`fence-${i}`}))),/up to 20 fences/,'more than 20 fences are refused');

// Saving, loading and sharing keep fences.
const design=withFences([fence({gates:[{id:'gate-1',kind:'double',atIn:240}]})]);
eq(parseDesign(serializeDesign(design)).fences,design.fences,'a saved design reloads its fences');
bad(()=>validateDesign({...design,fences:[fence({heightFt:3 as Fence['heightFt']})]}),/4, 5 or 6 ft/,'loading refuses a bad fence');
const link=await encodeDesignLink(design,'https://goldenmaplelandscaping.ca'),shared=await decodeDesignLink(link.slice(link.indexOf('#d=')+3));
eq(shared.fences,design.fences,'a share link keeps its fences');
eq(Math.round(calculateEstimate(shared).total*100),Math.round(calculateEstimate(design).total*100),'a shared design has the same price');
eq(parsePrivateProject(serializePrivateProject(design)).fences,design.fences,'a saved job keeps its fences (the autosave path)');
bad(()=>assertUniqueObjectIds({fences:[fence({id:'patio-1'})],yardFeatures:[{id:'patio-1'} as NonNullable<DeckData['yardFeatures']>[number]]}),/unique/,'a fence cannot share an id with a yard feature');
ok(hasBackyardLayout(design),'a fence is part of the backyard layout');

// The estimate: one Yard row per fence and per fence's gates, in the backyard subtotal; nothing else moves.
const estimate=calculateEstimate(design),rows=estimate.sections.filter(s=>s.title.startsWith('Yard · Back fence'));
eq(rows.map(s=>s.total),[1080,2150],'the estimate lists the fence and its gate as Yard rows');
ok(!rows.some(s=>s.quoteRequired),'fence rows are priced, not quotes');
const split=splitSubtotal(estimate),plainSplit=splitSubtotal(before);
eq(Math.round((split.backyard-plainSplit.backyard)*100),108000+215000,'the backyard subtotal grows by the fence and gate');
eq(Math.round(split.deck*100),Math.round(plainSplit.deck*100),'the deck subtotal does not move');
eq(buildYardTakeoff(withFences([])).sections.filter(s=>s.id.startsWith('fence')),[],'an empty fence list prices nothing');
eq(calculateEstimate(structuredClone(DEFAULT_DECK)).sections.map(s=>[s.title,s.total]),before.sections.map(s=>[s.title,s.total]),'a design without fences prices exactly as before');

// Layout: posts at the ends, both sides of each gate and at most the style's spacing apart; corners share a post.
const {fenceLayout}=await import('../src/features/deckcraft/fenceRuntime');
const plainRun=fenceLayout(fence());
eq([plainRun.spans.length,plainRun.gates.length,plainRun.posts.map(p=>p.xIn)],[1,0,[0,96,192,288,384,480]],'40 ft of wood privacy stands on 6 posts 8 ft apart');
const gateRun=fenceLayout(fence({gates:[{id:'gate-1',kind:'single',atIn:240}]}));
eq(gateRun.spans.map(s=>[s.start.xIn,s.end.xIn]),[[0,216],[264,480]],'a single gate leaves a 4 ft opening in the middle');
eq(gateRun.gates.map(g=>[g.start.xIn,g.end.xIn]),[[216,264]],'the gate fills the opening');
ok(gateRun.posts.some(p=>p.xIn===216)&&gateRun.posts.some(p=>p.xIn===264),'gate posts stand on both sides of the opening');
ok(gateRun.posts.every((p,i,all)=>i===0||Math.abs(p.xIn-all[i-1].xIn)<=96+1e-9),'no two posts are more than 8 ft apart');
eq(fenceLayout(fence({style:'chain-link'})).posts.length,5,'chain link posts are 10 ft apart');
eq(fenceLayout(fence({style:'aluminum-picket'})).posts.length,8,'aluminum posts are 6 ft apart (40 ft in 7 panels)');
eq(fenceLayout(fence({points:[{xIn:0,zIn:0},{xIn:96,zIn:0},{xIn:96,zIn:96}]})).posts.length,3,'two 8 ft parts share their corner post');

// Moving corners keeps each gate where it stands on the ground (review, S9: gates had slid along with corner 1).
const {fenceWithPoints,runPointAt,newFence}=await import('../src/features/deckcraft/fenceRuntime');
const gated1=fence({gates:[{id:'gate-1',kind:'single',atIn:240}]}),stretched=fenceWithPoints(gated1,[{xIn:-60,zIn:360},{xIn:480,zIn:360}]);
eq(stretched.gates[0].atIn,300,'stretching corner 1 out by 5 ft keeps the gate on the same spot (now 25 ft along, not 20)');
eq(runPointAt(stretched.points,stretched.gates[0].atIn),{xIn:240,zIn:360},'the gate stands where it stood');
eq(fenceWithPoints(gated1,[{xIn:0,zIn:360},{xIn:600,zIn:360}]).gates[0].atIn,240,'moving the far corner leaves the gate alone');
const corner=fence({points:[{xIn:0,zIn:0},{xIn:240,zIn:0},{xIn:240,zIn:240}],gates:[{id:'gate-1',kind:'single',atIn:360}]});
// The gate stood at (240, 120); on the new diagonal run its nearest point is 3/4 of the way along: 0.75 × 339.4 in.
eq(fenceWithPoints(corner,[{xIn:0,zIn:0},{xIn:240,zIn:240}]).gates[0].atIn,255,'removing a corner re-measures the gate to its nearest point on the new run');
ok(Object.values(runPointAt([{xIn:10,zIn:10},{xIn:10,zIn:10}],5)).every(Number.isFinite),'a zero-length part mid-drag gives a point, not NaN');
// New fences never repeat a name.
eq(newFence({width:16,length:12,fences:[fence({name:'Fence 2'})]}).name,'Fence 3','a new fence skips a name already in use');

// Layers and locks: a locked fence (or a fence on a locked layer) refuses every change; an unlocked one takes it.
const {loadEditorOrganizationRuntime,assertUnlockedChanges}=await import('../src/features/deckcraft/editorOrganization');await loadEditorOrganizationRuntime();
const locked=withFences([fence()],{editorOrganization:{layers:[{id:'design',name:'Design',visible:true,locked:false},{id:'yard',name:'Yard',visible:true,locked:true}],groups:[],objects:[{id:'fence-1',layerId:'yard',locked:false}]}});
bad(()=>assertUnlockedChanges(locked,{...locked,fences:[fence({heightFt:5})]}),/Back fence is locked/,'a fence on a locked layer refuses a change');
bad(()=>assertUnlockedChanges(locked,{...locked,fences:undefined}),/Back fence is locked/,'a locked fence cannot be removed');
const unlocked={...locked,editorOrganization:{...locked.editorOrganization!,layers:locked.editorOrganization!.layers.map(l=>({...l,locked:false}))}};
ok((assertUnlockedChanges(unlocked,{...unlocked,fences:[fence({heightFt:5})]}),true),'an unlocked fence takes the change');

console.log(`DECK FENCES OK — ${checks} checks.`);
