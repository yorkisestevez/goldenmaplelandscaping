/**
 * Card-sized variants of the estimator's project-type pictures (step 1 cards, step 2 Full Backyard picks).
 *
 *   npx tsx scripts/build-estimator-card-variants.ts          # write any missing variant
 *   npx tsx scripts/build-estimator-card-variants.ts --check  # lint gate: every variant exists, is 4:3 at its width,
 *                                                             # and stays under its ceiling
 *
 * Why: the cards draw at most 417 CSS px wide, but phones fetched all eleven 960–1200px masters (about 2.1 MB) from
 * the prerendered HTML while the page's JavaScript was still loading. Each master in PROJECT_TYPE_IMAGES is
 * re-encoded at PROJECT_CARD_WIDTHS and TypeThumb serves them through srcset: same picture, same centred 4:3 crop.
 *
 * netlify.toml serves /images/* immutable for a year, so an existing variant is never rewritten. A replacement
 * picture gets a new versioned master, and its variants follow the master's name.
 */
import sharp from 'sharp';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_CARD_WIDTHS, PROJECT_TYPE_IMAGES, projectCardVariant } from '../src/data/estimatorImages.ts';

const PUBLIC = join(import.meta.dirname, '..', 'public');
const QUALITY = 78; // same as the portfolio cards (build-portfolio-images.mjs)
const EFFORT = 5;
/** A variant over its ceiling means a wrong master or a botched encode; the 960 one serves only tablets and HiDPI. */
const CEILING_KB: Record<(typeof PROJECT_CARD_WIDTHS)[number], number> = { 320: 30, 480: 60, 640: 100, 960: 240 };

const checkOnly = process.argv.includes('--check');
const problems: string[] = [];
let written = 0;
let verified = 0;

for (const { src: master } of Object.values(PROJECT_TYPE_IMAGES)) {
  const masterFile = join(PUBLIC, master);
  if (!existsSync(masterFile)) {
    problems.push(`master missing: ${master}`);
    continue;
  }
  for (const width of PROJECT_CARD_WIDTHS) {
    const url = projectCardVariant(master, width);
    const file = join(PUBLIC, url);
    const height = (width * 3) / 4;
    if (!existsSync(file)) {
      if (checkOnly) {
        problems.push(`missing ${url} (run: npx tsx scripts/build-estimator-card-variants.ts)`);
        continue;
      }
      await sharp(masterFile).resize(width, height, { fit: 'cover' }).webp({ quality: QUALITY, effort: EFFORT }).toFile(file);
      written++;
    }
    const { width: w, height: h } = await sharp(file).metadata();
    const kb = Math.round(statSync(file).size / 1024);
    if (w !== width || h !== height) problems.push(`${url} is ${w}x${h}, expected ${width}x${height}`);
    else if (kb > CEILING_KB[width]) problems.push(`${url} is ${kb} KB, ceiling ${CEILING_KB[width]} KB`);
    else verified++;
  }
}

if (problems.length) {
  console.error(`estimator card variants: ${problems.length} problem(s)`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`estimator card variants: ok (${verified} variants${written ? `, ${written} written` : ''})`);
