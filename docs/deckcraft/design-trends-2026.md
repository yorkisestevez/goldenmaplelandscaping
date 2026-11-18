# DeckCraft yard concepts: design trends and local placement rules, 2026

**Status: APPROVED by the owner on 2026-10-06, as drafted (gas first; enclosed wood appliances only at 4 m; never open pits).**

Researched 2026-10-05 for the in-app AI that proposes yard concepts on sloped, measured ground (raised patios, seat
walls, fire features, raised and terraced beds, stone steps, planting) and scores them on trend, execution and cost.

Code that carries this brief:

- `src/features/deckcraft/designTrends.ts`: `DESIGN_TRENDS_STATUS`, `DESIGN_TRENDS` (16 trends).
- `src/features/deckcraft/designRules.ts`: `DESIGN_RULES_STATUS` and the rule constants (`FIRE_CLEARANCE`,
  `GUARD_REQUIRED_ABOVE_IN`, `GUARD`, `RETAINING_WALL`, `TERRACE_WALL`, `SEAT_WALL`, `RAISED_BED`, `STONE_STEPS`,
  `ZONING_SETBACKS`, `CONSERVATION_AUTHORITY`, `FROST_DEPTH_IN`).

Product and colour ids in the trends are real ids from `src/data/hardscape-index.json` (verified 2026-09-27); a check
script confirmed every id exists.

This is planning guidance for a design tool. It is not a permit review or engineering advice.

## How to read the confidence levels

- **High**: at least two independent sources agree, including survey data or two manufacturers.
- **Medium**: one manufacturer plus one other source, or survey data that supports it only indirectly.
- **Low**: a single manufacturer's marketing.

Source caveats. Manufacturer trend pages (Techo-Bloc, Unilock) are marketing for products they sell. Houzz and NALP
data are U.S. data. Ontario contractor blogs are local but low-tier. I found no 2024–2026 ASLA residential survey (the
latest found was 2018, so it is not used) and no Landscape Ontario trend article I could open.

## Trend summary

| Id | Trend | Confidence | Weight | Moves it favours |
|---|---|---|---|---|
| `outdoor-rooms` | Defined outdoor rooms | high | 0.90 | raised-patio, fire-room, seat-wall, stone-steps, planting |
| `gas-fire-room` | Fire as the room anchor, gas-first in Barrie | high | 0.90 | fire-room, seat-wall, raised-patio |
| `seat-walls` | Seat walls that edge and zone the patio | high | 0.85 | seat-wall, fire-room, raised-patio, ground-fit |
| `warm-earth-palette` | Warm, earthy neutrals over cool grey | high | 0.85 | raised-patio, seat-wall, ground-fit |
| `native-low-maintenance-planting` | Low-maintenance, native and pollinator planting | high | 0.85 | planting, terraced-beds, raised-beds |
| `large-format-slabs` | Large-format slabs, mixed with smaller units | high | 0.80 | raised-patio, fire-room, ground-fit |
| `landscape-lighting` | Lighting as standard | high | 0.80 | seat-wall, stone-steps, fire-room, planting |
| `split-level-terraces` | Split levels and planted terraces on slopes | medium | 0.75 | terraced-beds, stone-steps, raised-patio, ground-fit, planting |
| `natural-stone-character` | Natural stone and authentic materials | high | 0.70 | stone-steps, planting, terraced-beds, ground-fit |
| `quiet-texture-controlled-contrast` | Quiet texture and tone-on-tone contrast | medium | 0.60 | raised-patio, fire-room, stone-steps |
| `organic-ground-fit` | Work with the land | medium | 0.60 | ground-fit, planting, stone-steps |
| `permeable-surfaces` | Permeable paving | medium | 0.55 | ground-fit, planting |
| `edible-raised-beds` | Raised and terraced beds for food | medium | 0.50 | raised-beds, terraced-beds |
| `porcelain-pavers` | Porcelain pavers | medium | 0.35 | raised-patio, fire-room |
| `terrazzo-outdoors` | Terrazzo-look slabs | low | 0.30 | raised-patio, fire-room |
| `wood-look-hardscape` | Wood-texture concrete | low | 0.25 | stone-steps, seat-wall |

