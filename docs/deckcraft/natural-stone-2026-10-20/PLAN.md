# DeckCraft natural stone: flagstone, granite, boulders and boulder walls

2026-10-20. Research and a plan for approval. Nothing is built or committed. This folder is untracked and the repo is public, so keep it out of commits.

Scope: construction materials, which sit inside the owner's realism scope (house, construction materials, placed plants and trees).

## 1. What DeckCraft has today

Checked against `origin/main` at `3e94257` (PR 186). The local checkout is still on the old `feat/deckcraft-v2` branch, so none of this comes from it.

| Area | Today | The problem |
|---|---|---|
| Flagstone patios and walkways | "Flagstone" products are all concrete pavers with a flagstone texture: Unilock Beacon Hill Flagstone and Windermere Flagstone, plus rectangular natural-stone slabs (Unilock Natural Stone Pavers & Slabs, Techo Sandstone and Maya). | There is no irregular natural flagstone. Every surface is a grid of rectangles, so a real flagstone patio cannot be drawn. |
| Granite | "Granite" appears only as a colour name (Granite Fusion and similar) and as a crushed-granite bed aggregate. | No granite flagstone, granite slab, granite step or granite boulder. |
| Boulders | One CC0 scan (Poly Haven `namaqualand_boulder_03`), scaled to a 42 × 30 × 24 in box. The takeoff only counts them. | Every boulder is the same rock. There is no burial depth, no stone type, no weight or tonnage, and no fit against patios. |
| Natural stone retaining walls | `armour-stone` is drawn as running-bond courses of identical 36 × 18 in boxes, the same way as segmental block (`yardModelAdvancedRuntime.ts`, retaining-wall branch). | It looks like big concrete block. There is no boulder wall at all: no setback per course, no buried first course, no irregular faces, no flowing face line. |
| Natural stone steps | Oakville natural stone steps (48 × 16 × 7 in) with fillers exist in the step assembly. | This is the one natural stone item that is already modelled. It has no granite option. |

## 2. How Dan Preston builds it

Dan Preston runs Preston Hardscape Design in central Wisconsin and co-founded Hardscape Mentor with Luke Parmeter. The notes below come from his own words in 78 Hardscape Mentor videos (captions read 2026-10-20; YouTube rate-limited the other 12) and from the hardscapementor.com blog. Video IDs are given so each point can be checked.

### 2a. Flagstone: his "two-finger joint" method

He calls it his trademark and says it is patented (`V-6EXAFrBzE`, `1-rCtQdVqMo`), so DeckCraft should describe the method without using his name for it (decision D4).

1. **Big irregular slabs, cut to fit.** The stone arrives standing on pallets as "large slabs, irregular pieces" (`V-6EXAFrBzE`). He cuts most edges ("even though I'm cutting the crap out of it", `LjupM8Zzw_o`) but keeps the look natural. Large slabs plus tight joints lock the surface together (`Hsxm7kmTyno`).
2. **One even joint everywhere: about 1½ to 2 in.** "We literally drag our two fingers through to make sure that our joints are similar in size … about an inch and a half to 2 inch" (`V-6EXAFrBzE`). Even joints give a consistent look and let him calculate the joint material. Joints must never pass 4 in, which is the limit for wide-joint polymeric (`edRSwNE3B3I`). Random un-cut pieces leave "huge gaps" that are not secure (`Tyommba_khM`, `NVKfUBFZQLA`).
3. **Layout rules he names:**
   - Break up any joint line that keeps running with another stone (`LjupM8Zzw_o`, `C_9lKGNOYrk`).
   - No repetition: never four stones of the same size together (`4M-n7MjV8wY`).
   - Slice off a random point to get a straight starting edge (`3AlNP8pGxGs`).
   - Fill the last holes from a paper or fabric template traced with the two-finger gap (`OmcEzhUma-E`, `Oug9mqkb8EQ`).
