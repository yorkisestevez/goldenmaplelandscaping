# Case study intake — one sheet per job

This sheet turns a finished Golden Maple job into a case study page, for example `/portfolio/barrie-bungalow-patio/` → "How this project was built". **Only answer what you actually know.** Skip anything you don't. Every answer is published as a fact attested by you, with the date and the record it came from. Nothing gets estimated or filled in for you.

Answer by voice memo, text or email. Claude turns the answers into the `caseStudy` block in `src/data/projects.ts`, and `npm run lint` (`scripts/check-case-studies.ts`) rejects any field that is missing an attestation.

## The job

| Question | Field | Example |
|---|---|---|
| Which portfolio project is this? (or a new one, with its town) | project slug | `barrie-bungalow-patio` |
| What problem did the homeowner need solved? | `problem` | "Patio sank at the door and water pooled against the foundation" |
| Roughly how many square feet? | `areaSqFt` | 620 |
| How deep did you excavate? (inches) | `excavationDepthIn` | 14 |
| What went into the base? | `base` | "Geotextile + compacted 3/4-inch clear stone" |
| What was the bedding layer? | `bedding` | "HPB (high-performance bedding)" |
| Which paver or slab? (brand + product) | `paverProduct` | Permacon · Lafitt |
| What did you do for drainage? | `drainage` | "Regraded 2% away from the house; downspout into a dry well" |
| How many working days on site? | `durationDays` | 6 |
| Which budget bracket? | `budgetBracket` | under-13k · 13k-25k · 25k-50k · 50k-100k · 100k-250k · 250k+ |
| Where does each answer come from? | `source` | "job sheet", "invoice #1042", "voice memo 2026-10-02" |

The budget bracket is published as a range, never as the exact price.

## Construction-stage photos (the real moat)

Take one photo at each stage and send the originals. Each one goes through the photo register, `scripts/portfolio-sources.mjs`, so the owner-attestation rule still applies. **Keep crew faces out of frame.**

1. **Before**: the original yard or failing surface
2. **Excavation**: the dug-out area with the depth visible (a tape measure in frame is ideal)
3. **Base**: geotextile down, stone compacted
4. **Bedding**: screeded bedding layer
5. **Laying**: pavers going down, cuts and borders
6. **Finished**: same angle as "before" if you can

## What won't be published even if it's on the sheet

- Customer names, addresses or anything else that identifies the homeowner
- Testimonials. These need a separate consent record.
- Warranty terms, certifications or insurance amounts. These come from the business register only.