Weights are my proposed relevance for Barrie residential work (0 to 1). They are the main thing to approve or change.

## Trends

### Defined outdoor rooms (`outdoor-rooms`), high

- **In a yard:** several smaller zones (lounge, dining, quiet corner) instead of one big patio. Houzz 2026: 83% of
  renovated outdoor spaces include a lounge or seating area, 55% dining, 53% a quiet retreat.
- **On a slope:** each room gets its own level pad; the level changes become the room boundaries, joined by steps.
- **Sources:** NALP, *Five Landscape Design Trends for 2026* (2025-12-29); Houzz, *10 Outdoor Remodeling Trends to
  Know for 2026* (2026-06-02); Unilock, *Top 5 Hardscape and Landscape Design Trends in 2026* (2026).

### Fire as the room anchor, gas-first in Barrie (`gas-fire-room`), high

- **In a yard:** a fire feature with seating around it. Houzz 2026: 48% of lounge areas include a fireplace or fire
  pit. NALP finds fire pits more requested than fireplaces. Techo-Bloc shows custom linear fire features. An Ontario
  contractor lists gas fire tables and pairs fire with seat walls for wind protection.
- **Why gas in Barrie:** Barrie's rules make open wood pits impractical on ordinary lots (see the fire rule below). A
  linear gas table or gas bowl needs no burn permit.
- **On a slope:** on the most level pad, set back from the house and sheltered by an uphill seat wall.
- **Stocked walls for the surround:** `techo-raffinato-wall`, `unilock-u-cara`, `permacon-melville-tandem-wall`,
  `oaks-nueva-150-wall`. Fire appliances themselves are not in the hardscape catalogue.
- **Avoid:** open masonry wood pits.
- **Sources:** Houzz Pro, *Investing in outdoor living: 5 of the biggest backyard trends of 2026* (2026-07-09); NALP
  (2025-12-29); Techo-Bloc, *12 Backyard Trends 2025* (2025-04-14); Dutra Landscape & Pools, *Top 10 Southern Ontario
  Landscape Trends for 2026* (Dec 4, year not shown); City of Barrie fire by-laws (below).

### Seat walls that edge and zone the patio (`seat-walls`), high

- **In a yard:** low walls at seat height that define patio edges, add seating and can carry lighting on pillars or
  under the coping (Unilock 2026, trend 4).
- **On a slope:** the uphill retaining wall of a cut pad can finish at seat height, so one wall does two jobs.
- **Stocked:** `unilock-u-cara`, `unilock-pisa-smooth`, `unilock-sienastone-smooth`, `techo-raffinato-wall`,
  `techo-graphix-wall`, `techo-brandon-wall`, `permacon-melville-tandem-wall`, `oaks-nueva-150-wall`, `oaks-modan`.
- **Sources:** Unilock (2026); Dutra (Dec 4); Techo-Bloc 2025 (built-in seating in natural stone).

### Warm, earthy neutrals over cool grey (`warm-earth-palette`), high

- **In a yard:** beige, greige, taupe and soft brown fields. Techo-Bloc's 2026 "Warm Revival" names a return to beige
  and brown and a move away from cool greys; Unilock 2026 names Soreno in Toscana Beige and Richcliff in Pebble Taupe;
  Techo-Bloc 2025 already had "Warm Neutrals Take Over" (Caffè Crema).
- **On a slope:** works everywhere; warm walls and caps tie the levels together.
- **Stocked colours:** `toscana-beige` (unilock-soreno), `pebble-taupe` (unilock-richcliff), `avorio` (unilock-arcana),
  `stardust-beige` (techo-terrazzo-slab), `caff-crema` and `beige-cream` (techo-blu60-smooth-slab),
  `range-amber-beige` (permacon-melville-60-slab), `champagne` (oaks-yorkville-60mm-slab).
- **Avoid:** whole-yard cool grey; keep grey and charcoal for contrast.
- **Sources:** Techo-Bloc 2026 press release (2026-04-13); Unilock (2026); Techo-Bloc 2025 (2025-04-14).

### Low-maintenance, native and pollinator planting (`native-low-maintenance-planting`), high

