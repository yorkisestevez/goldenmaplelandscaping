/**
 * Every public document title is unique, at most 60 characters, and names
 * Golden Maple at most once. composeTitle is what <SEO> renders, so a page
 * that already says the brand must not gain a second "| Golden Maple".
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BARRIE_SERVICES } from '../src/data/barrieServices';
import { BUSINESS } from '../src/data/business';
import { FOUNDER } from '../src/data/founder';
import { LIBRARY_SECTIONS } from '../src/data/library';
import { PROJECTS } from '../src/data/projects';
import { LOCATIONS, LOCATION_KEYS, SERVICES, SERVICE_KEYS } from '../src/data/serviceLocations';
import { composeTitle } from '../src/utils/seoText';

const siteName = BUSINESS.publicName.value;
const brandCount = (title: string) => title.match(/golden maple/gi)?.length ?? 0;
const titles: { where: string; composed: string }[] = [];
const add = (where: string, raw: string) => titles.push({ where, composed: composeTitle(raw, siteName) });

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

function openingTags(source: string, tag: string): string[] {
  return [...source.matchAll(new RegExp(`<${tag}\\b[\\s\\S]*?>`, 'g'))].map((match) => match[0]);
}

function literalAttr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`));
  return match?.[1];
}

for (const path of [...walk('src/pages'), ...walk('src/components')]) {
  const source = readFileSync(path, 'utf8');
  for (const tag of openingTags(source, 'SEO')) {
    const title = literalAttr(tag, 'title');
    if (title) add(`${path} ${title}`, title);
  }
  for (const tag of openingTags(source, 'BlogPostLayout')) {
    const title = literalAttr(tag, 'seoTitle');
    if (title) add(`${path} ${title}`, title);
  }
}

const serviceFile = readFileSync('src/pages/services/ServiceLocation.tsx', 'utf8');
const locationFile = readFileSync('src/pages/locations/LocationLanding.tsx', 'utf8');
assert(
  serviceFile.includes('${service.shortName} in ${location.name} | Premium ${service.name} | Golden Maple Landscaping'),
  'Service location title template changed; update this check',
);
assert(
  locationFile.includes('Premium Landscaping in ${location.name}, Ontario | Golden Maple Landscaping'),
  'Location title template changed; update this check',
);
for (const serviceKey of SERVICE_KEYS) {
  for (const locationKey of LOCATION_KEYS) {
    const service = SERVICES[serviceKey];
    const location = LOCATIONS[locationKey];
    add(
      `service ${serviceKey} ${locationKey}`,
      `${service.shortName} in ${location.name} | Premium ${service.name} | Golden Maple Landscaping`,
    );
  }
}
for (const locationKey of LOCATION_KEYS) {
  add(`location ${locationKey}`, `Premium Landscaping in ${LOCATIONS[locationKey].name}, Ontario | Golden Maple Landscaping`);
}
for (const service of BARRIE_SERVICES) add(`barrie ${service.slug}`, service.title);
for (const section of LIBRARY_SECTIONS) add(`library ${section.slug}`, `${section.h1} | Barrie & Simcoe County`);
add('author', `${FOUNDER.name}, ${FOUNDER.role}`);
for (const project of PROJECTS) add(`project ${project.slug}`, `${project.title} in ${project.town}`);
const seen = new Map<string, string>();
for (const { where, composed } of titles) {
  assert(composed.length <= 60, `${where}: title is ${composed.length} characters (${composed})`);
  assert(brandCount(composed) <= 1, `${where}: brand is repeated (${composed})`);
  const prior = seen.get(composed);
  assert(!prior, `Duplicate title "${composed}" from ${prior} and ${where}`);
  seen.set(composed, where);
}

const about = composeTitle('About Golden Maple Landscaping | Barrie ON', siteName);
const contact = composeTitle('Contact Golden Maple | Patios, Walls & Decks in Barrie', siteName);
const reviews = composeTitle('Google Reviews | Golden Maple Landscaping Barrie', siteName);
assert.equal(brandCount(about), 1, about);
assert.equal(brandCount(contact), 1, contact);
assert.equal(brandCount(reviews), 1, reviews);
assert.notEqual(about, contact);
assert.notEqual(contact, reviews);
assert(titles.length > 40, `Expected the public pages, found ${titles.length} titles`);
console.log(`PAGE TITLES OK — ${titles.length} titles, each unique, one brand, at most 60 characters.`);
