import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const component = (name: string) => readFileSync(resolve('src/components', name), 'utf8');
const prohibited = [
  /5\.0\s*(?:★|·)/i,
  /8\s+reviews?/i,
  /WSIB\s*(?:covered|certified)/i,
  /\$5M\s*(?:insured|liability)/i,
  /5-year\s+(?:workmanship|warranty)/i,
  /free\s+(?:consultation|15-min|estimate request|on-site visit)/i,
  /(?:reply|reach out|follow up)\s+within\s+(?:24 hours|1 business day)/i,
  /\$99\s*(?:·\s*)?(?:credited|design)/i,
  /credited\s+toward\s+(?:your\s+)?(?:build|project)/i,
];

for (const file of [
  'HeroContactForm.tsx', 'QuickQuote.tsx', 'BookingScheduler.tsx',
  'BuyersGuide.tsx', 'EstimateLeadCapture.tsx', 'EstimateBookingCTA.tsx',
  'ChatWidget.tsx', 'Process.tsx',
]) {
  const source = component(file);
  for (const pattern of prohibited) {
    assert.doesNotMatch(source, pattern, `${file} must not publish an unverified business claim: ${pattern}`);
  }
}

for (const file of ['HeroContactForm.tsx', 'QuickQuote.tsx', 'BookingScheduler.tsx', 'Manifesto.tsx', 'EstimateBookingCTA.tsx']) {
  const source = component(file);
  assert.match(source, /publicContact/, `${file} must use canonical public contact data`);
}

const testimonials = component('Testimonials.tsx');
assert.match(testimonials, /if\s*\(!canPublish\(BUSINESS\.reviews\.testimonials\)\)\s*return null/, 'unapproved testimonials must not render');
assert.match(testimonials, /const REVIEWS = \[/, 'testimonial records must remain preserved in source');

console.log('component publication gates: passed');
