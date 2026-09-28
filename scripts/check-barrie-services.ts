/**
 * Lint gate for the data-driven Barrie money pages (src/data/barrieServices.ts)
 * and the keyword -> owner-page map (docs/seo-authority/keyword-map.json).
 *
 * - every page's offering passes canPublish() (service confirmed by the owner)
 * - slugs end in -barrie and never collide with the service x town matrix
 * - each page is routed in src/routes.ts, exactly once
 * - title + H1 carry the page's primary keyword; titles are unique
 * - the keyword map names this page as the owner of a keyword, and the H1
 *   contains that keyword's h1Contains phrase
 * - every keyword-map owner is a routed page (one owner URL per keyword)
 * - FAQ questions aren't duplicated across pages (one answer set per entity)
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canPublish } from '../src/data/business.ts';
import { BARRIE_SERVICES } from '../src/data/barrieServices.ts';
import { HAND_BUILT_COMBOS, getAutoCombos } from '../src/data/serviceLocations.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const routes = readFileSync(join(ROOT, 'src/routes.ts'), 'utf8');
const keywordMap = JSON.parse(readFileSync(join(ROOT, 'docs/seo-authority/keyword-map.json'), 'utf8')) as {
  keywords: { keyword: string; owner: string; h1Contains: string | null }[];
};

const matrixSlugs = new Set([...getAutoCombos().map((c) => c.slug), ...HAND_BUILT_COMBOS]);
const titles = new Set<string>();
const questions = new Map<string, string>();
const lower = (s: string) => s.toLowerCase();

for (const def of BARRIE_SERVICES) {
  const where = `barrieServices '${def.slug}'`;
  assert.ok(canPublish(def.offering), `${where}: offering "${def.offering.value}" is not confirmed — no page for a service the owner hasn't confirmed`);
  assert.match(def.slug, /^[a-z0-9-]+-barrie$/, `${where}: slug must be kebab-case ending in -barrie`);
  assert.ok(!matrixSlugs.has(def.slug), `${where}: collides with a service x town matrix slug`);

  const routeCount = routes.split(`route('services/${def.slug}',`).length - 1;
  assert.equal(routeCount, 1, `${where}: expected exactly one route('services/${def.slug}', ...) in src/routes.ts, found ${routeCount}`);

  assert.ok(lower(def.title).includes(lower(def.primaryKeyword)), `${where}: title must contain "${def.primaryKeyword}"`);
  assert.ok(lower(def.h1).includes(lower(def.primaryKeyword)), `${where}: H1 must contain "${def.primaryKeyword}"`);
  assert.ok(lower(def.h1).includes('barrie'), `${where}: H1 must name Barrie`);
  assert.ok(!titles.has(lower(def.title)), `${where}: duplicate title`);
  titles.add(lower(def.title));
  assert.ok(def.description.length <= 170, `${where}: meta description is ${def.description.length} chars (keep <= 170)`);

  const owned = keywordMap.keywords.filter((k) => k.owner === `/services/${def.slug}/`);
  assert.ok(owned.length > 0, `${where}: no keyword in keyword-map.json names this page as its owner`);
  for (const k of owned) {
    if (k.h1Contains) assert.ok(lower(def.h1).includes(lower(k.h1Contains)), `${where}: H1 must contain "${k.h1Contains}" (keyword "${k.keyword}")`);
  }

  assert.ok(def.faqs.length >= 3, `${where}: at least 3 FAQs`);
  for (const f of def.faqs) {
    const prior = questions.get(lower(f.q));
    assert.ok(!prior, `${where}: FAQ "${f.q}" duplicates ${prior}`);
    questions.set(lower(f.q), def.slug);
  }
  for (const link of def.related) assert.match(link.to, /^\/[a-z0-9/-]*$/, `${where}: related link ${link.to} must be a site path`);
}

// Every keyword has exactly one owner, and that owner is a routed page.
const seen = new Set<string>();
for (const k of keywordMap.keywords) {
  assert.ok(!seen.has(lower(k.keyword)), `keyword-map: "${k.keyword}" listed twice`);
  seen.add(lower(k.keyword));
  assert.match(k.owner, /^\/([a-z0-9-]+\/)*$/, `keyword-map: owner ${k.owner} must be a trailing-slash site path`);
  const path = k.owner.replace(/^\/|\/$/g, '');
  const routed = path === '' ? routes.includes("index('pages/Home.tsx')") : routes.includes(`route('${path}',`);
  assert.ok(routed, `keyword-map: owner ${k.owner} for "${k.keyword}" is not a route in src/routes.ts`);
}

console.log(`BARRIE SERVICES OK — ${BARRIE_SERVICES.length} money pages, ${keywordMap.keywords.length} keyword owners routed, no matrix collisions.`);
