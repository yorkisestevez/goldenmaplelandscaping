// Guillotined armour stone setting labour (owner, 2026-10-21): industry production timing (RSMeans dry-set cut stone,
// about 14 tons per 27 person-hour crew day) priced on the owner's $2,800 hardscape crew day, in half crew-day steps with
// a one crew-day minimum, private per job and editable per user with device defaults.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {buildYardModel,loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
import {buildYardTakeoff} from '../src/features/deckcraft/yardTakeoff';
import {loadWallStationRuntime} from '../src/features/deckcraft/yardPathGeometry';
import {loadSiteEngine} from '../src/features/deckcraft/siteSurface';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
import {GUILLOTINED_WALL} from '../src/features/deckcraft/wallStones';
import {parseDesign,serializeDesign} from '../src/features/deckcraft/designPersistence';
import {cleanJobDesign,parsePrivateProject,serializePrivateProject} from '../src/features/deckcraft/designer/jobRevisionLibrary';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {CONFIRMED_RATES} from '../src/features/deckcraft/rateConfidence';
import {DEFAULT_HARDSCAPE_LABOUR,GUILLOTINED_TONS_PER_CREW_DAY,mergeHardscapeLabour,validateHardscapeLabour,type HardscapeLabourSettings} from '../src/features/deckcraft/hardscapeLabour';
import {customHardscapeLabourDefaults,readHardscapeLabourDefaults,saveHardscapeLabourDefaults} from '../src/features/deckcraft/hardscapeLabourStorage';
import {closeProjectStorage} from '../src/features/deckcraft/projectStorage';
import baseline from '../src/data/engine-baseline.json';
const require=createRequire(new URL('../src/features/deckcraft/projectStorage.ts',import.meta.url));require('fake-indexeddb/auto');

let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;},near=(a:number,b:number,m:string,tolerance=1e-9)=>ok(Math.abs(a-b)<=tolerance,`${m}: ${a} vs ${b}`),bad=(f:()=>unknown,m:string)=>{assert.throws(f,undefined,m);checks++;};
const flat=(features:YardFeature[],extra:Partial<DeckData>={}):DeckData=>({...structuredClone(DEFAULT_DECK),houseVisible:false,yardFeatures:features,...extra});
const wall=(over:Partial<YardFeature>={}):YardFeature=>({id:'gw',kind:'retaining-wall',name:'Guillotined wall',enabled:true,xFt:0,zFt:40,widthFt:20,depthFt:14/12,heightIn:30,rotationDeg:0,productId:GUILLOTINED_WALL,color:'#a7a399',wallStone:{stoneId:'carr-orillia-grey',courseIn:14},finishedElevationIn:30,...over});
const settings=(patch:Partial<HardscapeLabourSettings['scopes']['guillotinedSetting']>,crewDayRate?:number)=>mergeHardscapeLabour(undefined,{...(crewDayRate===undefined?{}:{crewDayRate}),scopes:{guillotinedSetting:patch}});
await Promise.all([loadAdvancedYardRuntime(),loadWallStationRuntime(),loadSiteEngine()]);

// 1. Defaults: the owner's hardscape crew day, the RSMeans dry-set rate on the 27 person-hour crew day, half-day steps, one day minimum.
const defaults=validateHardscapeLabour(undefined),g=defaults.scopes.guillotinedSetting;
ok(defaults.crewDayRate===baseline.facts.crewDayRateHardscape&&defaults.crewDayRate===2800,'The crew day is the $2,800 hardscape card, read live');
ok(g.mode==='production'&&g.tonsPerCrewDay===GUILLOTINED_TONS_PER_CREW_DAY&&GUILLOTINED_TONS_PER_CREW_DAY===14&&g.stepCrewDays===.5&&g.minCrewDays===1,'Setting defaults to 14 tons per crew day, half-day steps, one crew-day minimum');
near(27/(0.16*2000/165),GUILLOTINED_TONS_PER_CREW_DAY,'14 t is RSMeans 0.160 labour-h per cu ft at 165 lb/cu ft over 27 person-hours',0.1);
ok(JSON.stringify(validateHardscapeLabour({version:1,crewDayRate:2800,scopes:{}}))===JSON.stringify(DEFAULT_HARDSCAPE_LABOUR),'A missing scope takes its default');
for(const [label,raw] of [['zero tons',{...defaults,scopes:{guillotinedSetting:{...g,tonsPerCrewDay:0}}}],['negative minimum',{...defaults,scopes:{guillotinedSetting:{...g,minCrewDays:-1}}}],['zero rate',{...defaults,crewDayRate:0}],['sub-cent rate',{...defaults,crewDayRate:2800.005}],['unknown mode',{...defaults,scopes:{guillotinedSetting:{...g,mode:'hours'}}}],['version 2',{...defaults,version:2}],['odd step',{...defaults,scopes:{guillotinedSetting:{...g,stepCrewDays:.3}}}]] as const)bad(()=>validateHardscapeLabour(raw),`Rejects ${label}`);
ok(mergeHardscapeLabour(defaults,{crewDayRate:3000}).scopes.guillotinedSetting.tonsPerCrewDay===14&&mergeHardscapeLabour(defaults,{crewDayRate:3000}).crewDayRate===3000,'Merging one field keeps the others');

