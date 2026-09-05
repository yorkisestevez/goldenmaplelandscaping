# SEO migration crawl and redirect-decision inventory

**Generated:** 2026-09-05T15:01:09.584652+00:00  
**Scope:** Read-only crawl only. No redirects, deletes, deployment, provider spend, authentication, GSC access, or CMS changes were performed.

## Coverage

- Old sitemap: `https://seo.goldenmaplelandscaping.ca/sitemap.xml`
- Current sitemap: `https://goldenmaplelandscaping.ca/sitemap.xml`
- Old sitemap URLs discovered: **129**
- Old page records written: **129**
- Current sitemap URLs discovered: **90**
- Old sitemap URLs represented in redirect inventory: **129**
- Coverage assertion (`old URL set == inventory source URL set`): **True**

## Decision safety

All **129** URLs are classified `OWNER_CONFIRMATION_REQUIRED`. This is deliberate: crawl/sitemap evidence can identify a candidate current-domain URL but cannot truthfully establish that the business currently offers an old service × municipality combination, nor authorize an executable redirect. No page is marked `410_NOT_OFFERED_OR_NO_VALUE` solely because it lacks a candidate. `proposed_destination` is explicitly separate from `confirmed_executable_redirect` (blank for every record).

Available taxonomy values are: `301_TO_EXACT_EQUIVALENT`, `301_TO_CLOSEST_RELEVANT_PAGE`, `KEEP_TEMPORARILY_FOR_REBUILD`, `410_NOT_OFFERED_OR_NO_VALUE`, `OWNER_CONFIRMATION_REQUIRED`.

## Files

- `raw-crawl-evidence.json` — robots responses, sitemap URL lists, and raw page-level crawl evidence including headers/direct+final status/canonical/indexability/on-page fields/internal links.
- `redirect-inventory.csv` and `redirect-inventory.json` — one decision record per old sitemap URL.
- `../scripts/audit-seo-migration.py` — reproducible read-only crawl command.

## Metrics unavailable by design

GSC clicks/impressions and off-site backlink data were **not accessible**: no credentials or third-party SEO data source were used. `NOT_ACCESSIBLE_NO_CREDENTIALS` means unknown, not zero.

## Required owner validation before any routing implementation

For each row: validate current service × municipality offering, correct market/phone/price/base/excavation claims, whether an exact/current target is actually appropriate, and only then fill `confirmed_executable_redirect` and choose a non-default disposition. Avoid homepage catch-alls; priority is exact combo → service → location → service-area. Use 410 only with evidence that the offering is not available and no honest relevant page exists.
