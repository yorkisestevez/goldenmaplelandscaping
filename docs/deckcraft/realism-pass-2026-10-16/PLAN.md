# DeckCraft house and yard realism pass: plan for approval

2026-10-16. A plan only: nothing is built, committed or merged. This folder is untracked, and the repo is public, so keep it out of commits.

> **Scope change, 2026-10-17 (owner):** realism work is now **only** for the house, construction materials and the
> plants and trees placed in a design. **R1 stays.** **R2 and R3 are dropped:** lawn and grass, context and
> background trees, presentation ground, and the default backyard. R4 is a UI fix, not realism; it is parked.
> The next realism phase will be planned within the new scope.

## What the live 3D shows today

Captured on goldenmaplelandscaping.ca/deck-designer/ with the realistic look on (RTX 5070, 1366×850).

| Shot | File |
|---|---|
| Corner | `before-corner.png` |
| Overview | `before-overview.png` |
| Front (eye level) | `before-front.png` |
| Showcase, corner (`?deck-quality=showcase&deck-context=1`) | `showcase-corner.png` |
| Showcase, overview | `showcase-overview.png` |

These are the problems, ranked by how fake they make the picture look:

1. **The house has no visible foundation.** The siding runs straight into the grass. An 8 in grey plinth is already modelled (`House3D.tsx`, `houseGeometry.ts`), but every wall is drawn from y = 0, over it, so it never shows. Real houses show 6–12 in of parged concrete under the siding.
2. **The default yard looks like a game map.** In the realistic look, `ShowcaseContext3D` draws up to 28 seeded trees around an open, unfenced lawn (`showcaseTrees` in `showcaseContext.ts`). From Overview they read as trees dotted over a golf course, and each one stands on a dark disc at the trunk. The fence and neighbour houses only come with presentation mode (owner decision with #164).
3. **The piers look like white discs.** The concrete is light grey (`#b0ada2` in `FootingDetails.tsx`, `#9aa3ab` in `Foundation.tsx`), flat and untextured, so in full sun it reads as white plastic.
4. **There's a lighter oval of grass in front of the camera.** At eye level (Front), the dense blade patch that follows the camera (`Turf.tsx` focus → `lawnTufts`) has a visible edge and a lighter tone than the lawn around it.
5. **In presentation mode, the ground outside the lot is too pale.** It looks washed out next to the yard lawn (`showcase-overview.png`).

## Phases: one PR each, with owner review between them

### R1: the house stands on a foundation, and the piers look like concrete

- Walls start at a **foundation reveal** above grade instead of 0, so the existing plinth shows. It gets a parged-concrete look: a warm mid grey with the shipped `masonry-detail.webp`, plus a 1 in drip edge where the siding overhangs it.
  - Files: `houseGeometry.ts` (`houseWallSpecs` / `buildHouseGeometry` wall base), `HouseFacade.tsx` (wall boxes start at the reveal; openings keep their heights), `House3D.tsx` and `HouseBlock3D` (plinth material, added blocks too), `houseWainscot.ts` (wainscot sits on the reveal).
  - Door sills are unchanged: they stay at deck height.
- **Piers:** darker cast-concrete material with a grime band at grade, in `FootingDetails.tsx` and `Foundation.tsx`. **Material only.** `foundationSolids.ts` feeds the takeoff, the typical section and the exports, so pier geometry is not touched, and nothing reprices.
- Exports: `designExports.ts` builds OBJ/DXF from `buildHouseGeometry`, so the exported house walls change too. Expect a refresh of the CAD/house goldens (`check-deck-cad-3d`, `check-deck-house*`). I'll show you the diff before refreshing.
- Budget: about +0.3 KB on the 3D viewer, which is at 335.0/340 KB. Pricing: none.

### R2: lawn and tree bases blend in (DROPPED 2026-10-17, out of scope)

- Feather the focus patch's blade density over its last ~25% and match blade colour to the lawn texture mean, so the oval disappears (`Turf.tsx`, `lawnTufts.ts`, `GrassBlades.tsx`).
- Find where the dark trunk discs come from (the tree proxy GLB's root, or the contact shadow) and replace them with a soft ground shadow and a few grass tufts (`ShowcaseContext3D.tsx`).
- Presentation mode: neighbour and street ground use the same lawn material and exposure as the yard (`showcaseContext.ts` ground grid, `ShowcaseContext3D.tsx`).
- Budget: everything here is in the lazy `ShowcaseContext3D` chunk or is shader constants. The viewer budget is unaffected. Pricing: none.

### R3: a believable default backyard (DROPPED 2026-10-17, out of scope)

Today's default is trees around an open lawn. The options:

- **A (recommended): a fenced lot by default, and no neighbour houses.** The realistic look draws the lot fence (`showcaseLotBounds` / `fenceRuns`, already built) and puts fewer trees (about 10–12) behind and along it, instead of 28 across open grass. The house side stays open, as it does now. Neighbour houses stay presentation-only.
- **B: no fence, tidier trees.** Trees cluster along an implied lot line and the back, with none on open lawn in front of the house, and there are fewer of them.
- **C: the full presentation context by default** (fence and neighbour houses). This looks the most finished, but it is the heaviest load and reverses the #164 decision.

Files: `showcaseContext.ts` (`showcaseTrees` count and placement, lot bounds), `ShowcaseContext3D.tsx` and `Environment3D.tsx` (which flag draws the fence).

Under any option, nothing is saved, priced or counted (`presentationOnly`). It loads only with the realistic look on capable devices, and it stays in the lazy chunk.

### R4 (small, optional; parked, not realism): the 3D toolbar at about 800 px

At 800 px wide, the 3D bar's **More** button covers **Realistic look** (seen in the live check). It's a CSS-only fix in `viewerBar.css`.

## How each phase is checked

- The same three cameras, before and after, saved in this folder.
- Checks: `npm run lint` (with `check:deck`, including `check-deck-realism` and `check-deck-house*`), `check-deck-bundle`, `check-site-rendering`, `check-yard-appearance`.
- e2e: the 3D specs, including the `@phone` "never downloads the 3D viewer until 3D is chosen" test.
- A real-GPU look in the browser pane: day, night and showcase.

## Questions for you

1. **Foundation reveal height:** a fixed 8 in (recommended, typical for Ontario), or one that follows deck height on high decks (deck height − 28 in, clamped to 8–24 in)?
2. **Exports:** should the reveal also show in the OBJ/DXF exports (same geometry everywhere; recommended), or only in the 3D view? Showing it in the exports means refreshing the CAD and house goldens after you've seen the diff.
3. **Default backyard:** A, B or C?
4. **Piers:** OK to change the material only, so no takeoff or price change?
5. **Order:** R1 → R2 → R3, with R4 slotted in anywhere, one PR each, merged only on your OK?
