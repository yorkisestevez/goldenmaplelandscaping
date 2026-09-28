/**
 * The Golden Maple Outdoor Construction Library — a topic map over the existing
 * /resources posts. It does not move any URL: /library/ and /library/<section>/
 * are hub pages that group posts and point at the matching money pages, so
 * search engines and AI crawlers see one organised body of construction
 * knowledge instead of a flat blog.
 *
 * Every slug must exist in src/data/blogPosts.ts and be routed
 * (scripts/check-library.ts, npm run lint). `pillar` marks a section's anchor
 * article and requires a recorded owner review (src/data/editorialReviews.ts).
 *
 * Side-effect-free: react-router.config.ts imports it to prerender the sections.
 */

export interface LibrarySection {
  slug: string;
  title: string;
  h1: string;
  description: string;
  intro: string;
  services: { label: string; to: string }[];
}

export const LIBRARY_SECTIONS = [
  {
    slug: 'patios',
    title: 'Patios & interlock',
    h1: 'Patio & Interlock Construction Library',
    description: 'How interlocking patios and walkways are built to last in Barrie: base, bedding, jointing, why patios sink, and what they cost.',
    intro: 'A patio is only as good as what is under it. These guides cover excavation, base and bedding, jointing sand, the warning signs of a failing patio, and what drives the price of interlock in Barrie.',
    services: [
      { label: 'Interlock contractor in Barrie', to: '/services/interlocking-barrie' },
      { label: 'Patio contractor in Barrie', to: '/patios-barrie' },
      { label: 'Porcelain patios in Barrie', to: '/services/porcelain-patios-barrie' },
      { label: 'Patio rebuilds in Barrie', to: '/premium-patio-rebuild-barrie' },
    ],
  },
  {
    slug: 'retaining-walls',
    title: 'Retaining walls',
    h1: 'Retaining Wall Construction Library',
    description: 'Retaining walls in Simcoe County: when a wall needs an engineer, geogrid and drainage, and what walls cost.',
    intro: 'Retaining walls fail from water pressure and poor reinforcement long before the block itself gives out. These guides cover wall types, drainage, geogrid, engineering triggers in Ontario, and pricing.',
    services: [
      { label: 'Retaining wall contractor in Barrie', to: '/services/retaining-walls-barrie' },
      { label: 'Sloped backyard landscaping in Barrie', to: '/sloped-backyard-solutions-barrie' },
    ],
  },
  {
    slug: 'driveways',
    title: 'Driveways',
    h1: 'Interlock Driveway Library',
    description: 'Interlock driveways in Ontario: how long they last, heated driveway systems, and what a driveway base has to handle.',
    intro: 'Driveways carry vehicles, plow blades and de-icing salt. These guides cover driveway lifespan, heated systems and what separates a driveway base from a patio base.',
    services: [
      { label: 'Interlock driveways in Barrie', to: '/services/interlocking-driveways-barrie' },
      { label: 'Front entrance landscaping in Barrie', to: '/services/front-entrance-landscaping-barrie' },
    ],
  },
  {
    slug: 'ontario-conditions',
    title: 'Ontario conditions',
    h1: 'Building for Ontario Soil, Water & Frost',
    description: 'Freeze-thaw, clay soil and drainage in Simcoe County: base materials, excavation, winter damage and wet-yard fixes.',
    intro: 'Most hardscape failures in Simcoe County trace back to three local conditions: water, frost and slow-draining soil. These guides explain base materials, excavation, drainage and winter protection.',
    services: [
      { label: 'Sloped backyard landscaping in Barrie', to: '/sloped-backyard-solutions-barrie' },
      { label: 'Landscape construction in Barrie', to: '/luxury-landscape-barrie' },
    ],
  },
  {
    slug: 'materials',
    title: 'Materials',
    h1: 'Hardscape & Decking Materials Library',
    description: 'Comparing pavers, natural stone, porcelain and composite decking for Ontario: brands, pool decks, maintenance.',
    intro: 'Material choice changes the look, the maintenance and how a surface handles an Ontario winter. These guides compare paver brands, natural stone, porcelain and composite decking.',
    services: [
      { label: 'Porcelain patios in Barrie', to: '/services/porcelain-patios-barrie' },
      { label: 'Composite deck builder in Barrie', to: '/services/composite-decking-barrie' },
      { label: 'Landscape designer in Barrie', to: '/services/landscape-design-barrie' },
    ],
  },
  {
    slug: 'planning',
    title: 'Planning, permits & costs',
    h1: 'Planning, Permits & Costs Library',
    description: 'Planning a Barrie landscaping project: costs, permits and bylaws, reading quotes, choosing a contractor and timing.',
    intro: 'Before anything is built: what projects cost, which ones need permits, how to read a quote, how to choose a contractor and when to start.',
    services: [
      { label: 'Backyard renovation in Barrie', to: '/full-backyard-transformations-barrie' },
      { label: 'Outdoor kitchens in Barrie', to: '/services/outdoor-kitchens-barrie' },
    ],
  },
] as const satisfies readonly LibrarySection[];

