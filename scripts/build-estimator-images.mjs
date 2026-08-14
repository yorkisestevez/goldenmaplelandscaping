/**
 * One-off builder for the cost estimator's images. Run manually:
 *
 *   node scripts/build-estimator-images.mjs
 *
 * Reads full-res masters (git-tracked source folders + public/images/projects)
 * and emits COMMITTED, VERSIONED outputs:
 *
 *   public/images/estimator/<slug>-card-v1.webp   — 320px-wide card thumbs
 *   public/images/og/cost-estimator-v1.jpg        — 1200×630 social share card
 *
 * Why committed files instead of a runtime image CDN: identical behaviour in
 * `npm run dev` and production, no per-request dependency.
 *
 * Why the -v1 suffix is NON-NEGOTIABLE: netlify.toml serves /images/* with
 * `Cache-Control: public, max-age=31536000, immutable`. Replacing an image
 * in place serves the stale one for a YEAR. Any reprocess must bump to -v2
 * (and update src/data/estimatorImages.ts to match).
 *
 * Image policy (decided 2026-08-13): real Golden Maple job photos +
 * manufacturer dealer assets ONLY. No AI imagery on the estimator — it's the
 * site's highest-trust page and the ops watchdog tracks "0 AI on customer
 * pages" as a standing metric.
 */

import sharp from 'sharp';
import { mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_2026 = join(ROOT, 'pictures for website 2026');
const SRC_PROJECTS = join(ROOT, 'public/images/projects');
const OUT_CARDS = join(ROOT, 'public/images/estimator');
const OUT_OG = join(ROOT, 'public/images/og');

const VERSION = 'v1';
const CARD_WIDTH = 320;      // 2× the ~160px render slot
const CARD_HEIGHT = 240;     // 4:3 crop — consistent slot, no CLS
const CARD_QUALITY = 72;

/** slug → master file. Slugs match estimator project-type ids. */
const CARDS = [
  // Real Golden Maple job photos
  ['patio',   join(SRC_PROJECTS, 'patio-pergola.jpg')],
  ['wall',    join(SRC_2026, 'midhurst-garden-wall.png')],
  ['steps',   join(SRC_2026, 'stairs and patio.jpg')],
  ['turf',    join(SRC_2026, 'Orillia-patio-turf.jpg')],
  ['pergola', join(SRC_2026, 'IMG_3743.jpg')],
  ['full',    join(SRC_2026, 'MTGN8627.JPG')],
  // Manufacturer dealer assets
  ['deck',    join(SRC_PROJECTS, 'TimberTech_CoconutHusk_Decking_APVC_Beauty_Angle_03_MAIN_DECK_v2jpg1.jpg')],
  ['kitchen', join(SRC_PROJECTS, 'Permacon-approved.jpeg')],
  // Deck BRAND thumbs (step-5 / workbench brand cards)
  ['brand-timbertech-prime',   join(SRC_PROJECTS, 'TimberTech Dark Cocoa PrimeCollection Composite Decking Beauty1.jpg')],
  ['brand-timbertech-vintage', join(SRC_PROJECTS, 'TimberTech EnglishWalnut Vintage APVC Decking1791.jpg')],
  // stone / firepit / lighting: intentionally absent — no real GM photo yet.
];

mkdirSync(OUT_CARDS, { recursive: true });
mkdirSync(OUT_OG, { recursive: true });

const kb = p => Math.round(statSync(p).size / 1024);

let failures = 0;

for (const [slug, src] of CARDS) {
  if (!existsSync(src)) {
    console.error(`  MISSING SOURCE  ${slug}: ${src}`);
    failures++;
    continue;
  }
  const out = join(OUT_CARDS, `${slug}-card-${VERSION}.webp`);
  await sharp(src)
    .rotate() // respect EXIF orientation (phone photos)
    .resize(CARD_WIDTH, CARD_HEIGHT, { fit: 'cover', position: 'attention' })
    .webp({ quality: CARD_QUALITY })
    .toFile(out);
  const size = kb(out);
  console.log(`  ${size > 35 ? 'WARN >35KB' : 'ok'}  ${slug}-card-${VERSION}.webp  ${size} KB`);
  if (size > 60) failures++; // hard ceiling — something went wrong
}

// ── OG share card: 1200×630, real photo + dark gradient + text ─────────────
const OG_W = 1200, OG_H = 630;
const ogText = Buffer.from(`
<svg width="${OG_W}" height="${OG_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#0C120E" stop-opacity="0.94"/>
      <stop offset="0.55" stop-color="#0C120E" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#0C120E" stop-opacity="0.15"/>
    </linearGradient>
  </defs>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#shade)"/>
  <rect x="0" y="${OG_H - 6}" width="${OG_W}" height="6" fill="#D4AF63"/>
  <text x="72" y="440" font-family="Georgia, 'Times New Roman', serif" font-size="72"
        fill="#EEF2EC" font-weight="600">What will your backyard cost?</text>
  <text x="72" y="510" font-family="Arial, Helvetica, sans-serif" font-size="30"
        fill="#D4AF63" letter-spacing="2">FREE ESTIMATOR · REAL SIMCOE COUNTY PRICING · NO SIGNUP</text>
  <text x="72" y="566" font-family="Arial, Helvetica, sans-serif" font-size="24"
        fill="#9FB0A4">goldenmaplelandscaping.ca/cost-estimator</text>
</svg>`);

const ogOut = join(OUT_OG, `cost-estimator-${VERSION}.jpg`);
await sharp(join(SRC_PROJECTS, 'patio-pergola.jpg'))
  .rotate()
  .resize(OG_W, OG_H, { fit: 'cover', position: 'attention' })
  .composite([{ input: ogText, top: 0, left: 0 }])
  .jpeg({ quality: 78, mozjpeg: true })
  .toFile(ogOut);
console.log(`  ${kb(ogOut) > 200 ? 'WARN >200KB' : 'ok'}  og/cost-estimator-${VERSION}.jpg  ${kb(ogOut)} KB`);

console.log(failures === 0 ? 'DONE — commit the outputs.' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
