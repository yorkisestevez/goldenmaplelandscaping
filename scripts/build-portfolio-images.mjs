/**
 * Portfolio image builder.
 *
 *   node scripts/build-portfolio-images.mjs                 # build missing variants + write manifest
 *   node scripts/build-portfolio-images.mjs --check         # lint gate: manifest ⇔ disk ⇔ register (stat only, <1s)
 *   node scripts/build-portfolio-images.mjs --dry-run       # list what would be emitted / refused
 *   node scripts/build-portfolio-images.mjs --only=<id>     # build one source
 *   node scripts/build-portfolio-images.mjs --contact-sheet # numbered review grid for owner attestation
 *
 * Reads the allowlist in scripts/portfolio-sources.mjs and emits COMMITTED,
 * VERSIONED outputs:
 *
 *   public/images/portfolio/<id>-v<n>-card-{480,960,1440}.webp   4:3 crop (cards, grids)
 *   public/images/portfolio/<id>-v<n>-full-{640,1280,1920}.webp  native aspect (detail gallery, lightbox)
 *   src/data/portfolioManifest.json                             dimensions + srcsets + byte sizes
 *
 * Rules (same as build-estimator-images.mjs):
 *   - netlify.toml serves /images/* immutable for a YEAR. Existing files are never
 *     rewritten; to re-crop, bump `version` in the register.
 *   - Only sources with `attestedOn` are emitted. Nothing here scans a directory.
 *   - Masters are hashed; two sources with identical bytes hard-fail.
 */

import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXCLUDED, SOURCES } from './portfolio-sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public/images/portfolio');
const URL_PREFIX = '/images/portfolio';
const MANIFEST = join(ROOT, 'src/data/portfolioManifest.json');
const CONTACT_DIR = join(ROOT, 'docs/portfolio');

const CARD = { ratio: 4 / 3, widths: [480, 960, 1440], quality: 78 };
const FULL = { widths: [720, 1280, 1920], quality: 76 }; // longest edge, fit:'inside'
const WEBP_EFFORT = 5;
const CEILING = {
  'card-960': { warn: 160, fail: 250 },
  'card-1440': { warn: 260, fail: 400 },
  'full-1920': { warn: 320, fail: 650 }, // lightbox-only asset; most viewports pick the 1280 candidate
};

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const kb = (bytes) => Math.round(bytes / 1024);

const attested = SOURCES.filter((s) => typeof s.attestedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.attestedOn));
const unattested = SOURCES.filter((s) => !attested.includes(s));

const fileName = (s, kind, w) => `${s.id}-v${s.version}-${kind}-${w}.webp`;

function readManifest() {
  if (!existsSync(MANIFEST)) return {};
  return JSON.parse(readFileSync(MANIFEST, 'utf8'));
}

function writeManifestAtomic(manifest) {
  const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
  const tmp = `${MANIFEST}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(sorted, null, 2)}\n`);
  renameSync(tmp, MANIFEST);
}

function sha10(path) {
  return createHash('sha1').update(readFileSync(path)).digest('hex').slice(0, 10);
}

function fail(msg) {
  console.error(`  FAIL  ${msg}`);
  process.exitCode = 1;
}

