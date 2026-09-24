import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {MANUFACTURER_ACCESSORIES,RAILING_CATALOGUE} from '../src/features/deckcraft/manufacturerCatalog';
import {DECK_LABEL,designFeatures,resetDeckAnalyticsVisit,setDeckAnalyticsSink,stepLabel,trackDeck,type DeckEvent} from '../src/features/deckcraft/deckAnalytics';
import type {DeckData} from '../src/features/deckcraft/types';
import {SECTIONS} from '../src/features/deckcraft/designer/sections';
import {designerSource} from './deck-designer-source';

/**
 * DeckCraft funnel analytics: a closed vocabulary of fixed labels (never customer text, sizes or prices),
 * steps/features/views counted once per visit, outputs and links counted every time, and every place in
 * the designer that should report does.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const sent:[DeckEvent,string][]=[];
setDeckAnalyticsSink((event,label)=>sent.push([event,label]));
const base=():DeckData=>structuredClone(DEFAULT_DECK);
const design=(patch:Partial<DeckData>):DeckData=>deckReleaseData({...base(),...patch});
const house=getHouseConfig({...base(),width:20});

// 1. The default design reports no features; each choice reports its own fixed label.
ok(designFeatures(base()).length===0,`The default design uses no features (got ${designFeatures(base()).join(', ')})`);
const expectations:[Partial<DeckData>,string][]=[
  [{shape:'L-Shape'},'deck_shape_l_shape'],[{shape:'Multi-corner'},'deck_shape_multi_corner'],[{shape:'Curved'},'deck_shape_curved'],
  [{pattern:'Herringbone'},'deck_pattern_herringbone'],[{pattern:'Picture Frame'},'deck_pattern_picture_frame'],
  [{deckType:'Freestanding'},'deck_type_freestanding'],[{deckType:'Floating',height:12},'deck_type_floating'],
  [{width:22,length:12,houseConfig:{...house,widthFt:26,depthFt:22},wrap:{left:{widthFt:8,runFt:10}}},'deck_wrap'],
  [{width:22,length:12,houseConfig:{...house,widthFt:26,depthFt:22},wrap:{left:{widthFt:8,runFt:8},porchLeft:{depthFt:8,runFt:10}}},'deck_porch'],
  [{cornerChamfers:{frontLeftFt:4}},'deck_corner_chamfer'],
  [{levels:2},'deck_level_2'],[{levels:3},'deck_level_3'],[{levels:2,level2FullStep:true},'deck_split_level'],
  [{stairType:'Landing'},'deck_stairs_landing'],[{stairType:'Winder'},'deck_stairs_winder'],[{stairFlights:2},'deck_stairs_extra_flights'],
  [{houseConfig:{...house,widthFt:30,depthFt:24,footprint:{rects:[{id:'bump1',kind:'house',wall:'Front',offsetFt:8,widthFt:10,depthFt:3}]}}},'deck_house_block'],
  [{houseConfig:{...house,widthFt:30,depthFt:24,footprint:{rects:[{id:'garage1',kind:'garage',wall:'Left',offsetFt:0,widthFt:20,depthFt:22}]}}},'deck_house_garage'],
  [{houseConfig:{...house,openings:[...house.openings,{id:'w9',type:'Window',facade:'Left',offsetPct:50,bottomIn:48,widthIn:36,heightIn:48}]}},'deck_doors_windows'],
  [{catalogueRailingId:RAILING_CATALOGUE[0].id,railingType:RAILING_CATALOGUE[0].baseType},'deck_catalogue_railing'],
  [{catalogueAccessories:[MANUFACTURER_ACCESSORIES.find(a=>a.previewSupported)!.id]},'deck_accessory'],
  [{pictureFrameRows:1},'deck_border_rows'],[{hasInlay:true,inlayLf:10},'deck_inlay'],
  [{privacyScreens:[{id:'s1',side:'Left',lengthFt:8,heightFt:6,offsetPct:30,lights:false}]},'deck_privacy_screen'],
  [{lightingSystem:{wireDistance:20,selectedItems:[{productId:'wedge',qty:4,zone:'stairs'},{productId:'hub100',qty:1}]}},'deck_lighting'],
  [{benchLf:8},'deck_bench'],[{pergolaSqft:64},'deck_pergola'],[{hasDemo:true},'deck_demolition'],
  [{yardFeatures:[{id:'p1',kind:'patio' as const,name:'Patio',enabled:true,xFt:10,zFt:30,widthFt:16,depthFt:12,heightIn:0,rotationDeg:0,productId:'permacon-melville',color:'#aaaaaa'}]},'deck_backyard'],[{yardFeatures:[{id:'p1',kind:'patio' as const,name:'Patio',enabled:true,xFt:10,zFt:30,widthFt:16,depthFt:12,heightIn:0,rotationDeg:0,productId:'permacon-melville',color:'#aaaaaa'}]},'deck_patio'],[{yardFeatures:[{...{id:'p1',kind:'patio' as const,name:'Patio',enabled:true,xFt:10,zFt:30,widthFt:16,depthFt:12,heightIn:0,rotationDeg:0,productId:'permacon-melville',color:'#aaaaaa'},kind:'retaining-wall' as const,productId:'segmental-concrete',depthFt:1,heightIn:24}]},'deck_retaining_wall'],[{yardFeatures:[{...{id:'p1',kind:'patio' as const,name:'Patio',enabled:true,xFt:10,zFt:30,widthFt:16,depthFt:12,heightIn:0,rotationDeg:0,productId:'permacon-melville',color:'#aaaaaa'},kind:'water-feature' as const,productId:'pond',widthFt:6,depthFt:6,heightIn:24}]},'deck_water_feature'],[{hasDrainage:true},'deck_drainage'],
  [{sceneLighting:'Evening'},'deck_night_preview'],
  ...(['deck_backyard','deck_fire_pit','deck_outdoor_kitchen','deck_turf','deck_landscape_lighting'] as const).map(label=>[{yardAllowances:{finish:'mid' as const,firePit:'wood' as const,kitchen:'basic' as const,turfSqft:500,lighting:true}},label] as [Partial<DeckData>,string]),
];
for(const [patch,label] of expectations){
  const features=designFeatures(design(patch));
  ok(features.includes(label),`${label} is reported (got ${features.join(', ')||'none'})`);
  ok(features.every(f=>DECK_LABEL.test(f)),`${label}: every label is in the fixed vocabulary`);
}
// A transformer on its own is not "lighting"; a screen switched off is not a screen in use.
ok(!designFeatures(design({lightingSystem:{wireDistance:0,selectedItems:[{productId:'hub100',qty:1}]}})).includes('deck_lighting'),'A lone transformer is not lighting');
ok(!designFeatures(design({privacyScreens:[{id:'s1',side:'Left',lengthFt:8,heightFt:6,offsetPct:30,lights:false,enabled:false}]})).includes('deck_privacy_screen'),'A switched-off screen is not in use');
ok(!designFeatures(design({yardFeatures:[{id:'p1',kind:'patio',name:'Patio',enabled:false,xFt:10,zFt:30,widthFt:16,depthFt:12,heightIn:0,rotationDeg:0,productId:'permacon-melville',color:'#aaaaaa'}]})).some(f=>['deck_backyard','deck_patio'].includes(f)),'A switched-off backyard feature is not in use');
// Resizing the house (a wrap sets its size) re-fits the doors and windows; that is not an edit.
ok(!designFeatures(design({width:22,length:12,houseConfig:{...house,widthFt:26,depthFt:22},wrap:{left:{widthFt:8,runFt:8},porchLeft:{depthFt:8,runFt:10}}})).includes('deck_doors_windows'),'A resized house does not count as a doors-and-windows edit');
{
  const door=house.openings.find(o=>o.type==='Door');
  ok(door,'The default house has a door to restyle');
  const restyled=design({houseConfig:{...house,openings:house.openings.map(o=>o===door?{...o,style:(o.style==='Sliding'?'French':'Sliding') as 'French'|'Sliding'}:o)}});
  ok(designFeatures(restyled).includes('deck_doors_windows'),'Restyling a door counts');
  const moved=design({houseConfig:{...house,openings:house.openings.map(o=>o===door?{...o,offsetPct:Math.min(100,o.offsetPct+10)}:o)}});
  ok(!designFeatures(moved).includes('deck_doors_windows'),'Sliding a door along its wall is not counted as an edit');
}
// Nothing the customer types can become a label.
ok(!designFeatures(design({customerName:'Jane Q Customer',projectAddress:'12 Example Crescent',width:23.5})).some(f=>/jane|example|23/i.test(f)),'Labels never carry names, addresses or sizes');

// 2. Once-per-visit events are de-duplicated; outputs and links count every time; bad labels are never sent.
{
  resetDeckAnalyticsVisit();sent.length=0;
  trackDeck('deckcraft_step',stepLabel(1));trackDeck('deckcraft_step',stepLabel(1));trackDeck('deckcraft_step',stepLabel(2));
  ok(sent.length===2&&sent[0][1]==='deck_step_2_materials'&&sent[1][1]==='deck_step_3_stairs_railings','A step is counted once per visit');
  sent.length=0;trackDeck('deckcraft_feature','deck_wrap');trackDeck('deckcraft_feature','deck_wrap');trackDeck('deckcraft_view','deck_view_plan');trackDeck('deckcraft_view','deck_view_plan');
  ok(sent.length===2,'Features and views are counted once per visit');
  sent.length=0;trackDeck('deckcraft_output','deck_proposal');trackDeck('deckcraft_output','deck_proposal');trackDeck('deckcraft_link','deck_link_copied');trackDeck('deckcraft_link','deck_link_copied');
  ok(sent.length===4,'Outputs and links count every time');
  sent.length=0;
  for(const bad of ['Jane Doe','deck_Jane_Doe','jane@example.com','deck_link opened','deck_'+'x'.repeat(40),'wrap',''])trackDeck('deckcraft_output',bad);
  ok(sent.length===0,'Labels outside the vocabulary are dropped, never sent');
  resetDeckAnalyticsVisit();sent.length=0;trackDeck('deckcraft_step',stepLabel(1));
  ok(sent.length===1,'A new visit counts the step again');
  ok(['deck_step_1_dimensions','deck_step_2_materials','deck_step_3_stairs_railings','deck_step_4_site_extras','deck_step_5_backyard','deck_step_6_estimate'].every((l,i)=>stepLabel(i)===l),'Step labels name the six steps');
  ok(['3d','overview','front','top','plan','drawing','structure','hardware','foundation'].every(m=>DECK_LABEL.test(`deck_view_${m}`)),'Every preview mode has a valid label');
  // The site plan (R4): a handle used, a figure typed, a shape shortcut, each once per visit.
  resetDeckAnalyticsVisit();sent.length=0;
  for(const label of ['deck_plan_drag','deck_plan_drag','deck_plan_typed','deck_plan_shortcut','deck_plan_shortcut'])trackDeck('deckcraft_plan',label);
  ok(sent.length===3&&sent.every(([event])=>event==='deckcraft_plan')&&sent.map(([,label])=>label).join()==='deck_plan_drag,deck_plan_typed,deck_plan_shortcut','Plan use is counted once per visit, by what was done');
  // Sections (R1): each opened and each first changed is its own label, once per visit; its old step keeps the funnel.
  ok(SECTIONS.every(s=>DECK_LABEL.test(`deck_section_${s.id}`)&&DECK_LABEL.test(`deck_changed_${s.id}`)),'Every section has valid opened and changed labels');
  ok(SECTIONS.map(s=>stepLabel(s.legacyStep)).join()==='deck_step_1_dimensions,deck_step_1_dimensions,deck_step_2_materials,deck_step_3_stairs_railings,deck_step_4_site_extras,deck_step_4_site_extras,deck_step_4_site_extras,deck_step_5_backyard,deck_step_6_estimate','Each section reports the old step it replaces');
  resetDeckAnalyticsVisit();sent.length=0;
  trackDeck('deckcraft_section','deck_section_stairs');trackDeck('deckcraft_section','deck_section_stairs');trackDeck('deckcraft_section','deck_changed_stairs');
  ok(sent.length===2&&sent[0][1]==='deck_section_stairs'&&sent[1][1]==='deck_changed_stairs','A section is counted once per visit when opened and once when first changed');
}

// 3. Every place in the designer that should report does, through trackDeck with fixed labels.
{
  const page=designerSource();
  const share=readFileSync(new URL('../src/features/deckcraft/ShareDesignLink.tsx',import.meta.url),'utf8');
  ok(/setDeckAnalyticsSink\(\(event,label\)=>trackEngagement\(event,label\)\)/.test(page),'The page sends DeckCraft events through the site analytics');
  ok(page.includes("trackDeck('deckcraft_step',stepLabel(0));},[]);")&&page.includes("trackDeck('deckcraft_step',stepLabel(section.legacyStep))")&&page.includes("trackDeck('deckcraft_view',`deck_view_${mode}`)")&&page.includes('designFeatures(data)'),'The page load and each section opened report their step; views and features are reported');
  ok(page.includes("const [mode,setMode]=useState<PreviewMode>('plan');"),'The page opens on the site plan, so deck_view_plan is the view counted on load');
  for(const label of ['deck_plan_drag','deck_plan_typed','deck_plan_shortcut'])ok(page.includes(`trackDeck('deckcraft_plan','${label}')`),`The site plan reports ${label}`);
  ok(page.includes("trackDeck('deckcraft_section',`deck_section_${section.id}`)")&&/for\(const id of sectionsOfPatch\(patch,data\)\)[^\n]*trackDeck\('deckcraft_section',`deck_changed_\$\{id\}`\)/.test(page),'Opening a section and the first edit in it are reported, through the fields it owns');
  for(const label of ['deck_proposal','deck_summary','deck_json_save','deck_json_import','deck_link_opened','deck_link_failed','deck_link_went_back'])ok(page.includes(`'${label}'`),`The page reports ${label}`);
  ok(page.includes("trackDeck('deckcraft_output',`deck_${kind}`)"),'DXF and OBJ exports are reported');
  ok(share.includes("trackDeck('deckcraft_link',`deck_link_${how}`)"),'The share control reports copies and shares');
  // Every literal label handed to trackDeck anywhere in DeckCraft is in the vocabulary.
  const sources=[page,share].join('\n'),literals=[...sources.matchAll(/trackDeck\('deckcraft_[a-z]+','([^']+)'\)/g)].map(m=>m[1]);
  ok(literals.length>=7&&literals.every(l=>DECK_LABEL.test(l)),`All ${literals.length} literal labels are valid`);
}

console.log(`DECK FUNNEL OK — ${expectations.length} feature labels, de-duplication, vocabulary and wiring; ${checks} checks.`);
