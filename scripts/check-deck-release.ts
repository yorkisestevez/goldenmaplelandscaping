import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {DESIGN_STORAGE_KEY,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {DECK_RELEASE_STORAGE_KEY,deckReleaseData,parseDeckReleaseDesign,serializeDeckReleaseDesign,calculateDeckReleaseEstimate} from '../src/features/deckcraft/deckRelease';
import {exportDeckReleaseDXF,exportDeckReleaseOBJ} from '../src/features/deckcraft/deckReleaseExports';
import {BACKYARD_SECTION_PREFIX,backyardElements,describeBackyard,hasBackyard,hasBackyardLayout,hasYardAllowances,splitSubtotal} from '../src/features/deckcraft/backyard';
import {computeEstimate,deltaFor,type EstimateInput} from '../src/utils/estimateEngine';
import {PAVER_BRANDS} from '../src/data/carrPrices';
import {normalizeWrap} from '../src/features/deckcraft/lib/wrapGeometry';
import {migrateLegacyPrivacy,pricedPrivacyArea} from '../src/features/deckcraft/privacyScreens';
import type {DeckData,YardAllowances} from '../src/features/deckcraft/types';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {DECKING_CATALOGUE,MANUFACTURER_ACCESSORIES,RAILING_CATALOGUE} from '../src/features/deckcraft/manufacturerCatalog';
import {STEPS} from '../src/features/deckcraft/designer/constants';
import {SECTIONS,SECTION_BY_ID,loadBackyardStep,sectionChanged,sectionsOfPatch} from '../src/features/deckcraft/designer/sections';
import {sectionSummary} from '../src/features/deckcraft/designer/sectionSummaries';
import {designerSource} from './deck-designer-source';

/**
 * The public release: the deck, with its backyard when the design has one (owner decision 2026-09-23).
 * A design without a backyard saves, exports and prices byte-for-byte as the deck-only release did; a
 * backyard adds its own "Yard ·" sections and subtotal without touching the deck's sections.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const sorted=(value:unknown)=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
// The deck-only release as it was before the backyard came back, for the byte-for-byte comparison.
function deckOnlyRelease(data:DeckData):DeckData{
  const {yardFeatures:_yard,terrainConfig:_terrain,projectKind:_kind,hsUse:_use,hsProduct:_product,hsColor:_color,hsBorderRows:_border,hsSteps:_steps,hsFirePit:_fire,hsLightCount:_lights,...deck}=data;
  const screens=deck.privacyScreens??(deck.privacySqft>0?migrateLegacyPrivacy(deck):undefined);
  return normalizeWrap({...deck,...(screens?{privacyScreens:screens,privacySqft:pricedPrivacyArea(screens)}:{}),projectKind:'deck'});
}
const patio={id:'patio-1',kind:'patio' as const,name:'Patio',enabled:true,xFt:10,zFt:30,widthFt:20,depthFt:16,heightIn:0,rotationDeg:0,productId:'permacon-melville',color:'#aaaaaa'};
const wall={id:'wall-1',kind:'retaining-wall' as const,name:'Retaining wall',enabled:true,xFt:10,zFt:42,widthFt:16,depthFt:1,heightIn:24,rotationDeg:0,productId:'segmental-concrete',color:'#aaaaaa'};
const pond={id:'pond-1',kind:'water-feature' as const,name:'Pond',enabled:true,xFt:28,zFt:34,widthFt:6,depthFt:6,heightIn:24,rotationDeg:0,productId:'pond',color:'#657478'};

// 1. Without a backyard nothing changed: the same saved file, exports and price as the deck-only release.
{
  const designs:DeckData[]=[structuredClone(DEFAULT_DECK),{...structuredClone(DEFAULT_DECK),width:24,length:16,pattern:'Herringbone',pictureFrameRows:1},{...structuredClone(DEFAULT_DECK),privacySqft:48},{...structuredClone(DEFAULT_DECK),projectKind:'hardscape',hsProduct:'old-paver'} as DeckData];
  for(const d of designs){
    ok(serializeDesign(deckReleaseData(d))===serializeDesign(deckOnlyRelease(d)),'A design without a backyard saves exactly as before');
    const now=calculateDeckReleaseEstimate(d),before=calculateEstimate(deckOnlyRelease(d));
    ok(now.total===before.total&&JSON.stringify(now.sections)===JSON.stringify(before.sections),'…and prices exactly as before');
    ok(exportDeckReleaseOBJ(d,now.model)===exportDeckReleaseOBJ(deckOnlyRelease(d),before.model)&&!exportDeckReleaseDXF(d,now.model).includes('yard_'),'…and exports exactly as before');
    ok(!hasBackyard(deckReleaseData(d))&&splitSubtotal(now).backyard===0,'…with no backyard subtotal');
  }
  ok(deckReleaseData({...structuredClone(DEFAULT_DECK),projectKind:'hardscape',hsProduct:'old-paver'} as DeckData).projectKind==='deck'&&!('hsProduct' in deckReleaseData({...structuredClone(DEFAULT_DECK),hsProduct:'old-paver'} as DeckData)),'The retired hardscape-only fields are still dropped');
  ok((DECK_RELEASE_STORAGE_KEY as string)!==DESIGN_STORAGE_KEY,'The release keeps its own autosave slot; the older combined autosave is never overwritten');
}

// 2. With a backyard: it is kept, saved, reopened, priced separately and exported, and the deck is untouched.
{
  const deckOnly=structuredClone(DEFAULT_DECK),withYard:DeckData={...structuredClone(DEFAULT_DECK),yardFeatures:[patio,wall,pond]};
  const snapshot=structuredClone(withYard),clean=deckReleaseData(withYard);
  ok(JSON.stringify(withYard)===JSON.stringify(snapshot),'The source design is never mutated');
  ok(clean.yardFeatures?.length===3&&hasBackyard(clean),'The backyard is kept in the public design');
  ok(sorted(parseDeckReleaseDesign(serializeDeckReleaseDesign(withYard)).yardFeatures)===sorted(clean.yardFeatures),'Save and reopen keeps the backyard');
  const base=calculateDeckReleaseEstimate(deckOnly),yard=calculateDeckReleaseEstimate(withYard);
  const deckSections=(e:typeof base)=>e.sections.filter(s=>!s.title.startsWith(BACKYARD_SECTION_PREFIX)&&!/^HST/.test(s.title));
  ok(JSON.stringify(deckSections(yard))===JSON.stringify(deckSections(base)),'Adding a backyard leaves every deck section exactly as it was');
  const split=splitSubtotal(yard);
  ok(Math.abs(split.deck-base.subtotal)<1e-6&&split.backyard>0&&Math.abs(split.backyard-yard.yardTakeoff.knownSubtotalCents/100)<1e-6,`The deck and backyard subtotals split the estimate (deck ${split.deck.toFixed(2)}, backyard ${split.backyard.toFixed(2)})`);
  ok(Math.abs(yard.hst-yard.subtotal*.13)<1e-6&&yard.sections.filter(s=>/^HST/.test(s.title)).length===1,'HST is charged once, on deck and backyard together');
  ok(yard.quoteRequired.some(q=>/Pond/.test(q))&&yard.sections.filter(s=>s.title.startsWith(BACKYARD_SECTION_PREFIX)&&s.quoteRequired).every(s=>s.total===0),'The water feature is a supplier quote, never $0');
  ok(exportDeckReleaseOBJ(withYard,yard.model).includes('yard_'),'Exports include the backyard');
  const words=describeBackyard(yard.yardModel)!;
  ok(words.startsWith('Backyard: ')&&/a \d+ sq ft patio \(Permacon [^)]+\)/.test(words)&&words.includes('a 16 ft retaining wall (Segmental concrete wall, 24 in exposed)')&&words.includes('a pond (supplier quote)'),`The backyard reads plainly: ${words}`);
  ok(backyardElements(withYard).join()==='patio,retaining wall,water feature'&&backyardElements({yardFeatures:[{...patio,enabled:false}]}).length===0,'The lead score sees the backyard kinds that are switched on');
  const off=calculateDeckReleaseEstimate({...withYard,yardFeatures:[patio,wall,pond].map(f=>({...f,enabled:false}))});
  ok(Math.abs(off.total-base.total)<1e-6&&splitSubtotal(off).backyard===0,'Backyard features switched off add nothing');
}

// 2b. Fire pit, outdoor kitchen, turf and landscape lighting (owner decision 2026-09-23): each is what the site's
// cost estimator adds for it on this backyard, labelled an allowance, never $0, and never moves the deck, a patio
// or a wall. The default design (Barrie, standard site, unknown soil) has no site conditions.
{
  const all:YardAllowances={finish:'mid',firePit:'wood',kitchen:'basic',turfSqft:500,lighting:true};
  const withAllowances=(a:Partial<YardAllowances>,extra:Partial<DeckData>={})=>calculateDeckReleaseEstimate({...structuredClone(DEFAULT_DECK),...extra,yardAllowances:{...all,...a}});
  const yardRows=(e:ReturnType<typeof calculateDeckReleaseEstimate>)=>e.sections.filter(s=>s.title.startsWith(BACKYARD_SECTION_PREFIX));
  const allowanceRows=(e:ReturnType<typeof calculateDeckReleaseEstimate>)=>yardRows(e).filter(s=>s.title.endsWith('(estimator allowance)'));
  const amount=(e:ReturnType<typeof calculateDeckReleaseEstimate>,word:RegExp)=>allowanceRows(e).find(s=>word.test(s.title))?.total??NaN;
  const base=calculateDeckReleaseEstimate(DEFAULT_DECK),four=withAllowances({});
  const deckSections=(e:typeof base)=>e.sections.filter(s=>!s.title.startsWith(BACKYARD_SECTION_PREFIX)&&!/^HST/.test(s.title));
  // The estimator's own arithmetic: one engine, each item added in turn (fire pit, kitchen, turf, lighting).
  const engine=(els:string[],tier:'budget'|'mid'|'premium'='mid'):EstimateInput=>({projectType:'full',selectedElements:els,sizes:{patio:0,wall:0,wallHeight:'Under 2ft',firepit:'Medium',kitchen:'Basic',turf:500,lighting:'Medium'},details:{'patio.surface':'grass','patio.shape':'simple','wall.wallPurpose':'garden','firepit.fuel':'wood','turf.surface':'grass'},conditions:{access:false,slope:false,drainage:false},location:'barrie',tier,paverBrandId:PAVER_BRANDS[0].id,deckBrandId:'',addOns:[]});
  const firstCents=computeEstimate(engine(['firepit'])).precise!.subtotalCents;
  const steps=[['firepit'],['firepit','kitchen'],['firepit','kitchen','turf'],['firepit','kitchen','turf','lighting']].map((els,i,list)=>i===0?firstCents:deltaFor(engine(list[i-1]),{selectedElements:els}).preciseCents!);
  ok(JSON.stringify(allowanceRows(four).map(s=>Math.round(s.total*100)))===JSON.stringify(steps),`Each allowance is what the cost estimator adds for it, in order (${steps.map(c=>c/100).join(', ')})`);
  ok(allowanceRows(four).map(s=>s.title).join('|')==='Yard · Fire pit, wood-burning (estimator allowance)|Yard · Outdoor kitchen, basic: counter, cabinet and a built-in grill (estimator allowance)|Yard · Artificial turf, 500 sq ft (estimator allowance)|Yard · Landscape lighting for the yard (estimator allowance)','Each allowance is labelled as one, in plain words');
  ok(allowanceRows(four).every(s=>s.total>0&&!s.quoteRequired&&s.description?.includes('a planning allowance, not a quote')),'No allowance is $0 or a quote, and each says it is a planning allowance');
  ok(allowanceRows(four)[0].description!.includes("one-time site work")&&allowanceRows(four).slice(1).every(s=>!s.description!.includes('one-time site work')),'Without a patio or wall, the first allowance carries the one-time site work, and says so');
  ok(JSON.stringify(deckSections(four))===JSON.stringify(deckSections(base))&&Math.abs(splitSubtotal(four).deck-base.subtotal)<1e-6,'Allowances leave every deck section as it was');
  ok(Math.abs(splitSubtotal(four).backyard-four.yardTakeoff.knownSubtotalCents/100)<1e-6&&Math.abs(four.hst-four.subtotal*.13)<1e-6,'The allowances are the backyard subtotal, with HST once');
  ok(four.flags.some(f=>/not drawn in (?:the )?3D(?: view)?/i.test(f)&&/site visit/i.test(f)),'The estimate says allowances are not drawn in 3D and are placed at the site visit');
  // Choices move the allowance the way the estimator's do.
  ok(amount(withAllowances({firePit:'gas'}),/Fire pit/)>amount(four,/Fire pit/)&&amount(withAllowances({kitchen:'full'}),/kitchen/)>amount(four,/kitchen/),'A gas fire pit and a full-build kitchen cost more');
  const tiers=(['budget','mid','premium'] as const).map(finish=>withAllowances({finish}));
  ok([/Fire pit/,/kitchen/,/lighting/].every(w=>amount(tiers[0],w)<amount(tiers[1],w)&&amount(tiers[1],w)<amount(tiers[2],w)),'The finish level sets the fire pit, kitchen and lighting allowances');
  ok(tiers.every(e=>amount(e,/turf/)===amount(four,/turf/))&&amount(withAllowances({turfSqft:1000}),/turf/)>amount(four,/turf/),'Turf follows its area, not the finish');
  // With a patio and a wall, their sections stay exactly as they were, whatever the finish.
  const layout={yardFeatures:[patio,wall]},plain=calculateDeckReleaseEstimate({...structuredClone(DEFAULT_DECK),...layout});
  for(const finish of ['budget','premium'] as const){
    const e=withAllowances({finish},layout);
    ok(JSON.stringify(yardRows(e).filter(s=>!s.title.endsWith('(estimator allowance)')))===JSON.stringify(yardRows(plain))&&JSON.stringify(deckSections(e))===JSON.stringify(deckSections(base)),`Allowances (${finish} finish) never move the patio, the wall or the deck`);
    ok(allowanceRows(e).every(s=>!s.description!.includes('one-time site work')),'With a patio, the site work is already in the patio sections');
  }
  // Nothing chosen prices nothing; the backyard is kept, saved and reopened; bad values are refused.
  const none=calculateDeckReleaseEstimate({...structuredClone(DEFAULT_DECK),yardAllowances:{finish:'premium',firePit:'none',kitchen:'none',turfSqft:0,lighting:false}});
  ok(none.total===base.total&&yardRows(none).length===0&&!hasYardAllowances({finish:'premium',firePit:'none',kitchen:'none',turfSqft:0,lighting:false}),'Allowances with nothing chosen add nothing');
  const saved:DeckData={...structuredClone(DEFAULT_DECK),yardAllowances:{...all,firePit:'gas',finish:'premium'}};
  ok(sorted(parseDeckReleaseDesign(serializeDeckReleaseDesign(saved)).yardAllowances)===sorted(saved.yardAllowances)&&deckReleaseData(saved).yardAllowances?.firePit==='gas','Save and reopen keeps the allowances');
  const bad:[Partial<YardAllowances>,string][]=[[{finish:'gold' as 'mid'},'finish'],[{firePit:'propane' as 'gas'},'fire pit'],[{kitchen:'deluxe' as 'full'},'kitchen'],[{turfSqft:50},'turf under 100 sq ft'],[{turfSqft:5000},'turf over 2,000 sq ft'],[{lighting:'yes' as unknown as boolean},'lighting']];
  for(const [patch,what] of bad)ok((()=>{try{validateDesign({...structuredClone(DEFAULT_DECK),yardAllowances:{...all,...patch}});return false;}catch{return true;}})(),`An invalid ${what} is refused`);
  ok(validateDesign({...structuredClone(DEFAULT_DECK),yardAllowances:{...all,turfSqft:0}}).yardAllowances?.turfSqft===0,'No turf is allowed');
  // Words, lead scoring and the 3D view.
  const only=deckReleaseData(saved);
  ok(hasBackyard(only)&&!hasBackyardLayout(only),'Allowances make a backyard, but not one the 3D view draws');
  ok(describeBackyard(four.yardModel,all)==='Backyard: allowances for a wood-burning fire pit, a basic outdoor kitchen, 500 sq ft of artificial turf and landscape lighting (Elevated finish)','The allowances read plainly');
  ok(describeBackyard(plain.yardModel,{...all,firePit:'none',kitchen:'none',lighting:false})!.endsWith('; allowances for 500 sq ft of artificial turf'),'Turf alone names no finish');
  ok(backyardElements({yardFeatures:[patio],yardAllowances:all}).join()==='patio,fire pit,outdoor kitchen,artificial turf,landscape lighting','The lead score sees the allowances');
}

// 3. The designer: a Backyard section before the proposal, loaded lazily through the section registry, the yard in 3D
// only when there is one, and an older autosave's backyard offered back rather than restored silently.
{
  const page=designerSource(),registry=readFileSync(new URL('../src/features/deckcraft/designer/sections.ts',import.meta.url),'utf8');
  ok(SECTIONS.map(s=>s.id).join().endsWith('backyard,proposal')&&SECTION_BY_ID.backyard.load===loadBackyardStep&&SECTION_BY_ID.backyard.legacyStep===STEPS.indexOf('Backyard')&&page.includes("'Backyard','Your estimate'"),'The Backyard section comes just before the proposal and counts as the old Backyard step');
  ok(registry.includes("export const loadBackyardStep=()=>import('./steps/BackyardStep');")&&page.includes('BackyardStep=lazy(loadBackyardStep)')&&page.includes("case 'backyard':return <BackyardStep ")&&page.includes("const active=[...open][0]??'deck'")&&page.includes('<Suspense key={active}')&&page.includes('{renderBody(active)}'),'The Backyard body loads lazily through the registry, and only while it is the selected inspector');
  ok(/<YardEditor\b(?=[^>]*\bdata=\{data\})(?=[^>]*\bonChange=\{update\})/.test(page),'The backyard is edited through the undoable update');
  ok(page.includes('deckOnly={!hasBackyardLayout(data)} yardModel={displayEstimate.yardModel}')&&page.includes('onUpdate={update}'),'The 3D view shows the backyard only when the design has patios, walls, water or terrain (allowances are not drawn)');
  ok(page.includes('update({yardAllowances:hasYardAllowances(next)?next:undefined})')&&page.includes('<select aria-label="Fire pit"')&&page.includes('<select aria-label="Outdoor kitchen"')&&page.includes('Artificial turf')&&page.includes('Landscape lighting for the yard')&&page.includes('<select aria-label="Finish level"'),'The Backyard step offers the four allowances and drops them when the last is switched off');
  ok(!page.includes('yardAllowances:undefined,'),'The live estimate re-prices when an allowance changes');
  ok(page.includes('hydrated.legacyKey===DESIGN_STORAGE_KEY&&restored.yardFeatures?.length')&&page.includes('const {yardFeatures,terrainConfig,...deck}=restored;setData(deck);dataRef.current=deck;setEarlierYard')&&page.includes('Add {earlierYard===1?\'it\':\'them\'} back'),'An older autosave\'s backyard is offered back, never restored silently');
  ok(page.includes('Deck subtotal')&&page.includes('Backyard subtotal'),'The estimate shows deck and backyard subtotals');
  ok(page.includes('yardFeatures:data.yardFeatures?.map(({color:_color,...feature})=>feature)')&&!page.includes('terrainConfig:undefined'),'The live estimate re-prices when the backyard or terrain changes (only a concept colour does not)');
}

// 4. Older single-area privacy designs become editable screens at exactly the same price.
for(const privacySqft of [24,25,137,500]){
  const legacy:DeckData={...structuredClone(DEFAULT_DECK),privacySqft};
  const migrated=deckReleaseData(legacy);
  ok(migrated.privacyScreens&&migrated.privacyScreens.length>0,'Legacy privacy area becomes screens');
  ok(migrated.privacySqft===privacySqft,'Migration preserves the priced area');
  ok(calculateDeckReleaseEstimate(legacy).total===calculateEstimate(legacy).total,'Same total as the original single-area pricing');
  ok(parseDeckReleaseDesign(serializeDeckReleaseDesign(legacy)).privacySqft===privacySqft,'Migrated screens survive save/load');
  ok(!('privacyScreens' in legacy),'Migration never mutates the source design');
}
// A slatted screen switched off keeps its settings but leaves the estimate entirely.
{
  const screen={id:'s1',side:'Left' as const,lengthFt:8,heightFt:6 as const,offsetPct:50,lights:false},base=calculateDeckReleaseEstimate(DEFAULT_DECK);
  const on=deckReleaseData({...structuredClone(DEFAULT_DECK),privacyScreens:[screen]}),off=deckReleaseData({...structuredClone(DEFAULT_DECK),privacyScreens:[{...screen,enabled:false}]});
  ok(on.privacySqft===48&&off.privacySqft===0,'An off screen has no priced area');
  ok(calculateDeckReleaseEstimate(off).total===base.total,'An off screen adds nothing');
  ok(calculateDeckReleaseEstimate(on).total>base.total,'The same screen switched on is priced');
  ok(off.privacyScreens?.[0].lengthFt===8,'Switching off keeps the screen settings');
}
// 5. The sections (R1): nine rows in a fixed order, each owning its design fields. Which row owns each estimate section,
// the rows' price effects (they add up to the priced subtotal, never $0 for a quote) and the engine titles are checked
// with the price schedule, in check-deck-ledger.ts.
{
  ok(SECTIONS.map(s=>s.name).join('|')==='House|Deck shape & size|Boards & finish|Stairs & railings|Lighting|Privacy, skirting & extras|Site & foundation|Backyard|Proposal & files','Nine sections, in order');
  ok(SECTIONS.every(s=>STEPS[s.legacyStep]!==undefined&&SECTION_BY_ID[s.related.id]&&s.related.id!==s.id),'Each section counts as an old wizard step and links to another section');
  const fields=SECTIONS.flatMap(s=>s.fields);
  ok(new Set(fields).size===fields.length,'No design field belongs to two sections');
  const house=getHouseConfig({...structuredClone(DEFAULT_DECK),width:20});
  const unrated=DECKING_CATALOGUE.find(m=>m.costPerSqft===null&&!m.isHidden)!;
  const samples:[string,Partial<DeckData>][]=[
    ['the default deck',{}],
    ['an L-shape with two levels',{width:24,length:16,shape:'L-Shape',levels:2}],
    ['no stairs and no railing',{stairFlights:0,railingType:'None'}],
    ['a porch wrap',{width:22,length:12,houseConfig:{...house,widthFt:26,depthFt:22},wrap:{left:{widthFt:8,runFt:8},porchLeft:{depthFt:8,runFt:10}}}],
    ['accent boards and an inlay',{width:20,boardColours:[{lv:1,role:'field',scope:'course',course:'r5',colour:'tt_prime_plus:Dark Cocoa'}],inlays:[{id:'a',kind:'rug',widthFt:6,depthFt:4}]}],
    ['a catalogue railing and a Dark Slate border',{catalogueRailingId:RAILING_CATALOGUE[0].id,railingType:RAILING_CATALOGUE[0].baseType,pictureFrameRows:1,borderFinish:'Dark Slate'}],
    ['deck-part finishes',{pictureFrameRows:1,deckFinishes:{border:'tt_legacy:Espresso',treads:'tt_terrain_plus:Dark Oak'}}],
    ['skirting, accessories, a screen and extras',{height:48,skirting:{style:'Lattice',clearanceIn:2,accessPanels:1},catalogueAccessories:[MANUFACTURER_ACCESSORIES.find(a=>a.previewSupported)!.id],privacyScreens:[{id:'s1',side:'Left',lengthFt:8,heightFt:6,offsetPct:30,lights:false}],benchLf:8,pergolaSqft:64,hasDemo:true,hasDrainage:true}],
    ['lighting',{lightingSystem:{wireDistance:20,selectedItems:[{productId:'wedge',qty:4,zone:'stairs'},{productId:'hub100',qty:1}]}}],
    [`${unrated.name} decking (no rate)`,{deckingMaterial:unrated.id,deckingColor:unrated.colors[0].name,benchLf:8}],
    ['a backyard with allowances',{yardFeatures:[patio,wall,pond],yardAllowances:{finish:'mid',firePit:'wood',kitchen:'basic',turfSqft:500,lighting:true}}],
  ];
  for(const [label,patch] of samples){
    const d=deckReleaseData({...structuredClone(DEFAULT_DECK),...patch});
    ok(SECTIONS.every(s=>sectionSummary(s,d).length>0),`${label}: every row has a current choice`);
  }
  // The "changed" mark compares a section's fields with the default design; an edit belongs to its fields' sections.
  const plain=deckReleaseData(structuredClone(DEFAULT_DECK));
  ok(SECTIONS.every(s=>!sectionChanged(s,plain)),'On the default design no section is marked changed');
  const changed=(patch:Partial<DeckData>)=>SECTIONS.filter(s=>sectionChanged(s,deckReleaseData({...plain,...patch}))).map(s=>s.id).join();
  ok(changed({width:20})==='deck'&&changed({stairFlights:2})==='stairs'&&changed({deckFinishes:{railingColor:'Matte Black'}})==='stairs'&&changed({deckFinishes:{border:'tt_legacy:Espresso'}})==='boards'&&changed({boardColours:[]})===''&&changed({sceneLighting:'Evening'})==='','Each change marks only its own section (an empty list is no change)');
  ok(sectionsOfPatch({deckFinishes:{border:'tt_legacy:Espresso',railingColor:'Matte Black'}},plain).join()==='boards,stairs'&&sectionsOfPatch({deckFinishes:{...plain.deckFinishes,railingColor:'Matte Black'}},plain).join()==='stairs'&&sectionsOfPatch({width:20,yardAllowances:undefined},plain).join()==='deck,backyard'&&sectionsOfPatch({sceneLighting:'Evening'},plain).length===0,'Edits are attributed to sections through their fields');
}
ok(designerSource().includes('deckRelease'),'The public page uses the release boundary');
console.log(`DECK RELEASE OK — deck-only designs unchanged byte for byte, the backyard priced separately (estimator allowances included), one HST, exports, the Backyard section, the section rows and older autosaves; ${checks} checks.`);
