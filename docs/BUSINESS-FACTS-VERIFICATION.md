# Independent verification verdict — business-facts cleanup

> Historical pre-remediation assessment. The local technical findings below have been addressed and freshly tested; see [the final local handoff](FINAL-BUSINESS-FACTS-HANDOFF.md) and its verification receipt. Original findings are preserved for audit. Owner fact confirmation and deployment approval remain separate.

## Verdict

**NOT RELEASE-READY. Phase 2 remains partial.** The implementation compiles and the new publication helper works, but old business assertions bypass it in rendered pages. This is a verification result, not a request to deploy.

## Fresh verification performed

- `npm run test:business`: PASS (publication gates; llms generation idempotency/resource retention).
- `npm run lint`: PASS (typecheck, pricing parity, 45 engine snapshot fixtures, 528 budget scenarios).
- `tsx scripts/check-chat-business-facts.ts`: PASS (three fallback paths, three input boundaries, one synthetic prompt assembly; zero external requests).
- `npm run build`: PASS; llms regenerated and routes prerendered. React Router future-flag notices only.
- `python3 scripts/verify-migration-artifacts.py`: PASS; initial and reviewed maps each cover 129 unique source URLs; empty/duplicate/missing-row fixtures rejected. This verifies saved crawl artifacts, not a fresh recrawl or offering approval.
- `scripts/check-business-browser.py`: PASS for five local mobile routes at 390×844: HTTP 200, H1 present, no horizontal overflow, no page exceptions, no legacy number in inspected telephone links, no AggregateRating/ratingValue in inspected JSON-LD.
- `scripts/check-rendered-business-claims.py`: **FAIL, exit 1 — 14 known-disputed-claim findings across all five inspected routes.** See `business-facts-browser-proof/claim-gate.json`.

## Material blockers reproduced in rendered output

1. `/`: 5.0 Google rating / 8 verified reviews, WSIB/$5M claims, 12–16-inch base language and broad warranty promises persist outside the replacement trust bar.
2. `/contact/`: “OUR CREDENTIALS” still asserts WSIB, $5M and five-year structural warranty.
3. `/about/`: unverified insurance and blanket five-year craftsmanship warranty on all installations remain.
4. `/services/interlocking-innisfil/`: embedded quote widget still displays “5.0 · 8 REVIEWS,” free-estimate/no-fee wording; footer still asserts insurance/warranty.
5. `/locations/orillia/`: quote widget and location trust strip still assert rating/count, WSIB, insurance and warranty.
6. Literal contact scan found 25 source files outside business.ts containing the current hardcoded tel/mailto pattern, including analytics.ts. Thus changing central contact values would still leave stale consumers. Analytics matching needs compatibility-aware handling, not blind text replacement.
7. `Testimonials.tsx` still renders unverified named quotations under “Published client-story inventory” with a pending consent/source disclaimer. This is neither approval/traceability nor acceptable final customer-facing copy. Gate unapproved records while preserving the source inventory; do not treat a disclaimer as validation.
8. Existing pricing-parity checks explicitly protect the 12–16-inch/12-inch engine baseline and no-estimator-minimum behavior. Passing those checks does not resolve the newer owner-reported 10/24-inch conflict or business minimum policy. Do not silently change pricing engines to make editorial checks green.

## Visual and test limitations

Mobile homepage header, settled headline and sticky actions rendered without horizontal clipping in the inspected crop. The initial screenshot caught entrance-animation opacity; the harness now waits for the H1 ancestor opacity to settle. Public fonts/analytics/other external requests were blocked in this local test; it is not a live performance test or full accessibility certification. No forms were submitted, no call links clicked, and no customer data was created. Other routes and full consent/portfolio/photo provenance still require review.

## Evidence

- `business-facts-browser-proof/proof.json` — rendered text/schema/contacts/canonical/status evidence.
- `business-facts-browser-proof/claim-gate.json` — specific failing routes and excerpts.
- `business-facts-browser-proof/*.png` — local mobile captures.
- `seo-migration/independent-verification.json` — saved inventory/map structural proof.

## Next correction scope

Finish config adoption in every reusable/contact/schema consumer, gate all unresolved business assertions at their actual rendering source, preserve original disputed content as non-public audit inventory, and add rendered-claim checks to the verification path. Then rebuild and repeat mobile checks. Owner decisions remain required before promoting claims or implementing redirects.

No production deploy, push, redirect activation, broad content deletion, credential/security change, provider spend or customer mutation was performed in this verification pass. Source changes in this pass are limited to verification harnesses and reports.
