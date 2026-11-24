# R1 golden diff: foundation reveal and concrete piers

2026-10-16. The R1 code is built in worktree `.claude/worktrees/foundation-reveal` (branch `feat/deckcraft-foundation-reveal`). It is uncommitted, and no golden has been updated.

## What changed in the picture

- Every house wall now shows 8 in of parged concrete (`#86837b`, stucco detail) under the siding. The siding, any wainscot and the corner trim start at 8 in.
- The old footprint plinth is gone. It was hidden behind the siding, and it ran as an 8 in curb across at-grade openings such as garage doors.
- Piers: a mid-grey cast concrete (`#8b877e`, was `#b0ada2`), plus a soil-stained first 1.5 in above grade. This is a material change only. The pier solids that feed the takeoff, the typical section and the exports are untouched.
- Before/after on the same design: `r1-compare-corner.png`, `r1-compare-front.png`, and the full frames `r1-before-*.png` / `r1-after-*.png`.

## What it does NOT change

- **Price:** the default design is $34,444.94 before and after. Legacy parity shows no drift in model, issues, hardware, extras or catalogue for any of the 213 saved scenarios.
- **Permit sheets G-0, A-0 and S-1 to S-6:** identical.

## Goldens that move (waiting for your OK)

| Check | What moves | Why |
|---|---|---|
| `check-deck-house-walls` (F4 golden) and `check-deck-house-finishes` | Default house export: 51 → 60 parts, new digest | The single `foundation` box becomes 10 per-wall pieces (7 on the front, which the door splits), and the wall pieces start at y 8 instead of 0. |
| `check-deck-legacy-parity` | `exports` digest only, for 212 of 213 scenarios | Same house export change. Pricing fields are unchanged. The script's own `--accept` path refreshes only `extras` and `exports`, and keeps every pricing field. |
| `check-deck-permit-set` | A-1 elevation digests: the current golden and the frozen saved-design golden | A-1 projects the export solids. Only house-layer (`A-HOUS`) lines change: 14 old segments out, 12 new in. Mostly the same edges split differently, because the old plinth already put a line at 8 in. See `r1-a1-elevation-diff.png` (red = new, blue = removed, grey = unchanged). |

Export part names, default design:

```
- foundation            (#93968d, y 0..8)
+ Front_foundation_0..6 (#86837b, y 0..8)
+ Back_foundation_0, Left_foundation_0, Right_foundation_0
~ Front_wall_0..6       y 0..36  -> 8..36
~ Back/Left/Right_wall_0 y 0..132 -> 8..132
```

A garage block exports `garage1_<side>_foundation_<n>` instead of `garage1_foundation`.

## Check updates already made (not goldens)

- `check-deck-house-shape`: the garage exports a foundation reveal (it used to look for a plinth), and the main-block equality ignores foundation pieces where a block joins, as it already does for wall pieces.
- `check-deck-realism`: the foundation reveal takes its surface detail through HouseParts (it used to check the plinth).

## Verified so far

- `tsc` passes, and every other deck/lint check passes.
- Bundle: 3D viewer 335.2/340 KB (+0.2), route 275.5/276, route CSS 11.7/12.
- Real-GPU look checked in the browser pane at the Corner, Overview and Front cameras.
- Not yet run: the e2e suite. That comes after the goldens are refreshed.
