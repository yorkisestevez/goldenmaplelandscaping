// Lead-conversion gate — run via `npm run lint`.
// Pins the spam rules so Ads generate_lead cannot silently start firing on
// honeypot / instant-bot Netlify 200s again.

import assert from 'node:assert/strict';
import { scoreGoldenMapleLead } from '../src/utils/leadScoring';
import {
  isQualifiedFormLead,
  shouldFireLeadConversion,
  MIN_QUALIFIED_SESSION_SEC,
} from '../src/utils/leadQualification';

const qualified = {
  visit_count: '1',
  session_duration_sec: String(MIN_QUALIFIED_SESSION_SEC),
  'bot-field': '',
};

assert.equal(isQualifiedFormLead(qualified), true, 'real visitor after 8s must qualify');
assert.equal(isQualifiedFormLead({ ...qualified, session_duration_sec: '57' }), true, '57s Ads lead must qualify');
assert.equal(isQualifiedFormLead({ ...qualified, 'bot-field': 'http://spam' }), false, 'honeypot must fail');
assert.equal(isQualifiedFormLead({ ...qualified, bot_field: 'x' }), false, 'bot_field alias must fail');
assert.equal(isQualifiedFormLead({ ...qualified, session_duration_sec: '7' }), false, 'under 8s must fail');
assert.equal(isQualifiedFormLead({ visit_count: '1' }), false, 'missing duration must fail');
assert.equal(isQualifiedFormLead({ session_duration_sec: '30' }), false, 'missing visit_count must fail');
assert.equal(isQualifiedFormLead(undefined), false, 'empty payload must fail');

assert.equal(shouldFireLeadConversion('contact', qualified), true);
assert.equal(shouldFireLeadConversion('contact', { ...qualified, 'bot-field': 'bot' }), false);
assert.equal(shouldFireLeadConversion('sophie-chat', { 'bot-field': 'bot' }), true, 'Sophie is ungated');
assert.equal(shouldFireLeadConversion('booking', {}), true, 'booking is ungated');
assert.equal(shouldFireLeadConversion('contact', {}, true), true, 'explicit skip still fires');

const maintenance = scoreGoldenMapleLead({
  service: 'Landscape maintenance (2027)',
  budget: 'under-13k',
  details: 'Property type: Commercial\nMowing, lawn care and garden beds',
  city: 'Barrie',
});
assert.deepEqual(maintenance.reasons, ['premium_service_area'], 'selected maintenance is a fit below the construction budget');

const priceShopping = scoreGoldenMapleLead({
  service: 'Landscape maintenance (2027)',
  details: 'Just pricing for lawn care',
});
assert.deepEqual(priceShopping.reasons, ['low_fit_language'], 'non-service low-fit phrases still count for maintenance');

const lowMaintenanceDeck = scoreGoldenMapleLead({
  service: 'Composite deck',
  budget: 'under-13k',
  details: 'Interested in low-maintenance decking',
});
assert.deepEqual(
  lowMaintenanceDeck.reasons,
  ['below_target_budget', 'priority_hardscape_scope', 'low_fit_language'],
  'low-maintenance decking stays construction-scored',
);

const seasonalCleanup = scoreGoldenMapleLead({
  service: 'Seasonal clean-up',
  budget: 'under-13k',
  details: 'Lawn and garden bed clean-up',
});
assert.deepEqual(seasonalCleanup.reasons, ['seasonal_cleanup'], 'seasonal clean-ups keep their existing scoring');

console.log('  PASS  lead qualification gate');
