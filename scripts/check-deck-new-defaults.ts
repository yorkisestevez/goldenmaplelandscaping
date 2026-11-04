import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK,NEW_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import type {DeckData} from '../src/features/deckcraft/types';
import {newSkirting,skirtingPlan} from '../src/features/deckcraft/skirting';
import {parseDesign,serializeDesign} from '../src/features/deckcraft/designPersistence';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {SECTIONS,sectionChanged} from '../src/features/deckcraft/designer/sections';
import {starterDeck} from '../src/features/deckcraft/estimatorDeck';
import {deckSizeForArea} from '../src/features/deckcraft/estimatorHandoff';
import {claddingPlan} from '../src/features/deckcraft/stairCladding';
import {OPEN_TREAD_EXTENSION_IN} from '../src/features/deckcraft/stairConstruction';
import {stairPads} from '../src/features/deckcraft/stairPads';
import {padPavers} from '../src/features/deckcraft/stairPadPavers';
import {PAVER_BRANDS} from '../src/data/carrPrices';
import {designIssues,isReviewNote} from '../src/features/deckcraft/designer/reviewNotes';

// Owner 2026-11-02: a deck started in the studio stands on helical piles, is skirted, and has open stringer stairs landing
// on a paver pad. Saved designs are parsed onto DEFAULT_DECK, which has none of these: a save reopens as it was quoted.
let checks=0;const ok=(cond:unknown,msg:string)=>{assert(cond,msg);checks++;};
const fresh=():DeckData=>deckReleaseData(structuredClone(NEW_DECK));

ok(NEW_DECK.foundation==='Helical Piles','A new deck stands on helical piles');
assert.deepEqual(NEW_DECK.skirting,newSkirting(),'A new deck is skirted with the editor\'s own new skirting');checks++;
ok(NEW_DECK.stairSides==='Open'&&NEW_DECK.stairPad===true,'A new deck has open stringer stairs on a paver pad');
ok(DEFAULT_DECK.foundation==='Concrete Piers'&&DEFAULT_DECK.skirting===undefined&&DEFAULT_DECK.stairSides===undefined&&DEFAULT_DECK.stairPad===undefined,'The parse base keeps concrete piers, no skirting and boxed stairs without a pad');
const plan=skirtingPlan(fresh(),buildDeckTakeoff(fresh()));
ok(plan&&plan.edges.length>0,'The default deck draws skirting on its open sides');

// Round trips: a new design keeps both; one with skirting taken off stays off; an older save stays as it was.
const saved=parseDesign(serializeDesign(fresh()));
ok(saved.foundation==='Helical Piles'&&saved.skirting?.style==='Horizontal boards','A new design reopens on helical piles with skirting');
const off={...fresh(),skirting:undefined};
ok(parseDesign(serializeDesign(off)).skirting===undefined,'Skirting taken off a new design stays off when it reopens');
const old=deckReleaseData(structuredClone(DEFAULT_DECK)),reopened=parseDesign(serializeDesign(old));
ok(reopened.foundation==='Concrete Piers'&&reopened.skirting===undefined,'An older save reopens on concrete piers without skirting');
ok(calculateDeckReleaseEstimate(reopened,DECK_SETTINGS).total===calculateDeckReleaseEstimate(old,DECK_SETTINGS).total,'An older save reopens at its saved price');
ok(reopened.stairSides===undefined&&reopened.stairPad===undefined,'An older save reopens with boxed stairs and no pad');
const plainStairs=parseDesign(serializeDesign({...fresh(),stairSides:undefined,stairPad:undefined}));
ok(plainStairs.stairSides===undefined&&plainStairs.stairPad===undefined,'Boxed stairs without a pad stay that way when a new design reopens');
ok(saved.stairSides==='Open'&&saved.stairPad===true,'Open stairs and the pad survive a save');