4. **Build-up, from the bottom:**
   - 3/4 in clear, open-graded crushed stone, compacted ("open graded gospel", `9iBrJ9dR3wQ`, `InDpRSTOVPY`).
   - Base finished 3 in below the top for 2 in flag on a 1 in bedding layer (`jE9Jo6Bo61E`).
   - The 1 in bedding layer is chips, screeded like a paver bed. Each stone is worked down into the chips, or chips are added under it, until the tops are flush (`wPFArbAUmog`, `MafozhczgGQ`).
   - The stone is nominally 2 in, really 1⅞ to 2¼ in (`jE9Jo6Bo61E`).
   - Joint sweeping is his last chance to fix lippage (`edRSwNE3B3I`).
5. **Joint fill:**
   - Either SEK X-Treme Wide Joint PolySweep (polymeric, about twice the polymer of regular; `edRSwNE3B3I`), or permeable SEK Perm Chips.
   - The chips are compacted and finish at least 1/8 in below the stone (`5h1YEr_Lg4c`).
   - Where chips could track into a pool or house, he stabilises them with SB-1000. Colours: Eclipse Black, Saturn Tan, Stormy Gray (`1-rCtQdVqMo`).
   - He does not seal the stone itself, because it goes shiny and dark (`j_EIB5RTYu4`).
   - Permeable joints let water in the stone's natural dips drain down instead of ponding (`1-rCtQdVqMo`).
6. **Borders and edges:**
   - Flagstone walkways get a contrasting concrete paver border that defines the curves (`4yUu6Vx_sYM`, `LjWzVQWXoq8`).
   - He sprays a second line one border-width in, lays the flag over it, then cuts back for the border (`a4uRCODrDZg`, `RFBqS0Zwxh0`).
   - Walkways keep a constant width. In his example the walk is 5 ft and the middle flag is 41 in after both borders (`iX7QUs16GxA`).
   - Under the border: Perma Edge set on the 3/4 in stone, angled back (`9zkWr646xTY`).
7. **Scribing to boulders and walls.**
   - Boulders and vertical features go in first (`5dhN2azh120`).
   - The flagstone is scribed tight to each boulder (`PVlgkCJmBo0`).
   - Along a curved wall he keeps the same even joint "to make these boulders flow right into this walkway" (`V-6EXAFrBzE`).
   - A boulder at a patio edge is set level with the sprayed line (`APPNrEbE3NE`).

### 2b. Boulder retaining walls

1. **Why boulders:** they weather to look better, they read like a natural rock face, and one boulder sets 5 to 7 face feet in 10 to 15 minutes (`JV-hW7vBpjo`, `P54YgpUSF-g`).
2. **Bury the first course 6 to 12 in**, the way a block wall buries its first 6 in (`60p5eV9ohsI`, `pGUrTSDmT-U`).
3. **Backfill each course with open-graded stone before setting the next.** The next boulder sits partly on that backfill, which is what makes the setback and the levelling possible. Tall walls need **6 to 8 in of setback on every course**, scaled to the wall height (`nj3IHKyCfqQ`, `bS284jGygt8`).
4. **Level the tops high point to high point.** "The bottom of the level represents the bottom of the next rock." Voids behind are left to fabric and backfill and disappear from view after a few courses (`WWfKgqOfXjk`, `nj3IHKyCfqQ`).
5. **Stagger the seams**, with enough offset (`nj3IHKyCfqQ`, `tRaAkSc8zN8`).
6. **One flowing face line.** "The faces of all these rocks are in one flowing curve", with flat faces out and S-curves where the site allows (`ECieTBjBtzM`, `tRaAkSc8zN8`).
7. **A clean top course:** "one consistent line and the seams could line up" (`XZmrp2twvag`).
8. **Picked stone.** He picks boulders at the quarry, including flat-topped "bench" stones (`NtPNrox6_fA`, `724QxdoCQVc`). His suppliers stock gauged "guillotine" boulders, flat on top and bottom so they stack like block (`jAE2Y05eaho`). He shows walls up to 10 courses high (`WWfKgqOfXjk`). A single boulder ran 3,000 to 3,500 lb (`6ynId-d51_I`).

### 2c. Granite in his work

His Wisconsin suppliers are quartzite and sandstone, plus "aqua blue" boulders (`XtJniFFO46w`). Granite is not a big part of his videos, so granite in DeckCraft has to come from Ontario supply, not from him:

- Canadian Shield granite flagstone, steps and boulders.
- Unilock publishes a 25 mm granite paving spec for Ontario.

