/**
 * Builds the founder-image derivatives from ONE source photo, so the same face
 * ships on every page. See src/data/founder.ts for why that needed enforcing.
 *
 *   portrait — byte-copy of the source (home Manifesto + /about, 3:4 frame)
 *   avatar   — 192px square face crop (36 blog bios + schema Person.image)
 *
 * Fully local, $0 — sharp only. A third derivative (a transparent cutout for the
 * /about floating panel, via rembg u2net_human_seg) was built and then dropped on
 * 2026-08-27: the source is a tight head-and-shoulders crop, so the matte read as
 * a floating head with the body clipped at the frame edges. That is a photo
 * problem, not a matting one — a cutout needs a wider source, so don't re-add the
 * rembg step against this image.
 *
 *   node scripts/build-founder-images.mjs
 *
 * The -v1 suffix is cache-busting against netlify.toml's 1-year immutable
 * /images/* header — NEVER overwrite a versioned file in place. To change the
 * founder photo: drop the new SOURCE in, bump the version in OUT below and in
 * src/data/founder.ts, and rerun.
 */
import { copyFileSync } from 'node:fs';
import sharp from 'sharp';

const DIR = 'public/images/projects';
// Source master lives OUTSIDE public/ so it isn't shipped — same split as
// build-estimator-images.mjs (masters in 'pictures for website 2026',
// derivatives in public/images).
const SOURCE = 'pictures for website 2026/yorkis-founder-master.jpg';
const OUT = {
  portrait: `${DIR}/yorkis-founder-headshot-v1.jpg`,
  avatar: `${DIR}/yorkis-founder-avatar-v1.webp`,
};

// portrait — the source itself, renamed. Kebab-case matters: the old filename
// had a space, which forces %20 anywhere it lands in a schema/OG URL.
copyFileSync(SOURCE, OUT.portrait);
console.log('portrait ->', OUT.portrait);

// avatar — displayed at 64px; ship 3x. Square crop centred on the face so the
// circular mask doesn't cut the chin or leave dead headroom.
const { width, height } = await sharp(SOURCE).metadata();
const side = Math.min(1000, width, height - 90);
await sharp(SOURCE)
  .extract({ left: Math.round((width - side) / 2), top: 90, width: side, height: side })
  .resize(192, 192)
  .webp({ quality: 88, effort: 6 })
  .toFile(OUT.avatar);
console.log('avatar ->', OUT.avatar);
