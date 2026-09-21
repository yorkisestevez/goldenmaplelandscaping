/**
 * Harvest the company's OWN photos from Meta into a local masters folder so they can be
 * attested and added to the portfolio register (scripts/portfolio-sources.mjs).
 *
 *   node scripts/photos/harvest-meta-photos.mjs              # download new photos + write index + contact sheets
 *   node scripts/photos/harvest-meta-photos.mjs --dry-run    # list only
 *   node scripts/photos/harvest-meta-photos.mjs --sheets     # rebuild contact sheets from what is on disk
 *
 * Sources (read-only Graph calls, token resolved in memory — see fetch-top-posts.mjs):
 *   - Facebook Page 109458021233747  /photos?type=uploaded   (largest rendition)
 *   - Instagram 17841447335950775    /media  IMAGE + every CAROUSEL child, all-time
 *
 * Output (gitignored except the index):
 *   sources/meta/<fb|ig>-<id>.jpg           full-size masters, re-downloadable by id
 *   sources/meta/index.json                 id, source, date, caption, dims, dhash, dupOf
 *   docs/portfolio/meta-sheet-<date>-<n>.jpg numbered review grids (40 per sheet)
 *
 * Near-duplicates (same photo re-posted, or already in the register) are detected with a
 * 9x8 difference hash and flagged `dupOf`, never deleted. Nothing here touches the register.
 */

import sharp from 'sharp';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES } from '../portfolio-sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(ROOT, 'sources/meta');
const INDEX = join(OUT_DIR, 'index.json');
const SHEET_DIR = join(ROOT, 'docs/portfolio');
const PAGE_ID = '109458021233747';
const IG_USER_ID = '17841447335950775';
const GRAPH = 'https://graph.facebook.com/v21.0';
const REGISTRY = process.env.META_TOKEN_REGISTRY ?? 'C:/Users/yorki/Hermes Agent/skills/_lib/meta-token-registry.js';
const MIN_EDGE = 640; // skip tiny thumbnails / profile pictures
const DUP_DISTANCE = 6;

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const DRY = flag('dry-run');

