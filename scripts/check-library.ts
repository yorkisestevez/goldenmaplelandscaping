/**
 * Lint gate: the Outdoor Construction Library (src/data/library.ts), the blog index
 * (src/data/blogPosts.ts) and owner reviews (src/data/editorialReviews.ts) agree.
 *
 * - every Library entry is a real, routed post, listed once
 * - every BLOG_POSTS slug is routed (the orphan class that hid interlocking-cost-barrie)
 * - every routed /resources/<slug> post is in BLOG_POSTS (so /resources shows it)
 * - each section has at least MIN_PER_SECTION guides; its service links are routes
 * - a pillar needs a recorded owner review
 * - editorial reviews: routed slug, ISO date, not in the future, source recorded
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLOG_POSTS } from '../src/data/blogPosts.ts';
import { AUTHORED_BY_FOUNDER, EDITORIAL_REVIEWS } from '../src/data/editorialReviews.ts';
import { LIBRARY, LIBRARY_SECTIONS } from '../src/data/library.ts';

const MIN_PER_SECTION = 2;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const routes = readFileSync(join(ROOT, 'src/routes.ts'), 'utf8');
const routedPosts = new Set([...routes.matchAll(/route\('resources\/([a-z0-9-]+)'/g)].map((m) => m[1]));
const isRouted = (path: string) => {
  const p = path.replace(/^\/|\/$/g, '');
  return p === '' || routes.includes(`route('${p}',`);
};

const indexed = new Set(BLOG_POSTS.map((p) => p.slug));
assert.equal(indexed.size, BLOG_POSTS.length, 'BLOG_POSTS lists a slug twice');
for (const slug of indexed) assert.ok(routedPosts.has(slug), `BLOG_POSTS '${slug}' has no route('resources/${slug}', ...)`);
for (const slug of routedPosts) assert.ok(indexed.has(slug), `/resources/${slug} is routed but missing from BLOG_POSTS (it would never appear on /resources)`);

const inLibrary = new Set<string>();
for (const entry of LIBRARY) {
  assert.ok(indexed.has(entry.slug), `library entry '${entry.slug}' is not in BLOG_POSTS`);
  assert.ok(!inLibrary.has(entry.slug), `library entry '${entry.slug}' listed twice`);
  inLibrary.add(entry.slug);
  if (entry.pillar) {
    assert.ok(EDITORIAL_REVIEWS.some((r) => r.slug === entry.slug), `pillar '${entry.slug}' needs an owner review in editorialReviews.ts`);
  }
}

for (const section of LIBRARY_SECTIONS) {
  const count = LIBRARY.filter((e) => e.section === section.slug).length;
  assert.ok(count >= MIN_PER_SECTION, `library section '${section.slug}' has ${count} guides (min ${MIN_PER_SECTION})`);
  for (const s of section.services) assert.ok(isRouted(s.to), `library section '${section.slug}' links ${s.to}, which is not a route`);
}

const today = new Date().toISOString().slice(0, 10);
const reviewed = new Set<string>();
for (const r of EDITORIAL_REVIEWS) {
  assert.ok(routedPosts.has(r.slug), `review '${r.slug}' is not a routed post`);
  assert.ok(!reviewed.has(r.slug), `review '${r.slug}' listed twice`);
  reviewed.add(r.slug);
  assert.match(r.reviewedOn, /^\d{4}-\d{2}-\d{2}$/, `review '${r.slug}': reviewedOn must be YYYY-MM-DD`);
  assert.ok(r.reviewedOn <= today, `review '${r.slug}': reviewedOn ${r.reviewedOn} is in the future`);
  assert.ok(r.source.trim().length >= 8, `review '${r.slug}': record where the review happened in source`);
}
for (const slug of AUTHORED_BY_FOUNDER) assert.ok(routedPosts.has(slug), `AUTHORED_BY_FOUNDER '${slug}' is not a routed post`);

console.log(`LIBRARY OK — ${LIBRARY_SECTIONS.length} sections, ${LIBRARY.length}/${BLOG_POSTS.length} posts mapped, ${EDITORIAL_REVIEWS.length} owner reviews, ${AUTHORED_BY_FOUNDER.size} founder-written.`);
