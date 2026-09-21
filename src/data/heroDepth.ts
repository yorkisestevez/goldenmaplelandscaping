/**
 * The home hero picture and its three depth layers.
 *
 * Generated design inspiration, deliberately separate from completed-project
 * photography — it lives under /images/concepts/, never /images/portfolio/, and
 * is captioned as a concept. Do not reference it from a project page.
 *
 * Built by two local scripts, in order (both $0, no API):
 *   python scripts/upscale-hero-master.py
 *   python scripts/build-hero-depth-layers.py
 *     --source "pictures for website 2026/hero-backyard-master-up.png"
 *     --near 0.34 --mid 0.045
 *     --far-poly  "0.60,0 1,0 1,0.350 0.757,0.438 0.60,0.438"
 *     --near-poly "0,0.5 0.52,0.5 0.52,1 0,1" --near-foliage
 *
 * Every flag is specific to THIS picture — re-check with --preview whenever it
 * changes. The rule behind all of them: a layer cut may only go AROUND discrete
 * objects. Anything that recedes continuously (the patio floor, a wall running
 * away from the camera) tears where a cut crosses it, because the two halves
 * then scale at different rates.
 *   --mid 0.045   puts the far cut on the roofline and fence top, so the whole
 *     patio floor stays inside ONE layer. The automatic split lands mid-patio.
 *   --far-poly    the right-hand tree canopy reads exactly as near as the fence
 *     in front of it, so no threshold separates them. The polygon hands
 *     everything above that fence line to the far layer.
 *   --near-poly   keeps the near layer to the grass clump, bottom-left. The
 *     armour-stone wall is just as close but runs away from the camera, so it
 *     stays whole in the middle layer.
 *   --near-foliage mattes the grasses blade by blade on colour, and leaves the
 *     original grasses in the middle layer: doubled grass reads as denser grass,
 *     whereas a filled-in hole behind it read as white haze.
 *
 * The -v1 suffix is cache-busting against netlify.toml's 1-year immutable
 * /images/* header — never overwrite in place; bump VERSION in the build script
 * and here together.
 */

const BASE = '/images/concepts/backyard-hero-depth';
const VERSION = 'v1';
const WIDTHS = [1280, 1920, 2560] as const;

type LayerName = 'flat' | 'bg' | 'mid' | 'fg';

const layer = (name: LayerName) => ({
  src: `${BASE}-${name}-${VERSION}-1920.webp`,
  srcSet: WIDTHS.map((w) => `${BASE}-${name}-${VERSION}-${w}.webp ${w}w`).join(', '),
});

export const HERO_DEPTH = {
  alt: 'Outdoor living design concept: large-format paver patio with a charcoal border, cedar pergola, dining table and fire feature, framed by armour stone and ornamental grasses at golden hour',
  /** Mobile and reduced-motion hero: the untouched picture. */
  flat: layer('flat'),
  /** Far: sky, maples, the neighbouring roofline. */
  bg: layer('bg'),
  /** Middle: the house, pergola, fence, armour stone and the entire patio floor. */
  mid: layer('mid'),
  /** Near: the ornamental grass clump, matted blade by blade. */
  fg: layer('fg'),
  /**
   * The dining table, as a fraction of the picture. The push-in scales every
   * layer about this point, and the framed card is centred on it.
   */
  focal: { x: 0.55, y: 0.6 },
  width: 2752,
  height: 1536,
} as const;
