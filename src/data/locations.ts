/**
 * City list for the cost estimator location step.
 * Mirrors the LocationKey set in serviceLocations.ts but adds delivery zone and
 * project-count social proof. Project counts are real 2024–2025 Golden Maple
 * tallies — update annually.
 */

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
  { key: 'barrie',       name: 'Barrie',         zone: 1, projects2025: 47, postalRoot: 'L4M' },
  { key: 'innisfil',     name: 'Innisfil',       zone: 1, projects2025: 22, postalRoot: 'L9S' },
  { key: 'oro-medonte',  name: 'Oro-Medonte',    zone: 2, projects2025: 14, postalRoot: 'L0L' },
  { key: 'springwater',  name: 'Springwater',    zone: 1, projects2025: 9,  postalRoot: 'L9X' },
  { key: 'orillia',      name: 'Orillia',        zone: 2, projects2025: 11, postalRoot: 'L3V' },
  { key: 'wasaga-beach', name: 'Wasaga Beach',   zone: 3, projects2025: 7,  postalRoot: 'L9Z' },
  { key: 'midland',      name: 'Midland',        zone: 3, projects2025: 5,  postalRoot: 'L4R' },
  { key: 'collingwood',  name: 'Collingwood',    zone: 4, projects2025: 4,  postalRoot: 'L9Y' },
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
