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
  /** Paths viewed this session, oldest first. */
  pagePaths: string[];
  /** Click and chat labels recorded this session. */
  clickLabels: string[];
  /** Project type of the visitor's most recent saved estimate, if any. */
  lastEstimateType: string | null;
}

export interface IntentProfile {
  /** Interest carried over from earlier sessions, as it stood at `carriedAt`. */
  carried: IntentScores;
  carriedAt: number;
  /** Identifies the session `session` was scored from. */
  sessionId: string;
  session: IntentScores;
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
const ESTIMATE_POINTS = 4;
const PAGE_POINTS = 2;
const PAGE_CAP = 6;
const CLICK_POINTS = 1;
const CLICK_CAP = 3;
/** Most interest that can be carried between sessions, so no habit becomes permanent. */
const CARRY_CAP = 12;
const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;
/** A segment needs this much interest, and this much more than the runner-up. */
const MIN_SCORE = 4;
const MIN_LEAD = 2;

const zeroScores = (): IntentScores => ({ patios: 0, decks: 0, walls: 0, driveways: 0 });

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

  const priced = signals.lastEstimateType ? ESTIMATE_TYPE_SERVICE[signals.lastEstimateType] : undefined;
  if (priced) scores[priced] += ESTIMATE_POINTS;

  return scores;
}

function decay(scores: IntentScores, ageMs: number): IntentScores {
  const factor = Math.pow(0.5, Math.max(0, ageMs) / HALF_LIFE_MS);
  const out = zeroScores();
  for (const service of HOME_SERVICES) out[service] = scores[service] * factor;
  return out;
}

/** The visitor's interest right now: faded carry-over plus this session. */
export function totalAt(profile: IntentProfile, now: number): IntentScores {
  const carried = decay(profile.carried, now - profile.carriedAt);
  const out = zeroScores();
  for (const service of HOME_SERVICES) out[service] = carried[service] + profile.session[service];
  return out;
}

/**
 * Fold a session's scores into the stored profile. Within one session the
 * scores are replaced, never added, so re-scoring on every page view cannot
 * inflate them. A new session carries the faded total of the last one forward.
 */
export function nextProfile(prior: IntentProfile | null, sessionId: string, session: IntentScores, now: number): IntentProfile {
  if (!prior) return { carried: zeroScores(), carriedAt: now, sessionId, session };
  if (prior.sessionId === sessionId) return { ...prior, session };
  const ageMs = now - prior.carriedAt;
  const faded = decay(prior.carried, ageMs);
  const lastSession = decay(prior.session, ageMs);
  const carried = zeroScores();
  for (const service of HOME_SERVICES) carried[service] = Math.min(CARRY_CAP, faded[service] + lastSession[service]);
  return { carried, carriedAt: now, sessionId, session };
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
