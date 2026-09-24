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

## R6: price effect on each option

Recorded 2026-09-24 on `feat/deckcraft-r6-deltas`, cut from `63fdaa7` (R5).

### Engine timing spike

`calculateDeckReleaseEstimate`, bundled on its own for the browser, run in Edge under Playwright's Pixel 7 emulation at 1× and at 4× CPU slowdown (`Emulation.setCPUThrottlingRate`). Each design had one cold run, then 30 warm runs, and the whole spike was run twice. Ranges cover both sessions.

| Design | 1× median / max | 4× first (cold) run | 4× median | 4× p90 | 4× max |
|---|---|---|---|---|---|
| Default deck (16 × 12 ft, $24,388) | 2.2–2.4 / 4.9–6.1 ms | 137–150 ms | 10.5–10.7 ms | 15.9–18.6 ms | 29.7–37.4 ms |
| Two-corner wrap, check-deck-ledger's (22 × 12 ft, 8 ft and 6 ft wings, $81,204) | 6.1–6.5 / 12–15 ms | 78–117 ms | 25.5–27.2 ms | 35–36 ms | 47–54 ms |
| Larger two-wing wrap (30 × 14 ft at 48 in, two 12 × 16 ft wings, glass railing, two flights, one border row, $253,220) | 13.5–13.6 / 20–23 ms | 80–92 ms | 62–63 ms | 77–89 ms | 82–97 ms |

**Phone decision: tap to show.** The two-corner wrap's slowest runs pass 50 ms at 4×, and the larger wrap's median does too. Phones (and any screen without a fine pointer, or with Save-Data) get a "Show price effect" button in each section with option groups. Once tapped it stays on for the visit. Desktops show the deltas without asking.

Pricing single options showed that a herringbone layout is the outlier. In Node, warm, it takes 44 ms on the two-corner wrap and 121–126 ms on the larger wrap, against 9 and 15 ms for the design itself. In the browser on this desktop at 1×, those runs were 55–69 ms and 183–205 ms. One option per idle slice on the page could not keep that under 50 ms. The deltas are therefore priced in a worker (`optionDeltas.worker.ts`), one option per task, and the page only receives each result. The idle-slice runner stays as the fallback wherever a worker cannot start.

### Long tasks attributable to the deltas (desktop)

This harness is `scratchpad/r6/delta-longtasks.mjs` against the production build at 1280 × 900. It loads each design, opens Boards & finish, Stairs & railings and Site & foundation, and waits for every delta. It then picks a collection, so every open option is priced again for the new design, and waits again. The page's work on each result is a user-timing measure (`deckcraft-option-delta`). A long task counts as the deltas' when it contains one.

| Design | Results | Page work per result (median / max) | Long tasks after settling | Attributable to deltas |
|---|---|---|---|---|
| Default, 1× | 114 | 0.3 / 6.1 ms | 0 | 0 |
| Two-corner wrap, 1× | 114 | 0.4 / 0.7 ms | 0 | 0 |
| Larger wrap, 1× | 114 | 0.4 / 0.9 ms | 1 (73 ms, the page's own re-estimate after the click) | 0 |
| Default, 4× | 114 | 1.6 / 6.3 ms | 1 (105 ms) | 0 |
| Two-corner wrap, 4× | 114 | 2.7 / 4.9 ms | 1 (162 ms) | 0 |
| Larger wrap, 4× | 114 | 3.1 / 11.8 ms | 2 (56, 556 ms) | 0 |

With the pricing on the page, before the worker, the same run at 1× had two attributable long tasks on each wrap: 69 and 55 ms, and 205 and 183 ms. Both were the herringbone option, once per design.

### Load (hermetic A/B against `63fdaa7`)

The harness is `perf-ab.mjs`, with the `measure-deck-perf.mjs` settings: Pixel 7, 4× CPU, Slow 4G, a 12 s settle, trackers answered empty and fonts stubbed. The two builds take turns run by run.

On this machine LCP falls into one of two modes, about 1.2–1.3 s or about 2.0–2.2 s, in both builds alike.

| Run | Base LCP / blocking | R6 LCP / blocking | Within-mode LCP |
|---|---|---|---|
| 5 pairs | 1,344 / 146 ms | 2,124 / 139 ms | fast runs −12 ms (3 base, 2 R6), slow runs +126 ms (2 base, 3 R6) |
| 10 pairs | 2,160 / 264 ms | 2,126 / 200 ms | fast runs +12 ms (2 and 2), slow runs −34 ms (8 and 8) |

The 5-pair medians differ only because base drew three fast runs and R6 two. R6 adds nothing to the first load: 0.11 KB of JS, and no delta runs until a section with option groups is open. Across 15 pairs the builds are level, and CLS was 0 in every run.

### Bundle

| | `63fdaa7` | R6 |
|---|---|---|
| Route first-load JS | 176.41 KB | 176.52 KB |
| Route CSS | 8.54 KB | 8.66 KB |
| `useOptionDeltas` chunk (with the option groups), loaded with the section bodies | – | 2.4 KB |
| `optionDeltas` chunk, loaded once deltas are wanted | – | 1.9 KB |
| `optionDeltas.worker` (its own copy of the engine), started with the first delta | – | 122.5 KB (budget 140) |
