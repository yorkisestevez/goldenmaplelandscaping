import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate} from '../src/features/deckcraft/deckRelease';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {designLinkJson} from '../src/features/deckcraft/designLink';
import {describeDesign} from '../src/features/deckcraft/designFacts';
import {priceLedger} from '../src/features/deckcraft/designer/priceLedgerModel';
import {ProposalSheet} from '../src/features/deckcraft/ProposalSheet';
import {normalizeUnderDeck,UNDER_DECK_OFF,underDeckConfig} from '../src/features/deckcraft/underDeckOptions';
import {buildUnderDeckPricing,underDeckGroundArea,UNDER_DECK_RATES,UNDER_DECK_POLICY} from '../src/features/deckcraft/underDeckPricing';
import {sectionOfTitle,SECTION_OF_FIELD} from '../src/features/deckcraft/designer/sections';
import type {DeckData,UnderDeckConfig} from '../src/features/deckcraft/types';

let checks=0;const ok=(v:unknown,message:string)=>{assert(v,message);checks++;};
const close=(a:number,b:number,message:string)=>ok(Math.abs(a-b)<.011,message);
const sample=(patch:Partial<UnderDeckConfig>={},extra:Partial<DeckData>={}):DeckData=>({...structuredClone(DEFAULT_DECK),height:108,...extra,underDeck:{...UNDER_DECK_OFF,...patch}});
const base=calculateDeckReleaseEstimate(sample()),off=calculateDeckReleaseEstimate({...sample(),underDeck:undefined,hasDrainage:false});
close(base.total,off.total,'All new options off leaves existing estimates unchanged');
ok(SECTION_OF_FIELD.underDeck==='extras'&&sectionOfTitle('Under-deck options')?.id==='extras','New field and cost section are owned by extras');
ok(normalizeUnderDeck({drainage:'toString',ceiling:'constructor',gravel:'true',floorMesh:1,gravelDepthIn:-10}).drainage==='none','Unknown/prototype selections cannot become priced products');
ok(!normalizeUnderDeck({gravel:'true',floorMesh:1}).gravel,'Unknown boolean values remain off');
ok(normalizeUnderDeck({gravelDepthIn:Infinity}).gravelDepthIn===3,'Nonfinite depth uses safe default');
ok(normalizeUnderDeck({gravelDepthIn:99}).gravelDepthIn===6,'Imported depth is bounded');
const original=base.model.levels[0];
const rect=(x:number,y:number,w:number,h:number)=>({...original,offset:{x:x*12,y:0,z:y*12},footprint:{...original.footprint,outline:[{x:0,y:0},{x:w*12,y:0},{x:w*12,y:h*12},{x:0,y:h*12}]}});
close(underDeckGroundArea({...base.model,levels:[rect(0,0,10,10),rect(5,0,10,10)]}),150,'Overlapping multilevel ground footprint is union, not summed200sqft');
close(underDeckGroundArea({...base.model,levels:[rect(0,0,10,2),rect(0,8,10,2),rect(0,2,2,6),rect(8,2,2,6)]}),64,'Union subtracts uncovered central courtyard hole');
close(underDeckGroundArea({...base.model,levels:[rect(0,0,10,10),rect(20,0,4,4)]}),116,'Disjoint ground platforms both count once');