// 2. The estimate: one priced setting row for every guillotined wall, at the billed crew days × crew day, no markup.
const crewDays=(tons:number,s=g)=>{const raw=tons/s.tonsPerCrewDay,stepped=s.stepCrewDays>0?Math.ceil(raw/s.stepCrewDays-1e-9)*s.stepCrewDays:raw;return Math.max(s.minCrewDays,stepped);};
const tonsOf=(data:DeckData)=>buildYardModel(data).features.reduce((n,f)=>n+(f.quantities.wallStoneLb??0),0)/2000;
const small=flat([wall()]),smallTons=tonsOf(small),smallTakeoff=buildYardTakeoff(small),smallRow=smallTakeoff.sections.find(s=>s.id==='wall-stone-setting');
ok(smallTons>0&&smallTons/14<1,`A short wall sets in under a crew day (${smallTons.toFixed(2)} t)`);
ok(smallRow&&smallRow.amountCents===280000&&smallRow.quantity===1&&smallRow.unit==='crew-days','A short wall is billed the one crew-day minimum: $2,800');
ok(smallRow!.label==='Guillotined armour stone setting'&&smallRow!.featureIds?.join()==='gw','The row is the stone setting of the guillotined walls');
ok(!/\$|2,?800|trade|markup|margin/i.test(smallRow!.note??'')&&/14 tons per crew-day/.test(smallRow!.note??'')&&/minimum/.test(smallRow!.note??''),'The homeowner-facing note gives tons and crew days, never a dollar rate, trade price, markup or margin');
ok(!smallTakeoff.sections.some(s=>s.id==='wall-installation-gw'),'The setting row replaces the wall installation builder quote');
ok(smallTakeoff.sections.some(s=>s.id==='wall-base-gw'&&s.amountCents===null&&s.note!.startsWith('Stone and setting priced separately.')),'Base, drainage and backfill stay builder quotes');
ok(smallTakeoff.quoteRequired,'The wall still needs a quote for its base, drainage and design');
const long=flat([wall({widthFt:60,heightIn:48,finishedElevationIn:48})]),longTons=tonsOf(long),longRow=buildYardTakeoff(long).sections.find(s=>s.id==='wall-stone-setting')!;
ok(longTons/14>1&&Math.abs(longTons/14*2-Math.round(longTons/14*2))>1e-6,`A long wall needs part of a half day (${(longTons/14).toFixed(3)} crew days)`);
ok(longRow.quantity===crewDays(longTons)&&longRow.amountCents===Math.round(crewDays(longTons)*2800*100),'A long wall is billed up to the next half crew day');
// Two walls share one crew: the total is stepped once, not each wall.
const pair=flat([wall(),wall({id:'gw2',name:'Second wall',zFt:80})]),pairTons=tonsOf(pair),pairRow=buildYardTakeoff(pair).sections.find(s=>s.id==='wall-stone-setting')!;
ok(pairRow.featureIds?.join()==='gw,gw2'&&pairRow.quantity===crewDays(pairTons)&&pairRow.amountCents===Math.round(crewDays(pairTons)*2800*100),'Two walls are set by one crew: one row, stepped on their total');