// Open stringers (default 16 × 12 ft deck, 36 in high, one 48 in flight of 5 risers): every tread runs 1.5 in past the stair
// width on each side, 1 in past a 0.75 in fascia on the outer stringer's face (0.25 in inside the width).
const model=buildDeckTakeoff(fresh()),boxed={...fresh(),stairSides:undefined},boxedModel=buildDeckTakeoff(boxed);
ok(OPEN_TREAD_EXTENSION_IN===1.5&&model.treads.length===4&&model.treads.every(t=>t.w===48+3),'Open treads are 51 in long on a 48 in stair');
ok(boxedModel.treads.every(t=>t.w===48),'Boxed treads stay the stair width');
const sides=claddingPlan(fresh(),model).slabs.filter(s=>s.part==='stair-side'),flight=model.flights[0];
ok(sides.length===8&&sides.every(s=>Math.abs(Math.abs(s.a.x-flight.start.x)-24.125)<1e-9),'The fascia stands on each outer stringer, centred 24.125 in from the stair centre');
// The stringer's underside runs from its throat (36 − 7.2 − 9.25 = 19.55 in) at the deck to the ground at the last riser.
const top=sides.filter(s=>Math.abs(s.topA-27.8)<1e-9);
ok(top.length===2&&top.every(s=>Math.abs(Math.min(s.bottomA,s.bottomB)-14.575)<.01&&Math.abs(Math.max(s.bottomA,s.bottomB)-19.55)<.01),"Under the top tread the fascia stops at the stringer's underside, not the ground");
ok(sides.filter(s=>Math.min(s.bottomA,s.bottomB)===0).length===2,"Only the last step's fascia reaches the ground");
const boxedSides=claddingPlan(boxed,boxedModel).slabs.filter(s=>s.part==='stair-side');
ok(boxedSides.every(s=>s.bottomA===0&&s.bottomB===0),'Boxed sides still run down to the ground');
ok(model.issues.some(i=>i.startsWith('Open stringer stairs'))&&!boxedModel.issues.some(i=>i.startsWith('Open stringer stairs')),"Open stairs ask the builder to confirm the tread's side overhang");
ok(isReviewNote(model.issues.find(i=>i.startsWith('Open stringer stairs'))!),'The overhang note is a review note');
// The starter design has nothing to review (owner, starter zero issues): skirting's descriptive notes are notes too, while
// a skirting that cannot take an access panel, or has none, still asks for a change.
const issuesOf=(d:DeckData)=>{const e=calculateDeckReleaseEstimate(d,DECK_SETTINGS);return designIssues([...new Set([...e.flags,...e.quoteRequired])]);};
assert.deepEqual(issuesOf(fresh()),[],'A new design has no issues to review');checks++;
ok(issuesOf({...fresh(),skirting:{...NEW_DECK.skirting!,accessPanels:0}}).some(i=>i.startsWith('Skirting access: no access panel is included')),'Skirting without an access panel is still an issue');
// The open stair hangs in front of the rim, so the skirting carries on behind it (48 in + 1 in each side), with no access
// panel there even when every run is asked for one.
const behind=(d:DeckData)=>skirtingPlan(d,buildDeckTakeoff(d))!.runs.filter(r=>r.behindStair);
ok(behind(fresh()).length===1&&Math.abs(behind(fresh())[0].lengthIn-50)<1e-9,'Skirting carries on behind an open stair');
ok(behind(boxed).length===0,'Boxed stairs still leave the skirting open across the stair');
const panelled={...fresh(),skirting:{...NEW_DECK.skirting!,accessPanels:6}},panelRuns=skirtingPlan(panelled,buildDeckTakeoff(panelled))!;
ok(panelRuns.frames.length>0&&panelRuns.frames.every(f=>behind(panelled).every(r=>Math.min(f.a.y,f.b.y)>r.a.y+.5||Math.max(f.a.y,f.b.y)<r.a.y-.5||Math.max(f.a.x,f.b.x)<Math.min(r.a.x,r.b.x)||Math.min(f.a.x,f.b.x)>Math.max(r.a.x,r.b.x))),'No access panel is framed behind the stair');
const path={...fresh(),stairPath:{points:[{x:48,y:144},{x:96,y:144}]}};
ok(buildDeckTakeoff(path).treads.every(t=>t.w<=48+2),'A drawn stair path keeps its treads to its width');

// The pad: 36 in out from the last riser, 3 in wider each side (54 × 36 in = 13.5 sq ft), its top at the stair's foot, priced
// at Permacon Melville's installed rate.
const pads=stairPads(fresh(),model),melville=PAVER_BRANDS.find(p=>p.id==='permacon-melville')!;
ok(pads.length===1&&Math.abs(pads[0].areaSqft-13.5)<1e-9&&pads[0].topIn===flight.end.y,'One 13.5 sq ft pad at the foot of the stair');
ok(padPavers(pads[0]).length>0&&padPavers(pads[0]).every(p=>p.w<=12&&p.d<=6),'The pad is laid in 12 × 6 in pavers');
const padRow=calculateDeckReleaseEstimate(fresh(),DECK_SETTINGS).sections.find(s=>s.title==='Stair landing pad');
ok(melville.installedPerSqft===32&&padRow&&Math.abs(padRow.total-13.5*32)<1e-6,'The pad is priced at $32 per sq ft installed ($432)');
ok(stairPads({...fresh(),stairPad:undefined},model).length===0&&!calculateDeckReleaseEstimate({...fresh(),stairPad:undefined},DECK_SETTINGS).sections.some(s=>s.title==='Stair landing pad'),'No pad, no pad price');
const onPatio={...fresh(),stairTargets:[{flightId:'grade-0',elevationIn:0,riserCount:5,treadDepthIn:10.6875,surface:'patio' as const,patioId:'p1'}]};
ok(stairPads(onPatio,model).length===0,'A stair that lands on a patio gets no pad');

// A fresh design shows no section as changed, and the cost estimator's starter deck is the deck the studio opens with.
for(const section of SECTIONS)ok(!sectionChanged(section,fresh()),`A new design leaves ${section.id} unchanged`);
const sqft=240,starter=deckReleaseData({...structuredClone(NEW_DECK),...deckSizeForArea(sqft)});
ok(starterDeck(sqft).subtotalCents===Math.round(calculateDeckReleaseEstimate(starter,DECK_SETTINGS).subtotal*100),'The estimator prices the deck the studio opens with');

// Every place that starts a new design starts from NEW_DECK.
for(const file of ['../src/features/deckcraft/designer/useDeckDesign.ts','../src/pages/DeckDesigner.tsx']){
  const text=readFileSync(new URL(file,import.meta.url),'utf8');
  ok(text.includes('structuredClone(NEW_DECK)')&&!text.includes('structuredClone(DEFAULT_DECK)'),`${file} starts a new design from NEW_DECK`);
}
console.log(`New-design defaults: ${checks} checks passed.`);