// ── --check: stat-only consistency gate (runs inside `npm run lint`) ─────────
function check() {
  const manifest = readManifest();
  const problems = [];
  const knownIds = new Set(SOURCES.map((s) => s.id));

  for (const s of attested) {
    const entry = manifest[s.id];
    if (!entry) { problems.push(`${s.id}: attested in register but missing from manifest (run the builder)`); continue; }
    if (entry.version !== s.version) problems.push(`${s.id}: manifest version ${entry.version} ≠ register version ${s.version}`);
    if (entry.project !== s.project) problems.push(`${s.id}: manifest project ${entry.project} ≠ register ${s.project}`);
    for (const [k, size] of Object.entries(entry.bytes)) {
      const p = join(OUT_DIR, `${s.id}-v${entry.version}-${k}.webp`);
      if (!existsSync(p)) problems.push(`${s.id}: ${basename(p)} missing on disk`);
      else if (statSync(p).size !== size) problems.push(`${s.id}: ${basename(p)} is ${statSync(p).size} bytes, manifest says ${size} (re-encoded in place?)`);
    }
  }
  for (const id of Object.keys(manifest)) {
    const s = SOURCES.find((x) => x.id === id);
    if (!s) problems.push(`${id}: in manifest but not in register`);
    else if (!attested.includes(s)) problems.push(`${id}: in manifest but NOT attested in register`);
  }
  if (existsSync(OUT_DIR)) {
    for (const f of readdirSync(OUT_DIR)) {
      const m = /^(.+)-v(\d+)-(card|full)-(\d+)\.webp$/.exec(f);
      if (!m) { problems.push(`${f}: unexpected file in ${URL_PREFIX}`); continue; }
      if (!knownIds.has(m[1])) problems.push(`${f}: orphan (id not in register)`);
    }
  }
  const masterPaths = SOURCES.map((s) => s.master);
  for (const ex of Object.keys(EXCLUDED)) {
    if (masterPaths.includes(ex)) problems.push(`${ex}: listed in both SOURCES and EXCLUDED`);
  }

  if (problems.length) {
    console.error(`portfolio image check: ${problems.length} problem(s)`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`portfolio image check: ok (${attested.length} attested, ${Object.keys(manifest).length} in manifest, ${unattested.length} pending attestation)`);
}

// ── --contact-sheet: numbered review grid for the owner ──────────────────────
async function contactSheet() {
  mkdirSync(CONTACT_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const COLS = 4, TW = 420, TH = 315, PAD = 16, LABEL = 44;
  const tiles = [];
  const rows = [];
  let n = 0;
  for (const s of SOURCES) {
    const abs = join(ROOT, s.master);
    if (!existsSync(abs)) { fail(`${s.id}: master missing ${s.master}`); continue; }
    n += 1;
    const meta = await sharp(abs).rotate().metadata();
    const buf = await sharp(abs).rotate().resize(TW, TH, { fit: 'cover', position: 'attention' }).jpeg({ quality: 80 }).toBuffer();
    const status = s.attestedOn ? 'attested' : 'PENDING';
    const label = Buffer.from(`<svg width="${TW}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${s.attestedOn ? '#1B2620' : '#7A1F1F'}"/>
      <text x="8" y="17" font-family="Arial" font-size="13" fill="#F4EFE6" font-weight="bold">#${n}  ${s.id}</text>
      <text x="8" y="35" font-family="Arial" font-size="11" fill="#D4AF63">${escapeXml(basename(s.master))} · ${meta.width}x${meta.height} · ${status}</text>
    </svg>`);
    const tile = await sharp({ create: { width: TW, height: TH + LABEL, channels: 3, background: '#111' } })
      .composite([{ input: buf, top: 0, left: 0 }, { input: label, top: TH, left: 0 }])
      .jpeg({ quality: 85 }).toBuffer();
    const i = n - 1;
    tiles.push({ input: tile, left: PAD + (i % COLS) * (TW + PAD), top: PAD + Math.floor(i / COLS) * (TH + LABEL + PAD) });
    rows.push(`| ${n} | \`${s.master}\` | ${s.project} | ${s.id} | ${meta.width}x${meta.height} | ${status} |  |  |  |`);
  }
  const rowsCount = Math.ceil(tiles.length / COLS);
  const W = PAD + COLS * (TW + PAD);
  const H = PAD + rowsCount * (TH + LABEL + PAD);
  const outJpg = join(CONTACT_DIR, `contact-sheet-${date}.jpg`);
  await sharp({ create: { width: W, height: H, channels: 3, background: '#F3EEE3' } }).composite(tiles).jpeg({ quality: 82 }).toFile(outJpg);

  const md = [
    `# Portfolio photo attestation — ${date}`,
    '',
    'Review `contact-sheet-' + date + '.jpg`. For each row confirm: is this a Golden Maple job, photographed by us (camera/drone, not a render)? Which town?',
    'Rows marked PENDING are not published until this is answered and `attestedOn` is set in `scripts/portfolio-sources.mjs`.',
    '',
    '| # | file | project | id | size | status | GM job? (Y/N) | camera photo? (Y/N) | town / notes |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '## Excluded from the portfolio (never published as our work)',
    '',
    ...Object.entries(EXCLUDED).map(([f, why]) => `- \`${f}\` — ${why}`),
    '',
  ].join('\n');
  writeFileSync(join(CONTACT_DIR, `attestation-${date}.md`), md);
  console.log(`contact sheet: ${outJpg} (${n} images, ${W}x${H})`);
  console.log(`attestation:   ${join(CONTACT_DIR, `attestation-${date}.md`)}`);
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Encode a NEW file, stepping quality down (−6 per pass, floor 58) until it is
 * under the hard ceiling for its variant. Only ever called for files that do
 * not exist yet, so the immutable-cache rule is preserved.
 */
async function encodeUnderCeiling(out, key, startQuality, pipelineAt) {
  const ceiling = CEILING[key]?.fail;
  let q = startQuality;
  for (;;) {
    await pipelineAt(q).toFile(out);
    if (!ceiling || kb(statSync(out).size) <= ceiling || q <= 58) return q;
    q -= 6;
  }
}

// ── build ────────────────────────────────────────────────────────────────────
async function build({ dryRun }) {
  mkdirSync(OUT_DIR, { recursive: true });
  const manifest = readManifest();
  const only = opt('only');
  const seenHash = new Map();

  for (const s of unattested) {
    console.log(`  skip  ${s.id}  (pending attestation${s.note ? `: ${s.note}` : ''})`);
    if (manifest[s.id]) { delete manifest[s.id]; console.log(`        removed ${s.id} from manifest`); }
  }

  for (const s of attested) {
    if (only && s.id !== only) continue;
    const abs = join(ROOT, s.master);
    if (!existsSync(abs)) { fail(`${s.id}: master missing ${s.master}`); continue; }
    const hash = sha10(abs);
    if (seenHash.has(hash)) { fail(`${s.id}: master is byte-identical to ${seenHash.get(hash)} (${s.master})`); continue; }
    seenHash.set(hash, s.id);

    const img = sharp(abs).rotate();
    const meta = await img.metadata();
    // sharp reports pre-rotation dimensions; swap for EXIF orientations 5-8.
    const rotated = meta.orientation && meta.orientation >= 5;
    const mw = rotated ? meta.height : meta.width;
    const mh = rotated ? meta.width : meta.height;

    const entry = { project: s.project, masterSha: hash, version: s.version, card: null, full: null, bytes: {} };
    const cardFiles = [], fullFiles = [];

    for (const w of CARD.widths) {
      const h = Math.round(w / CARD.ratio);
      const name = fileName(s, 'card', w);
      const out = join(OUT_DIR, name);
      if (!existsSync(out)) {
        if (dryRun) console.log(`  would  ${name}`);
        else await encodeUnderCeiling(out, `card-${w}`, CARD.quality, (q) => sharp(abs).rotate().resize(w, h, { fit: 'cover', position: s.cardPosition }).webp({ quality: q, effort: WEBP_EFFORT }));
      }
      if (!dryRun) { entry.bytes[`card-${w}`] = statSync(out).size; cardFiles.push({ name, w, h }); }
    }
    const longEdge = Math.max(mw, mh);
    for (const w of FULL.widths) {
      if (w > longEdge && fullFiles.length) break; // withoutEnlargement: stop once master is exhausted (always emit smallest)
      const name = fileName(s, 'full', w);
      const out = join(OUT_DIR, name);
      if (!existsSync(out)) {
        if (dryRun) console.log(`  would  ${name}`);
        else await encodeUnderCeiling(out, `full-${w}`, FULL.quality, (q) => sharp(abs).rotate().resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true }).webp({ quality: q, effort: WEBP_EFFORT }));
      }
      if (!dryRun) {
        const realMeta = await sharp(out).metadata();
        entry.bytes[`full-${w}`] = statSync(out).size;
        fullFiles.push({ name, w: realMeta.width, h: realMeta.height });
      }
    }
    if (dryRun) { console.log(`  ok     ${s.id}  ${mw}x${mh}  sha ${hash}`); continue; }

    const largestCard = cardFiles[1] ?? cardFiles[cardFiles.length - 1];
    const largestFull = fullFiles[fullFiles.length - 1];
    entry.card = {
      src: `${URL_PREFIX}/${largestCard.name}`,
      srcset: cardFiles.map((f) => `${URL_PREFIX}/${f.name} ${f.w}w`).join(', '),
      width: largestCard.w, height: largestCard.h,
    };
    entry.full = {
      src: `${URL_PREFIX}/${(fullFiles[1] ?? largestFull).name}`,
      srcset: fullFiles.map((f) => `${URL_PREFIX}/${f.name} ${f.w}w`).join(', '),
      width: largestFull.w, height: largestFull.h,
    };
    manifest[s.id] = entry;

    const notes = [];
    for (const [k, c] of Object.entries(CEILING)) {
      const size = entry.bytes[k];
      if (size == null) continue;
      if (kb(size) > c.fail) { fail(`${s.id}: ${k} is ${kb(size)} KB (> ${c.fail} KB)`); }
      else if (kb(size) > c.warn) notes.push(`WARN ${k} ${kb(size)} KB`);
    }
    const fullMaxKey = Object.keys(entry.bytes).filter((k) => k.startsWith('full-')).pop();
    console.log(`  ok     ${s.id}  ${mw}x${mh}  card-960 ${kb(entry.bytes['card-960'])} KB  ${fullMaxKey} ${kb(entry.bytes[fullMaxKey])} KB${notes.length ? '  ' + notes.join('; ') : ''}`);
  }

  if (!dryRun) {
    writeManifestAtomic(manifest);
    console.log(`manifest: ${Object.keys(manifest).length} images → ${MANIFEST}`);
  }
}

if (flag('check')) check();
else if (flag('contact-sheet')) await contactSheet();
else await build({ dryRun: flag('dry-run') });
