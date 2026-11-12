import { useSyncExternalStore } from 'react';
import { ESTIMATOR_LOCATIONS } from '../../data/locations';
import { readSession } from '../../utils/behavior';
import { readVault, type VaultEstimate } from '../../utils/estimatorVault';
import { readAttribution } from '../../utils/utmCapture';
import { SEGMENT_ATTRIBUTE, SEGMENT_PARAM, SEGMENT_STORAGE_KEY } from './heroBoot';
import {
  cityFrom,
  nextProfile,
  parseSegment,
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
const PROFILE_STORAGE_KEY = 'gm_intent';
const TOWN_KEYS: string[] = ESTIMATOR_LOCATIONS.map((loc) => loc.key);

export interface IntentSnapshot {
  segment: HomeSegment;
  scores: IntentScores;
}

function readProfile(): IntentProfile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as IntentProfile) : null;
  } catch {
    return null;
  }
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
    const session = readSession();
    const sessionScores = scoreSignals({
      utmText: [attribution?.utm_term, attribution?.utm_campaign, attribution?.utm_content].filter(Boolean).join(' '),
      pagePaths: session?.pages.map((page) => page.path) ?? [],
      clickLabels: session?.clicks.map((click) => click.label) ?? [],
      lastEstimateType: readVault().estimates[0]?.projectType ?? null,
    });
    const now = Date.now();
    const profile = nextProfile(readProfile(), session?.started_at ?? 'no-session', sessionScores, now);
    const scores = totalAt(profile, now);
    const segment = segmentOf(scores);
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    if (segment === 'default') window.localStorage.removeItem(SEGMENT_STORAGE_KEY);
    else window.localStorage.setItem(SEGMENT_STORAGE_KEY, segment);
    return { segment, scores };
  } catch {
    return null;
  }
}

/** The town the visitor priced or read about most recently, as an estimator location key. */
export function preferredCity(): string | null {
  if (typeof window === 'undefined') return null;
  const priced = readVault().estimates[0]?.city;
  if (priced && TOWN_KEYS.includes(priced)) return priced;
  return cityFrom(readSession()?.pages.map((page) => page.path) ?? [], TOWN_KEYS);
}

/** The visitor's most recent saved estimate, for the "pick up where you left off" line. */
export function lastEstimate(): VaultEstimate | null {
  return readVault().estimates[0] ?? null;
}

/**
 * The segment for this view of the homepage: a forced one from the URL, else
 * the one the pre-paint script already applied, else a fresh score. It is
 * fixed for as long as the homepage stays open, so the page never reshuffles
 * under a visitor who is reading it.
 */
let pageSegment: HomeSegment | null = null;

function resolveSegment(): HomeSegment {
  try {
    const forced = parseSegment(new URLSearchParams(window.location.search).get(SEGMENT_PARAM));
    if (forced) return forced;
    const painted = parseSegment(document.documentElement.getAttribute(SEGMENT_ATTRIBUTE));
    if (painted) return painted;
    // Re-score now rather than trust the stored value: the last page view may have reached the trail after the route-change refresh ran.
    return refreshIntent()?.segment ?? parseSegment(window.localStorage.getItem(SEGMENT_STORAGE_KEY)) ?? 'default';
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
}
