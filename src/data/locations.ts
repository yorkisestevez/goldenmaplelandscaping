/**
 * City list for the cost estimator location step.
 * Mirrors the LocationKey set in serviceLocations.ts but adds delivery zone and
 * delivery data. Legacy project-count records are unverified inventory in the
 * business register; they must not be used as public social proof.
 */

import { BUSINESS } from './business';

export type EstimatorLocationKey =
  | 'barrie'
  | 'innisfil'
  | 'oro-medonte'
  | 'springwater'
  | 'orillia'
  | 'wasaga-beach'
  | 'midland'
  | 'collingwood'
  | 'other';

export interface EstimatorLocation {
  key: EstimatorLocationKey;
  name: string;
  zone: 1 | 2 | 3 | 4;
  projects2025: number;
  postalRoot?: string;
}

export const ESTIMATOR_LOCATIONS: EstimatorLocation[] = [
  { key: 'barrie',       name: BUSINESS.serviceArea.primary.value[0], zone: 1, projects2025: BUSINESS.reviews.projectCounts.value.barrie, postalRoot: 'L4M' },
  { key: 'innisfil',     name: BUSINESS.serviceArea.primary.value[1], zone: 1, projects2025: BUSINESS.reviews.projectCounts.value.innisfil, postalRoot: 'L9S' },
  { key: 'oro-medonte',  name: BUSINESS.serviceArea.primary.value[2], zone: 2, projects2025: BUSINESS.reviews.projectCounts.value['oro-medonte'], postalRoot: 'L0L' },
  { key: 'springwater',  name: BUSINESS.serviceArea.primary.value[3], zone: 1, projects2025: BUSINESS.reviews.projectCounts.value.springwater, postalRoot: 'L9X' },
  { key: 'orillia',      name: BUSINESS.serviceArea.secondary.value[0], zone: 2, projects2025: BUSINESS.reviews.projectCounts.value.orillia, postalRoot: 'L3V' },
  { key: 'wasaga-beach', name: BUSINESS.serviceArea.secondary.value[1], zone: 3, projects2025: BUSINESS.reviews.projectCounts.value['wasaga-beach'], postalRoot: 'L9Z' },
  { key: 'midland',      name: BUSINESS.serviceArea.secondary.value[2], zone: 3, projects2025: BUSINESS.reviews.projectCounts.value.midland, postalRoot: 'L4R' },
  { key: 'collingwood',  name: BUSINESS.serviceArea.secondary.value[3], zone: 4, projects2025: BUSINESS.reviews.projectCounts.value.collingwood, postalRoot: 'L9Y' },
  { key: 'other',        name: 'Other / Outside Simcoe', zone: 4, projects2025: 0 },
];

/** Delivery surcharge by zone (CAD). Zone 1 baseline is folded into base rates. */
export const ZONE_SURCHARGE: Record<1 | 2 | 3 | 4, number> = {
  1: 0,
  2: 350,
  3: 700,
  4: 1200,
};

export function getLocation(key: EstimatorLocationKey): EstimatorLocation {
  return ESTIMATOR_LOCATIONS.find(l => l.key === key) || ESTIMATOR_LOCATIONS[0];
}
