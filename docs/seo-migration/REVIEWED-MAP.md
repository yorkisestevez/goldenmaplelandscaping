# Reviewed URL map — use this over lexical candidates

The initial `redirect-inventory.*` files preserve the crawl worker's lexical candidates. **Use `reviewed-redirect-map.csv` / `.json` for owner review instead.** Token overlap is not sufficient evidence of equivalent search intent (e.g. pool decking must not be confused with composite decking or a location with the wrong city).

## Verified scope

- 129 old sitemap URLs have decision records; all 129 returned HTTP 200.
- Old-host robots.txt permits Googlebot crawling for all 129 observed URLs. Technical eligibility is not proof of indexing.
- 90 main-sitemap URLs were inspected for potential targets. The candidate search does not prove all routes absent from that sitemap were examined.
- 57 conditional proposed destinations; 72 intentionally blank where no honest same-market target was established.
- Every record remains `OWNER_CONFIRMATION_REQUIRED`; **zero executable redirects**.

## Matching safeguards

- Old homepage → main homepage is considered only for that one homepage.
- Prefer same-city retaining-wall/interlocking-family pages. Interlocking candidates for paver patios, driveways, walkways, and pool decks are **broader service-family matches**, not asserted exact equivalents.
- Where no corresponding service page was established, a same-city location page is a conditional fallback after service confirmation.
- Old service hubs have a consolidated-services review candidate where a neutral exact-service destination was not established.
- No redirects to a different city merely because it shares a service keyword.
- Oro Station is not silently equated to all Oro-Medonte.
- No 410 recommendation based solely on missing coverage data.
- The reviewed CSV retains full internal-link lists. External backlinks and GSC metrics are null with explicit evidence-status fields, not zero. Authenticated GSC access was not verified by this audit; an absence of queried credentials is not proof that the owner lacks access.

## Reproduction and proof

1. Run `scripts/audit-seo-migration.py` to refresh the public inventory.
2. Run `scripts/refine-migration-map.py` for the conservative semantic review.
3. Run `scripts/verify-migration-artifacts.py` for independent nonempty/unique/complete coverage and authority-boundary checks. The verifier rejects empty, duplicate, and missing-row fixtures.

These scripts write audit artifacts, not Netlify configuration. Refreshing the crawl can change candidates; re-review before approving a migration. Required next evidence is owner-approved active service/municipality coverage and an exact destination-content review, supplemented with GSC/link exports if accessible. See the root `BUSINESS_FACTS_REQUIRING_CONFIRMATION.md`.