const redact = (s) => String(s).replace(/access_token=[^&\s"']+/gi, 'access_token=***').replace(/EAA[A-Za-z0-9]{20,}/g, 'EAA***');
const die = (msg) => { console.error(redact(msg)); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function resolveToken() {
  try {
    const { loadToken } = createRequire(import.meta.url)(REGISTRY);
    const r = loadToken({ slot: 'golden-maple' });
    console.log(`token: registry slot golden-maple (sha12 ${r.fingerprint?.sha12 ?? '?'})`);
    return r.token;
  } catch (e) {
    if (process.env.META_USER_LONG_TOKEN_GOLDEN_MAPLE) return process.env.META_USER_LONG_TOKEN_GOLDEN_MAPLE;
    die(`no token: ${e.message}`);
  }
}

async function graph(token, path, params = {}) {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    if (!res) { await sleep(500 * 2 ** attempt); continue; }
    const body = await res.json().catch(() => ({}));
    if (res.ok) return body;
    if (res.status >= 500) { await sleep(500 * 2 ** attempt); continue; }
    die(`Graph ${res.status} on ${path}: ${body?.error?.message ?? ''}`);
  }
  die(`Graph failed after retries on ${path}`);
}

async function paged(token, path, params, cap = 20) {
  const items = [];
  let p = path, q = params;
  for (let i = 0; i < cap; i++) {
    const body = await graph(token, p, q);
    items.push(...(body.data ?? []));
    const next = body.paging?.next;
    if (!next) break;
    const u = new URL(next);
    u.searchParams.delete('access_token');
    p = u.pathname.replace(/^\/v\d+\.\d+/, '');
    q = Object.fromEntries(u.searchParams.entries());
  }
  return items;
}

async function download(url) {
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

/** 9x8 difference hash → 64-bit hex string. */
async function dhash(input) {
  const { data } = await sharp(input).rotate().grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += data[y * 9 + x] < data[y * 9 + x + 1] ? '1' : '0';
  return BigInt('0b' + bits).toString(16).padStart(16, '0');
}
function hamming(a, b) {
  let x = BigInt('0x' + a) ^ BigInt('0x' + b), n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}

const clean = (s = '') => s.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

// ── main ─────────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
const index = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : { harvestedAt: null, items: [] };
const known = new Map(index.items.map((i) => [i.id, i]));

if (!flag('sheets')) {
  const token = resolveToken();

  // Page token for /photos (page edges need it).
  const accounts = await graph(token, '/me/accounts', { fields: 'id,name,access_token' });
  const page = (accounts.data ?? []).find((p) => p.id === PAGE_ID);
  if (!page) die(`page ${PAGE_ID} not in /me/accounts`);

  const fbPhotos = await paged(page.access_token, `/${PAGE_ID}/photos`, { type: 'uploaded', fields: 'id,created_time,name,width,height,images,link', limit: '100' });
  const igMedia = await paged(token, `/${IG_USER_ID}/media`, { fields: 'id,caption,media_type,media_url,permalink,timestamp,children{id,media_type,media_url}', limit: '50' });

  const candidates = [];
  for (const p of fbPhotos) {
    const best = (p.images ?? []).sort((a, b) => b.width - a.width)[0];
    if (!best || Math.max(p.width, p.height) < MIN_EDGE) continue;
    candidates.push({ id: `fb-${p.id}`, source: 'facebook-page', date: p.created_time.slice(0, 10), caption: clean(p.name).slice(0, 200), url: best.source, permalink: p.link ?? `https://www.facebook.com/${p.id}`, width: p.width, height: p.height });
  }
  for (const m of igMedia) {
    const frames = m.media_type === 'IMAGE' ? [{ id: m.id, media_url: m.media_url }]
      : m.media_type === 'CAROUSEL_ALBUM' ? (m.children?.data ?? []).filter((c) => c.media_type === 'IMAGE') : [];
    frames.forEach((f, i) => candidates.push({ id: `ig-${f.id}`, source: 'instagram', date: m.timestamp.slice(0, 10), caption: clean(m.caption).slice(0, 200), url: f.media_url, permalink: m.permalink, postId: m.id, frame: i + 1 }));
  }
  console.log(`candidates: ${candidates.length} (facebook ${candidates.filter((c) => c.source === 'facebook-page').length}, instagram ${candidates.filter((c) => c.source === 'instagram').length})`);

  let downloaded = 0;
  for (const c of candidates) {
    const file = join(OUT_DIR, `${c.id}.jpg`);
    const entry = known.get(c.id) ?? { ...c };
    delete entry.url;
    if (!existsSync(file)) {
      if (DRY) { console.log(`  would download ${c.id}  ${c.date}  ${c.caption.slice(0, 50)}`); continue; }
      try {
        const buf = await download(c.url);
        await sharp(buf).rotate().jpeg({ quality: 92 }).toFile(file);
        downloaded++;
      } catch (e) { console.error(redact(`  skip ${c.id}: ${e.message}`)); continue; }
    }
    if (!entry.dhash) {
      const meta = await sharp(file).metadata();
      entry.width = meta.width; entry.height = meta.height;
      entry.dhash = await dhash(file);
    }
    known.set(c.id, entry);
  }
  console.log(`downloaded ${downloaded} new files`);
}

// ── near-duplicate pass: against the register masters and within the harvest ─
const registerHashes = [];
for (const s of SOURCES) {
  const abs = join(ROOT, s.master);
  if (existsSync(abs)) registerHashes.push({ id: s.id, hash: await dhash(abs) });
}
const items = [...known.values()].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
for (const it of items) {
  if (!it.dhash) continue;
  it.dupOf = null;
  const reg = registerHashes.find((r) => hamming(r.hash, it.dhash) <= DUP_DISTANCE);
  if (reg) { it.dupOf = `register:${reg.id}`; continue; }
  const earlier = items.find((o) => o !== it && o.dhash && !o.dupOf && o.date <= it.date && hamming(o.dhash, it.dhash) <= DUP_DISTANCE && items.indexOf(o) > items.indexOf(it));
  if (earlier) it.dupOf = earlier.id;
}
const unique = items.filter((i) => !i.dupOf);
console.log(`index: ${items.length} photos, ${items.length - unique.length} near-duplicates flagged, ${unique.length} unique`);

if (!DRY) {
  const tmp = `${INDEX}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ harvestedAt: new Date().toISOString(), items }, null, 2)}\n`);
  renameSync(tmp, INDEX);
}

// ── contact sheets (unique only, numbered) ───────────────────────────────────
if (!DRY) {
  mkdirSync(SHEET_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const COLS = 5, TW = 300, TH = 225, PAD = 10, LABEL = 36, PER = 40;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const mdRows = [];
  for (let sheet = 0; sheet * PER < unique.length; sheet++) {
    const slice = unique.slice(sheet * PER, (sheet + 1) * PER);
    const tiles = [];
    for (let i = 0; i < slice.length; i++) {
      const it = slice[i];
      const n = sheet * PER + i + 1;
      it.n = n;
      const buf = await sharp(join(OUT_DIR, `${it.id}.jpg`)).resize(TW, TH, { fit: 'cover', position: 'attention' }).jpeg({ quality: 78 }).toBuffer();
      const label = Buffer.from(`<svg width="${TW}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1B2620"/><text x="6" y="14" font-family="Arial" font-size="12" fill="#F4EFE6" font-weight="bold">#${n}  ${it.source === 'instagram' ? 'IG' : 'FB'} ${it.date}  ${it.width}x${it.height}</text><text x="6" y="29" font-family="Arial" font-size="10" fill="#D4AF63">${esc(it.caption.slice(0, 48))}</text></svg>`);
      const tile = await sharp({ create: { width: TW, height: TH + LABEL, channels: 3, background: '#111' } }).composite([{ input: buf, top: 0, left: 0 }, { input: label, top: TH, left: 0 }]).jpeg().toBuffer();
      tiles.push({ input: tile, left: PAD + (i % COLS) * (TW + PAD), top: PAD + Math.floor(i / COLS) * (TH + LABEL + PAD) });
      mdRows.push(`| ${n} | ${it.id} | ${it.source} | ${it.date} | ${it.width}x${it.height} | ${it.caption.slice(0, 60).replace(/\|/g, '/')} |  |`);
    }
    const rows = Math.ceil(slice.length / COLS);
    const out = join(SHEET_DIR, `meta-sheet-${date}-${sheet + 1}.jpg`);
    await sharp({ create: { width: PAD + COLS * (TW + PAD), height: PAD + rows * (TH + LABEL + PAD), channels: 3, background: '#F3EEE3' } }).composite(tiles).jpeg({ quality: 80 }).toFile(out);
    console.log(`sheet ${sheet + 1}: ${basename(out)} (#${sheet * PER + 1}–#${sheet * PER + slice.length})`);
  }
  writeFileSync(join(SHEET_DIR, `meta-attestation-${date}.md`), [
    `# Meta photo harvest — ${date}`, '',
    `${unique.length} unique photos from the Facebook Page and Instagram account (near-duplicates hidden).`,
    'Mark each: GM job photographed by us (Y), or exclude (N) with a reason.', '',
    '| # | id | source | date | size | caption | Y/N + town |', '|---|---|---|---|---|---|---|', ...mdRows, '',
  ].join('\n'));
  writeFileSync(join(OUT_DIR, 'index.json'), `${JSON.stringify({ harvestedAt: new Date().toISOString(), items }, null, 2)}\n`);
}
