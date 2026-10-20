# Hydrangea pilot: spec for owner approval

Written 2026-10-20. Branch `feat/deckcraft-hydrangeas`, built off main 3e94257. This is a plan only; nothing is built until you approve it.

## What you asked for

"Flowering hydrangeas and all those plants you can have in Ontario, and they need to look real." Your choices:
- the hydrangea pilot first;
- free CC0 photos now, swapped for your own photos in summer 2027;
- about 70 Ontario nursery staples afterwards, with natives flagged and invasives left out.

## Today

Annabelle and panicle hydrangea both draw on the same generic broadleaf mound, which comes from an African tree model. Its leaves are about 12× real size. The "flowers" are 5–6 flat white discs drawn by code. Endless Summer is not in the catalogue.

## What the pilot builds

Three hydrangeas, each built in-repo to its real botany. Every number comes from `research/botany.md`, which cites patents, Proven Winners and the extension services.

| | Limelight (panicle) | Annabelle (smooth) | Endless Summer (bigleaf) |
|---|---|---|---|
| Shape | Upright, 8–15 woody canes; cone heads standing up, leaning a little | 15–40 thin canes that **arch and flop** under the heads | Compact mound, 10–25 canes |
| Leaves | Opposite pairs, 3.5 × 2 in, matte, rough | Opposite, 5 × 3.5 in, matte, coarse teeth | Opposite, 5 × 3.5 in, **glossy** |
| Flower head | Cone 8 × 6 in, made of hundreds of real 4-sepal florets | Dome 10 in across, about 0.75 as deep as it is wide | Dome 5 in across, about 100 round florets |
| Default colour (mid-July, the default) | Lime-white | White | **Pink.** Ontario soil is mostly alkaline. Blue is a later option. |
| Size drawn | Today's 48 in shrub, with blooms in proportion | 36 × 40 in | 36 × 36 in (new species) |

**Florets.** Each floret is a small card textured from a real CC0 photo of a single floret, with a cut-out outline. The cards sit on the dome or cone with varied tilt and size, so a head reads as many small flowers rather than a white blob. The florets are tinted per instance, so a single photo texture can show lime, white, pink and tan. That makes the seasonal colours (Limelight goes white → pink → burgundy → tan; Annabelle goes white → green → tan) simple to add once the seasons work lands.

**Leaves.** Each leaf is a card textured from a CC0 photo of one real leaf at its real size, with a separate underside photo for the back. The leaves use the R-P0 foliage lighting.

**Detail by distance.**
- Close: full florets.
- Middle distance: florets merged into clusters.
- Far: one textured head shape.

Phones get the middle level at most. Photo mode gets a capped floret count, because the path tracer merges every copy into one mesh.

## Photos (CC0 only)

The research agent found 73 iNaturalist photos and checked each by API: `license_code` is exactly `cc0` for all of them. The list is in `research/inat-cc0-candidates.json`.

| Use | Main pick (photo id, observer) |
|---|---|
| Limelight floret | 707468034 (jacob_mullin), single 4-sepal macro; 148820289 (leighmus) for lime tone |
| Limelight leaf | 730410163 (roberto-rizzi), with 702347193 for the underside |
| Annabelle floret | 47732501 (lvdt), single sterile floret macro |
| Annabelle leaf | 566636864 (skylar_schell) |
| Endless Summer floret | 422983973 (marinolinic), single pink floret |
| Endless Summer leaf | 601598413 (fabiotenshi), glossy |

**How the photos get in:**
- A script downloads the chosen originals to a local cache, which git ignores.
- It cuts each one out and colour-balances it, using crop and outline settings recorded in a committed manifest.
- It writes small texture files (about 512 px each, roughly 150–250 KB in total) to `public/deckcraft/landscape/hydrangea/`.
- The manifest records each photo's id, observer, URL and licence. A check in `check:deck` fails if any texture lacks a CC0 entry.

**Caveats:**
- Most garden-plant photos are graded "casual" on iNaturalist, because cultivated plants aren't wild. The licence is the same.
- The photos show these species, but nobody verified the exact cultivar. "Limelight-like" is honest until your 2027 shoot replaces them.

## Acceptance checks (the scope)

