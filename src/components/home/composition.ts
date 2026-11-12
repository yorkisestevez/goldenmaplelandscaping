import compositions from '../../data/homeCompositions.json';

/** Every block the homepage can show below the hero. */
export const BLOCK_IDS = [
  'instant-estimate',
  'selected-work',
  'process',
  'services',
  'founder',
  'pain-points',
  'why',
  'reviews',
  'instagram',
  'faq',
  'buyers-guide',
  'final-cta',
] as const;

export type BlockId = (typeof BLOCK_IDS)[number];

export interface HomeComposition {
  blocks: BlockId[];
}

/** The composition that is prerendered and shown when nothing is known about the visitor. */
export const DEFAULT_SEGMENT = 'default';

/** scripts/check-home-compositions.ts validates the JSON, so the cast is safe at runtime. */
const SEGMENTS = compositions as Record<string, HomeComposition>;

export function compositionFor(segment: string): HomeComposition {
  return SEGMENTS[segment] ?? SEGMENTS[DEFAULT_SEGMENT];
}
