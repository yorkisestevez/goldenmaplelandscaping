# Golden Maple business-facts cleanup — final local handoff

**Status: LOCAL REMEDIATION COMPLETE / VERIFIED. Not deployed or owner-fact certification.**

**Owner phone update, 2026-09-05:** Public contact is now Sophie voice agent at **(705) 300-8015**. The owner's personal number was removed from active public contact data. Website and PDF rebuilt; full integrated verification passed again. A scan of 231 built text assets and the extracted PDF found no personal-number occurrences. See `business-facts-audit/sophie-phone-verification.json`. No telephony routing changes or deployment occurred.

The final integrated run completed successfully at `2026-09-05T16:54:33.084273+00:00`. Its machine-readable receipt is [`business-facts-audit/final-verification.json`](business-facts-audit/final-verification.json); individual command logs are beside it. This supersedes the earlier partial/blocked assessment for the local technical cleanup, but not the outstanding owner-confirmation ledger.

## Delivered
- Canonical business/contact configuration and publication controls adopted across components, pages, articles, generated llms content, schema and chat fallbacks.
- Unverified testimonials, portfolio records and associated gallery images withheld; routes and source records preserved. Public fallback copy describes project planning rather than displaying internal verification notices.
- Removed targeted unsupported review, certification, insurance, blanket warranty, free/design-credit, universal excavation, engineering-handled, service-coverage, lead-time and quote-accuracy promises.
- Corrected named-person article authorship schema and conflicting BlogPostLayout configuration references.
- Corrected estimator display and raw output descriptions without changing calculations. Added an accessible estimator heading and mobile call-link label.
- Rebuilt the 13-page downloadable cost guide from its existing generator. Original preserved; price data retained as illustrative planning information rather than quotes or completed-job evidence. Added PDF binary Git attributes to protect cross-reference offsets from EOL conversion.
- Strengthened publication regression checks for independent-review false negatives. Renamed browser gate status to `publication_check_passed` so it cannot be mistaken for deployment approval.
- Fixed verification runner shell resolution by selecting the explicit Git Bash executable. Moved numeric-preservation testing off an ephemeral `/tmp` path to a preserved baseline derived from Git HEAD.

## Fresh verification
| Check | Actual result |
|---|---|
| Business publication/boundary/estimator/llms tests | PASS |
| TypeScript, lint and existing pricing gates | PASS |
| Estimator engine snapshot | PASS across 45 fixtures |
| Deep numeric preservation | 76 approved description-only changes; 0 numeric differences; 0 key changes |
| Component publication checks | PASS |
| Chat fallback, validation and synthetic prompt tests | PASS; no external requests |
| Production build and expanded postbuild gates | PASS |
| Prerendered claims | 104 routes, 293 JSON-LD blocks, 0 targeted findings |
| Canonical-contact static scan | PASS, 0 findings |
| Local mobile browser | 11 pages, all HTTP 200; no horizontal overflow or page errors; 0 submissions |
| Browser claim check | PASS, 0 findings |
| Offline migration-artifact integrity | PASS |
| Git whitespace check | PASS |
| Protected route/hosting configuration | No diff in src/routes.ts, react-router.config.ts or netlify.toml |
| Reviewed PDF vs build copy | Byte-identical |

Latest homepage/portfolio mobile crops were visually inspected: no obvious clipping or overlap and no internal verification boilerplate. PDF contact sheet was inspected for layout breakage. This is scoped visual QA, not a complete accessibility audit.

## Evidence and reproduction
- Integrated receipt/logs: `docs/business-facts-audit/final-verification.json`, `final-*.log`.
- Numeric proof: `docs/business-facts-audit/engine-copy-only-proof.json` and `estimator-snapshot.before-copy-only.json`.
- Browser proof: `docs/business-facts-browser-proof/proof.json`, `claim-gate.json`, route screenshots, `final-mobile-top.png`.
- Revised PDF: `public/downloads/2026-simcoe-county-backyard-cost-guide.pdf`.
- PDF SHA-256 after owner phone update: `4f7fda583c89981133534757fa1f7c324822347786f1267b133d5de24a5ad531`.
- Reproduce: `python3 scripts/verify-business-cleanup.py` from the repository, with the existing read-only localhost preview on port 4187 and browser-operator Python environment available.

## Authority, limitations and remaining owner decisions
No commit, push, deployment, production redirect, 410, URL deletion, CRM/customer mutation, form submission, hosting/account change or paid service was performed. Existing route and hosting configuration is unchanged. Local form/chat testing does not validate production lead delivery.

`BUSINESS_FACTS_REQUIRING_CONFIRMATION.md` remains authoritative for unresolved phone ownership, address visibility, commercial terms/minimums, warranty, coverage/credentials, manufacturer authorization, financing, permit/subcontractor responsibilities, review/photo/project evidence and active service areas. Current configured contact values are the preserved public baseline, not newly verified ownership. Pending claims have not been silently promoted to confirmed.

The checks target identified business assertions; they do not independently validate every educational/legal/material comparison or historical market-price statement. PDF ranges remain illustrative legacy data. Mobile CrUX field data remains unavailable; no CWV pass is claimed. SEO migration proposals remain offline, owner-confirmation-gated, with unavailable search/backlink evidence unknown rather than zero.

## Recovery
Pre-remediation sources: `docs/business-facts-audit/source-before-final-pass.zip`. Original PDF and extracted text remain in the same audit directory. Use those with the scoped Git diff for selective restoration; do not reset unrelated uncommitted work. No production rollback is needed because nothing was deployed.

**Next decision:** owner review of facts and a separate deployment authorization. Local cleanup has no remaining known technical blocker within the tested scope.
