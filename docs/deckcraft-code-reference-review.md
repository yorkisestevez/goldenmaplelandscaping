# DeckCraft code reference sign-off

G-0 is a review register. Its eight references remain **confirm** until a qualified reviewer checks the exact text and the design's local applicability. The presence of a source URL alone does not close an item.

## Review record

For each entry in `src/features/deckcraft/drawings/codeReferences.ts`:

1. Obtain the current official document. For Ontario, start at [Ontario's Building Code](https://www.ontario.ca/page/ontarios-building-code), use the current 2024 Compendium, and record its filing or amendment date. Check [O. Reg. 163/24](https://www.ontario.ca/laws/regulation/r24163) and later amendments before treating an older copy as current.
2. Locate the exact clause or table, including edition, sentence and any conditions or footnotes. Compare the values and conditions to the note or calculation on S-1 through S-5.
3. Confirm the project's municipality and site conditions. Barrie's [Deck Specs](https://www.barrie.ca/media/4040) and Springwater's [deck guide](https://www.springwater.ca/media/qkdb5m4z/deck-guide-march-2026.pdf) are local guides; apply each only where appropriate.
4. Record `edition`, a direct `clauseEvidenceUrl`, `checkedBy`, `checkedOn` (YYYY-MM-DD), and a written `applicability` finding. Change `status` to `verified` only after all five fields are recorded. The permit builder rejects an incomplete verified record.
5. Rebuild and review G-0, the affected structural sheet, and the permit golden. Keep any unresolved reference stamped DRAFT.

| ID | Reference to check | Record the relevant drawing decision |
| --- | --- | --- |
| joists | OBC 2024, Table 9.23.4.2.-A | Joist size, spacing, grade, span and bridging |
| beams | OBC 2024, Table 9.23.4.2.-H | Ply count, supported length, beam span and bearing |
| blocking | OBC 2024, Article 9.23.9.4. | Bridging or blocking spacing |
| posts | OBC 2024, Article 9.17.4.1. | Post size and any exception |
| guards | OBC 2024, Article 9.8.8.3. | Height relative to grade and stair guard conditions |
| stairs | OBC 2024, Table 9.8.4.1. | Rise, run and scope of the cited table |
| barrie | City of Barrie, Deck Specs | Footing, ledger, post, guard and stair details used |
| springwater | Township of Springwater, Building Guide - Decks, March 2026 | Two-ply beam conditions and local use |

Document any mismatch as a design issue and correct the calculation or drawing before closing its reference.
