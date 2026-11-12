import { useSyncExternalStore } from 'react';
import { ESTIMATOR_LOCATIONS } from '../../data/locations';
import { readSession } from '../../utils/behavior';
import { readVault, type VaultEstimate } from '../../utils/estimatorVault';
import { readAttribution } from '../../utils/utmCapture';
import { BOOT_ATTRIBUTE, SEGMENT_ATTRIBUTE, SEGMENT_PARAM, SEGMENT_STORAGE_KEY, storedSegmentValue } from './heroBoot';
import {
  cityFrom,
  parseSegment,
  recordSession,
  sanitizeProfile,
  scoreSignals,
  segmentOf,
  totalAt,
  type HomeSegment,
  type IntentProfile,
  type IntentScores,
} from './intent';

/**
 * Browser side of the intent engine. Everything here is first-party and stays
 * on the visitor's device: it reads what the site already keeps in session and
 * local storage and writes one small profile back. Nothing is sent anywhere.
 */
const PROFILE_STORAGE_KEY = 'gm_intent_profile';
const TOWN_KEYS: string[] = ESTIMATOR_LOCATIONS.map((loc) => loc.key);

export interface IntentSnapshot {
  segment: HomeSegment;
  scores: IntentScores;
}

/** This session's trail, tolerant of a missing or damaged stored value. Paths lose their query string. */
function sessionTrail(): { id: string; paths: string[]; labels: string[] } {
  const session = readSession();
  const pages = Array.isArray(session?.pages) ? session.pages : [];
  const clicks = Array.isArray(session?.clicks) ? session.clicks : [];
  return {
    id: typeof session?.started_at === 'string' ? session.started_at : 'no-session',
    paths: pages.map((page) => String(page?.path ?? '').split(/[?#]/)[0]),
    labels: clicks.map((click) => String(click?.label ?? '')),
  };
}

function readProfile(): IntentProfile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? sanitizeProfile(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** The visitor's most recent saved estimate, for scoring and for the "pick up where you left off" line. */
export function lastEstimate(): VaultEstimate | null {
  return readVault().estimates[0] ?? null;
}

/**
 * Re-score the visitor from this session's trail and store the result. Called
 * on every route change, so the segment is settled before the homepage is next
 * opened. Returns null when storage is unavailable.
 */
export function refreshIntent(): IntentSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const attribution = readAttribution();
    const trail = sessionTrail();
    const sessionScores = scoreSignals({
      utmText: [attribution?.utm_term, attribution?.utm_campaign, attribution?.utm_content].filter(Boolean).join(' '),
      pagePaths: trail.paths,
      clickLabels: trail.labels,
    });
    const now = Date.now();
    const profile = recordSession(readProfile(), trail.id, sessionScores, now);
    const estimate = lastEstimate();
    const savedAt = estimate ? Date.parse(estimate.savedAt) : NaN;
    const scores = totalAt(profile, now, estimate && Number.isFinite(savedAt) ? { projectType: estimate.projectType, savedAt } : null);
    const segment = segmentOf(scores);
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    if (segment === 'default') window.localStorage.removeItem(SEGMENT_STORAGE_KEY);
    else window.localStorage.setItem(SEGMENT_STORAGE_KEY, storedSegmentValue(segment, now));
    return { segment, scores };
  } catch {
    return null;
  }
}

/** The town the visitor priced or read about most recently, as an estimator location key. */
export function preferredCity(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // The vault stores the town's display name; the estimator link needs its key.
    const priced = lastEstimate()?.city;
    const pricedKey = ESTIMATOR_LOCATIONS.find((loc) => loc.name === priced || loc.key === priced)?.key;
    return pricedKey ?? cityFrom(sessionTrail().paths, TOWN_KEYS);
  } catch {
    return null;
  }
}

/**
 * The segment for this view of the homepage. It is fixed for as long as the
 * homepage stays open, so the page never reshuffles under a visitor who is
 * reading it.
 *
 *   - A valid `?gm_intent=` always wins.
 *   - On a hard load the pre-paint script has already decided and painted;
 *     React takes exactly that, so the two can never disagree and swap the
 *     hero after it is on screen.
 *   - On an in-site navigation there is no pre-painted hero, so the visitor
 *     is scored fresh. That writes the profile during render, once per view,
 *     which is what keeps the choice current with the page they just left.
 */
let pageSegment: HomeSegment | null = null;

function resolveSegment(): HomeSegment {
  try {
    const forced = parseSegment(new URLSearchParams(window.location.search).get(SEGMENT_PARAM));
    if (forced) return forced;
    const root = document.documentElement;
    if (root.hasAttribute(BOOT_ATTRIBUTE)) return parseSegment(root.getAttribute(SEGMENT_ATTRIBUTE)) ?? 'default';
    return refreshIntent()?.segment ?? 'default';
  } catch {
    return 'default';
  }
}

const subscribe = () => () => {};
const getSnapshot = (): HomeSegment => (pageSegment ??= resolveSegment());
const getServerSnapshot = (): HomeSegment => 'default';

/** "default" while prerendering and hydrating, then the visitor's segment. */
export function useHomeSegment(): HomeSegment {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Forget this view's segment; the homepage calls it on unmount. */
export function releaseHomeSegment(): void {
  pageSegment = null;
  document.documentElement.removeAttribute(SEGMENT_ATTRIBUTE);
  document.documentElement.removeAttribute(BOOT_ATTRIBUTE);
}
