/**
 * Project choices use generated service concepts at the owner's request.
 * Each picture isolates its service; these are not completed-job photographs.
 * Manufacturer-specific material choices retain their actual product images.
 * Keep versioned assets immutable and increment the filename for replacements.
 */

export const PROJECT_TYPE_IMAGES: Record<string, { src: string; alt: string }> = {
  patio: { src: '/images/estimator/patio-concept-v2.webp', alt: 'Interlocking paver patio — illustrative concept' },
  stone: { src: '/images/estimator/stone-concept-v1.webp', alt: 'Natural flagstone paving — illustrative concept' },
  wall: { src: '/images/estimator/wall-concept-v1.webp', alt: 'Block retaining wall supporting a raised garden — illustrative concept' },
  steps: { src: '/images/estimator/steps-concept-v2.webp', alt: 'Stone steps and connecting walkway — illustrative concept' },
  deck: { src: '/images/estimator/deck-concept-v1.webp', alt: 'Composite deck surface and fascia — illustrative concept' },
  kitchen: { src: '/images/estimator/kitchen-concept-v1.webp', alt: 'Built-in outdoor grill and kitchen counter — illustrative concept' },
  firepit: { src: '/images/estimator/firepit-concept-v2.webp', alt: 'Circular stone fire pit — illustrative concept' },
  pergola: { src: '/images/estimator/pergola-concept-v1.webp', alt: 'Freestanding cedar pergola — illustrative concept' },
  turf: { src: '/images/estimator/turf-concept-v1.webp', alt: 'Artificial turf with a neatly finished edge — illustrative concept' },
  lighting: { src: '/images/estimator/lighting-concept-v1.webp', alt: 'Landscape path lights illuminating a garden at dusk — illustrative concept' },
  full: { src: '/images/estimator/full-concept-v1.webp', alt: 'Complete backyard with patio, deck, pergola and planting — illustrative concept' },
};

/** Deck brand card photographs (step 5 + workbench brand picker). */
export const DECK_BRAND_IMAGES: Record<string, { src: string; alt: string }> = {
  'timbertech-prime': {
    src: '/images/estimator/brand-timbertech-prime-card-v2.webp',
    alt: 'TimberTech AZEK Prime+ decking, Dark Cocoa',
  },
  'timbertech-vintage': {
    src: '/images/estimator/brand-timbertech-vintage-card-v2.webp',
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
