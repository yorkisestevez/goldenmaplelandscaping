# 2026 Simcoe County Backyard Cost Guide — PDF remediation receipt

## Scope and preservation

- **Public artifact remediated:** `public/downloads/2026-simcoe-county-backyard-cost-guide.pdf`
- **Generator found and remediated:** `build_cost_guide.py`
- **Original preserved before editing:** `docs/business-facts-audit/2026-simcoe-county-backyard-cost-guide.original.pdf`
- **Original SHA-256:** `a737775ef2d2814524400666b2636646ad68384681136eb6506c7ccc26f6fb49`
- **Original extraction:** `docs/business-facts-audit/2026-simcoe-county-backyard-cost-guide.original.extracted.txt`

The original and its text extraction are retained as audit evidence. No source pages, components, or configuration files were modified.

## Findings in the original

| Claim class | Original location | Resolution |
| --- | --- | --- |
| Completed-job provenance / “real numbers” | Cover; founder note; worked example | Replaced with clearly labelled illustrative planning ranges/examples; explicitly not a completed-project record, quote, or promised result. |
| Universal base-depth presentation | Founder note; tier II; sample budget; cost drivers; low-quote section | Replaced with project-specific base/drainage/site conditions and a written-scope confirmation requirement. |
| WSIB, $5M liability, 5-year warranty badges | Final page | Replaced with neutral requests for current WSIB/coverage documentation and written workmanship terms. |
| Free 15-minute discovery call | Timing page; final page | Replaced with “confirm current consultation and design scope.” |
| Paid design / credit policy | Not present in original PDF | Explicitly avoided adding a fee, free visit, or credit claim; the consultation language directs readers to confirm fees, deliverables, availability, and any credit. |
| Legacy phone `(705) 790-3838` | Not present in original PDF | No legacy-phone remediation was needed. The PDF retains only the primary canonical display number from `src/data/business.ts`: `(705) 500-3581`. |

## Verification

- Rebuilt from the corrected generator with `env -u PYTHONPATH python3 build_cost_guide.py`.
- Re-extracted the rebuilt PDF to `2026-simcoe-county-backyard-cost-guide.remediated.extracted.txt`.
- Rebuilt artifact: **13 pages**, **29,876 bytes**, SHA-256 `1cdfd4be3d4775de1e6b563c4a228a374d690477bcfb3817707b9c37750ab6e4`.
- Term scan returned zero occurrences for: `42 completed`, `completed jobs`, `WSIB CERTIFIED`, `$5M LIABILITY`, `5-YR WARRANTY`, `free 15-minute`, `14–16`, `12–16`, `16 inches`, `790-3838`, `$99 paid design`, and `100% credited`.
- The current canonical phone appears once.
- Original pricing tokens were retained, including the four budget-tier values, the `$55–$85` planning benchmark, and worked-example figures.
- Rendered all 13 pages to `pdf-remediation-render/page-01.png` through `page-13.png`, created `2026-simcoe-county-backyard-cost-guide.remediated-contact-sheet.png`, and visually checked the full contact sheet plus pages 2 and 13. No blank/overflow page, clipping, overlap, or inconsistent background was observed. The final-page contact bar and conservative documentation prompts are legible and contained.

Machine-readable verification details: `2026-simcoe-county-backyard-cost-guide.remediation-verification.json`.

## Residuals / boundaries

- The retained numerical ranges and material/comparison content are legacy guide planning data, not independently validated market research. The revised provenance, pricing, and worked-example wording makes the guide expressly illustrative and site/scope dependent; it is not a quote.
- Generic contractor-comparison statements and manufacturer/product descriptions remain educational content. They are not presented as current Golden Maple certifications, coverage, a 5-year warranty, a free visit, or a universal construction standard.
- No deployment, push, production, paid dependency, or external service was used.
