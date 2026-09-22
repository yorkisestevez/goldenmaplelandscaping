import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff,type DeckLevel,type DeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {getHouseContact} from '../src/features/deckcraft/houseContact';
import {getHousePlacement} from '../src/features/deckcraft/housePlacement';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {unsupportedJoistEnds} from '../src/features/deckcraft/constructionDetails';
import {parseDesign,serializeDesign,validateDesign,defaultLevel3} from '../src/features/deckcraft/designPersistence';
import {deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {activeWrap} from '../src/features/deckcraft/lib/wrapGeometry';
import {polygonCut,signedArea} from '../src/features/deckcraft/lib/polygonCuts';
import type {DeckData} from '../src/features/deckcraft/types';

let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const design=(patch:Partial<DeckData>):DeckData=>deckReleaseData({...structuredClone(DEFAULT_DECK),...patch});
const box=(l:DeckLevel)=>{const xs=l.footprint.outline.map(p=>p.x+l.offset.x),zs=l.footprint.outline.map(p=>p.y+l.offset.z);return {x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs)};};
const world=(l:DeckLevel)=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}));
const rect=(b:{x0:number;x1:number;z0:number;z1:number})=>[{x:b.x0,y:b.z0},{x:b.x1,y:b.z0},{x:b.x1,y:b.z1},{x:b.x0,y:b.z1}];
/** Overlap of the real outlines (a wrap-around's bounding box covers the house between its wings). */
const overlap=(a:{x:number;y:number}[],b:{x:number;y:number}[])=>polygonCut([a],[b]).some(p=>Math.abs(signedArea(p))>1);
const decks=(m:DeckTakeoff)=>m.levels.filter(l=>l.kind==='deck');

/** Every section is clear of the house and of each other, every joist end bears, sections are joined
 * where their stair or step meets them (no guard rail across it), and grade stairs leave the lowest section. */
function sound(d:DeckData,tag:string){
  const m=buildDeckTakeoff(d),ds=decks(m),h=getHousePlacement(d),house={x0:h.x0,x1:h.x1,z0:-h.depthIn,z1:0};
  ok(ds.length===d.levels,`${tag}: builds ${d.levels} deck sections`);
  ok(ds.every(l=>!overlap(world(l),rect(house))),`${tag}: no deck section runs into the house`);
  ok(ds.every((l,i)=>ds.every((o,j)=>j<=i||!overlap(world(l),world(o)))),`${tag}: deck sections do not overlap`);
  ok(ds.every(l=>unsupportedJoistEnds(l,l.index===0?getHouseContact(d,l.footprint):undefined).length===0),`${tag}: every joist end bears`);
  ok(m.connections.length===d.levels-1,`${tag}: one connection per extra section`);
  for(const c of m.connections){
    const parent=m.levels[c.from],child=m.levels[c.to],o=c.opening.outward;
    const mid={x:parent.offset.x+c.opening.origin.x+c.opening.along.x*c.opening.width/2,z:parent.offset.z+c.opening.origin.y+c.opening.along.y*c.opening.width/2};
    const at={x:mid.x+o.x*c.run,z:mid.z+o.y*c.run},k=Math.abs(o.y)>.5?'x':'z',lo=at[k]-c.opening.width/2+1,hi=at[k]+c.opening.width/2-1;
    // No guard run of the joined section lies across the step or stair where it arrives.
    const blocked=m.railing.rails.some(r=>Math.abs(r.a.y-r.b.y)<1e-6&&Math.abs(r.a.y-child.top-3)<.01&&Math.abs(r.a[k==='x'?'z':'x']-at[k==='x'?'z':'x'])<1&&Math.abs(r.b[k==='x'?'z':'x']-at[k==='x'?'z':'x'])<1&&Math.max(r.a[k],r.b[k])>lo&&Math.min(r.a[k],r.b[k])<hi);
    ok(!blocked,`${tag}: the ${c.to===1?'second':'third'} section's opening lines up with its stair`);
  }
  const lowest=Math.min(...ds.map(l=>l.top)),grade=m.flights.filter(f=>f.kind==='grade');
  ok(!grade.length||grade.every(f=>Math.abs(f.start.y-lowest)<.01),`${tag}: grade stairs leave the lowest section`);
  return m;
}

// 1. Bug fix: a deep side section used to run into the house; it now slides clear, still joined to its stair.
{
  const d=design({levels:2,height:36,height2:29,level2Position:'Left',length2:20,width2:10});
  const m=sound(d,'deep left section');
  ok(box(decks(m)[1]).z0>=-.01,'The deep side section lines up with the house wall instead of entering the house');
  ok(!m.issues.some(i=>/runs into the house/.test(i)),'No house warning once it has slid clear');
}

