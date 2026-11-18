/**
 * Lint gate for src/data/pageUpdates.ts — the dates behind the visible
 * "Last updated" lines and the sitemap <lastmod> of the service pages and /faq.
 * - every updatedOn is a real ISO date and not in the future
 * - every entry names a source; reviewedBy is only the founder
 * - the booking window is the owner's exact wording
 */
import assert from 'node:assert/strict';
import { BOOKING_WINDOW, PAGE_UPDATES, type PageUpdate } from '../src/data/pageUpdates.ts';
import { displayDate } from '../src/utils/schema.ts';

const today = new Date().toISOString().slice(0, 10);

for (const [key, entry] of Object.entries(PAGE_UPDATES) as [string, PageUpdate][]) {
  assert.match(entry.updatedOn, /^\d{4}-\d{2}-\d{2}$/, `${key}: updatedOn must be YYYY-MM-DD`);
  assert.equal(new Date(`${entry.updatedOn}T00:00:00Z`).toISOString().slice(0, 10), entry.updatedOn, `${key}: ${entry.updatedOn} is not a real date`);
  assert.ok(entry.updatedOn <= today, `${key}: updatedOn ${entry.updatedOn} is in the future`);
  assert.ok(entry.source.trim().length > 20, `${key}: needs a source saying where the update is recorded`);
  if (entry.reviewedBy !== undefined) assert.equal(entry.reviewedBy, 'yorkis-estevez', `${key}: unknown reviewer`);
  displayDate(entry.updatedOn);
}

assert.equal(BOOKING_WINDOW, 'Now booking Spring 2027 projects. A site visit is booked once scope and budget are confirmed.', 'booking window must keep the owner wording');
assert.equal(displayDate('2026-11-07'), 'November 7, 2026');
assert.throws(() => displayDate('November 7, 2026'));

console.log(`PAGE UPDATES OK — ${Object.keys(PAGE_UPDATES).length} records, none in the future.`);
