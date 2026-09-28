/**
 * Owner editorial reviews — the ONLY source for a "Reviewed by Yorkis Estevez"
 * byline, a WebPage.reviewedBy / lastReviewed node, or a Library pillar.
 *
 * Add an entry only after Yorkis has actually read the post for technical
 * accuracy (voice memo, chat or PR approval all count — record which in
 * `source`). Most posts were drafted by the weekly blog robot, so a blanket
 * "written by" or "reviewed by" would be false; both lists start empty.
 * scripts/check-editorial-reviews.ts (npm run lint) validates every entry.
 */

export interface EditorialReview {
  /** /resources/<slug> post slug. */
  slug: string;
  reviewedBy: 'yorkis-estevez';
  /** ISO date the review happened — on or after the post date, never in the future. */
  reviewedOn: string;
  /** technical = specs/claims checked; full = technical + voice/sign-off. */
  scope: 'technical' | 'full';
  /** Where the review is recorded, e.g. "PR #97 approval" or "voice memo 2026-10-02". */
  source: string;
}

export const EDITORIAL_REVIEWS: readonly EditorialReview[] = [];

/** Posts Yorkis wrote himself (not robot drafts). Drives Article.author = Person. */
export const AUTHORED_BY_FOUNDER: ReadonlySet<string> = new Set<string>();

export function reviewFor(slug: string): EditorialReview | undefined {
  return EDITORIAL_REVIEWS.find((r) => r.slug === slug);
}
