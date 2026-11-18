/**
 * Update and review records for the service pages and /faq — the ONLY source of
 * their visible "Last updated · Reviewed by" line, their WebPage.dateModified,
 * and (through that node) their sitemap <lastmod>.
 *
 * `updatedOn` is the date the page content last changed. When you change one of
 * these pages, change its date in the same commit; never set a date the content
 * did not change on. `reviewedBy` is set only where the owner recorded the
 * review (see `source`). Blog posts do not use this file: their dates live on
 * the post and their reviews in editorialReviews.ts.
 * scripts/check-page-updates.ts (npm run lint) validates every entry.
 */

export interface PageUpdate {
  /** ISO date the page content last changed — never in the future. */
  updatedOn: string;
  reviewedBy?: 'yorkis-estevez';
  /** Where the update/review is recorded. */
  source: string;
}

/** The four hand-built service pages: the owner confirmed he reviewed these. */
const REVIEWED_2026_11_07: PageUpdate = {
  updatedOn: '2026-11-07',
  reviewedBy: 'yorkis-estevez',
  source:
    'Owner answer 2026-11-07 (Claude Code AiO session): Yorkis reviewed the 4 hand-built service pages only. Content changed that day in the AiO PR (process schema, founder block, booking window).',
};

/** Template-rendered pages: content changed in the AiO PR, but no owner review is recorded. */
const UPDATED_2026_11_07: PageUpdate = {
  updatedOn: '2026-11-07',
  source: 'AiO PR 2026-11-07: template gained the freshness strip, founder block and booking window. Owner did not review these pages (answer 2026-11-07).',
};

/** Keyed by page path, or by template for the data-driven service pages. */
export const PAGE_UPDATES = {
  '/services/interlocking-barrie/': REVIEWED_2026_11_07,
  '/services/retaining-walls-barrie/': REVIEWED_2026_11_07,
  '/services/landscape-design-barrie/': REVIEWED_2026_11_07,
  '/services/composite-decking-barrie/': REVIEWED_2026_11_07,
  '/services/landscape-maintenance-barrie/': {
    updatedOn: '2026-11-07',
    source: 'Created for the owner-confirmed 2027 residential and commercial landscape maintenance rollout.',
  },
  /** Default for pages rendered by BarrieServicePage. Shared date: bump it on template edits that affect those pages. */
  barrieServiceTemplate: UPDATED_2026_11_07,
  /** All /services/<service>-<town>/ pages rendered by ServiceLocation. Shared date: bump it on any template edit. */
  serviceLocationTemplate: UPDATED_2026_11_07,
  '/faq/': {
    updatedOn: '2026-11-07',
    source: 'Page created 2026-11-07 in the AiO PR from business.ts, the About page, llms.txt and the homepage questions.',
  },
} as const satisfies Record<string, PageUpdate>;

export type PageUpdateKey = keyof typeof PAGE_UPDATES;

/** Owner-supplied booking window, exact wording (AiO audit prompt, 2026-11-07). Plain text on service pages and /faq. */
export const BOOKING_WINDOW = 'Now booking Spring 2027 projects. A site visit is booked once scope and budget are confirmed.';
