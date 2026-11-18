import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate} from '../src/features/deckcraft/deckRelease';
// This process deliberately does not import any private contractor workflow or applicator.
const data=structuredClone(DEFAULT_DECK),base=calculateDeckReleaseEstimate(data);
assert.deepEqual(calculateDeckReleaseEstimate({...data,quoteResolutions:[]}),base);
assert.throws(()=>calculateDeckReleaseEstimate({...data,quoteResolutions:[{scopeKey:'quote-0000000000000000',fingerprint:'scope-0000000000000000',supplyCost:100,installationCost:50,confirmedOn:'2026-09-26',source:'Fixture only',note:'Fixture only',additionalScope:true}]}),/load|available|ready|private|quote/i);
console.log('Quote registry: 2 checks passed (public parity; private records fail closed without loaded extension).');