- **In a yard:** Houzz 2026: 73% choose low-maintenance plants, 55% native, 56% pollinator-friendly, 49%
  drought-resistant. LSRCA (Barrie is in the Lake Simcoe watershed) recommends native plants in groups and layers and
  names black-eyed Susan, butterfly milkweed, purple coneflower, spotted Joe-Pye weed, little bluestem and nannyberry.
- **On a slope:** terraces and wall tops become planting rather than lawn; deep-rooted natives on banks.
- **Avoid:** scattered single plants and large thirsty lawns.
- **Sources:** Houzz Pro (2026-07-09); 2026 U.S. Houzz Outdoor Trends Study (2026-06-02, n=1,191); LSRCA, *Native
  Gardens* (undated page).

### Large-format slabs, mixed with smaller units (`large-format-slabs`), high

- **In a yard:** slabs 24 in and larger, fewer joints, a calmer field. Techo-Bloc's 2026 patterns mix scales: large
  slabs in the field, small units for borders and bands. A Quebec contractor reports Permacon's 2026 line leaning to
  large formats; an Ontario contractor cites them for "less shifting".
- **On a slope:** best on raised or cut pads with a level base.
- **Stocked:** `unilock-umbriano`, `unilock-arcana`, `unilock-urban-line`, `techo-industria-slab`,
  `techo-blu60-smooth-slab`, `permacon-mega-melville-slab`, `permacon-melville-18-36-durafusion-slab`,
  `oaks-nueva-xl-slab`, `oaks-yorkville-60mm-slab`.
- **Sources:** Unilock (2026); Techo-Bloc, *Best Paver Patterns and Designs for 2026* (2025-04-14); Les Pavages Nick &
  Associés, *2026 Landscaping Trends* (undated); Dutra (Dec 4).

### Lighting as standard (`landscape-lighting`), high

