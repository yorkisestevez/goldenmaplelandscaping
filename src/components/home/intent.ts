/**
 * Homepage intent engine: turns what a visitor searched, viewed, clicked and
 * priced into one of a few service segments. Pure functions only; reading the
 * browser's storage lives in intentStore.ts.
 */

export const HOME_SERVICES = ['patios', 'decks', 'walls', 'driveways'] as const;
export type HomeService = (typeof HOME_SERVICES)[number];
export type HomeSegment = 'default' | HomeService;
export type IntentScores = Record<HomeService, number>;

export interface IntentSignals {
  /** utm_term, utm_campaign and utm_content joined. */
  utmText: string;
  /** Paths viewed this session, oldest first, without query strings. */
  pagePaths: string[];
  /** Click and chat labels recorded this session. */
  clickLabels: string[];
}

/** The visitor's most recent saved estimate. */
export interface SavedEstimate {
  projectType: string;
  savedAt: number;
}

/**
 * What is remembered between visits: the score of each recent session and when
 * it was last seen. Keyed by session, so re-scoring a session replaces its
 * entry and can never add to it, however many tabs are open.
 */
export interface IntentProfile {
  sessions: Record<string, { scores: IntentScores; at: number }>;
}

/**
 * One pattern per service, tested against lower-cased search terms, paths and
 * click labels alike. Order matters: the first match wins, so "interlocking
 * driveway" is a driveway and never a patio.
 */
export const INTENT_RULES: ReadonlyArray<{ service: HomeService; pattern: RegExp }> = [
  { service: 'driveways', pattern: /driveway/ },
  { service: 'decks', pattern: /deck|composite|timbertech/ },
  { service: 'walls', pattern: /retaining|wall|armou?r.?stone|slope/ },
  { service: 'patios', pattern: /patio|interlock|paver|porcelain|flagstone/ },
];

const ESTIMATE_TYPE_SERVICE: Record<string, HomeService> = { patio: 'patios', deck: 'decks', wall: 'walls' };

const UTM_POINTS = 5;
/** Pricing a project is the strongest signal there is; it outranks a search term until it fades. */
const ESTIMATE_POINTS = 6;
const PAGE_POINTS = 2;
const PAGE_CAP = 6;
const CLICK_POINTS = 1;
const CLICK_CAP = 3;
/** Sessions remembered, and the most their combined interest can count for, so no habit becomes permanent. */
const MAX_SESSIONS = 6;
const HISTORY_CAP = 16;
const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;
/** A segment needs this much interest, and this much more than the runner-up. */
const MIN_SCORE = 4;
const MIN_LEAD = 2;

const zeroScores = (): IntentScores => ({ patios: 0, decks: 0, walls: 0, driveways: 0 });

/** How much of a signal is left after `ageMs`. */
const fade = (ageMs: number): number => Math.pow(0.5, Math.max(0, ageMs) / HALF_LIFE_MS);

function serviceOf(text: string): HomeService | null {
  const lower = text.toLowerCase();
  return INTENT_RULES.find((rule) => rule.pattern.test(lower))?.service ?? null;
}

/** Interest shown in one session. */
export function scoreSignals(signals: IntentSignals): IntentScores {
  const scores = zeroScores();

  const searched = serviceOf(signals.utmText);
  if (searched) scores[searched] += UTM_POINTS;

  const pages = zeroScores();
  for (const path of new Set(signals.pagePaths)) {
    const service = serviceOf(path);
    if (service) pages[service] = Math.min(PAGE_CAP, pages[service] + PAGE_POINTS);
  }

  const clicks = zeroScores();
  for (const label of signals.clickLabels) {
    const service = serviceOf(label);
    if (service) clicks[service] = Math.min(CLICK_CAP, clicks[service] + CLICK_POINTS);
  }

  for (const service of HOME_SERVICES) scores[service] += pages[service] + clicks[service];
  return scores;
}

/** Store a session's latest score, keeping only the most recent sessions. */
export function recordSession(prior: IntentProfile | null, sessionId: string, scores: IntentScores, now: number): IntentProfile {
  const sessions = { ...(prior?.sessions ?? {}), [sessionId]: { scores, at: now } };
  const newest = Object.entries(sessions).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_SESSIONS);
  return { sessions: Object.fromEntries(newest) };
}

/**
 * The visitor's interest right now. Every remembered session fades with its
 * age, and so does a saved estimate, from the day it was saved.
 */
export function totalAt(profile: IntentProfile, now: number, estimate: SavedEstimate | null = null): IntentScores {
  const out = zeroScores();
  for (const { scores, at } of Object.values(profile.sessions)) {
    const left = fade(now - at);
    for (const service of HOME_SERVICES) out[service] += scores[service] * left;
  }
  for (const service of HOME_SERVICES) out[service] = Math.min(HISTORY_CAP, out[service]);

  const priced = estimate ? ESTIMATE_TYPE_SERVICE[estimate.projectType] : undefined;
  if (estimate && priced) out[priced] += ESTIMATE_POINTS * fade(now - estimate.savedAt);
  return out;
}

/** The segment to show, or "default" when no interest is clear enough. */
export function segmentOf(scores: IntentScores): HomeSegment {
  const ranked = [...HOME_SERVICES].sort((a, b) => scores[b] - scores[a]);
  const [top, runnerUp] = ranked;
  if (scores[top] < MIN_SCORE || scores[top] - scores[runnerUp] < MIN_LEAD) return 'default';
  return top;
}

/** Validates a segment name from a URL parameter or storage. */
export function parseSegment(value: string | null | undefined): HomeSegment | null {
  if (value === 'default') return 'default';
  return (HOME_SERVICES as readonly string[]).includes(value ?? '') ? (value as HomeService) : null;
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * A stored profile, read back. Anything that is not exactly the expected shape
 * is dropped, so an old or damaged value can never produce a NaN score.
 */
export function sanitizeProfile(value: unknown): IntentProfile | null {
  const sessions = (value as { sessions?: unknown } | null)?.sessions;
  if (!sessions || typeof sessions !== 'object') return null;
  const clean: IntentProfile['sessions'] = {};
  for (const [id, entry] of Object.entries(sessions as Record<string, unknown>)) {
    const { scores, at } = (entry ?? {}) as { scores?: Record<string, unknown>; at?: unknown };
    if (!scores || !isFiniteNumber(at) || !HOME_SERVICES.every((service) => isFiniteNumber(scores[service]))) continue;
    clean[id] = { scores: { patios: scores.patios, decks: scores.decks, walls: scores.walls, driveways: scores.driveways } as IntentScores, at };
  }
  return { sessions: clean };
}

/**
 * The town the visitor has been reading about: the latest viewed path that is
 * a location page or ends in a town key. Barrie is in most service URLs, so it
 * only counts on its own location page.
 */
export function cityFrom(pagePaths: string[], townKeys: readonly string[]): string | null {
  for (let i = pagePaths.length - 1; i >= 0; i -= 1) {
    const path = pagePaths[i].replace(/\/+$/, '');
    for (const key of townKeys) {
      if (path === `/locations/${key}`) return key;
      if (key !== 'barrie' && path.endsWith(`-${key}`)) return key;
    }
  }
  return null;
}
