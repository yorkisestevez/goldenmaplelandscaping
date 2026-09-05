import assert from 'node:assert/strict';
import { BUSINESS, canPublish, publicClaimCopy } from '../src/data/business.ts';

assert.equal(BUSINESS.legalName.status, 'owner_reported');
assert.equal(BUSINESS.urls.googleReviewUrl.status, 'owner_reported');
assert.equal(canPublish(BUSINESS.reviews.aggregate), false, 'unknown review evidence must not be publishable as a verified trust claim');
assert.equal(canPublish(BUSINESS.credentials.wsib), false, 'published-only WSIB claim must not be promoted');
assert.equal(publicClaimCopy(BUSINESS.credentials.wsib, 'WSIB coverage is documented.'), 'Ask us for current coverage documentation.');
assert.equal(publicClaimCopy(BUSINESS.reviews.aggregate, 'Verified Google reviews.'), 'Discuss your project with our team.');
console.log('business publication gates: passed');
