# Plants and trees: revised for "photoreal"

2026-10-17. The owner's verdict on PLAN.md was "they dont look real enough". This revision raises the bar to photoreal and says honestly what that takes. It is a plan only: nothing is committed, bought or downloaded.

## 1. What "real" can mean in a browser

Five research agents covered paid libraries, owner capture, rendering, free high-end sources and AI. Two sceptics then checked licences and realism claims. They agree on the ceiling, whatever the assets cost:

| Where | Best achievable with the best assets | Notes |
|---|---|---|
| **Photo-mode stills** (the path-traced "photo" button) | About 8–9/10. A homeowner may not tell it from a photo. | Needs real leaf transmission in Photo mode (today it fakes it with an emissive glow). The WebGPU tracer gets about 9/10. |
| **Desktop live view, camera still** | About 7–8/10. Twinmotion/Enscape class. | Needs the render fixes below. |
| **Phone, or any orbiting view** | About 6/10 still, 4–5/10 while moving. Convincing 3D, never a photo. | True for every route, paid included: phones get the lighter models. |

So the realistic promise is: **photo-like stills and desktop frames, plus a clearly better, CG-tell-free phone view.**

## 2. What the demo shows

These were captured locally and are not committed:
- `demo/compare-corner.png`
- `demo/compare-front.png`

Left is today; right is the same plants with only the render bugs fixed. The fixes:
- an opaque canvas;
- matte leaves with no colour lift;
- plants sitting on the mulch instead of buried in it.

From a distance, the speckle is gone and the plants read as solid foliage. Up close, the shrubs are still blobs of oversized leaves.

**Conclusion:** the render fixes are necessary but not enough. The models and their leaf textures set the ceiling.

**Correction to PLAN.md P0.** `alpha:false` in the Canvas `gl` props does nothing in three.js r185, because WebGLRenderer always creates its context with `alpha:true`. The demo proved it: the plants still turned magenta. The fix that works is to create the WebGL context ourselves with `alpha:false` and pass it to the renderer, then set tone mapping in `onCreated`. The magenta probe was clean with this fix.

## 3. Routes to photoreal, after licence verification

| Route | Realism | Can it ship on our public site and repo? | Cost |
|---|---|---|---|
| **A. Your own photos of the actual cultivars on species-true 3D shapes.** Leaf, needle, petal and bark sheets shot on a light pad with a colour checker, put on in-repo built geometry. | Highest licence-clean option. Every leaf is a real photo of the plant you install. | **Yes.** Golden Maple owns the photos. | Gear about C$350–700 (colour checker, LED light pad, polariser film), each item for your approval. About 1–1.5 h of shooting per species. |
| **B. Bentley e-on PlantFactory** (VFX-grade plant modeller, free since 2024) for shapes the generator can't reach, most likely trees. | PlantCatalog/VFX grade. | **Yes, for models we build ourselves.** But the free EULA forbids paid contractors doing the work for us, so **your own staff** would have to run it (or Bentley gives written permission). It is a desktop GUI tool I can't drive reliably. | $0 software; staff time about 0.5–2 days per species. |
| **C. Free CC BY models at species level.** Only the PlantCatalog Colorado blue spruce is clean. | High. | Yes, with attribution. It also needs a carve-out in the site Terms, because our Terms claim all content and CC BY forbids extra restrictions. | $0 |
| **D. Paid libraries** (Maxtree covers about 17 of the 26 species; Megascans, SpeedTree, Xfrog). | Highest at source. | **Effectively no.** Maxtree and Fab forbid use in tools that let users export work. DeckCraft exports stills, video and PDFs. Each paid licence also requires stopping users extracting files, and no paid licence allows a public repo. Rendering on a server does not get around this. A written exception from each vendor would be needed (outreach is yours). Fine for private side-by-side reference only. | $26–156 per species (Maxtree), plus vendor approval |
| **E. AI** (browser image generation, image-to-3D). | Weak botanically (expert study: 2.2/5 for botany); image-to-3D fuses leaves into lumps. | Outputs are owned by us. | Use only as a labelled stopgap texture, with your per-batch approval. **Rejected** as a source of plants. |
| **F. Gaussian splats** of real plants. | Most photographic from captured angles. | Owned, but they don't take the sun, cast shadows or appear in Photo mode, and the runtime adds about 910 KB. | **Rejected** for the yard. |

**Recommendation:**
- Route A for all 26 species, on the in-repo geometry.
- Route B by your staff only if the bake-off shows a tree or shrub shape the generator can't reach.
- Route C for blue spruce, if you accept CC BY and the Terms carve-out.
- No paid libraries.

## 4. The catch: seasons

It is mid-October. Only some species can be photographed in their summer look now.

| When | What can be shot |
|---|---|
| **Now, before hard frost** | Emerald cedar, boxwood (before winter bronzing), yew, white pine, blue spruce. Also the grasses in their autumn state (Karl Foerster tan plumes, switchgrass gold, little bluestem copper). |
| **May–August 2027** | Summer leaves and flowers of the maples, redbud, serviceberry, all shrubs and all perennials. |

Until then those species use the plan's CC0-detail textures, or an approved, labelled AI stopgap.

## 5. Revised order

Each step is one PR with your look sign-off. Nothing merges without your OK.

1. **R-P0, render foundation (about 6–8 days).**
   - Opaque context (corrected fix) plus the measuring probe.
   - Foliage shader v2: real translucency injected where it actually renders, matte leaves, crown normals, no colour lift.
   - Coverage-preserving alpha mips.
   - PCSS sized to the real sun.
   - Photo mode: the emissive leaf glow replaced by real thin-leaf transmission, and a realistic sun size.
   - Applies to every plant, today's included.
2. **R-P1, beds (about 4.5 days).** Plants sit in mulch, the spade-cut taper, collars, contact shade, flush edging and honest mulch colours, as in PLAN.md P2.
3. **R-P2, emerald cedar pilot, built from your photos (about 6–9 days, plus about 3 h of your shooting this month).**
   - Emerald cedar is 76 of the 273 showcase plants and can be shot now.
   - Judged blind against your own photo of a real hedge from the same camera positions, live and in Photo mode.
   - Optionally include a private, never-shipped Maxtree or Megascans reference as the "ceiling" arm.
4. **If the pilot passes your eye:**
   - Boxwood, yew, white pine, spruce and the grasses this fall.
   - Everything deciduous after the 2027 summer shoot.
   - Interim textures meanwhile.

**Honest total:** about 47–60 agent-days for all 26 species, not the 34.5 in PLAN.md. That is plus your shooting time across two seasons.

## 6. Decisions for you

1. **Expectation:** photo-like Photo-mode stills and desktop frames, with a convincing but clearly 3D phone view. Is that the bar?
2. **Your photos:** will you (or staff) shoot the evergreens and grasses this month, and the rest next summer? Approve the gear list (about C$350–700) when I itemise it.
3. **PlantFactory:** is there anyone on staff who could build trees in it, or do we stay with the in-repo generator?
4. **Blue spruce:** accept CC BY with a Terms carve-out, or build it like the others?
5. **Paid libraries:** agree to drop them, apart from private reference?
6. **Start:** R-P0 render foundation now, then the emerald cedar pilot?
