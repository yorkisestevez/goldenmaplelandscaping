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

const AIO_PASS_2026_11_07: PageUpdate = {
  updatedOn: '2026-11-07',
  reviewedBy: 'yorkis-estevez',
  source:
    'Owner instruction 2026-11-07 (AiO audit prompt): service pages show "Last updated · Reviewed by Yorkis Estevez". Content changed that day in the AiO PR (process schema, founder block, booking window).',
};

/** Keyed by page path, or by template for the data-driven service pages. */
export const PAGE_UPDATES = {
  '/services/interlocking-barrie/': AIO_PASS_2026_11_07,
  '/services/retaining-walls-barrie/': AIO_PASS_2026_11_07,
  '/services/landscape-design-barrie/': AIO_PASS_2026_11_07,
  '/services/composite-decking-barrie/': AIO_PASS_2026_11_07,
  /** All pages rendered by BarrieServicePage (src/data/barrieServices.ts). */
  barrieServiceTemplate: AIO_PASS_2026_11_07,
  /** All /services/<service>-<town>/ pages rendered by ServiceLocation. */
  serviceLocationTemplate: AIO_PASS_2026_11_07,
  '/faq/': {
    updatedOn: '2026-11-07',
    source: 'Page created 2026-11-07 in the AiO PR from business.ts, the About page, llms.txt and the homepage questions.',
  },
} as const satisfies Record<string, PageUpdate>;

export type PageUpdateKey = keyof typeof PAGE_UPDATES;

/** Owner-supplied booking window, exact wording (AiO audit prompt, 2026-11-07). Plain text on service pages and /faq. */
export const BOOKING_WINDOW = 'Now booking Spring 2027 projects. A site visit is booked once scope and budget are confirmed.';
