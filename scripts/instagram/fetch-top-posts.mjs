/**
 * Instagram top-posts bake — runs LOCALLY on the operator's machine, never on Netlify.
 *
 *   node scripts/instagram/fetch-top-posts.mjs               # fetch, download, write JSON + webp
 *   node scripts/instagram/fetch-top-posts.mjs --dry-run     # print the ranking, write nothing
 *   node scripts/instagram/fetch-top-posts.mjs --keep-orphans
 *   node scripts/instagram/fetch-top-posts.mjs --expect-username=goldenmaplelandscaping.ca
 *
 * What it does
 *   1. Confirms the IG business account username (evidence for BUSINESS.urls.instagram).
 *   2. Pages /media for the last `windowDays`, keeps IMAGE + CAROUSEL_ALBUM (first IMAGE
 *      child), skips VIDEO, drops `excludeIds`, sorts by like_count desc, takes `topN`.
 *   3. Downloads each winner ONCE into public/images/instagram/<id>-v1-{480,960}.webp
 *      (Graph `media_url`s are short-lived signed CDN URLs — never persisted).
 *   4. Writes src/data/instagramFeed.json atomically. Any failure after ranking leaves
 *      the previous JSON byte-identical.
 *
 * Token handling
 *   Resolved in memory via the Hermes registry (`loadToken({ slot: 'golden-maple' })`)
 *   or env META_USER_LONG_TOKEN_GOLDEN_MAPLE. Sent as an Authorization header, never in
 *   a URL. Only a sha12 fingerprint is ever printed; every error string is redacted.
 *   `scripts/check-instagram-feed.ts` (in `npm run lint`) refuses to ship a JSON that
 *   contains anything token-shaped.
 *
 * Prune policy
 *   A post already in the JSON survives while it is still within the top N+3 ("sticky
 *   band") so rank-12/13 flapping does not churn files weekly. Outside the band its
 *   entry and its two webp files are removed — an unreferenced URL cannot serve stale
 *   bytes, so the immutable-cache rule (netlify.toml) is unaffected.
 *
 * Exit codes: 0 ok · 1 generic · 2 rate-limited (nothing written) · 3 no token · 4 username mismatch
 */

import sharp from 'sharp';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONFIG_PATH = join(ROOT, 'scripts/instagram/config.json');
const FEED_PATH = join(ROOT, 'src/data/instagramFeed.json');
const OUT_DIR = join(ROOT, 'public/images/instagram');
const URL_PREFIX = '/images/instagram';
const GRAPH = 'https://graph.facebook.com/v21.0';
const WIDTHS = [480, 960];
const VERSION = 'v1';
const STICKY_EXTRA = 3;
const MAX_PAGES = 20;
const REGISTRY = process.env.META_TOKEN_REGISTRY ?? 'C:/Users/yorki/Hermes Agent/skills/_lib/meta-token-registry.js';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const DRY = flag('dry-run');

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
const { igUserId, topN = 12, windowDays = 365, excludeIds = [] } = config;

