import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {DESIGN_STORAGE_KEY,serializeDesign} from '../src/features/deckcraft/designPersistence';
import {DECK_RELEASE_STORAGE_KEY,deckReleaseData,parseDeckReleaseDesign,serializeDeckReleaseDesign,calculateDeckReleaseEstimate,exportDeckReleaseDXF,exportDeckReleaseOBJ} from '../src/features/deckcraft/deckRelease';
import {BACKYARD_SECTION_PREFIX,backyardElements,describeBackyard,hasBackyard,splitSubtotal} from '../src/features/deckcraft/backyard';
import {normalizeWrap} from '../src/features/deckcraft/lib/wrapGeometry';
import {migrateLegacyPrivacy,pricedPrivacyArea} from '../src/features/deckcraft/privacyScreens';
import type {DeckData} from '../src/features/deckcraft/types';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
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

// 3. The designer: a Backyard step, the yard in 3D only when there is one, and an older autosave's backyard
// offered back rather than restored silently.
{
  const page=designerSource();
  ok(page.includes('<YardEditor data={data} onChange={update}/>')&&page.includes("'Backyard','Your estimate'")&&page.includes('{step===4 && <BackyardStep '),'The designer has a Backyard step before the estimate, edited through the undoable update');
  ok(page.includes('<Viewer deckOnly={!hasBackyard(data)} yardModel={estimate.yardModel}'),'The 3D view shows the backyard only when the design has one');
  ok(/if\(!current&&restored\.yardFeatures\?\.length\)\{\s*const \{yardFeatures,terrainConfig,\.\.\.deck\}=restored;setData\(deck\);setEarlierYard/.test(page)&&page.includes('Add {earlierYard===1?\'it\':\'them\'} back'),'An older autosave\'s backyard is offered back, never restored silently');
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
ok(designerSource().includes('deckRelease'),'The public page uses the release boundary');
console.log(`DECK RELEASE OK — deck-only designs unchanged byte for byte, the backyard priced separately, one HST, exports, the Backyard step and older autosaves; ${checks} checks.`);
