/**
 * Completed-project register — the single source for /portfolio, /portfolio/:slug,
 * the Home "selected work" block, Services covers and the estimator proof strip.
 *
 * Every photo id must exist in the attested manifest (see portfolioImages.ts);
 * the type system enforces that. Records carry ONLY what the owner confirmed on
 * 2026-09-13: what is in the frame, the town, and a category. No investment
 * figures, durations, testimonials or narrative claims — those need a traceable
 * source before they can be published (src/data/business.ts).
 *
 * Towns: jobs the owner did not place are labelled "Simcoe County".
 *
 * This module must stay side-effect-free: react-router.config.ts imports it under
 * Node at build time to prerender every project route.
 */
import { CARD_SIZES, FULL_SIZES, portfolioImage, type ImageRef, type PortfolioImageId } from './portfolioImages';

export const PROJECT_CATEGORIES = [
  'Patios & interlocking',
  'Walkways & entrances',
  'Walls & steps',
  'Driveways',
  'Decks',
  'Lakeside & cottage',
  'Fences & privacy',
  'Artificial turf',
] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export interface ProjectPhoto {
  id: PortfolioImageId;
  alt: string;
}

export interface ProjectRecord {
  slug: string;
  title: string;
  town: string;
  category: ProjectCategory;
  /** One or two descriptive sentences: what is visible in the photos. */
  summary: string;
  cover: PortfolioImageId;
  /** Includes the cover. Order = gallery order. */
  photos: ProjectPhoto[];
  /** Shown first on Home "selected work". */
  featured?: boolean;
  instagramPermalink?: string;
}

export const PROJECTS: readonly ProjectRecord[] = [
  {
    slug: 'barrie-bungalow-patio',
    title: 'Bungalow patio with gazebo',
    town: 'Barrie',
    category: 'Patios & interlocking',
    summary: 'Interlocking paver patio behind a brick bungalow, sized for a gazebo-covered dining area and a barbecue corner, with a new lawn on three sides.',
    cover: 'barrie-bungalow-patio-1',
    instagramPermalink: 'https://www.instagram.com/p/DbXDqSfjfZp/',
    photos: [
      { id: 'barrie-bungalow-patio-1', alt: 'Interlocking paver patio with a gazebo-covered dining set behind a brick bungalow in Barrie, ON' },
      { id: 'barrie-bungalow-patio-2', alt: 'Paver patio and side entrance steps beside a brick bungalow in Barrie, ON, with planters and a gazebo' },
    ],
  },
  {
    slug: 'midhurst-front-entrance',
    title: 'Front entrance and walkway',
    town: 'Midhurst',
    category: 'Walkways & entrances',
    summary: 'Paver front entrance and walkway running between brick pillars, with freshly graded planting beds and lawn along the house.',
    cover: 'midhurst-front-entrance-1',
    photos: [
      { id: 'midhurst-front-entrance-1', alt: 'Paver walkway and front entrance between brick pillars with new planting beds in Midhurst, ON' },
      { id: 'midhurst-front-entrance-2', alt: 'Close view of a paver walkway with a soldier-course border at a home in Midhurst, ON' },
    ],
  },
  {
    slug: 'barrie-front-entrance',
    title: 'Slab walkway to the front door',
    town: 'Barrie',
    category: 'Walkways & entrances',
    summary: 'Large-format slab walkway with a contrasting border, set into the front lawn and leading to the entrance of a brick home.',
    cover: 'barrie-front-entrance-1',
    photos: [
      { id: 'barrie-front-entrance-1', alt: 'Large-format slab walkway with a dark border set into a front lawn in Barrie, ON' },
    ],
  },
  {
    slug: 'barrie-diamond-inlay-patio',
    title: 'Patio with diamond inlay',
    town: 'Simcoe County',
    category: 'Patios & interlocking',
    summary: 'Slab patio with a dark border and a hand-set diamond inlay, built beside a brick home with a planting bed along the edge.',
    cover: 'barrie-diamond-inlay-patio-1',
    featured: true,
    photos: [
      { id: 'barrie-diamond-inlay-patio-1', alt: 'Slab patio with a dark border and a diamond inlay beside a brick home in Simcoe County, ON' },
    ],
  },
  {
    slug: 'sloped-backyard-patio-steps',
    title: 'Retaining wall, steps and patio',
    town: 'Simcoe County',
    category: 'Walls & steps',
    summary: 'Block retaining wall with built-in steps leading down to a slab patio finished with a charcoal border and stepping pads set in gravel.',
    cover: 'sloped-backyard-patio-steps-2',
    photos: [
      { id: 'sloped-backyard-patio-steps-2', alt: 'Block retaining wall with built-in steps down to a slab patio with a charcoal border in Simcoe County, ON' },
      { id: 'sloped-backyard-patio-steps-1', alt: 'Slab patio with a dark border and stepping pads set in gravel along a side yard in Simcoe County, ON' },
    ],
  },
  {
    slug: 'cobblestone-driveway',
    title: 'Cobblestone paver driveway',
    town: 'Simcoe County',
    category: 'Driveways',
    summary: 'Cobblestone-style paver driveway with a border, leading to stone-pillar front steps at a red-brick home.',
    cover: 'cobblestone-driveway-1',
    featured: true,
    photos: [
      { id: 'cobblestone-driveway-1', alt: 'Cobblestone-style paver driveway with a border leading to stone-pillar front steps of a red-brick home in Simcoe County, ON' },
    ],
  },
  {
    slug: 'gazebo-patio',
    title: 'Patio with cedar gazebo',
    town: 'Simcoe County',
    category: 'Patios & interlocking',
    summary: 'Slab patio with a low block wall along the lawn edge, a cedar gazebo over the dining area and a new fence line with cedars planted behind it.',
    cover: 'gazebo-patio-1',
    instagramPermalink: 'https://www.instagram.com/p/Dceq6tWGg_O/',
    photos: [
      { id: 'gazebo-patio-1', alt: 'Slab patio with a cedar gazebo over a dining set, a low block wall and a new lawn in Simcoe County, ON' },
    ],
  },
  {
    slug: 'deck-and-garden-walkway',
    title: 'Backyard deck and garden walkway',
    town: 'Simcoe County',
    category: 'Decks',
    summary: 'Aerial view of a backyard deck with a stepped landing and a stone walkway winding through the garden beds to the lawn.',
    cover: 'deck-and-garden-walkway-1',
    photos: [
      { id: 'deck-and-garden-walkway-1', alt: 'Aerial view of a backyard deck with a stepped landing and a stone walkway through garden beds in Simcoe County, ON' },
    ],
  },
  {
    slug: 'lakeside-backyard',
    title: 'Waterfront backyard',
    town: 'Simcoe County',
    category: 'Lakeside & cottage',
    summary: 'Aerial view of a waterfront backyard with a walkway down to the shoreline and a fire-pit seating area beside the water.',
    cover: 'lakeside-backyard-1',
    photos: [
      { id: 'lakeside-backyard-1', alt: 'Aerial view of a waterfront backyard with a walkway to the shoreline and fire-pit seating in Simcoe County, ON' },
    ],
  },
];

