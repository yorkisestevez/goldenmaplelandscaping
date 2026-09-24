# DeckCraft redesign baseline (R0)

The figures the "Drawing Set" redesign (R1–R7) is measured against. Recorded 2026-09-24 on `feat/deckcraft-r0-prep`, cut from `f2bfb8d` (feat/deckcraft-v2 with F4, F5 and F7; F6 not yet in). R0 changes no rendered output, so the base and R0 columns describe the same page.

## Bundle (production build, gzip)

| | Base `f2bfb8d` | R0 |
|---|---|---|
| Route first-load JS, as `check-deck-bundle.ts` counts it | 180.02 KB (prints 180.0) | 180.16 KB (prints 180.2) |
| of which the route chunk `DeckDesigner-*.js` | 170.67 KB | 170.80 KB |
| of which its other imports (estimatorHandoff 7.20, leadScoring 0.78, SEO 0.76, route entry 0.27, eventId 0.18, projectBudgets 0.17) | 9.36 KB | 9.36 KB |
| Route CSS `DeckDesigner-*.css` | 6.53 KB (32,613 bytes raw) | the same file, byte for byte |
| 3D viewer chunk | 291.3 KB | 291.3 KB |
| PDF engine chunk | 126.0 KB | 126.0 KB |

The route budget is 185 KB, so R0 leaves 4.8 KB. Fonts are not counted anywhere yet: the page uses the site-wide Inter and Cormorant Garamond only.

## Load performance

`node scripts/measure-deck-perf.mjs 5`: Pixel 7, 4× CPU slowdown, Slow 4G, the production build served gzipped by `e2e/static-server.mjs`, median of 5 runs. JS transferred was 699 KB in every run.

| Build | Run | FCP / LCP | Blocking time | Long tasks before the 3D viewer is requested | 3D viewer requested at |
|---|---|---|---|---|---|
| Base | 1 | 2,364 ms | 1,805 ms | 376 ms | 5.3–5.4 s |
| Base | 2 | 1,772 ms | 1,687 ms | 480 ms | 4.5–5.9 s |
| R0 | 1 | 2,620 ms | 2,307 ms | 639 ms | 4.7–5.9 s |
| R0 | 2 | 2,592 ms | 2,431 ms | 637 ms | 4.7–5.6 s |

The same builds measured in alternation (6 runs each, base and R0 taking turns, so load on the machine falls on both alike):

| Build | FCP / LCP median | Blocking time median |
|---|---|---|
| Base | 2,612 ms | 2,420 ms |
| R0 | 2,572 ms | 2,396 ms |

**Baseline for later phases: LCP 2,572 ms and blocking time 2,396 ms** (the R0 medians from the alternating run).

**The noise is larger than the gates.** On this machine, single runs of the same page ranged from 1,448 to 2,700 ms for LCP and from 1,583 to 4,436 ms for blocking time, and the medians of two 5-run sets of the base build differed by 592 ms. The phase gates (LCP no worse than +100 ms, blocking time no worse than +50 ms) are well inside that spread. So compare each phase against a base build measured in the same session, in alternation, rather than against the figures above.

## Rendered output

- The prerendered `/deck-designer/index.html` is identical to the base once asset hashes are masked (39,901 bytes in both).
- `DeckDesigner.css` is byte-identical, with the same hashed file name.

## Tests

- e2e: 28 tests on the base; 29 on R0, the new one being "reaches every feature of the designer". It covers every row of the plan's reachability matrix except F6 deck-part finishes, which has a TODO until F6 lands.
- All layout-dependent locators in `e2e/deckcraft.spec.ts` go through the helpers at the top of the file: `price`, `size`, `schedule`, `quotes`, `summary`, `openSection`, `viewTab`, `contractorView`, `contractorFiles`, `openExterior` and the rest.
