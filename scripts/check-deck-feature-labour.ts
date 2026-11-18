/**
 * Inlay & special-feature labour defaults to man-hours + materials; per-user settings override.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {
  DEFAULT_FEATURE_LABOUR,
  FEATURE_DEFAULT_PERSON_HOUR_RATE,
  FEATURE_LABOUR_LABELS,
  featureLabourIsQuote,
  mergeFeatureLabour,
  priceFeatureLabourScope,
  validateFeatureLabour,
} from '../src/features/deckcraft/featureLabour';
import {CONFIRMED_RATES,unconfirmedRates} from '../src/features/deckcraft/rateConfidence';

import '../src/features/deckcraft/lib/inlayGeometryRuntime';

let n=0;
const ok=(v:unknown,s:string)=>{assert.ok(v,s);n++;};
const near=(a:number,b:number,s:string)=>ok(Math.abs(a-b)<1e-6,`${s} (${a} vs ${b})`);

const defaults=validateFeatureLabour(undefined);
ok(defaults.scopes.accent.mode==='crew-hours'&&defaults.scopes.medallion.mode==='crew-hours'&&defaults.scopes.customInlay.mode==='crew-hours','Defaults are crew-hours for all special-feature scopes');
near(defaults.personHourRate,FEATURE_DEFAULT_PERSON_HOUR_RATE,'Default person-hour rate matches $3,700 ÷ 27');

const accent=priceFeatureLabourScope(undefined,'accent',8)!;
near(accent.manHours,2*0.25*8,'Accent: 2 people × 0.25 h × 8 boards');
near(accent.installationCost,Math.round(accent.manHours*FEATURE_DEFAULT_PERSON_HOUR_RATE*100)/100,'Accent labour from man-hours');
ok(accent.supplyCost===0,'Accent extra materials default to 0 (boards priced separately)');

const med=priceFeatureLabourScope(undefined,'medallion',2)!;
near(med.manHours,2*4*2,'Medallion: 2 people × 4 h × 2');
ok(featureLabourIsQuote(mergeFeatureLabour(undefined,{scopes:{medallion:{...DEFAULT_FEATURE_LABOUR.scopes.medallion,mode:'quote'}}}),'medallion'),'Quote mode is detected');
ok(priceFeatureLabourScope(mergeFeatureLabour(undefined,{scopes:{medallion:{...DEFAULT_FEATURE_LABOUR.scopes.medallion,mode:'quote'}}}),'medallion',1)===null,'Quote mode prices nothing');

const design=deckReleaseData({...structuredClone(DEFAULT_DECK),width:20,length:14,inlays:[{id:'m1',kind:'medallion',style:'round',diameterFt:4}]});
const priced=calculateDeckReleaseEstimate(design);
const labour=priced.sections.find(s=>s.title.startsWith('Labour'))!;
const row=labour.items.find(i=>i.name===FEATURE_LABOUR_LABELS.medallion);
ok(row&&row.cost!==null&&row.cost>0,'Medallion labour is priced by default');
ok(!priced.quoteRequired.some(q=>/Medallion inlay labour/i.test(q)),'Medallion is not an outstanding builder quote by default');
near(row!.cost as number,priceFeatureLabourScope(undefined,'medallion',1)!.installationCost,'Estimate uses the default medallion allowance');

const quoted=calculateDeckReleaseEstimate({...design,featureLabour:mergeFeatureLabour(undefined,{scopes:{medallion:{...DEFAULT_FEATURE_LABOUR.scopes.medallion,mode:'quote'}}})});
ok(quoted.quoteRequired.some(q=>/Medallion inlay labour/i.test(q)),'Quote mode restores the builder-quote requirement');
ok(quoted.sections.find(s=>s.title.startsWith('Labour'))!.items.some(i=>i.name===FEATURE_LABOUR_LABELS.medallion&&i.cost===null),'Quote mode leaves a null-cost labour line');

const accentJob=deckReleaseData({...structuredClone(DEFAULT_DECK),width:20,length:12,boardColours:[{lv:1,role:'field',scope:'course',course:'r3',colour:'tt_prime_plus:Dark Cocoa'}]});
const accentEst=calculateDeckReleaseEstimate(accentJob);
ok(accentEst.sections.find(s=>s.title.startsWith('Labour'))!.items.some(i=>i.name===FEATURE_LABOUR_LABELS.accent&&(i.cost??0)>0),'Accent labour is priced by default');
ok(!accentEst.quoteRequired.some(q=>/Accent-colour board labour/i.test(q)),'Accent labour is not an outstanding quote by default');

const rates=unconfirmedRates();
ok(CONFIRMED_RATES.some(r=>r.id==='medallion-labour'),'Rate register confirms medallion man-hours default');
ok(CONFIRMED_RATES.some(r=>r.id==='accent-board-labour'),'Rate register confirms accent man-hours default');
ok(CONFIRMED_RATES.some(r=>r.id==='custom-inlay-labour'),'Rate register confirms custom-inlay man-hours default');

const panel=readFileSync(new URL('../src/features/deckcraft/designer/OwnerCostEditor.tsx',import.meta.url),'utf8');
ok(panel.includes('Inlays &amp; special features')&&panel.includes('Save as my defaults')&&panel.includes('Load my defaults'),'Owner editor exposes per-user feature labour settings');
ok(readFileSync(new URL('../src/features/deckcraft/projectBundle.ts',import.meta.url),'utf8').includes("'featureLabour'"),'featureLabour is stripped from public bundles');

console.log(`DECK FEATURE LABOUR OK — ${n} checks.`);
