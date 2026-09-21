/**
 * Portfolio photo register — the ONLY way an image reaches /images/portfolio.
 *
 * This is an explicit allowlist, not a directory scan. Every entry records
 * provenance and an owner attestation date. `build-portfolio-images.mjs`
 * refuses to emit any source without `attestedOn`, and `--check` (run inside
 * `npm run lint`) fails if src/data/projects.ts references an unattested id.
 *
 * `BUSINESS.reviews.portfolio` / `.photoRights` in src/data/business.ts are
 * `confirmed` ONLY because this register exists. If you bypass it, revert them.
 *
 * Fields:
 *   id            manifest key; `<project>-<n>`; also the output filename stem
 *   project       project slug (must match src/data/projects.ts)
 *   master        path relative to repo root (git-tracked source folder)
 *   provenance    'owner-photo' — camera/drone photo taken on a Golden Maple job
 *   attestedBy    who confirmed it is a Golden Maple job photographed by the owner
 *   attestedOn    ISO date of that confirmation, or null (=> NOT emitted)
 *   cardPosition  sharp `position` for the 4:3 card crop ('attention' | 'south' | 'centre' ...)
 *   version       bump to re-crop; never overwrite an existing versioned file
 *                 (netlify.toml serves /images/* immutable for a year)
 */

const S26 = 'pictures for website 2026';
const REV = 'New website pictures 2026 revised';
const OWNER = 'Yorkis Estevez';
const ATTESTED = '2026-09-13';

const owned = (id, project, master, extra = {}) => ({
  id,
  project,
  master,
  provenance: 'owner-photo',
  attestedBy: OWNER,
  attestedOn: ATTESTED,
  cardPosition: 'attention',
  version: 1,
  ...extra,
});

export const SOURCES = [
  // Barrie bungalow — interlocking patio behind a brick bungalow
  owned('barrie-bungalow-patio-1', 'barrie-bungalow-patio', `${S26}/IMG_3743.jpg`),
  owned('barrie-bungalow-patio-2', 'barrie-bungalow-patio', `${S26}/Barrie1.jpeg`),

  // Midhurst front entrance — paver entrance, brick pillars, planting beds
  owned('midhurst-front-entrance-1', 'midhurst-front-entrance', `${S26}/midhurst ontario.jpg`),
  owned('midhurst-front-entrance-2', 'midhurst-front-entrance', `${S26}/IMG_7985.jpg`),

  // Barrie front entrance — slab walkway and steps (house number visible: crop from the bottom)
  owned('barrie-front-entrance-1', 'barrie-front-entrance', `${S26}/front-entrance-barrie.jpg`, { cardPosition: 'south' }),

  // Sloped backyard — retaining wall, steps and patio (one job, two crew-free angles)
  owned('sloped-backyard-patio-steps-1', 'sloped-backyard-patio-steps', `${S26}/patio-retaining-wall-steps.jpg`),
  owned('sloped-backyard-patio-steps-2', 'sloped-backyard-patio-steps', `${S26}/stairs and patio.jpg`),

  // Barrie diamond-inlay patio
  owned('barrie-diamond-inlay-patio-1', 'barrie-diamond-inlay-patio', `${S26}/IMG_4826.jpg`),

  // Deck and garden walkway (drone)
  owned('deck-and-garden-walkway-1', 'deck-and-garden-walkway', `${REV}/Golden Maple deck and walkway.jpg`),

  // Lakeside backyard (drone) — hot-tub deck and fire-pit seating
  owned('lakeside-backyard-1', 'lakeside-backyard', `${S26}/MTGN8627.JPG`),

  // Cobblestone driveway
  owned('cobblestone-driveway-1', 'cobblestone-driveway', `${REV}/paver-driveway.JPG`),

  // Cedar gazebo patio — owner confirmed 2026-09-13 (also posted on the company Instagram as "A Golden Maple Build")
  owned('gazebo-patio-1', 'gazebo-patio', `${REV}/patio-pergola.png`),

];