- **In a yard:** Houzz 2026: landscape lighting is the top lighting upgrade, chosen by roughly four in five homeowners
  doing lighting work (Houzz's summaries give 77% and 80%), and 66% of lounge areas have lighting. Unilock pairs seat walls with under-coping lights; Techo-Bloc shows step uplighting.
- **On a slope:** every step run and wall edge lit; level changes are the safety reason to light.
- **Sources:** Houzz Pro (2026-07-09); Houzz 10 trends (2026-06-02); Unilock (2026); Techo-Bloc 2025.

### Split levels and planted terraces on slopes (`split-level-terraces`), medium

- **In a yard:** break a slope into level pads joined by steps, with planted terraces between short walls instead of
  one tall wall. Techo-Bloc 2025 "Split-Level Sophistication"; Houzz 2026: 19% of homeowners adding retaining walls.
- **On a slope:** this is the slope trend. Keep tiers at least twice the lower wall's height apart (rule below).
- **Stocked walls:** `unilock-pisa-2`, `unilock-u-cara`, `techo-mini-cretaarchitectural150-wall`, `techo-semma-wall`,
  `techo-g-force-wall`, `permacon-vario-wall`, `permacon-lafitt-tandem-wall`, `oaks-ortana`, `oaks-proterra-split`,
  `oaks-gardenia-linear`.
- **Cost:** VERSA-LOK ranks one wall lowest cost, one short wall in front of a taller one medium, multiple tiers
  highest.
- **Sources:** Techo-Bloc 2025 (2025-04-14); Houzz 10 trends (2026-06-02); VERSA-LOK Technical Bulletin 7 (2019).

### Natural stone and authentic materials (`natural-stone-character`), high

- **In a yard:** natural stone, flagstone, sandstone and stacked-stone looks, organic edges, balanced with planting.
  NALP 2026 "Authentic Natural Materials"; Unilock 2026 "Naturalistic Landscaping" (Beacon Hill Flagstone, Richcliff).
- **On a slope:** stone steps and stepping stones through planted banks.
- **Stocked:** `unilock-natural-stone-pavers`, `techo-sandstone-slab`, `unilock-beacon-hill-flagstone`,
  `unilock-richcliff`, `techo-maya-slab`, `techo-sandstonethinsetveneer-wall`, `unilock-rivercrest-wall`,
  `unilock-ledgestone`.
- **Sources:** NALP (2025-12-29); Unilock (2026); Techo-Bloc 2025.

### Quiet texture and tone-on-tone contrast (`quiet-texture-controlled-contrast`), medium

- **In a yard:** understated texture; zones defined by small shifts inside one colour family. Techo-Bloc 2026 still
  shows Squadra in Onyx Black and Shale Grey. My reading: dark and charcoal are now accents (borders, steps, the
  fire-room floor), not the main field. That reading is inference, not a quoted source.
- **Stocked dark accents:** `onyx-black`, `shale-grey`, `greyed-nickel` (Techo-Bloc), `dark-charcoal` (unilock-urban-line),
  `rockland-black` (permacon-mega-melville-slab).
- **Sources:** Techo-Bloc 2026 press release (2026-04-13); Techo-Bloc patterns 2026 (2025-04-14).

### Work with the land (`organic-ground-fit`), medium

- **In a yard:** design around existing grade, trees and greenery rather than clearing and flattening (Techo-Bloc 2026
  "Shift Toward Organic Design").
- **On a slope:** follow the ground with several short level changes; fewer, lower walls also cost less (VERSA-LOK).
- **Sources:** Techo-Bloc 2026; Unilock (2026); VERSA-LOK TB 7.

### Permeable paving (`permeable-surfaces`), medium

- **In a yard:** permeable interlock for walks and at-grade patios. Techo-Bloc 2026 "Permeable Surfaces"; an Ontario
  contractor lists permeable interlock for freeze-thaw.
- **On a slope:** the low end of the yard, where runoff collects.
- **Stocked:** `unilock-eco-promenade-ecoterra`, `permacon-aquapave-paver`, `oaks-hydr-eau-pave`, `oaks-enviro-midori`,
  `techo-aquastorm-paver`, `permacon-turfstone-80-and-100-paver`, `oaks-turf-slab`.
- **Sources:** Techo-Bloc 2026 (2026-04-13); Dutra (Dec 4).

### Raised and terraced beds for food (`edible-raised-beds`), medium

- **In a yard:** herb and vegetable beds at working height. Houzz 2026: 49% of renovating homeowners plan a dedicated
  gardening area and beds or borders anchor 74% of them; an Ontario contractor lists edible landscapes for 2026. I could
  not open a source with a current edible-plants figure, so this stays medium.
- **On a slope:** a sunny terrace or the sunny edge of a patio.
- **Stocked bed walls:** `unilock-u-cara`, `techo-mini-cretaarchitectural75-wall`, `permacon-wallstone-wall`,
  `oaks-nueva-75-wall`, `techo-borealis-wall`.
- **Sources:** 2026 U.S. Houzz Outdoor Trends Study (2026-06-02); Forma Landscaping (2025-11-22); UGA Extension C1027-4
  (2022-12-14, dimensions).

### Porcelain pavers (`porcelain-pavers`), medium

- **In a yard:** thin, dense porcelain for an interior-style finish. NALP 2026 says porcelain pavers are gaining
  traction. Premium: price before proposing large areas.
- **Stocked:** `permacon-november-mirage-porcelain-tile` in `land`, `rain`, `warm`, `wind`.
- **Source:** NALP (2025-12-29).

### Terrazzo-look slabs (`terrazzo-outdoors`), low

- Techo-Bloc pushes terrazzo outdoors in both 2025 and 2026. Single-manufacturer marketing.
- **Stocked:** `techo-terrazzo-slab`, `techo-terrazzo-paver` in `stardust-beige`, `mineral-white`, `moonrock-grey`.
- **Sources:** Techo-Bloc 2026 (2026-04-13); Techo-Bloc 2025.

### Wood-texture concrete (`wood-look-hardscape`), low

- Techo-Bloc 2025 shows Borealis wood-texture walls and slabs. NALP's "authentic materials" points at real wood and
  steel instead, so this is weak.
- **Stocked:** `techo-borealis-slab`, `techo-borealis-wall`, `techo-borealis-stepping-stone-slab` in `smoked-pine`,
  `hazelnut-brandy`.
- **Source:** Techo-Bloc 2025 (2025-04-14).

### Seen in the research but not adopted

No DeckCraft move exists for these yet:

- **Synthetic turf:** Houzz 2026 up 10 points to 19%; NALP notes some high-end clients moving back to grass.
- **Shade structures:** Houzz 2026 up 15 points to 35%.
- **Outdoor kitchens** and **wellness features** (saunas, cold plunges): NALP 2026, Techo-Bloc 2026.

## Local rules (Barrie, Ontario)

| Rule | Value | Scope | Source | Confidence | Confirmed |
|---|---|---|---|---|---|
| Open wood fire (not an approved appliance) | 15 m (49.2 ft) from any dwelling, structure or combustible; max 1 m³; daylight only; daily permit | All land in Barrie | By-law 2004-185 s. 3.1.1, 3.1.2, 3.1.8, 3.2.2 | high | yes |
| Approved enclosed wood appliance (OSFBA) | 4 m (13.1 ft) from any dwelling or structure; 2 m (6.6 ft) from combustibles; 3 m (9.8 ft) from overhanging vegetation; 5 m (16.4 ft) from woodland; 8 am to midnight; $24 annual permit | Non-combustible, enclosed on all sides, spark arrestor on every vent | By-law 2007-210 (City summary page); Burn Permits page | high | yes |
| Fire distance from a property line | Not stated. Default 4 m (13.1 ft) for wood | Treats a neighbour's fence or shed as a structure | none found | low | **no** |
| Gas fire table or bowl | No Barrie burn permit for propane fire tables. Clearance to combustibles 36 in (≤200k BTU) or 48 in (201–400k BTU); overhead 84 in with 2 open walls (≤200k BTU), no overhead above that. Default 48 in, not under roofs | Unit manual governs | Burn Permits page; HPC Fire *Gas Fire Pit Clearances* (2019-05-21) | medium | **no** |
| Gas piping and appliance hook-up | Only a TSSA-registered contractor with a certified gas technician | Ontario | TSSA news release (2023-03-01) | high | yes |
| Guard required | Walking surface more than 600 mm (23.6 in) above the adjacent surface within 1.2 m, or that surface steeper than 1 in 2 | Raised patios, landings, steps, decks | OBC Div. B 9.8.8.1.(1); Barrie Deck Specs (Summer 2026); Barrie deck checklist (2025-08-26) | high | yes |
| Guard height and openings | 36 in up to 5'-11" (1.8 m) above grade, 42 in above; max 4 in opening; nothing climbable between 5.5 in and 36 in | Same | Barrie Deck Specs (OBC 9.8.8.3, SB-7) | high | yes |
| Retaining wall permit | Over 1,000 mm (39.4 in) exposed height when "adjacent to" (within a horizontal distance equal to its height) public property, access to a building, or private property the public is admitted to (front or side yard on the way to the main entrance) | Height = finished grade at base to top of wall, excluding guard | Barrie *Retaining Walls* information sheet (Sept 2024) | high | yes |
| Retaining wall engineer | P.Eng design (OBC Part 4) for wall and guard when a permit is required | Same | Same | high | yes |
| Engineer recommended (any other wall) | Over 36 in, or any wall with a surcharge (patio, driveway, upper tier) | DeckCraft default; unreinforced segmental walls typically 3–4 ft | CMHA SRW-FAQ-001 (rev. 2014); VERSA-LOK TB 7 (2019); Unilock raised-patio detail | medium | **no** |
| Guard on a permit-scope wall | Above 600 mm if part of an elevated walkway, above 1.0 m elsewhere, where the public can reach the top | Same | Barrie *Retaining Walls* sheet | high | yes |
| Terrace spacing | Upper wall at least 2× the lower wall's height back (D ≥ 2H) with a level bench; overall grade across tiers no steeper than 2H:1V; tier max 36 in without engineering | Industry guidance | VERSA-LOK TB 7; CMHA SRW-FAQ-001 | medium | **no** |
| Seat wall | 18–20 in finished height; 12–16 in cap depth (stocked copings run 12–20 in) | Design guidance | ADA/ABA 903.5 (bench seat 17–19 in), 903.3; hardscape-index.json | medium | n/a |
| Front-yard walls | Any fence, wall or hedge in a front yard max 1 m (39.4 in) | Residential zones | Zoning By-law 2009-141, 5.3.5.4 a) | high | yes |
| Raised beds | 12–30 in (DeckCraft band); min 10 in soil; 24 in for wheelchair users; 36 in for no-bend standing; max 4 ft wide (3 ft for wheelchair users); paths 18–24 in, 4 ft for wheelchairs | Design guidance | UGA Extension C1027-4 (2022-12-14) | medium | n/a |
| Steps | Rise 125–200 mm (4 7/8–7 7/8 in); run 255–355 mm (10 1/16–14 in); handrail if more than 3 risers | Stairs serving a dwelling; default for garden steps | Barrie Deck Specs (OBC 9.8.4.2) | high | yes (for stairs serving the house) |
| Deck setbacks | Interior side 0.6 m, exterior side 1.5 m, rear 0.6 m, front 3 m | Residential zones | Zoning By-law 2009-141, 5.3.5.2 | high | yes |
| Accessory structures | Max 4 m high; not in a front yard (except pool, carport, deck, porch); 0.6 m from rear and side lot lines; 7 m from front lot line; 3 m from exterior side line on a corner lot; 10% lot coverage combined | Residential zones | Zoning By-law 2009-141, 5.3.5 | high | yes |
| Retaining wall near a street | Not within 0.3 m of a lot line abutting a street. "Required retaining walls" are otherwise exempt from zone height and setback rules | All zones | Zoning By-law 2009-141, 4.9.1.1 and accessory-structure Exemptions | high | yes |
| Conservation authority | LSRCA or NVCA permit for structures, grading or fill inside a regulated area | Regulated areas only | LSRCA *Do I need a permit* (O. Reg. 41/24, in force 2024-04-01); Barrie deck checklist glossary | high | yes |
| Frost depth for footings | 4'-0" (48 in) below grade | Pier footings (pergolas, structures on piers) | Barrie Deck Specs | high | yes |

