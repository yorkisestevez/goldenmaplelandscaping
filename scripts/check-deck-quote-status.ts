import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {newPergola} from '../src/features/deckcraft/pergolaValidation';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {isQuoteStatusRequirement} from '../src/features/deckcraft/quoteResolutions';
import {quoteScopeReview} from '../src/features/deckcraft/designer/quoteReviewModel';
import {confirmQuoteScope} from '../src/features/deckcraft/quoteResolutionValidation';
import type {QuoteResolution} from '../src/features/deckcraft/types';
let checks=0;const check=(condition:unknown,message:string)=>{assert.ok(condition,message);checks++;};
const data=deckReleaseData({...structuredClone(DEFAULT_DECK),width:30,length:30,pergola:{...newPergola('costco-mirador'),xFt:15,zFt:15}}),before=calculateDeckReleaseEstimate(data),review=quoteScopeReview(data,before),requirements=before.quoteRequired.filter(isQuoteStatusRequirement);
check(requirements.length===2,'Fixture has both availability and provisional-price requirements');
check(JSON.stringify(review.requirements)===JSON.stringify(requirements),'UI exposes both outstanding confirmations separately');
check(!review.scopes.some(s=>isQuoteStatusRequirement(s.name)||s.labels.some(isQuoteStatusRequirement)),'Status labels cannot be entered as additional-cost scopes');
const missing=review.scopes.find(s=>s.rows.some(r=>r.sectionTitle==='Aluminum pergola'))!;
check(!!missing&&missing.rows.length>=5,'Actual installation/delivery/anchor/structural/electrical null rows remain usable');
const confirmed=confirmQuoteScope(missing,{supplyCost:100,installationCost:250,confirmedOn:'2026-09-27',source:'TEST ONLY',note:'Additional missing pergola work only.'});
// Captured with the pre-fix scope builder: these once-chargeable status entries
// must remain inactive, even when the otherwise unchanged design is reopened.
const oldStatusRecords:QuoteResolution[]=[
 {supplyCost:100,installationCost:250,confirmedOn:'2026-09-27',source:'TEST ONLY',note:'Regression fixture; this must not confirm stock availability.',scopeKey:'quote-dd39214ee1a39f28',fingerprint:'scope-e793e0ea2db24c10',additionalScope:true},
 {supplyCost:100,installationCost:250,confirmedOn:'2026-09-27',source:'TEST ONLY',note:'Regression fixture; this must not confirm stock availability.',scopeKey:'quote-800a0bc044d825c6',fingerprint:'scope-209d5ec4f720a1d6',additionalScope:true}
];
const old=calculateDeckReleaseEstimate({...data,quoteResolutions:oldStatusRecords});
check(old.total===before.total,'Old generic fee records add no amount for non-cost confirmations');
check(old.quoteResolutionReview?.active.length===0&&old.quoteResolutionReview.inactive===2,'Old status fee records retained inactive');
check(requirements.every(q=>old.quoteRequired.includes(q)),'Old fee records cannot clear stock or price confirmations');
const next={...data,quoteResolutions:[confirmed,...oldStatusRecords]},after=calculateDeckReleaseEstimate(next),reopened=quoteScopeReview(next,after);
check(Math.abs(after.subtotal-before.subtotal-385)<1e-7,'Actual additional scope charges supply markup and installation once');
check(Math.abs(after.total-before.total-435.05)<1e-7,'HST added exactly once to true missing costs');
check(after.quoteResolutionReview?.active.length===1&&after.quoteResolutionReview.inactive===2,'Only actual missing-cost scope activates');
check(requirements.every(q=>after.quoteRequired.includes(q)),'Both confirmations remain after all pergola null costs are covered');
check(after.sections.find(s=>s.title==='Aluminum pergola')?.quoteRequired,'Pergola ledger still marks outstanding confirmation');
check(after.sections.find(s=>s.title==='Aluminum pergola')?.items.filter(i=>i.cost===null).every(i=>i.quoteResolved),'Real null rows report coverage');
check(JSON.stringify(reopened.requirements)===JSON.stringify(requirements),'Reopened UI keeps dedicated confirmation requirements');
check(!reopened.scopes.some(s=>isQuoteStatusRequirement(s.name)),'Reopened UI cannot sell a confirmation fee');
check(isQuoteStatusRequirement('Pergola availability and kit completeness require confirmation (catalog: check stock).'),'Other catalogue stock states remain protected');
check(!isQuoteStatusRequirement('Pergola installation labour (builder quote)'),'True labour quote remains cost-resolvable');
check(!isQuoteStatusRequirement('Aluminum pergola supply'),'True unpriced supply remains cost-resolvable');
console.log(`Quote status requirements: ${checks} checks passed.`);

