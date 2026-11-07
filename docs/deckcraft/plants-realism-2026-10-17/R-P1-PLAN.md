# R-P1: plants sit in beds. Plan for approval

2026-10-17. Plan only: nothing is built. It follows R-P0, which is live (PR #176).

This is the bed phase of the reviewed realism plan (`plan.json`, phase P2), updated for what shipped in R-P0. The code anchors were re-checked against main today.

## What is wrong today

Shots: `today-front.png`, `rp0/compare-front.png`.

| Today | Real Ontario practice (Toronto, Oshawa, Mississauga, Waterloo details) |
|---|---|
| Plants in a plain bed sit at grade, but the mulch sheet is drawn at grade + mulch depth + 0.05 in (3.05 in by default), so **the bottom 3 in of every plant is buried**. | The root flare sits at or just above grade, with mulch held 40–75 mm off stems and trunks. |
| The mulch is a **flat slab standing 3 in above the lawn**, with a hard vertical edge. | The mulch finishes about level with the lawn (about 25 mm below the turf at the cut), with a clean spade-cut edge. |
| **Brown, black and cedar mulch all render the same orange**: the shader hard-codes one colour (`landscapeSurfaceMaterial.ts:43`). | Each mulch is its own colour. |
| Steel edging stands **about 7 in above grade**. | Edging tops sit about ½ in proud of the turf. |
| No contact darkening where a plant meets the ground; far plants and phones have no plant shadow at all. | Bases are darker where stems meet soil. |

## What R-P1 builds

Everything here is render-only. Saved designs, prices, quantities, quote fingerprints, share links and OBJ/DXF exports stay byte-identical, and the checks prove it.

**0. Speed probe (the R-P0 follow-up, about 1 day).**
- A local Playwright harness for desktop high, balanced and constrained tiers at phone size.
- It records draw calls, triangles, texture memory and p95 frame time for the demo bed and the showcase estate.
- It also runs the magenta leak and black-frame probes.
- R-P1 needs this baseline: its performance gates compare against today.

**1. Mulch level.**
- Plain mulch and stone beds show their top at **grade + 1.0 in**, below the grass tips.
- The priced mulch depth, takeoff and exports are unchanged; only the drawn sheet moves.

**2. Spade-cut edge.**
- A 4 in taper runs from the bed edge (grade + 0.4 in) up to the mulch top.
- Its lower third is coloured as soil, which reads as the cut line.
- There is no taper where a bed meets another bed or the house, deck, patio or a wall, so no bare strip shows there.
- Raised, turf and putting-green beds are unchanged.

**3. Plants seated in the mulch.** Each plant sits on the drawn mulch surface, sunk by its form:

| Form | Sink | Mulch pulled back from stem |
|---|---|---|
| Trees | 0 in (flare at grade) | 3 in |
| Shrubs and clipped evergreens | 0.5 in | 2 in |
| Perennials and grasses | 0.75 in | 1.5 in |

- Raised beds keep their current rule, minus the sink. Plants on the lawn stay at grade.
- Flowers and the mature-spread ring follow the same seat.

**4. Collars.**
- Each bed plant gets a small dark soil dip at its stems, the pulled-back mulch.
- A 1¾ in mulch lip rises 0.6 in around the dip, so the rim catches light.
- They are opaque, so Photo mode traces them too.

**5. Contact shade.**
- **Every plant, every tier including phones:** a soft multiply shadow ring.
  - Low plants: 0.45 × width, capped at 30 in.
  - Trees: trunk radius + 10 in. The canopy shade is left to real shadows.
  - Its strength follows sun and ambient light, so there is no stain at night.
  - It is skipped in Photo mode, because the tracer makes its own contact shade.
- **Beds:** they also take the shared ground-occlusion map the lawn already uses, so a bed beside the house darkens like the lawn does.
- No new shadow casters, so house and deck shadow sharpness are unchanged.

**6. Flush edging.**
- Steel edging on plain beds is set 3.5 in into the ground, so its top is **½ in above grade**.
- It follows a sloped surface segment by segment.
- It uses the same weathered steel look as the raised beds.

**7. Honest mulch colours.**
- Albedo comes from the mulch photo, normalised, times a swatch per product:
  - **brown #73503a**;
  - **black #34302b**;
  - **cedar #a97548**.
- The close-up chips use the same swatches, and Photo mode matches.
- The pinned material colours stay.

**8. Chips.** The close-up mulch chips keep clear of the taper and of every collar. A per-bed lookup keeps this as fast as today.

## Acceptance (measured, not eyeballed)

- **Seating.** Plant base y equals the mulch top minus the form's sink (±0.01 in).
  - Within 4 in of a tapered edge, the taper height is used instead.
  - Raised beds and lawn plants follow their own rules.
  - Bed membership uses the same polygons the beds draw, including fill-seed beds and ground-cover-only beds.
- **Mulch top.** At least grade + 0.75 in and no higher than the 90th-percentile grass tip.
- **Nothing in data moves:**
  - landscape placement output, takeoff and quote sections deep-equal before and after;
  - the estate quote fingerprint is unchanged;
  - the estate link payload stays 98,422 bytes;
  - demo OBJ/DXF exports are byte-identical;
  - re-saving the demo and the estate gives byte-identical JSON.
- **Picking.**
  - A click through a collar, a shadow ring or the taper still selects the bed.
  - A click through a lawn plant's ring never stops on the ring.
- **Mulch colour.**
  - Each mean albedo is within ±8% per channel of its swatch, with the photo and with the procedural fallback.
  - At the Above camera, black < brown < cedar, with ΔE00 ≥ 15 between each pair.
- **Edging.** Top at grade + 0.5 in (±0.05) along the whole outline, including a sloped surface. Raised-bed edging is unchanged.
- **Edge geometry.**
  - The taper sits at least 0.25 in above the ground.
  - Drawn area equals bed area within ±0.5%. Tested on a curved outline, a bed with a hole, a bed against the house and two touching beds.
- **Contact.**
  - One collar, lip and ring per plant, on every tier.
  - Plant-base macro: at least 25% soil pixels in the collar annulus.
  - Inside a ring, luminance is at least 45% of open ground 1 ft away, so bases are not crushed to black.
- **Grass.** At the Bed edge low camera, grass tips rise above the mulch edge along at least half the visible outline.
- **Speed**, against the step-0 baseline per tier:
  - p95 frame time at most 1.15×;
  - shadow redraws and sun shadow extent unchanged (±5%);
  - chip layout time at most 1.10×;
  - magenta leak stays at 0;
  - the iOS 16-texture-unit test passes at night with beds and plants.
- **Look.** Screenshots at 1600×900 and 390×844 for your sign-off:
  - Bed close-up and Bed edge low, with edging on and off;
  - Plant base macro and Tree in lawn;
  - Corner and Above;
  - the three-mulch side-by-side;
  - Night.

## Checks that move

- **New `check-bed-edges.ts`**, added to the deploy gate: mulch level, taper, edging, collars and rings, picking, hardscape skips, export byte-identity and data invariance.
- **Deliberate updates:**
  - `check-landscape-surfaces` (the bed material now also takes the shared AO map, which it does not own);
  - `check-ground-cover-detail` (chip clearance from the taper and collars, swatch albedo, timing);
  - `check-photo-trace` (mulch albedo parity, ring skipped, collar, lip and taper traced);
  - the night texture-unit e2e test.
- **Must pass unchanged:** `check-landscape-objects`, `check-raised-beds`, `check-site-concepts` and `check-curved-landscape-editing`. The bed geometry, instance matrix and edging geometry functions are not modified.

## Budget

- **Triangles:** +2 per plant for rings, about +42 per bed plant for collar and lip (estate about +12k), and at most 260 per bed for the taper.
- **Draw calls:** +3 total, plus 1 per bed.
- **GPU memory:** about +0.3 MB.
- **Code:** at most +3 KB gzip in the lazy landscape chunks, and **0 in the budgeted 3D viewer chunk**.
- **Downloads:** none.

## Effort

About **5.5 days**: 1 for the probe and 4.5 for beds. One PR, with your look sign-off before commit. Merging needs your OK.

## Risks

- **Every existing bed changes look** (lower and honestly coloured). This is intended, and you see the before/after set first.
- **The taper on sloped ground could flicker into the lawn.** Mitigation: it is sampled from the same ground, kept at least 0.25 in clear, and tested on a slope.
- **Stacked darkening at plant bases** (AO map, collar, ring and shadow) could crush bases to black. The ≥45% luminance gate and the Night shots guard against that.
- **The 0.5–0.75 in sink hides the lowest card of today's proxy plants.** This is intended. The species models (R-P2 onward) start stems 2 in below the soil line.

## Decisions for you

1. **D8, bed values:** mulch top at grade + 1.0 in; sinks 0 / 0.5 / 0.75 in; pull-back 3 / 2 / 1.5 in; a 1¾ in lip rising 0.6 in; a 4 in taper; edging ½ in proud. **Recommended.** Alternatives: keep the 3 in mulch pad, use a single 0.75 in sink, or set plants exactly on the surface.
2. **D9, flat-bed steel edging look:** **weathered steel to match the raised beds (recommended)**, black powder-coat, or mill aluminium.
3. **D10, contact shade scope:** **rings on every tier plus the bed AO map, no new shadow casters (recommended)**. The alternative of more shadow casters or lawn darkening under phone-tier plants waits for a later phase.
4. **D17, trees in the lawn:** **a shade ring only (recommended)**, a visual mulch ring marked "not quoted", or an "add mulch ring" action that creates a real, priced bed.
5. **Step 0:** build the speed probe as part of R-P1 (recommended), or skip the speed gates.
