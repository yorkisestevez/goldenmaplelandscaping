import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BOARD_LAYOUTS,BORDER_ROWS,COLLECTIONS,FASTENERS,FOUNDATIONS,RAILING_STYLES,STAIR_LAYOUTS} from '../src/features/deckcraft/designer/optionGroups';
import {COLLECTION_GUIDES,DECKING_FAMILIES,OPTION_GUIDES,collectionFamilyLabel,collectionGuide,optionGuide} from '../src/features/deckcraft/designer/optionGuides';
import {DESIGNER_FAQ} from '../src/features/deckcraft/designerFaq';

/**
 * The designer's customer-facing explanations: every offered choice has one, none goes stale when an option is
 * removed, and none says what the business-fact register forbids (warranty lengths, permit promises, credentials,
 * prices, brands we don't sell). The same claim regexes the postbuild gate runs over prerendered pages apply here,
 * because option hints render client-side where that gate can't see them.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};

const rules:{id:string;pattern:string;tier?:string}[]=JSON.parse(readFileSync('scripts/claim-rules.json','utf8')).rules;
const blocking=rules.filter(r=>r.tier!=='warn').map(r=>({id:r.id,re:new RegExp(r.pattern,'i')}));
// Beyond the register: no warranty spans, no dollar figures (the price schedule is the one price), no unsold brands.
const extra=[
  {id:'warranty_years',re:/\b\d+[ -]year\b[^.]*warrant|warrant[^.]*\b\d+[ -]year/i},
  {id:'price_figure',re:/\$\s*\d/},
  {id:'unsold_brand',re:/\b(Trex|Ipe)\b/i},
  {id:'schedule_promise',re:/\b\d+\s*[-–]\s*\d+\s*(?:working\s+)?days\b/i},
];
const screen=(where:string,text:string)=>{
  for(const r of [...blocking,...extra])ok(!r.re.test(text),`${where}: matches claim rule ${r.id} — "${text}"`);
  ok(text.trim().length>=20,`${where}: too short to explain anything`);
};

// 1. Every offered collection has a family and a guide line; no guide for a collection that's gone.
for(const m of COLLECTIONS){
  ok(COLLECTION_GUIDES[m.id],`collection ${m.id} (${m.name}) has no guide — add it to optionGuides.ts`);
  ok(collectionFamilyLabel(m.id),`collection ${m.id} has no family label`);
  screen(`collection ${m.id}`,collectionGuide(m.id)!);
}
const offered=new Set(COLLECTIONS.map(m=>m.id));
for(const id of Object.keys(COLLECTION_GUIDES))ok(offered.has(id),`guide for ${id}, which is no longer offered`);
for(const [family,text] of Object.entries(DECKING_FAMILIES))screen(`family ${family}`,text);

// 2. Every select choice in the guided groups has a guide; no guide for a choice that's gone.
const groups={pattern:BOARD_LAYOUTS,fasteningSystem:FASTENERS,pictureFrameRows:BORDER_ROWS,foundation:FOUNDATIONS,stairType:STAIR_LAYOUTS,railingType:RAILING_STYLES} as const;
for(const [group,choices] of Object.entries(groups) as [keyof typeof groups,readonly (string|number)[]][]){
  for(const v of choices){
    const text=optionGuide(group,v);
    ok(text,`${group} "${v}" has no guide — add it to OPTION_GUIDES`);
    screen(`${group} "${v}"`,text!);
  }
  for(const key of Object.keys(OPTION_GUIDES[group]??{}))ok(choices.map(String).includes(key),`${group} guide for "${key}", which is not a choice`);
}

// 3. Code figures in the guides match the transcribed sources (docs/deckcraft/structure-sources.md).
ok(/600 mm/.test(optionGuide('railingType','None')!),'None railing guide states the 600 mm guard trigger');
ok(/4 in \(100 mm\)/.test(optionGuide('railingType','Cable')!),'Cable guide states the 100 mm opening rule');
ok(/4 ft/.test(optionGuide('foundation','Concrete Piers')!),'Concrete pier guide states the 4 ft frost depth');
ok(/aren't attached/.test(optionGuide('foundation','Deck Blocks')!),'Deck block guide limits them to unattached decks');
ok(/12 in/.test(optionGuide('pattern','Diagonal')!),'Diagonal guide states 12 in joist spacing');

// 4. The designer FAQ: unique, screened, and the same array the page renders and the schema emits.
ok(DESIGNER_FAQ.length>=5,'designer FAQ has at least five questions');
ok(new Set(DESIGNER_FAQ.map(f=>f.q)).size===DESIGNER_FAQ.length,'designer FAQ questions are unique');
for(const f of DESIGNER_FAQ){screen(`FAQ "${f.q}"`,f.q+' '+f.a);ok(f.q.endsWith('?'),`FAQ "${f.q}" is a question`);}
const page=readFileSync('src/pages/DeckDesigner.tsx','utf8');
ok(/faqPage\(\s*'\/deck-designer'\s*,\s*DESIGNER_FAQ\s*\)/.test(page),'DeckDesigner emits FAQPage schema from DESIGNER_FAQ');
ok(/DESIGNER_FAQ\.map\(/.test(page),'DeckDesigner renders DESIGNER_FAQ visibly (schema must match visible content)');

console.log(`DECK OPTION GUIDES OK — ${checks} checks: ${COLLECTIONS.length} collections, ${Object.values(groups).reduce((n,g)=>n+g.length,0)} choices and ${DESIGNER_FAQ.length} FAQ answers explained, screened against ${blocking.length + extra.length} claim rules.`);