### What the fire rules mean in practice

Barrie has two wood-fire paths and neither suits a typical backyard fire pit:

1. **An open fire**, which includes an open stone or block fire pit, is "open-air burning". It needs a permit for each
   day, burns in daylight only, and must stay 15 m from any dwelling, structure or combustible material (By-law
   2004-185, s. 3.2.2). The only exemption is a fire wholly inside a barbecue used to cook food (s. 6.1.1).
2. **An approved outdoor solid-fuel appliance** must be non-combustible, enclosed on all sides, with a spark arrestor
   on every vent. It needs an annual $24 permit and must stay 4 m from any dwelling or structure, 2 m from combustibles
   and 3 m from overhanging vegetation. Fires are put out on complaint even with a permit.

Gas features avoid both by-laws, so the AI should default fire rooms to gas. Not confirmed: whether a fire bowl with a
mesh spark screen counts as "enclosed on all sides", and whether the 4 m reaches a neighbour's fence or shed.

### Zoning status

The rules above come from Zoning By-law 2009-141, office consolidation of July 31, 2026, which I read directly. Barrie's
new comprehensive zoning by-law is still a draft (Draft 3); its timeline changed on 2025-11-13 and the City says to
check back in 2026. Re-check these values when it is adopted.

### Not confirmed

These need an answer from the City of Barrie or the named body before they become hard rules:

