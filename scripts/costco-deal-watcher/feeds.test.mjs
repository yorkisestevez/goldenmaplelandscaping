import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDdgHtml, parseRssItems } from './feeds.mjs';
import { extractOntarioLocations, looksLikeCologneDeal } from './extract.mjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const warehouses = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'ontario-warehouses.json'), 'utf8')
);

describe('parseRssItems', () => {
  test('reads title link description', () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item>
        <title>Costco Barrie $99 cologne</title>
        <link>https://example.com/1</link>
        <description>In stock at warehouse 1258</description>
      </item>
    </channel></rss>`;
    const items = parseRssItems(xml, 'slickdeals');
    assert.equal(items.length, 1);
    assert.equal(items[0].title, 'Costco Barrie $99 cologne');
    assert.match(items[0].text, /1258/);
  });
});

describe('parseDdgHtml', () => {
  test('extracts Ontario Costco East snippet', () => {
    const html = `
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fcocoeast.ca%2Fontario">1780954 ASSORTED FRAGRANCES FOR MEN 99 99 - Costco East Fan Blog</a>
      <a class="result__snippet">ASSORTED FRAGRANCES FOR MEN $99.99 Previous article Costco weekend Sales Ontario, Quebec</a>
    `;
    const items = parseDdgHtml(html);
    assert.equal(items.length, 1);
    assert.equal(items[0].url, 'https://cocoeast.ca/ontario');
    assert.equal(looksLikeCologneDeal(items[0].text), true);
    const locs = extractOntarioLocations(
      'Costco Barrie still has the $99 cologne set in the fragrance aisle',
      warehouses
    );
    assert.ok(locs.some((l) => l.city === 'Barrie'));
  });
});
