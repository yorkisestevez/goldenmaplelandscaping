# DeckCraft framing engine: sources and design basis

The framing engine is in `src/features/deckcraft/structure/`. It places beam rows, posts, joists and blocking for
each rectangular zone of a deck. It was written in September 2026 from the public references below, replacing a
ported third-party engine.

Every number it uses is in `structure/tableData.ts`, in the units the source publishes and with the source named.
`scripts/check-deck-structure.ts` pins those numbers and checks the framing rules over 5,184 zones.

These are planning assumptions for a design and estimating tool. They are not an engineering certification or a
permit approval. A permit drawing still goes through the municipality's review, or a P.Eng where the guides call
for one.

## Sources

| Id | Reference | Used for |
|---|---|---|
| `obc2024` | MMAH, *2024 Building Code Compendium*, Vol. 1: O. Reg. 163/24, Div. B Part 9, January 16, 2025 update | Joist spans (Table 9.23.4.2.-A), 3-ply beam spans (Table 9.23.4.2.-H), blocking rows (9.23.9.4) |
| `barrie2026` | City of Barrie Building Services, *Deck Specs*, Summer 2026 | Beam cantilever (12 in), 6 in pier above grade, "beam same depth as joists", confirms the joist table |
| `springwater2026` | Township of Springwater, *Building Guide – Decks*, March 3, 2026 | Joist cantilever by size (16/24/24 in), 2-ply beam spans (supported length ≤ 3.6 m) |
| `orillia2025` | City of Orillia, *Wood Deck – Structural Sizing Tables, OBC 2024*, sheets D01a–D01d, July 2025 | Joist cantilever at most 1/6 of the joist span |

The O. Reg. 332/12 (2012 code) table numbers still quoted by several Simcoe guides (A-1, A-8) are the old names of
Tables 9.23.4.2.-A and 9.23.4.2.-H.

## Load basis

- **The tables use 1.9 kPa.** That is the Part 9 residential floor load behind the Tables 9.23.4.2 spans.
- **Barrie is within it.** OBC 9.4.2.3.(1) designs a deck serving a single dwelling for the greater of its specified
  snow load and 1.9 kPa.
  - Barrie's climate data (SB-1, 2024) is Ss 2.5 kPa and Sr 0.4 kPa.
  - That gives a snow load of 0.55 × 2.5 + 0.4 = 1.775 kPa, below 1.9 kPa, so 1.9 kPa governs.
- **Sites where snow governs are outside the tables.** Where 0.55·Ss + Sr exceeds 1.9 kPa, the tables don't apply.
  Penetanguishene is the example, at 1.94 kPa.

## Tables used

**Joists:** S-P-F No. 1/No. 2, "with bridging" column (OBC Table 9.23.4.2.-A). Spans are clear spans, rounded down
to the inch.

| Joist | 12 in o.c. | 16 in o.c. |
|---|---|---|
| 2x8 | 3.81 m (12 ft 6 in) | 3.58 m (11 ft 8 in) |
| 2x10 | 4.44 m (14 ft 6 in) | 4.17 m (13 ft 8 in) |
| 2x12 | 5.01 m (16 ft 5 in) | 4.71 m (15 ft 5 in) |

Barrie prints the same table, with 2x8 at 16 in as 11 ft 9 in and 2x12 at 16 in as 15 ft 6 in. The engine keeps the
code's rounded-down values.

**Beams, 3-ply:** OBC Table 9.23.4.2.-H, S-P-F No. 1/No. 2, clear span in metres by supported length (m).

| Supported length | 3-2x8 | 3-2x10 | 3-2x12 |
|---|---|---|---|
| 2.4 | 3.07 | 3.92 | 4.57 |
| 3.0 | 2.85 | 3.52 | 4.09 |
| 3.6 | 2.63 | 3.22 | 3.73 |
| 4.2 | 2.44 | 2.98 | 3.46 |
| 4.8 | 2.28 | 2.79 | 3.23 |
| 5.4 | 2.15 | 2.63 | 3.05 |
| 6.0 | 2.04 | 2.49 | 2.89 |

The engine reads the next longer row rather than interpolating.

**Beams, 2-ply:** Springwater's table, for a supported length of 3.6 m or less. 2-2x8 spans 5 ft 10 in, 2-2x10
spans 7 ft 2 in and 2-2x12 spans 8 ft 4 in. The code table has no 2-ply column.