1. WHEN a design has an Annabelle, a panicle hydrangea or an Endless Summer, THE SYSTEM SHALL draw canes, opposite leaves and floret-built heads. Leaf and head sizes must be within ±15% of `research/botany.md`, checked by a script that measures the built geometry.
2. Every hydrangea texture file has a manifest entry with licence `cc0`, a photo id and an observer, and the check fails otherwise.
3. **Your eye.** Side-by-side images of the three hydrangeas, close up and in a bed, next to a real CC0 habit photo at a similar framing. Live view, phone view and Photo mode. You sign off, or it doesn't merge.
4. **Speed.** On the showcase design (8 hydrangea placements), interleaved A/B runs against main stay within 1.15× on every quality tier. The bundle gate still passes.
5. **Nothing else changes:**
   - saved designs, quotes, share links and prices;
   - every other species' look;
   - the legacy plant model files, byte for byte.

   Old designs with "Panicle hydrangea" simply start drawing as Limelight.
6. Endless Summer appears in the plant picker under Shrubs, with its sourced size and a note that it is pink in Ontario's alkaline soil.

## Not in this pilot

- The other ~67 Ontario species. Each comes after the pilot passes your eye, using the same method.
- Little Lime, Quick Fire, Incrediball and oakleaf. They come next, and are cheap once the three base models exist.
- Seasonal bloom colours: wired after the Seasonal design variations session merges, because it is editing the same bloom file right now. The colour table is ready in `research/botany.md`.
- A blue-hydrangea option, your own photos, and the cedar pilot.

## Risks

- The seasons session is changing `plantBlooms.tsx` and `Landscape3D.tsx` right now. The hydrangea code goes in its own files with a short hook, to keep the clash small. Whichever lands second rebases.
- Floret counts are what makes this look real. If phones slow down, the phone level uses fewer, larger cluster cards.
- iNaturalist originals are at most 2048 px. That is plenty for 512 px cut-outs, but the cut-outs need careful outlines.

## Ledger

**Approved by the owner on 2026-10-20:** "Approved. Build the hydrangea pilot as written in SPEC.md."

### Built

**Model**
- `hydrangeaCultivars.ts` maps species to cultivar and holds the triangle costs per level of detail.
- `viewer3d/hydrangea/` holds:
  - `hydrangeaSpecs.ts`: the botany.
  - `hydrangeaModel.ts`: the seeded builder.
    - Canes, opposite leaves (whorls of 3 on Limelight), and heads built from florets around a core.
    - Fill shoots for a leafy base.
    - A positions-only fit to the envelope.
  - `hydrangeaTextures.ts`: atlas layout and measured fill.
  - `Hydrangeas3D.tsx`: one node per plant, each level of detail built once.
    - Instanced double-sided leaves: the photo upper side on the front, the underside row on the back.
    - Instanced florets and head cores.
    - Stems.
    - Shared materials per cultivar. The file is lazy-loaded.

**Shared files**
- `Landscape3D.tsx` routes hydrangea species to the new renderer, away from the shrub GLB and the flower cards.
- `landscapeRenderLods` uses the hydrangea triangle costs.
- `foliageLighting.ts` takes an optional per-instance outward direction for leaves.

**Catalogue:** Endless Summer added; the palette now has 27 species.

**Textures**
- `scripts/build-hydrangea-textures.mts` builds `public/deckcraft/landscape/hydrangea/{florets,leaves}.webp` (67 KB and 145 KB) from 8 CC0 iNaturalist photos.
- `SOURCES.json` records each photo's licence, observer and observation, plus each texture's SHA-256 and measured fill.

**Checks**
- `scripts/check-hydrangeas.ts`: 60 checks, sizes against the sourced botany ranges.
- `e2e/deck-hydrangeas.spec.ts`.

### Decisions

- **Leaf width.** Leaves use the sourced width, not the photo's own aspect. Limelight's photo leaf is narrower than the patent range.
- **Endless Summer underside.** It is its upper-side photo recoloured, because no usable CC0 underside photo was found. This is recorded in SOURCES.json.
- **Annabelle floret cut-out.** It uses the drawn four-sepal outline only. The photo is soft, and its colour runs into the finger behind it.
- **No floret cap in Photo mode.** Photo mode bakes every instance. The hydrangea demo traced 778k triangles to 96 samples in 81 s on this GPU, so no cap was needed.

