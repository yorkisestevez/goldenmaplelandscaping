import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {LIGHTING_CATALOGUE} from '../src/features/deckcraft/lightingCatalogue';
import {activeLightingItems,lightingSystemCheck,syncAutoLighting,AUTO_LIGHTING,MAX_FIXTURE_QTY} from '../src/features/deckcraft/lightingSystem';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {extrasLayout,postFacing,screenOffsetFromPoint,treadNose,walkableAt} from '../src/features/deckcraft/extrasLayout';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import type {DeckData} from '../src/features/deckcraft/types';
import {MAX_PREVIEW_LIGHTS,MAX_SHADOW_LIGHTS,previewLightPlan,castsPreviewLight} from '../src/features/deckcraft/lightingPreview';
import {DEFAULT_KELVIN,FX_MAX_FIXTURES,FX_TEXELS,LEGACY_HYDE,fixtureNight,kelvinSrgb,packFixtureLights} from '../src/features/deckcraft/fixtureLight';
const data:DeckData={...structuredClone(DEFAULT_DECK),lightingSystem:{selectedItems:[{productId:'wedge',qty:4,zone:'stairs'},{productId:'hyve',qty:4,zone:'deck'},{productId:'hub100',qty:1}],wireDistance:80}};
const on=calculateEstimate(data),off=calculateEstimate({...data,lightingPreviewOn:false,sceneLighting:'Evening'});
const landscape={...data,terrainConfig:{widthFt:80,depthFt:80,elevationIn:6,slopePct:2},lightingSystem:{selectedItems:[{productId:'ace',qty:2,zone:'landscape' as const}],wireDistance:0}};
const groundFixtures=extrasLayout(landscape,on.model).fixtures;
assert(groundFixtures.length>0);
for(const fixture of groundFixtures)assert(Math.abs(fixture.y-(6+fixture.z*.02))<1e-8,'Landscape fixtures follow the shared terrain grade');
assert.equal(on.total,off.total,'Preview lights and time never alter the purchase');
assert.deepEqual(extrasLayout(data,on.model).fixtures,extrasLayout({...data,lightingPreviewOn:false},off.model).fixtures);
const removed={...data,lightingZoneEnabled:{stairs:false}},reduced=calculateEstimate(removed);
assert.equal(activeLightingItems(removed).reduce((n,p)=>n+p.qty,0),5);
assert(!extrasLayout(removed,reduced.model).fixtures.some(p=>p.productId==='wedge'),'Removed zones have no ghost fixtures');
assert(!deckExportMeshes(removed,reduced.model).some(p=>p.name.includes('light_wedge')),'Removed zones excluded from geometry export');
assert(on.total>reduced.total,'Removing priced installation reduces estimate');
for(const product of LIGHTING_CATALOGUE.filter(p=>p.supported)){
 const d={...structuredClone(DEFAULT_DECK),lightingSystem:{selectedItems:[{productId:product.id,qty:1}],wireDistance:0}},e=calculateEstimate(d),layout=extrasLayout(d,e.model);
 assert.equal(activeLightingItems(d)[0].id,product.id);
 assert(layout.fixtures.some(p=>p.productId===product.id)||layout.warnings.length,'Every selected product is placed or explicitly reports the missing support/fit');
 if(product.cost===null||product.laborCost===null){assert(e.quoteRequired.some(s=>s.includes(product.name)));const section=e.sections.find(s=>s.title==='in-lite® Lighting System')!;assert(section.items.some(i=>i.cost===null));assert(Math.abs(section.total-((product.cost??0)*1.35+(product.laborCost??0)))<.001,'Known supply or installation is charged; missing portions remain a quote');}
}
const bad={...data,lightingSystem:{selectedItems:[{productId:'smart_hub300',qty:1},{productId:'hyve',qty:1}],wireDistance:150}};
assert(lightingSystemCheck(bad).warnings.some(w=>w.includes('incompatible')));
const withCable=calculateEstimate({...data,lightingSystem:{...data.lightingSystem,selectedItems:[...data.lightingSystem.selectedItems,{productId:'cable_12_2',qty:1}]}});
assert(!withCable.sections.find(s=>s.title==='in-lite® Lighting System')!.items.some(i=>i.name==='Low-voltage cable'),'Purchased reels do not double charge a generic cable allowance');
// Simple post/stair lighting follows the modeled mounts and uses existing price-book fixtures only.
{
  const base:DeckData={...structuredClone(DEFAULT_DECK),autoLighting:{posts:true,stairs:true}};
  const model=calculateEstimate(base).model,counts={posts:model.railing.posts.length,stairs:model.treads.length,privacy:0};
  assert(counts.posts>0&&counts.stairs>0,'The default deck has posts and treads to light');
  const lit:DeckData={...base,lightingSystem:{...base.lightingSystem,selectedItems:syncAutoLighting(base,counts)}};
  const qty=(d:DeckData,id:string)=>d.lightingSystem.selectedItems.find(i=>i.productId===id)?.qty??0;
  assert.equal(qty(lit,AUTO_LIGHTING.posts.productId),Math.min(MAX_FIXTURE_QTY,counts.posts));
  assert.equal(qty(lit,AUTO_LIGHTING.stairs.productId),Math.min(MAX_FIXTURE_QTY,counts.stairs));
  assert.equal(qty(lit,AUTO_LIGHTING.transformer.productId),1,'One transformer comes with the simple lights');
  const litEstimate=calculateEstimate(lit),litLayout=extrasLayout(lit,litEstimate.model);
  assert.equal(litLayout.fixtures.filter(f=>f.zone==='posts').length,qty(lit,'puck'),'A cap light on every railing post');
  assert.equal(AUTO_LIGHTING.stairs.productId,'evo_hyde','Default under-step light is EVO HYDE');
  assert.equal(litLayout.fixtures.filter(f=>f.zone==='stairs').length,qty(lit,'evo_hyde'),'An EVO HYDE under every step');
  for(const f of litLayout.fixtures.filter(f=>f.zone==='stairs')){const t=litEstimate.model.treads.find(tr=>Math.hypot(tr.x-f.x,tr.z-f.z)<tr.d);assert(t&&f.y<t.y-t.h/2,'Under-step light sits below the tread, not on the riser face');}
  assert(litEstimate.total>calculateEstimate(DEFAULT_DECK).total,'Simple lights are priced');
  assert(!litEstimate.quoteRequired.some(s=>/PUCK|EVO HYDE|HUB-100/.test(s)),'Simple lights use existing price-book allowances');
  // EVO FLEX strip style: placed under each 48 in step, listed for a supplier quote; too long for 36 in steps.
  const flex:DeckData={...base,autoLighting:{...base.autoLighting,stairStyle:'evo_flex'}};
  const flexLit:DeckData={...flex,lightingSystem:{...flex.lightingSystem,selectedItems:syncAutoLighting(flex,counts)}};
  assert.equal(qty(flexLit,'evo_flex_1_kit'),Math.min(MAX_FIXTURE_QTY,counts.stairs));
  assert.equal(qty(flexLit,'evo_hyde'),0,'Switching style replaces the under-step product');
  const flexEstimate=calculateEstimate(flexLit);
  assert.equal(extrasLayout(flexLit,flexEstimate.model).fixtures.filter(f=>f.zone==='stairs').length,counts.stairs,'An EVO FLEX strip under every 48 in step');
  assert(flexEstimate.quoteRequired.some(s=>s.includes('EVO FLEX')),'EVO FLEX strips are a supplier quote');
  const narrow:DeckData={...flexLit,stairWidth:36},narrowLayout=extrasLayout(narrow,calculateEstimate(narrow).model);
  assert(!narrowLayout.fixtures.some(f=>f.zone==='stairs')&&narrowLayout.warnings.some(w=>w.includes('too long')),'A 1 m strip is not forced onto 36 in steps');
  // Round-1 designs with an auto WEDGE riser light migrate to the under-step light.
  const roundOne:DeckData={...base,lightingSystem:{wireDistance:20,selectedItems:[{productId:'wedge',qty:4,zone:'stairs',auto:true}]}};
  assert(!syncAutoLighting(roundOne,counts).some(i=>i.productId==='wedge'),'Stale auto WEDGE is replaced');
  assert.equal(calculateEstimate({...lit,sceneLighting:'Evening',lightingPreviewOn:false}).total,litEstimate.total,'Night and preview switches never change the price');
  assert.deepEqual(syncAutoLighting({...lit,autoLighting:{}},counts),[],'Turning the options off removes their fixtures and transformer');
  const manual:DeckData={...base,lightingSystem:{wireDistance:20,selectedItems:[{productId:'hub50',qty:1},{productId:'puck',qty:2,zone:'deck'}]}};
  const synced=syncAutoLighting(manual,counts);
  assert(!synced.some(i=>i.productId==='hub100'),'A chosen transformer is respected, not doubled');
  assert.equal(synced.filter(i=>i.productId==='puck').length,1,'A managed product is never listed twice');
}
// Lit privacy screens get one BLINK on each screen post; unlit screens get none.
{
  const screens:NonNullable<DeckData['privacyScreens']>=[{id:'screen-1',side:'Left',lengthFt:8,heightFt:6,offsetPct:50,lights:true},{id:'screen-2',side:'Right',lengthFt:6,heightFt:5,offsetPct:0,lights:false}];
  const d:DeckData={...structuredClone(DEFAULT_DECK),privacyScreens:screens,privacySqft:78};
  const mounts=extrasLayout(d,calculateEstimate(d).model).privacyMounts.length;
  assert(mounts>0,'A lit screen exposes its post mounts');
  const lit:DeckData={...d,lightingSystem:{...d.lightingSystem,selectedItems:syncAutoLighting(d,{posts:0,stairs:0,privacy:mounts})}};
  const litEstimate=calculateEstimate(lit);
  assert.equal(extrasLayout(lit,litEstimate.model).fixtures.filter(f=>f.zone==='privacy').length,mounts,'One light on each lit screen post');
  const dark:DeckData={...d,privacyScreens:screens.map(s=>({...s,lights:false}))};
  assert.equal(extrasLayout(dark,calculateEstimate(dark).model).privacyMounts.length,0);
  assert(litEstimate.total>calculateEstimate(dark).total,'Turning screen lights off lowers the estimate');
  const off:DeckData={...d,privacyScreens:screens.map(s=>({...s,enabled:false}))};
  assert.equal(extrasLayout(off,calculateEstimate(off).model).privacyMounts.length,0,'A screen that is off carries no lights');
}
// Manufacturer screens: drawn to stock panel sizes, listed for a supplier quote, never priced.
{
  const hideaway:NonNullable<DeckData['privacyScreens']>[number]={id:'h1',side:'Left',lengthFt:8,heightFt:6,offsetPct:50,lights:true,product:'hideaway',design:'Hexx',finish:'Black',panels:3};
  const withScreen:DeckData={...structuredClone(DEFAULT_DECK),privacyScreens:[hideaway],privacySqft:0};
  const e=calculateEstimate(withScreen),layout=extrasLayout(withScreen,e.model);
  assert.equal(layout.panels.length,3,'Three stock panels drawn');
  assert(layout.panels.every(p=>p.w===36&&p.h===68&&p.finish==='Black'&&p.design==='Hexx'));
  assert.equal(layout.metal.filter(b=>b.w===3&&b.h===73).length,4,'Four 3 × 3 × 73 in posts');
  assert.equal(layout.privacyMounts.length,4,'A light mount on each HIDEAWAY post');
  assert(e.quoteRequired.some(s=>s.includes('HIDEAWAY')&&s.includes('Hexx')&&s.includes('3 panels')),'Listed for a supplier quote');
  assert.equal(e.total,calculateEstimate(DEFAULT_DECK).total,'A manufacturer screen never changes the priced total');
  assert(deckExportMeshes(withScreen,e.model).some(m=>m.name.startsWith('privacy_panel')),'Panels are exported');
  const tooMany:DeckData={...withScreen,privacyScreens:[{...hideaway,panels:12}]};
  const trimmed=extrasLayout(tooMany,calculateEstimate(tooMany).model);
  assert(trimmed.panels.length<12&&trimmed.warnings.some(w=>w.includes('panels on that edge')),'Only whole panels that fit are drawn');
  // Dragging maps back to the same position the layout drew, on every side; a full-length screen cannot slide.
  assert.equal(screenOffsetFromPoint(layout.screenHandles[0],layout.screenHandles[0].x,layout.screenHandles[0].z),null,'A screen filling its edge has no room to slide');
  const front:DeckData={...withScreen,privacyScreens:[{...hideaway,side:'Front',panels:2}]},frontLayout=extrasLayout(front,calculateEstimate(front).model);
  assert(!frontLayout.screenHandles.length&&frontLayout.warnings.some(w=>w.includes('overlaps the stair opening')),'A screen is never drawn across the stairs');
  for(const side of ['Left','Right'] as const)for(const offsetPct of [0,35,100]){
    const d:DeckData={...withScreen,privacyScreens:[{...hideaway,side,panels:2,offsetPct}]};
    const h=extrasLayout(d,calculateEstimate(d).model).screenHandles[0];
    assert.equal(screenOffsetFromPoint(h,h.x,h.z),offsetPct,`Drag frame round-trips ${offsetPct}% on the ${side} edge`);
  }
}
// Night preview lights: a well-lit design must not run WebGL out of texture units (16 per shader). Only long-throw
// fixtures get real three lights (every shadow-casting one takes a unit in each lit material), so at most
// MAX_PREVIEW_LIGHTS of them light the preview and MAX_SHADOW_LIGHTS cast shadows. Step, post and screen-post lights all
// light their surroundings through the fixture light patch instead, with no count limit, and a cap PUCK only glows.
{
  const at=(productId:string,zone:string,n:number)=>Array.from({length:n},(_,i)=>({productId,zone,x:i,y:0,z:0,angle:0}));
  const heavy=[...at('fusion','deck',12),...at('sway_pendant','house',3),...at('liv','landscape',6),...at('scope','landscape',3),...at('evo_hyde','stairs',8),...at('fusion','posts',20),...at('smart_hub150','',1),...at('wedge','stairs',7)];
  const plan=previewLightPlan(heavy),shadows=[...plan].filter(([,s])=>s).map(([i])=>i);
  assert(plan.size<=MAX_PREVIEW_LIGHTS,`At most ${MAX_PREVIEW_LIGHTS} fixtures light the preview (got ${plan.size})`);
  assert(MAX_SHADOW_LIGHTS<=4,'Few enough preview lights cast shadows to leave texture units for the materials');
  assert.equal(shadows.length,Math.min(MAX_SHADOW_LIGHTS,plan.size),'A heavy lighting design casts shadows from exactly the capped number of lights');
  const rank=(i:number)=>fixtureNight(heavy[i].productId,heavy[i].zone).shadowPriority;
  assert(shadows.every(i=>[...plan.keys()].every(j=>plan.get(j)||rank(j)<=rank(i))),'Shadows go to the longest-throw fixtures first');
  assert(new Set([...plan.keys()].map(i=>heavy[i].zone)).size===3,'Real lights are still shared across the zones that have them');
  assert(![...plan.keys()].some(i=>!castsPreviewLight(heavy[i].productId,heavy[i].zone)),'Only long-throw fixtures take a real preview light');
  assert(![...plan.keys()].some(i=>['stairs','posts'].includes(heavy[i].zone)),'No step or post light takes a real light or casts a shadow');
  assert(!castsPreviewLight('puck','posts')&&fixtureNight('puck','posts').route==='glow-only','A PUCK in a post cap faces the sky: it glows and lights nothing');
  assert.equal(fixtureNight('evo_hyde','stairs').route,'patch','An under-step light lights its step through the fixture light patch');
  assert.equal(fixtureNight('wedge','posts').route,'patch','A post light lights the deck through the fixture light patch');
  const small=[...at('fusion','deck',2),...at('evo_hyde','stairs',1)],smallPlan=previewLightPlan(small);
  assert.equal(smallPlan.size,2,'The under-step light is not a real light');
  assert([...smallPlan.values()].every(Boolean),'A small design keeps a shadow on every real preview light, as before');
  // The fixture light texture: every near-field fixture, in world feet, only at night with the preview lights on.
  const many=[...at('wedge','posts',30),...at('evo_hyde','stairs',30),...at('blink','privacy',30),...at('evo_hyde_550','stairs',30),...at('puck','posts',30)];
  const packed=packFixtureLights(many,{evening:true,enabled:true});
  assert.equal(packed.count,120,'Every step, post and screen-post light is packed; cap PUCKs are not');
  assert.equal(packed.dropped,0,`A design with every simple option at its per-product cap fits the ${FX_MAX_FIXTURES} rows`);
  assert.equal(packFixtureLights(many,{evening:false,enabled:true}).count,0,'Nothing lights by day');
  assert.equal(packFixtureLights(many,{evening:true,enabled:false}).count,0,'Nothing lights with the preview lights off');
  for(let i=0;i<packed.count;i++){
    const row=packed.data.subarray(i*FX_TEXELS*4,(i+1)*FX_TEXELS*4),source=many[i];
    assert(Math.abs(row[0]-source.x/12)<1&&Math.abs(row[2]-source.z/12)<1,'Packed positions are in world feet');
    assert(row[3]>0&&row[3]<(source.zone==='stairs'?3:8),'Step lights reach less than 3 ft, post and screen lights less than 8 ft');
    assert(Math.abs(Math.hypot(row[4],row[5],row[6])-1)<1e-6,'Each light has a unit aim');
    assert(row[8]>=row[9]&&row[9]>=row[10]&&row[10]>0,'Warm white: more red than green than blue');
  }
  const [r27,g27,b27]=kelvinSrgb(2700),[r30,g30,b30]=kelvinSrgb(3000),[r40,g40,b40]=kelvinSrgb(4000);
  assert(r27>=r30&&r30>=r40&&b27<b30&&b30<b40&&g27<g30&&g30<g40,'Lower colour temperatures are warmer');
  assert.deepEqual(fixtureNight('puck','posts').kelvin,DEFAULT_KELVIN,'An unrated fixture shows 3000 K');
}
// Placement: under-step lights tuck flush under the nose, spread evenly along it (winders too); post lights face the
// deck or stair they guard.
{
  const wide:DeckData={...structuredClone(DEFAULT_DECK),stairWidth:96};
  const e=calculateEstimate(wide),treads=e.model.treads.length;
  const three:DeckData={...wide,lightingSystem:{wireDistance:20,selectedItems:[{productId:'evo_hyde',qty:treads*3,zone:'stairs'},{productId:'hub100',qty:1}]}};
  const layout=extrasLayout(three,calculateEstimate(three).model).fixtures.filter(f=>f.zone==='stairs');
  assert.equal(layout.length,treads*3,'Three under-step lights on every step');
  e.model.treads.forEach((t,ti)=>{
    const nose=treadNose(t),mine=layout.filter((_,k)=>k%treads===ti);
    const along=mine.map(f=>(f.x-nose.x)*Math.cos(nose.angle)-(f.z-nose.z)*Math.sin(nose.angle)).sort((a,b)=>a-b);
    assert(Math.abs(along[1])<.01&&Math.abs(along[2]-along[1]-nose.width/3)<.01&&Math.abs(along[1]-along[0]-nose.width/3)<.01,'Lights on one step are evenly spaced, one in the middle');
    for(const f of mine)assert(Math.abs(f.y+LEGACY_HYDE.height/2-(t.y-t.h/2))<.05,'The under-step housing sits flush on the tread underside');
  });
  const winder:DeckData={...structuredClone(DEFAULT_DECK),height:60,stairType:'Winder',autoLighting:{stairs:true}};
  const we=calculateEstimate(winder),wCounts={posts:we.model.railing.posts.length,stairs:we.model.treads.length,privacy:0};
  const wLit:DeckData={...winder,lightingSystem:{...winder.lightingSystem,selectedItems:syncAutoLighting(winder,wCounts)}},wModel=calculateEstimate(wLit).model;
  const winders=wModel.treads.map((t,i)=>({t,i})).filter(({t})=>t.polygon);
  assert(winders.length>0,'The winder design has winder treads');
  const wLayout=extrasLayout(wLit,wModel).fixtures.filter(f=>f.zone==='stairs');
  for(const {t,i} of winders){
    const f=wLayout[i],a=t.polygon![2],b=t.polygon![3],len=Math.hypot(b.x-a.x,b.y-a.y),ux=(b.x-a.x)/len,uz=(b.y-a.y)/len;
    const off=Math.abs((f.x-a.x)*uz-(f.z-a.y)*ux),along=(f.x-a.x)*ux+(f.z-a.y)*uz;
    assert(off<1&&along>0&&along<len,'A winder\'s light sits under its own nose edge');
    const c={x:t.polygon!.reduce((n,p)=>n+p.x,0)/4,y:t.polygon!.reduce((n,p)=>n+p.y,0)/4};
    assert((f.x-c.x)*Math.sin(f.angle)+(f.z-c.y)*Math.cos(f.angle)>0,'A winder\'s light faces out over the step below');
  }
  const posts=e.model.railing.posts.length,postLit:DeckData={...wide,lightingSystem:{wireDistance:20,selectedItems:[{productId:'wedge',qty:posts,zone:'posts'},{productId:'puck',qty:posts,zone:'posts'},{productId:'hub100',qty:1}]}};
  const pModel=calculateEstimate(postLit).model,pLayout=extrasLayout(postLit,pModel).fixtures,facing=postFacing(pModel),top=pModel.levels[0].top;
  const wedges=pLayout.filter(f=>f.productId==='wedge'),caps=pLayout.filter(f=>f.productId==='puck');
  assert.equal(wedges.length,posts,'A post light on every post');
  assert.equal(caps.length,posts,'A cap light on every post, alongside the post light');
  wedges.forEach((f,k)=>{
    const post=pModel.railing.posts[k];
    assert(Math.abs(f.y-(post.y+pModel.railing.height-7))<1e-6,'A cap light and a post light share a post without stacking');
    assert(Math.abs(Math.sin(f.angle)-facing[k].x)<1e-9&&Math.abs(Math.cos(f.angle)-facing[k].y)<1e-9,'A post light faces the way its post faces');
    if(Math.abs(post.y-top)<.01)assert(walkableAt(pModel,post.x+facing[k].x*12,post.z+facing[k].y*12),'A deck post\'s light faces the deck');
  });
}
console.log(`DECK LIGHTING OK — ${LIGHTING_CATALOGUE.filter(p=>p.supported).length} supported products, zone/preview/export/quote, circuit, under-step, privacy-screen and manufacturer-screen checks, night preview lights within the GPU's texture units, the fixture light texture, and flush, evenly spaced, deck-facing post and step lights.`);
