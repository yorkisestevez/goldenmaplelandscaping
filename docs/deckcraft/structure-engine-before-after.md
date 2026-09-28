# Framing engine replacement: before and after (213 saved designs)

This compares the released engine (main, 703bcec) with the clean-room engine on `feat/deckcraft-clean-structure`. The
new engine is built from public Ontario sources; see `structure-sources.md`. The comparison covers the 213 designs in
the legacy parity golden and uses the same price book (2026-09-26 / 5a73c092).

## Headline

- **The default deck is unchanged.** A 16 × 12 ft attached 2x10 deck keeps its price ($28,025.35), its 3 footings,
  48 ft of beam, 13 joists and 12 blocks.
- **Price:** 122 designs go down, 55 go up and 36 are unchanged.
  - The range is −2.04% to +2.34%; the median is −0.18% and the mean +$24 per design.
  - 36 more designs keep their price but change in drawings or hardware positions: blocking rows move to code
    spacing, and flush edge beams move half a beam width in.
- **Structure across all 213 designs:**
  - beam lumber 36,974 → 32,436 ft (−12%);
  - footings 2,710 → 2,794 (+84, spread over 48 designs);
  - joists 9,010 → 8,970;
  - blocks 55,348 → 54,948.

| Price change | Designs |
|---|---|
| −2.0 to −1.5% | 6 |
| −1.5 to −0.5% | 60 |
| −0.5 to 0% | 55 |
| unchanged | 38 |
| 0 to +0.5% | 6 |
| +0.5 to +1.5% | 6 |
| +1.5 to +2.4% | 42 |

## By design family (12 designs each: 4 patterns × 3 stair types)

| Family | Price change | Footings |
|---|---|---|
| std Rectangle attached | −0.24 to +0.02% | same |
| std Rectangle freestanding, 2 levels | −0.47 to −0.30% | same |
| std L-Shape attached | −1.12 to −0.25% | same |
| std L-Shape freestanding, 2 levels | −1.22 to −0.98% | same |
| **std Multi-corner attached** | **+1.51 to +2.04%** | **+1 each** |
| **std Multi-corner freestanding, 2 levels** | **+1.70 to +2.01%** | **+2 each** |
| std Curved attached | −0.21 to +0.01% | same |
| **std Curved freestanding, 2 levels** | **+1.85 to +2.34%** | **+2 each** |
| big Rectangle attached | −1.07 to −0.50% | same |
| big Rectangle freestanding, 2 levels | −1.04 to −0.61% | same |
| big L-Shape attached | −0.28 to 0.00% | same |
| big L-Shape freestanding, 2 levels | −0.48 to −0.15% | same |
| big Multi-corner attached | −0.68 to −0.33% | same |
| big Multi-corner freestanding, 2 levels | −2.04 to −0.39% | −1 each |
| big Curved attached | −1.18 to −0.08% | same |
| **big Curved freestanding, 2 levels** | **+1.11 to +1.76%** | **+3 each** |

Stair, deck-type, border, foundation, fastener, railing, extras, accessory, lighting, screen and house scenarios are
unchanged in price.

## Why the numbers move

1. **Beam cantilever of 12 in (Barrie, Springwater).** Every beam now has a post within 12 in of each end.
   - Multi-corner and curved decks split into several framing zones, each with its own beam. So they gain a footing
     or two, and the labour and foundation lines that go with it. These are the only increases over 0.5%.
2. **Beam size follows Barrie's "same depth as joists".**
   - The old engine often used 4-ply 2x12 beams, for example on the 20 ft deep "big" decks and on low second levels.
   - The new engine uses joist-size lumber:
     - 2-ply where the 2-ply span (Springwater, supported length ≤ 3.6 m) still lets posts stand 8 ft apart;
     - otherwise 3-ply, from the code's built-up beam table. For the default 2x10 framing that means 3-ply 2x10,
       which the table allows at these spans without closer posts.
   - This is the 12% cut in beam lumber and the framing savings (on average −$457 on 166 designs).
3. **Joist cantilever:** at most 16 in for 2x8 and 24 in for 2x10/2x12, and at most 1/6 of the joist span behind the
   beam (Orillia's OBC 2024 sheet). Shallow zones get a shorter overhang.
4. **Flush beams on low decks.** A drop beam needs its underside at least 6 in above grade: Barrie's 6 in of pier,
   with the beam in a saddle on it.
   - Below that, the beam is flush with the joists and the joists hang on it. So there is no cantilever, and the
     flush edge beam's outer face is the deck edge.
   - For 2x10 framing, that means decks under about 26 in high.
   - The old engine switched at 18 in. Between 18 and 26 in it set drop beams whose undersides fell below grade.
5. **Blocking rows** are at most 2100 mm (82 in) apart and from each bearing, as the code's "with bridging" joist
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
- **24 × 16 freestanding at 30 in and up: why the drop.** The house-side beam is now set in by the allowed
  cantilever, so the depth fits one joist span and not two.

**The FAQ changes.**
- The Cost Estimator FAQ (`src/pages/CostEstimator.tsx`) quotes this designer for a 20 × 15 attached deck 18 in off
  the ground. Its priced portion goes from about $32,900 to about **$35,200** before HST.
- The walkout example, 8 ft up, stays at about $49,400.
- `check-deck-site-price.ts` requires the FAQ to match the designer, so approving updates that sentence too.

## What approving updates

- `scripts/deck-legacy-golden.json`: the 213 fingerprints and prices. Run `check-deck-legacy-parity.ts --update`
  after `--report`.
- `scripts/deck-plan-sheet-golden.json`: the contractor plan drawings, because blocking and flush edge beams move.
- `check-deck-level-junction.ts`: the structure-owned price sections (framing, footings, hardware) join the sections
  allowed to differ from its 41d3eba baseline. Every price stays pinned by the legacy golden.
- `src/pages/CostEstimator.tsx`: the FAQ's ground-level example becomes about $35,200.
