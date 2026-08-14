/**
 * Which estimator choice gets which image — the single source of truth.
 *
 * Policy (locked 2026-08-13): real Golden Maple job photos + manufacturer
 * dealer assets ONLY. No AI imagery here — this is the site's highest-trust
 * page, and the ops watchdog tracks "0 AI on customer pages" as a standing
 * metric. A type with no honest photo keeps its icon; that absence is a
 * signal to go shoot the next stone / fire pit / lighting job, not to fake it.
 *
 * Files are produced by scripts/build-estimator-images.mjs. The -v1 suffix is
 * cache-busting against netlify.toml's 1-year immutable /images/* header —
 * NEVER overwrite a versioned file in place; regenerate as -v2 and update here.
 */

/** Card thumbs for project types (step 1 + full-backyard checklist). */
export const PROJECT_TYPE_IMAGES: Record<string, { src: string; alt: string }> = {
  patio: {
    src: '/images/estimator/patio-card-v1.webp',
    alt: 'Paver patio with cedar gazebo — Golden Maple project in Barrie',
  },
  wall: {
    src: '/images/estimator/wall-card-v1.webp',
    alt: 'Curved charcoal block garden wall — Golden Maple project in Midhurst',
  },
  steps: {
    src: '/images/estimator/steps-card-v1.webp',
    alt: 'Precast steps and slab walkway with dark border — Golden Maple project',
  },
  turf: {
    src: '/images/estimator/turf-card-v1.webp',
    alt: 'Artificial turf inlay framed in pavers — Golden Maple project in Orillia',
  },
  pergola: {
    src: '/images/estimator/pergola-card-v1.webp',
    alt: 'Shade pergola over a paver patio — Golden Maple project',
  },
  full: {
    src: '/images/estimator/full-card-v1.webp',
    alt: 'Aerial view of a completed Golden Maple backyard transformation',
  },
  deck: {
    src: '/images/estimator/deck-card-v1.webp',
    alt: 'TimberTech AZEK composite decking',
  },
  kitchen: {
    src: '/images/estimator/kitchen-card-v1.webp',
    alt: 'Outdoor kitchen with pergola on large-format pavers',
  },
  // stone, firepit, lighting: intentionally absent — icon renders instead.
};

/** Deck brand card thumbs (step 5 + workbench brand picker). */
export const DECK_BRAND_IMAGES: Record<string, { src: string; alt: string }> = {
  'timbertech-prime': {
    src: '/images/estimator/brand-timbertech-prime-card-v1.webp',
    alt: 'TimberTech AZEK Prime+ decking, Dark Cocoa',
  },
  'timbertech-vintage': {
    src: '/images/estimator/brand-timbertech-vintage-card-v1.webp',
    alt: 'TimberTech AZEK Vintage decking, English Walnut',
  },
};

/**
 * Paver swatches — EMPTY until Yorkis pulls product images for the 9 Permacon
 * SKUs from the dealer portal. When they land: run them through
 * build-estimator-images.mjs (add a SWATCHES list), fill this map keyed by
 * PaverBrand id, and the brand picker renders them with zero component changes.
 */
export const PAVER_SWATCHES: Record<string, { src: string; alt: string }> = {};