### Speed (acceptance check 4)

The test scene is the estate showcase, with 31 hydrangeas (19 Annabelle, 12 Limelight) and 273 plants in all. Probes run interleaved against an exact main build on this machine's GPU (`scripts/plants-probe.mts`).

**First build: failed.** The 95th-percentile frame was 2–2.6× main on the high and balanced tiers.

The cost was not in the median frame; it was in two kinds of spike:
1. **Detail-level changes during an orbit.** Each change rebuilt the cultivar's whole shared instance group in JavaScript (every leaf and floret matrix, plus a merged stems mesh) and re-uploaded several MB of buffers.
2. **Shadow redraws.** The sun's shadow map redraws about one frame in three. Before the fix it cost 16.7 ms against 2.4 ms on main; per-frame timing showed the spikes sat in those frames, where the re-uploads landed.

Three things did not cause it:
- hiding any single part (florets, leaves, cores or stems);
- turning off any single shadow caster;
- shader recompiles.

**Fixes**
- Each plant is its own node.
- Each level of detail is built once, with its own GPU buffers in plant inches.
- A level change shows one set of meshes and hides another, with no re-uploads and no per-instance work.
- Leaves are one double-sided card, whose back face samples the underside row; this takes 2 draws per plant down to 1.
- Florets do not cast shadows. Leaves and head cores do.
- Petioles are drawn close up only.
- Distant cores and canes are coarser.

### Surprises

- **Shared node_modules.** A node_modules junction to another worktree makes Vite's dev server refuse files with a 403. This worktree now has its own `npm ci`.
- **Detail-level costs.** Each hydrangea is far more triangles than the shrub GLB. The detail-level budget now costs it by species, so a crowd of hydrangeas still steps down with distance.

### Rebase onto seasons (PRs #188 S1, #189 S2, then S3)

These are the seasons session's notes:
1. Leave hydrangea objects out of `<PlantStems>` too, as with PlantBlooms. The hydrangea canes are the winter stems.
2. PlantShadeRings keeps hydrangeas in winter, because they have stems. That matches the canes.
3. Fall and spring leaf colours come from the hydrangea table. `seasonMode` and `recolor` only touch the GLB groups.
4. Snow: S2's SeasonScene patches every MeshStandardMaterial in winter. Set `userData.snow='none'` on any hydrangea material that shouldn't take it.
5. S3's winter photo bake skips alpha-tested and instanced materials.

### Independent review (2026-10-20)

**Finding 1 (IMPORTANT), fixed.** Selecting a hydrangea drew one outline per card, thousands of them.
- Now one invisible pick box per plant handles picking and the outline. It is never drawn, and Photo mode skips it.
- The cards are not raycast.

**Finding 2 (IMPORTANT), fixed.** The plant cache was module-level, so it would have been shared across viewers. It is now per viewer and disposed with that viewer.

**Also found and fixed:**
- **Colour space.** The atlas cell clones were sampled as linear, because R3F only marks textures sRGB when they are set through JSX props. They are now sRGB, so leaves render a truer, deeper green and florets show more shading than in the look first signed off.
- **Duplicate atlas upload.** It came from mismatched anisotropy.
- **Smaller fixes:** dead fields, a duplicated cut-out step, and a check that every published hydrangea file is in the manifest.

**Re-review:** both findings resolved, nothing new above MINOR.

### Deferred

- **Photo mode undersides.** Photo mode shows the upper-side photo on both faces of a leaf, because the underside is a raster-only shader switch, and the per-leaf crown normals are not baked either.
- **Coarse picking.** A click anywhere in a hydrangea's envelope box selects it.
- **Detail budget.** A design with hydrangeas spends the shared near-detail triangle budget at hydrangea cost, so other plants in it may step down a detail level sooner than on main. This is render only.

- Seasonal bloom colours, after the seasons branch lands.
- Little Lime, Quick Fire, Incrediball and oakleaf.
- The other Ontario species.

## Size

About 6–8 agent-days, then your look review:
- geometry generator: about 3 days;
- photo pipeline: about 1.5 days;
- levels of detail, Photo mode and speed: about 1.5 days;
- checks and review images: about 1 day.

One PR. Nothing merges without your OK.
