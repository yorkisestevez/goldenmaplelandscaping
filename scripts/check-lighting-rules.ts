import assert from 'node:assert/strict';
import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {ontarioShowcaseDesign,showcaseSampleIssues} from '../src/features/deckcraft/showcaseSample';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {extrasLayout,treadNose} from '../src/features/deckcraft/extrasLayout';
import {houseOutline} from '../src/features/deckcraft/houseFootprint';
import {lightingPlacementIssues,poolLightPlaces,poolWaterRing,poolWaterLevel,ringDistance,LIGHTING_RULES} from '../src/features/deckcraft/lightingPlacementRules';
import {POOL_LIGHT_ID,POOL_LENS_IN} from '../src/features/deckcraft/poolLightSpec';
import {syncAutoLighting} from '../src/features/deckcraft/lightingSystem';
import type {DeckData} from '../src/features/deckcraft/types';

await loadAdvancedYardRuntime();
const base=ontarioShowcaseDesign();await ensureLiveDesignExtensions(base);
const issuesOf=(d:DeckData)=>{const m=buildDeckTakeoff(d);return lightingPlacementIssues(d,m,extrasLayout(d,m).fixtures,{treadWidths:m.treads.map(t=>treadNose(t).width),houseRings:houseOutline(d)});};
const edit=(f:(d:DeckData)=>void)=>{const d=structuredClone(base);f(d);return d;};
const has=(list:string[],re:RegExp)=>list.some(m=>re.test(m));
const near3m=/within 3 m of the pool\. Use a GFCI/;
let checks=0;const ok=(cond:boolean,msg:string)=>{assert.ok(cond,msg);checks++;};

ok(showcaseSampleIssues(base).length===0,`showcase: ${showcaseSampleIssues(base).join(' | ')}`);
ok(issuesOf(base).filter(m=>!near3m.test(m)).length===0,`showcase rules: ${issuesOf(base).join(' | ')}`);
ok(has(issuesOf(base),near3m),'the pool-deck markers raise the 3 m GFCI/ESA note');

// Pool lights: the wall nearest the house, every 12 ft, lens top 18 in down, aimed away from the house.
const pool=base.pools![0],places=poolLightPlaces(pool,houseOutline(base)),ring=poolWaterRing(pool),water=poolWaterLevel(pool);
const zNear=Math.min(...ring.map(p=>p.y));
ok(places.length===3,'a 36 ft pool gets 3 lights');
ok(places.every(p=>Math.abs(p.z-zNear)<1&&Math.abs(Math.cos(p.angle)-1)<1e-6),'pool lights sit in the house-side wall, shining away from the house');
ok(places.every(p=>Math.abs(water-(p.y!+POOL_LENS_IN/2)-LIGHTING_RULES.poolLensTopBelowWaterIn)<.01),'lens top 18 in below the water');
ok(Math.abs(places[1].x-places[0].x-144)<1&&Math.abs(places[2].x-places[1].x-144)<1,'12 ft apart');
// An unpinned pool light is auto-placed by the rule.
{const d=edit(d=>{const i=d.lightingSystem.selectedItems.find(i=>i.productId===POOL_LIGHT_ID)!;delete i.places;});const m=buildDeckTakeoff(d);
 const got=extrasLayout(d,m).fixtures.filter(f=>f.productId===POOL_LIGHT_ID);ok(got.length===3&&got.every(f=>Math.abs(f.z-zNear)<1),'auto-placed pool lights follow the rule');}
ok(has(issuesOf(edit(d=>{d.lightingSystem.selectedItems=d.lightingSystem.selectedItems.filter(i=>i.productId!==POOL_LIGHT_ID);})),/has no underwater light/),'a pool without lights is flagged');
ok(has(issuesOf(edit(d=>{const i=d.lightingSystem.selectedItems.find(i=>i.productId===POOL_LIGHT_ID)!;i.places=i.places!.map(p=>({...p,y:p.y!-12}));})),/lens top is/),'a wrong lens depth is flagged');
ok(has(issuesOf(edit(d=>{const i=d.lightingSystem.selectedItems.find(i=>i.productId===POOL_LIGHT_ID)!;const far=Math.max(...ring.map(p=>p.y));i.places=i.places!.map(p=>({...p,z:far,angle:Math.PI}));})),/shines toward the house/),'a pool light aimed at the house is flagged');
// No lights in the coping, markers 36–48 in out, four or fewer.
const dots=(d:DeckData)=>d.lightingSystem.selectedItems.find(i=>i.productId==='dot_22')!;
ok(has(issuesOf(edit(d=>{dots(d).places!.push({x:288,z:zNear-6,angle:0});dots(d).qty++;})),/in the pool coping/),'a light in the coping is flagged');
ok(has(issuesOf(edit(d=>{dots(d).places!.push({x:288,z:zNear-30,angle:0});dots(d).qty++;})),/within 36 in of the pool coping/),'a marker within 36 in of the coping is flagged');
ok(has(issuesOf(edit(d=>{dots(d).places!.push({x:288,z:zNear-11-42,angle:0});dots(d).qty++;})),/flush markers\. Four or fewer/),'a fifth pool-deck marker is flagged');
ok(dots(base).places!.every(p=>{const e=ringDistance(p.x,p.z,ring)-11;return e>=36&&e<=48;}),'pool-deck markers are 36–48 in from the coping');
// No flush light in the middle of a seating floor.
{const t=base.landscapeObjects!.find(o=>o.id==='terrace-coffee')!;
 ok(has(issuesOf(edit(d=>{const i=d.lightingSystem.selectedItems.find(i=>i.productId==='fusion_22')!;i.places!.push({x:t.xIn,z:t.zIn,angle:0});i.qty++;})),/middle of a seating floor/),'a light in the terrace lounge is flagged');}
// Step lights: two a tread on the 8 ft stair.
ok(has(issuesOf(edit(d=>{d.autoLighting={...d.autoLighting!,stairsPerTread:1};const m=buildDeckTakeoff(d);d.lightingSystem.selectedItems=syncAutoLighting(d,{posts:0,stairs:m.treads.length,privacy:0});})),/two a tread on a stair over 60 in/),'one light a tread on an 8 ft stair is flagged');
// Path lights in beds only.
// The layout moves a pinned path light off the paving, so check the rule on the fixture list itself.
{const m=buildDeckTakeoff(base),fx=[...extrasLayout(base,m).fixtures,{productId:'liv',x:-252,y:0,z:312,angle:0,zone:'paths'}];
 ok(has(lightingPlacementIssues(base,m,fx,{treadWidths:m.treads.map(t=>treadNose(t).width)}),/outside a planting bed/),'a path light on the lawn is flagged');}
// Transformer within 3 m.
ok(has(issuesOf(edit(d=>{const i=d.lightingSystem.selectedItems.find(i=>i.productId==='hub100')!;i.places=[{x:288,z:zNear-60,angle:0},{x:96,z:24,angle:0}];})),/transformer is within 3 m/),'a transformer near the pool is flagged');
console.log(`LIGHTING RULES OK — ${checks} checks: pool-light placement, coping and pool-deck markers, seating floors, step lights, path lights in beds, the 3 m pool clearance, and the showcase.`);
