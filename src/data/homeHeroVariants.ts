import type { HomeSegment, HomeService } from '../components/home/intent';
import { HERO_DEPTH } from './heroDepth';
import type { ImageRef } from './portfolioImages';
import { getProject, projectCoverFull } from './projects';

/**
 * Home hero copy. Every headline and subhead here is owner copy:
 *   - default: owner-chosen, restored 2026-10-28.
 *   - decks / walls / driveways / patios: approved by the owner 2026-11-11.
 * Nothing else may add or reword a headline. The intent engine and the weekly
 * evolution job only choose between these entries.
 */
export interface HeroVariant {
  eyebrow: string;
  /** Three lines; the last one is set in the accent style. */
  headline: [string, string, string];
  subhead: string;
  image: ImageRef;
  caption: [string, string];
}

const projectHero = (slug: string): Pick<HeroVariant, 'image' | 'caption'> => {
  const project = getProject(slug);
  if (!project) throw new Error(`homeHeroVariants: unknown project "${slug}"`);
  return { image: projectCoverFull(project), caption: [project.title, `Golden Maple project · ${project.town}`] };
};

export const HERO_DEFAULT: HeroVariant = {
  eyebrow: 'Barrie & Simcoe County · Residential landscape construction',
  headline: ['The backyard', 'you’ve always', 'pictured.'],
  subhead: 'Thoughtfully planned patios, decks and outdoor spaces. Built around your home, and the way you want to live.',
  image: { ...HERO_DEPTH.flat, alt: HERO_DEPTH.alt, width: HERO_DEPTH.width, height: HERO_DEPTH.height },
  caption: ['Outdoor living concept', 'Stone · timber · open air'],
};

export const HERO_VARIANTS: Record<HomeService, HeroVariant> = {
  decks: {
    eyebrow: 'Decks · Barrie & Simcoe County',
    headline: ['The deck', 'you’ll live on', 'all summer.'],
    subhead: 'Composite decks planned around your house and the way you spend a summer evening.',
    ...projectHero('deck-and-garden-walkway'),
  },
  walls: {
    eyebrow: 'Retaining walls & steps · Barrie & Simcoe County',
    headline: ['A sloped', 'yard, made', 'usable.'],
    subhead: 'Retaining walls and steps that turn a slope into terraced space you can use.',
    ...projectHero('sloped-backyard-patio-steps'),
  },
  driveways: {
    eyebrow: 'Interlocking driveways · Barrie & Simcoe County',
    headline: ['A driveway', 'worth pulling', 'into.'],
    subhead: 'Interlocking driveways with borders and details that suit the house.',
    ...projectHero('cobblestone-driveway'),
  },
  patios: {
    eyebrow: 'Patios & interlocking · Barrie & Simcoe County',
    headline: ['The patio your', 'evenings have', 'been missing.'],
    subhead: 'Interlock and porcelain patios planned around the way you spend time outside.',
    ...projectHero('barrie-diamond-inlay-patio'),
  },
};

export function heroFor(segment: HomeSegment): HeroVariant {
  return segment === 'default' ? HERO_DEFAULT : HERO_VARIANTS[segment];
}