// ── secrets hygiene ──────────────────────────────────────────────────────────
function redact(s) {
  return String(s)
    .replace(/access_token=[^&\s"']+/gi, 'access_token=***')
    .replace(/EAA[A-Za-z0-9]{20,}/g, 'EAA***')
    .replace(/Bearer\s+[A-Za-z0-9._-]{20,}/g, 'Bearer ***');
}
function die(code, msg) {
  console.error(redact(msg));
  process.exit(code);
}

function resolveToken() {
  const envVar = 'META_USER_LONG_TOKEN_GOLDEN_MAPLE';
  if (existsSync(REGISTRY)) {
    try {
      const { loadToken } = createRequire(import.meta.url)(REGISTRY);
      const r = loadToken({ slot: 'golden-maple' });
      return { token: r.token, label: `registry slot golden-maple (${r.source.split(':')[0]}, sha12 ${r.fingerprint?.sha12 ?? r.fingerprint})` };
    } catch (e) {
      if (!process.env[envVar]) die(3, `no token: ${e.message}`);
    }
  }
  if (process.env[envVar]) return { token: process.env[envVar], label: `env ${envVar}` };
  die(3, `no token: registry not found at ${REGISTRY} and $${envVar} unset`);
}

// ── Graph client ─────────────────────────────────────────────────────────────
async function graph(token, path, params = {}) {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
      lastErr = e;
      await sleep(500 * 2 ** attempt);
      continue;
    }
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 200) }; }
    if (res.ok) return body;
    const code = body?.error?.code;
    if (res.status === 429 || code === 4 || code === 17 || code === 32) die(2, `rate-limited by Graph (${res.status} code ${code}) — nothing written`);
    if (res.status >= 500) { lastErr = new Error(`${res.status} ${body?.error?.message ?? ''}`); await sleep(500 * 2 ** attempt); continue; }
    die(1, `Graph ${res.status} on ${path}: ${body?.error?.message ?? text.slice(0, 200)}`);
  }
  die(1, `Graph request failed after retries on ${path}: ${lastErr?.message}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWindow(token) {
  const since = Date.now() - windowDays * 86400_000;
  const fields = 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count,thumbnail_url,children{media_type,media_url}';
  const items = [];
  let path = `/${igUserId}/media`;
  let params = { fields, limit: '50' };
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await graph(token, path, params);
    let stop = false;
    for (const m of body.data ?? []) {
      if (Date.parse(m.timestamp) < since) { stop = true; break; }
      items.push(m);
    }
    const next = body.paging?.next;
    if (stop || !next) break;
    // paging.next carries the access_token in the query — strip it and re-send via header.
    const u = new URL(next);
    u.searchParams.delete('access_token');
    path = u.pathname.replace(/^\/v\d+\.\d+/, '');
    params = Object.fromEntries(u.searchParams.entries());
  }
  return items;
}

function pickImage(m) {
  if (m.media_type === 'IMAGE') return m.media_url;
  if (m.media_type === 'CAROUSEL_ALBUM') {
    const child = (m.children?.data ?? []).find((c) => c.media_type === 'IMAGE');
    return child?.media_url;
  }
  return undefined;
}

function cleanCaption(raw = '') {
  return raw
    .replace(/#[\p{L}\p{N}_]+/gu, '')
    .replace(/@[\p{L}\p{N}_.]+/gu, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 140)
    .trim();
}

function altFor(post, username) {
  const month = new Date(post.timestamp).toLocaleString('en-CA', { month: 'long', year: 'numeric', timeZone: 'America/Toronto' });
  const first = post.caption.split(/(?<=[.!?])\s/)[0]?.slice(0, 100).trim();
  return `Instagram post from ${username}, ${month}${first ? `: ${first}` : ''}`;
}

async function downloadBinary(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(400 * 2 ** attempt);
    }
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
const { token, label } = resolveToken();
console.log(`token: ${label}`);

const acct = await graph(token, `/${igUserId}`, { fields: 'id,username' });
console.log(`IG username confirmed: ${acct.username}`);
const expect = opt('expect-username');
if (expect && acct.username !== expect) die(4, `username mismatch: expected ${expect}, Graph says ${acct.username}`);

const raw = await fetchWindow(token);
const excluded = new Set(excludeIds.map(String));
const candidates = raw
  .filter((m) => m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM')
  .map((m) => ({ ...m, imageUrl: pickImage(m) }))
  .filter((m) => m.imageUrl && !excluded.has(String(m.id)))
  .sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0) || Date.parse(b.timestamp) - Date.parse(a.timestamp));

const previous = existsSync(FEED_PATH) ? JSON.parse(readFileSync(FEED_PATH, 'utf8')) : { posts: [] };
const prevIds = new Set((previous.posts ?? []).map((p) => p.id));
const stickyIds = new Set(candidates.slice(0, topN + STICKY_EXTRA).map((m) => String(m.id)));

// winners = top N by likes, but a previously published post inside the sticky band keeps its slot
const winners = [];
for (const m of candidates) {
  if (winners.length >= topN) break;
  winners.push(m);
}
const kept = candidates.filter((m) => prevIds.has(String(m.id)) && stickyIds.has(String(m.id)) && !winners.includes(m));
const selection = [...winners, ...kept].slice(0, topN + STICKY_EXTRA);
const selIds = new Set(selection.map((m) => String(m.id)));
const removed = [...prevIds].filter((id) => !selIds.has(id));
const added = selection.filter((m) => !prevIds.has(String(m.id))).map((m) => String(m.id));

console.log(`\nwindow: last ${windowDays} d · ${raw.length} media · ${candidates.length} photo candidates · top ${topN} (+${STICKY_EXTRA} sticky)`);
console.log('rank | id                | likes | cmts | type     | date       | on-disk | caption');
selection.forEach((m, i) => {
  const onDisk = WIDTHS.every((w) => existsSync(join(OUT_DIR, `${m.id}-${VERSION}-${w}.webp`)));
  console.log(`${String(i + 1).padStart(4)} | ${m.id} | ${String(m.like_count ?? 0).padStart(5)} | ${String(m.comments_count ?? 0).padStart(4)} | ${m.media_type.padEnd(8)} | ${m.timestamp.slice(0, 10)} | ${onDisk ? 'yes' : 'no '}     | ${cleanCaption(m.caption).slice(0, 60)}`);
});
console.log(`\nadd: ${added.length ? added.join(', ') : 'none'}\nremove: ${removed.length ? removed.join(', ') : 'none'}`);

if (DRY) { console.log('\n--dry-run: nothing written'); process.exit(0); }

mkdirSync(OUT_DIR, { recursive: true });
const posts = [];
let downloads = 0;
for (const m of selection) {
  const id = String(m.id);
  const files = WIDTHS.map((w) => ({ w, name: `${id}-${VERSION}-${w}.webp`, path: join(OUT_DIR, `${id}-${VERSION}-${w}.webp`) }));
  if (!files.every((f) => existsSync(f.path))) {
    let buf;
    try { buf = await downloadBinary(m.imageUrl); }
    catch (e) { console.error(redact(`  skip ${id}: download failed (${e.message})`)); continue; }
    for (const f of files) {
      if (existsSync(f.path)) continue; // never overwrite a served file
      await sharp(buf).rotate().resize({ width: f.w, height: f.w, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78, effort: 5 }).toFile(f.path);
    }
    downloads++;
  }
  const metas = await Promise.all(files.map((f) => sharp(f.path).metadata()));
  const largest = metas[metas.length - 1];
  const caption = cleanCaption(m.caption);
  posts.push({
    id,
    permalink: m.permalink,
    caption,
    likeCount: m.like_count ?? 0,
    commentsCount: m.comments_count ?? 0,
    timestamp: m.timestamp,
    mediaType: m.media_type,
    image: {
      src: `${URL_PREFIX}/${files[files.length - 1].name}`,
      srcSet: files.map((f, i) => `${URL_PREFIX}/${f.name} ${metas[i].width}w`).join(', '),
      width: largest.width,
      height: largest.height,
      alt: altFor({ ...m, caption }, acct.username),
    },
  });
}
if (posts.length === 0) die(1, 'no posts survived download — JSON left untouched');

const finalIds = new Set(posts.map((p) => p.id));
if (!flag('keep-orphans') && existsSync(OUT_DIR)) {
  for (const f of readdirSync(OUT_DIR)) {
    const m = /^(\d+)-v\d+-\d+\.webp$/.exec(f);
    if (m && !finalIds.has(m[1])) { unlinkSync(join(OUT_DIR, f)); console.log(`  pruned ${f}`); }
  }
}

const feed = {
  schemaVersion: 1,
  fetchedAt: new Date().toISOString(),
  account: { id: String(igUserId), username: acct.username, url: `https://www.instagram.com/${acct.username}` },
  window: { since: new Date(Date.now() - windowDays * 86400_000).toISOString().slice(0, 10), until: new Date().toISOString().slice(0, 10) },
  topN,
  posts: posts.slice(0, topN + STICKY_EXTRA),
};
const tmp = `${FEED_PATH}.tmp`;
writeFileSync(tmp, `${JSON.stringify(feed, null, 2)}\n`);
renameSync(tmp, FEED_PATH);
const total = readdirSync(OUT_DIR).reduce((n, f) => n + statSync(join(OUT_DIR, f)).size, 0);
console.log(`\nwrote ${feed.posts.length} posts → ${FEED_PATH}\n${downloads} downloads · ${Math.round(total / 1024)} KB in ${URL_PREFIX}`);
