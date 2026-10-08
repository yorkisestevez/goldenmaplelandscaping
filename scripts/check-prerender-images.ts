/**
 * Postbuild: every /images/... URL in a prerendered <img>, srcset, or image
 * preload must exist in the build output. The homepage hero is the LCP image
 * and is preloaded, so its flat variants are required by name.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { HERO_DEPTH } from '../src/data/heroDepth.ts';

const ROOT = join(import.meta.dirname, '..');
const CLIENT = join(ROOT, 'build/client');

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (name.endsWith('.html')) yield p;
  }
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    out[m[1].toLowerCase()] = decode(m[3] ?? m[2] ?? '');
  }
  return out;
}

function fromSrcset(value: string): string[] {
  return value.split(',').flatMap((part) => {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length > 1 && /^\d+(?:\.\d+)?[wx]$/i.test(tokens[tokens.length - 1])) tokens.pop();
    const url = tokens.join(' ');
    return url ? [url] : [];
  });
}

function imageUrls(html: string): string[] {
  const urls: string[] = [];
  for (const m of html.matchAll(/<(img|source|link)\b[\s\S]*?>/gi)) {
    const tag = m[0];
    const a = attrs(tag);
    if (m[1].toLowerCase() === 'link') {
      const rel = (a.rel ?? '').toLowerCase().split(/\s+/);
      if (!rel.includes('preload')) continue;
      const as = (a.as ?? '').toLowerCase();
      if (as && as !== 'image') continue;
      if (a.href) urls.push(a.href);
      if (a.imagesrcset) urls.push(...fromSrcset(a.imagesrcset));
      continue;
    }
    if (a.src) urls.push(a.src);
    if (a.srcset) urls.push(...fromSrcset(a.srcset));
  }
  return urls;
}

/** Root-relative /images/... path, or null when the URL is not a local image. */
function localImage(url: string): string | null {
  let path = url.trim();
  if (!path || path.startsWith('data:') || path.startsWith('blob:')) return null;
  try {
    path = decodeURI(path);
  } catch {
    return null;
  }
  path = path.split(/[?#]/)[0];
  const origin = 'https://goldenmaplelandscaping.ca';
  if (path.startsWith(origin)) path = path.slice(origin.length);
  if (!path.startsWith('/images/') || path.includes('..')) return null;
  return path;
}

function routeOf(file: string): string {
  const rel = file.slice(CLIENT.length).replace(/\\/g, '/');
  if (rel === '/index.html') return '/';
  if (rel.endsWith('/index.html')) return rel.slice(0, -'index.html'.length);
  return rel;
}

function heroUrls(): string[] {
  return [...new Set([HERO_DEPTH.flat.src, ...fromSrcset(HERO_DEPTH.flat.srcSet)])];
}

if (!existsSync(CLIENT)) {
  console.error('prerender image check: no build found (build/client)');
  process.exit(1);
}

const expectedHero = heroUrls();
const missing = new Map<string, string[]>();
const problems: string[] = [];
let refs = 0;
let pages = 0;
let sawHome = false;

for (const file of walk(CLIENT)) {
  pages++;
  const route = routeOf(file);
  const found = new Set<string>();
  for (const raw of imageUrls(readFileSync(file, 'utf8'))) {
    const path = localImage(raw);
    if (!path || found.has(path)) continue;
    found.add(path);
    refs++;
    if (!existsSync(join(CLIENT, path.slice(1)))) {
      const list = missing.get(path) ?? [];
      list.push(route);
      missing.set(path, list);
    }
  }
  if (route === '/') {
    sawHome = true;
    for (const url of expectedHero) {
      if (!found.has(url)) problems.push(`homepage hero missing ${url}`);
    }
  }
}

if (!sawHome) problems.push('homepage prerender (build/client/index.html) is missing');
for (const [rel, routes] of missing) {
  problems.push(`${rel}  ← ${[...new Set(routes)].join(', ')}`);
}

if (problems.length) {
  console.error(`prerender image check: ${problems.length} failure(s)`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`prerender image check: ok (${refs} /images refs across ${pages} pages, homepage hero present)`);