// 3. Editable: the user's production rate, crew day and rounding; builder quote restores today's rows.
const custom=flat([wall({widthFt:60,heightIn:48,finishedElevationIn:48})],{hardscapeLabour:settings({tonsPerCrewDay:7,stepCrewDays:0,minCrewDays:0},3000)}),customRow=buildYardTakeoff(custom).sections.find(s=>s.id==='wall-stone-setting')!;
near(customRow.quantity!,longTons/7,'Exact crew days at the user\'s 7 t per crew day',1e-6);
ok(customRow.amountCents===Math.round(customRow.quantity!*3000*100)&&/7 tons per crew-day/.test(customRow.note!),'Priced at the user\'s own crew day');
const quoted=buildYardTakeoff(flat([wall()],{hardscapeLabour:settings({mode:'quote'})})),production=smallTakeoff;
ok(!quoted.sections.some(s=>s.id==='wall-stone-setting'),'Builder quote mode prices no setting');
ok(quoted.sections.some(s=>s.id==='wall-installation-gw'&&s.amountCents===null&&s.note!.startsWith('Stone priced separately; installation unpriced.')),'Builder quote mode restores the installation quote row');
ok(production.knownSubtotalCents-quoted.knownSubtotalCents===smallRow!.amountCents,'The setting row is part of the known subtotal');
const segmental=flat([wall({id:'sw',productId:'segmental-concrete',wallStone:undefined,depthFt:1})]);
ok(JSON.stringify(buildYardTakeoff(segmental))===JSON.stringify(buildYardTakeoff({...segmental,hardscapeLabour:settings({tonsPerCrewDay:3},4000)})),'Other walls ignore the setting rate');
// A wall from a manufacturer catalogue (no estimator allowance) keeps its own installation quote beside a guillotined wall.
const mixed=buildYardTakeoff(flat([wall(),wall({id:'mw',name:'Block wall',zFt:80,productId:'plain-block',wallStone:undefined,depthFt:1})]));
ok(mixed.sections.some(s=>s.id==='wall-installation-mw'&&s.amountCents===null)&&!mixed.sections.some(s=>s.id==='wall-installation-gw'),'Only guillotined walls lose their installation quote');
const estimate=calculateDeckReleaseEstimate(deckReleaseData(small)),estRow=estimate.sections.find(s=>s.title==='Yard · Guillotined armour stone setting');
ok(estRow?.items[0].cost===2800,'The design estimate carries the setting row');

// 4. Private: kept by private saves and job revisions, never in public files or links.
const privateDesign={...deckReleaseData(small),hardscapeLabour:settings({tonsPerCrewDay:10})};
ok(!serializeDesign(privateDesign).includes('hardscapeLabour')&&parseDesign(serializeDesign(privateDesign)).hardscapeLabour===undefined,'Public design files and links leave the setting out');
ok(cleanJobDesign(JSON.parse(JSON.stringify(privateDesign))).hardscapeLabour?.scopes.guillotinedSetting.tonsPerCrewDay===10,'Job revisions keep the setting');
ok(parsePrivateProject(serializePrivateProject(privateDesign)).hardscapeLabour?.scopes.guillotinedSetting.tonsPerCrewDay===10,'Private autosave keeps the setting');
bad(()=>cleanJobDesign({...JSON.parse(JSON.stringify(privateDesign)),hardscapeLabour:{version:1,crewDayRate:-5,scopes:{}}}),'Job revisions reject an invalid setting');
bad(()=>cleanJobDesign(JSON.parse(JSON.stringify(privateDesign)),true),'Portable job files refuse private setting rates');
const source=(p:string)=>readFileSync(new URL(`../src/${p}`,import.meta.url),'utf8');
for(const p of ['features/deckcraft/projectBundle.ts','features/deckcraft/ProjectFileTools.tsx','features/deckcraft/designer/deckAgentController.ts','pages/DeckDesigner.tsx'])ok(source(p).includes("'hardscapeLabour'"),`${p} treats the setting as private`);

// 5. Device defaults: saved on this device, applied to new designs only when they differ from the built-in book.
ok(await customHardscapeLabourDefaults()===undefined,'An empty device book applies nothing');
const mine=settings({tonsPerCrewDay:12.5,minCrewDays:.5},2950);
await saveHardscapeLabourDefaults(mine);
ok(JSON.stringify(await readHardscapeLabourDefaults())===JSON.stringify(mine)&&JSON.stringify(await customHardscapeLabourDefaults())===JSON.stringify(mine),'Saved device defaults come back and apply to new designs');
await saveHardscapeLabourDefaults(DEFAULT_HARDSCAPE_LABOUR);
ok(await customHardscapeLabourDefaults()===undefined,'Built-in defaults saved back apply nothing extra');
closeProjectStorage();

// 6. The editor and the rate register.
const editor=source('features/deckcraft/designer/OwnerCostEditor.tsx');
ok(editor.includes('Guillotined armour stone setting')&&editor.includes('Tons per crew-day')&&editor.includes('Crew-day rate')&&editor.includes('hardscapeLabour:undefined'),'Owner costs edits the setting per job and resets it');
ok(/saveHardscapeLabourDefaults/.test(editor)&&/readHardscapeLabourDefaults/.test(editor),'Owner costs saves and loads the setting as device defaults');
ok(source('pages/DeckDesigner.tsx').includes('customHardscapeLabourDefaults'),'Start over applies the device setting defaults');
ok(CONFIRMED_RATES.some(r=>r.id==='guillotined-setting'&&/14 t per crew-day/.test(r.note)),'The rate register records the owner\'s choice');

console.log(`HARDSCAPE LABOUR OK — ${checks} checks.`);
