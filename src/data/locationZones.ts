/**
 * Delivery zone for each cost-estimator location, and the surcharge for each zone.
 * Dependency-free on purpose: the estimate engine imports it, and the engine also runs inside the deck designer's
 * pricing worker, which must not carry the business register just to look up a zone. The display names stay in
 * locations.ts, which reads them from business.ts.
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

export type DeliveryZone = 1 | 2 | 3 | 4;

export const LOCATION_ZONE: Record<EstimatorLocationKey, DeliveryZone> = {
  barrie: 1,
  innisfil: 1,
  'oro-medonte': 2,
  springwater: 1,
  orillia: 2,
  'wasaga-beach': 3,
  midland: 3,
  collingwood: 4,
  other: 4,
};

/** Delivery surcharge by zone (CAD). Zone 1 baseline is folded into base rates. */
export const ZONE_SURCHARGE: Record<DeliveryZone, number> = {
  1: 0,
  2: 350,
  3: 700,
  4: 1200,
};

/** The zone for a location. A key that is not on the list is priced as Barrie, zone 1. */
export const zoneOf = (key: EstimatorLocationKey): DeliveryZone =>
  Object.prototype.hasOwnProperty.call(LOCATION_ZONE, key) ? LOCATION_ZONE[key] : LOCATION_ZONE.barrie;
