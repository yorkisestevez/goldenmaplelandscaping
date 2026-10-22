/**
 * Who may reach GA4, Ads, Meta and Clarity.
 *
 * In October 2026 most GA4 traffic was our own: CI e2e runs and local builds on
 * 127.0.0.1, plus headless captures of the live site, some of which fired test
 * leads. Only a real visitor on the live host is tracked. `?notrack=1` lets the
 * owner or crew mark their own browser; `?notrack=0` undoes it. The choice is per
 * host (apex and www separately), and it is separate from the staff `?internal=`
 * token (deckcraft/internalMode.ts), which stops DeckCraft leads and their
 * conversion events but not page analytics. The
 * one e2e spec that checks real tag behaviour sets `window.__gmAnalyticsTest`
 * before load.
 */

import { BUSINESS } from '../data/business';

const LIVE_HOST = new URL(BUSINESS.canonicalUrl).hostname;
const TRACKED_HOSTS = new Set([LIVE_HOST, `www.${LIVE_HOST}`]);

export const NO_TRACK_KEY = 'gm-notrack';

export type TrackingContext = {
  hostname: string;
  /** `navigator.webdriver`: true only in an automated browser. */
  webdriver: boolean;
  optedOut: boolean;
  testOptIn: boolean;
};

export function isTrackedVisit({ hostname, webdriver, optedOut, testOptIn }: TrackingContext): boolean {
  if (testOptIn) return true;
  return TRACKED_HOSTS.has(hostname) && !webdriver && !optedOut;
}

/** `?notrack=1` → opt out, `?notrack=0` → opt back in, anything else → keep the stored choice. */
export function noTrackParam(search: string): boolean | null {
  const value = new URLSearchParams(search).get('notrack');
  if (value === '1') return true;
  if (value === '0') return false;
  return null;
}

/** Browser storage as the gate uses it. Any call may throw (private mode, blocked site data). */
export type TrackingStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type TrackingEnv = Omit<TrackingContext, 'optedOut'> & { search: string; storage: TrackingStorage | null };

/** Stores a `?notrack=` choice, then decides. Storage that fails still honours the parameter for this page. */
export function decideTracking({ search, storage, ...visit }: TrackingEnv): boolean {
  const choice = noTrackParam(search);
  let stored = false;
  try {
    if (choice === true) storage?.setItem(NO_TRACK_KEY, '1');
    if (choice === false) storage?.removeItem(NO_TRACK_KEY);
    stored = storage?.getItem(NO_TRACK_KEY) === '1';
  } catch {
    /* private mode */
  }
  return isTrackedVisit({ ...visit, optedOut: choice ?? stored });
}
