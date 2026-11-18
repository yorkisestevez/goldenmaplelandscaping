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

/**
 * One version of the page for a segment. A segment has one arm, or two while a
 * challenger is being tried against the current one; `weight` is its share of
 * that segment's visitors, out of 100.
 */
export interface HomeArm {
  id: string;
  weight: number;
  blocks: BlockId[];
}

/** Local traffic is small, so a segment never splits more than two ways. */
export const MAX_ARMS = 2;

/** The segment that is prerendered and shown when nothing is known about the visitor. */
export const DEFAULT_SEGMENT = 'default';

/** scripts/check-home-compositions.ts validates the JSON, so the cast is safe at runtime. */
const SEGMENTS = compositions as Record<string, { arms: HomeArm[] }>;

export function armsFor(segment: string): HomeArm[] {
  return (SEGMENTS[segment] ?? SEGMENTS[DEFAULT_SEGMENT]).arms;
}

/** The arm the prerendered page carries: the first arm of the default segment. */
export function prerenderedArm(): HomeArm {
  return armsFor(DEFAULT_SEGMENT)[0];
}

/** Choose an arm by weight. `roll` is a number in [0, 1); anything outside it still lands on an arm. */
export function pickArm(arms: HomeArm[], roll: number): HomeArm {
  const total = arms.reduce((sum, arm) => sum + arm.weight, 0);
  let threshold = roll * total;
  for (const arm of arms) {
    threshold -= arm.weight;
    if (threshold < 0) return arm;
  }
  return arms[arms.length - 1];
}
