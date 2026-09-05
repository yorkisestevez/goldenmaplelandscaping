# Residual business-claim review — Phase 2 follow-up

**Scope:** source-level publication controls completed in this follow-up. This is an inventory and limitation record, not verification of any business fact. No content, routes, images, external listings, or production systems were published or changed.

## Implemented publication controls

| File | Change | Verification posture |
|---|---|---|
| `src/data/business.ts` | Added `owner_reported` status; registered owner-reported legal name **Golden Maple Landscaping Inc.** and Google review-link URL; added `canPublish`, `publicClaimCopy`, and shared conservative trust wording. | Owner-reported is explicitly **not independently verified**; only `confirmed` can become verified wording. |
| `src/components/PublicationTrustBar.tsx` | Added a reusable four-item conservative trust surface. | Used in Home, About, Services, Contact, and generated service-location pages. |
| `src/pages/services/ServiceLocation.tsx` | Replaced 5.0/8-star, WSIB, $5M, and 5-year assertions with `PublicationTrustBar`; schema URLs/provider/postal address now come from business config. | No review/aggregate-rating schema emitted. |
| `src/data/serviceLocations.ts` | Reworded template warranty, permit, design-fee/credit, and product-warranty language conservatively. | Manufacturer terms remain educational/product-specific and must be checked against current manufacturer documents; Golden Maple obligations are not asserted. |
| `src/components/Testimonials.tsx` | Removed rating stars/“Verified on Google” wording; labels content as pending source/consent confirmation and uses configured owner-reported review URL only for a leave-review link. | Existing quotations remain published inventory and are **not validated testimonials**. |
| `src/data/founder.ts` | Founder name/role and canonical URL now derive from the business config. | Existing portrait disclosure remains unchanged. |
| `scripts/generate-llms.ts`, `package.json` | Build now generates `public/llms.txt`; generator describes owner-reported status and preserves the structured content map. | Two-run byte-idempotency is automated. |

## Important unresolved/flagged claims

1. **Construction depth conflict:** published copy says 12–16 inches, while owner context says a 10-inch general minimum and 24 inches for driveways. `BUSINESS.construction.baseDepth` is `conflicting`; neither number is a universal public standard. Final depth belongs in project-specific written scope/engineering.
2. **Golden Maple warranties:** published five-year sink/settlement and composite-deck 10-year workmanship claims lack approved contract language. They are not represented as verified guarantees in the shared/template surfaces.
3. **Manufacturer warranties:** 25-/50-year TimberTech/Trex/other product claims are manufacturer-information candidates only. Current product, registration, exclusions, transferability, and installer status need direct manufacturer/source confirmation. They are not Golden Maple guarantees.
4. **Credentials/coverage:** WSIB, $5M liability, CMHA/ICPI, Techo-Pro, Permacon, TimberTech Pro, and similar certification/authorization language remains unverified unless owner supplies current proof.
5. **Permit handling:** “we handle all permits/applications/paperwork” is unresolved. Template generated-service FAQ now requires municipal/project confirmation. Hand-built service/location/blog pages may still contain legacy assertions (below).
6. **Consultation/design:** Free estimate/on-site visit, paid $99 vs $2,500–$8,000 design fee, and any construction credit are contradictory. Template and main Contact copy now request confirmation, but legacy route text persists.

## Remaining file-level residual inventory (not silently cleared)

The following source areas were intentionally **not** broadly rewritten because they contain route-specific editorial paragraphs, regulatory education, or pricing-engine-owned material. Review each against owner evidence before treating it as fact:

- `src/pages/locations/{Barrie,Innisfil,OroMedonte,Springwater}.tsx`: direct telephone/email literals; rating, free-visit, permit-handling, and warranty assertions.
- `src/pages/services/{Interlocking,CompositeDecking,RetainingWalls,LandscapeDesign}.tsx`: direct warranty/certification/permit/design-credit claims, including **10-year craftsmanship** and **up-to-50-year product** wording in `CompositeDecking.tsx`.
- `src/pages/process/{Completion,Construction,SiteAssessment}.tsx`: five-year warranty/certification-of-quality claims and published 12–16-inch construction language.
- `src/components/{ChatWidget,QuickQuote,EstimateLeadCapture,EstimateBreakdown,BuyersGuide,BookingScheduler,HeroContactForm,Manifesto,EstimateBookingCTA}.tsx`: direct phone literals and/or unverified rating, WSIB, coverage, warranty, free-site-visit, or quote claims.
- `src/pages/blog/**/*.tsx`: numerous legacy author-bio and article assertions involving reviews, WSIB/$5M, warranty remedies, permit practice, product warranties, and credentials. Some statements may be generic educational claims, but any wording that attributes an obligation, credential, authorization, current price, or installed-work outcome to Golden Maple requires confirmation.
- `src/data/carrPrices.ts`: “50-yr fade & stain warranty” is product pricing inventory; it must stay distinct from a Golden Maple warranty and should be source-checked on manufacturer documentation.

## Contact/config adoption status

`Layout.tsx`, `Contact.tsx`, `ServiceLocation.tsx`, `Testimonials.tsx`, `founder.ts`, root/SEO work from the prior phase, and the generator now consume centralized business data. Direct `tel:`/`mailto:` literals still exist in the residual components/pages above; they are explicitly **not claimed fully migrated** in this report. A follow-up should replace each with `publicContact.phoneTel`, `publicContact.phoneDisplay`, and `publicContact.email` while preserving analytics event names.

## Automated evidence

- `npm run test:business` — passed: publication gates/unknown reviews and llms generator two-run idempotency/resource retention.
- `npm run lint` — passed.
- `npm run build` — passed; it generated `public/llms.txt` before the production React Router build.

## Owner confirmation source

See `BUSINESS_FACTS_REQUIRING_CONFIRMATION.md` for the questions, source contradictions, and evidence required to promote a claim to `confirmed`.