export function getProject(slug: string): ProjectRecord | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}

export function categorySlug(category: ProjectCategory): string {
  return category.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function categoryFromSlug(slug: string | null): ProjectCategory | undefined {
  if (!slug) return undefined;
  return PROJECT_CATEGORIES.find((c) => categorySlug(c) === slug);
}

export function projectsInCategory(category: ProjectCategory): ProjectRecord[] {
  return PROJECTS.filter((p) => p.category === category);
}

export const FEATURED_PROJECTS: ProjectRecord[] = [
  ...PROJECTS.filter((p) => p.featured),
  ...PROJECTS.filter((p) => !p.featured),
].slice(0, 2);

/** Card-sized cover for a project (4:3). */
export function projectCover(project: ProjectRecord): ImageRef {
  const photo = project.photos.find((p) => p.id === project.cover) ?? project.photos[0];
  return portfolioImage(project.cover, 'card', photo.alt);
}

/** Full-resolution, native-aspect cover for the detail page hero. */
export function projectCoverFull(project: ProjectRecord): ImageRef {
  const photo = project.photos.find((p) => p.id === project.cover) ?? project.photos[0];
  return portfolioImage(project.cover, 'full', photo.alt);
}

/** Native-aspect gallery set for a project. */
export function projectPhotos(project: ProjectRecord): ImageRef[] {
  return project.photos.map((p) => portfolioImage(p.id, 'full', p.alt));
}

/** First cover in a category, or undefined when nothing is published there yet. */
export function coverForCategory(category: ProjectCategory): ImageRef | undefined {
  const project = projectsInCategory(category)[0];
  return project ? projectCover(project) : undefined;
}

/** Home hero: the widest, clearest completed-project photo in the register. */
export const HOME_HERO_PROJECT = getProject('barrie-bungalow-patio')!;
export const HOME_HERO: ImageRef = portfolioImage(
  'barrie-bungalow-patio-1',
  'full',
  'Completed interlocking paver patio with a gazebo-covered dining area behind a brick bungalow in Barrie, ON',
);

export { CARD_SIZES, FULL_SIZES };
export type { ImageRef };
