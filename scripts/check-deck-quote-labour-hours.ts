/**
 * Crew-hours quote entry: labour = crew × hours × person-hour rate, plus optional materials.
 * Used in Quote Review for medallion / accent / cladding / custom-inlay scopes without a fixed book rate.
 */
import assert from 'node:assert/strict';
import {CREW_DAY_RATES} from '../src/features/deckcraft/types';
import {confirmQuoteScope} from '../src/features/deckcraft/quoteResolutionValidation';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {quoteScopeReview} from '../src/features/deckcraft/designer/quoteReviewModel';
import {
  CREW_DAY_PERSON_HOURS,
  DEFAULT_CREW_MEMBERS,
  DEFAULT_PERSON_HOUR_RATE,
  crewHoursNote,
  crewManHours,
  quoteCostFromCrewHours,
} from '../src/features/deckcraft/designer/quoteLabourHours';
import {readFileSync} from 'node:fs';
import {CONFIRMED_RATES,unconfirmedRates} from '../src/features/deckcraft/rateConfidence';

let n=0;
const ok=(v:unknown,s:string)=>{assert.ok(v,s);n++;};
const near=(a:number,b:number,s:string)=>ok(Math.abs(a-b)<1e-7,`${s} (${a} vs ${b})`);
const reject=(f:()=>unknown,s:string)=>{assert.throws(f);n++;ok(true,s);};

ok(DEFAULT_CREW_MEMBERS===3&&CREW_DAY_PERSON_HOURS===27,'GM crew is three people × nine hours');
near(DEFAULT_PERSON_HOUR_RATE,Math.round(CREW_DAY_RATES.Toronto/27*100)/100,'Default person-hour rate is $3,700 ÷ 27');
near(crewManHours(3,4),12,'3 people × 4 h = 12 man-hours');

const labour=quoteCostFromCrewHours({crewMembers:3,hours:4,personHourRate:DEFAULT_PERSON_HOUR_RATE,materials:50});
near(labour.manHours,12,'Crew-hours man-hours');
near(labour.installationCost,Math.round(12*DEFAULT_PERSON_HOUR_RATE*100)/100,'Labour from man-hours × rate');
near(labour.supplyCost,50,'Materials pass through as supply');
ok(crewHoursNote(labour).includes('3 people × 4 h = 12 man-hours'),'Private note records the crew-hours basis');

reject(()=>quoteCostFromCrewHours({crewMembers:0,hours:4}),'Rejects zero crew');
reject(()=>quoteCostFromCrewHours({crewMembers:3,hours:0}),'Rejects zero hours');
reject(()=>quoteCostFromCrewHours({crewMembers:3,hours:1.1}),'Rejects non-quarter hours');
reject(()=>quoteCostFromCrewHours({crewMembers:3,hours:4,personHourRate:-1}),'Rejects negative rate');
reject(()=>quoteCostFromCrewHours({crewMembers:3,hours:4,materials:0.001}),'Rejects sub-cent materials');

// End-to-end: quote-mode medallion labour resolves via crew-hours → installationCost.
import '../src/features/deckcraft/lib/inlayGeometryRuntime';
import {DEFAULT_FEATURE_LABOUR,mergeFeatureLabour} from '../src/features/deckcraft/featureLabour';
const quoteMode=mergeFeatureLabour(undefined,{scopes:{medallion:{...DEFAULT_FEATURE_LABOUR.scopes.medallion,mode:'quote'}}});
const med=deckReleaseData({...structuredClone(DEFAULT_DECK),width:20,length:14,inlays:[{id:'m1',kind:'medallion',style:'round',diameterFt:4}],featureLabour:quoteMode});
const before=calculateDeckReleaseEstimate(med);
ok(before.quoteRequired.some(q=>/Medallion inlay labour/i.test(q)),'Quote-mode medallion labour is a quote requirement');
const scope=quoteScopeReview(med,before).scopes.find(s=>s.labels.some(l=>/Medallion inlay labour/i.test(l))||/Medallion/i.test(s.name));
ok(!!scope,'Medallion labour binds a quote scope');
const costs=quoteCostFromCrewHours({crewMembers:2,hours:6,materials:0});
const entry=confirmQuoteScope(scope!,{supplyCost:costs.supplyCost,installationCost:costs.installationCost,confirmedOn:'2026-10-08',source:'Crew-hours entry test',note:`Medallion install only. ${crewHoursNote(costs)}`});
const after=calculateDeckReleaseEstimate({...med,quoteResolutions:[entry]});
near(after.subtotal-before.subtotal,costs.installationCost,'Crew-hours labour adds installation with no markup');
ok(!after.quoteRequired.some(q=>/Medallion inlay labour/i.test(q)),'Confirmed crew-hours clears medallion labour quote');

const rates=unconfirmedRates();
ok(CONFIRMED_RATES.some(r=>r.id==='medallion-labour'),'Rate register confirms medallion labour man-hours default');
ok(CONFIRMED_RATES.some(r=>r.id==='accent-board-labour'),'Rate register confirms accent labour man-hours default');

const panel=readFileSync(new URL('../src/features/deckcraft/designer/QuoteReviewPanel.tsx',import.meta.url),'utf8');
ok(panel.includes("basis:'total'|'unit'|'crew'")&&panel.includes('Crew members × hours')&&panel.includes('quoteCostFromCrewHours'),'Quote Review exposes the crew-hours entry basis');

console.log(`DECK QUOTE LABOUR HOURS OK — ${n} checks.`);