// 2. Matrix: sides × drops (split step, flush, 4 ft, over 14 risers) × attachment × full-width step.
let cases=0;
for(const side of ['Front','Left','Right'] as const)for(const [h1,h2] of [[36,29],[36,36],[72,24],[140,24]])for(const deckType of ['Attached','Freestanding'] as const)for(const full of [false,true]){
  sound(design({levels:2,height:h1,height2:h2,level2Position:side,deckType,level2FullStep:full||undefined,width2:12,length2:16}),`${side} ${h1}→${h2} ${deckType}${full?' full step':''}`);cases++;
}

// 3. Split level preset: one riser across the whole shared edge, no stair guards, no zero-run stringers.
{
  const d=design({levels:2,level2Position:'Front',height:36,height2:29,width2:16,length2:9,level2FullStep:true});
  const m=sound(d,'split level'),step=m.flights.find(f=>f.kind==='connection')!;
  ok(step.risers===1&&Math.abs(step.width-16*12)<.01,'A split level is one full-width step');
  ok(!m.stringers.some(s=>Math.abs(s.a.y-step.start.y+9)<.01&&Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z)<1),'A one-riser step sits on the lower rim: no zero-run stringers');
  const railsAtStep=m.railing.rails.filter(r=>Math.abs(r.a.y-r.b.y)>1&&[r.a,r.b].some(p=>Math.abs(p.z-step.start.z)<1&&p.y>step.start.y));
  ok(railsAtStep.length===0,'No stair guards on a one-step split');
  const plain=buildDeckTakeoff(design({levels:2,level2Position:'Front',height:36,height2:29,width2:16,length2:9}));
  ok(m.quantities.railingLf<plain.quantities.railingLf,'The full-width step removes the guard between the two sections');
}

// 4. Three levels: a cascade, a third section off the main deck, and one off a wrap wing.
{
  const cascade=design({levels:3,height:72,height2:48,level2Position:'Front',width2:12,length2:10,level3:{widthFt:10,lengthFt:8,heightIn:24,parent:2,position:'Front',offsetPct:50}});
  const m=sound(cascade,'three-level cascade');
  ok(m.flights.filter(f=>f.kind==='connection').length>=2,'Each section is joined by its own stair');
  ok(calculateEstimate(cascade).total>calculateEstimate({...cascade,levels:2}).total,'A third section is priced');
  sound(design({levels:3,height:48,height2:36,level2Position:'Left',level3:{widthFt:8,lengthFt:8,heightIn:24,parent:1,position:'Right',offsetPct:30,fullStep:true}}),'third section off the main deck');
  const house={...getHouseConfig({...structuredClone(DEFAULT_DECK),width:20}),widthFt:24,depthFt:20};
  const wrap=design({width:22,length:12,height:36,houseConfig:house,wrap:{right:{widthFt:12,runFt:10}},levels:2,height2:24,level2EdgeId:'wingR-end',width2:10,length2:8});
  ok(activeWrap(wrap),'A wrap-around keeps its wings with a lower section');
  const w=sound(wrap,'lower section off a wrap wing end');
  ok(box(decks(w)[1]).z1<=-10*12+.5,'The section sits behind the wing end, beside the house');
  sound(design({...wrap,levels:3,level3:{widthFt:10,lengthFt:8,heightIn:12,parent:1,position:'Front',offsetPct:20,edgeId:'wingR-side'}}),'wrap with two lower sections');
}

// 5. Save/load and validation.
{
  const d=design({levels:3,level2FullStep:true,level3:{widthFt:9,lengthFt:7,heightIn:20,parent:2,position:'Left',offsetPct:40,fullStep:true}});
  const back=parseDesign(serializeDesign(d));
  assert.deepEqual(back.level3,d.level3);assert.equal(back.level2FullStep,true);assert.equal(back.levels,3);checks++;
  ok(validateDesign({...d,level3:undefined}).level3?.parent===defaultLevel3(d).parent,'Three levels without a third section get the default one');
  assert.throws(()=>validateDesign({...d,levels:4}));assert.throws(()=>validateDesign({...d,level3:{...d.level3,parent:3}}));assert.throws(()=>validateDesign({...d,level3:{...d.level3,widthFt:90}}));checks+=3;
  ok(validateDesign({...d,level2EdgeId:'main-front'}).level2EdgeId===undefined,'A level edge name is dropped on a deck without that edge');
  const house={...getHouseConfig({...structuredClone(DEFAULT_DECK),width:20}),widthFt:24,depthFt:20};
  ok(validateDesign({width:22,length:12,houseConfig:house,wrap:{right:{widthFt:12,runFt:10}},levels:2,level2EdgeId:'wingR-ledger'}).level2EdgeId===undefined,'A level cannot join a house wall');
}
console.log(`DECK LEVELS OK — ${cases} two-level matrix designs, ${checks} house-clearance, overlap, bearing, stair-alignment, split-level, three-level, wrap and persistence checks.`);
