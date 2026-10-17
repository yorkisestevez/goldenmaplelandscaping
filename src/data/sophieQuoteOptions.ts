import { ESTIMATOR_LOCATIONS, type EstimatorLocationKey } from './locations';

/** The choices behind Sophie's 3-tap planning range. Kept apart from the pricing engine so the chat
 *  widget can render the taps without loading the engine, and so the chat function can validate a
 *  visitor's choices before re-pricing them itself. */

export type QuickProject = 'patio' | 'stone' | 'wall' | 'full' | 'deck';
export type QuickSize = 'small' | 'medium' | 'large';

/** `serviceInterest` must match a BookingScheduler SERVICE_OPTIONS entry or /book ignores it. */
export const QUICK_PROJECTS: ReadonlyArray<{ id: QuickProject; label: string; noun: string; serviceInterest: string }> = [
  { id: 'patio', label: 'Patio', noun: 'patio', serviceInterest: 'Interlocking Stone & Patios' },
  { id: 'stone', label: 'Walkway', noun: 'walkway', serviceInterest: 'Interlocking Stone & Patios' },
  { id: 'wall', label: 'Retaining wall', noun: 'retaining wall', serviceInterest: 'Retaining Walls' },
  { id: 'full', label: 'Full backyard', noun: 'full backyard', serviceInterest: 'Complete Backyard Renovation' },
  { id: 'deck', label: 'Deck', noun: 'deck', serviceInterest: 'Composite Decking' },
];

export interface SizeOption { id: QuickSize; label: string; hint: string; amount: number; unit: 'sq ft' | 'linear ft' }

const areaSizes = (small: number, medium: number, large: number): SizeOption[] => [
  { id: 'small', label: 'Small', hint: `~${small} sq ft`, amount: small, unit: 'sq ft' },
  { id: 'medium', label: 'Medium', hint: `~${medium} sq ft`, amount: medium, unit: 'sq ft' },
  { id: 'large', label: 'Large', hint: `~${large} sq ft`, amount: large, unit: 'sq ft' },
];

/** Patio buckets match the home-page quick estimator (HeroEstimator SIZE_BUCKETS). */
export const QUICK_SIZES: Readonly<Record<QuickProject, SizeOption[]>> = {
  patio: areaSizes(300, 600, 1000),
  stone: areaSizes(100, 150, 250),
  wall: [
    { id: 'small', label: 'Short', hint: '~30 ft long', amount: 30, unit: 'linear ft' },
    { id: 'medium', label: 'Medium', hint: '~50 ft long', amount: 50, unit: 'linear ft' },
    { id: 'large', label: 'Long', hint: '~80 ft long', amount: 80, unit: 'linear ft' },
  ],
  full: areaSizes(300, 600, 1000),
  deck: areaSizes(200, 300, 500),
};

export interface QuickRangeInput { project: QuickProject; size: QuickSize; city: EstimatorLocationKey }

/** Accepts only known project, size and town ids — anything else (including free text) is null. */
export function parseQuickRangeInput(raw: unknown): QuickRangeInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const { project, size, city } = raw as Record<string, unknown>;
  const known = QUICK_PROJECTS.find((p) => p.id === project);
  if (!known || !QUICK_SIZES[known.id].some((s) => s.id === size)) return null;
  if (!ESTIMATOR_LOCATIONS.some((l) => l.key === city)) return null;
  return { project: known.id, size: size as QuickSize, city: city as EstimatorLocationKey };
}