1. Distance from a wood fire to a property line (default 4 m).
2. Gas fire clearances and overhead cover (default 48 in to combustibles, no roof over it). The unit manual governs.
3. Whether a screened fire bowl is an approved OSFBA.
4. Whether a raised patio, fire-table island or seat wall counts as an accessory "structure" under the zoning by-law
   (0.6 m setback, 4 m height, 10% coverage). Patios and retaining walls appear in the zoning definition of landscaped
   open space, which suggests they do not, but the City has not said so.
5. Whether a rear-yard walk to a back door counts as "access to a building" for the retaining-wall permit trigger.
6. The 36 in engineering recommendation and terrace limits are industry guidance, not Barrie rules.
7. OBC guard values were checked against the City's 2025 and 2026 documents, which cite the current code, and against
   the 2012 text of 9.8.8.1. I did not open the 2024 Compendium itself.

## How the AI should use this

**Gate.** While `DESIGN_TRENDS_STATUS` is `'draft'`, the AI should not score or cite trends. Rules marked
`confirmed: true` can show as warnings now. The owner decides whether they also apply while the brief is a draft.

**Trend score.** For each concept, add up `weight` × match for every trend whose `favours.moves`, products or colours
the concept uses. Scale by confidence (suggested: high 1.0, medium 0.75, low 0.5) and subtract for anything matching a
trend's `avoid`. Explain the score by naming the two or three trends that drove it, with their sources.