/** Files in the source folders that must NEVER be presented as Golden Maple work. */
export const EXCLUDED = {
  // AI / renders
  [`${S26}/ChatGPT Image Jan 5, 2026, 11_31_33 PM.png`]: 'ai',
  [`${S26}/Gemini_Generated_Image_olwe1solwe1solwe.png`]: 'ai',
  [`${S26}/Leigh.jpg`]: 'render',
  [`${REV}/luxury_simcoe_backyard_3d_render_1775169022603.png`]: 'ai',
  [`${REV}/oro_medonte_finished_estate_landscaping_1775169044031.png`]: 'ai',
  [`${REV}/rendering1.jpg`]: 'render',
  [`${REV}/Luxury Outdoor.jpeg`]: 'render',
  [`${REV}/Outdoor living life.jpeg`]: 'render',
  [`${REV}/cousy fire feature.jpeg`]: 'render',
  [`${REV}/luxury outdoor kitchen.jpeg`]: 'render',
  [`${REV}/small outdoor kitchen.jpeg`]: 'render',
  [`${REV}/WhatsApp Image 2026-03-20 at 8.12.25 PM.jpeg`]: 'render',
  [`${REV}/WhatsApp Image 2026-03-20 at 8.12.26 PM (3).jpeg`]: 'render',
  'public/images/projects/WhatsApp Image 2026-03-20 at 8.12.26 PM.jpeg': 'render',
  'public/images/projects/barrie-composite-deck.jpg': 'ai',
  'public/images/projects/barrie-firepit-patio.jpg': 'ai',
  'public/images/projects/barrie-walkway-entrance.jpg': 'ai',
  'public/images/projects/hero-barrie-patio.jpg': 'ai',
  'public/images/projects/composite-deck.jpg': 'ai',
  // Manufacturer / catalog assets (licensed dealer material, not GM jobs)
  [`${REV}/Silver Maple Radiance Rail 0101.jpg`]: 'manufacturer',
  [`${REV}/TimberTech Dark Cocoa PrimeCollection Composite Decking Beauty1.jpg`]: 'manufacturer',
  [`${REV}/TimberTech EnglishWalnut Vintage APVC Decking1791.jpg`]: 'manufacturer',
  [`${REV}/TimberTech Mahogany Vintage Collection AZEK Decking Beauty Shot 1731.jpg`]: 'manufacturer',
  [`${REV}/TimberTech-FrenchWhiteOak-AmericanWalnut-Matte-Espresso-CCS_0209-Stitch-2jpg1.jpg`]: 'manufacturer',
  [`${REV}/TimberTech-Landmark-CastleGate-Decking-Railing1_RT_1jpg1.jpg`]: 'manufacturer',
  [`${REV}/TimberTech_CoconutHusk_Decking_APVC_Beauty_Angle_03_MAIN_DECK_v2jpg1.jpg`]: 'manufacturer',
  [`${REV}/TimberTech_CoconutHusk_Decking_APVC_Beauty_Angle_08_MAIN_v2jpg1.jpg`]: 'manufacturer',
  [`${REV}/Timbertech Dark Roast Legacy Collection Composite Decking Beauty 1 21.jpg`]: 'manufacturer',
  [`${REV}/Timbertech-pro-logo.jpg`]: 'manufacturer',
  [`${REV}/Tt Legacy Espresso 96391.jpg`]: 'manufacturer',
  [`${REV}/Permacon-approved.jpeg`]: 'manufacturer',
  [`${REV}/IHPX8926.JPEG`]: 'manufacturer',
  [`${REV}/best.JPEG`]: 'manufacturer',
  [`${REV}/garden-wall.JPEG`]: 'manufacturer',
  [`${REV}/pool-deck-ideas.JPEG`]: 'manufacturer',
  [`${REV}/ABQI9355.JPEG`]: 'manufacturer',
  [`${REV}/covered patio.JPG`]: 'manufacturer',
  [`${REV}/composite deck.jpeg`]: 'manufacturer',
  [`${REV}/luxury decking.jpg`]: 'manufacturer',
  [`${REV}/decking1.jpg`]: 'manufacturer',
  // Owner review 2026-09-13: NOT confirmed as camera photos of Golden Maple jobs
  [`${S26}/midhurst-garden-wall.png`]: 'unconfirmed',
  [`${S26}/midhurst-walkway.png`]: 'unconfirmed',
  [`${REV}/orillia-walkway.png`]: 'unconfirmed',
  [`${REV}/Front-entrance-idea-pavers.JPG`]: 'unconfirmed',
  // Owner decision 2026-09-13: crew members visible — publish crew-free angles only
  [`${S26}/Orillia-patio-turf.jpg`]: 'crew-visible',
  [`${S26}/IMG_8058.jpg`]: 'crew-visible',
  [`${S26}/patio-steps-wall.jpg`]: 'crew-visible',
  // Duplicates / people
  [`${S26}/midhurst-landscaping-ontario.jpg`]: 'duplicate', // byte-identical to "midhurst ontario.jpg"
  [`${REV}/IMG_4826.jpg`]: 'duplicate', // same as pictures for website 2026/IMG_4826.jpg
  [`${S26}/yorkis-founder-master.jpg`]: 'reference', // founder portrait, owned by src/data/founder.ts
  [`${REV}/Yorkis Estevez.png`]: 'reference',
};
