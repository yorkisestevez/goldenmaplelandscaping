/**
 * Confirm the four production tracker ids survived the build.
 *
 *   node scripts/check-analytics-ids.mjs --dir build/client
 *   node scripts/check-analytics-ids.mjs --url https://goldenmaplelandscaping.ca/
 *
 * --dir reads every HTML and JS file in the directory, including chunks the
 * homepage does not link. --url starts at the page, then follows /assets/*.js
 * references inside each bundle, because Clarity and the Meta Pixel are loaded
 * from a chunk the homepage HTML no longer mentions. Exits 1 when any id is
 * missing. Prints `MISSING:` plus the absent names.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const IDS = [
  ['GA4', 'G-1BRTV91W3Z'],
  ['Clarity', 'wisgcj7yvw'],
  ['MetaPixel', '2084193635490617'],
  ['GoogleAds', 'AW-10839158941'],
];

const assetPath = /\/?assets\/[A-Za-z0-9._-]+\.js/g;

function missingFrom(text) {
  return IDS.filter(([, id]) => !text.includes(id)).map(([name]) => name);
}

function walk(dir) {
  let text = '';
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) text += walk(path);
    else if (/\.(html|js|mjs)$/.test(name)) text += readFileSync(path, 'utf8');
  }
  return text;
}

function referencedAssets(source) {
  const found = new Set();
  for (const match of source.matchAll(assetPath)) {
    const path = match[0].startsWith('/') ? match[0] : `/${match[0]}`;
    found.add(path);
  }
  return [...found];
}

async function crawl(startUrl) {
  const origin = new URL(startUrl).origin;
  const html = await fetch(startUrl).then((res) => {
    if (!res.ok) throw new Error(`homepage ${res.status}`);
    return res.text();
  });
  const queue = referencedAssets(html);
  const seen = new Set();
  let text = html;
  while (queue.length && missingFrom(text).length) {
    const path = queue.shift();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const res = await fetch(origin + path);
    if (!res.ok) continue;
    const body = await res.text();
    text += body;
    for (const next of referencedAssets(body)) queue.push(next);
  }
  return { text, bundles: seen.size };
}

const dirFlag = process.argv.indexOf('--dir');
const urlFlag = process.argv.indexOf('--url');

let text = '';
let where = '';
if (dirFlag !== -1) {
  const dir = process.argv[dirFlag + 1];
  text = walk(dir);
  where = dir;
} else if (urlFlag !== -1) {
  const crawled = await crawl(process.argv[urlFlag + 1]);
  text = crawled.text;
  where = `${crawled.bundles} bundles`;
} else {
  console.error('Pass --dir <build> or --url <origin>');
  process.exit(1);
}

const missing = missingFrom(text);
if (missing.length) {
  console.error(`MISSING: ${missing.join(' ')} (${where})`);
  process.exit(1);
}
console.log(`Analytics ids OK — GA4 + Clarity + Pixel + Ads (${where})`);