**Execution.** Treat these as hard checks, measured on the site model:

- No wood fire inside `FIRE_CLEARANCE.woodFt` of the house or any structure. No open wood pit at all unless the lot
  allows `openWoodFireFt`. Gas at least `gasFt` from combustibles and not under a roof.
- Add a guard wherever a patio, landing or step edge is more than `GUARD_REQUIRED_ABOVE_IN` above the ground within
  47 in, or that ground is steeper than 1 in 2. A seat wall does not count as a guard.
- Flag "permit + P.Eng" for any wall over `RETAINING_WALL.permitAboveIn` within its own height of a building access,
  front or side approach, or public land. Flag "engineer recommended" above `engineerRecommendedAboveIn`.
- Space terraces at least `TERRACE_WALL.minSeparationRatio` × the lower wall's height, or flag them for engineering.
- Seat walls inside `SEAT_WALL.heightIn`; steps inside `STONE_STEPS` rise and run, with a handrail above 3 risers.
- Respect `ZONING_SETBACKS`. Flag the conservation-authority check for any grading or fill near water, wetlands or
  steep banks.

**Cost.** Use DeckCraft's own pricing for numbers; never invent prices. Use this brief only for direction:

- Wall face area, and walls over 36 in (geogrid, engineering), are the big cost drivers.
- Multiple tiers cost the most, one wall the least, a short wall in front of a taller one sits in between (VERSA-LOK).
- Guards, a gas line by a TSSA contractor, and permits add cost.
- Porcelain and terrazzo are premium surfaces.

Prefer the concept that reaches the trend score with fewer and lower walls.

**Wording.** Proposals should say "planning guidance, confirm with the City of Barrie" next to any rule-driven
statement, and never call a value a code requirement when it is `confirmed: false`.

## Decisions for the owner

1. Approve, strike or re-weight each trend, especially the low-confidence ones (terrazzo, wood-look) and porcelain.
2. Confirm the wood-fire policy: gas-first, with enclosed approved wood appliances only at 4 m and never open pits?
3. Accept the gas defaults (48 in to combustibles, no roof over a gas feature), or set your own from the units you sell.
4. Accept 4 m from the property line for wood fire, or ask Barrie Fire (fire.prevention@barrie.ca).
5. Accept the 36 in engineering recommendation and terrace limits (36 in tiers, 2H spacing) for walls outside the
   permit scope.
6. Ask Barrie zoning whether a raised patio, fire-table island or seat wall is an accessory structure.
7. Decide whether confirmed rules may run as warnings before this brief is approved.
8. Confirm the raised-bed band of 12–30 in, or allow up to 36 in.

## Sources

All accessed 2026-10-05.

**Trends**

- Techo-Bloc, *Techo-Bloc Reveals 7 Outdoor Design Ideas to Help Homeowners Create More Intentional Backyards in 2026*
  (press release, 2026-04-13): https://natlawreview.com/press-releases/techo-bloc-reveals-7-outdoor-design-ideas-help-homeowners-create-more
