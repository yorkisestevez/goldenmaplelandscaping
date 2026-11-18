import type { PaverTier } from './carrPrices';
import type { EstimatorLocationKey } from './locations';

/** The cost estimator's starting build, defined once so anything that quotes "what the estimator
 *  would show" (Sophie's quick range) reads the same values the estimator opens with. */
export const ESTIMATOR_DEFAULT_SIZES: Readonly<Record<string, number | string>> = {
  patio: 500,
  stone: 500,
  wall: 50,
  wallHeight: '2-4ft',
  steps: 5,
  deck: 300,
  kitchen: 'Basic',
  firepit: 'Medium',
  pergola: 'Medium',
  turf: 500,
  lighting: 'Medium',
};

export const ESTIMATOR_DEFAULT_CONDITIONS: Readonly<Record<string, boolean>> = {
  access: false, slope: false, drainage: false, levels: false,
};

export const ESTIMATOR_DEFAULT_LOCATION: EstimatorLocationKey = 'barrie';
export const ESTIMATOR_DEFAULT_TIER: PaverTier = 'mid';
export const ESTIMATOR_DEFAULT_PAVER_ID = 'permacon-mondrian-plus';
export const ESTIMATOR_DEFAULT_DECK_ID = 'timbertech-prime';

/** A ?type=full link pre-selects the three most common picks so the size step still has meaning. */
export const FULL_BACKYARD_PREFILL: readonly string[] = ['patio', 'wall', 'lighting'];

/** A /cost-estimator?sqft= link is applied only inside this window (Estimator.tsx prefill effect). */
export const ESTIMATOR_PREFILL_SIZE = { min: 100, max: 2000 } as const;

/** The ± band the estimator shows before any project question is answered (its confidence starts here). */
export const ESTIMATOR_ENTRY_CONFIDENCE = 30;
