# Framing engine replacement: before and after

This compares the clean-room engine on `feat/deckcraft-clean-structure` with the engine it replaces.

- **Baseline:** production plus the crowded-footings fix, yorkisestevez/goldenmaplelandscaping#102 (owner-approved,
  not merged yet). That is what production will be once #102 merges, and this branch is built on it.
- **Sources:** the new engine is built only from public Ontario references; see `structure-sources.md`.
- **Designs:** the 213 in the legacy parity golden, with the same price book.

## Headline

- **The default deck is unchanged.** A 16 × 12 ft attached 2x10 deck keeps its price ($28,025.35) and its 3 footings.
- **Price:** 158 designs go down, 19 go up and 36 are unchanged.
  - The range is −2.04% to +2.34%; the median is −0.35% and the mean −$342 per design.
  - The unchanged designs still move in drawings or hardware positions: blocking rows go to code spacing, and edge
    beams move half a beam width in.
- **Structure across all 213 designs:**
  - beam lumber 36,974 → 32,436 ft (−12%);
  - footings 2,506 → 2,518 (+12);
  - joists 9,010 → 8,970;
  - blocks 55,348 → 54,948.
- **Crowded footings stay at 0.** No two posts stand less than 24 in apart, the #102 rule.

| Price change | Designs |
|---|---|
| −2.0 to −1.5% | 6 |
| −1.5 to −0.5% | 70 |
| −0.5 to 0% | 81 |
| unchanged (under 0.01%) | 38 |
| 0 to +0.5% | 6 |
| +1.5 to +2.4% | 12 |

## By design family (12 designs each: 4 patterns × 3 stair types)

| Family | Price change | Footings |
|---|---|---|
| big Multi-corner freestanding, 2 levels | −2.04 to −0.39% | −1 each |
| std L-Shape freestanding, 2 levels | −1.23 to −0.98% | same |
| big Curved attached | −1.20 to −0.08% | same |
| std L-Shape attached | −1.12 to −0.25% | same |
| big Rectangle attached | −1.07 to −0.51% | same |
| big Rectangle freestanding, 2 levels | −1.04 to −0.62% | same |
| big Curved freestanding, 2 levels | −0.80 to −0.24% | same |
| big Multi-corner attached | −0.68 to −0.34% | same |
| std Multi-corner freestanding, 2 levels | −0.63 to −0.40% | same |
| big L-Shape freestanding, 2 levels | −0.49 to −0.15% | same |
| std Rectangle freestanding, 2 levels | −0.47 to −0.31% | same |
| std Multi-corner attached | −0.36 to −0.24% | same |
| big L-Shape attached | −0.28 to 0.00% | same |
| std Rectangle attached | −0.24 to +0.02% | same |
| std Curved attached | −0.21 to +0.01% | same |
| **std Curved freestanding, 2 levels** | **+1.84 to +2.34%** | **+2 each** |

Stair, deck-type, border, foundation, fastener, railing, extras, accessory, lighting, screen and house scenarios are
unchanged in price.

## Why the numbers move

1. **Beams use joist-size lumber (Barrie's "same depth as joists").**
   - The old engine often used 4-ply 2x12 beams, for example on the 20 ft deep "big" decks and on low second levels.
   - The new engine uses 2-ply where Springwater's 2-ply span (supported length ≤ 3.6 m) still lets posts stand
     8 ft apart; otherwise 3-ply from the code's built-up beam table. For the default 2x10 framing that means 3-ply
     2x10, which the table allows at these spans without closer posts.
   - This is the 12% cut in beam lumber and most of the savings (framing −$457 on average over 166 designs).
2. **Joist cantilever:** at most 16 in for 2x8 and 24 in for 2x10/2x12 (Springwater and most Simcoe guides), and at
   most 1/6 of the joist span behind the beam (Orillia's OBC 2024 sheet).
   - The standard curved freestanding deck's curve varies by more than that 20 in allowance, so the deck splits into
     two beam lines. That adds 2 footings each, the only increase in the table.
3. **Beams:** at most 12 in past their end posts (Barrie, Springwater), and posts under one beam at least 24 in apart
   (#102).
   - A beam too short for both (under 4 ft) stands on one centre post, as #102 approved. That is the one place a
     beam may overhang more than 12 in: up to 2 ft on a 4 ft beam.
4. **Freestanding decks** get a house-side beam set in by the same cantilever as the front.
   - Every zone along the house edge shares one straight house-side beam.
   - A simple freestanding deck can then fit its depth in one joist span, not two. For example, 24 × 16 ft
     freestanding at 30 in and up goes from 9 footings to 6 (−5 to −6%).
5. **Low decks get flush beams.**
   - A drop beam needs its underside at least 6 in above grade: Barrie's 6 in of pier, with the beam in a saddle on
     it.
   - Below that, the beam is flush with the joists and the joists hang on it. There is no cantilever, and the edge
     beam's outer face is the deck edge. Landings frame the same way, with beams on both edges (the #102 rule).
   - For 2x10 framing, that means decks under about 26 in high.
   - The old engine switched at 18 in. Between 18 and 26 in it set drop beams whose undersides were below grade.
6. **Blocking rows** are at most 2100 mm (82 in) apart and from each bearing, as the code's "with bridging" joist
   spans assume. They were every 8 ft from the back before.

## Low decks and the site's FAQ price

The 213 saved designs are mostly at the default height, so this sweep shows the height effect. Each deck is the
default design at that size, and each figure is the priced portion before HST.

| Deck | 12 in | 18 in | 24 in | 30 in | 36 in | 96 in |
|---|---|---|---|---|---|---|
| 16 × 12 attached | same | same | same | same | same | same |
| 16 × 12 freestanding | same | same | same | same | same | same |
| 20 × 15 attached | same (6 footings) | **+7.0%**, 3 → 6 footings | **+6.8%**, 3 → 6 | same | same | same |
| 20 × 15 freestanding | same | **+5.9%**, 6 → 9 | **+5.8%**, 6 → 9 | same | same | same |
| 24 × 16 attached | −1.2% | −1.2% | −1.2% | −1.2% | −1.1% | −0.8% |
| 24 × 16 freestanding | −1.5% | −1.4% | −1.4% | **−6.3%**, 9 → 6 | **−6.2%**, 9 → 6 | −4.9%, 9 → 6 |

- **20 × 15 at 18–24 in: why the rise.**
  - A flush beam allows no cantilever, so 15 ft of 2x10 at 16 in needs a second beam row.
  - The old engine did the same at 12 in: 6 footings.

**The FAQ changes.**
- The Cost Estimator FAQ (`src/pages/CostEstimator.tsx`) quotes the designer for a 20 × 15 attached deck 18 in off
  the ground. Its priced portion goes from about $32,900 to about **$35,200** before HST.
- The walkout example, 8 ft up, stays at about $49,400.
- `check-deck-site-price.ts` requires the FAQ to match the designer, so approving updates that sentence too.

## What approving updates

- `scripts/deck-legacy-golden.json`: the 213 fingerprints and prices. Run `check-deck-legacy-parity.ts --update`.
- `scripts/deck-plan-sheet-golden.json`: the contractor plan drawings, because beams, posts and blocking move.
- `check-deck-level-junction.ts`: the structure-owned sections (framing, footings, hardware, labour) may differ from
  its 41d3eba baseline. Every price stays pinned by the legacy golden.
- `src/pages/CostEstimator.tsx`: the FAQ's ground-level example becomes about $35,200.
- `PRICE_BOOK` moves to a new version and fingerprint. A design reopened after the change then says its price changed,
  as #102 does.