- Techo-Bloc, *Best Paver Patterns and Designs for 2026* (2025-04-14): https://blog.techo-bloc.com/best-paver-patterns-and-designs-for-2026
- Techo-Bloc, *12 Backyard Trends 2025* (2025-04-14): https://blog.techo-bloc.com/12-backyard-trends-2025-top-landscape-outdoor-design
- Unilock, *Top 5 Hardscape and Landscape Design Trends in 2026* (2026): https://unilock.com/uncategorized/2026-outdoor-trends/
- NALP, *Five Landscape Design Trends for 2026*, Jill Odom (2025-12-29): https://blog.landscapeprofessionals.org/five-landscape-design-trends-for-2026/
- Houzz, *2026 U.S. Houzz Outdoor Trends Study* (2026-06-02, 1,191 U.S. homeowners): https://www.houzz.com/magazine/2026-u-s-houzz-outdoor-trends-study-stsetivw-vs~185306879
- Houzz, *10 Outdoor Remodeling Trends to Know for 2026* (2026-06-02): https://www.houzz.com/magazine/10-outdoor-remodeling-trends-to-know-for-2026-stsetivw-vs~185305660
- Houzz Pro, *Investing in outdoor living: 5 of the biggest backyard trends of 2026* (2026-07-09): https://pro.houzz.com/pro-learn/blog/2026-houzz-outdoor-trends-report
- Dutra Landscape & Pools, *Top 10 Southern Ontario Landscape Trends for 2026* (Dec 4, year not shown): https://www.dutrascape.ca/blog/2026-landscape-trends
- Forma Landscaping, *Top Outdoor Design Trends for 2026* (2025-11-22): https://www.formalandscaping.ca/post/top-outdoor-design-trends-for-2026-landscaping-innovations-transforming-ontario-homes
- Les Pavages Nick & Associés, *2026 Landscaping Trends* (undated): https://pavagesnick.com/2026-landscaping-trends/
- LSRCA, *Native Gardens* (undated): https://lsrca.on.ca/index.php/home/native-gardens/

**Rules and execution**

- City of Barrie, *Open Air Fires By-law 2004-185* (consolidated, amended by 2007-208): https://www.barrie.ca/Open-Air-Fires-Bylaw.pdf
- City of Barrie, *Outdoor Solid Fuel Burning Appliances By-law 2007-210* (City summary page, updated 2015): https://www.barrie.ca/government/policies-laws/laws-listing/outdoor-solid-fuel-burning-appliances-law
- City of Barrie, *Burn Permits*: https://www.barrie.ca/services-payments/permits-licences-applications/burn-permits
- City of Barrie Building Services, *Retaining Walls* information sheet (Sept 2024): https://www.barrie.ca/media/12009
- City of Barrie Building Services, *Deck Specs* (Summer 2026): https://www.barrie.ca/media/4040
- City of Barrie, *Building Permit Application Checklist – Decks* (2025-08-26): https://www.barrie.ca/media/4041
- City of Barrie, *Zoning By-law 2009-141*, office consolidation July 31, 2026: https://www.barrie.ca/media/1498
- Building Barrie, *New draft Zoning By-law*: https://www.buildingbarrie.ca/zoning
- Ontario Building Code Div. B 9.8.8.1 and 9.8.8.3 (2012/2017 text): https://www.buildingcode.online/1337.html and https://www.buildingcode.online/1339.html
- LSRCA, *Do I need a permit* (O. Reg. 41/24): https://lsrca.on.ca/index.php/planning-permits/do-i-need-a-permit/
- TSSA, *TSSA Cautions Ontario Homeowners Against Hiring Fraudulent Fuels Workers* (2023-03-01): https://www.globenewswire.com/news-release/2023/03/01/2618464/0/en/TSSA-Cautions-Ontario-Homeowners-Against-Hiring-Fraudulent-Fuels-Workers.html
- HPC Fire, *Tech Talks: Gas Fire Pit Clearances* (2019-05-21): https://hpcfire.com/tech-talks-gas-fire-pit-clearances/
- VERSA-LOK, *Technical Bulletin 7: Tiered Walls* (©2019): https://www.versa-lok.com/assets/sites/versalok2016/uploads/assets/uploads/techbull7.pdf
- CMHA, *SRW-FAQ-001* (rev. 2014): https://www.cmha.org/resource/srw-faq-001/
- Unilock, *Estate Wall Raised Patio – Setback w/ Seat Wall* (detail): https://contractor.unilock.com/wp-content/uploads/2021/09/Detail_Estate-Wall_Raised-Patio-with-Seat-Wall_Setback.pdf
- U.S. Access Board, *ADA/ABA Standards, Chapter 9, 903 Benches*: https://www.access-board.gov/aba/chapter/ch09/
- UGA Extension, *C1027-4 Raised Garden Bed Dimensions* (2022-12-14): https://fieldreport.caes.uga.edu/publications/C1027-4/
