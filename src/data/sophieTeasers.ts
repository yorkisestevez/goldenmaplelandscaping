import { underPath } from '../utils/trailingSlash';
import type { QuickProject } from './sophieQuoteOptions';

/** Sophie's one proactive nudge per session: a page-aware line beside the launcher. Copy stays
 *  claim-free (no prices, ratings, warranty terms or "free") — the numbers come from the estimator-backed range. */

export const COST_CHIP = 'What would mine cost?';
export const BOOK_CHIP = 'Book a site visit';

export const TEASER_DELAY_MS = 8000;
export const TEASER_SCROLL_RATIO = 0.4;
export const TEASER_AUTOHIDE_MS = 14000;
export const TEASER_STORAGE_KEY = 'gm_sophie_teaser';

export interface Teaser {
  /** Analytics label for the page family. */
  key: string;
  line: string;
  chips: readonly [string, string];
  /** Project the 3-tap range starts on, when the page says what it is. */
  project?: QuickProject;
}

const CHIPS = [COST_CHIP, BOOK_CHIP] as const;

/** Where a nudge gets in the way: legal pages, the booking/contact forms, and the estimator itself. */
const SUPPRESSED = ['/privacy', '/terms', '/book', '/contact', '/cost-guide/thank-you', '/cost-estimator', '/deck-designer'];

/** First match wins, so the more specific keywords come first. */
const PROJECT_KEYWORDS: ReadonlyArray<[RegExp, QuickProject]> = [
  [/retaining-wall|sloped/, 'wall'],
  [/deck/, 'deck'],
  [/full-backyard|luxury-landscape|landscape-design|outdoor-kitchen/, 'full'],
  [/walkway/, 'stone'],
  [/interlock|patio|paver|outdoor-living/, 'patio'],
];

const PROJECT_LINES: Record<QuickProject, string> = {
  patio: "Our estimator prices a patio's dig-out, base, pavers, labour and disposal. Give me a rough size and your town for your range.",
  stone: "Our estimator prices a walkway's dig-out, base, pavers, labour and disposal. Give me a rough size and your town for your range.",
  wall: "Our estimator prices a retaining wall by its length and height. Give me a rough length and your town for your planning range.",
  deck: "Decks are priced in our deck designer. Give me a rough size and I'll open it at that size for you.",
  full: "For a full backyard (patio, wall and lighting), give me a rough patio size and your town and I'll pull a planning range.",
};

const DEFAULT_LINE = "I'm Sophie. Pick the project, a rough size and your town, and I'll pull a planning range from our cost estimator.";

const normalize = (pathname: string) => (pathname.replace(/\/+$/, '') || '/').toLowerCase();

export function pickTeaser(pathname: string): Teaser | null {
  const path = normalize(pathname);
  // underPath, not quoted comparisons: the build rewrites quoted paths here to their slashed form (utils/trailingSlash.ts).
  if (SUPPRESSED.some((p) => underPath(path, p))) return null;
  const project = PROJECT_KEYWORDS.find(([re]) => re.test(path))?.[1];

  if (underPath(path, '/portfolio')) {
    return { key: 'portfolio', line: "If one of these builds is close to what you want, give me a rough size and your town and I'll pull a planning range.", chips: CHIPS, project };
  }
  if (path.startsWith('/resources/')) {
    return { key: 'resources', line: "When you're ready to price your own yard, give me a rough size and your town and I'll pull a planning range from our estimator.", chips: CHIPS, project };
  }
  if (project) return { key: project, line: PROJECT_LINES[project], chips: CHIPS, project };
  return { key: 'default', line: DEFAULT_LINE, chips: CHIPS };
}

export type TeaserMemory = 'seen' | 'dismissed' | null;

export function shouldShowTeaser(s: { pathname: string; stored: TeaserMemory; chatted: boolean; open: boolean }): boolean {
  return !s.open && !s.chatted && s.stored === null && pickTeaser(s.pathname) !== null;
}

/** First match wins: a "retaining wall for the patio" is a wall, a "deck and patio backyard" is a full backyard. */
const TEXT_PROJECTS: ReadonlyArray<[RegExp, QuickProject]> = [
  [/\b(whole|full|entire)\s+(back)?yard|\bbackyard\b/i, 'full'],
  [/\bretaining\b|\bwalls?\b|\bslope/i, 'wall'],
  [/\bdecks?\b|\bdecking\b/i, 'deck'],
  [/\bwalkways?\b|\bpathways?\b/i, 'stone'],
  [/\bpatios?\b|\binterlock|\bpavers?\b|\bdriveways?\b/i, 'patio'],
];

/** The project a visitor names in their own words, if any. */
export function projectFromText(text: string): QuickProject | undefined {
  return TEXT_PROJECTS.find(([re]) => re.test(text))?.[1];
}

/** Only plain "what does it cost" asks. Quote, estimate, free-visit and budget questions are policy
 *  questions that stay with the fact-gated model. */
const PRICE_QUESTION = /\b(cost|costs|price|prices|pricing|how much|ballpark)\b|\$/i;

export function isPriceQuestion(text: string): boolean {
  return PRICE_QUESTION.test(text);
}
