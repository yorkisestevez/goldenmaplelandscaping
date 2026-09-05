# Business facts requiring owner confirmation

**Purpose:** This register separates facts currently published in the site from facts verified by Golden Maple. A public claim is **evidence that it was published**, not evidence that it is true, current, authorized, or suitable for schema. Until resolved, the centralized config marks these items `published_unverified`, `conflicting`, or `unknown` and avoids review/aggregate-rating schema.

## Decisions needed

1. **Public phone — resolved by owner, 2026-09-05:** Publish **(705) 300-8015**, Sophie’s voice-agent number. **(705) 500-3581** is Yorkis’s personal number and must not appear in public contact outputs. This is publication approval, not independently tested telephony routing. **(705) 790-3838** remains unconfirmed and must not be published or routed without approval.
2. **Address policy** — Is the business operated from a residential address? Should a street address be public, or should the site remain a service-area business showing only Barrie, Ontario?
3. **First visit / consultation** — Is the first on-site visit free? Confirm the distinction among a free discovery call, a free estimate request, an on-site consultation, and a paid design session.
4. **Design** — What is the current paid design price (or range), what is included, and is any fee credited to construction? If credited, is it full or partial and under what conditions?
5. **Minimum project investment** — Is there a universal minimum? If not, provide the current minimum by service and whether repair/small-work exceptions exist.
6. **Five-year warranty** — Is there a five-year workmanship/sink-and-settlement warranty? Provide the exact contractual coverage, exclusions, remedy, transferability, start date, and whether decks/walls/design are covered.
7. **Paver credential** — Is **CMHA Certified Concrete Paver Installer** the current credential? Is **ICPI** obsolete terminology or still an accurate certification? Provide credential holder, certificate/proof, and expiry if applicable.
8. **Techo-Pro** — Is Golden Maple currently Techo-Pro? Provide the current status, account/certificate holder, and whether the logo/claim may be public.
9. **Permacon** — Is Golden Maple an authorized or certified Permacon contractor? State the exact authorized wording and proof.
10. **Payment / financing** — Is formal third-party financing offered? If not, are progress payment schedules the only payment approach? Provide only approved public wording.
11. **Permits** — Does Golden Maple apply for permits directly, coordinate applications, or leave the application to the client? Who pays municipal, engineering, ESA, gas, and other fees?
12. **Subcontractors** — Which work, if any, is subcontracted? What public disclosure/quality-control policy is approved?
13. **Testimonials** — Which testimonials are genuine, approved for publication, and traceable to a source/consent record? Names, project type, date, source URL, and consent status are needed before reuse in structured data.
14. **Portfolio** — Which displayed projects are genuine Golden Maple work? Provide a project-provenance register (project ID/location granularity, completion date, owner permission, source photos).
15. **Photo rights** — For every customer-facing photo, is it owned by Golden Maple, licensed, supplier-provided, stock, or AI-generated? Provide license/permission or removal/replacement direction.
16. **Active municipalities** — Confirm the active primary service municipalities and any secondary/travel-area municipalities. Are Orillia, Wasaga Beach, Midland, and Collingwood actively served today?

## Source contradictions and publication-only claims found in the current repo

| Topic | Existing source(s) | Conflict / reason not treated as verified |
|---|---|---|
| Design pricing and credit | `public/llms.txt`: `$99` session credited to project; `src/data/serviceLocations.ts`: `$2,500–$8,000` design fee and `100%` credited | Conflicting amounts and terms. |
| Consultation / first visit | `public/llms.txt`: no-free-site-visit model + free discovery call; `/contact` says “Get a free estimate”; `/book` says no-fee 15-minute phone call | “Estimate,” on-site visit, and design session are not consistently defined. |
| Minimum investment | `public/llms.txt` lists service-specific minimums; pages and estimator contain other pricing messages | No confirmed universal or exception policy. |
| Warranty | `public/llms.txt`, root/service copy claim a five-year sink/settlement warranty, while `CompositeDecking.tsx` claims a 10-year craftsmanship warranty | Exact contractual scope, exclusions, remedy, transferability, and service applicability are not in a source of record. |
| Manufacturer product warranties | `serviceLocations.ts`, `CompositeDecking.tsx`, `carrPrices.ts`, and blogs reference 25-/50-year product/fade/stain warranties | These may be generic manufacturer information, not a Golden Maple assurance. Product/model, current manufacturer terms, exclusions, registration, and transferability require direct manufacturer documentation. |
| Credentials | `public/llms.txt` says “ICPI-certified installation”; service copy references ICPI specifications; requested CMHA status is absent | Certification versus installation-standard claims are conflated; current credential unverified. |
| Insurance / WSIB | `public/llms.txt` and trust bars claim WSIB and `$5M` liability | No current clearance/certificate or policy evidence in repo. |
| Reviews | Root JSON-LD previously contained `5.0`, `8` reviews and named review excerpts; `public/llms.txt` repeats the count. Owner context supplied a Google write-review URL/Place ID. | The supplied URL is owner-reported and not independently verified; it is not review evidence. Review and AggregateRating schema remain intentionally omitted. |
| Legal name | Owner context supplied **Golden Maple Landscaping Inc.** | Recorded as `owner_reported`, not independently verified registry evidence. |
| Address | Existing schema emits Barrie/ON/L4N without a street address; blog copy says contractors should have a physical business address | Public address policy remains unresolved. |
| Municipalities | Root schema and `llms.txt` name eight municipalities; dedicated location routes exist for four primary and a matrix exists for four secondary locations | Routes prove publication, not active service coverage. |
| Brands / authorization | `llms.txt` lists Techo-Bloc, Permacon, Unilock, Trex, TimberTech and others | Listing a brand does not establish current availability, installer authorization, certification, or manufacturer warranty terms. |
| Permits | Pages variously say Golden Maple handles permits, pulls correct permits, or gives jurisdiction-specific guidance | Responsibility, fees, and application authority are not consistently established. |
| Testimonials, portfolio, images | Testimonials and project images are published across the site; founder source documents an AI-generated portrait | No testimonial consent, project provenance, or image-rights register was found. |

## Implementation posture in this phase

- `src/data/business.ts` is the typed source of publication status and last-verified fields.
- Known-but-unverified public copy is retained as inventory, not promoted to a verified claim.
- New root and reusable schema omit `AggregateRating` and `Review` objects pending traceable evidence and approval.
- Existing route/content inventory is intentionally preserved pending the separate SEO/content review.
