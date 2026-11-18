/**
 * City list for the cost estimator location step.
 * Mirrors the LocationKey set in serviceLocations.ts but adds delivery zone and
 * delivery data. Legacy project-count records are unverified inventory in the
 * business register; they must not be used as public social proof.
 */

import { BUSINESS } from './business';
import { LOCATION_ZONE, type DeliveryZone, type EstimatorLocationKey } from './locationZones';

// The keys, zones and surcharges live in locationZones.ts, which the estimate engine reads without this file.
export { ZONE_SURCHARGE, type EstimatorLocationKey } from './locationZones';

export interface EstimatorLocation {
  key: EstimatorLocationKey;
  name: string;
  zone: DeliveryZone;
  projects2025: number;
  postalRoot?: string;
}

export const ESTIMATOR_LOCATIONS: EstimatorLocation[] = [
  { key: 'barrie',       name: BUSINESS.serviceArea.primary.value[0], zone: LOCATION_ZONE.barrie, projects2025: BUSINESS.reviews.projectCounts.value.barrie, postalRoot: 'L4M' },
  { key: 'innisfil',     name: BUSINESS.serviceArea.primary.value[1], zone: LOCATION_ZONE.innisfil, projects2025: BUSINESS.reviews.projectCounts.value.innisfil, postalRoot: 'L9S' },
  { key: 'oro-medonte',  name: BUSINESS.serviceArea.primary.value[2], zone: LOCATION_ZONE['oro-medonte'], projects2025: BUSINESS.reviews.projectCounts.value['oro-medonte'], postalRoot: 'L0L' },
  { key: 'springwater',  name: BUSINESS.serviceArea.primary.value[3], zone: LOCATION_ZONE.springwater, projects2025: BUSINESS.reviews.projectCounts.value.springwater, postalRoot: 'L9X' },
  { key: 'orillia',      name: BUSINESS.serviceArea.secondary.value[0], zone: LOCATION_ZONE.orillia, projects2025: BUSINESS.reviews.projectCounts.value.orillia, postalRoot: 'L3V' },
  { key: 'wasaga-beach', name: BUSINESS.serviceArea.secondary.value[1], zone: LOCATION_ZONE['wasaga-beach'], projects2025: BUSINESS.reviews.projectCounts.value['wasaga-beach'], postalRoot: 'L9Z' },
  { key: 'midland',      name: BUSINESS.serviceArea.secondary.value[2], zone: LOCATION_ZONE.midland, projects2025: BUSINESS.reviews.projectCounts.value.midland, postalRoot: 'L4R' },
  { key: 'collingwood',  name: BUSINESS.serviceArea.secondary.value[3], zone: LOCATION_ZONE.collingwood, projects2025: BUSINESS.reviews.projectCounts.value.collingwood, postalRoot: 'L9Y' },
  { key: 'other',        name: 'Other / Outside Simcoe', zone: LOCATION_ZONE.other, projects2025: 0 },
];

export function getLocation(key: EstimatorLocationKey): EstimatorLocation {
  return ESTIMATOR_LOCATIONS.find(l => l.key === key) || ESTIMATOR_LOCATIONS[0];
}