## 3. What "proper" means in DeckCraft

### Flagstone patios and walkways (new natural surface)

- **Material:** stone type (granite, limestone, quartzite or sandstone) with colour sets and per-stone colour variation.
- **Nominal thickness:** 1½, 2 or 2½ in.
- **Laying style:**
  - **Cut-to-fit, even wide joint** (Dan's method; the proposed default).
  - **Natural dry-laid, wide planted or gravel joints.**
- **Layout generator:**
  - Irregular 4- to 7-sided stones, weighted towards large slabs.
  - Seeded from the feature id, so a saved design always lays the same stones.
  - Encodes his rules: three-way joints only (no "+" joints), no joint line running across more than about three stones, and no four neighbours of near-equal size.
  - Stones are cut straight at the outline or at a border.
- **Joint:** 1½ in default, range 1 to 3 in, capped at 4 in. Fill choice: permeable chips (black, tan or grey) or wide-joint polymeric. The fill top sits 1/8 in below the stone.
- **Build-up:** 3/4 in clear base, 1 in chip bedding, then the stone. The existing excavation and base takeoff follow from it.
- **3D:** each stone is its own slab with a cleft top (sub-1/8 in relief), cut edges straight and natural edges rougher, sitting in a recessed aggregate joint. The look comes from real stone photo textures, not a tint.
- **Border:** optional contrasting paver soldier course (any catalogue paver) with constant walkway width; the flag is clipped one joint short of it.
- **Scribe:** boulders, walls, steps and house walls inside or on the edge of a flagstone area cut the stones around them with the same joint.
- **Takeoff:**
  - Area.
  - Stone tons from coverage by thickness. Suppliers quote roughly 70 to 100 sq ft per ton at 1½ to 2 in; the exact figure must come from the chosen supplier.
  - Cut-and-fit waste %.
  - Joint material by joint length × width × depth.
  - Bedding and base volumes.
  - Until the owner sets rates, the price line stays "quote required".

### Granite range

- Granite as a stone type for flagstone, boulders and steps (Canadian Shield pinks, greys and charcoals).
- Sawn or thermal granite slabs as a rectangular product, only once the supplier sheet is in the catalogue.
- Granite slab steps added to the existing natural-stone step family.

### Boulders (landscape objects)

- **A shape library:** 4 to 6 CC0 scans (rounded glacial fieldstone, angular quarried, flat-top bench) instead of one rock.
- **Variation:** random yaw, and non-uniform scale within limits.
- **Burial:** about a third of the height below grade by default, adjustable.
- **Stone type and tint.**
- **Takeoff:** weight from volume and density, giving tons and a "machine-set" flag above a weight limit.
- **Patio fit:** a boulder dropped on or beside a flagstone area scribes into it.

### Boulder retaining wall (new wall product)

- **Options:**
  - Stone type.
  - Boulder style: rounded fieldstone, quarried, or gauged flat-top "guillotine".
  - Course height class, for example 18, 24, 30 or 36 in.
- **Rules from §2b:**
  - First course buried 6 to 12 in.
  - Setback per course scaled to wall height, 6 to 8 in on tall walls.
  - Staggered seams.
  - Faces on one flowing line that follows the wall path.
  - Top course levelled to one line.
- **3D:** real rock scans along the path, not boxes, with open-graded backfill behind every course, fabric and a drain.
- **Takeoff:** boulders by size class, tons, face sq ft, backfill yd³, fabric and drain pipe. Wall-height engineering warnings stay as they are.
- **Armour stone gets its own realism pass:** varied block lengths and rough quarried faces instead of identical boxes. Ontario armour stone sizes must come from a supplier sheet.

## 4. Phases

Each phase is its own PR off `main`, with tests first, the deploy gate and screenshots. Days are rough.

| Phase | What ships | Days |
|---|---|---|
| NS1 | Boulders that read as real: shape library, burial, stone type, tonnage. Small, and visible on every design that has boulders. | 2–3 |
| NS2 | Natural flagstone surface for patios and walkways: layout generator with the rules, 3D slabs and joints, build-up, takeoff. | 6–8 |
| NS3 | Paver borders on flagstone, constant-width walkways, scribing around boulders, walls and steps. | 3 |
| NS4 | Boulder retaining wall product, plus the armour stone realism pass. | 5–7 |
| NS5 | Granite range: granite flagstone colours, granite steps, and sawn granite slabs if the supplier data is in. | 2–3 |

## 5. Owner decisions

- **D1 Default flagstone style.** Recommended: cut-to-fit with an even 1½ in joint (Dan's method), with natural dry-laid as the second option.
- **D2 Default joint fill.** Recommended: permeable chips in black, which is what Dan shows most. Wide-joint polymeric is the alternative.
- **D3 Stone, colours and prices.** Which flagstone, boulder and granite you actually buy, and from which yard. The coverage per ton, the waste % and the installed rates. Until you set them, natural stone lines price as "quote required".
- **D4 Wording.** Dan calls "two-finger joint" his trademark and says it is patented. DeckCraft should say "cut-to-fit, even 1½ in joints" and not use his name for it. Mentioning his name in marketing is your call.
- **D5 Boulder wall pricing basis.** Per face sq ft or per ton, and which boulder size classes to offer.
- **D6 Start order.** Recommended: NS1 then NS2, because boulders are quick and flagstone is the biggest gap.

## Owner rulings (2026-10-20)

- D1: cut-to-fit with even 1½ in joints.
- D2: black permeable chips.
- D4: neutral wording.
- D3: natural stone prices as "quote required" for now.
- D6: NS1 first, then NS2.

## NS1 ledger: boulders

Worktree `.claude/worktrees/ns1-boulders`, branch `feat/deckcraft-natural-boulders`, base `origin/main` 3e94257.

### Scope Lock

**Objective:** boulders that read as real (shape library, burial, stone type, tonnage), while old saved designs render and price exactly as before.

**Acceptance checks:**

- **A1.** The library shows a single "Add boulder" entry. New boulders use one of 5 CC0 Poly Haven scan shapes:
  - round fieldstone `namaqualand_boulder_06`
  - domed fieldstone `_04`
  - quarried block `_03`
  - fractured quarried `boulder_01`
  - flat-top bench `_05`

  Each shape has its own default proportions. A random yaw and ±15 % size variation are baked into the saved rotation and envelope when the boulder is created.
- **A2.** Stone type recolours the rock in the live 3D and in Photo mode. The choices are granite (the default), limestone and sandstone. It works by normalising each scan to greyscale and multiplying by the stone colour.
- **A3.** New boulders are set a quarter of their height into the ground. The editor offers none, a quarter, a third and a half. The 3D lowers the rock by `burialIn`. `heightIn` is the full stone height.
- **A4.** Each new-format boulder gets an estimated weight in tonnes, shown in the editor and in its quote-line note. The weight is envelope × measured shape fill × density. Densities come from the AusIMM handbook table: granite 2.72, limestone 2.69, sandstone 2.42 t/m³. The line stays quote required (`amountCents: null`) and no price number is added.
- **A5.** Legacy `natural-boulder` objects with no new fields still validate, render the same way and produce byte-identical takeoff and quote lines. "Render the same way" means the same GLB, the same matrix, white tint and no burial. A frozen golden captured from base 3e94257 proves it.
- **A6.** These pass: `tsc --noEmit`, `npm run check:landscape`, `npm run check:deck` and the bundle budgets. Landscape GLBs stay under 16 MB. The assistant and agent APIs accept the new fields.

**In:**

- landscapeTypes(.ts and Runtime)
- landscapeCatalogue
- landscapeModel and landscapeModelRuntime (optional fields only)
- Landscape3D (tint and burial)
- LandscapeEditor (boulder fieldset)
- assistantPlan and deckAgentController field lists
- a new `scripts/build-boulder-library.mjs`
- a new `public/deckcraft/landscape/boulder-library-manifest.json` plus GLBs
- check-landscape-objects and a new boulder check
- devDependencies for the asset build only: glTF-Transform and meshoptimizer, the same tools that built the existing boulder

**Out:** NS2–NS5, the 2D plan symbol, shade rings, a machine-placement flag, any price, and the 15 frozen landscape GLBs and their manifest.

**Unchanged:** legacy boulder render, takeoff, quote and links; the empty takeoff shape; legacy parity goldens; bundle budgets.

### Progress

- 2026-10-20: subsystem map done (9-agent workflow; the critic verified 6 load-bearing claims).
- 2026-10-20: legacy golden captured at 3e94257 and committed as 97831f1.
- 2026-10-20: built test-first; `check-natural-boulders.ts` went red, then green.
- 2026-10-20: lint passed (exit 0), and the bundle budget passed with route chunk unchanged (new code is lazy).
- 2026-10-20: browser checks in headless Edge:
  - 3D shots of all 5 shapes and 3 stones;
  - editor flow at 1400 and 390 px;
  - contrast audit clean.
- 2026-10-20: the independent review (sonnet) found 0 CRITICAL and 4 IMPORTANT, all fixed:
  - **Texture mean.** It came out at 0.47–0.50 because of clipping and resizing in sRGB. The fix normalises after resizing with a clip-aware bisection, and a GLB-decoding test was added.
  - **Tint jitter.** Removed.
  - **"Add boulder" shape.** It now cycles through the shapes.
  - **Source-string tests.** Replaced with `landscapeSeatDyIn` behaviour tests.

### Surprises

- **`boulder_01` normals.** Its scan normals split nearly every vertex, so meshopt could not simplify it. Normals are now rebuilt as smooth, keyed by position.
- **Preview server config.** `preview_start` reads the main checkout's `.claude/launch.json`, not the worktree's.

### Decisions

- Shapes are new asset ids, `boulder-*`, kind `boulder`. Rendering, LOD and manifest are already keyed by asset id.
- `natural-boulder` stays valid but is hidden from the library, and only the new ids accept `stoneType` and `burialIn`.
- Choosing a shape on a legacy boulder converts it. The new envelope keeps the old volume, using the new shape's proportions.

### Deferred

- Contact shade ring for boulders.
- Boulders casting shadow at LOD2.
- Scribing into flagstone (NS3).
- 2D plan symbol.
- check:landscape is not in lint or CI. Propose adding it.

## NS2 ledger: natural flagstone

Branch `feat/deckcraft-natural-flagstone`, stacked on NS1 commit 3fa714f. The same worktree is used.

### Scope Lock

**Objective:** patios and walkways in real natural flagstone, laid the way Dan Preston lays it:

- big cut-to-fit irregular stones with an even 1½ in joint;
- black permeable chips in the joints;
- 2 in stone on a 1 in chip bed, over the existing ¾ in clear base;
- priced as quote required.

**Acceptance checks:**

- **B1.** A patio or walkway can be set to natural flagstone with:
  - a stone: granite, limestone or sandstone;
  - a joint width of 1–3 in, default 1.5 in;
  - a chip colour: black (the default), tan or grey.

  It saves as `productId: 'natural-flagstone'` plus a `flagstone` field, and old saves are unchanged.
- **B2.** The layout is deterministic: irregular, mostly 4- to 7-sided stones generated from a variable-radius Voronoi.
  - Stones are large: median at least 2.5 sq ft, none under 0.5 sq ft.
  - Every joint is a three-way junction.
  - Stones are cut straight at the outline.
  - The gap between neighbouring stones is `jointIn` ± 0.05 in.
  - Moving or rotating the patio does not reshuffle the stones.
- **B3.** In 3D, each stone is its own slab:
  - tinted to the stone colour over the rock scan, with per-stone tone variation;
  - chips fill the joints to ⅛ in below the stone top;
  - no paver joint-grid relief;
  - exempt from the simplified preview.
- **B4.** The takeoff adds quote-required lines only:
  - flagstone supply, cut-to-fit and setting (sq ft);
  - estimated stone weight (t, AusIMM density);
  - joint chips (cu yd);
  - 1 in chip bed (cu yd).

  Base and excavation use the existing shared lines. There is no paver freight, no `STONE_TRADE` and no price number.
- **B5.** Every existing design is byte-identical. The proof is legacy parity, saved-design migration, the boulder golden, the price book and the engine snapshot.
- **B6.** These pass: tsc, lint/check:deck and bundle budgets, with a new `check-natural-flagstone.ts` in check:deck. The agent and assistant accept the field.

**Out:**

- paver border and scribing (NS3);
- inlays on flagstone (skipped with a warning; the editor hides them);
- a displaced cleft top (the normal map stands in for it);
- one shared stone field across touching flagstone patios (each patio lays its own).

### Progress

- 2026-10-20: 3 read-only Explore maps (data/layout, 3D, picker/takeoff/tests).
- 2026-10-20: built test-first. `check-natural-flagstone.ts` went red (missing module), then green.
- 2026-10-20: headless Edge:
  - 3D shots;
  - flagstone chooser at 1400 and 390 px;
  - contrast audit clean;
  - switching to a paver product clears flagstone.
- 2026-10-20: the independent review (sonnet) found 1 CRITICAL, 4 IMPORTANT and 11 MINOR. The CRITICAL and IMPORTANT items are all fixed; the reload and preview fixes were mutation-checked.

### Decisions

- **Product id.** The flagstone product id is outside `PAVER_BRANDS`, so it is never priced as paver and never charged pallet freight.
- **Quote rows.** Rows come from the advanced runtime as `assemblyQuoteScopes`.
- **Bedding box.** The bedding box for flagstone is the chip layer, rising to 1/8 in below the stone. It shows as the joints.
- **Large slabs.** About 30 % of stones take in a neighbour, but only across at least 10 in of shared edge.
- **Route bundle.** The route bundle was over by 0.04 KB. It was fixed by:
  - splitting `flagstoneSpec.ts` off the lazy `flagstone.ts`;
  - regex checks in the validator;
  - reusing an existing error string;
  - reading `f.flagstone` directly, which is safe because design data arrives through JSON.parse or structuredClone.

  Route JS is now 276.0/276 KB, so **zero headroom is left.**

### Surprises

- **`yardArea` units.** `yardArea` returns sq ft, not in²; the first draft divided by 144 twice.
- **Size variation.** Variable-radius dart throwing alone gave near-uniform stones. Random slab merges gave real size variation.
- **Bundle chunking.** A module shared by eager and lazy code lands whole in the route chunk.

### Deferred (MINOR)

- **Snap-edge restraint on mixed designs.** On a mixed design (a priced paver patio plus flagstone), snap-edge restraint is priced on the union perimeter, flagstone included. Unpriced supplier patios already behave this way. **Owner call.**
- **Disposal bins.** Disposal bins (`BIN_COST`) include the flagstone dig, as they do for supplier patios. **Owner call.**
- **Pool reconcile.** With a pool present, pool reconcile recomputes `quantities.beddingYd3` from the 2.875 in chip box. Only the feature quantity is affected, not the quote row.
- **Paver budget.** `projectedYardPavers` counts phantom 12×24 pavers for flagstone against the 20k budget, which is conservative.
- **Walls.** A spec set on a wall gets a generic error. The agent descriptor text doesn't list flagstone values.
- **Small patios.** Patios under about 3×6 ft can't reach the 2.5 sq ft median stone.
- **Cross-browser determinism.** `Math.hypot` could make layouts differ by a last bit between browsers. Layouts are derived, not saved.
- **Duplication.** `polysArea`/`signedArea`, the outline point list and the seeded RNG are duplicated.

## Sources

- Hardscape Mentor YouTube channel, video IDs above: https://www.youtube.com/@hardscapementor
- Permeable flagstone joint: https://www.hardscapementor.com/blog/Permeable-Flagstone-Joint-Tutorial
- Flagstone joint filler: https://www.hardscapementor.com/blog/How%20to%20Install%20Flagstone%20Joint%20Filler%20the%20Right%20Way
- Boulder retaining wall: https://www.hardscapementor.com/blog/how%20to%20build%20a%20boulder%20retaining%20wall
- Dan Preston bio: https://www.pondtrademag.com/author/danpreston/ and https://www.hardscapementor.com/blog/Building-Hardscape-Mentor-Meet-The-Founders
- Unilock granite 25 mm (Ontario): https://contractor.unilock.com/wp-content/uploads/render_pdf/techsheets/granite/granite_25_ontario.pdf
- Flagstone coverage per ton (supplier catalogue): https://www.rockhardlandscapesupply.com/sites/default/files/2025-11/rockhardlandscape_showcasecatalog_jan2020.pdf