**Supported length:** half the joist span on each side of the beam, plus any joist cantilever in full. This follows
OBC note 3 and Barrie's "half of joist span + cantilever".

**Cantilevers:**
- Joists: at most 16 in for 2x8 and 24 in for 2x10 and 2x12 (Springwater, Severn, Innisfil, Oro-Medonte, Collingwood,
  CWC). They are also held to 1/6 of the joist span behind the beam (Orillia D01a).
- Beams: at most 12 in past the end post (Barrie, Springwater).

**Blocking:** rows not more than 2100 mm (82 in) apart, and not more than that from a bearing. The "with bridging"
spans assume this.

## Golden Maple layout choices (inside those limits)

- **Beam rows:** the fewest that keep every joist span within the table. Each free end is cantilevered as far as the
  cantilever rule allows, rounded down to the inch.
- **Freestanding decks:** a house-side beam, set in by the same cantilever as the front. Zones along one house edge
  share the smallest of those, so the house-side beam is one straight line.
- **Beam size:** designs saved before the structural review keep joist-depth lumber, as in Barrie's "same depth as joists" template. A new design (`2026-10-struct`) picks the beam on its own: the shallowest 2-ply that can stand 8 ft apart, otherwise the shallowest 3-ply that can.
  - 2-ply when its posts can stand at least 8 ft apart; otherwise 3-ply.
  - Hem-Fir and D.Fir-L change joist spans only (with-bridging cells whose S-P-F column matches Table 9.23.4.2.-A). Beams stay on the S-P-F tables, and the design says so.
- **Posts:**
  - Posts sit 12 in in from the beam ends and are evenly spaced within the beam's span.
  - They are never closer than 24 in, so two pier footings don't overlap (the rule
    yorkisestevez/goldenmaplelandscaping#102 set).
  - A beam shorter than 4 ft stands on one centre post. That is the only case where a beam overhangs more than 12 in:
    up to 2 ft.
- **Beam mount:** a drop beam needs its underside at least 6 in above grade (Barrie's 6 in of pier; at the lowest,
  the beam sits in a saddle on the pier). Lower decks set the beam flush with the joists.
  - Joists hung on a flush beam cannot cantilever past it, so its outer face is the deck edge.
  - Landings frame the same way, with beams on both edges, because their stringers bear there.
- **Joists:** laid out from the rim at the chosen spacing, with rim joists at both ends. Blocking rows are evenly
  spaced so no gap exceeds 82 in.

## Where the sources disagree, and what the engine does

- **Joist cantilever:** Barrie allows 24 in for every size, and most other guides allow 16 in for 2x8. The engine
  uses the stricter rule, 16 in, plus the 1/6 limit.
- **2-ply beams:** Severn prohibits them, and the code table has none. The engine uses Springwater's 2-ply values only
  up to their stated 3.6 m supported length.
- **Ledger on brick veneer:** Barrie prohibits it. A new design blocks a ledger when the house cladding is brick, stone, ledgestone, fieldstone, Norman brick or Roman brick, and frames a house-side beam instead. Saved designs keep the ledger they were quoted with.
- **Snow outside Barrie:** Barrie (Ss 2.5, Sr 0.4) stays on the 1.9 kPa tables. Toronto uses a published summary (Ss 1.4, Sr 0.4; confirm SB-1) that still leaves 1.9 kPa governing. Simcoe County, Burlington–Oakville and Rural-Other warn that they are not the Barrie station. Penetanguishene at about 1.94 kPa remains the example of a site outside the tables.
- **Footings, guards, stairs and posts** on a new design are checked in `structure/structuralReview.ts`. Pier diameter uses a DeckCraft planning bearing (unknown/clay 75 kPa, sandy 150 kPa, fill 50 kPa), not an OBC table. Post knee-brace (72 in), 6x6 (108 in) and freestanding (48 in) limits are planning thresholds; OBC 9.17.4.1 only sets the 140 mm minimum post. Guards use 600 mm (OBC 9.8.8.1.(1)). Stair rise and run use Barrie's print of Table 9.8.4.1 (125–200 mm, 255–355 mm). A handrail is required above 3 risers (OBC 9.8.7.1.). Frost depth is 48 in (1.2 m, OBC 9.12.2.2) unless the deck is floating or on helical piles or deck blocks.
- **Posts:** Barrie and the code (9.17.4.1) call for 6x6 posts; some guides allow 4x4. Post sizing is priced
  elsewhere in the takeoff, not in this engine.