export type LibrarySectionSlug = (typeof LIBRARY_SECTIONS)[number]['slug'];

export interface LibraryEntry {
  slug: string;
  section: LibrarySectionSlug;
  /** Anchor article for its section — requires an EDITORIAL_REVIEWS entry. */
  pillar?: true;
}

export const LIBRARY: readonly LibraryEntry[] = [
  // Patios & interlock
  { slug: 'why-patios-sink-barrie', section: 'patios' },
  { slug: 'failing-interlocking-patio-signs-barrie', section: 'patios' },
  { slug: 'polymeric-sand-vs-regular-sand-patio', section: 'patios' },
  { slug: 'concrete-vs-interlocking-patio-barrie', section: 'patios' },
  { slug: 'interlocking-patio-cost-ontario', section: 'patios' },
  { slug: 'interlocking-cost-barrie', section: 'patios' },
  { slug: 'paver-walkway-cost-barrie', section: 'patios' },
  { slug: 'best-time-install-patio-ontario', section: 'patios' },
  // Retaining walls
  { slug: 'retaining-wall-guide-simcoe-county', section: 'retaining-walls' },
  { slug: 'retaining-wall-engineer-required-ontario', section: 'retaining-walls' },
  { slug: 'retaining-wall-cost-oro-medonte', section: 'retaining-walls' },
  // Driveways
  { slug: 'interlocking-driveway-lifespan-ontario', section: 'driveways' },
  { slug: 'heated-driveway-worth-it-barrie', section: 'driveways' },
  // Ontario conditions
  { slug: 'clear-stone-vs-granular-a-base', section: 'ontario-conditions' },
  { slug: 'backyard-drainage-solutions-barrie', section: 'ontario-conditions' },
  { slug: 'winter-damage-prevention-interlocking', section: 'ontario-conditions' },
  { slug: 'landscaper-quote-excavation-line-item', section: 'ontario-conditions' },
  // Materials
  { slug: 'unilock-vs-techo-bloc-vs-permacon', section: 'materials' },
  { slug: 'permacon-pavers-honest-review-2026', section: 'materials' },
  { slug: 'natural-stone-vs-pavers-barrie', section: 'materials' },
  { slug: 'pool-deck-materials-ontario', section: 'materials' },
  { slug: 'best-pavers-pool-deck-simcoe-county', section: 'materials' },
  { slug: 'timbertech-vs-wood-decking-ontario', section: 'materials' },
  { slug: 'composite-decking-maintenance-ontario', section: 'materials' },
  // Planning, permits & costs
  { slug: 'landscape-permits-barrie-simcoe', section: 'planning' },
  { slug: 'landscaping-cost-guide-barrie', section: 'planning' },
  { slug: 'hidden-costs-cheap-landscaping', section: 'planning' },
  { slug: 'how-to-choose-landscaping-contractor-barrie', section: 'planning' },
  { slug: 'backyard-renovation-roi-ontario', section: 'planning' },
  { slug: 'best-month-landscaping-project-barrie', section: 'planning' },
  { slug: 'fire-pit-regulations-barrie', section: 'planning' },
  { slug: 'fire-pit-cost-barrie-with-permits', section: 'planning' },
];

export function getLibrarySection(slug: string | undefined) {
  return LIBRARY_SECTIONS.find((s) => s.slug === slug);
}

export function sectionFor(postSlug: string) {
  const entry = LIBRARY.find((e) => e.slug === postSlug);
  return entry ? getLibrarySection(entry.section) : undefined;
}

export function entriesIn(section: LibrarySectionSlug): readonly LibraryEntry[] {
  return LIBRARY.filter((e) => e.section === section);
}