for(const drainage of ['rainescape','dryspace','zipup'] as const){
  const data=sample({drainage}),estimate=calculateDeckReleaseEstimate(data),s=estimate.sections.find(s=>s.title==='Under-deck options')!;
  ok(s.items.some(i=>i.name.includes('installation')&&Number(i.qty)>0&&Number(i.cost)>0),`${drainage} includes separate installation`);
  ok(s.items.some(i=>i.name.includes('delivery')&&Number(i.cost)>0),`${drainage} includes delivery / handling`);
  ok(s.items.some(i=>i.name.includes('downpipes')&&Number(i.cost)>0),`${drainage} includes downpipe stock`);
  ok(!estimate.sections.flatMap(s=>s.items).some(i=>i.name==='Drainage System'),`${drainage} doesn't also charge legacy$12/sqft drainage`);
  close(estimate.subtotal-base.subtotal,s.total,`${drainage} price adds its section once`);
  close(estimate.hst,estimate.subtotal*.13,`${drainage} tax applies once`);
  close(s.total,s.items.reduce((n,i)=>n+(i.cost??0),0),`${drainage} includes all known components in section total`);
}
const legacy=calculateDeckReleaseEstimate({...sample(),underDeck:undefined,hasDrainage:true});
close(legacy.total,calculateDeckReleaseEstimate(sample({drainage:'rainescape',scope:'all'})).total,'Legacy drainage upgrades deterministically to stock plus labour budget');
ok(underDeckConfig({...sample({drainage:'none'}),hasDrainage:true}).drainage==='none','Explicit new config supersedes stale legacy switch');
for(const drainage of ['dryspace','zipup'] as const){
  const p=buildUnderDeckPricing(sample({drainage,ceiling:'cedar'}),base.model);
  ok(p.config.ceiling==='none'&&!p.sections[0].items.some(r=>/cedar|Ceiling furring/.test(r.name)),`${drainage} integrated ceiling isn't priced twice`);
}
const gravel=buildUnderDeckPricing(sample({gravel:true,gravelDepthIn:3}),base.model,1,3700);
close(gravel.stoneTonnes!,192*3/12/35.3146667*1.6*1.1,'Stone quantity follows depth, volume, density and disclosed10% allowance');
const stone=gravel.sections[0].items.find(r=>r.name==='3/4 in clear stone')!,bag=gravel.sections[0].items.find(r=>r.name==='Carr caddy bag packaging and delivery')!;
ok(stone.qty===3,'Whole tonne caddy bags round quantity up');
close(stone.cost!+bag.cost!,3*UNDER_DECK_RATES.caddyDeliveredTonne,'Stone plus packaging/delivery reconciles2026Carr195deliveredprice');
ok(gravel.fabricRolls===1,'Fabric ordered as whole600sqftroll including20% overlaps/cuts');
ok(buildUnderDeckPricing(sample({gravel:true,gravelDepthIn:6}),base.model).stoneTonnes!>gravel.stoneTonnes!,'Greater gravel depth increases stone quantity');
const mesh=buildUnderDeckPricing(sample({floorMesh:true}),base.model);
ok(mesh.meshRolls===1&&mesh.flags.some(s=>s.includes('open sides')&&s.includes('enclosure')),'Floor mesh has stock supply and no false enclosure claim');
ok(!mesh.sections[0].items.some(r=>/gravel|weed fabric|door|side screen/i.test(r.name)),'Floor mesh is independent of gravel/fabric and excludes unmodeled enclosure');
const labour=(p:ReturnType<typeof buildUnderDeckPricing>)=>p.sections[0].items.find(r=>r.name==='Under-deck installation planning allowance')!;
close(labour(mesh).cost!,labour(buildUnderDeckPricing(sample({floorMesh:true}),base.model,2)).cost!,'Material markup never doubles labour');
const customRate=buildUnderDeckPricing(sample({floorMesh:true}),base.model,1,4100);close(labour(customRate).cost!,customRate.crewDays*4100,'Installation uses current editable crew-day rate');
const lowData=sample({floorMesh:true},{height:36}),low=buildUnderDeckPricing(lowData,calculateDeckReleaseEstimate(lowData).model);
ok(low.crewDays>mesh.crewDays&&low.flags.some(s=>s.includes('1.5')),'Restricted height changes installation allowance transparently');
const longData=sample({drainage:'rainescape'},{length:30}),long=buildUnderDeckPricing(longData,calculateDeckReleaseEstimate(longData).model);
ok(long.quoteRequired.some(s=>s.includes('Long drainage'))&&long.sections[0].items.some(s=>s.spec.includes('Never splice')),'Long runs retain explicit waterproof transition quote');

const combined=sample({drainage:'rainescape',ceiling:'pvc',gravel:true,floorMesh:true});
const saved=parseDesign(serializeDesign(combined));assert.deepEqual(saved.underDeck,combined.underDeck);checks++;
const shared=JSON.parse(designLinkJson(combined));assert.deepEqual(shared.configuration.underDeck,combined.underDeck);checks++;
ok(validateDesign({...combined,underDeck:{...combined.underDeck,gravelDepthIn:-2}}).underDeck?.gravelDepthIn===2,'Saved/imported configuration normalizes depth');
const estimate=calculateDeckReleaseEstimate(combined),facts=describeDesign(combined,estimate).proposalFacts;
const html=renderToStaticMarkup(createElement(ProposalSheet,{data:combined,estimate,facts,reviewItems:estimate.flags,image:null,date:'September26,2026'}));
ok(html.includes('Under-deck options')&&html.includes('Under-deck installation planning allowance')&&html.includes('RSI weed fabric'),'Printed proposal includes component amounts and installation');
ok(html.includes('Materials and ancillary allowances:')&&html.includes('Delivery and handling allowances:')&&html.includes('Installation planning allowance:'),'Printed investment directly shows separate included supply, delivery and labour amounts');
ok(html.includes('floor insect mesh')&&html.includes('open sides'),'Printed proposal carries selected floor-only scope');
ok(priceLedger(estimate).quotes.length>0,'Unresolved site details remain quote-required alongside known priced budgets');
ok(priceLedger(estimate).quotes.filter(q=>q.label.startsWith('Under-deck')||q.label.startsWith('Sheltered')||q.label.startsWith('Combined floor')).every(q=>q.kind==='builder'),'Site/detail confirmations are tagged builder quotes');
for(const drainage of ['none','rainescape','dryspace','zipup'] as const)for(const ceiling of ['none','aluminum','pvc','cedar'] as const)for(const height of [36,108]){
  const d=sample({drainage,ceiling,gravel:true,floorMesh:true},{height}),e=calculateDeckReleaseEstimate(d);
  ok(Number.isFinite(e.total)&&e.total>0,'All product combinations produce a finite budget');
  close(e.subtotal,e.sections.filter(s=>s.title!=='HST (13%)').reduce((n,s)=>n+s.total,0),'Combination section totals reconcile');
  close(e.total,e.subtotal*1.13,'Combination applies HST once');
  const p=parseDesign(serializeDesign(d));ok(p.underDeck?.ceiling===underDeckConfig(d).ceiling,'Combination persistence matches normalized integrated-system ceiling');
}
console.log(`DeckCraft under-deck: ${checks} checks passed. Source policy ${UNDER_DECK_POLICY.version}.`);
