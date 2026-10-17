import { computeEstimate, widenTotals, type EstimateInput } from './estimateEngine';
import {
  ESTIMATOR_DEFAULT_SIZES, ESTIMATOR_DEFAULT_CONDITIONS, ESTIMATOR_DEFAULT_TIER,
  ESTIMATOR_DEFAULT_PAVER_ID, ESTIMATOR_DEFAULT_DECK_ID, ESTIMATOR_ENTRY_CONFIDENCE, FULL_BACKYARD_PREFILL,
} from '../data/estimatorDefaults';
import { getLocation, type EstimatorLocationKey } from '../data/locations';
import { QUICK_PROJECTS, QUICK_SIZES, type QuickProject, type QuickSize, type QuickRangeInput, type SizeOption } from '../data/sophieQuoteOptions';
import { deckDesignerHref } from '../features/deckcraft/estimatorHandoff';

export { QUICK_PROJECTS, QUICK_SIZES, parseQuickRangeInput, type QuickProject, type QuickSize, type QuickRangeInput } from '../data/sophieQuoteOptions';

/** Sophie's 3-tap planning range. Every dollar comes from the cost estimator's own engine, built the
 *  way /cost-estimator?type=&sqft=&city= builds it on arrival, so chat and estimator never disagree. */

/** The estimator applies a ?sqft= prefill only inside this window (Estimator.tsx prefill effect). */
const PREFILL_MIN = 100;
const PREFILL_MAX = 2000;

export type QuickRange =
  | { kind: 'designer'; href: string }
  | {
      kind: 'range';
      low: number;
      high: number;
      days: { low: number; high: number };
      summary: string;
      /** e.g. "$10,750–$23,000 + HST". */
      band: string;
      estimatorHref: string;
      serviceInterest: string;
      bookingNotes: string;
      /** What the AI is told, so a follow-up question gets these numbers and no others. */
      contextText: string;
    };

const money = (n: number) => `$${n.toLocaleString('en-CA')}`;

function sizeOption(project: QuickProject, size: QuickSize): SizeOption {
  const option = QUICK_SIZES[project].find((s) => s.id === size);
  if (!option) throw new Error(`Unknown quick size ${project}/${size}`);
  return option;
}

function estimatorInput(project: Exclude<QuickProject, 'deck'>, amount: number, city: EstimatorLocationKey): EstimateInput {
  return {
    projectType: project,
    selectedElements: project === 'full' ? [...FULL_BACKYARD_PREFILL] : [],
    sizes: { ...ESTIMATOR_DEFAULT_SIZES, [project === 'full' ? 'patio' : project]: amount },
    details: {},
    conditions: { ...ESTIMATOR_DEFAULT_CONDITIONS },
    location: city,
    tier: ESTIMATOR_DEFAULT_TIER,
    paverBrandId: ESTIMATOR_DEFAULT_PAVER_ID,
    deckBrandId: ESTIMATOR_DEFAULT_DECK_ID,
    addOns: [],
  };
}

export function quickRange({ project, size, city }: QuickRangeInput): QuickRange {
  const option = sizeOption(project, size);
  // Decks are priced only by the deck designer, the site's one deck price.
  if (project === 'deck') return { kind: 'designer', href: deckDesignerHref(option.amount) };

  const meta = QUICK_PROJECTS.find((p) => p.id === project)!;
  const estimate = computeEstimate(estimatorInput(project, option.amount, city));
  const { low, high } = widenTotals(estimate, ESTIMATOR_ENTRY_CONFIDENCE);
  const town = getLocation(city).name;
  // Sophie doesn't ask wall height, so say which height band was priced (the estimator's default).
  const sizeText =
    project === 'full' ? `~${option.amount} sq ft patio, wall and lighting`
    : project === 'wall' ? `~${option.amount} ${option.unit}, ${String(ESTIMATOR_DEFAULT_SIZES.wallHeight).replace('-', '–').replace('ft', ' ft')} high`
    : `~${option.amount} ${option.unit}`;
  const summary = `${meta.label}, ${sizeText}, ${town}`;
  const band = `${money(low)}–${money(high)} + HST`;

  const params = new URLSearchParams({ type: project });
  if (option.amount >= PREFILL_MIN && option.amount <= PREFILL_MAX) params.set('sqft', String(option.amount));
  params.set('city', city);

  return {
    kind: 'range',
    low,
    high,
    days: estimate.days,
    summary,
    band,
    estimatorHref: `/cost-estimator?${params.toString()}`,
    serviceInterest: meta.serviceInterest,
    bookingNotes: `Sophie planning range: ${summary}: ${band} (site estimator, before a site visit).`,
    contextText:
      `Visitor's planning range from the site cost estimator: ${summary}: ${band}. ` +
      'Quote only these numbers, call them a planning range confirmed at a site visit, and offer to book a site visit at /book.',
  };
}
